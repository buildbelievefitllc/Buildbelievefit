-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — GOOGLE HEALTH CONNECT INGESTION LAYER (bbf-health-sync)
-- ═══════════════════════════════════════════════════════════════════════════
-- Native Health Connect integration (no third-party aggregator). The Android
-- wrapper reads on-device Health Connect data (HRV RMSSD, resting HR, total
-- sleep) and POSTs it to the bbf-health-sync edge function, which lands rows
-- in the EXISTING bbf_readiness table via the RPCs below. bbf-agentic-peaking
-- reads the same row for its CNS Agent Override (HRV < 35ms · sleep < 240min).
--
-- SECURITY MODEL (identical to the wearable/ACWR layer):
--   • Athlete path  — bbf_ingest_health_connect(session_token, reading): vault
--     session token resolved via public._bbf_uid_from_vault_token(); callable
--     with the anon key (gated inside by the token).
--   • Server/webhook path — bbf_ingest_health_connect_admin(uid, reading):
--     service_role ONLY; the edge function authenticates the caller against
--     the Vault secret via bbf_check_ingest_token() before invoking.
--   • Internal upsert is REVOKEd from PUBLIC — never directly callable.
--
-- IDEMPOTENT by construction (IF NOT EXISTS / CREATE OR REPLACE).
--
-- DEPENDS ON: public.bbf_users(id), public._bbf_uid_from_vault_token(text)
--   (20260601160000_bbf_vault_session_tokens.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Telemetry columns on bbf_readiness ──────────────────────────────────
-- Legacy rows (subjective check-ins) keep NULLs here; Health Connect rows
-- carry the raw biometrics. `sleep_quality`/`soreness_level` stay the legacy
-- subjective 1–10 fields — sleep_quality is DERIVED for HC rows (below) so
-- existing consumers keep working.
ALTER TABLE public.bbf_readiness
  ADD COLUMN IF NOT EXISTS source        text,
  ADD COLUMN IF NOT EXISTS reading_date  date,
  ADD COLUMN IF NOT EXISTS hrv_ms        numeric CHECK (hrv_ms IS NULL OR (hrv_ms >= 0 AND hrv_ms <= 500)),
  ADD COLUMN IF NOT EXISTS resting_hr    integer CHECK (resting_hr IS NULL OR (resting_hr >= 20 AND resting_hr <= 220)),
  ADD COLUMN IF NOT EXISTS sleep_minutes integer CHECK (sleep_minutes IS NULL OR (sleep_minutes >= 0 AND sleep_minutes <= 2880)),
  ADD COLUMN IF NOT EXISTS raw           jsonb;

-- One row per (athlete, source, calendar day) for sourced telemetry — enables
-- the INSERT … ON CONFLICT upsert. Legacy rows (NULL source/date) untouched.
CREATE UNIQUE INDEX IF NOT EXISTS uq_readiness_user_source_date
  ON public.bbf_readiness (user_id, source, reading_date)
  WHERE source IS NOT NULL AND reading_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_readiness_user_ts
  ON public.bbf_readiness (user_id, "timestamp" DESC);

-- ─── 2. Internal upsert — normalized Health Connect reading in ──────────────
-- Trusted internal (already-resolved user_id). Derives the legacy fields so
-- both old (sleep_quality) and new (hrv_ms/sleep_minutes) consumers see the
-- push:
--   sleep_quality = clamp(round(sleep_minutes / 60), 1..10)   (480min → 8)
--   score (0–100) = 45·min(1, hrv/65) + 35·min(1, sleep/480)
--                 + 20·(1 − clamp((rhr−50)/30, 0..1))          (all 3 required)
CREATE OR REPLACE FUNCTION public._bbf_upsert_health_connect_reading(p_user_id uuid, p_reading jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id       uuid;
  v_date     date;
  v_hrv      numeric;
  v_rhr      integer;
  v_sleep    integer;
  v_quality  integer;
  v_score    integer;
BEGIN
  v_date := nullif(p_reading->>'reading_date', '')::date;
  IF v_date IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'missing_reading_date');
  END IF;

  v_hrv   := nullif(p_reading->>'hrv_ms', '')::numeric;
  v_rhr   := nullif(p_reading->>'resting_hr', '')::int;
  v_sleep := nullif(p_reading->>'sleep_minutes', '')::int;
  IF v_hrv IS NULL AND v_rhr IS NULL AND v_sleep IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'empty_metrics');
  END IF;
  IF v_hrv IS NOT NULL AND (v_hrv < 0 OR v_hrv > 500) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_hrv_ms');
  END IF;
  IF v_rhr IS NOT NULL AND (v_rhr < 20 OR v_rhr > 220) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_resting_hr');
  END IF;
  IF v_sleep IS NOT NULL AND (v_sleep < 0 OR v_sleep > 2880) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_sleep_minutes');
  END IF;

  v_quality := CASE WHEN v_sleep IS NULL THEN NULL
                    ELSE greatest(1, least(10, round(v_sleep / 60.0)::int)) END;
  v_score := CASE
    WHEN v_hrv IS NULL OR v_rhr IS NULL OR v_sleep IS NULL THEN NULL
    ELSE round(
        45 * least(1, v_hrv / 65.0)
      + 35 * least(1, v_sleep / 480.0)
      + 20 * (1 - least(1, greatest(0, (v_rhr - 50) / 30.0)))
    )::int
  END;

  INSERT INTO public.bbf_readiness
    (user_id, source, reading_date, hrv_ms, resting_hr, sleep_minutes,
     sleep_quality, score, raw, "timestamp")
  VALUES (
    p_user_id, 'health_connect', v_date, v_hrv, v_rhr, v_sleep,
    v_quality, v_score,
    coalesce(p_reading->'raw', '{}'::jsonb),
    coalesce(nullif(p_reading->>'recorded_at', '')::timestamptz, now())
  )
  ON CONFLICT (user_id, source, reading_date) WHERE source IS NOT NULL AND reading_date IS NOT NULL
  DO UPDATE SET
    hrv_ms        = excluded.hrv_ms,
    resting_hr    = excluded.resting_hr,
    sleep_minutes = excluded.sleep_minutes,
    sleep_quality = excluded.sleep_quality,
    score         = excluded.score,
    raw           = excluded.raw,
    "timestamp"   = excluded."timestamp"
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'readiness_id', v_id,
    'derived', jsonb_build_object('sleep_quality', v_quality, 'score', v_score)
  );
