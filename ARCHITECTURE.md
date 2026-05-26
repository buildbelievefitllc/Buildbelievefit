# Build Believe Fit · ARCHITECTURE

**Status:** canonical source of truth for system shape · update inline when you change the system, do not branch this doc
**Companion:** `api/BBF_MASTER_PLAN.md` is the living plan (what to do next) · this doc is the live map (what exists now)
**Generated:** 2026-05-25 · Phase 0.4 closeout

---

## 0 · TL;DR

Build Believe Fit runs on three execution surfaces backed by one Postgres:

| Surface | What runs there | Deploy target |
|---|---|---|
| **Supabase Edge Functions** | 24 Deno-based serverless functions (BBF agents, payment webhook, lead intake, voice integration) | Supabase project `ihclbceghxpuawymlvgi` |
| **Render web service** | `vision-scout` Node 20 monolith · smoke-test scanner + marketing-engine cron (scout/analyst/triage/dispatcher/unsubscribe agents) | `vision-scout` service · Docker · `vision-scout.onrender.com` |
| **Static site** | `public/` storefront (`buildbelievefit.fitness`) and the in-app `bbf-app.html` Vault | GitHub Pages / Cloudflare Pages on `buildbelievefitllc.github.io` + custom domain |

All persistent state lives in Supabase Postgres (24 `public.*` tables). RLS is enabled on every table; writes are restricted to service-role keys held by the edge functions. No app touches the database with the anon key for writes.

External providers: **Anthropic** (Claude · Opus 4.7, Sonnet 4.6, Haiku 4.5) · **Google** (Gemini 3.5 Flash, Imagen 3) · **ElevenLabs** (TTS) · **Stripe** (payment) · **Twilio** (SMS) · **Vapi** (voice agent) · **Brevo** (transactional email) · **Resend** (marketing email) · **Cloudflare Turnstile** (anti-bot) · **Browserless** (headless scan).

---

## 1 · Repo layout

```
/
├── ARCHITECTURE.md              ← THIS FILE · system map
├── api/
│   └── BBF_MASTER_PLAN.md       ← living roadmap · update phases as they complete
├── supabase/
│   ├── functions/               ← 24 edge functions · one dir per function
│   │   ├── _shared/             ← model-router.ts + intel-core.ts shared by multiple fns
│   │   ├── bbf-agentic-*/       ← 11 Claude-driven coaching agents
│   │   ├── bbf-lead-*/          ← Pathfinder/Lite intake + Sovereign Concierge
│   │   ├── bbf-meal-*/          ← Haiku macro lookup + Imagen plate photos
│   │   ├── bbf-sentinel/        ← Two-mode safety verifier + daily roster audit
│   │   ├── stripe-webhook/      ← Payment fulfilment (idempotent · provision + tier set)
│   │   ├── vapi-*/              ← Outbound voice trigger + SMS closer
│   │   └── ...                  ← (full inventory in §4)
│   └── migrations/              ← Supabase-managed migration history
├── migrations/                  ← 16 raw .sql files (some pre-date Supabase CLI · still authoritative for the schemas they touch)
├── vision-scout/                ← Render service · Node 20 / Docker
│   ├── server.js                ← Smoke-test scanner endpoint (Claude Sonnet)
│   ├── marketing/               ← Marketing engine pipeline
│   │   ├── orchestrator.js      ← Daily cron (14:00 UTC) · runs scout→analyst→dispatch
│   │   ├── gemini.js            ← Gemini 3.5 Flash wrapper (thinkingBudget=0)
│   │   ├── resend.js            ← Resend SMTP wrapper
│   │   ├── db.js · router.js · telemetry.js
│   │   └── agents/              ← scout · scout-engine · analyst · triage · dispatcher · unsubscribe
│   ├── package.json             ← Deps: @anthropic-ai/sdk, @supabase/supabase-js, express, playwright, resend, node-cron
│   └── Dockerfile (implied by `runtime: docker` in render.yaml)
├── bbf-app.html                 ← Vault SPA · monolithic HTML (now 19.7K lines, was 26.8K · Phase 2.1 surgical extraction moved styles + peripheral scripts to src/)
├── src/                         ← Phase 2.1 extraction target · loaded by bbf-app.html via <link> / <script src=>
│   ├── styles/
│   │   └── bbf-main.css         ← All 10 originally-inline <style> blocks consolidated · cascade order preserved · unbalanced @media{ braces explicitly closed
│   ├── state/
│   │   └── bbf-auth-engine.js   ← Login + session + PIN flow (formerly <script id="bbf-auth-engine">)
│   └── components/
│       ├── promethean-vault-iife.js   ← Vault mount IIFE (formerly <script id="promethean-vault-iife">)
│       ├── surprise-layer.js          ← Surprise layer IIFE
│       ├── pantheon-layer.js          ← Pantheon layer IIFE
│       └── ultra-instinct-layer.js    ← Ultra-instinct layer IIFE
├── public/                      ← Other static storefront assets
├── voiceover/                   ← Marketing-page audio assets (.mp3)
├── styles/                      ← CSS for the storefront
├── playbooks/                   ← Reference content (programmatic, not docs)
├── docs/                        ← Existing supporting docs (kept · not phase fragments)
├── package.json                 ← Root: bbf-vault-webhook (legacy index.js · Express + Anthropic SDK)
├── render.yaml                  ← Render Blueprint (vision-scout service definition)
└── (api/ also holds: AUTH_TOUCHPOINT_AUDIT.md · RLS_HARDENING_AUDIT.md ·
                       SCHEMA_DRIFT_REPORT.md · SYNC_REROUTE_DESIGN.md · VAPI_DESIGN.md
                       · AG_INTEGRATION_NOTES.md and CLAUDE_CODE_VIDEO_ENHANCEMENT_PROMPT_v2.md
                       at root · these are reference material, not phase fragments)
```

---

## 2 · Database schema (Postgres · 24 tables in `public.*`)

Project ref: `ihclbceghxpuawymlvgi` · RLS enabled on every table · service-role keys are the only writers (per edge function).

