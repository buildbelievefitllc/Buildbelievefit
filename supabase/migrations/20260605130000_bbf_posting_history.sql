-- bbf_posting_history — Social signal-tracking telemetry ledger (Signal Loop).
-- ─────────────────────────────────────────────────────────────────────────────
-- Applied to project ihclbceghxpuawymlvgi via apply_migration (mirrored here for
-- repo source-of-truth). Append-only flight recorder: one snapshot row per poll
-- of a posted asset's metrics, so the Generator can analyze performance trends
-- over time. Written ONLY by the bbf-signal-tracker edge function (service role);
-- RLS is enabled with a service-role-only policy, so anon/authenticated roles
-- have no access.
--
-- INTEGRITY NOTE: the metric columns are NULLABLE on purpose. When a platform or
-- asset type does not expose a given metric (e.g. organic DM-open rate), the
-- tracker stores NULL — never a fabricated 0. A NULL means "not reported by the
-- API", which is the truth; a 0 would be a measurement the Generator could act on.
--
-- `asset_id` is the platform-native object id the tracker polls (Instagram media
-- id / TikTok video id). `platform` is constrained to the two polled networks.

create table if not exists public.bbf_posting_history (
  id             uuid primary key default gen_random_uuid(),
  asset_id       text not null,
  platform       text not null check (platform in ('meta', 'tiktok')),
  posted_at      timestamptz,
  impressions    bigint,
  click_throughs bigint,
  dm_opens       bigint,
  fetched_at     timestamptz not null default now()
);

-- Latest-snapshot-per-asset lookups (the Generator's primary read pattern).
create index if not exists idx_bbf_posting_history_asset_fetched
  on public.bbf_posting_history (asset_id, fetched_at desc);

-- Per-platform trend scans.
create index if not exists idx_bbf_posting_history_platform_fetched
  on public.bbf_posting_history (platform, fetched_at desc);

-- Global recency scans.
create index if not exists idx_bbf_posting_history_fetched
  on public.bbf_posting_history (fetched_at desc);

alter table public.bbf_posting_history enable row level security;

-- Strict service-role-write RLS: the edge function (service-role key) is the only
-- writer/reader. No anon/authenticated policies => full deny by default for them.
drop policy if exists "bbf_posting_history_service_only" on public.bbf_posting_history;
create policy "bbf_posting_history_service_only"
  on public.bbf_posting_history for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_posting_history is
  'Social signal-tracking telemetry ledger · Signal Loop · append-only snapshots of posted-asset metrics (impressions / click_throughs / dm_opens) polled from Meta Graph + TikTok by the bbf-signal-tracker edge function · service-role writes only · nullable metrics store NULL when a platform does not expose them (never a fabricated value) · consumed by the Generator for performance analysis';
