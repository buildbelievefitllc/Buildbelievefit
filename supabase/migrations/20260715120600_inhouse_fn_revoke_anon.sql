-- In-House Equity Mandate · explicit anon revoke (§7) — follow-up to 120500
-- ----------------------------------------------------------------------------
-- Supabase grants EXECUTE explicitly to anon/authenticated/service_role via
-- ALTER DEFAULT PRIVILEGES, NOT through PUBLIC — so the prior `revoke ... from
-- public` was a no-op and `anon` retained EXECUTE. These SECURITY DEFINER
-- functions bypass RLS, so anon must be removed explicitly. authenticated
-- (admin console) + service_role keep access.
-- ----------------------------------------------------------------------------

revoke execute on function public.bbf_compute_acwr(uuid) from anon;
revoke execute on function public.query_research_embeddings(vector, float, int) from anon;
