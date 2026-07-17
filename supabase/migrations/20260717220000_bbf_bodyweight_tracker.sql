-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Sovereign Vault · BODYWEIGHT TRACKER — adult self-logged weigh-ins + goal
-- ───────────────────────────────────────────────────────────────────────────
-- The one thing missing from the adult Client Vault: a place for a client to log
-- their own weight toward a goal, on a GENTLE cadence (weekly — never daily, so
-- normal day-to-day fluctuation can't discourage them). Youth (Athlete Portal /
-- Support Hub) is deliberately excluded — this is an adult-vault surface only.
--
-- REUSE, DON'T DUPLICATE: weigh-ins are stored in the existing gram-native
-- time-series public.athlete_body_metrics (UNIQUE (athlete_id, measured_on) — one
-- row per day; a weigh-in is an upsert). We ADD only a numeric goal to
-- athlete_profiles (goal_body_mass_g + goal_set_at) — the legacy free-text
-- goal_weight is dead and is NOT resurrected. THE GRAM STANDARD holds: mass is
-- stored ONLY as integer grams; the UI converts lb/kg at the boundary.
--
-- AUTH: vault-token SECURITY DEFINER RPCs (the adult self-write pattern —
-- identical to biometricsApi / languageLabApi). The browser holds only the anon
-- key and can NEVER touch the RLS-forced tables directly; only these owner-run
-- functions write. _bbf_uid_from_vault_token → bbf_users.id, then the mandatory
-- hop bbf_users.id → athlete_profiles.user_id → athlete_profiles.id (the
-- athlete_body_metrics FK target). No new edge function (project is at its cap).
--
-- REMINDER: no server push exists; the "next weigh-in due" date is derived
-- client-side from the 7-day cadence the envelope returns (next_due_on). Calm by
-- design — a due date shown when the app opens, not a daily nag.
--
-- Applied via apply_migration (never db push); verify against the live catalog.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · numeric goal on the profile (additive; legacy goal_weight stays dead) ─
alter table public.athlete_profiles
  add column if not exists goal_body_mass_g bigint,
  add column if not exists goal_set_at      timestamptz;

comment on column public.athlete_profiles.goal_body_mass_g is
  'Adult bodyweight goal in integer grams (Sovereign Vault weight tracker). NULL = no goal set.';

-- Sane adult-bodyweight bounds in grams (≈20 kg / 44 lb … ≈400 kg / 882 lb).
-- Shared by every writer below so a fat-fingered entry can never poison the log.

-- ─── 2 · envelope helper — the one-read card state (owner-only) ────────────────
create or replace function public._bbf_bodyweight_envelope(p_pid uuid)
returns jsonb
language sql
security definer
set search_path to 'public'
as $function$
  with latest as (
    select body_mass_g, measured_on from public.athlete_body_metrics
     where athlete_id = p_pid order by measured_on desc limit 1
  ),
  first_in as (
    select body_mass_g from public.athlete_body_metrics
     where athlete_id = p_pid order by measured_on asc limit 1
  ),
  ser as (
    select measured_on, body_mass_g from public.athlete_body_metrics
     where athlete_id = p_pid order by measured_on desc limit 16
  ),
  prof as (
    select goal_body_mass_g, goal_set_at from public.athlete_profiles where id = p_pid
  )
  select jsonb_build_object(
    'ok', true,
    'cadence_days', 7,
    'current_g',        (select body_mass_g from latest),
    'current_on',       (select measured_on from latest),
    'start_g',          (select body_mass_g from first_in),
    'goal_g',           (select goal_body_mass_g from prof),
    'goal_set_at',      (select goal_set_at from prof),
    'last_measured_on', (select measured_on from latest),
    'next_due_on',      (select measured_on + 7 from latest),
    'count',            (select count(*) from public.athlete_body_metrics where athlete_id = p_pid),
    'series', coalesce(
      (select jsonb_agg(jsonb_build_object('on', measured_on, 'g', body_mass_g) order by measured_on asc) from ser),
      '[]'::jsonb)
  );
$function$;

