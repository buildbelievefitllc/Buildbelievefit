# BUILD BELIEVE FIT · SYSTEM INITIALIZATION HANDOFF (Phase 10 entry)

You are taking over an active engineering session on the **Build Believe Fit** repository. The previous AI delivered every commit from Phase 1 through Phase 9.5. Read this entire doc before suggesting any code. The CEO is **Akeem Brown** (uid `akeem`); he operates in WAR ROOM mode — fast-cycle directives, execute-and-report pattern.

---

## 1 · STACK & DEPLOY TOPOLOGY

| Surface | File / Location | Deploys via | Notes |
|---|---|---|---|
| **Storefront** | `index.html` (~3,000 lines) | GitHub Pages on `main` merge | Public marketing + Pathfinder + Nutrition Lite lead forms |
| **Client portal app** | `bbf-app.html` (~13,000 lines) + `bbf-data.js` + `bbf-sync.js` | GitHub Pages on `main` merge | Post-login SPA. Tabs: Home, Workout, Nutrition, Log, Prehab, Profile, Recalibrate (admin), Panopticon (admin Command Center) |
| **Render Node backend** | `index.js` | Render auto-build on `main` merge | Public URL `https://buildbelievefit.onrender.com`. Holds `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`. Routes: `/health`, `/process`, `/provision`, `/api/user/start-trial`, `/api/auth/ws-ticket`, `/api/wearable-sync/health-connect`, `/api/vision-coach`. WebSocket: `/ws/phantom-eye` (Gemini Multimodal Live bridge) |
| **Supabase project** | `supabase/functions/*` + `migrations/*` | MCP-driven | Project ref **`ihclbceghxpuawymlvgi`**. URL `https://ihclbceghxpuawymlvgi.supabase.co`. Edge Functions: `bbf-lead-capture`, `bbf-sentinel`, `stripe-webhook`, `vapi-outbound-trigger`, `vapi-sms-closer` |
| **Service worker** | `sw.js` | Bumps cache version per commit | **Current cache: `bbf-v120`** — bump on every HTML/JS/CSS change. Convention: `var CACHE = 'bbf-vN';` line |
| **i18n** | `bbf-lang.js` | with frontend | EN / ES / PT trilingual; key-based with `data-lang-key` attrs |
| **Auxiliary** | `kfh-3d-renderer.js`, `kfh-3d-rig-bridge.js`, `hologram-renderer.js`, `bbf-translator.js`, `bbf-util.js`, `somatic-engine.js`, `bbf-ws-ticket.js`, `bbf-intelligence-engine.js` | with frontend | Per-feature islands |

### Hard execution rules (the CEO calls these out repeatedly):
1. **All deploys via MCP-driven git flow.** Branch = `claude/init-bbf-frontend-413uy`. Standard cycle: edit → `git add` → `git commit` → `git fetch origin main` → `git rebase origin/main` → `git push --force-with-lease` → `mcp__github__create_pull_request` → `mcp__github__merge_pull_request` (method `rebase`).
2. **NEVER push directly to `main`** — branch protection returns HTTP 403. Always PR + rebase-merge.
3. **NEVER hardcode secrets in source.** Every key (`GEMINI_API_KEY`, `TURNSTILE_SECRET_KEY`, Twilio creds, Brevo creds, Stripe webhook secret) lives in Render env or `supabase secrets set`. Flag this loudly if the CEO pastes a secret in chat — recommend rotation after handoff.
4. **Bump `sw.js` cache version on every frontend commit.** Format `bbf-vN`. Edge cache (GitHub Pages + Cloudflare) and SW cache both flush on bump.
5. **Two distinct files for two distinct surfaces.** `index.html` = public storefront; `bbf-app.html` = post-login portal. The CEO sometimes conflates them in directives — verify before editing.
6. **No backwards-compat shims, no half-implementations.** Surgical changes only. The codebase has multiple duplicate data blocks (e.g., meal plans appear in BOTH `bbf-data.js` and `bbf-app.html`) — update both copies.

---

## 2 · AUTH, USERS, TIERS

