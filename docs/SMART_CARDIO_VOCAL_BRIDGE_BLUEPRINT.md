# BBF Smart Cardio Engine + Zero-API Sovereign Audio Stitching Router
## The Cardiovascular Counterweight to Mechanical Load — Spoken Without a Single Live API Call

**Date:** 2026-07-02 · **Version:** v2 — **supersedes v1's live-compose vocal integration**
(v1 Part 3 routed the daily brief through live Sonnet + live ElevenLabs at check-in; that
path is now demoted per CEO margin constraint — see §3.0).
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
```

MET constants (config-keyed `cardio_met_values_v1`): Zone 2 = 6.0 · Tempo = 8.5 ·
HIIT = 11.0 (interval-averaged, rest periods included).

### 0.2 Zero Live API (CRITICAL SYSTEM CONSTRAINT)

**The athlete's daily check-in path may not invoke any live LLM prompt generation or live
text-to-speech synthesis.** The daily Sovereign Briefing is assembled from **pre-baked
audio fragments** by a deterministic router — Postgres reads + Storage URLs only.

- **The only place LLM/TTS run is the bake pipeline** (§3.6): scripts are authored once,
  CEO-audited, synthesized once, stored forever. Marginal cost per athlete per day: **zero
  API calls.** This extends the proven "Operation Eviction / MARGIN GUARD" pattern
  (`bbf-bake-coach-static` → `coach-static` bucket → `staticVoice.js` manifest resolver)
  from single clips to a sequenced grammar.
- The existing **baseline readiness audio buckets are preserved** as the mandatory opening
  slot of every briefing (§3.2).
- v1's live Sonnet + ElevenLabs compose path is **demoted to non-daily special moments
  only** (Day-30 graduation ceremony, milestone promotions) where a one-off synthesis cost
  is justified; it is never on the daily check-in path.

### 0.3 Inherited constraints (binding)

1. **Deterministic core** (Dossier §4.3): bridge, matrix, and stitching router are pure
   Deno — zero Claude calls, zero TTS calls, zero `model-router.ts` imports at runtime.
2. **Missing data never punishes:** absent workload/recovery/debt rows → the mechanical
   ceiling is silent; a missing fragment → the beat is dropped, never a blocked briefing.
3. **No wearable dependencies:** all new math reads native floor data and check-ins only.
   HR caps are estimated natively (Tanaka from `birth_date`) with an RPE/talk-test fallback.
4. **Ceiling composition law ("gentlest wins"):** `applyTierCeiling` is the composition
   operator for ALL ceilings. Zone 2 < Tempo < HIIT; the minimum always survives.
5. **The manifest is the allow-list** (Dossier §4.1, extended to audio): the router may
   only emit fragment keys that exist in the baked manifest, verified for all three locales
   at bake time. No key can be constructed at runtime that was not enumerated at bake time.
6. **Trilingual structural:** every fragment is baked in en/es/pt — same voice
   (Akeem clone `ZbKDEqxkr8Ub4psNm5XD`), same `eleven_multilingual_v2`, same
   `BBF_VOICE_SETTINGS`, spoken natively per language. One voice, three languages.
7. **AI_DIRECTIVES §7:** fragment scripts speak *physiology*, never *system internals* —
   enforced at authoring time (scripts are static, audited text; nothing can leak at
   runtime because nothing is generated at runtime).
8. **Service-role-only RLS** on every new table; frozen response contracts extended
   additively only.

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

Computed each morning (and re-computed on floor sync — §4), producing
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
new CNS withdrawal — active protection, not punishment. This causal logic is baked into the
S1 fragment scripts (§3.3) so the athlete *hears* the why.

### 1.4 The same-day interference rule

Concurrent-training interference: heavy lower-body mechanical work and high-intensity
cardio in the same day compete for the same recovery currency.

```
IF today's already-synced floor tonnage on { knee_dominant ∪ hip_hinge } vectors
   ≥ 0.6 × that athlete's 28-day mean daily total tonnage
