-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab · Profile Guard & Backfill — no athlete reaches the Hub un-provisioned
-- ───────────────────────────────────────────────────────────────────────────
-- The cold-start orchestrator seeds athlete_profiles + athlete_nutrition_targets_
-- daily for every NEW checkout (all tiers, Fuel included). But it only runs on
-- newlyProvisioned — so LEGACY accounts and existing-user tier changes can reach
-- the Hub with those rows missing, sitting on Layer-2 defaults forever (no client
-- self-heal exists). This adds:
--
--   1. bbf_provision_athlete_baseline(user_id) — the idempotent core seeder:
--      creates the profile + today's body-metric + a 28-day FOUNDATION baseline
--      nutrition contract (the default-persona engine output — the graceful-
--      degradation targets when no body metrics are on file). Service-role only;
--      used by the backfill.
--   2. bbf_ensure_provisioned(uid, session_token) — the vault-token-gated guard the
--      client calls on landing: fast-path returns ready when the two rows exist,
--      else provisions and re-checks. anon/authenticated (self-gated by the token).
--
-- DISCIPLINE: baseline macros are the SAME numbers a real cold-start produces for
-- the default persona (180 lb / 18% / general / 4 d·wk → 3058 kcal · 147P · 327C ·
-- 129F, from _shared/fueling-core.ts). Nutrition tier is 'foundation' (day-1 truth);
-- the athlete's real subscription tier is untouched. Idempotent throughout.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · the idempotent core seeder (service-role) ──────────────────────────
create or replace function public.bbf_provision_athlete_baseline(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_profile_id uuid;
  v_created    boolean := false;
  v_day        date := (now() at time zone 'utc')::date;
  v_name       text;
  v_sub        text;
  v_locale     text;
  v_tier       text;
  v_bmg        bigint := 81647;   -- default persona: 180 lb (cold_start_defaults_v1)
  v_nut_rows   int := 0;
begin
  if p_user_id is null then return jsonb_build_object('ok', false, 'error', 'no_user'); end if;

  select coalesce(nullif(name, ''), 'BBF Athlete'),
         coalesce(subscription_tier, metabolic_tier),
         coalesce(nullif(preferred_locale, ''), 'en')
    into v_name, v_sub, v_locale
    from public.bbf_users
   where id = p_user_id and deleted_at is null;
  if not found then return jsonb_build_object('ok', false, 'error', 'user_not_found'); end if;

  v_locale := case when v_locale in ('en', 'es', 'pt') then v_locale else 'en' end;
  -- Display tier for the profile (Hub header); nutrition ROW tier stays 'foundation'.
  v_tier := case when lower(coalesce(v_sub, '')) like '%sovereign%' then 'sovereign'
                 when lower(coalesce(v_sub, '')) like '%performance%' then 'performance'
                 else 'foundation' end;

  -- find-or-create profile (user_id is UNIQUE → idempotent).
  select id into v_profile_id from public.athlete_profiles where user_id = p_user_id order by created_at asc limit 1;
  if v_profile_id is null then
    insert into public.athlete_profiles
      (user_id, full_name, birth_date, gender, sport, current_tier, preferred_language, body_mass_g, body_mass_logged_at)
    values
      (p_user_id, v_name, ((extract(year from now())::int - 30)::text || '-01-01')::date, null,
       'general', v_tier, v_locale, v_bmg, now())
    on conflict (user_id) do nothing
    returning id into v_profile_id;
    if v_profile_id is null then
      select id into v_profile_id from public.athlete_profiles where user_id = p_user_id order by created_at asc limit 1;
    else
      v_created := true;
    end if;
  end if;

  -- Today's body metric (idempotent). lean_mass_g is generated.
  insert into public.athlete_body_metrics (athlete_id, measured_on, body_mass_g, body_fat_pct, source)
  values (v_profile_id, v_day, v_bmg, 18, 'manual_checkin')
  on conflict (athlete_id, measured_on) do nothing;
  update public.athlete_profiles set body_mass_g = v_bmg where id = v_profile_id and body_mass_g is null;

  -- 28-day FOUNDATION baseline nutrition contract — only days not already present.
  insert into public.athlete_nutrition_targets_daily
    (athlete_id, day, tier, tdee_kcal, protein_g, carbs_g, fat_g, creatine_g, coefficients, day_type, timing_plan, computation_trace)
  select v_profile_id, (v_day + gs.i), 'foundation', 3058, 147, 327, 129, null,
         '{"carb_coeff":0.004,"protein_coeff":0.0018,"af":1.55,"profile":"general","rmr_base":500}'::jsonb,
         'standard', null,
         jsonb_build_object(
           'source', 'profile_guard_backfill',
           'inputs', jsonb_build_object('bodyMassG', 81647, 'leanMassG', 66951, 'bodyFatPct', 18,
                                        'trainingDaysWk', 4, 'sessionMinutes', 60, 'profileKey', 'general'),
           'clamps_fired', '[]'::jsonb,
           'note', 'default-persona baseline; no body metrics on file (graceful degradation)')
    from generate_series(0, 27) as gs(i)
  on conflict (athlete_id, day) do nothing;
  get diagnostics v_nut_rows = row_count;

  return jsonb_build_object('ok', true, 'profile_id', v_profile_id, 'created', v_created,
                            'nutrition_rows_seeded', v_nut_rows, 'display_tier', v_tier);
end;
$function$;

revoke all on function public.bbf_provision_athlete_baseline(uuid) from public, anon, authenticated;
grant execute on function public.bbf_provision_athlete_baseline(uuid) to service_role;

-- ─── 2 · the vault-token-gated landing guard (client-callable) ──────────────
create or replace function public.bbf_ensure_provisioned(
  p_uid           text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user_id     uuid;
  v_profile_id  uuid;
  v_day         date := (now() at time zone 'utc')::date;
  v_targets     boolean := false;
  v_result      jsonb;
begin
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u
      on u.id = s.user_id and u.deleted_at is null and u.access_status is distinct from 'locked'
   where s.token::text = p_session_token and s.expires_at > now()
   limit 1;
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  -- FAST PATH — already provisioned (profile + TODAY's targets). No writes.
  select p.id into v_profile_id from public.athlete_profiles p where p.user_id = v_user_id order by p.created_at asc limit 1;
  if v_profile_id is not null then
    select exists(select 1 from public.athlete_nutrition_targets_daily
                   where athlete_id = v_profile_id and day = v_day) into v_targets;
    if v_targets then
      return json_build_object('ok', true, 'profile_id', v_profile_id, 'provisioned', false, 'ready', true);
    end if;
  end if;

  -- SLOW PATH — seed the missing rows, then re-assert readiness (the hard guard).
  v_result := public.bbf_provision_athlete_baseline(v_user_id);
  v_profile_id := coalesce((v_result->>'profile_id')::uuid, v_profile_id);
  select exists(select 1 from public.athlete_nutrition_targets_daily
                 where athlete_id = v_profile_id and day = v_day) into v_targets;

  return json_build_object(
    'ok',          true,
    'profile_id',  v_profile_id,
    'provisioned', coalesce((v_result->>'created')::boolean, false),
    'ready',       (v_profile_id is not null and v_targets)
  );
end;
$function$;

revoke all on function public.bbf_ensure_provisioned(text, text) from public;
grant execute on function public.bbf_ensure_provisioned(text, text) to anon, authenticated, service_role;
