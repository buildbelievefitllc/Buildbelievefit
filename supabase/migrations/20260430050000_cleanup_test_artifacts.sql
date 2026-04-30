-- 1. Remove legacy test user (PIN-auth row that predates real provisioning)
DELETE FROM public.bbf_users WHERE uid = 'akeem_bbf';

-- 2. NULL out test plan content on the founder's active_clients row.
-- The row itself stays — akeemkbrown@gmail.com is a real future client.
-- Only the development-era plan content is being cleared so the next
-- /provision run writes fresh data.
UPDATE public.bbf_active_clients
SET workout_plan       = NULL,
    meal_plan          = NULL,
    plans_generated_at = NULL,
    vault_email        = NULL
WHERE client_email = 'akeemkbrown@gmail.com';
