-- ═══════════════════════════════════════════════════════════════════════════
-- SP-0 · TELEMETRY CUSTODIAN + REFEREE DRY-RUN RAIL
-- ═══════════════════════════════════════════════════════════════════════════
-- The Autonomous Referee's promotion gates read three telemetry fields that had
-- no maintained writer, so the gates could effectively never clear through the
-- normal logging path:
--   • mesocycle_week      — stayed at DEFAULT 1 (below the min_mesocycle_weeks=4 gate)
--   • friction_avg_last_3 — never written (session_feedback pain_score was the
--                           intended source; the rollup was missing)
--   • protocol_completed  — never derived from the youth Day 1-7 check-offs that
--                           bbf_log_youth_progress already persists
--
-- This migration makes the gates satisfiable with DETERMINISTIC SQL ONLY (zero
-- AI, zero external calls — CALCULATOR-OFF-LLM boundary), and arms the Referee's
-- DRY-RUN mode: promotions stage as PHASE_PROMOTION cards in coach_action_inbox
-- for founder review instead of auto-applying. bbf_apply_phase_promotion() is
-- the one-tap applier (same pattern as bbf_apply_plan_override).
--
--   1. Config seeds: referee_mode='dry_run' (flip to 'live' only by CEO order),
--      sp0_days_required='6' (days of Day 1-7 check-offs that count as a
--      completed protocol week — tunable without redeploy).
--   2. Friction rollup trigger: AFTER INSERT ON session_feedback → avg of the
--      athlete's last 3 pain_scores → bbf_athlete_progression.friction_avg_last_3
--      (UPDATE-only; a no-op for adults with no progression row).
--   3. bbf_sp0_recompute_progression(): nightly custodian — anchors
--      mesocycle_started_at, derives mesocycle_week, derives protocol_completed
--      from bbf_users.youth_progress, syncs guardian_consent from the youth
--      intake's par_q_screen guardian block, backfills friction. Only rows whose
--      values actually change are updated (the progression tripwire fires per
--      UPDATE — delta-guarding keeps the nightly referee re-evaluation bounded).
--   4. pg_cron 'bbf-sp0-telemetry-custodian' @ 03:10 UTC (after the 01:00-02:45
--      lab recompute suite) — plain SQL call, no HTTP, no edge function.
--   5. bbf_apply_phase_promotion(p_action_id): service-role applier invoked by
--      bbf-agent-brain's apply_override path when the founder taps APPROVE on a
--      PHASE_PROMOTION card. Applies the pre-built next protocol atomically,
--      resets the block state, clears youth_progress, marks the card APPROVED.
--      Re-checks live guardian consent for youth athletes at apply time.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · Config seeds ─────────────────────────────────────────────────────────
INSERT INTO public.bbf_app_config (key, value)
VALUES ('referee_mode', 'dry_run'), ('sp0_days_required', '6')
ON CONFLICT (key) DO NOTHING;

-- ── 2 · Friction rollup — session_feedback → Referee aggregate ──────────────
CREATE OR REPLACE FUNCTION public.tg_sp0_friction_rollup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- UPDATE-only, mirrors bbf_log_athlete_set's rpe rollup: never creates rows,
  -- never touches sport/phase; adults without a progression row are a no-op.
  UPDATE public.bbf_athlete_progression
     SET friction_avg_last_3 = (
           SELECT round(avg(pain_score), 2)
             FROM (SELECT pain_score FROM public.session_feedback
                    WHERE user_id = NEW.user_id
                    ORDER BY created_at DESC LIMIT 3) t
         ),
         updated_at = now()
   WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sp0_friction_rollup ON public.session_feedback;
CREATE TRIGGER sp0_friction_rollup
  AFTER INSERT ON public.session_feedback
  FOR EACH ROW EXECUTE FUNCTION public.tg_sp0_friction_rollup();

-- ── 3 · Nightly custodian ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_sp0_recompute_progression()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_required     integer;
  v_weeks        integer := 0;
  v_completed    integer := 0;
  v_friction     integer := 0;
  v_consent      integer := 0;
