-- ═══════════════════════════════════════════════════════════════════════════
-- SP-9 · THE GUARDIAN WIRE — monthly parent digest (founder-approved, owned rail)
-- ═══════════════════════════════════════════════════════════════════════════
-- Retention is a parent decision. Once a month, bbf-guardian-wire drafts a
-- warm, trilingual progress digest per active youth athlete from DETERMINISTIC
-- facts (phase/tier movement, check-off compliance, form-ledger safety stats,
-- RPE trend, next-month focus). Every digest stages as a GUARDIAN_WIRE card in
-- the Action Inbox — NOTHING reaches a guardian without founder approval
-- (youth guardrail #2). On approval, bbf_apply_guardian_wire queues the
-- dispatch row; the fn's next run (or a manual dispatch action) sends it on
-- the EXISTING Brevo transactional rail to the account email. Included in
-- Rising Athlete (no extra gate).
--
--   • bbf_guardian_wire_log — one row per digest: drafted → approved →
--     dispatched (or dismissed). Text only; the audit trail for what was
--     actually sent home.
--   • bbf_apply_guardian_wire(p_action_id) — one-tap applier (service_role).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bbf_guardian_wire_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  period       text NOT NULL,                    -- 'YYYY-MM' the digest covers
  locale       text NOT NULL DEFAULT 'en',
  subject      text NOT NULL,
  digest_html  text NOT NULL,
  facts        jsonb NOT NULL DEFAULT '{}'::jsonb,  -- the deterministic inputs (auditability)
  status       text NOT NULL DEFAULT 'drafted'
                 CHECK (status IN ('drafted','approved','dispatched','dismissed','dispatch_failed')),
  card_id      uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  approved_at  timestamptz,
  dispatched_at timestamptz,
  UNIQUE (user_id, period)
);

COMMENT ON TABLE public.bbf_guardian_wire_log IS
  'SP-9 Guardian Wire · monthly parent digest ledger (text only). drafted → founder-approved → dispatched on the existing Brevo rail to the account email. RLS zero-policy: service_role only.';

ALTER TABLE public.bbf_guardian_wire_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bbf_guardian_wire_log FROM public, anon, authenticated;

CREATE INDEX IF NOT EXISTS bbf_guardian_wire_status_idx
  ON public.bbf_guardian_wire_log (status, created_at DESC);

-- ── One-tap applier: founder APPROVE on the GUARDIAN_WIRE card ──────────────
CREATE OR REPLACE FUNCTION public.bbf_apply_guardian_wire(p_action_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_card   record;
  v_log_id uuid;
BEGIN
  SELECT * INTO v_card
    FROM public.coach_action_inbox
   WHERE id = p_action_id AND status = 'PENDING' AND type = 'GUARDIAN_WIRE'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found_or_processed');
  END IF;

  v_log_id := nullif(v_card.proposed_plan_modification -> 'guardian_wire' ->> 'log_id', '')::uuid;
  IF v_log_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  UPDATE public.bbf_guardian_wire_log
     SET status = 'approved', approved_at = now()
   WHERE id = v_log_id AND status = 'drafted';
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'log_not_found_or_processed');
  END IF;

  UPDATE public.coach_action_inbox
     SET status = 'APPROVED', processed_at = now()
   WHERE id = p_action_id;

  RETURN json_build_object('ok', true, 'applied', 'guardian_wire', 'log_id', v_log_id,
                           'note', 'queued for dispatch on the next guardian-wire run');
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_apply_guardian_wire(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_apply_guardian_wire(uuid) TO service_role;

-- ── Monthly cron — 1st of the month, 15:00 UTC. Dispatches approved digests
--    from LAST cycle first, then drafts the new month's. Vault-injected token.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-guardian-wire-monthly') THEN
    PERFORM cron.unschedule('bbf-guardian-wire-monthly');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-guardian-wire-monthly',
  '0 15 1 * *',
  $job$
  SELECT net.http_post(
    url     := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-guardian-wire',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-BBF-Admin-Token', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'BBF_COACH_AGENT_TOKEN' LIMIT 1)
    ),
    body    := '{"action":"run"}'::jsonb,
    timeout_milliseconds := 240000
  );
  $job$
);
