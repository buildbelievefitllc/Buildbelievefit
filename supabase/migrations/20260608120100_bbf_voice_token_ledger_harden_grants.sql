-- Harden the voice-ledger RPCs. Supabase default-grants EXECUTE on new public
-- functions to anon + authenticated; these SECURITY DEFINER functions must be
-- callable ONLY by the service-role WS proxy. Otherwise anon could probe any
-- user's balance (precheck) or inflate/burn a victim's quota (commit).
-- Also pin the SQL helper's search_path (advisor: function_search_path_mutable).
revoke all on function public._bbf_voice_token_ceiling(text)        from anon, authenticated;
revoke all on function public.bbf_voice_session_precheck(uuid)      from anon, authenticated;
revoke all on function public.bbf_voice_session_commit(text,bigint) from anon, authenticated;
alter function public._bbf_voice_token_ceiling(text) set search_path = public, pg_temp;
