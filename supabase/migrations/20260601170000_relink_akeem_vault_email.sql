-- Phase 21.3 — Re-link the CEO's account to his generated plan.
-- akeem's bbf_users.email was NULL, so bbf_verify_user_pin's join
-- (bbf_active_clients.vault_email = bbf_users.email) could not resolve his
-- already-generated workout_plan/meal_plan (stored under vault_email
-- 'buildbelievefit@gmail.com', plans_generated_at 2026-05-10). Setting the
-- email makes his real plan flow to the frontend exactly like a standard client.
-- Scoped to akeem only and guarded so it is a no-op if already linked.
UPDATE public.bbf_users
   SET email = 'buildbelievefit@gmail.com'
 WHERE uid = 'akeem'
   AND email IS NULL
   AND deleted_at IS NULL;
