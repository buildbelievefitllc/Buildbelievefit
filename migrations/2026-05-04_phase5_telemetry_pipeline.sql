-- ═══════════════════════════════════════════════════════════════
-- Phase 5 — Telemetry Pipeline Schema
-- Date:    2026-05-04
-- Project: ihclbceghxpuawymlvgi (bbf-lab)
-- Author:  Claude (per CEO Phase 5 sign-off — Path C ratified)
--
-- Purpose: Dedicated load-telemetry tables for the BBF_INTEL Dynamic
--          Load Auditor (Phase 4). Isolated from existing bbf_logs
--          and bbf_sets so the workout-tab module is unaffected —
--          zero blast radius.
--
-- Sign-off (4 questions ratified):
--   Q1 Path C ─ new dedicated tables (do not touch bbf_logs/bbf_sets)
--   Q2 Names: bbf_athlete_load_logs, bbf_athlete_load_bouts
--   Q3 load_au as Postgres GENERATED ALWAYS AS (...) STORED
--   Q4 RLS pattern matches bbf_athlete_progression (anon r/w, RLS on)
--
-- Schema:
--   bbf_athlete_load_logs   ─ macro session telemetry
--     log_id, athlete_id, session_timestamp, session_type,
--     duration_minutes, srpe_intensity, load_au (DB-computed),
--     created_at, updated_at
--   bbf_athlete_load_bouts  ─ intra-session bouts
--     set_id, log_id, bout_type, exercise_name,
--     start_timestamp, end_timestamp, created_at
--
-- All operations use IF NOT EXISTS / DROP-IF-EXISTS-THEN-CREATE so
-- the script is idempotent (safe to re-run).
--
-- To execute: paste this entire block into the Supabase SQL Editor
--             and run. Verify with the SELECTs at the bottom.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ─── bbf_athlete_load_logs : macro session telemetry ────────────
-- One row per training session. load_au is database-computed from
-- duration_minutes × srpe_intensity (Gabbett sRPE methodology), so
-- the frontend can never write a bad load value — Postgres locks
-- the math at the storage layer.
CREATE TABLE IF NOT EXISTS public.bbf_athlete_load_logs (
  log_id            uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  athlete_id        uuid        NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  session_timestamp timestamptz NOT NULL DEFAULT now(),
  session_type      text        NOT NULL,
  duration_minutes  integer     NOT NULL CHECK (duration_minutes >= 0),
  srpe_intensity    integer     NOT NULL CHECK (srpe_intensity BETWEEN 1 AND 10),
  load_au           integer     GENERATED ALWAYS AS (duration_minutes * srpe_intensity) STORED,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Index supports the 28-day window query on (athlete_id, recency).
CREATE INDEX IF NOT EXISTS bbf_athlete_load_logs_athlete_session_idx
  ON public.bbf_athlete_load_logs (athlete_id, session_timestamp DESC);

-- Trigger: auto-bump updated_at on every UPDATE (matches the
-- bbf_athlete_progression timestamp pattern).
CREATE OR REPLACE FUNCTION public.bbf_athlete_load_logs_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bbf_athlete_load_logs_updated_at_trg ON public.bbf_athlete_load_logs;
CREATE TRIGGER bbf_athlete_load_logs_updated_at_trg
  BEFORE UPDATE ON public.bbf_athlete_load_logs
  FOR EACH ROW EXECUTE FUNCTION public.bbf_athlete_load_logs_set_updated_at();

ALTER TABLE public.bbf_athlete_load_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Inserts" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Inserts" ON public.bbf_athlete_load_logs
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Select" ON public.bbf_athlete_load_logs
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update" ON public.bbf_athlete_load_logs;
CREATE POLICY "Allow Anon Update" ON public.bbf_athlete_load_logs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ─── bbf_athlete_load_bouts : intra-session bouts ───────────────
-- One row per bout (sprint, lift, drill). Fed into the engine's
-- micro-recovery audit to enforce the 3-minute ATP-PC rest rule.
CREATE TABLE IF NOT EXISTS public.bbf_athlete_load_bouts (
  set_id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  log_id          uuid        NOT NULL REFERENCES public.bbf_athlete_load_logs(log_id) ON DELETE CASCADE,
  bout_type       text        NOT NULL,
  exercise_name   text        NOT NULL,
  start_timestamp timestamptz NOT NULL,
  end_timestamp   timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bbf_athlete_load_bouts_time_order_chk
    CHECK (end_timestamp >= start_timestamp)
);

-- Indexes: JOIN-by-log_id (most common path) + chronological scans.
CREATE INDEX IF NOT EXISTS bbf_athlete_load_bouts_log_id_idx
  ON public.bbf_athlete_load_bouts (log_id);

CREATE INDEX IF NOT EXISTS bbf_athlete_load_bouts_start_idx
  ON public.bbf_athlete_load_bouts (start_timestamp);

ALTER TABLE public.bbf_athlete_load_bouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Inserts" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Inserts" ON public.bbf_athlete_load_bouts
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Select" ON public.bbf_athlete_load_bouts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update" ON public.bbf_athlete_load_bouts;
CREATE POLICY "Allow Anon Update" ON public.bbf_athlete_load_bouts
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

COMMIT;

-- ═══════════════════════════════════════════════════════════════
-- Verification (run after the COMMIT; optional)
-- ═══════════════════════════════════════════════════════════════
-- 1) Both tables exist:
--    SELECT table_name FROM information_schema.tables
--    WHERE table_schema='public' AND table_name LIKE 'bbf_athlete_load_%'
--    ORDER BY table_name;
--
-- 2) load_au is a Postgres-generated column (proves the math is locked):
--    SELECT column_name, is_generated, generation_expression
--    FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='bbf_athlete_load_logs'
--      AND column_name='load_au';
--    -- Expect is_generated='ALWAYS', expression='(duration_minutes * srpe_intensity)'
--
-- 3) RLS enabled with 6 policies (3 per table — anon INSERT/SELECT/UPDATE):
--    SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename LIKE 'bbf_athlete_load_%' ORDER BY tablename, cmd;
--
-- 4) End-to-end smoke (runs an INSERT, confirms load_au auto-computes,
--    cleans up after itself — paste into the SQL Editor as one block):
--
--    DO $$
--    DECLARE v_uid uuid; v_log uuid; v_load int;
--    BEGIN
--      SELECT id INTO v_uid FROM public.bbf_users LIMIT 1;
--      INSERT INTO public.bbf_athlete_load_logs (athlete_id, session_type, duration_minutes, srpe_intensity)
--        VALUES (v_uid, '__smoke__', 90, 7) RETURNING log_id, load_au INTO v_log, v_load;
--      RAISE NOTICE 'Smoke insert log_id=%  load_au=% (expect 630)', v_log, v_load;
--      DELETE FROM public.bbf_athlete_load_logs WHERE log_id = v_log;
--    END $$;
