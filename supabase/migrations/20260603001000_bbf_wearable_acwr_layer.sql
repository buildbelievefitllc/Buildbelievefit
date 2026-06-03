-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — WEARABLE / ACWR DATA LAYER  (Whoop · Apple · Oura)
-- ═══════════════════════════════════════════════════════════════════════════
-- Brief 2 (Opus Max Sprint) — a normalized readiness/strain ingestion layer and
-- an acute:chronic workload ratio (ACWR) read boundary for future orchestrator
-- use. Deterministic; no LLM is involved.
--
-- SECURITY MODEL (identical to the Smart Cardio layer): the table is RLS ENABLED
-- + FORCED with ZERO policies, so no role can read/write it directly. The ONLY
-- access path is the SECURITY DEFINER functions below (owned by `postgres`,
-- bypassrls). Athlete-facing RPCs are gated by the vault session token via the
-- existing public._bbf_uid_from_vault_token(); the server/webhook ingestion RPC
-- is granted to service_role ONLY (the edge function holds the key in env).
--
-- IDEMPOTENT by construction (IF NOT EXISTS / CREATE OR REPLACE) so re-running on
-- the live DB or a fresh rebuild is a safe no-op.
--
-- DEPENDS ON: public.bbf_users(id), public._bbf_uid_from_vault_token(text)
--   (defined by 20260601160000_bbf_vault_session_tokens.sql +
--    20260601170500_bbf_cardio_layer.sql — both ordered earlier).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Normalized readings table ──────────────────────────────────────────────
-- One row per (athlete, source, calendar day). `strain` is the source-agnostic
-- Universal Load Unit (ULU, 0–100) the ACWR is computed from; `raw` retains the
-- original payload for audit. See _shared/wearable-core.mjs for the normalization
-- contract that produces these rows.
CREATE TABLE IF NOT EXISTS public.bbf_wearable_readings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  source          text NOT NULL CHECK (source IN ('whoop', 'apple', 'oura', 'manual')),
  reading_date    date NOT NULL,
  readiness_score numeric CHECK (readiness_score IS NULL OR (readiness_score >= 0 AND readiness_score <= 100)),
  strain          numeric NOT NULL CHECK (strain >= 0 AND strain <= 100),
  resting_hr      integer CHECK (resting_hr IS NULL OR (resting_hr >= 20 AND resting_hr <= 220)),
  hrv_ms          numeric CHECK (hrv_ms IS NULL OR hrv_ms >= 0),
  sleep_minutes   integer CHECK (sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 2880)),
  raw             jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_wearable_reading UNIQUE (user_id, source, reading_date)
);

CREATE INDEX IF NOT EXISTS idx_wearable_readings_user_date
  ON public.bbf_wearable_readings (user_id, reading_date DESC);

-- ─── 2. RLS: enabled + FORCED, zero policies (deny-all direct access) ──────────
ALTER TABLE public.bbf_wearable_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_wearable_readings FORCE  ROW LEVEL SECURITY;