BEGIN
  SELECT greatest(1, least(7, coalesce(value::integer, 6))) INTO v_required
    FROM public.bbf_app_config WHERE key = 'sp0_days_required';
  v_required := coalesce(v_required, 6);

  -- 3a · Anchor mesocycle_started_at where missing (oldest available signal).
  UPDATE public.bbf_athlete_progression
     SET mesocycle_started_at = coalesce(mesocycle_started_at, completed_at, updated_at, now())
   WHERE mesocycle_started_at IS NULL;

  -- 3b · Weeks-in-block from the anchor (delta-guarded).
  WITH calc AS (
    SELECT id, greatest(1, (floor(extract(epoch FROM (now() - mesocycle_started_at)) / 604800))::integer + 1) AS wk
      FROM public.bbf_athlete_progression
     WHERE mesocycle_started_at IS NOT NULL
  )
  UPDATE public.bbf_athlete_progression p
     SET mesocycle_week = calc.wk, updated_at = now()
    FROM calc
   WHERE calc.id = p.id AND p.mesocycle_week IS DISTINCT FROM calc.wk;
  GET DIAGNOSTICS v_weeks = ROW_COUNT;

  -- 3c · protocol_completed from the youth Day 1-7 check-off map: a day counts
  --      when it has at least one completed exercise ('ex') or drill ('dr').
  WITH days AS (
    SELECT p.id,
           (SELECT count(*)
              FROM jsonb_each(coalesce(u.youth_progress, '{}'::jsonb)) d(day_key, day_val)
             WHERE EXISTS (SELECT 1 FROM jsonb_each(coalesce(day_val -> 'ex', '{}'::jsonb)) e
                            WHERE e.value = 'true'::jsonb)
                OR EXISTS (SELECT 1 FROM jsonb_each(coalesce(day_val -> 'dr', '{}'::jsonb)) e
                            WHERE e.value = 'true'::jsonb)
           ) AS days_done
      FROM public.bbf_athlete_progression p
      JOIN public.bbf_users u ON u.id = p.user_id AND u.deleted_at IS NULL
  )
  UPDATE public.bbf_athlete_progression p
     SET protocol_completed = (days.days_done >= v_required), updated_at = now()
    FROM days
   WHERE days.id = p.id
     AND p.protocol_completed IS DISTINCT FROM (days.days_done >= v_required);
  GET DIAGNOSTICS v_completed = ROW_COUNT;

  -- 3d · Guardian consent sync from the youth intake snapshot (ride-along keys
  --      on par_q_screen: {"guardian": {"name": ..., "consent": true}}).
  UPDATE public.bbf_athlete_progression p
     SET guardian_consent = true,
         guardian_consent_at = coalesce(p.guardian_consent_at, u.par_q_screened_at, now()),
         updated_at = now()
    FROM public.bbf_users u
   WHERE u.id = p.user_id AND u.deleted_at IS NULL
     AND p.guardian_consent IS DISTINCT FROM true
     AND (u.par_q_screen -> 'guardian' ->> 'consent') = 'true'
     AND coalesce(u.par_q_screen -> 'guardian' ->> 'name', '') <> '';
  GET DIAGNOSTICS v_consent = ROW_COUNT;

  -- 3e · Friction backfill for rows the trigger predates (delta-guarded).
  WITH fr AS (
    SELECT p.id,
           (SELECT round(avg(pain_score), 2)
              FROM (SELECT sf.pain_score FROM public.session_feedback sf
                     WHERE sf.user_id = p.user_id
                     ORDER BY sf.created_at DESC LIMIT 3) t) AS friction
      FROM public.bbf_athlete_progression p
  )
  UPDATE public.bbf_athlete_progression p
     SET friction_avg_last_3 = fr.friction, updated_at = now()
    FROM fr
   WHERE fr.id = p.id AND fr.friction IS NOT NULL
     AND p.friction_avg_last_3 IS DISTINCT FROM fr.friction;
  GET DIAGNOSTICS v_friction = ROW_COUNT;

  RETURN json_build_object(
    'ok', true,
    'days_required', v_required,
    'weeks_updated', v_weeks,
    'completion_updated', v_completed,
    'guardian_synced', v_consent,
    'friction_backfilled', v_friction
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_sp0_recompute_progression() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_sp0_recompute_progression() TO service_role;

COMMENT ON FUNCTION public.bbf_sp0_recompute_progression() IS
  'SP-0 Telemetry Custodian · nightly deterministic recompute of the Referee gate fields (mesocycle_week, protocol_completed, guardian_consent, friction backfill). Zero AI. Delta-guarded so the progression tripwire only re-fires for athletes whose telemetry actually moved.';

-- ── 4 · Nightly cron (03:10 UTC — after the lab recompute suite) ─────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'bbf-sp0-telemetry-custodian') THEN
    PERFORM cron.unschedule('bbf-sp0-telemetry-custodian');
  END IF;
