# Phase 11 · Opus 4.8 Backend Agentic Revamp — Blueprint (v2 · router-aware)

**Status:** locked spec · re-mapped around the central model router
**Supabase project:** `ihclbceghxpuawymlvgi`

**Decisions locked by operator:**
1. **Architecture fork:** App-layer Conductor + Verifier (Path 1). Orchestration stays inside the existing Supabase edge-function runtime. **Not** migrating to Anthropic Managed Agents.
2. **Migration vehicle:** the `opus-4-7 → opus-4-8` upgrade is handled **centrally via `_shared/model-router.ts`**, not by editing functions one by one.
3. **`bbf-agentic-interrogator` stays on Sonnet 4.6** — it routes via `onboarding_interview → MODELS.SONNET` by design; moving it to Opus would be a ~1.7× cost increase on a high-volume public funnel. Protected.
4. **New P0 pilot:** a `MODELS.OPUS` consumer (recommendation below), to validate the router bump on a real Opus codepath.

---

## §0 · The router reality (supersedes the per-function framing)

The fleet does **not** hardcode models. Every Claude call resolves its model through `_shared/model-router.ts` via a **use-case tag**. This is the single most important fact for Phase 11: **the fleet model migration is one line + redeploys, not 17 inline edits.**

```ts
// _shared/model-router.ts  (the one place model cost decisions live)
export const MODELS = {
  HAIKU:  'claude-haiku-4-5',
  SONNET: 'claude-sonnet-4-6',
  OPUS:   'claude-opus-4-7',   // ← the ONLY opus-4-7 string in the fleet. Bump this to opus-4-8.
};
```

**Current routing (verified from deployed source):**

| Tier | Model | Use-case tags |
|---|---|---|
| HAIKU | `claude-haiku-4-5` | vocab_retry, syntax_retry, mesocycle_rationale, snapshot_synthesis, sovereign_brief, i18n_translation, forecast_1rm, sport_immersion_seed |
| SONNET | `claude-sonnet-4-6` | kinematic_form_score, novel_form_correction, **onboarding_interview** (← interrogator + pathfinder), prehab_assignment |
| OPUS | `claude-opus-4-7` | **parq_assessment**, **wellbeing_escalation**, **cardiac_intercept** — safety-critical only |

**Two consequences:**
- **Model migration is central.** Changing `MODELS.OPUS` from `claude-opus-4-7` → `claude-opus-4-8` upgrades every Opus consumer at once. Blast radius = the three safety tags above, and the change takes effect per-function as each consumer is redeployed (each function ships its own copy of `_shared/`).
- **`opus-4-7 → opus-4-8` is cost-neutral** ($5/$25 per 1M either way) **and has no breaking changes.** The only thing to validate is *behavioral correctness on the safety classifications* — not API compatibility, not cost.

**Effort is NOT in the router** — `EFFORT_DEFAULT` is a local const in each function. So the §E effort targets remain per-function edits, applied when each consumer is redeployed.

---

## §A · Reality check (load-bearing corrections)

