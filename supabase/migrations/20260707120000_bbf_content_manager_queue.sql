-- ═══════════════════════════════════════════════════════════════════════════
-- BBF · DIGITAL CONTENT MANAGER — SCHEDULABLE DISTRIBUTION QUEUE
-- ───────────────────────────────────────────────────────────────────────────
-- The Command Center "Digital Content Manager" panel stages pre-baked drafts
-- (from the static bbf_master_content_engine.json library — NO live LLM), and on
-- "Approve & Synthesize" writes a finalized, SCHEDULABLE row here. The Distribution
-- Calendar reads this table and drag-and-drop reschedules a row's `scheduled_at`.
--
-- WHY A NEW TABLE (architectural note): the existing Sovereign Studio auto-post
-- queue is the two distributor tables bbf_calling_cards_batch_v1 / bbf_reels_batch_v1,
-- which carry NO scheduling column and post on a daily distributor drip. This panel
-- is a STRICTLY ADDITIVE scheduling layer that must not alter those live auto-posters
-- or their crons, so it owns its own queue with a first-class scheduled_at.
--
-- SECURITY (CLAUDE.md §7): RLS enabled + forced + revoked from anon/authenticated.
-- The bbf-content-manager edge function (service role, admin-session gated) is the
-- ONLY writer/reader — parity with bbf-studio-queue.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.bbf_content_manager_queue (
  id               uuid primary key default gen_random_uuid(),
  series           text not null,                         -- e.g. 'Mindset Engine' (drives calendar color + voice vibe)
  target_angle     text,                                  -- the strategic angle the draft attacks
  hook             text,                                  -- scroll-stopping headline
  caption          text,                                  -- full social caption
  studio_recipe    jsonb,                                 -- visual recipe { visual, asset, format }
  voiceover_script text,                                  -- the exact text voiced by the Akeem clone (no LLM)
  audio_url        text,                                  -- baked ElevenLabs MP3 (studio-audio-vault public URL)
  audio_slug       text,                                  -- the voiceover cache slug (provenance / re-fetch)
  status           text not null default 'scheduled'
                     check (status in ('scheduled','synthesized','posted','failed')),
  scheduled_at     timestamptz not null default now(),    -- the calendar dimension; drag-drop updates THIS
  source_ref       text,                                  -- originating bbf_master_content_engine.json item id
  created_by       uuid references public.bbf_users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

alter table public.bbf_content_manager_queue enable row level security;
alter table public.bbf_content_manager_queue force  row level security;
revoke all on table public.bbf_content_manager_queue from anon, authenticated;

create index if not exists idx_bbf_content_manager_queue_scheduled
  on public.bbf_content_manager_queue (scheduled_at);
create index if not exists idx_bbf_content_manager_queue_series
  on public.bbf_content_manager_queue (series, scheduled_at);

comment on table public.bbf_content_manager_queue is
  'BBF Digital Content Manager · schedulable distribution queue. Approved drafts (pre-baked JSON + Akeem voiceover) land here with a first-class scheduled_at; the Command Center calendar reads this and drag-drop reschedules scheduled_at. Additive — never touches the live distributor batch tables / crons. Service-role only (bbf-content-manager edge fn).';
