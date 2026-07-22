-- Blood Pressure Tracker (dedicated personal PWA)
-- Additive-only: two brand-new tables, no existing object touched.
-- Applied to production via apply_migration on 2026-07-22 (ledger assigns its own
-- timestamp; this filename version WILL differ from the ledger — expected drift,
-- see DATABASE_SAFETY.md). This file is the git record of that SQL.

-- ── bp_logs ──────────────────────────────────────────────────────────────
create table if not exists public.bp_logs (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null    default now(),
  systolic    integer     not null    check (systolic  > 0 and systolic  < 400),
  diastolic   integer     not null    check (diastolic > 0 and diastolic < 300),
  time_of_day text        not null    check (time_of_day in ('morning','evening')),
  notes       text
);

comment on table public.bp_logs is
  'Blood Pressure Tracker PWA readings. Personal single-user app; RLS enabled with open anon insert/select policies by product requirement.';

create index if not exists bp_logs_created_at_idx on public.bp_logs (created_at desc);

alter table public.bp_logs enable row level security;

drop policy if exists "bp_logs_open_insert" on public.bp_logs;
create policy "bp_logs_open_insert" on public.bp_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "bp_logs_open_select" on public.bp_logs;
create policy "bp_logs_open_select" on public.bp_logs
  for select to anon, authenticated using (true);

-- ── push_subscriptions ───────────────────────────────────────────────────
create table if not exists public.push_subscriptions (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null    default now(),
  subscription_data jsonb       not null
);

comment on table public.push_subscriptions is
  'Web Push subscriptions for the BP Tracker reminder cron. RLS enabled; anon may INSERT (register a device). Reads are service-role only (send-bp-reminder edge fn).';

-- Dedupe by push endpoint so re-subscribing a device does not pile up rows.
create unique index if not exists push_subscriptions_endpoint_idx
  on public.push_subscriptions ((subscription_data->>'endpoint'));

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_open_insert" on public.push_subscriptions;
create policy "push_subscriptions_open_insert" on public.push_subscriptions
  for insert to anon, authenticated with check (true);
-- No SELECT/UPDATE/DELETE policy: only the service role (edge fn) can read them.
