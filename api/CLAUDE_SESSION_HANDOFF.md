# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-05-01 (post Phase 10 — UI Pruning shipped, six phases past the prior bridge)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice
**Founder:** Akeem Brown
**Phase:** 10 (Vapi 1–5 verified live; Form Audit Data Routing live; Sentinel UI binding live; admin bypass + live trial toggles live; admin dashboard stats live; somatic readiness tiers live; UI pruning shipped)

This doc orients a fresh Claude session. Read it first, then run the checklist in **§4 Immediate Claude tasks** before touching anything else.

---

## 1. Roles

- **Akeem** — Decides scope, reviews diffs, merges PRs. Sole human in the loop.
- **Claude (you)** — Senior engineer & verifier. Uses Supabase MCP + GitHub MCP to introspect, apply migrations, deploy edge functions, open PRs, and verify AG's drafts.
- **Antigravity (AG)** — Autonomous coder running locally on Akeem's machine. Drafts code on `ag/<topic>` branches, commits, and pushes. **Never** applies to production. **Never** modifies `api/supabase-schema-actual.sql`. (Currently dormant — Phase 7-10 were all Claude-direct.)

## 2. Trust pattern (the loop)

1. Akeem (or Claude) writes a directive — bounded, with explicit deliverables and "what NOT to do".
2. Claude classifies via the **Tiered Autonomy** model in §6.2 — auto-execute, plan-then-greenlight, or halt-and-confirm.
3. For auto-execute work: investigate → execute → commit → push → PR → report.
4. For plan-then-greenlight work: investigate → present plan → wait for greenlight → execute → commit → push → PR → report.
5. Akeem reviews & merges PR.
6. Claude applies migrations / deploys edge functions via Supabase MCP (post-merge).
7. Akeem smoke tests in production.

## 3. Current production state

**Closed-loop signup pipeline is LIVE:**
Pathfinder questionnaire → Stripe checkout → Render `/provision` (creates `bbf_users` row + sends to Anthropic for plan generation) → Anthropic returns structured JSON (WP/MP shapes) → Supabase `bbf_active_clients.workout_plan` + `meal_plan` populated → Zapier → Gmail welcome email with credentials → client logs into bbf-app.html → polished UI renders cloud plans.

**Vapi voice integration — Phases 1, 1.5, 2, 3, 1.6, 1.7, 5 all merged & verified live:**
- `bbf_vapi_calls` tracking table + RLS, with `use_case` column (`accountability` | `sales_recovery`)
- `bbf_evaluate_streaks()` + `bbf_evaluate_abandoned_carts()` + cron schedules @ `0 17 * * *` and `0 19 * * *`.
- `vapi-outbound-trigger` edge fn (v6, ACTIVE, `verify_jwt:false`) — auth-gated via `X-BBF-Token`, routes assistantId by `use_case`, uses `phoneNumberId` (Vapi-registered Twilio number).

**Form Audit Data Routing (Phase 6) — LIVE:**
- `bbf_audit_logs` table (`id, user_id uuid → bbf_users.id, session_id, movement_name, tension_zone, created_at`). CHECK on `tension_zone IN ('lower-back','knees','shoulders','target-muscle','hips')`. RLS enabled with anon INSERT/SELECT.
- `BBF_SYNC.logAuditRequest()` / `fetchDamagedZones()` / `fetchPendingAudits()`.