### Login flow
1. Frontend POSTs `{ uid, pin_attempt }` to Supabase RPC `bbf_verify_user_pin`.
2. RPC checks `bbf_pin_attempts` lockout table (3 strikes / 15 min), then bcrypt-compares against `bbf_users.pin_hash` (`crypt(pin_attempt, stored_hash) = stored_hash`). Plaintext SHA-256 fallback exists for legacy rows + auto-migrates to bcrypt on first valid login.
3. Returns `{ ok, lockout_active, retry_after_seconds, plans_available, workout_plan, meal_plan, plans_generated_at }`.
4. To set a new PIN: `UPDATE bbf_users SET pin_hash = crypt('<pin>', gen_salt('bf')) WHERE uid = '<uid>'`.

### Globals (in `bbf-app.html`)
| Var | Meaning |
|---|---|
| `CU` | Current User uid string (just `'akeem'` etc., **not** an object — `CU.isAdmin` does NOT work; use `d.u[CU].role === 'trainer'` or `CU === 'akeem'`) |
| `VC` | Visiting Client uid when a trainer is viewing a client's data; null otherwise. Almost every gated read uses `uid = VC \|\| CU` |
| `GD()` / `SD(d)` | Get / Set the entire `bbf_v7` localStorage blob shaped `{ u: {uid: profile}, l: {uid: logs}, w: {...workouts}, audits: [...] }` |
| `MP` | Hardcoded meal-plan dictionary keyed by uid (in `bbf-data.js` + mirrored in `bbf-app.html`) |
| `TAB(name)` | Tab switcher; calls `RH()` / `RW()` / `RN()` / `renderPrehab()` / `PTAB('overview')`. Always re-applies `BBF_APPLY_TIER_GATE` at the end |

### Active roster (in `bbf_users`)
| uid | name | role | tier | notes |
|---|---|---|---|---|
| `akeem` | Akeem Brown | `trainer` | `sovereign` | Server-locked to sovereign in `bbf_admin_set_tier` RPC |
| `ana_bbf` | Ana | client | `gateway` | |
| `jacky_bbf` | Jacky | client | `gateway` | Treadmill cardio 3 mph / Level 6 / 30 min after lifting |
| `jacque_bbf` | **Jacquelyn** | client | `gateway` | **MEDICAL ALERT: STRICT coconut allergy.** Postpartum recomp client. 3-Day PPL plan + 1,652-cal coconut-free meal plan. PIN `999388` |
| `jordan_bbf` | Jordan | client | `gateway` | Partner = `wayne_bbf` |
| `wayne_bbf` | Wayne | client | `gateway` | Partner = `jordan_bbf` |

### Tier slugs (current monetized 4 + legacy still server-allowed)
**Live 4:** `gateway` · `youth_athlete` · `architect` · `sovereign`
**Legacy (server-allow-listed for backward compat):** `lite`, `nutrition_essentials`, `nutrition_platinum` — never use for new grants; surfaces in dropdown as disabled `[legacy: <slug>]`.

### Pricing (storefront `index.html` + `bbf-lang.js`)
| Tier | Price | Term | Stripe Link |
|---|---|---|---|
| Gateway | $67 | /mo recurring | `https://buy.stripe.com/14A7sNb7143x1F02AFaZi0c` |
| Youth Athlete | (same family) | /mo recurring | `https://buy.stripe.com/cNieVf8YT6bF2J42AFaZi0f` |
| Architect Hybrid | **$697** | **Flat Fee / 12-Week Protocol** | `https://buy.stripe.com/14A5kF7UP8jN5Vg7UZaZi0i` |
| Sovereign | **$1,197** | **Flat Fee / 12-Week Apex Protocol** | `https://buy.stripe.com/00wdRb5MHdE73N80sxZaZi0j` |

Old monthly Architect ($247) and Sovereign ($497) products are **archived in Stripe** and return HTTP 403. `BBF_STRIPE_BY_TIER` map at `index.html` ~L2446.

---

## 3 · LIVE FEATURES — DO NOT REBUILD

