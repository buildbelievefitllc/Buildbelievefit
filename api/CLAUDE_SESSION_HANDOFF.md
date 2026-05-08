# Claude Session Handoff — Build Believe Fit

**Last updated:** 2026-05-08 (post Phase 19b — Zapier + Formspree retirement; Stripe `Ghost Automation`, `Sentinel Alert`, and `Pathfinder Lead` zaps all migrated to native Supabase Edge Functions)
**Project:** Build Believe Fit (BBF) — PIN-auth fitness coaching app + Pathfinder pipeline + Vapi outbound voice + Live AI Coach (Phantom Eye + Virtual Coach via Gemini Multimodal Live)
**Founder:** Akeem Brown
**Phase:** Phases 14-19 all in production. Sovereign Trial is server-enforced (Phase 16 Iron Vault V2). Login hard-gate + admin Switchboard live (Phase 17). Stripe webhook native on Supabase Edge Functions (Phase 18) with `bbf_stripe_events` idempotency hardening (Phase 18.1). All Zaps killed except whatever CEO has running outside this session's scope. Three vendor subscriptions queued for cancellation: **Zapier** (downgraded to free, will lapse), **ConvertKit** (7-day sequence retired — Vapi sales_recovery cron handles abandoned-cart outreach), **Formspree** (lead-capture migrated to `bbf-lead-capture` Edge Function).

This doc orients a fresh Claude session. Read it first, then run the checklist in **§4 Immediate Claude tasks** before touching anything else.

---

## 1. Roles

