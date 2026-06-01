-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — PATH 2: SUPABASE AUTH BACKFILL (Phase A + C, combined)
-- ═══════════════════════════════════════════════════════════════════════════
-- Migrates the 7 live `bbf_users` profiles onto official Supabase Auth so that
-- `auth.uid()`-based RLS becomes real (auth.users was previously EMPTY — the
-- app ran on the custom PIN system with anon-key clients + a service_role
-- server, which meant auth.uid() was always NULL).
--
-- ── ZERO-ORPHAN STRATEGY ───────────────────────────────────────────────────
-- Every child row (bbf_sets.user_id, bbf_readiness.user_id, bbf_meal_logs.user_id,
-- bbf_logs.user_id) already references bbf_users.id. Rather than introducing a
-- separate auth_user_id column and rewriting 924+ foreign keys, we mint each
-- auth.users row with `id = the existing bbf_users.id`. The new identity slides
-- in underneath the existing data: auth.uid() === bbf_users.id === child.user_id.
-- NOT ONE child row is touched, and the directive's literal `user_id = auth.uid()`
-- policy (see companion lockdown migration) holds by construction.
--
-- Deliberately NOT added: a bbf_users.id -> auth.users(id) FK. bbf_sets and
-- bbf_meal_logs cascade ON DELETE from bbf_users, so a cascading auth->profile
-- FK could chain-delete client training data on an auth-user deletion. The
-- id-match provides the functional linkage without that hazard.
--
-- ── EMAIL / PASSWORD CAVEAT (flagged to CEO) ───────────────────────────────
-- 6 of 7 profiles have a NULL email. An email-identity auth.users row needs a
-- login identifier, so emailless users get a deterministic placeholder
-- `<uid>@users.buildbelievefit.fitness`. Every account is created with a
-- RANDOM bcrypt password (no one can log in with a known secret) and is
-- email-confirmed so RLS works immediately. ACTIVATION (collect real email +
-- password reset / invite) is a follow-up owned by the Auth-provider config +
-- frontend cutover — these records make RLS enforceable now; they are not yet
-- a usable client login until that cutover lands.
--
-- IDEMPOTENT: guarded by NOT EXISTS on auth.users.id / auth.identities; re-run
-- is a no-op. auth.users verified EMPTY (0 rows) pre-migration.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Mint auth.users (id = bbf_users.id) ────────────────────────────────
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  is_sso_user, is_anonymous
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  u.id,
  'authenticated',
  'authenticated',
  lower(coalesce(nullif(u.email, ''), u.uid || '@users.buildbelievefit.fitness')),
  extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', u.name, 'uid', u.uid, 'bbf_role', u.role),
  now(),
  now(),
  '', '', '', '',
  false,
  false
FROM public.bbf_users u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = u.id);

-- ─── 2. Mint matching auth.identities (email provider) ─────────────────────
-- GoTrue requires an identities row per provider; identity_data must carry
-- `sub` (= user id) and `email`. provider_id = user id for the email provider.
INSERT INTO auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  a.id,
  a.id::text,
  'email',
  jsonb_build_object(
    'sub', a.id::text,
    'email', a.email,
    'email_verified', true,
    'phone_verified', false
  ),
  NULL,
  now(),
  now()
FROM auth.users a
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i
  WHERE i.user_id = a.id AND i.provider = 'email'
);