### 3a · Tier Gating · `BBF_APPLY_TIER_GATE` (`bbf-app.html`)
- Pure DOM-class gate via `.bbf-tier-locked { display: none !important; }`.
- Reset-then-apply pattern: clears the lock class on every tracked element first, then applies the current tier's subset. Tier upgrade in Command Center reveals features without page refresh.
- **Lock map** (effective tier = trial-active ? `sovereign` : `subscription_tier`):
  - `gateway` / `youth_athlete`: hides `phantom-eye-module`, all of `nutrition-tools-stack` (Virtual Chef + Nutrition Vision), `audioMealScannerBtn`, `mealScannerContainer`, `somatic-map`, `qa-l`, `qa-n`, AND the nav tabs `nutrition` / `log` / `prehab`.
  - `architect`: hides only `phantom-eye-module`, `virtual-chef-module`, `nutrition-vision-module`, `nutrition-tools-stack`, `audioMealScannerBtn`, `mealScannerContainer`. All nav tabs visible.
  - `sovereign`: no locks.
  - Unknown tier: falls back to gateway treatment (safest).
- **Bouncer:** if the active tab is one we just locked, calls `TAB('home')`.
- Hooks: chained off `BBF_APPLY_TRIAL_GATE()` (6 sites), plus end of `TAB()`, plus end of `RN()` (so dynamically-rendered Scan Meal button + WebRTC container inherit the lock).

### 3b · Vision Audio Scanner (WebRTC + Gemini + Web Speech API)
- **Frontend:** in Nutrition tab. Button `#audioMealScannerBtn` → `getUserMedia({ video: { facingMode: 'environment' } })` → live feed in `#mealVideoFeed` inside `#mealScannerContainer` → 📸 Take Photo (`#captureMealBtn`) → `canvas.drawImage` → `toDataURL('image/jpeg', 0.9)` → strip `data:...;base64,` prefix → POST `/api/vision-coach` → response text → `speechSynthesisUtterance` → Lance speaks. **Zero text rendered to DOM.**
- **State machine** on Scan Meal button: `idle` (🎙️ Scan Meal) → `streaming` (❌ Cancel Scan) → `analyzing` (🎙️ Analyzing…) → idle on `utterance.onstart`.
- **iOS Safari fix:** silent utterance warm-up on Take Photo click to preserve user gesture across the network round-trip.
- **Leak defenses:** `init()` calls `stopStream()` defensively (RN re-render guard); `visibilitychange` listener kills camera on tab background.
- **Voice picker:** prefers Google UK English Male, falls back to `\bMale\b` word-boundary regex (NOT `.includes('Male')` — that bug accidentally matches "Female").
- **Backend route:** `POST /api/vision-coach` in `index.js`. Body `{ image_base64, mime_type, prompt }`. Calls `gemini-1.5-flash:generateContent` with `parts[].inline_data`. Returns `{ ok: true, text }`. CORS allowlist + per-IP rate limit (5/60s). Body limit globally bumped to 10mb.
- **Module:** `BBF_VISION_COACH` IIFE in `bbf-app.html` ~L10500-area.

### 3c · Prehab Audit "Mark Resolved" (`bbf_audit_logs`)
- **Schema migration applied 2026-05-13:** added `resolved_at timestamptz NULL` + partial index `WHERE resolved_at IS NULL`. NULL = pending. File: `migrations/2026-05-13_audit_logs_resolved_at.sql`.
- **`BBF_SYNC.resolveAudit(auditId)`** in `bbf-sync.js`: PATCH `?id=eq.<id>` with `{ resolved_at: now }` + `Prefer: return=representation`. Empty result = `audit_not_found` (resolved in another tab) → treated as silent success.
- **`fetchPendingAudits()`** now filters `?resolved_at=is.null`, projects `id`.
- **Render in `renderAdminAuditFeed()`** (Command Center Panopticon tab): each `.audit-card` carries a ✓ Mark Resolved button with `data-audit-id` + `data-audit-key`. Counter `.audit-feed-count` decrements in place.
- **Critical detail:** the handler ALSO clears the matching entry from local `d.audits` via the dedupe key (uid|exercise|areaLabel|timestamp.slice(0,16)) — otherwise `mergeAudits()` resurrects the resolved row on next render.

