# BBF 90-Day Language Mastery — Closed-Loop Fluency Engine
## Unifying Vocab Gym · Voice Matrix · Voice Studio · Immersion · Real Ready · Pimsleur · God-Mode Drills

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No deployable code in this
document; it is the spec.
**Scope:** Pure architectural logic, database schema additions, and mathematical trees.
**Companions:** Language Mastery Technical Audit (raw state) · Workload/Recovery, Fueling,
Cardio/Stitching, and Studio V4 blueprints (the patterns this engine reuses).

**Grounded against the live code:** `bbf_vocab_mastery` + `bbf_language_progress` +
vault-token RPCs (`bbf_record_vocab_attempt`, `bbf_save_language_score`),
`bbf-agentic-immersion` (Opus; returns `{ai_reply, grammar_correction, fluency_score}`),
`bbf-agentic-linguist` (Haiku via router; returns `{translation, phonetic,
literal_meaning}`), `pimsleurAudioCurriculum.json` (10 lessons, `dialogue_flow` arrays,
3 voice roles, 3.0 s / 4.0 s pause standards), the Sovereign fragment-stitching substrate
(`sovereign_audio_fragments` pattern + bake pipeline + gapless play contract).

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Standard Cross-Over (CRITICAL SYSTEM CONSTRAINT)

The Linguist Engine translates gym-floor cues that reference **mass and load**. Every
structural mass reference that is translated, templated, or stored MUST align with the
fitness ledgers' gram standard (`body_mass_g`, `load_g`, BIGINT grams):

```
CUE TEMPLATE CONTRACT (stored form — slots, never literals):
  "Add {load_g} to the bar"  →  es: "¡Súbele {load_g} a la barra!"
                                pt: "Bota mais {load_g} na barra!"
RENDER RULE: {load_g} / {body_mass_g} slots resolve at display time from the ledgers
  (bbf_sets.load_g, athlete_body_metrics.body_mass_g) as locale-grouped INTEGER grams:
  en "2,268 g" · es "2.268 g" · pt "2.268 g"

BANNED LEXEMES in stored templates and stored translations (CI grep, both languages):
  /\b(kilos?|kg|libras?|lbs?|quilos?)\b/i
  A translation containing a banned lexeme is REJECTED at persist time (the Linguist
  is re-prompted with the slot contract; on second failure the cue stores untranslated
  with status 'needs_review'). Mass leaves the system only as grams.
```

### 0.2 Zero Live API — Margin Guard (CRITICAL SYSTEM CONSTRAINT)

```
ZERO-API SURFACES (pre-baked audio + deterministic client/RPC lookups ONLY):
  · Daily vocab training (Vocab Gym selection, scoring, SRS scheduling)
  · Pimsleur lesson playback (all 10 lessons, both languages)
  · God-Mode drill sequencing (drill scripts compiled from SRS state)
  · Real Ready phrase practice · intention statements · Voice Matrix cue playback

LIVE-LLM SURFACE (exactly one):
  · Immersion Roleplay persistence layer — in-app multi-turn conversation via
    bbf-agentic-immersion (Opus tier via router — unchanged), because a roleplay
    partner cannot be pre-baked. Session writes are the ONLY live-model pathway.
  · (bbf-agentic-linguist remains live-callable as a COACH tool — it is not part of
    the athlete's daily training loop; its outputs are now LOGGED (§1.4) so repeated
    cues resolve from the ledger cache first: cache-hit = zero API.)

TTS: NEVER live. All lesson/drill/term audio is baked once (§3.2) into a public
bucket — the same MARGIN GUARD pattern as coach-static and the Sovereign fragments.
CI grep: no model-router or TTS import in any Vocab Gym / Pimsleur / drill module.
```

### 0.3 Inherited constraints (binding)

1. **Deterministic core:** SRS math, phase gates, drill compilers, trend detection —
   pure TypeScript/SQL, seeded-LCG randomness only (prescription-engine pattern),
   replayable from the ledgers.
2. **Missing data never punishes:** null fluency history → gates report `insufficient_data`
   and hold, never regress; a missing audio fragment → the item is skipped, never a
   blocked lesson.