END;
$function$;

-- ─── 3. Athlete-gated ingest (vault session token) ───────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_ingest_health_connect(p_session_token text, p_reading jsonb)
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
  RETURN public._bbf_upsert_health_connect_reading(v_user_id, p_reading);
END;
$function$;

-- ─── 4. Server/webhook ingest (service_role ONLY) ────────────────────────────
-- Explicit uid; the caller (bbf-health-sync edge function) authenticates the
-- webhook with the Vault shared secret via bbf_check_ingest_token() first.
CREATE OR REPLACE FUNCTION public.bbf_ingest_health_connect_admin(p_uid uuid, p_reading jsonb)
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
  RETURN public._bbf_upsert_health_connect_reading(p_uid, p_reading);
END;
$function$;

-- ─── 5. Grants ────────────────────────────────────────────────────────────────
-- Athlete RPC callable with the anon key (gated inside by the session token).
-- Supabase default privileges auto-GRANT to anon/authenticated on new public
-- functions — revoke explicitly where that would be a hole (admin + internal).
GRANT EXECUTE ON FUNCTION public.bbf_ingest_health_connect(text, jsonb) TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.bbf_ingest_health_connect_admin(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_ingest_health_connect_admin(uuid, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public._bbf_upsert_health_connect_reading(uuid, jsonb) FROM PUBLIC, anon, authenticated;