### 3d · Other live phases worth knowing
- **Shaker Bottle daily fuel** (Nutrition tab): `BBF_NUTRITION_TRACKER` IIFE. CSS-drawn bottle fills with gold → neon-green at 100%. localStorage key `bbf_nutrition_progress_<uid>` with `{date, checked[]}` — auto-resets at midnight.
- **Cloudflare Turnstile (invisible)** on storefront lead-capture forms. Secret in Supabase secret `TURNSTILE_SECRET_KEY`. Edge Function `bbf-lead-capture` 403s on `turnstile_failed`.
- **Vapi SMS Closer:** Edge Function `vapi-sms-closer`. Vapi Custom Tool webhook for the "Lance" agent — texts Stripe Payment Link via Twilio. Env vars `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, optional `VAPI_SHARED_SECRET` (X-Vapi-Secret header).
- **Phantom Eye (live AI):** WebSocket bridge `wss://buildbelievefit.onrender.com/ws/phantom-eye` to Gemini Multimodal Live (`gemini-2.5-flash-native-audio-latest`, BidiGenerateContent endpoint). Different surface than vision-coach REST.
- **Kinetic Hologram button** is now a smooth-scroll-to-Bio-Render anchor (V3 WebGL engine parked).
- **Trial gate:** `BBF_APPLY_TRIAL_GATE` walks `_BBF_TRIAL_SURFACES` = `[{pe-frame, pe-init-voice-btn}, {nv-frame, nv-init-chef-btn}]`. Trial-active = Sovereign UI override.

---

## 4 · DATABASE SCHEMA QUICK REFERENCE (Supabase)

| Table | Key columns |
|---|---|
| `bbf_users` | `id uuid PK`, `uid text` (e.g. `jacque_bbf`), `name`, `email`, `pin_hash` (bcrypt $2a$06), `role` (`trainer` / `client`), `subscription_tier`, `trial_expires_at`, `metabolic_tier`, `current_streak`, `last_login`, `access_status`, `cns_friction_score`, `biomechanical_redline`, `somatic_*` |
| `bbf_audit_logs` | `id uuid PK`, `user_id uuid` (FK → `bbf_users.id`), `session_id`, `movement_name`, `tension_zone`, `created_at`, **`resolved_at timestamptz NULL`** |
| `bbf_leads` | `source`, `email`, `full_name`, `phone`, `tier`, `payload jsonb` (turnstile_token stripped before insert) |
| `bbf_logs`, `bbf_sets`, `bbf_readiness`, `bbf_athlete_progression`, `bbf_athlete_load_logs` | All FK to `bbf_users.id` (uuid PK), NOT `uid` |
| `bbf_pin_attempts` | Login lockout state (3 strikes / 15 min) |
| `bbf_active_clients` | Maps `vault_email` → cloud-generated workout_plan / meal_plan markdown |

### Key RPCs
- `bbf_verify_user_pin(uid, pin_attempt)` — login
- `bbf_admin_set_tier(p_uid, p_tier)` — server-enforced allow-list (still includes legacy slugs)
- `bbf_admin_set_trial(p_uid, p_grant)` — trial toggle from Command Center
- `bbf_get_uid_map()` — bootstraps `{uid: id}` for slug→uuid resolution in `bbf-sync.js`
- `bbf_provision_client_pin(...)` — Phase 4 Step E `/provision` flow
- `bbf_sentinel(...)` — Sovereign Sentinel telemetry

---

## 5 · MCP TOOL REFERENCE

| Need | Tool |
|---|---|
| Read code | `Read`, `Bash` (grep), `Glob` |
| Edit code | `Edit` (preferred), `Write` (new files only) |
| Inspect / mutate Supabase | `mcp__3ff67aec-...__execute_sql`, `mcp__3ff67aec-...__apply_migration`, `mcp__3ff67aec-...__deploy_edge_function`, `mcp__3ff67aec-...__get_edge_function`, `mcp__3ff67aec-...__list_*`, `mcp__3ff67aec-...__get_logs`, `mcp__3ff67aec-...__get_advisors` |
| PRs / commits | `mcp__github__create_pull_request`, `mcp__github__merge_pull_request` (method `rebase`), `mcp__github__*` family |
| Run shell | `Bash` |

When dropdown / tool schemas aren't loaded, use `ToolSearch` with `query: "select:<tool1>,<tool2>"`.

---

## 6 · LATEST COMMIT HEAD (as of handoff)

