-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_users.preferred_locale  (Trilingual · Finding 2)
-- Phase 8.x · Per-athlete locale for cloud generation
-- ───────────────────────────────────────────────────────────────────────────
-- The trilingual fleet generates plan/cue/snapshot prose natively in EN/ES/PT,
-- but the NIGHTLY path (bbf-midnight-haiku → bbf-agentic-orchestrator) had no
-- per-athlete locale to pass, so scheduled briefs + snapshots defaulted to EN.
-- This adds the missing column so the cron can source each athlete's locale and
-- forward it to the orchestrator (and the daily-brief generator).
--
-- text · NOT NULL · default 'en' (back-fills every existing row to English).
-- Constrained to the supported trilingual set, matching _shared/locale.ts.
-- Idempotent (IF NOT EXISTS guards). Safe to re-apply.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS preferred_locale text NOT NULL DEFAULT 'en';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bbf_users_preferred_locale_chk'
  ) THEN
    ALTER TABLE public.bbf_users
      ADD CONSTRAINT bbf_users_preferred_locale_chk
      CHECK (preferred_locale IN ('en', 'es', 'pt'));
  END IF;
END$$;

COMMENT ON COLUMN public.bbf_users.preferred_locale IS
  'Athlete UI/content locale (en|es|pt). Sourced by bbf-midnight-haiku and forwarded to bbf-agentic-orchestrator for native-locale snapshot/brief generation. Default en.';
