# BBF Onboarding Transactional State Machine
## Pathfinder → Payment → Credentials → Cold-Start → First Login (Fail-Proof)

**Date:** 2026-07-02
**Status:** Architectural blueprint — ready for Opus execution. No deployable code in this
document; it is the spec.
**Scope:** Pure architectural logic, webhook handlers, schema additions, and queue
management trees.
**Companions:** BBF Lab Architectural Dossier · Workload/Recovery, Fueling,
Cardio/Stitching, Studio V4, and Language Mastery blueprints (the engines this pipeline
must pre-warm for Day 1).

**Grounded against the live code:** `stripe-webhook` (signature-verified,
`bbf_stripe_fulfillment_transaction` atomic RPC — active_clients insert → provision →
tier → idempotency ledger, 5xx → Stripe retry, replay-safe), PIN generation + trilingual
Brevo welcome templates, `bbf_email_events` failure recording, `bbf-resend-welcome`
(recovery sweeper, `bbf_service_reissue_pin`, dual admin/cron auth),
`bbf-agentic-pathfinder` (public triage widget, `[[RECOMMEND:tier]]` CTA),
`bbf_active_clients` intake table, Phase 2 auth (`uid` + bcrypt PIN,
`bbf_verify_user_pin`, `bbf_pin_attempts` lockout), `vapi-sms-closer` (Twilio SMS
transport), `PRICE_TO_TIER` payment-link resolution. This blueprint formalizes that
machinery into one ledger-driven state machine and fills the gaps: bounce fallback,
intake linkage, cold-start cascade, readiness gate.

---

## 0 · GOVERNING DOCTRINE

### 0.1 The Gram Boundary (CRITICAL SYSTEM CONSTRAINT)

**The Pathfinder questionnaire is the edge of the system.** Body-weight input arrives in
whatever unit the prospect thinks in (lb or kg — a UI toggle); it is converted **inside
the submission RPC** and stored exclusively as `body_mass_g BIGINT`:

```
body_mass_g = ROUND(weight_lb × 453.59237)      -- exact
            | ROUND(weight_kg × 1000)           -- exact
```

Past the intake boundary, pounds and kilograms are unrepresentable:
- `bbf_pathfinder_intakes` (§1.2) has **no** `weight_lb` / `weight_kg` column — the unit
  dies in the RPC's local scope.
- Height follows the same integer doctrine: `height_mm INTEGER` (in × 25.4, cm × 10).
- CI grep over the onboarding surface: `/weight_(lb|lbs|kg)|_kg\b/` in any new
  table/RPC/edge-function is a build failure.
- Downstream, the cold-start cascade (§2) feeds `athlete_body_metrics.body_mass_g`
  directly — the fueling/cardio/workload substrates never see a unit conversion again.

### 0.2 Transactional integrity doctrine

1. **One writer per transition:** every state change on the pipeline ledger (§3.1) happens
   inside a SECURITY DEFINER RPC; edge functions orchestrate, RPCs transact.
2. **Idempotency everywhere:** every step keys on a natural unique constraint
   (checkout_session_id, (user_id, day), fragment of the existing idempotency ledger) —
   any step can be re-run at any time with no double-effect. Stripe replays, cron sweeps,
   and manual admin retries are all the SAME code path.
3. **5xx = retry, 2xx = truth:** the webhook only 2xxs Stripe after the atomic RPC
   commits. Post-commit steps (email, cold-start) NEVER 5xx the webhook — a paid customer
   is a committed fact; delivery and warm-up are recoverable queues, not transaction
   members. (This is the live design — preserved and now made explicit law.)
4. **Missing data never punishes:** an absent questionnaire produces a *default* cold
   start, not a blocked one (§2.4).

### 0.3 No Empty Dashboards (CRITICAL SYSTEM CONSTRAINT)

The Hub renders exclusively from table-backed rows. The cold-start cascade (§2) exists to
guarantee those rows exist **before credentials are dispatched** — the email that gives a
user their PIN is only sent after the readiness gate (§3) passes or degrades gracefully.
A first login can therefore never race an empty database: if the user has a PIN, the
dashboard has data.

---

## PART 1 · THE PAYMENT & CREDENTIAL STATE MACHINE

### 1.1 The state graph (one ledger, eleven states)

