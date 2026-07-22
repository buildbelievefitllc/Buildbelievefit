# SPORTS HUB AGENTIC PROGRESSION MAP — The Youth Athlete's Full Coaching Staff

**Status:** STRATEGY DRAFT — held on `claude/agentic-workflow-use-cases-66rh5u`, no merge until CEO lock.
**Companion to:** `AGENTIC_EXPANSION_MAP.md` (CX/OP series). This doc goes deep on ONE surface — the
**BBF Athlete Portal / Sports Hub** — and answers: *where can agentic workflows make the biggest mark on
consistent, sport-specific progression for the youth athlete?*
**Doctrine:** constraint envelope unchanged — router-only models (§4), batch-and-bake / cache-first,
founder approval queue on every client-facing autonomous change, trilingual structural, RLS (§7),
`apply_migration`-only schema work (`DATABASE_SAFETY.md`). Youth-specific standing rule: the orchestrator's
hard exclusion of `youth_load_progression` from any auto-approve path is **correct and stays** — every
youth-facing agentic output below routes through founder approval or is purely narrative/explanatory.

---

## 0 · Ground truth from the two-sided audit (read this before the use cases)

A full sweep of the youth frontend (SportsHub.jsx + all `sportshub/*` components, sports data files) and
the backend engines (Referee, tier ladder, workload sentinel, ACWR, peaking/forecasting, schema) found:

1. **The youth journey contains ZERO generative AI today.** Every "AI" moment is cached TTS of a fixed
   script (Gameplan pep-talk, Mindset welcome). The only LLM that can reach a youth athlete at all is
   `bbf-agentic-comlink`'s `positional_drill` intent.
2. **The actual training week is sport-agnostic.** `hubData.js` `WEEK_TEMPLATE` is one generic S&C split
   for every sport — a lineman and a volleyballer do the identical squat/bench week; sport-specificity
   lives only in the drill/film overlay. Four of ten intake sports (volleyball, tennis, boxing, MMA)
   collapse onto `general` matrices inside `sportsEngine.js`. Softball/Boxing/MMA carry **one** drill each.
3. **Two disconnected progression systems.** The mesocycle Phase 1→3 Referee (state in
   `bbf_active_clients.sports_protocol`, keyed by email) and the youth→collegiate tier ladder
   (`athlete_profiles.current_tier`, keyed by athlete id) never reconcile. An athlete can be "Phase 3
   Peak" and "youth tier" at once with no cross-check, and no agent reasons over both.
4. **⚠️ The Referee's gates are largely unsatisfiable through normal logging.** `bbf_log_athlete_set`
   only rolls `rpe_avg_last_3`; `mesocycle_week` stays at its DEFAULT 1 (below the 4-week gate),
   `friction_avg_last_3` is never written, `protocol_completed` has no maintained writer. The tripwire
   fires on every set, but promotion can essentially never clear via the telemetry path. **Consistent
   progression is broken at the plumbing level before AI even enters the picture.**
5. **Season awareness is a manual toggle.** Off/In-Season is a user click; the rich per-sport
   `inSeason`/`offSeason` regimens in `bbfSportsHubProduction.json` are **never read by any backend
   engine**; there is no game, practice, or competition schedule anywhere in the data model.
6. **The Kinematic Form HUD — the youth flagship in every sales pitch — is not wired into the youth
   surface at all.** `bbf-agentic-kinematics` and `FormDemoPlayer` are referenced only from adult vault
   components; youths get plain YouTube demos.
7. **Combine numbers are synthetic.** "Current" combine/power/size values are derived from targets by
   fixed ratios (0.85/1.07) — progress bars that look like data but aren't measured.
8. **Rich data sits unconsumed:** `sport_milestones` category balance (technical/physical/mental) is
   ignored (count-only check), `phase_history` jsonb is unread, `athlete_readiness_logs.volume_multiplier`
   adjusts nothing, wearable ACWR is deliberately unwired, `nutrition_recovery_logs` has no consumer,
   and `birth_date` drives nothing beyond the 13–18 guardian gate — no age/maturation load scaling.
