-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 6/6 — CONTENT STUDIO V4
-- ───────────────────────────────────────────────────────────────────────────
-- Source: CONTENT_STUDIO_V4_BLUEPRINT §2.4 (studio_overlay_presets),
--         §4.3 (studio_directed_deliveries), §4.4 (studio_render_jobs mirror).
--
-- GRAM STANDARD: stat-badge overlays bind to *_g ledger columns and render
-- integer grams (no kg formatter). The binding contract lives in overlay_json.
-- TRILINGUAL: one locale per render job (target's preferred_language for Directed
-- Play; CEO channel choice for social).
-- PRIVACY: directed jobs land in a PRIVATE bucket (studio-queue pattern), never the
-- public reels bucket — enforced by the composer/serving fn; schema records the route.
-- SECURITY: RLS enabled + forced + revoked from anon/authenticated on every table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · studio_overlay_presets — customize once, reuse forever (§2.4) ─────────
create table if not exists public.studio_overlay_presets (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  overlay_json jsonb not null,                     -- full overlayState minus locale + binding values
  created_by   uuid references public.bbf_users(id),
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);

alter table public.studio_overlay_presets enable row level security;
alter table public.studio_overlay_presets force  row level security;
revoke all on table public.studio_overlay_presets from anon, authenticated;

comment on table public.studio_overlay_presets is
  'BBF Lab P1 · reusable cosmetics presets (layer list + grade). overlay_json round-trips through JSON.stringify (no functions/refs). Service-role only.';

-- ─── 2 · studio_render_jobs — server-side batch mirror (QueueMonitor, §4.4) ────
-- id is CLIENT-MINTED (no default) — the FoundryBatchController owns the job id;
-- best-effort upserts through bbf-studio-queue ('job_status'), telemetry posture.
create table if not exists public.studio_render_jobs (
  id            uuid primary key,                  -- client-minted job id (no default)
  kind          text not null,
  lane          text,
  ladder        jsonb,
  status        text not null,
  progress_pct  smallint,
  fail_reason   text,
  created_by    uuid references public.bbf_users(id),
  updated_at    timestamptz not null default now()
);

alter table public.studio_render_jobs enable row level security;
alter table public.studio_render_jobs force  row level security;
revoke all on table public.studio_render_jobs from anon, authenticated;

create index if not exists idx_studio_render_jobs_status
  on public.studio_render_jobs (status, updated_at desc);

comment on table public.studio_render_jobs is
  'BBF Lab P1 · lightweight server mirror of the React-free client render queue (lane A/B/C, ladder, progress). Survives reloads / cross-device visibility. Write failures never block rendering. Service-role only.';

-- ─── 3 · studio_directed_deliveries — route a render to one athlete (§4.3) ─────
create table if not exists public.studio_directed_deliveries (
  id             uuid primary key default gen_random_uuid(),
  asset_kind     text not null check (asset_kind in ('reel','audio_brief','card')),
  storage_bucket text not null,                    -- server-generated (private 'directed-v1')
  storage_path   text not null,
  athlete_id     uuid not null references public.athlete_profiles(id) on delete cascade,
  locale         text not null check (locale in ('en','es','pt')),
  note           text,                             -- CEO's one-liner, shown with the tile
  overlay_json   jsonb,                            -- provenance: what was rendered
  status         text not null default 'queued'
                   check (status in ('queued','delivered','viewed','expired')),
  created_by     uuid references public.bbf_users(id),
  created_at     timestamptz not null default now(),
  delivered_at   timestamptz,
  viewed_at      timestamptz
);

alter table public.studio_directed_deliveries enable row level security;
alter table public.studio_directed_deliveries force  row level security;
revoke all on table public.studio_directed_deliveries from anon, authenticated;

create index if not exists idx_sdd_athlete_status
  on public.studio_directed_deliveries (athlete_id, status, created_at desc);

comment on table public.studio_directed_deliveries is
  'BBF Lab P1 · CEO-to-one-athlete delivery lane. locale locks to athlete.preferred_language; stat bindings refreeze against that athlete''s ledgers; private bucket only. Status walks queued→delivered→viewed (read receipts). Service-role only.';
