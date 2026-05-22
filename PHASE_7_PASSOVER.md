# OPERATION PANTHEON · PHASE 7 PASSOVER

**Sovereign Handoff Document · Phases 0-6 Closed Clean · Phase 7 Ready**

---

## EXECUTIVE STATUS

| Field | Value |
|---|---|
| **HEAD hash** | `997cf74` (Phase 6 close) |
| **Branch (production)** | `main` (origin/main) |
| **Branch (dev)** | `claude/affectionate-cray-2DbMe` |
| **SW cache version** | `bbf-v213` |
| **Phases live** | 0, 1, 2, 3, 4, 5, 6 (all closed clean) |
| **Phase 7 status** | Ready · plan defined · directive pending |

**Phase 6 commit pushed to `origin/main` directly. No PR flow this cycle.**

---

## THE SIX PHASES (1-Line Summary Each)

| Phase | Title | Headline Deliverable |
|---|---|---|
| **0** | Foundation | Single-writer `BBF_CNS_AGENT` · `bbf_pending_review` proposal queue · `BBF_OT_PROMPT` 27-rule vocab sanitizer · `/api/proposal-submit` chokepoint |
| **1** | Prehab Keystone | `BBF_PREHAB_INTEL` coordinator · ACWR per-region via `BBF_DATA` · forecasting v5 cold-start lock |
| **2** | Athlete Portal | `BBF_ATHLETE_INTEL` coordinator · bifurcation · comlink positional drill · stateful queue |
| **3** | Smart Cardio | `BBF_CARDIO_INTEL` coordinator · antagonism rules · PAR-Q+ cardiac safety · cold-start gate |
| **4** | Program Tab | `BBF_PROGRAM_INTEL` · PHANTOM EYE kinematic schema · Sustained-Redline cascade · Hypertrophy Heatmap · Autonomous Periodization (forecasting v6 + peaking v6 with restructure proposal staging) |
| **5** | Nutrition Tab | `BBF_NUTRITION_INTEL` · `bbf_meal_logs` transient table · portion-confidence loop · IF-aware Wellbeing Guardrail · Sunday Macro Reconciliation via Midnight Haiku v2 · NAED resource integration |
| **6** | Connective Layer | `BBF_ORCHESTRATOR` · Two-Speed (Fast Path arbiter + Slow Path Athlete Snapshot synthesis) · `bbf_orchestrator_memory` + `bbf_action_idempotency` · Sentinel v11 Two-Bin Verifier · Greenline Digest · "Am I Free?" gauge · Sovereign Rollback |

---

## ARCHITECTURAL CONTRACTS (Six Inviolable Rules)

These are load-bearing across every phase. Any new code MUST honor all six:

1. **Single-writer CNS.** `cns_friction_score`, `biomechanical_redline`, `somatic_cognitive_load` are mutated ONLY by `BBF_CNS_AGENT._write()` (gated by a `_WRITE_TOKEN` generated via `crypto.getRandomValues()` at module load). All external mutations go through `BBF_CNS_AGENT.propose*Update()` methods which validate ranges, fan out to 3-D state, bump `_rev`, and dispatch `bbf:cns:updated`.

2. **ACWR canonicalized.** ACWR is computed ONLY via `BBF_DATA.computeACWR()` (Gabbett 2016 running-mean form). No consumer tab computes it locally.

3. **CNS listener install.** Every agentic tab installs the `bbf:cns:updated` listener in its `ensureListener()` and re-renders on `detail.uid === activeUid`.

4. **Founder approves structural changes.** No agent writes directly to `bbf_users` / `bbf_active_clients` / `bbf_athlete_progression`. All structural mutations route through `/api/proposal-submit` → `bbf_pending_review` → founder approval → `/api/proposal-approve` executor with explicit zero-row `.select()` confirmation.

