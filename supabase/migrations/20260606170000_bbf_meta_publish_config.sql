-- bbf-meta-publish — Terminal Delta · Instagram Reels distribution config.
-- ─────────────────────────────────────────────────────────────────────────────
-- Extends the existing single-row public.bbf_system_config (created by the budget
-- kill-switch migration, service-role-only RLS) with the Meta / Instagram Graph API
-- credentials: a 60-day long-lived IG access token + its expiry, the IG Business
-- user id that owns the Reels, and the graph version. RLS on bbf_system_config is
-- already service-role-only, so the token is never readable by anon/authenticated
-- (CLAUDE.md §7). NO secret value is written in this migration.

alter table public.bbf_system_config
  add column if not exists meta_ig_access_token     text,
  add column if not exists meta_ig_token_expires_at timestamptz,
  add column if not exists meta_ig_user_id          text,
  add column if not exists meta_graph_version       text not null default 'v21.0';

comment on column public.bbf_system_config.meta_ig_access_token is
  '60-day long-lived Instagram Graph API access token · written/refreshed by bbf-meta-publish · service-role only';
comment on column public.bbf_system_config.meta_ig_token_expires_at is
  'Expiry of meta_ig_access_token · bbf-meta-publish refreshes when inside the skew window';
comment on column public.bbf_system_config.meta_ig_user_id is
  'Instagram Business/Creator user id (IG-User-ID) that owns the Reels being published';
comment on column public.bbf_system_config.meta_graph_version is
  'Graph API version for Meta calls (default v21.0)';

-- Seed the token once with real values — do NOT commit them. Either run this in the
-- SQL editor, or use the function action  { "action": "set_token", ... }:
--   update public.bbf_system_config
--      set meta_ig_access_token     = '<LONG_LIVED_TOKEN>',
--          meta_ig_user_id          = '<IG_BUSINESS_USER_ID>',
--          meta_ig_token_expires_at = now() + interval '60 days'
--    where id = 1;
