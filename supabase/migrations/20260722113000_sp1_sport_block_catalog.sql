-- ═══════════════════════════════════════════════════════════════════════════
-- SP-1 · SPORT PERIODIZATION CATALOG — baked, founder-approved training blocks
-- ═══════════════════════════════════════════════════════════════════════════
-- Kills the sport-agnostic WEEK_TEMPLATE ceiling: every (sport × position-group
-- × phase × tier) cell gets a REAL periodized 7-day week, designed once by
-- Sonnet (bbf-sport-periodization-bake), validated deterministically against
-- the Immutable Laws + youth plyo ceilings, and stored as a DRAFT that serves
-- to no athlete until the founder activates the bake batch. Serving is a $0
-- catalog read forever after (In-House Equity: bake once, bill once).
--
-- Day shape is WEEK_TEMPLATE-compatible ({label, focus, exercises:[{name, off,
-- in}]} | {label, focus, rest, restNote}) so the Hub's check-off, progress-
-- persistence, and off/in-season toggle rails keep working untouched.
--
--   • bbf_sport_block_catalog — the catalog. RLS enabled, zero policies
--     (service_role only); clients read ONLY through the token-gated RPC below.
--   • bbf_get_my_sport_block(uid, token) — athlete-centric read: resolves the
--     caller's sport/position/phase/tier SERVER-SIDE (bbf_users +
--     athlete_profiles + staged sports_protocol) and returns the approved cell
--     (position-group exact → 'general' fallback), or null → the Hub falls
--     back to the generic WEEK_TEMPLATE. Fail-open by design: catalog absence
--     never breaks the athlete's week.
--   • bbf_apply_catalog_batch(p_action_id) — one-tap founder activation of a
--     bake batch from its CATALOG_BAKE Action-Inbox card (drafts → approved).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.bbf_sport_block_catalog (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sport          text NOT NULL,                       -- normalized key: basketball/football/soccer/track/baseball/volleyball/softball/boxing/mma/general
  position_group text NOT NULL DEFAULT 'general',
  phase          integer NOT NULL CHECK (phase BETWEEN 1 AND 3),
  tier           text NOT NULL DEFAULT 'youth'
                   CHECK (tier IN ('youth','middle_school','high_school','collegiate')),
  block          jsonb NOT NULL,                      -- { days:[7 × WEEK_TEMPLATE-day-shape], coaching_focus, summary }
  status         text NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','approved','retired')),
  bake_batch     uuid,
  model          text,
  generated_at   timestamptz NOT NULL DEFAULT now(),
  approved_at    timestamptz,
  notes          text,
  UNIQUE (sport, position_group, phase, tier)
);

COMMENT ON TABLE public.bbf_sport_block_catalog IS
  'SP-1 · Sonnet-baked, deterministically-validated, founder-approved periodized training blocks per sport/position-group/phase/tier. Drafts never serve. RLS zero-policy (service_role only) — client reads go through bbf_get_my_sport_block.';

CREATE INDEX IF NOT EXISTS bbf_sport_block_catalog_serve_idx
  ON public.bbf_sport_block_catalog (sport, position_group, phase, tier) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS bbf_sport_block_catalog_batch_idx
  ON public.bbf_sport_block_catalog (bake_batch, status);

ALTER TABLE public.bbf_sport_block_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.bbf_sport_block_catalog FROM public, anon, authenticated;