5. **OT vocab injection + sanitization.** Every LLM call injects `BBF_OT_PROMPT.systemContext()`. Every LLM output passes through `BBF_OT_PROMPT.sanitize()` or `passThrough()` at TTS / render / log boundaries.

6. **Audit everything.** Every agentic action writes to `bbf_audit_logs` via `/api/audit-log` with `action_type`, `agent`, `target_uid`, `payload`, `success`, `error_message`.

**Phase 6 added a 7th contract (not yet universally enforced):**

7. **Idempotency + Sentinel-gated submission.** Every proposal SHOULD flow through `BBF_ORCHESTRATOR.submitProposal()` for idempotency dedup + Sentinel v11 two-bin verification + episodic memory recording. **Currently OPT-IN, not enforced. Phase 7's primary goal is to make it MANDATORY.**

---

## THE 10 INVIOLABLE RULES (from original Pantheon handoff · still in force)

1. Never mutate `cns_friction_score` / `biomechanical_redline` / `somatic_cognitive_load` outside `BBF_CNS_AGENT`.
2. Never compute ACWR outside `BBF_DATA.computeACWR`.
3. Always install the `bbf:cns:updated` listener on new agentic tabs.
4. Never auto-write to `bbf_users` / `bbf_active_clients` / `bbf_athlete_progression` from an agent. Route through `/api/proposal-submit`. Founder approves structural changes.
5. Always inject `BBF_OT_PROMPT.systemContext()` into LLM calls.
6. Always run `BBF_OT_PROMPT.sanitize()` at TTS / render boundaries.
7. Never remove the `.select()` zero-row confirmation on the proposal executor.
8. Never enable `FUNCTIONAL_MATRIX` until verified content is seeded.
9. Never let AI infer cardiac risk. PAR-Q+ is the only path.
10. Always bump the SW cache version on commits touching HTML/JS/CSS.

---

## DEPLOYED EDGE FUNCTIONS (Production State as of Phase 6 close)

| Function | Version | Status | Notes |
|---|---|---|---|
| `bbf-agentic-prehab` | v6 | ACTIVE | Phase 1 · cold-start ACWR forecaster |
| `bbf-agentic-cardio` | v5 | ACTIVE | Phase 3 · routing engine · PAR-Q+ gated |
| `bbf-agentic-comlink` | v6 | ACTIVE | Phase 4 · constraint + friction + positional_drill + **form_correction** intents |
| `bbf-agentic-forecasting` | v6 | ACTIVE | Phase 4 · 1RM trajectory + **OT signal** computation + peaking fan-out |
| `bbf-agentic-peaking` | v6 | ACTIVE | Phase 4 · CNS intercept + **restructure intent** · stages to queue |
| `bbf-agentic-kinematics` | v4 | ACTIVE | Phase 6 of prior arc · single-image form scoring |
| `bbf-agentic-immersion` | v4 | ACTIVE | Pre-Pantheon · sport-immersion training |
| `bbf-agentic-linguist` | v4 | ACTIVE | Pre-Pantheon · i18n |
| `bbf-agentic-pathfinder` | v3 | ACTIVE | Pre-Pantheon · TDEE-fueled onboarding |
| `bbf-agentic-interrogator` | v3 | ACTIVE | Pre-Pantheon · onboarding interview |
| `bbf-midnight-haiku` | **v2** | **ACTIVE · DEPLOY DEFERRED** | Phase 5 logic live; **Phase 6 orchestrator-fan-out committed but NOT deployed**. Source is v3; production is v2. **Redeploy required to activate nightly Athlete Snapshot synthesis.** |
| `bbf-sentinel` | **v13** | ACTIVE | Phase 6 · cron audit preserved + NEW `verify_proposal` intent (two-bin sorting) |
| `bbf-agentic-orchestrator` | **v1** | ACTIVE | Phase 6 NEW · Slow Path synthesis + `compute_greenline_patterns` |
| `bbf-co-coach` | v7 | ACTIVE | Sovereign brief surface |
| `bbf-tts-eleven` | v5 | ACTIVE | Julius (fitness) + Kelli LaShae (nutrition) |
| `bbf-user-profile` | v1 | ACTIVE | Cross-device dietary hydration |
| `bbf-lead-capture` | v10 | ACTIVE | Pathfinder intake → Brevo |
| `bbf-lead-concierge` | v1 | ACTIVE | 24/7 re-engagement worker (pg_cron 09:00 UTC) |
| `bbf-tts-eleven` | v5 | ACTIVE | TTS gateway |
| `stripe-webhook` | v17 | ACTIVE | Stripe events |
| `vapi-*` | — | ACTIVE | VAPI suite (3 fns) |

