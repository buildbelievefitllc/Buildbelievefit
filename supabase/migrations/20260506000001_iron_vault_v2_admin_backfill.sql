-- ═══════════════════════════════════════════════════════════════
-- Phase 16 — Iron Vault V2 admin backfill
-- ═══════════════════════════════════════════════════════════════
-- The Iron Vault gate keys off subscription_tier='sovereign' OR
-- trial_expires_at>NOW(). The frontend has BBF_IS_ADMIN() that
-- short-circuits the gate for uid='akeem', but the SERVER runs the
-- same gate against bbf_users — and post-Slice-A migration akeem's
-- subscription_tier is NULL, so /api/auth/ws-ticket would 403 him
-- and the Live Coach modal would refuse to open in admin sessions.
--
-- Mark akeem (and any other architect-tier admin uid) as 'sovereign'
-- so the server-side gate matches the frontend bypass. Idempotent —
-- safe to re-run.
--
-- Apply post-Slice-A migration via Supabase MCP `apply_migration`.
-- ═══════════════════════════════════════════════════════════════

UPDATE public.bbf_users
   SET subscription_tier = 'sovereign',
       updated_at        = NOW()
 WHERE uid = 'akeem'
   AND (subscription_tier IS NULL OR subscription_tier <> 'sovereign');