### 2.1 Core identity & athlete state

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_users`** | 38 | 7 | Vault accounts · `uid` is the slug (`<firstname>_bbf`), `pin_hash` is bcrypt, `role` ∈ `client \| trainer \| admin` |
| **`bbf_active_clients`** | 26 | 5 | Pre-vault customer record · keyed by `vault_email` · `spectrum_tier`, `onboarding_status`, `liability_cleared`. **stripe-webhook ensures a row before calling `bbf_provision_client_pin`** |
| **`bbf_pin_attempts`** | 5 | 2 | Lockout ledger for PIN failures |
| **`bbf_athlete_progression`** | 16 | 10 | Per-user `sport`, `position`, `phase`, `protocol_completed`, `updated_at` |

### 2.2 Training + biometrics

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_logs`** | 10 | 43 | Session-level workout log · FK `user_id → bbf_users.id` |
| **`bbf_sets`** | 9 | 203 | Per-set tonnage · FK `log_id → bbf_logs.id` + `user_id → bbf_users.id` |
| **`bbf_readiness`** | 6 | 448 | Daily readiness survey · FK `user_id → bbf_users.id` |
| **`bbf_athlete_load_logs`** | 9 | 2 | Session metadata · `athlete_id → bbf_users.id`, `session_timestamp`, `load_au` (arbitrary units) |
| **`bbf_athlete_load_bouts`** | 7 | 2 | Bout-level slices of each log · FK `log_id → bbf_athlete_load_logs.log_id`, `bout_type`, `exercise_name`, `start_timestamp`, `end_timestamp` · **read by bbf-sentinel for ACWR + ATP-PC micro-recovery audits** |

### 2.3 Nutrition

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_meal_logs`** | 14 | 5 | Per-meal client log · FK `user_id → bbf_users.id` |
| **`bbf_meal_macros`** | 16 | 0 | Server-side macro cache · keyed on `name_normalized` · `kcal`, `protein_g`, `carbs_g`, `fat_g`, `confidence`, `source`, plus image columns (`image_url`, `image_generated_at`, `image_prompt_used`). **Populated by bbf-meal-macros (Haiku) and bbf-meal-image (Imagen 3)** |

### 2.4 Lead & payment

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_leads`** | 9 | 4 | Pathfinder/Nutrition Lite intake · `source`, `email`, `full_name`, `phone`, `tier`, `payload jsonb`. **Writes: bbf-lead-capture (service-role only · Turnstile-gated)** |
| **`bbf_lead_actions`** | 13 | 20 | Concierge cooldown ledger + audit · FK `lead_id → bbf_leads.id`. **Writes: bbf-lead-concierge (service-role only)** |
| **`bbf_outbound_athletes`** | 18 | 1 | Marketing-engine target list (scouted prospects). **Writes: vision-scout/marketing/agents/scout.js + dispatcher.js** |
| **`bbf_stripe_events`** | 7 | 0 | Stripe webhook dedup ledger · `event_id` (PK · 23505 = replay). **Writes: stripe-webhook only** |
| **`bbf_vapi_calls`** | 7 | 0 | Vapi call ledger · FK `client_email → bbf_active_clients.client_email` |

### 2.5 Agentic + audit

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_pending_review`** | 16 | 0 | Founder-gated proposal queue · ALL agentic proposals route here · `execution_success` boolean catches silent no-op writes |
| **`bbf_audit_logs`** | 15 | 5 | Unified audit ledger · AUDITOR-style movement audits (`movement_name`, `tension_zone`) coexist with general agentic-action audits (`action_type`, `agent`, `payload`, `result`, `success`). FK `proposal_id → bbf_pending_review.id`, `user_id → bbf_users.id` |
| **`bbf_orchestrator_memory`** | 20 | 0 | Cross-session memory for the agentic orchestrator |
| **`bbf_action_idempotency`** | 6 | 0 | Action-level dedup for the orchestrator |

### 2.6 Observability (Phase 0.2)

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_agent_runs`** | 10 | 5 | One row per agent invocation · `agent`, `run_id`, `started_at`, `finished_at`, `ok`, `summary jsonb`. Marketing pipeline writes here on every invocation |
| **`bbf_llm_calls`** | 15 | 0 | Per-call cost ledger · `model`, `prompt_name`, `input_tokens`, `output_tokens`, `cost_usd`, `latency_ms`. Cost rate card pre-seeded for `claude-opus-4-7`, `claude-sonnet-4-6`, `claude-haiku-4-5`, `gemini-3.5-flash`, `gemini-3.5-pro` |

### 2.6a Email defense + delivery telemetry (Phase 1.1 + 1.3)

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`bbf_email_suppression`** | 3 | 0 | Cross-system do-not-contact ledger · `email TEXT PK` (lowercase enforced via CHECK constraint), `suppressed_at`, `reason`. Reasons: `active_inbound_lead`, `unsubscribed`, `bounced`, `complaint`. **Marketing dispatcher consults this before EVERY send · hits get hard-skipped.** Writers: `marketing/agents/triage.js` (interested + not_interested replies), `marketing/agents/unsubscribe.js` (one-click), `marketing/suppression.js → logEmailEvent` (bounced/complained delivery events) |
| **`bbf_email_events`** | 6 | 0 | Resend delivery webhook flight recorder · `id UUID PK`, `message_id`, `email`, `event_type`, `ts`, `payload jsonb`. Event types: `email.sent / delivered / delivery_delayed / bounced / opened / clicked / complained / failed`. Writer: `marketing/suppression.js → logEmailEvent` (invoked from `/api/v1/marketing/inbound` when payload `type` matches `email.*` and is NOT `email.received`). Powers the delivery diagnostic matrix in `/api/v1/marketing/health` |

### 2.6b Budget kill-switch (Phase 1.4)

