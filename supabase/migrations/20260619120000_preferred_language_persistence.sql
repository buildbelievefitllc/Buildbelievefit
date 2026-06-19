-- Phase A — Explicit language persistence (Pathfinder funnel hardening).
--
-- Closes the gap where a client's chosen intake language was captured into
-- bbf_leads.payload but DROPPED before bbf_active_clients (the record the Vault
-- reads at login), so the post-login experience only stayed in-language by
-- accident of browser localStorage. Now the DB is the source of truth:
--   1) bbf_active_clients gains preferred_language (set at intake by
--      bbf-lead-capture from the payload's language_preference).
--   2) bbf_verify_user_pin returns preferred_language on login so the Vault
--      opens in the client's language on ANY device / fresh cache.
--
-- ── 1. Schema ────────────────────────────────────────────────────────────────
ALTER TABLE public.bbf_active_clients
  ADD COLUMN IF NOT EXISTS preferred_language varchar(2) NOT NULL DEFAULT 'en';

-- ── 2. Login hydration ───────────────────────────────────────────────────────
-- SURGICAL, additive change over 20260609130000_bbf_verify_user_pin_sports_protocol:
-- one new declaration (v_preferred_language), the sports_protocol read now also
-- pulls preferred_language in the same query, and one extra key in the success
-- json_build_object. ALL other behavior — PIN/bcrypt verification, lockout,
-- kill-switch, the bbf_users→bbf_active_clients plan fallback, the staged
-- sports_protocol read, and the 24h vault_token mint — is byte-preserved.
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
  v_preferred_language  text := 'en';  -- << LANGUAGE PERSISTENCE >>
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

    -- << NATIVE SPORTS ENGINE + LANGUAGE >> sports_protocol and preferred_language
    -- are staged at intake into bbf_active_clients (no bbf_users columns), so read
    -- them from there by email whenever present. sports_protocol null → the Portal
    -- GPP fallback; preferred_language defaults to 'en' when no staged row exists.
    if v_user_email is not null then
      select sports_protocol, coalesce(preferred_language, 'en')
        into v_sports_protocol, v_preferred_language
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
      'preferred_language', coalesce(v_preferred_language, 'en'),
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
