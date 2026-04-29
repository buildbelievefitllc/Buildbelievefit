# Antigravity Integration Notes

**Purpose:** orientation doc for Antigravity (AG) coming back into the BBF workflow after the Phase 3 hardening sprint. Read this first before picking up new work.

**Last updated:** 2026-04-29 by Claude.

---

## What changed while you were gone

A focused hardening sprint closed Phase 3 P0–P3 across 8 PRs. The repo and production are now aligned, the schema is documented, and the architectural decision for the next big move (sync re-route) is captured.

### Recent merged work

| PR | What |
|---|---|
| #51 | Re-entrancy guard on auth handlers (Phase 2 hotfix) |
| #52 | Schema-truth + drift report (`api/supabase-schema-actual.sql`, `api/SCHEMA_DRIFT_REPORT.md`) |
| #53 | Supabase CLI plumbing (`supabase/migrations/`, baseline migration) |
| #54 | Reconstructed `phase2_hotfix_uid_column.sql` from production registry |
| #55 | Removed duplicate auth listeners + dead Cloudflare email-decode script |
| #56 | RLS hardening — locked anon access on `bbf_sets`, `bbf_readiness`, `content_monarch` |
| #57 | SW cache-bump + 10s `AbortController` fetch timeout on auth/sync |
| #58 | PIN length 4 → 6 digits (mobile lockout bug) |
| #59 | Cleanup: `clinical_yield_log` dead refs + null-uid admin row delete |

### Production state snapshot

```
Project ref       : ihclbceghxpuawymlvgi (bbf-lab)
Postgres version  : 17.6
Migrations applied:
  20260101000000  baseline
  20260429054308  phase2_hotfix_uid_column
  20260429140000  rls_hardening
  20260429170000  remove_null_uid_admin_row

bbf_users  : 1 row (akeem, trainer, bcrypt PIN, 6-digit)
bbf_logs   : 0 rows
bbf_sets   : 0 rows  (RLS enabled, no policies)
bbf_readiness : 0 rows  (RLS enabled, no policies)
bbf_active_clients : 4 rows (lead webhook works)
content_monarch    : 2 rows
bbf_pin_attempts   : transient

All 7 public tables have RLS enabled. Only bbf_active_clients has a
policy (anon INSERT for the lead webhook). Other tables are RLS-locked
and only accessible via SECURITY DEFINER RPCs or service-key.
```

---

## Workflow contract

### MCP-first, CLI-optional

Claude has direct Supabase MCP access (tools prefixed `mcp__Supabase__` or `mcp__3ff67aec-...__`). When AG drafts a SQL migration, Claude applies it via `apply_migration` or `execute_sql` — **no CLI install needed on the user's machine**.

The Supabase CLI workflow is documented in `supabase/README.md` for the rare case where the user wants to apply migrations themselves without a Claude session.

### Division of labor

| Role | Owner |
|---|---|
| Audit / research / design proposals | AG |
| Code implementation (HTML/JS/SQL files in repo) | AG |
| Opening PRs | AG (or Claude via GitHub MCP if AG hits friction) |
| PR review / diff verification | Claude |
| Merging PRs | User |
| GitHub Pages deploy | Auto (via merge to main) |
| Supabase migrations | **Claude, directly via MCP** when connected |
| Verifying production state | Claude, via MCP queries |
| Smoke testing | User + Claude coordinating |
| Final approval | User |

### Trust pattern

