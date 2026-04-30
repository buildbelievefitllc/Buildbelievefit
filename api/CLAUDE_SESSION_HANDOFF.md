# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-04-30 (Phase 5 PR #78 awaiting merge; pivot to Ghost UI Audit / Phase 6)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice
**Founder:** Akeem Brown
**Phase:** 6 (Vapi backend stack stabilizing — Phase 5 in flight; **active workstream: Ghost UI audit on `bbf-app.html` and surfaces**)

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

**Vapi voice integration — Phases 1, 1.5, 2, 3, 1.6, 1.7 all merged to `main` and verified end-to-end:**
- `bbf_vapi_calls` tracking table + RLS
- `bbf_evaluate_streaks()` function — finds clients who haven't logged in 3+ days, enforces 7-day rate limit, calls edge function via `pg_net.http_post` with `X-BBF-Token` from Vault
- `vapi-outbound-trigger` edge function — auth-gated (returns 503 if `BBF_VAPI_INVOKE_TOKEN` unset, 401 on token mismatch), calls Vapi API with `phoneNumberId` + `customer.number` shape (Phase 1.7)
- `pg_cron` schedule applied (`20260430000002_vapi_pg_cron_schedule.sql`); cron job `vapi-daily-accountability-check` scheduled `0 17 * * *` running `SELECT public.bbf_evaluate_streaks()`

**End-to-end smoke test (2026-04-30, post Phase 1.7 deploy):**
- ✅ DB plumbing: cron → pg_net → edge fn auth → `bbf_vapi_calls` audit insert
- ✅ Negative auth: 401 on no token, 401 on wrong token (via pg_net)
- ✅ Positive path: edge fn returns 200, Vapi accepts payload, returns `status:queued`, Twilio dials +16233409254 successfully
- ✅ Accountability assistant ("Rex") verified live with the dialed-in script (Akeem received call, walked through the friction → commitment flow, hit a real workout commitment as a result). Same `VAPI_ASSISTANT_ID` — prompt swapped in place via Vapi dashboard.
- ✅ Sales-recovery assistant ("Pathfinder closer") pre-built in Vapi; ID stored in Edge Function Secrets as `VAPI_SALES_ASSISTANT_ID`. Not wired yet (see Phase 5 in §5 backlog).
- ✅ Synthetic test rows cleaned up (FK CASCADE + manual user delete)