- **Akeem** — CEO. Decides scope, reviews diffs, merges PRs. Sole human in the loop. Admin email: `buildbelievefitllc@buildbelievefit.fitness`.
- **Claude (you)** — Senior engineer & verifier. Uses Supabase MCP + GitHub MCP to introspect, apply migrations, deploy edge functions, open PRs, and verify drafts from other AI agents.
- **Big Jim (Gemini)** — Technical auditor (AI_DIRECTIVES §5). Validates against architecture/brand standards. Tonight Gemini's draft thread for Phase 18 went sideways (hallucination-prone, called CEO by a wrong name, generated 89-line code with 5+ schema mismatches). Lesson logged: when Gemini drifts, start a fresh thread and pre-flight every draft against live MCP state before deploy.
- **Antigravity (AG)** — Autonomous coder running locally. Drafts code on `ag/<topic>` branches. **Never** applies to production. **Never** modifies `api/supabase-schema-actual.sql`. Currently dormant — Phases 7-19 were Claude-direct except for AG security/cleanup PRs (#118 XSS sweep, #119 N+1 ghost sync patch, #120 unit tests).
- **Jules (Google)** — Security/cleanup/performance auditor. Operates on `ag/<topic>` branches, NEVER pushes main, NEVER applies migrations, NEVER modifies `api/supabase-schema-actual.sql`. Red-zone files Jules cannot touch without per-task CEO directive: auth/access surfaces, Phase 16/17/18/19 RPCs and migrations, `sw.js` cache constant, `.well-known/assetlinks.json`. Lane assignments documented in the keep-Jules-in-his-lane directive Akeem maintains.

## 2. Trust pattern (the loop)

1. Akeem (or Claude) writes a directive — bounded, with explicit deliverables and "what NOT to do".
2. Claude classifies via the **Tiered Autonomy** model in §6.2 — auto-execute, plan-then-greenlight, or halt-and-confirm.
3. For auto-execute work: investigate → execute → commit → push → PR → report.
4. For plan-then-greenlight work: investigate → present plan → wait for greenlight → execute → commit → push → PR → report.
5. Akeem reviews & merges PR.
6. Claude applies migrations / deploys edge functions via Supabase MCP (post-merge OR direct via MCP for time-sensitive work CEO greenlights).
7. Akeem smoke tests in production.

## 3. Current production state

**Closed-loop signup pipeline is LIVE (post-Zapier):**
Pathfinder questionnaire → `bbf-lead-capture` Edge Function (writes `bbf_leads` row + Brevo admin notification) → Stripe checkout → `stripe-webhook` Edge Function (verifies sig, claims idempotency row in `bbf_stripe_events`, ensures `bbf_active_clients`, calls `bbf_provision_client_pin` + `bbf_admin_set_tier`, fires Brevo welcome with credentials) → client logs into bbf-app.html → Phase 17 bouncer checks `subscription_tier` + `trial_expires_at` → polished UI renders cloud plans. Render `/process` continues to fire in parallel for Anthropic plan generation into `bbf_active_clients.workout_plan` + `meal_plan`.

**Vapi voice integration — Phases 1, 1.5, 2, 3, 1.6, 1.7, 5 all merged & verified live:**
- `bbf_vapi_calls` tracking table + RLS, with `use_case` column (`accountability` | `sales_recovery`).
- `bbf_evaluate_streaks()` + `bbf_evaluate_abandoned_carts()` + cron schedules @ `0 17 * * *` and `0 19 * * *`.
- `vapi-outbound-trigger` edge fn (v6+ ACTIVE, `verify_jwt:false`) — auth-gated via `X-BBF-Token`, routes `assistantId` by `use_case`. Apex Rex (sales_recovery) handles abandoned-cart outreach — **this is the replacement for the killed ConvertKit 7-day sequence.**

**Form Audit Data Routing (Phase 6) — LIVE.** `bbf_audit_logs` table; `BBF_SYNC.logAuditRequest()` / `fetchDamagedZones()` / `fetchPendingAudits()`.

**Slug → UUID bridge (PR #82) — LIVE.** 5 demo `bbf_users` rows (`ana_bbf` / `jacky_bbf` / `suzanna_bbf` / `jordan_bbf` / `wayne_bbf`). `bbf_get_uid_map()` SECURITY DEFINER RPC. `bbf-sync.js` resolver layer rewrites slug→UUID for all callsites.

**Sentinel UI Binding (Phase 7) — LIVE.** `BBF_SYNC.fetchDamagedZones(userId)` drives the Sovereign Sentinel SVG on Program tab.

**Pricing realignment + Youth Athlete tier (Phases A + B2 + B3) — LIVE.** Gateway $67, Youth Athlete $97, Architect $247, Sovereign $497, Nutrition Essentials $67, Nutrition Platinum $147. `BBF_STRIPE_BY_TIER` map has 6 live URLs; storefront `selectTier()` flow. `index.js` `/process` Phase 2 tri-forks on `tier` (`adult` / `youth_athlete` / `nutrition_only`).

**Phase 14 — Nutrition Tier System (PR #96 + post-merge `3d8c756`) — LIVE.** Nutrition Portal storefront, RBAC `nutrition_only` (app-layer Workouts-tab suppression), `bbf_meals.json` tri-cuisine NotebookLM data, dietary-intake liability shield in Pathfinder. **No new DB migrations** — application-layer only.

**Phase 15 — Live AI Coach + Wearable Sync + Friction Tracker + Android TWA (PRs #97-#107, #109-#113) — LIVE.** `/ws/phantom-eye` WebSocket bridge in `index.js` to Gemini Multimodal Live (`models/gemini-2.5-flash-native-audio-latest` on **v1alpha** BidiGenerateContent — locked, do not change without re-validating Slice 15). Bifurcated activation: **BBF Phantom Eye** (vision: video + audio) and **BBF Virtual Coach** (audio-only). 60s silence auto-terminate. Mobile fixes (`.pe-frame` drops aspect-ratio on ≤768px). Wearable Sync (`/api/wearable-sync/health-connect`). Friction Tracker on `#biomech-heatmap` (Slice 3). Manifest TWA-compliant. `.well-known/assetlinks.json` direct-pushed (`6275eb2`) — Android TWA in Play Console internal testing.

**Phase 16 — Iron Vault V2: Server-enforced Sovereign Trial (PR #116, merged `0e5ca60`) — LIVE.**
- Migration `20260506000000_iron_vault_v2`: drops Phase 8 cosmetic columns (`trial_status`, `trial_start_date`, RPC `bbf_set_trial_status`); adds `bbf_users.subscription_tier` + `trial_expires_at`; creates SECURITY DEFINER RPCs `bbf_start_trial(p_uid)`, `bbf_admin_set_trial(p_uid, p_grant)`, `bbf_get_trial_state(p_uid)`.
- Migration `20260506000001_iron_vault_v2_admin_backfill`: sets `subscription_tier='sovereign'` for `uid='akeem'` so the server-side ws-ticket gate doesn't lock CEO out.
- `bbf-ws-ticket.js` HMAC-SHA256 helper (mint + verify + replay-protect set, 60s TTL).
- `index.js` adds: `BBF_WS_TICKET_SECRET` env var, `POST /api/user/start-trial`, `POST /api/auth/ws-ticket`, ticket gate on `/ws/phantom-eye` upgrade handler.
- `bbf-app.html` 3-state frontend gate: `BBF_TRIAL_STATE()` returns `'null'|'active'|'expired'`; `BBF_APPLY_TRIAL_GATE()` swaps `iv-state-*` classes on `#pe-frame`; `BBF_APPLY_WEARABLES_COMING_SOON()` greyed badge; `BBF_START_TRIAL()` posts to `/api/user/start-trial`; `BBF_SHOW_PAYWALL_MODAL()` placeholder Stripe paywall. SW cache `bbf-v100 → bbf-v101`.
- `_lcStartStreaming` rewired to fetch ws-ticket before opening WebSocket.

**Phase 17 — The Bouncer & The Switchboard (PR #117, merged `3df8f91`) — LIVE.**
- Migration `20260507000000_phase17_bouncer_switchboard`: SECURITY DEFINER RPC `bbf_admin_set_tier(p_uid, p_tier)` with allowed-tier validation + **`akeem_locked_to_sovereign`** safety net (server raises if `uid='akeem' AND tier <> 'sovereign'`); grandfather backfill sets `subscription_tier='gateway'` for all NULL non-akeem users.
- `index.js` `/provision`: post-RPC follow-up call to `bbf_admin_set_tier` writes `subscription_tier` from `payload.tier` (defaults to `gateway`).
- `bbf-app.html` LOGIN bouncer: between PIN-verify and dashboard transition, calls `BBF_SYNC.fetchTrialState(uid)` and bounces `(NULL or 'lite') AND no active trial` users to a "Vault Access Denied" `<div class="scr" id="bouncer">` panel with two CTAs ([Upgrade to Gateway] → Stripe URL, [Unlock 7-Day Sovereign Trial] → `BBF_SYNC.startTrial`). Trial activation auto-resumes the dashboard transition (Mystery Box pattern). 409 `trial_already_consumed` collapses to upgrade-only.
- `bbf-sync.js` adds `adminSetTier(uid, tier)` wrapper + extended `fetchUserProfile` select.
- `mastermind-portal.html` per-row tier dropdown (all 7 tiers; akeem disabled with hover tooltip + server-enforced lock); `BBF_PORTAL.{toggleTrial, setTier}` attached. **Latent regression fix shipped:** `BBF_PORTAL.toggleTrial` was referenced from rendered HTML since Phase 8 but never attached to the IIFE — Sovereign Trial toggle has been silently broken since 2026-05-01 and now works for the first time.
- SW cache `bbf-v101 → bbf-v102`.

**Phase 17 hotfix — Virtual Coach button gate (commit `4570bd5`, direct-push to main) — LIVE.**
`#pe-init-voice-btn` was outside `.pe-frame` (Phase 15 Slice 9 split it into a standalone block) and missed the Phase 16 frontend gate. Fix: extend `BBF_APPLY_TRIAL_GATE()` to also gate the standalone Virtual Coach button. Button-shaped lockdown classes (`.iv-vc-state-null` / `.iv-vc-state-expired`) keep pointer-events:auto and intercept clicks at the DOM layer, routing to `BBF_START_TRIAL()` or `BBF_SHOW_PAYWALL_MODAL()` instead of the silent-failing `initLiveCoach('voice')`. SW cache `bbf-v102 → bbf-v103`.

**Phase 18 — `stripe-webhook` Edge Function: Zapier "Ghost Automation" replacement (PR #121, merged `9ac6ea6`) — LIVE.**
- New Edge Function `supabase/functions/stripe-webhook/index.ts` (~349 lines): verify Stripe sig (HMAC over raw bytes) → filter to `checkout.session.completed` → resolve tier from `session.metadata.tier` (primary) | `session.client_reference_id` (storefront fallback) | `'gateway'` default with HIGH-PRIORITY warning → ensure `bbf_active_clients` row → `bbf_provision_client_pin` → `bbf_admin_set_tier` → Brevo SMTP email with PIN + username. **Self-provisioning** (CEO ruling Option II): kills the race condition with Render `/process`.
- Storefront `index.html`: appends `?client_reference_id=<slug>` to Stripe Payment Link redirects (defense-in-depth fallback for tier resolution if Stripe dashboard metadata is missing).
- Stripe dashboard config: every Payment Link has `tier: <slug>` metadata set per CEO's manual setup (gateway / youth_athlete / architect / sovereign / nutrition_essentials / nutrition_platinum).
- Required Supabase Function Secrets: `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL` (verified: `buildbelievefitllc@buildbelievefit.fitness`).
- Akeem-side: Zapier endpoint replaced. Webhook is in LIVE mode subscribed to `checkout.session.completed`. Verified end-to-end with $1 promo-code Stripe Resend on `keembsr93@gmail.com` (test row cleaned up post-smoke).

**Phase 18 i18n hotfix (commit `d26b235`, direct-push to main) — LIVE.**
Phase A pricing repriced `index.html` static HTML in 2026-05-05, but missed the parallel `bbf-lang.js` translation table. The translator script reads `data-lang-key` attributes and overwrites HTML with i18n values on every page render — so the new $67/$247/$497 prices were silently being replaced by the OLD `$147 / $497 / $1,500` strings on every load. Stale on prod for ~9 days; surfaced during Phase 18 pre-smoke visual inspection. Fix: 4-line update to `bbf-lang.js` (`prog-t1-price`, `prog-t2-price`, `prog-t3-price`, `prog-section-sub`) across en/es/pt.

**Phase 18.1 idempotency hardening (Stripe webhook v9, MCP-applied + dashboard-pasted) — LIVE.**
- New table `bbf_stripe_events(event_id PRIMARY KEY, event_type, session_id, email, tier, username, received_at)` — applied via Supabase MCP, **no .sql file in `supabase/migrations/`** (schema-actual divergence flagged in §4).
- Stripe webhook function v9: at top of `checkout.session.completed` branch, INSERT into `bbf_stripe_events` with PK conflict detection. On `'23505'` (Postgres unique violation = retry of an already-processed event), return `{ok:true, replay:true}` and exit before any provision/tier/email side effects. Backfills `username` on the row after provision succeeds for audit trail.
- Closes the v1 risk where Stripe retries would re-send Brevo email AND silently rotate the customer's PIN via `bbf_provision_client_pin` INSERT.

**Phase 19a — `bbf-sentinel` rewired to Brevo (Edge Function v4, MCP-deployed) — LIVE.**
- The pre-existing `bbf-sentinel` Edge Function (Sentinel Protocol, daily roster ACWR + micro-recovery audit) was POSTing red-zone alerts to a Zapier webhook → Zap → CEO email.
- Surgical edit: removed `ZAPIER_WEBHOOK_URL` references; replaced webhook POST with Brevo SMTP API POST. New env vars: `SENTINEL_ALERT_TO_EMAIL` (default `buildbelievefitllc@buildbelievefit.fitness`). Subject: `[BBF Sentinel] N athlete(s) in RED zone`. HTML body: red/yellow/green/dormant counts + per-athlete blocks (name, sport, ACWR, alerts).
- Audit math, cron auth (`x-cron-secret`), `_shared/intel-core.ts` kernel — UNTOUCHED.
- Empty-red-zone silent path preserved.
- Sentinel Alert Zapier zap can be disabled.

**Phase 19b — `bbf-lead-capture` Edge Function: Pathfinder + Lite + Formspree retirement (Edge Function v1 + storefront direct-push `67ce616`) — LIVE.**
- New table `bbf_leads(id, source, email, full_name, phone, tier, payload jsonb, created_at)` — applied via Supabase MCP, **no .sql file in `supabase/migrations/`** (schema-actual divergence flagged in §4).
- New Edge Function `supabase/functions/bbf-lead-capture/index.ts` (v1, MCP-deployed): origin allowlist (`buildbelievefit.fitness` + GH Pages preview), per-IP rate limit (5/min), writes lead to `bbf_leads`, fires Brevo admin notification email, **for `source='nutrition_lite'` also fires Brevo welcome email to lead with TDEE + macros**.
- Storefront `index.html` direct-push `67ce616`: stripped both `hooks.zapier.com/hooks/catch/27190846/u7l7ixc/` POSTs (Pathfinder + Lite) and the `formspree.io/f/mwvwjokw` POST. Replaced Pathfinder's redirect-gating Formspree fetch with a `bbf-lead-capture` fetch (preserving the `.then()` chain so Stripe redirect still fires on success). Replaced Lite's fire-and-forget Zapier with `bbf-lead-capture`.
- Render `/process` Anthropic plan generation call: UNTOUCHED. Closed-loop pipeline intact.
- Three vendors retired: Zapier (zaps killed), ConvertKit (7-day sequence retired — Vapi sales_recovery handles abandoned-cart), Formspree (replaced by Brevo admin notification).

**Migrations applied to project `ihclbceghxpuawymlvgi`:**

| File on disk in `supabase/migrations/` | Phase |
|---|---|
| `20260502020500_form_audit_routing.sql` | Phase 6 |
| `20260502030000_seed_demo_users.sql` | slug bridge |
| `20260502040000_sovereign_trial_columns.sql` | Phase 8 (now superseded by Iron Vault V2) |
| `20260502050000_admin_dashboard_stats_rpc.sql` | Phase 9 |
| `20260506000000_iron_vault_v2.sql` | Phase 16 Slice A |
| `20260506000001_iron_vault_v2_admin_backfill.sql` | Phase 16 admin backfill |
| `20260507000000_phase17_bouncer_switchboard.sql` | Phase 17 |

**MCP-applied migrations with NO file in repo (schema-actual divergence):**
- `bbf_stripe_events_idempotency` (Phase 18.1) — table only, no RPC
- `bbf_leads_table` (Phase 19b) — table only, no RPC

**SECURITY DEFINER RPC inventory (admin trust surface):**
- `bbf_verify_admin_pin(pin_attempt)` — admin PIN check
- `bbf_get_uid_map()` — slug ↔ UUID directory
- `bbf_get_admin_dashboard_stats()` — Mastermind Portal counts
- `bbf_start_trial(p_uid)` — user-initiated 7-day mystery box (Iron Vault V2)
- `bbf_admin_set_trial(p_uid, p_grant)` — admin trial override (replaces dropped `bbf_set_trial_status`)
- `bbf_get_trial_state(p_uid)` — read path for Q4 fresh-fetch on login + tab focus
- `bbf_admin_set_tier(p_uid, p_tier)` — Switchboard tier assignment with `akeem_locked_to_sovereign` safety net
- `bbf_provision_client_pin(p_vault_email, p_pin, p_full_name)` — PIN provisioning (gated on pre-existing `bbf_active_clients` row by `vault_email`)

**Edge Functions deployed (live on `ihclbceghxpuawymlvgi`):**

| Slug | Version | verify_jwt | Purpose |
|---|---|---|---|
| `vapi-outbound-trigger` | v6+ | false | Outbound Vapi calls — accountability + sales_recovery (Apex Rex). Auth: `X-BBF-Token`. |
| `bbf-sentinel` | v4 | false | Daily ACWR + micro-recovery roster audit. Auth: `x-cron-secret`. Brevo-routed (Phase 19a). |
| `stripe-webhook` | v9 | false | Stripe `checkout.session.completed` handler with idempotency (Phase 18 + 18.1). Auth: Stripe signature. |
| `bbf-lead-capture` | v1 | false | Pathfinder + Lite form lead capture (Phase 19b). Auth: origin allowlist + rate limit. |

**Configuration state:**
- `pg_cron` extension: ENABLED.
- Edge Function Secrets (verified live): `BBF_VAPI_INVOKE_TOKEN`, `VAPI_API_KEY`, `VAPI_ASSISTANT_ID` (Rex), `VAPI_SALES_ASSISTANT_ID` (Pathfinder closer), `VAPI_PHONE_NUMBER_ID`, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `BREVO_API_KEY`, `BREVO_FROM_EMAIL` (`buildbelievefitllc@buildbelievefit.fitness` — verified Brevo sender), `BBF_WS_TICKET_SECRET`, `CRON_SECRET`.
- Render env: `GEMINI_API_KEY` (for `/ws/phantom-eye`), `BBF_PROVISION_TOKEN` (for `/provision` auth).
- **SW cache: `bbf-v103`** (Phase 17 Virtual Coach hotfix).
- Stripe webhook endpoint: `https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/stripe-webhook`, LIVE mode, subscribed to `checkout.session.completed`.

## 4. Immediate Claude tasks

All Phase 14-19 work is shipped. Real production state above.

- [x] Phase 14 (Nutrition Tier System), Phase 15 (Live AI Coach), Phase 16 (Iron Vault V2), Phase 17 (Bouncer + Switchboard), Phase 18 (Stripe webhook), Phase 18.1 (idempotency), Phase 19a (Sentinel → Brevo), Phase 19b (lead-capture)
- [ ] **Akeem todo:** disable the Zapier zaps (Sentinel Alert + Pathfinder Lead + Ghost Automation if still active). Cancel ConvertKit subscription. Let Formspree subscription lapse.
- [ ] **Akeem todo (paperwork):** start the Meta Business app review for `instagram_content_publish` permission if pursuing Phase 3 (DB → IG auto-pilot). Multi-week timeline.
- [ ] **Schema-actual.sql re-introspection** — DEFERRED, dedicated session, disk-only-write protocol per §11 Rule #7. Now SIGNIFICANTLY behind: Phase 16 columns + 3 RPCs, Phase 17 RPC + grandfather backfill, **Phase 18.1 `bbf_stripe_events` table (no .sql file in repo)**, **Phase 19b `bbf_leads` table (no .sql file in repo)**. The two MCP-applied-without-file migrations are particular technical debt — when schema-actual is re-introspected, also backfill `.sql` migration files for those two tables so future fresh-environment provisioning has them.
- [ ] **Stale `claude/*` branches** to clean up: `claude/build-believe-fit-dev-dcQw6`, `claude/phase-14-nutrition-tiers-U1nUv`, `claude/phase-16-iron-vault-v2` (merged via #116), `claude/phase-16-sovereign-trial-directive`, `claude/phase-17-bouncer-switchboard` (merged via #117), `claude/phase-18-stripe-webhook-edge-fn` (merged via #121), `claude/phase-18-stripe-fn-self-provision`, `claude/phase18-hotfix-i18n-prices`, `claude/phase6-handoff-live`, `claude/init-bbf-frontend-413uy`, `claude/global-claude-md-directive`, `v3-engine-swap-parked`. Merge-and-prune pass when CEO has time.
- [ ] **Diagnostic console.log cleanup** in `bbf-sync.js fetchAdminDashboardStats` and `stripe-webhook` once production telemetry confirms steady-state.

## 5. Active backlog

- **Phase 3 — DB → Instagram autopilot (paperwork-blocked).** Build a `social posts` table + `ig-autopilot` Edge Function triggered by Supabase Database Webhook. Requires Meta Business app + IG Business + `instagram_content_publish` permission (Meta app review = days-to-weeks). Image hosting needs publicly-reachable URLs (Supabase Storage public bucket OR signed URLs). Long-lived access token chain (60-day refresh strategy). Akeem starts paperwork; Claude codes in parallel.
- **Phase 18 follow-ups:**
  - Real Stripe paywall wiring (currently `BBF_SHOW_PAYWALL_MODAL()` is a placeholder routing to `BBF_STRIPE_BY_TIER.sovereign`).
  - Branded Brevo HTML template for the welcome email (current is minimal placeholder with PIN + username + tier).
  - PIN re-verification on `/api/user/start-trial` and `/api/auth/ws-ticket` (Slice B+1 hardening — currently both accept `{uid}` without auth, contained by rate-limit + one-trial-lock + ticket TTL).
- **Phase B4 (deferred)** — dedicated `sport` field on the youth-tier intake form.
- **Parental-consent liability copy** for under-18 youth intake.
- **Phase 14 follow-ups** — persist `nutrition_only` role in DB (currently inferred client-side); admin override path for tier flips (now possible via Switchboard).
- **`admin.html` access_status toggles** — same backend-disconnect problem `mastermind-portal.html` had pre-Phase-9.
- **`syncUser` rewrite** — `bbf-sync.js:130` writes `id: uid` (slug into uuid column) and includes fields not in schema.
- **Trainer-view name join** — `fetchPendingAudits` surfaces `user_id` UUID as display name; needs join.
- **Vapi Phase 4 (callback receiver)** — Vapi POSTs call status / transcript back; needs edge fn `vapi-callback` + columns on `bbf_vapi_calls`.
- **Render Vault Engine V9 cleanup** — see `api/AG_INTEGRATION_NOTES.md` P3 backlog.
- **Phase 9b diagnostic console.log cleanup** in `fetchAdminDashboardStats`.
- **`bbf_leads` follow-up:** drift-aware schema audit. The Phase 19b table has no migrations file. Future RLS hardening pass should also add policies (currently only service_role grants).

## 6. Workflow rules

### 6.1 Non-negotiable safeguards (integrity)

- **Nothing is version 2.** No `_v2`, `bbf_v2`, `*_new`, `*_2026` suffixes. Update existing code in place.
- **PIN auth (Option A) is the path.** Do not introduce Supabase Auth.
- **AG / Jules never modify** `api/supabase-schema-actual.sql`. Claude regenerates via introspection.
- **AG / Jules never apply** migrations or deploy edge functions. Claude does via MCP.
- **Service Worker:** when shipping changes to `bbf-app.html`, bump the `BBF_CACHE` version constant (currently `bbf-v103`).
- **No direct push to `main`.** Always PR. Akeem merges. **Per-task exceptions** authorized for hotfixes have included: `266ad2d` Phase B3, `6275eb2` assetlinks, `4570bd5` Virtual Coach gate, `d26b235` i18n prices, `67ce616` Phase 19b storefront. These are exceptions, not workflow changes.
- **Live Coach Gemini stack is locked** at `models/gemini-2.5-flash-native-audio-latest` on **v1alpha** BidiGenerateContent. Do not change without re-validating Slice 15.
- **`comlink-engine.js` + Mastermind Portal Comlink Dispatch panel are admin tooling — out of scope for client-surface purges.**
- **`akeem` uid is locked to `subscription_tier='sovereign'`** at the database layer (`bbf_admin_set_tier` raises `akeem_locked_to_sovereign` for any non-sovereign tier on uid='akeem'). Do not bypass.

### 6.2 Tiered Autonomy Model — when Claude pauses for greenlight

#### Tier 1 — Auto-execute (no plan presentation, no greenlight pause)
- UI/UX changes to existing surfaces, dead code deletion (grep-verified), cache bumps, comment cleanups, behavior-preserving refactors, defensive guards / try-catch hardening, doc updates, new helper functions in existing modules, tier label / copy / styling tweaks, PR creation, branch creation, commits to `claude/*` branches.

#### Tier 2 — Plan-then-greenlight
- Database migrations (DDL, RLS, new RPCs, schema changes) — including all Phase 16/17/18 work.
- New edge functions or cron schedules — including Phase 18/19 functions.
- New tables or columns on existing tables.
- Production secrets / Vault / Edge Function Secrets.
- Deletion of currently-active functionality (verified live, not dead code).
- Architectural pivots (auth model, sync layer, plan-resolution path, data routing).
- Cross-system changes (Render, Vapi, Stripe, Brevo, Gemini, ConvertKit, Formspree wiring).
- Anything Claude flags as "I'm not certain about scope" — uncertainty itself is a signal to pause.

#### Tier 3 — Halt-and-confirm (always pause before AND after)
- `DROP`, `DELETE` without `WHERE`, `TRUNCATE`.
- Force-push, branch deletions, history rewrites.
- Changes to live cron schedules or active edge functions.
- **Direct pushes to `main`** — only with per-task CEO authorization.
- Anything that could destroy data, lose work, or disrupt the production deploy.

### 6.3 PR & branch hygiene
- Branch naming: `claude/<phase-or-topic>-<short-slug>`.
- Always branch off `origin/main` for fresh work.
- Commit messages: `feat(scope): one-line summary` / `fix(scope): one-line summary` / `chore(scope): ...`.
- PR body: summary + files-changed table + risk + test plan checklist + out-of-scope.

## 7. Key files (source of truth)

| File | Purpose |
|---|---|
| `api/AG_INTEGRATION_NOTES.md` | AG orientation doc — read for AG context & P3 backlog |
| `api/VAPI_DESIGN.md` | Vapi architecture; §7 = operational setup |
| `api/PHASE_4_LIVE_CONFIG.md` | Render/Brevo config reference |
| `api/PHASE_6_FORM_AUDIT_PLAN.md` | Form Audit data routing plan |
| `api/PHASE_16_SOVEREIGN_TRIAL_DIRECTIVE.md` (on `claude/phase-16-sovereign-trial-directive` branch only) | Phase 16 architecture spec + 6-question Q-list (now resolved) |
| `api/supabase-schema-actual.sql` | Production schema (re-introspect — significantly behind; see §4) |
| `bbf-app.html` | Frontend — PIN login, LP() plan resolution, polished UI. `BBF_IS_ADMIN()` at top of auth engine (Phase 8). Workouts tab hosts Live Coach (Phantom Eye + Virtual Coach, Phase 15). Workouts tab suppressed for `nutrition_only` role (Phase 14). Sovereign Coach toggle has Phase 16 Iron Vault hard-lock. LOGIN bouncer at PIN-verify (Phase 17) bounces NULL/lite users to `<div class="scr" id="bouncer">` panel. Phase 17 hotfix gates `#pe-init-voice-btn` outside .pe-frame. SW cache bbf-v103. |
| `bbf-sync.js` | Cloud sync layer; `_supa()` raw HTTP + public `supa()` wrapper with slug→UUID resolver. RPC wrappers: `fetchAdminDashboardStats`, `adminSetTier` (Phase 17), `adminSetTrial` / `fetchTrialState` / `startTrial` / `fetchWsTicket` (Phase 16). |
| `bbf-ws-ticket.js` | Phase 16 HMAC-SHA256 mint/verify helper (60s TTL, replay-protect set). Constant-time signature compare. |
| `auditor-engine.js` / `prehab-auditor.js` | Form Audit + Pre-Hab modals. Phase 6 routing. Use `VC \|\| CU` admin view-as. |
| `fueling-engine.js` | Bioenergetic dashboard block. |
| `mastermind-portal.html` | Admin Command Center; stats from `BBF_SYNC.fetchAdminDashboardStats`. Sovereign Trial toggle (Phase 8 + Phase 16 RPC swap) + Switchboard tier dropdown (Phase 17, all 7 tiers, akeem disabled). `BBF_PORTAL.{toggleTrial, setTier}` attached at runtime (Phase 17 latent regression fix). Comlink Dispatch panel intact (admin tooling). |
| `portal-engine.js` | Mastermind portal IIFE module. |
| `comlink-engine.js` | Phantom Comlink (async video) — admin tooling, NOT client-facing (Phase 15 Slice 9 purged client surface). |
| `sw.js` | Service Worker; bump `CACHE` constant on every client-side change (currently `bbf-v103`). |
| `manifest.json` | PWA manifest — TWA/PWABuilder compliant (Phase 15 Slices 17/18). |
| `.well-known/assetlinks.json` | Android Digital Asset Links — package `fitness.buildbelievefit.twa`. |
| `bbf_meals.json` | Phase 14 NotebookLM-sourced tri-cuisine recipes. |
| `index.html` | Storefront. `BBF_STRIPE_BY_TIER` 6-tier map; `selectTier()` + `doSubmit()` flow. `doSubmit()` POSTs to Render `/process` + `bbf-lead-capture` Edge Function (Phase 19b — replaced Zapier + Formspree). `submitLiteLeadCapture()` POSTs to `bbf-lead-capture`. Stripe Payment Link redirect appends `?client_reference_id=<slug>`. |
| `bbf-lang.js` | i18n translation table. **DANGER:** every `data-lang-key` attribute on the storefront is overridden by the value here. Phase A repriced HTML in 2026-05-05 but missed this file — caused 9-day silent regression fixed in Phase 18 i18n hotfix `d26b235`. When changing prices or copy in `index.html`, mirror in `bbf-lang.js` for en/es/pt. |
| `index.js` | Render Vault Engine V9 — `/process` + `/provision` endpoints. `/process` Phase 2 tri-forks on `payload.tier` (`adult` → `youth_athlete` → `nutrition_only`). `/provision` calls `bbf_admin_set_tier` post-RPC to write `subscription_tier` (Phase 17). Hosts WebSocket proxy `/ws/phantom-eye` (Phase 15 Slice 5). Phase 16 routes `/api/user/start-trial` + `/api/auth/ws-ticket` + ticket gate on WS upgrade. |
| `supabase/functions/vapi-outbound-trigger/index.ts` | Vapi trigger edge fn (auth-gated `X-BBF-Token`). |
| `supabase/functions/bbf-sentinel/index.ts` | Daily ACWR roster audit, Brevo-routed (Phase 19a). |
| `supabase/functions/stripe-webhook/index.ts` | Phase 18 + 18.1 — Stripe webhook with idempotency. |
| `supabase/functions/bbf-lead-capture/index.ts` | Phase 19b — Pathfinder + Lite form lead capture. |
| `supabase/functions/_shared/intel-core.ts` | Deno-flavored audit kernel (ACWR, micro-recovery). Mirrors `bbf-intelligence-engine.js`. **Lockstep:** any change here lands in both files. |
| `supabase/migrations/` | All DB migrations with .sql files in repo. Phase 18.1 + Phase 19b tables NOT in this directory yet. |

## 8. Smoke tests

### Stripe webhook (Phase 18 + 18.1)
1. Real or test purchase → `bbf_users` count increments → row has `email`, `subscription_tier`, `pin_hash`, `role='client'`. Brevo email arrives.
2. Stripe CLI replay of same `event_id` → function returns `{ok:true, replay:true}` → no DB change, no email sent.

### Vapi outbound (existing)
1. Pick a test row in `bbf_active_clients` with `client_phone` set; ensure no `bbf_vapi_calls` entry in last 7 days for that email.
2. `SELECT public.bbf_evaluate_streaks();` → `bbf_vapi_calls` row appears with `call_status='initiated'`.
3. Negative auth: `curl -X POST` without `X-BBF-Token` → 401.

### Bouncer + Switchboard (Phase 17)
1. Login as `akeem` → bypass bouncer, dashboard loads.
2. Switchboard flip `wayne_bbf` → `lite`. Logout. Login as wayne → bouncer fires.
3. Click [Unlock 7-Day Sovereign Trial] → `bbf_start_trial` RPC fires → trial_expires_at set → ENTER() resumes dashboard transition.
4. Manually expire trial in DB → relogin → bouncer shows "trial already used" with upgrade-only CTA.
5. Switchboard attempt to flip akeem to `lite` (via dev tools to bypass disabled select) → server returns `akeem_locked_to_sovereign`.

### Sentinel alert (Phase 19a)
1. Insert synthetic high-load row in `bbf_athlete_load_logs` for a demo athlete (load_au will compute from `duration_minutes × srpe_intensity`).
2. `curl -X POST .../functions/v1/bbf-sentinel -H "x-cron-secret: <secret>"` → red zone fires → Brevo email arrives at `buildbelievefitllc@buildbelievefit.fitness`.
3. Cleanup synthetic row.

### Lead capture (Phase 19b)
1. Submit Pathfinder form on storefront → `bbf_leads` row appears with `source='pathfinder'` → admin Brevo email arrives → Stripe redirect fires (gated on lead-capture success).
2. Submit Nutrition Lite modal → `bbf_leads` row with `source='nutrition_lite'` → admin email + welcome email with TDEE/macros to lead.

## 9. Recent merged PRs + direct-push commits (reverse chronological)

- **`67ce616` (direct push to main)** (2026-05-08) Phase 19b storefront — strip Zapier + Formspree from `doSubmit` and `submitLiteLeadCapture`; replace with `bbf-lead-capture` Edge Function fetch. Stripe redirect chain preserved.
- **`d26b235` (direct push to main)** (2026-05-08) Phase A i18n hotfix — `bbf-lang.js` price keys synced to current Stripe reality (`prog-t1-price` $147→$67, `prog-t2-price` $497→$247, `prog-t3-price` $1,500→$497, `prog-section-sub` copy). Closes 9-day silent regression where translator overrode HTML prices.
- **#121** (2026-05-07) Phase 18 — `stripe-webhook` Edge Function. New `supabase/functions/stripe-webhook/index.ts`; storefront `?client_reference_id=` injection; nutrition tier Stripe URLs wired live.
- **#120** (AG, 2026-05-07) Unit tests for `t()`, `getTournamentMeals`, `auditVolume`.
- **#119** (AG, 2026-05-07) Fix N+1 query loop in `runGhostProtocolScan`.
- **#118** (AG, 2026-05-07) Fix innerHTML XSS vulnerabilities (global sweep).
- **`4570bd5` (direct push to main)** (2026-05-07) Phase 17 hotfix — gate `#pe-init-voice-btn` outside `.pe-frame`. Closes silent-failure path on Virtual Coach button. SW `bbf-v102 → bbf-v103`.
- **#117** (2026-05-07) Phase 17 — The Bouncer + The Switchboard. Migration, login hard-gate, admin tier override, `akeem_locked_to_sovereign` safety net, latent `BBF_PORTAL.toggleTrial` regression fix.
- **#116** (2026-05-07) Phase 16 — Iron Vault V2 (Slice A migration + Slice B backend + Slice C frontend in three commits).
- **`6275eb2` (direct push to main)** (2026-05-06) `.well-known/assetlinks.json` Android Digital Asset Links handshake.
- **#113** (2026-05-06) Phase 15 Slice 18 — PWABuilder strict storefront compliance.
- **#112** (2026-05-06) Phase 15 Slice 17 — `manifest.json` TWA / PWABuilder compliance.
- **#111** (2026-05-06) Phase 15 Slice 16 — mobile frame + video render.
- **#110** (2026-05-06) Phase 15 Slice 15 — stable engine swap (2.5 native-audio · v1alpha).
- **#109** (2026-05-06) Phase 15 Slice 14 — Gemini Live endpoint upgrade v1alpha → v1beta (later reverted in Slice 15).
- **#107** (2026-05-06) Phase 15 Slice 12 — Gemini Live model upgrade.
- **#106** (2026-05-06) Phase 15 Slice 11 — model revert.
- **#105** (2026-05-06) Phase 15 Slice 10 — Live Coach repair + verbose proxy diagnostics.
- **#104** (2026-05-06) Phase 15 Slice 9 — Phantom Comlink client purge + full-width Live Coach CTAs.
- **#103** (2026-05-06) Phase 15 Slice 8 — Gemini Live model upgrade + mobile viewport guard.
- **#102** (2026-05-06) Phase 15 Slice 7 — auto-terminate idle kill switch (60s).
- **#101** (2026-05-06) Phase 15 Slice 6 — bifurcated Live Coach (Phantom Eye + Virtual Coach).
- **#100** (2026-05-06) Phase 15 Slice 5 — `/ws/phantom-eye` WebSocket bridge.
- **#99** (2026-05-06) Phase 15 Slice 4 — Wearable API Bridge.
- **#98** (2026-05-06) Phase 15 Slices 2 + 3 — Titan vision pipeline + Friction Tracker on BHM.
- **#97** (2026-05-06) Phase 15 Slices 1A/1B/1C — Masterclass purge → Phantom Eye repurposed → camera modal + getUserMedia.
- **#96** (2026-05-05) Phase 14 — Nutrition Tier System (Slices 1+3, 2, 5) + post-merge `3d8c756` Pathfinder dietary intake.
- **`266ad2d` (direct push to main)** (2026-05-05) Phase B3 — Youth Athlete tier UI card on storefront.
- **#95** (2026-05-05) Phase B2 — Youth Athlete tier backend fork + clinical Anthropic prompts.
- **#94** (2026-05-05) Phase A — Pricing realignment.
- **#90** (2026-05-01) Phase 10 — UI pruning.
- **#89** (2026-05-01) Phase 9b — defensive normalizer.
- **#88** (2026-05-01) Phase 9 — admin dashboard stats + somatic tiers.
- **#87** (2026-05-01) Phase 8b — Vault Masterclass stacked.
- **#86** (2026-05-01) Phase 8 — admin bypass + live trial toggles (cosmetic; replaced by Iron Vault V2 in Phase 16).
- **#85** (2026-05-01) Phase 7 — Sentinel UI binding.

**Phase 18.1 + Phase 19a + Phase 19b: Edge Functions deployed via Supabase MCP, NOT through PRs.** Source code lives in `supabase/functions/{stripe-webhook,bbf-sentinel,bbf-lead-capture}/index.ts`. The deployed function source can be re-pulled at any time via `mcp__3ff67aec...__get_edge_function`.

## 10. Fresh-session kickoff prompt

Paste into a new Claude session as the opening message:

> You are continuing work on Build Believe Fit (PIN-auth fitness app + Pathfinder + Vapi + Live AI Coach + Iron Vault V2 trial gate + Bouncer/Switchboard + native Stripe webhook). **Read `api/CLAUDE_SESSION_HANDOFF.md` first — especially §6.2 (Tiered Autonomy) and §11 (context discipline, Rule #7 disk writes).** Production state, RPC inventory, migrations applied, SW cache (`bbf-v103`), and merged PR log are in §3 / §9. Edge Functions inventory in §3. After reading, run `git fetch origin --prune` and `git log origin/main --oneline -25`. Report: (a) where main is, (b) any new PRs since last cold-start, (c) standing by for the directive. Then stand by.

## 11. Context discipline (timeout prevention)

Tonight shipped 8 phases without a single timeout despite multiple Gemini-induced detours, MCP deploy flakiness, and a $1 live-fire smoke test. Future sessions follow the same habits:

1. **MCP > file reads.** Query prod with `execute_sql` before reading files when checking state.
2. **Batch parallel.** Independent tool calls in ONE message; never sequential without a real dependency.
3. **Read with offset/limit.** Don't read a 2000-line file for 150 lines.
4. **Don't echo your own writes.** Reference SQL/code you just produced by name.
5. **Status updates: ONE sentence.** "Migration 1/3 applied" — done.
6. **No "let me think" preambles.** Do the thing, then state the result.
7. **Big writes → disk, not chat.** Schema regens, bulk rewrites, multi-section docs: Write → commit → push → one-line confirm with sha. Never paste 1000+ lines into the conversation **except** when MCP deploy fails and the only path is dashboard-paste — that's a documented escape valve.
8. **Delegate to AG / Jules for non-trivial security or cleanup edits.** Both are scoped to `ag/<topic>` branches and out of red-zone files (auth/access path, Phase 16/17/18/19 RPCs and migrations, sw.js cache, `.well-known/assetlinks.json`).
9. **PR bodies = durable record.** Test plans, gotchas, verification checklists live in PR descriptions.
10. **Checkpoint to this doc proactively.** Phase wrap OR heavy context → update §3 / §4 / §9 + commit + push.
11. **End the turn early.** Question answered → stop. One next-step or "standing by" is enough.
12. **When MCP `deploy_edge_function` errors with `InternalServerErrorException`, fall back to dashboard-paste route** — print the function code in chat as a single clean ASCII code block (no box-drawing characters, no em-dashes that confuse the dashboard editor) for CEO to paste. This was a real failure pattern tonight, fixed by paste-and-deploy.
13. **When another AI's draft (Gemini, etc.) is dropped in chat for review, audit BEFORE deploying:** schema columns against `information_schema.columns`, RPC signatures against `pg_get_functiondef`, env vars against the set list, existing-function check via `list_edge_functions` to avoid duplication. Tonight Gemini's 89-line stripe-webhook draft would have shipped 5 hard breaks live without this gate.

### Frontend addendum (when editing `bbf-app.html`)

- **Grep before read.** Find handlers / IDs / selectors with `grep -n` first.
- **Bump SW cache.** Increment `BBF_CACHE` on every client-side change (currently `bbf-v103`).
- **Verify input/handler symmetry.** When deleting an input, grep for `getElementById('<id>')` first.
- **Live Coach Gemini stack is locked** — do not change model/endpoint without re-validating Slice 15.
- **`bbf-lang.js` is the silent override.** Every `data-lang-key` on the storefront is replaced at render time. Mirror price/copy changes there or risk a 9-day silent regression like Phase A → 18-i18n-hotfix.

### When other AI agents touch the repo

- **Jules / AG operate on `ag/<topic>` branches.** They never push main, never apply migrations, never deploy edge functions.
- **Red-zone files require per-task CEO directive** before Jules touches: auth/access path in `bbf-app.html`, gates in `index.js`, `bbf-ws-ticket.js`, all Phase 16/17/18/19 RPCs and migrations, `api/supabase-schema-actual.sql`, `sw.js` cache, `mastermind-portal.html` Switchboard, `.well-known/assetlinks.json`.
- **Every AI PR ships with a scope manifest** — files touched, intent, risk class (green/yellow/red). Red-zone touches halt and ping CEO before code.
- **Post-AI-merge smoke (30 sec):** login as akeem, login as wayne (gateway), flip wayne to lite via Switchboard and re-login (bouncer fires), curl `/api/auth/ws-ticket` for akeem (200 + ticket). Any failure = revert.

**Bridge signal:** if conversation gets heavy mid-task — stop, update this doc, commit, tell Akeem *"context refresh recommended — handoff updated."*

---

*Living doc. Update as state changes. Keep it under ~500 lines so a session can read it fast.*
