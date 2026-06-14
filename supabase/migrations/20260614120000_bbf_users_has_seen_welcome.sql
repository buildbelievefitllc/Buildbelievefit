-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_users.has_seen_welcome  (Concierge first-login persistence)
-- Pre-Launch Onboarding Audit · Phase 3 — patch the Concierge "fires every login"
-- ───────────────────────────────────────────────────────────────────────────
-- The Self-Serve Concierge (bbf-agentic-concierge + the vault Concierge modal) is
-- a FIRST-LOGIN-ONLY welcome. Its prior guard was a device-local localStorage flag,
-- which re-fires on every new device / browser / incognito session / cleared
-- storage — so to the member it appears to fire on EVERY login. localStorage has no
-- server-side durability, so it cannot enforce "absolute first login" across the
-- member's real device footprint.
--
-- This adds a DURABLE, cross-device server-side flag. The edge function ATOMICALLY
-- claims the first welcome (flips false→true) the first time it composes a member's
-- greeting; thereafter it returns { already_seen: true } and the modal never
-- auto-fires again (the member can still explicitly SUMMON it from Settings).
-- localStorage is retained only as a same-device fast-path that skips the round-trip.
--
-- boolean · NOT NULL · default false  → every existing row back-fills to
-- "not yet welcomed", so the new onboarding fires exactly once for the current
-- pre-launch cohort too (intended). Idempotent (IF NOT EXISTS). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS has_seen_welcome boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bbf_users.has_seen_welcome IS
  'Concierge onboarding gate. Atomically set true by bbf-agentic-concierge after the member''s first welcome is composed, so the modal auto-fires only on the ABSOLUTE first login (an explicit summon bypasses it). Default false.';
