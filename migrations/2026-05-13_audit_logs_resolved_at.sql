-- WAR ROOM Phase 9.5 · Prehab Audit resolution state.
-- Adds a nullable resolved_at timestamp so the Sovereign Command Center
-- "Mark Resolved" button can persist past a page reload. NULL = pending,
-- non-null = resolved at that time. Partial index keeps pending-feed
-- queries cheap as the table grows.
--
-- Applied to production via supabase MCP apply_migration on 2026-05-13.
-- This file is the git-tracked source-of-truth for the schema change.

ALTER TABLE public.bbf_audit_logs
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_bbf_audit_logs_pending
  ON public.bbf_audit_logs (created_at DESC)
  WHERE resolved_at IS NULL;
