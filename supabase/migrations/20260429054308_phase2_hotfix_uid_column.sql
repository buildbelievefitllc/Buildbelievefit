-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — PHASE 2 HOTFIX: uid column correction
-- ═══════════════════════════════════════════════════════════════════════════
-- File reconstructed 2026-04-29 from the production migration registry
-- (supabase_migrations.schema_migrations) to match the literal SQL that was
-- applied as `phase2_hotfix_uid_column` (version 20260429054308) during
-- Phase 2 emergency repair.
--
-- Context: Phase 2 server-side bcrypt RPCs were authored against the
-- fictional repo schema where bbf_users.id was a TEXT username. Production
-- actually has bbf_users.id UUID + bbf_users.uid TEXT for the username, so
-- every RPC's WHERE clause was looking up the wrong column. This hotfix
-- corrected all three RPCs to query/update by `uid`.
--
-- This migration is registered as APPLIED in the production registry. The
-- baseline migration (20260101000000_baseline) already creates these RPCs
-- in their post-hotfix form, so a from-scratch replay produces the same
-- final state — this hotfix becomes a no-op CREATE OR REPLACE in that case.
-- ═══════════════════════════════════════════════════════════════════════════

-- Phase 2 hotfix: production bbf_users uses 'uid' (TEXT) for username, not 'id' (UUID).
-- Corrects all three Phase 2 functions to query/update by the correct column.

CREATE OR REPLACE FUNCTION bbf_verify_admin_pin(pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key TEXT := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'UNKNOWN_IP');
  v_attempt bbf_pin_attempts%ROWTYPE;
  v_stored_hash TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := now();
  v_retry_after INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash
  FROM bbf_users
  WHERE uid = 'akeem' AND role = 'trainer'
  LIMIT 1;

  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(pin_attempt, gen_salt('bf')) WHERE uid = 'akeem';
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'lockout_active', false, 'retry_after_seconds', 0);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bbf_verify_user_pin(uid TEXT, pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_uid TEXT := uid;
  v_key TEXT := uid;
  v_attempt bbf_pin_attempts%ROWTYPE;
  v_stored_hash TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := now();
  v_retry_after INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash FROM bbf_users WHERE bbf_users.uid = v_target_uid LIMIT 1;
  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(pin_attempt, gen_salt('bf')) WHERE bbf_users.uid = v_target_uid;
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'lockout_active', false, 'retry_after_seconds', 0);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bbf_admin_clear_lockout(target_key TEXT, founder_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_ip TEXT := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'UNKNOWN_IP');
  v_key TEXT := 'CLEAR:' || v_caller_ip;
  v_attempt bbf_pin_attempts%ROWTYPE;
  v_stored_hash TEXT;
  v_is_valid BOOLEAN := FALSE;
  v_now TIMESTAMPTZ := now();
  v_retry_after INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash FROM bbf_users WHERE uid = 'akeem' AND role = 'trainer' LIMIT 1;
  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(founder_pin, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(founder_pin, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(founder_pin, gen_salt('bf')) WHERE uid = 'akeem';
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = target_key;
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'cleared_key', target_key);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$$;
