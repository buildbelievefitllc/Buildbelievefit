-- ═══════════════════════════════════════════════════════════════
-- bbf-agentic-cardio · per-IP daily rate limiter
-- ───────────────────────────────────────────────────────────────
-- Mirrors the bbf_prehab_rate_limit architecture (migration
-- 20260529054053): a (key, day) counter table + a SECURITY DEFINER
-- RPC that atomically upserts/increments and returns (allowed, count).
--
-- Keyed on IP (not uid): bbf-agentic-cardio is anon-key client-facing,
-- so the body `uid` is caller-controlled and untrusted; IP is the
-- spoof-resistant throttle key until per-user auth.uid() ships. Caps
-- total Opus spend per source IP per UTC day — generous for genuine
-- athletes (a few protocols/day), hard ceiling for rapid-fire scripts.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.bbf_cardio_rate_limit (
  ip         text not null,
  day        date not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (ip, day)
);

alter table public.bbf_cardio_rate_limit enable row level security;
-- Service-role only (the edge fn calls the RPC). No anon/auth policies.

create or replace function public.bbf_cardio_rate_check(p_ip text, p_cap integer)
returns table(allowed boolean, current_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_day   date := (now() at time zone 'utc')::date;
begin
  insert into public.bbf_cardio_rate_limit(ip, day, count, updated_at)
  values (p_ip, v_day, 1, now())
  on conflict (ip, day)
  do update set count = public.bbf_cardio_rate_limit.count + 1, updated_at = now()
  returning count into v_count;
  allowed := (v_count <= p_cap);
  current_count := v_count;
  return next;
end;
$$;
