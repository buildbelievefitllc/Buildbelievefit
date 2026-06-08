-- BBF Voice Token Ledger — per-user MONTHLY token metering for the live
-- Sovereign Coach (Gemini native-audio over /ws/phantom-eye). The Render WS
-- proxy checks the balance before minting a session ticket and commits the
-- session's token delta on teardown. Identity is resolved SERVER-SIDE — a
-- client-supplied uid is never trusted as the charged party.
--
-- Tier ceilings (CEO directive · keep in LOCKSTEP with entitlement-gate.ts
-- AUTO_BAND / APEX_BAND — voice_coach is Autonomous-and-up ONLY):
--   • Autonomous band  → 150,000 tokens / month
--   • Apex (Sovereign) → 750,000 tokens / month
--   • God Mode (admin/trainer/coach · akeem · active trial) → UNMETERED
--   • everything else (Baseline / Youth / none / unmapped) → NOT entitled
--
-- ADDITIVE + service-role only. SECURITY DEFINER RPCs are the sole writers.

create table if not exists public.bbf_voice_token_ledger (
  user_id     uuid        not null references public.bbf_users(id) on delete cascade,
  period      text        not null,                      -- 'YYYY-MM' (UTC)
  tokens_used bigint      not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, period)
);

alter table public.bbf_voice_token_ledger enable row level security;
-- No anon/authenticated policies: reachable ONLY through the SECURITY DEFINER
-- RPCs below + service_role (which bypasses RLS).
revoke all on table public.bbf_voice_token_ledger from anon, authenticated;

-- ── ceiling resolver — tier slug → monthly ceiling. NULL = NOT a voice tier
--    (God Mode unmetered is decided in the precheck, before this is called).
create or replace function public._bbf_voice_token_ceiling(p_tier text)
returns bigint
language sql
immutable
as $$
  select case lower(coalesce(p_tier, ''))
    -- Autonomous band (+ legacy gateway / architect) → 150k
    when 'autonomous'            then 150000
    when 'fuel_performance'      then 150000
    when 'gateway'               then 150000
    when 'architect'             then 150000
    -- Apex / Sovereign band (+ legacy sovereign / nutrition_platinum) → 750k
    when 'fuel_sovereign'        then 750000
    when 'kickstart_6wk_3x'      then 750000
    when 'kickstart_6wk_4x'      then 750000
    when 'transformation_8wk_3x' then 750000
    when 'transformation_8wk_4x' then 750000
    when 'sovereign_12wk_3x'     then 750000
    when 'sovereign_12wk_4x'     then 750000
    when 'sovereign'             then 750000
    when 'nutrition_platinum'    then 750000
    else null
  end;
$$;

-- ── precheck — called by the proxy BEFORE minting a session ticket. Resolves
--    band + God Mode + current-period balance for an already-resolved user_id.
create or replace function public.bbf_voice_session_precheck(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user   public.bbf_users%rowtype;
  v_period text   := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_god    boolean := false;
  v_ceil   bigint;
  v_used   bigint := 0;
begin
  if p_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;

  select * into v_user from public.bbf_users
    where id = p_user_id and deleted_at is null limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid_session');
  end if;
  if coalesce(v_user.access_status, '') = 'locked' then
    return jsonb_build_object('ok', false, 'reason', 'account_locked', 'uid', v_user.uid);
  end if;

  -- God Mode (mirror entitlement-gate): role ∈ {admin,trainer,coach} · uid='akeem' · active trial.
  v_god := lower(coalesce(v_user.role, '')) in ('admin','trainer','coach')
        or lower(coalesce(v_user.uid, '')) = 'akeem'
        or (v_user.trial_expires_at is not null and v_user.trial_expires_at > now());

  select coalesce(tokens_used, 0) into v_used
    from public.bbf_voice_token_ledger
   where user_id = p_user_id and period = v_period;
  v_used := coalesce(v_used, 0);

  if v_god then
    return jsonb_build_object('ok', true, 'uid', v_user.uid, 'user_id', p_user_id,
      'tier', v_user.subscription_tier, 'god_mode', true,
      'ceiling', null, 'used', v_used, 'remaining', null, 'period', v_period);
  end if;

  v_ceil := public._bbf_voice_token_ceiling(v_user.subscription_tier);
  if v_ceil is null then
    return jsonb_build_object('ok', false, 'reason', 'not_entitled',
      'uid', v_user.uid, 'tier', v_user.subscription_tier);
  end if;

  if v_used >= v_ceil then
    return jsonb_build_object('ok', false, 'reason', 'quota_exhausted',
      'uid', v_user.uid, 'user_id', p_user_id, 'tier', v_user.subscription_tier,
      'god_mode', false, 'ceiling', v_ceil, 'used', v_used, 'remaining', 0, 'period', v_period);
  end if;

  return jsonb_build_object('ok', true, 'uid', v_user.uid, 'user_id', p_user_id,
    'tier', v_user.subscription_tier, 'god_mode', false,
    'ceiling', v_ceil, 'used', v_used, 'remaining', greatest(v_ceil - v_used, 0), 'period', v_period);
end;
$$;

-- ── commit — called by the proxy on session teardown with the Gemini-reported
--    session token total. uid is HMAC-verified from the session ticket.
create or replace function public.bbf_voice_session_commit(p_uid text, p_tokens bigint)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_period  text   := to_char(now() at time zone 'utc', 'YYYY-MM');
  v_tokens  bigint := greatest(coalesce(p_tokens, 0), 0);
  v_used    bigint;
begin
  if p_uid is null or length(p_uid) = 0 then
    return jsonb_build_object('ok', false, 'reason', 'missing_uid');
  end if;
  select id into v_user_id from public.bbf_users
    where uid = p_uid and deleted_at is null limit 1;
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'unknown_uid');
  end if;
  if v_tokens = 0 then
    return jsonb_build_object('ok', true, 'committed', 0, 'period', v_period, 'note', 'zero_delta');
  end if;

  insert into public.bbf_voice_token_ledger (user_id, period, tokens_used, updated_at)
    values (v_user_id, v_period, v_tokens, now())
  on conflict (user_id, period)
    do update set tokens_used = public.bbf_voice_token_ledger.tokens_used + excluded.tokens_used,
                  updated_at  = now()
  returning tokens_used into v_used;

  return jsonb_build_object('ok', true, 'user_id', v_user_id, 'used', v_used,
    'committed', v_tokens, 'period', v_period);
end;
$$;

revoke all on function public._bbf_voice_token_ceiling(text)        from public;
revoke all on function public.bbf_voice_session_precheck(uuid)      from public;
revoke all on function public.bbf_voice_session_commit(text,bigint) from public;
grant execute on function public._bbf_voice_token_ceiling(text)        to service_role;
grant execute on function public.bbf_voice_session_precheck(uuid)      to service_role;
grant execute on function public.bbf_voice_session_commit(text,bigint) to service_role;
