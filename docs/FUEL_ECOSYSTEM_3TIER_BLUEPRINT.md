# BBF 3-Tier Nutritional Calculating Ecosystem
## Fuel Foundation · Fuel Performance · Fuel Sovereign

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No deployable code in this
document; it is the spec.
**Scope:** Pure architectural logic, database schema additions, and mathematical formulas.
**Companions:** BBF Lab Architectural Dossier (engine survey) ·
`PREHAB_RECOVERY_CLOSED_LOOP_BLUEPRINT.md` (workload substrate this ecosystem consumes).

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Standard (CRITICAL SYSTEM CONSTRAINT)

**All body-mass inputs and all macro outputs in this architecture are denominated in grams.**
Kilogram logic is discarded. The kilogram never appears as a stored value, an intermediate,
or a coefficient unit anywhere in the three tiers.

```
GRAMS_PER_POUND = 453.59237                       -- exact, by international definition

body_mass_g  = ROUND(weight_lb × 453.59237)       -- BIGINT, converted ONCE at the boundary
lean_mass_g  = ROUND(body_mass_g × (1 − body_fat_pct / 100))
fat_mass_g   = body_mass_g − lean_mass_g
```

**Coefficient doctrine — g/g ratios.** Every legacy "grams per kilogram of bodyweight"
constant is re-expressed as a dimensionless **grams-per-gram** coefficient (divide by 1000).
This is an exact algebraic identity — zero behavioral drift at the crossover, but the unit
kg is annihilated from the system:

| Legacy (kg logic — DISCARDED) | Gram Standard (canonical) |
|---|---|
| RMR = 500 + 22 kcal × leanKg | `RMR = 500 + 0.022 × lean_mass_g` |
| protein 1.8 g/kg | `PROTEIN_COEFF = 0.0018 g/g` |
| carbs 3–12 g/kg | `CARB_COEFF = 0.0030 … 0.0120 g/g` |
| creatine load 0.3 g/kg/d | `CREATINE_LOAD_COEFF = 0.0003 g/g` |
| creatine maint. 0.03 g/kg/d | `CREATINE_MAINT_COEFF = 0.00003 g/g` |
| RED-S floor: EA ≥ 30 kcal/kg FFM | `EA = tdee / lean_mass_g ≥ 0.030 kcal/g FFM` |

**Boundary rule:** `weight_lb` (intake / metrics log) is converted to `body_mass_g` at write
time and never read again downstream. `fueling-engine.js`'s `LB_TO_KG` constant and every
`weightKg` / `leanKg` intermediate are retired. All macro *outputs* (protein_g, carbs_g,
fat_g, creatine_g, water… ) are integers of grams. Energy remains in kcal (kcal is not a
mass unit; it is untouched by this constraint).

### 0.2 Inherited constraints (binding)

1. **Deterministic engines** (Dossier §4.3): all three tiers are pure TypeScript/Deno —
   zero Claude calls, zero `model-router.ts` imports. Same input → same output.
2. **Missing data never punishes the athlete:** any null input collapses to the neutral
   branch (Tier 2 falls back to Tier 1 targets; Tier 3 falls back to Tier 2).
3. **Trilingual structural:** every athlete-facing verdict/alert ships en/es/pt.
4. **Service-role-only RLS:** every new table ships RLS **enabled**, **zero** anon policies.
5. **No wearable dependencies (Tier 3 hard constraint):** the predictive engine reads only
   native floor data (`bbf_sets`/`bbf_logs` → `athlete_workload_daily`) and manual
   check-ins (`athlete_readiness_logs`, intake). Oura/Whoop/Garmin fields are forbidden
   inputs to every formula in this document.
6. **Youth safety gates:** youth tier remains locked to `fasting_window='none'` (existing
   upstream gate, now re-checked inside the engine), and the RED-S energy-availability
   floor is a **hard clamp** at every tier — no formula below may emit a target under it.
7. **Tier fallback chain:** `Sovereign → Performance → Foundation`. A higher tier is a
   strict superset; if its extra inputs are missing or stale, it degrades one level and
   says so in `computation_trace`. The ecosystem never returns nothing.

### 0.3 Entitlement mapping

