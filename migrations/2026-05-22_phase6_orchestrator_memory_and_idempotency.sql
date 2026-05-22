-- ════════════════════════════════════════════════════════════════════════
-- Phase 6 · Connective Layer · Operation Pantheon
-- Migration: bbf_orchestrator_memory (episodic) + bbf_action_idempotency
-- ────────────────────────────────────────────────────────────────────────
-- · bbf_orchestrator_memory is the episodic decision ledger. Every
--   arbitration, sentinel verdict, founder response, and rollback is
--   captured here · indexed by uid + pattern_hash for Greenline digest
--   pattern recognition.
-- · bbf_action_idempotency structurally rejects duplicate event-fires.
--   Keys are sha256(uid+action_type+target+5min_window). Cron prunes
--   expired rows; queries check existence before any action proceeds.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bbf_orchestrator_memory (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid                      text NOT NULL,
  action_type              text NOT NULL,
  priority_tier            text NOT NULL DEFAULT 'performance',
  proposed_action          jsonb NOT NULL,
  arbitration_result       text NOT NULL,
  arbitration_detail       jsonb,
  sentinel_verdict         text,
  sentinel_detail          jsonb,
  proposal_id              uuid,
  pattern_hash             text NOT NULL,
  founder_response         text,
  founder_response_at      timestamptz,
  founder_actor            text,
  negative_learning        boolean NOT NULL DEFAULT false,
  cns_snapshot_at_proposal jsonb,
  cns_snapshot_at_decision jsonb,
  is_stale_at_decision     boolean DEFAULT false,
  agent                    text,
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bbf_orchestrator_memory_uid_created_idx
  ON public.bbf_orchestrator_memory (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_orchestrator_memory_pattern_hash_idx
  ON public.bbf_orchestrator_memory (pattern_hash, founder_response);
CREATE INDEX IF NOT EXISTS bbf_orchestrator_memory_action_type_idx
  ON public.bbf_orchestrator_memory (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_orchestrator_memory_proposal_id_idx
  ON public.bbf_orchestrator_memory (proposal_id);

ALTER TABLE public.bbf_orchestrator_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Orchestrator Memory" ON public.bbf_orchestrator_memory;
CREATE POLICY "Allow Anon Insert Orchestrator Memory"
  ON public.bbf_orchestrator_memory FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Orchestrator Memory" ON public.bbf_orchestrator_memory;
CREATE POLICY "Allow Anon Select Orchestrator Memory"
  ON public.bbf_orchestrator_memory FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Update Orchestrator Memory" ON public.bbf_orchestrator_memory;
CREATE POLICY "Allow Anon Update Orchestrator Memory"
  ON public.bbf_orchestrator_memory FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.bbf_action_idempotency (
  idempotency_key text PRIMARY KEY,
  uid             text NOT NULL,
  action_type     text NOT NULL,
  payload_summary jsonb,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bbf_action_idempotency_expires_idx
  ON public.bbf_action_idempotency (expires_at);
CREATE INDEX IF NOT EXISTS bbf_action_idempotency_uid_idx
  ON public.bbf_action_idempotency (uid, created_at DESC);

ALTER TABLE public.bbf_action_idempotency ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow Anon Insert Idempotency" ON public.bbf_action_idempotency;
CREATE POLICY "Allow Anon Insert Idempotency"
  ON public.bbf_action_idempotency FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Anon Select Idempotency" ON public.bbf_action_idempotency;
CREATE POLICY "Allow Anon Select Idempotency"
  ON public.bbf_action_idempotency FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow Anon Delete Expired Idempotency" ON public.bbf_action_idempotency;
CREATE POLICY "Allow Anon Delete Expired Idempotency"
  ON public.bbf_action_idempotency FOR DELETE TO anon USING (expires_at < now());
