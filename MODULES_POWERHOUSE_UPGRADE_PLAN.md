# MODULES POWERHOUSE UPGRADE PLAN — Content · Knowledge · Coaching

**Status:** APPROVED-FOR-PLANNING draft — awaiting CEO green light to begin execution.
**Scope:** the three Command Center executive domains (`frontend/src/pages/CommandCenter.jsx:135-141`)
and every module inside them. This is the full-blown escalation blueprint: current state →
powerhouse state, per module, plus the cross-domain flywheel that makes the whole worth more
than the parts.
**Doctrine:** everything below honors the constraint envelope — LOCKED brand (§2), model router
(§4), tab-deck UI standard (§10), RLS boundaries (§7), and the bake-first / cache-first
burn-rate discipline already proven in the language lab and science digest.

---

## 0 · The one-paragraph thesis

Today the three domains are **three silos of mostly-static, mostly-manual tooling with real
plumbing underneath**: the Content rail has a fixed 30-post library and distributors sitting in
scaffold mode; the Knowledge rail is a curated museum (100 static studies, 90 static films, no
search, no PubMed); the Coaching rail is deterministic engines with two AI garnishes and a
dormant wearable spine. The upgrade turns each silo into a **generative, self-feeding engine**
and then wires them into one flywheel: **Knowledge discovers → Content manufactures &
distributes → Coaching proves → results feed back into Knowledge and Content.** Nothing gets
thrown away — every upgrade builds directly on tables, edge functions, and UI that already
exist.

---

# PART I — CURRENT STATE (what everything looks like right now)

## I.A · CONTENT domain — 5 modules (`content`, `content-manager`, `studio`, `studio-v4`, `studio-batch`)

| Module | What it is today | The ceiling it hits |
|---|---|---|
| **Content Engine** (`ContentEngine.jsx`) | CRUD editor for trilingual marketing CTA cards; public landing reads them live via RPC (`bbf_marketing_cards`). | Only ONE deck (`calibration`, 3 cards) though the schema supports arbitrary decks. No AI assist, no preview, no images, no scheduling. |
| **Digital Content Manager** (`DigitalContentManager.jsx` + `ContentVaultGrid.jsx`) | Review Bucket over a **static 30-post JSON** (10 EN/10 ES/10 PT, 5 series) → Green Light workflow → ElevenLabs synth; Marketing Vault (HeyGen clips, Meta dispatch, TikTok manual bridge); drag-drop Distribution Calendar over `bbf_content_manager_queue`. | Library is a fixed batch — **no regeneration pipeline exists**. Approval metadata (`approval_status`, `algorithmic_target`, `pacing_strategy`, `platform_specifics`) is sent by the client but **dropped by the edge fn** (no columns). **No auto-poster** consumes the queue at `scheduled_at` — publishing is manual. Draft edits lost on reload. |
| **Sovereign Studio v1** (`SovereignStudio.jsx`) | Script + 5 Vibes + voice-tuning sliders → ElevenLabs Akeem clone preview → device download. | "Save to Vault" is a download, not storage. Single voice. Largely superseded by V4's voice panel. |
| **Sovereign Studio V4** (`SovereignStudioV4/`) | 7-mode content machine (CTA cards / phone mockups / spotlight / reel video engine / ad compiler / queue / history). Haiku writes VO scripts on cache miss; client-side WebCodecs MP4 render ("Isolation Protocol"); posts ride `bbf_calling_cards_batch_v1` / `bbf_reels_batch_v1` + daily distributor crons. | CTA copy catalog hardcoded (~14 variants, EN-only). Render requires WebCodecs (no fallback). Blob uploads don't survive reload. `bbf-card-distributor` is **"SCAFFOLD… awaiting LIVE API tokens"**; TikTok posting disabled everywhere (manual bridge only). |
| **Studio Batch Compiler** (`StudioBatchPanel.jsx` + `bbf-studio-batch-compiler`) | Preset + audience + locale + gram override → compiled z-ordered render timeline into `studio_render_jobs`. Trilingual overlay localization; real-vs-demo gram privacy boundary. | **Prepare-step only — no encoder ever consumes `studio_render_jobs`.** Panel passes an empty preset list. Still on the old manual `X-BBF-Admin-Token` auth pattern. |

