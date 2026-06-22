-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_users.has_seen_sports_welcome  (Concierge YOUTH fork)
-- ───────────────────────────────────────────────────────────────────────────
-- The Concierge first-login gate was a SINGLE flag (has_seen_welcome) shared by
-- BOTH product surfaces, so the client's intended hub fork was never enforced
-- server-side. bbf-agentic-concierge now forks on `hub`: the BBF Athlete Portal
-- (youth/sports) is gated by its OWN durable flag, so a youth athlete's tailored
-- welcome is evaluated on their SPORTS onboarding state — independent of any
-- Sovereign Vault welcome. The Vault keeps has_seen_welcome.
--
-- boolean · NOT NULL · default false → every existing athlete back-fills to
-- "not yet welcomed in the Athlete Portal", so the corrected youth welcome fires
-- exactly once for the current cohort. Idempotent (IF NOT EXISTS). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS has_seen_sports_welcome boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.bbf_users.has_seen_sports_welcome IS
  'Concierge YOUTH/sports onboarding gate. Atomically set true by bbf-agentic-concierge (hub=sports) after the athlete''s first BBF Athlete Portal welcome, so the sports welcome auto-fires only on the absolute first sports-hub login (an explicit summon bypasses it). Independent of has_seen_welcome (the Sovereign Vault gate). Default false.';
