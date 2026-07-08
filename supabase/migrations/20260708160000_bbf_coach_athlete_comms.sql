-- ═══════════════════════════════════════════════════════════════════════════
-- FOUNDER FIVE BI-DIRECTIONAL WIRING — coach↔athlete messaging bridge +
-- admin 7-day fueling-history read.
--
-- 1 · bbf_coach_messages — the dedicated communications table behind the
--     Athlete Feed Chat. Coach sends from the Founder Five dossier; the athlete
--     reads/replies from the Vault. `read_by_athlete_at IS NULL` on a coach
--     message IS the unread-notification flag the athlete app polls.
-- 2 · RPCs (SECURITY DEFINER, deny-all RLS underneath — same doctrine as the
--     cardio/nutrition layers): the COACH side self-gates on
--     _bbf_is_admin_session(token); the ATHLETE side resolves identity from
--     _bbf_uid_from_vault_token(token) and can only ever touch its own thread.
-- 3 · bbf_admin_nutrition_history — admin read of the athlete's committed
--     nutrition_daily_sync rows (real logged adherence, not the plan) so the
--     dossier's 7-Day Nutrition deck reports history, not placeholders.
--
-- Idempotent: CREATE TABLE IF NOT EXISTS · CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · communications table ───────────────────────────────────────────────
create table if not exists public.bbf_coach_messages (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.bbf_users(id) on delete cascade,
  sender              text not null check (sender in ('coach','athlete')),
  body                text not null check (char_length(body) between 1 and 2000),
  created_at          timestamptz not null default now(),
  read_by_athlete_at  timestamptz,
  read_by_coach_at    timestamptz
);

comment on table public.bbf_coach_messages is
  'Founder Five Athlete Feed Chat — persisted coach↔athlete messages. A coach row with read_by_athlete_at IS NULL is the athlete-side unread-notification flag; symmetric for the coach side. Deny-all RLS; all access via the SECURITY DEFINER RPCs below.';

create index if not exists bbf_coach_messages_client_created_idx
  on public.bbf_coach_messages (client_id, created_at desc);
-- Fast unread poll (athlete notification flag).
create index if not exists bbf_coach_messages_unread_idx
  on public.bbf_coach_messages (client_id)
  where sender = 'coach' and read_by_athlete_at is null;

alter table public.bbf_coach_messages enable row level security;
alter table public.bbf_coach_messages force  row level security;

