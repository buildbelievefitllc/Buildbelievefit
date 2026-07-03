-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 4/6 — CARDIO BRIDGE & ZERO-API AUDIO STITCHING
-- ───────────────────────────────────────────────────────────────────────────
-- Source: SMART_CARDIO_VOCAL_BRIDGE_BLUEPRINT §1.5 (bbf_cardio_prescription ALTER),
--         §3.5 (sovereign_audio_fragments, sovereign_brief_playlists),
--         §3.4 (bbf_daily_brief_context — the router's deterministic input).
--
-- THE GRAM STANDARD: EE via MET × body_mass_g × 1.75e-5; sweat_loss_g_est /
-- rehydration_g are INTEGER grams. No kg anywhere.
--
-- ZERO LIVE API: the daily brief is assembled by a deterministic router from
-- pre-baked fragments (Postgres reads + Storage URLs only). sovereign_audio_fragments
-- is the bake-time allow-list; sovereign_brief_playlists is the daily stitched result.
--
-- NOTE — bbf_cardio_prescription ALREADY EXISTS (20260626140000), keyed on
-- user_id → bbf_users(id) + prescribed_for DATE, RLS enabled+forced. This migration
-- ALTERs it (appends the mechanical bridge + gram outputs). work_rest_ratio already
-- exists on the base table → ADD COLUMN IF NOT EXISTS is a safe no-op there.
-- SECURITY: RLS enabled + forced + revoked from anon/authenticated on new tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_cardio_prescription (EXISTING) — append the mechanical bridge (§1.5) ─
alter table public.bbf_cardio_prescription
  add column if not exists mech_state         text    check (mech_state in ('danger','caution','clear')),
  add column if not exists mech_ceiling       text    check (mech_ceiling in ('Zone 2','Tempo')),
  add column if not exists mech_signals       jsonb,        -- { acwr_axial, acwr_impact, shadow, debt_sum_ratio, monotony, fired:['D1','D3'] }
  add column if not exists effective_tier     text    check (effective_tier in ('HIIT','Tempo','Zone 2')),
  add column if not exists hr_cap_bpm         smallint,
  add column if not exists rpe_cap            smallint,
  add column if not exists work_rest_ratio    text,         -- already present on base → no-op
  add column if not exists duration_min       smallint,
  add column if not exists ee_kcal_est        integer,      -- §0.1 gram-MET equation
  add column if not exists sweat_loss_g_est   integer,      -- grams
  add column if not exists rehydration_g      integer,      -- grams (150% replacement)
  add column if not exists prescription_trace jsonb;        -- every ceiling, in order, with reasons

-- Re-assert RLS (order: every altered table ships RLS enabled; base is already forced).
alter table public.bbf_cardio_prescription enable row level security;

comment on column public.bbf_cardio_prescription.mech_signals is
  'BBF Lab P1 · mechanical bridge signal snapshot (per-vector ACWR, 48h shadow, debt sum, monotony, fired danger/caution codes).';

-- ─── 2 · bbf_daily_brief_context — the router''s deterministic input payload (§3.4) ─
-- The composed, locale-neutral JSON assembled from the cardio/nutrition/prehab/
-- recovery engines. One row per (athlete, day); the stitching router reads .payload.
create table if not exists public.bbf_daily_brief_context (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athlete_profiles(id) on delete cascade,
  day           date not null,
  payload       jsonb not null default '{}',        -- deterministic engine output (numbers)
  status        text not null default 'ready' check (status in ('ready','stale','consumed')),
  computed_at   timestamptz not null default now(),
  unique (athlete_id, day)
);

alter table public.bbf_daily_brief_context enable row level security;
alter table public.bbf_daily_brief_context force  row level security;
revoke all on table public.bbf_daily_brief_context from anon, authenticated;

comment on table public.bbf_daily_brief_context is
  'BBF Lab P1 · locale-neutral deterministic brief payload (cardio/nutrition/prehab/recovery joins). Input to the zero-API stitching router; router emits per-locale sovereign_brief_playlists. Service-role only.';

-- ─── 3 · sovereign_audio_fragments — the baked fragment library (the allow-list, §3.5)
create table if not exists public.sovereign_audio_fragments (
  id             uuid primary key default gen_random_uuid(),
  slot           text not null check (slot in ('S0','S1','S2','S3','S4','S5','S6','S7')),
  variant_key    text not null,                     -- 'S1_AXIAL_SPIKE_ZONE2_FORCED'
  locale         text not null check (locale in ('en','es','pt')),
  script_text    text not null,                     -- the audited words, versioned
  script_version integer not null default 1,
  sha256         text not null,                     -- hash of script_text → idempotent re-bake
  storage_path   text not null,                     -- sovereign-fragments/<key>-<locale>.mp3
  public_url     text not null,
  duration_ms    integer not null,
  lufs           numeric,                            -- loudness-normalization audit (§3.6)
  status         text not null default 'active' check (status in ('active','retired')),
  baked_at       timestamptz not null default now(),
  unique (variant_key, locale, script_version)
);

alter table public.sovereign_audio_fragments enable row level security;
alter table public.sovereign_audio_fragments force  row level security;
revoke all on table public.sovereign_audio_fragments from anon, authenticated;

-- Router manifest resolution: (slot, variant_key, locale) → active fragment.
create index if not exists idx_saf_slot_variant_locale
  on public.sovereign_audio_fragments (slot, variant_key, locale)
  where status = 'active';

comment on table public.sovereign_audio_fragments is
  'BBF Lab P1 · baked Sovereign fragment library = the router allow-list. 50 keys × en/es/pt, one Akeem-clone voice, hash-idempotent re-bake. The router may only emit keys that exist here (coverage gate enforced at bake). Service-role only.';

-- ─── 4 · sovereign_brief_playlists — the daily stitched result (§3.5) ──────────
-- One row per (athlete, day, locale). Zero-API: the morning router writes this
-- from pure lookups; the playback endpoint reads it and flips status to 'consumed'.
create table if not exists public.sovereign_brief_playlists (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.athlete_profiles(id) on delete cascade,
  day                date not null,
  locale             text not null check (locale in ('en','es','pt')),
  playlist           jsonb not null,               -- ordered fragments, resolved URLs inline
  screen_facts       jsonb not null default '[]',  -- the gram-precise visual channel
  beats_selected     jsonb not null,               -- ranked + dropped beats (audit)
  tone               text not null,
  total_duration_ms  integer not null,
  status             text not null default 'ready'
                       check (status in ('ready','consumed','stale')),
  computed_at        timestamptz not null default now(),
  unique (athlete_id, day, locale)
);

alter table public.sovereign_brief_playlists enable row level security;
alter table public.sovereign_brief_playlists force  row level security;
revoke all on table public.sovereign_brief_playlists from anon, authenticated;

comment on table public.sovereign_brief_playlists is
  'BBF Lab P1 · daily stitched Sovereign briefing (one row per athlete/day/locale). Gram-precise digits ride screen_facts; beats_selected is the audit trail. Re-routed in place on floor resync (free). Service-role only.';