**Slug → UUID bridge — LIVE (PR #82):**
- 5 demo `bbf_users` rows seeded (`ana_bbf`/`jacky_bbf`/`suzanna_bbf`/`jordan_bbf`/`wayne_bbf`), keyed by `bbf_users.uid` → auto-generated `bbf_users.id` (uuid).
- `bbf_get_uid_map()` SECURITY DEFINER RPC returns `(uid, id)` pairs to anon.
- `bbf-sync.js` resolver layer transparently rewrites `body.user_id` and `?user_id=eq.<slug>` slug → UUID for all callsites.

**Sentinel UI Binding (Phase 7, PR #85) — LIVE:**
- `BBF_SYNC.fetchDamagedZones(userId)` output now drives the Sovereign Sentinel SVG (Program tab — `tp-workout`, not Prehab).
- 3-tier `.audit-flag` CSS (amber → orange → red) keyed by audit count over last 30 days; `data-tier` attribute drives color. `.glow` (manual symptom toggle) wins visual when both apply; `<title>` tooltip preserved.
- `window.SS_REFRESH_DAMAGED` exposed; called on workout-tab activation + after every `logAuditRequest` resolves.

**Global Admin Bypass + Live Sovereign Trial (Phase 8, PR #86) — LIVE:**
- `window.BBF_IS_ADMIN()` helper at `bbf-app.html` top of auth engine returns `CU === 'akeem'` regardless of `VC` (Architect-everywhere, interpretation B). Three gate sites OR'd: Vault grid render, `openModule()` lock, Busy Parent guide tier.
- Migration `20260502040000_sovereign_trial_columns.sql` applied: adds `trial_status` (CHECK `inactive|active|completed`), `trial_start_date`, `updated_at` columns to `bbf_users`. SECURITY DEFINER RPC `bbf_set_trial_status(p_uid text, p_active boolean)` resolves slug → UUID server-side and applies UPDATE (mirrors `bbf_get_uid_map` pattern).
- `BBF_SYNC.toggleSovereignTrial` now calls the RPC. `mastermind-portal.html` toggle has optimistic UI + revert-on-failure path.
- Duplicate `toggleTrialAccess` in `portal-engine.js` deleted (canonical lives in `mastermind-portal.html`).

**Vault Masterclass Stacked Section (Phase 8b, PR #87) — LIVE:**
- `vault-masterclass-pane` was hidden permanently for all users (inline `display:none` + unreachable `switchVaultTab` referencing tab buttons that never existed in the DOM).
- Pane now stacks below `vault-program-pane` always; section divider with MASTERCLASS VAULT kicker; `renderVaultGrid()` wired into TAB('workout') activation hook.
- `switchVaultTab` deleted (~20 lines unreachable dead code).

**Live Admin Dashboard Stats + Somatic Tier Labels (Phase 9, PR #88) — LIVE:**
- Migration `20260502050000_admin_dashboard_stats_rpc.sql` applied: SECURITY DEFINER RPC `bbf_get_admin_dashboard_stats()` returns `jsonb_build_object('total_clients', 'total_logs', 'total_audits')`.
- `BBF_SYNC.fetchAdminDashboardStats()` wraps it. `mastermind-portal.html` Command Center stats now pull from Supabase (was localStorage-only → 0 on fresh desktop).
- Somatic Readiness sliders (Sleep / Cog / Stress) render axis-aware tier labels + color coding. Sleep direct-mapped (high=good); Cog/Stress flipped (`score = 11 - rawValue`) before bucketing into 5 tiers (`optimal/good/mid/warn/critical`). Tier vocabularies: Sleep `Depleted/Recovering/Adequate/Restored/Optimal`; Cog `Overload/Heavy/Active/Steady/Light`; Stress `Critical/Strained/Active/Settled/Calm`.

**Defensive Normalizer (Phase 9b, PR #89) — LIVE:**
- Phase 9 RPC verified live (`{total_clients:5, total_logs:0, total_audits:4}`) but Mastermind Portal still rendered blank in fresh incognito. Root cause was the original ternary `s.total_clients != null ? s.total_clients : 0` writing empty string when `s.total_clients = ""` (PostgREST shape edge case).
- `fetchAdminDashboardStats` now normalizes 4 PostgREST shapes (direct jsonb, SETOF/array-wrap, function-name-wrap, JSON-encoded string) + diagnostic `console.log` of raw response.
- Mastermind Portal init pre-paints stats to `'0'` baseline, coerces via `Number()` + `isFinite`, wraps in try/catch — never blank under any failure mode.

**UI Pruning (Phase 10, PR #90) — LIVE:**
- "Book a Session" tab + page deleted. Bottom nav reflowed 7 → 6 buttons. Community-banner "Upgrade to Elite" CTA rewired from `TAB('book')` (dead-end) → SMS intent `sms:6233409254?body=Upgrade%20me%20to%20Elite`. CSS `.bk* / .co*` rules removed (verified scope-exclusive).
- "Upcoming Event Date" settings row deleted from Profile. `FUELING_ENGINE.renderSettingsControl()` function + 3 call sites + export removed. `readEventDate / writeEventDate / auditEventPrep / renderDashboardBlock` retained as infrastructure for the dashboard bioenergetic block.
- Free Log (`tp-log`) cleaned: removed Weight + Body Fat row (body comp belongs in Profile → Body); removed Rest from Session Type chips; added subtitle kicker; added REFLECTION divider between objective and subjective fields; tightened title to Bebas Neue 1.4rem 4px-spacing. SAVELOG payload hardened to drop `wt`/`bf` (would've null-ref'd on the removed inputs).

**Admin "view as" UID priority — FIXED (PR #83):** `auditor-engine.js:178` + `prehab-auditor.js:96` use `VC || CU` (admin-view-as wins).

**Migrations applied to project `ihclbceghxpuawymlvgi` since the prior bridge:**
- `20260502020500_form_audit_routing` (Phase 6)
- `20260502030000_seed_demo_users` (slug bridge)
- `20260502040000_sovereign_trial_columns` (Phase 8 — columns + RPC)
- `20260502050000_admin_dashboard_stats_rpc` (Phase 9 — RPC)

**SECURITY DEFINER RPC inventory (admin trust surface):**
- `bbf_verify_admin_pin(pin_attempt)` — admin PIN check
- `bbf_get_uid_map()` — slug ↔ UUID directory for the bridge
- `bbf_set_trial_status(p_uid, p_active)` — Sovereign Trial toggle
- `bbf_get_admin_dashboard_stats()` — Mastermind Portal counts

**Configuration state (verified by Akeem):**
- `pg_cron` extension: ENABLED
- Edge Function Secrets: `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (Rex), `VAPI_SALES_ASSISTANT_ID` (Pathfinder closer), `VAPI_PHONE_NUMBER_ID`. Deprecated `TWILIO_PHONE_NUMBER` should be removed.
- Vault secret: `bbf_vapi_invoke_token` (matches Edge Function Secret)
- SW cache: `bbf-v32` (was `bbf-v26` at the prior bridge — six bumps).

## 4. Immediate Claude tasks

Phase 10 is live. Akeem is preparing the next directive.

- [x] Phase 7 — Sentinel UI binding (PR #85, merged 2026-05-01)
- [x] Phase 8 — admin bypass + live trial toggles (PR #86, merged 2026-05-01; migration applied)
- [x] Phase 8b — Vault Masterclass stacked section (PR #87, merged 2026-05-01)
- [x] Phase 9 — admin dashboard stats + somatic tier labels (PR #88, merged 2026-05-01; migration applied)
- [x] Phase 9b — defensive normalizer (PR #89, merged 2026-05-01)
- [x] Phase 10 — UI pruning (PR #90, merged 2026-05-01)
- [ ] **Akeem todo:** remove deprecated `TWILIO_PHONE_NUMBER` Edge Function Secret in Supabase dashboard.
- [ ] **Re-introspect schema** → regenerate `api/supabase-schema-actual.sql`. **DEFERRED** — separate dedicated session, disk-only-write protocol per §11 rule #7. Now FIVE units behind: `bbf_audit_logs`, demo `bbf_users` rows, `bbf_users.trial_status/trial_start_date/updated_at` columns, two new SECURITY DEFINER RPCs.
- [ ] **Diagnostic console.log cleanup** in `bbf-sync.js fetchAdminDashboardStats` once PostgREST response shape is confirmed from a real Mastermind Portal session.

## 5. Active backlog

- **Phase 11+ TBD** — Akeem dropping next directive into a fresh session.
- **`admin.html` access_status toggles** (Activate/Recovery/Lock) — same backend-disconnect problem `mastermind-portal.html` had pre-Phase-9. Currently writes `access_status` via `BBF_SYNC.syncUser` which is broken (writes columns that don't exist). Separate slice when Akeem prioritizes.
- **`syncUser` rewrite** — `bbf-sync.js:130` writes `id: uid` (slug into uuid column) and includes fields not in schema (`type`, `goal`, `goal_weight`, `plan`, `schedule`, `stress_mode`, `access_status`, `recovery_note`, `auto_lock_enabled`, `lock_expiry`). Bridge fixes the FK target side; this fixes the write side.
- **Trainer-view name join** — `fetchPendingAudits` (`bbf-sync.js:403`) surfaces `user_id` UUID as the display name; needs join (or RPC like `bbf_get_uid_map`) to resolve UUID → name for the Audit Log Feed.
- **Vapi Phase 4 (callback receiver)** — not yet scoped. Vapi can POST call status / transcript back; needs edge fn `vapi-callback` + columns on `bbf_vapi_calls`. Defer until at least one production cron run produces real call data.
- **Render Vault Engine V9 cleanup** — see `api/AG_INTEGRATION_NOTES.md` P3 backlog.
- **i18n table cleanup** — `app-book-*`, `app-nav-book` lang keys orphaned by Phase 10 deletions. Translator no-ops on missing DOM nodes; cleanup is cosmetic.
- **Schema-actual.sql re-introspection** — five units behind (see §4).

## 6. Workflow rules

### 6.1 Non-negotiable safeguards (integrity)

- **Nothing is version 2.** No `_v2`, `bbf_v2`, `*_new`, `*_2026` suffixes. Update existing code in place.
- **PIN auth (Option A) is the path.** Do not introduce Supabase Auth.
- **AG never modifies** `api/supabase-schema-actual.sql`. Claude regenerates via introspection.
- **AG never applies** migrations or deploys edge functions. Claude does via MCP.
- **Service Worker:** when shipping changes to `bbf-app.html`, bump the `BBF_CACHE` version constant.
- **No direct push to `main`.** Always PR. Akeem merges.

### 6.2 Tiered Autonomy Model — when Claude pauses for greenlight

The loop in §2 has been measured: when the next step is low-risk, the plan-then-greenlight pause adds friction without protecting integrity. This tier model removes that friction selectively while preserving every safeguard that protects the business.

#### Tier 1 — Auto-execute (no plan presentation, no greenlight pause)

Claude proceeds directive → investigate → execute → PR → report. Plans appear in commit messages and PR bodies, not as a separate chat round. Applies to:

- UI/UX changes to existing surfaces (HTML/CSS/JS edits in already-shipped files)
- Dead code deletion when grep confirms scope-exclusive (e.g., the Phase 10 `.bk*` and `switchVaultTab` removals)
- Cache bumps, comment cleanups, behavior-preserving refactors
- Adding diagnostic `console.log` / defensive guards / try-catch hardening
- Documentation updates (this file, PR descriptions)
- New helper functions in existing modules (e.g., `paintDamagedZones`, `BBF_IS_ADMIN`, `applySomTier`)
- Tier label / copy / styling tweaks
- PR creation, branch creation, commits to `claude/*` branches

Bounds: Tier 1 work still bumps the SW cache, still gets a PR, still gets smoke-tested by Akeem. It just doesn't pause mid-flight for "approve plan?" when the work is clearly bounded.

#### Tier 2 — Plan-then-greenlight (current §2 workflow, preserved)

Claude presents the implementation plan and waits for explicit greenlight before any edits. Applies to:

- Database migrations (DDL, RLS policy changes, new RPCs, schema changes)
- New edge functions or cron schedules
- New tables or columns on existing tables
- Anything touching production secrets / Vault / Edge Function Secrets
- Deletion of currently-active functionality (verified live, not dead code)
- Architectural pivots (auth model, sync layer, plan-resolution path, data routing)
- Cross-system changes (Render, Zapier, Vapi, Stripe, Brevo wiring)
- Anything Claude flags as "I'm not certain about scope" — uncertainty itself is a signal to pause.

#### Tier 3 — Halt-and-confirm (always pause before AND after)

Claude stops, describes the action, and waits for explicit confirmation. After the action lands, Claude reports back and pauses again before continuing. Applies to:

- `DROP`, `DELETE` without `WHERE`, `TRUNCATE`
- Force-push, branch deletions, history rewrites
- Changes to live cron schedules or active edge functions
- Anything that could destroy data, lose work, or disrupt the production deploy

### 6.3 PR & branch hygiene

- Branch naming: `claude/<phase-or-topic>-<short-slug>` (e.g., `claude/phase11-foo`, `claude/phase10-ui-pruning`).
- Always branch off `origin/main` for fresh work — never reuse a previously-merged branch's name.
- Commit messages: `feat(scope): one-line summary` / `fix(scope): one-line summary` / `chore(scope): ...`. Body explains the *why* and the *risk*.
- PR body: summary + files-changed table + risk + test plan checklist + out-of-scope. Migration commands inline if applicable.

## 7. Key files (source of truth)

| File | Purpose |
|---|---|
| `api/AG_INTEGRATION_NOTES.md` | AG's orientation doc — read for AG context & P3 backlog |
| `api/VAPI_DESIGN.md` | Vapi architecture; §7 = operational setup |
| `api/PHASE_4_LIVE_CONFIG.md` | Render/Zapier/Brevo config reference |
| `api/PHASE_6_FORM_AUDIT_PLAN.md` | Form Audit data routing plan |
| `api/AG_DIRECTIVE_PHASE_6_FORM_AUDIT.md` | Big Jim's directive + Claude scope guards for Phase 6 |
| `api/supabase-schema-actual.sql` | Production schema (re-introspect — five units behind) |
| `bbf-app.html` | Frontend — PIN login, LP() plan resolution, polished UI; demo client `d.u` dict at lines ~4335, 6282, 6495, 6810, 6944. `BBF_IS_ADMIN()` helper at top of auth engine (Phase 8). |
| `bbf-sync.js` | Cloud sync layer; `_supa()` raw HTTP + public `supa()` wrapper with slug→UUID resolver. `fetchAdminDashboardStats` (Phase 9) has 4-shape PostgREST normalizer (Phase 9b). `toggleSovereignTrial` calls `bbf_set_trial_status` RPC (Phase 8). |
| `auditor-engine.js` | Form Audit modal; writes via `BBF_SYNC.logAuditRequest`. Uses `VC \|\| CU`. Calls `SS_REFRESH_DAMAGED` post-success (Phase 7). |
| `prehab-auditor.js` | Pre-Hab modal; same `VC \|\| CU` + `SS_REFRESH_DAMAGED` pattern. |
| `fueling-engine.js` | Bioenergetic dashboard block; `renderSettingsControl` removed (Phase 10). |
| `mastermind-portal.html` | Admin Command Center; stats from `BBF_SYNC.fetchAdminDashboardStats` with pre-paint baseline + Number coercion + try/catch (Phase 9/9b). Sovereign Trial toggle has optimistic UI + revert. |
| `portal-engine.js` | Mastermind portal logic; duplicate `toggleTrialAccess` deleted (Phase 8). |
| `sw.js` | Service Worker; bump `CACHE` constant on every client-side change (currently `bbf-v32`). |
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

3. **Cleanup:** delete test rows from `bbf_vapi_calls` if synthetic.

## 9. Recent merged PRs (reverse chronological)

- **#90** (2026-05-01) Phase 10 UI pruning — Book tab + page removed (nav 7→6, Upgrade CTA → SMS intent); Upcoming Event Date settings row removed; Free Log five-point cleanup (tighter title + subtitle, removed Weight/Body Fat, removed Rest chip, REFLECTION divider). SAVELOG hardened. Cache `bbf-v32`.
- **#89** (2026-05-01) Phase 9b defensive normalizer — `fetchAdminDashboardStats` handles 4 PostgREST shapes + diagnostic log; Mastermind Portal pre-paints `'0'` baseline + Number coercion + try/catch. Cache `bbf-v31`.
- **#88** (2026-05-01) Phase 9 admin dashboard stats + somatic tiers — RPC `bbf_get_admin_dashboard_stats`; mastermind-portal.html stats from Supabase (was localStorage); Somatic sliders render axis-aware tier labels (Sleep direct, Cog/Stress flipped). Migration `20260502050000` applied. Cache `bbf-v30`.
- **#87** (2026-05-01) Phase 8b Vault Masterclass stacked — converted from hidden alternate pane to always-visible section beneath workout area; `switchVaultTab` deleted (~20 lines unreachable). Cache `bbf-v29`.
- **#86** (2026-05-01) Phase 8 admin bypass + live trial toggles — `BBF_IS_ADMIN()` helper, 3 gate sites OR'd; migration `20260502040000` adds `trial_status / trial_start_date / updated_at` + RPC `bbf_set_trial_status`; mastermind-portal toggle has optimistic UI + revert; duplicate `toggleTrialAccess` in `portal-engine.js` deleted. Cache `bbf-v28`.
- **#85** (2026-05-01) Phase 7 Sentinel UI binding — `BBF_SYNC.fetchDamagedZones` output drives Sovereign Sentinel SVG on Program tab; 3-tier `.audit-flag` CSS keyed by audit count; `SS_REFRESH_DAMAGED` activation hook on tab + post-audit. Cache `bbf-v27`.
- **#84** (prior bridge) Handoff post slug→UUID bridge + audit view-as fix.
- **#83** Audit "view as" UID priority fix — `VC || CU` in auditor-engine + prehab-auditor.
- **#82** Slug → UUID bridge — 5 demo clients seeded, `bbf_get_uid_map` RPC, resolver layer in `bbf-sync.js`.
- **#80** Phase 6 Form Audit data routing — `bbf_audit_logs`, `BBF_SYNC.logAuditRequest`/`fetchDamagedZones`/`fetchPendingAudits`.
- **#78** Phase 5 — Vapi sales recovery loop.
- **#77** Phase 1.7 — Vapi outbound payload fix.
- **#76** Admin PIN verification.
- **#74** Phase 1.6 — pg_net wired to Vapi edge fn with Vault auth.

## 10. Fresh-session kickoff prompt

Paste into a new Claude session as the opening message:

> You are continuing work on Build Believe Fit. **Read `AI_DIRECTIVES.md` first** (especially §2.1 — Operating Cadence / Speed-First Autonomy), then `api/CLAUDE_SESSION_HANDOFF.md` (especially §11 context discipline). Production state, RPC inventory, migrations applied, SW cache, and merged PR log are in handoff §3 / §9. After reading, run `git fetch origin --prune` and `git log origin/main --oneline -10`. Check for any open `ag/*` or `claude/*` branches with unmerged work. Report: (a) where main is, (b) what's queued. Then stand by for the directive — and execute it under the Tier 1 default unless a Tier 2/3 trigger applies.

## 11. Context discipline (timeout prevention)

This thread shipped six PRs without a single timeout (Phases 7, 8, 8b, 9, 9b, 10). Future sessions follow the same habits — they apply equally to backend MCP work and frontend UI work:

1. **MCP > file reads.** Query prod with `execute_sql` before reading files when checking state. Cheaper context.
2. **Batch parallel.** Independent tool calls in ONE message; never sequential without a real dependency.
3. **Read with offset/limit.** Need lines 391–545? `Read(file, offset:391, limit:155)`. Don't read a 2000-line file for 150 lines.
4. **Don't echo your own writes.** Reference SQL/code you just produced by name; don't paste it back into chat.
5. **Status updates: ONE sentence.** "Migration 1/3 applied" — done. Skip the recap.
6. **No "let me think" preambles.** Do the thing, then state the result.
7. **Big writes → disk, not chat.** Schema regens, bulk rewrites, multi-section docs: Write → commit → push → one-line confirm with sha. Never paste 1000+ lines into the conversation.
8. **Delegate to AG for non-trivial edits.** Anything > ~5 lines of new code that isn't time-sensitive → write a directive, AG drafts on `ag/<topic>`, you verify. Currently dormant; reactivate when scope warrants.
9. **PR bodies = durable record.** Test plans, gotchas, verification checklists live in PR descriptions where they survive context resets — not in chat scrollback.
10. **Checkpoint to this doc proactively.** Phase wrap OR heavy context → update §3 / §4 / §9 + commit + push. Bridges sessions cleanly.
11. **End the turn early.** Question answered → stop. Don't volunteer five next-step ideas. One next-step or "standing by" is enough.

### Frontend addendum (when editing `bbf-app.html`)

- **Grep before read.** Find handlers / IDs / selectors with `grep -n` first; then `Read` with offset/limit.
- **Bump SW cache.** Increment `BBF_CACHE` on every client-side change.
- **Verify input/handler symmetry.** When deleting an input like `#lwt`, grep for `getElementById('lwt')` first — handlers that read a removed input null-ref on save (caught Phase 10 mid-flight).

**Bridge signal:** if the conversation gets heavy mid-task — stop, update this doc with current state, commit, tell Akeem *"context refresh recommended — handoff updated."* That's the cue to move to a fresh session without losing thread.

---

*Living doc. Update as state changes. Keep it under ~350 lines so a session can read it fast.*
