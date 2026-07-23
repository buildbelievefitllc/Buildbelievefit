-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SELF-SERVICE ACCOUNT DELETION (App Store Guideline 5.1.1)
-- ═══════════════════════════════════════════════════════════════════════════
-- Apple requires any app that supports account creation to offer in-app
-- account deletion. This RPC is the backend for the "Delete Account" action in
-- the Vault Settings surface (frontend/src/components/vault/Settings.jsx).
--
-- DESIGN
--   • Authorization: bearer vault_token ONLY — identical pattern to
--     bbf_sync_vault_session / bbf_sync_readiness (20260601160000). p_uid is
--     never trusted for auth; it is only cross-checked against the token's
--     resolved identity as a fat-finger guard.
--   • Purge: dynamic sweep of every public base table carrying a
--     `user_id uuid` column, deleting the caller's rows. Two passes ride out
--     FK ordering; per-table exceptions are captured (subtransactions), never
--     fatal. Excluded from the sweep:
--       - bbf_users      (tombstoned below, not deleted — FK anchor)
--       - bbf_audit_logs (security/audit trail retained by policy)
--   • Email-keyed intake rows (bbf_active_clients: clinical history, macros,
--     phone) are deleted by vault_email/client_email match.
--   • bbf_pin_attempts row for the uid is cleared.
--   • The bbf_users row is tombstoned (deleted_at/… — every auth path already
--     filters `deleted_at is null`) and PII columns are scrubbed. The vault
--     session sweep revokes ALL live tokens, including the one used to call
--     this function — the account is unreachable the moment this commits.
--   • Admin/coach interlock: role admin/trainer (and the head-coach uid) are
--     refused — privileged accounts are decommissioned via ops, never a
--     one-tap client-side action.
--
-- SECURITY
--   • SECURITY DEFINER with pinned search_path; grants: anon, authenticated,
--     service_role (client calls ride the anon key + bearer token, the same
--     trust model as the existing sync RPCs). Tokens are UUIDv4 (122 bits) —
--     unguessable, so no additional rate limit is required (see the vault
--     session architecture notes in 20260601160000).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_delete_account(
  p_uid           text,
  p_session_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_user_id uuid;
  v_uid     text;
  v_email   text;
  v_role    text;
  r         record;
  v_count   bigint;
  v_total   bigint := 0;
  v_tables  int    := 0;
  v_pass    int;
  v_failed  text[] := '{}';
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- Authorize purely on the bearer token; p_uid is not trusted for auth.
  SELECT s.user_id, u.uid, u.email, coalesce(u.role, '')
    INTO v_user_id, v_uid, v_email, v_role
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- Fat-finger guard: if the caller names an account, it must be their own.
  IF p_uid IS NOT NULL AND length(trim(p_uid)) > 0
     AND lower(trim(p_uid)) <> lower(v_uid) THEN
    RETURN json_build_object('ok', false, 'error', 'uid_mismatch');
  END IF;

  -- Privileged-account interlock: coach/admin decommissioning is an ops task.
  IF lower(v_role) IN ('admin', 'trainer') OR lower(v_uid) = 'akeem' THEN
    RETURN json_build_object('ok', false, 'error', 'admin_account');
  END IF;

  -- Dynamic purge of every user_id-keyed public table (two passes for FK order).
  FOR v_pass IN 1..2 LOOP
    v_failed := '{}';
    FOR r IN
      SELECT c.table_name
        FROM information_schema.columns c
        JOIN information_schema.tables t
          ON t.table_schema = c.table_schema
         AND t.table_name   = c.table_name
         AND t.table_type   = 'BASE TABLE'
       WHERE c.table_schema = 'public'
         AND c.column_name  = 'user_id'
         AND c.data_type    = 'uuid'
         AND c.table_name NOT IN ('bbf_users', 'bbf_audit_logs')
    LOOP
      BEGIN
        EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', r.table_name)
          USING v_user_id;
        GET DIAGNOSTICS v_count = ROW_COUNT;
        IF v_pass = 1 THEN v_tables := v_tables + 1; END IF;
        v_total := v_total + v_count;
      EXCEPTION WHEN OTHERS THEN
        v_failed := array_append(v_failed, r.table_name);
      END;
    END LOOP;
    EXIT WHEN coalesce(array_length(v_failed, 1), 0) = 0;
  END LOOP;

  -- Email-keyed intake/clinical rows (no user_id column on bbf_active_clients).
  IF v_email IS NOT NULL AND length(v_email) > 0 THEN
    BEGIN
      DELETE FROM public.bbf_active_clients
       WHERE vault_email = v_email OR client_email = v_email;
    EXCEPTION WHEN OTHERS THEN
      v_failed := array_append(v_failed, 'bbf_active_clients');
    END;
  END IF;

  -- PIN throttle bookkeeping for this uid.
  BEGIN
    DELETE FROM public.bbf_pin_attempts WHERE key = v_uid;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- Tombstone + PII scrub. Every auth path filters deleted_at IS NULL, so the
  -- account is dead immediately; the row itself remains as the FK anchor.
  UPDATE public.bbf_users
     SET deleted_at      = now(),
         deleted_reason  = 'self_service_account_deletion',
         deleted_by      = 'user',
         name            = NULL,
         email           = NULL,
         pin_hash        = NULL,
         avatar          = NULL,
         daily_brief     = NULL,
         nutrition_plan  = NULL,
         dietary_profile = NULL,
         allergens       = NULL,
         food_likes      = NULL,
         food_dislikes   = NULL,
         par_q_screen    = NULL,
         workout_plan    = NULL,
         meal_plan       = NULL,
         sport           = NULL,
         "position"      = NULL,
         youth_progress  = NULL
   WHERE id = v_user_id;

  RETURN json_build_object(
    'ok', true,
    'account_deleted', true,
    'rows_purged', v_total,
    'tables_swept', v_tables,
    'tables_failed', to_json(v_failed)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_delete_account(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_delete_account(text, text)
  TO anon, authenticated, service_role;
