# BBF Closed-Loop Physical Preservation Blueprint
## The Prehab Predictive Matrix + Floor-Driven Recovery Engine ("Ball on a String")

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No code in this document is deployable; it is the spec.
**Scope:** Pure architectural logic, database schema additions, and mathematical logic trees.
**Companion:** BBF Lab Architectural Dossier (data skeleton + calculation engine survey).

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Standard (CRITICAL SYSTEM CONSTRAINT)

**All body-weight and load-bearing math in this architecture is denominated in grams.**
Kilogram-based logic is discarded. Grams are stored as `BIGINT` integers — no floating-point
drift, no unit ambiguity, exact arithmetic end-to-end.

```
GRAMS_PER_POUND = 453.59237            -- exact, by international definition

load_g        = ROUND(weight_lbs × 453.59237)        -- per-set external load
body_mass_g   = ROUND(weight_lb  × 453.59237)        -- athlete body mass at intake
```

**Conversion boundary rule:** the legacy `bbf_sets.weight_lbs` column and the intake
`body_metrics.weight_lb` field are treated as *edge-of-system inputs only*. They are converted
to grams **once**, at the ingestion boundary (generated column / sync write), and every
downstream calculation — tonnage, strain, ACWR, relative load, recovery debt — operates
exclusively on gram-denominated integers. No engine may reference `weight_lbs`, `weight_kg`,
`leanKg`, or any kilogram intermediate. Where a legacy formula used kg (e.g., relative
intensity "1.5× bodyweight squat"), the gram form is used:

```
relative_load = load_g / body_mass_g               -- dimensionless ratio (grams over grams)
tonnage_g     = Σ (reps × load_g)                  -- session mechanical volume, in grams moved
```

**Bodyweight movements** (push-ups, pull-ups, lunges with no external load) are NOT zero-load.
Each movement pattern carries a `bodyweight_load_coeff` (fraction of body mass displaced):

```
effective_load_g = load_g + ROUND(body_mass_g × bodyweight_load_coeff)
-- e.g., push-up: 0 + ROUND(81_646_g × 0.64) = 52_253 g per rep
```

### 0.2 Inherited constraints (unchanged, binding)

1. **Deterministic engines** (Dossier §4.3): every calculator below is pure TypeScript/Deno —
   zero Claude calls, zero `model-router.ts` imports, same input → same output, fully unit-testable.
2. **Missing data never punishes the athlete** (autoregulation doctrine): any null input
   collapses to the neutral branch, never the restrictive one.
3. **The Map Is the Allow-List** (Dossier §4.1): every drill the Prehab/Recovery engines emit
   must exist in the founder-audited catalogs (`prehab-matrix.mjs` drill sets /
   `BBF_RECOVERY_LIBRARY`). The engines select and sequence; they never invent movements.
4. **Trilingual structural** (en/es/pt): every athlete-facing string ships in all three languages.
5. **Service-role-only RLS**: every new table below is created with RLS **enabled** and
   **zero anon/authenticated policies**. Frontend access flows only through edge functions.
6. **Phase 2 identity**: all FKs point at `public.bbf_users(id)` / `athlete_profiles(id)`,
   never `auth.users`.

---

## PART 1 · THE WORKLOAD SUBSTRATE (shared foundation)

Both engines feed on the same substrate: a per-set strain model rolled up into per-day,
per-load-vector workload rows. This is the missing bridge the Dossier flagged
("No Linkage: Readiness Score + Historical Workload").

### 1.1 Load vectors and the movement taxonomy

Every exercise maps to a weighted set of **load vectors** — the mechanical channels through
which strain reaches joints. Six vectors:

| Vector | Reaches joints | Example loaders |
|---|---|---|
| `axial` | lower_back, knee | back squat, deadlift, OHP standing, loaded carries |
| `knee_dominant` | knee | squats, lunges, leg press, jumps |
| `hip_hinge` | lower_back, hamstring | deadlift, RDL, hip thrust, KB swing |
| `shoulder_load` | shoulder | all presses, raises, overhead work |
| `elbow_load` | elbow | presses, curls, extensions, rows |
| `impact` | ankle, knee | plyometrics, sprint drills, court/field work |

**`movement_load_taxonomy` (new table)** — parameterizes what `autoRegulation.js` currently
hardcodes as 5 regex rules, and extends it into a per-vector coefficient matrix:

```sql
CREATE TABLE IF NOT EXISTS public.movement_load_taxonomy (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_name           TEXT UNIQUE NOT NULL,          -- 'squat_axial', 'hinge_deadlift', ...
  detect_regex           TEXT NOT NULL,                 -- matched against drill/exercise name
  veto_regex             TEXT,                          -- safe variants excluded
  axial_coeff            NUMERIC NOT NULL DEFAULT 0,    -- 0.00–1.00 per vector
  knee_coeff             NUMERIC NOT NULL DEFAULT 0,
  hip_coeff              NUMERIC NOT NULL DEFAULT 0,
  shoulder_coeff         NUMERIC NOT NULL DEFAULT 0,
  elbow_coeff            NUMERIC NOT NULL DEFAULT 0,
  impact_coeff           NUMERIC NOT NULL DEFAULT 0,
  bodyweight_load_coeff  NUMERIC NOT NULL DEFAULT 0,    -- fraction of body_mass_g per rep
  muscle_groups          TEXT[] NOT NULL DEFAULT '{}',  -- recovery-library group keys
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.movement_load_taxonomy ENABLE ROW LEVEL SECURITY;
```

Seed coefficients (founder-reviewable, versioned by migration — illustrative first rows):

| pattern | axial | knee | hip | shoulder | elbow | impact | bw_coeff |
|---|---|---|---|---|---|---|---|
| back squat | 1.00 | 0.90 | 0.40 | 0.05 | 0 | 0 | 0.85 |
| front squat | 0.90 | 0.95 | 0.30 | 0.10 | 0.10 | 0 | 0.85 |
| deadlift / trap bar | 0.95 | 0.40 | 1.00 | 0.10 | 0.15 | 0 | 0.85 |
| RDL | 0.70 | 0.15 | 0.95 | 0.05 | 0.10 | 0 | 0.85 |
| leg press | 0.15 | 0.90 | 0.30 | 0 | 0 | 0 | 0 |
| overhead press (standing) | 0.75 | 0.05 | 0.05 | 1.00 | 0.60 | 0 | 0.10 |
| bench / horizontal press | 0.05 | 0 | 0 | 0.80 | 0.70 | 0 | 0 |
| bent-over row | 0.55 | 0.05 | 0.60 | 0.40 | 0.60 | 0 | 0.10 |
| lunge / split squat | 0.45 | 0.95 | 0.50 | 0 | 0 | 0.20 | 0.85 |
| box jump / plyo | 0.30 | 0.70 | 0.40 | 0 | 0 | 1.00 | 1.00 |
| push-up | 0 | 0 | 0 | 0.70 | 0.65 | 0 | 0.64 |
| pull-up | 0.10 | 0 | 0 | 0.75 | 0.80 | 0 | 1.00 |

Unmatched exercises fall through to a `general` pattern (all coefficients 0.20,
bw_coeff 0.30) — strain is never silently dropped to zero.

### 1.2 The per-set strain equation (gram-effort units)

For each row in `bbf_sets`, joined to its `bbf_logs` parent for the drill name and date:

```
load_g            = ROUND(weight_lbs × 453.59237)                       -- boundary conversion
effective_load_g  = load_g + ROUND(body_mass_g × bodyweight_load_coeff)
set_tonnage_g     = reps × effective_load_g                             -- grams moved
set_strain_au     = set_tonnage_g × (rpe / 10)                          -- effort-weighted grams
                                                                        -- "AU" = gram-effort units
vector_strain_au[v] = set_strain_au × vector_coeff[v]                   -- per vector v
```

`rpe / 10` linearly discounts submaximal work; a 10-RPE set counts its full tonnage as strain,
a 5-RPE set counts half. Null RPE → assume 7 (neutral, not punitive). Null weight on a
taxonomy-matched bodyweight pattern → `load_g = 0`, bodyweight term still applies.

### 1.3 Schema addition: gram column on the floor table

```sql
ALTER TABLE public.bbf_sets
  ADD COLUMN IF NOT EXISTS load_g BIGINT
  GENERATED ALWAYS AS (ROUND(weight_lbs * 453.59237)) STORED;
-- weight_lbs remains as the legacy write surface; ALL reads downstream use load_g.
```

```sql
ALTER TABLE public.athlete_profiles
  ADD COLUMN IF NOT EXISTS body_mass_g        BIGINT,          -- converted once at intake
  ADD COLUMN IF NOT EXISTS body_mass_logged_at TIMESTAMPTZ;
-- Null body_mass_g → bodyweight terms use sport/tier median from a seeded lookup;
-- never blocks strain computation (missing data never punishes).
```

### 1.4 Schema addition: the daily workload ledger

One row per (athlete, day, vector), plus a `total` vector row. Written by the Workload
Sentinel (Part 4), read by both engines.

