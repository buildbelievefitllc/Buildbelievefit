-- ═══════════════════════════════════════════════════════════════
-- Phase 8 — bbf_users anon SELECT policy
-- Date:    2026-05-04
-- Project: ihclbceghxpuawymlvgi (bbf-lab)
-- Author:  Claude (per CEO Phase 8 sign-off)
--
-- Purpose: Enable the Panopticon (admin global roster command center)
--          to fetch the athlete list. RLS was on for bbf_users with
--          zero policies, which silently no-op'd anon SELECTs (and
--          had been blocking fetchAllUsers / fetchUser / etc. in
--          bbf-sync.js without surfacing). This adds the missing
--          SELECT policy.
--
-- Sign-off: CEO Phase 5 Q4 — match the existing bbf_athlete_progression
--           RLS pattern (anon read/write, RLS enabled). Defer JWT
--           auth.uid() refactor to a dedicated security-hardening sprint.
--
-- Was applied via MCP at session time. This file exists for the audit
-- trail and re-application in fresh environments.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_users;
CREATE POLICY "Allow Anon Select" ON public.bbf_users
  FOR SELECT TO anon USING (true);

-- Verify:
-- SET LOCAL ROLE anon;
-- SELECT count(*) FROM public.bbf_users;  -- should return all rows
