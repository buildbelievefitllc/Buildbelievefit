# Antigravity Integration Notes

**Purpose:** orientation doc for Antigravity (AG) coming back into the BBF workflow. Read this first before picking up new work.

**Last updated:** 2026-04-30 by Claude (post-Phase 4 + Phase 5 shipping).

---

## TL;DR — What's running tonight

**The closed-loop pipeline is operational end-to-end.** A real customer can:

1. Fill the Pathfinder questionnaire on `index.html`
2. Submit → Render `/process` endpoint catches it
3. Render Phase 1 upserts `bbf_active_clients` (Supabase service-key)
4. Render Phase 2 calls Anthropic Claude in parallel with two locked system prompts (hypertrophy + nutrition) — **outputs strict JSON in legacy WP/MP shapes**
5. Render Phase 3 writes the JSON back to the row's `workout_plan` + `meal_plan` + `plans_generated_at` columns
6. Customer pays via Stripe (Tier 1 / 2 / 3)
7. Stripe webhook fires the BBF Ghost Automation Zapier Zap
8. Zap step 2 hits Render `/provision` with `X-BBF-Token` header
9. `/provision` calls `bbf_provision_client_pin` RPC — generates `firstname_bbf` username + 6-digit PIN, bcrypts the PIN, inserts `bbf_users` row linked by email
10. `/provision` returns `{username, pin, email, tier, app_url}` to Zapier
11. Zap step 3 (Gmail) sends a welcome email with credentials embedded via merge tags
12. Customer clicks the app link, signs in with their `firstname_bbf` + 6-digit PIN
13. `bbf_verify_user_pin` returns the auth response **plus the cloud workout/meal JSON**
14. `bbf-app.html` LOGIN parses the JSON, sets `PLAN` (workout array) and `MP[uid]` (meal object)
15. PROGRAM tab + NUTRITION tab render in the **same polished UI as legacy clients** (Ana, Jacky, etc.) — day tabs, exercise cards, color-coded meal sections, "MARK SESSION COMPLETE" button

Verified end-to-end with test user `akeem_bbf / 709027`.

---

## Recent merged work (Phase 3 + 4 + 5)

| PR | What |
|---|---|
| #51 | Re-entrancy guard on auth handlers |
| #52 | Schema-truth + drift report (`api/supabase-schema-actual.sql`, `api/SCHEMA_DRIFT_REPORT.md`) |
| #53 | Supabase CLI plumbing (`supabase/migrations/` + baseline) |
| #54 | Reconstructed `phase2_hotfix_uid_column.sql` from production registry |
| #55 | Removed duplicate auth listeners + dead Cloudflare email-decode script |
| #56 | RLS hardening — locked anon access on `bbf_sets`, `bbf_readiness`, `content_monarch` |
| #57 | SW cache-bump + 10s `AbortController` fetch timeout on auth/sync |
| #58 | PIN length 4 → 6 digits (mobile lockout bug fix) |
| #59 | Cleanup: `clinical_yield_log` dead refs + null-uid admin row |
| #60 | Sync re-route design + initial AG notes |
| #61 | Captured Big Jim V12 directive + reality reconciliation |
| #62 | Added `workout_plan` + `meal_plan` + `plans_generated_at` columns to `bbf_active_clients` |
| #63 | Render server writes Anthropic Markdown back to `bbf_active_clients` (V8 → V9) |
| #64 | Wired Pathfinder form to Render `/process` + CORS allowlist |
| #65 | bbf-app.html displays plans + `bbf_verify_user_pin` returns plans on auth |
| #66 | Payment-first credential provisioning (`/provision` endpoint + RPC + welcome email rewrites) |
| #67 | `api/PHASE_4_LIVE_CONFIG.md` — dashboard config reference |
| #68 | SW cache bump v17 → v18 (force refresh of stale browsers) |
| #69 | Program + Nutrition tabs read from cloud plans (Phase 5 polish, Markdown render) |
| #70 | Anthropic outputs JSON in WP/MP shapes — cloud plans render in polished UI |
| #71 | LP() cloud-cache fix (program tab was resetting PLAN to null) |
| #72 | Removed redundant home-tab YOUR PLAN summary panel |

22 PRs since Phase 2. Closed loop verified working.

---

## Production state snapshot (verified via MCP)