```sql
CREATE TABLE IF NOT EXISTS public.athlete_workload_daily (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id        UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day               DATE NOT NULL,
  load_vector       TEXT NOT NULL CHECK (load_vector IN
                      ('axial','knee_dominant','hip_hinge','shoulder_load',
                       'elbow_load','impact','total')),
  tonnage_g         BIGINT  NOT NULL DEFAULT 0,     -- Σ reps × effective_load_g (gram-pure)
  strain_au         NUMERIC NOT NULL DEFAULT 0,     -- Σ set_strain_au × coeff
  set_count         INTEGER NOT NULL DEFAULT 0,
  rep_count         INTEGER NOT NULL DEFAULT 0,
  mean_rpe          NUMERIC,
  ewma_acute_au     NUMERIC,                        -- 7-day EWMA of strain_au
  ewma_chronic_au   NUMERIC,                        -- 28-day EWMA of strain_au
  acwr              NUMERIC,                        -- ewma_acute / ewma_chronic
  monotony          NUMERIC,                        -- Foster: 7d mean / 7d stddev
  weekly_strain_au  NUMERIC,                        -- Foster: 7d Σ strain × monotony
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, day, load_vector)
);
ALTER TABLE public.athlete_workload_daily ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_awd_athlete_day
  ON public.athlete_workload_daily (athlete_id, day DESC);
```

### 1.5 The ACWR calculator (mathematical spec)

Exponentially-weighted moving averages, not simple rolling windows — EWMA responds faster to
spikes and has no cliff-edge artifacts when a heavy day exits the window.

```
λ_acute   = 2 / (7  + 1) = 0.25
λ_chronic = 2 / (28 + 1) ≈ 0.0690

For each vector v, each calendar day d (rest days count as strain 0 — decay is real):
  A_v(d) = λ_acute   × L_v(d) + (1 − λ_acute)   × A_v(d−1)
  C_v(d) = λ_chronic × L_v(d) + (1 − λ_chronic) × C_v(d−1)

  ACWR_v(d) = A_v(d) / max(C_v(d), ε)        ε = 1 AU guard

COLD-START GATE: ACWR_v = NULL until the athlete has ≥ 14 training days on record.
NULL ACWR contributes zero risk (missing data never punishes).
```

**Interpretation bands** (per vector):

| ACWR | Zone | Meaning |
|---|---|---|
| < 0.80 | UNDERLOAD | Detraining / return-from-absence — re-entry risk is real |
| 0.80 – 1.30 | SWEET SPOT | Adaptive stimulus, injury-protective |
| 1.30 – 1.50 | CAUTION | Acute spike forming |
| > 1.50 | DANGER | Spike — tissue load outrunning tissue capacity |

**RPE-spike detector** (catches intensity spikes that tonnage alone hides):

```
rpe_spike_v = ( mean_rpe_7d_v − mean_rpe_28d_v ≥ 1.5 )
              AND ( strain_au_today_v ≥ 1.25 × mean_daily_strain_28d_v )
```

**Monotony & strain** (Foster) — flags grinding sameness that precedes overuse:

```
monotony_v      = mean(L_v, last 7d) / max(stddev(L_v, last 7d), ε)
weekly_strain_v = Σ(L_v, last 7d) × monotony_v
mono_flag_v     = monotony_v > 2.0
```

---

## PART 2 · THE PREHAB ENGINE (Predictive Matrix)

### 2.1 From reactive to predictive — the shift

| | Today (static) | Target (predictive) |
|---|---|---|
| Trigger | Daily training focus string ("chest day") or reported friction | Nightly risk computation over `bbf_sets` history + check-ins |
| Timing | Same session, after the athlete already feels it | **Next session, before pain is reported** |
| Selection | Focus-keyword → region → fixed drills | Joint-zone risk score → mandatory/advisory queue → allow-listed drills |
| Memory | None | `athlete_injury_history` sensitivity coefficients |

The existing reactive path (`bbf-agentic-prehab` friction parse → `prehab-matrix.mjs`) is
**retained as the fallback layer**. The predictive layer sits in front of it.

### 2.2 Vector → joint-zone risk transmission

```
JOINT_VECTOR_MAP = {
  knee:        [ knee_dominant(w 0.60), axial(w 0.25), impact(w 0.15) ],
  lower_back:  [ axial(w 0.55),  hip_hinge(w 0.35), knee_dominant(w 0.10) ],
  shoulder:    [ shoulder_load(w 0.85), elbow_load(w 0.15) ],
  elbow:       [ elbow_load(w 0.80),  shoulder_load(w 0.20) ],
  hamstring:   [ hip_hinge(w 0.70),  impact(w 0.30) ],
  ankle:       [ impact(w 0.80),  knee_dominant(w 0.20) ]
}
```

### 2.3 The joint risk score — R_j ∈ [0, 100]

Computed nightly per athlete per joint zone `j`, and recomputed immediately on every floor
sync (see Part 4).

