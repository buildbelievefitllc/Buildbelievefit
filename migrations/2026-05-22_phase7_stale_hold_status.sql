-- ════════════════════════════════════════════════════════════════════════
-- Phase 7 · Workstream A · The Chokepoint
-- Migration: add 'stale_hold' to bbf_pending_review.status CHECK
-- ────────────────────────────────────────────────────────────────────────
-- The chokepoint moves stale revalidation INTO /api/proposal-approve.
-- When a proposal's CNS snapshot has drifted past the threshold (field
-- drift count > 1) OR wall-clock age > 6h, the proposal is HELD with
-- status='stale_hold' instead of executed. Founder must re-fire the
-- coordinator to recompute against the current CNS state.
--
-- Idempotent: the migration introspects the existing CHECK constraint,
-- drops it, and re-creates it with the new value appended. Safe to
-- re-run.
-- ════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find any existing CHECK constraint on bbf_pending_review.status.
  -- Constraint name may vary across environments; we look it up rather
  -- than hard-code it.
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.bbf_pending_review'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bbf_pending_review DROP CONSTRAINT %I', constraint_name);
  END IF;

  -- Re-create with 'stale_hold' included. Eight allowed values total:
  --   pending · approved · rejected · executed · execution_failed
  --   expired · withdrawn · stale_hold (NEW · Phase 7)
  ALTER TABLE public.bbf_pending_review
    ADD CONSTRAINT bbf_pending_review_status_check
    CHECK (status IN (
      'pending',
      'approved',
      'rejected',
      'executed',
      'execution_failed',
      'expired',
      'withdrawn',
      'stale_hold'
    ));
END $$;

-- Companion index · queries that filter for stale_hold (founder cockpit
-- "needs re-fire" view) get a small win without an extra index since
-- the existing (proposed_at DESC) ordering covers it. No additional
-- index needed.

COMMENT ON CONSTRAINT bbf_pending_review_status_check ON public.bbf_pending_review IS
  'Phase 7 · Workstream A · 8 allowed values including stale_hold';
