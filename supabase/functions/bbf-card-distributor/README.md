# bbf-card-distributor — "The Distributor"

Social distribution for the BBF calling-card batch:
`public.bbf_calling_cards_batch_v1` → **Meta (Instagram + Facebook)** and **TikTok**.

> **Status: scaffolded, integration logic complete, awaiting live API tokens.**
> The function is wired and deployable; it cannot post until the CEO injects the
> social tokens into Supabase Vault. Four independent gates make an accidental
> live blast impossible (see below).

---

## The flip rule (CEO directive)

A row is flipped to `status='posted'` **if and only if every targeted, enabled
channel returns a confirmed HTTP 200.** Any non-200 → the row is marked `'failed'`
with an audit trail and is **not** posted. A card whose rendered image isn't in
Storage yet is released back to `'queued'` (Bravo may still be rendering it).

## Four safety gates

1. **Admin-only** — `X-BBF-Admin-Token` must equal `BBF_COACH_AGENT_TOKEN`, else `401`.
2. **Dry-run by default** — `distribute` previews only; it posts/mutates **only**
   when the body explicitly carries `{ "live": true }`.
3. **Token-gated** — a channel is "enabled" only when its Vault secrets are present.
   No tokens → nothing enabled → nothing can post.
4. **Asset-gated** — a card posts only if its rendered image exists in Storage.

## Actions (POST JSON, all admin-gated)

| Body | What it does | Side effects |
|---|---|---|
| `{ "action": "status" }` | Queue counts + which channels are configured | none (read-only) |
| `{ "action": "verify" }` | Authenticated test call per configured channel → active/inactive | none (never posts) |
| `{ "action": "distribute" }` | **Dry-run preview** — resolves assets + channels, lists what *would* post | none |
| `{ "action": "distribute", "live": true, "limit": 25 }` | **LIVE** — posts + applies the flip rule | posts to social; flips rows |

Optional `distribute` params: `limit` (1–100, default 25), `ids` (specific rows),
`channels` (subset of `["instagram","facebook","tiktok"]`).

## Secrets (Supabase Vault first, `Deno.env` fallback)

The function reads each via `public.bbf_get_vault_secret(name)` (a service_role-only
reader; see `supabase/migrations/20260605000000_bbf_card_distributor_vault_reader.sql`),
falling back to `Deno.env.get`. Inject whichever way you prefer.

| Secret | Enables | Notes |
|---|---|---|
| `META_TOKEN` | Meta (IG + FB) | Long-lived Graph API access token |
| `META_IG_USER_ID` | Instagram | IG Business user id |
| `META_FB_PAGE_ID` | Facebook | Page id |
| `TIKTOK_TOKEN` | TikTok | Content Posting API access token |
| `META_GRAPH_VERSION` | — | optional, default `v21.0` |
| `BBF_CARDS_BUCKET` | — | optional, default `calling-cards-v1` |
| `BBF_CARDS_EXT` | — | optional, default `png` |

Inject into Vault (example):

```sql
select vault.create_secret('EAAG...your-token...', 'META_TOKEN');
select vault.create_secret('17841400000000000', 'META_IG_USER_ID');
select vault.create_secret('1000000000000', 'META_FB_PAGE_ID');
select vault.create_secret('act.your-tiktok-token', 'TIKTOK_TOKEN');
```

## Asset convention

Each card's image is expected at
`storage/v1/object/public/<BBF_CARDS_BUCKET>/<row id>.<BBF_CARDS_EXT>`
(default `calling-cards-v1/<id>.png`). The bucket must be **public** (or this can be
switched to signed URLs). For TikTok PULL_FROM_URL, the bucket domain must be
verified in the TikTok developer console.

## Go-live runbook

1. **Deploy** (done as a scaffold, or redeploy after edits):
   `deploy_edge_function` → name `bbf-card-distributor`, `verify_jwt: false`
   (the admin token is the boundary, matching `bbf-admin-roster`).
2. **Migrate** (Vault reader + audit columns): apply
   `20260605000000_bbf_card_distributor_vault_reader.sql`.
3. **Inject tokens** into Vault (above).
4. **Verify**: `POST { "action": "verify" }` → confirm `active: true` per channel.
5. **Preview**: `POST { "action": "distribute" }` (dry-run) → confirm assets resolve.
6. **Go live, small**: `POST { "action": "distribute", "live": true, "limit": 1 }`,
   confirm the post + the `posted` flip, then scale the `limit` up.

## Enhancements (left as hooks, intentionally not built)

- TikTok publish-status poll (`/v2/post/publish/status/fetch/`) — the init 200 is
  treated as success per the flip rule; a follow-up poll can confirm final publish.
- Per-channel idempotency replay (skip channels already in `post_refs`) for safe
  partial-failure retries — currently partial failures stop at `'failed'` for review.
- Audience routing by `platform_target` (`athlete`/`hybrid`/`everyday`/`online`) if
  you want different channel sets per segment.