9. **Nobody explains anything.** Referee verdicts are machine slugs (`insufficient_weeks`,
   `rpe_too_high`); tier verdicts are `requirements_not_met`. No athlete-, parent-, or coach-language
   rationale is ever generated. After the one-time consent signature, the guardian never hears from
   the platform again.

The shape of the opportunity is identical to the adult side, but more extreme: **deterministic engines
with real safety discipline, wearing no voice, no sport brain, and — uniquely here — broken telemetry
feeding the progression gate.** Fix the plumbing, then give the machine a coaching staff.

---

# PART I — THE USE CASES (SP series)

### SP-0 · Telemetry Custodian — the non-negotiable prerequisite (deterministic, not AI)
- **Problem:** finding #4 — the Referee's gates reference fields nothing populates. Any agentic layer
  built on top of a promotion engine that can't promote is theater.
- **Ships:** native SQL/RPC work only — `mesocycle_week` derived from `mesocycle_started_at` on a nightly
  recompute (rides the existing 01:00 lab-recompute suite); `friction_avg_last_3` rolled from
  `session_feedback` (the Post-Game Check already writes it); `protocol_completed` computed from the
  per-day check-offs `bbf_log_youth_progress` already persists; a reconciliation view joining the two id
  spaces (`bbf_users.email` ↔ `athlete_profiles`) so Phase and Tier can finally see each other.
- **Tier:** none — zero AI, zero recurring cost. **Sequence first; everything below stands on it.**

### SP-1 · Periodization Architect — a real training week per sport, position, and phase
- **Problem:** finding #2 — the executed week is generic; the sport-specific content is garnish.
- **Ships:** `bbf-sport-periodization-bake` — a **catalog bake, not live generation**: for each
  (sport × position-group × phase 1-3 × tier youth/MS/HS × season off/in) cell, Sonnet drafts the 7-day
  block — lift selection, set/rep/RPE targets, plyo progression, drill placement — seeded from the
  existing `SPORT_SKILL` matrices, position presets, and combine benchmark gaps. Every generated block
  passes **deterministic validation** against the Immutable Laws (no barbell back squat, no crunches,
  phase-appropriate plyo ceilings) before it can be stored; founder approves each cell once in the
  Command Center; athletes are then served from the approved catalog at $0 marginal cost. Also closes
  the thin-content gap: the same bake fills Softball/Boxing/MMA/volleyball drill pools (Haiku), ending
  the collapse-to-`general`.
- **Tier:** Sonnet (block design) + Haiku (drill card copy), one-shot bake per cell, re-baked only on
  CEO order. The catalog is finite (~10 sports × ~4 position groups × 3 phases × 3 tiers × 2 seasons).
- **Sell-line:** *"A lineman's Tuesday and a setter's Tuesday were written by different coaches — both ours."*

### SP-2 · Season Brain — periodization that knows when game day is
- **Problem:** finding #5 — no calendar, manual season toggle, peaking engine that has never heard of a game.
- **Ships:** (a) new `bbf_athlete_season` schema — season start/end, game/competition dates, practice
  days/week — captured in a 60-second guardian/athlete flow at intake or from Settings; (b) deterministic
  calendar logic flips off/in-season automatically and computes days-to-next-game; (c) the agentic layer:
  a weekly Sunday pass (rides the same batch window as CX-7) reads the coming week's calendar + current
  ACWR + phase and **drafts the week's micro-adjustments** — taper the 48h pre-game window, swap the
  post-game day to the recovery variant, front-load CNS-heavy work early week — into the founder approval
  queue as a diff against the SP-1 catalog block. In-season ACWR bands tighten deterministically.
