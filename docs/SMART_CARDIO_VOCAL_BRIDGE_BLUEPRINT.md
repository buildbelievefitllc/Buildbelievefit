# BBF Smart Cardio Engine + Sovereign Vocal Bridge
## The Cardiovascular Counterweight to Mechanical Load

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No deployable code in this
document; it is the spec.
**Scope:** Pure architectural logic, schema additions, and math trees.
**Companions:** BBF Lab Architectural Dossier ·
`PREHAB_RECOVERY_CLOSED_LOOP_BLUEPRINT.md` (workload substrate) ·
`FUEL_ECOSYSTEM_3TIER_BLUEPRINT.md` (nutrition contract).

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Standard (CRITICAL SYSTEM CONSTRAINT)

**Every metabolic, energy, and mass calculation in this engine is denominated against
`body_mass_g` (BIGINT grams).** No kilogram appears as a stored value, intermediate, or
coefficient unit. The two load-bearing conversions:

```
── CARDIO ENERGY EXPENDITURE (gram-rebased MET equation) ─────────────
Legacy (DISCARDED):   kcal/min = MET × 3.5 × weight_kg / 200
Gram Standard:        kcal/min = MET × body_mass_g × GRAM_MET_KCAL
                      GRAM_MET_KCAL = 1.75e-5  kcal per (MET · min · g)
-- exact identity: 3.5/(200×1000) = 1.75e-5. Zero drift, kg annihilated.

ee_kcal = ROUND( MET_tier × body_mass_g × 1.75e-5 × duration_min )

── SWEAT RATE ESTIMATION (gram-proportional, no wearables) ───────────
sweat_rate_g_per_min = body_mass_g × K_SWEAT[tier] × heat_factor
  K_SWEAT (g sweat · g body mass⁻¹ · min⁻¹):
    Zone 2  0.00015        -- ≈ 0.7 L/h at 81,647 g (180 lb)
    Tempo   0.00022        -- ≈ 1.1 L/h
    HIIT    0.00030        -- ≈ 1.5 L/h
  heat_factor = 1.0 default · 1.3 if athlete flags hot environment at check-in

sweat_loss_g    = ROUND(sweat_rate_g_per_min × duration_min)     -- grams of water mass
rehydration_g   = ROUND(1.5 × sweat_loss_g)                      -- 150% replacement rule
-- Water is mass; it is reported in grams like every other mass in the ecosystem.
-- rehydration_g is emitted for the briefing + future nutrition-hydration consumption.
```

MET constants (config-keyed `cardio_met_values_v1`): Zone 2 = 6.0 · Tempo = 8.5 ·
HIIT = 11.0 (interval-averaged, rest periods included).

### 0.2 Inherited constraints (binding)

1. **Deterministic core** (Dossier §4.3): every calculation below — bridge, matrix,
   payload composer — is pure Deno, zero Claude calls. Claude enters exactly once,
   downstream, to write briefing prose (§3), via the model router.
2. **Missing data never punishes:** absent workload/recovery/debt rows → the mechanical
   ceiling is silent and the engine behaves exactly as today. Fail-open to current behavior.
3. **No wearable dependencies in the new math:** the mechanical ceiling, prescription
   matrix, and EE/sweat estimates read only native floor data and check-ins. (The existing
   HRV red-flag path in `_shared/cardio-readiness.ts` remains untouched — it simply isn't
   an input to anything new.) Heart-rate caps are *estimated* natively (§2.3): Tanaka
   HRmax from `birth_date`, with an RPE/talk-test fallback when the athlete has no monitor.
4. **Ceiling composition law ("gentlest wins"):** the existing `applyTierCeiling` semantic
   is the composition operator for ALL ceilings. Zone 2 < Tempo < HIIT; the minimum always
   survives. The new mechanical ceiling composes; it never replaces.
5. **Trilingual structural · service-role-only RLS · frozen response contracts:**
   `bbf-agentic-cardio`'s FROZEN CONTRACT response shape is extended additively only.
