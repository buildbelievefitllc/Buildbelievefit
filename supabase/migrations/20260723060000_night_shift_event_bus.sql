-- 20260723060000_night_shift_event_bus.sql
-- ═══════════════════════════════════════════════════════════════════════════
-- NIGHT SHIFT · MASTER ORCHESTRATION TRACK — Part 2.1: the unified event bus.
--
-- Two deterministic database triggers push real athlete/client events straight
-- into the founder's Action Inbox (coach_action_inbox) as PENDING proposals —
-- the same dry-run, founder-approved rail every agentic surface already rides.
-- ZERO LLM involvement: thresholds, tier ladders, and payloads are pure SQL
-- (CALCULATOR-OFF-LLM). Table mapping from the directive's working names:
--   "sports_hub_telemetry"      → athlete_milestones_sync (+ sport_milestones)
--   "client_checkins"           → bbf_readiness
--   "command_center_action_inbox" → coach_action_inbox
--
-- A) LEVEL_UP_PROPOSAL — an athlete completes (coach-verified) the FULL
--    milestone set of their sport + current tier → propose promotion to the
--    next tier on the ladder (youth → middle_school → high_school → collegiate).
-- B) COACHING_INTERVENTION — a check-in lands with soreness ≥ 8/10 or a
--    readiness score ≤ 40 → propose a 3-day conservative recovery override.
--    The payload carries the exact root-level keys bbf_apply_plan_override and
--    the ActionInbox ModificationPanel already consume (volume_multiplier,
--    intensity_multiplier, target_days, modification_reason) so the EXISTING
--    one-tap applier works unchanged.
--    (The "missed 2 consecutive check-ins" case is ABSENCE — a row trigger
--    cannot fire on rows that never arrive; the 2:00 AM night orchestrator
--    cron sweep owns that path.)
--
-- Plus the one-tap applier for A: bbf_apply_level_up(action_id) — atomically
-- promotes athlete_profiles.current_tier and closes the card; returns the
-- athlete + recipient info so the agent brain can dispatch the parent
-- progress email (Brevo) after the DB work commits.
--
-- All functions SECURITY DEFINER + pinned search_path; coach_action_inbox
-- stays RLS-sealed (no client path can forge a card — only these triggers and
-- the service role write it). EXECUTE revoked from public/anon/authenticated.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Tier ladder (deterministic, single source of truth) ─────────────────────
create or replace function public._bbf_next_tier(p_tier text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(p_tier, ''))
    when 'youth'         then 'middle_school'
    when 'middle_school' then 'high_school'
    when 'high_school'   then 'collegiate'
    else null  -- collegiate (or unknown) has no automatic next rung
  end;
$$;

-- ── A · LEVEL_UP_PROPOSAL trigger ────────────────────────────────────────────
create or replace function public.bbf_levelup_propose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile   athlete_profiles%rowtype;
  v_total     integer;
  v_done      integer;
  v_next_tier text;
  v_first     text;
begin
  -- Only coach-verified completions count toward a tier crossing.
  if new.completed_at is null or coalesce(new.verified_by_coach, false) is not true then
    return new;
  end if;

  select * into v_profile from athlete_profiles where id = new.athlete_id;
  if not found or v_profile.user_id is null then return new; end if;

  v_next_tier := _bbf_next_tier(v_profile.current_tier);
  if v_next_tier is null then return new; end if;

  -- Threshold: the athlete has verified-completed EVERY milestone of their
  -- sport + current tier. Deterministic set arithmetic, no heuristics.
  select count(*) into v_total
  from sport_milestones m
  where m.sport = v_profile.sport
    and m.tier = v_profile.current_tier;
  if v_total = 0 then return new; end if;

  select count(distinct s.milestone_id) into v_done
  from athlete_milestones_sync s
  join sport_milestones m on m.id = s.milestone_id
  where s.athlete_id = new.athlete_id
    and s.completed_at is not null
    and coalesce(s.verified_by_coach, false)
    and m.sport = v_profile.sport
    and m.tier = v_profile.current_tier;
  if v_done < v_total then return new; end if;

  -- One live proposal per athlete — never stack duplicates.
  if exists (
    select 1 from coach_action_inbox
    where athlete_id = v_profile.user_id
      and type = 'LEVEL_UP_PROPOSAL'
      and status = 'PENDING'
  ) then return new; end if;

  v_first := split_part(coalesce(nullif(v_profile.full_name, ''), 'Athlete'), ' ', 1);

  insert into coach_action_inbox
    (athlete_id, type, status, risk_score, insight_summary, proposed_action, draft_message, proposed_plan_modification)
  values (
    v_profile.user_id,
    'LEVEL_UP_PROPOSAL',
    'PENDING',
    null,
    format('%s cleared all %s %s milestones for %s — coach-verified, tier crossing earned.',
           v_first, v_total, replace(v_profile.current_tier, '_', '-'), initcap(v_profile.sport)),
    format('Promote %s from %s to %s in the Sports Hub and wire the progress note home.',
           v_first, replace(v_profile.current_tier, '_', '-'), replace(v_next_tier, '_', '-')),
    format('%s just leveled up! Every %s milestone in %s is complete and coach-verified — they''ve officially earned the move to the %s track. Proud of this one. — Coach Akeem, Build Believe Fit',
           v_first, replace(v_profile.current_tier, '_', '-'), initcap(v_profile.sport), replace(v_next_tier, '_', '-')),
    jsonb_build_object('level_up', jsonb_build_object(
      'profile_id', v_profile.id,
      'user_id', v_profile.user_id,
      'sport', v_profile.sport,
      'from_tier', v_profile.current_tier,
      'to_tier', v_next_tier,
      'milestones_done', v_done,
      'milestones_total', v_total
    ))
  );
  return new;
