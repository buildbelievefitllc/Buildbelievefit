-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — audit ping on security-question PIN reset
-- ───────────────────────────────────────────────────────────────────────────
-- The email reset path (bbf-forgot-pin) already drops an admin-visible row in
-- bbf_email_events (event_type 'onboarding_alert', kind 'forgot_pin_self_reset')
-- so the coach can see who self-reset. The security-question path
-- (bbf_pin_recovery_reset) was silent. This adds the SAME lightweight ledger row
-- on a successful reset, so both self-service methods land in one Command Center
-- feed — a coach glance, nothing more (no PII beyond the username, no email send).
--
-- Best-effort: the audit insert is wrapped so a logging hiccup can NEVER block a
-- legitimate PIN reset. Everything else in the function is byte-preserved from
-- migration 20260713120000.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_pin_recovery_reset(
  p_uid     text,
  p_answer  text,
  p_new_pin text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  text := lower(btrim(coalesce(p_uid, '')));
  v_key  text := 'recover:' || v_uid;
  v_att  bbf_pin_attempts%rowtype;
  v_ok   boolean := false;
  v_now  timestamptz := now();
  v_new_failed int;
begin
  if v_uid = '' then
    raise exception 'missing_uid';
  end if;
  if p_new_pin is null or p_new_pin !~ '^[0-9]{4,8}$' then
    raise exception 'invalid_pin';
  end if;

  select * into v_att from bbf_pin_attempts where key = v_key;
  if v_att.locked_until is not null and v_att.locked_until > v_now then
    return jsonb_build_object(
      'ok', false, 'locked', true,
      'retry_after_seconds', extract(epoch from (v_att.locked_until - v_now))::int
    );
  end if;

  select true into v_ok
    from bbf_pin_recovery_answers a
    join bbf_users u on u.uid = a.uid
   where a.uid = v_uid
     and u.deleted_at is null
     and a.slot = 1
     and crypt(_bbf_norm_answer(p_answer), a.answer_hash) = a.answer_hash
   limit 1;

  if coalesce(v_ok, false) then
    update bbf_users
       set pin_hash = crypt(p_new_pin, gen_salt('bf'))
     where uid = v_uid
       and deleted_at is null;
    delete from bbf_pin_attempts where key = v_key;   -- clear recovery lockout
    delete from bbf_pin_attempts where key = v_uid;   -- clear any login lockout

    -- Best-effort coach ping: one admin-visible row, same shape the email reset
    -- path writes, so both self-reset methods surface together. Never blocks the
    -- reset — a logging failure is swallowed.
    begin
      -- channel is constrained to email/email_alt/sms; use 'email' to match the
      -- email-path alert exactly (this is a ledger row, not an actual send).
      insert into bbf_email_events (event_type, email, channel, payload)
      values (
        'onboarding_alert', null, 'email',
        jsonb_build_object(
          'kind', 'forgot_pin_self_reset',
          'reason', 'security_question',
          'uid', v_uid,
          'user_id', (select id from bbf_users where uid = v_uid limit 1),
          'detail', v_uid || ' reset their PIN via a security question.',
          'alerted_at', v_now
        )
      );
    exception when others then
      null;
    end;

    return jsonb_build_object('ok', true);
  end if;

  insert into bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
  values (v_key, 1, v_now, null, v_now)
  on conflict (key) do update set
    failed_count = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end,
    window_started_at = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then now() else bbf_pin_attempts.window_started_at end,
    locked_until = case
      when (case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end) >= 5
      then now() + interval '30 minutes'
      else null
    end,
    last_attempt_at = now();

  select failed_count into v_new_failed from bbf_pin_attempts where key = v_key;
  return jsonb_build_object('ok', false, 'locked', coalesce(v_new_failed, 0) >= 5);
end;
$$;
