-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SECURE VAULT-SYNC BRIDGE RPC (bbf_sync_vault_session)
-- ═══════════════════════════════════════════════════════════════════════════
-- Context: the frontend is rolling back to the legacy 4/6-digit PIN gate, so
-- clients connect as the `anon` role again. The per-user RLS lockdown
-- (authenticated, user_id = auth.uid()) therefore blocks their workout writes
-- to bbf_logs/bbf_sets. This RPC restores that write path WITHOUT reopening the
-- cross-user spoofing hole.
--
-- ── SECURITY MODEL ─────────────────────────────────────────────────────────
--  • The caller proves authorization by passing the user's PIN. Verification is
--    DELEGATED to the existing hardened public.bbf_verify_user_pin(uid, pin),
--    which does bcrypt comparison AND enforces the 3-strike / 15-minute
--    bbf_pin_attempts lockout. This is what makes a short PIN safe behind an
--    anon-callable endpoint — a bare crypt() check here would be brute-forceable.
--  • The inserted rows are ALWAYS stamped with the user_id resolved from the
--    *verified* uid. Any user_id in the payload is ignored. A caller who passes
--    someone else's uid cannot write their data without that user's PIN (and is
--    rate-limited/locked out trying), so cross-user forgery is impossible.
--  • SECURITY DEFINER (owner-privileged) is what lets it bypass the anon RLS
--    block and read pin_hash — both shielded from anon directly.
--
-- Idempotent: CREATE OR REPLACE. No secrets stored. Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_sync_vault_session(
  p_uid     text,
  p_pin     text,
  p_session jsonb DEFAULT '{}'::jsonb,
  p_sets    jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_auth          json;
  v_user_id       uuid;
  v_log_id        uuid;
  v_sets_inserted int := 0;
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 OR p_pin IS NULL OR length(p_pin) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'missing_credentials');
  END IF;

  -- 1. AUTHENTICATE — delegate to the hardened verifier (bcrypt + lockout).
  v_auth := public.bbf_verify_user_pin(p_uid, p_pin);
  IF (v_auth->>'ok') IS DISTINCT FROM 'true' THEN
    RETURN json_build_object(
      'ok',                  false,
      'error',               'invalid_credentials',
      'lockout_active',      coalesce((v_auth->>'lockout_active')::boolean, false),
      'retry_after_seconds', coalesce((v_auth->>'retry_after_seconds')::int, 0)
    );
  END IF;

  -- 2. Resolve the authoritative user_id from the VERIFIED uid (payload ignored).
  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid AND deleted_at IS NULL
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'user_not_found');
  END IF;

  -- 3. Insert the session log row, stamped with the verified user_id.
  INSERT INTO public.bbf_logs
    (user_id, date, sport, position, drill_name, coach_notes, language, body_fat, duration)
  VALUES (
    v_user_id,
    coalesce(nullif(p_session->>'date','')::date, CURRENT_DATE),
    p_session->>'sport',
    p_session->>'position',
    p_session->>'drill_name',
    p_session->>'coach_notes',
    coalesce(nullif(p_session->>'language',''), 'en'),
    p_session->>'body_fat',
    p_session->>'duration'
  )
  RETURNING id INTO v_log_id;

  -- 4. Insert sets, all stamped with the same verified user_id + parent log_id.
  INSERT INTO public.bbf_sets
    (log_id, user_id, set_number, reps, weight_lbs, rpe, day_key, exercise_key)
  SELECT
    v_log_id,
    v_user_id,
    (s->>'set_number')::int,
    (s->>'reps')::int,
    (s->>'weight_lbs')::double precision,
    (s->>'rpe')::int,
    s->>'day_key',
    s->>'exercise_key'
  FROM jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) AS s;
  GET DIAGNOSTICS v_sets_inserted = ROW_COUNT;

  RETURN json_build_object(
    'ok',           true,
    'log_id',       v_log_id,
    'sets_inserted', v_sets_inserted
  );
END;
$function$;

-- Anon-callable (clients are on the PIN/anon path), but authorization is gated
-- inside the function by the PIN verification above.
REVOKE ALL ON FUNCTION public.bbf_sync_vault_session(text, text, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_sync_vault_session(text, text, jsonb, jsonb)
  TO anon, authenticated, service_role;