```
                                   ┌──────────────────────────────────────────┐
 intake_open ──► intake_complete ──►                                          │
      │                (Pathfinder submitted; §1.2)                           │
      └────────────── (skipped — direct payment link) ────────┐               │
                                                              ▼               ▼
 [Stripe checkout.session.completed webhook]  ──────────►  paid
                                                              │  atomic fulfillment RPC
                                                              ▼  (existing, extended §1.3)
                                                         provisioned
                                                              │  cold-start cascade (§2)
                                        ┌─────────────────────┤
                                        ▼                     ▼
                              cold_start_degraded      cold_start_ready
                                (partial init; §3.3)          │
                                        └──────────┬──────────┘
                                                   ▼  credential dispatch (§1.4)
                                          credentials_dispatched
                                                   │
                          ┌───────────────────────┼───────────────────────┐
                          ▼                       ▼                       ▼
                  dispatch_retrying        delivery_blocked          activated
                  (soft fail; queue)       (hard bounce; §1.5)   (first PIN login)
                          │                       │
                          └──── success ──────────┴──── fallback success ──► credentials_dispatched
```

Terminal state: `activated`. Every other state is visible on the admin Command Center
onboarding board with age-in-state timers (§3.4).

### 1.2 The intake edge — `bbf_pathfinder_intakes`

The Pathfinder widget stops being fire-and-forget: on the recommendation CTA, the
questionnaire persists and its id rides the checkout.

```sql
CREATE TABLE IF NOT EXISTS public.bbf_pathfinder_intakes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              TEXT,                         -- captured pre-checkout when offered
  phone              TEXT,                         -- optional; powers the SMS fallback (§1.5)
  -- THE GRAM BOUNDARY (no unit columns exist)
  body_mass_g        BIGINT,                       -- converted in the submit RPC, §0.1
  height_mm          INTEGER,
  body_fat_pct       NUMERIC,                      -- optional; null → estimated later
  birth_year         SMALLINT,                     -- Tanaka HR + tier heuristics
  -- training identity (feeds the cold-start cascade)
  goal               TEXT,                         -- 'cut' | 'build' | 'performance' | ...
  training_days_wk   SMALLINT,
  session_minutes    SMALLINT,                     -- typical session length
  sport              TEXT, position TEXT,          -- nullable (adults often none)
  friction_flags     TEXT[] NOT NULL DEFAULT '{}', -- 'knee_pain','low_back','shoulder',...
  dietary_profile    TEXT,                         -- 'Omnivore'|'Vegetarian'|'Vegan'
  allergens          TEXT[] NOT NULL DEFAULT '{}',
  preferred_locale   TEXT CHECK (preferred_locale IN ('en','es','pt')),
  recommended_tier   TEXT,                         -- the [[RECOMMEND:x]] outcome
  session_id         TEXT,                         -- pathfinder chat session (telemetry join)
  consumed_by_user   UUID,                         -- set when fulfillment claims it
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bbf_pathfinder_intakes ENABLE ROW LEVEL SECURITY;
```

**Linkage contract:** the checkout launcher (`bbf-create-checkout` / Payment Link CTA)
sets `client_reference_id = intake.id`. The webhook joins on it. Static Payment Links
entered from elsewhere carry no reference — that is the legal "skipped" edge in the state
graph, not an error (§2.4 covers it). A fuzzy fallback join (same email, intake < 72 h
old, unconsumed) claims orphaned intakes deterministically: newest first, exactly one.

### 1.3 The fulfillment sequence (webhook → database, exact order)

```
ON checkout.session.completed:
 1. VERIFY Stripe signature (existing) · resolve tier (metadata.tier → PRICE_TO_TIER
    fallback, existing) · resolve intake via client_reference_id → email fallback (§1.2)
 2. GENERATE credentials (in webhook memory ONLY — see rules below)
 3. ATOMIC RPC bbf_stripe_fulfillment_transaction (existing, EXTENDED):
      a. idempotency check (replay → { replay: true }, zero writes — existing)
      b. bbf_active_clients upsert (existing)
      c. bbf_users provision: uid, pin_hash, role, tier, preferred_locale (existing)
      d. NEW: claim intake row (consumed_by_user = user_id)
      e. NEW: athlete_profiles + athlete_body_metrics seeded from intake
         (body_mass_g flows straight through — gram-pure, §0.1)
      f. NEW: bbf_onboarding_pipeline row → state 'provisioned', steps checklist seeded
      g. idempotency ledger row (existing — written last, only on full success)
    ANY failure → full rollback → 5xx → Stripe retries. No split-brain. (Existing law.)
 4. RESPOND 2xx to Stripe. Everything after this line is queue-recoverable (§0.2.3).
 5. ENQUEUE cold-start cascade (§2) — invoked inline, but failure only marks the
    pipeline 'cold_start_degraded', never un-acks Stripe.
 6. DISPATCH credentials (§1.4) — gated on the readiness check (§3.2).
```

