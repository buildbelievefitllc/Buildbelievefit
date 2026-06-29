-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 3 — per-athlete Loop Breaker signal (applied to prod 2026-06-28).
-- ───────────────────────────────────────────────────────────────────────────
-- Non-breaking OVERLOAD of bbf_resolve_program_day: same shape as the date-only
-- resolver (Day 1..84 / Week 1..12 / override), PLUS the per-athlete fields:
--   • is_loop_breaker — the athlete has been enrolled >= 84 days (crossed the
--     12-week macrocycle threshold), computed from bbf_users.created_at.
--   • days_on_program — elapsed days since enrollment.
-- Token-gated (resolves the session token → uid), SECURITY DEFINER. The date-only
-- bbf_resolve_program_day(date) is untouched, so existing callers are unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.bbf_resolve_program_day(p_session_token text, p_date date default current_date)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path = public
as $function$
declare
  v_base    jsonb := public.bbf_resolve_program_day(p_date);  -- reuse date-only resolver
  v_uid     uuid;
  v_created timestamptz;
  v_days    integer := null;
  v_lb      boolean := false;
begin
  v_uid := public._bbf_uid_from_vault_token(p_session_token);
  if v_uid is not null then
    select created_at into v_created
      from public.bbf_users
     where id = v_uid and deleted_at is null
     limit 1;
    if v_created is not null then
      v_days := floor(extract(epoch from (p_date::timestamptz - v_created)) / 86400)::int;
      v_lb   := v_days >= 84;
    end if;
  end if;
  return v_base || jsonb_build_object('is_loop_breaker', v_lb, 'days_on_program', v_days);
end;
$function$;

comment on function public.bbf_resolve_program_day(text, date) is
  'Phase 3 Loop Breaker (per-athlete): date-only resolver + is_loop_breaker (enrolled >= 84 days, from bbf_users.created_at) + days_on_program. Token-gated, SECURITY DEFINER.';

revoke all on function public.bbf_resolve_program_day(text, date) from public;
grant execute on function public.bbf_resolve_program_day(text, date) to anon, authenticated, service_role;
