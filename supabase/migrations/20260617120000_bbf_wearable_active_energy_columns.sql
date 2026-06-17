-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — WEARABLE READINGS: first-class ACTIVE-ENERGY columns (active_kcal / bmr /
-- total_kcal) for the server/ACWR ingest path.
-- ═══════════════════════════════════════════════════════════════════════════
-- _shared/wearable-core.mjs now emits active_kcal (the workload-tracker input),
-- bmr (Mifflin-St Jeor baseline) and total_kcal as first-class normalized fields.
-- Previously the server path only persisted them inside `raw` (active burn was
-- folded into `strain` ULU). This migration lands them as queryable columns and
-- threads them through the upsert + the read boundary.
--
-- ADDITIVE + IDEMPOTENT: nullable columns (ADD COLUMN IF NOT EXISTS) + CREATE OR
-- REPLACE on the two SECURITY DEFINER RPCs. The function bodies are the CURRENT
-- production definitions (incl. the optional-vitals sanitization from
-- 20260612140000) with ONLY the new energy fields added — no existing branch is
-- changed. RLS/grants are untouched (CREATE OR REPLACE preserves them).
--
-- SCOPE NOTE: this hardens the bbf_wearable_readings / ACWR (admin dossier) path.
-- The athlete Client Hub reads HRV/active-calories from the SEPARATE Sovereign
-- biometric ledger (bbf_daily_biometrics), which already persists both.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. First-class energy columns (nullable; sane physiological caps) ─────────
ALTER TABLE public.bbf_wearable_readings
  ADD COLUMN IF NOT EXISTS active_kcal numeric CHECK (active_kcal IS NULL OR (active_kcal >= 0 AND active_kcal <= 20000)),
  ADD COLUMN IF NOT EXISTS bmr         numeric CHECK (bmr        IS NULL OR (bmr        >= 0 AND bmr        <= 10000)),
  ADD COLUMN IF NOT EXISTS total_kcal  numeric CHECK (total_kcal IS NULL OR (total_kcal >= 0 AND total_kcal <= 30000));

-- ─── 2. Upsert — preserve all current logic; persist the energy split ──────────
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
  v_active    numeric;
  v_bmr       numeric;
  v_total     numeric;
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

  -- Energy split (additive): active drives the workload; bmr/total are context.
  -- Out-of-range → NULL (mirrors the optional-vitals stance; never a hard abort).
  v_active := nullif(p_reading->>'active_kcal', '')::numeric;
  IF v_active IS NOT NULL AND (v_active < 0 OR v_active > 20000) THEN
    v_active := NULL;
  END IF;

  v_bmr := nullif(p_reading->>'bmr', '')::numeric;
  IF v_bmr IS NOT NULL AND (v_bmr < 0 OR v_bmr > 10000) THEN
    v_bmr := NULL;
  END IF;

  v_total := nullif(p_reading->>'total_kcal', '')::numeric;
  IF v_total IS NOT NULL AND (v_total < 0 OR v_total > 30000) THEN
    v_total := NULL;
  END IF;

  INSERT INTO public.bbf_wearable_readings
    (user_id, source, reading_date, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes,
     active_kcal, bmr, total_kcal, raw, recorded_at)
  VALUES (
    p_user_id,
    p_source,
    v_date,
    v_readiness,
    v_strain,
    v_resting,
    v_hrv,
    v_sleep,
    v_active,
    v_bmr,
    v_total,
    coalesce(p_reading->'raw', '{}'::jsonb),
    coalesce(nullif(p_reading->>'recorded_at', '')::timestamptz, now())
  )
  ON CONFLICT (user_id, source, reading_date) DO UPDATE SET
    readiness_score = excluded.readiness_score,
    strain          = excluded.strain,
    resting_hr      = excluded.resting_hr,
    hrv_ms          = excluded.hrv_ms,
    sleep_minutes   = excluded.sleep_minutes,
    active_kcal     = excluded.active_kcal,
    bmr             = excluded.bmr,
    total_kcal      = excluded.total_kcal,
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

-- ─── 3. Read boundary — surface the energy split in the readings array ─────────
CREATE OR REPLACE FUNCTION public.bbf_get_wearable_readiness(p_session_token text, p_as_of date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id  uuid;
  v_readings jsonb;
  v_acwr     jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r.reading_date DESC), '[]'::jsonb)
    INTO v_readings
  FROM (
    SELECT reading_date, source, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes,
           active_kcal, bmr, total_kcal
      FROM public.bbf_wearable_readings
     WHERE user_id = v_user_id AND reading_date <= p_as_of
     ORDER BY reading_date DESC
     LIMIT 28
  ) r;

  v_acwr := public._bbf_wearable_acwr(v_user_id, p_as_of);

  RETURN jsonb_build_object('ok', true, 'as_of', p_as_of, 'acwr', v_acwr, 'readings', v_readings);
END;
$function$;