| Table / RPC / Cron | Notes |
|---|---|
| **`bbf_system_config`** (single-row, `id=1` CHECK-enforced) | Global config · `emergency_stop BOOLEAN`, `daily_spend_ceiling_usd NUMERIC(10,2) DEFAULT 10.00`, `emergency_stop_reason`, `emergency_stop_at`, `ceiling_tripped_at`, `updated_at`. **Service-role writes only.** Operator-controlled · clear the trip via `UPDATE public.bbf_system_config SET emergency_stop=false, emergency_stop_reason=null, emergency_stop_at=null WHERE id=1;` |
| **`public.bbf_check_daily_spend()`** | Aggregates `sum(cost_usd)` from `bbf_llm_calls` over the last 24h, flips `emergency_stop=true` if it exceeds the ceiling. Returns `{spend_24h_usd, call_count_24h, ceiling_usd, tripped_now, was_stopped, currently_stopped, checked_at}`. Will NOT auto-clear · operator must explicitly acknowledge the trip · prevents flapping. |
| **pg_cron job `bbf_daily_spend_check`** | Runs `select public.bbf_check_daily_spend();` at `5 0 * * *` UTC (daily floor). Orchestrators also call this RPC on every invocation as mid-day defense-in-depth. |
| **Gate helpers** | `supabase/functions/_shared/spend-gate.ts` (Deno · for edge functions) and `vision-scout/marketing/spend-gate.js` (Node · for Render service). Both export `checkSpendGate()` returning `{stopped, reason, spend_24h_usd, ceiling_usd, ...}` with fail-CLOSED posture (DB error → treated as stopped). |
| **Wired into** | `supabase/functions/bbf-agentic-orchestrator/index.ts` (first gate after auth · returns HTTP 429 SpendLimitExceeded via `spendLimitResponse`) · `vision-scout/marketing/orchestrator.js` (aborts the daily scout→analyst→dispatch pipeline before scout fires) · `/api/v1/marketing/health` surfaces current `spend_gate` state to the operator |

### 2.7 Misc

| Table | Cols | Live rows | Notes |
|---|---:|---:|---|
| **`voices`** | 9 | 4 | ElevenLabs voice catalog for bbf-tts-eleven |
| **`content_monarch`** | 6 | 2 | Static content payloads served by the storefront |

### 2.8 Foreign-key topology

```
bbf_users (id) ──┬── bbf_logs.user_id ── bbf_sets.log_id
                 ├── bbf_sets.user_id
                 ├── bbf_readiness.user_id
                 ├── bbf_meal_logs.user_id
                 ├── bbf_athlete_load_logs.athlete_id ── bbf_athlete_load_bouts.log_id
                 ├── bbf_athlete_progression.user_id
                 └── bbf_audit_logs.user_id

bbf_pending_review (id) ── bbf_audit_logs.proposal_id

bbf_leads (id) ── bbf_lead_actions.lead_id

bbf_active_clients (client_email) ── bbf_vapi_calls.client_email
```

### 2.9 Stored procedures used by edge functions

| RPC | Caller | Return shape | Notes |
|---|---|---|---|
| `bbf_provision_client_pin(p_vault_email, p_pin, p_full_name)` | `stripe-webhook` | `{ok:true, username, email, active_client_id}` on fresh; `{ok:false, reason:'already_provisioned', existing_uid}` on re-fire; `{ok:false, reason:'active_client_not_found'}` otherwise | bcrypt-hashes the PIN; generates `<firstname>_bbf` slug with `_2`, `_3`… on collision |
| `bbf_admin_set_tier(p_uid, p_tier)` | `stripe-webhook` | text | Validates tier against allow-list; enforces "akeem locked to sovereign" safety rule |

---

## 3 · Component map · who calls whom

```
                    ┌────────────────────────┐
                    │  Storefront / bbf-app  │  (GitHub Pages)
                    │  index.html · bbf-app  │
                    └────────────┬───────────┘
                                 │ POST (Turnstile token)
                                 ▼
                    ┌────────────────────────┐
   Stripe ───────►  │  bbf-lead-capture      │ ──► bbf_leads + Brevo (admin + lite welcome)
   checkout         │  bbf-lead-concierge    │ ──► bbf_lead_actions + Brevo
   webhook ───────► │  stripe-webhook        │ ──► bbf_stripe_events (dedup)
                    │                        │      → bbf_active_clients ensure-insert
                    │                        │      → bbf_provision_client_pin RPC
                    │                        │      → bbf_admin_set_tier RPC
                    │                        │      → Brevo welcome
                    └────────────────────────┘

   Vapi voice agent ──► vapi-sms-closer ──► Twilio SMS
   ("Lance" closer)     vapi-outbound-trigger ──► Vapi REST API

   In-app (Vault) ────► bbf-meal-macros ──► Claude Haiku 4.5 → cache write
                        bbf-meal-image  ──► Gemini Imagen 3 → storage + cache
                        bbf-tts-eleven  ──► ElevenLabs TTS
                        bbf-user-profile / bbf-co-coach / bbf-agentic-* …

   Cron (08:00 UTC) ──► bbf-sentinel (mode A: roster audit) ──► Zapier webhook
   Server-side agent ─► bbf-sentinel (mode B: verify_proposal · two-bin sort)
   Cron (nightly)   ──► bbf-midnight-haiku (snapshot synthesis)

   Render cron      ──► vision-scout/marketing/orchestrator (14:00 UTC)
   (14:00 UTC)            ├── scout.js (Browserless + Gemini)
                          ├── analyst.js (Gemini · pitch writing)
                          ├── triage.js  (Gemini · inbound classification)
                          └── dispatcher.js (Resend SMTP)

   GitHub push ─────► vision-scout/server.js /scan endpoint
                       (Playwright + Claude Sonnet 4.6 smoke test)
```

---

## 4 · Edge function inventory · 24 functions · AI model routing

Source of truth for model selection: `supabase/functions/_shared/model-router.ts`. Use-case taxonomy fans out to `MODELS.HAIKU` / `MODELS.SONNET` / `MODELS.OPUS` (Anthropic) plus standalone Gemini for image generation.

