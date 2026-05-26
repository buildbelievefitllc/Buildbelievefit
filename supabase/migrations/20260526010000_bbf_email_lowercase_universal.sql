-- ═══════════════════════════════════════════════════════════════════════
-- Phase 2.4 · Universal lowercase email migration
-- ───────────────────────────────────────────────────────────────────────
-- Eliminates case-sensitivity authentication bypasses + profile-splitting
-- across every email column on every public.bbf_* table. Two-stage:
--   1. UPDATE every existing row to LOWER(...) form (atomic, single tx).
--   2. Add a permanent CHECK (col = LOWER(col)) constraint per column so
--      future writes can never re-introduce mixed case.
--
-- DATA STATE AT MIGRATION TIME (verified):
--   Every one of the 9 in-scope columns reports zero rows where
--   col <> LOWER(col). The UPDATE statements below are effectively
--   no-ops on today's data, but stay in the migration as a defensive
--   guard so re-running on a forked/imported dataset would normalize
--   it before locking the CHECK.
--
-- FK SAFETY (bbf_vapi_calls.client_email -> bbf_active_clients.client_email):
--   The FK is NOT deferrable and uses ON UPDATE NO ACTION. Since
--   parent + child are already in sync (both 100% lowercase today),
--   the parent UPDATE is a no-op so the FK never fires. If a future
--   re-run encounters dirty data, the order below (child first, then
--   parent) means a mismatch surfaces on the child UPDATE with a clear
--   FK-violation message pointing at the right table rather than a
--   silent cascade.
--
-- ALREADY-CONSTRAINED COLUMNS (not in scope):
--   bbf_email_suppression.email   · CHECK shipped in Phase 1.3
--     (20260525220000_bbf_email_suppression_and_events.sql).
--
-- IN-SCOPE COLUMNS (9):
--   bbf_active_clients.client_email
--   bbf_active_clients.vault_email
--   bbf_email_events.email
--   bbf_lead_actions.lead_email
--   bbf_leads.email
--   bbf_outbound_athletes.email
--   bbf_stripe_events.email
--   bbf_users.email
--   bbf_vapi_calls.client_email
--
-- OUT OF SCOPE (string columns that *contain* "email" in their name
-- but hold message content, not addresses):
--   bbf_lead_actions.email_body_preview
--   bbf_lead_actions.email_subject
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Normalize every existing row (no-op on clean data) ─────────────
-- Child first · parent second · keeps the FK chain consistent if data
-- ever drifts in the future.
update public.bbf_vapi_calls
   set client_email = lower(client_email)
 where client_email is not null and client_email <> lower(client_email);

update public.bbf_active_clients
   set client_email = lower(client_email)
 where client_email is not null and client_email <> lower(client_email);

update public.bbf_active_clients
   set vault_email = lower(vault_email)
 where vault_email is not null and vault_email <> lower(vault_email);

update public.bbf_email_events
   set email = lower(email)
 where email is not null and email <> lower(email);

update public.bbf_lead_actions
   set lead_email = lower(lead_email)
 where lead_email <> lower(lead_email);

update public.bbf_leads
   set email = lower(email)
 where email <> lower(email);

update public.bbf_outbound_athletes
   set email = lower(email)
 where email <> lower(email);

update public.bbf_stripe_events
   set email = lower(email)
 where email is not null and email <> lower(email);

update public.bbf_users
   set email = lower(email)
 where email is not null and email <> lower(email);

-- ─── 2. Permanent engine-level lock ────────────────────────────────────
-- CHECK constraint per column. NOT VALID is intentionally omitted so the
-- constraint validates existing data immediately · since the UPDATEs
-- above already normalized everything, validation passes in O(rows).

alter table public.bbf_active_clients
  add constraint bbf_active_clients_client_email_lowercase_chk
  check (client_email is null or client_email = lower(client_email));

alter table public.bbf_active_clients
  add constraint bbf_active_clients_vault_email_lowercase_chk
  check (vault_email is null or vault_email = lower(vault_email));

alter table public.bbf_email_events
  add constraint bbf_email_events_email_lowercase_chk
  check (email is null or email = lower(email));

alter table public.bbf_lead_actions
  add constraint bbf_lead_actions_lead_email_lowercase_chk
  check (lead_email = lower(lead_email));

alter table public.bbf_leads
  add constraint bbf_leads_email_lowercase_chk
  check (email = lower(email));

alter table public.bbf_outbound_athletes
  add constraint bbf_outbound_athletes_email_lowercase_chk
  check (email = lower(email));

alter table public.bbf_stripe_events
  add constraint bbf_stripe_events_email_lowercase_chk
  check (email is null or email = lower(email));

alter table public.bbf_users
  add constraint bbf_users_email_lowercase_chk
  check (email is null or email = lower(email));

alter table public.bbf_vapi_calls
  add constraint bbf_vapi_calls_client_email_lowercase_chk
  check (client_email is null or client_email = lower(client_email));

commit;
