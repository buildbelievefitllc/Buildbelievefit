-- Phase B · enable the anon role to write/read bbf_readiness so the
-- somatic-engine → syncReadiness re-route can actually land rows.
-- Mirrors the wide-open pattern already in production for bbf_logs
-- (Allow Anon Insert/Select/Delete) and bbf_sets (Allow Anon Insert/
-- Select). Tightening to user_id = auth.uid() is deferred until
-- Supabase Auth is wired roster-wide (handoff §11 follow-up).

CREATE POLICY "Allow Anon Insert Readiness"
  ON public.bbf_readiness
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow Anon Select Readiness"
  ON public.bbf_readiness
  FOR SELECT
  TO anon
  USING (true);