END $$;

SELECT cron.schedule(
  'bbf-sp0-telemetry-custodian',
  '10 3 * * *',
  $job$ SELECT public.bbf_sp0_recompute_progression(); $job$
);

-- ── 5 · One-tap applier for founder-approved PHASE_PROMOTION cards ──────────
CREATE OR REPLACE FUNCTION public.bbf_apply_phase_promotion(p_action_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_card      record;
  v_promo     jsonb;
  v_user_id   uuid;
  v_next      jsonb;
  v_is_youth  boolean;
  v_consent   boolean;
  v_email     text;
  v_ac_id     uuid;
  v_from      text;
  v_to        text;
BEGIN
  SELECT * INTO v_card
    FROM public.coach_action_inbox
   WHERE id = p_action_id AND status = 'PENDING' AND type = 'PHASE_PROMOTION'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found_or_processed');
  END IF;

  v_promo := coalesce(v_card.proposed_plan_modification -> 'promotion', '{}'::jsonb);
  v_user_id := nullif(v_promo ->> 'user_id', '')::uuid;
  v_next := v_promo -> 'next_protocol';
  v_from := v_promo ->> 'from_phase';
  v_to := v_promo ->> 'to_phase';
  IF v_user_id IS NULL OR v_next IS NULL OR jsonb_typeof(v_next) <> 'object' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  -- Youth safety re-check at APPLY time (consent may have been revoked since staging).
  v_is_youth := coalesce((v_promo ->> 'is_youth')::boolean, false);
  IF v_is_youth THEN
    SELECT bool_or(guardian_consent) INTO v_consent
      FROM public.bbf_athlete_progression WHERE user_id = v_user_id;
    IF NOT coalesce(v_consent, false) THEN
      RETURN json_build_object('ok', false, 'error', 'guardian_consent_required');
    END IF;
  END IF;

  SELECT email INTO v_email
    FROM public.bbf_users WHERE id = v_user_id AND deleted_at IS NULL;
  IF v_email IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'athlete_not_found');
  END IF;

  UPDATE public.bbf_active_clients
     SET sports_protocol = v_next::text
   WHERE vault_email = v_email
  RETURNING id INTO v_ac_id;
  IF v_ac_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'active_client_not_found');
  END IF;

  -- New block starts now: archive the finished phase into phase_history, reset
  -- the week clock and completion state, clear the Day 1-7 check-off map.
  -- (This UPDATE fires the progression tripwire → Referee re-evaluates → week 1
  -- fails min_mesocycle_weeks → clean no-op. Loop-safe.)
  UPDATE public.bbf_athlete_progression
     SET phase_history = coalesce(phase_history, '[]'::jsonb) || jsonb_build_object(
           'phase', v_from, 'ended_at', now(), 'weeks', mesocycle_week,
           'promoted_to', v_to, 'via', 'founder_approved_dry_run'),
         mesocycle_started_at = now(),
         mesocycle_week = 1,
         protocol_completed = false,
         target_phase = NULL,
         updated_at = now()
   WHERE user_id = v_user_id;

  UPDATE public.bbf_users SET youth_progress = '{}'::jsonb WHERE id = v_user_id;

  UPDATE public.coach_action_inbox
     SET status = 'APPROVED', processed_at = now()
   WHERE id = p_action_id;

  RETURN json_build_object(
    'ok', true, 'applied', 'phase_promotion',
    'from_phase', v_from, 'to_phase', v_to, 'user_id', v_user_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_apply_phase_promotion(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_apply_phase_promotion(uuid) TO service_role;

COMMENT ON FUNCTION public.bbf_apply_phase_promotion(uuid) IS
  'SP-0 · one-tap applier for founder-approved PHASE_PROMOTION inbox cards. Applies the Referee-prebuilt next protocol to bbf_active_clients, archives the finished phase, resets the block clock + youth check-offs, marks the card APPROVED. service_role only (invoked via bbf-agent-brain apply_override).';

-- ── 6 · Run the custodian once now (backfill; fires bounded re-evaluations) ──
SELECT public.bbf_sp0_recompute_progression();
