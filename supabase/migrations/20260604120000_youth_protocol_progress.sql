-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — YOUTH PROTOCOL PROGRESS (Day 1–7 check-off persistence)
-- ═══════════════════════════════════════════════════════════════════════════
-- The youth Daily Execution Protocol's check-offs (workout exercises, drills,
-- film study) now persist to the athlete's row so the Command Center can track
-- compliance and the athlete's completed tasks survive refresh / logout.
--
--   • bbf_users.youth_progress (jsonb) — the per-day tracking map:
--       { "Day 1": { "ex": {"0":true}, "dr": {"0":true}, "fm": {"0":"complete"} }, … }
--     ex/dr are booleans (done); fm holds the film card's status.
--   • bbf_log_youth_progress — token-gated per-tap writer (same security model as
--     bbf_sync_readiness / bbf_submit_youth_intake: user_id resolved FROM the vault
--     bearer token, never the caller). Validates the addressing (Day 1–7 · ex/dr/fm ·
--     small index) so a caller can never write arbitrary keys into the row.
--   • bbf_get_youth_intake_status — now also returns youth_progress so the Hub
--     restores every check-off on load (anon-safe: check-off state only).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS youth_progress jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── Status read — now carries the persisted per-day progress map ────────────
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
    ),
    'youth_progress', coalesce((
      SELECT u.youth_progress FROM public.bbf_users u WHERE u.uid = lower(p_uid) AND u.deleted_at IS NULL LIMIT 1
    ), '{}'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_youth_intake_status(text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_youth_intake_status(text)
  TO anon, authenticated, service_role;

-- ─── Per-tap check-off writer — token-gated, addressing-validated ────────────
CREATE OR REPLACE FUNCTION public.bbf_log_youth_progress(
  p_uid           text,
  p_session_token text,
  p_day           text,
  p_kind          text,
  p_index         text,
  p_value         jsonb DEFAULT 'false'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id  uuid;
  v_protocol jsonb;
  v_day      jsonb;
  v_kind     jsonb;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  -- Reject anything but a known Day · kind · small index so the JSONB can't be
  -- used as an arbitrary key/value store on the user row.
  IF p_day !~ '^Day [1-7]$' OR p_kind NOT IN ('ex', 'dr', 'fm') OR p_index !~ '^[0-9]{1,2}$' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_target');
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

  -- Merge the single leaf into the nested map (build each level so a brand-new
  -- day/kind path is created without clobbering siblings).
  SELECT coalesce(youth_progress, '{}'::jsonb) INTO v_protocol
    FROM public.bbf_users WHERE id = v_user_id;
  v_day  := coalesce(v_protocol -> p_day, '{}'::jsonb);
  v_kind := coalesce(v_day -> p_kind, '{}'::jsonb);
  v_kind := jsonb_set(v_kind, ARRAY[p_index], coalesce(p_value, 'false'::jsonb), true);
  v_day  := jsonb_set(v_day, ARRAY[p_kind], v_kind, true);
  v_protocol := jsonb_set(v_protocol, ARRAY[p_day], v_day, true);

  UPDATE public.bbf_users SET youth_progress = v_protocol WHERE id = v_user_id;

  RETURN json_build_object('ok', true, 'youth_progress', v_protocol);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_log_youth_progress(text, text, text, text, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_log_youth_progress(text, text, text, text, text, jsonb)
  TO anon, authenticated, service_role;
