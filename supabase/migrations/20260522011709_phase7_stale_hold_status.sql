DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.bbf_pending_review'::regclass
    AND contype  = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.bbf_pending_review DROP CONSTRAINT %I', constraint_name);
  END IF;

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

COMMENT ON CONSTRAINT bbf_pending_review_status_check ON public.bbf_pending_review IS
  'Phase 7 · Workstream A · 8 allowed values including stale_hold';