**Action required at next session boot:** Redeploy `bbf-midnight-haiku` to v3 to activate the nightly orchestrator-synthesis fan-out. The source code is in `supabase/functions/bbf-midnight-haiku/index.ts` at `997cf74` and is ready; only the deploy call is missing.

---

## DATABASE SCHEMA STATE (Tables Material to Pantheon)

| Table | Phase Created | Notes |
|---|---|---|
| `bbf_users` | pre-Pantheon · extended every phase | Single source of truth for athlete state. Columns include: `id` (uuid), `uid` (slug), `subscription_tier`, `baseline_status`, `block_priority`, `cardiac_clearance`, `cns_friction_score`, `biomechanical_redline`, `somatic_cognitive_load`, `tdee_target`, `macro_p/c/f`, `nutrition_plan`, `ghost_intervention_needed`, `ghost_flagged_at`, `daily_brief`, `par_q_screened_at`, `auto_lock_enabled`, `access_status` |
| `bbf_active_clients` | pre-Pantheon | Plan + meal_plan assignments |
| `bbf_athlete_progression` | Phase 2 (prod-only · no local migration) | Mesocycle + phase state |
| `bbf_logs` | baseline | Session events |
| `bbf_sets` | baseline (extended Phase 2/5) | Per-set telemetry · `user_id, log_id, set_number, reps, weight_lbs, rpe, day_key, exercise_key` |
| `bbf_athlete_load_logs` | pre-Pantheon | ACWR aggregate input |
| `bbf_athlete_load_bouts` | pre-Pantheon | Per-bout telemetry · ATP-PC tracking |
| `bbf_readiness` | pre-Pantheon | Daily readiness · `sleep_quality, soreness_level, score, timestamp` |
| `bbf_pending_review` | Phase 0 (prod-only · no local migration) | The proposal queue. CHECK constraint allows 25 `proposal_type` values (24 + `nutrition_target_recalc` added Phase 5). 7 `status` values: `pending, approved, rejected, executed, execution_failed, expired, withdrawn`. |
| `bbf_audit_logs` | Phase 0 (extended) | Agentic action ledger |
| `bbf_meal_logs` | **Phase 5** | Transient daily intake · NEVER routed to audit. 14 columns including `portion_confidence`, `vision_payload`, `metadata`. RLS: anon insert + select. |
| `bbf_orchestrator_memory` | **Phase 6** | Episodic decision ledger. 20 columns including `arbitration_result`, `sentinel_verdict`, `pattern_hash`, `founder_response`, `negative_learning`, `cns_snapshot_at_proposal/decision`. 4 indexes. RLS: anon insert/select/update. |
| `bbf_action_idempotency` | **Phase 6** | sha256-keyed dedup table. Primary key = idempotency_key. `expires_at` TTL with anon-delete-where-expired policy. |

**Local migration files (chronological):**
- `migrations/2026-05-21_phase5_meal_logs_and_nutrition_target_recalc.sql`
- `migrations/2026-05-22_phase6_orchestrator_memory_and_idempotency.sql`

