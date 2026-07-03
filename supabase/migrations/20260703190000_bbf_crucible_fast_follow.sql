-- ═══════════════════════════════════════════════════════════════════════════
-- CRUCIBLE FAST-FOLLOW — Wave A, step 16 (after 20260703180000_bbf_crucible_
-- remediation.sql). Closes the residual audit gaps the advisory-lock could not:
--   • C-1 / H-4 · the Cron Idempotency Ledger — the real fix for the sentinels'
--     non-idempotent nightly read-modify-writes (the REST advisory lock was a
--     no-op: xact-scoped, released the instant its own rpc committed).
--   • G-1 · the missing intake submit RPC — the gram-boundary conversion the
--     onboarding schema references but never had, so body_mass_g stays NULL and
--     cold-start always falls to the 81647 g persona default.
-- (H-1 / H-4 fail-soft inserts are code-side in the sentinels, using the Wave A
--  partial uniques.) Idempotent; safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── C-1 / H-4 · the Cron Idempotency Ledger ──────────────────────────────────
-- One claim row per (job, athlete, day). A sentinel INSERTs its claim ON CONFLICT
-- DO NOTHING at the top of its per-athlete NIGHTLY body; no row back = another run
-- already owns tonight → skip. The PK is a FULL unique (not partial), so PostgREST
-- upsert(onConflict, ignoreDuplicates) arbiters it cleanly.
create table if not exists public.bbf_cron_ledger (
  job_name    text        not null,
  target_id   uuid        not null,
  target_date date        not null,
  executed_at timestamptz not null default now(),
  primary key (job_name, target_id, target_date)
);
alter table public.bbf_cron_ledger enable  row level security;
alter table public.bbf_cron_ledger force   row level security;
revoke all on table public.bbf_cron_ledger from anon, authenticated;  -- service-role only
comment on table public.bbf_cron_ledger is
  'BBF Crucible fast-follow · per-(job,athlete,day) claim ledger. Sentinels INSERT ON CONFLICT DO NOTHING to gate their non-idempotent nightly passes to exactly one run (C-1/H-4). Service-role only.';

-- ── G-1 · bbf_submit_intake — the gram-boundary conversion RPC ────────────────
-- The Pathfinder intake submit. Weight arrives in lb OR kg, height in in OR cm; all
-- die HERE in RPC-local scope. body_mass_g / height_mm are the ONLY mass/length that
-- leave — INTEGER grams / mm, exact multipliers (§0.1). No lb/kg column exists.
create or replace function public.bbf_submit_intake(
  p_email            text,
  p_weight_lbs       numeric default null,
  p_weight_kg        numeric default null,
  p_height_in        numeric default null,
  p_height_cm        numeric default null,
  p_body_fat_pct     numeric default null,
  p_birth_year       int     default null,
  p_goal             text    default null,
  p_training_days_wk int     default null,
  p_session_minutes  int     default null,
  p_sport            text    default null,
  p_position         text    default null,
  p_friction_flags   text[]  default '{}',
  p_dietary_profile  text    default null,
  p_allergens        text[]  default '{}',
  p_preferred_locale text    default null,
  p_phone            text    default null,
  p_session_id       text    default null
) returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_body_mass_g bigint;
  v_height_mm   integer;
  v_loc         text := lower(coalesce(p_preferred_locale, ''));
  v_id          uuid;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    return json_build_object('ok', false, 'error', 'missing_email');
  end if;

  -- GRAM BOUNDARY (§0.1): exact multipliers, integer output. lb → g via 453.59237,
  -- kg → g via 1000; in → mm via 25.4, cm → mm via 10. Pounds/kilos never persist.
  v_body_mass_g := case
    when p_weight_lbs is not null and p_weight_lbs > 0 then round(p_weight_lbs::numeric * 453.59237)
    when p_weight_kg  is not null and p_weight_kg  > 0 then round(p_weight_kg::numeric  * 1000)
    else null end;
  v_height_mm := case
    when p_height_in is not null and p_height_in > 0 then round(p_height_in::numeric * 25.4)
    when p_height_cm is not null and p_height_cm > 0 then round(p_height_cm::numeric * 10)
    else null end;
  if v_loc not in ('en', 'es', 'pt') then v_loc := null; end if;

  insert into public.bbf_pathfinder_intakes
    (email, phone, body_mass_g, height_mm, body_fat_pct, birth_year, goal,
     training_days_wk, session_minutes, sport, position, friction_flags,
     dietary_profile, allergens, preferred_locale, session_id)
  values
    (lower(trim(p_email)), p_phone, v_body_mass_g, v_height_mm, p_body_fat_pct, p_birth_year::smallint, p_goal,
     p_training_days_wk::smallint, p_session_minutes::smallint, p_sport, p_position, coalesce(p_friction_flags, '{}'),
     p_dietary_profile, coalesce(p_allergens, '{}'), v_loc, p_session_id)
  returning id into v_id;

  return json_build_object('ok', true, 'intake_id', v_id, 'body_mass_g', v_body_mass_g, 'height_mm', v_height_mm);
end;
$function$;

-- Public prospect form (pre-checkout, no session yet). SECURITY DEFINER writes the
-- service-role-only intake table; the row is later claimed by consumed_by_user at
-- fulfillment. Mirrors the anon-callable lead-capture posture.
revoke all on function public.bbf_submit_intake(text, numeric, numeric, numeric, numeric, numeric, int, text, int, int, text, text, text[], text, text[], text, text, text) from public;
grant execute on function public.bbf_submit_intake(text, numeric, numeric, numeric, numeric, numeric, int, text, int, int, text, text, text[], text, text[], text, text, text) to anon, authenticated, service_role;

comment on function public.bbf_submit_intake is
  'BBF Crucible fast-follow (G-1) · Pathfinder intake submit. Converts weight lb/kg + height in/cm to body_mass_g BIGINT / height_mm INTEGER with the exact §0.1 multipliers in RPC-local scope, then inserts bbf_pathfinder_intakes. No lb/kg ever persists.';