-- ─── 3. ACWR helper — SQL mirror of _shared/wearable-core.mjs computeAcwr() ─────
-- acute   = Σ(per-day MAX strain) over the trailing 7 days  ÷ 7
-- chronic = Σ(per-day MAX strain) over the trailing 28 days ÷ 28
-- acwr    = acute ÷ chronic  (null when chronic = 0)
-- flag    : insufficient_data (<14 chronic days w/ data) · detraining (<0.8)
--           · optimal (≤1.3) · caution (≤1.5) · high_risk (>1.5)
-- ⚠ Keep this VERBATIM-aligned with wearable-core.mjs; both are pinned to the
--   same numbers by the test suite (1.0/optimal, 1.6/high_risk).
CREATE OR REPLACE FUNCTION public._bbf_wearable_acwr(p_user_id uuid, p_as_of date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acute        numeric := 0;
  v_chronic      numeric := 0;
  v_days_data    integer := 0;
  v_acwr         numeric;
  v_flag         text;
BEGIN
  WITH days AS (
    SELECT reading_date, max(strain) AS daymax
      FROM public.bbf_wearable_readings
     WHERE user_id = p_user_id
       AND reading_date <= p_as_of
       AND reading_date >  p_as_of - 28      -- trailing 28 days inclusive
     GROUP BY reading_date
  )
  SELECT
    round(coalesce(sum(daymax) FILTER (WHERE reading_date > p_as_of - 7), 0) / 7.0, 2),
    round(coalesce(sum(daymax), 0) / 28.0, 2),
    count(*)
    INTO v_acute, v_chronic, v_days_data
  FROM days;

  v_acwr := CASE WHEN v_chronic > 0 THEN round(v_acute / v_chronic, 3) ELSE NULL END;

  v_flag := CASE
    WHEN v_acwr IS NULL OR v_chronic <= 0 OR v_days_data < 14 THEN 'insufficient_data'
    WHEN v_acwr < 0.8  THEN 'detraining'
    WHEN v_acwr <= 1.3 THEN 'optimal'
    WHEN v_acwr <= 1.5 THEN 'caution'
    ELSE 'high_risk'
  END;

  RETURN jsonb_build_object(
    'as_of', p_as_of,
    'acute_days', 7,
    'chronic_days', 28,
    'chronic_days_with_data', v_days_data,
    'acute', v_acute,
    'chronic', v_chronic,
    'acwr', v_acwr,
    'flag', v_flag
  );
END;
$function$;

-- ─── 4. Internal upsert — normalized reading in, trailing strain series out ─────
-- Trusted internal (operates on an already-resolved user_id). Validates the
-- normalized shape defensively alongside the table constraints.
CREATE OR REPLACE FUNCTION public._bbf_upsert_wearable_reading(p_user_id uuid, p_source text, p_reading jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id     uuid;
  v_date   date;
  v_strain numeric;
  v_series jsonb;
BEGIN
  IF p_source IS NULL OR p_source NOT IN ('whoop', 'apple', 'oura', 'manual') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_source');
  END IF;

  v_date := nullif(p_reading->>'reading_date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_reading_date');
  END IF;

  v_strain := nullif(p_reading->>'strain', '')::numeric;
  IF v_strain IS NULL OR v_strain < 0 OR v_strain > 100 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_strain');
  END IF;

  INSERT INTO public.bbf_wearable_readings
    (user_id, source, reading_date, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes, raw, recorded_at)
  VALUES (
    p_user_id,
    p_source,
    v_date,
    nullif(p_reading->>'readiness_score', '')::numeric,
    v_strain,
    nullif(p_reading->>'resting_hr', '')::int,
    nullif(p_reading->>'hrv_ms', '')::numeric,
    nullif(p_reading->>'sleep_minutes', '')::int,
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

  -- Trailing 28-day strain series (per-day MAX), as_of = the ingested reading_date.
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

-- ─── 5. Athlete-gated ingest (vault session token) ─────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_ingest_wearable_reading(p_session_token text, p_source text, p_reading jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;
  RETURN public._bbf_upsert_wearable_reading(v_user_id, p_source, p_reading);
END;
$function$;

-- ─── 6. Server/webhook ingest (service_role ONLY — the future-orchestrator path) ─
-- Explicit uid; the caller (bbf-wearable-ingest edge function) authenticates the
-- source webhook with a shared secret held in env before invoking this.
CREATE OR REPLACE FUNCTION public.bbf_ingest_wearable_reading_admin(p_uid uuid, p_source text, p_reading jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists boolean;
BEGIN
  SELECT true INTO v_exists FROM public.bbf_users WHERE id = p_uid AND deleted_at IS NULL;
  IF v_exists IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_user');
  END IF;
  RETURN public._bbf_upsert_wearable_reading(p_uid, p_source, p_reading);
END;
$function$;

-- ─── 7. THE READ BOUNDARY — documented interface for future orchestrator use ────
-- bbf_get_wearable_readiness(session_token, as_of)
--   → { ok, as_of, acwr: { acute, chronic, acwr, flag, ... }, readings: [ recent ] }
-- Read-only. Defined here; intentionally NOT wired into any agent/orchestrator.
CREATE OR REPLACE FUNCTION public.bbf_get_wearable_readiness(p_session_token text, p_as_of date DEFAULT current_date)
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
    SELECT reading_date, source, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes
      FROM public.bbf_wearable_readings
     WHERE user_id = v_user_id AND reading_date <= p_as_of
     ORDER BY reading_date DESC
     LIMIT 28
  ) r;

  v_acwr := public._bbf_wearable_acwr(v_user_id, p_as_of);

  RETURN jsonb_build_object('ok', true, 'as_of', p_as_of, 'acwr', v_acwr, 'readings', v_readings);
END;
$function$;

-- ─── 8. Grants ─────────────────────────────────────────────────────────────────
-- Athlete RPCs callable with the anon key (gated inside by the session token).
GRANT EXECUTE ON FUNCTION public.bbf_ingest_wearable_reading(text, text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bbf_get_wearable_readiness(text, date)         TO anon, authenticated, service_role;
-- Server/webhook ingest + internals: service_role only (never anon).
GRANT EXECUTE ON FUNCTION public.bbf_ingest_wearable_reading_admin(uuid, text, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public._bbf_upsert_wearable_reading(uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._bbf_wearable_acwr(uuid, date)                  FROM PUBLIC;