```
c58054e fix(audit): Mark Resolved persists past reload + filter pending only
44e738e feat(entitlements): tier-based feature gate matching new flat-fee pricing
441ff2a feat(pricing): wire new flat-fee Stripe Payment Links
93184b0 feat(pricing): Architect Hybrid + Sovereign → flat-fee 12-Week Protocols
0839da5 feat(roster): hot-swap Suzanna -> Jacquelyn — 3-Day Postpartum Recomp
061490d feat(roster): Jacquelyn — coconut-free 1,652-cal postpartum meal plan
a947900 fix(nutrition): Feature 2 hotfix — WebRTC camera override
86239f4 feat(nutrition): Feature 2 — Vision AI Audio Scanner (Lance voice)
e684329 feat(nutrition): Feature 1 — Shaker Bottle daily-fuel progress
9d511c6 feat(security): Phase 6 — Cloudflare Turnstile (invisible) on lead capture
1ea51cf feat(vapi): vapi-sms-closer Edge Function — SMS Stripe link via Twilio
```

---

## 7 · IMMEDIATE NEXT OBJECTIVE · "One-Click Admin AI Nutrition Rotator"

**DO NOT WRITE CODE FOR THIS YET. AWAIT CEO DIRECTIVE.**

### Blueprint
An admin-only button rendered in the Nutrition tab that, on click, regenerates the active client's 7-day meal plan via Gemini and persists it to Supabase.

### Architecture sketch

| Layer | Work |
|---|---|
| **DOM (`bbf-app.html`)** | Add a "🔄 Rotate Nutrition" button inside the Nutrition tab header, visible only when the current user is admin. **Admin gating note:** there is no `CU.isAdmin`. Use `(d.u[CU] \|\| {}).role === 'trainer'` or `CU === 'akeem'`. The button operates on the *viewed* client (`uid = VC \|\| CU`). |
| **Client JS** | New module (suggest `BBF_NUTRITION_ROTATOR` IIFE near `BBF_VISION_COACH`). On click: gather `{ uid, tdee_target, macro_p/c/f, allergens, medical_notes (e.g. coconut), current_plan_summary }` from `MP[uid]` + `d.u[uid]`. POST to `/api/rotate-nutrition`. On response: overwrite `MP[uid]` in-memory, persist to Supabase (NEW path — see below), call `RN()` to repaint. Show pulse-state on button during fetch. |
| **Render route** | New `POST /api/rotate-nutrition` in `index.js`. Body `{ uid, profile: {...} }`. Calls `gemini-1.5-flash:generateContent` with `responseMimeType: "application/json"` + `responseSchema` describing the meal-plan shape (matches existing `MP[uid].days[].meals[].{m, i}` structure). CORS allowlist same as `/api/vision-coach`. Rate-limit per uid (suggest 2/day to keep costs bounded). |
| **Persistence** | **Currently no `nutrition_plan` column / table exists** on `bbf_users` or related tables — `MP` is hardcoded in `bbf-data.js`. The CEO's blueprint says "overwrite the client's `nutrition_plan` array in Supabase" — this requires a new migration. Options: (a) add `nutrition_plan jsonb` column to `bbf_users`; (b) new table `bbf_meal_plans(user_id, plan jsonb, generated_at, generated_by, model)`. Recommend (b) for history + auditability. |
| **Hot-reload** | `RN()` already supports a cloud-plan fallback path via `window._bbfPlans.meal_plan`. Reuse that read path: on successful rotate, set `window._bbfPlans.meal_plan = newPlan` and call `RN()`. Or simpler: directly write to `MP[uid]` and call `RN()`. |