6. **AI_DIRECTIVES §7 (customer-facing copy):** the vocal briefing explains *physiology*,
   never *system internals*. No table names, no "ACWR", no "ledger", no "edge function"
   may reach the athlete's ears. §3.4 enforces this at the prompt layer.

---

## PART 1 · THE WORKLOAD BRIDGE (Mechanical vs. Cardiac)

### 1.1 The counterweight principle

Mechanical strain (bar in hand) and cardiac output (engine at redline) drain **one shared
CNS reserve**. Today the cardio engine sees a 3-day CNS-fatigue read from raw `bbf_sets`
and the morning readiness band — it is blind to the workload ledger's richer truth: vector
ACWR, monotony, recovery debt, and the 48-hour shadow. The bridge gives cardio that sight,
so cardiac prescription moves *inversely* to mechanical spikes: when the floor pulls the
string up, cardio swings down.

### 1.2 Bridge inputs (read-only, same-morning)

| Source | Fields consumed |
|---|---|
| `athlete_workload_daily` | `acwr` per vector (`axial`, `impact`, `knee_dominant`, `total`), `strain_au`, `monotony` |
| `athlete_recovery_state` | `debt_ratio` per muscle group, `recovery_shadow_until` |
| `prehab_queue` | any `mandatory` row scheduled today (joint protection context) |
| `bbf_logs`/`bbf_sets` (today) | same-day mechanical tonnage already executed (interference check) |

### 1.3 The mechanical ceiling — logic tree

Computed each morning (and re-computed on floor sync — see §4), producing
`mech_state ∈ { danger, caution, clear }` and a tier ceiling that composes with the
existing readiness-band ceiling:

```
── STATE DERIVATION ──────────────────────────────────────────────────
mech_state = DANGER  if ANY of:
  D1  ACWR_axial  > 1.50                          -- axial spike: spine + CNS loaded
  D2  ACWR_impact > 1.50                          -- impact spike: tissue + CNS loaded
  D3  recovery_shadow_until > now                 -- 48h post high-volume/high-RPE shadow
  D4  Σ debt_au (all groups) ≥ 2.0 × C_total      -- systemic recovery debt flag
  D5  monotony_total > 2.0 AND ACWR_total > 1.30  -- grinding accumulation

mech_state = CAUTION  if none of D1–D5 and ANY of:
  C1  1.30 < ACWR on any of { axial, impact, knee_dominant } ≤ 1.50
  C2  max(debt_ratio over lower-body groups) ≥ 1.40   -- legs owe; running costs legs
  C3  a 'mandatory' prehab_queue row is scheduled today

mech_state = CLEAR otherwise — including when inputs are NULL (fail-open).

── CEILING + THROTTLE PARAMETERS ─────────────────────────────────────
             tier_ceiling   hr_cap          rpe_cap   work:rest    structure
DANGER       'Zone 2'       0.70 × HRmax    5         none         steady-state only
CAUTION      'Tempo'        0.80 × HRmax    7         1:2          long-rest intervals
CLEAR        none           tier default    tier default  tier default

── COMPOSITION (gentlest wins, existing operator) ────────────────────
effective_tier = applyTierCeiling(
                   applyTierCeiling(time_based_tier, readiness_band_ceiling),
                   mechanical_ceiling )
effective_hr_cap  = min(readiness-band hr implication, mechanical hr_cap)
effective_rpe_cap = min(band rpe_ceiling, mechanical rpe_cap)
```

**Why Zone 2 under mechanical danger:** high-intensity glycolytic intervals add sympathetic
load to an already-spiked system; Zone 2 raises perfusion and parasympathetic tone without
new CNS withdrawal — active protection, not punishment. This causal sentence travels with
the prescription into the vocal payload (§3.3) so the athlete hears the *why*.

### 1.4 The same-day interference rule

Concurrent-training interference: heavy lower-body mechanical work and high-intensity
cardio in the same day compete for the same recovery currency.

```
IF today's already-synced floor tonnage on { knee_dominant ∪ hip_hinge } vectors
   ≥ 0.6 × that athlete's 28-day mean daily total tonnage
THEN cap cardio at 'Tempo' (or 'Zone 2' if the session's mean RPE ≥ 8),
     AND stamp interference_gap_advice = '6h' into the trace
     (if session timestamps show < 6h separation, the briefing narrates the trade).
```