**Production-only schemas not captured locally:** `bbf_pending_review`, `bbf_athlete_progression`, extended `bbf_audit_logs` columns (`action_type`, `agent`, `target_uid`, `payload`, `result`, `success`, `error_message`).

---

## CRITICAL FILE LOCATIONS (Line Numbers as of `997cf74`)

| Module | File · Line | Purpose |
|---|---|---|
| `BBF_DATA` | `bbf-data.js:1210` | Canonical ACWR + JOINT_REGIONS + MUSCLE_GROUPS + classifiers |
| `BBF_CNS_AGENT` | `bbf-app.html:11837` (approx · may have shifted) | Single-writer CNS state |
| `BBF_OT_PROMPT` | `bbf-app.html:12261` | 27-rule vocab sanitizer + `systemContext()` |
| `BBF_PREHAB_INTEL` | `bbf-app.html:13071` | Phase 1 coordinator |
| `BBF_ATHLETE_INTEL` | `bbf-app.html:13377` | Phase 2 coordinator |
| `BBF_CARDIO_INTEL` | `bbf-app.html:13865` | Phase 3 coordinator |
| `BBF_PROGRAM_INTEL` | `bbf-app.html:14313` | Phase 4 coordinator |
| `BBF_NUTRITION_INTEL` | `bbf-app.html:14935` | Phase 5 coordinator |
| `BBF_ORCHESTRATOR` | `bbf-app.html:15645` | **Phase 6 master coordinator · 766 lines** |
| `BBF_INTERCEPT` | `bbf-app.html:~15753` | First-click education + `rateLimit()` for retry budgeting |
| `BBF_KINEMATICS` | `bbf-app.html:~15601` | Single-image form scoring |
| `BBF_NUTRITION_TRACKER` | `bbf-app.html:~17886` | Meal-plan check tracking |
| `BBF_VISION_COACH` | `bbf-app.html:~17987` | Nutrition vision scanner |
| `renderTrainerDashboard` | `bbf-app.html:8893` | Founder admin entry. **Phase 6 panels (`#orchestrator-gauge`, `#orchestrator-greenline`) injected here.** |
| `renderAdminAuditFeed` | `bbf-app.html:9165` | Audit feed in admin dashboard |
| `RDW` | `bbf-app.html:~17375` | Program tab render · Phase 4 Hypertrophy Heatmap hook here |
| `RN` | `bbf-app.html:~19222` | Nutrition tab render · Phase 5 daily-panel + wellbeing-evaluation hook here |
| `SVS` | `bbf-app.html:~17660` | Set saved · Phase 4 `bbf:set:completed` dispatch here |
| `CWO` | `bbf-app.html:~17713` | Mark session complete · cloud sync |
| WS message router | `bbf-app.html:~10710` | `_lcAttachWsHandlers` · Phase 4 `kinematic-event` + Phase 5 `nutrition-vision-event` routes here |

**Render proxy (`index.js`):**
- `PROPOSAL_TARGET_WHITELIST` at line ~1877 (defines which `bbf_users`/`bbf_active_clients`/`bbf_athlete_progression` columns proposals can mutate)
- `_sanitizeProposalDiff` at line ~1906
- `POST /api/proposal-submit` at line ~1939
- `POST /api/proposal-approve` at line ~2032 (the executor with explicit `.select()` zero-row check)
- `POST /api/proposal-reject` at line ~2143
- `POST /api/audit-log` at line ~2180

**Edge functions (TypeScript):**
- `supabase/functions/bbf-agentic-orchestrator/index.ts` — Phase 6 NEW · 387 lines
- `supabase/functions/bbf-sentinel/index.ts` — Phase 6 v11 · 546 lines · imports `_shared/intel-core.ts`
- `supabase/functions/bbf-midnight-haiku/index.ts` — Phase 5/6 · 840 lines · **source v3 · production v2**
- `supabase/functions/_shared/intel-core.ts` — shared ACWR + risk classifier

---

## THE DIAGNOSIS · Five Real Problems Identified

