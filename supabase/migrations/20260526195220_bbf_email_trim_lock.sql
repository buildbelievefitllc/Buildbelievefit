-- Phase 6.0g · Email TRIM lock · APPLIED 2026-05-26

-- ─── 1. Normalize every existing row (no-op on today's data) ────────────
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