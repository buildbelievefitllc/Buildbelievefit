-- Dual-Path Sentinel + Closed-Loop Program Override + Onboarding Architect
-- ----------------------------------------------------------------------------
-- Completes the agentic network for BOTH wearable-sync and manual-input
-- (watchless) athletes:
--
--   1 · bbf_compute_autonomic_readiness — adaptive readiness calculator.
--       WEARABLE path: rolling 7-day HRV z-score vs the athlete's own 28-day
--       baseline (bbf_wearable_readings.hrv_ms). SUBJECTIVE path (watchless):
--       composite readiness (score, else sleep_quality + inverted soreness on a
--       10..100 scale) z-scored the same way (bbf_readiness). Crisis:
--         WEARABLE   → ACWR >= 1.5 AND hrv_z <= -1.0   (Autonomic Crisis)
--         SUBJECTIVE → ACWR >= 1.5 AND subj_z <= -1.5  (Subjective Fatigue Crisis)
--       Sentinels on bbf_wearable_readings + bbf_readiness fire bbf-agent-brain
--       (AUTONOMIC_OVERUSE) when is_crisis, Vault-secret signed, 48h dedup.
--
--   2 · Closed-loop override — coach_action_inbox.proposed_plan_modification
--       (jsonb) + bbf_apply_plan_override(action_id). GROUNDED DEVIATION from
--       the build brief: the brief assumed a per-exercise workout calendar with
--       numeric target weights/sets/reps. No such table exists (bbf_users.
--       workout_plan is TEXT; bbf_sets is logged history). The REAL structured
--       plan surface is bbf_daily_protocols(athlete_id, date UNIQUE,
--       training_volume_modifier, directive_log) — read live by ProgramGrid +
--       autoRegulation.js as the day's volume-scaling knob. The override
--       upserts the next N days there: volume_multiplier drives
--       training_volume_modifier (LEAST-merged so it never RAISES a volume the
--       readiness engine already cut); intensity_multiplier + reason ride in
--       directive_log for the delivery pipeline + audit trail.
--
--   3 · Onboarding architect — trigger on bbf_pathfinder_intakes fires when an
--       intake is LINKED to a real user (consumed_by_user set — at INSERT time
--       the form is pre-signup and has no user id). bbf_apply_onboarding_plan
--       deploys the Gemini blueprint into bbf_users.workout_plan (the live plan
--       surface the app renders) + stamps plans_generated_at.
--
-- §7 posture (CRITICAL REVENUE & POSTURE ALIGNMENT): every function below is
-- SECURITY DEFINER with a pinned search_path; EXECUTE is revoked from PUBLIC,
-- anon AND authenticated (the Supabase default-privileges trap, per the 120600
-- lesson); service_role (+ postgres where cron/console-invoked) only. All
-- coach/UI access routes through the admin-gated bbf-agent-brain edge function.
-- ----------------------------------------------------------------------------

