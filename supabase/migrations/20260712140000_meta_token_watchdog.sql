-- 20260712140000_meta_token_watchdog.sql
-- Meta distribution token expiry watchdog — a passive, self-contained health probe
-- for the Marketing Vault's Dispatch-to-Meta pipeline (bbf-content-manager
-- vault_dispatch). Applied to project ihclbceghxpuawymlvgi via MCP apply_migration;
-- mirrored here for version control.
--
-- WHY: the Meta system-user token is long-lived but finite (~60-day). If it lapses
-- silently, IG Reels + FB Page dispatch starts returning OAuthException 190. This
-- watchdog re-validates the token on a cron and raises a CRITICAL_RENEWAL flag when
-- < 7 days remain, surfaced as an elegant warning in the Command Center header.
--
-- DECOUPLING (CEO order): this touches NOTHING the reel distributor owns — no
-- bbf_reels_batch_v1, no distributor crons, no shared state. It reads the SAME Vault
-- secret (via the canonical bbf_get_vault_secret accessor) read-only, and owns
-- exactly one status row. It never posts, mutates, or reads any distributor table.
--
-- ASYNC PATTERN: pg_net is asynchronous — a request enqueued now lands in
-- net._http_response ~1s later, in a separate transaction. So the watchdog is
-- evaluate-prior-then-fire: each run reads the response to the probe the PREVIOUS
-- run enqueued (tracked by request id), updates the flag, then fires a fresh probe
-- for the next run to read. A 3-hour cadence keeps the prior response well within
-- pg_net's response retention window, and a 1-run lag is immaterial to a 7-day wall.

-- ── 1) Passive status store (non-sensitive flags only; NEVER secrets) ────────────
create table if not exists public.bbf_system_status (
  key         text primary key,
  state       text not null default 'UNKNOWN',
  detail      jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.bbf_system_status enable row level security;

-- Public SELECT (the anon Command Center client reads the flag directly — the row
-- holds only a state string + an expiry date + days remaining, zero secrets).
-- No INSERT/UPDATE/DELETE policies → writes stay SECURITY-DEFINER / service-role only.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bbf_system_status' and policyname = 'bbf_system_status_public_read'
  ) then
    create policy bbf_system_status_public_read on public.bbf_system_status for select using (true);
  end if;
end $$;

comment on table public.bbf_system_status is 'Passive system health flags surfaced to the Command Center. Public SELECT, SECURITY-DEFINER/service-role writes only. NEVER store secrets here.';

-- ── 2) The watchdog probe (read-only; SECURITY DEFINER for Vault + net access) ────
create or replace function public.bbf_meta_token_watchdog()
returns public.bbf_system_status
language plpgsql
security definer
set search_path = public, extensions, net, pg_temp
as $fn$
declare
  v_token    text;
  v_prev_id  bigint;
  v_status   int;
  v_content  text;
  v_data     jsonb;
  v_is_valid boolean;
  v_expires  bigint;
  v_days     numeric;
  v_state    text;
  v_new_id   bigint;
  v_row      public.bbf_system_status;
begin
  -- (a) Evaluate the PRIOR probe's response (enqueued by the previous run).
  select (detail->>'last_request_id')::bigint into v_prev_id
  from public.bbf_system_status where key = 'meta_token';

  if v_prev_id is not null then
    select status_code, content into v_status, v_content
    from net._http_response where id = v_prev_id;

    if found then
      if v_status = 200 then
        v_data     := (v_content::jsonb) -> 'data';
        v_is_valid := coalesce((v_data->>'is_valid')::boolean, false);
        v_expires  := coalesce((v_data->>'expires_at')::bigint, 0);
        if v_expires = 0 then
          v_days  := null;  -- 0 ⇒ non-expiring token
          v_state := case when v_is_valid then 'OK' else 'CRITICAL_RENEWAL' end;
        else
          v_days  := round(extract(epoch from (to_timestamp(v_expires) - now())) / 86400.0, 1);
          v_state := case
                       when not v_is_valid then 'CRITICAL_RENEWAL'
                       when v_days < 7      then 'CRITICAL_RENEWAL'
                       else 'OK'
                     end;
        end if;

        insert into public.bbf_system_status(key, state, detail, updated_at)
        values ('meta_token', v_state, jsonb_build_object(
                  'is_valid',       v_is_valid,
                  'expires_at',     v_expires,
                  'expires_at_iso', case when v_expires = 0 then null
                                         else to_char(to_timestamp(v_expires) at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') end,
                  'days_remaining', v_days,
                  'threshold_days', 7,
                  'checked_at',     to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                ), now())
        on conflict (key) do update
          set state = excluded.state, detail = excluded.detail, updated_at = excluded.updated_at;
      else
        -- Non-200 (transient network / gateway) — record, but do NOT cry wolf.
        update public.bbf_system_status
          set state = 'UNKNOWN',
              detail = detail || jsonb_build_object(
                         'last_probe_status', v_status,
                         'checked_at', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
              updated_at = now()
          where key = 'meta_token';
      end if;
    end if;
  end if;

  -- (b) Fire a FRESH read-only debug_token probe for the NEXT run to evaluate.
  --     The token is read from the Vault and used inline — it never leaves the DB.
  v_token := public.bbf_get_vault_secret('META_TOKEN');
  if v_token is not null and length(v_token) > 0 then
    v_new_id := net.http_get(url := 'https://graph.facebook.com/debug_token?input_token=' || v_token || '&access_token=' || v_token);
    insert into public.bbf_system_status(key, state, detail, updated_at)
    values ('meta_token', coalesce((select state from public.bbf_system_status where key = 'meta_token'), 'UNKNOWN'),
            jsonb_build_object('last_request_id', v_new_id), now())
    on conflict (key) do update
      set detail = public.bbf_system_status.detail || jsonb_build_object('last_request_id', v_new_id),
          updated_at = now();
  end if;

  select * into v_row from public.bbf_system_status where key = 'meta_token';
  return v_row;
end;
$fn$;

-- Lock the probe down — it reads a Vault secret, so only the service role (and the
-- cron owner) may invoke it; never anon/authenticated.
revoke all on function public.bbf_meta_token_watchdog() from public;
grant execute on function public.bbf_meta_token_watchdog() to service_role;

-- ── 3) Schedule it — every 3 hours, idempotent re-schedule ───────────────────────
do $$
begin
  if exists (select 1 from cron.job where jobname = 'bbf-meta-token-watchdog') then
    perform cron.unschedule('bbf-meta-token-watchdog');
  end if;
end $$;

select cron.schedule('bbf-meta-token-watchdog', '0 */3 * * *', $$select public.bbf_meta_token_watchdog();$$);
