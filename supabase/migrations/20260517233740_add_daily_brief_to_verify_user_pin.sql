CREATE OR REPLACE FUNCTION public.bbf_verify_user_pin(uid text, pin_attempt text)
 RETURNS json
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
  v_daily_brief         TEXT;
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
    SELECT email, daily_brief
      INTO v_user_email, v_daily_brief
      FROM bbf_users
     WHERE bbf_users.uid = v_target_uid
     LIMIT 1;
    IF v_user_email IS NOT NULL THEN
      SELECT workout_plan, meal_plan, plans_generated_at
      INTO v_workout_plan, v_meal_plan, v_plans_generated_at
      FROM bbf_active_clients WHERE vault_email = v_user_email LIMIT 1;
    END IF;
    RETURN json_build_object(
      'ok', true,
      'lockout_active', false,
      'retry_after_seconds', 0,
      'plans_available', (v_plans_generated_at IS NOT NULL),
      'workout_plan', v_workout_plan,
      'meal_plan', v_meal_plan,
      'plans_generated_at', v_plans_generated_at,
      'daily_brief', v_daily_brief
    );
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
$function$;