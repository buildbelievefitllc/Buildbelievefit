# BBF Pantheon · Sovereign Handoff Document

> **Operation Pantheon · Phases 0 → 3 · Cross-session handoff**
> Authored by the closing agent · context window at critical capacity.
> The next agent reads THIS document FIRST before touching code.

---

## 🎯 Section 0 · Session State at Handoff

| Field | Value |
|---|---|
| **Repository HEAD** | `cf39737` |
| **Branch** | `main` (direct commits · no PR flow this cycle) |
| **Service Worker version** | `bbf-v210` |
| **Phases shipped** | 0 (Foundation) · 1 (Prehab Keystone) · 2 (Athlete Portal) · 3 (Smart Cardio) |
| **Phases pending** | 4 (Program Tab) · 5 (Nutrition Tab Guardrails) |
| **Database state** | All Pantheon migrations applied · listed below |
| **Edge function status** | 4 active deployments · versions below |
| **Sandbox** | Render auto-deploys `main` · GitHub Pages serves the marketing site + bbf-app.html |

**Verify state on next-session bootstrap:**
```bash
git log -1 --oneline                    # Expect: cf39737 feat(pantheon-phase-3): Smart Cardio…
grep "var CACHE" sw.js                  # Expect: bbf-v210
```

---

## 🏛️ Section 1 · The Phase 0 Contract (LOAD-BEARING · DO NOT VIOLATE)

Every downstream tab MUST honor these four contracts. Violations break the agentic architecture.

### 1.1 The Single-Writer Rule

**`BBF_CNS_AGENT` is the SOLE authorized writer of three canonical CNS fields:**

- `bbf_users.cns_friction_score` (numeric · 0-100)
- `bbf_users.biomechanical_redline` (boolean)
- `bbf_users.somatic_cognitive_load` (numeric · 0-10)

Enforcement: a `_WRITE_TOKEN` is generated at module-load via `crypto.getRandomValues()`. Only the internal `_write()` function holds the token. External callers MUST use the public propose-methods, which validate ranges THEN route through `_write`:

```js
// Public API · the ONLY external write paths
BBF_CNS_AGENT.proposeSystemicUpdate(uid, { cns_friction_score, somatic_cognitive_load })
BBF_CNS_AGENT.proposeLocalizedUpdate(uid, { biomechanical_redline, region_alerts })
BBF_CNS_AGENT.proposeAxialUpdate(uid, { posture_load, axial_compression_flag })
```

Any direct write to those three columns from outside `BBF_CNS_AGENT` is a contract violation. The console will log `[BBF_CNS_AGENT] write blocked · invalid token` on attempts.

### 1.2 The 3-D State Object

Per-uid state is structured into three dimensions:

```js
{
  Systemic: {
    cns_friction_score:      0-100 | null,
    somatic_cognitive_load:  0-10  | null,
    computed_at:             ISO timestamp
  },
  Localized: {
    biomechanical_redline:   boolean,
    region_alerts:           { [joint_region]: any },   // gated by BBF_DATA.JOINT_REGIONS
    computed_at:             ISO timestamp
  },
  Axial: {
    posture_load:            number | null,
    axial_compression_flag:  boolean,
    computed_at:             ISO timestamp
  },
  _rev:                      monotonic integer
}
```

**Reads happen ONLY via `BBF_CNS_AGENT.snapshot(uid)`** — returns a deep-cloned copy. Consumers cannot mutate by reference. No direct localStorage reads of those fields outside the agent.

### 1.3 The `bbf:cns:updated` Event Listener (REQUIRED)

Every consumer tab that makes agentic decisions MUST honor mid-session state changes:

```js
window.addEventListener('bbf:cns:updated', function(e) {
  if (e.detail.uid !== currentlyViewedUid) return;
  // dimension: 'Systemic' | 'Localized' | 'Axial'
  // changes: { [field]: { before, after } }
  // rev: integer · monotonically increasing
  // ts: epoch ms
  reSnapshotAndReRender();
});
```

