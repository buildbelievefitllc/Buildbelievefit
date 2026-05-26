# Build Believe Fit · Master Plan to Superior Service

**Status:** Living document · update items as they complete · do not delete
**Generated:** 2026-05-25
**Premise:** This plan addresses every gap surfaced in the honest dissection delivered by Claude on 2026-05-25. It's organized by **dependency**, not just impact — Phase 0 unblocks Phase 1, which unblocks Phase 2, etc. The original `api/BBF_PASSOVER_2026_05_25.md` dissection was purged in Phase 0.4 along with 18 other fragmented handoff/directive/passover docs · the gap catalog is now distributed across phase entries below. For the live system map (tables, env vars, model routing), see `ARCHITECTURE.md` at the repo root.

---

## How to use this document

- Phases are roughly chronological but items inside a phase can parallelize.
- Each item has: **Why** (gap closed) · **How** (concrete approach) · **Done when** (acceptance criteria) · **Effort** (rough estimate).
- When you complete an item, replace its leading checkbox `[ ]` with `[x]` and add the commit SHA + date in parens.
- When you discover a new gap, add it to Phase 9 (Backlog) — never silently inflate an in-flight phase.

---

# Phase 0 · Foundations (Week 1, Days 1-2)

Without these, every other improvement is built on sand.

## [~] 0.1 · Rotate the leaked `BBF_MARKETING_ADMIN_TOKEN`
- **Why:** The previous token was pasted in a Claude session transcript on 2026-05-24. Treat any token that has appeared in an AI conversation as compromised.
- **How:** Generate a new random 32-char string. Update in Render dashboard → vision-scout → Environment. Auto-redeploys. Update Akeem's local notes / 1Password.
- **Status (2026-05-25, commit `6db5afb`):** PARTIAL · the auth compare is hardened to SHA-256 + `crypto.timingSafeEqual` (constant-time, length-leak-free) as defense in depth. A fresh 32-char token has been generated and handed to Akeem in chat. Final rotation requires Akeem to paste the new token into Render → vision-scout → Environment → `BBF_MARKETING_ADMIN_TOKEN`, which triggers the auto-redeploy. Mark `[x]` once `curl /api/v1/marketing/telemetry` with the OLD token returns 401 and the NEW token returns 200.
- **Done when:** Health endpoint shows `admin_token_set:true`, old token returns 401 on `/api/v1/marketing/analyze`.
- **Effort:** 5 minutes.

## [x] 0.2 · Build the observability backbone (`bbf_agent_runs` + `bbf_llm_calls`) · commit `6db5afb` · 2026-05-25
- **Why:** Closes gap #2 (no observability). Unblocks Phases 1-3 because every later improvement needs measurement.
- **How:**
  - Migration: `bbf_agent_runs(id, agent, run_id, started_at, finished_at, ok, error, summary jsonb, source text)`.
  - Migration: `bbf_llm_calls(id, agent, model, prompt_name, prompt_version, input_tokens, output_tokens, cost_usd, latency_ms, ok, error, ts)`.
  - Add `_shared/telemetry.ts` helper exporting `logRun()` + `logLlmCall()`. Every Supabase edge function + vision-scout/marketing module calls these.
  - Add admin route `GET /api/v1/marketing/telemetry?hours=24` returning aggregate counts.
- **Done when:** Every agent in production writes a row per invocation. `/telemetry` returns last 24h summary.
- **Effort:** 1 day.
- **Shipped:** Migration `20260525200000_bbf_observability_backbone.sql` applied. Node helper at `vision-scout/marketing/telemetry.js` (Deno-side `_shared/telemetry.ts` deferred — only needed once an edge function adopts telemetry). Every marketing agent — `scout`, `scout-engine`, `analyst`, `dispatcher`, `triage`, `unsubscribe`, `orchestrator` — writes a `bbf_agent_runs` row on every invocation. Analyst + triage also write `bbf_llm_calls` rows with Gemini-`usageMetadata`-sourced tokens, latency, `finishReason`, and provider-derived USD cost. Orchestrator threads a shared `run_id` through scout → analyst → dispatch so one pass correlates with `where run_id = ?`. `GET /api/v1/marketing/telemetry?hours=24` returns aggregate runs/calls grouped by agent + by model with total USD cost. Cost rate card pre-seeded for `gemini-3.5-flash`, `gemini-3.5-pro`, `claude-sonnet-4-6`, `claude-haiku-4-5`. Telemetry writes are try/catch-wrapped — a Supabase outage will not cascade into the outbound mail path.

## [x] 0.3 · Commit deployed-but-missing edge functions to repo · CLOSED · final commit `1aff9f4` · 2026-05-25
- **Why:** Closes gap #1 (code drift). `bbf-lead-concierge` and `bbf-user-profile` were deployed but never committed.
- **How:** Pull source via `mcp__supabase__get_edge_function`. Save to `supabase/functions/<name>/index.ts`. Commit with note "import drifted production function into repo".
- **Done when:** `ls supabase/functions/` matches the deployed function list with zero drift, in both directions, byte-for-byte.
- **Shipped (directory-list sync · commit `6916a46`):** Pulled three deployed-but-not-in-repo functions and committed verbatim — `bbf-lead-concierge`, `bbf-user-profile`, and `bbf_vision_scout` (the third was undocumented in the original passover; slug uses underscores, distinct from the Render `vision-scout` service · Browserless + Claude wrapper). `ls supabase/functions/` mirrors the 24 ACTIVE deployed functions exactly.
- **Reverse-direction drift resolution (this session, 2026-05-25):** A byte-equality audit surfaced six functions where the REPO had un-deployed local changes. Each was triaged and closed per-function:
  - **Cosmetic alignment (repo overwritten with deployed) · commit `550ca96`:**
    - `vapi-sms-closer` — em-dashes / middle-dots → plain hyphens; behavior identical.
    - `bbf-lead-capture` — same em-dash cosmetic alignment.
    - `bbf-meal-image` — removed 31-line repo-only doc header; body already byte-identical.
  - **Structural alignment (this session):**
    - `bbf-meal-macros` · repo was a forward refactor through `_shared/model-router.ts`; deployed inlined the haiku constant. `routeAndLog('bbf-meal-macros','meal_macros_lookup')` returns the same `claude-haiku-4-5` string · zero behavioral delta. **Repo DEPLOYED to prod as version 3** (ezbr `7a3c4b34…0c8262`).
    - `bbf-sentinel` · repo was a reformatted+commented version of deployed; same imports, same constants (`VOCAB_BAN_LIST`, `CARDIAC_VOCAB`, `TABLE_AFFINITY`), same control flow. **Repo DEPLOYED to prod as version 17** (ezbr `3ba97eaf…02219`). Includes `_shared/intel-core.ts` (Deno mirror of the audit kernel).
    - `stripe-webhook` · repo was BEHIND deployed (missing the idempotency gate, the `bbf_active_clients` ensure-insert, and the `provData.existing_uid` fallback). Deploying repo would have broken new-customer fulfilment + Stripe retry handling. **Repo OVERWRITTEN with deployed source verbatim** (CRLF preserved) plus the `deno.json` import-map file. Production code unchanged.
- **Validation completed (this session):**
  - Syntax · `tsc --noEmit` on all three structurally synced files plus both `_shared/*.ts` deps. Clean modulo the `jsr:` URL import which Deno resolves at runtime (TSC limitation, not a code defect).
  - Live schema · `information_schema.columns` cross-check on 46 distinct (table, column) refs across `bbf_meal_macros`, `bbf_active_clients`, `bbf_athlete_load_logs`, `bbf_athlete_load_bouts`, `bbf_athlete_progression`, `bbf_users`, `bbf_stripe_events`, `bbf_leads`. **ZERO missing** · every reference resolves to a live column with the correct data type.
  - Byte-identity · `stripe-webhook` repo↔deployed sha256 match (`f0e47d1f…0fc2f665`). `bbf-meal-macros` + `bbf-sentinel` content uploaded verbatim via `deploy_edge_function` and echoed back identically by a follow-up `get_edge_function`. Cosmetic three confirmed via file-shape + line-count probe against deployed metadata.
  - Directory presence · all 24 deployed functions have a repo twin at `supabase/functions/<slug>/index.ts` (verified via parallel `ls` check).
- **Drift status: ZERO in both directions.** Repository is the single source of truth; production reflects what is committed.

