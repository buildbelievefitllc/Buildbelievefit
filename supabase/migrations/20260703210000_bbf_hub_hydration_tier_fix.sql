-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab · HOTFIX — bbf_hub_hydration tier column reference (go-live smoke catch)
-- ───────────────────────────────────────────────────────────────────────────
-- The Day-1 Hub hydration RPC referenced `u.current_tier`, but bbf_users has no
-- such column (its tier fields are metabolic_tier / subscription_tier); the tier
-- lives on athlete_profiles.current_tier (aliased `p`, already left-joined). The
-- function CREATEd clean (plpgsql defers column resolution to run time) but threw
-- `42703: column u.current_tier does not exist` for EVERY real logged-in session —
-- the bogus-token path returned cleanly only because it exits before the profile
-- build. This corrects the reference to `coalesce(p.current_tier, u.metabolic_tier)`.
-- Idempotent CREATE OR REPLACE; identical to the P3.1 definition except that line.
-- ═══════════════════════════════════════════════════════════════════════════

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
      coalesce(p.current_tier, u.metabolic_tier)  as tier
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

revoke all on function public.bbf_hub_hydration(text, text) from public;
grant execute on function public.bbf_hub_hydration(text, text) to anon, authenticated, service_role;
