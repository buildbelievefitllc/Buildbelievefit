-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — YOUTH INTAKE: SPORT / POSITION SELECTION PERSISTENCE
-- ═══════════════════════════════════════════════════════════════════════════
-- Extends the youth first-run intake gate: the athlete now picks their primary
-- sport + position/event in the intake, and that choice persists to dedicated
-- profile columns (canonical ids — 'football'/'OL', 'track'/'sprints', …) and
-- drives the Sports Hub's sport-aware tabs.
--
--   • bbf_users.sport / bbf_users.position  — the persisted selection.
--   • bbf_submit_youth_intake  — now also writes sport/position from the payload
--     (token-gated, user resolved from the bearer token — unchanged security model).
--   • bbf_get_youth_intake_status — now also returns sport/position so a RETURNING
--     athlete's Hub renders their chosen sport (anon-safe: ids only, no clinical data).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE. No secrets stored.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS sport      text,
  ADD COLUMN IF NOT EXISTS "position" text;

-- ─── Status read — completion + persisted sport/position (canonical ids) ─────
CREATE OR REPLACE FUNCTION public.bbf_get_youth_intake_status(p_uid text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT json_build_object(
    'ok', true,
    'completed', coalesce((
      SELECT u.par_q_screened_at IS NOT NULL
        FROM public.bbf_users u WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL LIMIT 1
    ), false),
    'screened_at', (
      SELECT u.par_q_screened_at FROM public.bbf_users u WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL LIMIT 1
    ),
    'sport', (
      SELECT u.sport FROM public.bbf_users u WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL LIMIT 1
    ),
    'position', (
      SELECT u."position" FROM public.bbf_users u WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL LIMIT 1
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_youth_intake_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_youth_intake_status(text)
  TO anon, authenticated, service_role;

-- ─── Intake write — PAR-Q snapshot + cardiac_clearance + sport/position ──────
CREATE OR REPLACE FUNCTION public.bbf_submit_youth_intake(
  p_uid           text,
  p_session_token text,
  p_payload       jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id    uuid;
  v_now        timestamptz := now();
  v_yes        int;
  v_classified text;
  v_snapshot   jsonb;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id INTO v_user_id
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT count(*) INTO v_yes
    FROM jsonb_each(coalesce(p_payload->'answers', '{}'::jsonb)) e
   WHERE e.value IN ('true'::jsonb, '"yes"'::jsonb);
  v_classified := CASE WHEN v_yes = 0 THEN 'self_attested'
                       WHEN v_yes = 1 THEN 'restricted'
                       ELSE 'contraindicated' END;

  v_snapshot := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'version',     'parq+_2014',
    'classified',  v_classified,
    'screened_at', to_jsonb(v_now),
    'attested_by', p_uid,
    'source',      'youth_intake_gate'
  );

  UPDATE public.bbf_users
     SET par_q_screen      = v_snapshot,
         par_q_screened_at = v_now,
         cardiac_clearance = v_classified,
         sport             = coalesce(nullif(p_payload->>'sport', ''), sport),
         "position"        = coalesce(nullif(p_payload->>'position', ''), "position")
   WHERE id = v_user_id;

  RETURN json_build_object(
    'ok', true,
    'screened_at', v_now,
    'cardiac_clearance', v_classified,
    'sport', nullif(p_payload->>'sport', ''),
    'position', nullif(p_payload->>'position', '')
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_submit_youth_intake(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_submit_youth_intake(text, text, jsonb)
  TO anon, authenticated, service_role;