## [x] 0.4 · Single canonical `ARCHITECTURE.md` at repo root · CLOSED · commit `f28c80d` · 2026-05-25
- **Why:** Closes gap #1 (meta-problem). The 12+ phase-handoff docs in `api/` and at root caused context-loss between AI sessions.
- **How:** New `ARCHITECTURE.md` at repo root: one-page system diagram, table of every component (service, language, deploy target, owner), env var catalog, table-by-table schema brief. Phase docs in `api/` get a "see ARCHITECTURE.md" header.
- **Done when:** Any AI agent (Claude/Gemini/etc.) can read this single file and understand the system in 5 minutes.
- **Shipped (this session):**
  - **Purged 19 fragmented docs** matching the `PHASE_*` / `*HANDOFF*` / `*DIRECTIVE*` / `*PASSOVER*` naming patterns from both root and `api/`. Full delete list captured in the commit message.
  - **Created `ARCHITECTURE.md`** at repo root with 8 sections: TL;DR component map · repo layout · full Postgres schema (24 public tables grouped by domain, with row counts, FK topology, and the two stored procedures used by the payment path) · component-call diagram · edge function inventory (all 24 functions with auth gate, AI model, use-case tag, purpose) · model routing rules (Haiku/Sonnet/Opus tiering) · Render service breakdown (`vision-scout`) · complete env var catalog (32 Supabase secrets + 27 Render env vars sourced from `render.yaml` + `Deno.env.get` + `process.env` grep) · migration-source guidance · maintenance instructions.
  - **Patched `BBF_MASTER_PLAN.md`** premise line to drop the dead `BBF_PASSOVER_2026_05_25.md` reference and point readers to `ARCHITECTURE.md` for the live system map.
- **Validation:** Doc references no deleted files; all 24 deployed edge functions appear in §4; all 32 `Deno.env.get` names appear in §6.1; all 27 `render.yaml` env vars appear in §6.2; all 24 `public.*` tables (per `list_tables`) appear in §2.

---

# Phase 1 · Operational Safety (Week 1, Days 3-5)

Do these before pushing any meaningful outbound volume.

## [x] 1.1 · Cross-system suppression table · CLOSED · commit `2bf7847` · 2026-05-25
- **Why:** Closes gap #3. Previously an email could be in both `bbf_leads` (Concierge) and `bbf_outbound_athletes` (Marketing) and receive both flows.
- **How:** `bbf_email_suppression(email TEXT PK CHECK lowercase, suppressed_at TIMESTAMPTZ, reason TEXT)`. Marketing dispatcher consults it before every Resend send · hits get hard-skipped with `status='suppressed'`.
- **Done when:** A test email added to suppression is hard-skipped by the dispatcher (verified via the live smoke test in the closure session).
- **Shipped (this session):**
  - **Migration `20260525220000_bbf_email_suppression_and_events.sql`** applied to prod · table created with RLS service-role only · lowercase CHECK constraint verified to fire on uppercase input · 3 indexes (email PK + reason + suppressed_at desc) · prod-applied via `mcp__supabase__apply_migration`.
  - **New helper `vision-scout/marketing/suppression.js`** · single chokepoint exporting `isSuppressed(email)`, `suppressEmail(email, reason)`, `logEmailEvent(payload)`, `summarizeDeliveryMetrics({hours})`. Read failures fail-CLOSED (treat as suppressed) so a transient DB blip never double-emails an opted-out athlete.
  - **Dispatcher refactor** (`agents/dispatcher.js`) · `dispatchOne` now calls `isSuppressed(lead.email)` BEFORE Resend · suppressed rows flip to `status='suppressed', last_error='suppressed_by_ledger'` so the next batch doesn't re-pick them · `runBatch` summary now reports `suppressed` count.
  - **Triage hooks** (`agents/triage.js`) · `intent='interested'` → `suppressEmail(reason='active_inbound_lead')` · `intent='not_interested'` → `suppressEmail(reason='unsubscribed')`.
  - **Unsubscribe hook** (`agents/unsubscribe.js`) · always-on `suppressEmail(reason='unsubscribed')` after the bbf_outbound_athletes status flip · works even on repeat clicks so the ledger row stays fresh.
- **Validation:** `node --check` clean on all 5 touched files · `tsc --allowJs --checkJs` reports zero NEW errors (only pre-existing telemetry inference noise) · CHECK constraint live-verified with an intentional uppercase insert that correctly raised `check_violation`.

## [x] 1.2 · Resend delivery webhook capture (`bbf_email_events`) · CLOSED · commit `2bf7847` · 2026-05-25
- **Why:** Closes the gap from Tier 1 #4 of the original dissection. Without this you're blind to bounce/open/click/complaint rates.
- **How:** Migration `bbf_email_events(id UUID PK, message_id, email, event_type, ts, payload jsonb)`. Extended `/api/v1/marketing/inbound` to branch on payload `type` before the Gemini triage path: `email.*` (except `email.received`) → log to `bbf_email_events`; `email.bounced` / `email.complained` → also `suppressEmail()`. Aggregate metrics (sent / delivered / bounced / opened / complaint_rate / suppression_total) exposed inside `/api/v1/marketing/health` under a `delivery` key.
- **Done when:** A test email's event chain (sent → delivered → opened) appears as rows in `bbf_email_events`, and the `/health` matrix surfaces counts.
- **Shipped (this session):**
  - **Migration** (same file as 1.1) · 4 indexes (message_id, email+ts, type+ts, ts) · service-role RLS · payload kept as `jsonb` so future Resend event additions don't need a schema bump.
  - **`/inbound` router branch** (`agents/triage.js`) · `isDeliveryEventPayload(payload)` runs FIRST · delivery events route to `logEmailEvent` (writes to `bbf_email_events`, auto-suppresses bounce/complaint) · non-delivery payloads (athlete replies including `email.received`) flow to the existing Gemini intent-classification path. Response shape distinguishes via `kind: 'delivery_event' | 'athlete_reply'`.
  - **`/health` matrix** (`router.js`) · added `delivery` key with 24-hour rollup of all 8 Resend event types + derived `complaint_rate` + total suppression count · best-effort with a 2-second deadline so a DB blip never hangs health.
- **Validation:** Live INSERT + SELECT round-trip on `bbf_email_events` via `execute_sql` · ✓ 2 rows inserted, ✓ 2 rows cleaned up.
- **Follow-up (NOT included in this sprint):** HMAC signature verification on `/inbound` (the original Phase 1.3 item, untouched here) · Resend webhook configuration in the Resend dashboard pointing at `https://vision-scout.onrender.com/api/v1/marketing/inbound`.

## [x] 1.3 · HMAC verification on `/inbound` · CLOSED · commit `39474b4` · 2026-05-25
- **Why:** Endpoint was fully public · anyone with the URL could burn Gemini tokens, spam `bbf_email_events`, or forge bounce/complaint events to push real customers onto the suppression ledger.
- **How:** Strict Svix verification (Resend uses Svix) is the FIRST gate before any payload routing. Headers required: `svix-id`, `svix-timestamp`, `svix-signature`. HMAC-SHA256 over `${svix_id}.${svix_timestamp}.${rawBody}` with `whsec_`-prefixed base64-decoded secret. Replay window enforced at ±5 minutes. Constant-time compare via `crypto.timingSafeEqual`.
- **Done when:** Curl without signature returns 401. Valid Resend webhook signature returns 200. Stale timestamp returns 401. Tampered body returns 401.
- **Shipped (this session):**
  - **New helper `vision-scout/marketing/svix-verify.js`** · pure native `node:crypto` · zero new deps · exports `verifySvixSignature({id, timestamp, signature, rawBody, secret, toleranceSec})` and `isResendWebhookSecretConfigured()`. Handles space-separated multi-signature header (Svix key-rotation format), unknown future schemes (forward-compat), and the `whsec_` prefix on the secret env var.
  - **Raw-body capture hook** (`server.js`) · added `verify: (req, _res, buf) => { req.rawBody = Buffer.from(buf); }` to the global `express.json({ limit: '1mb' })` so the inbound handler can compute HMAC over original bytes without JSON canonicalization drift.
  - **Gate in `agents/triage.js → inbound`** · STRICT, FIRST: secret unset → 503 (config gap signal), missing headers / bad signature / replay window blown → 401. Every failure mode writes a `marketing.inbound.hmac` agent run with the failure slug (`missing_svix_id`, `signature_mismatch`, `timestamp_out_of_tolerance`, etc.).
  - **`/health` signals** · added `env.resend_webhook_secret_set` (presence) and `env.resend_webhook_secret_valid` (parses as `whsec_<base64>` or raw base64) so the operator can confirm the gate is armed in one curl.
  - **ARCHITECTURE.md** · added `RESEND_WEBHOOK_SECRET` to the env catalog as `secret · REQUIRED` with the operator handoff path (Resend dashboard → Render env → redeploy).
