-- Agentic Command Center · the Inbox Ledger + Automated Sentinels
-- ----------------------------------------------------------------------------
-- Transforms the Command Center from a passive biometric display into a
-- proactive agent loop:
--
--   sentinels (this file)  →  bbf-agent-brain (edge fn, Gemini)  →  coach_action_inbox
--
--   • coach_action_inbox — the agent intelligence inbox the coach triages.
--   • ACWR Spike Sentinel — AFTER INSERT on bbf_athlete_load_logs; ACWR >= 1.5
--     fires the brain asynchronously (pg_net, never blocks the athlete's log).
--   • Nightly Stagnancy Sentinel — pg_cron 09:00 UTC (2:00 AM America/Los_Angeles
--     during PDT); flags athletes silent > 48h across ALL logging surfaces.
--
-- SECURITY (deliberate deviation from the build brief, per DATABASE_SAFETY.md +
-- Phase 1.6): the brief asked for SELECT/UPDATE grants to `authenticated`. That
-- is the exact posture the 120700 hardening removed — coaches authenticate via
-- the admin-token/vault-session edge gate, NOT as Supabase `authenticated`, so
-- such a grant would only ever widen exposure of coaching/health-adjacent data.
-- Instead: RLS ENABLED with ZERO policies (anon + authenticated fully denied),
-- service_role only. All coach reads/updates route through bbf-agent-brain's
-- admin-gated list/resolve actions. The advisor `rls_enabled_no_policy` (INFO)
-- on this table is intentional — do not "fix" it with a policy.
-- ----------------------------------------------------------------------------

-- ── A · The Inbox Ledger ─────────────────────────────────────────────────────
create table if not exists public.coach_action_inbox (
  id               uuid primary key default gen_random_uuid(),
  athlete_id       uuid not null references public.bbf_users(id) on delete cascade,
  type             text not null,
  status           text not null default 'PENDING'
                     constraint coach_action_inbox_status_chk
                     check (status in ('PENDING', 'APPROVED', 'DISMISSED')),
  risk_score       numeric,
  insight_summary  text,
  proposed_action  text,
  draft_message    text,
  created_at       timestamptz not null default now(),
  processed_at     timestamptz
);

comment on table public.coach_action_inbox is
  'Agentic Command Center inbox — Gemini-generated coach actions (ACWR_SPIKE / STAGNANCY_ALERT). RLS ENABLED with NO policies: service_role only; coach access routes through bbf-agent-brain (admin-gated). rls_enabled_no_policy advisor INFO is intentional.';

-- Drawer paint (pending newest-first) + sentinel dedup lookups.
create index if not exists coach_action_inbox_pending_idx
  on public.coach_action_inbox (status, created_at desc);
create index if not exists coach_action_inbox_dedup_idx
  on public.coach_action_inbox (athlete_id, type, status, created_at desc);

alter table public.coach_action_inbox enable row level security;

-- No policies on purpose. Belt-and-braces: strip direct table grants too, so
-- even a future policy slip can't expose it over PostgREST.
revoke all on table public.coach_action_inbox from public, anon, authenticated;

-- ── Shared secret · sentinels → bbf-agent-brain (Phase 1.6 pattern) ──────────
-- Value generated inside Postgres, stored encrypted in Vault; never in git.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bbf_agent_webhook_secret') then
    perform vault.create_secret(
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'bbf_agent_webhook_secret',
      'Shared secret · ACWR/stagnancy sentinels -> bbf-agent-brain edge fn'
    );
  end if;
end $$;

-- Service-role-only accessor (the brain verifies inbound sentinel calls with it).
create or replace function public.bbf_agent_webhook_secret()
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = 'bbf_agent_webhook_secret'
  limit 1;
$$;

revoke all on function public.bbf_agent_webhook_secret() from public, anon, authenticated;
grant execute on function public.bbf_agent_webhook_secret() to service_role;

comment on function public.bbf_agent_webhook_secret() is
  'Agentic Command Center · returns the sentinel webhook shared secret from Vault. service_role only (bbf-agent-brain verification).';

-- ── B · Real-Time ACWR Spike Sentinel ────────────────────────────────────────
create or replace function public.tg_load_log_acwr_spike()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_acwr   numeric;
  v_secret text;
  v_url    text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-agent-brain';
begin
  select acwr into v_acwr from public.bbf_compute_acwr(new.athlete_id);
  if v_acwr is null or v_acwr < 1.5 then
    return new;
  end if;

  -- Dedup/cooldown: one live spike card per athlete; never re-fire within 24h
  -- even after a dismiss (protects the coach's inbox AND the Gemini budget).
  if exists (
    select 1 from public.coach_action_inbox
    where athlete_id = new.athlete_id
      and type = 'ACWR_SPIKE'
      and (status = 'PENDING' or created_at > now() - interval '24 hours')
  ) then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_agent_webhook_secret'
  limit 1;

  -- Phase 1.6 rule: never fire an unsigned/empty-signed webhook. Abort loudly.
  if v_secret is null or length(btrim(v_secret)) = 0 then
    raise warning 'bbf_agent_webhook_secret is empty or missing. Aborting ACWR spike webhook.';
    return new;
  end if;

  -- Async (pg_net): the athlete's log INSERT never blocks on the brain.
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-agent-secret', v_secret
    ),
    body    := jsonb_build_object(
      'action',       'generate',
      'athlete_id',   new.athlete_id,
      'trigger_type', 'ACWR_SPIKE',
      'risk_score',   v_acwr
    )
  );

  return new;
