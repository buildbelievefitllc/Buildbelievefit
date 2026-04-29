-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — Credential provisioning (Phase 4, Step E)
-- ═══════════════════════════════════════════════════════════════════════════
-- Two changes:
--
-- 1. ADD UNIQUE constraint on bbf_users.uid
--    Production currently has no uniqueness on uid (the username column).
--    The auth flow keys lookups on uid, so a duplicate would break logins.
--    Pre-migration: 1 row (akeem). Constraint adds cleanly.
--
-- 2. CREATE bbf_provision_client_pin(p_vault_email, p_pin, p_full_name)
--    SECURITY DEFINER RPC called by Render's /provision endpoint after
--    Stripe payment success. Generates a unique username, bcrypts the
--    plaintext PIN, and inserts the bbf_users row linked to the matching
--    bbf_active_clients row by email.
--
-- Username generation:
--   - Base: lowercased first word of full name, alpha-only, max 20 chars
--   - First attempt: <base>_bbf
--   - Collisions: <base>2_bbf, <base>3_bbf, ... up to 99
--   - Fallback (extremely rare): <base><4 hex chars>_bbf
--
-- Idempotency: if a bbf_users row already exists for the given email,
-- returns ok=false with reason='already_provisioned'. Caller should not
-- retry — duplicate provisioning is intentionally blocked.
--
-- Step E of 5 in Phase 4 closed-loop bridge:
--   A. Plan columns (#62) ✓
--   B. Render writes back (#63) ✓
--   C. Pathfinder fires at /process (#64) ✓
--   D. App displays plans (#65) ✓
--   E. Credential provisioning (THIS migration + Render /provision endpoint)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. UNIQUE constraint on uid
ALTER TABLE public.bbf_users
  ADD CONSTRAINT bbf_users_uid_unique UNIQUE (uid);

-- 2. Provisioning RPC
CREATE OR REPLACE FUNCTION public.bbf_provision_client_pin(
  p_vault_email TEXT,
  p_pin         TEXT,
  p_full_name   TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_active_client_id  UUID;
  v_existing_uid      TEXT;
  v_first_name        TEXT;
  v_base              TEXT;
  v_candidate         TEXT;
  v_attempt           INT := 0;
BEGIN
  -- 1. Find the matching bbf_active_clients row (most recent if multiple)
  SELECT id INTO v_active_client_id
  FROM bbf_active_clients
  WHERE vault_email = p_vault_email
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_active_client_id IS NULL THEN
    RETURN json_build_object('ok', false, 'reason', 'active_client_not_found');
  END IF;

  -- 2. Idempotency: already provisioned?
  SELECT uid INTO v_existing_uid
  FROM bbf_users
  WHERE email = p_vault_email
  LIMIT 1;

  IF v_existing_uid IS NOT NULL THEN
    RETURN json_build_object(
      'ok', false,
      'reason', 'already_provisioned',
      'existing_uid', v_existing_uid
    );
  END IF;

  -- 3. Build username base from first name
  v_first_name := lower(split_part(coalesce(p_full_name, 'client'), ' ', 1));
  v_base := regexp_replace(v_first_name, '[^a-z]', '', 'g');
  IF v_base = '' THEN v_base := 'client'; END IF;
  v_base := substring(v_base FROM 1 FOR 20);

  -- 4. Find unique candidate, retrying with numeric suffix
  LOOP
    v_candidate := CASE
      WHEN v_attempt = 0 THEN v_base || '_bbf'
      ELSE v_base || (v_attempt + 1)::text || '_bbf'
    END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bbf_users WHERE uid = v_candidate);
    v_attempt := v_attempt + 1;
    IF v_attempt > 99 THEN
      -- Extreme fallback: random 4-hex suffix
      v_candidate := v_base || substring(md5(random()::text) FROM 1 FOR 4) || '_bbf';
      EXIT;
    END IF;
  END LOOP;

  -- 5. Insert with bcrypt hash
  INSERT INTO bbf_users (uid, name, email, pin_hash, role)
  VALUES (
    v_candidate,
    p_full_name,
    p_vault_email,
    crypt(p_pin, gen_salt('bf')),
    'client'
  );

  RETURN json_build_object(
    'ok', true,
    'username', v_candidate,
    'email', p_vault_email,
    'active_client_id', v_active_client_id
  );
END;
$function$;