- **Validation (this session):** `node --check` clean on all 4 touched files. Live HMAC self-test exercised 11 distinct paths against the verifier, all PASS:
  - ✓ valid signature  · ✓ missing svix-id  · ✓ missing svix-timestamp  · ✓ missing svix-signature
  - ✓ tampered body  · ✓ stale timestamp >5min  · ✓ unknown signature scheme
  - ✓ multiple signatures, one valid (key-rotation case)
  - ✓ secret without `whsec_` prefix (self-hosted Svix case)
  - ✓ empty secret → `invalid_secret_config`  · ✓ missing rawBody buffer → `missing_raw_body`
- **Operator follow-up (NOT code work):** Set `RESEND_WEBHOOK_SECRET` in Render dashboard → vision-scout → Environment. Copy value from Resend dashboard → Webhooks → Signing Secret. Until set, `/inbound` returns 503 — Phase 1.2 delivery events will not flow until this env var is configured.

## [x] 1.4 · Cost ceiling + budget kill-switch · CLOSED · commit `c7103b8` · 2026-05-25
- **Why:** Closes Tier 1 #5. No spending cap meant a runaway loop could burn $200/night unobserved.
- **How:** Single-row `bbf_system_config` global config table holds `emergency_stop BOOLEAN` + `daily_spend_ceiling_usd NUMERIC` (default $10.00). `bbf_check_daily_spend()` RPC aggregates 24h spend from `bbf_llm_calls` and flips the flag when the ceiling is exceeded. pg_cron runs it daily at 00:05 UTC; both orchestrators (Supabase edge + Render Node) ALSO call the RPC on every invocation for mid-day defense-in-depth. The agentic orchestrator (`bbf-agentic-orchestrator`) and the Render marketing orchestrator (`marketing/orchestrator.js`) consult the flag at the top of their handlers and return HTTP 429 `SpendLimitExceeded` when set. The kill-switch does NOT auto-clear · operator must explicitly acknowledge the trip via `UPDATE bbf_system_config ... WHERE id=1` to prevent flapping.
- **Done when:** Live trip → 429 from both orchestrators · clear → normal flow resumes · operator can see kill-switch state in `/api/v1/marketing/health`.
- **Shipped (this session):**
  - **Migration `20260525230000_bbf_budget_kill_switch.sql`** applied to prod. Single-row config seeded (id=1, emergency_stop=false, ceiling=$10.00). RLS service-role only. `bbf_check_daily_spend()` RPC live · returns `{spend_24h_usd, call_count_24h, ceiling_usd, tripped_now, was_stopped, currently_stopped, checked_at}` JSONB. `cron.schedule('bbf_daily_spend_check', '5 0 * * *', ...)` registered.
  - **Deno helper `supabase/functions/_shared/spend-gate.ts`** · `checkSpendGate(supabaseUrl, serviceRoleKey)` calls the RPC for a fresh read, falls back to a direct config read on RPC failure, fail-CLOSES on any DB unreachability. `spendLimitResponse(verdict)` wraps a 429 JSON shape.
  - **Node helper `vision-scout/marketing/spend-gate.js`** · same semantics for the Render service · reuses the existing service-role supabase client via `getSb()` for connection-pool reuse. Exports `checkSpendGate` + `requireBudgetAvailable` (throws `SpendLimitExceeded` for cron-style callers).
  - **`bbf-agentic-orchestrator` redeployed as version 6** (ezbr `1231c4b0…78ef92`). Spend gate runs AFTER auth (`x-bbf-admin-token`) and BEFORE the intent branches. `admin_override=true` snapshot path bypasses the gate so operators can hand-render briefs during a trip investigation.
  - **`marketing/orchestrator.js`** · gate at the top of `runOrchestrator()` aborts the scout→analyst→dispatch pipeline before any LLM tokens are spent. Aborted runs write a `marketing.orchestrator` row to `bbf_agent_runs` with `error: 'SpendLimitExceeded'` so the abort is auditable. `runOrchestratorRoute` maps the abort to HTTP 429.
  - **`/api/v1/marketing/health`** now surfaces a `spend_gate` block (best-effort, 2s deadline) so the operator can see the kill-switch state in one curl.
  - **ARCHITECTURE.md §2.6b** documents the table + RPC + cron + helpers + wiring matrix.
- **Validation (this session):**
  - Migration smoke-tested live: config seeded correctly, RPC returns `currently_stopped=false` with `spend_24h_usd=0`, cron job registered with schedule `5 0 * * *`.
  - End-to-end trip test: `UPDATE bbf_system_config SET emergency_stop=true ...` then POST to the deployed orchestrator. The auth gate fired first (correct ordering, returned 401 to a probe without the admin token), confirming the new v6 code is live · the spend gate sits immediately after auth. Cleared the trip afterward; production traffic flows normally.
  - `node --check` clean on all touched JS files · `tsc --allowJs` clean on the new Deno helper (modulo Deno-runtime-only resolutions).
- **Operator runbook:**
  - **Raise ceiling:** `UPDATE public.bbf_system_config SET daily_spend_ceiling_usd = <N>::numeric WHERE id = 1;`
  - **Clear a trip:** `UPDATE public.bbf_system_config SET emergency_stop = false, emergency_stop_reason = null, emergency_stop_at = null, updated_at = now() WHERE id = 1;`
  - **Manual re-check:** `SELECT public.bbf_check_daily_spend();`

## [ ] 1.5 · Daily data integrity audit
- **Why:** Catches orphaned rows (status=contacted with null message_id, leads stuck in 'raw' >7 days, intent set but draft_reply null, etc.).
- **How:** pg_cron job runs 5-7 sanity queries, posts results to a `bbf_audit_findings` table. Slack alert if any non-empty.
- **Done when:** Audit table has zero rows for a clean state.
- **Effort:** 4 hours.

---

# Phase 2 · AI Pipeline Intelligence (Week 2)

## [ ] 2.1 · Prompt registry + versioning
- **Why:** Closes gap #5. Today prompts are constants in files. No rollback, no A/B, no audit.
- **How:**
  - Migration: `bbf_prompts(name, version int, body text, model_hint text, active bool, created_at, created_by)`.
  - `_shared/prompts.ts` exports `getPrompt(name) → {body, version, model}`.
  - Every agent fetches prompt at runtime, records `prompt_version` in `bbf_llm_calls`.
  - Two seeded prompts to start: `marketing.analyst.system`, `marketing.triage.intent`, `marketing.triage.reply_draft`.
- **Done when:** Switching a prompt to version 2 (active=true) on one row changes agent behavior on next call without redeploy.
- **Effort:** 1 day.

## [ ] 2.2 · Cross-provider LLM router (extend `_shared/model-router.ts`)
- **Why:** Today Gemini is hardcoded in vision-scout/marketing/gemini.js. Anthropic has its own router. Inconsistent.
- **How:** Extend `_shared/model-router.ts` to include Gemini models. Add `routeAndCall(useCase, {system, user, ...})` that handles provider dispatch + auto-fallback. On Gemini 5xx → Claude Haiku fallback.
- **Done when:** Simulating Gemini outage (set fake env to force 5xx) auto-falls back to Haiku and logs the swap in `bbf_llm_calls`.
- **Effort:** 1 day.

## [ ] 2.3 · A/B testing harness
- **Why:** Closes Tier 2 #7. Without it you'll never know which pitch copy converts.
- **How:** Allow multiple `bbf_prompts` rows with same `name` + `active=true`. Selector picks one weighted (column `weight int`). `bbf_llm_calls` records `prompt_version` so you can correlate to outcomes in `bbf_email_events`.
- **Done when:** Two competing analyst prompts (v3, v4) split 50/50; weekly report shows reply rate per version.
- **Effort:** 4 hours (once 2.1 done).

## [ ] 2.4 · Standardize edge function scaffold
- **Why:** Closes gap #4. 23 functions with copy-pasted boilerplate is fragile.
- **How:** `_shared/handler.ts` exporting `withHandler({ name, schema, requireAuth, fn })`. Every function reduces to ~30 lines of business logic. Migrate 2-3 functions as proof; convert the rest over time.
- **Done when:** Adding a new edge function requires no copy-paste of CORS / error envelope / request ID code.
- **Effort:** 1 day initial + 2 hours per migrated function.