```
Project ref       : ihclbceghxpuawymlvgi (bbf-lab)
Postgres version  : 17.6
Render service    : https://buildbelievefit.onrender.com (V9 — closed loop)
Pages site        : https://buildbelievefit.fitness (auto-deploys on main)
Migrations applied:
  20260101000000  baseline
  20260429054308  phase2_hotfix_uid_column
  20260429140000  rls_hardening
  20260429170000  remove_null_uid_admin_row
  20260429220000  add_plan_columns
  20260429232015  verify_user_pin_returns_plans
  20260429233809  credential_provisioning

bbf_users:
  - akeem (uid='akeem', role='trainer', bcrypt PIN — founder)
  - akeem_bbf (uid='akeem_bbf', role='client', bcrypt PIN — TEST USER, see "Test artifacts" below)

bbf_active_clients: 4 rows (1 with vault_email + JSON test plans, 3 from earlier webhook tests)
bbf_pin_attempts: transient
content_monarch: 2 rows (untouched)

All 7 public tables have RLS enabled. Auth flow operational via SECURITY
DEFINER RPCs (bbf_verify_admin_pin, bbf_verify_user_pin, bbf_admin_clear_lockout,
bbf_provision_client_pin).

Service Worker cache: v22
```

### Test artifacts that need cleanup at some point

These are leftover from tonight's verification. **Not blocking but should be wiped before first real customer goes through:**

- `bbf_users` row with `uid='akeem_bbf', email='akeemkbrown@gmail.com'`
- `bbf_active_clients` row for `akeemkbrown@gmail.com` has TEST workout/meal JSON content (replace with real data when first real customer pays)

Cleanup SQL when ready:
```sql
DELETE FROM bbf_users WHERE uid = 'akeem_bbf';
UPDATE bbf_active_clients
  SET workout_plan = NULL, meal_plan = NULL, plans_generated_at = NULL, vault_email = NULL
  WHERE client_email = 'akeemkbrown@gmail.com';
```

Defer until first real Pathfinder + Stripe lifecycle goes through.

---

## Workflow contract

### MCP-first, CLI-optional

Claude has direct Supabase MCP access via `mcp__3ff67aec-...__apply_migration` and `execute_sql`. When AG drafts a SQL migration, Claude applies it via MCP — **no CLI install needed on the user's machine**.

### Division of labor

| Role | Owner |
|---|---|
| Audit / research / design proposals | AG |
| Code implementation (HTML/JS/SQL files in repo) | AG |
| Opening PRs | AG (or Claude via GitHub MCP if AG hits friction) |
| PR review / diff verification | Claude |
| Merging PRs | User (or Claude via MCP when authorized) |
| GitHub Pages deploy | Auto (via merge to main) |
| Render deploy | Auto (via merge to main) |
| Supabase migrations | **Claude via MCP** when connected |
| Verifying production state | Claude via MCP queries |
| Smoke testing | User + Claude coordinating |
| Final approval | User |

### Trust pattern

