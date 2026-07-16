-- Stateful Gap Analyzer — the Lead Ledger + prospect inbox linkage
-- ----------------------------------------------------------------------------
-- Turns the stateless Routine Interrogator into a stateful lead-capture engine.
-- Two changes:
--   (1) public.prospect_leads — the durable ledger of every audited prospect.
--   (2) public.coach_action_inbox — extend the (empty, pre-existing) agentic
--       inbox so a prospect card can exist WITHOUT an athlete_id.
--
-- SECURITY NOTE (deliberate deviation from the literal spec, house pattern):
-- prospect_leads is RLS-SEALED with service-role-only access — exactly like
-- public.bbf_leads. The bbf-agentic-interrogator edge function performs the
-- insert with the service role after a successful audit; the public browser
-- never writes the table directly. This is strictly safer than a raw `anon`
-- INSERT grant (which would be an open, unauthenticated spam endpoint) while
-- still letting public web traffic submit their program *through the function*.
-- Reads stay closed to anon/authenticated to prevent scraping.
-- ----------------------------------------------------------------------------

-- (1) The Lead Ledger ---------------------------------------------------------
create table if not exists public.prospect_leads (
  id                uuid primary key default gen_random_uuid(),
  name              text,
  contact_handle    text not null,                -- email, phone, or IG handle
  raw_workout_split text not null,
  gap_verdict       text,                         -- 'architect' | 'gateway'
  gap_report        jsonb not null,               -- { gaps, sovereign_contrast, verdict }
  created_at        timestamptz not null default now()
);

comment on table public.prospect_leads is
  'Routine Interrogator lead ledger. One row per audited prospect (raw split + structured Gemini gap report + tier verdict). RLS-sealed: service-role writes only (bbf-agentic-interrogator), no anon/authenticated read (anti-scrape).';

create index if not exists prospect_leads_created_idx on public.prospect_leads (created_at desc);

alter table public.prospect_leads enable row level security;
-- No anon/authenticated policies => full deny (mirrors bbf_leads). The edge
-- function's service-role key bypasses RLS for the insert.
revoke all on public.prospect_leads from anon, authenticated;

-- (2) Extend the pre-existing coach_action_inbox for prospect cards -----------
-- The table already exists (empty, unwired). A prospect is not an athlete yet,
-- so athlete_id must be nullable, and we add a typed link to the lead ledger.
alter table public.coach_action_inbox alter column athlete_id drop not null;
alter table public.coach_action_inbox add column if not exists prospect_id uuid
  references public.prospect_leads (id) on delete set null;

comment on column public.coach_action_inbox.prospect_id is
  'Set on NEW_PROSPECT cards — links the inbox card to its prospect_leads row (athlete_id is null for prospects).';

create index if not exists coach_action_inbox_type_status_idx
  on public.coach_action_inbox (type, status, created_at desc);

-- Defensive: keep the inbox RLS-sealed (service-role/admin-RPC access only).
alter table public.coach_action_inbox enable row level security;
revoke all on public.coach_action_inbox from anon, authenticated;
