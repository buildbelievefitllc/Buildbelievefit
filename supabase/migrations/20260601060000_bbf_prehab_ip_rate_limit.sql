-- ═══════════════════════════════════════════════════════════════
-- bbf-agentic-prehab · per-IP daily rate limiter
-- ───────────────────────────────────────────────────────────────
-- Parity with bbf_cardio_rate_limit (migration 20260601050000): closes the
-- token-burn exposure created when the admin-token gate was removed from the
-- now anon-key client-facing bbf-agentic-prehab endpoint.
--
-- NOTE: a uid-keyed bbf_prehab_rate_limit / bbf_prehab_rate_check already
-- exists (migration 20260529054053) but is unused by the function. This adds
-- the IP-keyed variant the edge fn actually enforces, matching cardio exactly.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bbf_prehab_ip_rate_limit (
  ip         text not null,
  day        date not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip, day)
);

alter table public.bbf_prehab_ip_rate_limit enable row level security;
-- Service-role only (the edge fn calls the RPC). No anon/auth policies.

create or replace function public.bbf_prehab_ip_rate_check(p_ip text, p_cap integer)
returns table(allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_day   date := (now() at time zone 'utc')::date;
begin
  insert into public.bbf_prehab_ip_rate_limit(ip, day, count, updated_at)
  values (p_ip, v_day, 1, now())
  on conflict (ip, day)
  do update set count = public.bbf_prehab_ip_rate_limit.count + 1, updated_at = now()
  returning count into v_count;
  allowed := (v_count <= p_cap);
  current_count := v_count;
  return next;
end;
$$;
