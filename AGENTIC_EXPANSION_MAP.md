# AGENTIC EXPANSION MAP — The BBF Lab, Fully Autonomous

**Status:** STRATEGY DRAFT — held on `claude/agentic-workflow-use-cases-66rh5u`, no merge until CEO lock.
**Scope:** NEW agentic-workflow use cases across (I) the client program side and (II) the Command Center —
layered **on top of** `MODULES_POWERHOUSE_UPGRADE_PLAN.md` (C-1…C-7, K-1…K-7, H-1…H-8), never duplicating it.
**Doctrine:** every directive honors the constraint envelope — LOCKED brand (§2), model router (§4),
In-House Equity Mandate (batch-and-bake, cache-first, no free-running loops, no rented middleware),
founder approval queue on every client-facing autonomous change, trilingual structural, RLS (§7),
`apply_migration`-only schema changes (`DATABASE_SAFETY.md`).

---

## 0 · The one-paragraph thesis

The audit of all ~88 edge functions shows the BBF Lab already owns a world-class **deterministic spine**
(readiness math, prescription tripwires, ACWR, the autonomous referee, sentinels, cron loops, the
`coach_action_inbox` approval rail) — but only **~15 functions still make live AI calls**, and several
folders literally named `bbf-agentic-*` were converted OFF the LLM for cost ("CALCULATOR-OFF-LLM · wave 1").
That was the right margin move — and it created the exact architecture the next era wants: **deterministic
engines decide, agents explain, converse, and anticipate — batch-baked so each output is billed once.**
This map adds the missing agentic layer at every client step and every operator console, so the sales story
becomes literal truth: *the Lab watches, reasons, speaks, and adapts around every client 24/7, and the CEO's
only job is approve/veto.*

