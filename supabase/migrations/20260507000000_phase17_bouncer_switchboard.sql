-- ═══════════════════════════════════════════════════════════════
-- Phase 17 — The Bouncer & The Switchboard
-- ═══════════════════════════════════════════════════════════════
-- Adds the admin tier-override RPC (the "Switchboard" backend) and
-- grandfathers all existing non-akeem users to subscription_tier =
-- 'gateway' so the new Phase 17 login bouncer doesn't lock anyone
-- out at deploy time.
--
-- Allowed tier slugs:
--   lite, gateway, architect, sovereign, youth_athlete,
--   nutrition_essentials, nutrition_platinum
--
-- Safety net per CEO directive: bbf_admin_set_tier rejects any
-- attempt to set akeem to a tier other than 'sovereign'. The CEO
-- can never accidentally lock himself out via the Switchboard UI.
--
-- Apply via Supabase MCP after merge.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.bbf_admin_set_tier(
  p_uid  text,
  p_tier text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_allowed_tiers text[] := ARRAY[
    'lite','gateway','architect','sovereign',
    'youth_athlete','nutrition_essentials','nutrition_platinum'
  ];
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 THEN
    RAISE EXCEPTION 'invalid_uid';
  END IF;

  IF p_tier IS NULL OR NOT (p_tier = ANY(v_allowed_tiers)) THEN
    RAISE EXCEPTION 'invalid_tier';
  END IF;

  -- CEO safety net: akeem is permanently sovereign.
  IF p_uid = 'akeem' AND p_tier <> 'sovereign' THEN
    RAISE EXCEPTION 'akeem_locked_to_sovereign';
  END IF;

  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  UPDATE public.bbf_users
     SET subscription_tier = p_tier,
         updated_at        = NOW()
   WHERE id = v_user_id;

  RETURN p_tier;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text) TO anon, authenticated;

-- ─── Grandfather backfill ──────────────────────────────────────
-- All existing users with NULL subscription_tier get 'gateway' so
-- the legacy demo clients (ana_bbf, jacky_bbf, suzanna_bbf,
-- jordan_bbf, wayne_bbf) can be used to test Gateway-tier
-- restrictions. akeem retains sovereign (set by Phase 16 backfill).
-- Idempotent.
UPDATE public.bbf_users
   SET subscription_tier = 'gateway',
       updated_at        = NOW()
 WHERE subscription_tier IS NULL
   AND uid <> 'akeem';
