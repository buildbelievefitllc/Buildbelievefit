-- ═══════════════════════════════════════════════════════════════════════════
-- BBF Lab · Nutrition Daily Sync — the "Complete & Sync Protocol" commit
-- ───────────────────────────────────────────────────────────────────────────
-- Adds the missing nutrition SYNC RITUAL — parity with the workout / cardio
-- "Complete & Sync Protocol" moment. Meal tap-to-log was a silent per-card write
-- with no "day is done" commit; this finalizes the DAY: a deliberate fueling-
-- adherence snapshot the athlete syncs to their history, off which every readiness
-- surface rehydrates (the client fires the same PROTOCOL_UPDATED broadcast the
-- morning check-in and cardio sync use).
--
--   nutrition_daily_sync          — one committed adherence row per athlete-day
--   bbf_log_nutrition_adherence() — vault-token-gated commit: recomputes today's
--                                   adherence from nutrition_intake_log vs the
--                                   canonical daily target, upserts the snapshot,
--                                   returns the verdict.
--
-- DISCIPLINE (respected): this COMMITS + SURFACES adherence across the readiness
-- board; it does NOT rewrite the deterministic HRV readiness score in
-- bbf_daily_protocols. That morning verdict stays sacred — it regulates training
-- volume + HIIT locks app-wide, so it must not silently move because a client
-- under-logged dinner. Nutrition rides the same broadcast + ledger the score does,
-- so it is "collected across the board" without destabilizing global regulation.
-- Making prior-day fuel move the numeric score is a separate, conscious engine
-- change — and this table is the clean day-1 hook for it (read yesterday's row).
-- Idempotent: CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · the committed daily fueling-adherence snapshot ─────────────────────
create table if not exists public.nutrition_daily_sync (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references public.athlete_profiles(id) on delete cascade,
  day                 date not null,
  target_kcal         integer,
  consumed_kcal       integer not null default 0,
  kcal_pct            integer,
  target_protein_g    integer,
  consumed_protein_g  integer not null default 0,
  protein_pct         integer,
  target_carbs_g      integer,
  consumed_carbs_g    integer not null default 0,
  target_fat_g        integer,
  consumed_fat_g      integer not null default 0,
  meals_logged        integer not null default 0,
  synced_at           timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (athlete_id, day)
);

comment on table public.nutrition_daily_sync is
  'One committed daily fueling-adherence snapshot per athlete-day, written by the Nutrition tab "Complete & Sync Protocol" ritual (bbf_log_nutrition_adherence). Parity with the workout/cardio sync. History + readiness-board broadcast; does NOT feed the HRV readiness score (Tier-1 discipline) — a clean day-1 hook for a future engine fueling axis.';

alter table public.nutrition_daily_sync enable row level security;
alter table public.nutrition_daily_sync force row level security;
-- No policies: service-role / SECURITY DEFINER RPC only (mirrors nutrition_intake_log).

-- ─── 2 · the commit RPC — recompute + upsert + return the verdict ───────────
create or replace function public.bbf_log_nutrition_adherence(
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_user_id    uuid;
  v_profile_id uuid;
  v_day        date := (now() at time zone 'utc')::date;
  v_t_kcal integer; v_t_pro integer; v_t_car integer; v_t_fat integer;
  v_c_kcal integer; v_c_pro integer; v_c_car integer; v_c_fat integer;
  v_meals  integer;
  v_kcal_pct integer; v_pro_pct integer;
  v_synced timestamptz;
begin
  -- Authorize purely on the bearer token (mirror bbf_nutrition_today).
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u
      on u.id = s.user_id
     and u.deleted_at is null
     and u.access_status is distinct from 'locked'
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;

  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  -- Earliest athlete profile; nutrition keys on it.
  select p.id into v_profile_id
    from public.athlete_profiles p
   where p.user_id = v_user_id
   order by p.created_at asc
   limit 1;

  if v_profile_id is null then
    return json_build_object('ok', false, 'error', 'no_profile');
  end if;

  -- Canonical daily target (may be absent → nulls; commit still records intake).
  select tdee_kcal, protein_g, carbs_g, fat_g
    into v_t_kcal, v_t_pro, v_t_car, v_t_fat
    from public.athlete_nutrition_targets_daily
   where athlete_id = v_profile_id and day = v_day
   limit 1;

  -- Today's logged intake rollup (kcal is the generated 4P+4C+9F column).
  select coalesce(sum(kcal), 0), coalesce(sum(protein_g), 0),
         coalesce(sum(carbs_g), 0), coalesce(sum(fat_g), 0), count(*)
    into v_c_kcal, v_c_pro, v_c_car, v_c_fat, v_meals
    from public.nutrition_intake_log
   where athlete_id = v_profile_id and day = v_day;

  -- Adherence % vs target, capped at 999 (mirror bbf_nutrition_today).
  v_kcal_pct := case when coalesce(v_t_kcal, 0) > 0
                     then least(round(100.0 * v_c_kcal / v_t_kcal)::int, 999) else null end;
  v_pro_pct  := case when coalesce(v_t_pro, 0) > 0
                     then least(round(100.0 * v_c_pro / v_t_pro)::int, 999) else null end;

  insert into public.nutrition_daily_sync (
    athlete_id, day, target_kcal, consumed_kcal, kcal_pct,
    target_protein_g, consumed_protein_g, protein_pct,
    target_carbs_g, consumed_carbs_g, target_fat_g, consumed_fat_g,
    meals_logged, synced_at, updated_at
  ) values (
    v_profile_id, v_day, v_t_kcal, v_c_kcal, v_kcal_pct,
    v_t_pro, v_c_pro, v_pro_pct,
    v_t_car, v_c_car, v_t_fat, v_c_fat,
    v_meals, now(), now()
  )
  on conflict (athlete_id, day) do update set
    target_kcal        = excluded.target_kcal,
    consumed_kcal      = excluded.consumed_kcal,
    kcal_pct           = excluded.kcal_pct,
    target_protein_g   = excluded.target_protein_g,
    consumed_protein_g = excluded.consumed_protein_g,
    protein_pct        = excluded.protein_pct,
    target_carbs_g     = excluded.target_carbs_g,
    consumed_carbs_g   = excluded.consumed_carbs_g,
    target_fat_g       = excluded.target_fat_g,
    consumed_fat_g     = excluded.consumed_fat_g,
    meals_logged       = excluded.meals_logged,
    synced_at          = now(),
    updated_at         = now()
  returning synced_at into v_synced;

  return json_build_object(
    'ok',                 true,
    'day',                v_day,
    'target_kcal',        v_t_kcal,
    'consumed_kcal',      v_c_kcal,
    'kcal_pct',           v_kcal_pct,
    'target_protein_g',   v_t_pro,
    'consumed_protein_g', v_c_pro,
    'protein_pct',        v_pro_pct,
    'consumed_carbs_g',   v_c_car,
    'consumed_fat_g',     v_c_fat,
    'meals_logged',       v_meals,
    'synced_at',          v_synced
  );
end;
$function$;

revoke all on function public.bbf_log_nutrition_adherence(text) from public;
grant execute on function public.bbf_log_nutrition_adherence(text) to anon, authenticated, service_role;
