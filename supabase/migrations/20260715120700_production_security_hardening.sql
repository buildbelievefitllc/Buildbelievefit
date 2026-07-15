-- In-House Equity Mandate · Phase 1.6 production security hardening (§7)
-- ----------------------------------------------------------------------------
-- Closes the three findings from the pre-deploy audit of 120000-120600:
--
--   A. bbf_compute_acwr was granted to `authenticated` with no ownership check.
--      The fn is SECURITY DEFINER (bypasses RLS) and takes p_athlete_id from the
--      caller, so ANY authenticated user could read ANY athlete's load data via
--      /rest/v1/rpc. Only bbf-athlete-acwr calls it, and that runs as service_role
--      — the `authenticated` grant was never needed. Revoked entirely.
--
--   B. research_vault_auth_read used `using (true)` — every authenticated user
--      could read the whole corpus, with no tier gate to separate free from
--      premium. Policy dropped; RLS stays ENABLED with NO policy, so anon and
--      authenticated are default-denied. service_role bypasses RLS, forcing all
--      reads/searches through tier-gated server-side edge functions.
--
--   C. tg_research_vault_embed sent `coalesce(v_secret, '')` when the Vault
--      secret was missing. It failed closed at the worker (401), but silently:
--      the INSERT succeeded, the row never vectorized, and the only trace was a
--      function log. Now it aborts the POST and RAISEs a WARNING instead.
--
-- Verified before writing: no client code reads research_vault or calls
-- query_research_embeddings; the sole bbf_compute_acwr caller is the edge fn
-- (service_role). This migration therefore breaks no live caller.
-- ----------------------------------------------------------------------------

-- ── A. Harden ACWR ──────────────────────────────────────────────────────────
-- service_role + postgres only. (anon already revoked in 120600; re-revoked here
-- so this migration is self-contained and order-independent on a fresh DB.)
revoke execute on function public.bbf_compute_acwr(uuid) from authenticated;
revoke execute on function public.bbf_compute_acwr(uuid) from anon;
revoke execute on function public.bbf_compute_acwr(uuid) from public;

grant execute on function public.bbf_compute_acwr(uuid) to postgres, service_role;

comment on function public.bbf_compute_acwr(uuid) is
  'In-House Equity · deterministic Foster-load ACWR (duration*sRPE, acute EWMA N=7 a=0.25, chronic N=28 a=0.0689, gapless). Zero API cost. Div-safe. SECURITY DEFINER — service_role/postgres ONLY (no ownership check on p_athlete_id; must never be reachable by anon/authenticated).';

-- ── B. Harden Research Vault & Search ───────────────────────────────────────
-- Drop the wide-open read policy. RLS remains ENABLED with zero policies =>
-- anon/authenticated are fully denied; service_role bypasses RLS.
drop policy if exists research_vault_auth_read on public.research_vault;

-- Belt-and-braces: RLS must stay on, or a dropped policy would mean open access.
alter table public.research_vault enable row level security;

revoke execute on function public.query_research_embeddings(vector, float, int) from authenticated;
revoke execute on function public.query_research_embeddings(vector, float, int) from anon;
revoke execute on function public.query_research_embeddings(vector, float, int) from public;

grant execute on function public.query_research_embeddings(vector, float, int)
  to postgres, service_role;

comment on function public.query_research_embeddings(vector, float, int) is
  'In-House Equity · native cosine (<=>) search over research_vault. Zero external search API. SECURITY DEFINER — service_role/postgres ONLY; all premium queries must route through tier-gated server-side edge functions.';

comment on table public.research_vault is
  'In-House Equity · Research Vault corpus. embedding is gte-small (384-dim), populated by the bbf-embed-research edge fn via the AFTER INSERT/UPDATE OF content webhook. RLS ENABLED with NO policies: anon/authenticated fully denied, service_role only. Reads/searches go through tier-gated edge functions.';

-- ── C. Harden Webhook Trigger (silent-failure fix) ──────────────────────────
create or replace function public.tg_research_vault_embed()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net, pg_temp
as $$
declare
  v_secret text;
  v_url    text := 'https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-embed-research';
begin
  -- Nothing to embed if there is no content.
  if new.content is null or length(btrim(new.content)) = 0 then
    return new;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'bbf_embed_webhook_secret'
  limit 1;

  -- Strict null-check: never fire an unsigned/empty-signed webhook. Previously we
  -- sent coalesce(v_secret,'') and let the worker reject it — fail-closed, but
  -- invisible. Abort loudly instead; the row still inserts, embedding stays NULL.
  if v_secret is null or length(btrim(v_secret)) = 0 then
    raise warning 'bbf_embed_webhook_secret is empty or missing. Aborting webhook execution.';
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'x-embed-secret', v_secret
    ),
    body    := jsonb_build_object(
      'type',   tg_op,
      'table',  'research_vault',
      'record', jsonb_build_object('id', new.id, 'content', new.content)
    )
  );

  return new;
end;
$$;

comment on function public.tg_research_vault_embed() is
  'In-House Equity · async pg_net webhook -> bbf-embed-research, Vault-secret signed. Trigger is OF content so the embedding write-back cannot re-fire it. Aborts with a WARNING if the Vault secret is missing (never sends an empty signature).';

-- CREATE OR REPLACE resets grants to the default, which on Supabase re-grants
-- EXECUTE to anon/authenticated. This fn must never be RPC-callable — only the
-- trigger fires it, as the table owner. Re-strip every callable role.
revoke execute on function public.tg_research_vault_embed() from public, anon, authenticated;
