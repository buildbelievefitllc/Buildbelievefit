# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-05-01 (Phase 6 wrapped — Form Audit live + Founders Five PINs provisioned; awaiting Phase 7 directive)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice
**Founder:** Akeem Brown
**Phase:** 6 wrapped → Phase 7 (scope TBD by Akeem)

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

**Vapi voice integration — Phases 1, 1.5, 2, 3, 1.6, 1.7, 5 all merged & verified live:**
- `bbf_vapi_calls` tracking table + RLS, with `use_case` column (`accountability` | `sales_recovery`)
- `bbf_evaluate_streaks()` — accountability loop: clients who haven't logged in 3+ days, 7-day rate limit, tags `use_case='accountability'`. Cron `vapi-daily-accountability-check` @ `0 17 * * *`.
- `bbf_evaluate_abandoned_carts()` — sales recovery loop: Pending Pathfinder fills 3-30 days old with no matching `bbf_users` row, 1+1 follow-up cadence (initial + 1 retry at 7 days), tags `use_case='sales_recovery'`. Cron `vapi-daily-abandoned-cart-check` @ `0 19 * * *`.
- `vapi-outbound-trigger` edge fn (v6, ACTIVE, `verify_jwt:false`) — auth-gated via `X-BBF-Token`, routes assistantId by `use_case` field, uses `phoneNumberId` (Vapi-registered Twilio number), backwards-compat defaults for safety.

**Smoke test of Phase 5 (2026-05-01):**
- ✅ Negative auth: 401 on no/wrong token (rid 6, 7)
- ✅ Rate limit gates: final count = 2 proves all 4 1+1 cadence checks fired (initial → block → follow-up → block → still-block after re-backdate)
- ✅ Exclusion gates: under-threshold / past-hard-stop / already-paid all blocked (0 calls)
- ✅ Accountability ring (Rex): synthetic Active+paid client with no logs → edge fn 200, Vapi call id `019de0de-8b2a-7000-bfe6-9576e…`
- ✅ Sales recovery ring (Pathfinder closer): synthetic Pending cart 5d old, no user → edge fn 200, Vapi call id `019de0df-7067-7aaf-bd8e-1d1f2…`
- ✅ Cleanup verified: 0 synthetic rows remain.

**Form Audit Data Routing (Phase 6) — LIVE end-to-end:**
- `bbf_audit_logs` table — `id, user_id (uuid → bbf_users.id), session_id, movement_name, tension_zone, created_at`. CHECK constraint on `tension_zone IN ('lower-back','knees','shoulders','target-muscle','hips')`. RLS enabled with anon INSERT/SELECT.
- `BBF_SYNC.logAuditRequest()` — POSTs to `bbf_audit_logs` with `getOrCreateSessionId()` (sessionStorage UUID per workout).
- `BBF_SYNC.fetchDamagedZones(userId)` — reads last 30 days, maps `tension_zone` → Sentinel SVG IDs (`ss-z-lumbar`, `ss-z-knee-l/r`, `ss-z-shoulders-l/r`, `ss-z-cervical`, `ss-z-hip-l/r`). Sentinel UI binding still pending.
- Migration `20260502020500_form_audit_routing.sql` applied 2026-05-01.

