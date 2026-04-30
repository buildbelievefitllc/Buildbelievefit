-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE SCHEMA — ACTUAL (production-derived)
-- ═══════════════════════════════════════════════════════════════════════════
-- Source of truth captured from production project ihclbceghxpuawymlvgi
-- (bbf-lab) on 2026-04-29 via Supabase MCP introspection (information_schema,
-- pg_proc, pg_indexes, pg_policies, etc.). Postgres 17.6.
--
-- This file SUPERSEDES api/supabase-schema.legacy.sql (renamed from
-- api/supabase-schema.sql on 2026-04-29), which documents a fictional
-- model that production never matched. Treat this file as the single source
-- of truth for the public schema until Supabase CLI migrations land
-- (Phase 3 P1).
--
-- IDEMPOTENCY: Every statement is safe to re-run. CREATE TABLE / INDEX use
-- IF NOT EXISTS; functions use OR REPLACE; policies are guarded with DROP
-- IF EXISTS. RLS toggles are explicit per table to match production state.
--
-- Migrations registered with Supabase: 20260429054308_phase2_hotfix_uid_column
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── EXTENSIONS ────────────────────────────────────────────────────────────
-- Production has these installed in the `extensions` schema (Supabase default).
CREATE EXTENSION IF NOT EXISTS pgcrypto      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;


-- ═══════════════════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. bbf_users ──────────────────────────────────────────────────────────
-- Production canonical: `id` is a UUID surrogate primary key; `uid` is the
-- human-readable identifier (e.g. 'akeem') that auth flows and RPCs key on.
-- Phase 2 RPCs lookup by `uid`, NOT `id`.
CREATE TABLE IF NOT EXISTS public.bbf_users (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name            TEXT,
  email           TEXT UNIQUE,
  current_streak  INTEGER DEFAULT 0,
  last_login      TIMESTAMPTZ,
  metabolic_tier  TEXT DEFAULT '12:12 Foundation'::text,
  uid             TEXT,
  pin_hash        TEXT,
  role            TEXT
);

-- ─── 2. bbf_logs ───────────────────────────────────────────────────────────
-- Workout/session logs. Note: production uses `date DATE` (not TEXT) and
-- has coach-oriented columns (sport/position/drill_name/coach_notes), not
-- the lifter-style columns the fiction file claimed.
CREATE TABLE IF NOT EXISTS public.bbf_logs (
  id           UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id      UUID REFERENCES public.bbf_users(id),
  date         DATE DEFAULT CURRENT_DATE,
  sport        TEXT,
  position     TEXT,
  drill_name   TEXT,
  coach_notes  TEXT,
  language     TEXT DEFAULT 'en'::text
);

-- ─── 3. bbf_sets ───────────────────────────────────────────────────────────
-- Per-set workload data. FK is `log_id → bbf_logs.id` (NOT user_id, despite
-- what the fiction file claimed).
CREATE TABLE IF NOT EXISTS public.bbf_sets (
  id          UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  log_id      UUID REFERENCES public.bbf_logs(id),
  set_number  INTEGER,
  reps        INTEGER,
  weight_lbs  DOUBLE PRECISION,
  rpe         INTEGER
);

-- ─── 4. bbf_readiness ──────────────────────────────────────────────────────
-- Daily readiness scores. Production has `sleep_quality` + `soreness_level`,
-- not the fiction's `sleep`/`stress`/`energy`.
CREATE TABLE IF NOT EXISTS public.bbf_readiness (
  id              UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  user_id         UUID REFERENCES public.bbf_users(id),
  score           INTEGER,
  sleep_quality   INTEGER,
  soreness_level  INTEGER,
  timestamp       TIMESTAMPTZ DEFAULT now()
);

-- ─── 5. bbf_active_clients ─────────────────────────────────────────────────
-- Lead/client intake table. Populated via webhook (see policy below).
-- Undocumented in the fiction file but live in production with 4 rows.
CREATE TABLE IF NOT EXISTS public.bbf_active_clients (
  id                  UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  client_name         TEXT,
  client_email        TEXT UNIQUE,
  spectrum_tier       TEXT,
  onboarding_status   TEXT DEFAULT 'Pending'::text,
  age                 INTEGER,
  height_weight       TEXT,
  clinical_history    TEXT,
  training_protocol   TEXT,
  liability_agreement BOOLEAN,
  liability_cleared   BOOLEAN,
  updated_at          TIMESTAMPTZ DEFAULT now(),
  vault_email         TEXT UNIQUE
);

