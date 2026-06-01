-- ════════════════════════════════════════════════════════════════════════
-- Phase 22 · Security · enable RLS on bbf_leads + bbf_stripe_events
-- ────────────────────────────────────────────────────────────────────────
-- Both tables were left RLS-disabled, which exposed every row to anyone
-- with the anon key. Service-role bypasses RLS by design (Supabase auth
-- model), so the edge functions that legitimately write to these tables
-- (bbf-lead-capture · stripe-webhook) continue working unchanged.
--
-- POLICY POSTURE
-- ──────────────
-- bbf_leads          · service role only (no anon/auth policies = deny all)
-- bbf_stripe_events  · service role only (no anon/auth policies = deny all)
--
-- If a future admin dashboard needs to read these from the frontend, add
-- a separate SELECT policy gated to the admin user (CU === 'akeem'). For
-- now: deny-by-default keeps the anon key from being a master read key.
-- ════════════════════════════════════════════════════════════════════════

-- bbf_leads · Pathfinder form intake. Written by the bbf-lead-capture
-- edge function (service role). Read by future admin-only surfaces.
ALTER TABLE public.bbf_leads ENABLE ROW LEVEL SECURITY;

-- bbf_stripe_events · provisioned for Stripe webhook deduplication.
-- Currently a "follow-up slice" per stripe-webhook/index.ts:305 · no
-- code writes to it yet, but locking it down now so the column never
-- becomes a soft target later.
ALTER TABLE public.bbf_stripe_events ENABLE ROW LEVEL SECURITY;

-- ── Defensive · force-reload the role grants to make sure anon/auth
-- can't sneak through via leftover table-level GRANTs. RLS gates on
-- top of the role grant so this is belt + suspenders.
REVOKE ALL ON public.bbf_leads          FROM anon, authenticated;
REVOKE ALL ON public.bbf_stripe_events  FROM anon, authenticated;
-- Service role retains full access automatically via the postgres role.

-- ── Sanity confirmation in the migration record itself ──
COMMENT ON TABLE public.bbf_leads IS
  'Pathfinder form intake. RLS enabled. Writes restricted to service-role (bbf-lead-capture edge fn). No anon/auth policies = full deny by default.';
COMMENT ON TABLE public.bbf_stripe_events IS
  'Stripe webhook event dedup ledger (provisioned, not yet populated). RLS enabled. Writes restricted to service-role (stripe-webhook edge fn). No anon/auth policies = full deny by default.';