| Nutrition tier | Product tier | Gate |
|---|---|---|
| Tier 1 · Fuel Foundation | Catalyst | any valid vault session |
| Tier 2 · Fuel Performance | Momentum | `requireEntitlement('momentum')` |
| Tier 3 · Fuel Sovereign | Autonomous | `requireEntitlement('autonomous')` |

---

## PART 1 · SHARED SUBSTRATE

### 1.1 Body metrics ledger (gram-native time series)

The current engine scrapes `weight_lb`/`body_fat_pct` out of localStorage blobs. The
ecosystem needs a durable, gram-native metrics ledger — targets must be reproducible from
the DB alone:

```sql
CREATE TABLE IF NOT EXISTS public.athlete_body_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  measured_on   DATE NOT NULL,
  body_mass_g   BIGINT NOT NULL,                      -- converted once at the boundary
  body_fat_pct  NUMERIC CHECK (body_fat_pct BETWEEN 1 AND 60),
  lean_mass_g   BIGINT GENERATED ALWAYS AS
                  (ROUND(body_mass_g * (1 - COALESCE(body_fat_pct, 20) / 100))) STORED,
  source        TEXT NOT NULL DEFAULT 'manual_checkin'
                  CHECK (source IN ('manual_checkin','intake','coach')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, measured_on)
);
ALTER TABLE public.athlete_body_metrics ENABLE ROW LEVEL SECURITY;
```

Resolution rule: `current metrics = most recent row ≤ today`. Null `body_fat_pct` → the
generated column assumes 20% (neutral, documented) and the engine flags
`lean_mass_estimated=true` in the trace — never a hard failure.

### 1.2 The gram-native core equations (all tiers share these)

```
── IDENTITY ──────────────────────────────────────────────────────────
lean_mass_g = ROUND(body_mass_g × (1 − body_fat_pct/100))

── BBF RMR (retained by order, re-based to grams) ────────────────────
rmr_kcal = 500 + 0.022 × lean_mass_g
-- e.g. lean_mass_g = 68,039 g (150 lb lean) → RMR = 500 + 1,496.9 ≈ 1,997 kcal

── ACTIVITY FACTOR (Tier 1 static; Tier 2/3 override — see below) ────
af_base = 2.000 if twice-daily
        = 1.725 if training_days ≥ 6
        = 1.550 otherwise

── TDEE ──────────────────────────────────────────────────────────────
tdee_kcal = ROUND(rmr_kcal × af)

── MACRO ASSEMBLY (order is law: protein → carb → fat residual) ──────
protein_g = ROUND(protein_coeff × body_mass_g)        -- coeff in g/g
carbs_g   = ROUND(carb_coeff   × body_mass_g)
fat_kcal  = max(fat_floor_kcal, tdee_kcal − 4×protein_g − 4×carbs_g)
fat_g     = ROUND(fat_kcal / 9)

── HARD SAFETY CLAMPS (applied LAST, at every tier, no exceptions) ───
C1  ENERGY FLOOR   tdee_kcal ≥ 1.10 × rmr_kcal
C2  RED-S FLOOR    tdee_kcal / lean_mass_g ≥ 0.030 kcal/g FFM
                   (if C1/C2 bind: raise carbs_g to fill the gap — protein is never cut,
                    fat never below its floor; emit safety_clamp='red_s_floor' in trace)
C3  PROTEIN BAND   0.0014 ≤ protein_coeff ≤ 0.0026
C4  CARB BAND      0.0020 ≤ carb_coeff   ≤ 0.0120
C5  FAT FLOOR      fat_kcal ≥ fat_floor_pct × tdee_kcal   (per-tier value, ≥ 0.20)
```

### 1.3 Baseline coefficient table (config-keyed, never inlined)

Stored in `bbf_app_config` key `fueling_coefficients_v1` (JSON), seeded:

| Profile / condition | carb_coeff (g/g) | protein_coeff (g/g) | fat_floor_pct |
|---|---|---|---|
| general / atp_pc baseline | 0.0040 | 0.0018 | 0.20 |
| glycolytic · ~60 min sessions | 0.0060 | 0.0018 | 0.20 |
| glycolytic · 1–3 h sessions | 0.0080 | 0.0018 | 0.20 |
| glycolytic · >4 h sessions | 0.0100 | 0.0018 | 0.20 |
| carb-load window (Tier 3 §4.5) | 0.0110 → 0.0120 ramp | 0.0018 | 0.20 |
| creatine (atp_pc): load / maintain | — | — | `0.0003` / `0.00003` g/g, 5–7 d load |