### 1.5 Schema addition — extend the existing prescription cache

`bbf_cardio_prescription` already caches the morning recovery band. It gains the bridge:

```sql
ALTER TABLE public.bbf_cardio_prescription
  ADD COLUMN IF NOT EXISTS mech_state        TEXT CHECK (mech_state IN ('danger','caution','clear')),
  ADD COLUMN IF NOT EXISTS mech_ceiling      TEXT CHECK (mech_ceiling IN ('Zone 2','Tempo')),
  ADD COLUMN IF NOT EXISTS mech_signals      JSONB,        -- { acwr_axial, acwr_impact, shadow, debt_sum_ratio, monotony, fired: ['D1','D3'] }
  ADD COLUMN IF NOT EXISTS effective_tier    TEXT CHECK (effective_tier IN ('HIIT','Tempo','Zone 2')),
  ADD COLUMN IF NOT EXISTS hr_cap_bpm        SMALLINT,
  ADD COLUMN IF NOT EXISTS rpe_cap           SMALLINT,
  ADD COLUMN IF NOT EXISTS work_rest_ratio   TEXT,
  ADD COLUMN IF NOT EXISTS duration_min      SMALLINT,
  ADD COLUMN IF NOT EXISTS ee_kcal_est       INTEGER,      -- §0.1 gram-MET equation
  ADD COLUMN IF NOT EXISTS sweat_loss_g_est  INTEGER,      -- grams
  ADD COLUMN IF NOT EXISTS rehydration_g     INTEGER,      -- grams
  ADD COLUMN IF NOT EXISTS prescription_trace JSONB;       -- every ceiling, in order, with reasons
```

One row per (athlete, day) remains the contract; supersede-on-recompute is unchanged.

---

## PART 2 · THE PRESCRIPTION MATRIX

### 2.1 Inputs

```
available_minutes   athlete input (existing UX, unchanged)
effective_tier      from Part 1 composition
sport_profile       'atp_pc' | 'glycolytic'   (existing SPORT_PROFILE resolution)
debt_class          from max lower/relevant debt_ratio:
                      HIGH ≥ 1.40 · MODERATE 0.90–1.39 · LOW < 0.90 · UNKNOWN (null → LOW)
body_mass_g         latest athlete_body_metrics (nutrition substrate §1.1)
hr_max_est          §2.3
```

### 2.2 The deterministic matrix (tier × sport profile → structure)

The time-based router (minutes → tier) stays exactly as shipped; the matrix decides what
the tier *contains* once ceilings have had their say:

| effective_tier | profile | work | rest | work:rest | reps/blocks | MET |
|---|---|---|---|---|---|---|
| HIIT | atp_pc | 12 s sprint (alactic) | 60 s | **1:5** | 8–12 reps | 11.0 |
| HIIT | glycolytic | 45 s hard | 45–90 s | **1:1 → 1:2** | 6–10 reps | 11.0 |
| Tempo | atp_pc | 60 s strong | 120 s | **1:2** | 5–8 blocks | 8.5 |
| Tempo | glycolytic | 4 min threshold | 2 min | **2:1** | 3–5 blocks | 8.5 |
| Zone 2 | both | continuous | — | steady-state | 1 block | 6.0 |

Rationale encoded in the matrix (travels into the vocal payload): ATP-PC athletes
(linemen, throwers) train the alactic system — short violence, full restoration, 1:5;
sending them into 45-second glycolytic grinders trains the wrong engine. Glycolytic
athletes (soccer, basketball perimeter) live in incomplete-recovery intervals — 1:1 and
2:1 are their sport.

### 2.3 Native heart-rate math (no wearables)

