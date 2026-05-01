-- Phase 8 — Sovereign Trial: wire bbf_users to the Command Center toggle.
-- Adds trial_status / trial_start_date / updated_at columns and a
-- SECURITY DEFINER RPC the admin Command Center calls to flip state by slug.
-- Mirrors the trust pattern used by bbf_get_uid_map and bbf_verify_admin_pin.

ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS trial_status text DEFAULT 'inactive'
    CHECK (trial_status IN ('inactive','active','completed')),
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.bbf_set_trial_status(
  p_uid text,
  p_active boolean
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.bbf_users WHERE uid = p_uid LIMIT 1;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'user_not_found', 'uid', p_uid);
  END IF;

  UPDATE public.bbf_users
  SET trial_status     = CASE WHEN p_active THEN 'active' ELSE 'inactive' END,
      trial_start_date = CASE WHEN p_active THEN now() ELSE trial_start_date END,
      updated_at       = now()
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'uid', p_uid,
    'trial_status', CASE WHEN p_active THEN 'active' ELSE 'inactive' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.bbf_set_trial_status(text, boolean) TO anon, authenticated;

COMMENT ON FUNCTION public.bbf_set_trial_status(text, boolean) IS
  'Phase 8 — admin Command Center toggle. Resolves slug -> uuid then sets trial_status. SECURITY DEFINER bypasses RLS-on/no-policy default on bbf_users.';
