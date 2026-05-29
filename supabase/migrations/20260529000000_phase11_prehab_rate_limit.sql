-- Phase 11 · bbf-agentic-prehab interim auth — per-uuid daily rate cap.
-- Applied to production 2026-05-29. Backs the abuse guard that replaces the
-- founder BBF_COACH_AGENT_TOKEN gate now that prehab is open to all client
-- tiers via the anon-key posture (full Supabase Auth / JWT migration = Phase 12).

create table if not exists public.bbf_prehab_rate_limit (
  uid        text not null,
  day        date not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (uid, day)
);

-- Internal table — service-role only. RLS on with no policies blocks anon/auth.
alter table public.bbf_prehab_rate_limit enable row level security;

-- Atomic increment + cap check. Returns whether this call is within the cap.
create or replace function public.bbf_prehab_rate_check(p_uid text, p_cap integer)
returns table(allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_day   date := (now() at time zone 'utc')::date;
begin
  insert into public.bbf_prehab_rate_limit(uid, day, count, updated_at)
  values (p_uid, v_day, 1, now())
  on conflict (uid, day)
  do update set count = public.bbf_prehab_rate_limit.count + 1, updated_at = now()
  returning count into v_count;
  allowed := (v_count <= p_cap);
  current_count := v_count;
  return next;
end;
$$;