-- ─── 2a · COACH: send a message to an athlete (admin session gated) ─────────
create or replace function public.bbf_coach_send_message(
  p_session_token text,
  p_client_id     uuid,
  p_body          text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_body text := btrim(coalesce(p_body, ''));
  v_row  public.bbf_coach_messages;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;
  if p_client_id is null
     or not exists (select 1 from public.bbf_users u where u.id = p_client_id and u.deleted_at is null) then
    return jsonb_build_object('ok', false, 'error', 'unknown_client');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_body');
  end if;

  insert into public.bbf_coach_messages (client_id, sender, body)
  values (p_client_id, 'coach', v_body)
  returning * into v_row;

  return jsonb_build_object('ok', true, 'message', to_jsonb(v_row));
end;
$$;

-- ─── 2b · COACH: read a thread (marks athlete replies as coach-read) ────────
create or replace function public.bbf_coach_thread(
  p_session_token text,
  p_client_id     uuid,
  p_limit         int default 50
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msgs jsonb;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  update public.bbf_coach_messages
     set read_by_coach_at = now()
   where client_id = p_client_id and sender = 'athlete' and read_by_coach_at is null;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
    into v_msgs
    from (
      select * from public.bbf_coach_messages
       where client_id = p_client_id
       order by created_at desc
       limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) m;

  return jsonb_build_object('ok', true, 'messages', v_msgs);
end;
$$;

-- ─── 2c · ATHLETE: inbox (own thread + unread count; identity from token) ───
create or replace function public.bbf_athlete_inbox(
  p_session_token text,
  p_limit         int default 50
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_msgs    jsonb;
  v_unread  int;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select count(*) into v_unread
    from public.bbf_coach_messages
   where client_id = v_user_id and sender = 'coach' and read_by_athlete_at is null;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb)
    into v_msgs
    from (
      select * from public.bbf_coach_messages
       where client_id = v_user_id
       order by created_at desc
       limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) m;

  return jsonb_build_object('ok', true, 'unread', v_unread, 'messages', v_msgs);
end;
$$;

-- ─── 2d · ATHLETE: lightweight unread poll (the notification flag) ──────────
create or replace function public.bbf_athlete_unread_count(
  p_session_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_unread  int;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select count(*) into v_unread
    from public.bbf_coach_messages
   where client_id = v_user_id and sender = 'coach' and read_by_athlete_at is null;
  return jsonb_build_object('ok', true, 'unread', v_unread);
end;
$$;

-- ─── 2e · ATHLETE: mark the thread read (clears the notification flag) ──────
create or replace function public.bbf_athlete_mark_read(
  p_session_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_n       int;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  update public.bbf_coach_messages
     set read_by_athlete_at = now()
   where client_id = v_user_id and sender = 'coach' and read_by_athlete_at is null;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'marked', v_n);
end;
$$;

-- ─── 2f · ATHLETE: reply (bi-directional bridge; own thread only) ───────────
create or replace function public.bbf_athlete_send_message(
  p_session_token text,
  p_body          text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_body    text := btrim(coalesce(p_body, ''));
  v_row     public.bbf_coach_messages;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    return jsonb_build_object('ok', false, 'error', 'invalid_body');
  end if;
  insert into public.bbf_coach_messages (client_id, sender, body)
  values (v_user_id, 'athlete', v_body)
  returning * into v_row;
  return jsonb_build_object('ok', true, 'message', to_jsonb(v_row));
end;
$$;

-- ─── 3 · ADMIN: 7-day committed fueling history (real logs, not the plan) ───
create or replace function public.bbf_admin_nutrition_history(
  p_session_token text,
  p_client_id     uuid,
  p_days          int default 7
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days int := greatest(1, least(coalesce(p_days, 7), 90));
  v_rows jsonb;
begin
  if not public._bbf_is_admin_session(p_session_token) then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  select coalesce(jsonb_agg(to_jsonb(r) order by r.day asc), '[]'::jsonb)
    into v_rows
    from (
      select s.day, s.target_kcal, s.consumed_kcal, s.kcal_pct,
             s.target_protein_g, s.consumed_protein_g, s.protein_pct,
             s.consumed_carbs_g, s.consumed_fat_g, s.meals_logged, s.synced_at
        from public.nutrition_daily_sync s
        join public.athlete_profiles ap on ap.id = s.athlete_id
       where ap.user_id = p_client_id
         and s.day >= (now() at time zone 'UTC')::date - v_days
       order by s.day desc
       limit v_days
    ) r;

  return jsonb_build_object('ok', true, 'days', v_rows);
end;
$$;

-- ─── grants (PostgREST exposure; same envelope as the sibling layers) ────────
grant execute on function public.bbf_coach_send_message(text, uuid, text)   to anon, authenticated, service_role;
grant execute on function public.bbf_coach_thread(text, uuid, int)          to anon, authenticated, service_role;
grant execute on function public.bbf_athlete_inbox(text, int)               to anon, authenticated, service_role;
grant execute on function public.bbf_athlete_unread_count(text)             to anon, authenticated, service_role;
grant execute on function public.bbf_athlete_mark_read(text)                to anon, authenticated, service_role;
grant execute on function public.bbf_athlete_send_message(text, text)       to anon, authenticated, service_role;
grant execute on function public.bbf_admin_nutrition_history(text, uuid, int) to anon, authenticated, service_role;