Phase 1 wires this in `BBF_PREHAB_INTEL.ensureListener()` · Phase 2 reuses the contract · Phase 3 reuses the contract. **Phase 4 and Phase 5 MUST install the same listener pattern when they render.**

### 1.4 The `bbf_pending_review` Approval Queue

ALL agentic mutations route through this queue. **NEVER auto-write to bbf_users / bbf_active_clients / bbf_athlete_progression from an agent.**

**Submit path:**
```
POST /api/proposal-submit  (admin-token-gated · X-BBF-Admin-Token header)
```

**Body schema:**
```js
{
  proposal_type: 'phase_advancement' | 'cardio_structure_change' | 'program_swap' |
                 'nutrition_swap' | 'cns_intervention' | 'redline_override' |
                 'adaptive_drill_candidate' | 'transient_swap' |
                 'block_priority_shift' | 'youth_load_progression' |
                 // ...full list in the migration · 23 values total
  risk_level: 'low' | 'medium' | 'high' | 'critical',
  population: { uids:[], cohort:'single'|'youth_athlete'|... },
  diff: {
    target_table: 'bbf_users' | 'bbf_active_clients' | 'bbf_athlete_progression',
    target_uid:   '<text slug · lowercased>',
    before:       {...} | null,
    after:        {...},   // ONLY whitelisted fields · executor enforces
    fields:       [...]
  },
  rationale: '...',         // required · founder reads this
  proposed_by: 'BBF_PREHAB_INTEL.v1' | 'BBF_ATHLETE_INTEL.v1' | 'bbf-agentic-forecasting.v1' | ...,
  metadata: { ...whatever_helps_the_founder_decide }
}
```

**Executor safeguard (`/api/proposal-approve`):** writes use `.select()` to force PostgREST to return the affected row. `execution_success` flips true **ONLY** when at least one row comes back. Zero rows → `status='execution_failed'`, `execution_error='write_affected_zero_rows'`. **NO silent HTTP 200 stubs anywhere on the write path.** This is the load-bearing safeguard from Task 1 of the original directive.

**PROPOSAL_TARGET_WHITELIST** (in `index.js` · Render proxy) explicitly lists every column an agent can mutate per table. Anything else in `diff.after` is silently dropped server-side. Updating the whitelist requires a Render redeploy.

**Endpoints reference:**
- `POST /api/proposal-submit` · creates row
- `POST /api/proposal-list` · admin reads queue (filter by status)
- `POST /api/proposal-approve` · executes write with confirmation
- `POST /api/proposal-reject` · marks rejected with reason
- `POST /api/audit-log` · generic AI-action audit ingester

All four are admin-token gated. Origin-allowlisted to the marketing/app domains.

---

## 🛡️ Section 2 · The O.T. Guardrails

### 2.1 `BBF_OT_PROMPT.systemContext(opts)` · Client-Context Injection

Every LLM call across the agentic fleet MUST inject the OT reasoning frame into `client_context` or the equivalent system block:

```js
// Frontend call site pattern
const systemContext = BBF_OT_PROMPT.systemContext({
  scope: 'fitness' | 'nutrition' | ...,
  clientFirstName: '<name>'
});
// Inject into the LLM request alongside your task-specific prompt.
```

The frame enforces three OT principles in every model response:

1. **MEANINGFUL OCCUPATION** — what the athlete must be able to do in life/sport beyond the gym floor
2. **GRADED PROGRESSION** — every change scales from current capacity, never aspirational target
3. **ADAPTIVE COMPENSATION** — friction patterns are MODIFIED (substitute / regress / change tempo), not pushed through, not diagnosed

The frame also enforces the vocabulary contract — the banned-term list below — at the prompt level.

### 2.2 The Deterministic Banned-Term Vocabulary Filter

`BBF_OT_PROMPT.sanitize(text, opts)` runs a 27-rule ordered substitution chain. **Longer compound phrases run first** so `injury risk` is caught before `injury`. Every match is recorded with a `label` for audit.

**Sample replacements (full table in `BBF_OT_PROMPT.getBanList()`):**