Every deliverable lands as a commit + PR. Claude verifies it against production reality (not the legacy schema fiction file — that's deprecated and renamed `api/supabase-schema.legacy.sql` with a DO-NOT-USE header). The phase closes only when smoke tests pass.

---

## Where to look first

| Question | File |
|---|---|
| What does production actually look like? | `api/supabase-schema-actual.sql` (canonical) |
| What was wrong with the old schema doc? | `api/SCHEMA_DRIFT_REPORT.md` (14 catalogued items) |
| Why was RLS hardened? | `api/RLS_HARDENING_AUDIT.md` (security gap analysis + the ~30 broken anon calls in `bbf-sync.js`) |
| What did the Phase 2 PIN+lockout system look like? | `api/PHASE2_DESIGN.md`, `api/AUTH_TOUCHPOINT_AUDIT.md` |
| How do migrations work now? | `supabase/README.md` |
| What's the next big architectural move? | `api/SYNC_REROUTE_DESIGN.md` |

**Do not edit `api/supabase-schema.legacy.sql`** — it's retained for git history continuity only.

---

## Current backlog (in priority order)

### Priority 1 — Sync re-route to Supabase Auth (`api/SYNC_REROUTE_DESIGN.md`)

User has signaled intent for **Option B (Supabase Auth migration)**. Awaiting final ratification on the open questions in the design doc (auth providers for v1, founder fallback during migration, client UX expectations, migration pace).

Once ratified, AG owns Phase A–G implementation. Each phase ships as its own PR. Estimated 6–10 PRs total to fully migrate.

### Priority 2 — Phase 2C tests (deferred from Phase 3 P2)

Defensive coverage for the auth/lockout system. Match the existing `*.test.js` pattern in the repo root:

- `lockout-state-machine.test.js` — test the `bbf_pin_attempts` upsert logic for failed_count increment, sliding-window reset, lockout activation thresholds
- `auth-json-contract.test.js` — test client handling of various RPC response shapes (`ok:true`, `lockout_active:true`, `error:true`, malformed)
- `countdown-timer.test.js` — test the `setInterval`-driven UI decrement logic in admin.html / bbf-app.html / coach-lab.html

These can be picked up either before or during the sync re-route, but are most useful **before** since they pin down current behavior and let us catch regressions during the rewrite.

### Priority 3 — Client onboarding flow design

Will likely be subsumed by the sync re-route's Phase D (Supabase Auth signup flow). If the user picks email+password for v1, this is straightforward. If they want a phone-OTP or magic-link UX, more design work needed.

### Priority 4 — Ongoing service worker design call

The current SW uses stale-while-revalidate (cached version returned first, network in background). PR #57 added a manual cache-bump convention (bump `CACHE` string per deploy). The deeper question — switch to network-first? — is deferred. Real trade-off (freshness vs latency); the user wants explicit input before choosing.

---

## What NOT to do

- **Do not paste SQL into the dashboard SQL editor.** Every change goes through `supabase/migrations/`. The drift we just spent two phases cleaning up was caused by exactly this pattern.
- **Do not edit a migration file after it's been applied.** Migrations are immutable once in `supabase_migrations.schema_migrations`. New changes go in a new file.
- **Do not trust `api/supabase-schema.legacy.sql`.** It documents a fictional model. The canonical schema is `api/supabase-schema-actual.sql` and the migrations directory.
- **Do not run destructive Supabase ops** (drop tables, truncate, force-reset migrations) without explicit user authorization. The user trusts the workflow but expects communication on irreversible changes.
- **Do not push directly to `main`.** Open a PR. User merges.

---

## How to start a new task

1. Read this file + the relevant audit/design doc in `api/`
2. Pull `main`, branch from it (`claude/<short-name>` or `ag/<short-name>` convention)
3. Make changes, commit with a clear message
4. Open a PR with: summary, change list, test plan, risk notes
5. Tag Claude (or post a clear handoff message) for MCP application of any SQL changes
6. User merges after review

If a task has SQL: **write the migration file under `supabase/migrations/<timestamp>_<name>.sql`**, then either ask Claude to apply via MCP or coordinate with the user. Do not apply via dashboard.

---

## Open questions waiting on user

These come from `api/SYNC_REROUTE_DESIGN.md`. AG should not start Phase A until the user has answered:

1. Auth providers for v1: email-only? phone-only? both? Email + OAuth (Google/Apple)?
2. Founder PIN flow: keep as fallback through Phase G or cut over fully in Phase C?
3. Client UX: is email + password acceptable, or does the brand require frictionless username + PIN?
4. Migration pace: one PR per phase (slow + safe) or bundle (faster + bigger blast radius)?

When user answers, the design doc gets a "Ratified by [user] on [date]" entry at the bottom and AG begins Phase A.