| # | Function slug | Auth gate | Model · use-case | Purpose |
|---|---|---|---|---|
| 1 | **`bbf-agentic-cardio`** | service-role | Claude Opus 4.7 · `cardiac_intercept` | Cardio routing engine · PAR-Q+-derived risk gating |
| 2 | **`bbf-agentic-comlink`** | service-role | Claude Sonnet 4.6 (hardcoded) · was `novel_form_correction` | Novel kinematic deviation correction (vision-adjacent) |
| 3 | **`bbf-agentic-forecasting`** | service-role | Claude Haiku 4.5 · `forecast_1rm` | Linear-regression 1RM narration |
| 4 | **`bbf-agentic-immersion`** | service-role | Claude Haiku 4.5 · `sport_immersion_seed` | Static sport-immersion content generation |
| 5 | **`bbf-agentic-interrogator`** | service-role | Claude Sonnet 4.6 · `onboarding_interview` | Pathfinder/interrogator dialog |
| 6 | **`bbf-agentic-kinematics`** | service-role | Claude Sonnet 4.6 (`vision:true`) · `kinematic_form_score` | Single-image biomechanics scoring |
| 7 | **`bbf-agentic-linguist`** | service-role | Claude Haiku 4.5 · `i18n_translation` | Language pack rotation (en/es/pt) |
| 8 | **`bbf-agentic-orchestrator`** | service-role | Claude Haiku 4.5 · `snapshot_synthesis` | Athlete snapshot 2-4 sentence digest |
| 9 | **`bbf-agentic-pathfinder`** | service-role | Claude Sonnet 4.6 · `onboarding_interview` | Pathfinder onboarding dialog |
| 10 | **`bbf-agentic-peaking`** | service-role | Claude Haiku 4.5 · `mesocycle_rationale` | Block-priority rewrite narration |
| 11 | **`bbf-agentic-prehab`** | service-role | Claude Sonnet 4.6 · `prehab_assignment` | ACWR + cold-start prehab assignment |
| 12 | **`bbf-co-coach`** | service-role | Claude Haiku 4.5 · `sovereign_brief` | Founder cockpit nightly synthesis |
| 13 | **`bbf-lead-capture`** | anon + Turnstile | none (no LLM) | Pathfinder/Lite intake · writes `bbf_leads` + Brevo admin + lite welcome email |
| 14 | **`bbf-lead-concierge`** | service-role | none (no LLM) | Sovereign Concierge cooldown + reply ledger |
| 15 | **`bbf-meal-image`** | JWT | Google Imagen 3 (`imagen-3.0-generate-002`) | Per-meal photoreal plate generation · uploads to `meal-images` storage bucket · caches `image_url` |
| 16 | **`bbf-meal-macros`** | JWT | Claude Haiku 4.5 · `meal_macros_lookup` | Per-meal macro lookup with cache + LLM fallback |
| 17 | **`bbf-midnight-haiku`** | x-cron-secret | Claude Haiku 4.5 (hardcoded) · matches `snapshot_synthesis` | Nightly summary cron |
| 18 | **`bbf-sentinel`** | x-cron-secret (mode A) · x-bbf-admin-token (mode B) | none (deterministic) | Mode A: daily roster audit (08:00 UTC) → Zapier · Mode B: `verify_proposal` two-bin sort (recoverable vs substantive) for the founder queue |
| 19 | **`bbf-tts-eleven`** | JWT | ElevenLabs (TTS) | Voice-clip generation · reads from `voices` table |
| 20 | **`bbf-user-profile`** | service-role | none (no LLM) | Vault profile read/write helper |
| 21 | **`bbf_vision_scout`** | JWT | Claude Opus 4.7 + Browserless headless scan | Browserless + Claude wrapper (slug uses underscores · distinct from the Render `vision-scout` service) |
| 22 | **`stripe-webhook`** | Stripe signature (HMAC) | none (no LLM) | Payment fulfilment · idempotent (`bbf_stripe_events` 23505 dedup) · ensures `bbf_active_clients` row → `bbf_provision_client_pin` RPC → `bbf_admin_set_tier` RPC → Brevo |
| 23 | **`vapi-outbound-trigger`** | service-role | none (no LLM) | Initiates outbound Vapi voice call |
| 24 | **`vapi-sms-closer`** | optional x-vapi-secret | none (no LLM) | Vapi "Lance" tool · texts Stripe checkout link via Twilio while call is live |

### Model routing rules (from `_shared/model-router.ts`)

| Tier | Model id | Use-cases |
|---|---|---|
| **Haiku** | `claude-haiku-4-5` | `vocab_retry`, `syntax_retry`, `mesocycle_rationale`, `snapshot_synthesis`, `sovereign_brief`, `i18n_translation`, `forecast_1rm`, `sport_immersion_seed`, `meal_macros_lookup` |
| **Sonnet** | `claude-sonnet-4-6` | `kinematic_form_score`, `novel_form_correction`, `onboarding_interview`, `prehab_assignment` · auto-upgrade from Haiku when `vision:true` |
| **Opus** | `claude-opus-4-7` | `parq_assessment`, `wellbeing_escalation`, `cardiac_intercept` · peak reasoning · safety-critical only |

CEO directive: **PAR-Q+ and cardiac routing stay on Opus regardless of cost.** Wellbeing halt + ED triage stay on Opus.

> **Marketing engine note** · the `vision-scout/marketing/*` pipeline runs on **Google Gemini 3.5 Flash**, not Claude, and is governed by a separate determinism standard · see **§5.3 Marketing engine · Gemini hyperparameter standard** for the authoritative `temperature` / `topP` / `topK` / `seed` matrix.

---

## 5 · Render service (`vision-scout`)

Single Docker web service hosting two responsibilities:

### 5.1 `/scan` (smoke-test scanner)
- `vision-scout/server.js` · Express + Playwright + `@anthropic-ai/sdk@^0.32.0`
- Model: `claude-sonnet-4-6` (override via `VISION_MODEL`)
- Triggered by GitHub webhook (`GITHUB_WEBHOOK_SECRET`) on every push
- Loads the prod URL, runs Playwright, sends DOM + console errors to Claude for triage, posts result to Slack/Discord

### 5.2 Marketing engine (`vision-scout/marketing/`)
- Cron: `0 14 * * *` UTC (configurable via `BBF_ORCHESTRATOR_CRON`)
- Pipeline: **scout → scout-engine → analyst → triage → dispatcher → unsubscribe**
- LLM: Google **Gemini 3.5 Flash** (override via `GEMINI_MODEL`) · thinking-budget disabled (the model otherwise eats the visible-output token budget)
- Mail provider: **Resend** (via `marketing/resend.js`)
- Targets table: `bbf_outbound_athletes`
- Telemetry: every agent writes a `bbf_agent_runs` row · analyst + triage also write `bbf_llm_calls` rows with Gemini `usageMetadata`-derived tokens, latency, `finishReason`, USD cost

