-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — YOUTH FIRST-RUN INTAKE GATE (PAR-Q+ persistence RPCs)
-- ═══════════════════════════════════════════════════════════════════════════
-- The youth routing fork (frontend) blocks a flagged sports athlete from The
-- Sports Hub until they complete a forced PAR-Q+ intake. These two RPCs are the
-- server side of that gate. NO schema change: the intake reuses the EXISTING
-- clinical PAR-Q columns on bbf_users (par_q_screen jsonb / par_q_screened_at
-- timestamptz / cardiac_clearance text), so a youth athlete's self-screen feeds
-- the SAME pipeline the admin dossier, RiskTelemetry, and the agentic
-- orchestrator already read — instead of a parallel, ignored column.
--
-- Security model is IDENTICAL to bbf_sync_readiness / bbf_sync_vault_session:
--   • The WRITE is authorized purely by the 24h vault bearer token in
--     bbf_vault_sessions; user_id is resolved FROM THE TOKEN, never trusted from
--     the caller (cross-user forgery impossible). SECURITY DEFINER bypasses the
--     anon RLS lockdown as owner.
--   • The STATUS read is anon-safe: it exposes only a completion boolean +
--     timestamp, never the clinical payload.
--   • cardiac_clearance is derived from the user-ATTESTED answers (standard
--     PAR-Q+ rule: 0 yes → self_attested · 1 → restricted · 2+ →
--     contraindicated), mirroring the legacy monolith's _classifyPARQ verbatim.
--     NEVER AI-set — the athlete attests; the function only records + classifies.
--
-- Idempotent: CREATE OR REPLACE. No secrets stored.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Status read — anon-safe (booleans only, never the clinical snapshot) ──
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
        FROM public.bbf_users u
       WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL
       LIMIT 1
    ), false),
    'screened_at', (
      SELECT u.par_q_screened_at
        FROM public.bbf_users u
       WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL
       LIMIT 1
    )
  );
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_youth_intake_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_youth_intake_status(text)
  TO anon, authenticated, service_role;

-- ─── 2. Intake write — token-gated; stamps par_q_screen + cardiac_clearance ──
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
  v_user_id       uuid;
  v_now           timestamptz := now();
  v_yes           int;
  v_classified    text;
  v_snapshot      jsonb;
BEGIN
  -- Authorize purely on the bearer token; p_uid is not trusted for auth.
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

  -- Standard PAR-Q+ classification from the ATTESTED answers (server-authoritative
  -- so a spoofed client classification can't downgrade a flagged screen).
  SELECT count(*) INTO v_yes
    FROM jsonb_each(coalesce(p_payload->'answers', '{}'::jsonb)) e
   WHERE e.value IN ('true'::jsonb, '"yes"'::jsonb);
  v_classified := CASE WHEN v_yes = 0 THEN 'self_attested'
                       WHEN v_yes = 1 THEN 'restricted'
                       ELSE 'contraindicated' END;

  -- Persist the snapshot in the canonical par_q_screen shape, overriding the
  -- safety-critical fields server-side. Youth-specific extras (guardian consent,
  -- liability ack, sport/position) ride along as additional keys — harmless to
  -- the canonical readers, which only consume answers/classified/screened_at.
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
         cardiac_clearance = v_classified
   WHERE id = v_user_id;

  RETURN json_build_object(
    'ok', true,
    'screened_at', v_now,
    'cardiac_clearance', v_classified
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_submit_youth_intake(text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_submit_youth_intake(text, text, jsonb)
  TO anon, authenticated, service_role;
