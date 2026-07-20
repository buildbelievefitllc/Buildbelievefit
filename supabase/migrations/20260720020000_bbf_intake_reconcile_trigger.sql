-- 20260720020000_bbf_intake_reconcile_trigger.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Identity-aware reconciliation for the Sovereign Intake funnel. An AFTER INSERT
-- trigger on bbf_intake_submissions unpacks the raw wizard payload into a clean,
-- normalized per-user tracking table (bbf_intake_profile), keyed by the SAME
-- auth.uid() as the submission — so no bbf_users identity mapping is assumed and
-- the core users table is never exposed to direct frontend insertion bugs.
--
-- Separation of duties: the frontend may only INSERT its own RAW submission (RLS,
-- prior migration). The normalized profile row is written ONLY by this
-- SECURITY DEFINER trigger (runs as owner, bypasses RLS) — the frontend has no
-- INSERT/UPDATE path to it. Additive only; touches no existing object.
--
-- Robustness: every numeric field is regex-guarded before casting, and the whole
-- body is wrapped in an exception handler that logs and returns — a malformed
-- payload can never fail (and thus roll back) the user's raw submission.
--
-- Security (CLAUDE.md §7 + DATABASE_SAFETY.md §Phase 1.6): SECURITY DEFINER,
-- search_path pinned to public, EXECUTE revoked from public/anon/authenticated
-- (a trigger fires without an EXECUTE grant). RLS on; authenticated may SELECT
-- only their own row; service_role full.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Normalized reconciliation target (trigger-written only) ──
create table if not exists public.bbf_intake_profile (
  user_id           uuid        primary key,
  goal              text,
  units             text,
  height_cm         numeric(6,2),
  weight_kg         numeric(6,2),
  target_weight_kg  numeric(6,2),
  weekly_days       text,
  injuries          jsonb       not null default '[]'::jsonb,
  source_submission uuid,
  raw               jsonb,
  updated_at        timestamptz not null default now()
);

comment on table public.bbf_intake_profile is
  'Normalized Sovereign Intake profile per user (auth.uid()). Written ONLY by the bbf_reconcile_intake_submission trigger; authenticated reads own row.';

alter table public.bbf_intake_profile enable row level security;
revoke all on table public.bbf_intake_profile from anon, authenticated;
grant select on table public.bbf_intake_profile to authenticated;
grant all on table public.bbf_intake_profile to service_role;

drop policy if exists bbf_intake_profile_self_read on public.bbf_intake_profile;
create policy bbf_intake_profile_self_read
  on public.bbf_intake_profile
  for select
  to authenticated
  using (auth.uid() = user_id);

-- ── Reconciliation trigger function ──
create or replace function public.bbf_reconcile_intake_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p        jsonb := coalesce(new.payload, '{}'::jsonb);
  v_units  text  := nullif(p->>'units', '');
  v_num_w  numeric;
  v_num_t  numeric;
  v_h_cm   numeric;
  v_w_kg   numeric;
  v_t_kg   numeric;
begin
  if new.user_id is null then
    return new;
  end if;

  -- Defensive numeric extraction — guard every cast against malformed payloads.
  v_num_w := case when (p->>'weight')       ~ '^[0-9]+(\.[0-9]+)?$' then (p->>'weight')::numeric       else null end;
  v_num_t := case when (p->>'targetWeight') ~ '^[0-9]+(\.[0-9]+)?$' then (p->>'targetWeight')::numeric else null end;

  -- Height → centimetres.
  if v_units = 'metric' then
    v_h_cm := case when (p->>'heightCm') ~ '^[0-9]+(\.[0-9]+)?$' then (p->>'heightCm')::numeric else null end;
  else
    v_h_cm := case
      when (p->>'heightFt') ~ '^[0-9]+$'
      then ((p->>'heightFt')::numeric * 12
            + coalesce(case when (p->>'heightIn') ~ '^[0-9]+(\.[0-9]+)?$' then (p->>'heightIn')::numeric else 0 end, 0)
           ) * 2.54
      else null end;
  end if;

  -- Weights → kilograms.
  if v_units = 'metric' then
    v_w_kg := v_num_w;
    v_t_kg := v_num_t;
  else
    v_w_kg := round(v_num_w * 0.45359237, 2);
    v_t_kg := round(v_num_t * 0.45359237, 2);
  end if;

  insert into public.bbf_intake_profile as ip
    (user_id, goal, units, height_cm, weight_kg, target_weight_kg, weekly_days, injuries, source_submission, raw, updated_at)
  values (
    new.user_id,
    nullif(p->>'focus', ''),
    v_units,
    round(v_h_cm, 2),
    v_w_kg,
    v_t_kg,
    nullif(p->>'availability', ''),
    case when jsonb_typeof(p->'injuries') = 'array' then p->'injuries' else '[]'::jsonb end,
    new.id,
    p,
    now()
  )
  on conflict (user_id) do update set
    goal              = excluded.goal,
    units             = excluded.units,
    height_cm         = excluded.height_cm,
    weight_kg         = excluded.weight_kg,
    target_weight_kg  = excluded.target_weight_kg,
    weekly_days       = excluded.weekly_days,
    injuries          = excluded.injuries,
    source_submission = excluded.source_submission,
    raw               = excluded.raw,
    updated_at        = now();

  return new;
exception when others then
  -- Never let reconciliation roll back the raw submission.
  raise warning '[bbf_reconcile_intake] skipped for user %: %', new.user_id, sqlerrm;
  return new;
end;
$$;

comment on function public.bbf_reconcile_intake_submission() is
  'AFTER INSERT trigger on bbf_intake_submissions: normalizes the wizard payload into bbf_intake_profile. SECURITY DEFINER, fails safe.';

revoke all on function public.bbf_reconcile_intake_submission() from public, anon, authenticated;

drop trigger if exists trg_reconcile_intake on public.bbf_intake_submissions;
create trigger trg_reconcile_intake
  after insert on public.bbf_intake_submissions
  for each row execute function public.bbf_reconcile_intake_submission();