```
age        = floor((today − birth_date) / 365.25)          -- athlete_profiles, native
hr_max_est = ROUND(208 − 0.7 × age)                        -- Tanaka; config 'cardio_hr_model_v1'

hr_cap_bpm = ROUND(hr_max_est × cap_fraction)
  cap_fraction: Zone 2 → 0.70 · Tempo → 0.80 · HIIT → 0.90
  mechanical DANGER overrides all → 0.70 · CAUTION clamps to ≤ 0.80

NO-MONITOR FALLBACK (always emitted alongside the bpm number):
  Zone 2 → "conversational pace — full sentences" · rpe_cap 5
  Tempo  → "phrases only"                         · rpe_cap 7
  HIIT   → "single words between reps"            · rpe_cap band default
```

### 2.4 Duration and dose — debt-scaled

```
duration_min = clamp( ROUND(available_minutes × debt_scale), 10, available_minutes )
  debt_scale: HIGH 0.70 · MODERATE 0.85 · LOW/UNKNOWN 1.00

reps_final   = ROUND(matrix reps × debt_scale)   floor 4 reps / 2 blocks
warmup/cool  : 3 min in + 2 min out carved from duration_min (never from work blocks
               below their floors — if minutes can't fit floors, tier degrades one level)
```

### 2.5 Gram-denominated session outputs (worked example)

81,647 g athlete (180 lb), glycolytic, effective_tier Tempo (mechanically capped from
HIIT), debt MODERATE, 30 available minutes:

```
duration_min  = ROUND(30 × 0.85)                        = 26 min
structure     = 4 blocks × (4 min threshold + 2 min easy) = 24 min work window + warm/cool
ee_kcal       = ROUND(8.5 × 81,647 × 1.75e-5 × 26)      = 316 kcal
sweat_loss_g  = ROUND(81,647 × 0.00022 × 26)            = 467 g
rehydration_g = ROUND(1.5 × 467)                        = 701 g of water
hr_cap_bpm    = 16 y/o: ROUND((208 − 11.2) × 0.80)      = 157 bpm  ("phrases only")
```

Every number above lands in `bbf_cardio_prescription` and flows unchanged into §3's payload.

---

## PART 3 · THE VOCAL TOOL INTEGRATION (Sovereign Brief)

### 3.1 Placement in the existing pipeline

`bbf-sovereign-briefing` already runs: tripwire/on-demand → gates (voice_coach entitlement,
Day-30 graduation, metering) → Claude compose (SONNET via router) → ElevenLabs
(`eleven_multilingual_v2`, Akeem clone `ZbKDEqxkr8Ub4psNm5XD`, one voice / three languages)
→ cache `bbf_sovereign_audio`. **None of that changes.** What changes is what the composer
is *given*: today it sees calibration day + readiness trend; tomorrow it receives the
**Daily Brief Context** — a single deterministic JSON assembled from the three engines.

### 3.2 The handoff table

```sql
CREATE TABLE IF NOT EXISTS public.bbf_daily_brief_context (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day          DATE NOT NULL,
  payload      JSONB NOT NULL,                  -- §3.3, locale-agnostic (numbers + enums)
  narrative    JSONB NOT NULL,                  -- §3.4 ranked beats, locale-agnostic
  status       TEXT NOT NULL DEFAULT 'ready'
                 CHECK (status IN ('ready','consumed','stale')),
  computed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, day)
);
ALTER TABLE public.bbf_daily_brief_context ENABLE ROW LEVEL SECURITY;
```

Written by the morning pre-compute chain (§4); read by `bbf-sovereign-briefing` in both
modes. Recompute-on-floor-sync marks intra-day revisions in place (UNIQUE key), flipping
`status` back to `ready` so an evening on-demand brief speaks to the updated day.

### 3.3 The Daily Brief Context payload (exact JSON structure)

Locale-agnostic by design — numbers, enums, and pre-computed deltas only; all prose is
born in the composer, natively, per locale (never translated post-hoc):

