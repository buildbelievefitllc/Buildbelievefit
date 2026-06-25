-- 30-Day Biometric Calibration — PHASE 1 (THE LEDGER): broadcast the calibration
-- anchor on login. bbf_verify_user_pin (the PIN/token-mint RPC) now returns
-- `calibration_started_at` in the success envelope so the Vault can compute the
-- athlete's calibration day/phase client-side (Phase 1: days 1-14, Phase 2: 15-29,
-- Phase 3: 30+ graduated).
--
-- ANCHOR CHOICE (deliberate): the calibration clock is anchored on
-- bbf_active_clients.created_at — the real intake timestamp, reliably DEFAULT now()
-- at lead capture. We do NOT add a fresh bbf_users.created_at DEFAULT now(): that
-- would stamp every EXISTING user with "today" and reset the entire roster to Day 1,
-- locking established clients out of Smart Cardio / the Library for 30 days. Anchoring
-- on the existing intake date auto-graduates everyone already 30+ days past onboarding
-- (zero disruption) and starts the clock at real onboarding for new athletes. Accounts
-- with no bbf_active_clients row return NULL → the frontend fails OPEN to "graduated"
-- and never padlocks an undatable account.
--
-- SURGICAL, additive change: one v_calibration_started_at declaration, created_at
-- folded into the EXISTING unconditional bbf_active_clients read (the sports_protocol
-- lookup), and one extra key in the success json_build_object. ALL other behavior —
-- PIN/bcrypt verification, the 3-strike lockout, kill-switch, the
-- bbf_users→bbf_active_clients plan fallback, the Native Sports Engine protocol, and
-- the 24h vault_token mint — is byte-preserved from 20260609130000.
CREATE OR REPLACE FUNCTION public.bbf_verify_user_pin(uid text, pin_attempt text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
declare
  v_target_uid          text := uid;
  v_key                 text := uid;
  v_attempt             bbf_pin_attempts%rowtype;
  v_stored_hash         text;
  v_is_valid            boolean := false;
  v_now                 timestamptz := now();
  v_retry_after         int := 0;
  v_user_id             uuid;
  v_user_email          text;
  v_access_status       text;          -- << KILL SWITCH >>
  v_workout_plan        text;
  v_meal_plan           text;
  v_plans_generated_at  timestamptz;
  v_daily_brief         text;
  v_sports_protocol     text;          -- << NATIVE SPORTS ENGINE >>
  v_calibration_started_at timestamptz; -- << 30-DAY CALIBRATION >> intake anchor
  v_vault_token         uuid;
begin
  select * into v_attempt from bbf_pin_attempts where key = v_key;
  if v_attempt.locked_until > v_now then
    return json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  end if;

  select pin_hash into v_stored_hash
    from bbf_users
   where bbf_users.uid = v_target_uid
     and bbf_users.deleted_at is null
   limit 1;

  if v_stored_hash is not null then
    if v_stored_hash like '$2a$%' then
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    else
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      if v_is_valid then
        update bbf_users
           set pin_hash = crypt(pin_attempt, gen_salt('bf'))
         where bbf_users.uid = v_target_uid
           and bbf_users.deleted_at is null;
      end if;
    end if;
  end if;

  if v_is_valid then
    delete from bbf_pin_attempts where key = v_key;

    -- << RESTORE >> Read the plan columns from bbf_users FIRST (the canonical
    -- source the admin Push-to-Athlete / assign_workout writes to), alongside the
    -- kill-switch access_status. The kill-switch migration dropped these here and
    -- read them ONLY from bbf_active_clients — that is the regression this fixes.
    select id, email, daily_brief, access_status, workout_plan, meal_plan, plans_generated_at
      into v_user_id, v_user_email, v_daily_brief, v_access_status, v_workout_plan, v_meal_plan, v_plans_generated_at
      from bbf_users
     where bbf_users.uid = v_target_uid
       and bbf_users.deleted_at is null
     limit 1;

    -- << KILL SWITCH >> A locked account authenticates correctly but is denied a
    -- session: no vault_token is minted, so the client cannot enter the Vault.
    if v_access_status = 'locked' then
      return json_build_object(
        'ok', false,
        'lockout_active', false,
        'retry_after_seconds', 0,
        'account_locked', true
      );
    end if;

    -- << RESTORE >> Fallback ONLY when bbf_users carries no workout_plan, so
    -- legacy active-clients-sourced athletes still resolve without overriding a
    -- bbf_users-written plan.
    if v_workout_plan is null and v_user_email is not null then
      select workout_plan, meal_plan, plans_generated_at
        into v_workout_plan, v_meal_plan, v_plans_generated_at
        from bbf_active_clients where vault_email = v_user_email limit 1;
    end if;

    -- << NATIVE SPORTS ENGINE >> + << 30-DAY CALIBRATION >> sports_protocol and the
    -- calibration anchor both live on bbf_active_clients (there is no bbf_users
    -- column for either), so read them together by email whenever present. created_at
    -- is the intake timestamp → the calibration clock origin. Null (no intake row) →
    -- the frontend fails open to "graduated" and never padlocks.
    if v_user_email is not null then
      select sports_protocol, created_at
        into v_sports_protocol, v_calibration_started_at
        from bbf_active_clients where vault_email = v_user_email limit 1;
    end if;

    -- Mint a 24h vault session token (and purge this user's expired tokens).
    delete from bbf_vault_sessions where user_id = v_user_id and expires_at < v_now;
    v_vault_token := gen_random_uuid();
    insert into bbf_vault_sessions (token, user_id, expires_at)
    values (v_vault_token, v_user_id, v_now + interval '24 hours');

    return json_build_object(
      'ok', true,
      'lockout_active', false,
      'retry_after_seconds', 0,
      'vault_token', v_vault_token,
      'plans_available', (v_plans_generated_at is not null),
      'workout_plan', v_workout_plan,
      'meal_plan', v_meal_plan,
      'sports_protocol', v_sports_protocol,
      'calibration_started_at', v_calibration_started_at,
      'plans_generated_at', v_plans_generated_at,
      'daily_brief', v_daily_brief
    );
  else
    insert into bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    values (v_key, 1, v_now, null, v_now)
    on conflict (key) do update set
      failed_count = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end,
      window_started_at = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then now() else bbf_pin_attempts.window_started_at end,
      locked_until = case
        when (case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end) >= 3
        then now() + interval '15 minutes'
        else null
      end,
      last_attempt_at = now();

    select * into v_attempt from bbf_pin_attempts where key = v_key;
    v_retry_after := case when v_attempt.locked_until > v_now then extract(epoch from (v_attempt.locked_until - v_now))::int else 0 end;
    return json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  end if;
end;
$function$;
