# bbf-meta-publish — Terminal Delta · Instagram Reels distribution

Publishes Reels to the BBF Instagram Business account via Meta's **official Content
Publishing API** (Graph API) — no browser, no scraping. Sister to `bbf-card-distributor`
(IG/FB photos) and `bbf-tiktok-publish` (TikTok video).

## What it does
1. **Auth** — reads a 60-day long-lived IG token from `bbf_system_config` (service-role
   RLS), auto-refreshing inside a 7-day skew window when `META_APP_ID`/`META_APP_SECRET`
   are present. Bootstraps from `META_TOKEN`/`META_IG_USER_ID` env if the row is empty.
2. **Caption** — turns `user_prompt` into a Reel caption via Claude, **routed through the
   model router** (`reel_caption` → Sonnet). Spend-gated + `bbf_llm_calls` telemetry.
3. **Publish** — resumable Reels flow: create `REELS` container → upload the binary →
   poll `status_code` until `FINISHED` → `media_publish`.

## ⚠️ Model tier — why Sonnet, not Opus
CLAUDE.md §4 reserves **Opus for safety-critical only** (PAR-Q+, ED/wellbeing, cardiac).
A marketing caption is customer-facing brand copy → **Sonnet** tier (same as `sales_chat`).
Per §4 the model is **never hardcoded** — it's `routeAndLog('bbf-meta-publish','reel_caption')`.
If you truly want Opus for captions, it's a one-line change in `MODEL_MAP` — but that's a
deliberate cost decision (Opus is ~5× Sonnet), so it lives in the router, reviewed in one place.

## Safety gates
- **Admin-only** — `X-BBF-Admin-Token` must equal `BBF_COACH_AGENT_TOKEN`.
- **Dry-run by default** — `publish` previews the caption + asset reachability and posts
  **nothing** unless `{ "live": true }`.
- **Spend-gated** — caption generation respects the budget kill-switch (`bbf_system_config.emergency_stop`).

## Actions (POST JSON, admin-gated)
| Body | Does | Posts? |
|---|---|---|
| `{ "action":"status" }` | token/config readiness | no |
| `{ "action":"set_token", "long_lived_token":"…", "ig_user_id":"…", "expires_in_days":60 }` | store the token | no |
| `{ "action":"refresh_token" }` | refresh the long-lived token now | no |
| `{ "action":"publish", "video_url":"…", "user_prompt":"…" }` | dry-run (caption preview) | no |
| `{ "action":"publish", "live":true, "video_url":"…", "user_prompt":"…", "share_to_feed":true }` | publish a Reel | yes |

`publish` accepts `caption` to skip generation. `video_url` is any URL the function can
fetch (e.g. a Supabase Storage signed/public URL) — the bytes are streamed to Meta's
resumable upload endpoint.

## Secrets
Auto-injected: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BBF_COACH_AGENT_TOKEN`,
`ANTHROPIC_API_KEY`. Optional for refresh: `META_APP_ID`, `META_APP_SECRET`.
Bootstrap fallback: `META_TOKEN`, `META_IG_USER_ID`, `META_GRAPH_VERSION`.

## Go-live runbook
1. Apply `20260606170000_bbf_meta_publish_config.sql`.
2. Deploy `bbf-meta-publish` (`verify_jwt:false` — admin token is the boundary).
3. `set_token` with the long-lived IG token + `ig_user_id` (or seed via SQL).
4. `status` → confirm `ready_to_post:true`.
5. `publish` dry-run → review the generated caption.
6. `publish` `{ live:true }` → returns the `media_id` (feed it to `bbf-signal-tracker`, `platform:'meta'`).
