create table if not exists public.bbf_prehab_rate_limit (
  uid        text not null,
  day        date not null default (now() at time zone 'utc')::date,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (uid, day)
);

alter table public.bbf_prehab_rate_limit enable row level security;

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