-- ─── 6. bbf_pin_attempts ───────────────────────────────────────────────────
-- Phase 2 lockout state. `key` is either an IP (admin verifier) or a uid
-- (user verifier) or 'CLEAR:<ip>' (founder clear-lockout brute-force guard).
CREATE TABLE IF NOT EXISTS public.bbf_pin_attempts (
  key                TEXT PRIMARY KEY,
  failed_count       INTEGER DEFAULT 0,
  window_started_at  TIMESTAMPTZ DEFAULT now(),
  locked_until       TIMESTAMPTZ,
  last_attempt_at    TIMESTAMPTZ DEFAULT now()
);

-- ─── 7. content_monarch ────────────────────────────────────────────────────
-- Marketing/content-pipeline staging table. Undocumented in the fiction
-- file but live in production with 2 rows.
CREATE TABLE IF NOT EXISTS public.content_monarch (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  post_copy     TEXT,
  image_prompt  TEXT,
  status        TEXT DEFAULT 'pending'::text,
  image_url     TEXT
);


-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES (non-pkey, non-unique-constraint)
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: The fiction file declared idx_logs_user, idx_logs_date, idx_sets_user,
-- idx_sets_day, idx_readiness_user — none of these exist in production. They
-- are intentionally omitted here. Re-introduce only via a tracked migration
-- if/when justified by query patterns.

CREATE INDEX IF NOT EXISTS idx_pin_attempts_locked
  ON public.bbf_pin_attempts (locked_until);


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW-LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════
-- Production state (verified 2026-04-29):
--   RLS ENABLED  : bbf_users, bbf_logs, bbf_active_clients, bbf_pin_attempts
--   RLS DISABLED : bbf_sets, bbf_readiness, content_monarch
--   POLICIES     : exactly ONE — "Allow Webhook Inserts" on bbf_active_clients
--
-- This means RLS-enabled tables with no policies are effectively closed to
-- the anon role. The Phase 2 auth flow works because the verifier RPCs are
-- SECURITY DEFINER and run as the function owner (bypassing RLS).
--
-- ⚠️  bbf_sets and bbf_readiness having RLS disabled is a likely security
-- gap to revisit in Phase 3+. Tracked in the drift report.

ALTER TABLE public.bbf_users          ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_logs           ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_active_clients ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_pin_attempts   ENABLE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_sets           DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_readiness      DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_monarch    DISABLE ROW LEVEL SECURITY;

-- bbf_active_clients : permits anon INSERT (used by the lead-capture webhook).
DROP POLICY IF EXISTS "Allow Webhook Inserts" ON public.bbf_active_clients;
CREATE POLICY "Allow Webhook Inserts"
  ON public.bbf_active_clients
  FOR INSERT
  TO anon
  WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
-- Production has a Zapier webhook fired on bbf_sets writes. This trigger is
-- created via the Supabase Dashboard's "Database Webhooks" UI, which compiles
-- to a trigger calling supabase_functions.http_request(...). The function
-- itself ships with the Supabase platform; we only declare the trigger here.
--
-- The literal string "BBF workout videos" matches the production trigger name
-- (with spaces) — preserved verbatim for fidelity.

DROP TRIGGER IF EXISTS "BBF workout videos" ON public.bbf_sets;
CREATE TRIGGER "BBF workout videos"
  AFTER INSERT OR UPDATE OR DELETE ON public.bbf_sets
  FOR EACH ROW
  EXECUTE FUNCTION supabase_functions.http_request(
    'https://hooks.zapier.com/hooks/catch/27190846/ujsukew/',
    'POST',
    '{"Content-type":"application/json"}',
    '{}',
    '5000'
  );


-- ═══════════════════════════════════════════════════════════════════════════
-- RPC FUNCTIONS (Phase 2 auth)
-- ═══════════════════════════════════════════════════════════════════════════
-- All three are SECURITY DEFINER and key off the `uid` column on bbf_users
-- (matching the phase2_hotfix_uid_column migration).

