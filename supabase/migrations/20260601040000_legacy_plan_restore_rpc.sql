-- ═══════════════════════════════════════════════════════════════
-- Legacy restoration · username-keyed plan fetch
-- ───────────────────────────────────────────────────────────────
-- The Original Five (jacky_bbf, ana_bbf, jacque_bbf, jordan_bbf,
-- wayne_bbf) are Username+PIN only — NO email. bbf_verify_user_pin
-- fetched plans from bbf_active_clients via an EMAIL join, gated behind
-- `if v_user_email is not null`, so emailless users got blank dashboards.
--
-- Fix: store plans on bbf_users (keyed by uid) and have the RPC read them
-- from there FIRST, falling back to the bbf_active_clients email join for
-- Pathfinder (email) clients. Auth itself was always uid+PIN — unchanged.
-- ═══════════════════════════════════════════════════════════════

-- 1. Plan columns on bbf_users (uid-keyed). akeem payload shape:
--    workout_plan = JSON array of days; meal_plan = JSON object.
alter table public.bbf_users add column if not exists workout_plan       text;
alter table public.bbf_users add column if not exists meal_plan          text;
alter table public.bbf_users add column if not exists plans_generated_at timestamptz;

-- 2. RPC: fetch plans by uid (bbf_users) first, then email fallback.
create or replace function public.bbf_verify_user_pin(uid text, pin_attempt text)
 returns json
 language plpgsql
 security definer
 set search_path to 'public', 'extensions'
as $function$
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
  v_workout_plan        text;
  v_meal_plan           text;
  v_plans_generated_at  timestamptz;
  v_daily_brief         text;
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

    -- Pull plans from bbf_users (uid-keyed) — works for username-only clients.
    select id, email, daily_brief, workout_plan, meal_plan, plans_generated_at
      into v_user_id, v_user_email, v_daily_brief, v_workout_plan, v_meal_plan, v_plans_generated_at
      from bbf_users
     where bbf_users.uid = v_target_uid
       and bbf_users.deleted_at is null
     limit 1;

    -- Pathfinder (email) clients keep their plans on bbf_active_clients —
    -- fall back to the email join only if bbf_users had no plan.
    if v_workout_plan is null and v_user_email is not null then
      select workout_plan, meal_plan, plans_generated_at
        into v_workout_plan, v_meal_plan, v_plans_generated_at
        from bbf_active_clients where vault_email = v_user_email limit 1;
    end if;

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
