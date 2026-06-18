-- supabase/migrations/20260618120000_bbf_weekly_briefs.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- WEEKLY BRIEF backend — the coach's Monday voice memo (bbf-weekly-brief-scenario-
-- engine). Three pieces, all collision-free with the existing bbf_coach_audio
-- (section-coach) cache:
--   1. bbf_weekly_briefs  — one brief per (user, ISO year+week). Stores the STORAGE
--      PATH (not a URL): the edge fn signs a fresh URL on every read, so the weekly
--      cache never serves an expired link.
--   2. get_user_week_data — the week-telemetry RPC the scenario engine reads. Built
--      on the REAL schema: bbf_sets (dated via day_key 'YYYY-MM-DD_dN') + bbf_readiness.
--   3. bbf-coach-audio    — a PRIVATE storage bucket for the mp3 blobs (signed URLs
--      only; coaching audio is not world-readable — §7).

-- ── 1 · weekly brief cache table ────────────────────────────────────────────────
create table if not exists public.bbf_weekly_briefs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.bbf_users(id) on delete cascade,
  year            integer not null,
  week_of_year    integer not null,
  scenario        text not null,
  substatus       text not null,
  locked_in       boolean not null default false,
  audio_path      text,            -- storage object path; signed fresh on every read
  rendered_script text,            -- backs the UI transcript drawer
  voice_id        text,
  voice_name      text,
  created_at      timestamptz not null default now(),
  unique (user_id, year, week_of_year)   -- one brief per week per user
);

create index if not exists idx_weekly_briefs_user_week
  on public.bbf_weekly_briefs (user_id, year, week_of_year);

-- RLS: service_role only (the edge fn writes/reads with the service key; no client
-- ever touches this table directly). Mirrors the bbf_coach_audio lockdown.
alter table public.bbf_weekly_briefs enable row level security;
drop policy if exists "weekly_briefs_service_only" on public.bbf_weekly_briefs;
create policy "weekly_briefs_service_only" on public.bbf_weekly_briefs
  for all to service_role using (true) with check (true);

-- ── 2 · week-telemetry RPC ──────────────────────────────────────────────────────
-- SECURITY DEFINER: the edge fn calls it with the service key AFTER the entitlement
-- gate has resolved identity server-side, so p_user_id is already trusted. Plateau /
-- progression DETAIL fields are NULL in v1 (the scenario engine degrades to
-- COMPLIANCE / PROGRESSION-by-max-weight / NEUTRAL) — matching the original draft's
-- documented behavior; richer lift-level analytics can fill them later.
create or replace function public.get_user_week_data(p_user_id uuid)
returns table (
  user_id              uuid,
  sessions_logged      integer,
  unique_days          integer,
  avg_rpe              double precision,
  readiness_logs       integer,
  app_open_days        integer,
  max_weight_this_week double precision,
  max_weight_last_week double precision,
  plateau_lift         text,
  plateau_weight       double precision,
  plateau_weeks        integer,
  progression_lift     text,
  progression_weight   double precision,
  pr_amount            double precision,
  rep_delta            integer
)
language sql
security definer
set search_path = public
as $$
  with sets7 as (
    select s.*, substring(s.day_key, 1, 10)::date as d
    from public.bbf_sets s
    where s.user_id = p_user_id
      and s.day_key ~ '^\d{4}-\d{2}-\d{2}'
      and substring(s.day_key, 1, 10)::date >= (current_date - 7)
  ),
  sets14 as (
    select s.*, substring(s.day_key, 1, 10)::date as d
    from public.bbf_sets s
    where s.user_id = p_user_id
      and s.day_key ~ '^\d{4}-\d{2}-\d{2}'
      and substring(s.day_key, 1, 10)::date >= (current_date - 14)
      and substring(s.day_key, 1, 10)::date <  (current_date - 7)
  ),
  read7 as (
    select coalesce(r.reading_date, (r.timestamp at time zone 'utc')::date) as rd
    from public.bbf_readiness r
    where r.user_id = p_user_id
      and coalesce(r.reading_date, (r.timestamp at time zone 'utc')::date) >= (current_date - 7)
  )
  select
    p_user_id,
    (select count(distinct d) from sets7)::integer,
    (select count(distinct d) from sets7)::integer,
    coalesce((select avg(rpe)::double precision from sets7 where rpe is not null), 0),
    (select count(*) from read7)::integer,
    (select count(distinct dd) from (
        select d as dd from sets7
        union
        select rd from read7
     ) u)::integer,
    coalesce((select max(weight_lbs) from sets7), 0),
    coalesce((select max(weight_lbs) from sets14), 0),
    null::text, null::double precision, null::integer,
    null::text, null::double precision, null::double precision, null::integer;
$$;

revoke all on function public.get_user_week_data(uuid) from public, anon, authenticated;
grant execute on function public.get_user_week_data(uuid) to service_role;

-- ── 3 · private storage bucket for the mp3 blobs ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('bbf-coach-audio', 'bbf-coach-audio', false)
on conflict (id) do nothing;
