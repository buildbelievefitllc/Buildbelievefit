-- provision_legacy_client_pins — REDACTED (credential material withheld from git)
-- ============================================================================
-- The live ledger entry (version 20260501045004) sets bcrypt PIN hashes for the
-- five legacy clients (ana / jacky / suzanna / jordan / wayne) directly on
-- bbf_users.pin_hash.
--
-- Those bcrypt ($2a$06$...) hashes are CREDENTIAL MATERIAL and are intentionally
-- NOT reproduced here: a 4-digit PIN behind bcrypt cost-6 is offline-crackable,
-- so committing the verbatim hashes to git would be a credential leak (violates
-- the "never commit secrets" rule). This is the ONE backfilled migration that is
-- deliberately not byte-verbatim — see the Terminal 3 reconciliation report.
--
-- The live database already holds these hashes. On a clean rebuild, provision
-- the PINs out-of-band (founder-delivered plaintext → bbf_verify_user_pin lazy
-- bcrypt migration, or a secret-managed seed). This placeholder only preserves
-- the migration's presence and ledger ordering without exposing secrets.
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'provision_legacy_client_pins: PIN hashes provisioned out-of-band; intentionally not stored in git.';
END $$;