-- Owner-only: this helper trusts a raw profile-id with NO token check, so it must
-- never be directly callable by client roles (that would be an IDOR — any weight
-- readable by profile-uuid). The token-gated RPCs below call it as the SECURITY
-- DEFINER owner, so revoking the client roles does not break the internal path.
-- (Supabase default privileges auto-grant EXECUTE to anon/authenticated on new
-- public functions, so revoking from PUBLIC alone is insufficient — revoke both.)
revoke all on function public._bbf_bodyweight_envelope(uuid) from public;
revoke execute on function public._bbf_bodyweight_envelope(uuid) from anon, authenticated;

-- ─── 3 · bbf_get_bodyweight — one-read hydration ───────────────────────────────
create or replace function public.bbf_get_bodyweight(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid; v_pid uuid;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  select id into v_pid from public.athlete_profiles where user_id = v_uid order by created_at asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'no_profile'); end if;
  return public._bbf_bodyweight_envelope(v_pid);
end;
$function$;

-- ─── 4 · bbf_log_bodyweight — upsert a weigh-in + mirror the current weight ─────
create or replace function public.bbf_log_bodyweight(
  p_session_token text,
  p_body_mass_g   bigint,
  p_measured_on   date default null,
  p_source        text default 'manual_checkin'
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid; v_pid uuid;
  v_day    date := least(coalesce(p_measured_on, (now() at time zone 'utc')::date), (now() at time zone 'utc')::date);
  v_source text := case when p_source in ('manual_checkin','intake','coach') then p_source else 'manual_checkin' end;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if p_body_mass_g is null or p_body_mass_g < 20000 or p_body_mass_g > 400000 then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;
  select id into v_pid from public.athlete_profiles where user_id = v_uid order by created_at asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'no_profile'); end if;

  insert into public.athlete_body_metrics (athlete_id, measured_on, body_mass_g, source)
  values (v_pid, v_day, p_body_mass_g, v_source)
  on conflict (athlete_id, measured_on) do update set body_mass_g = excluded.body_mass_g, source = excluded.source;

  -- Mirror the denormalized "current" weight to the LATEST weigh-in by date, so
  -- back-logging an older day never clobbers the current reading.
  update public.athlete_profiles ap
     set body_mass_g = lm.body_mass_g, body_mass_logged_at = now()
    from (select body_mass_g from public.athlete_body_metrics where athlete_id = v_pid order by measured_on desc limit 1) lm
   where ap.id = v_pid;

  return public._bbf_bodyweight_envelope(v_pid);
end;
$function$;

-- ─── 5 · bbf_set_weight_goal — set / clear the numeric goal ────────────────────
create or replace function public.bbf_set_weight_goal(
  p_session_token    text,
  p_goal_body_mass_g bigint
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_uid uuid; v_pid uuid;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  if p_goal_body_mass_g is not null and (p_goal_body_mass_g < 20000 or p_goal_body_mass_g > 400000) then
    return jsonb_build_object('ok', false, 'error', 'out_of_range');
  end if;
  select id into v_pid from public.athlete_profiles where user_id = v_uid order by created_at asc limit 1;
  if v_pid is null then return jsonb_build_object('ok', false, 'error', 'no_profile'); end if;

  update public.athlete_profiles
     set goal_body_mass_g = p_goal_body_mass_g,
         goal_set_at = case when p_goal_body_mass_g is null then null else now() end
   where id = v_pid;

  return public._bbf_bodyweight_envelope(v_pid);
end;
$function$;

-- Vault-token gated internally, so the client roles may execute (identical
-- posture to the Language Lab / biometrics self-write RPCs).
grant execute on function public.bbf_get_bodyweight(text)                         to anon, authenticated, service_role;
grant execute on function public.bbf_log_bodyweight(text, bigint, date, text)     to anon, authenticated, service_role;
grant execute on function public.bbf_set_weight_goal(text, bigint)                to anon, authenticated, service_role;

comment on function public.bbf_get_bodyweight(text) is
  'Sovereign Vault weight tracker · one-read hydration: current/start/goal grams, 16-point series, 7-day next-due. Vault-token gated.';
comment on function public.bbf_log_bodyweight(text, bigint, date, text) is
  'Sovereign Vault weight tracker · upsert a weigh-in (grams) into athlete_body_metrics + mirror current weight. Returns the refreshed envelope. Vault-token gated.';
comment on function public.bbf_set_weight_goal(text, bigint) is
  'Sovereign Vault weight tracker · set/clear the numeric bodyweight goal (grams). Returns the refreshed envelope. Vault-token gated.';
