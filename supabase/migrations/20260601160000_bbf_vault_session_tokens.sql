-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — VAULT SESSION TOKEN ARCHITECTURE
-- ═══════════════════════════════════════════════════════════════════════════
-- Replaces caching the raw PIN in client memory with short-lived bearer tokens.
--   • bbf_verify_user_pin: on successful PIN auth, mints a vault_token (24h) and
--     returns it. (All existing behaviour — lockout, lazy sha256->bcrypt
--     migration, plans/daily_brief fetch — preserved verbatim.)
--   • bbf_sync_vault_session / bbf_sync_readiness: now take p_session_token
--     instead of p_pin; they validate the token and stamp the row with the
--     user_id resolved FROM THE TOKEN (never a caller-supplied value).
--
-- SECURITY NOTES
--   • bbf_vault_sessions holds bearer credentials. RLS is enabled with NO
--     policies and table grants are revoked from anon/authenticated, so the
--     ONLY access is via the SECURITY DEFINER functions below (which bypass
--     RLS as owner). Tokens cannot be harvested via the REST API.
--   • Tokens are random UUIDv4 (122 bits) -> unguessable, so the token-validating
--     RPCs need no rate-limit. Brute-force protection stays where it belongs:
--     the PIN check in bbf_verify_user_pin (3-strike / 15-min lockout).
--   • expires_at is timestamptz (now() is tz-aware); a bare TIMESTAMP would
--     mis-compare across session timezones.
--   • Hardening option (not implemented, noted for later): store sha256(token)
--     instead of the raw token so a DB read can't resurrect live sessions.
--     Kept raw here to match the agreed contract; the table is unreadable
--     by anon/authenticated regardless.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Session state table ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbf_vault_sessions (
  token       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS idx_vault_sessions_expires ON public.bbf_vault_sessions (expires_at);
CREATE INDEX IF NOT EXISTS idx_vault_sessions_user    ON public.bbf_vault_sessions (user_id);

ALTER TABLE public.bbf_vault_sessions ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny all direct anon/authenticated access.
REVOKE ALL ON public.bbf_vault_sessions FROM anon, authenticated;

-- ─── 2. bbf_verify_user_pin — mint a vault_token on success ─────────────────
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

    select id, email, daily_brief
      into v_user_id, v_user_email, v_daily_brief
      from bbf_users
     where bbf_users.uid = v_target_uid
       and bbf_users.deleted_at is null
     limit 1;

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

-- ─── 3. bbf_sync_vault_session — token-gated (was PIN-gated) ────────────────
DROP FUNCTION IF EXISTS public.bbf_sync_vault_session(text, text, jsonb, jsonb);
CREATE FUNCTION public.bbf_sync_vault_session(
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
  -- Authorize purely on the bearer token; p_uid is not trusted for auth.
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
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

-- ─── 4. bbf_sync_readiness — token-gated (was PIN-gated) ────────────────────
DROP FUNCTION IF EXISTS public.bbf_sync_readiness(text, text, jsonb);
CREATE FUNCTION public.bbf_sync_readiness(
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
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
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
