create extension if not exists pgcrypto;

create table if not exists public.bbf_outbound_athletes (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  athlete_name        text not null,
  email               text not null unique,
  discipline          text,
  public_profile_url  text,
  performance_notes   text,
  personalized_pitch  text,
  status              text not null default 'raw'
    check (status in ('raw','analyzed','contacted','replied','converted','bounced','unsubscribed')),
  intent              text
    check (intent is null or intent in ('interested','not_interested','support')),
  resend_message_id   text,
  draft_reply         text,
  unsubscribe_token   text unique default replace(gen_random_uuid()::text, '-', ''),
  contacted_at        timestamptz,
  replied_at          timestamptz,
  unsubscribed_at     timestamptz,
  last_error          text
);

create index if not exists idx_bbf_outbound_athletes_status            on public.bbf_outbound_athletes (status);
create index if not exists idx_bbf_outbound_athletes_intent            on public.bbf_outbound_athletes (intent)            where intent is not null;
create index if not exists idx_bbf_outbound_athletes_unsubscribe_token on public.bbf_outbound_athletes (unsubscribe_token) where unsubscribe_token is not null;

create or replace function public.bbf_outbound_athletes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bbf_outbound_athletes_touch on public.bbf_outbound_athletes;
create trigger trg_bbf_outbound_athletes_touch
  before update on public.bbf_outbound_athletes
  for each row execute function public.bbf_outbound_athletes_touch_updated_at();

alter table public.bbf_outbound_athletes enable row level security;

drop policy if exists "bbf_outbound_athletes_service_only" on public.bbf_outbound_athletes;
create policy "bbf_outbound_athletes_service_only"
  on public.bbf_outbound_athletes for all
  to service_role
  using (true)
  with check (true);