**Domain verdict:** a manufacturing line with a finished front half (authoring, compiling,
queueing) and an unfinished back half (auto-posting, server rendering, live distribution,
performance feedback). Zero engagement data returns from any platform.

## I.B · KNOWLEDGE domain — 3 modules (`coach-lab`, `coach-cave`, `language-lab`)

| Module | What it is today | The ceiling it hits |
|---|---|---|
| **Coach Lab** (`CoachLab.jsx`, 4 pillars all live) | **Research Vault**: 100-study static JSON grid (EN-only) + manual-paste ingest → Claude structures it into `coach_knowledge_base` flip cards. **Kinesiology Lab**: 24 concepts, localStorage Leitner boxes, 100% client-side. **Coach's Arena**: 10 hardwired cases + AI critique (0-100 vs NASM/NSCA), nothing persisted. **Broadcast Hub**: synthesize ≤5 vault entries into a newsletter → copy-to-clipboard. | **No PubMed integration anywhere** (the word appears only in placeholder text). No search over the 100-study grid or saved cards. Arena critiques vanish — no history, no trend. Broadcast output goes nowhere (clipboard only). 24 kinesiology concepts is a demo, not a curriculum. Stale "1 of 4 pillars live" copy. |
| **Coach's Cave** (`CoachCave.jsx`) | 90 hand-curated YouTube films (3 sport-psych decks × 3 languages × 10), language-branching, inline player. | Pure static list. No notes, no watch-tracking, no cross-links to Arena/Vault. Films can rot (external YouTube). |
| **Language Mastery Lab** (`LanguageMasteryPanel.jsx`, 8 modes + legacy Audio Lab) | The deepest module in the app: SRS Vocab Forge (Postgres-backed Leitner), Audio Dojo (zero-API Pimsleur stitch), Immersion roleplay (live Claude, error-injection back into SRS), Video Vault (100 lessons), Guided Track curriculum engine, nightly Polyglot Sentinel cron, baked ElevenLabs soundboard (each cue billed once ever). | Content-thin in spots: The Path has **3 sentences per language**; Audio Dojo 10 lessons/language; unbaked fragments show "Calibrating". Single-user by design. The legacy Audio Lab (2,003-line `AdminLanguageRoadmap`) is fused in whole, un-refactored. |
| *(Public satellite)* Marketing Knowledge deck | Science Hub: **8 hardcoded studies**. Routine Interrogator (React): **hardcoded placeholder reply** — the real `bbf-agentic-interrogator` fn is only wired from legacy `index.html`. | The "live Supabase corpus + AI search" promised in code comments was never built. The React Interrogator is a mannequin. |

**Domain verdict:** the Language Lab proves the architecture pattern (SRS + baked audio +
nightly sentinel + curriculum engine). The rest of the Knowledge domain never received that
pattern — it's still curated JSON with an AI paste-box.

## I.C · COACHING domain — 5 modules (`roster`, `eagle-eye`, `comlink`, `nutrition-locker`, `sports`)

