-- supabase/migrations/20260618090000_bbf_coach_audio_cache.sql
-- bbf_coach_audio — TTS cache for the Universal Voice Coach (bbf-biokinetic-briefing).
-- Avoids re-billing ElevenLabs + Claude for an identical cue. Keyed by a stable
-- hash of (context|locale|cue_ref) so the cache survives Claude's non-deterministic
-- phrasing. Service-role only (the edge fn reads/writes via service key).
create table if not exists public.bbf_coach_audio (
  id          uuid primary key default gen_random_uuid(),
  cue_hash    text not null unique,
  context     text not null,
  locale      text not null,
  cue_ref     text,
  voice_id    text,
  voice_name  text,
  narrative   text,
  audio_b64   text not null,
  mime        text not null default 'audio/mpeg',
  bytes       integer,
  model_id    text,
  hit_count   integer not null default 0,
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz
);

create unique index if not exists idx_bbf_coach_audio_hash on public.bbf_coach_audio (cue_hash);
create index if not exists idx_bbf_coach_audio_ctx on public.bbf_coach_audio (context, locale);

alter table public.bbf_coach_audio enable row level security;
drop policy if exists bbf_coach_audio_service_only on public.bbf_coach_audio;
create policy bbf_coach_audio_service_only
  on public.bbf_coach_audio for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_coach_audio is
  'TTS audio cache for bbf-biokinetic-briefing coach cues (recovery/prehab/cardio). Keyed by hash(context|locale|cue_ref).';
