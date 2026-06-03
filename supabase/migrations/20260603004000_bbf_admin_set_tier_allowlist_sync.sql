-- ════════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — bbf_admin_set_tier ALLOWLIST SYNC
-- Overwatch audit remediation · DB validator ↔ Command Center SETTABLE_TIERS
-- ════════════════════════════════════════════════════════════════════════════
-- The DB validator allowed only the 7 legacy Phase 17 slugs, so the Command
-- Center's `set_tier` action returned 400 ('invalid_tier') for every newer
-- monetization tier (catalyst, momentum, fuel_*, kickstart_*, …). This syncs
-- v_allowed_tiers to the EXACT 20-slug set in bbf-admin-roster SETTABLE_TIERS
-- (supabase/functions/bbf-admin-roster/index.ts).
--
-- The function body is otherwise reproduced VERBATIM from
-- 20260507000000_phase17_bouncer_switchboard.sql — the akeem-locked-to-sovereign
-- safety net, invalid_uid / user_not_found guards, the UPDATE, and the RETURN
-- are all preserved exactly.
--
-- ACCESS: re-asserts the post-revoke boundary from 20260603003000 — service_role
-- ONLY. anon/authenticated are intentionally NOT granted; the only callers are
-- the token-gated bbf-admin-roster edge function and the service-role monolith
-- /provision path. (CREATE OR REPLACE preserves the existing ACL, but we
-- re-assert it explicitly so this migration is correct in isolation.)
--
-- Idempotent: CREATE OR REPLACE + explicit grant re-assertion.
-- ════════════════════════════════════════════════════════════════════════════

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
  -- Synced to bbf-admin-roster SETTABLE_TIERS (Command Center · Access Control).
  v_allowed_tiers text[] := ARRAY[
    -- Vault / coaching subscription tiers
    'catalyst','momentum','autonomous',
    -- Fuel (nutrition) subscription tiers
    'fuel_foundation','fuel_performance','fuel_sovereign',
    -- Athlete program tiers
    'rising_athlete',
    'kickstart_6wk_3x','kickstart_6wk_4x',
    'transformation_8wk_3x','transformation_8wk_4x',
    'sovereign_12wk_3x','sovereign_12wk_4x',
    -- Legacy Phase 17 slugs (retained)
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

-- Re-assert the locked-down boundary (service_role only; never anon).
REVOKE EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_admin_set_tier(text, text) TO service_role;