-- ── 1A · Adaptive Readiness Calculator ───────────────────────────────────────
create or replace function public.bbf_compute_autonomic_readiness(p_athlete_id uuid)
returns table (
  z_score    numeric,
  acwr_ratio numeric,
  is_crisis  boolean,
  path_used  text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_acwr     numeric;
  v_z        numeric;
  v_path     text;
  v_recent   numeric;
  v_base_avg numeric;
  v_base_sd  numeric;
  v_days     integer;
begin
  select acwr into v_acwr from public.bbf_compute_acwr(p_athlete_id);

  -- ── WEARABLE path: rolling 7-day HRV mean z-scored vs 28-day baseline ──
  with daily as (
    select reading_date as d, avg(hrv_ms) as v
    from public.bbf_wearable_readings
    where user_id = p_athlete_id
      and hrv_ms is not null
      and reading_date > current_date - 28
    group by 1
  ),
  stats as (
    select count(*)::int as n, avg(v) as mu, stddev_samp(v) as sd,
           (select avg(v) from daily where d > current_date - 7) as recent
    from daily
  )
  select n, mu, sd, recent into v_days, v_base_avg, v_base_sd, v_recent from stats;

  if v_days >= 5 and v_base_sd is not null and v_base_sd > 0 and v_recent is not null then
    v_path := 'WEARABLE';
    v_z := round((v_recent - v_base_avg) / v_base_sd, 2);
    return query select
      v_z, v_acwr,
      (coalesce(v_acwr, 0) >= 1.5 and v_z <= -1.0),
      v_path;
    return;
  end if;

  -- ── SUBJECTIVE path (watchless): composite readiness z-scored the same way ──
  -- Composite per row: the synced score (already 0..100) when present, else
  -- sleep_quality (1..10) + inverted soreness (11 - soreness_level, 1..10),
  -- scaled *5 onto the same 10..100 band.
  with daily as (
    select coalesce(reading_date, "timestamp"::date) as d,
           avg(
             coalesce(
               score::numeric,
               ( coalesce(sleep_quality, 11 - soreness_level)
               + (11 - coalesce(soreness_level, 11 - sleep_quality)) ) * 5.0
             )
           ) as v
    from public.bbf_readiness
    where user_id = p_athlete_id
      and (score is not null or sleep_quality is not null or soreness_level is not null)
      and coalesce(reading_date, "timestamp"::date) > current_date - 28
    group by 1
  ),
  stats as (
    select count(*)::int as n, avg(v) as mu, stddev_samp(v) as sd,
           (select avg(v) from daily where d > current_date - 7) as recent
    from daily
  )
  select n, mu, sd, recent into v_days, v_base_avg, v_base_sd, v_recent from stats;

  if v_days >= 5 and v_base_sd is not null and v_base_sd > 0 and v_recent is not null then
    v_path := 'SUBJECTIVE';
    v_z := round((v_recent - v_base_avg) / v_base_sd, 2);
    return query select
      v_z, v_acwr,
      (coalesce(v_acwr, 0) >= 1.5 and v_z <= -1.5),
      v_path;
    return;
  end if;

  -- Neither surface has enough signal (>= 5 distinct days + live variance).
  -- Missing data never fabricates a crisis (autoRegulation doctrine).
  return query select null::numeric, v_acwr, false, 'INSUFFICIENT'::text;
end;
$$;

comment on function public.bbf_compute_autonomic_readiness(uuid) is
  'Agentic Command Center · dual-path readiness: WEARABLE (7d HRV z vs 28d baseline, crisis ACWR>=1.5 & z<=-1.0) else SUBJECTIVE (composite score z, crisis ACWR>=1.5 & z<=-1.5) else INSUFFICIENT (never fabricates). service_role/postgres only.';

revoke all on function public.bbf_compute_autonomic_readiness(uuid) from public, anon, authenticated;
grant execute on function public.bbf_compute_autonomic_readiness(uuid) to postgres, service_role;

-- ── 1B · The Autonomic/Subjective Sentinel (shared trigger fn) ───────────────
create or replace function public.tg_autonomic_crisis_sentinel()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_athlete uuid;
  v_secret  text;
  v_url     text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-agent-brain';
  r         record;
begin
  -- Both watched tables key the athlete as user_id (bbf_users.id).
  v_athlete := new.user_id;
  if v_athlete is null then return new; end if;

  select * into r from public.bbf_compute_autonomic_readiness(v_athlete);
  if r.is_crisis is distinct from true then return new; end if;

  -- Dedup/cooldown: one live card per athlete; no re-fire within 48h even
  -- after triage (a crisis needs coach action, not a card per sync).
  if exists (
    select 1 from public.coach_action_inbox
    where athlete_id = v_athlete
      and type = 'AUTONOMIC_OVERUSE'
      and (status = 'PENDING' or created_at > now() - interval '48 hours')
  ) then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_agent_webhook_secret'
  limit 1;

  if v_secret is null or length(btrim(v_secret)) = 0 then
    raise warning 'bbf_agent_webhook_secret is empty or missing. Aborting autonomic crisis webhook.';
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-agent-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action',       'generate',
      'athlete_id',   v_athlete,
      'trigger_type', 'AUTONOMIC_OVERUSE',
      'path_used',    r.path_used,
      'risk_score',   r.acwr_ratio,
      'z_score',      r.z_score
    )
  );

  return new;