```
── COMPONENT 1: ACWR excess, transmitted through vectors ─────────────
f_acwr(x) = 0                        if x is NULL or 0.80 ≤ x ≤ 1.30
          = 0.30                     if x < 0.80          (underload re-entry risk)
          = (x − 1.30) / 0.50        if 1.30 < x ≤ 1.80   (linear ramp 0→1)
          = 1.00                     if x > 1.80

acwr_component_j = Σ_v ( JOINT_VECTOR_MAP[j][v].w × f_acwr(ACWR_v) )

── COMPONENT 2: RPE spike flag on the joint's dominant vector ────────
spike_component_j = 1.0 if rpe_spike on any vector with w ≥ 0.25, else 0

── COMPONENT 3: Injury history factor (the learning term) ────────────
H_j = clamp01( Σ over athlete_injury_history rows at joint j:
        (severity / 10)
        × exp( − months_since_resolved / 12 )        -- 12-month decay half-scale
        × (recurrence_count ≥ 2 ? 1.25 : 1.0)
        × sensitivity_coefficient )                  -- learned, §2.6

── COMPONENT 4: Readiness deficit (today's check-in) ─────────────────
readiness_component = clamp01( (85 − readiness_score) / 45 )   -- 0 at ≥85, 1 at ≤40
                    = 0 if no check-in exists (never punish missing data)

── COMPONENT 5: Monotony flag on the dominant vector ─────────────────
mono_component_j = 1.0 if mono_flag on the joint's highest-weight vector, else 0

── COMPOSITE ─────────────────────────────────────────────────────────
R_j = 100 × clamp01(
        0.35 × acwr_component_j
      + 0.20 × spike_component_j
      + 0.25 × H_j
      + 0.10 × readiness_component
      + 0.10 × mono_component_j )
```

Weights live in `bbf_app_config` under key `prehab_risk_weights_v1` (JSON) — tunable without
redeploy, versioned, never hardcoded in more than one place.

### 2.4 The decision tree (risk → queue action)

```
FOR each joint zone j:
│
├─ R_j ≥ 70  → MANDATORY
│   • Insert prehab_queue row: priority='mandatory', scheduled_for = next session date
│   • Floor gate: session start button locked until the queued protocol is marked complete
│   • Autoregulation directive for next session gains: axialSwap=true for j's dominant
│     vector patterns, rpeCap = min(existing cap, 7) on movements loading j
│   • Trilingual alert pushed to Check-in tab (§2.7)
│
├─ 45 ≤ R_j < 70  → STRONG
│   • priority='strong'; protocol auto-injected into warm-up slots (2 warmup + 1 cooldown)
│   • Skippable, but a skip requires a reason tap → logged to prehab_queue.status='skipped'
│     and feeds the sensitivity learning loop (§2.6)
│
├─ 25 ≤ R_j < 45  → ADVISORY
│   • priority='advisory'; drills appended as optional cooldown; no gate, no alert
│
└─ R_j < 25  → BASELINE
    • No queue row. Existing static focus-based injection (autoRegulation.js) still
      applies when the readiness band demands it — the predictive layer only ADDS.

CONFLICT RULE: if multiple joints are ≥ 70 on the same day, queue at most the TOP TWO
by R_j (a warm-up is not a second workout); remaining mandatory joints degrade to 'strong'
and roll forward to the following session at full priority.
```

**Worked example — the squat-spike scenario in the brief:**
Athlete's 7-day axial strain jumps (new PR block: 5×5 back squat at 143,335 g — 316 lb —
plus trap-bar pulls). `A_axial` rises to 1.62 × `C_axial` → ACWR_axial = 1.62 →
f_acwr = 0.64. Mean RPE 7d = 8.4 vs 28d = 6.7 → spike flag on axial and knee_dominant.
No knee injury history (H = 0), readiness 62 → readiness_component = 0.51.

```
R_knee       = 100 × (0.35×(0.60×f_knee + 0.25×0.64 + …) + 0.20×1 + 0 + 0.10×0.51 + 0) ≈ 74
R_lower_back = 100 × (0.35×(0.55×0.64 + 0.35×f_hinge + …) + 0.20×1 + 0 + 0.10×0.51 + 0) ≈ 71
```

Both cross 70 → **mandatory knee + lower-back prehab is queued for the next session,
the athlete has reported zero pain**, and the next session's autoregulation directive
arrives with axial substitutions armed. The system moved before the athlete felt anything.

### 2.5 Schema addition: the prehab queue

