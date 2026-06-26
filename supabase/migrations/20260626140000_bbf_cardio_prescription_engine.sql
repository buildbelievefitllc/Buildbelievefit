-- ═══════════════════════════════════════════════════════════════════════════
-- PHASE 10b — CARDIO PRESCRIPTION TRIPWIRE (deterministic pre-compute · ZERO AI)
-- ───────────────────────────────────────────────────────────────────────────
-- Architectural parity with bbf-prescription-engine: the instant an athlete's
-- morning readiness verdict lands (bbf_daily_protocols INSERT/UPDATE), a pg_net
-- tripwire fires the bbf-cardio-prescription edge fn, which derives today's
-- RECOVERY BAND (deriveReadinessBand) and caches it here — so the band is ready,
-- instant, and LLM-free before the athlete ever opens Smart Cardio. The agentic
-- engine (bbf-agentic-cardio) also computes the band live from the request
-- payload, so this cache is an OPTIMIZATION, never a dependency (fail-open).
--
-- LOOP-SAFE: the trigger writes ONLY bbf_cardio_prescription; it never touches
-- bbf_daily_protocols → no recursion. SHARED SECRET in bbf_app_config (the deploy
-- toolset can't set edge env vars), read by BOTH the trigger and the function.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1 · The cached daily band — one active row per (athlete, day) ─────────────
create table if not exists public.bbf_cardio_prescription (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.bbf_users(id) on delete cascade,
  prescribed_for     date not null,
  -- readiness inputs (snapshot of what drove the band)
  readiness_score    numeric,
  readiness_mode     text,
  hrv_ms             numeric,
  hrv_baseline_ms    numeric,
  sleep_hours        numeric,
  -- band outputs (mirror RecoveryBand)
  recovery_state     text not null,
  tier_ceiling       text,
  rpe_ceiling        integer,
  work_rest_ratio    text,
  interval_directive text,
  recovery_note      text,
  status             text not null default 'active',
  created_at         timestamptz not null default now()
);

create index if not exists idx_cardio_rx_user_day
  on public.bbf_cardio_prescription (user_id, prescribed_for desc);

comment on table public.bbf_cardio_prescription is
  'Phase 10 cached daily cardio recovery band, pre-computed by bbf-cardio-prescription from the morning readiness verdict (bbf_daily_protocols tripwire). Deterministic (deriveReadinessBand), zero-AI. Per-athlete; service-role only.';

-- RLS: enabled + FORCED, zero policies (deny-all direct access). The ONLY writers
-- are the service-role edge fn + the SECURITY DEFINER tripwire (mirror of the
-- biometric ledger + prescription-engine security model).
alter table public.bbf_cardio_prescription enable row level security;
alter table public.bbf_cardio_prescription force  row level security;
revoke all on table public.bbf_cardio_prescription from anon, authenticated;

-- ─── 2 · Arm the shared secret (idempotent — never resets an existing secret) ──
insert into public.bbf_app_config (key, value)
values ('cardio_prescription_secret', gen_random_uuid()::text)
on conflict (key) do nothing;

-- ─── 3 · Tripwire: fire the cardio prescription engine on every readiness verdict
create or replace function public._bbf_cardio_prescription_tripwire()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, net
as $$
declare
  v_fn_url text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-cardio-prescription';
  v_secret text;
begin
  select value into v_secret from public.bbf_app_config where key = 'cardio_prescription_secret';
  -- Fire-and-forget. Wrapped so a pg_net hiccup can NEVER block the check-in write.
  begin
    perform net.http_post(
      url     := v_fn_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-BBF-Cardio-Secret', coalesce(v_secret, '')
      ),
      body    := jsonb_build_object(
        'athlete_id',      NEW.athlete_id,
        'prescribed_for',  NEW.date,
        'readiness_score', NEW.readiness_score,
        'directive_log',   NEW.directive_log
      )
    );
  exception when others then
    raise warning '[bbf cardio tripwire] net.http_post failed: %', sqlerrm;
  end;
  return NEW;
end;
$$;

drop trigger if exists bbf_daily_protocol_cardio_tripwire on public.bbf_daily_protocols;
create trigger bbf_daily_protocol_cardio_tripwire
  after insert or update on public.bbf_daily_protocols
  for each row
  execute function public._bbf_cardio_prescription_tripwire();

-- ═══════════════════════════════════════════════════════════════════════════
-- DAY-30 GRADUATION — server-side authority for the Sovereign Audio gate.
-- ───────────────────────────────────────────────────────────────────────────
-- Re-derives the calibration day/graduation from the intake anchor
-- (bbf_active_clients.created_at, joined by vault_email) — NEVER trusting the
-- client. Mirrors frontend calibration.js EXACTLY: the 2026-06-25 grandfather
-- epoch + the day>=30 rule; no intake row / pre-epoch intake → graduated.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.bbf_calibration_status(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_user_id uuid;
  v_email   text;
  v_started timestamptz;
  v_epoch   timestamptz := '2026-06-25T00:00:00Z';
  v_day     integer;
  v_grad    boolean;
begin
  v_user_id := public._bbf_uid_from_vault_token(p_session_token);
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;

  select email into v_email from public.bbf_users where id = v_user_id and deleted_at is null limit 1;
  if v_email is not null then
    select created_at into v_started from public.bbf_active_clients where vault_email = v_email limit 1;
  end if;

  -- GRANDFATHER + FAIL-OPEN: no intake row OR a pre-epoch intake → graduated.
  if v_started is null or v_started < v_epoch then
    return jsonb_build_object('ok', true, 'graduated', true, 'day', null,
      'started_at', v_started, 'grandfathered', true);
  end if;

  v_day  := greatest(1, floor(extract(epoch from (now() - v_started)) / 86400)::int + 1);
  v_grad := v_day >= 30;
  return jsonb_build_object('ok', true, 'graduated', v_grad, 'day', v_day,
    'started_at', v_started, 'grandfathered', false);
end;
$$;

revoke all on function public.bbf_calibration_status(text) from public;
grant execute on function public.bbf_calibration_status(text) to anon, authenticated, service_role;