```jsonc
{
  "contract_version": "brief_ctx_v1",
  "athlete": {
    "athlete_id": "…", "first_name": "Marco", "sport": "soccer",
    "position": "field", "tier": "high_school", "locale_default": "es",
    "body_mass_g": 81647
  },
  "readiness": {
    "score": 62, "state": "strain",                  // canonical cardio-readiness vocab
    "sleep_hours": 6.2, "vibe": "chill_restless",
    "trend_7d": "declining"                          // rising | flat | declining
  },
  "workload": {                                       // from athlete_workload_daily
    "acwr_total": 1.34,
    "spiking_vectors": [
      { "vector": "axial", "acwr": 1.62, "zone": "danger",
        "pct_above_chronic": 62,                      // pre-computed for narration
        "driver_movements": ["back squat", "trap bar deadlift"] }
    ],
    "monotony_flag": false,
    "yesterday": { "tonnage_g": 14650000, "mean_rpe": 8.4,
                   "vs_28d_mean_pct": 160 }
  },
  "recovery": {                                       // from athlete_recovery_state
    "shadow_active": true, "shadow_hours_remaining": 34,
    "top_debts": [
      { "muscle_group": "quads",      "debt_ratio": 1.47, "prep_variant": "deep" },
      { "muscle_group": "lower_back", "debt_ratio": 1.21, "prep_variant": "standard_plus" }
    ]
  },
  "prehab": {                                         // from prehab_queue (today)
    "queued": [
      { "joint_zone": "knee",       "priority": "mandatory", "risk_score": 74,
        "primary_cause": "acwr_spike" },              // acwr_spike | rpe_spike | history | monotony
      { "joint_zone": "lower_back", "priority": "mandatory", "risk_score": 71,
        "primary_cause": "acwr_spike" }
    ],
    "floor_gate_active": true
  },
  "nutrition": {                                      // from athlete_nutrition_targets_daily
    "tier": "sovereign", "day_type": "recovery_forced",
    "tdee_kcal": 2762,
    "targets_g": { "protein": 196, "carbs": 322, "fat": 77 },
    "deltas_vs_baseline_pct": { "kcal": -21, "protein": 33, "carbs": -30 },
    "next_scheduled": { "day_type": "refeed_eve", "in_days": 2 }   // Tier 3 forecast peek
  },
  "cardio": {                                         // from bbf_cardio_prescription (Parts 1–2)
    "effective_tier": "Zone 2",
    "ceiling_chain": [                                // ordered — the WHY spine
      { "source": "time_router",     "tier": "Tempo",  "bound": false },
      { "source": "readiness_band",  "tier": "Tempo",  "bound": false },
      { "source": "mechanical",      "tier": "Zone 2", "bound": true,
        "signals_fired": ["D1", "D3"] }               // axial ACWR danger + 48h shadow
    ],
    "duration_min": 26, "work_rest_ratio": "steady-state",
    "hr_cap_bpm": 157, "talk_test": "full_sentences", "rpe_cap": 5,
    "ee_kcal_est": 316, "sweat_loss_g_est": 467, "rehydration_g": 701
  },
  "flags": { "wellbeing_escalation": false, "data_fallbacks": [] }
}
```

Composer contract: every field optional; a missing engine section simply drops its beats
(§3.4). The payload is assembled by pure joins — no Claude, no derivation logic in the
briefing function itself.

### 3.4 The narrative directive layer — numbers → "why" instructions

The bridge between telemetry and voice is a deterministic **beat ranker + translation
table**. It converts machine state into *causal narration instructions* — and it is where
AI_DIRECTIVES §7 is enforced: internal vocabulary is mapped to coach physiology language
before Claude ever sees a prompt.

```
── BEAT EXTRACTION (deterministic) ───────────────────────────────────
Each engine section yields candidate beats with a fixed severity:
  wellbeing_escalation ..................... 100 (always leads if present)
  mechanical DANGER ceiling bound .......... 90
  mandatory prehab queued .................. 85
  recovery_forced nutrition day ............ 80
  recovery shadow active ................... 75
  readiness strain/breach .................. 70
  refeed/carb-load upcoming ................ 60
  caution-zone vector (no ceiling bound) ... 50
  standard/prime clean day ................. 20 (default celebratory beat)

RULE: top 3 beats by severity → narrative.beats[]. Everything else is silent
(a 90-second briefing that mentions nine things explains none of them).

── TRANSLATION TABLE (internal → spoken concept; config 'brief_lexicon_v1') ──
ACWR spike            → "training load this week vs. your monthly norm"
acwr 1.62 / +62%      → "about sixty percent above what your body is conditioned for"
recovery shadow       → "the 48-hour window your body is still paying for Tuesday"
debt_ratio (quads)    → "your legs are still carrying Tuesday's bill"
mechanical ceiling    → "today's cardio protects the engine instead of taxing it"
Zone 2 + hr_cap       → "conversational pace — if you can't speak full sentences, ease off"
NEVER SPOKEN: 'ACWR', 'ledger', 'sentinel', table/function names, tier internals, scores
              as bare numbers without their meaning attached.
```