After Phase 6 ship, an honest review surfaced these load-bearing gaps:

1. **The orchestrator is opt-in, not load-bearing.** Phase 4/5 coordinators (`BBF_PROGRAM_INTEL`, `BBF_NUTRITION_INTEL`, etc.) still POST directly to `/api/proposal-submit`. Idempotency, Sentinel verify, and memory capture only fire for callers who opt in. **~80% of actual proposal traffic bypasses the Phase 6 safety layer.** This is the biggest gap.

2. **Cost concentrated in the wrong calls.** No model-tier discipline. Forecasting + peaking + comlink all use Opus 4.7. Forecasting fires per-PB-click; comlink form_correction fires per-novel-deviation. System prompt caching not audited for actual hit rate. Slow Path nightly synthesis fans out per-user instead of batching.

3. **Pattern hash too coarse for Greenline trust.** `sha256(action_type | tier | fields_sorted)` means an 8% macro cut and a 35% macro cut hash identically. After 5 approves of the gentle pattern, Greenline would happily batch-approve a severe cut. Pattern hash needs magnitude-binned input.

4. **Fail-open Sentinel is wrong for safety-critical paths.** When Sentinel is unreachable, orchestrator submits anyway with `verdict='not_verified'`. Audit is loud but no one reads audit logs in real time. Should fail-CLOSED for `tier ∈ {safety, vulnerable}`, fail-open for `performance`.

5. **Stale revalidation lives in the wrong layer.** `checkStaleAndDegrade()` runs only when the founder approves through the BBF UI. Any call to `/api/proposal-approve` from curl, automation, or future external integration bypasses the check. The stale-data gate belongs in the executor, not the client.

---

## PHASE 7 GAME PLAN · Four Workstreams · ~6 Weeks of Build

Detailed in the chat session that produced this passover. Top-line:

### Workstream A · The Chokepoint (Week 1 · Highest Leverage · **PHASE 7 PRIMARY**)
Make the orchestrator unbypassable. Move idempotency + conflict resolution + Sentinel verify + memory recording INTO the Render proxy `/api/proposal-submit` handler. Make `/api/proposal-approve` re-validate against current CNS state server-side. Fail-CLOSED on safety/vulnerable tiers. Deprecate direct coordinator submission paths.

### Workstream B · Cost Discipline (Week 2)
Build `BBF_MODEL_ROUTER` mapping (intent, complexity, urgency, tier) → model. Push Forecasting + Comlink + Peaking from Opus to Haiku/Sonnet where appropriate. Batch the Slow Path via Anthropic Batch API. Audit system-prompt cache hit rates. Estimated 60-70% Anthropic spend reduction.

### Workstream C · The Closed Loop (Weeks 3-4)
Magnitude-binned pattern hash. Wire Athlete Snapshot into Sovereign Intelligence Brief. Negative-learning auto-suppression on 3+ rejects per pattern. Greenline confidence intervals. Actionable sub-metrics on "Am I Free?" gauge.

### Workstream D · Resilience & 24/7 Posture (Weeks 5-6)
IndexedDB optimistic local proposal queue. Real circuit breaker on Sentinel. pg_cron orchestrator heartbeat. Automatic rollback loop detection. Full world-snapshot capture for true state restoration. Single-pane-of-glass founder cockpit.

---

## PHASE 7 DIRECTIVE · WORKSTREAM A · THE CHOKEPOINT

**Primary goal:** Make `BBF_ORCHESTRATOR.submitProposal()` the only path that exists. Every proposal — frontend coordinator, edge function, future external automation — flows through one server-side pipeline.

**Concrete deliverables for Phase 7:**

### Task 1 · Move Idempotency + Conflict + Sentinel into Render proxy