| Module | What it is today | The ceiling it hits |
|---|---|---|
| **Founder Five roster + Dossier** (`ClientHub.jsx` + `ClientDossier.jsx` 1,888 L) | Master-detail roster with Coaching Velocity Index (deterministic 0-100), calibration + telemetry overlays, 7 dossier decks (nutrition, workouts, 30/60/90 analytics, chat, targets, override, access). Co-Coach Intel chat assist. | **Co-Coach runs on Gemini 2.5 Flash — the only model-router bypass in the stack**; answers aren't persisted. Dossier still fires a ~7-read fan-out (R2 consolidation only reached DossierPulse). `SovereignAthlete` premium layout ships **mock telemetry**. Chat is poll-on-mount, no realtime. Coach UI EN-only. |
| **Eagle Eye** (`EagleEye.jsx` + `bbf-eagle-eye`, 907 L) | Deterministic daily-vs-weekly alignment verdicts; Autonomous Cycle fires trilingual nudges, Sonnet escalation scripts, and load corrections into the founder approval queue; `bbf_eagle_eye_interventions` ledger. | **Manually triggered only — no cron.** Nudges are in-app channel only (no email/SMS). No outcome tracking on interventions (did the nudge work?). |
| **Comlink** (`Comlink.jsx`) | Read-only triage: Pathfinder leads + concierge run log + TDEE micro-leads. | Display-only — no convert/provision/replay actions; concierge "Run Now" deliberately unwired; no lead scoring; EN-only. |
| **Nutrition Locker** (`NutritionLocker.jsx`, 824 L) | Impressive console (6 diet styles × 9 allergy exemptions × 1200–6000 kcal × fasting paces + Coach Oversight push) — but generation is **deterministic template scaling** of a preloaded week catalog. | **The real generative engine ("Terminal H") was never built.** No feedback loop from `nutrition_daily_sync` adherence. EN-only plans. |
| **Sports Portal** (`SportsPortal.jsx`) | Live youth roster (strict allowlist + guardian-consent enforcement), Autonomous Referee (zero-AI phase-advance tripwire), admin override panel. | Age is a UI lens (no DB column). Small live population. Dossier drill-in reuses the adult dossier with its mock telemetry. Kinematic form scores not surfaced in the dossier. |
| *(Dormant spine)* | `bbf_wearable_readings` (0 rows), ACWR load pipeline staged for deprecation, `bbf-workload-sentinel` nightly cron still running against 4 rows. | The single biggest unrealized coaching moat: no wearable ingest → no ACWR → no RED-LOCKOUT overtraining protection. Also: **tier gating is cosmetic/fail-open** — no `bbf_feature_gates`, price ladder unbacked. |

**Domain verdict:** world-class deterministic engines (readiness, prescription, referee,
velocity index) wearing a thin AI layer, with the two highest-value loops — generative
nutrition and wearable-driven load management — unbuilt or dormant.

---

# PART II — THE POWERHOUSE PLAN (how we take it to the next level)

Each move below is numbered `<Domain>-<n>`, states what it builds ON (existing asset) and
what it ships. Model tiers follow §4 discipline: **Haiku for bulk/baked generation, Sonnet
for judgment, Opus only where safety-critical** — and generation is batch-and-bake wherever
possible so recurring spend stays near zero.

## II.A · CONTENT → the Autonomous Content Foundry

