-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — PATH 2: RLS USER-ISOLATION LOCKDOWN (Phase F)
-- ═══════════════════════════════════════════════════════════════════════════
-- Closes the live data-exfiltration hole: bbf_sets / bbf_readiness /
-- bbf_meal_logs / bbf_logs carried blanket `Allow Anon Select/Insert` policies
-- (qual=true) granted to the anon role. Because the anon key ships in the
-- public client bundle, anyone could read/write every user's rows; bbf_logs
-- even allowed anon DELETE of all rows. (These permissive policies were
-- production drift — not present in any prior migration.)
--
-- Depends on: 20260601120000_supabase_auth_backfill (auth.uid() now resolves
-- to bbf_users.id, which every child user_id references).
--
-- MODEL:
--   • Clients (role `authenticated`): may SELECT/INSERT/UPDATE only their own
--     rows (user_id = auth.uid()). No client DELETE (least privilege; the
--     directive grants clients S/I/U only).
--   • Admin / CEO / Sentinel auditors: overarching read/write across ALL rows,
--     including DELETE, via public.bbf_is_admin() (keyed on bbf_users.role).
--   • anon: no policies => no access. service_role + SECURITY DEFINER RPCs
--     bypass RLS and are unaffected (the real server write path keeps working).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Admin predicate (SECURITY DEFINER avoids RLS recursion on bbf_users) ─
CREATE OR REPLACE FUNCTION public.bbf_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bbf_users
    WHERE id = auth.uid()
      AND role IN ('trainer', 'admin', 'ceo', 'founder')
  );
$$;
REVOKE ALL ON FUNCTION public.bbf_is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.bbf_is_admin() TO authenticated, service_role;

-- ─── 1. Ensure RLS is enabled (idempotent) ─────────────────────────────────
ALTER TABLE public.bbf_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_sets      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bbf_meal_logs ENABLE ROW LEVEL SECURITY;

-- ─── 2. Drop the dangerously permissive anon policies (drift) ──────────────
DROP POLICY IF EXISTS "Allow Anon Select Logs"      ON public.bbf_logs;
DROP POLICY IF EXISTS "Allow Anon Insert Logs"      ON public.bbf_logs;
DROP POLICY IF EXISTS "Allow Anon Delete Logs"      ON public.bbf_logs;
DROP POLICY IF EXISTS "Allow Anon Select Sets"      ON public.bbf_sets;
DROP POLICY IF EXISTS "Allow Anon Insert Sets"      ON public.bbf_sets;
DROP POLICY IF EXISTS "Allow Anon Select Readiness" ON public.bbf_readiness;
DROP POLICY IF EXISTS "Allow Anon Insert Readiness" ON public.bbf_readiness;
DROP POLICY IF EXISTS "Allow Anon Select Meal Logs" ON public.bbf_meal_logs;
DROP POLICY IF EXISTS "Allow Anon Insert Meal Logs" ON public.bbf_meal_logs;

-- ─── 3. Table grants for the authenticated role (RLS still gates rows) ──────
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbf_logs      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbf_sets      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbf_readiness TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bbf_meal_logs TO authenticated;

-- ─── 4. Per-user isolation policies (owner OR admin) ───────────────────────
-- bbf_logs ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bbf_logs owner or admin select" ON public.bbf_logs;
CREATE POLICY "bbf_logs owner or admin select" ON public.bbf_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_logs owner or admin insert" ON public.bbf_logs;
CREATE POLICY "bbf_logs owner or admin insert" ON public.bbf_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_logs owner or admin update" ON public.bbf_logs;
CREATE POLICY "bbf_logs owner or admin update" ON public.bbf_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin())
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_logs admin delete" ON public.bbf_logs;
CREATE POLICY "bbf_logs admin delete" ON public.bbf_logs
  FOR DELETE TO authenticated
  USING (public.bbf_is_admin());

-- bbf_sets ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bbf_sets owner or admin select" ON public.bbf_sets;
CREATE POLICY "bbf_sets owner or admin select" ON public.bbf_sets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_sets owner or admin insert" ON public.bbf_sets;
CREATE POLICY "bbf_sets owner or admin insert" ON public.bbf_sets
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_sets owner or admin update" ON public.bbf_sets;
CREATE POLICY "bbf_sets owner or admin update" ON public.bbf_sets
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin())
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_sets admin delete" ON public.bbf_sets;
CREATE POLICY "bbf_sets admin delete" ON public.bbf_sets
  FOR DELETE TO authenticated
  USING (public.bbf_is_admin());

-- bbf_readiness ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bbf_readiness owner or admin select" ON public.bbf_readiness;
CREATE POLICY "bbf_readiness owner or admin select" ON public.bbf_readiness
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_readiness owner or admin insert" ON public.bbf_readiness;
CREATE POLICY "bbf_readiness owner or admin insert" ON public.bbf_readiness
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_readiness owner or admin update" ON public.bbf_readiness;
CREATE POLICY "bbf_readiness owner or admin update" ON public.bbf_readiness
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin())
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_readiness admin delete" ON public.bbf_readiness;
CREATE POLICY "bbf_readiness admin delete" ON public.bbf_readiness
  FOR DELETE TO authenticated
  USING (public.bbf_is_admin());

-- bbf_meal_logs ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "bbf_meal_logs owner or admin select" ON public.bbf_meal_logs;
CREATE POLICY "bbf_meal_logs owner or admin select" ON public.bbf_meal_logs
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_meal_logs owner or admin insert" ON public.bbf_meal_logs;
CREATE POLICY "bbf_meal_logs owner or admin insert" ON public.bbf_meal_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_meal_logs owner or admin update" ON public.bbf_meal_logs;
CREATE POLICY "bbf_meal_logs owner or admin update" ON public.bbf_meal_logs
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bbf_is_admin())
  WITH CHECK (user_id = auth.uid() OR public.bbf_is_admin());

DROP POLICY IF EXISTS "bbf_meal_logs admin delete" ON public.bbf_meal_logs;
CREATE POLICY "bbf_meal_logs admin delete" ON public.bbf_meal_logs
  FOR DELETE TO authenticated
  USING (public.bbf_is_admin());
