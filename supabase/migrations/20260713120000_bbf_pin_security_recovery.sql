-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — Knowledge-based PIN recovery (security questions)
-- ───────────────────────────────────────────────────────────────────────────
-- Gives Pathfinder-onboarded clients (role='client') a self-service PIN reset
-- that does NOT depend on email: they set two security questions during setup,
-- and on a lost PIN they answer one at a recovery gate to mint a new PIN.
--
-- HARDENING (mirrors the pin_hash doctrine, §7 + 20260601130000):
--   • Answers are BCRYPT-hashed (extensions.crypt + gen_salt('bf')). The
--     plaintext answer is normalized then hashed INSIDE the RPC — only the
--     digest is ever persisted, exactly like pin_hash. No plaintext at rest.
--   • bbf_pin_recovery_answers is RLS-enabled with NO anon/authenticated
--     policies and all table privileges revoked — it is reachable ONLY through
--     the SECURITY DEFINER RPCs below (and service_role). The anon key in the
--     client bundle cannot read a single answer hash or question_key.
--   • Anti-enumeration: bbf_pin_recovery_challenge returns a DETERMINISTIC
--     DECOY question for any uid that doesn't exist or hasn't set answers, so
--     the recovery gate is byte-identical for real and fake accounts. Only a
--     correct answer to a REAL stored question ever resets a PIN.
--   • Per-uid brute-force lockout via the existing bbf_pin_attempts table
--     (key = 'recover:<uid>'), 5 attempts / 30-minute lock — independent of the
--     login lockout (key = '<uid>') so a recovery attacker can't lock the real
--     owner out of normal login, and vice-versa.
--   • Setup is authenticated by the live 24h vault_token (bbf_vault_sessions),
--     so only the signed-in account holder can set/replace their own answers.
--
-- The question TEXT is never stored — only a stable question_key. The frontend
-- owns the trilingual label bank (EN/ES/PT), keeping this layer i18n-agnostic.
-- Idempotent (CREATE OR REPLACE / IF NOT EXISTS). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Storage ───────────────────────────────────────────────────────────────
create table if not exists public.bbf_pin_recovery_answers (
  uid           text     not null references public.bbf_users(uid) on delete cascade,
  slot          smallint not null check (slot in (1, 2)),
  question_key  text     not null,
  answer_hash   text     not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (uid, slot)
);

alter table public.bbf_pin_recovery_answers enable row level security;

-- Column/table privilege lock: no direct access for the public anon key or
-- authenticated role. There are intentionally NO RLS policies for those roles —
-- every read/write goes through the SECURITY DEFINER RPCs (which run as the
-- table owner and bypass RLS) or service_role. This is the same two-lock shield
-- pin_hash carries: even a future permissive policy can't help a role that has
-- had its table privileges revoked.
revoke all on public.bbf_pin_recovery_answers from anon, authenticated;

-- ── 2. Answer normalization (shared) ─────────────────────────────────────────
-- Lowercase, trim ends, collapse internal whitespace runs to one space. Applied
-- identically at set-time and verify-time so "  Fluffy " matches "fluffy".
create or replace function public._bbf_norm_answer(p_answer text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(btrim(coalesce(p_answer, ''))), '\s+', ' ', 'g');
$$;

-- ── 3. Set / replace a client's two security questions (authenticated) ───────
-- p_items: jsonb array of exactly two objects:
--   [{"slot":1,"question_key":"first_pet","answer":"Rex"},
--    {"slot":2,"question_key":"birth_city","answer":"Miami"}]
-- Auth is the live vault_token (minted by bbf_verify_user_pin) — NOT a raw PIN,
-- so this composes with the existing session model. Answers are hashed in-RPC.
create or replace function public.bbf_set_recovery_questions(
  p_vault_token uuid,
  p_items       jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid        text;
  v_item       jsonb;
  v_slot       smallint;
  v_qkey       text;
  v_ans        text;
  v_seen_slots smallint[] := '{}';
  v_seen_keys  text[]     := '{}';
begin
  -- Resolve the session → uid (unexpired token, live account).
  select u.uid into v_uid
    from bbf_vault_sessions s
    join bbf_users u on u.id = s.user_id
   where s.token = p_vault_token
     and s.expires_at > now()
     and u.deleted_at is null
   limit 1;
  if v_uid is null then
    raise exception 'invalid_session';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) <> 2 then
    raise exception 'need_two_questions';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_slot := (v_item->>'slot')::smallint;
    v_qkey := btrim(v_item->>'question_key');
    v_ans  := _bbf_norm_answer(v_item->>'answer');

    if v_slot not in (1, 2)            then raise exception 'bad_slot'; end if;
    if v_qkey is null or length(v_qkey) = 0 then raise exception 'bad_question'; end if;
    -- Require a non-trivial answer so a client can't set an empty/near-empty
    -- secret that anyone could guess.
    if length(v_ans) < 2               then raise exception 'answer_too_short'; end if;
    if v_slot = any(v_seen_slots)      then raise exception 'duplicate_slot'; end if;
    if v_qkey = any(v_seen_keys)       then raise exception 'duplicate_question'; end if;
    v_seen_slots := v_seen_slots || v_slot;
    v_seen_keys  := v_seen_keys  || v_qkey;

    insert into bbf_pin_recovery_answers (uid, slot, question_key, answer_hash)
    values (v_uid, v_slot, v_qkey, crypt(v_ans, gen_salt('bf')))
    on conflict (uid, slot) do update
      set question_key = excluded.question_key,
          answer_hash  = excluded.answer_hash,
          updated_at   = now();
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

