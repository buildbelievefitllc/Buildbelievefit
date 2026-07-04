-- supabase/migrations/20260704130000_bbf_language_soundboard_audio_cache.sql
-- bbf_language_soundboard_audio — TTS cache for the Language Mastery soundboard
-- (AdminLanguageRoadmap Vocab Gym/Rio Ready/Voice Studio + PimsleurAudioLab), served
-- via bbf-language-soundboard-tts. Coach Akeem's ElevenLabs voice clone replaces the
-- free browser voice; this cache is what keeps a repeat play of the same fixed vocab
-- term/phrase/lesson line from re-billing ElevenLabs. Keyed by a stable hash of
-- (cache_version|lang|text) so a deliberate voice/model bump can version-bust it.
-- Service-role only (the edge fn reads/writes via service key).
create table if not exists public.bbf_language_soundboard_audio (
  id          uuid primary key default gen_random_uuid(),
  cache_hash  text not null unique,
  lang        text not null check (lang in ('en','es','pt')),
  cue_text    text not null,
  voice_id    text not null,
  model_id    text not null,
  audio_b64   text not null,
  mime        text not null default 'audio/mpeg',
  bytes       integer,
  hit_count   integer not null default 0,
  created_at  timestamptz not null default now(),
  last_hit_at timestamptz
);

create unique index if not exists idx_bbf_lang_soundboard_audio_hash on public.bbf_language_soundboard_audio (cache_hash);
create index if not exists idx_bbf_lang_soundboard_audio_lang on public.bbf_language_soundboard_audio (lang);

alter table public.bbf_language_soundboard_audio enable row level security;
alter table public.bbf_language_soundboard_audio force  row level security;
revoke all on table public.bbf_language_soundboard_audio from anon, authenticated;

drop policy if exists bbf_language_soundboard_audio_service_only on public.bbf_language_soundboard_audio;
create policy bbf_language_soundboard_audio_service_only
  on public.bbf_language_soundboard_audio for all
  to service_role
  using (true)
  with check (true);

comment on table public.bbf_language_soundboard_audio is
  'TTS audio cache for the Language Mastery soundboard (bbf-language-soundboard-tts, Coach Akeem ElevenLabs voice clone). Keyed by hash(cache_version|lang|text). Service-role only.';
