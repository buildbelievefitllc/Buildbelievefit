alter table public.bbf_active_clients drop column if exists liability_agreement;
alter table public.bbf_meal_macros   drop column if exists ingredients_hash;
alter table public.bbf_stripe_events drop column if exists received_at;
alter table public.bbf_users         drop column if exists last_login;
alter table public.bbf_vapi_calls    drop column if exists vapi_call_id;