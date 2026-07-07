-- ═══════════════════════════════════════════════════════════════════════════
-- BBF · Post-Workout Check-In — allow pain_score 0 for the "None" target area
-- ───────────────────────────────────────────────────────────────────────────
-- The check-in gained a "None" target-area option (athlete has no pain / no
-- friction anywhere), which submits pain_score = 0. The original CHECK required
-- pain 1..10, so every "None" check-in 500'd on the session_feedback insert
-- ("Check-in could not be saved (500)"). Relax the floor to 0:
--   0  = no pain / no target area reported (skips the prehab prescription)
--   1..10 = a real complaint on the reported joint (feeds the prehab engine)
-- RPE is always a genuine 1..10 session-difficulty rating, so its CHECK is
-- unchanged. Idempotent: DROP CONSTRAINT IF EXISTS → ADD CONSTRAINT.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.session_feedback
  drop constraint if exists session_feedback_pain_score_check;

alter table public.session_feedback
  add constraint session_feedback_pain_score_check
  check (pain_score >= 0 and pain_score <= 10);
