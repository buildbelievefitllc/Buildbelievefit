-- ═══════════════════════════════════════════════════════════════════════════
-- BRIEF 5 · Closed-Loop Intelligence — Monetization capture backbone
-- ───────────────────────────────────────────────────────────────────────────
-- Data-capture hooks for the monetization engine. ADDITIVE + service-role RLS.
-- Nothing here changes recommendation logic; the read interface is STAGED only.
--
--   • bbf_users.avatar         — denormalized marketing avatar (closed-loop key).
--   • bbf_conversions          — one row per fulfilled checkout, tagged to avatar.
--   • bbf_completion_events    — one row per completed Vault session (outcome row).
--   • bbf_normalize_avatar()   — raw Stripe metadata / tier → canonical avatar slug.
--   • bbf_capture_conversion() — idempotent conversion writer (stripe-webhook calls it).
--   • bbf_capture_completion() — AFTER-INSERT trigger on bbf_logs (exception-safe;
--                                can NEVER fail a workout write).
--   • bbf_monetization_metrics() — STAGED read interface for the orchestrator.
--                                  Granted to service_role only; NOT wired to any
--                                  caller / recommendation path.
--
-- Canonical avatars: student_athlete · driven_parent · momentum_builder · unspecified
-- RLS posture mirrors bbf_agent_runs (observability backbone): service_role only.
-- Idempotent: safe to re-apply (IF NOT EXISTS / CREATE OR REPLACE / DROP..CREATE).
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ─── Avatar normalization ───────────────────────────────────────────────────
-- Primary signal is the avatar string the funnel stamps into Stripe checkout
-- metadata; the tier heuristic is a weak secondary fallback so we attribute
-- rather than fabricate (unknowns stay 'unspecified', never a guessed avatar).
create or replace function public.bbf_normalize_avatar(p_raw text, p_tier text default null)
returns text
language plpgsql
immutable
as $$
declare
  r text := lower(coalesce(p_raw, ''));
  t text := lower(coalesce(p_tier, ''));
begin
  if r like '%student%' or r like '%athlete%' then return 'student_athlete'; end if;
  if r like '%parent%'  then return 'driven_parent'; end if;
  if r like '%momentum%' then return 'momentum_builder'; end if;

  -- Secondary heuristic from the purchased tier when metadata carried no avatar.
  if t in ('rising_athlete','youth_athlete',
           'kickstart_6wk_3x','kickstart_6wk_4x',
           'transformation_8wk_3x','transformation_8wk_4x',
           'sovereign_12wk_3x','sovereign_12wk_4x') then
    return 'student_athlete';
  end if;
  if t in ('momentum','catalyst','autonomous') then return 'momentum_builder'; end if;

  return 'unspecified';
end;
$$;

-- ─── Denormalized avatar on the user (closed-loop join key) ──────────────────
alter table public.bbf_users add column if not exists avatar text;

-- ─── bbf_conversions ────────────────────────────────────────────────────────
create table if not exists public.bbf_conversions (
  id           uuid primary key default gen_random_uuid(),
  occurred_at  timestamptz not null default now(),
  event_id     text unique,                              -- Stripe event id → idempotency
  session_id   text,
  user_id      uuid references public.bbf_users(id) on delete set null,
  email        text,
  tier         text,
  avatar       text not null default 'unspecified',
  avatar_raw   text,
  amount_cents integer,
  currency     text,
  new_user     boolean,
  source       text not null default 'stripe-webhook'
);
create index if not exists idx_bbf_conversions_avatar_time on public.bbf_conversions (avatar, occurred_at desc);
create index if not exists idx_bbf_conversions_tier_time   on public.bbf_conversions (tier, occurred_at desc);
create index if not exists idx_bbf_conversions_user        on public.bbf_conversions (user_id);

alter table public.bbf_conversions enable row level security;
drop policy if exists "bbf_conversions_service_only" on public.bbf_conversions;
create policy "bbf_conversions_service_only" on public.bbf_conversions
  for all to service_role using (true) with check (true);

-- ─── bbf_completion_events ──────────────────────────────────────────────────
create table if not exists public.bbf_completion_events (
  id                uuid primary key default gen_random_uuid(),
  occurred_at       timestamptz not null default now(),
  user_id           uuid not null references public.bbf_users(id) on delete cascade,
  log_id            uuid references public.bbf_logs(id) on delete set null,
  session_date      date,
  avatar            text not null default 'unspecified',
  subscription_tier text,
  source            text not null default 'vault-session'
);
create index if not exists idx_bbf_completion_avatar_time on public.bbf_completion_events (avatar, occurred_at desc);
create index if not exists idx_bbf_completion_user_time   on public.bbf_completion_events (user_id, occurred_at desc);

alter table public.bbf_completion_events enable row level security;
drop policy if exists "bbf_completion_events_service_only" on public.bbf_completion_events;
create policy "bbf_completion_events_service_only" on public.bbf_completion_events
  for all to service_role using (true) with check (true);

