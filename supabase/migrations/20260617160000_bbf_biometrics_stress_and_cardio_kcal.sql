-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — BIOMETRIC LEDGER: subjective CNS stress + additive cardio active-kcal
-- ═══════════════════════════════════════════════════════════════════════════
-- Architectural pivot (CEO): the OS probe confirmed the device hoards HRV +
-- Active Calories (never written to Health Connect). So HRV is dropped as the
-- recovery axis and replaced by a MANUAL Subjective CNS Stress input (1–10), and
-- Active Calories are computed internally by Smart Cardio. This migration:
--   1. adds bbf_daily_biometrics.stress_level (1–10, nullable).
--   2. bbf_upsert_daily_biometrics — persists stress_level, and switches
--      stress_level + active_calories_burned to COALESCE-PRESERVE on conflict so a
--      null-bearing autonomous sync (the device reports neither) never WIPES a
--      manual stress or a cardio-added burn written by another path the same day.
--      hrv/sleep/steps stay authoritative (= excluded).
--   3. bbf_get_biometric_ledger — returns stress_level in the series.
--   4. bbf_add_active_calories(token, date, kcal) — additive write: Smart Cardio's
--      "Complete & Sync" ADDS a session's estimated burn to the day's total without
--      touching the other columns.
-- Additive + idempotent. The two CREATE OR REPLACE bodies are the CURRENT prod
-- definitions (incl. the absent-vital sanitization) with ONLY these changes layered
-- in; CREATE OR REPLACE preserves existing grants.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_daily_biometrics
  ADD COLUMN IF NOT EXISTS stress_level numeric CHECK (stress_level IS NULL OR (stress_level >= 1 AND stress_level <= 10));

CREATE OR REPLACE FUNCTION public.bbf_upsert_daily_biometrics(p_session_token text, p_day jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_date    date;
  v_hrv     numeric;
  v_sleep   int;
  v_stress  numeric;
  v_id      uuid;
  v_series  jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  v_date := nullif(p_day->>'date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_date');
  END IF;

  -- Absent-vital sanitization: 0/negative HRV or sleep = "not measured" → NULL.
  v_hrv := nullif(p_day->>'hrv_ms', '')::numeric;
  IF v_hrv IS NOT NULL AND v_hrv <= 0 THEN
    v_hrv := NULL;
  END IF;
  v_sleep := nullif(p_day->>'sleep_minutes', '')::int;
  IF v_sleep IS NOT NULL AND v_sleep <= 0 THEN
    v_sleep := NULL;
  END IF;
  -- Subjective CNS stress (1–10); out-of-range → NULL (never a hard abort).
  v_stress := nullif(p_day->>'stress_level', '')::numeric;
  IF v_stress IS NOT NULL AND (v_stress < 1 OR v_stress > 10) THEN
    v_stress := NULL;
  END IF;

  INSERT INTO public.bbf_daily_biometrics
    (athlete_id, date, hrv_ms, sleep_minutes, active_calories_burned, daily_steps, stress_level)
  VALUES (
    v_user_id,
    v_date,
    v_hrv,
    v_sleep,
    nullif(p_day->>'active_calories_burned', '')::numeric,
    nullif(p_day->>'daily_steps', '')::int,
    v_stress
  )
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    hrv_ms                 = excluded.hrv_ms,
    sleep_minutes          = excluded.sleep_minutes,
    -- COALESCE-preserve: a null-bearing autonomous sync must not wipe a cardio-added
    -- burn or a manually-entered stress set by another write path on the same day.
    active_calories_burned = COALESCE(excluded.active_calories_burned, bbf_daily_biometrics.active_calories_burned),
    daily_steps            = excluded.daily_steps,
    stress_level           = COALESCE(excluded.stress_level, bbf_daily_biometrics.stress_level)
  RETURNING id INTO v_id;

  -- Trailing 28 days (newest first), the upserted day included.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'date', b.date, 'hrv_ms', b.hrv_ms, 'sleep_minutes', b.sleep_minutes,
           'active_calories_burned', b.active_calories_burned, 'daily_steps', b.daily_steps,
           'stress_level', b.stress_level
         ) ORDER BY b.date DESC), '[]'::jsonb)
    INTO v_series
  FROM public.bbf_daily_biometrics b
  WHERE b.athlete_id = v_user_id
    AND b.date <= v_date
    AND b.date >  v_date - 28;

  RETURN jsonb_build_object('ok', true, 'biometric_id', v_id, 'series', v_series);
END;
$function$;

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
    SELECT b.date, b.hrv_ms, b.sleep_minutes, b.active_calories_burned, b.daily_steps, b.stress_level
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

-- Additive active-calorie write — Smart Cardio's "Complete & Sync" ADDS a session's
-- estimated burn to the day's running total (preserving hrv/sleep/steps/stress).
CREATE OR REPLACE FUNCTION public.bbf_add_active_calories(p_session_token text, p_date date, p_kcal numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_kcal    numeric;
  v_total   numeric;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  IF p_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_date');
  END IF;

  v_kcal := p_kcal;
  IF v_kcal IS NULL OR v_kcal <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_kcal');
  END IF;
  IF v_kcal > 20000 THEN
    v_kcal := 20000;
  END IF;

  INSERT INTO public.bbf_daily_biometrics (athlete_id, date, active_calories_burned)
  VALUES (v_user_id, p_date, v_kcal)
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    active_calories_burned = least(20000, COALESCE(bbf_daily_biometrics.active_calories_burned, 0) + excluded.active_calories_burned)
  RETURNING active_calories_burned INTO v_total;

  RETURN jsonb_build_object('ok', true, 'date', p_date, 'active_calories_burned', v_total);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_add_active_calories(text, date, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_add_active_calories(text, date, numeric) TO anon, authenticated, service_role;