| Banned | Replacement |
|---|---|
| `injury risk` | `load alert` |
| `chronic pain` | `recurring friction` |
| `chronic condition` | `recurring pattern` |
| `acute injury` | `fresh load incident` |
| `dysfunction(s)` | `friction detected` |
| `pathology` | `pattern variance` |
| `diagnose(d/s)` | `flag(ged/s)` |
| `diagnosis` | `assessment note` |
| `patient(s)` | `athlete(s)` |
| `therapy` | `restoration` |
| `therapist` | `restoration coach` |
| `treatment(s)` | `protocol(s)` |
| `disease(s)` | `condition(s)` |
| `symptom(s)` | `signal(s)` |
| `prognosis` | `projected arc` |
| `illness` | `low-state` |
| `clinical(ly)` | `precise(ly)` |
| `disord(er/ered)` | `variance` |

**Where the filter is enforced (THREE LAYERS · defense in depth):**

1. **TTS boundary** — `BBF_TTS.speak()` runs every utterance through `sanitize()` before the edge fn synthesizes audio. Clinical vocabulary cannot reach the user's speakers regardless of which model produced the text (Gemini Live · Anthropic · templated copy · all caught).
2. **Edge function output** — `bbf-agentic-prehab` v6 and `bbf-agentic-cardio` v2 both run the **same 27-rule sanitizer server-side** on `name / duration / focus / reason / modality / protocol / roi_toast` fields. Clinical vocabulary cannot escape the edge function regardless of what Claude phrased.
3. **Audit trail** — every substitution emits `action_type='vocab_sanitize'` to `bbf_audit_logs` with the count + labels caught. Search SQL: `SELECT * FROM bbf_audit_logs WHERE action_type='vocab_sanitize' ORDER BY created_at DESC;`

**`BBF_OT_PROMPT.passThrough(text, opts)`** is the convenience wrapper that returns the sanitized string directly · use at any render boundary you control.

---

## 🚀 Section 3 · Live Edge Functions

All four are ACTIVE in Supabase Edge Functions. `verify_jwt: false`. All admin-token gated where applicable. All run their own OT vocab sanitizer where they emit text.

| Edge Function | Active Version | Purpose |
|---|---|---|
| `bbf-agentic-comlink` | (existing · v1 pre-Pantheon) | Phase 7 friction/constraint/positional_drill router · the Athlete Portal novel-case LLM fallback (deterministic table now runs client-side in `BBF_ATHLETE_INTEL.transientSwap`) |
| `bbf-agentic-prehab` | **v6** (Phase 1 v3 spec) | Prehab Keystone · 5-protocol deterministic table fires FIRST · Claude only for novel cases · OT system frame injected · 27-rule vocab filter server-side · audits `prehab_protocol_select` |
| `bbf-agentic-forecasting` | **v5** (Phase 1) | Cold-start lock on `baseline_status='valid'` · per-region ACWR using BBF_DATA's Gabbett math · structural changes (deload / block shift) → `bbf_pending_review` proposal · advisory-only outputs return inline |
| `bbf-agentic-cardio` | **v2** (Phase 3) · version 5 ACTIVE | Smart Cardio · antagonism arbitration · cardiac safety routing (no AI cardiac inference) · 6-rule transient downgrade table · OT vocab sanitizer · audits `cardio_protocol_select` |

**Plus six pre-existing edge functions still in production** (untouched by Pantheon):
- `bbf-lead-capture` · Pathfinder intake + Brevo notifications
- `bbf-tts-eleven` · ElevenLabs voice gateway (Julius / Kelli LaShae)
- `bbf-user-profile` · cross-device dietary hydration
- `bbf-lead-concierge` · 24/7 lead re-engagement worker (pg_cron daily 09:00 UTC)
- `stripe-webhook` · Stripe payment events
- Other pre-Pantheon agentic functions

**Diag probes available on most:**
```
GET https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/<fn-name>?diag=1
```

---

## 📐 Section 4 · Canonical Data Module (`bbf-data.js` + `BBF_DATA`)

### 4.1 ACWR · Single Source of Truth