### Hard constraints / gotchas
- **Coconut allergy for `jacque_bbf` must propagate to the prompt.** Build a `medical_constraints` string from `d.u[uid]` notes. The Gemini prompt must include something like `MEDICAL ALERT: STRICT coconut allergy. Olive or avocado oil only. NO coconut milk, flour, oil, shredded.`
- **`responseMimeType: "application/json"` requires a strict `responseSchema`** — define one matching `{ days: [{ day, meals: [{ m, i }] }] }` so Gemini returns parseable JSON, not free-form Markdown.
- **Cost guardrails.** Each call burns ~3-8k tokens. Per-uid rate limit + admin-only gate are non-negotiable.
- **Frontend has TWO copies of meal data** (in `bbf-data.js` line ~180 area AND `bbf-app.html` line ~7200 area). The persisted source-of-truth in Supabase should override both for any uid that has a cloud plan, via the existing `_bbfPlans.meal_plan` mechanism.
- **Reuse, don't rebuild.** The `/api/vision-coach` pattern (Gemini REST + CORS allowlist + rate limiter + JSON response) is the template. Mirror its structure.

### Suggested first-touch sequence (when CEO greenlights)
1. Run schema migration adding `bbf_meal_plans` table (id, user_id FK, plan jsonb, model text, generated_at, generated_by text).
2. Add `BBF_SYNC.saveMealPlan(uid, plan)` + `BBF_SYNC.fetchMealPlan(uid)` in `bbf-sync.js`.
3. Add `/api/rotate-nutrition` route in `index.js`.
4. Add `BBF_NUTRITION_ROTATOR` module + admin-only button in `RN()`.
5. Bump SW cache, commit, PR, rebase-merge.

---

## 8 · BEHAVIORAL DOCTRINE (CEO observed preferences)

- **Surface ambiguity in the directive before executing.** The CEO writes fast and sometimes references files that don't exist (e.g., "the Gemini fetch in `bbf-data.js`" — never existed). Verify with grep, then either (a) build the missing piece if it's clearly implied, or (b) flag and ask.
- **Reconnaissance grep before any edit.** The codebase has ~30k lines across 2 main HTML files; line numbers in directives are often stale.
- **Defensive defaults.** Tier-gate falls back to most-restrictive when unknown. Audit resolve treats `not_found` as success (parallel-tab safe). Vision coach speaks an audio fallback on every failure path (never breaks UX silently).
- **Idempotent everything.** Init functions guard with `dataset.bbfXxxWired === '1'`. Mutations check current state before applying. CSS classes are added/removed not toggled.
- **Bump SW cache on every frontend touch.** Easy to forget. Cloudflare + GitHub Pages edge will serve stale HTML otherwise.
- **CEO replies are often voice-transcribed.** Expect typos, conversational tone, occasionally misspelled IDs (`Susanna` vs actual `Suzanna`, `Jacquellyn` vs intended `Jacquelyn`). Verify against DB / grep before mass-renaming.
- **Speak in SITREP format.** Field/value table → what changed → what's flagged for follow-up. Concise.
- **One commit per logical phase.** No mega-commits mixing pricing + features + bugfixes.
- **Test creds for Jacquelyn:** `jacque_bbf` / `999388` — fine to use for smoke tests; recommend rotating after handoff if this doc is ever pasted publicly.

---

## 9 · STANDING REMINDERS

- Old monthly Stripe products (Architect $247, Sovereign $497) are **archived and dead (HTTP 403)** — verified.
- `TURNSTILE_SECRET_KEY` and Twilio creds live in Supabase secrets; `GEMINI_API_KEY` lives in Render env. Don't ask the CEO to re-paste them.
- Legacy tier slugs `lite` / `nutrition_essentials` / `nutrition_platinum` are still server-allow-listed for backward compat; don't grant new ones.
- Branch protection on `main` is enforced — every change goes through PR + rebase-merge.

End of handoff. Acknowledge and await the first directive — it will likely be the Nutrition Rotator blueprint above.

---

## 10 · PHASE 11 ADDENDUM · BBF_CNS_AGENT (CNS Intelligence Agent)

Layered ON TOP of the Phase 4-5 autoreg engine. Lives as an IIFE in
`bbf-app.html` just before `function RW()`. Pure deterministic math +
template bank, no Gemini, no schema change.

