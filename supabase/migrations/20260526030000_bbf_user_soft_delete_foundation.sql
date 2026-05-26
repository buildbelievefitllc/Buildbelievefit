-- ═══════════════════════════════════════════════════════════════════════
-- Phase 6.0i · Soft-delete foundation · APPLIED 2026-05-26
-- ───────────────────────────────────────────────────────────────────────
-- Closes red-team audit cracks 3.1 / 3.2 / 3.3 by replacing hard-delete
-- semantics with a soft-delete + RLS-gated view pattern. Eliminates the
-- bbf_users delete-blocked-by-bbf_logs/readiness FK violation, removes
-- the bbf_audit_logs cascade forensics hole, and standardises the
-- delete-user contract behind a single SECURITY DEFINER procedure.
--
-- WHAT IT INSTALLS
--   1. bbf_users.deleted_at      timestamptz · the soft-delete marker
--      bbf_users.deleted_reason  text         · human-readable cause
--      bbf_users.deleted_by      text         · uid of the actor (admin/system/sovereign)
--      idx_bbf_users_active_uid  partial index on uid WHERE deleted_at IS NULL
--   2. RLS restrictive policy `bbf_users_hide_soft_deleted` · forces
--      anon + authenticated to see only active rows · service_role
--      bypasses RLS via BYPASSRLS so the auth RPC + edge functions can
--      still administer deleted rows when needed.
--   3. View `public.bbf_users_active` · canonical "active only" read
--      surface · granted to anon + authenticated + service_role.
--   4. Stored procedure `bbf_soft_delete_user(uid, reason, actor)` ·
--      the single canonical entrypoint for marking a user as deleted ·
--      grabs FOR UPDATE row lock to prevent concurrent double-delete.
--   5. `bbf_verify_user_pin` RPC patched · the auth gate now treats
--      soft-deleted users as not-found (3 explicit `AND deleted_at IS
--      NULL` filters on every bbf_users read inside the function body).
--
-- WHY SOFT-DELETE METADATA LIVES ON BBF_USERS, NOT BBF_AUDIT_LOGS
--   bbf_audit_logs.movement_name + bbf_audit_logs.tension_zone are
--   NOT NULL with an enum CHECK on tension_zone (lower-back/knees/
--   shoulders/target-muscle/hips · kinematic vocabulary). Writing a
--   user-lifecycle audit row through this table requires populating
--   semantically wrong placeholder values · cleaner to keep the
--   soft-delete audit self-contained on bbf_users (deleted_at +
--   deleted_reason + deleted_by). A future general-purpose
--   user-lifecycle audit table is out of scope for this phase.
--
-- WHY THE RPC PATCH IS INSIDE THIS MIGRATION (NOT A SEPARATE COMMIT)
--   bbf_verify_user_pin runs SECURITY DEFINER which bypasses RLS via
--   the owner's BYPASSRLS attribute · the new RLS policy ALONE is
--   insufficient to gate the auth path. The 3 explicit filters inside
--   the function body are load-bearing · they cannot land in a
--   separate change without leaving a window where soft-deleted users
--   can still authenticate.
--
-- DOWNSTREAM READER STATUS (to confirm post-apply)
--   ✓ Phase 6.0i ships filters into the 3 highest-risk readers:
--       bbf-agentic-orchestrator/index.ts:91   ·  user-slice fetch
--       index.js:1923                          ·  /api/admin-check-cloud
--       index.js:1862                          ·  /api/admin-upsert-client
--   ✗ Lower-risk readers (other index.js admin endpoints, legacy
--     bbf-app.html trainer roster JS) continue to read raw bbf_users ·
--     RLS gate already hides soft-deleted rows from their
--     non-service-role surfaces · UX leak only · queued in
--     MASTER_PLAN.md §6.0i-followup.
-- ═══════════════════════════════════════════════════════════════════════

begin;

-- ─── 1. Schema additions ────────────────────────────────────────────
alter table public.bbf_users
  add column if not exists deleted_at     timestamptz,
  add column if not exists deleted_reason text,
  add column if not exists deleted_by     text;

create index if not exists idx_bbf_users_active_uid
  on public.bbf_users (uid)
  where deleted_at is null;

-- ─── 2. Restrictive RLS · hide soft-deleted from anon+authenticated ──
-- service_role still bypasses RLS · its queries MUST filter explicitly
-- or read from bbf_users_active.
drop policy if exists bbf_users_hide_soft_deleted on public.bbf_users;
create policy bbf_users_hide_soft_deleted
  on public.bbf_users
  as restrictive
  for all
  to public
  using (deleted_at is null);

-- ─── 3. Canonical "active users" view ───────────────────────────────
create or replace view public.bbf_users_active as
  select * from public.bbf_users where deleted_at is null;

grant select on public.bbf_users_active to anon, authenticated, service_role;