- **Tier:** Sonnet, one call per athlete-week, only for athletes with a populated calendar. This is the
  single biggest "consistent progression per their sport" unlock: the program breathes with the season.
- **Sell-line:** *"The Lab tapers your kid for Friday's game without anyone asking it to."*

### SP-3 · Referee's Voice + Hold-to-Plan converter (supersedes CX-6, expanded)
- **Problem:** finding #9 — promote/hold verdicts are silent machine slugs; a **hold** is a dead end
  instead of a coaching moment.
- **Ships:** event-triggered on every Referee and tier-ladder verdict: (a) trilingual athlete-language
  and guardian-language narratives (the CX-6 scope); (b) **the new part — every HOLD becomes a plan**:
  the agent reads the specific failed gate (`rpe_too_high` → "we're pulling intensity 10% for two weeks,
  here's why that makes you faster in October"; `insufficient_weeks` → countdown card) and drafts the
  corrective micro-block into the approval queue. Verdict + narrative + plan land in `phase_history`
  (finally giving that jsonb a writer AND a reader) so the next verdict has memory.
- **Tier:** Haiku (narratives) + Sonnet (hold-plans), event-triggered — referee events are rare; cost ≈ 0.
- **Sell-line:** *"No silent gates. Every yes explains itself; every not-yet comes with the road back."*

### SP-4 · Milestone Pathfinder — the tier ladder gets a guide
- **Problem:** finding #8 — `sport_milestones` is richly seeded (8 sports × 4 tiers, trilingual,
  technical/physical/mental categories) but progression checks only the raw verified count; nothing
  guides the athlete toward balance, and coach verification silently bottlenecks promotions.
- **Ships:** nightly native SQL computes each athlete's milestone state (verified/pending per category);
  a Haiku bake authors the **"Path to {next tier}" card** — which milestones to attack next, why the
  category balance matters for their position, projected promotion window — refreshed only on state
  change. Coach side: when unverified milestones age past 7 days, a drafted verification nudge lands in
  the Action Inbox (the coach-verification bottleneck becomes visible instead of silent).
- **Tier:** Haiku, delta-triggered. Directly answers "consistent progression": the athlete always knows
  the next rung, in their language, for their sport.

### SP-5 · Youth Kinematic Form HUD — ship the flagship to the people it was named for
- **Problem:** finding #6 — the ACL-protection scanner that headlines the Rising Athlete pitch is
  adult-only in code.
- **Ships:** wire `bbf-agentic-kinematics` into the Sports Hub Drills/Exercises decks (the adult
  invocation pattern in `Generator.jsx`/`ProgramGrid.jsx` is the template): (a) a **youth-specific cue
  library** in the vision prompt — knee valgus/ACL shear, landing mechanics, growth-plate-sensitive
  loading — keyed by sport and drill; (b) the CX-8 Form Ledger lands here FIRST (youth is where
  longitudinal form memory matters most): every scan persists, the worst cue auto-becomes next session's
  "camera check" card, and the form-trend line feeds the athlete dossier (the H-7 hook that's already
  planned); (c) a guardian-visible safety summary — "3 scans this month, landing mechanics improved,
  zero red flags."
- **Tier:** Sonnet vision (router already maps `kinematic_form_score` there). Gate scans/week by tier —
  a clean H-8 ladder rung for Rising Athlete upsell.
- **Sell-line:** *"We don't just train your athlete. We watch every landing."* — now true in the youth app.

### SP-6 · Combine Truth Engine — measured numbers, coached gaps
- **Problem:** finding #7 — synthetic combine values undermine the whole progression story; you can't
  sell "consistent progression" on placeholder bars.