-- ── 4. Recovery challenge — which question to display (anon, decoy-safe) ──────
-- Returns { ok, slot, question_key } for the account's slot-1 question when it
-- exists; otherwise a DETERMINISTIC decoy (stable per-uid, drawn from the same
-- bank) so a caller cannot distinguish a real account from a nonexistent one.
-- Honors the recovery lockout so a locked attacker gets no fresh challenge.
create or replace function public.bbf_pin_recovery_challenge(p_uid text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid  text := lower(btrim(coalesce(p_uid, '')));
  v_key  text := 'recover:' || v_uid;
  v_att  bbf_pin_attempts%rowtype;
  v_qkey text;
  v_bank text[] := array[
    'mothers_maiden', 'first_pet', 'birth_city',
    'childhood_street', 'elementary_school', 'favorite_teacher'
  ];
  v_idx  int;
begin
  if v_uid = '' then
    raise exception 'missing_uid';
  end if;

  select * into v_att from bbf_pin_attempts where key = v_key;
  if v_att.locked_until is not null and v_att.locked_until > now() then
    return jsonb_build_object(
      'ok', false, 'locked', true,
      'retry_after_seconds', extract(epoch from (v_att.locked_until - now()))::int
    );
  end if;

  -- Real slot-1 question for a live account?
  select a.question_key into v_qkey
    from bbf_pin_recovery_answers a
    join bbf_users u on u.uid = a.uid
   where a.uid = v_uid
     and u.deleted_at is null
     and a.slot = 1
   limit 1;

  if v_qkey is null then
    -- Deterministic decoy: pick a bank entry from a hash of the uid so the same
    -- unknown username always yields the same question (indistinguishable from a
    -- real one, and stable across retries).
    v_idx := (('x' || substr(md5(v_uid), 1, 8))::bit(32)::int & 2147483647)
             % array_length(v_bank, 1);
    v_qkey := v_bank[v_idx + 1];
  end if;

  return jsonb_build_object('ok', true, 'slot', 1, 'question_key', v_qkey);
end;
$$;

-- ── 5. Recovery reset — verify answer, mint new PIN (anon, rate-limited) ──────
-- Verifies p_answer against the account's slot-1 stored hash. On success: sets a
-- fresh bcrypt pin_hash and clears BOTH the recovery lockout and the login
-- lockout. On failure (wrong answer, no questions set, or nonexistent account):
-- increments the recovery lockout and returns a GENERIC {ok:false} — never
-- revealing which of those it was.
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
  -- Numeric PIN only (client 6-digit; accept 4–8 to match the reissue RPCs).
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

  -- Constant-shape verify: match the normalized answer against the slot-1 hash
  -- of a LIVE account. A decoy/nonexistent account simply has no row → v_ok stays
  -- false and falls through to the generic failure path.
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
    return jsonb_build_object('ok', true);
  end if;

  -- Failure → advance the recovery lockout (5 tries / 30-min lock, 60-min window).
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

-- ── 5b. Recovery status — has this signed-in client set their questions? ─────
-- Authenticated (vault_token) read used by the first-login setup gate and the
-- Settings "manage" surface to decide whether to prompt. Never exposes answers.
create or replace function public.bbf_recovery_status(p_vault_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid   text;
  v_count int;
begin
  select u.uid into v_uid
    from bbf_vault_sessions s
    join bbf_users u on u.id = s.user_id
   where s.token = p_vault_token
     and s.expires_at > now()
     and u.deleted_at is null
   limit 1;
  if v_uid is null then
    raise exception 'invalid_session';
  end if;

  select count(*) into v_count from bbf_pin_recovery_answers where uid = v_uid;
  return jsonb_build_object('ok', true, 'set', v_count >= 2, 'count', v_count);
end;
$$;

-- ── 6. Grants ────────────────────────────────────────────────────────────────
-- Challenge/reset are anon-callable (same posture as bbf_verify_user_pin) — they
-- self-gate via the decoy + lockout. Set-questions is anon/authenticated-callable
-- but self-gates via the vault_token. None can leak an answer hash.
revoke all on function public.bbf_set_recovery_questions(uuid, jsonb)  from public;
revoke all on function public.bbf_pin_recovery_challenge(text)         from public;
revoke all on function public.bbf_pin_recovery_reset(text, text, text) from public;
revoke all on function public.bbf_recovery_status(uuid)                from public;
grant execute on function public.bbf_set_recovery_questions(uuid, jsonb)  to anon, authenticated, service_role;
grant execute on function public.bbf_pin_recovery_challenge(text)         to anon, authenticated, service_role;
grant execute on function public.bbf_pin_recovery_reset(text, text, text) to anon, authenticated, service_role;
grant execute on function public.bbf_recovery_status(uuid)                to anon, authenticated, service_role;

comment on table public.bbf_pin_recovery_answers is
  'Knowledge-based PIN recovery. Bcrypt answer hashes only (never plaintext); RLS-shielded, reachable solely via the bbf_*recovery* SECURITY DEFINER RPCs + service_role. question TEXT is never stored — only a stable question_key the frontend localizes.';
