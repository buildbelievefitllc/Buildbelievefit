-- ═══════════════════════════════════════════════════════════════════════════
-- DRIFT-CLOSURE SNAPSHOT — Vanguard Blueprint generation-token ledger
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️ THIS OBJECT SET ALREADY EXISTS IN PRODUCTION. It was applied out-of-band and
-- was NEVER committed to git — exactly the kind of repo↔prod divergence DATABASE_
-- SAFETY.md warns about ("~33 migrations exist in production but were never committed
-- to git — the repo cannot rebuild the database"). This file is a FAITHFUL SNAPSHOT
-- of the live definitions (captured verbatim via pg_get_functiondef + the catalog on
-- 2026-07-19), committed so the repo finally documents what is live.
--
-- It was NOT applied by the committing session — the objects were already present.
-- Every statement is idempotent (IF NOT EXISTS / CREATE OR REPLACE) so a future
-- rebuild-from-repo recreates the system without clobbering the live one. Do NOT run
-- `supabase db push` (forbidden here); if this ever needs (re)application, use the
-- apply_migration pathway only, and verify against the live catalog afterward.
--
-- WHAT IT IS: the per-athlete monthly "Master Program Generation Token" ledger for
-- the Blueprint micro-subs. Allotment is tier-derived (blueprint_pro → 3,
-- blueprint_basic / legacy blueprint → 1, everyone else → 1), self-seeds lazily on
-- first read/consume, and resets by UTC calendar month. Refills are idempotent by
-- Stripe event id. All access is via SECURITY DEFINER functions (RLS on, no policies
-- → no direct client reads/writes; the functions are the only doorway).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tables ──────────────────────────────────────────────────────────────────
create table if not exists public.bbf_blueprint_tokens (
  user_id           uuid    not null references public.bbf_users(id),
  period            text    not null,                      -- 'YYYY-MM' (UTC) reset key
  tokens_remaining  integer not null default 1,
  monthly_allotment integer not null default 1,
  updated_at        timestamptz not null default now(),
  constraint bbf_blueprint_tokens_pkey primary key (user_id)
);

create table if not exists public.bbf_blueprint_refill_events (
  event_id   text not null,                                -- Stripe event id (idempotency)
  user_id    uuid,
  tokens     integer,
  created_at timestamptz default now(),
  constraint bbf_blueprint_refill_events_pkey primary key (event_id)
);

-- RLS on, zero policies — the SECURITY DEFINER functions below are the ONLY access path.
alter table public.bbf_blueprint_tokens        enable row level security;
alter table public.bbf_blueprint_refill_events enable row level security;

-- ── Functions (verbatim from production) ────────────────────────────────────

-- Tier → monthly allotment.
create or replace function public._bbf_blueprint_allotment(p_user_id uuid)
 returns integer
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select case coalesce(
      (select subscription_tier from public.bbf_users where id = p_user_id and deleted_at is null), '')
    when 'blueprint_pro'   then 3
    when 'blueprint_basic' then 1
    when 'blueprint'       then 1   -- legacy standalone slug
    else 1                          -- every other standard client keeps the 1/mo baseline
  end;
$function$;

-- Consume one token (session-token authed). Seeds the monthly allotment lazily and
-- resets on a new UTC month. Returns { ok, remaining, allotment, period } | { ok:false, error }.
create or replace function public.bbf_consume_blueprint_token(p_session_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user_id   uuid;
  v_period    text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_allot     integer;
  v_remaining integer;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  v_allot := public._bbf_blueprint_allotment(v_user_id);

  insert into public.bbf_blueprint_tokens as t (user_id, period, tokens_remaining, monthly_allotment)
  values (v_user_id, v_period, v_allot, v_allot)
  on conflict (user_id) do update
    set tokens_remaining  = case when t.period = v_period then t.tokens_remaining else v_allot end,
        monthly_allotment = v_allot,   -- keep in sync with the current tier
        period = v_period,
        updated_at = now()
  returning tokens_remaining into v_remaining;

  if v_remaining <= 0 then
    return jsonb_build_object('ok', false, 'error', 'exhausted', 'remaining', 0, 'allotment', v_allot, 'period', v_period);
  end if;

  update public.bbf_blueprint_tokens
     set tokens_remaining = tokens_remaining - 1, updated_at = now()
   where user_id = v_user_id
   returning tokens_remaining into v_remaining;

  return jsonb_build_object('ok', true, 'remaining', v_remaining, 'allotment', v_allot, 'period', v_period);
end;
$function$;

-- Credit N tokens to a user (used by the idempotent refill wrapper below).
create or replace function public.bbf_credit_blueprint_tokens(p_user_id uuid, p_count integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_period    text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_allot     integer;
  v_remaining integer;
begin
  if p_user_id is null or p_count is null or p_count <= 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;
  v_allot := public._bbf_blueprint_allotment(p_user_id);

  insert into public.bbf_blueprint_tokens as t (user_id, period, tokens_remaining, monthly_allotment)
  values (p_user_id, v_period, v_allot + p_count, v_allot)
  on conflict (user_id) do update
    set tokens_remaining  = (case when t.period = v_period then t.tokens_remaining else v_allot end) + p_count,
        monthly_allotment = v_allot,
        period = v_period,
        updated_at = now()
  returning tokens_remaining into v_remaining;

  return jsonb_build_object('ok', true, 'remaining', v_remaining, 'credited', p_count, 'period', v_period);
end;
$function$;

-- Idempotent credit keyed by a Stripe event id (safe to call from webhook fulfillment;
-- a replay is a no-op). Records the refill in bbf_blueprint_refill_events.
create or replace function public.bbf_credit_blueprint_tokens_for_event(p_event_id text, p_user_id uuid, p_count integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_rows   integer;
  v_credit jsonb;
begin
  if p_event_id is null or p_user_id is null or p_count is null or p_count <= 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_args');
  end if;

  insert into public.bbf_blueprint_refill_events (event_id, user_id, tokens)
  values (p_event_id, p_user_id, p_count)
  on conflict (event_id) do nothing;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return jsonb_build_object('ok', true, 'replay', true, 'event_id', p_event_id);
  end if;

  v_credit := public.bbf_credit_blueprint_tokens(p_user_id, p_count);
  return v_credit || jsonb_build_object('replay', false, 'event_id', p_event_id);
end;
$function$;

-- Read the current balance (session-token authed) WITHOUT consuming. Reports the lazy
-- allotment for an unseeded / stale-period athlete so a fresh Blueprint buyer always
-- shows their monthly tokens even before the first consume.
create or replace function public.bbf_get_blueprint_tokens(p_session_token text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user_id    uuid;
  v_period     text := to_char((now() at time zone 'utc'), 'YYYY-MM');
  v_allot      integer;
  v_remaining  integer;
  v_row_period text;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then return jsonb_build_object('ok', false, 'error', 'invalid_session'); end if;
  v_allot := public._bbf_blueprint_allotment(v_user_id);

  select tokens_remaining, period into v_remaining, v_row_period
    from public.bbf_blueprint_tokens where user_id = v_user_id;

  if not found or v_row_period is distinct from v_period then
    return jsonb_build_object('ok', true, 'remaining', v_allot, 'allotment', v_allot, 'period', v_period, 'seeded', false);
  end if;
  return jsonb_build_object('ok', true, 'remaining', v_remaining, 'allotment', v_allot, 'period', v_period, 'seeded', true);
end;
$function$;
