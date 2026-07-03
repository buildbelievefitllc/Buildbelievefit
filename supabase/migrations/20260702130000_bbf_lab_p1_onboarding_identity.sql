-- ═══════════════════════════════════════════════════════════════════════════
-- BBF LAB · PHASE 1 · MIGRATION 1/6 — ONBOARDING & IDENTITY
-- ───────────────────────────────────────────────────────────────────────────
-- Source: ONBOARDING_STATE_MACHINE_BLUEPRINT §1.2 (bbf_pathfinder_intakes),
--         §3.1 (bbf_onboarding_pipeline), §1.4 (bbf_email_events dispatch queue).
--
-- THE GRAM BOUNDARY (§0.1): the Pathfinder questionnaire is the edge of the
-- system. Weight arrives in lb/kg at the UI, is converted INSIDE the submit RPC,
-- and is stored ONLY as body_mass_g BIGINT / height_mm INTEGER. No unit column
-- exists on the intake table — pounds/kilos die in the RPC's local scope.
--
-- SECURITY: every new table ships RLS enabled + forced + revoked from
-- anon/authenticated (zero policies → service-role-only, matching the live
-- bbf_cardio_prescription / bbf_sovereign_audio posture).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · bbf_pathfinder_intakes — the persisted questionnaire (intake edge) ────
create table if not exists public.bbf_pathfinder_intakes (
  id                 uuid primary key default gen_random_uuid(),
  email              text,                          -- captured pre-checkout when offered
  phone              text,                          -- optional; powers the SMS fallback (§1.5)
  -- THE GRAM BOUNDARY (no unit columns exist)
  body_mass_g        bigint,                        -- converted in the submit RPC (§0.1)
  height_mm          integer,                       -- in × 25.4 | cm × 10, integer mm
  body_fat_pct       numeric,                       -- optional; null → estimated later
  birth_year         smallint,                      -- Tanaka HR + tier heuristics
  -- training identity (feeds the cold-start cascade §2)
  goal               text,                          -- 'cut' | 'build' | 'performance' | ...
  training_days_wk   smallint,
  session_minutes    smallint,                      -- typical session length
  sport              text,
  position           text,                          -- nullable (adults often none)
  friction_flags     text[] not null default '{}',  -- 'knee_pain','low_back','shoulder',...
  dietary_profile    text,                          -- 'Omnivore'|'Vegetarian'|'Vegan'
  allergens          text[] not null default '{}',
  preferred_locale   text check (preferred_locale in ('en','es','pt')),
  recommended_tier   text,                          -- the [[RECOMMEND:x]] outcome
  session_id         text,                          -- pathfinder chat session (telemetry join)
  consumed_by_user   uuid,                          -- set when fulfillment claims it
  created_at         timestamptz not null default now()
);

alter table public.bbf_pathfinder_intakes enable row level security;
alter table public.bbf_pathfinder_intakes force  row level security;
revoke all on table public.bbf_pathfinder_intakes from anon, authenticated;

-- Fuzzy-fallback join support (§1.2): claim orphaned intakes by email, newest first.
create index if not exists idx_pathfinder_intakes_email_created
  on public.bbf_pathfinder_intakes (email, created_at desc)
  where email is not null and consumed_by_user is null;

comment on table public.bbf_pathfinder_intakes is
  'BBF Lab P1 · persisted Pathfinder questionnaire (the intake edge). Gram boundary: body_mass_g BIGINT / height_mm INTEGER only — no lb/kg columns exist. Its id rides checkout as client_reference_id; the fulfillment RPC claims it via consumed_by_user. Service-role only.';

-- ─── 2 · bbf_onboarding_pipeline — the account_status ledger (11-state machine) ─
create table if not exists public.bbf_onboarding_pipeline (
  id                   uuid primary key default gen_random_uuid(),
  checkout_session_id  text unique,                 -- idempotency anchor (Stripe)
  intake_id            uuid references public.bbf_pathfinder_intakes(id),
  user_id              uuid references public.bbf_users(id),
  email                text not null,
  tier                 text not null,
  state                text not null default 'paid' check (state in
                         ('paid','provisioned','cold_start_ready','cold_start_degraded',
                          'credentials_dispatched','dispatch_retrying','delivery_blocked',
                          'activated','needs_attention')),
  steps                jsonb not null default '{}',  -- cascade checklist (§3.1 shape)
  heal_attempts        integer not null default 0,
  failure_reason       text,
  state_entered_at     timestamptz not null default now(),   -- age-in-state timers (§3.4)
  activated_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table public.bbf_onboarding_pipeline enable row level security;
alter table public.bbf_onboarding_pipeline force  row level security;
revoke all on table public.bbf_onboarding_pipeline from anon, authenticated;

-- Onboarding board query path: live non-activated pipelines by state + age.
create index if not exists idx_obp_state on public.bbf_onboarding_pipeline
  (state, state_entered_at) where state <> 'activated';

comment on table public.bbf_onboarding_pipeline is
  'BBF Lab P1 · onboarding transactional state machine (11 states, terminal=activated). checkout_session_id is the Stripe idempotency anchor. steps JSONB is the cold-start cascade checklist; the gate verifies EXISTENCE of output rows, not step self-reports. Service-role only.';

-- ─── 3 · bbf_email_events (EXISTING) — grow the failure log into a dispatch queue ─
-- Live shape (20260525222843): id, message_id, email, event_type, ts, payload.
-- §1.4 appends the retry-queue spine columns. Idempotent (ADD COLUMN IF NOT EXISTS).
alter table public.bbf_email_events
  add column if not exists attempts        integer not null default 0,
  add column if not exists next_attempt_at timestamptz,
  add column if not exists channel         text not null default 'email'
                             check (channel in ('email','email_alt','sms')),
  add column if not exists provider_msg_id text;          -- Brevo message id → bounce join (§1.5)

-- Re-assert RLS on the altered table (order: every altered table ships RLS enabled).
alter table public.bbf_email_events enable row level security;

-- Retry sweeper index: rows due for another dispatch attempt.
create index if not exists idx_bbf_email_events_next_attempt
  on public.bbf_email_events (next_attempt_at)
  where next_attempt_at is not null;