end;
$$;

comment on function public.tg_autonomic_crisis_sentinel() is
  'Agentic Command Center · AFTER INSERT sentinel on bbf_wearable_readings + bbf_readiness: dual-path crisis fires bbf-agent-brain (AUTONOMIC_OVERUSE, async pg_net, Vault-signed, 48h dedup). Never RPC-callable.';

revoke execute on function public.tg_autonomic_crisis_sentinel() from public, anon, authenticated;

drop trigger if exists wearable_autonomic_sentinel_ai on public.bbf_wearable_readings;
create trigger wearable_autonomic_sentinel_ai
  after insert on public.bbf_wearable_readings
  for each row
  execute function public.tg_autonomic_crisis_sentinel();

drop trigger if exists readiness_autonomic_sentinel_ai on public.bbf_readiness;
create trigger readiness_autonomic_sentinel_ai
  after insert on public.bbf_readiness
  for each row
  execute function public.tg_autonomic_crisis_sentinel();

-- ── 2A · Inbox schema: the structured modification block ─────────────────────
alter table public.coach_action_inbox
  add column if not exists proposed_plan_modification jsonb;

comment on column public.coach_action_inbox.proposed_plan_modification is
  'Gemini structured block. Spike/autonomic: {intensity_multiplier, volume_multiplier, target_days, modification_reason}. Onboarding: {kind:onboarding_blueprint, blueprint:{weeks:[…]}, plan_text}. Applied server-side by bbf_apply_plan_override / bbf_apply_onboarding_plan.';

-- ── 2C · In-database plan modifier (One-Tap Prescription) ────────────────────
create or replace function public.bbf_apply_plan_override(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card   record;
  v_vol    numeric;
  v_int    numeric;
  v_days   integer;
  v_reason text;
  v_entry  jsonb;
  v_d      integer;
begin
  select * into v_card
  from public.coach_action_inbox
  where id = p_action_id and status = 'PENDING'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_processed');
  end if;
  if v_card.proposed_plan_modification is null
     or v_card.proposed_plan_modification->>'volume_multiplier' is null then
    return jsonb_build_object('ok', false, 'error', 'no_modification_block');
  end if;

  -- Clamp everything Gemini proposed into physiologically sane bounds —
  -- defense in depth on top of the brain's own clamping.
  v_vol    := least(greatest(coalesce((v_card.proposed_plan_modification->>'volume_multiplier')::numeric, 0.8), 0.3), 1.0);
  v_int    := least(greatest(coalesce((v_card.proposed_plan_modification->>'intensity_multiplier')::numeric, 0.7), 0.3), 1.0);
  v_days   := least(greatest(coalesce((v_card.proposed_plan_modification->>'target_days')::int, 3), 1), 14);
  v_reason := left(coalesce(v_card.proposed_plan_modification->>'modification_reason', 'Agent-proposed deload'), 500);

  v_entry := jsonb_build_object(
    'source',               'agent_override',
    'action_id',            p_action_id,
    'trigger_type',         v_card.type,
    'volume_multiplier',    v_vol,
    'intensity_multiplier', v_int,
    'reason',               v_reason,
    'applied_at',           now()
  );

  -- Upsert the next N protocol days. LEAST-merge on conflict: the override may
  -- deepen a cut the readiness engine already made, never undo one.
  for v_d in 0..(v_days - 1) loop
    insert into public.bbf_daily_protocols (athlete_id, "date", training_volume_modifier, directive_log)
    values (v_card.athlete_id, current_date + v_d, v_vol, jsonb_build_array(v_entry))
    on conflict (athlete_id, "date") do update
      set training_volume_modifier = least(coalesce(public.bbf_daily_protocols.training_volume_modifier, 1.0), excluded.training_volume_modifier),
          directive_log            = coalesce(public.bbf_daily_protocols.directive_log, '[]'::jsonb) || v_entry;
  end loop;

  update public.coach_action_inbox
     set status = 'APPROVED', processed_at = now()
   where id = p_action_id;

  return jsonb_build_object(
    'ok', true,
    'athlete_id', v_card.athlete_id,
    'days_applied', v_days,
    'volume_multiplier', v_vol,
    'intensity_multiplier', v_int
  );
end;
$$;

comment on function public.bbf_apply_plan_override(uuid) is
  'Agentic Command Center · one-tap prescription: applies a PENDING card''s proposed_plan_modification to the next N bbf_daily_protocols days (LEAST-merged volume cut + directive_log audit entry), then APPROVEs the card. service_role only.';

revoke all on function public.bbf_apply_plan_override(uuid) from public, anon, authenticated;
grant execute on function public.bbf_apply_plan_override(uuid) to service_role;

-- ── 3A · Onboarding Architect trigger ────────────────────────────────────────
-- bbf_pathfinder_intakes has NO user id at INSERT (pre-signup form); the
-- athlete link lands when consumed_by_user is set. Fire on both paths:
-- INSERT (in case the row arrives pre-linked) and UPDATE OF consumed_by_user.
create or replace function public.tg_pathfinder_intake_onboarding()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_secret text;
  v_url    text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-agent-brain';
begin
  if new.consumed_by_user is null then return new; end if;
  if tg_op = 'UPDATE' and old.consumed_by_user is not distinct from new.consumed_by_user then
    return new;  -- only fire on the link transition
  end if;

  -- One onboarding blueprint per athlete: skip if any ONBOARDING_PLAN card
  -- already exists (any status — a dismissed blueprint is a coach decision).
  if exists (
    select 1 from public.coach_action_inbox
    where athlete_id = new.consumed_by_user and type = 'ONBOARDING_PLAN'
  ) then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_agent_webhook_secret'
  limit 1;

  if v_secret is null or length(btrim(v_secret)) = 0 then
    raise warning 'bbf_agent_webhook_secret is empty or missing. Aborting onboarding webhook.';
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-agent-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action',       'generate',
      'athlete_id',   new.consumed_by_user,
      'trigger_type', 'ONBOARDING',
      'intake_id',    new.id
    )
  );

  return new;
