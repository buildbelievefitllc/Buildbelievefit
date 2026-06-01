begin;

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