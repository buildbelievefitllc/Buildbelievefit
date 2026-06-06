-- bbf-tiktok-oauth — rotating OAuth token store for the TikTok Content Posting API.
-- ─────────────────────────────────────────────────────────────────────────────
-- Companion to the `bbf-tiktok-oauth` (auth lifecycle) and `bbf-tiktok-publish`
-- (video Direct Post) edge functions, and the shared `_shared/tiktok-auth.ts`
-- module that reads/writes this row.
--
-- WHY A TABLE (and not Vault) FOR THESE TOKENS:
--   The TikTok *Client Key* and *Client Secret* are STATIC app credentials — those
--   live in Supabase Vault (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET), read via the
--   existing public.bbf_get_vault_secret() reader, exactly like META_TOKEN /
--   TIKTOK_TOKEN. The *access* and *refresh* tokens, by contrast, ROTATE: the access
--   token expires every ~24h and is re-minted from the refresh token. A rotating
--   value is a poor fit for Vault (no clean in-place update by name); it belongs in a
--   locked row the service role can UPDATE in place. Security boundary is identical
--   to bbf_posting_history: RLS on, service-role-only policy => anon/authenticated
--   have zero access, and the SERVICE_ROLE_KEY never leaves the edge runtime
--   (CLAUDE.md §7). No secret VALUE is written in this migration or in git.
--
-- SINGLETON: a single id=1 row holds the live token set (one TikTok app → one creator
-- session for the BBF brand account). `auth_state` carries the short-lived CSRF nonce
-- minted by an admin-gated `authorize` call and verified at the public OAuth callback,
-- so only an admin-initiated flow can complete a token exchange.

create table if not exists public.bbf_tiktok_oauth_v1 (
  id                 smallint primary key default 1 check (id = 1),
  open_id            text,        -- TikTok creator open_id (stable per app+user)
  scope              text,        -- granted scopes, e.g. 'user.info.basic,video.publish,video.upload'
  access_token       text,        -- rotates (~24h); re-minted from refresh_token
  refresh_token      text,        -- longer-lived; rotates on each refresh
  access_expires_at  timestamptz, -- when access_token must be refreshed by
  refresh_expires_at timestamptz, -- when the creator must re-authorize from scratch
  auth_state         text,        -- short-lived CSRF nonce for the authorize→callback handshake
  auth_state_at      timestamptz, -- nonce mint time (callback enforces a TTL)
  updated_at         timestamptz not null default now()
);

comment on table public.bbf_tiktok_oauth_v1 is
  'Rotating TikTok Content Posting API OAuth token set (singleton id=1) for the BBF brand account. Written ONLY by the bbf-tiktok-oauth / bbf-tiktok-publish edge functions via the service role. Static Client Key/Secret live in Vault, not here. RLS service-role-only => no anon/authenticated access.';

alter table public.bbf_tiktok_oauth_v1 enable row level security;

-- Strict service-role-only RLS (mirrors bbf_posting_history): the edge functions
-- (service-role key) are the only reader/writer. No anon/authenticated policy =>
-- full deny by default for browser/JWT callers, so a token can never be read client-side.
drop policy if exists "bbf_tiktok_oauth_service_only" on public.bbf_tiktok_oauth_v1;
create policy "bbf_tiktok_oauth_service_only"
  on public.bbf_tiktok_oauth_v1 for all
  to service_role
  using (true)
  with check (true);

-- Keep updated_at honest on every write.
create or replace function public.bbf_tiktok_oauth_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_bbf_tiktok_oauth_touch on public.bbf_tiktok_oauth_v1;
create trigger trg_bbf_tiktok_oauth_touch
  before update on public.bbf_tiktok_oauth_v1
  for each row execute function public.bbf_tiktok_oauth_touch();
