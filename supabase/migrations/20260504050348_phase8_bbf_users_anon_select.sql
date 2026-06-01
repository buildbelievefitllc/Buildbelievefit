-- Phase 8: enable anon SELECT on bbf_users so the Panopticon adapter
-- can fetch the roster. Mirrors the bbf_audit_logs / bbf_athlete_progression
-- RLS pattern (CEO Phase 5 Q4 sign-off — defer JWT auth.uid() refactor
-- to a dedicated security-hardening sprint).
DROP POLICY IF EXISTS "Allow Anon Select" ON public.bbf_users;
CREATE POLICY "Allow Anon Select" ON public.bbf_users
  FOR SELECT TO anon USING (true);