-- ─── bbf_verify_admin_pin(pin_attempt) → JSON ──────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_verify_admin_pin(pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_key          TEXT := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'UNKNOWN_IP');
  v_attempt      bbf_pin_attempts%ROWTYPE;
  v_stored_hash  TEXT;
  v_is_valid     BOOLEAN := FALSE;
  v_now          TIMESTAMPTZ := now();
  v_retry_after  INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash
  FROM bbf_users
  WHERE uid = 'akeem' AND role = 'trainer'
  LIMIT 1;

  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(pin_attempt, gen_salt('bf')) WHERE uid = 'akeem';
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'lockout_active', false, 'retry_after_seconds', 0);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$function$;

-- ─── bbf_verify_user_pin(uid, pin_attempt) → JSON ──────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_verify_user_pin(uid TEXT, pin_attempt TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_target_uid   TEXT := uid;
  v_key          TEXT := uid;
  v_attempt      bbf_pin_attempts%ROWTYPE;
  v_stored_hash  TEXT;
  v_is_valid     BOOLEAN := FALSE;
  v_now          TIMESTAMPTZ := now();
  v_retry_after  INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash FROM bbf_users WHERE bbf_users.uid = v_target_uid LIMIT 1;
  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(pin_attempt, gen_salt('bf')) WHERE bbf_users.uid = v_target_uid;
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'lockout_active', false, 'retry_after_seconds', 0);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$function$;

