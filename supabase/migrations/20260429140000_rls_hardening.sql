-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — RLS HARDENING (Phase 3 P2)
-- ═══════════════════════════════════════════════════════════════════════════
-- Closes the security gap flagged in api/SCHEMA_DRIFT_REPORT.md D10:
-- three tables in production still allow direct anon-key read/write because
-- RLS was never enabled on them.
--
-- Pre-migration state (verified via MCP introspection on 2026-04-29):
--   bbf_sets        — RLS DISABLED, 0 rows
--   bbf_readiness   — RLS DISABLED, 0 rows
--   content_monarch — RLS DISABLED, 2 rows (no client code refs;
--                     dashboard/external-pipeline source)
--
-- Post-migration state:
--   All three tables: RLS ENABLED, no policies → anon role has no access.
--   Service-role and SECURITY DEFINER functions retain access.
--
-- IMPACT:
--   - Phase 2 auth RPCs (bbf_verify_admin_pin, bbf_verify_user_pin,
--     bbf_admin_clear_lockout) are SECURITY DEFINER and unaffected.
--   - Server-side index.js uses SUPABASE_SERVICE_KEY and is unaffected.
--   - bbf-sync.js's direct anon-key calls to bbf_sets/bbf_readiness will
--     fail post-migration (they were already broken for bbf_users/bbf_logs
--     which have RLS-enabled-no-policy). Cloud sync from the client was
--     not operational pre-migration — no functional regression.
--
-- See api/RLS_HARDENING_AUDIT.md for the full code audit and risk analysis.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_sets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_readiness   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_monarch ENABLE ROW LEVEL SECURITY;
