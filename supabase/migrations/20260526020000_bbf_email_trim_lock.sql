-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6.0g · Email TRIM lock · DRAFTED (NOT YET APPLIED)
-- ───────────────────────────────────────────────────────────────────────
-- Strengthens the Phase 2.4/6.0b lowercase-email CHECK constraints by
-- adding TRIM enforcement at the engine level. Without TRIM, an
-- accidental leading/trailing space ('  user@x.com  ') would slip past
-- the existing CHECK because LOWER('  user@x.com  ') = '  user@x.com  '
-- still satisfies col = LOWER(col). The app layer already calls
-- .trim().toLowerCase() at all 18 documented sites (Phase 6.0b audit),
-- so this is engine-level defense-in-depth · belt to the suspenders.
--
-- TWO-STAGE LIKE PHASE 2.4:
--   1. UPDATE every existing row to LOWER(TRIM(...)) form (no-op on
--      clean data · Phase 6.0g pre-flight probe confirmed 0 whitespace
--      anomalies across all 10 columns as of 2026-05-26).
--   2. DROP the existing LOWER-only CHECK + ADD a new
--      CHECK (col = LOWER(TRIM(col))) constraint per column. Same
--      constraint NAME so any external migration referencing it by
--      identifier stays valid.
--
-- DATA STATE AT MIGRATION TIME (verified 2026-05-26):
--   Pre-flight probe executed against project ihclbceghxpuawymlvgi via
--   mcp__supabase__execute_sql · every one of the 10 in-scope columns
--   reports zero rows where col <> TRIM(col):
--     bbf_active_clients.client_email   = 0
--     bbf_active_clients.vault_email    = 0
--     bbf_email_events.email            = 0
--     bbf_email_suppression.email       = 0
--     bbf_lead_actions.lead_email       = 0
--     bbf_leads.email                   = 0
--     bbf_outbound_athletes.email       = 0
--     bbf_stripe_events.email           = 0
--     bbf_users.email                   = 0
--     bbf_vapi_calls.client_email       = 0
--   The UPDATE statements below are no-ops on today's data; they stay
--   as a defensive guard so a re-run on a forked / imported dataset
--   normalizes before the stricter CHECK locks.
--
-- FK SAFETY (bbf_vapi_calls.client_email -> bbf_active_clients.client_email):
--   Same posture as Phase 2.4 · child first, parent second. The FK is
--   NOT deferrable and uses ON UPDATE NO ACTION · today's data is in
--   sync so the parent UPDATE is a no-op. If a future re-run encounters
--   dirty data, the order below means a mismatch surfaces on the child
--   UPDATE with a clean FK-violation diagnostic.
--
-- DEPLOY POSTURE · DRAFTED, NOT APPLIED.
--   Per PASSOVER §4 #4 destructive DDL is committed first and applied
--   only on explicit operator go-signal. This file is committed to the
--   repository as a queued artifact · the operator must explicitly
--   request `mcp__supabase__apply_migration` invocation before the
--   contents reach the live database. Until then, the existing
--   Phase 2.4/6.0b LOWER-only CHECKs remain in force and the app-layer
--   .trim().toLowerCase() sanitizers keep whitespace out at the
--   ingestion boundary.
--
-- IN-SCOPE COLUMNS (10):
--   bbf_active_clients.client_email
--   bbf_active_clients.vault_email
--   bbf_email_events.email
--   bbf_email_suppression.email
--   bbf_lead_actions.lead_email
--   bbf_leads.email
--   bbf_outbound_athletes.email
--   bbf_stripe_events.email
--   bbf_users.email
--   bbf_vapi_calls.client_email
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Normalize every existing row (no-op on today's data) ────────────
-- Child first (bbf_vapi_calls), then parent (bbf_active_clients) so the
-- FK chain stays consistent if future data drifts.

update public.bbf_vapi_calls
   set client_email = lower(trim(client_email))
 where client_email is not null and client_email <> lower(trim(client_email));

update public.bbf_active_clients
   set client_email = lower(trim(client_email))
 where client_email is not null and client_email <> lower(trim(client_email));

update public.bbf_active_clients
   set vault_email = lower(trim(vault_email))
 where vault_email is not null and vault_email <> lower(trim(vault_email));

update public.bbf_email_events
   set email = lower(trim(email))
 where email is not null and email <> lower(trim(email));

update public.bbf_email_suppression
   set email = lower(trim(email))
 where email <> lower(trim(email));

update public.bbf_lead_actions
   set lead_email = lower(trim(lead_email))
 where lead_email <> lower(trim(lead_email));

update public.bbf_leads
   set email = lower(trim(email))
 where email <> lower(trim(email));

update public.bbf_outbound_athletes
   set email = lower(trim(email))
 where email <> lower(trim(email));

update public.bbf_stripe_events
   set email = lower(trim(email))
 where email is not null and email <> lower(trim(email));

update public.bbf_users
   set email = lower(trim(email))
 where email is not null and email <> lower(trim(email));

-- ─── 2. Replace LOWER-only CHECKs with LOWER+TRIM CHECKs ────────────────
-- Single ALTER TABLE per relation so DROP + ADD are atomic · same
-- constraint name preserved · NULL handling preserved exactly as it
-- existed pre-Phase 6.0g (some columns are NOT NULL by virtue of PK
-- or NOT NULL constraint, so the IS NULL guard is harmless either way).

alter table public.bbf_active_clients
  drop constraint if exists bbf_active_clients_client_email_lowercase_chk,
  add  constraint bbf_active_clients_client_email_lowercase_chk
  check (client_email is null or client_email = lower(trim(client_email)));

alter table public.bbf_active_clients
  drop constraint if exists bbf_active_clients_vault_email_lowercase_chk,
  add  constraint bbf_active_clients_vault_email_lowercase_chk
  check (vault_email is null or vault_email = lower(trim(vault_email)));

alter table public.bbf_email_events
  drop constraint if exists bbf_email_events_email_lowercase_chk,
  add  constraint bbf_email_events_email_lowercase_chk
  check (email is null or email = lower(trim(email)));

alter table public.bbf_email_suppression
  drop constraint if exists bbf_email_suppression_email_check,
  add  constraint bbf_email_suppression_email_check
  check (email = lower(trim(email)));

alter table public.bbf_lead_actions
  drop constraint if exists bbf_lead_actions_lead_email_lowercase_chk,
  add  constraint bbf_lead_actions_lead_email_lowercase_chk
  check (lead_email = lower(trim(lead_email)));

alter table public.bbf_leads
  drop constraint if exists bbf_leads_email_lowercase_chk,
  add  constraint bbf_leads_email_lowercase_chk
  check (email = lower(trim(email)));

alter table public.bbf_outbound_athletes
  drop constraint if exists bbf_outbound_athletes_email_lowercase_chk,
  add  constraint bbf_outbound_athletes_email_lowercase_chk
  check (email = lower(trim(email)));

alter table public.bbf_stripe_events
  drop constraint if exists bbf_stripe_events_email_lowercase_chk,
  add  constraint bbf_stripe_events_email_lowercase_chk
  check (email is null or email = lower(trim(email)));

alter table public.bbf_users
  drop constraint if exists bbf_users_email_lowercase_chk,
  add  constraint bbf_users_email_lowercase_chk
  check (email is null or email = lower(trim(email)));

alter table public.bbf_vapi_calls
  drop constraint if exists bbf_vapi_calls_client_email_lowercase_chk,
  add  constraint bbf_vapi_calls_client_email_lowercase_chk
  check (client_email is null or client_email = lower(trim(client_email)));

commit;