Ranked beats are stored as structured directives, not prose:

```jsonc
"narrative": {
  "beats": [
    { "beat": "mechanical_ceiling", "severity": 90,
      "cause":  { "concept": "load_spike", "vector_label": "squat_pattern",
                  "pct_above_norm": 62, "window": "this_week" },
      "action": { "concept": "cardio_throttle", "tier": "Zone 2",
                  "hr_cap_bpm": 157, "talk_test": "full_sentences" },
      "connect": "cause_protects_athlete" },          // the rhetorical shape to voice
    { "beat": "mandatory_prehab", "severity": 85,
      "cause":  { "concept": "predictive_protection", "joints": ["knee","lower_back"] },
      "action": { "concept": "gate_before_floor" },
      "connect": "before_pain_not_after" },
    { "beat": "recovery_nutrition", "severity": 80,
      "cause":  { "concept": "forced_recovery" },
      "action": { "concept": "protein_up_carbs_down",
                  "protein_g": 196, "protein_delta_pct": 33 },
      "connect": "fuel_the_repair" }
  ],
  "tone": "protective_confident",     // protective_confident | celebratory | steady
  "must_mention_g": ["rehydration_g:701"]   // gram numbers the voice MUST speak
}
```

### 3.5 The composer prompt contract (what Claude receives)

`bbf-sovereign-briefing`'s compose step keeps VOICE_DNA + vocal-state directive + the
COLLOQUIAL trilingual directive, and gains one structured block:

```
SYSTEM (existing VOICE_DNA + locale directives, unchanged) +

DAY CONTEXT (machine-generated, do not read aloud verbatim):
<brief_context>{payload}</brief_context>
<narrative_directives>{narrative}</narrative_directives>

COMPOSITION LAWS:
1. Speak ONLY the beats in narrative_directives, in severity order. Do not surface
   any other payload field.
2. For each beat, voice the CAUSE before the ACTION, joined by the 'connect' shape —
   the athlete must hear WHY before WHAT ("your squat volume jumped sixty percent
   above your norm this week — so today we drop to conversational pace and let the
   engine rebuild").
3. Use the spoken-concept lexicon only. Never utter internal terms (the directives
   contain none — do not reconstruct them).
4. Speak masses in grams exactly as given (e.g. "seven hundred one grams of water
   across the session"). Never convert to kilograms, liters, or ounces.
5. 140–190 words. End on the athlete's next concrete action.
```

Model: SONNET tier via `routeAndLog('bbf-sovereign-briefing', 'sovereign_briefing')` —
mid-complexity narration, unchanged routing. Output text → existing ElevenLabs synthesis,
settings untouched (`BBF_VOICE_SETTINGS`, `eleven_multilingual_v2`).

**Determinism boundary, stated plainly:** everything up to and including
`bbf_daily_brief_context` is deterministic and replayable. Claude's only degree of freedom
is *phrasing* — never *facts*, never *numbers*, never *which beats*.

---

## PART 4 · ORCHESTRATION & CLOSED-LOOP FLOW

### 4.1 The morning chain (extends the existing tripwire, no new cron)