**Credential generation rules (formalizing + hardening the live behavior):**

```
USERNAME: slug(email local-part) → lowercase, [a-z0-9] only, max 12 chars;
  collision → append 2-digit counter (marco, marco02, marco03…). Deterministic,
  human-readable, spoken-aloud-friendly (it goes in an email AND possibly an SMS).
PIN: 6 digits from crypto.getRandomValues, REJECT-AND-REDRAW list:
  all-same (111111), straight runs (123456/654321), yyyy-like (19xx/20xx),
  the user's birth_year. bcrypt (existing cost) → bbf_users.pin_hash.
PLAINTEXT PIN LIFETIME: webhook memory + the dispatch payload. Never logged, never
  in the pipeline ledger, never in bbf_email_events payloads (existing posture — now law).
  Recovery ALWAYS re-issues (bbf_service_reissue_pin, existing) — no PIN is ever
  read back, only replaced.
```

### 1.4 The dispatch retry queue

`bbf_email_events` grows from a failure log into the dispatch queue's spine:

```sql
ALTER TABLE public.bbf_email_events
  ADD COLUMN IF NOT EXISTS attempts        INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS channel         TEXT NOT NULL DEFAULT 'email'
                             CHECK (channel IN ('email','email_alt','sms')),
  ADD COLUMN IF NOT EXISTS provider_msg_id TEXT;      -- Brevo message id → bounce join (§1.5)
```

```
DISPATCH TREE (welcome credentials):
├─ SEND via Brevo (trilingual template by preferred_locale — existing)
├─ 2xx → pipeline 'credentials_dispatched' · event row 'sent' + provider_msg_id
└─ non-2xx / exception → event row 'welcome_send_failed' (existing) +
     attempts=1, next_attempt_at = now() + BACKOFF[1]

RETRY WORKER (bbf-resend-welcome, existing — cadence + backoff formalized):
  cron every 15 min · sweeps rows where status='failed' AND next_attempt_at ≤ now()
  BACKOFF[n] = 15 min · 1 h · 4 h · 12 h · 24 h        (attempts 1→5)
  each retry: RE-ISSUE PIN (existing — bcrypt is one-way) → resend → on 2xx mark
  resolved + pipeline 'credentials_dispatched'
  attempts > 5 → escalate: pipeline 'delivery_blocked', reason 'retry_exhausted',
  admin alert (§3.4). A paid customer is NEVER silently stranded (existing goal,
  now with a bounded clock: worst-case ~41 h to human escalation).
```

### 1.5 The hard-bounce fallback protocol

New webhook receiver `bbf-email-events-webhook` (Brevo → us; shared-secret validated,
`--no-verify-jwt`, mirrors the Stripe posture) ingests delivery telemetry:

```
BREVO EVENT INGEST:
  delivered   → event row 'welcome_delivered' (closes the loop — §3.2 uses this)
  soft_bounce → treat as send failure → retry queue (§1.4), same backoff clock
  hard_bounce | invalid_email | blocked | spam →

HARD-BOUNCE LADDER (executed in order, each step logged as its own dispatch row):
 1. ALTERNATE EMAIL: intake captured a different email than checkout? (Stripe
    customer email ≠ intake.email) → re-issue PIN → dispatch to the alternate
    (channel 'email_alt'). Success → done.
 2. SMS CREDENTIALS: intake.phone present → re-issue PIN → SMS via the existing
    Twilio transport (vapi-sms-closer pattern): trilingual micro-copy,
    "BBF Vault access — user: {username} · PIN: {pin} · buildbelievefit.fitness"
    (channel 'sms'). Success → pipeline 'credentials_dispatched'.
 3. HUMAN ESCALATION: no alternate route → pipeline 'delivery_blocked',
    reason 'hard_bounce_no_fallback' → admin alert card (Command Center onboarding
    board, §3.4) with the Stripe customer link — the CEO's white-glove call/text
    IS the tier-3 fallback, armed with everything but the PIN (a fresh one is
    issued from the admin card in one tap).
 4. SELF-SERVICE BACKSTOP (always on, independent of the ladder): the login screen's
    "Never got your credentials?" flow — email or phone entry → if it matches a PAID
    pipeline row in a non-activated state, trigger re-issue + dispatch to that
    verified channel. Rate-limited by bbf_pin_attempts-style tripwire.
```