Refactor `/api/proposal-submit` in `index.js`:
```
Receive proposal payload
  → Compute idempotency_key server-side (sha256, don't trust client-supplied keys)
  → Lookup bbf_action_idempotency · if duplicate, return 409 with original proposal_id
  → Insert idempotency row with TTL
  → Fetch current CNS snapshot via service-role
  → Check bbf_pending_review for in-flight collisions (same uid + target_table + overlapping fields)
  → Apply priority hierarchy · if incoming tier ≤ existing, return 409 suppressed
  → Call bbf-sentinel verify_proposal
  → IF sentinel.verdict === 'substantive': INSERT with risk_level='critical' + sentinel_flag
  → IF sentinel.verdict === 'recoverable': return 422 with sentinel.reason (client re-fires Claude)
  → IF sentinel.verdict === 'clean' || (verdict === 'not_verified' AND tier === 'performance'): INSERT
  → IF sentinel unreachable AND tier ∈ {safety, vulnerable}: return 503 fail_closed
  → Record memory row in bbf_orchestrator_memory
  → Return proposal
```

### Task 2 · Move Stale Revalidation into the Executor

Refactor `/api/proposal-approve` in `index.js`:
```
Receive approve request (id, approver)
  → Fetch proposal · must be status=pending
  → Fetch target user's current CNS snapshot via service-role
  → Compare proposal.metadata.cns_snapshot_rev vs current._rev
  → IF drift > 3 OR (now - proposal.proposed_at) > 6 hours:
        UPDATE proposal SET status='stale_hold' (new status value)
        Record memory row with is_stale_at_decision=true
        Return 409 stale_holds_required_recompute
  → Else proceed with existing executor logic (the .select() zero-row check stays intact)
  → Record memory row with founder_response='approve', founder_actor=approver
```

Add `'stale_hold'` to the `bbf_pending_review.status` CHECK constraint via migration.

### Task 3 · Refactor Coordinators to Dispatch Events

Sweep all six coordinators (`BBF_PREHAB_INTEL`, `BBF_ATHLETE_INTEL`, `BBF_CARDIO_INTEL`, `BBF_PROGRAM_INTEL`, `BBF_NUTRITION_INTEL`, and the in-flight callers in `bbf-app.html`). Replace direct `fetch(_renderProxyOrigin() + '/api/proposal-submit')` calls with `BBF_ORCHESTRATOR.submitProposal(action)` OR `window.dispatchEvent(new CustomEvent('bbf:proposed:action', { detail: action }))`. The orchestrator already listens; the existing call sites just need their POSTs swapped for the event dispatch or method call.

Priority order for refactor (highest safety risk first):
1. `BBF_CARDIO_INTEL.proposeCardioStructureChange()` (cardiac · critical)
2. `BBF_NUTRITION_INTEL.triggerWellbeingHalt()` (ED escalation · critical)
3. `BBF_NUTRITION_INTEL.proposeMacroRecalc()` (numeric targets)
4. `BBF_PROGRAM_INTEL.proposeMesocycleRestructure()` (block priority)
5. `BBF_PREHAB_INTEL` proposals
6. `BBF_ATHLETE_INTEL` proposals

### Task 4 · Edge Function Refactor Too

The edge functions that stage proposals server-side also bypass the orchestrator:
- `bbf-agentic-forecasting` v6 → `bbf-agentic-peaking` v6 (fan-out for restructure proposals)
- `bbf-midnight-haiku` v3 (Sunday macro recalc proposals)

For Phase 7, these should call `/api/proposal-submit` which (after Task 1) will be the chokepoint — so they inherit the safety properties without further changes. Verify each edge function still works after the proxy refactor; the contract from the edge fn's perspective should be unchanged (still POST to `/api/proposal-submit`, still get `{ ok, proposal }` back), but now with idempotency + Sentinel + memory automatic.

### Task 5 · Backward Compatibility Bridge

Add a deprecation warning header to the legacy direct-POST path:
```
res.set('Deprecation', 'true');
res.set('Sunset', '<future date>');
res.set('Link', '<https://...orchestrator-docs>; rel="successor-version"');
```

