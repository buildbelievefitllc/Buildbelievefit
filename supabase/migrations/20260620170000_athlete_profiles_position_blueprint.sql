-- 20260620170000_athlete_profiles_position_blueprint.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Athlete Blueprint pipeline · schema patch.
--   • position  — the athlete's position/event code (parity with bbf_users.position),
--                 so athlete_profiles is a complete blueprint identity record.
--   • blueprint / blueprint_updated_at — the server-side store for the forged Athlete
--                 Blueprint (Field Work / Weight Room / Fuel), persisted by the
--                 bbf-athlete-sync edge function (replaces the localStorage fallback).
--   • UNIQUE(user_id) — one profile per athlete; lets bbf_submit_youth_intake UPSERT.

alter table public.athlete_profiles
  add column if not exists "position"          text,
  add column if not exists blueprint           jsonb,
  add column if not exists blueprint_updated_at timestamptz;

create unique index if not exists athlete_profiles_user_id_key
  on public.athlete_profiles (user_id);

grant select, insert, update, delete on public.athlete_profiles to service_role;