These are the exact legacy values ÷ 1000 — behavior-identical crossover, gram-pure units.

### 1.4 The daily targets ledger (single output table for all tiers)

One row per athlete per day is **the** nutrition contract — what the meal-plan assembler
(`nutritionEngine.js`) scales against, what intake tracking grades against:

```sql
CREATE TABLE IF NOT EXISTS public.athlete_nutrition_targets_daily (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day                DATE NOT NULL,
  tier               TEXT NOT NULL CHECK (tier IN ('foundation','performance','sovereign')),
  tdee_kcal          INTEGER NOT NULL,
  protein_g          INTEGER NOT NULL,               -- grams, integer, always
  carbs_g            INTEGER NOT NULL,
  fat_g              INTEGER NOT NULL,
  creatine_g         NUMERIC,                        -- null unless atp_pc protocol active
  coefficients       JSONB NOT NULL,                 -- { carb_coeff, protein_coeff, af, ... }
  day_type           TEXT NOT NULL DEFAULT 'standard' CHECK (day_type IN
                       ('standard','recovery_forced','heavy_predicted','refeed_eve',
                        'carb_load','post_heavy','taper','competition')),
  timing_plan        JSONB,                          -- Tier 3 only (§4.6 windows)
  computation_trace  JSONB NOT NULL,                 -- inputs, clamps fired, fallback level
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, day)
);
ALTER TABLE public.athlete_nutrition_targets_daily ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_antd_athlete_day
  ON public.athlete_nutrition_targets_daily (athlete_id, day DESC);
```

Supersede rule: recomputation for the same (athlete, day) **updates in place** and appends
the prior values into `computation_trace.history[]` — the day always has exactly one live
contract, with its full revision story attached.

---

## PART 2 · TIER 1 — FUEL FOUNDATION (Static Execution)

### 2.1 Contract

Foundation is the disciplined baseline: **compute once, hold steady, track grams in.**
No readiness coupling, no auto-adjustment — by design. The athlete learns to hit a fixed
number before the system starts moving the number.

### 2.2 Logic tree

```
ON: intake completion, OR new athlete_body_metrics row, OR manual "recalculate" tap
│
├─ 1. Resolve metrics: latest athlete_body_metrics → body_mass_g, lean_mass_g
│      (null body mass → status 'missing_inputs', no target row written; UI prompts intake)
│
├─ 2. rmr_kcal  = 500 + 0.022 × lean_mass_g
├─ 3. af        = af_base(training_days_per_week, twice_daily)      -- static buckets, §1.2
├─ 4. tdee_kcal = ROUND(rmr_kcal × af)
│
├─ 5. Coefficients from §1.3 by resolved sport profile (SPORT_PROFILE lookup, unchanged
│      logic, gram-based table). Session-minutes bucket from the athlete's OWN stated
│      typical session length (intake field) — Foundation does not read the floor.
│
├─ 6. Macro assembly + clamps C1–C5 (§1.2)
├─ 7. atp_pc profile → creatine_g = 0.0003 × body_mass_g (load, 5–7 d)
│                                 then 0.00003 × body_mass_g (maintenance)
│
└─ 8. WRITE athlete_nutrition_targets_daily rows for today → today+27 (28-day horizon),
       tier='foundation', day_type='standard', identical values each day.
       STATIC MEANS STATIC: rows are only rewritten by the triggers at the top of
       this tree — never by readiness, never by the floor.
```

### 2.3 Intake tracking (grams in, no judgment loop)

Foundation's second half is the ledger of what the athlete actually ate — logged in grams,
graded against the contract, **never** feeding back into the target:

```sql
CREATE TABLE IF NOT EXISTS public.nutrition_intake_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day           DATE NOT NULL,
  meal_slot     TEXT NOT NULL CHECK (meal_slot IN
                  ('breakfast','lunch','dinner','snack','pre','peri','post')),
  food_label    TEXT NOT NULL,
  serving_g     INTEGER NOT NULL,                    -- grams of food, integer
  protein_g     INTEGER NOT NULL DEFAULT 0,          -- grams of macro, integer
  carbs_g       INTEGER NOT NULL DEFAULT 0,
  fat_g         INTEGER NOT NULL DEFAULT 0,
  kcal          INTEGER GENERATED ALWAYS AS
                  (protein_g * 4 + carbs_g * 4 + fat_g * 9) STORED,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_intake_log ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_nil_athlete_day
  ON public.nutrition_intake_log (athlete_id, day);
```

**Daily adherence readout (display math, not control math):**

```
adherence_pct(macro) = 100 × Σ intake_macro_g / target_macro_g      -- per macro, per day
band: 90–110% ON TARGET · 75–90 / 110–125% DRIFT · else OFF TARGET
```

Trilingual verdicts render the band; Foundation stops there. (These same intake rows become
*inputs* at Tier 3 — the data is collected from day one so Sovereign has history to eat.)

---

## PART 3 · TIER 2 — FUEL PERFORMANCE (Dynamic Recalibration)

### 3.1 The bridge

Performance connects the nutrition contract to the **daily readiness verdict**. The state
vocabulary is the existing canonical one (`_shared/cardio-readiness.ts` — reuse, do not
fork): `breach` (< 40) · `strain` (40–65) · `standard` (65–85) · `prime` (≥ 85).

**Timing law:** today's check-in recalibrates **tomorrow's** contract (`day = checkin_day + 1`).
The athlete's food for today was already planned; the loop moves the next day, every day —
same "ball on a string" cadence as the Recovery Engine.

### 3.2 The exact recalibration formulas

**Step A — energy side.** A strained system is prescribed less training volume
(volMultiplier), so its activity energy must shrink in proportion — feeding full-load
calories into a half-load day is the inflammatory-surplus gap the Dossier flagged
("No Linkage: Nutrition + Readiness"):

```
volAnticipated = 1.0  (prime | standard)          -- mirrors autoregulation directives
               = 0.8  (strain)
               = 0.5  (breach)

af_dyn    = 1 + (af_base − 1) × volAnticipated
            -- RMR share is untouchable; only the ACTIVITY margin scales.
            -- e.g. af_base 1.725, strain: af_dyn = 1 + 0.725×0.8 = 1.580
            --                     breach: af_dyn = 1 + 0.725×0.5 = 1.3625

tdee_next = ROUND(rmr_kcal × af_dyn)
```

**Step B — macro re-split (recovery-forcing).** Protein rises (tissue repair substrate),
carbs contract with the vanished glycolytic demand, fat holds the hormonal floor:

```
                    protein_coeff            carb_coeff              fat_floor_pct
prime | standard    baseline (0.0018)        baseline (§1.3)         0.20
strain              0.0022                   baseline × 0.85         0.20
breach              0.0024                   baseline × 0.70         0.25

protein_g = ROUND(protein_coeff × body_mass_g)
carbs_g   = ROUND(carb_coeff_adjusted × body_mass_g)
fat_kcal  = max(fat_floor_pct × tdee_next, tdee_next − 4×protein_g − 4×carbs_g)
fat_g     = ROUND(fat_kcal / 9)
```

Worked example — 81,647 g (180 lb) athlete, 15% BF → lean 69,400 g, glycolytic 1–3 h,
af_base 1.725, readiness crashes to 38 (breach):

```
rmr        = 500 + 0.022 × 69,400            = 2,027 kcal
tdee_next  = 2,027 × 1.3625                  = 2,762 kcal   (was 3,497 at full load: −21%)
protein_g  = 0.0024 × 81,647                 = 196 g        (was 147 g: +33%)
carbs_g    = 0.0080 × 0.70 × 81,647          = 457 g → check bands → 457 g
fat_kcal   = max(0.25 × 2,762, 2762 − 784 − 1828) = max(690, 150) → 690 → fat_g = 77 g
carb re-fit: tdee − protein − fat kcal = 2762 − 784 − 690 = 1288 → carbs_g = 322 g
```

(Assembly order when the fat floor binds: protein is law → fat floor is law → carbs absorb
the remainder. Deterministic, no negotiation between macros.)