- **Ships:** (a) a measured-entry flow in the Combine & Measurables accordion (athlete/coach logs real
  40-yard, vertical, agility times; timestamps + who-measured); (b) deterministic gap math vs the real
  position-keyed `COMBINE_BENCHMARKS` that already exist; (c) the agentic layer: on each new measurement
  batch, Sonnet authors the **gap analysis + focus block** ("0.3s off the RB 40-target; the gap is your
  first 10 yards — here's the 6-week acceleration emphasis, woven into your current phase") as an
  approval-queue proposal that adjusts the SP-1 block's emphasis, not its structure.
- **Tier:** Sonnet, per measurement event (a few times per season). Measured combine deltas over time
  become the marketing proof-points OP-4 harvests.

### SP-7 · Growth Governor — age & maturation-aware loading
- **Problem:** finding #8 tail — `birth_date` exists and scales nothing; load thresholds are identical
  at 13 and 17; growth spurts (peak height velocity — the injury-risk window) are invisible.
- **Ships:** deterministic first — age-banded volume/intensity/plyo ceilings applied as a validation
  layer on every served block (SP-1 catalog cells already split by tier; this adds the hard governor),
  and a height/weight log (quarterly prompt) whose growth-velocity calculation flags probable PHV windows
  in native SQL. The agent's role is **explanation only**: when the governor trims a block or a PHV flag
  raises, Haiku writes the athlete/guardian note ("Marcus grew 4cm this quarter — we're deliberately
  pulling jump volume for 6 weeks; here's the science"). Escalation to the coach dossier, never auto-loosened.
- **Tier:** Haiku, event-triggered. This is the deepest "we protect them" differentiator in the youth
  market, and it's mostly free math.

### SP-8 · Sport-Aware Load Sentinel — context for the watchdogs
- **Problem:** finding from the backend audit — `bbf-workload-sentinel`, `bbf-athlete-acwr` apply
  identical thresholds to a sprinter and a lineman, in-season or off; `volume_multiplier` from readiness
  logs adjusts nothing.
- **Ships:** a `sport_load_profiles` reference table (per sport/position-group: dominant load vectors,
  in-season vs off-season ACWR bands, joint-risk emphasis — one-time Sonnet-drafted, founder-approved,
  then frozen) consumed deterministically by the existing sentinel; `athlete_readiness_logs.volume_multiplier`
  finally wired into served-block volume. Breaches route to SP-3's narrator so the athlete hears "why
  today got lighter" instead of silently receiving a trimmed session.
- **Tier:** one-time Sonnet bake for the profiles; runtime stays ZERO-AI. Pure In-House Equity form.

### SP-9 · Post-Game Debrief + The Guardian Wire
- **Problem:** findings #9 — Post-Game Check is four binary buttons; parents get nothing after the
  consent signature, ever.
- **Ships:** (a) **debrief upgrade**: after a game-day check-in (Season Brain knows it was game day),
  one bounded conversational turn — "rough third quarter or rough matchup?" — captured into the friction
  telemetry SP-0 makes meaningful; (b) **The Guardian Wire**: a monthly baked trilingual guardian digest —
  phase/tier movement (SP-3), form-safety summary (SP-5), measured combine deltas (SP-6), growth notes
  (SP-7), next month's focus — dispatched on the owned email rail with founder approval. The youth
  edition of CX-7's narrative discipline, aimed at the person who pays.
- **Tier:** Sonnet (debrief turn, game days only) + Haiku/Fable (monthly digest bake). **Retention is
  a parent decision — this is the retention engine for the youth product.**

---

# PART II — HOW IT COMPOUNDS (the youth flywheel)

```
 SP-0 telemetry truth ──► Referee gates actually clear ──► SP-3 explains every verdict
        │                                                        │
 SP-2 season calendar ──► SP-1 sport-true blocks flex ──► athlete progresses per THEIR sport
        │                  around real game weeks               │
 SP-5 form scans + SP-6 measured combine + SP-7 growth log ──► SP-9 Guardian Wire tells the
        └──────────► the dossier fills with REAL data ─────────► parent a story worth paying for
                     (feeds H-7, OP-4 proof-points, C-2 content seeds)
```

The sell, in one paragraph: *Every Rising Athlete gets what a D1 program has — a periodization
coordinator (SP-1) who knows their sport and position, a season planner (SP-2) who tapers them into game
day, a biomechanist (SP-5) watching every landing, a combine analyst (SP-6) coaching measured gaps, a
growth specialist (SP-7) protecting them through the spurt, and a program director (SP-3/SP-4) who
explains every promotion and every hold — with a monthly letter home (SP-9). For $14.99 a month. That's
the futuristic pitch, and every piece of it runs on rails BBF already owns.*

---

# PART III — SEQUENCING & GUARDRAILS

| Order | Ship | Rationale |
|---|---|---|
| **1 (now)** | SP-0 custodian · SP-3 Referee's Voice · SP-4 Milestone Pathfinder | SP-0 unblocks everything; SP-3/SP-4 are cheap event-triggered narration on data SP-0 makes true |
| **2** | SP-1 periodization catalog bake · SP-5 youth Form HUD | The two flagship visible upgrades; SP-1 is a finite bake, SP-5 reuses a live function |
| **3** | SP-2 Season Brain · SP-6 Combine Truth · SP-8 sport-aware sentinel | Need the calendar schema + measured-entry flows (small migrations via `apply_migration`) |
| **4** | SP-7 Growth Governor · SP-9 Guardian Wire | Governor wants a quarter of height/weight data; the Wire wants SP-3/5/6/7 feeding it |

**Youth-specific guardrail ledger (binding):**
1. **No autonomous load changes for minors — ever.** The orchestrator's `youth_load_progression`
   exclusion stays; every SP proposal that touches load/volume/phase routes through the founder approval
   queue. Agents narrate freely; they never write training state directly.
2. Guardian-facing copy (SP-3, SP-7, SP-9) ships via approval queue until the CEO explicitly graduates
   it; owned email rail only.
3. All youth narrative generation is batch/event-baked — no free-running loops; SQL sentinels decide
   whether an agent runs (§4 + In-House Equity).
4. Deterministic validation wraps every generated block: Immutable Laws + SP-7 age governor run AFTER
   generation, in native code, before storage (AI proposes, our code disposes).
5. Trilingual structural in every SP output (the milestone/regimen data is already trilingual — the
   agents must keep pace).
6. Minor-athlete data never seeds public content without the OP-4 deterministic anonymization layer +
   founder green-light; no photos of minors leave the platform (form-scan images stay transient, scores
   persist — same posture as today's adult kinematics).
7. Schema additions (`bbf_athlete_season`, `sport_load_profiles`, form ledger, growth log) via
   `apply_migration` only; `supabase db push` remains forbidden (`DATABASE_SAFETY.md`).

**CEO decision points (flagged, not assumed):**
1. **SP-0 changes when promotions fire.** Once the gates become satisfiable, athletes WILL start
   auto-promoting Phase 1→2 on real telemetry. Confirm you want the Referee live-firing before the
   custodian ships, or keep promotions in dry-run/approval mode for the first cycle.
2. SP-5 puts minors' movement video through the vision model (transient, score-only persistence, same
   as adult flow) — confirm the privacy posture and whether guardian consent language needs a line item.
3. SP-2's game calendar is new PII-adjacent data (a minor's whereabouts schedule) — confirm collection
   comfort + RLS review before the migration.
4. SP-9 Guardian Wire cadence and whether it's included in Rising Athlete or an upsell (pairs with H-8).

---

*Prepared from a two-sided deep audit of the Sports Hub: the full youth frontend journey (intake gate →
check-in → drills → post-game → fuel → prehab → mindset, all `sportshub/*` components + sport data
files) and the complete backend progression machinery (Autonomous Referee, tier ladder, workload
sentinel, ACWR, peaking/forecasting, and the 12 athlete-table migrations). Every gap cited was verified
in code; every "ships" builds on a table, function, or rail that already exists.*
