-- 20260723070000_night_shift_hardening.sql
-- Advisor-driven hardening for the Night Shift event bus (closes the WARN
-- findings the post-DDL get_advisors pass surfaced on the new objects):
--   • _bbf_next_tier — pin search_path (was mutable).
--   • bbf_levelup_propose / bbf_intervention_propose — SECURITY DEFINER trigger
--     functions must not be EXECUTE-able by anon/authenticated (they only ever
--     run as table triggers; client roles have no business invoking them).

alter function public._bbf_next_tier(text) set search_path = public;

revoke all on function public.bbf_levelup_propose() from public, anon, authenticated;
revoke all on function public.bbf_intervention_propose() from public, anon, authenticated;