**C-1 · Auto-Poster (close the loop that's already promised).**
Builds on: `bbf_content_manager_queue` + the migration comment that literally says the
metadata is "for the eventual auto-poster."
Ships: new `bbf-content-autoposter` edge fn on a pg_cron (every 15 min) — pulls `scheduled`
rows where `scheduled_at <= now()`, routes by format to the existing Meta dispatch path /
distributor tables, marks `posted`/`failed` with retry + dead-letter status, honors the
Algorithm Health pacing already computed. Add the missing columns (`approval_status`,
`algorithmic_target`, `pacing_strategy`, `platform_specifics`) so the Green Light workflow's
output finally persists. Add `draft_state jsonb` so caption/cut-sheet edits survive reload.

**C-2 · Generative Content Foundry (kill the fixed 30-post batch).**
Builds on: the 5-series taxonomy, the deterministic `algorithmicBriefEngine`, the reel_kit
shape, the Green Light workflow.
Ships: `bbf-content-foundry` edge fn — batch-generates a new N-post trilingual drop on
demand (Haiku, one batch call per series, baked into `bbf_content_manager_queue` as
`draft`), seeded from **live inputs**: Research Vault entries (Knowledge flywheel), roster
proof-points (anonymized velocity/tonnage wins), seasonal calendar. The CEO's job compresses
to Review Bucket curation — the machine drafts, the founder green-lights. Static JSON becomes
the fallback seed, not the ceiling.

**C-3 · Distribution goes fully live.**
Builds on: `bbf-card-distributor` / `bbf-reel-distributor` scaffolds with their four safety
gates and FLIP RULE.
Ships: (a) activate Meta tokens in Supabase Vault + flip dry-run (operational, near-zero
code); (b) **TikTok Content Posting API** integration in both distributors (the switch is
already stubbed), replacing the manual bridge; (c) unified `bbf_distribution_ledger` view
across queue + both batch tables so QUEUE/HISTORY show one truth; (d) Meta token watchdog
upgraded to auto-refresh long-lived tokens instead of a hardcoded Aug-5 banner.

**C-4 · Performance feedback loop (the missing half of "algorithmic").**
Builds on: the client-side Algorithm Health heuristic and platform calibration matrix.
Ships: `bbf-engagement-harvester` cron — pulls post-level insights from Meta Graph (views,
reach, saves, shares) into `bbf_content_performance`; the Distribution Calendar gains a
performance overlay; a weekly Haiku digest ("what worked, what to make more of") lands in
the founder brief; and C-2's foundry reads the winners table so **generation is steered by
real engagement data**, not guesses. The Algorithm Health bar graduates from heuristic to
measured.

**C-5 · Server render farm (finish the Batch Compiler's back half).**
Builds on: `studio_render_jobs` (compiled z-ordered timelines nobody consumes) +
`bbf-studio-compiler`'s job state machine + the `bbf_studio_exports` bucket.
Ships: a headless render worker (Playwright/Chromium is already in the stack — render the
timeline in a headless page and capture via the same WebCodecs path, or muxer-server
equivalent) that consumes `studio_render_jobs` → MP4 → bucket → auto-enqueue to
distribution. Client-side render stays as the fast interactive path; the server path unlocks
**true batch manufacturing** (compile 20 directed athlete videos overnight) and removes the
WebCodecs browser ceiling. Also: real preset catalog UI for the Batch panel (the fn already
supports it; the panel passes `[]`), and migrate its auth to the session-token pattern.

**C-6 · Content Engine → multi-deck marketing CMS.**
Builds on: the schema that already supports arbitrary decks ("any deck tomorrow").
Ships: deck manager UI (create/clone/reorder decks — calibration, hero, proof, seasonal),
live landing preview pane, image/asset attachment via the existing storage patterns, Haiku
trilingual copy-assist ("draft ES/PT from my EN"), and scheduled deck flips (launch-day
swaps without a deploy). The public landing keeps reading the same RPC — zero migration risk.

**C-7 · Voice & vibe expansion.**
Builds on: Studio v1 sliders + V4 VibeSelector + the baked-audio doctrine.
Ships: Studio v1's "Save to Vault" writes to `studio-audio-vault` for real (it's a download
today); vibe presets become DB rows (operator-editable); V4's CTA copy catalog goes
trilingual + foundry-refreshable instead of 14 hardcoded EN variants.

## II.B · KNOWLEDGE → the Living Research Engine

**K-1 · Research Vault → PubMed-wired, searchable, self-feeding.**
Builds on: `coach_knowledge_base` + the ingest→structure pipeline that already works.
Ships: (a) `bbf-pubmed-scout` edge fn hitting NCBI E-utilities (free API) — search by topic,
pull abstracts/PMIDs, one-click ingest into the existing Claude structuring flow (no more
manual paste); (b) **pgvector semantic search** over `coach_knowledge_base` + the 100-study
static grid (embed once, search forever — bake-first); (c) a weekly `bbf-research-sweep`
cron that runs saved topic queries (hypertrophy, youth periodization, fasting, prehab) and
stages new findings in a review queue — the Vault grows while the CEO sleeps; (d) trilingual
card summaries (Haiku batch-bake on ingest). Fix the stale "1 of 4 pillars" copy while in
the file.

**K-2 · Kinesiology Lab → server-backed adaptive curriculum.**
Builds on: the Leitner drill engine and the Language Lab's proven SRS architecture
(`bbf_vocab_mastery` pattern).
Ships: `bbf_kinesiology_mastery` table (mirror the vocab SRS schema — the code pattern
already exists), expand 24 concepts → 200+ via a **one-shot Haiku bake** reviewed in the
Arena before activation (never live-generated at drill time), trilingual question content
(the data file explicitly reserved the drop-in), and adaptive session assembly (weak boxes
first, exactly like Vocab Forge). CGCC/NAU/M.S. checklist state moves from localStorage to
the same table so it survives devices.

**K-3 · Coach's Arena → career-grade simulator with a memory.**
Builds on: the critique engine (0-100 vs NASM/NSCA) that already works but forgets.
Ships: `bbf_arena_history` table (case, protocol, score, gaps, timestamp) → score trendline
and weakness heatmap by domain; **case generation seeded from real anonymized roster
telemetry** (a stalled Founder-Five pattern becomes tomorrow's case — Coaching flywheel);
difficulty ladder (case complexity scales with rolling score); weakness-targeted case
selection (your lowest NASM domain gets drawn more often — Leitner for coaching judgment).

**K-4 · Broadcast Hub → wired into the Content Foundry.**
Builds on: the synthesis that already produces client-ready newsletters, and the Content
domain's queue + distributors.
Ships: "Broadcast" gains three real destinations beyond clipboard — (a) push to
`bbf_content_manager_queue` as a drafted post series (research → social content in one
click), (b) email dispatch via the Brevo/Resend path (the long-deferred welcome-email
migration finally gets a second customer), (c) directed delivery to specific athletes via
the existing `bbf-studio-directed-delivery` rails. Trilingual output per the recipient's
`preferred_language`.

**K-5 · Coach's Cave → active study room.**
Builds on: the 90-film trilingual library and its deck structure.
Ships: `bbf_cave_log` (watch state, per-film founder notes, timestamps), a one-shot baked
Haiku companion card per film (key concepts + "use it on the floor tomorrow"), dead-link
sentinel (nightly HEAD-check on YouTube IDs — flag rot before the CEO hits it), and
cross-links: a film can cite Vault entries and spawn Arena cases.

**K-6 · Public knowledge surfaces stop being mannequins.**
Builds on: `bbf-agentic-interrogator` (live, but only wired from legacy index.html) and the
Science Hub's "live corpus planned" comment.
Ships: (a) wire the React Interrogator to the real fn (small, high-visibility win); (b)
Science Hub reads a **public projection of the Research Vault** — a `bbf_science_corpus`
view of broadcast-approved, founder-curated entries, so the private lab feeds the public
sales surface automatically (8 hardcoded studies → living library with AI search via the
K-1 pgvector index). Private→public is an explicit `approved_public` flag — nothing leaks
by default (§7).

**K-7 · Language Lab content densification.**
Builds on: the strongest engine in the app — it needs ammunition, not architecture.
Ships: The Path 3 → 60+ sentences/language (one-shot Haiku bake, founder-reviewed), Audio
Dojo 10 → 30 lessons/language via the existing `bbf-bake-language-soundboard` pipeline,
"Calibrating" gaps closed by a bake-coverage report (which cues lack fragments), and a
refactor pass that carves the 2,003-line legacy `AdminLanguageRoadmap` into the modern mode
components it's fused into.

## II.C · COACHING → the Sovereign Autonomous Coach

**H-1 · Co-Coach comes home to the router (and gets a memory).**
Builds on: the Gemini-powered `coach` action in `bbf-admin-roster` and the telemetry
enrichment it already does.
Ships: migrate Co-Coach to the model router (`co_coach_intel` → Sonnet) — eliminating the
single off-router AI call in the stack; persist exchanges in `bbf_co_coach_threads`;
context-inject the **full dossier envelope** (readiness trend, volume, nutrition adherence,
chat history, wearable state, velocity band) via the existing `bbf_athlete_dossier` RPC; and
add a proactive mode — a morning per-client brief card in the roster ("Ana: 3rd readiness
dip this week, deload candidate") generated in one nightly batch (Haiku), not per-click.

**H-2 · Eagle Eye goes truly autonomous.**
Builds on: the complete Autonomous Cycle (verdicts → nudges → escalations → founder approval
queue) that today waits for a button press.
Ships: nightly pg_cron (`bbf-eagle-eye-nightly`, dry-run ledger + morning digest first, live
after one week of clean dry-runs); **multi-channel interventions** — email via the Brevo/
Resend rail (K-4 shares it) and SMS via the existing Twilio/VAPI plumbing
(`vapi-sms-closer` proves the pipe), channel-escalation ladder in-app → email → SMS by
severity; and **outcome tracking** on `bbf_eagle_eye_interventions` (did the client log in /
train within 72h? → `outcome` column) so the escalation scripts learn what actually
re-engages people (feeds H-1's context and C-4's digest).

**H-3 · Terminal H — build the real generative nutrition engine.**
Builds on: the Locker's already-excellent console (diet styles, allergies, kcal, fasting
paces, oversight push) and the `bbf_admin_set_meal_plan` write path.
Ships: `bbf-terminal-h` edge fn — Sonnet generates the 7-day plan from the console dials
**plus live athlete telemetry** (goals, `nutrition_daily_sync` adherence history, body comp,
training phase), with a **deterministic macro-validation layer** after generation (the
nutritionEngine math verifies every day hits the kcal/macro envelope — AI proposes,
deterministic code disposes; generation is never trusted raw). Trilingual output keyed to
`preferred_language`. Adherence feedback loop: weekly delta between plan and
`nutrition_daily_sync` auto-drafts next week's adjustments into the founder approval queue
(same rail Eagle Eye uses). The template catalog remains the $0 fallback.

**H-4 · Wearable spine revival — ACWR + RED-LOCKOUT (the moat).**
Builds on: `bbf-wearable-ingest` (exists), `bbf_wearable_readings` (empty),
`bbf_athlete_load_logs` + `bbf-workload-sentinel` (running against 4 rows), and the staged
deprecation file we will now **rescind instead of run**.
Ships: (a) finish the ingest path for Apple Health export + Whoop/Oura webhook payloads;
(b) ACWR computation as the Postgres function the Big Jim directive specified; (c) the
RED-LOCKOUT state machine — acute:chronic ratio breach flags the athlete, Eagle Eye (H-2)
carries the intervention, the dossier and `SovereignAthlete` panel display it; (d) replace
`SovereignAthlete`'s mock telemetry with the now-live readings. This is the highest-
complexity item in the plan and the strongest defensible feature: no competitor at this
price point runs autonomous overtraining protection.

**H-5 · Dossier consolidation + realtime (finish R2/R3, then go live-wire).**
Builds on: `useAthleteDossier` + the `bbf_athlete_dossier` RPC (built, only DossierPulse
migrated) and the R3 facade recommendation from COACHING_MODULE_AUDIT.md.
Ships: migrate all 7 dossier decks onto the single-RPC hook (kills the 7-read fan-out),
collapse the 4 fragmented lib modules into `lib/coachingData.js`, and add **Supabase
realtime** to coach chat and the wearable card (the `content_vault` grid already proves the
realtime pattern in this codebase) — the dossier becomes a live console instead of a
refresh-to-see tool.

**H-6 · Comlink → action console with a brain.**
Builds on: the read-only triage lanes and `bbf-admin-roster`'s existing action verbs.
Ships: inline actions — provision (fires the existing `/provision` rail), archive, replay
concierge for one lead, and the deliberately-unwired "Run Now" gets wired behind a confirm;
**Haiku lead-scoring** batch (nightly, baked onto `bbf_leads.score`) ranks the pending lane
by conversion likelihood using Pathfinder payload + TDEE signals; pipeline funnel strip
(applied → provisioned → active → retained) finally populates `bbf_conversions` (flag #9
from the tier audit).

**H-7 · Sports Portal grows into its own dossier.**
Builds on: the Autonomous Referee, the guardian-consent enforcement, and
`bbf-agentic-kinematics` (Sonnet vision) which already scores form.
Ships: real `age`/`birth_year` column (the slider stops being a lens), **kinematic form
scores surfaced in the athlete dossier** (the scores exist; the coach never sees them in
this rail), a youth-specific dossier variant that drops the adult mock telemetry, and
Referee decisions logged to a visible ledger card ("Phase 3 → 4 advanced on 07/12 —
criteria: completion 94%, RPE ceiling clear").

**H-8 · Server-side tier gating (monetization backbone).**
Builds on: TIER_FEATURE_AUDIT flags #4/#5 (cosmetic fail-open gating, unbacked price
ladder) and the existing `bbf_tiers` table.
Ships: `bbf_feature_gates` table + a `_shared/gate.ts` check used by tiered edge functions
(fail-closed for premium features, fail-open only for base), reconcile `bbf_tiers` Stripe
price IDs with `pricingMatrix.js`, and gate the new powerhouse features (Terminal H,
wearable spine, directed video) as the paid ladder they justify. Every upgrade above
becomes sellable instead of given away.

---

# PART III — THE FLYWHEEL (why the three plans are one plan)

```
        KNOWLEDGE                     CONTENT                      COACHING
  PubMed sweep (K-1) ──────► Foundry drafts posts (C-2) ──► clients educated via
  Research Vault grows        Broadcast Hub feeds queue      directed delivery (K-4/C-5)
        ▲                     Auto-poster ships (C-1)               │
        │                     Engagement harvested (C-4)            ▼
  Arena cases seeded ◄────── proof-points & winners ◄──── telemetry, adherence,
  from roster reality (K-3)   steer next generation         outcomes (H-2/H-3/H-4)
```

- **Knowledge → Content:** every Vault entry is a post seed; Broadcast Hub pushes straight
  into the distribution queue. The public Science Hub is a projection of the private lab.
- **Content → Coaching:** directed studio videos and trilingual education clips land in
  specific athletes' vaults; engagement tells us which cues clients actually absorb.
- **Coaching → Knowledge/Content:** anonymized roster outcomes become Arena training cases
  and marketing proof-points; intervention outcomes teach Eagle Eye's scripts; adherence
  data steers Terminal H.

One shared rail makes this cheap: the **founder approval queue** (Render proposal endpoint)
already gates Eagle Eye corrections — Terminal H adjustments, foundry batches, and research
sweeps all reuse it. The CEO's role everywhere is *approve/veto*, never *produce*.

---

# PART IV — EXECUTION WAVES (dependency-ordered)

**Wave 1 — Close the open circuits (foundation, low risk, immediate payoff).**
C-1 auto-poster + metadata persistence · K-6a React Interrogator wiring · H-1 Co-Coach
router migration + persistence · H-5 dossier consolidation (R2/R3 finish) · C-6 multi-deck
CMS · stale-copy cleanup (Coach Lab "Phase 2", Opus-4.7 header comments).
*Everything here completes plumbing that already half-exists. No new external dependencies.*

**Wave 2 — Generative engines come online.**
C-2 Content Foundry · H-3 Terminal H · K-1 PubMed + pgvector search · K-2 Kinesiology
expansion · K-7 Language densification · H-6 Comlink actions + lead scoring.
*The batch-and-bake generation layer. Each engine ships with its deterministic validation
guardrail and its founder review queue.*

**Wave 3 — Autonomy & distribution.**
H-2 Eagle Eye nightly + multi-channel · C-3 live distributors + TikTok API · C-4 engagement
harvester · K-4 Broadcast→queue/email · K-3 Arena memory · K-5 Cave study room.
*The system starts acting on a schedule and reporting back. Dry-run-first discipline on
every autonomous actor.*

**Wave 4 — The moat.**
H-4 wearable spine + ACWR + RED-LOCKOUT · C-5 server render farm · H-7 youth dossier ·
H-8 tier gating + Stripe reconciliation.
*The heaviest schema and infrastructure work, deliberately last — it lands on a platform
that is by then generative, autonomous, and instrumented.*

**Standing rules for every wave:** model router only (§4) · bake-first, cache-first, Haiku
for bulk · deterministic validation wraps every generative write · founder approval queue
gates every client-facing autonomous change · trilingual is structural in all new content
paths · RLS + `approved_public` flags on any private→public projection · lint+build green
before every push, `sw.js`/SPA cache bump on frontend changes (§3/§6).

**Explicit decision points reserved for the CEO (flagged, not assumed):**
1. H-4 rescinds the staged ACWR deprecation — revival is this plan's recommendation, but it
   reverses a staged decision and needs a direct order.
2. C-3 requires live Meta/TikTok API tokens injected into Supabase Vault (external-platform
   credentials only the CEO can mint).
3. H-8 tier gating changes what paying tiers receive — pricing is a CEO call.
4. Brevo (vs. current Gmail/Zap) becomes the email rail for K-4 + H-2 — cutover approval.

---

*Prepared from a full three-domain code audit (13 modules, ~40 edge functions, all backing
tables and crons) — every "builds on" claim above was verified against the current tree.*