3. **Vault-token security model preserved:** all new writes go through SECURITY DEFINER
   RPCs keyed off the session token, exactly like `bbf_record_vocab_attempt`. RLS enabled,
   zero anon policies, on every new table.
4. **Scope preserved:** admin/CEO-only surface (AdminGuard), per the audit. The schema is
   multi-athlete-ready (every table keys on `athlete_id`) but no entitlement change ships.
5. **Trilingual discipline inverted:** this is the module *teaching* es/pt — UI chrome
   stays trilingual, but content locale = the **target language** of the active profile.

---

## PART 1 · THE UNIFIED POLYGLOT SUBSTRATE (Cross-Module Feedback)

### 1.1 `bbf_language_profiles` — the learner spine

One row per (athlete, language). Every module reads it; only the Polyglot Sentinel RPCs
write it. This is the table that ends the silo era: all seven modules key their state here.

```sql
CREATE TABLE IF NOT EXISTS public.bbf_language_profiles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id            UUID NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  language              TEXT NOT NULL CHECK (language IN ('es','pt')),
  -- phase machine (Part 4 is the only writer of these three)
  phase                 SMALLINT NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 5),
                        -- 1 FOUNDATION · 2 ACCELERATION · 3 IMMERSION · 4 MASTERY SPRINT
                        -- 5 GRADUATED (terminal)
  phase_started_on      DATE NOT NULL DEFAULT CURRENT_DATE,
  protocol_started_on   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- streak structure (deterministic update rule §1.2)
  streak_current        INTEGER NOT NULL DEFAULT 0,
  streak_best           INTEGER NOT NULL DEFAULT 0,
  last_qualified_on     DATE,                       -- last day a qualifying event landed
  -- rolled fluency state (Part 4 trend math is the writer)
  fluency_ewma          NUMERIC,                    -- EWMA of immersion scores, λ=0.30
  fluency_slope_14d     NUMERIC,                    -- pts/day linear slope, 14d window
  vocab_mastered        INTEGER NOT NULL DEFAULT 0, -- box_level=5 count (cached rollup)
  pimsleur_done         INTEGER NOT NULL DEFAULT 0, -- completed lesson count
  phrases_mastered      INTEGER NOT NULL DEFAULT 0, -- Real Ready kit, box_level≥4
  weak_clusters         JSONB NOT NULL DEFAULT '[]',-- ranked §4.4 error clusters
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, language)
);
ALTER TABLE public.bbf_language_profiles ENABLE ROW LEVEL SECURITY;
```

### 1.2 The streak rule (one definition, all modules)

```
QUALIFYING EVENT (any ONE per calendar day, athlete-local):
  vocab session with ≥ 10 attempts · Pimsleur segment ≥ 5 listened minutes ·
  immersion session ≥ 4 turns · drill sequence completed · ≥ 5 phrases reviewed

ON qualifying event (day D):
  D == last_qualified_on            → no-op (already counted)
  D == last_qualified_on + 1 day    → streak_current += 1
  D >  last_qualified_on + 1 day    → streak_current = 1          (reset, no punishment
                                                                   beyond the reset itself)
  streak_best = max(streak_best, streak_current)
```

### 1.3 `bbf_vocab_mastery` v2 — from read-only mirror to live loop

```sql
ALTER TABLE public.bbf_vocab_mastery
  ADD COLUMN IF NOT EXISTS language        TEXT NOT NULL DEFAULT 'es'
                             CHECK (language IN ('es','pt')),
  ADD COLUMN IF NOT EXISTS source          TEXT NOT NULL DEFAULT 'seed'
                             CHECK (source IN ('seed','phrase_kit','immersion_inject',
                                               'linguist_flag','pimsleur_vocab')),
  ADD COLUMN IF NOT EXISTS injected_from   UUID,           -- immersion session provenance
  ADD COLUMN IF NOT EXISTS due_at          TIMESTAMPTZ,    -- SRS schedule (§2.2 writer)
  ADD COLUMN IF NOT EXISTS lapses          INTEGER NOT NULL DEFAULT 0,  -- box resets count
  ADD COLUMN IF NOT EXISTS priority_boost  NUMERIC NOT NULL DEFAULT 0
                             CHECK (priority_boost BETWEEN 0 AND 1),
  ADD COLUMN IF NOT EXISTS error_cluster   TEXT;           -- §4.4 taxonomy tag, if injected
-- UNIQUE constraint widens: (athlete_id, term) → (athlete_id, language, term)
```

