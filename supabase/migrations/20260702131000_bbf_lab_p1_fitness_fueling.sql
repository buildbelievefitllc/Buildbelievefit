-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 2/6 — FITNESS & FUELING (3-Tier Nutrition)
-- ───────────────────────────────────────────────────────────────────────────
-- Source: FUEL_ECOSYSTEM_3TIER_BLUEPRINT §1.1 (athlete_body_metrics),
--         §1.4 (athlete_nutrition_targets_daily), §2.3 (nutrition_intake_log).
--
-- THE GRAM STANDARD (§0.1): body mass in body_mass_g BIGINT; every macro output
-- (protein_g/carbs_g/fat_g/serving_g) is an INTEGER of grams. Kilograms are
-- unrepresentable. lean_mass_g is a STORED generated column (gram-pure identity);
-- kcal is a STORED generated column (4·P + 4·C + 9·F). Energy stays in kcal (not
-- a mass unit — untouched by the gram constraint).
--
-- FK: athlete_id → public.athlete_profiles(id) (the sport-identity spine).
-- SECURITY: RLS enabled + forced + revoked from anon/authenticated on every table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · athlete_body_metrics — gram-native metrics time series (§1.1) ─────────
create table if not exists public.athlete_body_metrics (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athlete_profiles(id) on delete cascade,
  measured_on   date not null,
  body_mass_g   bigint not null,                    -- converted once at the boundary
  body_fat_pct  numeric check (body_fat_pct between 1 and 60),
  lean_mass_g   bigint generated always as
                  (round(body_mass_g * (1 - coalesce(body_fat_pct, 20) / 100))) stored,
  source        text not null default 'manual_checkin'
                  check (source in ('manual_checkin','intake','coach')),
  created_at    timestamptz not null default now(),
  unique (athlete_id, measured_on)                  -- current metrics = most recent row ≤ today
);

alter table public.athlete_body_metrics enable row level security;
alter table public.athlete_body_metrics force  row level security;
revoke all on table public.athlete_body_metrics from anon, authenticated;

comment on table public.athlete_body_metrics is
  'BBF Lab P1 · gram-native body-metrics ledger. body_mass_g BIGINT (converted once at intake); lean_mass_g STORED-generated (null body_fat_pct assumes 20%). Targets are reproducible from this table alone. Service-role only.';

-- ─── 2 · athlete_nutrition_targets_daily — THE nutrition contract (§1.4) ────────
-- One live row per (athlete, day) across all three tiers; supersede-in-place with
-- prior values folded into computation_trace.history[].
create table if not exists public.athlete_nutrition_targets_daily (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references public.athlete_profiles(id) on delete cascade,
  day                date not null,
  tier               text not null check (tier in ('foundation','performance','sovereign')),
  tdee_kcal          integer not null,
  protein_g          integer not null,             -- grams, integer, always
  carbs_g            integer not null,
  fat_g              integer not null,
  creatine_g         numeric,                       -- null unless atp_pc protocol active
  coefficients       jsonb not null,               -- { carb_coeff, protein_coeff, af, ... }
  day_type           text not null default 'standard' check (day_type in
                       ('standard','recovery_forced','heavy_predicted','refeed_eve',
                        'carb_load','post_heavy','taper','competition')),
  timing_plan        jsonb,                         -- Tier 3 only (§4.6 windows)
  computation_trace  jsonb not null,               -- inputs, clamps fired, fallback level
  computed_at        timestamptz not null default now(),
  unique (athlete_id, day)
);

alter table public.athlete_nutrition_targets_daily enable row level security;
alter table public.athlete_nutrition_targets_daily force  row level security;
revoke all on table public.athlete_nutrition_targets_daily from anon, authenticated;

create index if not exists idx_antd_athlete_day
  on public.athlete_nutrition_targets_daily (athlete_id, day desc);

comment on table public.athlete_nutrition_targets_daily is
  'BBF Lab P1 · the single daily nutrition contract (Foundation/Performance/Sovereign). All macros integer grams. UNIQUE(athlete_id, day) = one live contract; recomputes update in place and append to computation_trace.history[]. Service-role only.';

-- ─── 3 · nutrition_intake_log — grams in, graded, never fed back to targets (§2.3) ─
create table if not exists public.nutrition_intake_log (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references public.athlete_profiles(id) on delete cascade,
  day           date not null,
  meal_slot     text not null check (meal_slot in
                  ('breakfast','lunch','dinner','snack','pre','peri','post')),
  food_label    text not null,
  serving_g     integer not null,                   -- grams of food, integer
  protein_g     integer not null default 0,         -- grams of macro, integer
  carbs_g       integer not null default 0,
  fat_g         integer not null default 0,
  kcal          integer generated always as
                  (protein_g * 4 + carbs_g * 4 + fat_g * 9) stored,
  logged_at     timestamptz not null default now()
);

alter table public.nutrition_intake_log enable row level security;
alter table public.nutrition_intake_log force  row level security;
revoke all on table public.nutrition_intake_log from anon, authenticated;

create index if not exists idx_nil_athlete_day
  on public.nutrition_intake_log (athlete_id, day);

comment on table public.nutrition_intake_log is
  'BBF Lab P1 · gram-denominated intake ledger. Display/adherence math only — NEVER feeds back into the daily target (Tier 1 discipline). Collected from day one so Tier 3 Sovereign has history to eat. Service-role only.';