-- ─── 4. Stored procedure · single canonical soft-delete entrypoint ──
create or replace function public.bbf_soft_delete_user(
  p_uid    text,
  p_reason text default 'operator_request',
  p_actor  text default null
)
returns table(uid text, deleted_at timestamptz, deleted_reason text, deleted_by text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_now     timestamptz := now();
begin
  -- Lock the row · prevent concurrent double-delete
  select id into v_user_id
    from public.bbf_users
   where bbf_users.uid = p_uid and bbf_users.deleted_at is null
   limit 1
   for update;

  if v_user_id is null then
    raise exception 'bbf_soft_delete_user · uid=% not found or already soft-deleted', p_uid
      using errcode = 'no_data_found';
  end if;

  update public.bbf_users
     set deleted_at     = v_now,
         deleted_reason = p_reason,
         deleted_by     = p_actor,
         updated_at     = v_now
   where id = v_user_id;

  return query
    select p_uid::text, v_now::timestamptz, p_reason::text, p_actor::text;
end;
$$;

grant execute on function public.bbf_soft_delete_user(text, text, text) to service_role;

-- ─── 5. Auth gate · soft-deleted users treated as unknown ───────────
-- Three load-bearing filters added (the only deltas vs the previous
-- definition · everything else preserved verbatim):
--   (a) pin_hash lookup · `and bbf_users.deleted_at is null`
--   (b) bcrypt-upgrade UPDATE · same filter (defense-in-depth · the
--       (a) gate already prevents reaching this branch for deleted
--       users)
--   (c) post-success email+daily_brief lookup · same filter

create or replace function public.bbf_verify_user_pin(uid text, pin_attempt text)
returns json
language plpgsql
security definer
as $function$
declare
  v_target_uid          text := uid;
  v_key                 text := uid;
  v_attempt             bbf_pin_attempts%rowtype;
  v_stored_hash         text;
  v_is_valid            boolean := false;
  v_now                 timestamptz := now();
  v_retry_after         int := 0;
  v_user_email          text;
  v_workout_plan        text;
  v_meal_plan           text;
  v_plans_generated_at  timestamptz;
  v_daily_brief         text;
begin
  select * into v_attempt from bbf_pin_attempts where key = v_key;
  if v_attempt.locked_until > v_now then
    return json_build_object('ok', false, 'lockout_active', true, 'retry_after_seconds', extract(epoch from (v_attempt.locked_until - v_now))::int);
  end if;

  -- Phase 6.0i (a) · soft-delete gate · treat as unknown uid
  select pin_hash into v_stored_hash
    from bbf_users
   where bbf_users.uid = v_target_uid
     and bbf_users.deleted_at is null
   limit 1;

  if v_stored_hash is not null then
    if v_stored_hash like '$2a$%' then
      v_is_valid := (crypt(pin_attempt, v_stored_hash) = v_stored_hash);
    else
      v_is_valid := (v_stored_hash = encode(digest(pin_attempt, 'sha256'), 'hex'));
      if v_is_valid then
        -- Phase 6.0i (b) · soft-delete defense-in-depth on bcrypt upgrade
        update bbf_users
           set pin_hash = crypt(pin_attempt, gen_salt('bf'))
         where bbf_users.uid = v_target_uid
           and bbf_users.deleted_at is null;
      end if;
    end if;
  end if;

  if v_is_valid then
    delete from bbf_pin_attempts where key = v_key;
    -- Phase 6.0i (c) · soft-delete defense-in-depth on post-success path
    select email, daily_brief
      into v_user_email, v_daily_brief
      from bbf_users
     where bbf_users.uid = v_target_uid
       and bbf_users.deleted_at is null
     limit 1;
    if v_user_email is not null then
      select workout_plan, meal_plan, plans_generated_at
      into v_workout_plan, v_meal_plan, v_plans_generated_at
      from bbf_active_clients where vault_email = v_user_email limit 1;
    end if;
    return json_build_object(
      'ok', true,
      'lockout_active', false,
      'retry_after_seconds', 0,
      'plans_available', (v_plans_generated_at is not null),
      'workout_plan', v_workout_plan,
      'meal_plan', v_meal_plan,
      'plans_generated_at', v_plans_generated_at,
      'daily_brief', v_daily_brief
    );
  else
    insert into bbf_pin_attempts (key, failed_count, window_started_at, locked_until, last_attempt_at)
    values (v_key, 1, v_now, null, v_now)
    on conflict (key) do update set
      failed_count = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end,
      window_started_at = case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then now() else bbf_pin_attempts.window_started_at end,
      locked_until = case
        when (case when bbf_pin_attempts.last_attempt_at < (now() - interval '60 minutes') then 1 else bbf_pin_attempts.failed_count + 1 end) >= 3
        then now() + interval '15 minutes'
        else null
      end,
      last_attempt_at = now();

    select * into v_attempt from bbf_pin_attempts where key = v_key;
    v_retry_after := case when v_attempt.locked_until > v_now then extract(epoch from (v_attempt.locked_until - v_now))::int else 0 end;
    return json_build_object('ok', false, 'lockout_active', v_attempt.failed_count >= 3, 'retry_after_seconds', v_retry_after);
  end if;
end;
$function$;

commit;
