-- 20260621120000_youth_intake_status_profile_completeness.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- LEGACY ATHLETE BACK-POPULATION · gate signal.
--
-- The YouthIntakeGate must now intercept an athlete IF they have not cleared the
-- PAR-Q intake OR if their athlete_profiles record is missing/incomplete (no
-- birth_date or gender — the two values we cannot guess and that drive the tier
-- calc). To let the frontend make that decision, the status RPC now also reports:
--   • profile_complete — athlete_profiles row exists AND birth_date IS NOT NULL
--                        AND gender IS NOT NULL.
--   • birth_date / gender — the existing values, so the re-gated intake form can
--                           pre-fill anything already on file (minimize friction).
-- sport/position now coalesce bbf_users → athlete_profiles so the pre-fill survives
-- even if only one surface carries the selection. All prior fields are preserved.

CREATE OR REPLACE FUNCTION public.bbf_get_youth_intake_status(p_uid text)
 RETURNS json
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH u AS (
    SELECT * FROM public.bbf_users
    WHERE uid = lower(p_uid) AND deleted_at IS NULL
    LIMIT 1
  ),
  ap AS (
    SELECT a.birth_date, a.gender, a.sport AS ap_sport, a."position" AS ap_position
    FROM public.athlete_profiles a
    JOIN u ON a.user_id = u.id
    LIMIT 1
  )
  SELECT json_build_object(
    'ok', true,
    'completed', coalesce((SELECT par_q_screened_at IS NOT NULL FROM u), false),
    'screened_at', (SELECT par_q_screened_at FROM u),
    'sport', coalesce((SELECT sport FROM u), (SELECT ap_sport FROM ap)),
    'position', coalesce((SELECT "position" FROM u), (SELECT ap_position FROM ap)),
    'birth_date', (SELECT birth_date FROM ap),
    'gender', (SELECT gender FROM ap),
    'profile_complete', coalesce(
      (SELECT birth_date IS NOT NULL AND gender IS NOT NULL FROM ap), false
    ),
    'youth_progress', coalesce((SELECT youth_progress FROM u), '{}'::jsonb)
  );
$function$;