-- ── Sport-key normalizer (SQL twin of sports-engine normalizeSportKey) ──────
CREATE OR REPLACE FUNCTION public._bbf_normalize_sport_key(p_sport text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE
    WHEN s = '' OR s = 'none' OR s = 'other' THEN 'general'
    WHEN s LIKE '%basket%' THEN 'basketball'
    WHEN s LIKE '%foot%' OR s LIKE '%gridiron%' THEN 'football'
    WHEN s LIKE '%soccer%' OR s LIKE '%futbol%' THEN 'soccer'
    WHEN s LIKE '%track%' OR s LIKE '%sprint%' OR s LIKE '%field%' THEN 'track'
    WHEN s LIKE '%softball%' THEN 'softball'
    WHEN s LIKE '%base%' THEN 'baseball'
    WHEN s LIKE '%volley%' THEN 'volleyball'
    WHEN s LIKE '%box%' THEN 'boxing'
    WHEN s LIKE '%mma%' OR s LIKE '%martial%' THEN 'mma'
    ELSE s
  END
  FROM (SELECT lower(trim(coalesce(p_sport, ''))) AS s) t;
$function$;

-- ── Athlete-centric approved-block read (token-gated, fail-open to null) ────
CREATE OR REPLACE FUNCTION public.bbf_get_my_sport_block(
  p_uid           text,
  p_session_token text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id  uuid;
  v_sport    text;
  v_position text;
  v_email    text;
  v_tier     text := 'youth';
  v_phase    integer := 1;
  v_proto    text;
  v_row      record;
BEGIN
  IF p_session_token IS NULL OR length(p_session_token) = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT s.user_id, u.sport, u."position", u.email
    INTO v_user_id, v_sport, v_position, v_email
    FROM public.bbf_vault_sessions s
    JOIN public.bbf_users u ON u.id = s.user_id AND u.deleted_at IS NULL
   WHERE s.token::text = p_session_token
     AND s.expires_at > now()
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_session');
  END IF;

  SELECT coalesce(current_tier, 'youth') INTO v_tier
    FROM public.athlete_profiles WHERE user_id = v_user_id
    ORDER BY id LIMIT 1;
  v_tier := coalesce(v_tier, 'youth');

  SELECT ac.sports_protocol INTO v_proto
    FROM public.bbf_active_clients ac WHERE ac.vault_email = v_email LIMIT 1;
  IF v_proto IS NOT NULL THEN
    BEGIN
      v_phase := greatest(1, least(3, coalesce((v_proto::jsonb ->> 'phase_number')::integer, 1)));
    EXCEPTION WHEN others THEN
      v_phase := 1;
    END;
  END IF;

  -- Exact position-group first, then the sport's 'general' cell. Approved only.
  SELECT * INTO v_row
    FROM public.bbf_sport_block_catalog c
   WHERE c.sport = public._bbf_normalize_sport_key(v_sport)
     AND c.phase = v_phase
     AND c.tier = v_tier
     AND c.status = 'approved'
     AND c.position_group IN (lower(coalesce(v_position, 'general')), 'general')
   ORDER BY CASE WHEN c.position_group = lower(coalesce(v_position, 'general')) THEN 0 ELSE 1 END
   LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN json_build_object('ok', true, 'block', NULL, 'phase', v_phase, 'tier', v_tier);
  END IF;

  RETURN json_build_object(
    'ok', true,
    'block', v_row.block,
    'phase', v_phase,
    'tier', v_tier,
    'sport', v_row.sport,
    'position_group', v_row.position_group,
    'catalog_id', v_row.id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_get_my_sport_block(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_get_my_sport_block(text, text) TO anon, authenticated, service_role;

-- ── One-tap founder activation of a bake batch (CATALOG_BAKE inbox card) ────
CREATE OR REPLACE FUNCTION public.bbf_apply_catalog_batch(p_action_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_card     record;
  v_batch    uuid;
  v_approved integer := 0;
BEGIN
  SELECT * INTO v_card
    FROM public.coach_action_inbox
   WHERE id = p_action_id AND status = 'PENDING' AND type = 'CATALOG_BAKE'
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'not_found_or_processed');
  END IF;

  v_batch := nullif(v_card.proposed_plan_modification -> 'catalog_bake' ->> 'batch_id', '')::uuid;
  IF v_batch IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  UPDATE public.bbf_sport_block_catalog
     SET status = 'approved', approved_at = now()
   WHERE bake_batch = v_batch AND status = 'draft';
  GET DIAGNOSTICS v_approved = ROW_COUNT;

  UPDATE public.coach_action_inbox
     SET status = 'APPROVED', processed_at = now()
   WHERE id = p_action_id;

  RETURN json_build_object('ok', true, 'applied', 'catalog_batch', 'batch_id', v_batch, 'blocks_approved', v_approved);
END;
$function$;

REVOKE ALL ON FUNCTION public.bbf_apply_catalog_batch(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_apply_catalog_batch(uuid) TO service_role;

COMMENT ON FUNCTION public.bbf_apply_catalog_batch(uuid) IS
  'SP-1 · one-tap founder activation of a periodization bake batch from its CATALOG_BAKE Action-Inbox card. Drafts in the batch flip to approved; the card closes APPROVED. service_role only.';