The 100 seed terms, the 50-phrase Rio Ready kit, and each Pimsleur lesson's `vocabulary[]`
migrate from JSX/JSON into a `bbf_vocab_catalog` reference table (term, language, category,
`phase_min`, audio fragment keys) — content becomes versioned data, and every module draws
from one pool.

### 1.4 The injection loop — immersion errors become Box-1 homework

Immersion moves **in-app** (the audit's copy-paste flow dies): the frontend calls
`bbf-agentic-immersion` directly, and a new persistence layer captures every turn. The
function's response contract is extended additively — alongside the free-text
`grammar_correction` it now returns a **structured error block** (this is the live-LLM
surface, §0.2, so structure costs nothing extra):

```jsonc
"errors": [   // [] when grammar_correction === "Perfect."
  { "term": "estar",                       // the reviewable unit (word or short phrase)
    "cluster": "ser_estar",                // MUST be from the fixed taxonomy (§4.4)
    "severity": "major" | "minor" }
]
```

```sql
CREATE TABLE IF NOT EXISTS public.bbf_immersion_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id     UUID NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  language       TEXT NOT NULL CHECK (language IN ('es','pt')),
  scenario_key   TEXT NOT NULL,
  phase          SMALLINT NOT NULL,
  turn_count     INTEGER NOT NULL DEFAULT 0,
  avg_fluency    NUMERIC,
  error_clusters JSONB NOT NULL DEFAULT '{}',       -- { "ser_estar": 3, "gender": 1 }
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at       TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS public.bbf_immersion_turns (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.bbf_immersion_sessions(id) ON DELETE CASCADE,
  turn_num           INTEGER NOT NULL,
  user_input         TEXT NOT NULL,
  ai_reply           TEXT NOT NULL,
  grammar_correction TEXT,
  errors             JSONB NOT NULL DEFAULT '[]',   -- the structured block, verbatim
  fluency_score      SMALLINT CHECK (fluency_score BETWEEN 0 AND 100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, turn_num)
);
-- RLS on both; SECURITY DEFINER RPC writers only.
```

**The loop itself (deterministic post-session pass, `bbf_immersion_close_session` RPC):**

```
ON session end:
 1. avg_fluency = mean(turn fluency, excluding 0-score empty turns)
 2. error_clusters = fold(turn.errors[].cluster → counts)
 3. FOR EACH distinct error term across turns:
      UPSERT bbf_vocab_mastery (athlete, language, term):
        box_level      = 1                    -- to the front of the line, even if it
                                              --   was box 5 (a live miss beats history)
        lapses        += 1 (if row existed at box ≥ 2)
        source         = 'immersion_inject', injected_from = session_id
        error_cluster  = cluster tag
        priority_boost = severity == 'major' ? 0.50 : 0.25
        due_at         = now()                -- due immediately
 4. Append session row to bbf_language_session_history (§4.3)
 5. Update bbf_language_profiles: fluency_ewma ← 0.30×avg + 0.70×prior · streak check
MANDATORY REVIEW GUARANTEE: injected terms occupy the Vocab Gym's mandatory slots
(§2.3) on the very next session — the athlete cannot grind high-box terms while
yesterday's live mistakes sit unreviewed.
```

**Linguist joins the loop (and the gram ledger):**

```sql
CREATE TABLE IF NOT EXISTS public.bbf_linguist_cue_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cue_en          TEXT NOT NULL,
  language        TEXT NOT NULL CHECK (language IN ('es','pt')),
  translation     TEXT NOT NULL,           -- template form: {load_g} slots, no literals
  phonetic        TEXT NOT NULL,
  literal_meaning TEXT NOT NULL,
  has_mass_slot   BOOLEAN NOT NULL DEFAULT false,   -- §0.1 contract
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','needs_review')),
  requested_by    UUID REFERENCES public.bbf_users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cue_en, language)
);
```

Cache-first: a repeated cue resolves from the ledger (zero API). New translations persist
through the banned-lexeme gate (§0.1). Any cue term the CEO flags "I keep forgetting this"
(one-tap on the Voice Matrix card) upserts it into `bbf_vocab_mastery` as
`source='linguist_flag'`, box 1 — the third injection pathway into the same loop.

---

## PART 2 · THE ADAPTIVE LEITNER SRS WEIGHTING ENGINE

### 2.1 The intervals (box → due schedule)

```
INTERVAL[box] :  box 1 → 0 d (always due) · box 2 → 1 d · box 3 → 3 d ·
                 box 4 → 7 d · box 5 → 14 d (maintenance review)

WRITE RULE (extends bbf_record_vocab_attempt — the existing RPC, now schedule-aware):
  on CORRECT: box = min(box+1, 5) · due_at = now() + INTERVAL[new box]
  on MISS:    box = 1 · lapses += 1 · due_at = now()
              priority_boost = min(1, priority_boost + 0.15)   -- repeat offenders rise
```

### 2.2 The "Ready for Review" pass (nightly cron + on-demand RPC)

```
ON-DEMAND (bbf_srs_due_set RPC — the Vocab Gym calls this at session start):
  due_set = rows WHERE due_at ≤ now()                    -- pure index read, zero compute

NIGHTLY CRON (polyglot sentinel pass, per athlete-language):
  N1 STALE-FORWARD: box-5 terms with last_reviewed > 14 d → due_at = now()
     (mastered ≠ finished; maintenance is the whole point of box 5)
  N2 MASTERY DECAY: box-5 terms with last_reviewed > 45 d →
       box_level = 4 · due_at = now() · decay logged to session_history (meta)
     -- unreviewed mastery quietly rots; the ledger makes the rot visible and actionable
  N3 BOOST DECAY: priority_boost ×= 0.9 when last_reviewed < 7 d ago and last
     attempt was correct (a boosted term that behaves earns its way back to normal)
  N4 ROLLUP: refresh profiles cache counts (vocab_mastered, phrases_mastered)
```

### 2.3 Session assembly + the exact probability matrix

A Vocab Gym session = `N = 12` questions, assembled in three tranches:

```
TRANCHE 1 · MANDATORY (up to 3 slots):
  injected terms (source ∈ {immersion_inject, linguist_flag}, box 1, due) —
  newest session first. These are not sampled; they are SEATED.

TRANCHE 2 · WEIGHTED SRS SAMPLE (fills to 10):
  candidate pool = due_set minus tranche 1
  weight w(t) = W_BOX[box] × S(t) × (1 + priority_boost)
    W_BOX = { 1: 1.00, 2: 0.60, 3: 0.35, 4: 0.20, 5: 0.10 }
    S(t)  = staleness = clamp( 1 + days_overdue / INTERVAL[box], 1.0, 3.0 )
            (a box-3 term 6 days overdue: S = 1 + 6/3 = 3.0 → capped)
  P(t) = w(t) / Σ w                     -- then weighted sampling WITHOUT replacement,
                                        -- seeded LCG (seed = athlete_id ⊕ date) so a
                                        -- reloaded session serves the same set
TRANCHE 3 · NEW-TERM INTRODUCTION (fills to 12):
  unseen catalog terms with phase_min ≤ current phase, catalog order,
  HARD CAP 5 new terms/day — the SRS queue must never be starved by novelty.

WORKED MATRIX — pool of one term per box, all exactly due (S = 1, no boost):
  box:        1      2      3      4      5
  w:          1.00   0.60   0.35   0.20   0.10     Σ = 2.25
  P(pick):    44.4%  26.7%  15.6%  8.9%   4.4%
  Same pool, box-3 term 6 days overdue (S=3) and box-1 term boosted +0.5:
  w:          1.50   0.60   1.05   0.20   0.10     Σ = 3.45
  P(pick):    43.5%  17.4%  30.4%  5.8%   2.9%
  -- the matrix breathes: struggling terms and stale terms surface themselves,
  -- mastered terms fade to maintenance frequency but never to zero.

MODE MAPPING (difficulty follows the box, deterministically):
  box 1–2 → recognition modes (Match, Listen) · box 3 → Speed ·
  box 4–5 → production modes (Sentence, spoken via speech evaluator)
  A term is always quizzed at the HARDEST mode its box allows.
```

---

## PART 3 · ZERO-API AUDIO STITCHING & PIMSLEUR PLAYBACK

### 3.1 The pattern, reused

This is the Sovereign stitching router (cardio blueprint Part 3) applied to a second
library. Same bake posture (`bbf-bake-coach-static` clone), same manifest-is-the-allow-list
law, same gapless play contract. What changes: the fragment inventory, the compiler input
(lesson `dialogue_flow` arrays instead of daily telemetry), and the **pauses are pedagogy**
— the 3.0 s / 4.0 s anticipation gaps are scheduled silence, exactly as authored.

### 3.2 Fragment inventory + bake

```
INVENTORY EXTRACTION (deterministic build script, from committed content):
  · Pimsleur: parse all 10 lessons' dialogue_flow → unique (speaker_role, text) pairs
    → fragment_key = 'PIM_' + hash(speaker_role + text)        (~350–450 fragments/lang)
  · Vocab catalog: every term × { target-language native read, EN prompt read }
    → 'VOC_<lang>_<term-slug>' + 'VOCEN_<term-slug>'           (100 terms + growth)
  · Real Ready kit: 50 phrases × native read                   ('PHR_pt_<slug>')
  · Drill connectors: ~20 narrator stubs ("Repeat.", "Again.", "Now say…", per language)
  · Intention statements: 6 themes × 2 languages

VOICE MAP (bake-time synthesis config — honored from the curriculum spec):
  narrator → en-US narrator voice · pt_native_female / pt_native_male → the two
  defined pt-BR voices · es drills → one es-MX/es-CO native pair (config-keyed).
  TTS provider is a BAKE-TIME concern only; swapping providers re-bakes fragments
  without touching the router. (Akeem's ElevenLabs clone stays the COACH voice —
  language natives are deliberately different voices: the ear must learn natives.)

STORAGE + MANIFEST: public bucket 'language-fragments' + table
  language_audio_fragments (mirror of sovereign_audio_fragments: fragment_key UNIQUE,
  speaker_role, language, script_text, sha256, storage_path, public_url, duration_ms,
  lufs, status) — loudness-normalized −16 LUFS, edges trimmed ≤ 60 ms, hash-idempotent
  re-bake, POST-BAKE COVERAGE GATE: every dialogue_flow line + every catalog term must
  resolve to an active fragment before the player deploys. The router can never route
  to silence.
```

### 3.3 The playback compiler (client-side, deterministic)

```
COMPILE(lesson_number, language) → playlist:
  FOR each entry in dialogue_flow, in order:
    { speaker: role, text }        → { seq, fragment_key, url, duration_ms, gap_after_ms: 0 }
    { speaker: 'silent_pause',
      duration_seconds: s }        → { seq, kind: 'silence', duration_ms: s×1000 }
                                     -- SCHEDULED silence (Web Audio timeline), no file
  total_duration_ms = Σ durations
  playback_directives = { preload: 'all', scheduling: 'sample_accurate',
                          seek_model: 'virtual_timeline' }     -- stitching contract, reused
PAUSE LAW: anticipation pauses are never trimmed, skipped, or compressed by the player.
  A "speed" control may scale FRAGMENT playbackRate (0.75×–1×) but NEVER the pauses —
  slowing the native without shrinking the athlete's answer window is the correct
  asymmetry for a language ear.

GOD-MODE DRILL COMPILER (same machinery, dynamic script):
  input = today's SRS due_set (§2.2), hardest-mode-eligible terms first, cap 15 items
  script per item = [ VOCEN_<term> (EN prompt) → silence 4.0 s (anticipation)
                      → VOC_<lang>_<term> (native) → silence 3.0 s → VOC_<lang>_<term> ]
  -- the drill IS the SRS queue, spoken. Zero live synthesis: every unit was baked.
  completion of a drill item posts bbf_record_vocab_attempt (self-scored tap:
  "got it / missed it" during the second pause) — drills FEED the boxes, closing
  the last silo.
```

### 3.4 `bbf_pimsleur_progress` — the resume-aware ledger

```sql
CREATE TABLE IF NOT EXISTS public.bbf_pimsleur_progress (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  language           TEXT NOT NULL CHECK (language IN ('es','pt')),
  lesson_number      SMALLINT NOT NULL,
  status             TEXT NOT NULL DEFAULT 'locked'
                       CHECK (status IN ('locked','available','in_progress','completed')),
  last_fragment_seq  INTEGER,                    -- resume checkpoint (fragment boundary)
  last_position_ms   INTEGER,                    -- virtual-timeline offset at checkpoint
  listened_ms_total  BIGINT NOT NULL DEFAULT 0,  -- accumulated across all plays
  retries            INTEGER NOT NULL DEFAULT 0, -- full restarts after a completion
  first_started_at   TIMESTAMPTZ,
  completed_at       TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (athlete_id, language, lesson_number)
);
ALTER TABLE public.bbf_pimsleur_progress ENABLE ROW LEVEL SECURITY;
```

```
CHECKPOINT RULE: written at every fragment boundary (not per-second — durable, cheap,
  and resume lands at a sentence start, never mid-word).
COMPLETION RULE: status → 'completed' when listened coverage ≥ 90% of total_duration_ms
  AND the final fragment played (skipping to the end does not graduate a lesson).
UNLOCK RULE: lesson N+1 → 'available' on lesson N completion; replays always allowed
  (retries increments on restart-after-completion — replay is a feature, not a failure).
SPACED LESSON REVIEW: nightly pass flags completed lessons idle > 10 d with a
  "review suggested" surface chip (suggestion only — lessons never re-lock).
```

---

## PART 4 · CURRICULUM PHASE-GATING & THE ANALYTICS LEDGER

### 4.1 The gate tree (static roadmap → strict validation)

Deterministic RPC `bbf_language_phase_check(athlete, language)` — the
`bbf-progression-calculator` pattern applied to fluency. Metrics definitions in §4.2;
every gate also requires **time-in-phase ≥ 7 days** (no gaming a good afternoon):

```
PHASE 1 → 2 (FOUNDATION → ACCELERATION):
  V1  ≥ 60 catalog terms at box ≥ 3          (breadth)
  V2  ≥ 20 terms at box 5                    (depth)
  P1  Pimsleur lessons 1–3 completed
  S1  streak_current ≥ 10 OR ≥ 14 qualified days since protocol start (consistency)

PHASE 2 → 3 (ACCELERATION → IMMERSION):
  V3  ≥ 45 terms at box 5
  V4  box-5 clearance rate ≥ 70% over the last 14 d     (§4.2 — retention, not grinding)
  P2  Pimsleur lessons 1–6 completed
  I1  ≥ 3 immersion sessions logged AND fluency_ewma ≥ 55
      (Phase 2 unlocks scenarios at difficulty tier 1 so I1 is earnable — see §4.5)

PHASE 3 → 4 (IMMERSION → MASTERY SPRINT):
  I2  fluency_ewma ≥ 75 across ≥ 8 total sessions
  I3  no error cluster ≥ 25% share over the last 14 d    (no dominant weakness)
  P3  Pimsleur 10/10 completed
  R1  Real Ready: ≥ 40/50 phrases at box ≥ 4
  V5  box-5 clearance rate ≥ 80% over the last 14 d

PHASE 4 → 5 (GRADUATION):
  B*  benchmark checklist (5-min coaching session · gym navigation run ·
      6 intentions recited both languages · bilingual Reel posted) — each item is a
      one-tap coach attestation row; the Reel item can auto-verify against the
      Studio V4 post queue.

FAIL POSTURE: gate returns { met: bool, missing: [codes], detail: {per-metric numbers} }
  — the UI renders exactly what stands between the athlete and the next phase.
NO REGRESSION: phases never walk backward; falling behind surfaces pacing chips
  ("Phase 2, day 34 — typical exit is day 28") computed from phase_started_on.
```

### 4.2 Metric definitions (exact, auditable)

```
box5_clearance_rate(window) = correct box-5 review attempts / box-5 review attempts
  within window, from session_history item logs. Denominator < 5 → 'insufficient_data'
  (holds the gate open-question rather than failing it — never punish missing data).
fluency_ewma: λ = 0.30 over immersion session averages (profile-cached, §1.4).
error cluster share(c) = cluster_count(c) / Σ cluster_counts, last-14 d turns.
qualified day: §1.2 definition — one source of truth for streaks AND gates.
```

### 4.3 `bbf_language_session_history` — the temporal spine

Every module appends one row per session — the audit's missing "per-attempt history"
becomes one uniform ledger:

```sql
CREATE TABLE IF NOT EXISTS public.bbf_language_session_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id     UUID NOT NULL REFERENCES public.bbf_users(id) ON DELETE CASCADE,
  language       TEXT NOT NULL CHECK (language IN ('es','pt')),
  module         TEXT NOT NULL CHECK (module IN
                   ('vocab_gym','pimsleur','immersion','drill','phrase_kit',
                    'linguist','intention')),
  mode           TEXT,                          -- game mode / scenario key / lesson number
  phase          SMALLINT NOT NULL,
  started_at     TIMESTAMPTZ NOT NULL,
  duration_s     INTEGER,
  items_total    INTEGER, items_correct INTEGER,
  fluency_score  NUMERIC,                       -- immersion sessions only
  error_clusters JSONB NOT NULL DEFAULT '{}',
  items          JSONB NOT NULL DEFAULT '[]',   -- per-item log: [{term, box_before,
                                                --  box_after, correct, mode}] — the
                                                --  granular record the audit found missing
  srs_snapshot   JSONB,                         -- {due_count, boxes_histogram} at start
  meta           JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bbf_language_session_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_lsh_athlete_lang_time
  ON public.bbf_language_session_history (athlete_id, language, started_at DESC);
```

(`bbf_language_progress` best-scores stay as the fast leaderboard cache; history is the
truth the cache summarizes.)

### 4.4 Error clustering + trend detection (deterministic)

```
FIXED CLUSTER TAXONOMY (the immersion contract enum — config 'lang_error_clusters_v1'):
  ser_estar · gender_agreement · verb_conjugation · preposition (por/para, em/no) ·
  false_friend · word_order · vocab_gap · register (tú/usted, você/o senhor) ·
  pronunciation
  -- a fixed enum is what makes clustering DETERMINISTIC: the model classifies
  -- against a closed list at immersion time; aggregation is pure counting after.

TREND ENGINE (nightly, per profile — pure SQL/TS over session_history):
  fluency_slope_14d = least-squares slope of session fluency vs day, 14 d window
  PLATEAU   = |slope| < 0.3 pts/day AND ewma < 75 AND ≥ 4 sessions in window
              → surface chip: "Plateau — drill your top cluster" + auto-queue a
                God-Mode drill compiled from that cluster's injected terms
  REGRESSION= slope ≤ −1.0 pts/day over ≥ 4 sessions
              → chip + hold new-term introduction (Tranche 3 cap → 0) until slope ≥ 0
  VELOCITY  = terms newly reaching box 5 per week (learning speed, dashboarded)
  ERROR HEAT= 14 d cluster shares, ranked → bbf_language_profiles.weak_clusters
```

### 4.5 Scenario difficulty ladder (Immersion, unlockable)

The 4 static scenarios become a catalog with tiers: `scenario_catalog (key, language,
tier 1–3, phase_min, title, prompt)`. Tier 1 available from Phase 2; tier 2 unlocks at
fluency_ewma ≥ 65; tier 3 at ≥ 75 — checked by the same gate RPC. The Opus immersion
prompt receives the tier as a register/complexity directive (faster natives, more slang,
less patience — difficulty is prompt-side, deterministic in selection).

---

## PART 5 · THE CLOSED LOOP + EXECUTION MANIFEST

### 5.1 One day in the unified engine (the loop, walked)

```
07:40  VOCAB GYM · bbf_srs_due_set → 2 mandatory injected terms (yesterday's immersion
       ser/estar misses) seated first · 8 weighted-sampled · 2 new terms.
       12 items → attempts recorded → boxes move → session_history row appended.
08:05  WORKOUT + PIMSLEUR · lesson 7 resumes at fragment 41 (checkpoint) — pre-baked
       fragments, scheduled pauses, zero API. Completion at 90% coverage →
       bbf_pimsleur_progress 'completed' → lesson 8 'available' → streak qualifies.
13:00  GYM FLOOR · Linguist cue "Add {load_g} to the bar" → ledger cache hit (zero API)
       → renders "Bota mais 2.268 g na barra!" from today's actual bbf_sets.load_g.
       CEO taps "keep forgetting this" on 'barra' → box 1, source='linguist_flag'.
19:30  IMMERSION (in-app, the one live surface) · tier-2 São Paulo gym scenario ·
       6 turns → turns persisted → close pass: avg 71, two 'preposition' errors →
       both terms injected to box 1 (tomorrow's mandatory slots) → ewma 68.2 →
       phase-3 gate check: I2 not yet met (ewma < 75) — UI shows exactly that.
03:00  NIGHTLY SENTINEL · stale-forward + mastery decay + boost decay + rollups +
       trend engine (slope −0.1: no flag) + pacing chips + gate re-check.
The ball on the string: one immersion mistake at 19:30 is a mandatory vocab rep at
07:40, a drill line by the weekend, a shrinking cluster share by next gate check.
```

### 5.2 Execution manifest (for Opus — dependency order)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `bbf_language_profiles`, `bbf_vocab_mastery` v2 ALTER (+catalog table + seed migration of the 100 terms / 50 phrases / lesson vocab out of JSX), `bbf_immersion_sessions/turns`, `bbf_linguist_cue_ledger`, `bbf_pimsleur_progress`, `bbf_language_session_history`, `language_audio_fragments`, `scenario_catalog`; public `language-fragments` bucket | `apply_migration` | — |
| 2 | Config seeds: `srs_weights_v1` (W_BOX, staleness cap, tranche sizes, new-term cap), `lang_phase_gates_v1`, `lang_error_clusters_v1`, voice map, stitch timing | migration | — |
| 3 | RPC layer: `bbf_srs_due_set`, schedule-aware `bbf_record_vocab_attempt` v2, `bbf_immersion_open/append/close_session`, `bbf_pimsleur_checkpoint/complete`, `bbf_language_phase_check`, session-history writers (all SECURITY DEFINER, vault-token) | migration | 1, 2 |
| 4 | Fragment inventory extractor + `bbf-bake-language-fragments` (coach-static clone) + coverage gate | script + edge fn | 1 |
| 5 | Polyglot Sentinel nightly cron: SRS passes N1–N4, trend engine, pacing chips, gate re-checks | edge fn | 3 |
| 6 | `bbf-agentic-immersion` v2: additive `errors[]` contract (closed taxonomy), tier directive input; in-app frontend flow replaces copy-paste | edge fn + UI | 3 |
| 7 | `bbf-agentic-linguist` v2: gram-slot template contract, banned-lexeme persist gate, ledger cache-first, "keep forgetting" flag path | edge fn | 1 |
| 8 | Vocab Gym v2: tranche assembly + probability engine (client, seeded), mode-by-box mapping; Pimsleur player + drill compiler on the stitching play contract; roadmap tab → live gate/pacing renders; CACHE bump | frontend | 3–6 |
| 9 | Tests: probability-matrix goldens (worked examples §2.3 exact), interval/decay walk (simulated 90-day athlete), injection-loop end-to-end (immersion error → next-session mandatory slot), coverage gate red/green, gram-lexeme gate (kilo/lb rejection), gate-tree truth table incl. insufficient_data holds, resume checkpoint fidelity, zero-API CI grep on gym/pimsleur/drill modules | tests | all |

**Non-goals:** cohort/multi-learner surfaces (schema-ready, not shipped — admin scope
holds), speech-to-text pronunciation scoring beyond the existing browser evaluator
(future track once persistence proves out), additional languages beyond es/pt, live-TTS
anywhere.

---
*Seven silos, one spine: every mistake becomes a rep, every rep moves a box, every box
feeds a gate — and the whole loop runs on audio that was paid for exactly once.*
