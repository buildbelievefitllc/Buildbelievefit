-- bbf_wearable_sanitize_optional_vitals
-- ─────────────────────────────────────────────────────────────────────────────
-- The Android Health Connect sync was returning 502 (FunctionsHttpError) because
-- the ingest RPC threw on a CHECK-constraint violation: Health Connect exposes no
-- resting-HR sample, so the client sent resting_hr = 0, and the column requires
-- NULL or 20–220 BPM. One absent optional vital aborted the entire reading.
--
-- Fix: _bbf_upsert_wearable_reading now sanitizes each OPTIONAL vital to NULL when
-- it is absent or out of its valid range, instead of letting a single bad field
-- abort the write. Strain (the required load signal) stays hard-validated.
--
-- The true root cause also lived in the client (frontend/src/lib/healthConnectSync.js
-- `num()` returned Number(null) === 0); that is fixed in the same change set. This
-- server guard is the durable belt-and-suspenders so NO client can lose a reading
-- over a single garbage optional field.
CREATE OR REPLACE FUNCTION public._bbf_upsert_wearable_reading(p_user_id uuid, p_source text, p_reading jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id        uuid;
  v_date      date;
  v_strain    numeric;
  v_readiness numeric;
  v_resting   int;
  v_hrv       numeric;
  v_sleep     int;
  v_series    jsonb;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('whoop', 'apple', 'oura', 'manual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_source');
  END IF;

  v_date := nullif(p_reading->>'reading_date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_reading_date');
  END IF;

  -- Strain is the required load signal — still hard-validated.
  v_strain := nullif(p_reading->>'strain', '')::numeric;
  IF v_strain IS NULL OR v_strain < 0 OR v_strain > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_strain');
  END IF;

  -- Optional vitals: out-of-range or "not measured" (0) → NULL, never a hard abort.
  v_readiness := nullif(p_reading->>'readiness_score', '')::numeric;
  IF v_readiness IS NOT NULL AND (v_readiness < 0 OR v_readiness > 100) THEN
    v_readiness := NULL;
  END IF;

  v_resting := nullif(p_reading->>'resting_hr', '')::int;
  IF v_resting IS NOT NULL AND (v_resting < 20 OR v_resting > 220) THEN
    v_resting := NULL;  -- 0 = Health Connect has no resting-HR sample → not a real reading
  END IF;

  v_hrv := nullif(p_reading->>'hrv_ms', '')::numeric;
  IF v_hrv IS NOT NULL AND v_hrv < 0 THEN
    v_hrv := NULL;
  END IF;

  v_sleep := nullif(p_reading->>'sleep_minutes', '')::int;
  IF v_sleep IS NOT NULL AND (v_sleep < 0 OR v_sleep > 2880) THEN
    v_sleep := NULL;
  END IF;

  INSERT INTO public.bbf_wearable_readings
    (user_id, source, reading_date, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes, raw, recorded_at)
  VALUES (
    p_user_id,
    p_source,
    v_date,
    v_readiness,
    v_strain,
    v_resting,
    v_hrv,
    v_sleep,
    coalesce(p_reading->'raw', '{}'::jsonb),
    coalesce(nullif(p_reading->>'recorded_at', '')::timestamptz, now())
  )
  ON CONFLICT (user_id, source, reading_date) DO UPDATE SET
    readiness_score = excluded.readiness_score,
    strain          = excluded.strain,
    resting_hr      = excluded.resting_hr,
    hrv_ms          = excluded.hrv_ms,
    sleep_minutes   = excluded.sleep_minutes,
    raw             = excluded.raw,
    recorded_at     = excluded.recorded_at
  RETURNING id INTO v_id;

  SELECT coalesce(jsonb_agg(jsonb_build_object('reading_date', d, 'strain', s) ORDER BY d), '[]'::jsonb)
    INTO v_series
  FROM (
    SELECT reading_date AS d, max(strain) AS s
      FROM public.bbf_wearable_readings
     WHERE user_id = p_user_id
       AND reading_date <= v_date
       AND reading_date >  v_date - 28
     GROUP BY reading_date
  ) q;

  RETURN jsonb_build_object('ok', true, 'reading_id', v_id, 'series', v_series);
END;
$function$;