```js
BBF_DATA.computeACWR(bouts, opts)              // pure Gabbett running-mean
BBF_DATA.acwrForUserRegion(uid, region, opts)  // async · 5-min cache
BBF_DATA.classifyExerciseToRegion(name)        // 10-pattern regex chain
BBF_DATA.computeBaselineStatus(uid)            // 'building' | 'valid'
BBF_DATA.invalidateCache(uid)                  // admin cache bust
```

**Acute window**: 7 days · **Chronic window**: 28 days · **Baseline gate**: ≥14 days of chronic load required before ratio is computed (otherwise returns `zone:'baseline_building'`).

**Zones:** `detraining` (ratio=0) · `undertrained` (<0.8) · `optimal` (0.8-1.3) · `caution` (1.3-1.5) · `overload` (>1.5).

**`BBF_DATA.JOINT_REGIONS`** is the canonical 8-region taxonomy: `['shoulder','elbow_wrist','spine','hip','knee','ankle','core','systemic']`. Every consumer tab classifies exercises via `classifyExerciseToRegion()` — never invent a region.

**HARD RULE:** any future codebase grep for `acwr` or `acute` outside `bbf-data.js` is drift. Phase 4 and Phase 5 must consume from BBF_DATA.

### 4.2 Lifecycle Enums

```js
BBF_DATA.BASELINE_STATUS   = { BUILDING, VALID, EXPIRED }
BBF_DATA.BLOCK_PRIORITIES  = { MAINTENANCE, RECOVERY, HYPERTROPHY, STRENGTH, PEAKING, REHAB }
BBF_DATA.CARDIAC_CLEARANCE = { UNVERIFIED, SELF_ATTESTED, PROVIDER_CLEARED, RESTRICTED, CONTRAINDICATED }
```

These map 1:1 to columns on `bbf_users`:
- `bbf_users.baseline_status` (text · default 'building')
- `bbf_users.block_priority` (text · default 'maintenance')
- `bbf_users.cardiac_clearance` (text · default 'unverified')

---

## 🗂️ Section 5 · Pantheon Coordinator IIFEs (cheat sheet for new agent)

All coordinators live in `bbf-app.html`. The Phase 4 / 5 work should follow the same coordinator pattern.

| Coordinator | Owns | Public API highlights |
|---|---|---|
| `BBF_PREHAB_INTEL` (Phase 1) | CNS snapshot read · readiness gate · damper · regression floor · forecast invocation | `evaluate(uid)` · `readinessForToday(uid)` · `damperCheck(uid)` · `applyRegressionFloor(mult, opts)` · `runForecast(uid, opts)` · `reportLocalizedFriction(uid, region_alerts)` |
| `BBF_ATHLETE_INTEL` (Phase 2) | Matrix bifurcation · youth lock · ACWR + cold-start fork · positional comlink · queue routing | `readiness(uid)` · `transientSwap(input)` · `proposePhaseAdvancement(opts)` · `proposeAdaptiveDrillCandidate(opts)` · `loadCeilingForUid(uid)` · `applyLoadCeiling(uid, mult)` · `isYouth(uid)` |
| `BBF_CARDIO_INTEL` (Phase 3) | Antagonism arbitration · PAR-Q+ · cardiac routing · transient downgrade · structural-change queue | `evaluate({ uid, minutes, modality })` · `submitPARQScreen(uid, answers)` · `hasValidPARQ(uid)` · `proposeCardioStructureChange(opts)` · `PAR_Q_QUESTIONS` constant |

