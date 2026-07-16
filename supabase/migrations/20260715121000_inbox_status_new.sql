-- Widen coach_action_inbox.status to allow 'NEW' (prospect isolation)
-- ----------------------------------------------------------------------------
-- The agentic Action Inbox (bbf-agent-brain) lists coach_action_inbox by
-- status='PENDING' with no type filter and added a CHECK limiting status to
-- PENDING/APPROVED/DISMISSED. Interrogator prospect cards (type NEW_PROSPECT)
-- need a status that stays OUT of that athlete-oriented desk yet still reads as
-- "unactioned" in the Comlink Prospects lane. 'NEW' does exactly that.
--
-- This is strictly ADDITIVE: the agentic loop never emits 'NEW', so widening the
-- allowed set cannot break its inserts, reads, or resolves. Coordinate before any
-- future NARROWING of this constraint.
-- ----------------------------------------------------------------------------

alter table public.coach_action_inbox drop constraint if exists coach_action_inbox_status_chk;
alter table public.coach_action_inbox add constraint coach_action_inbox_status_chk
  check (status = any (array['PENDING', 'APPROVED', 'DISMISSED', 'NEW']));