end;
$$;

comment on function public.tg_load_log_acwr_spike() is
  'Agentic Command Center · AFTER INSERT sentinel on bbf_athlete_load_logs: ACWR >= 1.5 fires bbf-agent-brain (async pg_net, Vault-secret signed, 24h dedup). Never RPC-callable.';

revoke execute on function public.tg_load_log_acwr_spike() from public, anon, authenticated;

drop trigger if exists load_log_acwr_spike_ai on public.bbf_athlete_load_logs;
create trigger load_log_acwr_spike_ai
  after insert on public.bbf_athlete_load_logs
  for each row
  execute function public.tg_load_log_acwr_spike();

-- ── C · Nightly Stagnancy Sentinel ───────────────────────────────────────────
-- Last activity = the newest signal across ALL logging surfaces (sRPE load logs,
-- post-workout feedback, daily readiness) — same honesty rule as bbf-athlete-acwr:
-- an athlete who logs readiness but not sRPE is NOT stagnant.
create or replace function public.bbf_stagnancy_sweep()
returns integer
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_secret text;
  v_url    text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-agent-brain';
  v_fired  integer := 0;
  r        record;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_agent_webhook_secret'
  limit 1;

  if v_secret is null or length(btrim(v_secret)) = 0 then
    raise warning 'bbf_agent_webhook_secret is empty or missing. Aborting stagnancy sweep.';
    return 0;
  end if;

  for r in
    with athletes as (
      select u.id
      from public.bbf_users u
      where u.deleted_at is null
        and coalesce(lower(u.role), '') not in ('admin', 'trainer')
    ),
    last_act as (
      select a.id,
             greatest(
               coalesce((select max(l.created_at)  from public.bbf_athlete_load_logs l where l.athlete_id = a.id), 'epoch'::timestamptz),
               coalesce((select max(f.created_at)  from public.session_feedback f      where f.user_id    = a.id), 'epoch'::timestamptz),
               coalesce((select max(d."timestamp") from public.bbf_readiness d          where d.user_id    = a.id), 'epoch'::timestamptz)
             ) as last_at
      from athletes a
    )
    select id,
           nullif(last_at, 'epoch'::timestamptz) as last_at
    from last_act
    where last_at < now() - interval '48 hours'   -- 'epoch' (never logged) qualifies
  loop
    -- Cooldown: a live PENDING card, or ANY stagnancy card in the last 72h,
    -- suppresses a re-fire — a dormant athlete becomes one card, not one per night.
    if exists (
      select 1 from public.coach_action_inbox
      where athlete_id = r.id
        and type = 'STAGNANCY_ALERT'
        and (status = 'PENDING' or created_at > now() - interval '72 hours')
    ) then
      continue;
    end if;

    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-agent-secret', v_secret
      ),
      body    := jsonb_build_object(
        'action',       'generate',
        'athlete_id',   r.id,
        'trigger_type', 'STAGNANCY_ALERT',
        'risk_score',   case when r.last_at is null then null
                             else round(extract(epoch from (now() - r.last_at)) / 3600.0, 1) end
      )
    );

    v_fired := v_fired + 1;
    -- Nightly ceiling: bounds the Gemini spend + inbox flood on the first-ever
    -- run over a dormant roster. The remainder queues for the next night.
    if v_fired >= 25 then
      raise warning 'bbf_stagnancy_sweep hit the 25-athlete nightly ceiling; remainder deferred to tomorrow.';
      exit;
    end if;
  end loop;

  return v_fired;
end;
$$;

comment on function public.bbf_stagnancy_sweep() is
  'Agentic Command Center · nightly stagnancy sentinel: athletes silent > 48h across load logs / feedback / readiness fire bbf-agent-brain (72h cooldown, 25/night ceiling). service_role/postgres only.';

revoke execute on function public.bbf_stagnancy_sweep() from public, anon, authenticated;
grant execute on function public.bbf_stagnancy_sweep() to postgres, service_role;

-- pg_cron registration — idempotent (house pattern: bbf-eagle-eye-daily).
-- 09:00 UTC = 2:00 AM America/Los_Angeles during PDT (1:00 AM during PST).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bbf-agent-stagnancy-nightly') then
    perform cron.unschedule('bbf-agent-stagnancy-nightly');
  end if;
end $$;

select cron.schedule(
  'bbf-agent-stagnancy-nightly',
  '0 9 * * *',
  $job$ select public.bbf_stagnancy_sweep(); $job$
);
