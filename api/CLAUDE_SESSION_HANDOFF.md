# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-04-30 (post PR #74 merge)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice
**Founder:** Akeem Brown
**Phase:** 6 (Antigravity online; Vapi voice integration in operational phase)

This doc orients a fresh Claude session. Read it first, then run the checklist in **§4 Immediate Claude tasks** before touching anything else.

---

## 1. Roles

- **Akeem** — Decides scope, reviews diffs, merges PRs. Sole human in the loop.
- **Claude (you)** — Senior engineer & verifier. Uses Supabase MCP + GitHub MCP to introspect, apply migrations, deploy edge functions, open PRs, and verify AG's drafts.
- **Antigravity (AG)** — Autonomous coder running locally on Akeem's machine. Drafts code on `ag/<topic>` branches, commits, and pushes. **Never** applies to production. **Never** modifies `api/supabase-schema-actual.sql`.

## 2. Trust pattern (the loop)

1. Akeem (or Claude) writes a directive — bounded, with explicit deliverables and "what NOT to do".
2. AG drafts on `ag/<topic>` branch → commits → pushes.
3. Claude reviews diff vs. directive (scope, correctness, hallucinations).
4. Claude opens PR; Akeem reviews & merges.
5. Claude applies migrations / deploys edge functions via Supabase MCP.
6. Claude verifies in production and reports.

## 3. Current production state

**Closed-loop signup pipeline is LIVE:**
Pathfinder questionnaire → Stripe checkout → Render `/provision` (creates `bbf_users` row + sends to Anthropic for plan generation) → Anthropic returns structured JSON (WP/MP shapes) → Supabase `bbf_active_clients.workout_plan` + `meal_plan` populated → Zapier → Gmail welcome email with credentials → client logs into bbf-app.html → polished UI renders cloud plans.

**Vapi voice integration — Phases 1, 1.5, 2, 3, 1.6 all merged to `main`:**
- `bbf_vapi_calls` tracking table + RLS
- `bbf_evaluate_streaks()` function — finds clients who haven't logged in 3+ days, enforces 7-day rate limit, calls edge function via `pg_net.http_post` with `X-BBF-Token` from Vault
- `vapi-outbound-trigger` edge function — auth-gated (returns 503 if `BBF_VAPI_INVOKE_TOKEN` unset, 401 on token mismatch), calls Vapi API
- `pg_cron` schedule migration exists (`20260430000002_vapi_pg_cron_schedule.sql`) — **NOT YET APPLIED** (held back until pg_cron extension was enabled)

**Configuration state (verified by Akeem):**
- `pg_cron` extension: ENABLED via Supabase Dashboard
- Edge Function Secrets (uppercase): `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID`, `TWILIO_PHONE_NUMBER`
- Vault secret (lowercase): `bbf_vapi_invoke_token` (same value as Edge Function Secret)

## 4. Immediate Claude tasks (post PR #74)

Run in this order. Stop and report after each step.

- [ ] **Apply migration** `supabase/migrations/20260430031500_vapi_phase_1_6_wire_pgnet_with_auth.sql` via `mcp__3ff67aec-…__apply_migration`
- [ ] **Apply migration** `supabase/migrations/20260430000002_vapi_pg_cron_schedule.sql` via `apply_migration` (was held back, now safe)
- [ ] **Deploy edge function** `vapi-outbound-trigger` via `mcp__3ff67aec-…__deploy_edge_function` from `supabase/functions/vapi-outbound-trigger/index.ts`
- [ ] **Verify cron job registered:** `SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'vapi-daily-accountability-check';`
- [ ] **Re-introspect schema** → regenerate `api/supabase-schema-actual.sql` to wipe AG's prior hand-edits. Use `list_tables` + targeted SQL for indexes/policies/functions/triggers
- [ ] **Smoke test** (see §8)

## 5. Active backlog

- **Test artifact cleanup migration** — directive given to AG overnight on branch `ag/cleanup-test-artifacts`. Two statements: `DELETE FROM bbf_users WHERE uid = 'akeem_bbf'` + NULL the four plan columns on `bbf_active_clients` for `akeemkbrown@gmail.com`. Check if branch was pushed; if so, review diff, open PR, merge, apply via MCP.
- **Vapi Phase 4 (callback receiver)** — not yet scoped. Vapi can POST call status / transcript back; we need an edge function `vapi-callback` + columns on `bbf_vapi_calls` to capture. Defer until Phase 1.6 cron has fired in production at least once.
- **Schema-actual.sql AG hand-edits** — resolved by re-introspection in §4.
- **Render Vault Engine V9 cleanup** — see `api/AG_INTEGRATION_NOTES.md` P3 backlog.

## 6. Workflow rules (non-negotiable)

- **Nothing is version 2.** No `_v2`, `bbf_v2`, `*_new`, `*_2026` suffixes. Update existing code in place.
- **PIN auth (Option A) is the path.** Do not introduce Supabase Auth.
- **AG never modifies** `api/supabase-schema-actual.sql`. Claude regenerates via introspection.
- **AG never applies** migrations or deploys edge functions. Claude does via MCP.
- **Service Worker:** when shipping changes to `bbf-app.html`, bump the `BBF_CACHE` version constant.
- **Confirm before destructive ops** (DROP, DELETE without WHERE, TRUNCATE, force-push, branch deletes).
- **No direct push to `main`.** Always PR.