end;
$$;

drop trigger if exists trg_bbf_levelup_propose on athlete_milestones_sync;
create trigger trg_bbf_levelup_propose
  after insert or update of completed_at, verified_by_coach on athlete_milestones_sync
  for each row execute function public.bbf_levelup_propose();

-- ── B · COACHING_INTERVENTION trigger ───────────────────────────────────────
create or replace function public.bbf_intervention_propose()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name  text;
  v_first text;
  v_why   text;
begin
  -- Threshold gate: flag only genuinely red check-ins.
  if coalesce(new.soreness_level, 0) < 8 and coalesce(new.score, 100) > 40 then
    return new;
  end if;

  if exists (
    select 1 from coach_action_inbox
    where athlete_id = new.user_id
      and type = 'COACHING_INTERVENTION'
      and status = 'PENDING'
  ) then return new; end if;

  select coalesce(nullif(name, ''), uid, 'Client') into v_name
  from bbf_users where id = new.user_id;
  v_first := split_part(coalesce(v_name, 'Client'), ' ', 1);

  v_why := case
    when coalesce(new.soreness_level, 0) >= 8 and coalesce(new.score, 100) <= 40
      then format('soreness %s/10 with readiness at %s', new.soreness_level, new.score)
    when coalesce(new.soreness_level, 0) >= 8
      then format('soreness %s/10 on today''s check-in', new.soreness_level)
    else format('readiness collapsed to %s', new.score)
  end;

  insert into coach_action_inbox
    (athlete_id, type, status, risk_score, insight_summary, proposed_action, draft_message, proposed_plan_modification)
  values (
    new.user_id,
    'COACHING_INTERVENTION',
    'PENDING',
    coalesce(new.soreness_level, 10 - coalesce(new.score, 0) / 10),
    format('%s checked in with %s — the protocol should bend before something breaks.', v_first, v_why),
    format('Apply a 3-day recovery override (70%% volume · 80%% intensity) and check in with %s directly.', v_first),
    format('%s — saw your check-in (%s). I''ve pulled your next 3 days back so we recover on schedule instead of digging a hole. Joints and tendons first, always. Tell me how it''s actually feeling. — Coach Akeem', v_first, v_why),
    jsonb_build_object(
      -- Root-level keys = the EXACT shape bbf_apply_plan_override + the
      -- ActionInbox ModificationPanel already consume. Zero new applier code.
      'volume_multiplier', 0.7,
      'intensity_multiplier', 0.8,
      'target_days', 3,
      'modification_reason', format('Compliance sentinel: %s. Conservative 3-day recovery window auto-proposed.', v_why),
      'intervention', jsonb_build_object(
        'reason', case when coalesce(new.soreness_level, 0) >= 8 then 'high_soreness' else 'low_readiness' end,
        'soreness_level', new.soreness_level,
        'readiness_score', new.score,
        'reading_date', new.reading_date
      )
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_bbf_intervention_propose on bbf_readiness;
create trigger trg_bbf_intervention_propose
  after insert on bbf_readiness
  for each row execute function public.bbf_intervention_propose();

-- ── One-tap applier · LEVEL_UP_PROPOSAL ─────────────────────────────────────
create or replace function public.bbf_apply_level_up(p_action_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card    coach_action_inbox%rowtype;
  v_lu      jsonb;
  v_email   text;
  v_name    text;
begin
  select * into v_card from coach_action_inbox
  where id = p_action_id and status = 'PENDING' and type = 'LEVEL_UP_PROPOSAL'
  for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'card_not_pending');
  end if;

  v_lu := v_card.proposed_plan_modification -> 'level_up';
  if v_lu is null or v_lu ->> 'profile_id' is null or v_lu ->> 'to_tier' is null then
    return jsonb_build_object('ok', false, 'error', 'malformed_payload');
  end if;

  update athlete_profiles
     set current_tier = v_lu ->> 'to_tier'
   where id = (v_lu ->> 'profile_id')::uuid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'profile_missing');
  end if;

  update coach_action_inbox
     set status = 'APPROVED',
         processed_at = now(),
         resolution_reason = format('tier promoted %s → %s', v_lu ->> 'from_tier', v_lu ->> 'to_tier')
   where id = p_action_id;

  select email, coalesce(nullif(name, ''), uid) into v_email, v_name
  from bbf_users where id = v_card.athlete_id;

  -- The brain dispatches the parent progress email AFTER this commits, using
  -- the recipient + letter returned here (draft_message is the letter body).
  return jsonb_build_object(
    'ok', true,
    'user_id', v_card.athlete_id,
    'athlete_name', v_name,
    'recipient_email', v_email,
    'from_tier', v_lu ->> 'from_tier',
    'to_tier', v_lu ->> 'to_tier',
    'sport', v_lu ->> 'sport',
    'letter', v_card.draft_message
  );
end;
$$;

-- ── Lockdown: service-role only (the brain's admin gate is the sole caller) ──
revoke all on function public._bbf_next_tier(text) from public, anon, authenticated;
revoke all on function public.bbf_apply_level_up(uuid) from public, anon, authenticated;
grant execute on function public._bbf_next_tier(text) to service_role;
grant execute on function public.bbf_apply_level_up(uuid) to service_role;