`render.yaml` is the deploy blueprint · `runtime: docker` · `rootDir: vision-scout` · health check `/health` · auto-deploy on push to `main`.

### 5.3 Marketing engine · Gemini hyperparameter standard (Phase 6.0d)

Authoritative determinism matrix for every live Gemini call inside the marketing pipeline. Set verbatim at each call site; do NOT relax without a corresponding update to this table and a PROMPT_VERSION bump on the affected prompt. The `gemini.js` wrapper forwards `temperature` / `topP` / `topK` / `seed` into `generationConfig` only when the caller passes them, so non-marketing callers (none today) stay on Gemini defaults.

| # | Call site | File | `temperature` | `topP` | `topK` | `seed` | `thinkingBudget` | `maxOutputTokens` | `responseSchema` |
|---:|---|---|---:|---:|---:|---:|---:|---:|---|
| 1 | Intent classifier | `vision-scout/marketing/agents/triage.js` | `0.0` | `1.0` | `1`  | `42` | `0` | `64`   | enum: `interested \| not_interested \| support` |
| 2 | Pitch generation  | `vision-scout/marketing/agents/analyst.js` | `0.2` | `1.0` | `40` | `42` | `0` | `1024` | object: `{ ok, pitch_text, reason }` |
| 3 | Reply drafter     | `vision-scout/marketing/agents/triage.js` | `0.2` | `1.0` | `40` | `42` | `0` | `220`  | (none · free text · banned-filler verified post-hoc) |

