-- 20260623120000_bbf_daily_steps_coalesce_preserve.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Steps accuracy fix. Make daily_steps COALESCE-preserve on upsert, exactly like
-- active_calories_burned and stress_level already do.
--
-- Before this, a Manual Baseline save (which sends daily_steps = null when no step
-- count is entered) ran `daily_steps = excluded.daily_steps`, hard-overwriting
-- (WIPING) the step count the autonomous Health Connect sync had already written
-- for that day → the Client Hub then showed "No Signal" for steps. After this:
--   • autonomous sync (non-null steps)        → updates the running daily total
--   • manual END-OF-DAY count (non-null)       → overrides as the authoritative total
--   • manual save with steps left blank (null) → PRESERVES the wearable's count
--
-- Only the daily_steps ON CONFLICT line changes vs. 20260617160000; everything else
-- is byte-identical. daily_steps is NOT consumed by the readiness engine (pure
-- telemetry), so this has zero effect on the readiness score/mode.
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
    active_calories_burned = COALESCE(excluded.active_calories_burned, bbf_daily_biometrics.active_calories_burned),
    daily_steps            = COALESCE(excluded.daily_steps, bbf_daily_biometrics.daily_steps),
    stress_level           = COALESCE(excluded.stress_level, bbf_daily_biometrics.stress_level)
  RETURNING id INTO v_id;

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
