-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — EXECUTIVE ACCESS CONTROL & ACCOUNT KILL SWITCH
-- (Command Center · Access Control / Revenue Roster)
-- ═══════════════════════════════════════════════════════════════════════════
-- The CEO's master control switches for subscription tier + Vault access. Every
-- capability is driven server-side by the bbf-admin-roster edge function, which
-- carries BBF_COACH_AGENT_TOKEN and calls these RPCs as the service role.
--
--   1. TIER REASSIGNMENT — reuses the existing public.bbf_admin_set_tier RPC
--      (allowlist-validated; akeem permanently 'sovereign'). Nothing changes here
--      beyond an explicit service_role EXECUTE grant so the edge fn can drive it.
--
--   2. ACCOUNT KILL SWITCH — public.bbf_admin_set_access_status(uid, status, actor):
--      flips bbf_users.access_status between 'unlocked' | 'locked' AND, on lock,
--      DELETES every bbf_vault_sessions row for that user. That instantly
--      invalidates the bearer token minted at PIN login — the app's session
--      "access_token" equivalent (there is NO GoTrue JWT in this architecture;
--      auth is username + PIN → a server-revocable vault_token). The live Vault's
--      next token-gated call / heartbeat then fails and the client is bounced to
--      the public login screen. akeem can NEVER be locked (CEO safety net).
--
--   3. RE-LOGIN BLOCK + DEFENSE IN DEPTH — a revoked token alone is not enough: a
--      locked athlete could re-enter their PIN and mint a fresh token. So:
--        • bbf_verify_user_pin now refuses a 'locked' account (no token minted).
--        • bbf_sync_vault_session / bbf_sync_readiness reject 'locked' accounts.
--        • bbf_validate_vault_session(uid, token) is the cheap, read-only heartbeat
--          the Vault polls to detect revocation and self-eject to /login.
--
-- SECURITY
--   • bbf_admin_set_access_status is the kill switch: REVOKED from
--     public/anon/authenticated, GRANTed ONLY to service_role, so it is reachable
--     solely through the token-gated admin edge function. (Contrast
--     bbf_admin_set_tier, which stays anon/authenticated-callable for the legacy
--     monolith storefront fulfilment path.)
--   • bbf_validate_vault_session is anon-callable (the client polls it) but leaks
--     nothing — it only confirms a caller-held 122-bit token is still live and the
--     account is not locked. No token can be harvested.
--
-- The bbf_verify_user_pin / bbf_sync_vault_session / bbf_sync_readiness bodies
-- below are reproduced VERBATIM from 20260601160000_bbf_vault_session_tokens.sql
-- (the current live versions) with only the minimal, commented lock additions, so
-- every existing behaviour — 3-strike lockout, lazy sha256→bcrypt migration, plans
-- + daily_brief fetch, 24h token mint — is preserved.
--
-- Idempotent (CREATE OR REPLACE / IF NOT EXISTS). Safe to re-apply.
-- Apply via Supabase MCP apply_migration AFTER PR review (touches the
-- safety-critical login path bbf_verify_user_pin).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. access_status column (already live: text default 'unlocked') ───────────
-- Belt-and-suspenders so any environment predating the column converges, without
-- disturbing live defaults/values. A partial index keeps the roster's "who is
-- locked" scan cheap (locked accounts are the rare case).
ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS access_status text DEFAULT 'unlocked';

CREATE INDEX IF NOT EXISTS idx_bbf_users_access_status_locked
  ON public.bbf_users (access_status)
  WHERE access_status = 'locked';

