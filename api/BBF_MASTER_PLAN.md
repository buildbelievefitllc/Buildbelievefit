# Build Believe Fit · Master Plan to Superior Service

**Status:** Living document · update items as they complete · do not delete
**Generated:** 2026-05-25
**Premise:** This plan addresses every gap surfaced in the honest dissection delivered by Claude on 2026-05-25 (see `api/BBF_PASSOVER_2026_05_25.md` § "Dissection scope" for the gap catalog). It's organized by **dependency**, not just impact — Phase 0 unblocks Phase 1, which unblocks Phase 2, etc.

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

## [~] 0.3 · Commit deployed-but-missing edge functions to repo · partial · commit `6916a46` · 2026-05-25
- **Why:** Closes gap #1 (code drift). `bbf-lead-concierge` and `bbf-user-profile` are deployed but never committed.
- **How:** Pull source via `mcp__supabase__get_edge_function`. Save to `supabase/functions/<name>/index.ts`. Commit with note "import drifted production function into repo".
- **Done when:** `ls supabase/functions/` matches the deployed function list with zero drift.
- **Effort:** 30 minutes.
- **Shipped (directory-list sync):** Pulled three deployed-but-not-in-repo functions and committed verbatim — `bbf-lead-concierge`, `bbf-user-profile`, and `bbf_vision_scout` (the third was undocumented in the original passover; slug uses underscores, distinct from the Render `vision-scout` service · Browserless + Claude wrapper). `ls supabase/functions/` now mirrors the 24 ACTIVE deployed functions exactly.
- **Drift detected (REVERSE direction · repo is ahead of deployed):** A subsequent byte-equality audit of all 24 functions surfaced six cases where the REPO has changes that were never pushed via `supabase functions deploy`:
  - `stripe-webhook` · repo has a 49-line doc header + a 21-line trailing TODO about idempotency (the TODO's described follow-up — `bbf_stripe_events` insert with ON CONFLICT — IS already implemented in the deployed code · TODO is stale).
  - `bbf-meal-macros` · structural · repo imports `routeAndLog` from `_shared/model-router.ts`; deployed inlines a hardcoded `claude-haiku-4-5` model id. Repo is an aborted/incomplete model-router refactor.
  - `bbf-meal-image` · repo prepends a 31-line doc header missing from deployed; otherwise body close to deployed.
  - `bbf-sentinel` · repo header `v11 · Sentinel Protocol — TWO modes, single endpoint` vs deployed `v11 · Two-Bin Verifier + Cron Audit`. Repo uses long-form multi-line query chains; deployed has single-line dense form. 546 repo lines vs much fewer deployed.
  - `vapi-sms-closer` · cosmetic typography · repo has em-dashes (—) + middle-dots (·) where deployed has plain hyphens.
  - `bbf-lead-capture` · same em-dash cosmetic drift.
- **What this means:** Phase 0.3 as written assumes one-way drift (deployed→missing-from-repo). The real state is two-way drift: three were missing from repo (now fixed), six have un-deployed local changes. Decision needed per function — deploy repo→prod, revert repo to match prod, or investigate. Do NOT autopilot a `supabase functions deploy` on these without per-function review — `stripe-webhook` and `bbf-meal-macros` in particular sit in critical paths.
- **To close fully:** decide+execute per function (deploy or revert), then re-run the byte-equality audit and confirm zero drift in both directions.

## [ ] 0.4 · Single canonical `ARCHITECTURE.md` at repo root
- **Why:** Closes gap #1 (meta-problem). The 12+ phase-handoff docs in `api/` cause context-loss between AI sessions.
- **How:** New `ARCHITECTURE.md` at repo root: one-page system diagram, table of every component (service, language, deploy target, owner), env var catalog, table-by-table schema brief. Phase docs in `api/` get a "see ARCHITECTURE.md" header.
- **Done when:** Any AI agent (Claude/Gemini/etc.) can read this single file and understand the system in 5 minutes.
- **Effort:** 4 hours.

---

# Phase 1 · Operational Safety (Week 1, Days 3-5)

Do these before pushing any meaningful outbound volume.

## [ ] 1.1 · Cross-system suppression table
- **Why:** Closes gap #3. Today an email could be in both `bbf_leads` (Concierge) and `bbf_outbound_athletes` (Marketing) and receive both flows.
- **How:** `bbf_email_suppression(email PK, source text, reason text, created_at)`. Both `bbf-lead-concierge` and `marketing/agents/dispatcher.js` check it before sending. Honors `unsubscribed_at` from either table.
- **Done when:** A test email added to suppression doesn't receive emails from either system.
- **Effort:** 4 hours.

## [ ] 1.2 · Resend delivery webhook capture (`bbf_email_events`)
- **Why:** Closes the gap from Tier 1 #4 of the original dissection. Without this you're blind to bounce/open/click/complaint rates.
- **How:**
  - Migration: `bbf_email_events(id, provider text, message_id, event_type text, recipient text, occurred_at, meta jsonb, ts)`.
  - Extend `/api/v1/marketing/inbound` to ALSO handle `email.delivered`, `email.bounced`, `email.opened`, `email.clicked`, `email.complained` event types.
  - Configure webhook URL in Resend dashboard → Webhooks → all events.
  - Add `RESEND_WEBHOOK_SECRET` env, verify HMAC on every event.
- **Done when:** A test email's full event chain (sent → delivered → opened) appears as rows in `bbf_email_events`.
- **Effort:** 1 day.

## [ ] 1.3 · HMAC verification on `/inbound`
- **Why:** Today the endpoint is fully public; anyone who finds the URL can burn Gemini tokens.
- **How:** Verify `Svix-Signature` (Resend uses Svix) on every POST. Reject 401 if invalid. `RESEND_WEBHOOK_SECRET` env.
- **Done when:** Curl without signature returns 401. Valid Resend webhook returns 200.
- **Effort:** 2 hours.

## [ ] 1.4 · Cost ceiling + daily alerts
- **Why:** Closes Tier 1 #5. No spending cap; runaway loop could burn $200/night.
- **How:** Daily pg_cron job queries `bbf_llm_calls` (sum cost_usd by provider for last 24h). If >$X for any provider, POST to Slack webhook OR mark a flag in `bbf_agent_runs` that workers check before firing.
- **Done when:** Synthetic test (insert 1000 fake llm_calls rows totaling $500) fires the alert.
- **Effort:** 4 hours.

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

## [ ] 4.1 · Introduce a build pipeline (Vite)
- **Why:** Closes gap #6 (bbf-app.html monolith). Today no bundler, no minification, no automatic cache-busting.
- **How:** Add Vite to repo root. `src/` directory created. Entry point `src/main.js`. Vite emits content-hashed bundles to `dist/`. GitHub Pages serves `dist/`. Service worker cache key derived from build hash, not manual `bbf-v232` strings.
- **Done when:** `npm run build` produces bundled assets; SW cache versioning is automatic; deploy still serves at `buildbelievefit.fitness`.
- **Effort:** 3 days.

## [ ] 4.2 · Design system tokens + primitives
- **Why:** Closes gap #7. Current CSS is "vibes-based".
- **How:** `src/styles/tokens.css` with color/spacing/typography/motion vars only. `src/styles/components.css` with primitives (`.bbf-card`, `.bbf-button-primary`, `.bbf-button-ghost`, `.bbf-input`, `.bbf-pill`). All feature CSS composes from these.
- **Done when:** Grep for hardcoded hex colors / px values in non-token CSS returns zero results.
- **Effort:** 3 days.

## [ ] 4.3 · Split bbf-app.html into per-feature modules
- **Why:** 22k lines in one file is unmaintainable. Closes gap #6.
- **How:** Per-feature directories: `src/nutrition/`, `src/coach/`, `src/concierge/`, `src/cardio/`, `src/admin/`. Each exports a single mount function. The HTML shell becomes a thin router + slot.
- **Done when:** Feature additions/edits happen in a 500-line file, not a 22k-line file.
- **Effort:** 1-2 weeks of focused work. Can be done incrementally (move one feature per PR).

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
