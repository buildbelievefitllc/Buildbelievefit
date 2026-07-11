-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — BIOMETRIC LEDGER: vitals lock (stop a silent auto-sync from reverting
-- an athlete's explicit baseline correction)
-- ───────────────────────────────────────────────────────────────────────────
-- FIELD BUG: a watch that didn't record through the night produces a stale,
-- incomplete HRV+sleep read (readiness scored 67). The athlete corrects it via
-- Manual Health Input (saved baseline → 96) — but the very next app open
-- re-fires the SILENT launch-time Health Connect auto-pull (vitalsPipeline.js
-- useAutoVitalsSync — one pull per fresh JS session), which re-reads the SAME
-- stale watch data and unconditionally overwrites hrv_ms/sleep_minutes on the
-- ledger (bbf_upsert_daily_biometrics wrote `= excluded.*` with zero regard
-- for who last touched the day), silently reverting the correction back to 67.
-- This hits ANY client whose wearable has an incomplete night and who
-- manually corrects it — a general defect, not a one-off.
--
-- FIX: a provenance lock per day.
--   • wearable_auto     — the SILENT launch-time auto-pull. If today's row is
--     already vitals_locked, an auto write is still absorbed for kcal/steps/
--     stress (unchanged COALESCE-preserve) but NEVER touches hrv_ms/
--     sleep_minutes — those stay exactly as the athlete last explicitly set them.
--   • wearable_explicit — the athlete tapped "Sync Health Connect" on purpose.
--   • manual_input      — the athlete typed & saved a baseline on purpose.
-- Both explicit sources ALWAYS win (an intentional human action always
-- governs) and (re-)lock the day; only another explicit action can move
-- hrv_ms/sleep_minutes after that. p_source defaults to 'wearable_auto', so
-- any caller not yet updated behaves exactly as before UNLESS the day is
-- already locked — matching pre-fix behavior for the common (unlocked) case.
--
-- The client-side half of this fix (useAutoVitalsSync skipping the pull
-- entirely once the ledger reports today locked — the piece that actually
-- stops the readiness score from recomputing off the stale native read) ships
-- in the same change set; this migration is the durable, cross-device source
-- of truth that guard reads.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_daily_biometrics
  ADD COLUMN IF NOT EXISTS vitals_locked boolean NOT NULL DEFAULT false;
ALTER TABLE public.bbf_daily_biometrics
  ADD COLUMN IF NOT EXISTS vitals_source text
    CHECK (vitals_source IS NULL OR vitals_source IN ('wearable_auto', 'wearable_explicit', 'manual_input'));

-- The new p_source parameter changes the function's arg signature — DROP first
-- so no stale 2-arg overload survives alongside the new 3-arg one (Postgres
-- would otherwise treat them as distinct functions and 2-arg callers would
-- keep resolving to the OLD, unguarded body).
DROP FUNCTION IF EXISTS public.bbf_upsert_daily_biometrics(text, jsonb);

CREATE OR REPLACE FUNCTION public.bbf_upsert_daily_biometrics(p_session_token text, p_day jsonb, p_source text DEFAULT 'wearable_auto')
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_date     date;
  v_hrv      numeric;
  v_sleep    int;
  v_stress   numeric;
  v_source   text;
  v_explicit boolean;
  v_id       uuid;
  v_series   jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_date := nullif(p_day->>'date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_date');
  END IF;

  v_source := lower(coalesce(nullif(p_source, ''), 'wearable_auto'));
  IF v_source NOT IN ('wearable_auto', 'wearable_explicit', 'manual_input') THEN
    v_source := 'wearable_auto';
  END IF;
  v_explicit := v_source IN ('wearable_explicit', 'manual_input');

  -- Absent-vital sanitization: 0/negative HRV or sleep = "not measured" → NULL.
  v_hrv := nullif(p_day->>'hrv_ms', '')::numeric;
  IF v_hrv IS NOT NULL AND v_hrv <= 0 THEN
    v_hrv := NULL;
  END IF;
  v_sleep := nullif(p_day->>'sleep_minutes', '')::int;
  IF v_sleep IS NOT NULL AND v_sleep <= 0 THEN
    v_sleep := NULL;
  END IF;
  v_stress := nullif(p_day->>'stress_level', '')::numeric;
  IF v_stress IS NOT NULL AND (v_stress < 1 OR v_stress > 10) THEN
    v_stress := NULL;
  END IF;

  INSERT INTO public.bbf_daily_biometrics
    (athlete_id, date, hrv_ms, sleep_minutes, active_calories_burned, daily_steps, stress_level, vitals_locked, vitals_source)
  VALUES (
    v_user_id,
    v_date,
    v_hrv,
    v_sleep,
    nullif(p_day->>'active_calories_burned', '')::numeric,
    nullif(p_day->>'daily_steps', '')::int,
    v_stress,
    v_explicit,
    v_source
  )
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    -- An automatic (silent) sync NEVER touches hrv/sleep once the day is locked
    -- by an explicit action; an explicit action always wins and (re-)locks it.
    hrv_ms = CASE
               WHEN v_explicit OR NOT bbf_daily_biometrics.vitals_locked THEN excluded.hrv_ms
               ELSE bbf_daily_biometrics.hrv_ms
             END,
    sleep_minutes = CASE
               WHEN v_explicit OR NOT bbf_daily_biometrics.vitals_locked THEN excluded.sleep_minutes
               ELSE bbf_daily_biometrics.sleep_minutes
             END,
    active_calories_burned = COALESCE(excluded.active_calories_burned, bbf_daily_biometrics.active_calories_burned),
    daily_steps             = COALESCE(excluded.daily_steps, bbf_daily_biometrics.daily_steps),
    stress_level             = COALESCE(excluded.stress_level, bbf_daily_biometrics.stress_level),
    vitals_locked            = bbf_daily_biometrics.vitals_locked OR v_explicit,
    vitals_source            = CASE
               WHEN v_explicit OR NOT bbf_daily_biometrics.vitals_locked THEN v_source
               ELSE bbf_daily_biometrics.vitals_source
             END
  RETURNING id INTO v_id;

  -- Trailing 28 days (newest first), the upserted day included.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'date', b.date, 'hrv_ms', b.hrv_ms, 'sleep_minutes', b.sleep_minutes,
           'active_calories_burned', b.active_calories_burned, 'daily_steps', b.daily_steps,
           'stress_level', b.stress_level, 'vitals_locked', b.vitals_locked, 'vitals_source', b.vitals_source
         ) ORDER BY b.date DESC), '[]'::jsonb)
    INTO v_series
  FROM public.bbf_daily_biometrics b
  WHERE b.athlete_id = v_user_id
    AND b.date <= v_date
    AND b.date >  v_date - 28;

  RETURN jsonb_build_object('ok', true, 'biometric_id', v_id, 'series', v_series);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_upsert_daily_biometrics(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_upsert_daily_biometrics(text, jsonb, text) TO anon, authenticated, service_role;

-- bbf_get_biometric_ledger — surface vitals_locked/vitals_source in the series
-- so the client can gate the silent launch auto-pull (useAutoVitalsSync)
-- BEFORE it ever fires, on ANY device (server-derived, not a local-only flag).
-- Same (text, integer) signature — CREATE OR REPLACE is safe, no drop needed.
CREATE OR REPLACE FUNCTION public.bbf_get_biometric_ledger(p_session_token text, p_days integer DEFAULT 28)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_days     integer := greatest(1, least(coalesce(p_days, 28), 90));
  v_series   jsonb;
  v_protocol jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r.date DESC), '[]'::jsonb)
    INTO v_series
  FROM (
    SELECT b.date, b.hrv_ms, b.sleep_minutes, b.active_calories_burned, b.daily_steps,
           b.stress_level, b.vitals_locked, b.vitals_source
      FROM public.bbf_daily_biometrics b
     WHERE b.athlete_id = v_user_id
     ORDER BY b.date DESC
     LIMIT v_days
  ) r;

  SELECT to_jsonb(q) INTO v_protocol
  FROM (
    SELECT p.date, p.readiness_score, p.training_volume_modifier,
           p.carb_target_pct, p.fat_target_pct, p.directive_log, p.created_at
      FROM public.bbf_daily_protocols p
     WHERE p.athlete_id = v_user_id
     ORDER BY p.date DESC
     LIMIT 1
  ) q;

  RETURN jsonb_build_object(
    'ok', true,
    'as_of', current_date,
    'series', v_series,
    'latest_protocol', coalesce(v_protocol, 'null'::jsonb)
  );
END;
$function$;