```
03:00  Workload Sentinel (nightly)            → athlete_workload_daily fresh
03:30  Fueling Sentinel (nightly)             → nutrition targets fresh
──── athlete wakes ────
T+0    Morning check-in → bbf_daily_protocols tripwire (EXISTING) fires:
T+1s   bbf-readiness-calculator               → readiness verdict (+ Tier 2 fueling pass)
T+2s   bbf-cardio-prescription (EXTENDED)     → recovery band + MECHANICAL BRIDGE (Part 1)
                                                + PRESCRIPTION MATRIX (Part 2)
                                                → bbf_cardio_prescription row complete
T+3s   NEW final chain step: brief-context composer (pure joins, zero AI)
                                                → bbf_daily_brief_context row 'ready'
T+4s   bbf-sovereign-briefing tripwire mode   → reads context row → Sonnet compose
                                                → ElevenLabs → bbf_sovereign_audio cache
T+~15s Athlete opens Vault Hub: the day's audio brief is already waiting — and it
       explains the squat spike, the Zone 2 order, the 196 g protein target, and the
       701 g of water, in Akeem's voice, in the athlete's language.
```

### 4.2 Intra-day resync

Floor sync already re-fires the Workload Sentinel (companion blueprint §4). Its pipeline
gains one tail call: recompute `bbf_cardio_prescription` (interference rule §1.4 may now
bind) and refresh `bbf_daily_brief_context` (`status='ready'`, revision traced). Cached
morning audio is NOT regenerated (metering discipline); the on-demand path regenerates only
if it finds context `computed_at` newer than the cached audio — the evening brief speaks to
the day that actually happened.

### 4.3 Loop invariants

1. **Single writer per table:** cardio chain writes `bbf_cardio_prescription` +
   `bbf_daily_brief_context`; the briefing function only reads context and flips `status`.
2. **The ceiling chain is the audit trail:** every tier decision records every ceiling in
   order with `bound: true|false` — the CEO can ask "why Zone 2 on Tuesday" and read it.
3. **Gram-pure outputs:** ee_kcal via the gram-MET identity; sweat and rehydration as
   integer grams; the voice speaks grams verbatim (composition law 4).
4. **Fail-open at every seam:** no workload rows → no mechanical ceiling; no context row →
   briefing composes from calibration + readiness exactly as it does today.

---

## PART 5 · EXECUTION MANIFEST (for Opus)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `bbf_cardio_prescription` ALTER (§1.5) + `bbf_daily_brief_context` (RLS on, zero policies) | `apply_migration` | Workload substrate #1–4 |
| 2 | Config seeds: `cardio_mech_ceiling_v1` (D/C thresholds), `cardio_matrix_v1` (§2.2), `cardio_met_values_v1`, `cardio_hr_model_v1`, `brief_lexicon_v1` | migration | — |
| 3 | `bbf-cardio-prescription` v2: mechanical bridge + prescription matrix + gram EE/sweat outputs (still ZERO AI) | edge fn | 1, 2 |
| 4 | `bbf-agentic-cardio` v2: read the day's `bbf_cardio_prescription` row for ceilings (replaces its private 3-day CNS read as primary; keeps it as fallback); FROZEN CONTRACT extended additively with `mech_state`, `ceiling_chain`, gram outputs | edge fn | 3 |
| 5 | Brief-context composer step (pure joins) appended to the morning chain | edge fn | 3 + fueling/prehab substrates |
| 6 | `bbf-sovereign-briefing` v2: consume context + narrative directives, composition laws in prompt; gates/metering/ElevenLabs untouched | edge fn | 5 |
| 7 | Frontend: cardio card renders ceiling chain + talk-test + hydration grams; CACHE bump | frontend | 4 |
| 8 | Tests: gram-identity goldens (MET equation vs legacy at crossover), ceiling composition truth table (3 ceilings × bound permutations), interference rule personas, beat-ranker determinism (same payload → same 3 beats), §7 lexicon leak scan (assert no internal vocabulary reaches composed prose), fail-open paths | tests | all |

**Non-goals:** wearable HR telemetry fusion (explicitly out), in-session live HR
adjustment, hydration/electrolyte prescription beyond the rehydration_g output
(nutrition-track consumption of that field is a later phase).

---
*The floor loads the spring; the engine is the counterweight. When mechanical strain
spikes, cardio bows — and the athlete hears exactly why, in Akeem's voice, before they
touch a bar.*