Every deliverable lands as a commit + PR. Claude verifies it against production reality (not the legacy schema fiction file — that's deprecated and renamed `api/supabase-schema.legacy.sql`). Phase closes only when smoke tests pass.

---

## Where to look first

| Question | File |
|---|---|
| What does the closed loop actually do? | `api/PHASE_4_LIVE_CONFIG.md` (dashboard config + smoke test path) |
| What's the founder's V12 vision? | `api/BIGJIM_V12_DIRECTIVE.md` (verbatim + Claude's reconciliation) |
| Why was the sync re-route Option A vs Option B? | `api/SYNC_REROUTE_DESIGN.md` (Option B was the original recommendation; user ratified Option A — PIN-based, trainer-curated. Doc has the decision rationale) |
| What does production actually look like? | `api/supabase-schema-actual.sql` (canonical) |
| What was wrong with the old schema doc? | `api/SCHEMA_DRIFT_REPORT.md` (14 catalogued items) |
| Why was RLS hardened? | `api/RLS_HARDENING_AUDIT.md` (security gap analysis) |
| Phase 2 PIN+lockout design | `api/PHASE2_DESIGN.md`, `api/AUTH_TOUCHPOINT_AUDIT.md` |
| How do migrations work now? | `supabase/README.md` |
| What format does Anthropic output now? | See `index.js` SYSTEM_PROMPT_HYPERTROPHY and SYSTEM_PROMPT_NUTRITION — both require strict JSON in WP/MP shapes |

**Do not edit `api/supabase-schema.legacy.sql`** — retained for git history only.

---

## Curated backlog (pick top item, propose plan, ship)

In priority order. Each is bounded scope — one PR, one smoke test, one merge.

### P1 — Test artifact cleanup
Delete `akeem_bbf` user + reset `bbf_active_clients` for `akeemkbrown@gmail.com` (SQL above). Single migration. Trivial. Can defer until first real customer goes through.

### P1 — Native Pathfinder INSIDE bbf-app.html
Big Jim v2's vision: customers fill Pathfinder *in the app* for re-assessment, not just on the marketing site at sign-up. Add a "Re-Calibrate" tab/button in `bbf-app.html` that shows the same Pathfinder form, fires at `/process` with the logged-in user's existing email so plans regenerate.

Scope: ~150 lines new HTML/JS in bbf-app.html, no schema changes (Render `/process` already accepts the payload).

### P1 — Vapi voice integration (Big Jim directive #4)
Outbound accountability calls based on logged activity. Webhook from Supabase row events to Vapi. Scope: needs design — Vapi setup, webhook payload spec, trigger conditions (missed log streak, etc.). Not a single PR — likely a 3-4 PR sequence.

### P2 — ACWR / wearable sync (Big Jim directive #3)
Schema for wearable data import (Whoop, Apple Health, Oura). ACWR computation as a Postgres function. RED-LOCKOUT state machine that flags overtraining. **Big new schema area** — design doc first, then implement.

### P2 — Trilingual cloud plans
The app has EN/ES/PT toggle but cloud-generated plans are English-only. Anthropic system prompts could be extended to output `{en, es, pt}` keyed content, or per-language generation triggered by `language_preference` in the Pathfinder payload.

### P2 — Phase 2C tests (long-deferred)
Defensive unit tests for the lockout state machine, JSON contract handling, countdown timer. Match `*.test.js` pattern. Locks in current behavior so future refactors don't regress.

### P3 — Markdown fallback removal in RW/RN
Once enough cloud plans are JSON (basically all of them after PR #70), the `<pre>` Markdown fallback in RW() and RN() becomes dead code. Remove for cleanliness. Wait until at least one real customer has cycled through to confirm Anthropic JSON is reliable.

### P3 — Welcome email polish
Currently the Gmail step in the Zap sends a basic HTML welcome with credentials embedded. Move to Brevo for proper template management + trilingual variants (`api/day0-welcome-emails.json` already has the copy). Required: Brevo dashboard setup + Zapier flow update + cutover.

---

## What NOT to do

- **Don't paste SQL into the Supabase dashboard SQL editor.** Every change goes through `supabase/migrations/`. The drift we just spent two phases cleaning up was caused by exactly this pattern.
- **Don't edit a migration file after it's been applied.** Migrations are immutable once in `supabase_migrations.schema_migrations`. New changes go in a new file.
- **Don't trust `api/supabase-schema.legacy.sql`.** Documents a fictional model. Canonical schema is `api/supabase-schema-actual.sql`.
- **Don't run destructive Supabase ops** (drop tables, truncate, force-reset migrations) without explicit user authorization.
- **Don't push directly to `main`.** Open a PR. User merges (or Claude when authorized).
- **Don't break the BBF Ghost Automation Zap.** It's the live link between Stripe and the welcome email. Any changes to the `/provision` response shape need coordinated Zapier dashboard updates.
- **Don't change Anthropic system prompts to revert to Markdown output.** The frontend now expects JSON in WP/MP shapes (PR #70). Keep them in sync.

---

## How to start a new task

1. Read this file + the relevant doc in `api/`
2. Pull `main`, branch from it (`ag/<short-name>` or `claude/<short-name>`)
3. Make changes, commit with a clear message
4. Open a PR with: summary, change list, test plan, risk notes
5. Tag Claude (or post a clear handoff message) for MCP application of any SQL changes
6. User merges after review (or Claude merges when authorized)

If a task has SQL: **write the migration file under `supabase/migrations/<timestamp>_<name>.sql`**, then ask Claude to apply via MCP. Do not apply via dashboard.

If a task has Render server changes (`index.js`): merging to main triggers Render auto-deploy (~1-2 min). No manual deploy step needed. Verify via `https://buildbelievefit.onrender.com/health`.

If a task has frontend changes (`bbf-app.html`, `index.html`, `sw.js`): merging to main triggers GitHub Pages deploy (~1-2 min). **Always bump `sw.js` CACHE version** when frontend files change so users get the new content on next visit.

---

## Open questions (low priority)

These came up during recent work and aren't blocking but worth tracking:

1. **Brevo migration vs keep Gmail.** Welcome emails currently flow through Gmail in the Zap. The `api/webhook-schema.json` and `api/day0-welcome-emails.json` documented a Brevo-based flow that was never fully wired. Cutover when convenient, or keep Gmail forever — both work.

2. **Trilingual generation scope.** Should Anthropic output one language matching the customer's `language_preference`, or all three at once and the app shows the right one based on the EN/ES/PT toggle? Both are doable; design pick needed.

3. **Render cost monitoring.** Each Pathfinder submission triggers two parallel Anthropic calls (Sonnet 4.6, ~4096 max tokens each). Monitor as customer volume grows — may need to tier the model based on Stripe tier (Gateway → Sonnet, Architect → Sonnet, Sovereign → Opus for higher quality).

4. **Sw.js cache-bump automation.** Currently bumping `CACHE` is a manual step on every frontend-touching PR. CI hook could auto-increment it, or use a deterministic hash of the bundled assets. Quality-of-life improvement, not urgent.
