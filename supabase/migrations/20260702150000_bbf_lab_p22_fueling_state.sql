-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 2.2 · FUELING STATE TABLES (chronobiology substrate)
-- ───────────────────────────────────────────────────────────────────────────
-- The Fuel Sovereign (Tier 3) engine needs two state tables the Phase-1 migrations
-- didn't provision (they belong to the fueling engine, not the core contract):
--   • athlete_volume_fingerprint — weekday volume rhythm (FUEL blueprint §4.2)
--   • nutrition_phase_state      — mesocycle phase + armed carb-load window (§4.4)
-- bbf-fueling-sentinel reads/writes these to arm the 48-hour carb ramp from the
-- athlete's own floor ledger (no wearables, no manual event date).
--
-- SERVICE-ROLE RLS: enabled + forced + revoked from anon/authenticated (zero policies).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── athlete_volume_fingerprint — the weekday volume fingerprint (§4.2) ───────
create table if not exists public.athlete_volume_fingerprint (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.athlete_profiles(id) on delete cascade,
  weekday            smallint not null check (weekday between 0 and 6),   -- 0=Sunday
  ewma_strain_au     numeric not null default 0,     -- EWMA over same-weekday history
  observation_count  integer not null default 0,
  cv                 numeric,                         -- coefficient of variation (stability)
  median_session_min smallint,                        -- minutes-since-midnight, session start
  computed_at        timestamptz not null default now(),
  unique (athlete_id, weekday)
);
alter table public.athlete_volume_fingerprint enable row level security;
alter table public.athlete_volume_fingerprint force  row level security;
revoke all on table public.athlete_volume_fingerprint from anon, authenticated;

comment on table public.athlete_volume_fingerprint is
  'BBF Lab P2.2 · per-(athlete,weekday) EWMA strain fingerprint (λ_fp=0.25, 8-week memory). Predicts heavy floor days from logged sets alone — the chronobiology substrate for the predictive carb scheduler. Service-role only.';

-- ─── nutrition_phase_state — mesocycle phase + armed carb-load window (§4.4) ──
create table if not exists public.nutrition_phase_state (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.athlete_profiles(id) on delete cascade,
  phase              text not null check (phase in
                       ('accumulation','intensification','taper','maintenance')),
  detected_on        date not null,
  carb_window_start  timestamptz,                     -- null when no window armed
  carb_window_end    timestamptz,
  window_source      text check (window_source in ('signature','declared')),
  confidence         numeric,
  signals            jsonb not null default '{}',     -- ACWR series, slopes, fingerprint hits
  status             text not null default 'active' check (status in
                       ('active','superseded','cancelled','completed')),
  created_at         timestamptz not null default now()
);
alter table public.nutrition_phase_state enable row level security;
alter table public.nutrition_phase_state force  row level security;
revoke all on table public.nutrition_phase_state from anon, authenticated;

-- One live phase per athlete — the idempotency key for supersede-on-recompute.
create unique index if not exists uq_nutrition_phase_active
  on public.nutrition_phase_state (athlete_id) where status = 'active';
create index if not exists idx_nps_athlete
  on public.nutrition_phase_state (athlete_id, detected_on desc);

comment on table public.nutrition_phase_state is
  'BBF Lab P2.2 · mesocycle phase + auto-armed carb-load window (signature or declared). The partial unique index (athlete_id WHERE status=active) enforces one live phase; the sentinel supersedes on recompute. Service-role only.';