```sql
CREATE TABLE IF NOT EXISTS public.prehab_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  scheduled_for   DATE NOT NULL,
  joint_zone      TEXT NOT NULL CHECK (joint_zone IN
                    ('shoulder','knee','lower_back','elbow','hamstring','ankle',
                     'hip','wrist','neck','groin','full_body')),
  priority        TEXT NOT NULL CHECK (priority IN ('mandatory','strong','advisory')),
  risk_score      NUMERIC NOT NULL,
  trigger_reason  JSONB NOT NULL,     -- { acwr: {...per vector}, spike: bool, history: H_j,
                                      --   readiness: n, monotony: bool, weights_version: 'v1' }
  protocol        JSONB NOT NULL,     -- 3-drill matrix, allow-listed drills only
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN
                    ('queued','served','completed','skipped','expired','superseded')),
  skip_reason     TEXT,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prehab_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_pq_athlete_day
  ON public.prehab_queue (athlete_id, scheduled_for, status);
```

Supersede rule mirrors `active_playlists`: a fresh computation for the same
(athlete, day, joint) marks the prior `queued` row `superseded` before inserting.
`queued` rows older than `scheduled_for + 2 days` are swept to `expired` by the nightly run —
stale prehab must never resurrect weeks later.

### 2.6 The learning loop (deterministic, no AI)

`sensitivity_coefficient` on `athlete_injury_history` is the system's memory of which joints
are fragile *for this athlete in this sport*. Update rules are pure arithmetic:

```
EVENT: pain report (check-in pain ≥ 5, or reactive prehab friction request) at joint j
       within 72h of a day where any of j's vectors carried strain ≥ its 28d mean
  → sensitivity_coefficient_j += 0.10   (cap 2.00)
  → if no open injury row exists for j: insert one with
      injury_type='overuse', reported_by='system_inferred',
      severity=pain_score, source_feedback_id=<check-in id>

EVENT: mandatory/strong prehab for j marked 'skipped' AND pain at j reported ≤ 7 days later
  → sensitivity_coefficient_j += 0.15   (skipping prehab that was then vindicated
                                          teaches the system to insist harder)

EVENT: 90 consecutive days, zero friction at j, vectors of j loaded at ≥ 0.8 × chronic mean
  → sensitivity_coefficient_j ×= 0.95   (floor 0.80 — proven-robust joints earn slack)
```

Every mutation appends to `trigger_reason`-style audit JSON on the history row —
the coefficient is always explainable.

### 2.7 Trilingual alert templates (Check-in surface)

```
en: "Preservation Protocol armed: {joint} workload spiked {pct}% this week.
     Mandatory prehab is queued before your next floor session."
es: "Protocolo de Preservación armado: la carga de {joint} subió {pct}% esta semana.
     Prehab obligatorio en cola antes de tu próxima sesión."
pt: "Protocolo de Preservação armado: a carga de {joint} subiu {pct}% esta semana.
     Prehab obrigatório na fila antes da sua próxima sessão."
```

---

## PART 3 · THE RECOVERY ENGINE (Floor-Driven Recalibration)

### 3.1 From prescription-subset to standalone bridge

Today, recovery work fires only when the Prescription Engine classifies REGRESS
(pain ≥ 7 OR RPE ≥ 8) — a pain gate. The Recovery Engine decouples from that gate entirely:
it is driven by **yesterday's floor ledger**, runs for *every* athlete *every* morning, and
its output is the recalibrated **prep phase** of today's session plus modifiers handed to
the Check-in verdict. Pain never has to occur for recovery to adapt.

### 3.2 The recovery-debt model (per muscle group, gram-effort denominated)

Each muscle group `m` carries a debt account. Yesterday's session deposits; sleep withdraws.

```
── DEPOSIT (at floor sync, per group m) ──────────────────────────────
session_strain_au_m = Σ over yesterday's sets whose taxonomy muscle_groups ∋ m:
                        set_strain_au × (1 / |muscle_groups|)     -- split across groups

debt_m ← debt_m + session_strain_au_m

── OVERNIGHT DECAY (at morning check-in) ─────────────────────────────
sleepFactor    = min(sleep_hours / 8, 1.0)                        -- existing formula, reused
half_life_h    = 36 / max(sleepFactor, 0.5)                       -- 36h at full sleep,
                                                                  -- up to 72h when starved
hours_elapsed  = time since last decay checkpoint
debt_m ← debt_m × 0.5 ^ (hours_elapsed / half_life_h)

── NORMALIZATION (athlete-relative, not absolute) ────────────────────
debt_ratio_m = debt_m / max(C_total, ε)     -- chronic EWMA as the personal yardstick:
                                            -- 300,000 AU means nothing absolute; 1.4× your
                                            -- own chronic load means everything
```

### 3.3 The recalibration decision tree (debt → today's prep phase)

Consumed by `bbf-agentic-recovery` (which already supports `light`/`standard`/`deep`
duration variants and per-group emphasis — this tree finally gives those knobs a brain):