-- ─── bbf_admin_clear_lockout(target_key, founder_pin) → JSON ───────────────
-- Founder safety valve. Has its own caller-IP-keyed lockout to prevent
-- brute-forcing the founder PIN through this surface.
CREATE OR REPLACE FUNCTION public.bbf_admin_clear_lockout(target_key TEXT, founder_pin TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_caller_ip    TEXT := coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', 'UNKNOWN_IP');
  v_key          TEXT := 'CLEAR:' || v_caller_ip;
  v_attempt      bbf_pin_attempts%ROWTYPE;
  v_stored_hash  TEXT;
  v_is_valid     BOOLEAN := FALSE;
  v_now          TIMESTAMPTZ := now();
  v_retry_after  INT := 0;
BEGIN
  SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
  IF v_attempt.locked_until > v_now THEN
    RETURN json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  END IF;

  SELECT pin_hash INTO v_stored_hash FROM bbf_users WHERE uid = 'akeem' AND role = 'trainer' LIMIT 1;
  IF v_stored_hash IS NOT NULL THEN
    IF v_stored_hash LIKE '$2a$%' THEN
      v_is_valid := (crypt(founder_pin, v_stored_hash) = v_stored_hash);
    ELSE
      v_is_valid := (v_stored_hash = encode(digest(founder_pin, 'sha256'), 'hex'));
      IF v_is_valid THEN
        UPDATE bbf_users SET pin_hash = crypt(founder_pin, gen_salt('bf')) WHERE uid = 'akeem';
      END IF;
    END IF;
  END IF;

  IF v_is_valid THEN
    DELETE FROM bbf_pin_attempts WHERE key = target_key;
    DELETE FROM bbf_pin_attempts WHERE key = v_key;
    RETURN json_build_object('ok', true, 'cleared_key', target_key);
  ELSE
    INSERT INTO bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    VALUES (v_key, 1, v_now, NULL, v_now)
    ON CONFLICT (key) DO UPDATE SET
      failed_count = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END,
      window_started_at = CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN now() ELSE bbf_pin_attempts.window_started_at END,
      locked_until = CASE
        WHEN (CASE WHEN bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') THEN 1 ELSE bbf_pin_attempts.failed_count + 1 END) >= 3
        THEN now() + interval '15 minutes'
        ELSE NULL
      END,
      last_attempt_at = now();

    SELECT * INTO v_attempt FROM bbf_pin_attempts WHERE key = v_key;
    v_retry_after := CASE WHEN v_attempt.locked_until > v_now THEN extract(epoch from (v_attempt.locked_until - v_now))::int ELSE 0 END;

    RETURN json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  END IF;
END;
$function$;


-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DATA — INTENTIONALLY OMITTED
-- ═══════════════════════════════════════════════════════════════════════════
-- The fiction file seeded 1 trainer + 5 client accounts with sha256 hashes.
-- Production has only:
--   - akeem  (uid='akeem',  role='trainer', bcrypt hash)
--   - admin  (uid=NULL,     role='admin',   bcrypt hash)
-- The 5 client seeds were never inserted (or have since been removed) and
-- the surviving rows have already been migrated to bcrypt + rotated PINs.
-- Re-seeding from this file would clobber that work, so seeds are NOT
-- replayed here. Onboarding new users is a Phase 3 P3 follow-up.
- -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
 - -   B B F   V A P I   V O I C E   I N T E G R A T I O N   -   P H A S E   1  
 - -   D e s c r i p t i o n :   S c h e m a   a n d   t r a c k i n g   t a b l e s   f o r   o u t b o u n d   a c c o u n t a b i l i t y   c a l l s .  
 - -   R e f e r e n c e :   B i g   J i m   D i r e c t i v e   # 4  
 - -   = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = = =  
  
 - -   1 .   C r e a t e   t r a c k i n g   t a b l e   f o r   V a p i   c a l l s  
 C R E A T E   T A B L E   I F   N O T   E X I S T S   p u b l i c . b b f _ v a p i _ c a l l s   (  
         i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   e x t e n s i o n s . u u i d _ g e n e r a t e _ v 4 ( ) ,  
         c l i e n t _ e m a i l   T E X T   R E F E R E N C E S   p u b l i c . b b f _ a c t i v e _ c l i e n t s ( c l i e n t _ e m a i l )   O N   D E L E T E   C A S C A D E ,  
         c a l l e d _ a t   T I M E S T A M P T Z   D E F A U L T   n o w ( ) ,  
         c a l l _ s t a t u s   T E X T   D E F A U L T   ' i n i t i a t e d ' ,  
         v a p i _ c a l l _ i d   T E X T ,  
         t r a n s c r i p t   T E X T  
 ) ;  
  
 - -   E n a b l e   R L S  
 A L T E R   T A B L E   p u b l i c . b b f _ v a p i _ c a l l s   E N A B L E   R O W   L E V E L   S E C U R I T Y ;  
  
 - -   O n l y   s e r v i c e   r o l e   c a n   a c c e s s   v a p i   c a l l s   ( a v o i d s   e x p o s i n g   o t h e r   u s e r s '   a c c o u n t a b i l i t y   d a t a )  
 C R E A T E   P O L I C Y   " S e r v i c e   r o l e s   c a n   m a n a g e   v a p i   c a l l s "    
         O N   p u b l i c . b b f _ v a p i _ c a l l s    
         U S I N G   ( a u t h . r o l e ( )   =   ' s e r v i c e _ r o l e ' ) ;  
  
 - -   2 .   C r e a t e   E v a l u a t i o n   F u n c t i o n  
 - -   T h i s   f u n c t i o n   e v a l u a t e s   a l l   a c t i v e   c l i e n t s .   I f   t h e y   h a v e   n o t   l o g g e d   a   w o r k o u t    
 - -   i n   t h e   l a s t   3   d a y s ,   a n d   h a v e n ' t   r e c e i v e d   a   c a l l   i n   t h e   l a s t   7   d a y s ,   i t   p r e p a r e s   t h e m   f o r   a   c a l l .  
 C R E A T E   O R   R E P L A C E   F U N C T I O N   p u b l i c . b b f _ e v a l u a t e _ s t r e a k s ( )  
 R E T U R N S   v o i d  
 L A N G U A G E   p l p g s q l  
 S E C U R I T Y   D E F I N E R  
 A S   $ $  
 D E C L A R E  
         s l i p _ r e c o r d   R E C O R D ;  
         d a y s _ m i s s e d   I N T E G E R ;  
 B E G I N  
         F O R   s l i p _ r e c o r d   I N  
                 S E L E C T    
                         a c . c l i e n t _ e m a i l ,  
                         a c . c l i e n t _ n a m e ,  
                         a c . t r a i n i n g _ p r o t o c o l ,  
                         u . i d   a s   u s e r _ i d ,  
                         ( S E L E C T   m a x ( d a t e )   F R O M   p u b l i c . b b f _ l o g s   l   W H E R E   l . u s e r _ i d   =   u . i d )   a s   l a s t _ l o g _ d a t e  
                 F R O M   p u b l i c . b b f _ a c t i v e _ c l i e n t s   a c  
                 J O I N   p u b l i c . b b f _ u s e r s   u   O N   a c . c l i e n t _ e m a i l   =   u . e m a i l  
                 W H E R E   a c . o n b o a r d i n g _ s t a t u s   ! =   ' P e n d i n g '  
         L O O P  
                 - -   C a l c u l a t e   d a y s   m i s s e d .   I f   n e v e r   l o g g e d ,   a s s u m e   3 +   f o r   t r i g g e r i n g .  
                 I F   s l i p _ r e c o r d . l a s t _ l o g _ d a t e   I S   N U L L   T H E N  
                         d a y s _ m i s s e d   : =   3 ;  
                 E L S E  
                         d a y s _ m i s s e d   : =   C U R R E N T _ D A T E   -   s l i p _ r e c o r d . l a s t _ l o g _ d a t e ;  
                 E N D   I F ;  
  
                 I F   d a y s _ m i s s e d   > =   3   T H E N  
                         - -   C h e c k   r a t e   l i m i t :   H a s   t h i s   c l i e n t   b e e n   c a l l e d   i n   t h e   l a s t   7   d a y s ?  
                         I F   N O T   E X I S T S   (  
                                 S E L E C T   1   F R O M   p u b l i c . b b f _ v a p i _ c a l l s   v c    
                                 W H E R E   v c . c l i e n t _ e m a i l   =   s l i p _ r e c o r d . c l i e n t _ e m a i l    
                                 A N D   v c . c a l l e d _ a t   >   n o w ( )   -   I N T E R V A L   ' 7   d a y s '  
                         )   T H E N  
                                 - -   1 .   L o g   t h e   i n i t i a t i o n   o f   t h e   c a l l  
                                 I N S E R T   I N T O   p u b l i c . b b f _ v a p i _ c a l l s   ( c l i e n t _ e m a i l ,   c a l l _ s t a t u s )  
                                 V A L U E S   ( s l i p _ r e c o r d . c l i e n t _ e m a i l ,   ' i n i t i a t e d ' ) ;  
  
                                 - -   2 .   I n v o k e   t h e   S u p a b a s e   E d g e   F u n c t i o n   u s i n g   p g _ n e t   ( a s y n c   w e b h o o k )  
                                 - -   N O T E :   p g _ n e t   e x t e n s i o n   m u s t   b e   e n a b l e d .   T h e   a c t u a l   U R L   a n d   a n o n   k e y    
                                 - -   a r e   p l a c e h o l d e r s   t o   b e   c o n f i g u r e d   w i t h   V a u l t   i n   P h a s e   2 .  
                                 / *  
                                 P E R F O R M   n e t . h t t p _ p o s t (  
                                         u r l   : =   ' h t t p s : / / l o c a l h o s t / f u n c t i o n s / v 1 / v a p i - o u t b o u n d - t r i g g e r ' ,  
                                         h e a d e r s   : =   ' { " C o n t e n t - T y p e " :   " a p p l i c a t i o n / j s o n " } ' : : j s o n b ,  
                                         b o d y   : =   j s o n b _ b u i l d _ o b j e c t (  
                                                 ' c l i e n t _ e m a i l ' ,   s l i p _ r e c o r d . c l i e n t _ e m a i l ,    
                                                 ' c l i e n t _ n a m e ' ,   s l i p _ r e c o r d . c l i e n t _ n a m e ,    
                                                 ' d a y s _ m i s s e d ' ,   d a y s _ m i s s e d ,    
                                                 ' p r o t o c o l ' ,   s l i p _ r e c o r d . t r a i n i n g _ p r o t o c o l  
                                         )  
                                 ) ;  
                                 * /  
                         E N D   I F ;  
                 E N D   I F ;  
         E N D   L O O P ;  
 E N D ;  
 $ $ ;  
 