## 7. Key files (source of truth)

| File | Purpose |
|---|---|
| `api/AG_INTEGRATION_NOTES.md` | AG's orientation doc — read for AG context & P3 backlog |
| `api/VAPI_DESIGN.md` | Vapi architecture; §7 = operational setup |
| `api/PHASE_4_LIVE_CONFIG.md` | Render/Zapier/Brevo config reference |
| `api/supabase-schema-actual.sql` | Production schema (re-introspect to refresh) |
| `bbf-app.html` | Frontend — PIN login, LP() plan resolution, Service Worker, polished UI |
| `index.js` | Render Vault Engine V9 — `/process` + `/provision` endpoints |
| `supabase/functions/vapi-outbound-trigger/index.ts` | Vapi trigger edge function (auth-gated) |
| `supabase/migrations/` | All DB migrations |

## 8. Vapi end-to-end smoke test

After §4 migrations + deploy, before declaring victory:

1. **Positive path:**
   - Pick a test row in `bbf_active_clients` with `client_phone` set (or insert one with a Twilio test number).
   - Ensure `bbf_logs` for that client has no entry in the last 3 days, AND `bbf_vapi_calls` has no entry in the last 7 days for that email.
   - Run: `SELECT public.bbf_evaluate_streaks();`
   - Verify: row appears in `bbf_vapi_calls` with `call_status = 'initiated'`.
   - Verify: `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;` shows a 200/202 from the edge function URL.

2. **Negative auth test:**
   - `curl -X POST https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger -H "Content-Type: application/json" -d '{}'`
   - Expect: `401 unauthorized`.
   - Same with wrong token: still `401`.

3. **Cleanup:** delete test rows from `bbf_vapi_calls` if they were synthetic.

## 9. Recent merged PRs (reverse chronological)

- **#74** Phase 1.6 — pg_net wired to Vapi edge function with Vault auth (this session)
- AG Vapi commits Phase 1, 1.5, 2, 3 (pre-1.6)
- **#73** AG integration notes
- **#71** LP() cloud-plan reset fix
- **#67** Phase 4 live config doc
- **Phase 4 series** — plan columns / Render writeback / Pathfinder wire / display plans / credential provisioning

## 10. Fresh-session kickoff prompt

Paste into a new Claude session as the opening message:

> You are continuing work on Build Believe Fit. **Read `api/CLAUDE_SESSION_HANDOFF.md` first — especially §11 (context discipline).** It has the current state, your immediate to-do list, the workflow rules, the smoke test plan, and the habits that prevent timeouts. After reading, run `git fetch origin --prune`, `git log origin/main --oneline -5`, and check for any open `ag/*` or `claude/*` branches with unmerged work. Report back with: (a) where main is, (b) what's queued, (c) what you'd grind on first. Don't apply migrations or deploy edge functions until I greenlight.

## 11. Context discipline (timeout prevention)

This thread shipped a lot without a single timeout. Future sessions follow the same habits — they apply equally to backend MCP work and to frontend UI work:

1. **MCP > file reads.** Query prod with `execute_sql` before reading files when checking state. Cheaper context.
2. **Batch parallel.** Independent tool calls in ONE message; never sequential without a real dependency.
3. **Read with offset/limit.** Need lines 391–545? `Read(file, offset:391, limit:155)`. Don't read a 2000-line file for 150 lines.
4. **Don't echo your own writes.** Reference SQL/code you just produced by name; don't paste it back into chat.
5. **Status updates: ONE sentence.** "Migration 1/3 applied" — done. Skip the recap.
6. **No "let me think" preambles.** Do the thing, then state the result.
7. **Big writes → disk, not chat.** Schema regens, bulk rewrites, multi-section docs: Write → commit → push → one-line confirm with sha. Never paste 1000+ lines into the conversation.
8. **Delegate to AG for non-trivial edits.** Anything > ~5 lines of new code → write a directive, AG drafts on `ag/<topic>`, you verify. Saves your context for MCP and review.
9. **PR bodies = durable record.** Test plans, gotchas, verification checklists live in PR descriptions where they survive context resets — not in chat scrollback.
10. **Checkpoint to this doc proactively.** Phase wrap OR heavy context → update §3 / §4 / §9 + commit + push. Bridges sessions cleanly.
11. **End the turn early.** Question answered → stop. Don't volunteer five next-step ideas. One next-step or "standing by" is enough.

### Frontend addendum (when editing `bbf-app.html`)

- **Grep before read.** Find handlers / IDs / selectors with `grep -n` first; then `Read` with offset/limit. The file is large — never load the whole thing unless you genuinely need it.
- **Bump SW cache.** Increment the `BBF_CACHE` constant on every client-side change, or users see stale UI and you waste a debug cycle hunting a phantom bug.

**Bridge signal:** if the conversation gets heavy mid-task — stop, update this doc with current state, commit, tell Akeem *"context refresh recommended — handoff updated."* That's the cue to move to a fresh session without losing thread.

---

*Living doc. Update as state changes. Keep it under ~300 lines so a session can read it fast.*
