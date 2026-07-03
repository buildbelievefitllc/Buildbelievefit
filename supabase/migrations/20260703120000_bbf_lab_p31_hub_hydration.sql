-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab P3.1 · bbf_hub_hydration — the Day-1 Hub hydration RPC (Onboarding
-- State Machine blueprint §2.2 "Hydration Contract")
-- ───────────────────────────────────────────────────────────────────────────
-- The single read the React Day-1 Hub makes on first login. It returns ONE
-- atomic snapshot of the four surfaces the Hub paints — nutrition, cardio,
-- prehab, and the audio brief — plus the athlete profile summary and the
-- onboarding pipeline state. A first login can never race an empty database:
-- bbf-cold-start-orchestrator seeds these rows BEFORE credentials dispatch
-- (§0.3 "No Empty Dashboards"), and this contract exposes them in one round-trip.
--
-- THE HYDRATION CONTRACT (§2.2) — the JSON shape the hook consumes:
--   { ok, uid, profile_id, day, pipeline_state,
--     nutrition_today | null,   -- athlete_nutrition_targets_daily (athlete_id, day)
--     cardio_today    | null,   -- bbf_cardio_prescription (user_id, prescribed_for, active)
--     prehab_card,              -- prehab_queue (athlete_id, scheduled_for) → { queued[], count }
--     brief_playlist  | null,   -- sovereign_brief_playlists (athlete_id, day, locale)
--     profile, intents, defaults }
-- A null card is the DEGRADED path: the client renders the config-backed tier
-- default from `defaults` + a Calibrating chip (§3.3 Degradation Rendering),
-- never an empty panel or a raw error.
--
-- THE GRAM BOUNDARY (§0.1): every mass field crosses as an INTEGER of grams
-- (protein_g / carbs_g / fat_g / sweat_loss_g_est / rehydration_g / body_mass_g).
-- No kg/lb ever appears. Locale grouping ("143,335 g" vs "143.335 g") is a pure
-- presentation-layer concern in the React cards, never here.
--
-- ID SPACES (per the blueprints, mirrored from the orchestrator):
--   • cardio prescription keys on bbf_users.id            (v_user_id)
--   • nutrition / prehab / brief key on athlete_profiles.id (v_profile_id)
--
-- AUTH: authorized purely on the caller-held 122-bit vault bearer token — the
-- SAME gate bbf_validate_vault_session uses (token live · account not locked ·
-- not deleted). p_uid is advisory (logging/symmetry). SECURITY DEFINER over the
-- service-role-only tables; leaks nothing a session owner can't already see.
--
-- Idempotent (CREATE OR REPLACE / ON CONFLICT DO NOTHING). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Layer-2 degraded defaults (config-backed tier baseline) ────────────────
-- The numbers a card renders when its live row is missing (§3.3). Gram-native
-- integers, internally self-consistent, and physiologically aligned with the
-- cold-start MET/foundation seed for the default persona (~81.647 kg) — so a
-- degraded card shows a real baseline (chip-flagged), never zeros or a blank.
--   nutrition foundation: 180g P·320g C·85g F = 720+1280+765 = 2765 kcal
--   cardio Zone-2 30min:  ee = round(6.0·81647·0.0000175·30)      = 257 kcal
--                         sweat = round(81647·0.00015·30)          = 367 g
--                         rehydration = round(1.5·367)             = 551 g
insert into public.bbf_app_config (key, value)
values (
  'hub_degraded_defaults_v1',
  '{'
    '"intents":{},'
    '"nutrition":{"tier":"foundation","tdee_kcal":2765,"protein_g":180,"carbs_g":320,"fat_g":85,"creatine_g":null,"day_type":"standard"},'
    '"cardio":{"effective_tier":"Zone 2","recovery_state":"unknown","mech_state":null,"hr_cap_bpm":null,"rpe_cap":null,"duration_min":30,"work_rest_ratio":null,"ee_kcal_est":257,"sweat_loss_g_est":367,"rehydration_g":551}'
  '}'
)
on conflict (key) do nothing;

