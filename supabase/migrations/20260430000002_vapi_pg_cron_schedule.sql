-- ============================================================================
-- BBF VAPI VOICE INTEGRATION - PHASE 3
-- Description: pg_cron scheduling for the daily streak evaluation.
-- Reference: Big Jim Directive #4
-- ============================================================================

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the bbf_evaluate_streaks() function to run every day at 10:00 AM MST
-- (MST is UTC-7, so 10:00 AM MST is 17:00 UTC)
SELECT cron.schedule(
    'vapi-daily-accountability-check',
    '0 17 * * *',
    $$ SELECT public.bbf_evaluate_streaks() $$
);
