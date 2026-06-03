-- ═══════════════════════════════════════════════════════════════════════════
-- BBF WEARABLE — lock down the ingest-token verification oracle
-- ═══════════════════════════════════════════════════════════════════════════
-- public.bbf_check_ingest_token(text) returns a boolean "does this token match the
-- Vault secret" — it must be callable ONLY by service_role (the edge function),
-- never by anon/authenticated, or it becomes a public token oracle via PostgREST.
--
-- Supabase applies ALTER DEFAULT PRIVILEGES that auto-GRANT EXECUTE on new public
-- functions to anon + authenticated; `REVOKE … FROM PUBLIC` does NOT remove those
-- explicit role grants. So we revoke them explicitly here.
REVOKE EXECUTE ON FUNCTION public.bbf_check_ingest_token(text) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.bbf_check_ingest_token(text) TO service_role;