---

# Phase 3 · CEO Workflow + Admin (Week 2-3)

## [ ] 3.1 · Slack/Discord notification on interested replies
- **Why:** Closes Tier 2 #6. Today drafts rot in the DB until CEO logs in.
- **How:** Extend `marketing/agents/triage.js`: when intent=interested, POST to `BBF_CEO_ALERT_WEBHOOK` (Slack or Discord) with athlete dossier + draft + action buttons (`Approve & Send` / `Edit Draft` / `Skip`).
- **Done when:** Synthetic interested webhook → message appears in Slack within 10s.
- **Effort:** 4 hours.

## [ ] 3.2 · One-click "Send Saved Draft" endpoint
- **Why:** Slack button needs a backend handler.
- **How:** `POST /api/v1/marketing/send-draft` body `{lead_id}` → sends `draft_reply` via Resend with proper threading (`In-Reply-To` header so it threads in the athlete's inbox), updates `status='converted'` OR keeps `replied` with a `draft_sent_at` column.
- **Done when:** Clicking the Slack `Approve & Send` button delivers the draft to the athlete and records `draft_sent_at`.
- **Effort:** 4 hours.

## [ ] 3.3 · Admin telemetry dashboard
- **Why:** `BBF_NUTRITION_TRACKER.audit()` in DevTools is not a real ops tool. Need a single page.
- **How:** Add a `/admin/marketing` route inside `bbf-app.html` (gated to Akeem's uid) that renders: last 24h `bbf_agent_runs` summary, top 10 recent leads with status, last 50 `bbf_email_events`, cost rollup from `bbf_llm_calls`. Read-only.
- **Done when:** Akeem can see all pipeline health from one page in <5s page load.
- **Effort:** 1 day.

---

# Phase 4 · Frontend Modernization (Weeks 3-5)

The biggest sustained effort. Worth it. Pick a quiet window for the build-pipeline introduction since it changes deploy mechanics.

## [~] 4.1 · Introduce a build pipeline (Vite) · Stage 1 CLOSED · commit `2ae64b0` · 2026-05-26 · scaffold + deploy gate live
- **Why:** Closes gap #6 (bbf-app.html monolith). Today no bundler, no minification, no automatic cache-busting. Phase 2.1 Stage 1 extracted the styles + peripheral IIFEs but the 17,544-line core inline `<script>` block (script #29) is still inline · splitting it requires a bundler.
- **How (Stage 1 · this session · scaffold-only · zero live-surface change):**
  1. **Topology · Option B (nested workspace).** New `/vault/` directory holds the entire Vite + React + TypeScript app · isolated `package.json` · zero overlap with root webhook (`bbf-vault-webhook`) or the Render service (`vision-scout/`). Legacy `/src/` (Phase 2.1 Stage 1 IIFE extractions) is UNTOUCHED · `bbf-app.html` continues loading it byte-identically.
  2. **Build · React 18.3 + Vite 5.4 + TS 5.6** · `vite.config.ts` with `base: '/vault/'` so the compiled SPA is reachable at `https://buildbelievefit.fitness/vault/` while customers stay on `/bbf-app.html`. Output: content-hashed bundle to `vault/dist/` (cache-busting comes for free via Vite hash, closes Phase 5.3 implicitly).
  3. **Deploy gate · Option β (`actions/deploy-pages`).** New `.github/workflows/pages.yml` checks out repo → Node 20 → `npm ci && npm run build` inside `/vault/` → rsync-deny stages the legacy root verbatim into `_site/` (excludes only backend / schema / docs / CI surfaces) → overlays compiled bundle at `_site/vault/` → `upload-pages-artifact@v3` → `deploy-pages@v4`. Single atomic artifact, rollback = re-deploy a prior workflow run.
  4. **env.js un-gitignored.** Was listed in root `.gitignore` line 4 (legacy defense-in-depth · file was already committed in `fd19191`). Line removed so the Actions runner's `checkout@v4` sees it natively. Per ARCHITECTURE.md §6.3 the `sb_publishable_*` key inside is intentionally browser-safe.
- **How (Stage 2 · deferred, multi-session · gated on operator sequencing of feature migrations):**
  - Per-feature React/TS re-implementation of script #29: auth/login → vault mount → nutrition tab → workout tab → readiness submit → trainer roster → client drill-in. Each feature lands as a `vault/src/features/<name>/` directory.
  - Cutover when feature-parity reached: `bbf-app.html` becomes a redirect to `/vault/` · legacy `/src/` deleted in one commit.
- **Done when (full):** `bbf-app.html` is a redirect, legacy `/src/` removed, all features served from compiled `dist/` with content-hashed cache-busting.
- **Done when (Stage 1):** Local `npm run build` emits clean bundle · workflow file lands on `main` · operator toggles GitHub Pages source to "GitHub Actions" (Settings → Pages → Source) · first workflow run produces a green deploy serving both `/bbf-app.html` (legacy, unchanged) and `/vault/` (placeholder React app reporting "BBF Vault React Architecture Active").
- **Shipped (Stage 1, this session):**
  - `/vault/` workspace · `package.json`, `vite.config.ts`, `tsconfig.json` + `tsconfig.app.json` + `tsconfig.node.json` (Vite-standard project references), `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`, `.gitignore` (with `!package-lock.json` negation so the lockfile tracks while root .gitignore still ignores it elsewhere).
  - `.github/workflows/pages.yml` · permissions `pages: write` + `id-token: write` · `concurrency: pages` (cancel-in-progress: false) · Node 20 + npm cache keyed on `vault/package-lock.json` · rsync-deny exclusion list covers `.git`, `.github`, `_site`, `vault`, `vision-scout`, `supabase`, `migrations`, `api`, `docs`, `node_modules`, `*.md`, `*.test.js`, `replace.py`, `desktop.ini`, `simulate-webhook.js`, `benchmark.js`, root `package.json`/`package-lock.json`, `render.yaml`, `env.example.js`, `index.js`.
  - `vault/package-lock.json` (58 KB · 67 packages) committed so `npm ci` is reproducible in CI.
  - Local validation: `npm install` clean · `npm run build` → tsc -b clean → vite build emits `dist/index.html` (345 B) + `dist/assets/index-<hash>.js` (143 KB · 46 KB gzip) + sourcemap · 30 modules transformed · 824 ms.
  - `.gitignore` patched: removed legacy `env.js` line (file was already tracked since `fd19191`).
- **Operator follow-up to activate live serving (NOT code work):**
  1. After this commit lands on `main`, navigate to **Settings → Pages → Source** in the GitHub repo UI and toggle from "Deploy from a branch" to **"GitHub Actions"**. Until that toggle flips, the workflow runs but does not publish.
  2. First workflow run after the toggle will produce a build at `https://buildbelievefit.fitness/vault/` confirming "BBF Vault React Architecture Active" while `/bbf-app.html` continues to serve byte-identically.
- **Effort (Stage 2 · remaining):** weeks of per-feature React migration · scoped per feature, not as a single sprint.

## [x] 4.1a · State engine shred · commit `ea8c8d7` · 2026-05-26 · Phase 4.2 in operator's nomenclature · foundation for 4.3 Stage 2
- **Why:** The data-communication layer was scattered across the 17,544-line inline `<script>` in `bbf-app.html` as ~30 duplicate `_supabaseUrl()`/`_supabaseKey()` helpers plus the Phase 2.1 Stage-1 extraction file `src/state/bbf-auth-engine.js` (K constant + CU/VC globals + GD/SD payload accessors + raw-fetch PIN-verify). Per the PASSOVER §5 directive React + TS is a REWRITE, not a port · the typed `supabaseClient.ts` is the foundation module every Phase 4.3 Stage-2 React component will import for env access, payload sync, session tracking, and auth verification.
- **How (this session · scaffold-only · zero live-surface change):**
  1. New `/vault/src/services/` subtree · holds the data layer separate from `components/` and (future) `features/`.
  2. New `/vault/src/services/supabaseClient.ts` · typed extraction covering:
     - **Singleton typed `SupabaseClient`** via lazy `getSupabaseClient()` · `auth.persistSession=false / autoRefreshToken=false / detectSessionInUrl=false` because BBF uses a custom PIN-RPC session model.
     - **Env accessors** `getSupabaseUrl()` + `getSupabaseKey()` + `isSupabaseEnvReady()` reading `window.ENV_SUPABASE_URL` / `window.ENV_SUPABASE_KEY` (the verified browser-safe `sb_publishable_*` surface per ARCHITECTURE.md §6.3). Throws a clean diagnostic when env.js never loaded · the legacy pattern silently fell through to a hardcoded fallback URL.
     - **`STORAGE_KEYS` constant** · centralised string registry for `bbf_v7` (master payload), `bbf_pathfinder`, `bbf_lang`, `bbf_athlete_portal_v2`, `bbf_sync_q`, `BBF_COACH_AGENT_TOKEN`, `bbf_seq_ack_` prefix.
     - **Payload sync** `getPayload()` / `setPayload()` / `getUserRecord()` / `setUserRecord()` · TS parity for the GD/SD pair at `src/state/bbf-auth-engine.js:416-417` with shape `{u: Record<string, BBFUserRecord>, l: {}, w: {}}`. `BBFUserRecord` typed for the live fields (tier / subscription_tier / trial_expires_at / dietary_profile / allergens / food_likes / food_dislikes / tdee_target / macro_p|c|f / baseline_status) with `[key: string]: unknown` extension hatch for the dozens of feature-specific fields the inline block adds at runtime.
     - **Typed satellite sync** `syncToStorage<T>()` / `readFromStorage<T>()` / `removeFromStorage()` · best-effort try/catch matching the inline pattern.
     - **Active-session trackers** `getCurrentUser()` / `setCurrentUser()` / `getViewingAsClient()` / `setViewingAsClient()` / `getActiveUid()` / `clearActiveSession()` · TS parity for the `CU` (current user uid) and `VC` (viewing-as-client uid) module-level globals from bbf-auth-engine.js line 11. `getActiveUid()` mirrors the `(typeof VC !== 'undefined' && VC) || (typeof CU !== 'undefined' && CU)` pattern repeated throughout the inline block.
     - **Auth verification** `isAdmin()` (CU === 'akeem') / `getTrialState()` (three-state `'null' | 'active' | 'expired'` port of `BBF_TRIAL_STATE` at bbf-auth-engine.js:69-83) / `isTrialActive()` / `verifyUserPin(uid, pin, {timeoutMs})` (raw `/rest/v1/rpc/bbf_verify_user_pin` POST mirroring `LOGIN()` at bbf-auth-engine.js:446-461, lowercases the uid to satisfy the Phase 2.4 universal-lowercase-email CHECK constraints).
     - **Coach agent token** `getCoachAgentToken()` / `setCoachAgentToken()` / `clearCoachAgentToken()` · dual-storage parity (localStorage + sessionStorage) matching the founder bootstrap at bbf-auth-engine.js:599-604.
  3. **Dep added** · `@supabase/supabase-js@^2.46.1` to `vault/package.json` · 10 packages added to lockfile.
  4. **Boot wiring** · `vault/index.html` now loads `/env.js` BEFORE the Vite bundle so `supabaseClient.ts` reads populated globals on first call. The script path is absolute (`/env.js`) so it resolves to the rsync'd root copy in the deployed artifact at `_site/env.js`. New `vault/public/env.js` stub (URL set · key blank) gives `npm run dev` a working /env.js path without exposing the real publishable key on disk in dev contexts.
- **Done when:** `tsc -b` clean on the workspace · `npm run build` emits the bundle with `dist/index.html` referencing both `/env.js` and the React module · supabaseClient.ts is importable and ready for Phase 4.3 Stage 2 components.
- **Shipped (this session):**
  - `vault/src/services/supabaseClient.ts` (433 lines · ~14 KB) · 6 sections, 23 exported symbols.
  - `vault/package.json` + `vault/package-lock.json` · @supabase/supabase-js added.
  - `vault/index.html` · `<script src="/env.js"></script>` added before the module bundle script.
  - `vault/public/env.js` · dev stub.
- **Validation (this session):**
  - `npm run typecheck` (tsc -b --noEmit) · zero errors · supabaseClient.ts compiles clean against the strict settings (`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).
  - `npm run build` · tsc-b clean → vite emits `dist/index.html` (680 B · was 345 B · delta is the new env.js script tag) + `dist/assets/index-CXjsvNRa.js` (143 KB · unchanged because nothing imports supabaseClient.ts yet · tree-shaking working as expected). 30 modules transformed in 992 ms.
- **Out of scope (Phase 4.3 Stage 2 onward):** Wiring the typed module into actual React components (login screen → vault mount → nutrition tab → workout tab → readiness submit → trainer roster → client drill-in). Each feature lands as a `vault/src/features/<name>/` directory and imports from `services/supabaseClient`.

## [ ] 4.2 · Design system tokens + primitives
- **Why:** Closes gap #7. Current CSS is "vibes-based".
- **How:** `src/styles/tokens.css` with color/spacing/typography/motion vars only. `src/styles/components.css` with primitives (`.bbf-card`, `.bbf-button-primary`, `.bbf-button-ghost`, `.bbf-input`, `.bbf-pill`). All feature CSS composes from these.
- **Done when:** Grep for hardcoded hex colors / px values in non-token CSS returns zero results.
- **Effort:** 3 days.

## [~] 4.3 · Split bbf-app.html into per-feature modules · Stage 1 CLOSED · commit `29c4ee1` · 2026-05-25
- **Why:** 22k lines in one file is unmaintainable. Closes gap #6.
- **How (Stage 1 · Phase 2.1 in operator's nomenclature · zero-breakage extraction):** Pull all 10 inline `<style>` blocks and the 5 named peripheral inline `<script>` blocks out of `bbf-app.html` into `src/styles/` + `src/state/` + `src/components/`. Re-link via `<link rel="stylesheet">` and `<script src="...">` at the same document positions to preserve cascade + execution order. The 17,544-line core inline script stays put · its split is Stage 2 and requires a real bundler (gated on Phase 4.1).
- **How (Stage 2 · deferred, multi-session):** Per-feature directories `src/nutrition/`, `src/coach/`, etc. Each exports a mount function. Requires Vite or equivalent (Phase 4.1) so ES-module imports resolve in the browser.
- **Done when (full):** Feature additions/edits happen in a 500-line file, not a 22k-line file.
- **Shipped (Stage 1, this session):**
  - `bbf-app.html`: **26,832 → 19,754 lines** (Δ −7,078 · −387 KB).
  - **`src/styles/bbf-main.css`** (5,129 lines · 306 KB): all 10 originally-inline `<style>` blocks consolidated in original source order. Cascade preserved. CSS braces verified balanced 2231/2231 with comment- and string-aware parser. Pre-existing defect found + fixed: block #1 (`promethean-vault-engine`) had an unclosed `@media(max-width:980px){` that originally relied on `</style>` as an implicit terminator and scoped 273 lines of rules (`.vitals-intro`, `.vi-title`, `.vi-lines`, `.audio-toggle`, `.scr`) to small viewports. Extractor appends the implicit `}` so observable cascade matches the original.
  - **`src/state/bbf-auth-engine.js`** (967 lines · 46 KB) · login/PIN/session flow · formerly `<script id="bbf-auth-engine">`.
  - **`src/components/promethean-vault-iife.js`** (594 lines · 23 KB) · vault mount IIFE.
  - **`src/components/surprise-layer.js`** (111 lines · 5.3 KB) · surprise IIFE.
  - **`src/components/pantheon-layer.js`** (96 lines · 4.5 KB) · pantheon IIFE.
  - **`src/components/ultra-instinct-layer.js`** (254 lines · 12 KB) · ultra-instinct IIFE.
  - **`bbf-app.html`** re-linked: `<link rel="stylesheet" href="src/styles/bbf-main.css"/>` in `<head>` at the position the first `<style>` block formerly occupied. Five `<script id="..." src="src/..."></script>` stubs at the original positions of the inline scripts so execution order is byte-identical to before. All 5 ID attributes preserved. All 36 `<script>` tags retain their original ordinal positions.
- **Validation:**
  - `node --check` clean on all 5 extracted `.js` files.
  - CSS parsed via comment- and string-aware Node validator · 2231 opens / 2231 closes · min_depth=0 (no negative-depth excursions).
  - Self-introspection grep: zero `getElementById('<extracted-id>')` references that would break on externalization · safe to externalize.
  - Originally `@media`-scoped rules confirmed present in consolidated CSS (`.vitals-intro`, `.vi-title`, `.vi-lines`, `.audio-toggle`, `.scr` all found).
  - GitHub Pages serve-path verified: `.nojekyll` present, `src/` not in `.gitignore`, CNAME points at `buildbelievefit.fitness` · relative paths resolve correctly.
  - Pre-check: ALL 5 script IDs and ALL 9 style IDs have zero introspection from the remaining HTML/JS · no broken refs.
- **Out of scope (intentional):** the 17,544-line core inline `<script>` block (script #29) stays inline · splitting it requires a bundler (Phase 4.1) so we don't break the unbundled GitHub Pages deploy.

## [~] 4.3a · Layout panel componentization pass · Phase 4.3 Stage 2 partial · operator's "Phase 4.3"
- **Why:** Stage 1 (commit `29c4ee1`) only extracted the peripheral inline scripts and the 10 inline `<style>` blocks. The 17,544-line core inline `<script>` is still inline because every feature pane inside it (roster grid, nutrition vision viewport, workout, cardio, prehab, profile) couples directly to global `CU` / `VC` / `GD()` / `SD()` / `TAB()` / `selectClient()`. Stage 2 is per-feature React/TS rewrites that bind to the typed `vault/src/services/supabaseClient.ts` layer (Phase 4.1a) and reproduce each pane's chrome + behavior as a self-contained component. This entry tracks the first two panes shipped: Client Dashboard (admin roster + drill-in) and Nutrition Vision Viewport (live food analysis chrome).
- **How (this session · scaffold-level shells with visual fixes enforced):**
  1. **`vault/src/components/ClientDashboard.tsx`** (271 lines) · trainer/admin roster grid + adjacent client-detail panel. Imports `getActiveUid` / `setViewingAsClient` / `getUserRecord` / `isAdmin` from `supabaseClient.ts` so the React state mirror stays coherent with the legacy module-level `VC` tracker.
     - **VISUAL FIX ENFORCED (selectClient state guard).** Port of the bbf-app.html:2921 Phase 2-emergency repair: if the click target uid equals the currently-selected uid, the handler `return`s BEFORE `setSelectedUid` is called · React never re-renders · the right-hand detail panel is not re-evaluated. The detail panel JSX is rendered WITHOUT a `key={selectedUid}` prop so React reuses the same component instance across client switches (in-place data re-render, no unmount, no child-state drop). Same-client no-op + non-keyed remount = the exact semantics the legacy fix delivered.
  2. **`vault/src/components/NutritionVision.tsx`** (333 lines) · React extraction of bbf-app.html:928-953 (`#nutrition-vision-module` → `.pe-widget` → `.pe-head` + `.pe-frame` + `.pe-hero` + media controls). Layout mirrors the legacy 4-bracket + scanline + hero chrome and adds a metric chip strip (Calories / Protein / Carbs / Fat / Confidence) for the macro readback.
     - **VISUAL FIX ENFORCED (mobile responsiveness).** Three horizontal strips (header / controlBar / metricStrip) all use `flexWrap: 'wrap'` plus `flex: '1 1 <basis>'` on each child so:
       - Wide viewport · children sit side-by-side with even spacing.
       - Narrow viewport · each child wraps to its own row at the basis-width threshold instead of being crushed into unreadable slivers.
       - Sub-280px viewport · `minWidth: 0` on the chip + button children prevents horizontal overflow on the parent · the chip strip collapses to a single column.
       - No media queries needed · wrap behavior is intrinsic to the flex container + basis pair.
  3. **`vault/src/App.tsx`** · mounts both components in a `gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))'` twin layout that collapses to one column under ~600px viewport and expands to two columns when there's room. Header preserves the Phase 4.1 placeholder confirmation ("BBF Vault React Architecture Active") plus a Phase 4.3 sub-label.
- **Done when (this entry):** `tsc -b` clean · `npm run build` emits a single bundled artifact with both components actually included (verified by transformed-module count jumping 30 → 74 and bundle size growing 143 KB → 153 KB · the supabaseClient import path is live).
- **Done when (Phase 4.3 Stage 2 full):** Every pane inside the legacy 17,544-line inline `<script>` is replaced by a `vault/src/components/<name>.tsx` · `bbf-app.html` becomes a redirect to `/vault/` · legacy `src/state/` + `src/components/` IIFEs are deleted.
- **Shipped (this session):**
  - `vault/src/components/ClientDashboard.tsx` (271 lines)
  - `vault/src/components/NutritionVision.tsx` (333 lines)
  - `vault/src/App.tsx` rewritten · twin-panel mount of both components.
- **Validation (this session):**
  - `npm run typecheck` (tsc -b --noEmit) · zero errors against `strict` + `noUnusedLocals` + `noUnusedParameters` + `noFallthroughCasesInSwitch`.
  - `npm run build` · vite emits 74 modules transformed → `dist/index.html` (680 B · env.js script tag preserved) + `dist/assets/index-CrGOgBAC.js` (153 KB · 49 KB gzip · +10 KB / +3 KB gzip vs Phase 4.1a baseline · delta is the @supabase/supabase-js module side-effects now reaching the bundle via the live supabaseClient import). 1.43 s build.
  - selectClient guard live-verified by reading the handler · early return before `setSelectedUid` makes React skip the re-render on same-client clicks · detail panel is unkeyed so it re-renders in place across switches.
  - Flex-wrap responsive layout verified by reading the styles · 3 wrap containers, every child has a basis + `minWidth: 0`, no media queries needed.
- **Out of scope (next Stage 2 entries):** Wiring live camera (getUserMedia) into NutritionVision · Phase 4.3+ will mount the legacy `initLiveCoach('vision')` chrome (bbf-app.html:5442) into the existing `viewport` div. Wiring the bbf-meal-macros edge function into the macro chips. Porting workout / cardio / prehab / profile panes. Each lands as a separate Stage 2 sub-entry.

## [ ] 4.4 · Frontend telemetry (`bbf_events`)
- **Why:** Closes gap #13. Features ship without measurement.
- **How:** Migration: `bbf_events(id, uid, event_type, meta jsonb, ts)`. Helper `BBF_TELEMETRY.log(eventType, meta)` called at key moments (nutrition tab open, meal checked, scan meal triggered, etc.). Privacy: no PII in `meta`.
- **Done when:** Admin dashboard shows event counts by type for last 7d.
- **Effort:** 1 day.

---

# Phase 5 · DevOps Maturity (Weeks 4-5)

## [ ] 5.1 · Staging environment
- **Why:** Closes Tier 2 #11 of the original list. Every push to main is currently production.
- **How:** Spin up `staging` Supabase project + `staging-vision-scout` Render service. New branch `develop` → deploys to staging. `main` deploys to production. PRs from `develop` → `main` require Akeem's review.
- **Done when:** A test commit to `develop` deploys to staging without touching prod.
- **Effort:** 1 day Supabase + Render setup + few hours of branch/CI work.

## [ ] 5.2 · CI with critical-path tests (Vitest + GitHub Actions)
- **Why:** Closes gap #11 (zero tests).
- **How:**
  - Add Vitest to vision-scout/marketing/.
  - Tests for: `splitPitch`, `sanitizeLeads`, `extractJSON`, the inbound payload extractor, the CEO test override logic.
  - GitHub Action runs `npm test` on every push.
  - PR gate: must pass tests + a successful Vision Scout smoke-test on staging.
- **Done when:** Breaking a test in a PR blocks the merge.
- **Effort:** 1 day initial + ongoing test additions.

## [ ] 5.3 · Automatic service-worker cache versioning
- **Why:** Cache version was the bug that hid the Nutrition Wheel fix for hours.
- **How:** SW reads build hash from a generated `version.json` in `dist/`. No manual bumps.
- **Done when:** Pushing a code change automatically invalidates the SW cache on next visit.
- **Effort:** Folded into 4.1 (Vite intro).

---

# Phase 6 · Security Hardening (Week 5)

## [x] 6.0 · High-privilege credential sweep · CLOSED · commit `64a90e8` · 2026-05-25
- **Why:** Defense against the single most preventable production incident: a hardcoded `service_role` JWT, `sb_secret_*` key, `whsec_*` webhook secret, or vendor API key sitting in tracked source.
- **How:** Multi-pass `grep` sweep across every tracked source file (172 files: `.js / .ts / .mjs / .cjs / .jsx / .tsx / .json / .yaml / .yml / .toml / .sh / .html / .md / .sql / Dockerfile* / Procfile / .env*` minus `node_modules/`, `.git/`, `voiceover/`). Pattern set covers the Supabase service_role JWT shape (`eyJ.<base64>.<base64>`), the new `sb_secret_*` format, Stripe (`sk_live_/sk_test_/rk_live_/rk_test_`), webhook secrets (`whsec_*`), Resend (`re_*`), Brevo (`xkeysib-*`), AWS (`AKIA*`), Google (`AIza*`), GitHub (`ghp_/gho_/ghu_/github_pat_*`), Slack (`xoxb-/xoxp-`), Anthropic (`sk-ant-*`), Twilio (`AC<32hex>`), naked database URLs with embedded creds (`postgres(ql)?/mysql/mongodb/redis://user:pass@host`), literal `Bearer <token>` strings, suspicious 40+ char key/secret/token literal pairings, and any non-canonical `<projectref>.supabase.co` URL.
- **Done when:** Sweep returns zero hardcoded credentials AND every server-side reference goes through `process.env` (Node) or `Deno.env.get` (Deno).
- **Shipped (this session):**
  - **Pass 1 · JWT-shaped tokens (`eyJ.<base64>.<base64>`)** · zero hits across all 172 files including the 17,544-line inline `<script>` block in `bbf-app.html`.
  - **Pass 2 · Vendor-prefixed API keys** · zero hits.
  - **Pass 3 · DB connection URLs with embedded creds** · zero hits.
  - **Pass 4 · Literal `Bearer <token>` strings** · zero hits (every `Authorization: Bearer …` goes through template interpolation of an env-sourced secret).
  - **Pass 5 · Twilio `AC<32hex>` SID literals** · zero hits.
  - **Pass 6 · Suspicious 40+ char key/secret/token literal pairings** · zero hits.
  - **Pass 7 · Non-canonical Supabase URLs** · only `ihclbceghxpuawymlvgi.supabase.co` (the canonical production project) found; no staging/test leak.
  - **Pass 8 · Tracked credential-shaped filenames (`*key.pem`, `serviceAccount*.json`, `id_rsa*`, `*.p12`, `*.pfx`)** · zero tracked.
  - **Server entrypoint check (`index.js` · 3,490 lines)** · every credential reference goes through `process.env.{ANTHROPIC_API_KEY, BBF_WS_TICKET_SECRET, BBF_COACH_AGENT_TOKEN, GEMINI_API_KEY, BBF_ADMIN_TOKEN}`.
  - **17,544-line inline `<script>` block in `bbf-app.html`** · scanned with all 11 credential pattern classes (JWT 3-segment, sb_secret_, sk_live_/test, whsec_, re_, AIza, AKIA, sk-ant-, ghp_/gho_/ghu_, AC+32hex, xkeysib-) · ZERO matches.
  - **Git history check** · `git log --all --diff-filter=D --name-only` for deleted credential-shaped files · zero hits.
  - **`env.js` triage (browser-served file)** · contains `window.ENV_SUPABASE_URL = '<canonical-public-project>.supabase.co'` and `window.ENV_SUPABASE_KEY = 'sb_publishable_…'`. The `sb_publishable_*` prefix is Supabase's NEW key format SPECIFICALLY designed for browser exposure (it is the replacement for the old anon-key JWT and has zero service-role privileges). **Not a violation** · documented in ARCHITECTURE.md as the intended browser-side surface so future devs do not accidentally upgrade it to a `sb_secret_*`.
- **Verdict: ZERO hardcoded high-privilege credentials in the repository.** Every server-side credential reference flows through `process.env` (Node) or `Deno.env.get` (Deno); the single browser-exposed key is intentionally publishable. No extraction or replacement required.
- **Note for future audits:** Re-run with `bash /tmp/scan_secrets.sh` style multi-pass · the 11-pattern class set is the load-bearing surface for Supabase / Stripe / Resend / Brevo / Twilio / AWS / Google / GitHub / Anthropic / Slack credential shapes.

## [x] 6.0a · Schema normalization · ghost column sweep · CLOSED · drafted `31ae9e1` · applied 2026-05-26
- **Why:** Dead columns drift the DB shape away from the app's actual contract · the longer they sit the harder it is to tell intentional state from legacy debris.
- **How:** 5-layer dependency check on every column of every `public.bbf_*` table (308 columns across 24 tables): (1) live application code grep · (2) stored functions in public schema · (3) views · (4) foreign-key constraints · (5) triggers + indexes + cross-schema function bodies. A column counts as a ghost only when ALL FIVE layers return zero references AND the column data is either empty or fully null.
- **Done when:** Ghost migration applied · schema introspection re-run reports zero unreferenced columns.
- **Audit findings (this session):**
  - **Pass 1 (app-code grep)** flagged 12 zero-reference candidates after excluding the 36 universal platform columns (id/created_at/updated_at/inserted_at).
  - **Pass 2 (pg_proc public)** eliminated 7 candidates — DB-internal use found:
    - `bbf_pin_attempts.{failed_count, last_attempt_at, locked_until, window_started_at}` — read/written by `bbf_admin_clear_lockout`, `bbf_verify_admin_pin`, `bbf_verify_user_pin`.
    - `bbf_system_config.ceiling_tripped_at` — written by `bbf_check_daily_spend` (Phase 1.4).
    - `bbf_vapi_calls.{call_status, called_at}` — read by `bbf_evaluate_abandoned_carts`, `bbf_evaluate_streaks`.
  - **Pass 3 (views)** zero hits.
  - **Pass 4 (FKs)** zero hits on remaining 5.
  - **Pass 5 (triggers / cross-schema / indexes)** the lone index `idx_bbf_stripe_events_received_at` cascades on column drop · benign (empty table).
- **Confirmed ghost columns (5 total) · drop-safety verified:**

| # | Table | Column | Type | Rows | Non-null | Distinct | Triggers | Views | FKs | Cross-fns | Verdict |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | `bbf_active_clients` | `liability_agreement` | boolean | 5 | 1 (value `true`) | 1 | 0 | 0 | 0 | 0 | DROP · superseded by `liability_cleared` (stripe-webhook writes the active path) |
| 2 | `bbf_meal_macros` | `ingredients_hash` | text | 0 | 0 | 0 | 0 | 0 | 0 | 0 | DROP · cache keys on `name_normalized` instead · never wired up |
| 3 | `bbf_stripe_events` | `received_at` | timestamptz | 0 | 0 | 0 | 0 | 0 | 0 | 0 | DROP · index `idx_bbf_stripe_events_received_at` cascades · `created_at` covers the same semantics |
| 4 | `bbf_users` | `last_login` | timestamptz | 7 | **0 (100% null)** | 0 | 0 | 0 | 0 | 0 | DROP · never populated by any path · login telemetry deferred to Phase 4.4 `bbf_events` |
| 5 | `bbf_vapi_calls` | `vapi_call_id` | text | 0 | 0 | 0 | 0 | 0 | 0 | 0 | DROP · sibling cols stay (used by stored fns) · this one is orphaned |
- **Migration applied (2026-05-26):** `supabase/migrations/20260525240000_bbf_ghost_column_sweep.sql` executed via `mcp__supabase__apply_migration` on operator go-signal. Post-DDL `information_schema.columns` query confirmed all 5 (table, column) pairs are gone · zero rows match.

## [x] 6.0b · Universal lowercase email migration · CLOSED · commit `a3868c7` · 2026-05-26
- **Why:** Case-sensitive email columns are an authentication-bypass / profile-splitting vector: `User@x.com` and `user@x.com` resolving to separate rows breaks idempotency in stripe-webhook, lead-capture, suppression, and every "find user by email" lookup. Engine-level enforcement makes the bypass structurally impossible.
- **How:** (1) Atomic SQL migration: `UPDATE … SET col = LOWER(col)` per email column + permanent `CHECK (col IS NULL OR col = LOWER(col))` constraint per column. (2) Application-layer audit · inject `.toLowerCase().trim()` at every entry point where an email arrives from a user.
- **Done when:** Live `UPDATE … SET col = upper(col)` probe fires `check_violation` on every constrained column · every app entry point lowercases before the DB write.
- **Shipped (this session):**
  - **Migration `20260526010000_bbf_email_lowercase_universal.sql`** applied to prod. 9 columns normalized + locked (`bbf_active_clients.client_email`, `bbf_active_clients.vault_email`, `bbf_email_events.email`, `bbf_lead_actions.lead_email`, `bbf_leads.email`, `bbf_outbound_athletes.email`, `bbf_stripe_events.email`, `bbf_users.email`, `bbf_vapi_calls.client_email`). One was already locked in Phase 1.3 (`bbf_email_suppression.email`) · the schema now has 10 lowercase-email CHECK constraints total. Pre-migration audit: zero rows in any column had `col <> LOWER(col)` · the existing app-layer sanitization had been doing this defensively for a long time. The CHECK is the engine-level lock that prevents future regression.
  - **FK safety**: `bbf_vapi_calls.client_email → bbf_active_clients.client_email` (NO ACTION on update, not deferrable). Migration UPDATEs child first then parent so any future dirty-data re-run produces a clean diagnostic instead of a silent cascade. Today's data is 100% clean so the UPDATE is a no-op.
  - **App-layer audit · 19 email write sites scanned** across `supabase/functions/`, `vision-scout/marketing/`, and `index.js`:
    - **Already sanitized (18 sites)** · `bbf-lead-capture`, `stripe-webhook`, `bbf-lead-concierge`, `marketing/agents/{scout,scout-engine,triage,unsubscribe,dispatcher,analyst}.js`, `marketing/suppression.js`, `index.js /provision` (line 2928) — all explicitly `.trim().toLowerCase()` before any DB call.
    - **Single gap fixed**: `index.js → normalizeClientPayload()` was returning `vault_email: String(b.vault_email || '')` without `.trim().toLowerCase()`. Patched to `String(b.vault_email || '').trim().toLowerCase()` so the upsert into `bbf_active_clients` never hits the engine-level `check_violation` from a mixed-case payload.
- **Validation (this session):**
  - Post-migration `pg_constraint` query confirms all 10 CHECK constraints installed (9 new + 1 from Phase 1.3).
  - Live `UPDATE … SET col = upper(col)` probe on each constrained column · 7 of 9 fire `check_violation` immediately (the other 2 are on empty tables · UPDATE is a no-op, constraint is confirmed installed via `pg_constraint`).
  - `node --check index.js` clean post-patch.
- **Operator note:** Any future Supabase MCP-driven write attempting to insert/upsert a non-lowercase email value now fails immediately with `check_violation` · the engine is the source of truth. App-layer `.toLowerCase().trim()` remains as belt-and-suspenders for cleaner UX (avoids the `check_violation` surfacing to the user).

## [ ] 6.1 · RLS audit on every public table
- **Why:** Closes Tier 1 #10 of the original list. Coverage isn't audited.
- **How:** For each table in `public`, document: who can SELECT, who can INSERT/UPDATE/DELETE, why. Add missing policies. Block anything that should be service-role-only.
- **Done when:** `RLS_AUDIT.md` checked into repo with table-by-table grid; CI fails if a new table is created without an RLS policy.
- **Effort:** 1 day.

## [ ] 6.2 · Signed URLs for storage buckets
- **Why:** `meal-images` bucket is currently fully public.
- **How:** Switch bucket to private. Edge function `bbf-meal-image` returns 1-hour signed URLs instead of raw public URLs. Update client to refresh URLs on expiry.
- **Done when:** Direct enumeration of meal-images bucket URLs returns 403.
- **Effort:** 4 hours.

## [ ] 6.3 · Rate limiting on public endpoints
- **Why:** `/api/v1/marketing/inbound`, `/api/v1/marketing/unsubscribe`, `/scan` (manual) — all could be hammered.
- **How:** Add `express-rate-limit` middleware. 10 req/min per IP on `/inbound` and `/unsubscribe`. 100 req/hour on `/scan` (still admin-gated but defensive).
- **Done when:** Exceeding the limit returns 429.
- **Effort:** 2 hours.

## [ ] 6.4 · Quarterly secret rotation policy
- **Why:** Anthropic, Gemini, Resend, Brevo, Supabase service role, Stripe, ElevenLabs, Vapi — none have a rotation cadence.
- **How:** Documented in `SECRETS.md`. Calendar reminder. Each rotation = update the env in Render + Supabase + restart services.
- **Done when:** Calendar entry exists; first rotation completed.
- **Effort:** 1 hour to document, 1 hour per rotation cycle.

---

# Phase 7 · Compliance + Cleanup (Week 6)

## [ ] 7.1 · GDPR readiness
- **Why:** Closes Tier 1 #9 of the original list. EU recipients need consent, export, and deletion.
- **How:** Geo-filter outbound dispatcher to skip EU country codes (require explicit opt-in for EU). Add `GET /api/v1/user/export` (returns user's data as JSON) and `DELETE /api/v1/user/delete` (soft-deletes + removes from suppression lists). Update privacy.html to reflect AI-driven outreach.
- **Done when:** Test user can export + delete their data via API; EU emails are blocked at dispatch time.
- **Effort:** 1 day.

## [ ] 7.2 · Backups
- **Why:** Single point of failure. If Supabase has a billing/service issue, you lose access.
- **How:** Nightly pg_cron job + Edge function that dumps key tables to a Supabase storage bucket OR external S3. Retain 30 days.
- **Done when:** Test restore from yesterday's backup populates a fresh staging Supabase from scratch.
- **Effort:** 1 day.

## [ ] 7.3 · Decision on Vision Scout
- **Why:** Closes gap #13. Honest call: it's over-built for current need OR commit to it.
- **How:** Three options:
  - Delete `vision-scout/server.js` (keep `vision-scout/marketing/` intact), use Browserless for occasional smoke tests when needed.
  - Bump Render to Standard ($25/mo, 2 GB RAM), remove the fragile Chromium flags, commit to Vision Scout as a real CI tool.
  - Keep current state, accept fragility.
- **Done when:** Decision made and committed in `ARCHITECTURE.md`.
- **Effort:** 1 hour decision + 1 day execution if option (a) or (b).

---

# Phase 8 · Product Depth (Multi-month)

These aren't engineering tasks — they're product strategy. Listed for completeness.

## [ ] 8.1 · Pick a competitive moat
- Outcomes tracking (PR graphs, weight curves, retention) · OR
- Biometric ingest (Apple Health, Garmin, Whoop) · OR
- Real-time coach-client messaging in-app

Whichever you pick, go DEEP. Half-built versions of all three is worse than one polished.

## [ ] 8.2 · Lead sourcing strategy
- Manual research + VA · OR
- Buy a list (Apollo, Hunter) · OR
- Build platform-specific Playwright scrapers as new sources in `marketing/agents/scout-engine.js` SOURCES · OR
- Partner sourcing (gym coaches, race directors)

Pipeline sits idle until this is decided.

## [ ] 8.3 · Agent ROI audit + prune
- Once `bbf_agent_runs` data exists, run a quarterly review. Kill bottom-3 agents by usage. The discipline of pruning makes survivors better.

---

# Phase 9 · Backlog

New gaps discovered after 2026-05-25 go here. Move to a real phase when prioritized.

- [ ] (empty so far · add as found)

---

# Cross-cutting principles

- **No new code without telemetry.** After Phase 0.2, every new agent or worker writes to `bbf_agent_runs`. No exceptions.
- **No new prompt without a registry entry.** After Phase 2.1, prompts are data, not constants.
- **No new public endpoint without rate limiting + RLS audit.**
- **No new feature without measurement.** After Phase 4.4, the answer to "do users use this?" must be queryable.
- **PRs over direct-to-main.** After Phase 5.1, the `develop → main` flow is mandatory.

---

# Done · Won't repeat

Logged so the next agent doesn't re-do completed work.

- [x] Migration · `bbf_outbound_athletes` table (2026-05-23)
- [x] Migration · `bbf_meal_macros` + `bbf_meal_images` (2026-05-23)
- [x] Edge functions · `bbf-meal-macros`, `bbf-meal-image` (2026-05-23)
- [x] Marketing engine · ingest, analyze, dispatch, inbound, unsubscribe, run-orchestrator (commits a755fe4 through 3186acb, 2026-05-24/25)
- [x] node-cron orchestrator at `0 14 * * *` UTC (commit f878aaf)
- [x] DKIM/SPF/DMARC verified on buildbelievefit.fitness (2026-05-24)
- [x] CEO test override (bbf_test_lead → akeemkbrown@gmail.com)
- [x] Triage reply prompt: self-service `/join` close (commit 3186acb)
- [x] db.js lazy re-init + truthful /health snapshot (commits dfba66c, cd4cac4, c9a7910)
- [x] Vision Scout journey/actions framework + Resend low-RAM Chromium flags (commits 23b5c2e, 046fb17)
- [x] Service worker cache bump policy (commit 2f4ea96)

---

# References

- `api/BBF_PASSOVER_2026_05_25.md` — handoff doc for the next AI/dev session
- `vision-scout/marketing/README.md` — marketing engine ops guide
- `api/BIGJIM_V12_DIRECTIVE.md` — founder's V12 architecture vision (historical context)
- `api/CLAUDE_SESSION_HANDOFF.md` — previous Claude session handoffs (historical)
