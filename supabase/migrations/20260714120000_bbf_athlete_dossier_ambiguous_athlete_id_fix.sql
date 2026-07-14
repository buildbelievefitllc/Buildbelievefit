-- 20260714120000_bbf_athlete_dossier_ambiguous_athlete_id_fix.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- FIX: "column reference \"athlete_id\" is ambiguous" — Command Center Dossier
-- Pulse widget (frontend/src/components/command/DossierPulse.jsx) rendering a
-- red error on every athlete's detail screen.
--
-- ROOT CAUSE: get_complete_athlete_dossier's parameter is named `athlete_id`
-- (20260709190000_bbf_athlete_dossier_rpc.sql) — the ONE RPC in this codebase
-- whose parameter isn't `p_`-prefixed (every other function uses p_session_token,
-- p_uid, p_vault_token, ... specifically to avoid this class of bug). Six
-- subqueries inside the function body filter `where athlete_id in (v_uid,
-- v_profile_id)` against tables that ALSO have their own `athlete_id` column
-- (athlete_body_metrics, bbf_daily_biometrics, bbf_daily_protocols,
-- nutrition_daily_sync, athlete_nutrition_targets_daily, prehab_queue). Under
-- PL/pgSQL's default `variable_conflict = error`, every one of those bare
-- references is genuinely ambiguous between "the function parameter" and "the
-- table column" — Postgres refuses to guess and raises exactly this error. It
-- fires on EVERY call (not just Ana's profile): the whole RPC body is one
-- `jsonb_build_object(...)` statement, so the first ambiguous subquery
-- (body_metrics_latest) fails the entire dossier fetch.
--
-- FIX (two complementary layers, CREATE OR REPLACE — safe: the only caller,
-- bbf_athlete_dossier, invokes this positionally as get_complete_athlete_
-- dossier(v_target), so a parameter rename cannot break it):
--   1. Rename the parameter athlete_id -> p_athlete_id (matches house
--      convention, removes the collision at its source so this bug class
--      cannot recur in this function even if extended later).
--   2. Explicitly table-qualify all six previously-bare `athlete_id` filters
--      (defense in depth + self-documents which table's column is meant).
-- Body is otherwise byte-identical to 20260709190000.
-- ═══════════════════════════════════════════════════════════════════════════

-- CREATE OR REPLACE cannot rename an input parameter (Postgres: "cannot change
-- name of input parameter" — hits this on apply, confirmed live). Argument
-- types/order are unchanged (single uuid) and the only caller invokes it
-- positionally, so DROP + CREATE is safe; grants are re-asserted below since
-- a DROP does not carry them forward.
drop function if exists public.get_complete_athlete_dossier(uuid);

create function public.get_complete_athlete_dossier(p_athlete_id uuid)
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

-- Grants unchanged (CREATE OR REPLACE preserves them, but restated for clarity
-- since the migration convention in this codebase always re-asserts grants).
revoke all on function public.get_complete_athlete_dossier(uuid) from public, anon, authenticated;
grant execute on function public.get_complete_athlete_dossier(uuid) to service_role;
