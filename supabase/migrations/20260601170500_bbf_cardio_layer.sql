-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — SMART CARDIO DATA LAYER (git backfill of phase22_smart_cardio_vault)
-- ═══════════════════════════════════════════════════════════════════════════
-- GIT/LIVE SYNC: Terminal 1's Smart Cardio layer was applied to the live DB via
-- apply_migration (recorded in the live ledger as `phase22_smart_cardio_vault`,
-- 20260601130334) but the migration FILE was never committed. A fresh rebuild
-- from git therefore lacked these objects — and the companion migration
-- 20260601180000_bbf_assign_cardio_protocol.sql (which references them) would
-- collapse the rebuild. This file restores the missing DDL to git, reconstructed
-- VERBATIM from live introspection (information_schema / pg_constraint /
-- pg_indexes / pg_get_functiondef). The structural DDL was validated to compile
-- on an empty schema before commit.
--
-- ORDERING: timestamped after bbf_vault_session_tokens (defines bbf_vault_sessions,
-- which _bbf_uid_from_vault_token depends on) and before
-- 20260601180000_bbf_assign_cardio_protocol.sql — so the dependency chain is
-- flawless on a clean rebuild.
--
-- IDEMPOTENT by construction (type guard / IF NOT EXISTS / CREATE OR REPLACE), so
-- re-running against the existing live DB — e.g. a future `supabase db push`,
-- since the live ledger version differs from this filename — is a safe no-op.
--
-- SECURITY MODEL: both tables are RLS ENABLED + FORCED with ZERO policies, so no
-- role (incl. the table owner) can read/write them directly. The default Supabase
-- table grants to anon/authenticated are thereby neutralized; the ONLY access
-- path is the SECURITY DEFINER functions below (owned by `postgres`, bypassrls).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Cardio zone enum (no CREATE TYPE ... IF NOT EXISTS in PG, so guard it) ─
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'bbf_cardio_zone' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.bbf_cardio_zone AS ENUM ('hiit', 'tempo', 'zone2');
  END IF;
END
$$;

-- ─── 2. Protocols: coach-assigned / AI-generated cardio prescriptions ──────────
CREATE TABLE IF NOT EXISTS public.bbf_cardio_protocols (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  zone                public.bbf_cardio_zone NOT NULL,
  title               text,
  target_duration_min integer NOT NULL CHECK (target_duration_min > 0 AND target_duration_min <= 600),
  intensity           text,
  protocol_detail     text,
  is_active           boolean NOT NULL DEFAULT true,
  generated_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Logs: athlete-recorded cardio sessions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bbf_cardio_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  protocol_id   uuid REFERENCES public.bbf_cardio_protocols(id) ON DELETE SET NULL,
  session_date  date NOT NULL DEFAULT ((now() AT TIME ZONE 'UTC')::date),
  zone          public.bbf_cardio_zone NOT NULL,
  duration_min  integer NOT NULL CHECK (duration_min > 0 AND duration_min <= 600),
  intensity     text,
  avg_hr        integer CHECK (avg_hr IS NULL OR (avg_hr >= 40 AND avg_hr <= 230)),
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Indexes (match live names so re-runs skip) ─────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cardio_protocols_user_active
  ON public.bbf_cardio_protocols (user_id, is_active, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cardio_logs_user_date
  ON public.bbf_cardio_logs (user_id, session_date DESC);

-- ─── 5. RLS: enabled + FORCED, zero policies (deny-all direct access) ──────────
ALTER TABLE public.bbf_cardio_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_cardio_protocols FORCE  ROW LEVEL SECURITY;
ALTER TABLE public.bbf_cardio_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_cardio_logs      FORCE  ROW LEVEL SECURITY;

-- ─── 6. Token→uid resolver + athlete read/log RPCs (verbatim from live) ────────
CREATE OR REPLACE FUNCTION public._bbf_uid_from_vault_token(p_session_token text)
 RETURNS uuid
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.bbf_log_cardio(p_session_token text, p_log jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_log_id  uuid;
  v_zone    public.bbf_cardio_zone;
  v_dur     int;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- Validate the zone + duration before insert (defense-in-depth alongside the
  -- table CHECK/enum constraints).
  BEGIN
    v_zone := (p_log->>'zone')::public.bbf_cardio_zone;
  EXCEPTION WHEN others THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_zone');
  END;
  v_dur := nullif(p_log->>'duration_min','')::int;
  IF v_dur IS NULL OR v_dur <= 0 OR v_dur > 600 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_duration');
  END IF;

  INSERT INTO public.bbf_cardio_logs
    (user_id, protocol_id, session_date, zone, duration_min, intensity, avg_hr, notes)
  VALUES (
    v_user_id,
    nullif(p_log->>'protocol_id','')::uuid,
    coalesce(nullif(p_log->>'session_date','')::date, (now() at time zone 'UTC')::date),
    v_zone,
    v_dur,
    nullif(p_log->>'intensity',''),
    nullif(p_log->>'avg_hr','')::int,
    nullif(p_log->>'notes','')
  )
  RETURNING id INTO v_log_id;

  RETURN jsonb_build_object('ok', true, 'log_id', v_log_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bbf_get_cardio(p_session_token text, p_log_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_protocols jsonb;
  v_logs jsonb;
BEGIN
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(jsonb_agg(p ORDER BY p.generated_at DESC), '[]'::jsonb)
    INTO v_protocols
  FROM (
    SELECT id, zone, title, target_duration_min, intensity, protocol_detail, generated_at
      FROM public.bbf_cardio_protocols
     WHERE user_id = v_user_id AND is_active = true
  ) p;

  SELECT coalesce(jsonb_agg(l ORDER BY l.session_date DESC, l.created_at DESC), '[]'::jsonb)
    INTO v_logs
  FROM (
    SELECT id, protocol_id, session_date, zone, duration_min, intensity, avg_hr, notes, created_at
      FROM public.bbf_cardio_logs
     WHERE user_id = v_user_id
     ORDER BY session_date DESC, created_at DESC
     LIMIT greatest(1, least(coalesce(p_log_limit, 30), 200))
  ) l;

  RETURN jsonb_build_object('ok', true, 'protocols', v_protocols, 'logs', v_logs);
END;
$function$;

-- ─── 7. Function grants (athlete RPCs callable with the anon key; gated inside) ─
GRANT EXECUTE ON FUNCTION public.bbf_log_cardio(text, jsonb) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bbf_get_cardio(text, integer) TO anon, authenticated, service_role;