---

## PART 2 · THE DAY-1 COLD-START MATRIX

### 2.1 The cascade (ordered, idempotent, engine by engine)

Runs immediately after `provisioned` commits (invoked by the webhook, re-runnable by the
sweeper). Each step is an idempotent upsert keyed on (user, day) or (user) — re-running
the cascade heals, never duplicates:

```
bbf-cold-start-orchestrator (new edge fn; pure orchestration, zero AI):

 STEP 1 · IDENTITY & METRICS (already inside the fulfillment RPC, §1.3.e)
   athlete_profiles (sport, tier band, preferred_language) +
   athlete_body_metrics (body_mass_g, body_fat_pct | null→flag 'estimated')

 STEP 2 · FUELING SENTINEL — TIER 1 FOUNDATION PASS (fueling blueprint §2)
   rmr = 500 + 0.022 × lean_mass_g · af from intake.training_days_wk/session_minutes
   → 28 rows of athlete_nutrition_targets_daily (gram-precise protein_g/carbs_g/fat_g,
     clamps C1–C5 incl. the RED-S floor) · trace notes source:'cold_start'
   Product-tier mapping: fuel_* SKUs and catalyst+ all get Tier-1 targets on day 1;
   Performance/Sovereign nutrition behavior activates as check-ins/floor data accrue.

 STEP 3 · CARDIO MATRIX — BASELINE PRESCRIPTION (cardio blueprint Parts 1–2)
   No workload history → mechanical ceiling SILENT (fail-open, by design) ·
   readiness unknown → band 'unknown' (full prescription) ·
   sport_profile from intake.sport/position (default 'glycolytic') ·
   hr_max_est = 208 − 0.7 × age(birth_year) · duration from session_minutes bucket
   → bbf_cardio_prescription row for day 1 with gram outputs
     (ee_kcal via MET × body_mass_g × 1.75e-5, sweat/rehydration_g) + talk-test lines

 STEP 4 · PREHAB BASELINE (prehab blueprint; predictive layer has no data yet)
   intake.friction_flags → athlete_injury_history seed rows
     (reported_by 'intake', severity 4, injury_type 'friction_pattern')
   flags present → advisory prehab_queue rows for those joints (priority 'advisory' —
     history factor H_j alone, no ACWR yet)
   no flags → the existing defaultBaselineMatrix (universal 3-drill reset) is the
     Hub's prehab card — NEVER an empty panel

 STEP 5 · LANGUAGE PHASE (entitled tiers/admin only — language blueprint §1.1)
   bbf_language_profiles row(s), phase 1, protocol_started_on = first login date
   (created now, clock starts at activation) · non-entitled tiers: step auto-passes

 STEP 6 · SOVEREIGN BRIEF (stitching blueprint §3.8 fallback tier 3, promoted to
   the cold-start default)
   bbf_daily_brief_context minimal payload + sovereign_brief_playlists =
   [ S0_NEUTRAL, S5_<tier default>, S7_STEADY ] in preferred_locale —
   the new user's FIRST tap on the audio tile speaks, zero API, day one.

 STEP 7 · READINESS GATE CHECK (§3.2) → 'cold_start_ready' | 'cold_start_degraded'
```

### 2.2 The first-login hydration contract

```
PIN auth (bbf_verify_user_pin, existing) →
  fast path: pipeline.state ∈ {cold_start_ready, credentials_dispatched, activated}
    → ONE hydration RPC returns the Hub's day-1 rows in a single round trip:
      { nutrition_today, cardio_today, prehab_card, brief_playlist, profile, intents }
  → pipeline.state = 'activated' · activated_at stamped · streak day 1 qualifies
  degraded path: §3.3 rendering contract (populated, flagged, never broken)
FIRST-SESSION OVERLAY (not a substitute for data — an addition): welcome tour +
  morning check-in prompt ("your first check-in tunes everything you see").
```

### 2.3 Why the Hub cannot be blank (the layered guarantee)

```
Layer 1  cascade rows (the normal case — everything real, everything personal)
Layer 2  per-engine defaults on any missing row (tier-default nutrition card from
         §1.3 config coefficients · 'unknown'-band cardio · defaultBaselineMatrix
         prehab · S0_NEUTRAL brief) — rendered from CONFIG, not from absence
Layer 3  the gate (§3) — because dispatch waits for the gate, a user WITH a PIN
         has at minimum Layer 2 everywhere, verified server-side before the
         credentials email ever left the building
```

