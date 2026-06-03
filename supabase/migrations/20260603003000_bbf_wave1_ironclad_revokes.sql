-- ════════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — WAVE 1 IRONCLAD REVOKES
-- Overwatch audit remediation · close anon/authenticated EXECUTE leaks
-- ════════════════════════════════════════════════════════════════════════════
-- The Wave 1 layers (wearable ACWR + monetization intelligence) and the legacy
-- Phase 17 switchboard granted — or left default-granted — EXECUTE on SECURITY
-- DEFINER functions to anon/authenticated. Crucially, `anon` and `authenticated`
-- INHERIT the PUBLIC pseudo-role, so a `REVOKE ... FROM anon, authenticated`
-- alone is INSUFFICIENT where a PUBLIC grant also exists. This sweep revokes
-- PUBLIC + anon + authenticated on all six, restoring the intended
-- "service_role / token-gated only" access boundary.
--
-- VERIFIED SAFE — every legitimate caller authenticates as service_role:
--   • bbf_admin_set_tier               ← bbf-admin-roster (service_role) AND
--                                         index.js /provision (SUPABASE_SERVICE_KEY)
--   • bbf_capture_conversion            ← stripe-webhook (SUPABASE_SERVICE_ROLE_KEY)
--   • bbf_ingest_wearable_reading_admin ← bbf-wearable-ingest (service_role)
--   • _bbf_upsert_wearable_reading      ← internal SECURITY DEFINER callers only
--   • _bbf_wearable_acwr                ← internal SECURITY DEFINER callers only
--   • bbf_monetization_metrics          ← staged; service_role only, no caller yet
-- SECURITY DEFINER inner calls run as the function OWNER, which retains EXECUTE,
-- so the token-gated public wrappers (bbf_get_wearable_readiness, etc.) are
-- unaffected.
--
-- DELIBERATE BREAK: the legacy browser Switchboard (bbf-sync.js `adminSetTier`,
-- surfaced in mastermind-portal.html) called bbf_admin_set_tier with the ANON
-- key — that direct-from-browser path WAS the tier-escalation hole. The React
-- Command Center (→ bbf-admin-roster edge fn, service_role) is the sanctioned
-- replacement and is unaffected.
--
-- Idempotent: REVOKE/GRANT are safe to re-apply on the live DB or a clean rebuild.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. bbf_admin_set_tier (Phase 17) — was PUBLIC + anon + authenticated ──────
REVOKE EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text)
  TO service_role;

-- ── 2. bbf_ingest_wearable_reading_admin — was PUBLIC + anon + authenticated ──
REVOKE EXECUTE ON FUNCTION public.bbf_ingest_wearable_reading_admin(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_ingest_wearable_reading_admin(uuid, text, jsonb)
  TO service_role;

-- ── 3. _bbf_upsert_wearable_reading (internal helper) — was anon + authenticated
REVOKE EXECUTE ON FUNCTION public._bbf_upsert_wearable_reading(uuid, text, jsonb)
  FROM PUBLIC, anon, authenticated;

-- ── 4. _bbf_wearable_acwr (internal helper) — was anon + authenticated ────────
REVOKE EXECUTE ON FUNCTION public._bbf_wearable_acwr(uuid, date)
  FROM PUBLIC, anon, authenticated;

-- ── 5. bbf_monetization_metrics (staged read interface) — was anon + authenticated
REVOKE EXECUTE ON FUNCTION public.bbf_monetization_metrics(integer)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_monetization_metrics(integer)
  TO service_role;

-- ── 6. bbf_capture_conversion (stripe-webhook) — was PUBLIC + anon + authenticated
REVOKE EXECUTE ON FUNCTION public.bbf_capture_conversion(text, text, uuid, text, text, text, integer, text, boolean)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_capture_conversion(text, text, uuid, text, text, text, integer, text, boolean)
  TO service_role;
