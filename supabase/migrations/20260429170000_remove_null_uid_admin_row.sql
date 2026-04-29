-- ═══════════════════════════════════════════════════════════════════════════
-- BBF SUPABASE — REMOVE VESTIGIAL NULL-UID ADMIN ROW (Phase 3 P3 cleanup)
-- ═══════════════════════════════════════════════════════════════════════════
-- The bbf_users table contains a single row with uid=NULL, name=NULL,
-- role='admin', and a bcrypt pin_hash. This row is unreferenced by any of
-- the Phase 2 RPCs (bbf_verify_admin_pin, bbf_verify_user_pin,
-- bbf_admin_clear_lockout) — all three key on uid='akeem' and role='trainer'.
--
-- Likely created during early Phase 2 testing or via a direct dashboard
-- insert before the founder PIN flow was finalized. Vestigial.
--
-- Pre-migration  : bbf_users has 2 rows (akeem trainer + null-uid admin)
-- Post-migration : bbf_users has 1 row  (akeem trainer)
--
-- See api/RLS_HARDENING_AUDIT.md "Out-of-scope" section for the original
-- finding that flagged this row.
-- ═══════════════════════════════════════════════════════════════════════════

DELETE FROM public.bbf_users
WHERE uid IS NULL
  AND role = 'admin';