### 2.4 The drop-off edge cases (paid ≠ questionnaire)

```
CASE A · paid via static Payment Link, no intake row:
  cascade runs on TIER-DEFAULT persona (config 'cold_start_defaults_v1': per-tier
  body_mass_g median, training_days, dietary defaults — every value flagged
  source:'default' in traces) → Hub fully populated → first-login prompt:
  "Complete your blueprint (2 min) to calibrate these numbers" → completing the
  in-app intake re-runs Steps 1–2–3 with real grams (idempotent upserts absorb it).
CASE B · intake submitted, checkout abandoned:
  intake row ages unconsumed → 72 h sweep hands it to the lead-capture path
  (bbf_active_clients 'Pending' + the existing sales follow-up loop). No user is
  provisioned — a questionnaire is a lead, not an account.
CASE C · paid, credentials dispatched, never logs in:
  pipeline sits 'credentials_dispatched' with age-in-state visible; 72 h → gentle
  re-welcome email (no PIN — link to self-service §1.5.4) · 7 d → admin board flag.
```

---

## PART 3 · THE ONBOARDING READINESS GATE

### 3.1 `bbf_onboarding_pipeline` — the account_status ledger

```sql
CREATE TABLE IF NOT EXISTS public.bbf_onboarding_pipeline (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_session_id  TEXT UNIQUE,                 -- idempotency anchor (Stripe)
  intake_id            UUID REFERENCES public.bbf_pathfinder_intakes(id),
  user_id              UUID REFERENCES public.bbf_users(id),
  email                TEXT NOT NULL,
  tier                 TEXT NOT NULL,
  state                TEXT NOT NULL DEFAULT 'paid' CHECK (state IN
                         ('paid','provisioned','cold_start_ready','cold_start_degraded',
                          'credentials_dispatched','dispatch_retrying','delivery_blocked',
                          'activated','needs_attention')),
  steps                JSONB NOT NULL DEFAULT '{}',
  -- steps = { provisioned:      { ok, at },
  --           metrics_seeded:   { ok, at, source: 'intake'|'default' },
  --           nutrition_init:   { ok, at, rows: 28 },
  --           cardio_init:      { ok, at },
  --           prehab_init:      { ok, at, mode: 'advisory'|'baseline' },
  --           language_init:    { ok, at } | { skipped: 'not_entitled' },
  --           brief_init:       { ok, at },
  --           dispatch:         { ok, at, channel, attempts },
  --           delivered:        { ok, at } }          ← Brevo 'delivered' event (§1.5)
  heal_attempts        INTEGER NOT NULL DEFAULT 0,
  failure_reason       TEXT,
  state_entered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),   -- age-in-state timers
  activated_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.bbf_onboarding_pipeline ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_obp_state ON public.bbf_onboarding_pipeline
  (state, state_entered_at) WHERE state <> 'activated';
```

### 3.2 The gate check (deterministic RPC — `bbf_onboarding_gate_check`)

```
FOR user U, verify by EXISTENCE OF OUTPUT ROWS (not by step self-reports —
the checklist says what ran; the gate verifies what EXISTS):
  G1  athlete_profiles row + athlete_body_metrics row (body_mass_g NOT NULL)
  G2  athlete_nutrition_targets_daily row for today AND today+6 (contract depth)
  G3  bbf_cardio_prescription row for today
  G4  prehab surface: ≥1 prehab_queue row OR baseline-matrix flag set
  G5  sovereign_brief_playlists row (locale = preferred_locale)
  G6  language profile IF tier-entitled, else auto-pass
  G7  bbf_users.pin_hash NOT NULL · tier set · locale set

ALL pass → 'cold_start_ready'
ANY fail → 'cold_start_degraded' + failing gate codes into steps/failure_reason

RUN AT: (1) end of cascade · (2) BEFORE credential dispatch — dispatch is GATED:
  ready → dispatch now · degraded → ONE heal cycle first (§3.3), then dispatch
  regardless (a paid customer gets credentials within minutes even if an engine is
  limping — Layer-2 defaults carry the UI) · (3) sweeper (§3.3) · (4) first login
  fast-path check (§2.2).
```

### 3.3 Auto-heal tree + the degradation rendering contract

