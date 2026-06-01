-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SECURE READINESS-SYNC BRIDGE RPC (bbf_sync_readiness)
-- ═══════════════════════════════════════════════════════════════════════════
-- Parallel to bbf_sync_vault_session: restores the anon (legacy PIN) write
-- path to bbf_readiness, which the per-user RLS lockdown otherwise blocks.
-- Same security model:
--   • Authorization delegated to public.bbf_verify_user_pin(uid, pin)
--     (bcrypt + 3-strike / 15-minute bbf_pin_attempts lockout) — brute-force safe.
--   • The row is ALWAYS stamped with the user_id resolved from the *verified*
--     uid; any payload user_id is ignored, so cross-user forgery is impossible.
--   • SECURITY DEFINER bypasses the anon RLS block (and reads pin_hash) as owner.
--
-- Idempotent: CREATE OR REPLACE. No secrets stored.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_sync_readiness(
  p_uid       text,
  p_pin       text,
  p_readiness jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_auth         json;
  v_user_id      uuid;
  v_readiness_id uuid;
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 OR p_pin IS NULL OR length(p_pin) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'missing_credentials');
  END IF;

  -- 1. AUTHENTICATE — hardened verifier (bcrypt + lockout).
  v_auth := public.bbf_verify_user_pin(p_uid, p_pin);
  IF (v_auth->>'ok') IS DISTINCT FROM 'true' THEN
    RETURN json_build_object(
      'ok',                  false,
      'error',               'invalid_credentials',
      'lockout_active',      coalesce((v_auth->>'lockout_active')::boolean, false),
      'retry_after_seconds', coalesce((v_auth->>'retry_after_seconds')::int, 0)
    );
  END IF;

  -- 2. Resolve authoritative user_id from the VERIFIED uid (payload ignored).
  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid AND deleted_at IS NULL
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- 3. Insert the readiness row, stamped with the verified user_id.
  INSERT INTO public.bbf_readiness
    (user_id, score, sleep_quality, soreness_level, "timestamp")
  VALUES (
    v_user_id,
    (p_readiness->>'score')::int,
    (p_readiness->>'sleep_quality')::int,
    (p_readiness->>'soreness_level')::int,
    coalesce(nullif(p_readiness->>'timestamp','')::timestamptz, now())
  )
  RETURNING id INTO v_readiness_id;

  RETURN json_build_object('ok', true, 'readiness_id', v_readiness_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_sync_readiness(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_sync_readiness(text, text, jsonb)
  TO anon, authenticated, service_role;
