-- In-House Equity Mandate · lock down the new SECURITY DEFINER functions (§7)
-- ----------------------------------------------------------------------------
-- New functions inherit a default EXECUTE grant to PUBLIC, which lets the `anon`
-- role invoke them over /rest/v1/rpc. These are SECURITY DEFINER (they bypass
-- RLS), so anon exposure would leak athlete load data / vault search past the
-- authenticated-only boundary. Revoke the blanket PUBLIC grant; the explicit
-- grants to authenticated + service_role (set in their own migrations) remain.
-- The trigger function must not be RPC-callable at all — only the trigger fires
-- it (as the table owner), so strip every role.
-- ----------------------------------------------------------------------------

-- Athlete ACWR + vault search: authenticated (admin console) + service_role only.
revoke execute on function public.bbf_compute_acwr(uuid) from public;
revoke execute on function public.query_research_embeddings(vector, float, int) from public;

-- Trigger function: never called directly. Strip all callable roles.
revoke execute on function public.tg_research_vault_embed() from public, anon, authenticated;