```
HEAL WORKER (bbf-onboarding-sweeper — cron 10 min, dual-auth like bbf-resend-welcome):
  sweep pipelines WHERE state IN ('cold_start_degraded','paid','provisioned')
                    AND state age > 5 min
  FOR each failing gate code → re-run ONLY that cascade step (all steps idempotent
    upserts — §2.1) → re-run gate check
  success → state advances (and if dispatch already happened, the Hub silently
    upgrades from Layer 2 to Layer 1 on next load — the user never knew)
  heal_attempts += 1 · attempts ≥ 3 with same failing code →
    state 'needs_attention' + ADMIN ALERT (§3.4). Heal never loops silently forever.

DEGRADATION RENDERING CONTRACT (frontend law, per §2.3 Layer 2):
  each Hub card render-checks its OWN row; missing → config-backed tier default +
  a small "calibrating" chip (brand-styled, not an error) · NEVER an empty panel,
  NEVER a spinner older than one load, NEVER a raw error string. A degraded
  account is visually indistinguishable from a healthy one except the chip.
```

### 3.4 Admin alerting (before the user ever sees it)

```
ONBOARDING BOARD (Command Center): live table of non-activated pipelines —
  state, age-in-state (amber > 1 h in paid/provisioned · red > 24 h anywhere,
  > 15 min in needs_attention), failing codes, one-tap actions:
  [re-run cascade] [re-issue + resend] [send via SMS] [mark handled]
ALERT PUSH: transitions INTO 'needs_attention' or 'delivery_blocked' →
  bbf-command-feed event + admin email (and SMS if configured) with the pipeline id
  and failing codes. The design goal stated plainly: the admin learns about a broken
  onboarding from an alert BEFORE the athlete can learn about it from a login —
  the dispatch gate (§3.2) plus the heal cycle make that ordering structural.
WEEKLY FUNNEL DIGEST: counts + median times per transition (paid→ready,
  ready→dispatched, dispatched→activated) from state_entered_at history —
  the pipeline measures itself.
```

---

## PART 4 · EXECUTION MANIFEST (for Opus)

| # | Deliverable | Type | Depends on |
|---|---|---|---|
| 1 | Migration: `bbf_pathfinder_intakes`, `bbf_onboarding_pipeline`, `bbf_email_events` ALTER (§1.4); config `cold_start_defaults_v1`, `onboarding_backoff_v1` | `apply_migration` | — |
| 2 | Pathfinder persistence: submit RPC with the gram-boundary conversion (§0.1), widget wiring, checkout `client_reference_id` linkage | edge fn + UI | 1 |
| 3 | `bbf_stripe_fulfillment_transaction` v2: intake claim + profile/metrics seed + pipeline row (extends the existing atomic RPC — same rollback envelope) | migration | 1 |
| 4 | Credential rules hardening: username slug + PIN reject-list (webhook-local) | edge fn | 3 |
| 5 | `bbf-cold-start-orchestrator`: cascade steps 2–6 (calls the Fueling/Cardio/Prehab/Language/Brief initializers), gate check, state writes | edge fn | 3 + prior-blueprint substrates |
| 6 | `bbf-email-events-webhook` (Brevo ingest) + hard-bounce ladder incl. SMS channel via the existing Twilio transport | edge fn | 1 |
| 7 | `bbf-resend-welcome` v2: backoff schedule, attempts cap, escalation transition (formalizes the live sweeper) | edge fn | 1, 6 |
| 8 | `bbf-onboarding-sweeper` (heal worker, cron 10 min) + `bbf_onboarding_gate_check` RPC | edge fn + migration | 5 |
| 9 | First-login hydration RPC + Hub degradation rendering contract + welcome tour + in-app intake completion (Case A) + self-service credential recovery (§1.5.4); CACHE bump | frontend | 5, 8 |
| 10 | Command Center onboarding board + alert pushes + weekly funnel digest | frontend + edge fn | 8 |
| 11 | Tests: gram-boundary goldens (lb/kg inputs → exact BIGINT, no unit columns exist), Stripe replay idempotency, kill-tests per cascade step (each failure → degraded → healed → upgraded), bounce-ladder walk (alt-email → SMS → escalation), dispatch-gate ordering (email never precedes gate), drop-off cases A/B/C, first-login hydration under every non-terminal state, backoff clock math | tests | all |

**Non-goals:** payment-processor migration or dunning flows (Stripe owns billing
lifecycle), passwordless/magic-link auth (Phase 2 PIN model is the standard), automated
refunds on abandonment, multi-seat/team onboarding (single-athlete pipeline first).

---
*Money in, PIN out, dashboard warm — with a ledger that can prove it for every account,
and an alarm that rings in the Command Center before it ever rings in a customer's face.*