```
FOR today's session prep, per muscle group m:
│
├─ debt_ratio_m ≥ 1.40  → DEEP PROTOCOL
│   • recovery_stretches: deep variant (90s holds) for m
│   • foam_rolling: m's sequence promoted to slot 1
│   • prep_drills: today's dynamic drills for m swapped to lowest-intensity variants
│   • HANDOFF → Check-in: readiness verdict for today carries prep_extension_min = +8
│   • HANDOFF → Autoregulation: if m maps to an axial/impact vector, arm rpeCap = 8
│     on movements loading m today (soft cap, not a swap)
│
├─ 0.90 ≤ debt_ratio_m < 1.40  → STANDARD-PLUS
│   • standard variant (60s holds), m weighted first in stretch emphasis ordering
│   • prep_extension_min = +4
│
├─ 0.40 ≤ debt_ratio_m < 0.90  → STANDARD (current behavior, unchanged)
│
└─ debt_ratio_m < 0.40  → LIGHT
    • light variant (30s); prep time reclaimed for the main block

GLOBAL OVERLAYS (evaluated after per-group pass):
│
├─ Σ debt across all groups ≥ 2.0 × C_total          → SYSTEMIC FLAG
│   • Check-in verdict text upgraded to recovery-focus messaging (trilingual)
│   • volMultiplier ceiling 0.8 for today regardless of readiness score
│     (readiness formula can miss soreness; the floor ledger cannot)
│
├─ Any joint j in athlete_injury_history with sensitivity_coefficient ≥ 1.2
│   AND any of j's vectors loaded yesterday                → HISTORY SLOT
│   • One targeted drill for j is ALWAYS inserted into prep, debt regardless.
│     This is the sport-profile learning surfacing daily: the ex-ACL soccer knee
│     gets its knee drill every time knees were loaded, forever, at any debt level.
│
└─ Yesterday flagged high-volume + high-RPE
    (tonnage_total ≥ 1.5 × 28d daily mean AND mean_rpe ≥ 8)  → 48-HOUR SHADOW
    • recovery_shadow_until = yesterday + 48h persisted on athlete_recovery_state
    • While shadow is live: prep always ≥ STANDARD-PLUS for the loaded groups,
      HIIT locked in cardio band (tier ceiling 'Tempo'), and the Prehab Engine's
      readiness_component is computed as if readiness were 10 points lower.
```

### 3.4 Schema addition: recovery state ledger

```sql
CREATE TABLE IF NOT EXISTS public.athlete_recovery_state (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id             UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day                    DATE NOT NULL,
  muscle_group           TEXT NOT NULL,               -- BBF_RECOVERY_LIBRARY group keys
  debt_au                NUMERIC NOT NULL DEFAULT 0,
  debt_ratio             NUMERIC,                     -- debt / chronic EWMA at compute time
  deposit_au             NUMERIC NOT NULL DEFAULT 0,  -- yesterday's session_strain share
  prep_variant           TEXT NOT NULL DEFAULT 'standard'
                           CHECK (prep_variant IN ('light','standard','standard_plus','deep')),
  recovery_shadow_until  TIMESTAMPTZ,                 -- 48h high-load shadow, §3.3
  computed_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, day, muscle_group)
);
ALTER TABLE public.athlete_recovery_state ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ars_athlete_day
  ON public.athlete_recovery_state (athlete_id, day DESC);
```

### 3.5 Schema addition: `athlete_injury_history` (the memory organ)

This is the table both engines share — the Prehab Engine reads it for H_j and writes
system-inferred overuse rows; the Recovery Engine reads it for the HISTORY SLOT and
sport-profile targeting.

```sql
CREATE TABLE IF NOT EXISTS public.athlete_injury_history (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id               UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  joint_zone               TEXT NOT NULL CHECK (joint_zone IN
                             ('shoulder','knee','lower_back','elbow','hamstring',
                              'ankle','hip','wrist','neck','groin')),
  side                     TEXT NOT NULL DEFAULT 'n/a'
                             CHECK (side IN ('left','right','bilateral','n/a')),
  injury_type              TEXT NOT NULL CHECK (injury_type IN
                             ('acute_trauma','overuse','surgical','chronic','friction_pattern')),
  diagnosis_label          TEXT,                      -- free text: 'ACL reconstruction 2024'
  mechanism                TEXT CHECK (mechanism IN
                             ('axial_load','impact','rotational','overextension',
                              'repetitive_strain','contact','unknown')),
  sport_context            TEXT,                      -- sport being played when it occurred
  severity                 INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  occurred_on              DATE NOT NULL,
  resolved_on              DATE,                      -- NULL = still open → H_j uses today
  recurrence_count         INTEGER NOT NULL DEFAULT 0,
  sensitivity_coefficient  NUMERIC NOT NULL DEFAULT 1.00
                             CHECK (sensitivity_coefficient BETWEEN 0.80 AND 2.00),
  coefficient_audit        JSONB NOT NULL DEFAULT '[]', -- append-only mutation trail (§2.6)
  reported_by              TEXT NOT NULL CHECK (reported_by IN
                             ('athlete_checkin','coach','clinician','intake','system_inferred')),
  source_feedback_id       UUID,                      -- check-in / friction event provenance
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.athlete_injury_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_aih_athlete_joint
  ON public.athlete_injury_history (athlete_id, joint_zone);
```

