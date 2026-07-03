-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 3/6 — WORKLOAD & RECOVERY ("Ball on a String")
-- ───────────────────────────────────────────────────────────────────────────
-- Source: PREHAB_RECOVERY_CLOSED_LOOP_BLUEPRINT §1.4 (athlete_workload_daily),
--         §2.5 (prehab_queue), §3.4 (athlete_recovery_state).
--
-- THE GRAM STANDARD (§0.1): tonnage_g BIGINT (Σ reps × effective_load_g); strain
-- is gram-effort units (AU). Pounds live only at the legacy write boundary; every
-- ledger here is grams or gram-derived.
--
-- SINGLE WRITER: the bbf-workload-sentinel edge fn is the only writer of these
-- three tables (UNIQUE constraints are the idempotency keys). Surfaces read + flip
-- status only — no write cycles, fail-open by construction.
--
-- FK: athlete_id → public.athlete_profiles(id).
-- SECURITY: RLS enabled + forced + revoked from anon/authenticated on every table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · athlete_workload_daily — the daily workload ledger, per load vector (§1.4)
-- One row per (athlete, day, vector) + a 'total' vector row. EWMA / ACWR / Foster
-- monotony roll forward here.
create table if not exists public.athlete_workload_daily (
  id                uuid primary key default gen_random_uuid(),
  athlete_id        uuid not null references public.athlete_profiles(id) on delete cascade,
  day               date not null,
  load_vector       text not null check (load_vector in
                      ('axial','knee_dominant','hip_hinge','shoulder_load',
                       'elbow_load','impact','total')),
  tonnage_g         bigint  not null default 0,     -- Σ reps × effective_load_g (gram-pure)
  strain_au         numeric not null default 0,     -- Σ set_strain_au × coeff
  set_count         integer not null default 0,
  rep_count         integer not null default 0,
  mean_rpe          numeric,
  ewma_acute_au     numeric,                         -- 7-day EWMA of strain_au
  ewma_chronic_au   numeric,                         -- 28-day EWMA of strain_au
  acwr              numeric,                         -- ewma_acute / ewma_chronic
  monotony          numeric,                         -- Foster: 7d mean / 7d stddev
  weekly_strain_au  numeric,                         -- Foster: 7d Σ strain × monotony
  computed_at       timestamptz not null default now(),
  unique (athlete_id, day, load_vector)
);

alter table public.athlete_workload_daily enable row level security;
alter table public.athlete_workload_daily force  row level security;
revoke all on table public.athlete_workload_daily from anon, authenticated;

create index if not exists idx_awd_athlete_day
  on public.athlete_workload_daily (athlete_id, day desc);

comment on table public.athlete_workload_daily is
  'BBF Lab P1 · per-(athlete,day,vector) workload substrate. tonnage_g BIGINT gram-pure. EWMA acute/chronic → ACWR, Foster monotony/strain. Written only by bbf-workload-sentinel. Service-role only.';

-- ─── 2 · prehab_queue — the predictive preservation queue (§2.5) ───────────────
create table if not exists public.prehab_queue (
  id              uuid primary key default gen_random_uuid(),
  athlete_id      uuid not null references public.athlete_profiles(id) on delete cascade,
  scheduled_for   date not null,
  joint_zone      text not null check (joint_zone in
                    ('shoulder','knee','lower_back','elbow','hamstring','ankle',
                     'hip','wrist','neck','groin','full_body')),
  priority        text not null check (priority in ('mandatory','strong','advisory')),
  risk_score      numeric not null,
  trigger_reason  jsonb not null,     -- { acwr:{per vector}, spike, history:H_j, readiness, monotony, weights_version }
  protocol        jsonb not null,     -- 3-drill matrix, allow-listed drills only
  status          text not null default 'queued' check (status in
                    ('queued','served','completed','skipped','expired','superseded')),
  skip_reason     text,
  completed_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.prehab_queue enable row level security;
alter table public.prehab_queue force  row level security;
revoke all on table public.prehab_queue from anon, authenticated;

create index if not exists idx_pq_athlete_day
  on public.prehab_queue (athlete_id, scheduled_for, status);

comment on table public.prehab_queue is
  'BBF Lab P1 · predictive prehab queue (mandatory/strong/advisory). trigger_reason JSON is the full auditable ACWR/spike/history breakdown. Supersede-on-recompute; nightly sweep expires stale rows. Service-role only.';

-- ─── 3 · athlete_recovery_state — recovery-debt ledger, per muscle group (§3.4) ─
create table if not exists public.athlete_recovery_state (
  id                     uuid primary key default gen_random_uuid(),
  athlete_id             uuid not null references public.athlete_profiles(id) on delete cascade,
  day                    date not null,
  muscle_group           text not null,               -- BBF_RECOVERY_LIBRARY group keys
  debt_au                numeric not null default 0,
  debt_ratio             numeric,                     -- debt / chronic EWMA at compute time
  deposit_au             numeric not null default 0,  -- yesterday's session_strain share
  prep_variant           text not null default 'standard'
                           check (prep_variant in ('light','standard','standard_plus','deep')),
  recovery_shadow_until  timestamptz,                 -- 48h high-load shadow (§3.3)
  computed_at            timestamptz not null default now(),
  unique (athlete_id, day, muscle_group)
);

alter table public.athlete_recovery_state enable row level security;
alter table public.athlete_recovery_state force  row level security;
revoke all on table public.athlete_recovery_state from anon, authenticated;

create index if not exists idx_ars_athlete_day
  on public.athlete_recovery_state (athlete_id, day desc);

comment on table public.athlete_recovery_state is
  'BBF Lab P1 · per-(athlete,day,muscle_group) recovery-debt ledger (gram-effort AU). Deposits at floor sync, decays overnight by sleep-scaled half-life. Drives prep variant + the 48h recovery shadow. Service-role only.';