-- ─── Conversion capture (idempotent) — called by stripe-webhook ─────────────
-- Best-effort by contract: the webhook wraps the call so a failure here can
-- never block payment fulfillment. on conflict (event_id) makes Stripe retries
-- a no-op. Resolves user_id from email when the caller did not supply one.
create or replace function public.bbf_capture_conversion(
  p_event_id     text,
  p_session_id   text,
  p_user_id      uuid,
  p_email        text,
  p_tier         text,
  p_avatar_raw   text,
  p_amount_cents integer,
  p_currency     text,
  p_new_user     boolean
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_avatar text;
  v_email  text := lower(nullif(trim(p_email), ''));
  v_uid    uuid := p_user_id;
  v_id     uuid;
begin
  v_avatar := public.bbf_normalize_avatar(p_avatar_raw, p_tier);

  if v_uid is null and v_email is not null then
    select id into v_uid from public.bbf_users
     where email = v_email and deleted_at is null
     limit 1;
  end if;

  insert into public.bbf_conversions
    (event_id, session_id, user_id, email, tier, avatar, avatar_raw, amount_cents, currency, new_user)
  values
    (p_event_id, p_session_id, v_uid, v_email, p_tier, v_avatar,
     nullif(trim(p_avatar_raw), ''), p_amount_cents, nullif(trim(p_currency), ''), p_new_user)
  on conflict (event_id) do nothing
  returning id into v_id;

  -- Denormalize the avatar onto the user so completion events can join to it.
  if v_uid is not null and v_avatar <> 'unspecified' then
    update public.bbf_users set avatar = v_avatar where id = v_uid;
  end if;

  return json_build_object('ok', true, 'avatar', v_avatar,
                           'inserted', v_id is not null, 'conversion_id', v_id);
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

-- ─── Completion capture — exception-safe AFTER INSERT trigger on bbf_logs ────
-- The real completion write-path is bbf_sync_vault_session → INSERT bbf_logs.
-- A data-layer trigger captures EVERY completion regardless of caller, and the
-- inner block swallows all errors so analytics can never roll back a session.
create or replace function public.bbf_capture_completion()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_avatar text;
  v_tier   text;
begin
  begin
    select coalesce(avatar, 'unspecified'), subscription_tier
      into v_avatar, v_tier
      from public.bbf_users
     where id = NEW.user_id;

    insert into public.bbf_completion_events (user_id, log_id, session_date, avatar, subscription_tier)
    values (NEW.user_id, NEW.id, NEW.date, coalesce(v_avatar, 'unspecified'), v_tier);
  exception when others then
    null; -- never let analytics capture break a workout write
  end;
  return NEW;
end;
$$;

drop trigger if exists bbf_capture_completion_trg on public.bbf_logs;
create trigger bbf_capture_completion_trg
  after insert on public.bbf_logs
  for each row execute function public.bbf_capture_completion();

-- ─── STAGED read interface (orchestrator — later). NOT wired anywhere. ──────
-- Returns the three monetization metric families. Granted to service_role only
-- and called by NOTHING in this migration — the boundary is exposed, not used.
create or replace function public.bbf_monetization_metrics(p_days integer default 30)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_days  integer := greatest(1, least(365, coalesce(p_days, 30)));
  v_since timestamptz := now() - (v_days || ' days')::interval;
  v_out   json;
begin
  select json_build_object(
    'ok', true,
    'generated_at', now(),
    'window_days', v_days,

    -- Conversion by avatar.
    'conversions_by_avatar', coalesce((
      select json_agg(row_to_json(c)) from (
        select avatar,
               count(*)                              as conversions,
               count(*) filter (where new_user)      as new_users,
               coalesce(sum(amount_cents), 0)        as gross_cents
        from public.bbf_conversions
        where occurred_at >= v_since
        group by avatar
        order by conversions desc
      ) c), '[]'::json),

    -- Workout completion rates by avatar.
    'completion_rates', coalesce((
      select json_agg(row_to_json(r)) from (
        select avatar,
               count(*)                                                      as sessions,
               count(distinct user_id)                                       as active_users,
               round(count(*)::numeric / nullif(count(distinct user_id), 0), 2) as sessions_per_user
        from public.bbf_completion_events
        where occurred_at >= v_since
        group by avatar
        order by sessions desc
      ) r), '[]'::json),

    -- Strength deltas by avatar (first → latest working weight per lift).
    'strength_deltas', coalesce((
      select json_agg(row_to_json(d)) from (
        select coalesce(u.avatar, 'unspecified')                   as avatar,
               round(avg(s.latest_w - s.first_w)::numeric, 1)      as avg_strength_delta_lbs,
               count(*)                                            as tracked_lifts
        from (
          select sd.user_id, sd.exercise_key,
                 (array_agg(sd.weight_lbs order by sd.d asc))[1]  as first_w,
                 (array_agg(sd.weight_lbs order by sd.d desc))[1] as latest_w
          from (
            select bl.user_id, bs.exercise_key, bl.date as d, bs.weight_lbs
            from public.bbf_sets bs
            join public.bbf_logs bl on bl.id = bs.log_id
            where bs.weight_lbs is not null
              and bs.exercise_key is not null
              and bl.date >= v_since::date
          ) sd
          group by sd.user_id, sd.exercise_key
          having count(*) >= 2
        ) s
        join public.bbf_users u on u.id = s.user_id
        group by coalesce(u.avatar, 'unspecified')
        order by tracked_lifts desc
      ) d), '[]'::json)
  ) into v_out;

  return v_out;
exception when others then
  return json_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.bbf_monetization_metrics(integer) from public;
grant execute on function public.bbf_monetization_metrics(integer) to service_role;