**Sport-profile learning:** because every row carries `sport_context` + `mechanism`, the
engines can compute per-sport joint priors deterministically (e.g., a soccer athlete's
open-knee row with `mechanism='rotational'` weights knee_dominant AND impact vectors into
H_knee; a boxer's shoulder row with `repetitive_strain` weights shoulder_load). No AI —
the mapping is `mechanism → vector emphasis` in a seeded lookup, founder-auditable.

---

## PART 4 · THE CLOSED LOOP — "BALL ON A STRING"

One string, one ball: **every RPE tap on the floor pulls the string, and Check-in, Prehab,
and Recovery all swing with it for the next 48 hours.** The pull is the Workload Sentinel.

### 4.1 The Workload Sentinel (new deterministic edge function)

`bbf-workload-sentinel` — pure Deno, zero Claude calls, two triggers:

1. **Hot path:** invoked by the existing floor-sync write path immediately after
   `bbf_sets` rows land (same posture as `bbf_sync_vault_session`) with
   `{ athlete_id, day }`.
2. **Cold path:** nightly cron sweep (03:00 athlete-local) for all athletes with activity
   in the last 35 days — computes rest-day decay, expires stale queues, runs the
   90-day sensitivity relaxation.

Pipeline per invocation: recompute §1 rollups → §2 risk scores + queue writes →
§3 debt deposits + prep variants → emit trilingual alerts payload. Idempotent:
re-running any (athlete, day) overwrites the same ledger rows (UNIQUE constraints are
the idempotency keys).

### 4.2 Step-by-step data flow: one RPE input → 48 hours of consequence

```
T+0s      FLOOR · Athlete finishes set 4 of back squats at 143,335 g (316 lb × 453.59237),
│         taps RPE = 9 in the floor UI.
│         → floorDb (local IndexedDB) commits the set instantly; UI never blocks.
│
T+2s      SYNC · floorSync pushes the session delta → bbf_sets row lands
│         (weight_lbs=316 at the boundary; load_g=143,335 materializes via the
│         generated column — the LAST moment pounds exist anywhere in the system).
│
T+3s      PULL · sync completion invokes bbf-workload-sentinel { athlete_id, day }.
│
T+4s      SUBSTRATE · Sentinel joins today's bbf_sets × movement_load_taxonomy:
│           set_strain_au = 5 reps × (143,335 g + 0.85 × body_mass_g) × 0.9
│         Vector fan-out: axial ×1.00, knee ×0.90, hip ×0.40.
│         athlete_workload_daily upserted: tonnage_g, strain_au, EWMAs roll forward,
│         ACWR_axial recomputes → 1.34 → CAUTION. Mean RPE 7d now 8.1 vs 28d 6.9 → spike.
│
T+5s      PREHAB ARM · Risk pass: R_knee = 58 (STRONG), R_lower_back = 52 (STRONG).
│         prehab_queue ← two 'strong' rows, scheduled_for = next session date,
│         trigger_reason JSON carries the full ACWR/spike/H breakdown (auditable).
│
T+6s      RECOVERY DEPOSIT · debt_quads += strain share, debt_lower_back += share.
│         Session qualifies as high-volume + high-RPE (tonnage 1.6× 28d mean, mean RPE 8.4)
│         → athlete_recovery_state.recovery_shadow_until = now + 48h.  ⏱ SHADOW ARMED.
│
T+8s      FLOOR UI FEEDBACK · Sentinel response paints a quiet banner:
│         "Axial load trending hot — preservation work queued for next session." (en/es/pt)
│         The athlete sees the string tighten in real time. Loop visible = loop trusted.
│
─────────── overnight ───────────
│
T+14h     CHECK-IN (next morning) · Athlete logs sleep 6.2h, vibe 'chill_restless'.
│         bbf-readiness-calculator now reads the loop state and composes:
│           • raw readiness 68 → shadow active → effective ceiling volMultiplier = 0.8
│           • debt decay ran: sleepFactor 0.775 → half_life 46h → quads debt_ratio 1.47 → DEEP
│           • Check-in tab renders: readiness verdict + "Recovery shadow: 34h remaining"
│             + queued prehab preview cards (from prehab_queue, status 'queued'→'served').
│
T+15h     RECOVERY TAB · bbf-agentic-recovery reads athlete_recovery_state:
│           recovery_stretches → deep 90s variants, quads + lower_back promoted to slots 1–2;
│           foam_rolling → quad sequence first; prep_drills → low-intensity variants;
│           prep_extension_min = +8. Yesterday's floor wrote today's warm-up.
│
T+16h     PREHAB TAB / FLOOR GATE · Session opens with the two STRONG protocols injected
│         into warm-up slots (skippable-with-reason). Autoregulation directive arrives with
│         rpeCap 8 on axial patterns and 'Leg Press' substitution armed if the athlete's
│         live readiness band degrades. Any skip is logged → learning loop (§2.6).
│
T+17h     FLOOR · Today's sets land → Sentinel fires again → EWMAs update with today's
│         (lighter) load → ACWR_axial eases toward 1.2 → tomorrow's risk pass cools.
│         The ball swings back toward center. Every day, the same string.
│
T+38h     CHECK-IN (day 2) · Shadow still live (10h left): prep floor still STANDARD-PLUS,
│         HIIT still tier-capped. Debt_quads decayed to ratio 0.8 → STANDARD.
│
T+48h     SHADOW EXPIRES · Nightly sentinel sweep clears recovery_shadow_until, expires
│         any unserved advisory queue rows, applies the 90-day sensitivity relaxation
│         check. System is back at baseline — unless the floor pulls the string again.
```

### 4.3 Loop invariants (what makes it "closed")

1. **Single writer:** only the Sentinel writes the three loop tables
   (`athlete_workload_daily`, `prehab_queue`, `athlete_recovery_state`). Check-in, Prehab,
   and Recovery surfaces are readers + status-flippers. No write cycles, no race topology.
2. **Every prescription is traceable to floor data:** `trigger_reason` / `coefficient_audit`
   JSON on every queue row and coefficient mutation — the CEO can ask "why did the app
   force knee prehab on Tuesday" and get exact numbers.
3. **Every skip feeds back:** skipped prehab + subsequent pain is the highest-gain learning
   event in the system (+0.15 sensitivity).
4. **Gram-pure core:** pounds exist only at the two legacy boundaries (`weight_lbs` write,
   intake `weight_lb`); every ledger, ratio, and threshold inside the loop is grams or
   gram-derived AU.
5. **Fail-open posture:** Sentinel failure → no queue rows → surfaces render exactly today's
   static behavior. The loop degrades to the current system, never below it.

---

## PART 5 · EXECUTION MANIFEST (for Opus)

Build order — each step ships independently and degrades gracefully:

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `bbf_sets.load_g` generated column + `athlete_profiles.body_mass_g` | `apply_migration` | — |
| 2 | Migration: `movement_load_taxonomy` + seed rows | migration | — |
| 3 | Migration: `athlete_workload_daily`, `athlete_injury_history`, `prehab_queue`, `athlete_recovery_state` (RLS on, zero policies) | migration | 1, 2 |
| 4 | `bbf-workload-sentinel` edge function (deterministic; §1 + §2 + §3 pipelines) + hot-path invoke from floor sync + nightly cron | edge fn | 3 |
| 5 | `bbf-agentic-prehab` v3: read `prehab_queue` first; friction parse becomes fallback | edge fn | 4 |
| 6 | `bbf-agentic-recovery` v2: read `athlete_recovery_state` for variant + emphasis + shadow | edge fn | 4 |
| 7 | `bbf-readiness-calculator` v2: shadow ceiling + debt-aware verdict text (trilingual) | edge fn | 4 |
| 8 | Frontend: Check-in shadow banner, Prehab queue cards + mandatory floor gate, Recovery variant rendering; `sw.js`/SPA CACHE bump | frontend | 5–7 |
| 9 | Test suite: athlete personas (squat-spike, return-from-absence, ex-ACL soccer, clean-baseline), EWMA golden vectors, gram-conversion exactness (316 lb → 143,335 g), fail-open paths | tests | all |

**Config keys** (all in `bbf_app_config`, versioned): `prehab_risk_weights_v1`,
`acwr_bands_v1`, `recovery_debt_bands_v1`, `sensitivity_update_rules_v1`.
No threshold in this blueprint may be inlined twice.

**Non-goals of this phase:** wearable HRV fusion (separate track), dynamic TDEE coupling
(Dossier §3.4 — consumes `athlete_workload_daily` later, for free), youth-tier threshold
calibration (config-key override, post-MVP).

---
*The floor is the sensor. The Sentinel is the string. Check-in, Prehab, and Recovery are
the ball — and it never stops swinging back to center.*
