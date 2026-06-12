-- bbf_biometrics_sanitize_absent_vitals
-- ─────────────────────────────────────────────────────────────────────────────
-- A no-watch night must read as "absent telemetry," never as a zero vital.
--
-- Incident (2026-06-12): the athlete synced with no watch worn overnight. The
-- native bridge correctly sent hrv_ms=null / sleep_minutes=null, but the client
-- mapper (biometricsApi.js num()) coerced null→0 (Number(null) === 0), so the
-- ledger stored hrv 0 / sleep 0 and the readiness engine — instead of emitting
-- INSUFFICIENT_TELEMETRY ("manual baseline governs today") — scored a zero-sleep
-- athlete: readiness 0, SYSTEM_BREACH, training volume ×0.00. A 0-ms HRV row also
-- poisons the rolling 14-day HRV baseline.
--
-- The client mapper is fixed in the same change set (ships with the next build);
-- this RPC guard protects the ledger from any stale installed build: HRV ≤ 0 ms
-- and sleep ≤ 0 min are physiologically impossible readings → store NULL.
-- Calories/steps keep honest zeros (0 active load is a real reading).
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

  INSERT INTO public.bbf_daily_biometrics
    (athlete_id, date, hrv_ms, sleep_minutes, active_calories_burned, daily_steps)
  VALUES (
    v_user_id,
    v_date,
    v_hrv,
    v_sleep,
    nullif(p_day->>'active_calories_burned', '')::numeric,
    nullif(p_day->>'daily_steps', '')::int
  )
  ON CONFLICT (athlete_id, date) DO UPDATE SET
    hrv_ms                 = excluded.hrv_ms,
    sleep_minutes          = excluded.sleep_minutes,
    active_calories_burned = excluded.active_calories_burned,
    daily_steps            = excluded.daily_steps
  RETURNING id INTO v_id;

  -- Trailing 28 days (newest first), the upserted day included.
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'date', b.date, 'hrv_ms', b.hrv_ms, 'sleep_minutes', b.sleep_minutes,
           'active_calories_burned', b.active_calories_burned, 'daily_steps', b.daily_steps
         ) ORDER BY b.date DESC), '[]'::jsonb)
    INTO v_series
  FROM public.bbf_daily_biometrics b
  WHERE b.athlete_id = v_user_id
    AND b.date <= v_date
    AND b.date >  v_date - 28;

  RETURN jsonb_build_object('ok', true, 'biometric_id', v_id, 'series', v_series);
END;
$function$;

-- One-time scrub of the incident artifacts (applied to prod alongside this
-- migration): the 2026-06-12 biometric row's hrv/sleep zeros were NULLed and the
-- 0-score SYSTEM_BREACH protocol computed from them was deleted, restoring the
-- "no telemetry → no regulation" state for the day.
UPDATE public.bbf_daily_biometrics
   SET hrv_ms = NULL, sleep_minutes = NULL
 WHERE date = '2026-06-12' AND hrv_ms = 0 AND sleep_minutes = 0;

DELETE FROM public.bbf_daily_protocols p
 USING public.bbf_daily_biometrics b
 WHERE p.athlete_id = b.athlete_id
   AND p.date = '2026-06-12'
   AND b.date = '2026-06-12'
   AND p.readiness_score = 0
   AND b.hrv_ms IS NULL
   AND b.sleep_minutes IS NULL;
