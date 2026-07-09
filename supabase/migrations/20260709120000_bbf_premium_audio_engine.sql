-- 20260709120000_bbf_premium_audio_engine.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- PREMIUM AUDIO MONETIZATION ENGINE — data foundation (blueprint commit c509f26).
--
-- Product 1 · Biometric Narration & Music Engine:
--   · bbf_premium_audio_fragments — content-hash-deduped Akeem narration segments
--     + the pre-baked biometric inflection variant library.
--   · bbf_music_beds              — ElevenLabs Music v2 beds cached by workout
--     SHAPE (plan_signature), user-agnostic — the unit-economics engine.
--   · bbf_premium_session_tracks  — per-athlete daily play contracts (manifests).
--
-- Product 2 · Real-Time Interactive Mindset Coach:
--   · bbf_convai_sessions         — live agent session ledger + accountability
--     memory (commitments feed the NEXT session's dynamic variables).
--
-- Storage: PRIVATE bucket `bbf_premium_audio_vault` — paid content is never on a
-- public bucket; delivery is exclusively short-TTL signed URLs minted by the
-- entitlement-gated composer. RLS posture (house pattern, cf. 20260626160000 /
-- 20260702133000): ENABLED + FORCED, zero anon/auth policies — service-role only,
-- clients reach the data exclusively through the gated edge functions.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Isolated PRIVATE premium bucket ─────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('bbf_premium_audio_vault', 'bbf_premium_audio_vault', false)
on conflict (id) do nothing;

-- Service-role owns the bucket; NO public read (unlike coach-static). Signed
-- URLs are the only delivery path.
drop policy if exists premium_audio_vault_service_all on storage.objects;
create policy premium_audio_vault_service_all
  on storage.objects for all to service_role
  using (bucket_id = 'bbf_premium_audio_vault')
  with check (bucket_id = 'bbf_premium_audio_vault');

-- ── 2 · Narration fragments (segment cache + inflection variants) ───────────
create table if not exists public.bbf_premium_audio_fragments (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('segment','inflection','intro_outro')),
  variant_key     text not null,            -- timeline slot ('B1_S1_REST') or 'INF_HR_LOW_strength'
  locale          text not null check (locale in ('en','es','pt')),
  script_text     text not null,
  script_sha256   text not null,            -- dedupe key: sha256(voice|model|rendered_text)
  model_id        text not null,
  voice_id        text not null,
  storage_path    text not null,            -- bbf_premium_audio_vault/seg/<sha>.mp3
  duration_ms     integer,
  hit_count       bigint not null default 0,
  status          text not null default 'active' check (status in ('active','retired')),
  created_at      timestamptz not null default now(),
  unique (script_sha256, locale)
);
create index if not exists bbf_premium_audio_fragments_variant_idx
  on public.bbf_premium_audio_fragments (variant_key, locale) where status = 'active';

alter table public.bbf_premium_audio_fragments enable row level security;
alter table public.bbf_premium_audio_fragments force row level security;
revoke all on public.bbf_premium_audio_fragments from anon, authenticated;

-- ── 3 · Shared music beds (cached by workout SHAPE — never identity) ─────────
create table if not exists public.bbf_music_beds (
  id               uuid primary key default gen_random_uuid(),
  plan_signature   text not null unique,    -- sha256(blocks|durations|category|intensity)
  composition_plan jsonb not null,          -- exact /v1/music payload for audit/regen
  storage_path     text not null,           -- bbf_premium_audio_vault/beds/<sig>.mp3
  duration_ms      integer not null,
  loopable         boolean not null default false,
  hit_count        bigint not null default 0,
  created_at       timestamptz not null default now()
);

alter table public.bbf_music_beds enable row level security;
alter table public.bbf_music_beds force row level security;
revoke all on public.bbf_music_beds from anon, authenticated;

-- ── 4 · Per-athlete daily session tracks (the play contracts) ────────────────
create table if not exists public.bbf_premium_session_tracks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.bbf_users(id) on delete cascade,
  session_day       date not null,
  locale            text not null check (locale in ('en','es','pt')),
  plan_signature    text not null,
  manifest          jsonb not null,          -- full play contract (paths, NOT signed URLs)
  readiness_score   integer,                 -- stale-cache guard (bbf_sovereign_audio pattern)
  total_duration_ms integer,
  status            text not null default 'ready'
                    check (status in ('composing','ready','failed')),
  created_at        timestamptz not null default now(),
  unique (user_id, session_day, locale)
);
create index if not exists bbf_premium_session_tracks_user_idx
  on public.bbf_premium_session_tracks (user_id, session_day desc);

alter table public.bbf_premium_session_tracks enable row level security;
alter table public.bbf_premium_session_tracks force row level security;
revoke all on public.bbf_premium_session_tracks from anon, authenticated;

-- ── 5 · Live agent sessions (P2 ledger + accountability memory) ──────────────
create table if not exists public.bbf_convai_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.bbf_users(id) on delete cascade,
  mode                text not null check (mode in ('mindset','nutrition_audit','checkin')),
  locale              text not null default 'en' check (locale in ('en','es','pt')),
  conversation_id     text,                  -- ElevenLabs conversation id (from the webhook)
  status              text not null default 'minted'
                      check (status in ('minted','active','completed','expired','failed')),
  duration_s          integer,
  tokens_charged      bigint,
  transcript_summary  text,
  commitments         jsonb not null default '[]'::jsonb,
  wellbeing_flag      boolean not null default false,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz
);
create index if not exists bbf_convai_sessions_user_idx
  on public.bbf_convai_sessions (user_id, started_at desc);

alter table public.bbf_convai_sessions enable row level security;
alter table public.bbf_convai_sessions force row level security;
revoke all on public.bbf_convai_sessions from anon, authenticated;

-- ── 5b · Bed hit-count touch (observability for the amortization thesis) ─────
-- PostgREST PATCH cannot express `hit_count = hit_count + 1`; a tiny SECURITY
-- DEFINER RPC keeps the composer's cache-hit telemetry a single call.
create or replace function public.bbf_touch_music_bed(p_signature text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.bbf_music_beds
     set hit_count = hit_count + 1
   where plan_signature = p_signature;
$$;
revoke all on function public.bbf_touch_music_bed(text) from public, anon, authenticated;
grant execute on function public.bbf_touch_music_bed(text) to service_role;

-- ── 6 · Config keys (bbf_app_config — house perimeter pattern) ───────────────
-- Secrets are GENERATED server-side (gen_random_bytes), never committed.
-- convai_agent_id starts empty — set post-agent-creation via the admin console.
insert into public.bbf_app_config (key, value)
select 'premium_audio_secret', encode(gen_random_bytes(32), 'hex')
where not exists (select 1 from public.bbf_app_config where key = 'premium_audio_secret');

insert into public.bbf_app_config (key, value)
select 'convai_webhook_secret', encode(gen_random_bytes(32), 'hex')
where not exists (select 1 from public.bbf_app_config where key = 'convai_webhook_secret');

insert into public.bbf_app_config (key, value)
select 'convai_agent_id', ''
where not exists (select 1 from public.bbf_app_config where key = 'convai_agent_id');
