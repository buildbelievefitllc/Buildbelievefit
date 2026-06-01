-- ═══════════════════════════════════════════════════════════════════════
-- Phase 0.2 · Observability backbone.
-- ───────────────────────────────────────────────────────────────────────
-- Two tables · one row per agent invocation, one row per LLM call.
-- Every agent (marketing scout/analyst/dispatcher/triage/unsubscribe,
-- the orchestrator, and any future edge function) writes to both. The
-- /api/v1/marketing/telemetry route aggregates them; Phase 1.4 builds
-- the cost-ceiling alert on top of bbf_llm_calls.
--
-- RUN CORRELATION · run_id is a shared string across all rows produced
-- by a single orchestrator pass · lets us answer "what did the 14:00 UTC
-- run on 2026-05-25 actually do?" with one WHERE clause.
--
-- RLS · service_role only. Admin telemetry route reads via service-role
-- client; no public surface area on these tables.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── bbf_agent_runs ───────────────────────────────────────────────────
create table if not exists public.bbf_agent_runs (
  id           uuid primary key default gen_random_uuid(),
  agent        text not null,
  run_id       text,
  source       text,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  duration_ms  integer,
  ok           boolean,
  error        text,
  summary      jsonb not null default '{}'::jsonb
);

create index if not exists idx_bbf_agent_runs_agent_started
  on public.bbf_agent_runs (agent, started_at desc);

create index if not exists idx_bbf_agent_runs_run_id
  on public.bbf_agent_runs (run_id)
  where run_id is not null;

create index if not exists idx_bbf_agent_runs_started
  on public.bbf_agent_runs (started_at desc);

alter table public.bbf_agent_runs enable row level security;

drop policy if exists "bbf_agent_runs_service_only" on public.bbf_agent_runs;
create policy "bbf_agent_runs_service_only"
  on public.bbf_agent_runs for all
  to service_role
  using (true)
  with check (true);

-- ─── bbf_llm_calls ────────────────────────────────────────────────────
create table if not exists public.bbf_llm_calls (
  id              uuid primary key default gen_random_uuid(),
  agent           text not null,
  run_id          text,
  provider        text,
  model           text not null,
  prompt_name     text,
  prompt_version  integer,
  input_tokens    integer,
  output_tokens   integer,
  cost_usd        numeric(12, 6),
  latency_ms      integer,
  finish_reason   text,
  ok              boolean,
  error           text,
  ts              timestamptz not null default now()
);

create index if not exists idx_bbf_llm_calls_agent_ts
  on public.bbf_llm_calls (agent, ts desc);

create index if not exists idx_bbf_llm_calls_provider_ts
  on public.bbf_llm_calls (provider, ts desc);

create index if not exists idx_bbf_llm_calls_run_id
  on public.bbf_llm_calls (run_id)
  where run_id is not null;

create index if not exists idx_bbf_llm_calls_ts
  on public.bbf_llm_calls (ts desc);

alter table public.bbf_llm_calls enable row level security;

drop policy if exists "bbf_llm_calls_service_only" on public.bbf_llm_calls;
create policy "bbf_llm_calls_service_only"
  on public.bbf_llm_calls for all
  to service_role
  using (true)
  with check (true);