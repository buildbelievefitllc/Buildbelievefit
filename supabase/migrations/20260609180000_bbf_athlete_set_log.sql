-- ═══════════════════════════════════════════════════════════════════════════
-- BBF — ATHLETE TELEMETRY SET LOG (per-movement weight / RPE / completed_at)
-- ═══════════════════════════════════════════════════════════════════════════
-- The Athlete Portal logbook (TelemetryLog) now persists every logged set. The
-- per-set fields (exercise_name, weight|BW, rpe, completed_at) cannot live on
-- bbf_athlete_progression — that is the Referee's ONE-ROW-PER-ATHLETE aggregate
-- (sport/phase/protocol_completed/rpe_avg_last_3). So per-set telemetry lands in a
-- dedicated log, and the writer ALSO rolls rpe_avg_last_3 back into the athlete's
-- progression row so the Autonomous Referee (bbf-evaluate-athlete-progress) reads
-- live athlete-fed RPE. Security model = bbf_log_youth_progress: user_id resolved
-- FROM the vault bearer token, never the caller.

create table if not exists public.bbf_athlete_set_log (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.bbf_users(id) on delete cascade,
  log_key       text not null,                 -- stable per movement: 'ex:Day 1:Back Squat'
  exercise_name text not null,
  source        text not null default 'ex',    -- 'ex' (workout) | 'dr' (drill) | 'sp' (sport engine)
  day_label     text,
  weight        numeric,                        -- null = bodyweight
  bodyweight    boolean not null default false,
  rpe           numeric not null,
  completed_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, log_key)
);
create index if not exists bbf_athlete_set_log_user_idx
  on public.bbf_athlete_set_log (user_id, completed_at desc);

-- Locked: no direct table access; reach it only through the SECURITY DEFINER RPCs.
alter table public.bbf_athlete_set_log enable row level security;

-- ─── Writer — token-gated upsert + safe rpe rollup into the Referee aggregate ───
create or replace function public.bbf_log_athlete_set(
  p_uid           text,
  p_session_token text,
  p_log_key       text,
  p_exercise_name text,
  p_weight        numeric,
  p_bodyweight    boolean,
  p_rpe           numeric,
  p_source        text default 'ex',
  p_day           text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_rpe_avg numeric;
begin
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;
  if p_log_key is null or length(p_log_key) = 0 or length(p_log_key) > 240 then
    return json_build_object('ok', false, 'error', 'invalid_target');
  end if;
  if p_rpe is null or p_rpe < 1 or p_rpe > 10 then
    return json_build_object('ok', false, 'error', 'invalid_rpe');
  end if;
  if p_weight is not null and (p_weight < 0 or p_weight > 2000) then
    return json_build_object('ok', false, 'error', 'invalid_weight');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u on u.id = s.user_id and u.deleted_at is null
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  insert into public.bbf_athlete_set_log
    (user_id, log_key, exercise_name, source, day_label, weight, bodyweight, rpe, completed_at, updated_at)
  values
    (v_user_id, p_log_key, left(coalesce(p_exercise_name, p_log_key), 160),
     case when p_source in ('ex', 'dr', 'sp') then p_source else 'ex' end,
     left(coalesce(p_day, ''), 120),
     case when coalesce(p_bodyweight, false) then null else p_weight end,
     coalesce(p_bodyweight, false), p_rpe, now(), now())
  on conflict (user_id, log_key) do update
    set exercise_name = excluded.exercise_name,
        source        = excluded.source,
        day_label     = excluded.day_label,
        weight        = excluded.weight,
        bodyweight    = excluded.bodyweight,
        rpe           = excluded.rpe,
        completed_at  = now(),
        updated_at    = now();

  -- Roll the athlete's last-3 logged-set RPE into the Referee aggregate (UPDATE only —
  -- never creates or mutates sport/phase/protocol_completed; no-op if no row yet).
  select round(avg(rpe), 2) into v_rpe_avg
    from (select rpe from public.bbf_athlete_set_log
           where user_id = v_user_id order by completed_at desc limit 3) t;
  update public.bbf_athlete_progression
     set rpe_avg_last_3 = v_rpe_avg, updated_at = now()
   where user_id = v_user_id;

  return json_build_object('ok', true, 'log_key', p_log_key, 'rpe_avg_last_3', v_rpe_avg);
end;
$function$;

-- ─── Reader — token-gated; returns the caller's full set log as a keyed map ─────
create or replace function public.bbf_get_athlete_set_log(
  p_uid           text,
  p_session_token text
)
returns json
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
  v_logs    json;
begin
  if p_session_token is null or length(p_session_token) = 0 then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select s.user_id into v_user_id
    from public.bbf_vault_sessions s
    join public.bbf_users u on u.id = s.user_id and u.deleted_at is null
   where s.token::text = p_session_token
     and s.expires_at > now()
   limit 1;
  if v_user_id is null then
    return json_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select coalesce(json_object_agg(log_key, json_build_object(
           'weight', weight, 'bodyweight', bodyweight, 'rpe', rpe, 'completed_at', completed_at)), '{}'::json)
    into v_logs
    from public.bbf_athlete_set_log
   where user_id = v_user_id;

  return json_build_object('ok', true, 'logs', v_logs);
end;
$function$;

revoke all on function public.bbf_log_athlete_set(text, text, text, text, numeric, boolean, numeric, text, text) from public;
grant execute on function public.bbf_log_athlete_set(text, text, text, text, numeric, boolean, numeric, text, text) to anon, authenticated, service_role;
revoke all on function public.bbf_get_athlete_set_log(text, text) from public;
grant execute on function public.bbf_get_athlete_set_log(text, text) to anon, authenticated, service_role;