-- ─── 1. Kill switch — set access_status + revoke live vault sessions ───────────
CREATE OR REPLACE FUNCTION public.bbf_admin_set_access_status(
  p_uid    text,
  p_status text,
  p_actor  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_user_id          uuid;
  v_sessions_revoked int := 0;
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 THEN
    RAISE EXCEPTION 'invalid_uid';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('locked', 'unlocked') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  -- CEO safety net: the head coach can never be locked out of his own platform.
  IF p_uid = 'akeem' AND p_status = 'locked' THEN
    RAISE EXCEPTION 'akeem_cannot_be_locked';
  END IF;

  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid AND deleted_at IS NULL
   LIMIT 1
   FOR UPDATE;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.bbf_users
     SET access_status = p_status,
         updated_at    = now()
   WHERE id = v_user_id;

  -- On lock: instantly invalidate every live bearer token for this user. Their
  -- next sync / heartbeat returns invalid_session and the Vault ejects to login.
  IF p_status = 'locked' THEN
    DELETE FROM public.bbf_vault_sessions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_sessions_revoked = ROW_COUNT;
  END IF;

  RETURN json_build_object(
    'ok',               true,
    'uid',              p_uid,
    'access_status',    p_status,
    'sessions_revoked', v_sessions_revoked,
    'actor',            p_actor
  );
END;
$function$;

-- The kill switch is service-role ONLY (driven exclusively by the admin edge fn).
REVOKE ALL ON FUNCTION public.bbf_admin_set_access_status(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_admin_set_access_status(text, text, text) TO service_role;

-- ─── 2. Tier reassignment — let the service-role edge fn drive the existing RPC ─
GRANT EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text) TO service_role;

-- ─── 3. Session heartbeat — cheap, read-only bearer-token liveness check ───────
CREATE OR REPLACE FUNCTION public.bbf_validate_vault_session(
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
BEGIN
  -- Authorize purely on the bearer token; p_uid is advisory (logging/symmetry).
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u
      ON u.id = s.user_id
     AND u.deleted_at IS NULL
     AND u.access_status IS DISTINCT FROM 'locked'
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  RETURN json_build_object('ok', true);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_validate_vault_session(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_validate_vault_session(text, text) TO anon, authenticated, service_role;

-- ─── 4. bbf_verify_user_pin — refuse a 'locked' account (no token minted) ──────
-- Reproduced from 20260601160000 with TWO additions, both marked << KILL SWITCH >>:
-- read access_status alongside the user row, and bail before minting on 'locked'.
CREATE OR REPLACE FUNCTION public.bbf_verify_user_pin(uid text, pin_attempt text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
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

    select id, email, daily_brief, access_status
      into v_user_id, v_user_email, v_daily_brief, v_access_status   -- << KILL SWITCH >>
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

    if v_user_email is not null then
      select workout_plan, meal_plan, plans_generated_at
      into v_workout_plan, v_meal_plan, v_plans_generated_at
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

-- ─── 5. bbf_sync_vault_session — also reject a 'locked' account ────────────────
-- Reproduced from 20260601160000; the ONLY change is the access_status guard on
-- the user JOIN (<< KILL SWITCH >>). Token revocation already covers the common
-- case; this closes the window where a token outlives the status flip.
CREATE OR REPLACE FUNCTION public.bbf_sync_vault_session(
  p_uid           text,
  p_session_token text,
  p_session       jsonb DEFAULT '{}'::jsonb,
  p_sets          jsonb DEFAULT '[]'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_user_id       uuid;
  v_log_id        uuid;
  v_sets_inserted int := 0;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u
      ON u.id = s.user_id
     AND u.deleted_at IS NULL
     AND u.access_status IS DISTINCT FROM 'locked'   -- << KILL SWITCH >>
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  INSERT INTO public.bbf_logs
    (user_id, date, sport, position, drill_name, coach_notes, language, body_fat, duration)
  VALUES (
    v_user_id,
    coalesce(nullif(p_session->>'date','')::date, CURRENT_DATE),
    p_session->>'sport',
    p_session->>'position',
    p_session->>'drill_name',
    p_session->>'coach_notes',
    coalesce(nullif(p_session->>'language',''), 'en'),
    p_session->>'body_fat',
    p_session->>'duration'
  )
  RETURNING id INTO v_log_id;

  INSERT INTO public.bbf_sets
    (log_id, user_id, set_number, reps, weight_lbs, rpe, day_key, exercise_key)
  SELECT
    v_log_id, v_user_id,
    (s->>'set_number')::int,
    (s->>'reps')::int,
    (s->>'weight_lbs')::double precision,
    (s->>'rpe')::int,
    s->>'day_key',
    s->>'exercise_key'
  FROM jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) AS s;
  GET DIAGNOSTICS v_sets_inserted = ROW_COUNT;

  RETURN json_build_object('ok', true, 'log_id', v_log_id, 'sets_inserted', v_sets_inserted);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_sync_vault_session(text, text, jsonb, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_sync_vault_session(text, text, jsonb, jsonb)
  TO anon, authenticated, service_role;

-- ─── 6. bbf_sync_readiness — also reject a 'locked' account ────────────────────
CREATE OR REPLACE FUNCTION public.bbf_sync_readiness(
  p_uid           text,
  p_session_token text,
  p_readiness     jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_user_id      uuid;
  v_readiness_id uuid;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u
      ON u.id = s.user_id
     AND u.deleted_at IS NULL
     AND u.access_status IS DISTINCT FROM 'locked'   -- << KILL SWITCH >>
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  INSERT INTO public.bbf_readiness
    (user_id, score, sleep_quality, soreness_level, "timestamp")
  VALUES (
    v_user_id,
    (p_readiness->>'score')::int,
    (p_readiness->>'sleep_quality')::int,
    (p_readiness->>'soreness_level')::int,
    coalesce(nullif(p_readiness->>'timestamp','')::timestamptz, now())
  )
  RETURNING id INTO v_readiness_id;

  RETURN json_build_object('ok', true, 'readiness_id', v_readiness_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_sync_readiness(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_sync_readiness(text, text, jsonb)
  TO anon, authenticated, service_role;