**Rationale per lever:**
- **`temperature`** · `0.0` for classification (greedy decode · same input → same label) · `0.2` for generative copy (tight distribution around the top mode while preserving cross-athlete differentiation · was `0.7` pre-Phase 6.0d for the pitch site and `0.6` for the draft site).
- **`topP`** · `1.0` everywhere · delegates the truncation entirely to `topK` so the two levers don't fight (lower `topP` would re-introduce nucleus-sampling variance).
- **`topK`** · `1` on the classifier (collapses sampling to a single deterministic pick) · `40` on the generative sites (wide enough for natural phrasing variation, narrow enough to suppress drift into off-brand vocabulary).
- **`seed`** · `42` everywhere · `gemini-3.5-flash` does not currently honour the seed parameter (it's a no-op on this SKU) but the field is forwarded for forward-compat with Gemini 4.x SKUs that DO honour it. Plumbing it now means future model swaps inherit deterministic-where-supported behavior without code changes.
- **`thinkingBudget`** · `0` everywhere · Gemini 3.x implicit-thinking tokens are subtracted from `maxOutputTokens` so leaving thinking on truncates visible output. Disabled in `gemini.js` for the whole stack.
- **`responseMimeType` + `responseSchema`** · live on calls 1 + 2 · API-enforced structured output so the model literally cannot emit free prose / markdown fences (Phase 6.0c lockdown). Call 3 (reply drafter) intentionally stays free-text because the draft is sent verbatim to the CEO inbox; banned-filler verification (`prompt-armor.verifyNoBannedFiller`) is the post-hoc gate.

**Audit:** to confirm the live config matches this matrix, grep the call sites:
```
grep -nE "temperature:|topP:|topK:|seed:" vision-scout/marketing/agents/{analyst,triage}.js
```

**Drift detection:** the orchestrator's `summary.steps.analyze.tally` (Phase 6.0c) surfaces `verify_rejected` + `model_refused` counts per run · a non-zero `verify_rejected` rate with the locked hyperparams above is a strong signal of either prompt-injection attempts or a server-side model swap, not parameter drift.

**Related error classification (Phase 6.0g):** the resilience layer's retry/fallback classification depends on the `finishReason` field returned alongside Gemini's `gemini_no_text` failures · SAFETY / BLOCKLIST / RECITATION = permanent, null / undefined / OTHER = transient (retryable). Full classification table lives in §5.4 alongside the rest of the resilience contract.

### 5.4 Marketing engine · LLM resilience standard (Phase 6.0e)

`vision-scout/marketing/llm-resilience.js` exports a higher-order `withResilience(primaryFn, fallbackFn, opts)` middleware. Every public `generate()` call inside `gemini.js` is wrapped by it, so every analyst + triage Gemini call inherits retry-with-backoff + fallback-to-pro semantics with zero per-caller code change.

**Retry budget (per Gemini call):**

| Attempt | Delay before (default · jittered ±25%) | Model | Notes |
|---:|---|---|---|
| 1 | `0 ms`     | primary  (`gemini-3.5-flash`) | First shot · no backoff |
| 2 | `1000 ms`  | primary  (`gemini-3.5-flash`) | After 1st retryable failure |
| 3 | `2000 ms`  | primary  (`gemini-3.5-flash`) | After 2nd retryable failure |
| 4 | `4000 ms`  | fallback (`gemini-3.5-pro`)   | Primary exhausted · single fallback shot · uses identical hyperparams + responseSchema |

The backoff curve doubles per attempt (1s → 2s → 4s) capped at `GEMINI_RETRY_MAX_DELAY_MS` (default 8000ms) with a ±25% jitter so multiple concurrent calls don't synchronize their retry timing.

**Error classification:**

| Class | Errors | Action |
|---|---|---|
| Retryable transient | `gemini_timeout`, `gemini_fetch_failed`, `gemini_429`, `gemini_500`, `gemini_502`, `gemini_503`, `gemini_504`, any 5xx status | Backoff + retry up to `maxAttempts` · then fallback |
| Retryable conditional · Phase 6.0g | `gemini_no_text` AND `finishReason ∈ { null, undefined, 'OTHER', <unknown> }` · HTTP 200 with empty body from a transient internal error or an unmapped finish state | Backoff + retry up to `maxAttempts` · then fallback |
| Permanent | `gemini_400`, `gemini_401`, `gemini_403`, `gemini_404`, parse failures · AND `gemini_no_text` with `finishReason ∈ { 'SAFETY', 'BLOCKLIST', 'RECITATION' }` (Phase 6.0g · model REFUSED to emit content for this exact input · retrying always re-blocks · token-burn guard) | Skip retry loop · skip fallback (the same input will fail on fallback too · `fallbackOnPermanent: false` by default) |
| Success | `ok: true` with non-empty text | Return immediately with `attempts` count + `fallback_used: false` |

**Byte-compatibility guarantee:** The fallback path calls `_generateOnce(GEMINI_FALLBACK_MODEL, opts)` with the SAME `opts` object as the primary · same `temperature` / `topP` / `topK` / `seed` (§5.3 matrix) · same `responseSchema` · same `maxOutputTokens` · same `thinkingConfig`. The result shape returned to the caller is identical to a primary success; the only signal that fallback was used is the `fallback_used: true` flag on the augmented return.

**Return shape augmentation:** every `generate()` call now returns the underlying `_generateOnce` result with three additional fields:
- `attempts` · primary attempts made (1 on first-try success · up to `maxAttempts` on exhaustion)
- `fallback_used` · `true` iff the result came from the fallback model
- `retry_history` · `[{ error, status, latency_ms }]` array · one entry per failed primary attempt

**Telemetry surfacing:** `bbf_llm_calls` rows still log the FINAL outcome (one row per `generate()` call, not per retry attempt) · the retry breadcrumb is surfaced in `bbf_agent_runs.summary` as `tally.retried` (count of calls that succeeded after at least one retry) and `tally.fallback_used` (count of calls that ended on the fallback model) for the analyst batch, and as `intent_attempts` / `intent_fallback_used` / `draft_attempts` / `draft_fallback_used` for triage webhook runs.

**Env knobs (all optional · safe defaults):**

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_FALLBACK_MODEL` | `gemini-3.5-pro` | Backup model dispatched after primary exhausts retries |
| `GEMINI_RETRY_MAX_ATTEMPTS` | `3` | Total primary attempts before fallback |
| `GEMINI_RETRY_BASE_DELAY_MS` | `1000` | Delay before the 2nd attempt |
| `GEMINI_RETRY_MAX_DELAY_MS` | `8000` | Cap for any single backoff |

**Escape hatch:** `gemini.js` also exports `generateOnce(opts)` · a single-shot call that bypasses the resilience layer entirely. Reserved for one-shot diagnostic probes (e.g. `/health` endpoint test calls) where retry latency would mask the very signal the operator is probing for. Production code should always use `generate()`.

### 5.5 In-vault agents · Anthropic hardening standard (Phase 6.0j)

The Claude-driven edge functions in `supabase/functions/bbf-agentic-*` + `bbf-co-coach` + `bbf-midnight-haiku` now share a 3-file Deno-side hardening layer at `supabase/functions/_shared/`. Mirror of the marketing-engine pattern from §5.3 + §5.4, adapted to Anthropic's request/response shape.

**The three shared helpers:**

| File | Role | Mirror of |
|---|---|---|
| `_shared/anthropic-armor.ts` | Sanitize / wrap UNTRUSTED user fields in `<context_boundaries>` + `<user_input>` shells · neutralize tag tunneling for the 4-tag reserved set · JSON-Schema → Anthropic `input_schema` adapter · `tool_use` + `text` + `refusal` content-block extractors | `vision-scout/marketing/prompt-armor.js` |
| `_shared/anthropic-resilience.ts` | Retry-with-backoff middleware · per-use-case `FALLBACK_POLICY` · classifies HTTP 429/5xx + `overloaded_error` + network/timeout as retryable, treats 400/401/403/404 + refusal blocks + `stop_reason='refusal'` as permanent | `vision-scout/marketing/llm-resilience.js` |
| `_shared/anthropic-call.ts` | The canonical `callClaude(args)` entrypoint that ties armor + resilience together · routes via `model-router.routeAndLog` · returns `{ ok, text\|toolInput, usage, model, stop_reason, attempts, fallback_used, retry_history }` | `vision-scout/marketing/gemini.js → generate()` |

**Per-use-case fallback policy (`FALLBACK_POLICY` in `anthropic-resilience.ts`):**

| Use-case tier | Primary | Fallback on transient | Rationale |
|---|---|---|---|
| Haiku-tier (`vocab_retry`, `syntax_retry`, `mesocycle_rationale`, `snapshot_synthesis`, `sovereign_brief`, `i18n_translation`, `forecast_1rm`, `sport_immersion_seed`, `meal_macros_lookup`) | `claude-haiku-4-5` | `claude-sonnet-4-6` | Escalate up the tier ladder · transient Haiku failure rescued by Sonnet |
| Sonnet-tier (`kinematic_form_score`, `novel_form_correction`, `onboarding_interview`, `prehab_assignment`) | `claude-sonnet-4-6` | `claude-opus-4-7` | Escalate further · vision + onboarding pathways tolerate Opus cost on rescue |
| Opus-tier (`parq_assessment`, `wellbeing_escalation`, `cardiac_intercept`) | `claude-opus-4-7` | `null` (NO fallback) | CEO directive · safety-critical · do NOT demote · retry on Opus, accept failure if Anthropic is fully down |

**Structured-output enforcement (vs Gemini's `responseSchema`):**

Anthropic's equivalent of Gemini's API-enforced JSON output is `tools` + `tool_choice: { type: 'tool', name: <toolName> }`. When `callClaude({ toolSchema, toolName })` is supplied, the helper:
1. Wraps the JSON schema via `toAnthropicInputSchema()` (pass-through adapter today · the chokepoint for future Anthropic-specific schema massaging).
2. Sends `tools: [{ name, description, input_schema }]` + `tool_choice: { type: 'tool', name }` so Anthropic forces a `tool_use` block in the response.
3. Extracts `tool_use.input` via `extractToolUseBlock()` and returns it as `result.toolInput`.

The model literally cannot emit prose / markdown / commentary outside the tool call · no `JSON.parse(text)` defensive code needed at the caller.

**Retry budget (per call · default):**

| Attempt | Delay | Model | Notes |
|---:|---|---|---|
| 1 | `0 ms`    | primary  | First shot · routes via `routeAndLog(agentTag, useCase)` |
| 2 | `1000 ms` | primary  | After 1st retryable failure (±25% jitter) |
| 3 | `2000 ms` | primary  | After 2nd retryable failure |
| 4 | `4000 ms` | **fallback** OR none | Per-use-case `FALLBACK_POLICY` · Opus-tier returns the last error with full `retry_history` |

**Tag tunneling defense:** the same 4-tag reserved set as `prompt-armor.js` (`user_input`, `system_constraints`, `context_boundaries`, `system_instruction`) · open + close variants both stripped to `[REDACTED_TAG]` before user content reaches the model.

**Refusal-block detection:** when Anthropic returns a `refusal` content block (safety system response · newer API versions) OR `stop_reason: 'refusal'`, the helper classifies it as PERMANENT · no retry · no fallback · returns `{ ok: false, error: 'anthropic_refusal', detail: <reason> }`. Same input would re-block on fallback, so token-burn is prevented.

**Agent adoption matrix (Phase 6.0j):**

| Agent | Status | Notes |
|---|---|---|
| `bbf-co-coach` | ✓ Phase 6.0j v13 deployed | Canonical conversion · sovereign_brief use case · tool_use with `submit_co_coach_analysis` schema |
| `bbf-agentic-orchestrator` | ☐ pending §6.0h-followup | snapshot_synthesis use case · v8 deployed for Phase 6.0i soft-delete filter only |
| `bbf-midnight-haiku` | ☐ pending §6.0h-followup | sovereign_brief / snapshot_synthesis hybrid · nightly cron |
| `bbf-agentic-cardio` | ☐ pending §6.0h-followup | cardiac_intercept · Opus-tier · NO fallback policy |
| `bbf-agentic-pathfinder` | ☐ pending §6.0h-followup | onboarding_interview |
| `bbf-agentic-interrogator` | ☐ pending §6.0h-followup | onboarding_interview |
| `bbf-agentic-prehab` | ☐ pending §6.0h-followup | prehab_assignment |
| `bbf-agentic-forecasting` | ☐ pending §6.0h-followup | forecast_1rm |
| `bbf-agentic-kinematics` | ☐ pending §6.0h-followup | kinematic_form_score · vision flag |
| `bbf-agentic-comlink` | ☐ pending §6.0h-followup | novel_form_correction |
| `bbf-agentic-immersion` | ☐ pending §6.0h-followup | sport_immersion_seed |
| `bbf-agentic-peaking` | ☐ pending §6.0h-followup | mesocycle_rationale |
| `bbf-agentic-linguist` | ☐ pending §6.0h-followup | i18n_translation |

Each pending agent is a single-session conversion · adopt `callClaude({ useCase, system, userFields, toolSchema?, maxTokens, ... })` and delete the local fetch-to-Anthropic boilerplate.

---

## 6 · Environment variable catalog

### 6.1 Supabase Edge Function secrets (32 distinct)

Set via `supabase secrets set NAME=value --project-ref ihclbceghxpuawymlvgi`.

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | all edge fns | Auto-injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | all edge fns that write | Auto-injected · bypasses RLS |
| `SUPABASE_ANON_KEY` | (rare · only for client-issuing edge fns) | Auto-injected |
| `ANTHROPIC_API_KEY` | every `bbf-agentic-*`, `bbf-co-coach`, `bbf-meal-macros`, `bbf-midnight-haiku`, `bbf_vision_scout` | Anthropic API access |
| `GEMINI_API_KEY` | `bbf-meal-image` | Google Generative Language API (Imagen 3) |
| `ELEVENLABS_API_KEY` | `bbf-tts-eleven` | ElevenLabs TTS |
| `STRIPE_API_KEY` | `stripe-webhook` | Stripe secret/restricted key |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | `whsec_…` for HMAC signature verify |
| `BREVO_API_KEY` | `bbf-lead-capture`, `stripe-webhook` | Brevo transactional API |
| `BREVO_FROM_EMAIL` | `bbf-lead-capture`, `stripe-webhook` | Default `buildbelievefitllc@buildbelievefit.fitness` |
| `BREVO_FROM_NAME` | `bbf-lead-capture`, `stripe-webhook` | Default `Build Believe Fit` |
| `ADMIN_LEAD_NOTIFY_EMAIL` | `bbf-lead-capture` | Default `buildbelievefitllc@buildbelievefit.fitness` |
| `TURNSTILE_SECRET_KEY` | `bbf-lead-capture` | Cloudflare Turnstile siteverify |
| `TWILIO_ACCOUNT_SID` | `vapi-sms-closer` | Twilio API |
| `TWILIO_AUTH_TOKEN` | `vapi-sms-closer` | Twilio API |
| `TWILIO_PHONE_NUMBER` | `vapi-sms-closer` | Twilio "from" number |
| `VAPI_API_KEY` | `vapi-outbound-trigger` | Vapi REST API |
| `VAPI_ASSISTANT_ID` | `vapi-outbound-trigger` | Default Vapi assistant id |
| `VAPI_SALES_ASSISTANT_ID` | `vapi-outbound-trigger` | "Lance" sales agent id |
| `VAPI_PHONE_NUMBER_ID` | `vapi-outbound-trigger` | Vapi-managed phone number id |
| `VAPI_SHARED_SECRET` | `vapi-sms-closer` | Optional x-vapi-secret header value |
| `BBF_VAPI_INVOKE_TOKEN` | `vapi-outbound-trigger` | Caller auth for outbound trigger |
| `CRON_SECRET` | `bbf-sentinel`, `bbf-midnight-haiku` | x-cron-secret header value |
| `BBF_MIDNIGHT_CRON_TOKEN` | `bbf-midnight-haiku` | Secondary cron auth |
| `BBF_COACH_AGENT_TOKEN` | `bbf-sentinel` (mode B) | x-bbf-admin-token for `verify_proposal` |
| `BBF_ADMIN_TOKEN` | admin-gated reads | Shared with Render proxy for admin operations |
| `BBF_RENDER_PROXY_ORIGIN` | (cross-call) | Render base URL when edge fn calls into the proxy |
| `ZAPIER_WEBHOOK_URL` | `bbf-sentinel` (mode A) | RED-zone alert outbound |
| `BROWSERLESS_TOKEN` | `bbf_vision_scout` | Headless browser session |

### 6.2 Render env vars (`vision-scout` service)

Defined in `render.yaml` (`sync: false` means stored in Render secret manager; `value:` means committed default).

| Variable | Source | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret | Claude calls (smoke scan) |
| `GEMINI_API_KEY` | secret | Gemini calls (marketing pipeline) |
| `RESEND_API_KEY` | secret | Outbound marketing email |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | All Supabase writes from this service |
| `BBF_MARKETING_ADMIN_TOKEN` | secret | `/api/v1/marketing/*` admin gate · SHA-256 + `timingSafeEqual` compare (Phase 0.1 hardening) |
| `GITHUB_WEBHOOK_SECRET` | secret | GitHub-webhook signature verify on `/scan` |
| `SCAN_API_KEY` | secret | Manual-invoke gate on `/scan` |
| `SLACK_WEBHOOK_URL` | secret | Smoke-scan + marketing alerts |
| `DISCORD_WEBHOOK_URL` | secret | Alternative alert sink |
| `SUPABASE_URL` | value (committed) | `https://ihclbceghxpuawymlvgi.supabase.co` |
| `PROD_URL` | value | `https://buildbelievefit.fitness` |
| `VISION_MODEL` | value | `claude-sonnet-4-6` |
| `GEMINI_MODEL` | value | `gemini-3.5-flash` |
| `PLAYWRIGHT_TIMEOUT_MS` | value | `30000` |
| `ANTHROPIC_TIMEOUT_MS` | value | `60000` |
| `BBF_FROM_NAME` | value | `Akeem Brown` |
| `BBF_FROM_EMAIL` | value | `buildbelievefitllc@buildbelievefit.fitness` |
| `BBF_REPLY_TO` | value | `buildbelievefitllc@buildbelievefit.fitness` |
| `BBF_BUSINESS_ADDRESS` | value | `Build Believe Fit · USA` |
| `BBF_UNSUB_BASE_URL` | value | `https://vision-scout.onrender.com` |
| `BBF_ORCHESTRATOR_CRON` | value | `0 14 * * *` |
| `BBF_ORCH_ANALYZE_BATCH` | value | `25` |
| `BBF_ORCH_DISPATCH_BATCH` | value | `25` |
| `BBF_SCOUT_USE_DEMO_SEEDS` | value | `false` |
| `BBF_TELEMETRY_DISABLED` | (optional, default off) | Set `true` to silence telemetry writes |
| `GEMINI_TIMEOUT_MS` | (optional, default 30000) | Gemini call timeout |
| `GEMINI_THINKING_BUDGET` | (optional, default 0) | Override the disabled-thinking default |
| `GEMINI_FALLBACK_MODEL` | (optional, default `gemini-3.5-pro`) | Phase 6.0e · backup model used by `llm-resilience.js` when primary exhausts retries · see §5.4 |
| `GEMINI_RETRY_MAX_ATTEMPTS` | (optional, default `3`) | Phase 6.0e · total primary attempts before fallback dispatch |
| `GEMINI_RETRY_BASE_DELAY_MS` | (optional, default `1000`) | Phase 6.0e · delay (ms) before 2nd retry attempt · doubles per subsequent attempt |
| `GEMINI_RETRY_MAX_DELAY_MS` | (optional, default `8000`) | Phase 6.0e · ceiling (ms) for any single retry backoff |
| `RESEND_WEBHOOK_SECRET` | **secret · REQUIRED** | Phase 1.3 · Svix-format webhook signing secret (`whsec_<base64>`) · `/api/v1/marketing/inbound` returns 503 when unset, 401 on signature failure. Set in Resend dashboard → Webhooks → Signing Secret, paste into Render env, redeploy |

### 6.3 Browser-exposed credential surface · the only one that exists

| File | Contents | Why this is safe |
|---|---|---|
| `env.js` (root, served as a `<script src="env.js">` by `bbf-app.html`) | `window.ENV_SUPABASE_URL` = canonical project URL · `window.ENV_SUPABASE_KEY` = `sb_publishable_…` | The `sb_publishable_*` prefix is Supabase's NEW publishable key format (the replacement for the old anon-JWT). It has zero service-role privileges and is **specifically designed for browser exposure**. RLS protects every table; the publishable key cannot bypass it. **DO NOT** ever replace this with an `sb_secret_*` or a service_role JWT · those go in Supabase function secrets / Render env only. |

### 6.4 Credential audit posture (Phase 2.2 sweep · 2026-05-25)

Multi-pass `grep` sweep across all 172 tracked source files returned **zero hardcoded high-privilege credentials**. Every server-side credential reference flows through `process.env` (Node) or `Deno.env.get` (Deno). The 11-pattern class checked: JWT 3-segment (`eyJ.<base64>.<base64>`), `sb_secret_*`, `sk_live_/sk_test_/rk_live_/rk_test_`, `whsec_*`, `re_*`, `AIza*`, `AKIA*`, `sk-ant-*`, `ghp_/gho_/ghu_/github_pat_*`, `AC<32hex>` Twilio SIDs, `xkeysib-*` Brevo. The 17,544-line inline script inside `bbf-app.html` was scanned with the full pattern set independently · zero matches. See MASTER_PLAN.md §6.0 for the audit log.

---

## 7 · Schema migrations

Two parallel sources today (consolidation is a Phase 2 item):

- `migrations/` — 16 raw `.sql` files, oldest dated 2025-12-13. Authoritative for the schemas they introduce; manually applied via the SQL editor before Supabase-CLI adoption.
- `supabase/migrations/` — Supabase-CLI-managed; newer migrations land here (e.g. `20260525200000_bbf_observability_backbone.sql` for Phase 0.2).

When adding new schema, prefer `supabase/migrations/` and a CLI-driven workflow.

---

## 8 · How to use this document

- **Adding a table:** add a row to §2.x (pick the right subsection), add it to the FK topology diagram if it joins anything, name the writer edge fn.
- **Adding an edge function:** add a row to §4, set the auth gate, set the model / use-case (if Claude, add the tag to `_shared/model-router.ts` first), add any new env vars to §6.1.
- **Adding a Render env var:** add an entry to `render.yaml` AND to §6.2.
- **Changing model routing:** edit `_shared/model-router.ts` (the routing table is at line 55) AND update §4 + §4 routing rules subsection.
- **The next-action list lives in `api/BBF_MASTER_PLAN.md`** · keep this map descriptive, keep that doc prescriptive.
