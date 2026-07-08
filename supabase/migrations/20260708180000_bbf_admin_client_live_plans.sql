-- ═══════════════════════════════════════════════════════════════════════════
-- FRONTEND CENTRALIZATION · LIVE DATA BINDING — bbf_admin_client_live_plans
--
-- THE BUG: the dossier's `detail` action joins bbf_active_clients with an
-- UNORDERED limit=1 — an athlete with multiple intake rows hydrated from an
-- arbitrary (often oldest) row, so the Command Center showed stale plans (or
-- "no plan on file") while the athlete's app rendered the current one. The
-- join also never surfaced the clinical intake (age · height/weight ·
-- clinical history), leaving the dossier header context-blind.
--
-- THE FIX (additive RPC — same "don't redeploy the 940-line monolith" pattern
-- as the Manual Override RPCs, migration 20260609150000): one admin-gated read
-- that resolves the FRESHEST truth for a client:
--   • meal_plan / workout_plan / sports_protocol — bbf_users first (the login
--     source of truth that assign_workout / compile / the Forge write), then
--     the NEWEST bbf_active_clients mirror row (plans_generated_at desc,
--     nulls last — deterministic, never arbitrary).
--   • clinical intake — age, height_weight, clinical_history,
--     preferred_language from that same newest intake row.
-- The dossier merges this over the detail row after fetch, so the coach sees
-- exactly what the athlete's app will pull.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_admin_client_live_plans(
  p_session_token text,
  p_client_id     uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user record;
  v_ac   record;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select id, email, workout_plan, meal_plan, plans_generated_at
    into v_user
    from public.bbf_users
   where id = p_client_id and deleted_at is null
   limit 1;
  if v_user.id is null then
    return jsonb_build_object('ok', false, 'error', 'unknown_client');
  end if;

  -- Newest intake mirror row — ORDERED, never arbitrary.
  if v_user.email is not null then
    select workout_plan, meal_plan, sports_protocol, plans_generated_at,
           age, height_weight, clinical_history, preferred_language
      into v_ac
      from public.bbf_active_clients
     where lower(vault_email) = lower(v_user.email)
        or lower(client_email) = lower(v_user.email)
     order by plans_generated_at desc nulls last, created_at desc
     limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'workout_plan',       coalesce(v_user.workout_plan, v_ac.workout_plan),
    'meal_plan',          coalesce(v_user.meal_plan, v_ac.meal_plan),
    'sports_protocol',    v_ac.sports_protocol,
    'plans_generated_at', coalesce(v_user.plans_generated_at, v_ac.plans_generated_at),
    'age',                v_ac.age,
    'height_weight',      v_ac.height_weight,
    'clinical_history',   v_ac.clinical_history,
    'preferred_language', v_ac.preferred_language
  );
end;
$$;

grant execute on function public.bbf_admin_client_live_plans(text, uuid) to anon, authenticated, service_role;
