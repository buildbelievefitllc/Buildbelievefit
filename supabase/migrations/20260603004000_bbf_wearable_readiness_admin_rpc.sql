-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — WEARABLE READINESS · SERVER-SIDE (service_role) ACWR READ
-- Phase 7 · Orchestrator Hardening
-- ───────────────────────────────────────────────────────────────────────────
-- bbf_get_wearable_readiness(session_token, as_of) is ATHLETE-facing: it gates on
-- a vault session token via public._bbf_uid_from_vault_token(). The nightly
-- bbf-agentic-orchestrator runs as service_role with an already-resolved
-- user_id and holds NO athlete session token, so it cannot use the token RPC.
--
-- This adds the missing uid sibling — exactly mirroring the established pattern
-- in 20260603001000_bbf_wearable_acwr_layer.sql, where the athlete ingest
-- (bbf_ingest_wearable_reading · token) already has a service_role uid sibling
-- (bbf_ingest_wearable_reading_admin · uuid). The readiness READ only shipped the
-- token version; this completes the pair so the orchestrator can ingest ACWR
-- server-side.
--
-- Returns the SAME shape as bbf_get_wearable_readiness:
--   { ok, as_of, acwr: { acute, chronic, acwr, flag, ... }, readings: [ recent ] }
-- Read-only. SECURITY DEFINER (owner-privileged) so its internal call to the
-- revoked-from-PUBLIC _bbf_wearable_acwr() resolves as owner — identical to how
-- the token wrapper calls it. service_role ONLY (never anon/authenticated).
--
-- Idempotent (CREATE OR REPLACE). Safe to re-apply.
-- DEPENDS ON: public.bbf_users(id), public.bbf_wearable_readings,
--             public._bbf_wearable_acwr(uuid, date)
--             (all from 20260603001000_bbf_wearable_acwr_layer.sql, ordered earlier).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_get_wearable_readiness_admin(p_uid uuid, p_as_of date DEFAULT current_date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_exists   boolean;
  v_readings jsonb;
  v_acwr     jsonb;
BEGIN
  SELECT true INTO v_exists FROM public.bbf_users WHERE id = p_uid AND deleted_at IS NULL;
  IF v_exists IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unknown_user');
  END IF;

  SELECT coalesce(jsonb_agg(r ORDER BY r.reading_date DESC), '[]'::jsonb)
    INTO v_readings
  FROM (
    SELECT reading_date, source, readiness_score, strain, resting_hr, hrv_ms, sleep_minutes
      FROM public.bbf_wearable_readings
     WHERE user_id = p_uid AND reading_date <= p_as_of
     ORDER BY reading_date DESC
     LIMIT 28
  ) r;

  v_acwr := public._bbf_wearable_acwr(p_uid, p_as_of);

  RETURN jsonb_build_object('ok', true, 'as_of', p_as_of, 'acwr', v_acwr, 'readings', v_readings);
END;
$function$;

-- service_role ONLY — the orchestrator path. Never anon/authenticated/PUBLIC.
REVOKE ALL    ON FUNCTION public.bbf_get_wearable_readiness_admin(uuid, date) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_get_wearable_readiness_admin(uuid, date) TO service_role;
