-- Front 2 · Coach HUD — surface each athlete's 30-Day Calibration day/phase on the
-- Founder Five master roster. Admin-gated (same _bbf_is_admin_session gate as the other
-- bbf_admin_* RPCs). Computed in SQL from bbf_active_clients.created_at (intake), matched
-- by email, honoring the GRANDFATHER epoch (mirrors frontend/src/lib/calibration.js): a
-- pre-deployment intake reads Sovereign regardless of raw age, so the coach HUD reflects
-- each athlete's REAL access state, never a misleading "Day 5". Returns bbf_users.id so
-- the frontend merges it onto the roster rows (the roster edge function is unchanged).
create or replace function public.bbf_admin_roster_calibration(p_session_token text)
returns table(id uuid, calibration_day int, calibration_phase text)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public._bbf_is_admin_session(p_session_token) then
    raise exception 'not_authorized';
  end if;

  return query
  with anchors as (
    select u.id,
           (select ac.created_at
              from public.bbf_active_clients ac
             where lower(ac.vault_email) = lower(u.email)
                or lower(ac.client_email) = lower(u.email)
             order by ac.created_at asc
             limit 1) as created_at
      from public.bbf_users u
     where u.deleted_at is null
  ),
  computed as (
    select a.id,
           case
             when a.created_at is null then null
             when a.created_at < timestamptz '2026-06-25 00:00:00+00' then null  -- grandfathered
             else greatest(1, floor(extract(epoch from (now() - a.created_at)) / 86400.0)::int + 1)
           end as day
      from anchors a
  )
  select c.id,
         c.day as calibration_day,
         case
           when c.day is null  then 'sovereign'   -- grandfathered / undatable → graduated
           when c.day >= 30    then 'sovereign'
           when c.day >= 15    then 'ignition'
           else                     'baseline'
         end as calibration_phase
    from computed c;
end;
$$;
revoke all on function public.bbf_admin_roster_calibration(text) from public;
grant execute on function public.bbf_admin_roster_calibration(text) to anon, authenticated, service_role;
