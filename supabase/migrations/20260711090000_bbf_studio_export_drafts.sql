-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Studio V4 · VAULT EXPORT HISTORY — never lose a finished render again
-- ───────────────────────────────────────────────────────────────────────────
-- FIELD FAILURE THIS SOLVES (Galaxy S25 Ultra): a reel renders client-side
-- (WebCodecs/mp4-muxer via SovereignFoundry) but the phone download dies —
-- blob anchors are dropped silently in the installed PWA and the share sheet
-- needs a fresh tap. Today that blob lives ONLY in browser memory: close the
-- tab and the 10-60s render is gone. This migration gives every finished
-- export a durable server-side home so the CEO can render on the phone and
-- retrieve on the laptop (or any device) from the Studio's HISTORY tab.
--   • bbf_studio_export_drafts — the draft ledger (one row per finished
--     export: filename, kind, size, duration, where it lives in storage).
--   • studio-drafts-v1 — PRIVATE bucket the export blobs land in. Uploads go
--     through one-shot signed URLs minted by bbf-studio-drafts; downloads go
--     through short-lived signed URLs minted the same way. Nothing public.
-- SECURITY (CLAUDE.md §7): table is RLS enabled + forced + revoked from anon/
-- authenticated — the ONLY reader/writer is the bbf-studio-drafts edge
-- function (service role), same envelope as bbf_studio_compiler_jobs.
-- Bucket pattern mirrors directed-v1 (20260702140000): private, service-write.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_studio_export_drafts — the export-history ledger ─────────────────
create table if not exists public.bbf_studio_export_drafts (
  id             uuid primary key,                -- server-minted at sign; MUST equal the storage object stem
  status         text not null default 'stored'
                   check (status in ('stored', 'deleted')),
  kind           text not null default 'video'
                   check (kind in ('image', 'video')),
  mode           text,                            -- studio surface that baked it: cta | phone | reel
  file_name      text not null,                   -- the exact export filename (bbf-reel-….mp4 / bbf-cta-….jpg)
  content_type   text not null default 'video/mp4',
  bytes          bigint,                          -- verified server-side at confirm (storage HEAD)
  duration_sec   numeric,                         -- video meta (null for images)
  frames         integer,                         -- video meta (null for images)
  caption        text,                            -- auto-caption snapshot, so the laptop session can re-post
  source_device  text,                            -- 'mobile' | 'desktop' — where it was rendered
  storage_bucket text not null default 'studio-drafts-v1',
  storage_path   text not null,                   -- '{id}.{ext}'
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.bbf_studio_export_drafts enable row level security;
alter table public.bbf_studio_export_drafts force  row level security;
revoke all on table public.bbf_studio_export_drafts from anon, authenticated;

create index if not exists idx_studio_export_drafts_recent
  on public.bbf_studio_export_drafts (created_at desc);

comment on table public.bbf_studio_export_drafts is
  'Studio V4 · Vault Export History. One row per finished client-side export (reel MP4 / card JPEG), blob stored in private bucket studio-drafts-v1 — so a phone-side download failure never loses a render. Service-role/bbf-studio-drafts edge function only.';

-- ─── 2 · studio-drafts-v1 (PRIVATE) — the export blobs ────────────────────────
insert into storage.buckets (id, name, public)
values ('studio-drafts-v1', 'studio-drafts-v1', false)
on conflict (id) do nothing;

drop policy if exists "studio_drafts_v1_service_write" on storage.objects;
create policy "studio_drafts_v1_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'studio-drafts-v1')
  with check (bucket_id = 'studio-drafts-v1');
