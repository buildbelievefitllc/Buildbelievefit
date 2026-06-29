-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 2 — "BBF LOOP BREAKER" 12-WEEK MACROCYCLE + LIVE SQUAD INTERCEPTS
-- ───────────────────────────────────────────────────────────────────────────
-- Two pieces of backend foundation for the synchronized squad macrocycle:
--
--   1. program_day(date)  — a DETERMINISTIC, LOOPING Day 1..84 position.
--      The Loop Breaker is a 12-week (84-day) macrocycle that repeats. Given a
--      single squad-wide anchor (Monday 2026-06-29), any calendar date maps to
--      its position in the cycle:  ((date - anchor) mod 84) + 1  → 1..84.
--      The modulo is normalized so dates BEFORE the anchor still resolve cleanly
--      (Postgres '%' is sign-preserving), making the function total over all dates.
--
--   2. bbf_calendar_overrides — a thin table of LIVE SQUAD INTERCEPTS. When the
--      CEO/coach needs to override what the macrocycle would otherwise schedule
--      on a given date (a recovery drop-in, a re-test, a themed session), they
--      drop one row (override_date, title, brief_script_reference). The resolver
--      surfaces the override INSTEAD OF the computed day for that date.
--
-- The anchor lives in bbf_app_config (key 'loop_breaker_anchor_date') so the CEO
-- can re-base the entire squad's cycle with one UPDATE — no code change.
--
-- SECURITY: bbf_calendar_overrides is RLS-forced deny-all (service-role writes
-- only). Reads go through the SECURITY DEFINER resolver RPC, mirroring the
-- bbf_sovereign_audio / bbf_get_sovereign_briefing pattern.
--
-- NOTE on brief_script_reference: this column is NET-NEW (it does not exist
-- elsewhere in the schema). Per CEO ruling it STRICTLY stores a manifest id
-- (e.g. 'audio_62a878f8' from sovereignVaultManifest.json) — never a raw URL.
-- A CHECK constraint enforces the 'audio_' + 8-hex shape (or NULL).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0 · Squad-wide macrocycle anchor (idempotent; CEO-rebasable) ──────────────
-- bbf_app_config already exists (see bbf_sovereign_audio migration). Seed the
-- anchor only if absent — never clobber a CEO re-base on re-run.
insert into public.bbf_app_config (key, value)
values ('loop_breaker_anchor_date', '2026-06-29')   -- Monday → week-1 aligned
on conflict (key) do nothing;

-- ─── 1 · The looping Day 1..84 calculation ─────────────────────────────────────
create or replace function public.bbf_program_day(p_date date default current_date)
 returns integer
 language sql
 stable
 set search_path = public
as $function$
  -- normalize a possibly-negative modulo into 0..83, then shift to 1..84.
  select (
    (
      ( (p_date - coalesce(
          (select nullif(value, '')::date from public.bbf_app_config
            where key = 'loop_breaker_anchor_date'),
          date '2026-06-29'))            -- hard fallback if config row is missing
        % 84 ) + 84
    ) % 84
  ) + 1;
$function$;

comment on function public.bbf_program_day(date) is
  'Phase 2 Loop Breaker: maps any date to its looping Day 1..84 position in the 12-week macrocycle, anchored to bbf_app_config.loop_breaker_anchor_date.';

-- Convenience: the macrocycle week (1..12) for a date.
create or replace function public.bbf_program_week(p_date date default current_date)
 returns integer
 language sql
 stable
 set search_path = public
as $function$
  select ((public.bbf_program_day(p_date) - 1) / 7) + 1;
$function$;

comment on function public.bbf_program_week(date) is
  'Phase 2 Loop Breaker: macrocycle week 1..12 for a date (derived from bbf_program_day).';

-- ─── 2 · Live squad intercepts ─────────────────────────────────────────────────
create table if not exists public.bbf_calendar_overrides (
  id                     uuid primary key default gen_random_uuid(),
  override_date          date not null,
  title                  text not null,
  -- STRICT: manifest id only (e.g. 'audio_62a878f8') — never a raw URL.
  brief_script_reference text
    constraint ck_calendar_override_manifest_id
      check (brief_script_reference is null
             or brief_script_reference ~ '^audio_[0-9a-f]{8}$'),
  notes                  text,
  created_by             uuid references public.bbf_users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint uq_calendar_override_date unique (override_date)  -- one intercept / squad / day
);

create index if not exists idx_calendar_overrides_date
  on public.bbf_calendar_overrides (override_date);

comment on table public.bbf_calendar_overrides is
  'Phase 2 Loop Breaker: squad-wide live intercepts. One row per calendar date overrides the computed macrocycle day. Service-role writes; read via bbf_resolve_program_day RPC.';

-- keep updated_at honest on edits
create or replace function public._bbf_calendar_overrides_touch()
 returns trigger
 language plpgsql
as $function$
begin
  NEW.updated_at := now();
  return NEW;
end;
$function$;

drop trigger if exists bbf_calendar_overrides_touch on public.bbf_calendar_overrides;
create trigger bbf_calendar_overrides_touch
  before update on public.bbf_calendar_overrides
  for each row execute function public._bbf_calendar_overrides_touch();

-- RLS: forced deny-all. Writes = service-role edge fn; reads = the resolver RPC.
alter table public.bbf_calendar_overrides enable row level security;
alter table public.bbf_calendar_overrides force  row level security;
revoke all on table public.bbf_calendar_overrides from anon, authenticated;

-- ─── 3 · Resolver — override wins, else the computed macrocycle position ────────
-- For a date, returns the squad's effective schedule: an explicit intercept if one
-- exists for that date, otherwise the looping Day 1..84 / Week 1..12 position.
create or replace function public.bbf_resolve_program_day(p_date date default current_date)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public
as $function$
declare
  v_day  integer := public.bbf_program_day(p_date);
  v_week integer := public.bbf_program_week(p_date);
  v_ovr  record;
begin
  select title, brief_script_reference, notes
    into v_ovr
    from public.bbf_calendar_overrides
   where override_date = p_date
   limit 1;

  return jsonb_build_object(
    'ok',                     true,
    'date',                   p_date,
    'program_day',            v_day,                       -- 1..84
    'program_week',           v_week,                      -- 1..12
    'day_of_week',            ((v_day - 1) % 7) + 1,       -- 1..7 within the week
    'is_override',            found,
    'title',                  case when found then v_ovr.title else null end,
    'brief_script_reference', case when found then v_ovr.brief_script_reference else null end,
    'notes',                  case when found then v_ovr.notes else null end
  );
end;
$function$;

comment on function public.bbf_resolve_program_day(date) is
  'Phase 2 Loop Breaker: resolves a date to the squad schedule — an override intercept if present, else the computed Day 1..84 / Week 1..12 macrocycle position.';

revoke all on function public.bbf_resolve_program_day(date) from public;
grant execute on function public.bbf_resolve_program_day(date) to anon, authenticated, service_role;
grant execute on function public.bbf_program_day(date)  to anon, authenticated, service_role;
grant execute on function public.bbf_program_week(date) to anon, authenticated, service_role;
