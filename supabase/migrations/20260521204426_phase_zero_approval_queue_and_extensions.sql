-- ════════════════════════════════════════════════════════════════════════
-- BBF PHASE 0 · Cross-cutting infrastructure
-- ────────────────────────────────────────────────────────────────────────
-- This migration is foundational. Every subsequent agentic tab (Prehab,
-- Athlete, Cardio, Program, Nutrition) will depend on these contracts.
-- Three artifacts:
--   1. bbf_pending_review      · typed approval queue
--   2. bbf_users extensions    · baseline_status, cardiac_clearance, block_priority
--   3. bbf_audit_logs extension· generalize beyond AUDITOR for AI-action audit
-- ════════════════════════════════════════════════════════════════════════

-- ─── 1. APPROVAL QUEUE ──────────────────────────────────────────────────
-- Typed queue. Founder-gated. No silent HTTP 200 stub on the execution
-- path: the executor must record execution_success boolean + the row
-- returned from the actual write target so any silent no-op is caught.
CREATE TABLE IF NOT EXISTS public.bbf_pending_review (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_type     text NOT NULL CHECK (proposal_type IN (
    'program_swap','program_create','program_progress',
    'nutrition_swap','nutrition_rotate','nutrition_macro_adjust',
    'cardio_prescription','cardio_intensity_shift',
    'prehab_assignment','prehab_escalation',
    'athlete_evolution','baseline_recompute',
    'cns_intervention','redline_override',
    'block_priority_shift','tier_upgrade','provision_override',
    'roster_action','custom'
  )),
  risk_level        text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  population        jsonb NOT NULL DEFAULT '{}'::jsonb,    -- { uids: [], cohort: '...', count: N }
  diff              jsonb NOT NULL DEFAULT '{}'::jsonb,    -- { target_table, target_uid, before: {}, after: {}, fields: [] }
  rationale         text NOT NULL,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed','execution_failed','expired','withdrawn')),
  proposed_by       text NOT NULL,                          -- agent name (e.g. 'bbf-agentic-prehab', 'bbf-lead-concierge')
  proposed_at       timestamptz NOT NULL DEFAULT now(),
  approver          text,                                   -- 'akeem' or future delegated admin uid
  decided_at        timestamptz,
  execution_success boolean,                                -- explicit · TRUE only when target write returned the affected row
  execution_result  jsonb,                                  -- the row(s) returned by the write target · proof-of-effect
  execution_error   text,
  expires_at        timestamptz,                            -- optional · auto-expire stale proposals
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS bbf_pending_review_status_idx       ON public.bbf_pending_review (status, proposed_at DESC);
CREATE INDEX IF NOT EXISTS bbf_pending_review_type_idx         ON public.bbf_pending_review (proposal_type);
CREATE INDEX IF NOT EXISTS bbf_pending_review_proposed_by_idx  ON public.bbf_pending_review (proposed_by, proposed_at DESC);
CREATE INDEX IF NOT EXISTS bbf_pending_review_risk_idx         ON public.bbf_pending_review (risk_level, status) WHERE status = 'pending';

ALTER TABLE public.bbf_pending_review ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bbf_pending_review FROM anon, authenticated;
COMMENT ON TABLE public.bbf_pending_review IS
  'Founder-gated approval queue · all agentic proposals route through here · service-role + admin-token writes only · execution_success boolean is the load-bearing field that catches silent no-op writes.';

-- ─── 2. BBF_USERS EXTENSIONS ────────────────────────────────────────────
ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS baseline_status   text NOT NULL DEFAULT 'building'
    CHECK (baseline_status IN ('building','valid','expired')),
  ADD COLUMN IF NOT EXISTS cardiac_clearance text NOT NULL DEFAULT 'unverified'
    CHECK (cardiac_clearance IN ('unverified','self_attested','provider_cleared','restricted','contraindicated')),
  ADD COLUMN IF NOT EXISTS block_priority    text NOT NULL DEFAULT 'maintenance'
    CHECK (block_priority IN ('maintenance','recovery','hypertrophy','strength','peaking','rehab'));

CREATE INDEX IF NOT EXISTS bbf_users_baseline_status_idx   ON public.bbf_users (baseline_status);
CREATE INDEX IF NOT EXISTS bbf_users_cardiac_clearance_idx ON public.bbf_users (cardiac_clearance);
CREATE INDEX IF NOT EXISTS bbf_users_block_priority_idx    ON public.bbf_users (block_priority);

COMMENT ON COLUMN public.bbf_users.baseline_status   IS 'building = client needs more sessions before agentic prescriptions are valid · valid = enough data to drive decisions · expired = data too stale, force rebaseline';
COMMENT ON COLUMN public.bbf_users.cardiac_clearance IS 'Gates high-intensity / VO2 prescriptions · unverified blocks zone-5 + plyo · provider_cleared opens all · restricted = zone-3 cap · contraindicated = strength only';
COMMENT ON COLUMN public.bbf_users.block_priority    IS 'The current programming block · agents read this before proposing exercise changes · explicit string > magic numbers';

-- ─── 3. BBF_AUDIT_LOGS GENERALIZATION ───────────────────────────────────
-- Existing schema is shaped for AUDITOR (movement_name, tension_zone).
-- Add columns so the same table is the unified audit ledger for ALL
-- agentic actions per the directive: "Audit all AI actions and
-- approvals to bbf_audit_logs."
ALTER TABLE public.bbf_audit_logs
  ADD COLUMN IF NOT EXISTS action_type   text,           -- 'proposal_submit','proposal_approve','proposal_execute','cns_write','vocab_sanitize', etc.
  ADD COLUMN IF NOT EXISTS agent         text,           -- which agent/module wrote this · 'BBF_CNS_AGENT','BBF_OT_PROMPT','bbf-agentic-peaking', etc.
  ADD COLUMN IF NOT EXISTS proposal_id   uuid REFERENCES public.bbf_pending_review(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_uid    text,           -- subject of the action · text slug or uuid string
  ADD COLUMN IF NOT EXISTS payload       jsonb,          -- what was attempted
  ADD COLUMN IF NOT EXISTS result        jsonb,          -- what came back
  ADD COLUMN IF NOT EXISTS success       boolean,        -- explicit OK/FAIL bit
  ADD COLUMN IF NOT EXISTS error_message text;

CREATE INDEX IF NOT EXISTS bbf_audit_logs_action_type_idx ON public.bbf_audit_logs (action_type, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_audit_logs_agent_idx       ON public.bbf_audit_logs (agent, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_audit_logs_proposal_idx    ON public.bbf_audit_logs (proposal_id);
CREATE INDEX IF NOT EXISTS bbf_audit_logs_target_uid_idx  ON public.bbf_audit_logs (target_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_audit_logs_success_idx     ON public.bbf_audit_logs (success, created_at DESC) WHERE success IS NOT NULL;

COMMENT ON TABLE public.bbf_audit_logs IS
  'Unified audit ledger · AUDITOR-style movement audits (movement_name, tension_zone) coexist with general agentic-action audits (action_type, agent, payload, result, success). Service-role writes only.';