-- ─── 2. bbf_hub_hydration — the single first-login hydration read ──────────────
create or replace function public.bbf_hub_hydration(
  p_uid           text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user_id    uuid;
  v_profile_id uuid;
  v_locale     text;
  v_day        date := (now() at time zone 'utc')::date;
  v_profile    jsonb;
  v_nutrition  jsonb;
  v_cardio     jsonb;
  v_prehab     jsonb;
  v_brief      jsonb;
  v_state      text;
  v_defaults   jsonb;
begin
  -- Authorize purely on the bearer token (mirror bbf_validate_vault_session).
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u
      on u.id = s.user_id
     and u.deleted_at is null
     and u.access_status is distinct from 'locked'
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;

  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  -- Resolve the athlete profile (earliest). nutrition/prehab/brief key on it.
  select p.id, coalesce(nullif(p.preferred_language, ''), 'en')
    into v_profile_id, v_locale
    from public.athlete_profiles p
   where p.user_id = v_user_id
   order by p.created_at asc
   limit 1;

  v_locale := case when v_locale in ('en', 'es', 'pt') then v_locale else 'en' end;

  -- Profile summary — no backend internals, just what the Hub header paints.
  select to_jsonb(x) into v_profile from (
    select
      u.uid                                       as uid,
      coalesce(p.full_name, u.name)               as full_name,
      v_locale                                    as preferred_language,
      coalesce(p.sport, 'general')                as sport,
      p.body_mass_g                               as body_mass_g,   -- integer grams
      coalesce(u.current_tier, u.metabolic_tier)  as tier
    from public.bbf_users u
    left join public.athlete_profiles p on p.id = v_profile_id
    where u.id = v_user_id
    limit 1
  ) x;

  -- NUTRITION — today's single daily contract (athlete_id, day). Integer grams.
  if v_profile_id is not null then
    select to_jsonb(n) into v_nutrition from (
      select tier, tdee_kcal, protein_g, carbs_g, fat_g, creatine_g, day_type
        from public.athlete_nutrition_targets_daily
       where athlete_id = v_profile_id and day = v_day
       limit 1
    ) n;
  end if;

  -- CARDIO — today's active prescription (user_id, prescribed_for). Gram outputs.
  select to_jsonb(c) into v_cardio from (
    select effective_tier, recovery_state, mech_state, hr_cap_bpm, rpe_cap,
           duration_min, work_rest_ratio, ee_kcal_est, sweat_loss_g_est,
           rehydration_g, interval_directive, recovery_note
      from public.bbf_cardio_prescription
     where user_id = v_user_id and prescribed_for = v_day and status = 'active'
     order by created_at desc
     limit 1
  ) c;

  -- PREHAB — today's open queue (athlete_id, scheduled_for). Priority-ordered.
  -- An empty queue is the HEALTHY "all clear" state, not a degraded one.
  if v_profile_id is not null then
    select jsonb_build_object(
             'queued', coalesce(
               jsonb_agg(
                 jsonb_build_object('joint_zone', joint_zone, 'priority', priority, 'risk_score', risk_score)
                 order by (case priority when 'mandatory' then 0 when 'strong' then 1 else 2 end), joint_zone
               ),
               '[]'::jsonb),
             'count', count(*)
           )
      into v_prehab
      from public.prehab_queue
     where athlete_id = v_profile_id and scheduled_for = v_day
       and status in ('queued', 'served');
  end if;
  v_prehab := coalesce(v_prehab, jsonb_build_object('queued', '[]'::jsonb, 'count', 0));

  -- AUDIO BRIEF — today's stitched playlist in the athlete's locale.
  if v_profile_id is not null then
    select to_jsonb(b) into v_brief from (
      select tone, total_duration_ms, status,
             jsonb_array_length(playlist) as fragment_count
        from public.sovereign_brief_playlists
       where athlete_id = v_profile_id and day = v_day and locale = v_locale
       order by computed_at desc
       limit 1
    ) b;
  end if;

  -- Onboarding pipeline state (cold_start_ready | cold_start_degraded | …).
  select state into v_state
    from public.bbf_onboarding_pipeline
   where user_id = v_user_id
   order by created_at desc
   limit 1;

  -- Config-backed Layer-2 defaults (bbf_app_config.value is TEXT JSON).
  select value::jsonb into v_defaults
    from public.bbf_app_config
   where key = 'hub_degraded_defaults_v1'
   limit 1;

  return json_build_object(
    'ok',              true,
    'uid',             p_uid,
    'profile_id',      v_profile_id,
    'day',             v_day,
    'pipeline_state',  v_state,
    'nutrition_today', v_nutrition,     -- null → card degrades to defaults.nutrition
    'cardio_today',    v_cardio,        -- null → card degrades to defaults.cardio
    'prehab_card',     v_prehab,        -- always present; count 0 = all clear
    'brief_playlist',  v_brief,         -- null → card shows a calibrating brief
    'profile',         v_profile,
    'intents',         jsonb_build_object(
                         'tier',   v_profile->>'tier',
                         'sport',  v_profile->>'sport',
                         'locale', v_locale),
    'defaults',        v_defaults
  );
end;
$function$;

-- Callable by the client (anon/authenticated) — it authorizes on the bearer
-- token internally and leaks nothing a session owner can't already see.
revoke all on function public.bbf_hub_hydration(text, text) from public;
grant execute on function public.bbf_hub_hydration(text, text) to anon, authenticated, service_role;

comment on function public.bbf_hub_hydration(text, text) is
  'BBF Lab P3.1 · Day-1 Hub hydration contract (Onboarding §2.2). One atomic, vault-token-gated read returning today''s nutrition/cardio/prehab/brief slices + profile + config-backed Layer-2 defaults. A null card slice is the degraded path (client renders defaults + Calibrating chip, §3.3). Gram fields are integer grams; locale grouping is presentation-only.';
