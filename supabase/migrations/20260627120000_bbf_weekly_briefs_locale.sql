-- supabase/migrations/20260627120000_bbf_weekly_briefs_locale.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- WEEKLY BRIEF — make the cache locale-aware. The coach's Monday voice memo is now
-- rendered AND voiced (Coach Akeem · eleven_multilingual_v2) in the athlete's chosen
-- language. Previously one brief was cached per (user, ISO year+week), so whichever
-- language generated first won the week and every other locale replayed it. We add a
-- `locale` dimension so EN / ES / PT each persist their own brief for the week.

-- 1 · locale column (existing rows are English).
alter table public.bbf_weekly_briefs
  add column if not exists locale text not null default 'en';

-- 2 · drop the old (user_id, year, week_of_year) unique so locales can coexist.
alter table public.bbf_weekly_briefs
  drop constraint if exists bbf_weekly_briefs_user_id_year_week_of_year_key;

-- 3 · add the locale-aware unique key (guarded → safe to re-run).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.bbf_weekly_briefs'::regclass
      and conname = 'bbf_weekly_briefs_user_year_week_locale_key'
  ) then
    alter table public.bbf_weekly_briefs
      add constraint bbf_weekly_briefs_user_year_week_locale_key
      unique (user_id, year, week_of_year, locale);
  end if;
end $$;

-- 4 · refresh the lookup index to match the new read pattern.
drop index if exists public.idx_weekly_briefs_user_week;
create index if not exists idx_weekly_briefs_user_week_locale
  on public.bbf_weekly_briefs (user_id, year, week_of_year, locale);