**Step C — hard clamps** C1–C5 (§1.2) run last. The RED-S floor is the non-negotiable
counterweight: recovery days *reduce* energy, but never below `0.030 kcal/g FFM` —
under-fueling a breached athlete is how RED-S starts, and the clamp makes it unrepresentable.

### 3.3 Persistence and escalation rules

```
├─ Write tomorrow's athlete_nutrition_targets_daily row:
│    tier='performance', day_type = 'recovery_forced' (strain|breach) else 'standard',
│    computation_trace = { readiness_score, state, volAnticipated, af_dyn,
│                          coeffs before/after, clamps fired }
│
├─ HYSTERESIS: state must persist to move the contract twice —
│    a single strain day recalibrates tomorrow; returning to standard the next morning
│    restores baseline immediately (recovery credit is instant, restriction is not sticky).
│
├─ ESCALATION: 3 consecutive breach-recalibrated days
│    → freeze further reductions (hold at breach values)
│    → emit wellbeing escalation event (routes into the EXISTING safety-critical
│      Opus-tier wellbeing path; nutrition math itself stays deterministic)
│
└─ MISSING CHECK-IN: no readiness row today → tomorrow inherits Tier 1 baseline,
     trace notes 'fallback:foundation'. Missing data never punishes.
```

### 3.4 Trilingual verdict templates

```
en: "Recovery recalibration: tomorrow runs at {tdee} kcal — protein up to {p} g,
     carbs eased to {c} g. Fuel the repair, not the strain."
es: "Recalibración de recuperación: mañana operas a {tdee} kcal — proteína sube a {p} g,
     carbohidratos bajan a {c} g. Alimenta la reparación, no el desgaste."
pt: "Recalibração de recuperação: amanhã você opera a {tdee} kcal — proteína sobe para {p} g,
     carboidratos caem para {c} g. Abasteça o reparo, não o desgaste."
```

---

## PART 4 · TIER 3 — FUEL SOVEREIGN (Predictive Periodization)

### 4.1 Contract and data sources

Sovereign stops reacting and starts **scheduling**. It predicts heavy-volume days and
competition windows from the athlete's own floor ledger, then pre-positions carbs, protein,
and nutrient timing across the coming 7 days — recomputed nightly.

**Permitted inputs (exhaustive):**
- `athlete_workload_daily` — per-vector strain, EWMAs, ACWR (built by the Workload Sentinel
  from `bbf_sets`/`bbf_logs`; see companion blueprint §1)
- `bbf_logs`/`bbf_sets` timestamps — session time-of-day inference
- `athlete_readiness_logs` — manual morning check-ins
- `nutrition_intake_log` — adherence history
- Manual check-in declarations (e.g., intake phase flag, optional event confirmation)

**Forbidden inputs:** any wearable field (`wearable_sync_id`, HRV, RHR, sleep-stage
telemetry). The chronobiology loop below is built precisely so the manual event-date crutch
(`bbf_fueling_event_v1` in localStorage) AND the wearable path are both unnecessary.

### 4.2 The chronobiology loop — weekday volume fingerprint

Training life is weekly-periodic: squads lift heavy Mondays, compete Saturdays. The
fingerprint extracts that rhythm from nothing but logged sets:

```sql
CREATE TABLE IF NOT EXISTS public.athlete_volume_fingerprint (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  weekday            SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),   -- 0=Sunday
  ewma_strain_au     NUMERIC NOT NULL DEFAULT 0,     -- EWMA over same-weekday history
  observation_count  INTEGER NOT NULL DEFAULT 0,
  cv                 NUMERIC,                        -- coefficient of variation (stability)
  median_session_min SMALLINT,                       -- minutes-since-midnight, session start
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, weekday)
);
ALTER TABLE public.athlete_volume_fingerprint ENABLE ROW LEVEL SECURITY;
```