**Slug → UUID bridge — LIVE (PR #82):**
- The frontend identifies users by stable slugs (`'ana_bbf'`, `'jacky_bbf'`, etc.) hardcoded in `bbf-app.html` `d.u` dict. Schema columns `bbf_audit_logs.user_id`, `bbf_logs.user_id`, `bbf_sets.user_id`, `bbf_users.id` are all uuid-typed — slug-as-uuid was 400'ing every Supabase write/read for demo clients (full wall of 400s in DevTools).
- Migration `20260502030000_seed_demo_users.sql` seeds 5 `bbf_users` rows (`ana_bbf`, `jacky_bbf`, `suzanna_bbf`, `jordan_bbf`, `wayne_bbf`) keyed by `bbf_users.uid` (text UNIQUE) → auto-generated `bbf_users.id` (uuid). Akeem's row already existed with `uid='akeem'`.
- SECURITY DEFINER RPC `bbf_get_uid_map()` returns `(uid, id)` pairs to anon (since `bbf_users` has RLS-on/no-policy by default). Mirrors `bbf_verify_admin_pin` pattern.
- `bbf-sync.js` resolver layer sits between public `supa()` and raw `_supa()` HTTP. `resolveBody()` rewrites `body.user_id` slug → UUID; `resolveQuery()` rewrites `?user_id=eq.<slug>` and (for `bbf_users`) `?id=eq.<slug>` → `?uid=eq.<slug>`. Bootstrap caches map for the session. **Zero changes at any of the ~20 existing user_id callsites** — wrapping is transparent.

**Audit "view as" UID priority — FIXED (PR #83):**
- `auditor-engine.js:178` had `CU || VC` (admin's UID won over viewed client's). `prehab-auditor.js:96` only checked `CU`. Both now use `VC || CU` — admin "view as Ana" → click Audit Form → row lands under Ana's UUID.

**Founders Five — PINs provisioned 2026-05-01 (migration `provision_legacy_client_pins`):**
- The 5 grandfathered clients (Ana, Jacky, Suzanna, Jordan, Wayne) — Akeem's original support system pre-Pathfinder — now have functional bcrypt PINs in `bbf_users.pin_hash` (`$2a$06$…`, same scheme as the trainer PIN).
- Plaintexts generated server-side via `gen_random_bytes`, delivered to founder out-of-band (chat), and **never committed to git or migration history** (migration stores hashes only).
- These clients bypass the Pathfinder/Stripe pipeline entirely — they have `bbf_users` rows but no `bbf_active_clients` row. Plans resolve from the code-baked `d.u` dict in `bbf-app.html` (workout-data.js / meal-data.js). Auth path: `bbf_verify_user_pin(uid, pin_attempt)` RPC (already deployed).
- Lockout: 3 wrong PINs → 15-minute timeout per `bbf_pin_attempts`.

**Smoke tested 2026-05-01:** Akeem clicked as `akeem` → row landed `user_id=0a58aa6c…` ✓. Then admin "view as Ana" → 2 clicks (knees + target-muscle) → both landed `user_id=9a43a383…` (ana_bbf's UUID) ✓. Bridge confirmed working for both real users and demo clients.

**Configuration state (verified by Akeem):**
- `pg_cron` extension: ENABLED
- Edge Function Secrets: `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (Rex), `VAPI_SALES_ASSISTANT_ID` (Pathfinder closer), `VAPI_PHONE_NUMBER_ID`. Deprecated `TWILIO_PHONE_NUMBER` should be removed.
- Vault secret: `bbf_vapi_invoke_token` (matches Edge Function Secret)

## 4. Immediate Claude tasks (Phase 6 wrapped — Phase 7 scope incoming)

Vapi work COMPLETE through Phase 5. Phase 6 (Form Audit Data Routing + slug→UUID bridge + admin view-as VC priority + Founders Five PIN provisioning) all COMPLETE.

- [x] Phase 1.7 — payload fix (PR #77, merged 2026-04-30)
- [x] Phase 5 — sales recovery loop (PR #78, merged 2026-04-30; verified 2026-05-01)
- [x] Phase 6 Form Audit slice (PR #80, merged 2026-05-01)
- [x] Slug → UUID bridge (PR #82, merged 2026-05-01; smoke tested live)
- [x] Audit view-as VC priority fix (PR #83, merged 2026-05-01)
- [x] Founders Five PIN provisioning (migration `provision_legacy_client_pins`, applied 2026-05-01; plaintexts handed off out-of-band)
- [ ] **Akeem todo:** remove deprecated `TWILIO_PHONE_NUMBER` Edge Function Secret in Supabase dashboard.
- [ ] **Akeem todo:** text the 5 PINs to each Founders Five client and confirm each can log in.

**Phase 7 — awaiting founder directive.** Akeem will brief scope at session start. Candidate slices already in §5 backlog if Akeem chooses to grind there:
1. **Sentinel UI binding** — consume `BBF_SYNC.fetchDamagedZones` output in `bbf-app.html:4823-4949` (highlight damaged `ss-z-*` zones on the SVG). Pure frontend, no migration.
2. **Trainer-view name join** — `fetchPendingAudits` (`bbf-sync.js:320`) currently surfaces `user_id` UUID; needs name resolution for the Audit Log Feed on Command Center.
3. **`syncUser` rewrite** — `bbf-sync.js:47` writes `id: uid` (slug into uuid column) and includes columns not present in schema. Bigger lift; affects PIN-auth login persistence path.

For each new slice Akeem brain-dumps, the loop is unchanged:
1. **Locate** — `grep -n` for the handler/selector/text.
2. **Trace** — read just the relevant slice (offset/limit).
3. **Classify** — wired / partial / stub / dead.
4. **Decide** — wire it (small + valuable) OR remove it.
5. **Bump SW cache** (`CACHE` constant in `sw.js`) on every client-side change.

Working branch: `claude/continue-bbf-dev-RXWha` (used through PR #82/#83) or `claude/handoff-post-bridge-fix` (PR #84). Branch fresh per Akeem's preference for Phase 7.

- [ ] **Re-introspect schema** → regenerate `api/supabase-schema-actual.sql`. **DEFERRED** — separate dedicated session, disk-only-write protocol per §11 rule #7. Now 2-3 changes behind (`bbf_audit_logs` table, demo client rows in `bbf_users`, PIN hashes on those rows, `bbf_get_uid_map()` RPC).

## 5. Active backlog

- **Phase 6 — Sentinel UI binding** (consume `BBF_SYNC.fetchDamagedZones` output in `bbf-app.html:4823-4949`).
- **Phase 6 — additional Ghost UI surfaces** (continued audit, see §4).
- **Phase 6 — trainer-view name join** — `fetchPendingAudits` (`bbf-sync.js:320`) currently surfaces `user_id` as the display name; needs a join (or a SECURITY DEFINER RPC like `bbf_get_uid_map`) to resolve UUID → name for the Audit Log Feed on Command Center.
- **`syncUser` rewrite** — `bbf-sync.js:47` writes `id: uid` (slug into uuid column) and includes fields not present in schema (`type`, `goal`, `goal_weight`, `plan`, `schedule`, `stress_mode`, `access_status`, `recovery_note`, `auto_lock_enabled`, `lock_expiry`). Currently broken for demo clients. The slug→UUID bridge fixes the FK target side; this fixes the write side. Separate workstream.
- **Vapi Phase 4 (callback receiver)** — not yet scoped. Vapi can POST call status / transcript back; we need an edge function `vapi-callback` + columns on `bbf_vapi_calls` (`call_status` lifecycle + `transcript`). Defer until at least one production cron run produces real call data.
- **Schema-actual.sql re-introspection** — deferred to dedicated session. Two tables behind (`bbf_audit_logs`, demo client rows in `bbf_users`).
- **Render Vault Engine V9 cleanup** — see `api/AG_INTEGRATION_NOTES.md` P3 backlog.
- **Akeem dashboard cleanup** — remove deprecated `TWILIO_PHONE_NUMBER` Edge Function Secret.
- **Stale PR cleanup** — PR #81 (post-Phase-6 handoff doc) was opened pre-bridge; superseded by this PR. Close #81 when this lands.

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
| `api/PHASE_6_FORM_AUDIT_PLAN.md` | Form Audit data routing plan (post-amendment, AG-authored) |
| `api/AG_DIRECTIVE_PHASE_6_FORM_AUDIT.md` | Big Jim's directive + Claude scope guards for Phase 6 |
| `api/supabase-schema-actual.sql` | Production schema (re-introspect; two tables behind) |
| `bbf-app.html` | Frontend — PIN login, LP() plan resolution, polished UI; demo client `d.u` dict at lines ~4335, 6282, 6495, 6810, 6944 (slugs `ana_bbf`/`jacky_bbf`/`suzanna_bbf`/`jordan_bbf`/`wayne_bbf`) |
| `bbf-sync.js` | Cloud sync layer; `_supa()` raw HTTP + public `supa()` wrapper with slug→UUID resolver (`ensureUidMap`/`resolveUid` exposed). All user_id-bearing requests go through transparent translation |
| `auditor-engine.js` | Form Audit modal (Audit Form button); writes via `BBF_SYNC.logAuditRequest`. Uses `VC \|\| CU` for uid (admin-view-as wins) |
| `prehab-auditor.js` | Pre-Hab modal; same `VC \|\| CU` pattern as auditor-engine |
| `sw.js` | Service Worker; bump `CACHE` constant on every client-side change (currently `bbf-v26`) |
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

- **2026-05-01 migration `provision_legacy_client_pins`** — Bcrypt PINs assigned to the 5 Founders Five (`ana_bbf`/`jacky_bbf`/`suzanna_bbf`/`jordan_bbf`/`wayne_bbf`). Plaintexts delivered to Akeem out-of-band; never persisted to git/history. Verified via `bbf_verify_user_pin` path.
- **#83** (2026-05-01) Audit "view as" UID priority fix — `auditor-engine.js` + `prehab-auditor.js` now use `VC || CU` (was `CU || VC` / CU-only). Verified: admin "view as Ana" → 2 clicks → 2 rows in `bbf_audit_logs` under `user_id=9a43a383…` (ana_bbf).
- **#82** (2026-05-01) Slug → UUID bridge — seeds 5 demo clients in `bbf_users` (ana_bbf/jacky_bbf/suzanna_bbf/jordan_bbf/wayne_bbf), adds `bbf_get_uid_map()` SECURITY DEFINER RPC, adds resolver layer to `bbf-sync.js` that transparently rewrites slug→UUID on all user_id-bearing requests. Migration `20260502030000_seed_demo_users.sql` applied 2026-05-01.
- **#80** (2026-05-01) Phase 6 Form Audit data routing — `bbf_audit_logs` table, `BBF_SYNC.logAuditRequest`/`fetchDamagedZones`/`fetchPendingAudits`, migration `20260502020500_form_audit_routing.sql`. Sentinel UI binding deferred.
- **2026-05-01 verification** — Phase 5 post-merge: edge fn v6 deployed + migration applied + 5 smoke tests passed (negative auth, rate limit 1+1, three exclusion gates, two real Vapi rings to +16233409254 with edge fn 200 + valid Vapi call IDs).
- **#78** Phase 5 — Vapi sales recovery loop (Pathfinder closer); `use_case` column, `bbf_evaluate_abandoned_carts()`, `0 19 * * *` cron, edge fn assistant routing.
- **#77** Phase 1.7 — Vapi outbound payload fix (uses `phoneNumberId`); +16233409254 confirmed ringing.
- **#76** Admin PIN verification.
- **#75** Test artifact cleanup migration.
- **#74** Phase 1.6 — pg_net wired to Vapi edge fn with Vault auth.
- AG Vapi commits Phase 1, 1.5, 2, 3 (pre-1.6).
- **#73** AG integration notes.
- **#71** LP() cloud-plan reset fix.
- **#67** Phase 4 live config doc.
- **Phase 4 series** — plan columns / Render writeback / Pathfinder wire / display plans / credential provisioning.

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
