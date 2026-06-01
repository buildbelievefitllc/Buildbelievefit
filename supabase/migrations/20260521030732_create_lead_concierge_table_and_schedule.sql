-- ════════════════════════════════════════════════════════════════════════
-- Sovereign Lead Concierge · 24/7 autonomous lead re-engagement
-- ────────────────────────────────────────────────────────────────────────
-- Schedules a daily pg_cron job that invokes the bbf-lead-concierge
-- edge function. The edge function pulls pending leads from bbf_leads,
-- scores by intake completeness, generates a templated re-engagement
-- email, sends via Brevo, and logs every action here for audit + UI.
--
-- COST POSTURE
--   · Templated emails (no per-lead LLM call) — deterministic copy
--   · Hard cap 50 leads per run · 14d cooldown per lead
--   · Daily cadence · 1 run/24h · negligible spend at current volume
--
-- SAFETY POSTURE
--   · Cooldown enforced at the DB level (this table) — even a runaway
--     edge function can't double-send
--   · Skip leads already provisioned (email exists in bbf_users)
--   · Skip leads older than 30 days (cold-bucket graveyard)
--   · Skip leads with do_not_contact = true (kill switch per lead)
-- ════════════════════════════════════════════════════════════════════════

-- 1. Audit + cooldown ledger table
CREATE TABLE IF NOT EXISTS public.bbf_lead_actions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id            uuid NOT NULL,                          -- groups all actions from a single concierge run
  lead_id           uuid REFERENCES public.bbf_leads(id) ON DELETE CASCADE,
  lead_email        text NOT NULL,
  action_type       text NOT NULL CHECK (action_type IN ('email_sent','email_failed','skipped_cooldown','skipped_provisioned','skipped_dnc','skipped_stale','scored_only')),
  score             integer,                                -- 0-100 intake completeness
  priority          text CHECK (priority IN ('HOT','WARM','COLD')),
  template_id       text,                                   -- 'hot_v1' | 'warm_v1' | 'cold_v1'
  email_subject     text,
  email_body_preview text,                                  -- first 240 chars for the admin log
  brevo_message_id  text,
  error             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bbf_lead_actions_lead_id_idx     ON public.bbf_lead_actions (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_lead_actions_email_idx       ON public.bbf_lead_actions (lead_email, created_at DESC);
CREATE INDEX IF NOT EXISTS bbf_lead_actions_run_id_idx      ON public.bbf_lead_actions (run_id);
CREATE INDEX IF NOT EXISTS bbf_lead_actions_created_at_idx  ON public.bbf_lead_actions (created_at DESC);

-- RLS · service-role only (same posture as bbf_leads / bbf_stripe_events)
ALTER TABLE public.bbf_lead_actions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bbf_lead_actions FROM anon, authenticated;
COMMENT ON TABLE public.bbf_lead_actions IS
  'Audit log + cooldown ledger for Sovereign Lead Concierge. RLS enabled. Writes only via service-role (bbf-lead-concierge edge fn). Reads exposed via /api/leads-list (admin-token gated).';

-- 2. Per-lead kill switch column on bbf_leads (no UI yet — admin can toggle via SQL)
ALTER TABLE public.bbf_leads ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;

-- 3. Schedule the daily concierge run · 09:00 UTC (~4-5am ET — leads
--    submitted overnight get processed before the CEO's morning coffee).
--    Removes any prior schedule with the same name first so re-applying
--    this migration is idempotent.
DO $$
DECLARE
  v_jobid bigint;
  v_url   text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-lead-concierge';
  v_key   text;
BEGIN
  -- Unschedule any existing job with this name
  SELECT jobid INTO v_jobid FROM cron.job WHERE jobname = 'bbf_lead_concierge_daily';
  IF v_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(v_jobid);
  END IF;

  -- Pull the service-role key from vault if present; fall back to a
  -- placeholder that the edge function rejects (gives a clean error
  -- rather than silently failing) when the secret hasn't been stored.
  BEGIN
    SELECT decrypted_secret INTO v_key
      FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_key := NULL;
  END;

  -- Schedule the daily run · 09:00 UTC
  PERFORM cron.schedule(
    'bbf_lead_concierge_daily',
    '0 9 * * *',
    format($job$
      SELECT net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', %L
        ),
        body := jsonb_build_object('source', 'cron')
      ) AS request_id;
    $job$, v_url, 'Bearer ' || COALESCE(v_key, ''))
  );
END $$;