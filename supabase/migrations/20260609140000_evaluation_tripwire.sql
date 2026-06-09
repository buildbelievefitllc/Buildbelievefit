-- 20260609140000_evaluation_tripwire.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- THE TRIPWIRE — fires the Autonomous Referee (bbf-evaluate-athlete-progress) via
-- pg_net whenever an athlete's telemetry is INSERTED or UPDATED in
-- bbf_athlete_progression. Fire-and-forget (async pg_net); NEVER blocks the write.
--
-- SHARED SECRET: the deploy toolset can't set edge-function env vars, so the secret
-- lives in a LOCKED config table (bbf_app_config) that BOTH the trigger and the
-- function read. The secret VALUE is inserted at arm-time via a one-off statement
-- (never committed here). RLS-locked: only service_role (the function) + the
-- SECURITY DEFINER trigger can read it.
--
-- LOOP-SAFETY: the function writes ONLY bbf_active_clients (never this table) → the
-- trigger can never recurse. Do not add a write-back here without a re-entry guard.

create table if not exists public.bbf_app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.bbf_app_config enable row level security;
revoke all on table public.bbf_app_config from anon, authenticated;

create or replace function public._bbf_evaluate_progress_tripwire()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_fn_url text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-evaluate-athlete-progress';
  v_secret text;
begin
  select value into v_secret from public.bbf_app_config where key = 'evaluator_secret';
  -- Fire-and-forget. Wrapped so a pg_net hiccup can never block the athlete's write.
  begin
    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Evaluator-Secret', coalesce(v_secret, '')
      ),
      body    := jsonb_build_object(
        'user_id',            NEW.user_id,
        'sport',              NEW.sport,
        'phase',              NEW.phase,
        'target_phase',       NEW.target_phase,
        'protocol_completed', NEW.protocol_completed,
        'mesocycle_week',     NEW.mesocycle_week,
        'rpe_avg_last_3',     NEW.rpe_avg_last_3,
        'friction_avg_last_3', NEW.friction_avg_last_3,
        'guardian_consent',   NEW.guardian_consent
      )
    );
  exception when others then
    raise warning '[bbf tripwire] net.http_post failed: %', sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists bbf_athlete_progress_tripwire on public.bbf_athlete_progression;
create trigger bbf_athlete_progress_tripwire
  after insert or update on public.bbf_athlete_progression
  for each row
  execute function public._bbf_evaluate_progress_tripwire();
