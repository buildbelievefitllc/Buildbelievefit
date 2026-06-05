-- ════════════════════════════════════════════════════════════════════════
-- BBF · Calling Cards Batch V1 · service-only lockdown (RLS)
-- ────────────────────────────────────────────────────────────────────────
-- Closes the public read/write hole flagged by the Supabase security advisor
-- (rls_disabled_in_public). Enabling RLS with NO policy denies anon +
-- authenticated by default; service_role bypasses RLS by design (Supabase
-- auth model), so the backend/shipper keeps full access. The REVOKE strips
-- the leftover table-level GRANTs so the table is closed at the privilege
-- layer too — belt + suspenders, mirroring the posture established in
-- 20260521023056_enable_rls_leads_and_stripe_events.
--
-- Repo parity note: this file mirrors migration 20260605152251 exactly as it
-- was applied to project ihclbceghxpuawymlvgi via the Supabase MCP.
-- ════════════════════════════════════════════════════════════════════════

-- Service-only lockdown: RLS on (no policy => anon/authenticated denied),
-- and revoke direct table grants from public API roles. service_role bypasses RLS.
ALTER TABLE public.bbf_calling_cards_batch_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.bbf_calling_cards_batch_v1 FROM anon, authenticated;