**Support modules:**
- `BBF_CLOUDSYNC` · admin escape-hatch upserts to `bbf_users` (Phase 22 fix · used by all coordinators for cloud writes when they don't go through the queue)
- `BBF_FEATURE_FLAGS` · `{ functional_matrix_enabled: false, athlete_intel_v2_enabled: true, positional_comlink_enabled: true }`
- `FUNCTIONAL_MATRIX` · 2D adaptive/elderly skeleton · **ships EMPTY + flagged OFF** · 8 documented profile keys reserved · flip the flag only when verified content is seeded

---

## 🗄️ Section 6 · Database Schema State

### 6.1 Tables introduced/extended in Pantheon

```sql
-- Phase 0
public.bbf_pending_review        -- typed approval queue · 23 proposal_types
public.bbf_audit_logs            -- extended with action_type/agent/proposal_id/target_uid/payload/result/success/error_message
public.bbf_users                 -- extended with baseline_status, cardiac_clearance, block_priority

-- Phase 2
public.bbf_athlete_progression   -- extended with mesocycle_started_at, mesocycle_week, target_phase,
                                 --   phase_history (jsonb), rpe_avg_last_3, friction_avg_last_3,
                                 --   guardian_consent (boolean default false), guardian_consent_at

-- Phase 3
public.bbf_users                 -- extended with par_q_screen (jsonb), par_q_screened_at
public.bbf_pending_review        -- proposal_type CHECK extended to include cardio_structure_change
```

### 6.2 Proposal type enum (load-bearing CHECK constraint)

```
program_swap · program_create · program_progress
nutrition_swap · nutrition_rotate · nutrition_macro_adjust
cardio_prescription · cardio_intensity_shift · cardio_structure_change
prehab_assignment · prehab_escalation
athlete_evolution · baseline_recompute
cns_intervention · redline_override
block_priority_shift · tier_upgrade · provision_override
roster_action · custom
phase_advancement · adaptive_drill_candidate · transient_swap · youth_load_progression
```

When Phase 4 / 5 add proposal types, they must extend this CHECK via migration (drop + recreate pattern).

### 6.3 RLS state

All Pantheon tables enable RLS with **NO** anon/auth policies (deny-by-default). Writes only via service-role through the Render proxy / edge functions. `bbf_leads` and `bbf_stripe_events` were locked down in the pre-Pantheon RLS hardening commit.

---

## 🎯 Section 7 · PENDING OBJECTIVES (Next Session Targets)

### 🟡 Phase 4 · Program Tab Evolution

**Status:** NOT STARTED. The Program tab is the workout-prescription surface — the actual lift execution UI. Phases 0-3 built the supporting infrastructure; Phase 4 ports the Program tab onto the canonical contracts.

**Likely scope (CEO will issue the directive · pre-plan recommendation):**

- **Task A** — Program tab consumes `BBF_CNS_AGENT.snapshot()` + `bbf:cns:updated` listener for live re-render on Somatic Matrix submits
- **Task B** — Set logging must respect `BBF_PREHAB_INTEL.applyRegressionFloor()` for any agentic load reduction · per-set audit emission via `/api/audit-log`
- **Task C** — Phase advancement triggers (e.g., "ready to move to next mesocycle") MUST go through `BBF_ATHLETE_INTEL.proposePhaseAdvancement()` · NEVER auto-write `bbf_athlete_progression`
- **Task D** — Workout swap requests route through `BBF_ATHLETE_INTEL.transientSwap()` first (deterministic), Claude only as fallback via the existing `bbf-agentic-comlink` edge fn
- **Task E** — Youth load ceiling (`BBF_ATHLETE_INTEL.applyLoadCeiling`) enforced at every weight-progression CTA · 1.03x for youth_athlete tier · 1.05x for adults
- **Task F** — Block priority (`bbf_users.block_priority`) drives the program-week structure · maintenance/recovery/hypertrophy/strength/peaking/rehab determines default rep ranges + accessory volume

**Probable schema additions:** none required at the foundation level · the existing `bbf_athlete_progression` carries the mesocycle state. May need a `bbf_program_blocks` table if the directive wants explicit week-by-week block definitions.

**Probable new proposal types:** `program_swap` and `program_progress` already exist in the enum from Phase 0 · no migration needed unless new types surface.

### 🟢 Phase 5 · Nutrition Tab Guardrails

**Status:** NOT STARTED. The Nutrition tab already has substantial wiring (Sovereign meal rotator from earlier · BBF_DIETARY editor · AI Profile Diagnostic · Pathfinder pipeline · 40-meal library filter). Phase 5 layers the Pantheon contracts on top.

**Likely scope (CEO will issue the directive · pre-plan recommendation):**

- **Task A** — Allergen safety lock: any nutrition LLM call must enforce the allergen array as a HARD filter server-side · the existing whitelist filter in `bbf-agentic-rotation` already does this · Phase 5 likely adds defense-in-depth
- **Task B** — Macro adjustments must go through `/api/proposal-submit` with `proposal_type='nutrition_macro_adjust'` for any TDEE shift > 10% from the Pathfinder baseline
- **Task C** — `BBF_OT_PROMPT.passThrough()` enforcement on every Chef on Call / Nutrition Vision text output (the existing TTS boundary already catches it · Phase 5 may add the on-screen text rendering boundary too)
- **Task D** — Add Nutrition coordinator IIFE `BBF_NUTRITION_INTEL` matching the prehab/athlete/cardio pattern · single-writer for nutrition-side proposals · event listener for `bbf:cns:updated` to surface low-CNS days as "recovery-fuel emphasis" prompts
- **Task E** — Cardiac-aware nutrition warnings: if `cardiac_clearance` is `restricted` or `contraindicated`, warn against high-sodium / high-stimulant meal recommendations · feature-entry disclaimer pattern (matches Phase 3)
- **Task F** — Lock down free-text food-input AI parsing under the OT vocabulary contract — Chef on Call should never use clinical framing when discussing nutrition restrictions (e.g., "digestive distress" → "GI signal")

**Probable schema additions:** maybe a `bbf_nutrition_overrides` table to track per-day macro adjustments separately from the canonical plan · TBD per directive.

**Probable new proposal types:** `nutrition_swap`, `nutrition_rotate`, `nutrition_macro_adjust` already exist · no migration needed for v1.

### Both phases share these inviolable contracts:

- ✅ MUST install `bbf:cns:updated` listener on tab render
- ✅ MUST read CNS state ONLY via `BBF_CNS_AGENT.snapshot(uid)`
- ✅ MUST read ACWR ONLY via `BBF_DATA.acwrForUserRegion()`
- ✅ MUST route structural changes through `/api/proposal-submit` · NEVER auto-write
- ✅ MUST sanitize every LLM output via `BBF_OT_PROMPT.sanitize()` at the render OR TTS boundary (server-side for edge fns)
- ✅ MUST include the OT system frame (`BBF_OT_PROMPT.systemContext()`) in every Claude/Gemini `client_context` block
- ✅ MUST audit every agentic action via `/api/audit-log` with `action_type` + `agent` fields

---

## 🧰 Section 8 · Quick Reference Commands

### Inspect the Pantheon contracts (DevTools · admin viewing any client)

```js
// Phase 0 sanity
BBF_CNS_AGENT.snapshot('akeem')                    // → 3-D state · deep clone
BBF_DATA.JOINT_REGIONS                              // → 8-region taxonomy
BBF_OT_PROMPT.sanitize('chronic pain dysfunction')  // → { text: 'recurring friction friction detected', substitutions: [...] }

// Phase 1
BBF_PREHAB_INTEL.evaluate()                         // readiness + damper + suppressions
BBF_PREHAB_INTEL.damperCheck()                      // multi-day trend
BBF_PREHAB_INTEL.runForecast()                      // fires forecasting edge fn

// Phase 2
await BBF_ATHLETE_INTEL.readiness()                 // ACWR or RPE/friction fallback
await BBF_ATHLETE_INTEL.transientSwap({ movement: 'Box Jump' })
BBF_ATHLETE_INTEL.applyLoadCeiling(null, 1.10)      // → clamped to 1.05 adult / 1.03 youth

// Phase 3
await BBF_CARDIO_INTEL.evaluate({ minutes: 30 })
BBF_CARDIO_INTEL.PAR_Q_QUESTIONS                    // → 7-question PAR-Q+ array
```

### Inspect Pantheon state (SQL · Supabase)

```sql
-- Pending agentic proposals waiting for founder
SELECT id, proposal_type, risk_level, proposed_by, rationale, proposed_at
FROM public.bbf_pending_review
WHERE status='pending' ORDER BY proposed_at DESC LIMIT 20;

-- AI action audit trail (all agents)
SELECT created_at, action_type, agent, target_uid, success, error_message
FROM public.bbf_audit_logs
WHERE action_type IS NOT NULL
ORDER BY created_at DESC LIMIT 50;

-- Per-action drilldowns
SELECT * FROM bbf_audit_logs WHERE action_type='prehab_protocol_select' ORDER BY created_at DESC LIMIT 10;
SELECT * FROM bbf_audit_logs WHERE action_type='athlete_transient_swap' ORDER BY created_at DESC LIMIT 10;
SELECT * FROM bbf_audit_logs WHERE action_type='cardio_intensity_downgrade' ORDER BY created_at DESC LIMIT 10;
SELECT * FROM bbf_audit_logs WHERE action_type='vocab_sanitize' ORDER BY created_at DESC LIMIT 10;
SELECT * FROM bbf_audit_logs WHERE action_type='forecast_cold_start_lock' ORDER BY created_at DESC LIMIT 10;

-- Per-client mesocycle history
SELECT phase, mesocycle_week, phase_history, guardian_consent, updated_at
FROM public.bbf_athlete_progression
WHERE user_id = (SELECT id FROM bbf_users WHERE uid='<slug>')
ORDER BY updated_at DESC LIMIT 5;

-- Per-client lifecycle state
SELECT uid, name, subscription_tier, baseline_status, cardiac_clearance, block_priority,
       par_q_screened_at, dietary_profile,
       jsonb_array_length(COALESCE(allergens,'[]')) AS allergen_count
FROM public.bbf_users ORDER BY updated_at DESC;
```

### Diagnostic edge function probes

```
GET https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-tts-eleven?diag=1
GET https://ihclbceghxpuawymlvgi.supabase.co/functions/v1/bbf-lead-concierge?diag=1
```

---

## 📜 Section 9 · The Inviolable Rules (for the next agent)

1. **DO NOT mutate `cns_friction_score`, `biomechanical_redline`, or `somatic_cognitive_load` outside `BBF_CNS_AGENT`.** The `_WRITE_TOKEN` will reject you and the console will log the attempt.
2. **DO NOT compute ACWR anywhere outside `BBF_DATA.computeACWR`.** Any local re-implementation is drift and will be caught by audit.
3. **DO NOT skip the `bbf:cns:updated` listener** when adding a new agentic surface. Stale snapshots are how athletes get hurt.
4. **DO NOT auto-write to `bbf_users / bbf_active_clients / bbf_athlete_progression`** from an agent. Route through `/api/proposal-submit`. The founder approves every structural change.
5. **DO NOT skip `BBF_OT_PROMPT.systemContext()`** on any LLM call. The brand contract is non-negotiable.
6. **DO NOT skip the post-generation `sanitize()`** on any LLM output reaching the user (TTS or screen). The 27-rule filter is the last line of defense.
7. **DO NOT remove the `.select()` confirmation** on the proposal executor. The zero-row safeguard is what catches silent no-ops.
8. **DO NOT enable `FUNCTIONAL_MATRIX`** until verified adaptive/elderly content is seeded. Shipping empty is intentional.
9. **DO NOT let AI infer cardiac risk.** Cardiac clearance is set ONLY by the PAR-Q+ self-screen flow. No LLM reasoning about cardiac state at any point.
10. **DO bump the SW cache version (`bbf-v210` → `bbf-v211`+) on every commit that touches HTML/JS/CSS.** Stale-cache bugs are how production state diverges from cloud state.

---

## ✅ Section 10 · Handoff Acknowledgment

**This session is ready for termination.**

- Repository: clean at `cf39737`
- All Pantheon migrations applied to Supabase production
- All four Pantheon edge functions ACTIVE
- All client-side coordinators (BBF_PREHAB_INTEL · BBF_ATHLETE_INTEL · BBF_CARDIO_INTEL) wired and event-honoring
- Audit trail confirmed firing across the four `action_type` families

**Next session opens with:** `git pull && git log -1 --oneline` → expect `cf39737`. Read this document. Receive the CEO's Phase 4 directive. Honor the Phase 0 contract.

---

*End of Sovereign Handoff Document · Operation Pantheon · Phases 0-3 closed clean.*
