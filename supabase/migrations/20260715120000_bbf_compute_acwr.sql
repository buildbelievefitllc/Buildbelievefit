-- In-House Equity Mandate · deterministic ACWR (zero API cost)
-- ----------------------------------------------------------------------------
-- bbf_compute_acwr(p_athlete_id UUID) computes the athlete's Acute:Chronic
-- Workload Ratio from the Foster session-load method, entirely in Postgres.
--
--   Daily load   = duration_minutes * srpe_intensity   (bbf_athlete_load_logs)
--   Acute EWMA   = N=7  days,  alpha = 0.25    (decay (1-alpha) = 0.75)
--   Chronic EWMA = N=28 days,  alpha = 0.0689  (decay (1-alpha) = 0.9311)
--   ACWR         = acute / chronic  (returns 0 when chronic = 0 — no div/0)
--
-- The daily series is made GAPLESS with generate_series + ROW_NUMBER() so a day
-- with no training contributes a genuine 0 load (not a skipped row), which is
-- what keeps the exponential decay honest. EWMA here is the decay-weighted mean
-- (weight = decay^days_ago), so acute and chronic are on the same daily-load
-- scale and the ratio is a true ACWR. No AI, no external call, no rented compute.
-- ----------------------------------------------------------------------------

create or replace function public.bbf_compute_acwr(p_athlete_id uuid)
returns table (
  athlete_id     uuid,
  acute_ewma     numeric,
  chronic_ewma   numeric,
  acwr           numeric,
  computed_at    timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with anchor as (
    -- Anchor the window on the more recent of today / the last logged session,
    -- so an athlete whose latest data is a few days stale still resolves.
    select greatest(
             current_date,
             coalesce((select max(session_timestamp)::date
                         from public.bbf_athlete_load_logs
                        where athlete_id = p_athlete_id), current_date)
           ) as anchor_day
  ),
  calendar as (
    -- Gapless 28-day daily spine (chronic window is the widest we need).
    select
      d::date                                   as day,
      (a.anchor_day - d::date)                  as days_ago,
      row_number() over (order by d::date)      as rn
    from anchor a,
         generate_series(a.anchor_day - interval '27 days', a.anchor_day, interval '1 day') d
  ),
  daily_load as (
    select
      l.session_timestamp::date as day,
      sum(coalesce(l.duration_minutes, 0)::numeric
        * coalesce(l.srpe_intensity, 0)::numeric) as load_au
    from public.bbf_athlete_load_logs l,
         anchor a
    where l.athlete_id = p_athlete_id
      and l.session_timestamp::date between a.anchor_day - interval '27 days'
                                        and a.anchor_day
    group by 1
  ),
  series as (
    select c.day, c.days_ago, c.rn, coalesce(dl.load_au, 0) as load_au
    from calendar c
    left join daily_load dl on dl.day = c.day
  ),
  acute as (
    -- last 7 gapless days (days_ago 0..6), decay 0.75
    select sum(load_au * power(0.75, days_ago))
         / nullif(sum(power(0.75, days_ago)), 0) as ewma
    from series
    where days_ago <= 6
  ),
  chronic as (
    -- full 28 gapless days, decay 0.9311
    select sum(load_au * power(0.9311, days_ago))
         / nullif(sum(power(0.9311, days_ago)), 0) as ewma
    from series
  )
  select
    p_athlete_id,
    round(coalesce(a.ewma, 0), 2)                                   as acute_ewma,
    round(coalesce(c.ewma, 0), 2)                                   as chronic_ewma,
    case
      when coalesce(c.ewma, 0) = 0 then 0::numeric                  -- div/0 guard
      else round(coalesce(a.ewma, 0) / c.ewma, 3)
    end                                                             as acwr,
    now()                                                           as computed_at
  from acute a, chronic c;
$$;

comment on function public.bbf_compute_acwr(uuid) is
  'In-House Equity · deterministic Foster-load ACWR (duration*sRPE, acute EWMA N=7 a=0.25, chronic N=28 a=0.0689, gapless). Zero API cost. Div-safe (0 when chronic=0).';

-- Coach console / edge functions call this; service_role already bypasses RLS,
-- authenticated (admin console) gets explicit execute.
grant execute on function public.bbf_compute_acwr(uuid) to authenticated, service_role;
