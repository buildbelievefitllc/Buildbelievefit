-- ═══════════════════════════════════════════════════════════════
-- Phase 16 — IRON VAULT V2: Sovereign Trial Hard-Lock
-- ═══════════════════════════════════════════════════════════════
-- Replaces the cosmetic Phase 8 trial surface with a server-enforced
-- gate. The Phase 8 (`trial_status` / `trial_start_date`) columns and
-- the `bbf_set_trial_status` RPC are dropped wholesale (CEO ruling:
-- Option A — Replace, keep the database clean). Two new columns and
-- three new SECURITY DEFINER RPCs replace them.
--
-- Tier 3 destructive operations (all CEO-authorized in the Phase 16
-- planning thread):
--   • DROP COLUMN bbf_users.trial_status
--   • DROP COLUMN bbf_users.trial_start_date
--   • DROP FUNCTION public.bbf_set_trial_status(text, boolean)
--
-- Apply order: this migration first (via Supabase MCP `apply_migration`).
-- Then Slice B backend deploy. Then Slice C frontend deploy.
-- ═══════════════════════════════════════════════════════════════

-- ─── 1. New columns on bbf_users ────────────────────────────────
-- subscription_tier: gateway / architect / sovereign / youth_athlete /
-- nutrition_essentials / nutrition_platinum. Nullable for now (migration
-- does not backfill from bbf_active_clients.tier — middleware treats
-- NULL as non-sovereign which is the safe default for the gate).
-- trial_expires_at: NULL means "no trial ever started" (eligible for
-- the 7-day mystery-box CTA). A past timestamp means "trial expired"
-- (greyed-out + paywall). A future timestamp means "trial active".
ALTER TABLE public.bbf_users
  ADD COLUMN IF NOT EXISTS subscription_tier text NULL,
  ADD COLUMN IF NOT EXISTS trial_expires_at  timestamptz NULL;

-- ─── 2. Drop the cosmetic Phase 8 surface ───────────────────────
-- updated_at stays — it's harmless and reused by other write paths.
ALTER TABLE public.bbf_users DROP COLUMN IF EXISTS trial_status;
ALTER TABLE public.bbf_users DROP COLUMN IF EXISTS trial_start_date;
DROP FUNCTION IF EXISTS public.bbf_set_trial_status(text, boolean);

-- ─── 3. bbf_start_trial — user-initiated 7-day opt-in ───────────
-- One-trial-per-uid hard lock: if trial_expires_at IS NOT NULL the
-- user has already consumed (or is consuming) their trial; reject.
-- Sovereign-tier short-circuit: paying customers don't need a trial.
-- Returns the new trial_expires_at on success; raises on rejection.
CREATE OR REPLACE FUNCTION public.bbf_start_trial(p_uid text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_existing_expires timestamptz;
  v_existing_tier text;
  v_new_expires timestamptz;
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 THEN
    RAISE EXCEPTION 'invalid_uid';
  END IF;

  SELECT id, trial_expires_at, subscription_tier
    INTO v_user_id, v_existing_expires, v_existing_tier
    FROM public.bbf_users
   WHERE uid = p_uid
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_existing_tier = 'sovereign' THEN
    RAISE EXCEPTION 'already_sovereign';
  END IF;

  IF v_existing_expires IS NOT NULL THEN
    RAISE EXCEPTION 'trial_already_consumed';
  END IF;

  v_new_expires := NOW() + INTERVAL '7 days';

  UPDATE public.bbf_users
     SET trial_expires_at = v_new_expires,
         updated_at       = NOW()
   WHERE id = v_user_id;

  RETURN v_new_expires;
END;
$$;

-- ─── 4. bbf_admin_set_trial — admin override ────────────────────
-- Replaces bbf_set_trial_status. p_grant=true sets trial_expires_at
-- to NOW() + 7 days (overwrites any prior value, including expired);
-- p_grant=false clears it back to NULL (user becomes eligible to
-- start a fresh trial — admin-driven reset). Mastermind Portal calls
-- this from the entitlements toggle.
CREATE OR REPLACE FUNCTION public.bbf_admin_set_trial(
  p_uid text,
  p_grant boolean
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_new_expires timestamptz;
BEGIN
  IF p_uid IS NULL OR length(p_uid) = 0 THEN
    RAISE EXCEPTION 'invalid_uid';
  END IF;

  SELECT id INTO v_user_id
    FROM public.bbf_users
   WHERE uid = p_uid
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF p_grant THEN
    v_new_expires := NOW() + INTERVAL '7 days';
  ELSE
    v_new_expires := NULL;
  END IF;

  UPDATE public.bbf_users
     SET trial_expires_at = v_new_expires,
         updated_at       = NOW()
   WHERE id = v_user_id;

  RETURN v_new_expires;
END;
$$;

-- ─── 5. bbf_get_trial_state — read path for fresh-fetch (Q4) ────
-- Frontend calls this on login and on tab focus to refresh the
-- localStorage cache. Returns subscription_tier + trial_expires_at;
-- middleware on the WS upgrade path is the actual source of truth,
-- this RPC just keeps the UI honest with the server.
CREATE OR REPLACE FUNCTION public.bbf_get_trial_state(p_uid text)
RETURNS TABLE(subscription_tier text, trial_expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subscription_tier, trial_expires_at
    FROM public.bbf_users
   WHERE uid = p_uid
   LIMIT 1;
$$;

-- ─── 6. Grants — match Phase 8 / Phase 9 RPC pattern ────────────
GRANT EXECUTE ON FUNCTION public.bbf_start_trial(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_admin_set_trial(text, boolean) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bbf_get_trial_state(text)     TO anon, authenticated;
