-- ═══════════════════════════════════════════════════════════════════════════
-- BBF WEARABLE — Vault-backed webhook ingest token  (architecture pivot)
-- ═══════════════════════════════════════════════════════════════════════════
-- CEO-authorized pivot: the X-BBF-Admin-Token shared secret for the
-- bbf-wearable-ingest admin/webhook path moves OUT of a platform edge-env var
-- (the old BBF_WEARABLE_INGEST_TOKEN) and INTO Supabase Vault, verified by a
-- SECURITY DEFINER RPC. The edge function (service_role) calls
-- public.bbf_check_ingest_token() to validate the inbound header — no Deno.env
-- secret is required, so the pipe no longer depends on platform secret plumbing.
--
-- The secret VALUE is generated SERVER-SIDE here (extensions.gen_random_bytes(32),
-- 256-bit) and is NEVER written into this migration, git, or any log. Retrieve it
-- for sender configuration with:
--   SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='wearable_ingest_token';
--
-- IDEMPOTENT: the secret is created only if absent (re-running never rotates it),
-- and the generation is skipped entirely on environments without the vault schema.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── 1. Generate + store the 256-bit token in Vault (once) ──────────────────────
DO $$
BEGIN
  IF to_regclass('vault.secrets') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'wearable_ingest_token') THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'wearable_ingest_token',
      'X-BBF-Admin-Token shared secret for the bbf-wearable-ingest admin/webhook path (Whoop/Apple/Oura).'
    );
  END IF;
END $$;

-- ─── 2. Verify RPC — service_role only ──────────────────────────────────────────
-- Returns true iff the supplied token matches the Vault secret. SECURITY DEFINER so
-- it can read vault.decrypted_secrets; the raw secret never leaves the database.
CREATE OR REPLACE FUNCTION public.bbf_check_ingest_token(p_token text)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public', 'vault', 'extensions'
AS $function$
  SELECT EXISTS (
    SELECT 1
      FROM vault.decrypted_secrets
     WHERE name = 'wearable_ingest_token'
       AND p_token IS NOT NULL
       AND length(p_token) >= 16
       AND decrypted_secret = p_token
  );
$function$;

REVOKE ALL ON FUNCTION public.bbf_check_ingest_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bbf_check_ingest_token(text) TO service_role;
