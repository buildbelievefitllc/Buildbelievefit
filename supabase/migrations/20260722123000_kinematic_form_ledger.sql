-- ═══════════════════════════════════════════════════════════════════════════
-- KINEMATIC PRIVACY · THE FORM LEDGER — numerical biomechanical telemetry ONLY
-- ═══════════════════════════════════════════════════════════════════════════
-- PRIVACY CONTRACT (binding — enforced by design, documented here):
--   • Raw media NEVER persists. The athlete's image exists only in the
--     bbf-agentic-kinematics request memory for the duration of the vision
--     call; there is no storage upload, no media column, no raw-frame cache.
--     Video is not accepted at all (single-frame stills only).
--   • What persists is the NUMERICAL/TEXT extraction only: form_score (0-100),
--     the two anatomic observations, the correction cue, lift, locale, model.
--   • This table deliberately has no bytea/media/url columns. Adding one is a
--     privacy-contract change requiring an explicit CEO order.
--
-- The ledger is what unlocks longitudinal form intelligence (SP-5/CX-8): the
-- worst cue becomes next session's camera check, the trend line feeds the
-- dossier, the Guardian Wire reports "scans this month + zero red flags".
--
--   • bbf_form_ledger — RLS enabled, zero policies (service_role writes from
--     the edge fn; reads via the token-gated RPC below).
--   • bbf_get_my_form_ledger(uid, token) — the athlete's own recent scans.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bbf_form_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  uid_slug        text NOT NULL,
  lift_name       text NOT NULL,
  form_score      integer NOT NULL CHECK (form_score BETWEEN 0 AND 100),
  kinematic_flags jsonb NOT NULL DEFAULT '[]'::jsonb,
  correction_cue  text NOT NULL DEFAULT '',
  locale          text,
  model           text,
  scanned_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.bbf_form_ledger IS
  'Kinematic Form Ledger · numerical biomechanical telemetry ONLY (score, 2 anatomic flags, 1 cue). PRIVACY CONTRACT: raw media never persists anywhere — images are transient in the vision request; this table has no media columns by design. RLS zero-policy: service_role writes, token-gated RPC reads.';

CREATE INDEX IF NOT EXISTS bbf_form_ledger_user_idx
  ON public.bbf_form_ledger (user_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS bbf_form_ledger_slug_idx
  ON public.bbf_form_ledger (uid_slug, scanned_at DESC);
CREATE INDEX IF NOT EXISTS bbf_form_ledger_lift_idx
  ON public.bbf_form_ledger (user_id, lift_name, scanned_at DESC);

ALTER TABLE public.bbf_form_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bbf_form_ledger FROM public, anon, authenticated;

-- ── Athlete's own scan history (token-gated; powers the trend line + the
--    "re-check this cue" card) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.bbf_get_my_form_ledger(
  p_uid           text,
  p_session_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_slug    text;
  v_scans   json;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;
  SELECT s.user_id, u.uid INTO v_user_id, v_slug
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token AND s.expires_at > now()
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(json_agg(json_build_object(
           'lift_name', lift_name,
           'form_score', form_score,
           'kinematic_flags', kinematic_flags,
           'correction_cue', correction_cue,
           'scanned_at', scanned_at
         ) ORDER BY scanned_at DESC), '[]'::json)
    INTO v_scans
    FROM (
      SELECT * FROM public.bbf_form_ledger
       WHERE user_id = v_user_id OR uid_slug = v_slug
       ORDER BY scanned_at DESC LIMIT 50
    ) t;

  RETURN json_build_object('ok', true, 'scans', v_scans);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_my_form_ledger(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_my_form_ledger(text, text) TO anon, authenticated, service_role;