**Configuration state (verified by Akeem):**
- `pg_cron` extension: ENABLED via Supabase Dashboard
- Edge Function Secrets (uppercase): `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (accountability/Rex), `VAPI_SALES_ASSISTANT_ID` (Pathfinder closer — stored, not wired), `VAPI_PHONE_NUMBER_ID`. The deprecated `TWILIO_PHONE_NUMBER` secret can now be removed.
- Vault secret (lowercase): `bbf_vapi_invoke_token` (same value as Edge Function Secret)

## 4. Immediate Claude tasks

**ACTIVE WORKSTREAM: Ghost UI audit (Phase 6).** Akeem flagged that `bbf-app.html` (and possibly admin/coach-lab/index pages) has UI elements that look functional but aren't actually wired — vibe-coded surfaces with no backend. Top priority is auditing every interactive element (buttons, forms, toggles, panels) for actually-works vs. visually-present-but-stub. Akeem will provide the specific list at session start. For each item:
1. Locate the element (HTML/JS file + line range)
2. Trace the handler → backend
3. Classify: **wired** (works), **partial** (UI fires but no persistence), **stub** (no handler at all), or **dead** (handler points at removed code)
4. Decide per item: wire it up, OR remove it from the UI to stop misleading paying clients
5. Bump SW cache (`BBF_CACHE` constant) on every client-side change

Workstream rules: prioritize paying-client-facing surfaces over admin > nice-to-have. Use Explore agent for broad surveys; targeted `grep` + `Read(offset/limit)` for specific elements (frontend §11 rule). Don't read all 7000+ lines of `bbf-app.html` at once.

---

**Vapi backend tasks** (mostly stable, but a few open items):

Phase 1.7 verified end-to-end (sha `dd75091`):
- [x] Phase 1.6 migration applied
- [x] pg_cron schedule migration applied
- [x] Test artifact cleanup migration applied
- [x] Edge fn `vapi-outbound-trigger` ACTIVE at version 3 (Phase 1.7 deploy)
- [x] Cron job `vapi-daily-accountability-check` scheduled `0 17 * * *`
- [x] Negative auth: 401 on no/wrong token
- [x] Positive path: Twilio dials +16233409254, Rex assistant runs script, Akeem confirmed working live

Phase 5 in flight:
- [x] Phase 5 directive committed (sha `d1a56fe`)
- [x] AG drafted on `ag/vapi-phase-5` (sha `4511246`) per directive — migration + edge fn refactor + VAPI_DESIGN.md updates
- [x] PR #78 opened: https://github.com/buildbelievefitllc/Buildbelievefit/pull/78
- [ ] **Awaiting Akeem merge of PR #78.**
- [ ] Post-merge sequence (deploy-first per directive safety order):
  1. Deploy edge fn via `mcp__3ff67aec-…__deploy_edge_function` (with backwards-compat default for safety)
  2. Apply migration `20260430150000_vapi_phase_5_sales_recovery.sql` via `apply_migration`
  3. Run 5 smoke tests: accountability regression + sales positive + rate-limit + exclusion checks + negative auth (full plan in `api/AG_DIRECTIVE_VAPI_PHASE_5.md` §"Test plan")
  4. Update §3 / §4 / §5 / §9 here, commit, push

Lower-priority Vapi backlog (don't preempt UI audit):
- [ ] **Akeem:** remove deprecated `TWILIO_PHONE_NUMBER` Edge Function Secret (no longer referenced; trivial housekeeping)
- [ ] **Vapi Phase 4 — callback receiver** to capture transcript / end_reason / call outcome (currently `bbf_vapi_calls.vapi_call_id` + `transcript` stay NULL post-call). Becomes important once we want to measure conversion on Rex + Pathfinder closer.
- [ ] **SMS payment-link tool** for the Pathfinder closer (Vapi function → Twilio SMS + Stripe payment-link). Conversion lift; not required for Phase 5 to ship.
- [ ] **Re-introspect schema** → regenerate `api/supabase-schema-actual.sql`. **DEFERRED — separate dedicated session, disk-only-write protocol per §11 rule #7.** Two prior sessions timed out attempting inline-rewrite.

## 5. Active backlog

- **Test artifact cleanup migration** — shipped 2026-04-30 (`20260430050000_cleanup_test_artifacts`). `uid='akeem_bbf'` removed; 0 rows confirmed.
- **Vapi Phase 5 — Sales recovery / abandoned cart closer.** Pathfinder closer assistant already built in Vapi by Akeem; ID stored as `VAPI_SALES_ASSISTANT_ID` Edge Function Secret. Remaining work:
  1. New SQL function `bbf_evaluate_abandoned_carts()` — scans `bbf_active_clients` for `onboarding_status='Pending'` rows aged > N days with `client_phone IS NOT NULL` and no recent call.
  2. Update edge fn `vapi-outbound-trigger` to accept a `use_case` (or `assistant_id`) field in the pg_net payload and select the correct assistant from `VAPI_ASSISTANT_ID` vs `VAPI_SALES_ASSISTANT_ID`.
  3. Pass new variable `daysSincePathfinder` (computed `now() - bbf_active_clients.created_at`) in the closer's payload.
  4. New `pg_cron` schedule for the closer (different hour from accountability to avoid overlap).
  5. Smoke test the closer path same way as 1.6/1.7.
  6. (Future, separate phase) Wire a real Vapi tool for SMS payment-link delivery — needs Stripe + Twilio API keys + new edge fn `vapi-tool-send-payment-link`. Don't promise SMS in the assistant's prompt until this is wired.
- **Vapi Phase 4 (callback receiver)** — not yet scoped. Vapi can POST call status / transcript back; we need an edge function `vapi-callback` + columns on `bbf_vapi_calls` to capture (`ended_at`, `transcript`, `ended_reason`, etc.). Currently `bbf_vapi_calls.vapi_call_id` and `transcript` stay NULL after a call.
- **Schema-actual.sql AG hand-edits** — pending re-introspection (deferred to dedicated session per §11 rule #7).
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

- **#78 (open, awaiting merge)** Phase 5 — Vapi sales recovery (Pathfinder closer). AG drafted on `ag/vapi-phase-5` per directive `api/AG_DIRECTIVE_VAPI_PHASE_5.md`. Adds `bbf_vapi_calls.use_case` column, `bbf_evaluate_abandoned_carts()` SQL function, new cron `0 19 * * *`, edge fn refactor for use-case routing.
- **#77 (2026-04-30) Phase 1.7** — Vapi outbound payload fix. Switched from BYO Twilio nesting to Vapi-managed `phoneNumberId` + `customer.number`. Smoke test post-deploy: edge fn 200 → Vapi `status:queued` → Twilio dials +16233409254. Outbound voice operational end-to-end.
- **#74** Phase 1.6 — pg_net wired to Vapi edge function with Vault auth
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
