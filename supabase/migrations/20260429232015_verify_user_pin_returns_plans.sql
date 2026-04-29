-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_verify_user_pin returns plans (Phase 4, Step D)
-- ═══════════════════════════════════════════════════════════════════════════
-- Extends the existing bbf_verify_user_pin RPC so that on successful auth
-- it ALSO returns the user's workout_plan + meal_plan from bbf_active_clients
-- (joined by email = vault_email).
--
-- Why this design vs a separate "fetch plans" RPC:
--   - Avoids holding the PIN in client memory after login
--   - Single round-trip for auth + initial plan load
--   - SECURITY DEFINER bypass remains the only access path; anon role still
--     can't read bbf_active_clients directly
--   - Existing callers (admin.html, bbf-app.html, coach-lab.html) ignore
--     extra fields, so fully backward-compatible
--
-- Lockout, hash validation, sliding-window logic UNCHANGED. Only the
-- success branch adds the plans join + extra JSON fields.
--
-- Step D of 5 in Phase 4 closed-loop bridge:
--   A. Plan columns added (#62) ✓
--   B. Render writes back (#63) ✓
--   C. Pathfinder fires at /process (#64) ✓
--   D. App displays plans (THIS migration + bbf-app.html changes)
--   E. Credential auto-provisioning + welcome email
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_verify_user_pin(uid TEXT, pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_target_uid          TEXT := uid;
  v_key                 TEXT := uid;
  v_attempt             bbf_pin_attempts%ROWTYPE;
  v_stored_hash         TEXT;
  v_is_valid            BOOLEAN := FALSE;
  v_now                 TIMESTAMPTZ := now();
  v_retry_after         INT := 0;
  v_user_email          TEXT;
  v_workout_plan        TEXT;
  v_meal_plan           TEXT;
  v_plans_generated_at  TIMESTAMPTZ;
BEGIN
  -- 1. Lockout check
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object(
      'ok', false,
      'lockout_active', true,
      'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int
    );
  END IF;

  -- 2. Hash validation (lazy migration aware)
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

  -- 3. Handle result
  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;

    -- Phase 4 D: best-effort plans fetch by email join.
    -- If lookup fails for any reason, plans_available is false but auth still succeeds.
    SELECT email INTO v_user_email FROM bbf_users WHERE bbf_users.uid = v_target_uid LIMIT 1;
    IF v_user_email IS NOT NULL THEN
      SELECT workout_plan, meal_plan, plans_generated_at
      INTO v_workout_plan, v_meal_plan, v_plans_generated_at
      FROM bbf_active_clients
      WHERE vault_email = v_user_email
      LIMIT 1;
    END IF;

    RETURN json_build_object(
      'ok', true,
      'lockout_active', false,
      'retry_after_seconds', 0,
      'plans_available', (v_plans_generated_at IS NOT NULL),
      'workout_plan', v_workout_plan,
      'meal_plan', v_meal_plan,
      'plans_generated_at', v_plans_generated_at
    );
  ELSE
    -- 60-minute sliding window failure increment
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

    RETURN json_build_object(
      'ok', false,
      'lockout_active', v_attempt.failed_count >= 3,
      'retry_after_seconds', v_retry_after
    );
  END IF;
END;
$function$;