**Relationship to the Powerhouse plan:** that plan turns the three Command Center domains into engines
(execute it — don't re-propose it). THIS map covers what it doesn't: the **client-facing conversational/
narrative layer**, the **re-agentification of the de-AI'd calculators**, and **operator intelligence**
beyond the three domains (ops, revenue, compliance, QA).

---

# PART I — CLIENT-SIDE AGENTIC USE CASES (CX series)

Each entry: the journey step it serves → what exists today → what the agent adds → router tier + burn control.

### CX-1 · Adaptive Voice Intake ("the intake that listens")
- **Step:** Assessment / onboarding (`/assessment`, `bbf-intake-voice`, `VoiceIntake.jsx`).
- **Today:** Akeem's voice speaks a FIXED allowlisted question script; answers are recorded, never reasoned on.
- **Ships:** `bbf-agentic-intake` — the agent reads each answer mid-flow, asks adaptive follow-ups
  ("you said your knee aches on stairs — which side, and does it swell?"), branches the question tree,
  and live-flags PAR-Q+ contraindications. A cardiac/red-flag answer triggers the existing Opus
  cardiac-intercept path *during* intake, not after. Output: a structured intake dossier the Pathfinder
  plan generation consumes, plus a "what I heard" spoken recap in Akeem's voice (existing TTS rails).
- **Tier:** Sonnet for dialog, **Opus for the PAR-Q+/cardiac branch only** (§4 safety-critical). One
  session = one bounded conversation, hard turn-cap; no loop.
- **Sell-line:** *"Our AI physician's-assistant interviews you by voice before a human ever would."*

### CX-2 · Fuel Companion — meal-snap vision + conversational fasting coach
- **Step:** Nutrition / fasting (`vault/Nutrition.jsx`, `bbf-meal-log`, `bbf-fueling-sentinel`).
- **Today:** static meal catalogs, tap-to-log CRUD, deterministic chronobiology engine, a clock visualiser
  for the 16/8 window. Zero AI. (Terminal H / H-3 is the *coach-side* generator — this is the *client-side* companion.)
- **Ships:** `bbf-agentic-fuel-companion` — (a) **meal-snap**: photo → Sonnet vision (the exact mirror of
  `bbf-agentic-kinematics`, `vision: true` auto-upgrade already in the router) → estimated macros written to
  `nutrition_intake_log` through the existing deterministic macro validator (AI proposes, native code disposes);
  (b) **fasting-window dialog**: "I have a work dinner at 9pm Thursday" → agent re-plots the eating window and
  explains the trade-off, bounded to the fueling-sentinel's math; (c) adherence-aware nudge copy baked nightly
  (Haiku batch) instead of live calls.
- **Tier:** Sonnet (vision + dialog), Haiku (baked nudges). Cache-keyed per photo hash; nudges billed once/night.
- **Sell-line:** *"Point your camera at your plate — the Lab logs it, scores it, and re-plans your window."*

### CX-3 · The Explainer Layer — re-agentify the voice, not the math
- **Step:** Prehab, recovery, forecasting, cardio (`bbf-agentic-prehab`, `-recovery`, `-forecasting`,
  `-cardio`, `bbf-smart-cardio-router` — all de-AI'd or narration-only).
- **Today:** the calculators output matrices and numbers with template copy. Correct, but mute.
- **Ships:** one shared `bbf-narrative-baker` nightly batch (rides the existing 01:00–02:45 recompute cron
  suite): for each athlete whose deterministic outputs CHANGED that day, Haiku bakes a trilingual 2–3 sentence
  "why" ("your 1RM projection dipped because volume fell 22% during travel week — here's the re-entry ramp"),
  stored per (athlete, module, day) and served free forever. The calculators stay ZERO-AI; the narrative layer
  is cache-first and delta-triggered, so a stable week costs $0.
- **Tier:** Haiku, one batch call per night. This directly reverses the "agentic-in-name-only" optics of the
  CALCULATOR-OFF-LLM wave at near-zero burn.
- **Sell-line:** *"Every number in your vault explains itself, in your language, in Akeem's voice."*
  (Pipe the baked text through `bbf-biokinetic-briefing` — the TTS rail already exists.)

### CX-4 · Trend Witness — the conversational daily check-in
- **Step:** Daily check-in (`bbf-readiness-calculator`, `bbf-prescription-checkin` — both ZERO-AI;
  conversational coaching today is Apex-paywalled via `bbf-convai-session`).
- **Ships:** `bbf-agentic-trend-witness` — after the deterministic readiness score posts, the agent reads the
  rolling 14-day window (readiness, sleep, sRPE, session feedback) and, ONLY when it detects a pattern worth
  naming ("third sub-60 readiness the morning after leg day — let's move leg day off Thursdays"), surfaces one
  card + optional one-question dialog. Pattern detection itself is native SQL (window functions);
  the agent is invoked solely on trigger, never per-check-in.
- **Tier:** Sonnet on trigger only; SQL sentinel decides *whether* to call at all. Founder approval queue
  gates any card that proposes a program change (same rail Eagle Eye uses).
- **Sell-line:** *"The Lab notices what you'd never connect — before it becomes an injury or a plateau."*
- **Monetization:** this is the natural mid-tier answer to the Apex-only live convai coach — a gateable
  feature for H-8's fail-closed ladder.

### CX-5 · Mindset Composer
- **Step:** Champion Mindset (`bbf-agentic-cns-video-prescription` = rules map over a fixed 30-video library;
  static mindset libraries).
- **Ships:** upgrade the rules map to an agent that *sequences* interventions: reads stress/sleep trend +
  recent session outcomes + (youth) game calendar, then composes a 3-item mindset block (video + baked
  affirmation audio + one journaling prompt) with a one-line rationale. Composition baked nightly per
  flagged athlete; the deterministic slider stays as fallback.
- **Tier:** Haiku nightly bake; escalation to the existing Opus wellbeing path if language flags distress
  (that safety route already exists in the router — this wires a real caller to it).
- **Sell-line:** *"Sport psychology that reads your week, not a playlist on shuffle."*

### CX-6 · Referee's Voice — youth progression, explained to parents
- **Step:** Youth portal (`bbf-evaluate-athlete-progress`, `bbf-progression-calculator` — ZERO-AI referee).
- **Ships:** when the Autonomous Referee promotes/holds, `bbf-referee-voice` bakes two trilingual narratives:
  **athlete-language** ("you owned Phase 3 — completion 94%, RPE ceiling clear") and **guardian-language**
  (what changed, why it's safe, what's next). Complements H-7's referee ledger card with the human copy on top.
  Guardian note can ride the owned email rail (K-4/H-2 pattern).
- **Tier:** Haiku, event-triggered bake (referee decisions are rare events — cost ≈ zero). Youth-facing copy
  passes through the founder approval queue until trust is established.
- **Sell-line:** *"Parents get a coach's phone call, written by the Lab, every time their kid levels up."*

### CX-7 · The Sunday Broadcast — personalized weekly narrative podcast
- **Step:** Weekly brief (`bbf-weekly-brief-scenario-engine` = deterministic SAFETY→COMPLIANCE→PROGRESSION
  templates; `bbf-sovereign-briefing` = pre-baked graduation audio).
- **Ships:** `bbf-weekly-narrative` — Sunday batch: one agent pass per active athlete over the true weekly
  telemetry (tonnage, readiness arc, nutrition adherence, milestone hits) authors a genuinely individual
  3-minute script — story arc, not template slots — then the existing stitch/TTS/premium-session rails
  produce the audio. **FABLE tier is built for exactly this** (narrative continuity, register fidelity) and
  currently has almost no callers.
- **Tier:** Fable (narrative), one call per athlete per week, baked. Falls back to the scenario engine on
  any failure — the deterministic engine becomes the safety net instead of the ceiling.
- **Sell-line:** *"Every Sunday, a podcast about YOU — your week, your numbers, your next move, in three languages."*

### CX-8 · Form Ledger — longitudinal kinematics
- **Step:** Kinematic Form HUD (`bbf-agentic-kinematics` — single still image, single verdict, no memory).
- **Ships:** (a) **burst mode**: 3–5 frames per rep sequence in one vision call (top/middle/lockout) for phase-aware
  analysis; (b) `bbf_form_ledger` table — every scan's cues persist per (athlete, lift); (c) the **re-check loop**:
  last scan's #1 cue is injected into the next session's program card ("Camera check: did the knees track out
  this week?") and the next scan explicitly grades improvement on that cue; (d) form-trend line surfaced in the
  youth dossier (feeds H-7).
- **Tier:** Sonnet vision (router `kinematic_form_score` already maps there). Same per-scan cost, multiplied
  value — memory is free.
- **Sell-line:** *"The HUD remembers your last scan and coaches the delta. ACL protection with a memory."*

### CX-9 · Re-Calibration Concierge — the quarterly agentic re-assessment
- **Step:** Retention / plan refresh (extends the old backlog item "native Pathfinder inside the app" —
  and makes it agentic instead of a form).
- **Ships:** every N weeks (or on demand from Settings), the concierge opens a short voice/text dialog:
  what changed — schedule, equipment, goals, injuries — *pre-filled from telemetry* ("you've logged 4:45am
  sessions all month; should we make early-bird official?"). Output feeds the existing `/process` plan
  regeneration with a delta-summary into the founder approval queue.
- **Tier:** Sonnet dialog, bounded turns; regeneration rides the existing Render rail.
- **Sell-line:** *"Your program re-interviews you before it goes stale."*

### CX-10 · Ask the Lab — tier-aware science concierge (post-K-1)
- **Step:** In-vault education; depends on K-1's pgvector Research Vault (sequence AFTER it ships).
- **Ships:** client-facing RAG over the founder-approved research corpus + the athlete's own plan:
  "why am I fasting 16/8 instead of OMAD?" → cited answer grounded in the Vault + their protocol, refusal-safe
  outside scope (no medical advice beyond PAR-Q boundaries, no backend talk per `AI_DIRECTIVES.md` §7).
- **Tier:** Haiku with pgvector retrieval (in-house embeddings, zero external search); cache per
  (question-normalized, tier) so common questions bill once.
- **Sell-line:** *"Ask your program why. It answers with the study."* — and it's a padlockable premium tab for H-8.

---

# PART II — COMMAND CENTER AGENTIC USE CASES (OP series)

The Powerhouse plan already owns Content/Knowledge/Coaching. These are the operator-intelligence layers it left open.

### OP-1 · The Morning Command Brief — one narrative, whole business
- **Today:** intelligence is fragmented across Action Inbox, Eagle Eye, Comlink lanes, signal-tracker,
  Stripe — the CEO assembles the picture by clicking through tabs.
- **Ships:** `bbf-morning-brief` nightly bake (after the recompute suite): ONE agent pass over the day's
  deltas — roster risk moves, new/scored leads, content performance, revenue events, cron/system health —
  authors a 60-second executive narrative + top-3 approve/veto items, lands as the pinned card in Action
  Inbox and optionally as Akeem-voice audio (own the same briefing rails clients get). All inputs are
  already-computed rows; the agent only narrates and ranks.
- **Tier:** Sonnet, one call per day. The single highest leverage-per-token item in this document.

### OP-2 · Revenue Sentinel — the money loop gets a brain
- **Today:** `bbf_conversions` empty despite live Stripe links (tier-audit flag #9), `bbf_tiers` Stripe-ID
  drift (flag #4), refunds/failed payments invisible until the CEO looks, `bbf-agentic-sales-router` fires
  on engagement but nothing watches the *lifecycle*.
- **Ships:** native SQL watchers (drift check, failed-payment/refund events, trial expiry, one-time-package
  end-dates approaching) feed a weekly Haiku revenue digest + event-triggered Sonnet drafts: win-back offer,
  tier-upgrade pitch (routed through the sales-router's existing Opus copy path), renewal outreach — every
  draft into the founder approval queue, dispatch on owned rails only.
- **Tier:** Haiku weekly + Sonnet on event. Pairs with H-8: gating creates the ladder, this agent sells the climb.

### OP-3 · Ops Surgeon — log triage with a verdict
- **Today:** ~88 functions, ~15 crons, budget kill-switch — but failure discovery is "CEO notices something's off"
  or a dead silent cron. `get_logs`/`get_advisors` exist and nothing reads them autonomously.
- **Ships:** nightly sweep: native collectors pull error-rate deltas per function, cron no-show detection
  (expected-run ledger vs actual), spend-gate anomalies, Supabase advisor flags → ONLY anomalies go to a
  Sonnet triage pass that writes a diagnosis card ("`bbf-resend-welcome` 40% failure since 02:00 — Brevo 429s;
  suggest backoff bump; no client impact yet") into Action Inbox with severity. No auto-fix without approval;
  read-only by construction (`execute_sql` reads + log APIs — fully inside DATABASE_SAFETY rules).
- **Tier:** Sonnet, anomaly-gated (quiet nights cost $0).

### OP-4 · Proof-Point Harvester — telemetry becomes marketing ammunition
- **Today:** real wins (velocity-index jumps, PR streaks, readiness turnarounds, youth phase promotions) die
  in the dossier; C-2's foundry wants "roster proof-points" as seed but nothing produces them.
- **Ships:** weekly native SQL milestone detector → Haiku drafts anonymized, brand-voice proof-point blurbs
  (trilingual) into the Review Bucket as `draft` rows — feeding C-2/C-4 exactly the seed corpus they expect.
  Anonymization is deterministic (no names/ages/identifiers reach the prompt), founder green-lights every card.
- **Tier:** Haiku weekly batch. The flywheel's Coaching→Content arc, made real.

### OP-5 · Funnel Analyst — the drop-off detective
- **Today:** the funnel (landing → /burn → /pathfinder → /assessment → tier → checkout → provision) is fully
  instrumented in tables but nobody watches WHERE prospects stall; marketing-deck copy changes are gut-driven.
- **Ships:** weekly native funnel rollup (stage-to-stage conversion, drop deltas vs 4-week baseline) → Sonnet
  authors one diagnosis + up to three copy/ordering experiments for the tab-decks (Content Engine cards are
  already operator-editable — the agent drafts, the CEO flips the deck). Closes the loop with OP-2's revenue view.
- **Tier:** Sonnet weekly. Zero new client-facing surface; pure operator leverage.

### OP-6 · Guardian & Screening Sentinel — compliance that never sleeps
- **Today:** guardian-consent enforcement and PAR-Q+ gating are enforced at intake — then never revisited.
  Consents don't age, screenings don't expire, youth athletes birthday into new risk bands silently.
- **Ships:** nightly native SQL checks (consent age, screening staleness, age-band transitions once H-7's real
  age column lands, waiver versions) → Haiku drafts the renewal/re-screen outreach in guardian language →
  approval queue → owned email rail. Zero-AI detection, AI only writes the words.
- **Tier:** Haiku, event-triggered. Cheap insurance; strong "we protect your kid" story for Rising Athlete sales.

### OP-7 · Autonomous Smoke Tester — Antigravity, in-house
- **Today:** Phase-4 visual smoke testing is a manual/hand-off step in the constitution; a broken deploy on
  `main` ships live (§6 lifted branch protection — speed with no safety net).
- **Ships:** post-deploy GitHub Action (Playwright + Chromium are already in the stack): walk the golden path
  (landing → burn calc → login → vault tabs → sports hub), capture screenshots + console errors; a Sonnet
  vision pass grades against the LOCKED brand checklist (purple/gold present, founder assets rendered, no
  blank panels) → pass/fail card into Action Inbox with the offending screenshot. Phase 4 of the constitution,
  automated on owned rails.
- **Tier:** Sonnet vision, once per deploy. Directly serves the Zero-Manual-Labor boundary.

### OP-8 · Mesocycle Architect — Co-Coach graduates from Q&A to proposals
- **Today:** even after H-1 (router migration + memory + morning cards), Co-Coach *answers*; it doesn't *plan*.
- **Ships:** end-of-mesocycle trigger (block completion is deterministic) → agent drafts the next block per
  athlete — progression targets, deload placement, exercise rotation — as a structured proposal into the
  founder approval queue with a diff-view against the current block ("+5% squat volume, swap RDL for GHR —
  hamstring readiness flags"). One-tap apply through the existing appliers. The CEO stops writing programs
  and starts signing them.
- **Tier:** Sonnet per block-end event (rare, high-value). The purest expression of "approve/veto, never produce."

---

# PART III — THE SELL — "The Lab Never Sleeps" narrative

The futuristic pitch is a **timeline**, because BBF's compounding advantage is what happens between sessions:

> **01:00** — the Lab recomputes every athlete's load, language mastery, and progression (native math, zero AI).
> **02:00** — the Narrative Baker writes tonight's "why" for every number that moved, in three languages (CX-3).
> **03:00** — Eagle Eye drafts interventions for the three athletes drifting off-plan (H-2). The Trend Witness
> flags one pattern no human would catch (CX-4). The Ops Surgeon confirms all systems green (OP-3).
> **05:00** — the Morning Command Brief lands: sixty seconds of narrated business state and three decisions
> awaiting one tap (OP-1).
> **Sunday** — every client gets a podcast about their own week, written for them alone (CX-7). Parents get
> the Referee's phone-call-in-writing when their athlete levels up (CX-6).
> **Any moment** — a client photographs a meal (CX-2), scans a lift (CX-8), or asks their program *why* (CX-10)
> — and the Lab answers with vision, memory, and citations.
>
> **And the CEO's entire operational role in that timeline is: approve or veto.**

Demo-day beats (each maps to one shipped item): meal-snap live on stage (CX-2) · form scan with "last time vs
today" delta (CX-8) · the voice intake asking an unscripted follow-up (CX-1) · playing a Sunday podcast (CX-7) ·
the Morning Brief on the Command Center wall (OP-1).

---

# PART IV — SEQUENCING & GUARDRAIL LEDGER

**Interleave with the Powerhouse waves — don't fork them.** Dependency-honest ordering:

| Window | Ship | Why then |
|---|---|---|
| **Now / Wave-1-adjacent** | CX-3 explainer baker · CX-6 referee voice · OP-1 morning brief · OP-3 ops surgeon · OP-7 smoke tester | Pure additive layers on data that already exists; no schema risk; instant "futuristic" visibility for near-zero burn |
| **Wave-2-adjacent** | CX-2 fuel companion (beside H-3) · CX-4 trend witness · CX-7 Sunday broadcast · OP-4 proof-points (feeds C-2) · OP-5 funnel analyst | Rides the generative-engine wave and the same approval rails |
| **Wave-3-adjacent** | CX-1 adaptive intake · CX-5 mindset composer · CX-9 re-calibration concierge · OP-2 revenue sentinel · OP-6 compliance sentinel | Multi-channel + autonomy discipline (dry-run-first) arrives in Wave 3 — these ride it |
| **Wave-4-adjacent** | CX-8 form ledger (with H-7 dossier) · CX-10 Ask the Lab (needs K-1 pgvector) · OP-8 mesocycle architect (needs H-1 memory + H-5 dossier RPC) | Explicit upstream dependencies |

**Standing rules binding every item above (restated, not optional):**
1. Router-only model selection (§4); new `UseCase` tags per feature — never inline model strings. Fable tier
   reserved for narrative continuity (CX-7); Opus only on safety branches (CX-1 cardiac, CX-5 distress escalation).
2. Batch-and-bake / cache-first / delta-triggered — no free-running loops; SQL sentinels decide whether an agent
   runs at all. Spend-gate + budget kill-switch cover every new caller.
3. Deterministic validation wraps every generative write (macro validator on CX-2, program-diff bounds on OP-8).
4. Founder approval queue gates every client-facing autonomous change; dry-run ledger before any live autonomy.
5. Trilingual structural in every new content path; brand LOCKED in every rendered surface.
6. Schema changes via `apply_migration` ONLY; OP-3 is read-only by construction. `supabase db push` remains forbidden.
7. Tier-gating (H-8) turns CX-4, CX-7, CX-8, CX-10 into ladder rungs — every wow-feature is also a paywall reason.

**CEO decision points (flagged, not assumed):**
1. CX-1 replaces the fixed intake script — the current script is a deliberate allowlist; going adaptive is a
   posture change on a safety surface. Needs a direct order.
2. CX-6/OP-6 send AI-authored copy to guardians of minors (via approval queue). Confirm comfort level + review cadence.
3. OP-7 posts automated pass/fail on deploys — decide whether a FAIL should auto-block anything or remain advisory.
4. Which CX features land on which paid tier (pairs with the H-8 pricing call).

---

*Prepared from a full two-surface audit (≈88 edge functions, 17 Command Center panels, every cron, tripwire,
and webhook, plus the client journey from landing to graduation) — cross-checked against
`MODULES_POWERHOUSE_UPGRADE_PLAN.md`, `TIER_FEATURE_AUDIT.md`, and `AG_INTEGRATION_NOTES.md` so that nothing
here re-proposes work already specced. Companion doc: this file answers "what ELSE can the Lab do"; the
Powerhouse plan answers "how the three domains become engines." Together they are the full futuristic pitch.
Deep-dive companion: `SPORTS_HUB_AGENTIC_PROGRESSION_MAP.md` (SP series) — the youth-athlete surface, where
sport-specific progression gets its own dedicated agentic map.*