THEN cap cardio at 'Tempo' (or 'Zone 2' if the session's mean RPE ≥ 8),
     AND stamp interference_gap_advice = '6h' into the trace.
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

Rationale encoded in the matrix (and in the S5 fragment scripts): ATP-PC athletes
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

Every number lands in `bbf_cardio_prescription` and flows into §3's screen-facts channel.

---

## PART 3 · THE ZERO-API AUDIO STITCHING ROUTER (The Sovereign Brief)

### 3.0 The margin problem, stated

v1 composed each daily brief live: one Sonnet call + ~1.5k characters of ElevenLabs
synthesis per athlete per day — a per-seat marginal cost that scales linearly with the
$49.99 roster and burns the voice meter on every check-in. v2 inverts the cost curve:
**author once, synthesize once, route forever.** The daily path is a pure lookup; the
entire fragment library (~150 clips, §3.5) costs one bounded bake run, re-paid only when
the CEO changes the words.

### 3.1 The core idea — a sentence grammar made of audio

A briefing is not one recording; it is a **sequenced playlist of pre-baked fragments**
that, played back-to-back in Akeem's voice with engineered pause spacing, sounds like one
continuous address. The router's job each morning: read the day's math, pick the fragments,
order them, and hand the frontend a gapless play contract.

```
BRIEFING GRAMMAR (fixed slot order — the spine never changes):

  S0  BASE READINESS   (required)  ← the existing baseline readiness buckets, preserved
  S1  MECH CEILING     (conditional vector track)
  S2  PREHAB WARNING   (conditional vector track)
  S3  RECOVERY STATE   (conditional vector track)
  S4  NUTRITION SHIFT  (conditional vector track)
  S5  CARDIO ORDER     (required — the day's cardiac prescription)
  S6  FORECAST PEEK    (conditional vector track)
  S7  OUTRO            (required — tone-matched close)

RULE OF THREE: at most 3 conditional slots (S1–S4, S6) play per briefing — selected by
the deterministic beat ranker (severity table below). A briefing that mentions everything
explains nothing. Playlist length: 3–6 fragments · ~45–100 s total.
```

### 3.2 Slot S0 — the preserved baseline readiness buckets

The four canonical readiness modes map 1:1 to the existing baseline audio buckets — these
tracks open every briefing, unchanged in concept, re-cut once into the new fragment format:

```
readiness state (canonical vocab)  →  S0 variant_key
  prime     (score ≥ 85)              S0_PRIME
  standard  (65–84)                   S0_STANDARD
  strain    (40–64)                   S0_STRAIN
  breach    (< 40)                    S0_BREACH
  (no check-in yet)                   S0_NEUTRAL       -- fifth bucket, generic open
```

### 3.3 Conditional vector tracks — variant keyspace (the full enumeration)

Every variant key is a **quantized bucket**, not a free value — that is what makes
pre-baking possible. The complete keyspace (config `sovereign_fragment_keys_v1`):

```
S1 · MECH CEILING — cause × action
  causes:  AXIAL_SPIKE | IMPACT_SPIKE | SHADOW_48H | SYSTEMIC_DEBT | MONOTONY   (5)
  actions: ZONE2_FORCED | TEMPO_CAPPED                                          (×2 = 10)
  script shape: "[cause in coach language] — so today we [action], and let the
                 engine rebuild while the tissue catches up."

S2 · PREHAB WARNING — joint × priority
  joints:  KNEE | LOWER_BACK | SHOULDER | ELBOW | HAMSTRING | ANKLE             (6)
  priority: MANDATORY (gate) | STRONG (injected)                                (×2 = 12)
  script shape: "Your [joint] has been carrying the spike. [Mandatory: The floor
                 opens after the protection work — non-negotiable today.]"

S3 · RECOVERY STATE
  SHADOW_ACTIVE | DEEP_DEBT_LOWER | DEEP_DEBT_UPPER                             (3)

S4 · NUTRITION SHIFT — day_type quantized
  RECOVERY_FORCED | REFEED_EVE | CARB_LOAD | POST_HEAVY | TAPER                 (5)
  script shape (RECOVERY_FORCED): "Fuel shifts with the day: protein climbs,
                 carbs ease back. Feed the repair, not the strain — the exact
                 grams are on your screen right now."
                 ← the voice points at the screen; the screen carries the digits.

S5 · CARDIO ORDER — tier × duration bucket
  tiers:   ZONE2 | TEMPO | HIIT   (talk-test line baked into each tier script)  (3)
  duration: SHORT (<20) | MID (20–35) | LONG (>35)                              (×3 = 9)

S6 · FORECAST PEEK
  HEAVY_DAY_SOON | REFEED_TOMORROW | CARB_WINDOW_OPEN                           (3)

S7 · OUTRO — tone
  PROTECTIVE | STEADY | CELEBRATORY                                             (3)

Keyspace: S0(5) + S1(10) + S2(12) + S3(3) + S4(5) + S5(9) + S6(3) + S7(3) = 50 keys
× 3 locales = 150 fragments  ·  ~10–14 s each  ·  ≈ 30 min total audio, baked once.
```

**Quantization doctrine (how personalization survives without live TTS):** continuous
values are bucketed to the nearest baked phrase; the **exact numbers ride the visual
channel** (`screen_facts`, §3.7) synchronized to the fragment that references them. The
voice delivers the *why* in Akeem's cadence ("about sixty percent above what your body is
conditioned for" is baked into `S1_AXIAL_SPIKE_*`); the screen delivers the *digits*
(`ACWR-driven +62%`, `196 g protein`, `701 g water`) at the moment the matching fragment
plays. Gram precision is never spoken approximately AND displayed wrong — the numbers on
screen come straight from the deterministic ledgers.

### 3.4 The routing logic tree (pure lookups, zero AI, zero TTS)

```
INPUT: bbf_daily_brief_context.payload (unchanged from v1 — the deterministic
       JSON assembled from the cardio/nutrition/prehab/recovery engines)

STEP 1 · BEAT RANKING (deterministic severity table, carried over from v1):
  mechanical DANGER ceiling bound .......... 90  → S1
  mandatory prehab queued .................. 85  → S2
  recovery_forced nutrition day ............ 80  → S4
  recovery shadow active ................... 75  → S3
  refeed/carb-load upcoming ................ 60  → S6
  caution-zone vector (no ceiling bound) ... 50  → S1 (TEMPO_CAPPED variants)
  clean day ................................ 20  → no conditional slots
  TAKE TOP 3 · one fragment per slot · slot order S1→S6 regardless of severity order
  (severity picks WHICH; the grammar picks WHERE — the spine keeps it sounding human)

STEP 2 · VARIANT RESOLUTION (quantization tables, config-keyed):
  e.g. payload.workload.spiking_vectors[0] = { vector:'axial', acwr:1.62 }
       + payload.cardio.effective_tier = 'Zone 2' with mechanical bound
       → S1 key = 'S1_AXIAL_SPIKE_ZONE2_FORCED'
  e.g. payload.prehab.queued[0] = { joint:'knee', priority:'mandatory' }
       → S2 key = 'S2_KNEE_MANDATORY'
  e.g. payload.cardio = { tier:'Zone 2', duration_min:26 }
       → S5 key = 'S5_ZONE2_MID'

STEP 3 · TONE RESOLUTION:
  any DANGER/mandatory beat → PROTECTIVE · all-clear prime day → CELEBRATORY
  otherwise → STEADY        → S0 variant + S7 variant share the tone register

STEP 4 · MANIFEST RESOLUTION (the allow-list):
  each (slot, variant_key, locale) → sovereign_audio_fragments row → URL, duration_ms
  MISS RULE: fragment missing → drop that beat, promote next-ranked beat; S0/S5/S7
  missing (should be impossible post-bake-verification) → fallback chain (§3.8)

STEP 5 · PLAYLIST ASSEMBLY:
  ordered array + inter-fragment gap_ms (§3.6) + screen_facts bound to sequence
  indices + total_duration_ms = Σ duration_ms + Σ gap_ms
  → WRITE sovereign_brief_playlists row (athlete, day, locale) status 'ready'
```

### 3.5 Schema additions

```sql
-- The baked fragment library (the allow-list)
CREATE TABLE IF NOT EXISTS public.sovereign_audio_fragments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot           TEXT NOT NULL CHECK (slot IN ('S0','S1','S2','S3','S4','S5','S6','S7')),
  variant_key    TEXT NOT NULL,                    -- 'S1_AXIAL_SPIKE_ZONE2_FORCED'
  locale         TEXT NOT NULL CHECK (locale IN ('en','es','pt')),
  script_text    TEXT NOT NULL,                    -- the audited words, versioned
  script_version INTEGER NOT NULL DEFAULT 1,
  sha256         TEXT NOT NULL,                    -- hash of script_text → idempotent re-bake
  storage_path   TEXT NOT NULL,                    -- sovereign-fragments/<key>-<locale>.mp3
  public_url     TEXT NOT NULL,
  duration_ms    INTEGER NOT NULL,
  lufs           NUMERIC,                          -- loudness-normalization audit (§3.6)
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','retired')),
  baked_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_key, locale, script_version)
);
ALTER TABLE public.sovereign_audio_fragments ENABLE ROW LEVEL SECURITY;

-- The daily stitched result (one row per athlete per day per locale)
CREATE TABLE IF NOT EXISTS public.sovereign_brief_playlists (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  day                DATE NOT NULL,
  locale             TEXT NOT NULL CHECK (locale IN ('en','es','pt')),
  playlist           JSONB NOT NULL,               -- §3.7 array, resolved URLs inline
  screen_facts       JSONB NOT NULL DEFAULT '[]',
  beats_selected     JSONB NOT NULL,               -- ranked beats + dropped beats (audit)
  tone               TEXT NOT NULL,
  total_duration_ms  INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'ready'
                       CHECK (status IN ('ready','consumed','stale')),
  computed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, day, locale)
);
ALTER TABLE public.sovereign_brief_playlists ENABLE ROW LEVEL SECURITY;
```

`bbf_daily_brief_context` (v1) is retained unchanged — it remains the router's input.

### 3.6 The bake pipeline + audio continuity engineering

Extends `bbf-bake-coach-static` verbatim in posture (shared-secret gate, idempotent
skip-by-hash, batch cap, stateless synth-proxy) into `bbf-bake-sovereign-fragments`:

```
AUTHORING (offline, once per copy change):
  scripts/sovereign-fragment-scripts.json — 50 keys × 3 locales, committed to the repo.
  Claude MAY draft them (one-time authoring assist, Sonnet); the CEO audits the text;
  the committed file is the source of truth. AI_DIRECTIVES §7 is enforced HERE, in
  static text review — nothing is generated at athlete time, so nothing can leak.

SYNTHESIS RULES (what makes 6 fragments sound like ONE take):
  • one voice, one model, one settings block (existing constants — never vary per clip)
  • every script is 1–3 COMPLETE sentences; terminal punctuation; no dangling
    conjunctions; no fragment ever references audio position ("next", "as I said")
  • loudness-normalized at bake: −16 LUFS integrated, −1.5 dBTP peak (stored for audit)
  • leading/trailing silence trimmed to ≤ 60 ms at bake
  • playback spacing: gap_ms = 240 between fragments (one natural breath), 400 before S7
    (paragraph turn) — constants in config 'sovereign_stitch_timing_v1'

COVERAGE GATE (the allow-list, enforced):
  post-bake verification job enumerates the FULL router keyspace × 3 locales and asserts
  an 'active' fragment for every cell. A red coverage report blocks router deploy —
  the router can never route to silence.
```

**Margin math (the point of all this):** live path ≈ 1 LLM call + ~1.5k TTS chars ×
athletes × 365 days. Stitched path: 150 clips × ~12 s, baked once (~30 min of synthesis,
one bounded run), then **zero marginal API cost forever**. Re-bake touches only fragments
whose `sha256` changed. Daily cost per athlete: 2 Postgres reads + N cached-CDN fetches.

### 3.7 The frontend play contract (exact JSON response)

Served by the playlist read endpoint (vault-token gated, cache-read like today's briefing
tile). This is the complete shape the player needs for seamless back-to-back playback:

```jsonc
{
  "ok": true,
  "contract_version": "sovereign_stitch_v1",
  "source": "stitched_zero_api",
  "briefing": {
    "briefing_id": "…", "day": "2026-07-02", "locale": "es",
    "tone": "protective_confident",
    "total_duration_ms": 68400,                    // Σ durations + Σ gaps → one seek bar
    "playlist": [
      {
        "seq": 0, "slot": "S0", "variant_key": "S0_STRAIN",
        "url": "https://…/sovereign-fragments/s0-strain-es.mp3",
        "sha256": "…", "duration_ms": 11200,
        "gap_after_ms": 240,                       // engineered breath before next clip
        "screen_fact_ids": ["readiness"]
      },
      { "seq": 1, "slot": "S1", "variant_key": "S1_AXIAL_SPIKE_ZONE2_FORCED",
        "url": "…", "sha256": "…", "duration_ms": 13600, "gap_after_ms": 240,
        "screen_fact_ids": ["axial_spike"] },
      { "seq": 2, "slot": "S2", "variant_key": "S2_KNEE_MANDATORY",
        "url": "…", "sha256": "…", "duration_ms": 12100, "gap_after_ms": 240,
        "screen_fact_ids": [] },
      { "seq": 3, "slot": "S4", "variant_key": "S4_RECOVERY_FORCED",
        "url": "…", "sha256": "…", "duration_ms": 11800, "gap_after_ms": 240,
        "screen_fact_ids": ["protein", "carbs"] },
      { "seq": 4, "slot": "S5", "variant_key": "S5_ZONE2_MID",
        "url": "…", "sha256": "…", "duration_ms": 12300, "gap_after_ms": 400,
        "screen_fact_ids": ["hr_cap", "hydration"] },
      { "seq": 5, "slot": "S7", "variant_key": "S7_PROTECTIVE",
        "url": "…", "sha256": "…", "duration_ms": 6200, "gap_after_ms": 0,
        "screen_fact_ids": [] }
    ],
    "screen_facts": [                              // the gram-precise visual channel
      { "id": "readiness",   "label": "Readiness",      "value": "62 · Strain" },
      { "id": "axial_spike", "label": "Squat-pattern load", "value": "+62% vs monthly norm" },
      { "id": "protein",     "label": "Protein target",  "value": "196 g" },
      { "id": "carbs",       "label": "Carb target",     "value": "322 g" },
      { "id": "hr_cap",      "label": "Heart-rate cap",  "value": "157 bpm · full sentences" },
      { "id": "hydration",   "label": "Rehydration",     "value": "701 g water" }
    ],
    "transcript": "…full stitched script text in locale, for accessibility/captions…"
  },
  "playback_directives": {                         // spec for the player, not code
    "preload": "all",                              // fetch+decode every clip BEFORE play
    "scheduling": "sample_accurate",               // Web-Audio buffer scheduling, not
                                                   //   sequential <audio> events (which gap)
    "gap_source": "gap_after_ms",                  // silence is scheduled, not file-baked
    "seek_model": "virtual_timeline",              // one continuous scrubber over the sum
    "fact_sync": "on_fragment_start"               // surface screen_facts as its clip begins
  },
  "fallback_chain": ["stitched", "yesterday_playlist", "base_only", "device_tts"]
}
```

**Why it sounds continuous:** identical voice/model/settings + bake-time loudness
normalization (no level jumps) + trimmed clip edges + *scheduled* silence at natural breath
lengths + full preload with sample-accurate scheduling (no network hitch mid-brief) +
scripts authored as complete sentences with a fixed rhetorical spine. The athlete hears one
address; the system played six files.

### 3.8 Fallback chain (fail-open, in order)

```
1. stitched            today's sovereign_brief_playlists row (normal path)
2. yesterday_playlist  no context yet (pre-check-in open) → yesterday's row, flagged stale
3. base_only           playlist of [S0_NEUTRAL, S7_STEADY] — always baked, always valid
4. device_tts          speechFallback.js reads the transcript — existing pattern, zero API
```

---

## PART 4 · ORCHESTRATION & CLOSED-LOOP FLOW

### 4.1 The morning chain (extends the existing tripwire, no new cron, no API calls)

```
03:00  Workload Sentinel (nightly)            → athlete_workload_daily fresh
03:30  Fueling Sentinel (nightly)             → nutrition targets fresh
──── athlete wakes ────
T+0    Morning check-in → bbf_daily_protocols tripwire (EXISTING) fires:
T+1s   bbf-readiness-calculator               → readiness verdict (+ Tier 2 fueling pass)
T+2s   bbf-cardio-prescription (EXTENDED)     → recovery band + MECHANICAL BRIDGE (Part 1)
                                                + PRESCRIPTION MATRIX (Part 2)
T+3s   brief-context composer (pure joins)    → bbf_daily_brief_context 'ready'
T+4s   STITCHING ROUTER (pure lookups)        → beat rank → variant keys → manifest
                                                → sovereign_brief_playlists 'ready'
T+5s   Athlete opens Vault Hub: playlist + screen facts render instantly.
       ZERO LLM calls. ZERO TTS calls. ZERO voice-meter spend. Two table reads.
```

### 4.2 Intra-day resync

Floor sync re-fires the Workload Sentinel; its pipeline tail now recomputes
`bbf_cardio_prescription` (interference rule §1.4 may bind), refreshes
`bbf_daily_brief_context`, and **re-routes the playlist in place** (UNIQUE key upsert,
`status` back to `ready`). Because stitching is free, the evening brief always speaks to
the day that actually happened — re-generation costs nothing, so it happens every time.

### 4.3 Loop invariants

1. **Single writer per table:** the morning chain writes prescriptions, context, and
   playlists; the playback endpoint only reads and flips `status` to `consumed`.
2. **The ceiling chain + beats_selected are the audit trail:** "why Zone 2, why these
   three beats, which beats were dropped" is answerable from the rows alone.
3. **Gram-pure outputs:** EE via the gram-MET identity; sweat/rehydration as integer
   grams; exact gram values reach the athlete via screen_facts, verbatim from the ledgers.
4. **Zero-API invariant (the margin lock):** the daily path touches Postgres and Storage
   only. Grep-level enforcement: no `model-router`, no ElevenLabs import may exist in the
   router or playback functions — CI asserts it.
5. **Fail-open at every seam:** missing fragment → dropped beat; missing context →
   yesterday; missing everything → base bucket + device TTS. The athlete always hears
   *something* in ≤ 2 s.

---

## PART 5 · EXECUTION MANIFEST (for Opus)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `bbf_cardio_prescription` ALTER (§1.5) + `sovereign_audio_fragments` + `sovereign_brief_playlists` + `bbf_daily_brief_context` (all RLS on, zero policies) | `apply_migration` | Workload substrate #1–4 |
| 2 | Config seeds: `cardio_mech_ceiling_v1`, `cardio_matrix_v1`, `cardio_met_values_v1`, `cardio_hr_model_v1`, `sovereign_fragment_keys_v1`, `sovereign_stitch_timing_v1` | migration | — |
| 3 | `bbf-cardio-prescription` v2: mechanical bridge + prescription matrix + gram EE/sweat outputs (ZERO AI, unchanged posture) | edge fn | 1, 2 |
| 4 | `bbf-agentic-cardio` v2: consume the day's prescription row for ceilings; FROZEN CONTRACT extended additively | edge fn | 3 |
| 5 | Fragment scripts: `scripts/sovereign-fragment-scripts.json` — 50 keys × en/es/pt, drafted then CEO-audited, committed | content | — |
| 6 | `bbf-bake-sovereign-fragments` (clone of coach-static baker posture: secret gate, hash-idempotent, batch-capped) + post-bake coverage gate | edge fn + script | 1, 5 |
| 7 | Brief-context composer + stitching router appended to the morning chain (pure joins/lookups) | edge fn | 3 + fueling/prehab substrates, 6 |
| 8 | Playlist read endpoint (vault-token gated) + frontend gapless player per §3.7 playback_directives + screen-facts panel; CACHE bump | frontend | 7 |
| 9 | `bbf-sovereign-briefing` demotion: daily tripwire path removed; live compose retained ONLY for graduation/milestone events | edge fn | 7 |
| 10 | Tests: gram-identity goldens (MET/sweat), ceiling composition truth table, matrix personas, beat-ranker determinism, keyspace coverage test (router can never emit an unbaked key), fallback-chain walk, zero-API CI grep (no model-router/TTS imports in daily path), loudness/gap audio QA checklist | tests | all |

**Non-goals:** wearable HR fusion (out by order), in-session live HR adjustment,
number-synthesis/digit-stitching (rejected by design — robotic seams break the illusion;
digits live on screen), per-athlete voice cloning.

---
*The floor loads the spring; the engine is the counterweight. The athlete hears why in
Akeem's voice, in their language, every morning — and it never costs another API call.*
