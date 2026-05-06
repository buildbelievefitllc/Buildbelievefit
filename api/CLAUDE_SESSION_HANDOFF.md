# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-05-06 (post Phase 14 Nutrition Tier System + all 18 slices of Phase 15 Live AI Coach + manifest TWA compliance + Android `assetlinks.json` direct-push; Phase 16 Sovereign Trial Hard-Lock — with Iron Vault — queued)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice + Live AI Coach (Phantom Eye + Virtual Coach via Gemini Multimodal Live)
**Founder:** Akeem Brown
**Phase:** Phase 14 Nutrition Tier System shipped (PR #96 + post-merge dietary-intake commit). Phase 15 Live AI Coach shipped end-to-end across 17 merged commits (PRs #97-#107, #109-#113; #108 + Slice 13 abandoned per CEO override). `.well-known/assetlinks.json` direct-pushed to main as per-task exception (commit `6275eb2`). Android TWA submitted to Play Console internal testing — CEO is in 20-tester waiting period and applying for DUNS. Phase 16 Sovereign Trial Hard-Lock (with **Project Iron Vault** server-enforced gate architecture) queued — six open architecture questions on `claude/phase-16-sovereign-trial-directive` branch awaiting CEO answers before any code. Prior live state: Vapi 1-5, Phases 6-10, Phases A/B2/B3 all in production.

This doc orients a fresh Claude session. Read it first, then run the checklist in **§4 Immediate Claude tasks** before touching anything else.

---

## 1. Roles

- **Akeem** — Decides scope, reviews diffs, merges PRs. Sole human in the loop.
- **Claude (you)** — Senior engineer & verifier. Uses Supabase MCP + GitHub MCP to introspect, apply migrations, deploy edge functions, open PRs, and verify AG's drafts.
- **Antigravity (AG)** — Autonomous coder running locally on Akeem's machine. Drafts code on `ag/<topic>` branches, commits, and pushes. **Never** applies to production. **Never** modifies `api/supabase-schema-actual.sql`. (Currently dormant — Phases 7-15 were all Claude-direct.)

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
- `BBF_SYNC.fetchDamagedZones(userId)` output drives the Sovereign Sentinel SVG (Program tab — `tp-workout`, not Prehab).
- 3-tier `.audit-flag` CSS (amber → orange → red) keyed by audit count over last 30 days; `<title>` tooltip preserved.
- `window.SS_REFRESH_DAMAGED` exposed; called on workout-tab activation + after every `logAuditRequest` resolves.

**Global Admin Bypass + Live Sovereign Trial cosmetic toggle (Phase 8, PR #86) — LIVE (about to be hard-locked by Phase 16):**
- `window.BBF_IS_ADMIN()` helper at `bbf-app.html` top of auth engine returns `CU === 'akeem'` regardless of `VC` (Architect-everywhere, interpretation B). Three gate sites OR'd: Vault grid render, `openModule()` lock, Busy Parent guide tier.
- Migration `20260502040000_sovereign_trial_columns.sql` applied: adds `trial_status` (CHECK `inactive|active|completed`), `trial_start_date`, `updated_at` columns to `bbf_users`. SECURITY DEFINER RPC `bbf_set_trial_status(p_uid text, p_active boolean)` resolves slug → UUID and applies UPDATE.
- ⚠️ **The toggle is currently cosmetic** — flipping `trial_status` does NOT block backend AI/voice/camera routes. **Phase 16 turns this into a real lockout gate** (see Project Iron Vault in §5).

**Vault Masterclass Stacked Section (Phase 8b, PR #87) — LIVE.**

**Live Admin Dashboard Stats + Somatic Tier Labels (Phase 9, PR #88) — LIVE:**
- Migration `20260502050000_admin_dashboard_stats_rpc.sql` applied: SECURITY DEFINER RPC `bbf_get_admin_dashboard_stats()` returns `jsonb_build_object('total_clients', 'total_logs', 'total_audits')`.
- Somatic Readiness sliders render axis-aware tier labels + color (Sleep direct-mapped; Cog/Stress flipped).

**Defensive Normalizer (Phase 9b, PR #89) — LIVE:** `fetchAdminDashboardStats` normalizes 4 PostgREST shapes; Mastermind Portal pre-paints `'0'` baseline + Number coercion + try/catch.

**UI Pruning (Phase 10, PR #90) — LIVE:** Book tab removed (nav 7→6, Upgrade CTA → SMS intent); Upcoming Event Date row removed; Free Log five-point cleanup.

**Pricing realignment + Youth Athlete tier (Phases A + B2 + B3) — LIVE:**
- **Phase A (PR #94)** repriced storefront: Gateway $147→$67, Architect $497→$247, Sovereign $1,500→$497.
- **Phase B2 (PR #95)** youth-athlete backend fork in `index.js` `/process` Phase 2 → `SYSTEM_PROMPT_YOUTH_HYPERTROPHY` + `SYSTEM_PROMPT_YOUTH_NUTRITION` (age-gated load caps, sport-specific prehab triggers, hard nutrition exclusions).
- **Phase B3 (direct push `266ad2d`)** youth storefront card on 4-card grid, `selectTier('youth_athlete')` → Pathfinder. `BBF_STRIPE_BY_TIER` + `BBF_TIER_INDEX` updated to 4 entries.

**Phase 14 — Nutrition Tier System (PR #96 + post-merge `3d8c756`) — LIVE:**
- **Slice 1+3 (`e1c48a3`):** Nutrition Portal storefront + Lite-tier lead capture surface added to marketing flow.
- **Slice 2 (`decd5dd`):** RBAC `nutrition_only` role — application-layer gate that suppresses the Workouts tab in `bbf-app.html` for nutrition-only clients. **No DB migration shipped** — role is currently inferred client-side from tier metadata; backend persistence is a follow-up if/when admin override is needed.
- **Slice 5 (`3df30cd`):** Nutrition-only AI engine in `index.js` — `/process` Phase 2 now tri-forks (`adult` → `youth_athlete` → `nutrition_only`), routing nutrition-only intakes to a dedicated Anthropic prompt that emits MP-shape JSON with no WP companion.
- **Pathfinder dietary intake (`3d8c756`):** liability-shield questions added to the Pathfinder questionnaire (allergies, medical conditions, dietary restrictions) — required before nutrition routing can proceed.
- **Tri-cuisine library:** `bbf_meals.json` lives at repo root (American / Mexican / Brazilian recipes from NotebookLM, NotebookLM cite markers stripped per `4d732ac`). Referenced by the nutrition-only prompt for cuisine grounding.
- **Skipped:** Slice 4 (consolidated into other slices).

**Phase 15 — Live AI Coach + Wearable Sync + Friction Tracker + Android TWA (PRs #97-#107, #109-#113) — LIVE:**

*Live AI Coach core (Slices 1A/1B/1C/2/5):*
- **Slice 1A (`7ffc25c`):** Masterclass surface purged from `bbf-app.html` + `bbf-data.js` to clear the slot for the Live Coach hub.
- **Slice 1B (`1f0c9e8`):** Phantom Eye repurposed as the Live AI Coach hub on the Workouts tab.
- **Slice 1C (`f13b8a6`):** Live Coach camera modal + `getUserMedia` + first SW bump.
- **Slice 2 (`ef4104d`):** Titan 3 vision pipeline surgically extracted into the Phantom Eye flow.
- **Slice 5 (`4f6f882`):** WebSocket bridge **`/ws/phantom-eye` in `index.js`** uses the `ws` package; requires `GEMINI_API_KEY` Render env var; targets `models/gemini-2.5-flash-native-audio-latest` on the **v1alpha** BidiGenerateContent endpoint with the `setup.generationConfig` payload shape (final stable choice after Slices 8/11/12/14/15 model/endpoint churn).

*Bifurcation, idle, mobile (Slices 6/7/8/16):*
- **Slice 6 (`7b0db0e`):** Bifurcated activation for cost control — **`BBF Phantom Eye`** (vision: video + audio) and **`BBF Virtual Coach`** (audio-only). Both render in `bbf-app.html` Workouts tab; both share the same `_lcResolveMode` resolver.
- **Slice 7 (`0679afe`):** 60-second silence auto-terminate kill switch wraps both modes via the AnalyserNode that drives the orb pulse.
- **Slice 8 (`603ec91`) + Slice 16 (`d7fbed8`):** Mobile fixes — `.pe-frame` drops `aspect-ratio: 16/9` on `≤768px`; video uses `object-fit: cover` not `contain`; `videoEl.play().catch()` for iOS autoplay quirk; camera-denied fires both in-modal pill + persistent TOAST.

*Comlink purge (Slice 9):*
- **Slice 9 (`8511194`):** Phantom Comlink (async video drop) **client surface fully purged** + Live Coach CTAs go full-width. `comlink-engine.js` and the `mastermind-portal.html` Comlink Dispatch panel **left intact** (admin tooling, separate file, not in scope).

*Repair + diagnostics (Slice 10):*
- **Slice 10 (`5ab7288`):** Live Coach repair + verbose proxy diagnostics in the WebSocket bridge.

*Model/endpoint churn (Slices 11/12/14/15) — settled at the Slice 5 stack above:*
- Slices 11/12 (model revert then upgrade), Slices 14/15 (endpoint v1alpha → v1beta then revert to v1alpha with native-audio model). End-state: `models/gemini-2.5-flash-native-audio-latest` on v1alpha. **Do not change without re-validating Slice 15.**

*Wearable Sync (Slice 4):*
- **Slice 4 (`1d915de`):** GET `/api/wearable-sync/health-connect` returns simulated Samsung Health Connect payload. `syncWearable()` button on the Somatic Readiness Matrix maps to color tiers `cleared / caution / depleted` (Galaxy Watch / Health Connect bridge).

*Friction Tracker (Slice 3):*
- **Slice 3 (`837d370`):** Joint-recovery row inside `#biomech-heatmap` ("BHM"). Reads `d.u[uid].intake.friction` (Sovereign Intake step 3); exponential decay model.

*Android TWA / PWABuilder compliance (Slices 17/18 + assetlinks direct-push):*
- **Slice 17 (`c118143`):** `manifest.json` TWA / PWABuilder compliance — description copy locked, `id` field added, all icons `.png` with RGBA, `<link rel="manifest" href="/manifest.json" crossorigin="use-credentials"/>` on both HTML entry points.
- **Slice 18 (`cdd6e00`):** PWABuilder strict storefront compliance pass.
- **`6275eb2` direct push to main (per-task CEO exception, NOT a workflow change):** `.well-known/assetlinks.json` live with SHA-256 cert fingerprint `1F:2F:D0:2F:C9:89:D4:99:C9:3D:4C:AB:88:86:E2:EC:90:20:F4:64:1E:7E:56:3B:9B:1D:2A:2F:4D:0A:82:B1` and package `fitness.buildbelievefit.twa`. Default §6.1 (no direct push) still applies to all other work.

*Phase 15 misses (per CEO override):* PR #108 + Slice 13 abandoned. Treat as complete.

**Admin "view as" UID priority — FIXED (PR #83).**

**Migrations applied to project `ihclbceghxpuawymlvgi`:**
- `20260502020500_form_audit_routing` (Phase 6)
- `20260502030000_seed_demo_users` (slug bridge)
- `20260502040000_sovereign_trial_columns` (Phase 8 — columns + RPC; **Phase 16 will add gate enforcement on top of these**)
- `20260502050000_admin_dashboard_stats_rpc` (Phase 9 — RPC)
- *(Phase 14 + Phase 15 shipped without new migrations — both are application-layer.)*

**SECURITY DEFINER RPC inventory (admin trust surface):**
- `bbf_verify_admin_pin(pin_attempt)` — admin PIN check
- `bbf_get_uid_map()` — slug ↔ UUID directory for the bridge
- `bbf_set_trial_status(p_uid, p_active)` — Sovereign Trial toggle (cosmetic until Phase 16 wires the gate)
- `bbf_get_admin_dashboard_stats()` — Mastermind Portal counts

**Configuration state (verified by Akeem):**
- `pg_cron` extension: ENABLED.
- Edge Function Secrets: `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (Rex), `VAPI_SALES_ASSISTANT_ID` (Pathfinder closer), `VAPI_PHONE_NUMBER_ID`. Deprecated `TWILIO_PHONE_NUMBER` should be removed.
- Render env: `GEMINI_API_KEY` required for `/ws/phantom-eye` Live Coach proxy.
- Vault secret: `bbf_vapi_invoke_token` (matches Edge Function Secret).
- **SW cache: `bbf-v100`** (was `bbf-v32` at the prior bridge; bumped through Phase 14 + every Phase 15 slice).

## 4. Immediate Claude tasks

Phases 14 + 15 are live end-to-end. Akeem has the Android TWA in Play Console internal testing (20-tester waiting period, DUNS application in flight). Next directive is **Phase 16 Sovereign Trial Hard-Lock** with **Project Iron Vault** server-enforced gate (see §5).

- [x] Phase 14 — Nutrition Tier System (PR #96 + commit `3d8c756`, merged 2026-05-05/06)
- [x] Phase 15 — Live AI Coach + Wearable + Friction + manifest TWA + assetlinks (PRs #97-#107, #109-#113 + direct-push `6275eb2`)
- [ ] **Phase 16 prereq (CEO):** answer the six open architecture questions on `claude/phase-16-sovereign-trial-directive` branch — no Phase 16 code lands until this clears.
- [ ] **Phase 16 prereq (Claude):** read `PHASE_16_SOVEREIGN_TRIAL_DIRECTIVE.md` from `origin/claude/phase-16-sovereign-trial-directive` and surface the Q-list to CEO.
- [ ] **Akeem todo:** smoke-test Phase 14 end-to-end (Nutrition Portal storefront → Pathfinder dietary intake → Stripe → `/provision` nutrition-only fork → app login renders MP-only with Workouts tab suppressed).
- [ ] **Akeem todo:** smoke-test Phase 15 Live Coach in production on mobile + desktop (both modes, idle kill at ~60s, camera-denied path).
- [ ] **Akeem todo:** verify Android TWA passes Play Console internal review once 20-tester window closes; complete DUNS for business-path submission.
- [ ] **Akeem todo:** remove deprecated `TWILIO_PHONE_NUMBER` Edge Function Secret in Supabase dashboard.
- [ ] **Re-introspect schema** → regenerate `api/supabase-schema-actual.sql`. **DEFERRED** — separate dedicated session, disk-only-write protocol per §11 rule #7. Still FIVE units behind (no new migrations since Phase 9, so the deficit hasn't grown — but Phase 16 Iron Vault columns will make it SIX once applied).
- [ ] **Diagnostic console.log cleanup** in `bbf-sync.js fetchAdminDashboardStats` and the `/ws/phantom-eye` proxy in `index.js` once production telemetry confirms steady-state.

## 5. Active backlog

- **Phase 16 — Sovereign Trial Hard-Lock + Project Iron Vault (NEXT, plan-then-greenlight per §6.2 Tier 2; multiple Tier 2 components inside).** The Phase 8 Sovereign Trial toggle is currently cosmetic — flipping `trial_status` does not block backend access to AI/voice/camera routes. Phase 16 makes it a real lockout gate. Six open architecture questions live on branch `claude/phase-16-sovereign-trial-directive` (`PHASE_16_SOVEREIGN_TRIAL_DIRECTIVE.md`); CEO answers them before any code. **Iron Vault locked architecture (CEO directive 2026-05-06):**
  1. **Supabase schema update:** add `subscription_tier` and `trial_expires_at` columns to `bbf_users` (new migration). Q6 in the Phase 16 Q-list is the gate-composition question that will determine exact column types + how this composes with the existing `trial_status / trial_start_date` columns from Phase 8.
  2. **Node.js Express middleware `requirePremiumOrActiveTrial`** in `index.js` — guards the AI voice/camera routes (at minimum `/ws/phantom-eye` Live Coach proxy and any Vapi-touching endpoints). Returns `403 Unauthorized` if `trial_expires_at < Date.now()` AND `subscription_tier` is not premium.
  3. **Frontend hard-lock in `bbf-app.html`:** force the Sovereign Coach toggle to disabled state and trigger the Paywall/Stripe modal when `trial_expires_at` is past `Date.now()`. UI mirrors the backend gate — frontend state alone is NOT trusted; the 403 from the middleware is the source of truth.
  - **Sequencing:** migration first (Tier 2), then middleware (Tier 2 — touches an active edge fn / Render server), then frontend (Tier 1 — UI in already-shipped file). SW cache bump on the frontend slice.
- **Phase B4 (deferred)** — add a dedicated `sport` field to the youth-tier intake form (currently inferred from `training_protocol` text).
- **Parental-consent liability copy** for under-18 youth intake — Big Jim's call.
- **Phase 14 follow-ups:** persist `nutrition_only` role in DB (currently inferred client-side); admin override path for tier flips.
- **Schema-actual.sql re-introspection** — five units behind; will be six after Phase 16 Iron Vault migration applies.
- **`admin.html` access_status toggles** — same backend-disconnect problem `mastermind-portal.html` had pre-Phase-9.
- **`syncUser` rewrite** — `bbf-sync.js:130` writes `id: uid` (slug into uuid column) and includes fields not in schema.
- **Trainer-view name join** — `fetchPendingAudits` surfaces `user_id` UUID as display name; needs join.
- **Vapi Phase 4 (callback receiver)** — not yet scoped.
- **Render Vault Engine V9 cleanup** — see `api/AG_INTEGRATION_NOTES.md` P3 backlog.
- **i18n table cleanup** — `app-book-*`, `app-nav-book` lang keys orphaned by Phase 10 deletions.
- **Dangling remote branches** — `claude/phase-14-nutrition-tiers-U1nUv`, `claude/init-bbf-frontend-413uy`, `claude/global-claude-md-directive`, `claude/phase6-handoff-live`, `v3-engine-swap-parked`. Prune in a future cleanup pass (CEO override: not now).

## 6. Workflow rules

### 6.1 Non-negotiable safeguards (integrity)

- **Nothing is version 2.** No `_v2`, `bbf_v2`, `*_new`, `*_2026` suffixes. Update existing code in place.
- **PIN auth (Option A) is the path.** Do not introduce Supabase Auth.
- **AG never modifies** `api/supabase-schema-actual.sql`. Claude regenerates via introspection.
- **AG never applies** migrations or deploys edge functions. Claude does via MCP.
- **Service Worker:** when shipping changes to `bbf-app.html`, bump the `BBF_CACHE` version constant (currently `bbf-v100`).
- **No direct push to `main`.** Always PR. Akeem merges. (`266ad2d` Phase B3 and `6275eb2` assetlinks were per-task exceptions, not a workflow change.)
- **Live Coach Gemini stack is locked** at `models/gemini-2.5-flash-native-audio-latest` on **v1alpha** BidiGenerateContent. Do not change without re-validating Slice 15.
- **`comlink-engine.js` + Mastermind Portal Comlink Dispatch panel are admin tooling — out of scope for client-surface purges.**

### 6.2 Tiered Autonomy Model — when Claude pauses for greenlight

The loop in §2 has been measured: when the next step is low-risk, the plan-then-greenlight pause adds friction without protecting integrity. This tier model removes that friction selectively while preserving every safeguard.

#### Tier 1 — Auto-execute (no plan presentation, no greenlight pause)

Claude proceeds directive → investigate → execute → PR → report. Plans appear in commit messages and PR bodies, not as a separate chat round. Applies to:

- UI/UX changes to existing surfaces (HTML/CSS/JS edits in already-shipped files)
- Dead code deletion when grep confirms scope-exclusive
- Cache bumps, comment cleanups, behavior-preserving refactors
- Adding diagnostic `console.log` / defensive guards / try-catch hardening
- Documentation updates (this file, PR descriptions)
- New helper functions in existing modules
- Tier label / copy / styling tweaks
- PR creation, branch creation, commits to `claude/*` branches

Bounds: Tier 1 work still bumps the SW cache, still gets a PR, still gets smoke-tested by Akeem.

#### Tier 2 — Plan-then-greenlight (current §2 workflow, preserved)

Claude presents the implementation plan and waits for explicit greenlight before any edits. Applies to:

- Database migrations (DDL, RLS policy changes, new RPCs, schema changes) — **including Phase 16 Iron Vault columns**
- New edge functions or cron schedules
- New tables or columns on existing tables
- Anything touching production secrets / Vault / Edge Function Secrets
- Deletion of currently-active functionality (verified live, not dead code)
- Architectural pivots (auth model, sync layer, plan-resolution path, data routing) — **including the Phase 16 `requirePremiumOrActiveTrial` middleware that newly gates `/ws/phantom-eye` and Vapi routes**
- Cross-system changes (Render, Zapier, Vapi, Stripe, Brevo, Gemini wiring)
- Anything Claude flags as "I'm not certain about scope" — uncertainty itself is a signal to pause.

#### Tier 3 — Halt-and-confirm (always pause before AND after)

- `DROP`, `DELETE` without `WHERE`, `TRUNCATE`
- Force-push, branch deletions, history rewrites
- Changes to live cron schedules or active edge functions
- Anything that could destroy data, lose work, or disrupt the production deploy
- **Direct pushes to `main`** — only with per-task CEO authorization

### 6.3 PR & branch hygiene

- Branch naming: `claude/<phase-or-topic>-<short-slug>`.
- Always branch off `origin/main` for fresh work — never reuse a previously-merged branch's name.
- Commit messages: `feat(scope): one-line summary` / `fix(scope): one-line summary` / `chore(scope): ...`.
- PR body: summary + files-changed table + risk + test plan checklist + out-of-scope. Migration commands inline if applicable.

## 7. Key files (source of truth)

| File | Purpose |
|---|---|
| `api/AG_INTEGRATION_NOTES.md` | AG's orientation doc — read for AG context & P3 backlog |
| `api/VAPI_DESIGN.md` | Vapi architecture; §7 = operational setup |
| `api/PHASE_4_LIVE_CONFIG.md` | Render/Zapier/Brevo config reference |
| `api/PHASE_6_FORM_AUDIT_PLAN.md` | Form Audit data routing plan |
| `api/AG_DIRECTIVE_PHASE_6_FORM_AUDIT.md` | Big Jim's directive + Claude scope guards for Phase 6 |
| `api/supabase-schema-actual.sql` | Production schema (re-introspect — five units behind; six after Phase 16) |
| `bbf-app.html` | Frontend — PIN login, LP() plan resolution, polished UI; demo client `d.u` dict at lines ~4335, 6282, 6495, 6810, 6944. `BBF_IS_ADMIN()` helper at top of auth engine (Phase 8). Workouts tab hosts the Live Coach hub with two CTAs (Phantom Eye / Virtual Coach), 60s idle kill, mobile `.pe-frame` overrides. Workouts tab suppressed for `nutrition_only` role (Phase 14). Friction Tracker row inside `#biomech-heatmap` (Phase 15 Slice 3). Sovereign Coach toggle gets Phase 16 Iron Vault hard-lock. |
| `bbf-sync.js` | Cloud sync layer; `_supa()` raw HTTP + public `supa()` wrapper with slug→UUID resolver. `fetchAdminDashboardStats` 4-shape PostgREST normalizer. `toggleSovereignTrial` calls `bbf_set_trial_status` RPC. |
| `auditor-engine.js` | Form Audit modal; writes via `BBF_SYNC.logAuditRequest`. Uses `VC \|\| CU`. Calls `SS_REFRESH_DAMAGED` post-success. |
| `prehab-auditor.js` | Pre-Hab modal; same `VC \|\| CU` + `SS_REFRESH_DAMAGED` pattern. |
| `fueling-engine.js` | Bioenergetic dashboard block. |
| `mastermind-portal.html` | Admin Command Center; stats from `BBF_SYNC.fetchAdminDashboardStats`. Sovereign Trial toggle (cosmetic until Phase 16). Comlink Dispatch panel intact (admin tooling). |
| `portal-engine.js` | Mastermind portal logic. |
| `comlink-engine.js` | Phantom Comlink (async video) — admin tooling, NOT client-facing (Phase 15 Slice 9 purged client surface but kept this file). |
| `sw.js` | Service Worker; bump `CACHE` constant on every client-side change (currently `bbf-v100`). |
| `manifest.json` | PWA manifest — TWA/PWABuilder compliant (Phase 15 Slices 17/18). Description locked, `id` field set, all icons `.png` RGBA. Loaded with `crossorigin="use-credentials"` from both HTML entry points. |
| `.well-known/assetlinks.json` | Android Digital Asset Links — package `fitness.buildbelievefit.twa`, SHA-256 fingerprint locked. Direct-pushed to main (`6275eb2`) per CEO per-task exception. |
| `bbf_meals.json` | NotebookLM-sourced tri-cuisine recipes (American / Mexican / Brazilian). Cite markers stripped. Referenced by Phase 14 nutrition-only Anthropic prompt. |
| `index.js` | Render Vault Engine V9 — `/process` + `/provision` endpoints. `/process` Phase 2 tri-forks on `payload.tier` (`adult` → `youth_athlete` → `nutrition_only`) with three Anthropic prompt variants. Hosts the **WebSocket proxy `/ws/phantom-eye`** (Phase 15 Slice 5) — uses the `ws` package, requires `GEMINI_API_KEY` Render env, targets `models/gemini-2.5-flash-native-audio-latest` on v1alpha BidiGenerateContent with `setup.generationConfig` payload shape. **Phase 16 will add `requirePremiumOrActiveTrial` middleware here** to gate the WS proxy + Vapi routes. Storefront `index.html` uses `BBF_STRIPE_BY_TIER` (4 entries) + `BBF_TIER_INDEX` + `selectTier()`. |
| `supabase/functions/vapi-outbound-trigger/index.ts` | Vapi trigger edge function (auth-gated) |
| `supabase/migrations/` | All DB migrations |

## 8. Vapi end-to-end smoke test

After §4 migrations + deploy, before declaring victory:

1. **Positive path:**
   - Pick a test row in `bbf_active_clients` with `client_phone` set.
   - Ensure `bbf_logs` for that client has no entry in the last 3 days, AND `bbf_vapi_calls` has no entry in the last 7 days for that email.
   - Run: `SELECT public.bbf_evaluate_streaks();`
   - Verify: row appears in `bbf_vapi_calls` with `call_status = 'initiated'`.
   - Verify: `SELECT * FROM net._http_response ORDER BY created DESC LIMIT 5;` shows a 200/202 from the edge function URL.

2. **Negative auth test:**
   - `curl -X POST https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/vapi-outbound-trigger -H "Content-Type: application/json" -d '{}'`
   - Expect: `401 unauthorized`.

3. **Cleanup:** delete test rows from `bbf_vapi_calls` if synthetic.

## 9. Recent merged PRs (reverse chronological)

- **`6275eb2` (direct push to main)** (2026-05-06) `.well-known/assetlinks.json` — Android Digital Asset Links handshake live. Package `fitness.buildbelievefit.twa`, SHA-256 fingerprint `1F:2F:D0:2F:C9:89:D4:99:C9:3D:4C:AB:88:86:E2:EC:90:20:F4:64:1E:7E:56:3B:9B:1D:2A:2F:4D:0A:82:B1`. Per-task CEO exception, default §6.1 still applies.
- **#113** (2026-05-06) Phase 15 Slice 18 — PWABuilder strict storefront compliance.
- **#112** (2026-05-06) Phase 15 Slice 17 — `manifest.json` TWA / PWABuilder compliance (description locked, `id` field, all icons `.png` RGBA, `crossorigin="use-credentials"`).
- **#111** (2026-05-06) Phase 15 Slice 16 — mobile frame + video render (CSS-only, no DOM dup): `.pe-frame` drops `aspect-ratio:16/9` ≤768px; `object-fit:cover`.
- **#110** (2026-05-06) Phase 15 Slice 15 — stable engine swap (2.5 native-audio · v1alpha). End-state of model/endpoint churn.
- **#109** (2026-05-06) Phase 15 Slice 14 — Gemini Live endpoint upgrade v1alpha → v1beta (later reverted in Slice 15).
- **#107** (2026-05-06) Phase 15 Slice 12 — upgrade Gemini Live model to 3.1-flash-live-preview (later reverted).
- **#106** (2026-05-06) Phase 15 Slice 11 — revert Gemini Live model string to -exp.
- **#105** (2026-05-06) Phase 15 Slice 10 — Live Coach repair + verbose proxy diagnostics.
- **#104** (2026-05-06) Phase 15 Slice 9 — Phantom Comlink client-surface purge + full-width Live Coach CTAs. `comlink-engine.js` + Mastermind Comlink Dispatch panel intact.
- **#103** (2026-05-06) Phase 15 Slice 8 — Gemini Live model upgrade + mobile viewport guard. `videoEl.play().catch()` for iOS autoplay; camera-denied pill + persistent TOAST.
- **#102** (2026-05-06) Phase 15 Slice 7 — auto-terminate idle kill switch (60s silence) wraps both modes via the AnalyserNode.
- **#101** (2026-05-06) Phase 15 Slice 6 — bifurcated Live Coach (Phantom Eye = vision, Virtual Coach = audio-only); shared `_lcResolveMode` resolver.
- **#100** (2026-05-06) Phase 15 Slice 5 — `/ws/phantom-eye` WebSocket bridge to Gemini Multimodal Live (`ws` package; `GEMINI_API_KEY`; v1alpha BidiGenerateContent).
- **#99** (2026-05-06) Phase 15 Slice 4 — Wearable API Bridge for Galaxy Watch / Health Connect (`/api/wearable-sync/health-connect` + Somatic Readiness Matrix tier mapping).
- **#98** (2026-05-06) Phase 15 Slice 2 (Titan vision pipeline extraction) + Slice 3 (Joint Friction Recovery Tracker on the BHM, exponential decay).
- **#97** (2026-05-06) Phase 15 Slices 1A/1B/1C — Masterclass purge → Phantom Eye repurposed as Live AI Coach hub → camera modal + getUserMedia + first SW bump.
- **#96** (2026-05-05) Phase 14 — Nutrition Tier System (Slices 1+3 storefront/lead capture; Slice 2 RBAC nutrition_only; Slice 5 nutrition-only AI engine + tri-fork in `/process`). Post-merge `3d8c756` added Pathfinder dietary intake liability shield.
- **`266ad2d` (direct push to main)** (2026-05-05) Phase B3 — Youth Athlete tier UI card on storefront. 4-card grid; per-task exception.
- **#95** (2026-05-05) Phase B2 — Youth Athlete tier backend fork in `/process` + clinical Anthropic prompts.
- **#94** (2026-05-05) Phase A — Pricing realignment ($147→$67 / $497→$247 / $1,500→$497).
- **#90** (2026-05-01) Phase 10 UI pruning — Book tab + page removed (nav 7→6).
- **#89** (2026-05-01) Phase 9b defensive normalizer.
- **#88** (2026-05-01) Phase 9 admin dashboard stats + somatic tiers.
- **#87** (2026-05-01) Phase 8b Vault Masterclass stacked.
- **#86** (2026-05-01) Phase 8 admin bypass + live trial toggles (cosmetic until Phase 16).
- **#85** (2026-05-01) Phase 7 Sentinel UI binding.
- **#84** Handoff post slug→UUID bridge + audit view-as fix.
- **#83** Audit "view as" UID priority fix.
- **#82** Slug → UUID bridge.
- **#80** Phase 6 Form Audit data routing.
- **#78** Phase 5 — Vapi sales recovery loop.
- **#77** Phase 1.7 — Vapi outbound payload fix.
- **#76** Admin PIN verification.
- **#74** Phase 1.6 — pg_net wired to Vapi edge fn with Vault auth.

*PR #108 + Phase 15 Slice 13 abandoned per CEO override — treat as complete.*

## 10. Fresh-session kickoff prompt

Paste into a new Claude session as the opening message:

> You are continuing work on Build Believe Fit (PIN-auth fitness app + Pathfinder + Vapi + Live AI Coach). **Read `api/CLAUDE_SESSION_HANDOFF.md` first — especially §6.2 (Tiered Autonomy) and §11 (context discipline, Rule #7 disk writes).** Production state, RPC inventory, migrations applied, SW cache (`bbf-v100`), and merged PR log are in §3 / §9. After reading, run `git fetch origin --prune` and `git log origin/main --oneline -25`. Check for any open `claude/*` branches with unmerged work — particularly `claude/phase-16-sovereign-trial-directive` which carries the next directive + the six open architecture questions. Report: (a) where main is, (b) PRs landed since last cold-start, (c) Phase 16 Q-list status. Then stand by.

## 11. Context discipline (timeout prevention)

This thread has shipped 30+ PRs without timeout. Future sessions follow the same habits:

1. **MCP > file reads.** Query prod with `execute_sql` before reading files when checking state.
2. **Batch parallel.** Independent tool calls in ONE message; never sequential without a real dependency.
3. **Read with offset/limit.** Don't read a 2000-line file for 150 lines.
4. **Don't echo your own writes.** Reference SQL/code you just produced by name.
5. **Status updates: ONE sentence.** "Migration 1/3 applied" — done. Skip the recap.
6. **No "let me think" preambles.** Do the thing, then state the result.
7. **Big writes → disk, not chat.** Schema regens, bulk rewrites, multi-section docs: Write → commit → push → one-line confirm with sha. Never paste 1000+ lines into the conversation.
8. **Delegate to AG for non-trivial edits.** Currently dormant; reactivate when scope warrants.
9. **PR bodies = durable record.** Test plans, gotchas, verification checklists live in PR descriptions.
10. **Checkpoint to this doc proactively.** Phase wrap OR heavy context → update §3 / §4 / §9 + commit + push.
11. **End the turn early.** Question answered → stop. One next-step or "standing by" is enough.

### Frontend addendum (when editing `bbf-app.html`)

- **Grep before read.** Find handlers / IDs / selectors with `grep -n` first; then `Read` with offset/limit.
- **Bump SW cache.** Increment `BBF_CACHE` on every client-side change (currently `bbf-v100`).
- **Verify input/handler symmetry.** When deleting an input, grep for `getElementById('<id>')` first.
- **Live Coach Gemini stack is locked** — do not change model/endpoint without re-validating Slice 15.

**Bridge signal:** if the conversation gets heavy mid-task — stop, update this doc, commit, tell Akeem *"context refresh recommended — handoff updated."*

---

*Living doc. Update as state changes. Keep it under ~400 lines so a session can read it fast.*