Log every legacy direct POST loudly so the founder can see which call sites still need refactor.

---

## TACTICAL ROADMAP · 6-WEEK FULL EXECUTION

| Week | Workstream | Outcome |
|---|---|---|
| 1 | **A · Chokepoint** | Orchestrator becomes load-bearing. Phase 6 safety properties universalize. |
| 2 | B · Cost Discipline | Anthropic spend cut 60-70%. |
| 3 | C.1 · Pattern hash fix | Greenline becomes trustworthy. |
| 3 | C.2-3 · Snapshot consume + negative learning | Slow Path closes the loop. |
| 4 | C.4-6 · Confidence intervals + actionable gauge | Founder workload metrics become real. |
| 5 | D.1-3 · Failure containment + circuit breaker + heartbeat | System survives outages. |
| 6 | D.4-6 · Rollback automation + world snapshot + cockpit | System is unattended-safe. |

**End state after 6 weeks:** Sub-$50/day Anthropic bill at 50-athlete scale. Founder workload < 15 min/day on the cockpit. System uptime through arbitrary single-component failures.

---

## READY-FOR-PHASE-7 CHECKLIST (Boot Verification)

The next agent MUST verify all of these before writing any Phase 7 code:

- [ ] `git log -1 --oneline` returns `997cf74` (or `997cf74` is in the recent history)
- [ ] `git branch --show-current` returns `claude/affectionate-cray-2DbMe` OR `main`
- [ ] `head -20 sw.js` shows `var CACHE = 'bbf-v213';`
- [ ] `grep -n "var BBF_ORCHESTRATOR" bbf-app.html` returns one hit (~line 15645)
- [ ] `grep -n "var BBF_NUTRITION_INTEL" bbf-app.html` returns one hit (~line 14935)
- [ ] `grep -n "var BBF_PROGRAM_INTEL" bbf-app.html` returns one hit (~line 14313)
- [ ] Migration files present: `migrations/2026-05-22_phase6_orchestrator_memory_and_idempotency.sql`, `migrations/2026-05-21_phase5_meal_logs_and_nutrition_target_recalc.sql`
- [ ] Edge function source files present: `supabase/functions/bbf-agentic-orchestrator/index.ts`, `supabase/functions/bbf-sentinel/index.ts` (v11)
- [ ] Supabase production state: tables `bbf_orchestrator_memory` and `bbf_action_idempotency` exist with RLS enabled
- [ ] **Outstanding deploy:** `bbf-midnight-haiku` source is v3 but production is v2. Redeploy required to activate nightly orchestrator-synthesis fan-out. **This is non-blocking for Phase 7 but should be scheduled.**

---

## NOTES FOR PHASE 7 EXECUTION POSTURE

- **Commit posture:** Direct to `main` per prior phases. No PR flow.
- **SW cache:** Bump `bbf-v213` → `bbf-v214` on any HTML/JS/CSS-touching commit.
- **Render proxy redeploy:** Phase 7 Task 1 modifies `index.js`. The founder controls the Render redeploy. Commit the changes; document the redeploy gap in the commit message clearly.
- **Supabase MCP:** All migrations via `apply_migration` (idempotent). All edge fn deploys via `deploy_edge_function`. Both work fine for Phase 7.
- **Backward compatibility:** Existing coordinator direct-POST paths must KEEP WORKING during the refactor window. The chokepoint adds intelligence; it doesn't break existing flows.

---

## END OF PASSOVER

The Pantheon is six phases deep. The Connective Layer is built. Phase 7 is about making it *unbypassable*. After Phase 7, every other improvement compounds off the single server-side chokepoint.

**The next session inherits a production system mid-flight. The foundation is load-bearing. Build on top of it · do not bypass it.**

— Phase 6 close · `997cf74` · `2026-05-22`
