-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Studio V4 · AD COMPILER — backend render pipeline substrate
-- ───────────────────────────────────────────────────────────────────────────
-- The Ad Compiler stitches a background B-roll clip + audio track + hook/
-- sub-line text into a single 1080×1920 MP4 — text-overlay + B-roll ads,
-- NO AI avatars. The actual pixel/audio encode runs client-side (WebCodecs +
-- mp4-muxer, the SAME "Sovereign Foundry" engine the interactive Video Engine
-- tab already uses — the only viable "process assets to output MP4" path in
-- this stack; a Deno edge function has no ffmpeg binary and a CPU/time budget
-- nowhere near a real video transcode). This migration provides the two
-- pieces THAT side of the pipeline is missing:
--   • bbf_studio_compiler_jobs — the job ledger (queued → rendering →
--     completed/failed), giving the Studio a "Rendering…" state to poll and
--     the Queue tab a persistent list of compiled ads.
--   • bbf_studio_exports — the PUBLIC bucket the compiled MP4 lands in
--     (the exact bucket name the pipeline spec calls for).
-- Bucket-creation pattern mirrors sovereign-fragments/language-fragments
-- (20260702140000): public-read CDN, service-role-only write.
-- SECURITY: the jobs table is RLS enabled + forced + revoked from anon/
-- authenticated — the ONLY writer is the bbf-studio-compiler edge function
-- (service role), same envelope as bbf_reels_batch_v1/bbf_calling_cards_batch_v1.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_studio_compiler_jobs — the render job ledger ──────────────────────
create table if not exists public.bbf_studio_compiler_jobs (
  id                  uuid primary key default gen_random_uuid(),
  status              text not null default 'queued'
                        check (status in ('queued', 'rendering', 'completed', 'failed')),
  -- the compile request (REQUIREMENT 1 payload, verbatim)
  background_video_url text not null,
  audio_track_url      text not null,
  hook_text             text,
  sub_line_text         text,
  -- composition options (REQUIREMENT 2 — Studio V4's own font/position picks)
  hook_font           text not null default 'bebas'
                        check (hook_font in ('bebas', 'anton', 'barlow')),
  hook_font_size      integer not null default 138,
  text_layout         text not null default 'bottom'
                        check (text_layout in ('bottom', 'center', 'top')),
  -- output (REQUIREMENT 3)
  output_bucket       text not null default 'bbf_studio_exports',
  output_path         text,                       -- '{id}.mp4' once uploaded
  output_url          text,                        -- public URL once completed
  duration_sec        numeric,
  error               text,
  created_by          uuid references public.bbf_users(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.bbf_studio_compiler_jobs enable row level security;
alter table public.bbf_studio_compiler_jobs force  row level security;
revoke all on table public.bbf_studio_compiler_jobs from anon, authenticated;

create index if not exists idx_studio_compiler_jobs_recent
  on public.bbf_studio_compiler_jobs (created_at desc);

comment on table public.bbf_studio_compiler_jobs is
  'Studio V4 Ad Compiler · job ledger. The actual MP4 encode runs client-side (WebCodecs/mp4-muxer via SovereignFoundry); this table tracks queued→rendering→completed/failed and the resulting bbf_studio_exports URL. Service-role/edge-function only.';

-- ─── 2 · bbf_studio_exports (PUBLIC) — compiled ad MP4s, public-read CDN ──────
insert into storage.buckets (id, name, public)
values ('bbf_studio_exports', 'bbf_studio_exports', true)
on conflict (id) do nothing;

drop policy if exists "bbf_studio_exports_public_read" on storage.objects;
create policy "bbf_studio_exports_public_read"
  on storage.objects for select
  using (bucket_id = 'bbf_studio_exports');

drop policy if exists "bbf_studio_exports_service_write" on storage.objects;
create policy "bbf_studio_exports_service_write"
  on storage.objects for all
  to service_role
  using (bucket_id = 'bbf_studio_exports')
  with check (bucket_id = 'bbf_studio_exports');