1. **`opus-4-7 → opus-4-8` has no new breaking changes** — adaptive thinking only; `temperature`/`top_p`/`top_k`/`budget_tokens` 400; prefills 400; structured-output + effort unchanged. Same price tier.
2. **Effort values: `low | medium | high | xhigh | max`** (no `extra`; that's `xhigh`). `max` is Opus-only. **Errors on Haiku** → Haiku-tier functions send no effort param.
3. **Opus 4.8 has NO native subagent coordination and NO built-in output verification.** Those are application-layer (we chose Path 1) — the model does not orchestrate or self-audit.
4. **Models are centrally routed (§0).** Do not hunt for hardcoded `claude-opus-4-7` strings in function bodies — there is one, in the router.

---

## §B · The DAG (three planes; only one is a reasoning graph)

```
                          ┌─────────────────────────────┐
   intent ───────────────▶│  CONDUCTOR  (NEW · app-layer │  ← Gap #4
                          │  classify → route → gather)  │
                          └───────┬──────────────┬───────┘
                fan-out (parallel, independent)  │ sequential (data-dependent)
        ┌──────────┬──────────┬──────────┐       │
        ▼          ▼          ▼          ▼        ▼
     prehab    forecasting  kinematics  peaking   cardio ──needs──▶ same-day bbf_sets  ← Gap #3
   (readiness)  (ACWR/trend) (vision)   (taper)   (antagonism)
        └──────────┴────┬─────┴──────────┴─────────┘
                        ▼
                   co-coach  (synthesis / athlete-facing voice)
                        ▼
                 VERIFIER pass (NEW)  ← Gap #7  (gates prescriptions + claims)
```

| Plane | Functions | Role |
|---|---|---|
| **Reasoning DAG** | prehab, cardio, kinematics, peaking, forecasting, co-coach, interrogator | Subagents. Fan out independents; sequence data-dependents. |
| **Event / automation** | stripe-webhook, vapi-outbound-trigger, vapi-sms-closer, bbf-sentinel | Triggers & sinks — NOT subagents. |
| **Batch** | bbf-midnight-haiku | Nightly → Batches API (50% cost). Home for Gap #2. Stays Haiku (no effort param). |
| **Real-time multimodal** | Gemini Live: PHANTOM EYE / VIRTUAL COACH / NUTRITION VISION / VIRTUAL CHEF | Stays Gemini; feeds the DAG via Gap #6 plumbing. |

---

## §C · Gap solutions (tagged model vs. engineering)

- **Gap #4 — orchestrator.** *Not a model feature.* App-layer **Conductor** (new edge fn): classify → fan out (parallel) → collect → synthesize via co-coach. Drive at `high`/`xhigh`; consider Task Budgets (beta) to self-moderate spend.
- **Gap #7 — verifier.** *Not a model feature.* `strict`/`json_schema` guarantees shape, never truth. App-layer **verifier pass**: a second `messages.create` (cheaper Sonnet 4.6) takes `{agent_output, source_data}` → `{passed, corrections}` under a strict schema; gate prescriptions on it.
- **Gap #3 — cardio × strength antagonism.** *Pure data-flow.* Conductor sequences cardio after the strength write and supplies same-day `bbf_sets` load (or cardio queries it directly).
- **Gap #1 — wearable ingestion.** Pure ETL connector into `bbf_readiness`. No Claude.
- **Gap #2 — macro reconciliation.** pg_cron + one Claude call; Batches API; pairs with midnight-haiku.
- **Gap #5 — episodic memory.** Per-user rolling-summary table injected into prompts (app-layer).
- **Gap #6 — Gemini→Claude handoff.** Plumbing: Gemini emits structured observation → passed into a Claude call (or Opus 4.8 vision).

---

## §D · Orchestration pattern (illustrative)

```ts
async function conduct(intent, athlete) {
  const [prehab, forecast, kin, peak] = await Promise.all([
    callFn("bbf-agentic-prehab",      { athlete, lang }),
    callFn("bbf-agentic-forecasting", { athlete, lang }),
    callFn("bbf-agentic-kinematics",  { athlete, lang }),
    callFn("bbf-agentic-peaking",     { athlete, lang }),
  ]);
  const sameDayLoad = await sql`select coalesce(sum(weight*reps),0)
                                from bbf_sets where uid=${athlete.id}
                                and logged_at::date = current_date`;       // Gap #3
  const cardio = await callFn("bbf-agentic-cardio", { athlete, sameDayLoad, lang });
  const plan   = await callFn("bbf-co-coach", { prehab, forecast, kin, peak, cardio, lang });
  const check  = await verify(plan, { prehab, forecast, cardio, sameDayLoad }); // Gap #7
  return check.passed ? plan : reconcile(plan, check.corrections);
}
```

---

## §E · Upgrade path (split: model = central, effort = local)

**Model (one central edit):** `MODELS.OPUS: 'claude-opus-4-7' → 'claude-opus-4-8'` in `_shared/model-router.ts`. Takes effect per-function as each OPUS consumer is redeployed. Cost-neutral, no breaking changes. (Optionally, later, evaluate bumping HAIKU/SONNET tiers — but those are already the current generation; leave unless a use case needs more.)

**Effort (per-function local `EFFORT_DEFAULT`, applied at redeploy):**

| OPUS consumer (tag) | Host (confirm via get_edge_function) | Effort target | Notes |
|---|---|---|---|
| cardiac_intercept | bbf-agentic-cardio | **max** | Daily safety hot-path |
| parq_assessment | intake/onboarding path | **high** | Low-volume structured screening |
| wellbeing_escalation | escalation/halt path | **high–max** | Rare trigger, highest harm-if-wrong |

**Caching:** stable system prompt cached per function (Opus min prefix **4096 tokens**). Model swap invalidates existing cache (one-time fresh write). Verify via `usage.cache_read_input_tokens`.

**Failure posture:** keep HTTP-200-with-fallback (already in place); add `stop_reason` handling (`refusal`/`max_tokens`/`model_context_window_exceeded`); typed SDK errors; SDK auto-retry for 429/5xx.

**4.8 re-tuning** (per safety consumer, since 4.8 behavior shifts): structured-output classifiers are largely insulated from the narration/ask-rate shifts, but re-verify classification thresholds (PAR-Q clear/refer, cardiac route, wellbeing halt) against opus-4-7 baselines.

---

## §F · Safe migration sequence (router-based)

1. **Confirm hosts** — `get_edge_function` for each OPUS consumer to locate `parq_assessment` / `wellbeing_escalation` / `cardiac_intercept` host functions and confirm clean params.
2. **Bump the router** — `MODELS.OPUS → 'claude-opus-4-8'` in `_shared/model-router.ts`.
3. **Pilot on the lowest-stakes OPUS path FIRST** (§G) — redeploy only that consumer, **synthetic-probe before live traffic**, compare opus-4-8 vs opus-4-7 output on representative cases.
4. **Canary** — roll the next OPUS consumer; watch logs + classification correctness.
5. **Cardio + wellbeing LAST**, gated on operator confirm (safety hot-paths / highest harm). Behind the verifier where applicable.
6. **Effort tuning** rides along with each redeploy (set local `EFFORT_DEFAULT` per §E).
7. **Build Conductor + Verifier as NEW functions** (additive; independent of the model bump).

---

## §G · Prioritized punch list

- **P0 (revised)** — Confirm OPUS-consumer hosts; bump `MODELS.OPUS → opus-4-8`; pilot on **`parq_assessment`** (lowest-traffic, structured, onboarding-gated — *not* cardio's daily hot-path, *not* wellbeing's harm ceiling). Synthetic-probe-first; compare 4.7↔4.8.
- **P1** — Gap #3 data fix (cardio reads same-day `bbf_sets`).
- **P2** — Build app-layer Conductor (Gap #4).
- **P3** — Build verifier pass (Gap #7): cardio + co-coach prescriptions first.
- **P4** — Roll opus-4-8 to cardio + wellbeing (gated); per-function effort tuning; caching audit.
- **P5** — Gap #2 macro reconciliation (Batches + midnight-haiku) · Gap #1 wearable connector · Gap #5 episodic-memory table · Gap #6 Gemini→Claude plumbing.

**Interrogator note:** stays on Sonnet 4.6. No change. Public-funnel economics protected.

---

*Verified against current Claude API guidance: `claude-opus-4-8` model ID, adaptive-thinking-only surface, `low/medium/high/xhigh/max` effort (max Opus-only; errors on Haiku), opus-4-7↔4-8 cost parity ($5/$25 per 1M) + no breaking changes, 4096-token Opus cache minimum.*
