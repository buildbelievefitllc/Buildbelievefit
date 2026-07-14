-- 20260714120000_bbf_athlete_dossier_ambiguity_fix.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- DOSSIER PULSE HOTFIX — "column reference \"athlete_id\" is ambiguous" (42702).
--
-- The original definition (20260709190000_bbf_athlete_dossier_rpc.sql) named the
-- input PARAMETER `athlete_id`, then filtered six tables that ALSO expose an
-- `athlete_id` COLUMN (athlete_body_metrics, bbf_daily_biometrics,
-- bbf_daily_protocols, nutrition_daily_sync, athlete_nutrition_targets_daily,
-- prehab_queue) with an UNQUALIFIED `where athlete_id in (v_uid, v_profile_id)`.
-- plpgsql could not tell the parameter from the column and raised 42702, which
-- surfaced as the red error in the client-profile Dossier Pulse widget
-- (frontend → bbf_athlete_dossier → get_complete_athlete_dossier).
--
-- This migration codifies the corrected definition in the repo so a fresh
-- rebuild-from-migrations cannot reintroduce the bug (the production database was
-- already hotfixed to this exact shape; applying this is an idempotent no-op
-- there). Two changes vs. the original:
--   1. The input parameter is renamed `athlete_id` → `p_athlete_id` (house
--      convention; removes the name shadow at the source). Because
--      CREATE OR REPLACE cannot rename a parameter, callers that had already run
--      the original must rely on this file being applied over the hotfixed prod
--      definition, whose parameter is likewise `p_athlete_id`.
--   2. Every ambiguous filter is explicitly table-qualified
--      (`<table>.athlete_id in (v_uid, v_profile_id)`), so the reference is
--      unambiguous even if the parameter name ever collides again.
-- Behaviour is otherwise identical to the original. The token-gated wrapper
-- public.bbf_athlete_dossier(text, uuid) is unchanged and not re-declared here.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.get_complete_athlete_dossier(p_athlete_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid        uuid := p_athlete_id;
  v_profile_id uuid;
  v_dossier    jsonb;
begin
  -- Resolve the athlete_profiles twin id (either direction of the lineage).
  select p.id into v_profile_id
  from public.athlete_profiles p
  where p.user_id = v_uid or p.id = v_uid
  limit 1;

  select jsonb_build_object(
    'athlete', (
      select to_jsonb(u) - 'pin_hash' - 'par_q_screen'   -- never ship secrets/clinical raw
      from (
        select id, name, uid, email, avatar, role, subscription_tier, access_status,
               current_streak, metabolic_tier, baseline_status, cardiac_clearance,
               block_priority, sport, position, preferred_locale, trial_expires_at,
               tdee_target, macro_p, macro_c, macro_f, plans_generated_at,
               ghost_intervention_needed, updated_at
        from public.bbf_users where id = v_uid and deleted_at is null
      ) u
    ),
    'profile', (
      select to_jsonb(p) from (
        select full_name, birth_date, gender, sport, position, current_tier,
               preferred_language, body_mass_g, blueprint_updated_at, created_at
        from public.athlete_profiles where id = v_profile_id
      ) p
    ),
    'body_metrics_latest', (
      select to_jsonb(m) from (
        select measured_on, body_mass_g, body_fat_pct, lean_mass_g, source
        from public.athlete_body_metrics
        where athlete_body_metrics.athlete_id in (v_uid, v_profile_id)
        order by measured_on desc limit 1
      ) m
    ),
    'metrics', jsonb_build_object(
      'daily_biometrics', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select date, hrv_ms, sleep_minutes, active_calories_burned, daily_steps, stress_level
          from public.bbf_daily_biometrics
          where bbf_daily_biometrics.athlete_id in (v_uid, v_profile_id)
          order by date desc limit 14
        ) t
      ),
      'readiness_protocols', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select date, readiness_score, training_volume_modifier, carb_target_pct, fat_target_pct
          from public.bbf_daily_protocols
          where bbf_daily_protocols.athlete_id in (v_uid, v_profile_id)
          order by date desc limit 14
        ) t
      ),
      'wearable_readings', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select reading_date, source, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes
          from public.bbf_wearable_readings
          where user_id = v_uid
          order by reading_date desc limit 14
        ) t
      )
    ),
    'timeline', jsonb_build_object(
      'completion_events', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select occurred_at, session_date, source
          from public.bbf_completion_events
          where user_id = v_uid
          order by occurred_at desc limit 20
        ) t
      ),
      'session_feedback', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select created_at, pain_score, rpe_score, target_area
          from public.session_feedback
          where user_id = v_uid
          order by created_at desc limit 10
        ) t
      ),
      'recent_sets', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select day_key, exercise_key, set_number, reps, weight_lbs, rpe
          from public.bbf_sets
          where user_id = v_uid and day_key is not null
          order by day_key desc, set_number asc limit 30
        ) t
      ),
      'meal_logs', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select log_date, meal_slot, meal_name, calories, protein_g, carbs_g, fats_g, source
          from public.bbf_meal_logs
          where user_id = v_uid
          order by logged_at desc limit 14
        ) t
      ),
      'nutrition_sync', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select day, kcal_pct, protein_pct, consumed_kcal, target_kcal, meals_logged
          from public.nutrition_daily_sync
          where nutrition_daily_sync.athlete_id in (v_uid, v_profile_id)
          order by day desc limit 7
        ) t
      ),
      'messages', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select sender, left(body, 240) as body, created_at, read_by_athlete_at, read_by_coach_at
          from public.bbf_coach_messages
          where client_id = v_uid
          order by created_at desc limit 10
        ) t
      )
    ),
    'protocols', jsonb_build_object(
      'nutrition_target_latest', (
        select to_jsonb(t) from (
          select day, tier, tdee_kcal, protein_g, carbs_g, fat_g, day_type
          from public.athlete_nutrition_targets_daily
          where athlete_nutrition_targets_daily.athlete_id in (v_uid, v_profile_id)
          order by day desc limit 1
        ) t
      ),
      'cardio_prescription_latest', (
        select to_jsonb(t) from (
          select prescribed_for, readiness_score, recovery_state, effective_tier,
                 rpe_cap, hr_cap_bpm, duration_min, interval_directive, status
          from public.bbf_cardio_prescription
          where user_id = v_uid
          order by prescribed_for desc limit 1
        ) t
      ),
      'active_playlist_latest', (
        select to_jsonb(t) from (
          select scheduled_for, target_area, action, intensity_modifier, status, pain_score, rpe_score
          from public.active_playlists
          where user_id = v_uid
          order by scheduled_for desc limit 1
        ) t
      ),
      'prehab_open', (
        select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from (
          select scheduled_for, joint_zone, priority, risk_score, status
          from public.prehab_queue
          where prehab_queue.athlete_id in (v_uid, v_profile_id)
            and status not in ('completed','expired','superseded')
          order by scheduled_for desc limit 5
        ) t
      )
    ),
    'generated_at', now()
  ) into v_dossier;

  return v_dossier;
end;
$$;

-- Preserve the original perimeter (bare-uuid core is service-role only).
revoke all on function public.get_complete_athlete_dossier(uuid) from public, anon, authenticated;
grant execute on function public.get_complete_athlete_dossier(uuid) to service_role;