```
── FINGERPRINT UPDATE (nightly, per weekday w) ───────────────────────
λ_fp = 0.25                                    -- 8-week effective memory per weekday
F(w) ← λ_fp × strain_au_total(today) + (1 − λ_fp) × F(w)     -- on w's own day only
cv(w) = stddev(last 8 same-weekday strains) / max(mean, ε)

── PREDICTION (for each of the next 7 days d with weekday w) ─────────
F_mean          = mean over the 7 fingerprint rows
predicted_heavy(d) = F(w) ≥ 1.30 × F_mean
confidence(d)      = clamp01( (observation_count(w) / 4) × (1 − min(cv(w), 1)) )

GATE: predictions act only when confidence ≥ 0.5 — a chaotic or young fingerprint
      (< 4 same-weekday observations, or cv ≥ 1) schedules nothing. Fallback: Tier 2.
```

### 4.3 Phase detector — mesocycle state from ACWR trend

```
Inputs: 14-day series of (ewma_acute_au, ewma_chronic_au, ACWR) on the 'total' vector,
        14-day mean-RPE trend from bbf_sets.

slope_chronic = linear-regression slope of C(d) over last 14 d, normalized by C̄
slope_rpe     = same for mean session RPE

PHASE =
  'intensification'  if ACWR > 1.30                                    -- loading hard
  'accumulation'     if 1.00 ≤ ACWR ≤ 1.30 AND slope_chronic > +0.5%/d -- building
  'taper'            if ACWR < 0.80 AND C(d) ≥ 0.8 × max(C, 28d)       -- volume cut,
                        AND slope_rpe ≥ 0                              -- intensity held
  'maintenance'      otherwise
```

### 4.4 Competition-window inference (the automated 48-hour trigger)

The manual event date is replaced by a signature detector — a taper that terminates in a
peak weekend is what competition prep *looks like* in floor data:

```
COMPETITION WINDOW ARMED when EITHER:

A. SIGNATURE (fully automatic):
   PHASE == 'taper' for ≥ 4 consecutive days
   AND next predicted_heavy day d* has confidence ≥ 0.6
   → treat d* as event day T0; arm carb-load window [T0 − 48h, T0]

B. DECLARED (manual check-in, still in-app, still no wearable):
   athlete/coach confirms an event date via check-in
   → T0 = declared date; overrides A on conflict (declaration beats inference)

DISARM: if the taper signature collapses (ACWR re-enters > 1.0 on new heavy floor days
        before T0−48h), the window is cancelled and the trace says why.
```

State persists in:

```sql
CREATE TABLE IF NOT EXISTS public.nutrition_phase_state (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  phase              TEXT NOT NULL CHECK (phase IN
                       ('accumulation','intensification','taper','maintenance')),
  detected_on        DATE NOT NULL,
  carb_window_start  TIMESTAMPTZ,                    -- null when no window armed
  carb_window_end    TIMESTAMPTZ,
  window_source      TEXT CHECK (window_source IN ('signature','declared')),
  confidence         NUMERIC,
  signals            JSONB NOT NULL,                 -- ACWR series, slopes, fingerprint hits
  status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','superseded','cancelled','completed')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.nutrition_phase_state ENABLE ROW LEVEL SECURITY;
```

### 4.5 The predictive macro scheduler (7-day rolling contract)

Nightly, Sovereign writes/updates the next 7 rows of `athlete_nutrition_targets_daily`.
Each day's coefficients start from the Tier 2 output (readiness recalibration still applies
inside Sovereign — the tiers stack, they don't fork) and are then modulated:

```
── CARB MODULATION M_c(d) — multiplicative on carb_coeff ─────────────
day_type(d)                                   M_c      day_type value
default                                       1.00     'standard'
refeed eve (d+1 is predicted_heavy)           1.25     'refeed_eve'
predicted heavy day                           1.15     'heavy_predicted'
post-heavy (d−1 was actual heavy ≥ 1.5× mean) 1.10     'post_heavy'
carb-load window (glycolytic only):
    T0−48h → T0−24h                           ramp to carb_coeff = 0.0110   'carb_load'
    T0−24h → T0                               ramp to carb_coeff = 0.0120   'carb_load'
    (absolute coefficients, not multipliers — the legacy 10–12 g/kg band, gram-based)
competition day T0                            hold 0.0120                    'competition'
taper (non-window days)                       0.90     'taper'

── PROTEIN SCALING P(d) — absolute protein_coeff by phase ────────────
maintenance                    0.0018
accumulation                   0.0020
intensification                0.0022
taper                          0.0018
post_heavy adder               +0.0002        (stacked on phase value)
Tier 2 strain/breach override  max(phase value, Tier 2 value)   -- recovery wins
CAP (clamp C3)                 0.0026

── ENERGY SIDE ───────────────────────────────────────────────────────
af_pred(d) = 1 + (af_base − 1) × predicted_volume_ratio(d)
predicted_volume_ratio(d) = clamp( F(w_d) / F_mean , 0.5 , 1.5 )
tdee(d)    = ROUND(rmr_kcal × af_pred(d))
-- the athlete finally eats FOR the day they're about to have, not the average week

── ASSEMBLY: §1.2 order + clamps C1–C5, then fat residual ────────────
── RECONCILIATION: every night, predicted_heavy vs actual floor strain is compared;
   misses (predicted heavy, floor said light) decay that weekday's fingerprint faster
   (λ_fp doubled for one update). The scheduler self-corrects within 2 weeks. ──
```

### 4.6 Nutrient timing — intra-day windows from floor chronology

Session start time is inferred, not asked: `median_session_min` per weekday from the
first `bbf_sets` write timestamp of each historical session (≥ 4 observations, else no
timing plan). Daily grams are then split into windows and written to
`athlete_nutrition_targets_daily.timing_plan`:

```
Windows relative to predicted session start S (training days only):
  PRE   [S−3h, S−1h]   carbs 25% of carbs_g       protein 20% of protein_g
  PERI  [S, S+session] carbs 10% (only if median session ≥ 90 min, glycolytic)
  POST  [S, S+2h]      carbs 30%                  protein 30%
  BASE  remainder      carbs 35–45%               protein 50% in ≥3 even feedings,
                                                  each ≥ 0.0004 × body_mass_g grams

FASTING COLLISION RULE (Sovereign Vault adults): windows are intersected with the
athlete's eating window. If S sits inside the fast, PRE collapses into the last legal
hour before the fast opens... precisely: PRE and PERI shift to the eating-window
boundary nearest S, POST anchors at window-open, and the trace flags
'timing_compressed_by_fast'. Youth: fasting_window is 'none' by gate — full plan.
Rest days: no windows; BASE carries 100% in even feedings.
```

### 4.7 Sovereign trilingual verdicts

```
en: "Sovereign forecast: heavy floor day {weekday}. Carb ramp starts {date} — {c} g
     scheduled. Protein holds at {p} g through the block."
es: "Pronóstico Soberano: día pesado el {weekday}. La rampa de carbohidratos inicia el
     {date} — {c} g programados. La proteína se mantiene en {p} g durante el bloque."
pt: "Previsão Soberana: dia pesado {weekday}. A rampa de carboidratos começa em {date} —
     {c} g programados. A proteína se mantém em {p} g durante o bloco."
```

---

## PART 5 · ORCHESTRATION, DATA FLOW, EXECUTION MANIFEST

### 5.1 The Fueling Sentinel (new deterministic edge function)

`bbf-fueling-sentinel` — pure Deno, zero Claude calls. Triggers:

1. **Nightly cron** (03:30 athlete-local, after the Workload Sentinel's 03:00 pass so
   `athlete_workload_daily` is fresh): fingerprint update → phase detect → window arm/disarm
   → 7-day Sovereign schedule write (or Tier 1/2 fallback per entitlement + data).
2. **On check-in** (invoked by `bbf-readiness-calculator` completion): Tier 2 pass —
   recalibrate tomorrow's row only.
3. **On body-metrics write / intake completion:** Tier 1 pass — rebase the 28-day baseline.

Idempotent: `UNIQUE (athlete_id, day)` is the idempotency key; every overwrite appends to
`computation_trace.history[]`. Failure posture: fail-open — no write means surfaces render
the last live contract; the meal-plan assembler always has a row to scale against.

### 5.2 Consumer rewiring