### Inputs (read at analyze-time)
| Source | Field | Notes |
|---|---|---|
| `d.u[uid].somatic_readiness_score` | CNS score 0-100 | Preferred input — set by Somatic Matrix submit (`_somSubmit` → `BBF_SYNC.calculateSomaticReadiness`). Falls back to `d.u[uid].daily_readiness[today()].score` from the Autonomic slider. |
| `d.u[uid].goal` | Goal taxonomy | Free text or chip value. Inferred via substring match → `recomp` / `hypertrophy` / `fat-loss` / `strength` / `longevity` / `performance`. Defaults to `recomp` for the original 5 (`ana_bbf, jacky_bbf, jacque_bbf, jordan_bbf, wayne_bbf`) via `seedDefaultGoalIfNeeded`. |
| `d.l[uid]` | Local log array | History modifiers: `sessions_last_7d`, `days_since_last`. RPE + plateau flags are v1.5. |

### Math (goal × zone prescription)
```
            recovery    baseline     overload
recomp      ×0.85       ×1.00        ×1.04
            sets -1     sets ±0      sets ±0
            reps 12-15  reps 10-12   reps 8-10
            rest 45s    rest 60s     rest 75s
```
Other goals alias to `recomp` for V1. To be differentiated row-by-row in v1.5.

Zone classifier matches the Phase 4 autoreg matrix: `<70` recovery, `70-84` baseline, `≥85` overload.

### History modifiers (post-zone, pre-prescription)
- `plateau_flag` → force `recovery` + narrative `plateau` (v1.5; flag currently always `false`)
- `avg_rpe_last_3 > 8.5` → force `recovery` + narrative `overreaching` (v1.5; field currently `null`)
- `days_since_last > 7` AND zone == `overload` → drop to `baseline` + narrative `returning_layoff`
- `sessions_last_7d ≥ 5` AND zone == `overload` → drop to `baseline` + narrative `hot_streak`

### Coaching template bank
Indexed by `zone + '_' + narrative`. Keys live: `recovery_default`, `recovery_plateau`, `recovery_overreaching`, `baseline_default`, `baseline_returning_layoff`, `baseline_hot_streak`, `overload_default`. `${name}` interpolated at render. Voice is calm-mentor — supportive, direct, patient.

### Output shape
```js
{
  cns_score, goal, zone, narrative,
  weight_mult, sets_delta, rep_band, rest_seconds,
  coaching_message, computed_at
}
```

### Persistence
`d.u[uid].cns_prescription` (full rx) + `d.u[uid].cns_prescription_at` (ISO). Cache valid until midnight local (compared via `today()`); `recompute(uid)` invalidates + re-runs. Every Somatic Matrix submit calls `BBF_CNS_AGENT.recompute(uid)` so the workout view picks up fresh values on next render.

### Surfaces
1. **RDW top banner** — `BBF_CNS_AGENT.ensure(uid)` then `renderAgentBannerHTML(rx)`. REPLACES `getReadinessBannerHTML(readyScore)` at the top of the workout day. Legacy function is kept as a fallback for the module-missing edge case.
2. **Per-exercise overlay** — appended below the existing Phase 4 autoreg banner via `renderExerciseOverlayHTML(rx, exReps)`. Skips cardio/timed exercises.
3. **Somatic submit hook** — `_somSubmit` in `bbf-app.html` calls `BBF_CNS_AGENT.recompute(uid)` after `calculateSomaticReadiness` resolves.

### Public API
```js
BBF_CNS_AGENT.analyze(uid)
BBF_CNS_AGENT.ensure(uid)       // cache-first wrapper
BBF_CNS_AGENT.persist(uid, rx)
BBF_CNS_AGENT.getCached(uid)
BBF_CNS_AGENT.invalidate(uid)
BBF_CNS_AGENT.recompute(uid)
BBF_CNS_AGENT.renderAgentBannerHTML(rx)
BBF_CNS_AGENT.renderExerciseOverlayHTML(rx, exReps)
BBF_CNS_AGENT.seedDefaultGoalIfNeeded(uid)
BBF_CNS_AGENT.classifyZone(cns)
BBF_CNS_AGENT.inferGoal(uid)
```

### Out of scope (V1.5 follow-ups)
- Differentiated goal rows (hypertrophy / fat-loss / strength / longevity / performance currently alias to recomp)
- Auto-apply the `sets_delta` to the actual set-input grid (currently descriptive only)
- Cloud-stored prescription history table for weekly coaching review
- Per-set RPE storage → enables `avg_rpe_last_3` overreaching detection
- Set-level history walk → enables `plateau_flag` detection