end;
$$;

comment on function public.tg_pathfinder_intake_onboarding() is
  'Agentic Command Center · fires bbf-agent-brain (ONBOARDING) when a pathfinder intake is linked to a real user (consumed_by_user). One blueprint per athlete. Never RPC-callable.';

revoke execute on function public.tg_pathfinder_intake_onboarding() from public, anon, authenticated;

drop trigger if exists pathfinder_intake_onboarding_aiu on public.bbf_pathfinder_intakes;
create trigger pathfinder_intake_onboarding_aiu
  after insert or update of consumed_by_user on public.bbf_pathfinder_intakes
  for each row
  execute function public.tg_pathfinder_intake_onboarding();

-- ── 3D · Baseline plan deployer ──────────────────────────────────────────────
-- Writes the brain-formatted plan_text into bbf_users.workout_plan — the live
-- plan surface the app renders — and stamps plans_generated_at.
create or replace function public.bbf_apply_onboarding_plan(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card record;
  v_text text;
begin
  select * into v_card
  from public.coach_action_inbox
  where id = p_action_id and status = 'PENDING' and type = 'ONBOARDING_PLAN'
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found_or_processed');
  end if;

  v_text := v_card.proposed_plan_modification->>'plan_text';
  if v_text is null or length(btrim(v_text)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_plan_text');
  end if;

  update public.bbf_users
     set workout_plan = v_text,
         plans_generated_at = now()
   where id = v_card.athlete_id and deleted_at is null;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'athlete_not_found');
  end if;

  update public.coach_action_inbox
     set status = 'APPROVED', processed_at = now()
   where id = p_action_id;

  return jsonb_build_object('ok', true, 'athlete_id', v_card.athlete_id);
end;
$$;

comment on function public.bbf_apply_onboarding_plan(uuid) is
  'Agentic Command Center · deploys an ONBOARDING_PLAN card''s plan_text into bbf_users.workout_plan (+ plans_generated_at), then APPROVEs the card. service_role only.';

revoke all on function public.bbf_apply_onboarding_plan(uuid) from public, anon, authenticated;
grant execute on function public.bbf_apply_onboarding_plan(uuid) to service_role;