- `nutritionEngine.js buildMealPlan()` — signature gains `targets` (the day's row) instead
  of a bare `tdee`; scales meals against `{tdee_kcal, protein_g, carbs_g, fat_g}` and maps
  `timing_plan` windows onto meal slots. Diet hierarchy, allergen net, fasting
  redistribution logic unchanged.
- `fueling-engine.js` — retired as a calculator; becomes a thin reader of
  `athlete_nutrition_targets_daily` (legacy PWA surface). `LB_TO_KG` and all kg
  intermediates deleted. `bbf_fueling_event_v1` localStorage key retired in favor of the
  declared-event check-in (§4.4 B).
- Check-in tab — renders tomorrow's recalibrated contract next to the readiness verdict
  (the Tier 2 bridge made visible).

### 5.3 Closed-loop data flow (one check-in → 7 days of fuel)

```
T+0s    CHECK-IN · readiness 44 (strain) lands in athlete_readiness_logs.
T+1s    bbf-readiness-calculator completes → invokes bbf-fueling-sentinel {athlete, day}.
T+2s    TIER 2 PASS · tomorrow's row rewritten: af 1.725→1.580, protein 147→180 g,
        carbs ×0.85, day_type='recovery_forced', trace records every clamp.
T+3s    Check-in tab paints the trilingual recalibration verdict. String pulled.
───────── nightly ─────────
T+20h   WORKLOAD SENTINEL (03:00) refreshes athlete_workload_daily.
T+20.5h FUELING SENTINEL (03:30) · fingerprint EWMA update → Saturday F(6) = 1.42 × F_mean,
        confidence 0.71 → predicted_heavy(Sat) → Friday flips to 'refeed_eve' (carbs ×1.25),
        Saturday to 'heavy_predicted' (×1.15, af_pred 1.65), Sunday pre-written 'post_heavy'
        (protein +0.0002). Taper signature check: not armed. 7 rows upserted.
T+38h…  Each morning's check-in re-tunes only tomorrow inside the standing 7-day forecast:
        prediction sets the shape, readiness bends it, clamps guard the floor. 48-hour
        carb windows arm themselves off the taper signature — no manual date, no wearable.
```

### 5.4 Execution manifest (for Opus — dependency order)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `athlete_body_metrics` (gram-native, generated lean mass) | `apply_migration` | — |
| 2 | Migration: `athlete_nutrition_targets_daily`, `nutrition_intake_log` | migration | 1 |
| 3 | Config seed: `fueling_coefficients_v1`, `fueling_tier2_states_v1`, `fueling_tier3_modulation_v1` in `bbf_app_config` | migration | — |
| 4 | `bbf-fueling-sentinel` Tier 1 pipeline (RMR/TDEE/macros, clamps, 28-day write) + intake tracking endpoints | edge fn | 2, 3 |
| 5 | Tier 2 pass wired to `bbf-readiness-calculator` completion (states via `_shared/cardio-readiness.ts`) | edge fn | 4 |
| 6 | Migration: `athlete_volume_fingerprint`, `nutrition_phase_state` | migration | Workload substrate (companion blueprint #1–4) |
| 7 | Tier 3 pipelines: fingerprint, phase detector, window inference, 7-day scheduler, timing planner | edge fn | 5, 6 |
| 8 | Consumer rewiring: `buildMealPlan(targets)`, fueling-engine reader mode, Check-in verdict surface; `sw.js`/SPA CACHE bump | frontend | 4–7 |
| 9 | Test suite: gram-identity goldens (legacy kg output ≡ new g/g output at crossover), clamp-binding personas (RED-S floor, fat floor, breach streak), fingerprint convergence (synthetic 8-week Mon/Sat cycle), fasting-collision timing, fallback chain (Sovereign→Performance→Foundation) | tests | all |

**Config keys** (all versioned in `bbf_app_config`): `fueling_coefficients_v1` (§1.3),
`fueling_tier2_states_v1` (§3.2 table), `fueling_tier3_modulation_v1` (§4.5 tables),
`fueling_safety_clamps_v1` (C1–C5 constants). No threshold in this blueprint may be
inlined twice.

**Non-goals of this phase:** micronutrients/hydration modeling, meal-DB expansion (separate
content track), wearable fusion (explicitly forbidden here by order), youth-specific
coefficient calibration beyond the existing gates (config-key override, post-MVP).

---
*Foundation sets the number. Performance bends it to today's engine state. Sovereign moves
it before the day even arrives — all of it in grams, all of it from the floor.*
