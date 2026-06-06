# bbf-tiktok-publish + bbf-tiktok-oauth — TikTok video distribution

The **official, ToS-compliant** path for pushing a BBF Calling Card video to TikTok.
No browser automation, no cookie/profile hijack — the edge function holds an OAuth
token and talks to TikTok's [Content Posting API](https://developers.tiktok.com/doc/content-posting-api-get-started).

This is the **video** counterpart to `bbf-card-distributor` (which posts *photo* cards).
Both can share one token: this feature provisions a *self-refreshing* OAuth token, fixing
the Distributor's current assumption that a static `TIKTOK_TOKEN` stays valid (it expires
every ~24h).

## Pieces

| Piece | Path | Role |
|---|---|---|
| OAuth lifecycle | `supabase/functions/bbf-tiktok-oauth/` | authorize → callback → refresh; stores tokens |
| Video publisher | `supabase/functions/bbf-tiktok-publish/` | `status` / `verify` / `init` / `poll` (Direct Post) |
| Shared auth | `supabase/functions/_shared/tiktok-auth.ts` | token store + auto-refresh + creator gate |
| Token store | `supabase/migrations/20260606120000_bbf_tiktok_oauth_tokens.sql` | `bbf_tiktok_oauth_v1`, service-role RLS |
| Calling Card caller | `scripts/publish-calling-card.mjs` | local file → chunked upload → poll |

## Four safety gates (same posture as the Distributor)

1. **Admin-only** — `X-BBF-Admin-Token` must equal `BBF_COACH_AGENT_TOKEN`, else `401`.
2. **Dry-run by default** — `init` previews the creator gate + chunk plan and posts
   **nothing** unless the body carries `{ "live": true }`. The caller mirrors this (`--live`).
3. **Token-gated** — no provisioned OAuth token ⇒ nothing can post.
4. **Privacy-gated** — the requested `privacy_level` must be in the creator's
   `privacy_level_options`. We never upgrade past what TikTok allows.

## ⚠️ The audit gate (plan around this)

Until the TikTok app passes **audit** for `video.publish`, Direct Post is restricted to
`SELF_ONLY` — the video lands **private** on the account. That's not a bug; it's TikTok's
rule for unaudited apps. `verify` shows the real `privacy_level_options`. Public posting
(`PUBLIC_TO_EVERYONE`) unlocks after the app is audited in the developer console.

## One unavoidable human step (TikTok console — not bypassable)

TikTok requires the **app owner** to configure these in
[developers.tiktok.com](https://developers.tiktok.com) (no API does it for you):

- Add the **Content Posting API** product with the **Direct Post** capability.
- Request scopes: `user.info.basic`, `video.publish`, `video.upload`.
- Register the **redirect URI** (exact match) — use this function's URL:
  `https://<project-ref>.supabase.co/functions/v1/bbf-tiktok-oauth`
  (or set `TIKTOK_REDIRECT_URI` to whatever you registered).
- For `PULL_FROM_URL` only: verify the source **domain** as a URL-prefix property.

## Secrets (Supabase Vault first, `Deno.env` fallback — house pattern)

| Secret | Purpose |
|---|---|
| `TIKTOK_CLIENT_KEY` | static app Client Key |
| `TIKTOK_CLIENT_SECRET` | static app Client Secret |
| `TIKTOK_REDIRECT_URI` | optional; exact-match registered redirect (defaults to the oauth fn URL) |
| `TIKTOK_TOKEN` | optional static access-token fallback (legacy/manual) |

```sql
select vault.create_secret('<client key>',    'TIKTOK_CLIENT_KEY');
select vault.create_secret('<client secret>', 'TIKTOK_CLIENT_SECRET');
```

Auto-injected by Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BBF_COACH_AGENT_TOKEN`.

## Go-live runbook

1. **Migrate** the token store: apply `20260606120000_bbf_tiktok_oauth_tokens.sql`.
2. **Deploy** both functions (`verify_jwt: false` — the admin token is the boundary):
   `deploy_edge_function` → `bbf-tiktok-oauth`, then `bbf-tiktok-publish`.
3. **Inject** `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` (Vault or env) + console setup above.
4. **Authorize once**: `POST bbf-tiktok-oauth { "action":"authorize" }` → open `authorize_url`
   in a browser, approve → the callback stores the tokens and shows a success page.
5. **Verify**: `POST bbf-tiktok-publish { "action":"verify" }` → confirm `active:true` and
   read `privacy_level_options`.
6. **Dry run**: `node scripts/publish-calling-card.mjs ./calling-card.mp4 "caption"` → gate passes, nothing posts.
7. **Go live**: add `--live` → uploads, polls, prints the `video_id`.

## Actions (POST JSON, admin-gated)

**bbf-tiktok-oauth**

| Body | Does |
|---|---|
| `{ "action":"authorize" }` | returns a consent `authorize_url` + CSRF `state` |
| `{ "action":"refresh" }` | force-refresh the access token (cron-safe) |
| `{ "action":"status" }` | value-free token status (presence/expiry/scope) |
| `GET ?code&state` | OAuth callback (browser redirect target) |

**bbf-tiktok-publish**

| Body | Does | Posts? |
|---|---|---|
| `{ "action":"status" }` | readiness snapshot | no |
| `{ "action":"verify" }` | creator-info query (allowed privacy, limits) | no |
| `{ "action":"init", "live":true, "source":"FILE_UPLOAD", "video_size":N, "caption":"…" }` | start Direct Post → `publish_id` + `upload_url` + `chunk_plan` | yes |
| `{ "action":"init", "live":true, "source":"PULL_FROM_URL", "video_url":"…", "caption":"…" }` | start Direct Post from a URL | yes |
| `{ "action":"poll", "publish_id":"…" }` | publish status (+ final `video_id`) | no |

`init` optional params: `privacy_level` (default `SELF_ONLY`), `disable_comment`,
`disable_duet`, `disable_stitch`, `cover_timestamp_ms`.

## Signal loop

On `PUBLISH_COMPLETE`, `poll` returns `video_id` — the same id `bbf-signal-tracker`
polls into `bbf_posting_history` (`platform:"tiktok"`). The loop closes:
publish → video_id → impressions/CTR telemetry.

## Follow-up (intentionally not built)

- Point `bbf-card-distributor`'s TikTok path at `getValidAccessToken()` too, so the
  photo + video paths share one self-refreshing token (drops the static-`TIKTOK_TOKEN` staleness).
- Cron a `bbf-tiktok-oauth { "action":"refresh" }` as belt-and-suspenders (publish already auto-refreshes).
