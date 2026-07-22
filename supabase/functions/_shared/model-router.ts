// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/model-router.ts
// Operation Pantheon · Phase 7 · Workstream B · The Model Router
// ───────────────────────────────────────────────────────────────────────
// Centralized model routing across every Claude-calling edge function.
// Replaces hardcoded `const MODEL = 'claude-opus-4-7'` strings so that
// cost decisions live in one file and can be tuned without redeploying
// every function.
//
// CEO ROUTING RULES (Phase 7 directive):
//   · Syntax/Vocab Retries & Mesocycle Rationale → Haiku 4.5
//   · Novel Kinematic Deviations                 → Sonnet 4.6 (vision)
//   · PAR-Q+ Assessment & Wellbeing Escalations  → Opus 4.8
//
// Every Claude call SHOULD pass through routeModel() with a use-case
// tag. Edge functions that need peak reasoning (cardiac · ED triage)
// stay on Opus; everything else escalates only when the use case
// genuinely warrants it.
// ═══════════════════════════════════════════════════════════════════════

export const MODELS = {
  HAIKU:  'claude-haiku-4-5',
  SONNET: 'claude-sonnet-4-6',
  OPUS:   'claude-opus-4-8',
  // FABLE · narrative tier — long-horizon character/voice continuity (in-character
  // roleplay, serialized curriculum fiction). Not a reasoning upgrade over Opus for
  // safety calls; it is the storytelling specialist. Live traffic on this tier is
  // CEO-only today (the Language Lab sits behind the /command AdminGuard).
  FABLE:  'claude-fable-5',
} as const;

export type Model = typeof MODELS[keyof typeof MODELS];

// Use-case taxonomy. Every Claude-calling edge function picks the tag
// that best matches its invocation. New tags should be added here ·
// never hardcoded model strings in callers.
export type UseCase =
  // ── HAIKU tier · low-stakes, deterministic narration ──────────────
  | 'vocab_retry'             // Sentinel-recoverable kickback retry
  | 'syntax_retry'            // Schema-repair retry
  | 'mesocycle_rationale'     // Peaking · block-priority rewrite narration
  | 'snapshot_synthesis'      // Athlete snapshot 2-4 sentence digest
  | 'sovereign_brief'         // Founder cockpit nightly synthesis
  | 'i18n_translation'        // Linguist · language pack rotation
  | 'studio_voiceover_script' // Sovereign Studio · dynamic VO script for a cached exercise/topic reel (low-stakes narration → margin protection)
  // forecast_1rm — MIGRATED off the LLM to the deterministic engine
  //   (_shared/forecast-engine.mjs · Epley + Brzycki + OLS regression). No LLM route.
  // sport_immersion_seed — RETIRED (Fable Fleet Sync). The tag was named for a
  //   one-shot scenario seed, but bbf-agentic-immersion is a full multi-turn
  //   in-character conversation → re-tagged immersion_roleplay_turn (FABLE tier).
  | 'premium_inflection_scripts' // Premium Audio Engine · short pre-baked biometric inflection cue variants (low-stakes narration)
  | 'convai_dynamic_brief'    // Live Mindset Coach · pre-session dynamic-variable packaging (low-stakes)
  // ── SONNET tier · vision + mid-complexity reasoning ───────────────
  | 'kinematic_form_score'    // Single-image biomechanics scoring (vision)
  | 'novel_form_correction'   // Comlink · novel deviation correction (vision-adjacent)
  | 'onboarding_interview'    // Pathfinder/Interrogator dialog
  // prehab_assignment — MIGRATED off the LLM to the deterministic lookup
  //   matrix (_shared/prehab-matrix.mjs · DYNAMIC PREHAB MATRIX). No LLM route.
  | 'sales_chat'              // AI Hub · BBF Chatbox sales-closer dialog
  | 'concierge_greeting'      // Self-serve onboarding · tier-aware BBF Lab Concierge welcome
  | 'coach_research_ingest'   // Coach Lab · Research Vault — structure a study/abstract into a coaching summary
  | 'coach_case_generate'     // Coach Lab · Arena — generate a randomized client case study
  | 'coach_protocol_critique' // Coach Lab · Arena — score the coach's protocol vs NASM/NSCA
  | 'coach_broadcast_synthesis' // Coach Lab · Broadcast — synthesize vault entries into a client newsletter
  | 'sovereign_audio_briefing'  // Sovereign Audio — Day-30 graduation voice briefing (premium narration, mid-complexity → Sonnet)
  | 'premium_session_script'    // Premium Audio Engine — full-session segmented narration plan (per-athlete, mid-complexity → Sonnet)
  | 'eagle_eye_alignment'       // BBF Eagle Eye — secondary-brain cross-check of daily readiness vs weekly-report coaching-cue buckets (per-client reasoned synthesis)
  | 'eagle_eye_intervention'    // BBF Eagle Eye — client-facing empathetic, intrinsic-motivation escalation script when a client stays dark on a re-engagement nudge
  // ── Agentic Expansion wave (SP/OP series · 2026-07) ────────────────
  | 'sport_block_design'        // SP-1 · sport × position × phase × season training-block catalog bake (offline, founder-approved before serving)
  | 'season_taper_adjustment'   // SP-2 · Season Brain weekly game-week micro-adjustment draft (proposal-only, approval-gated)
  | 'guardian_wire_digest'      // SP-9 · monthly guardian-facing progress digest (parent-facing warmth — parity with eagle_eye_intervention)
  | 'morning_command_brief'     // OP-1 · nightly executive brief over pre-computed daily deltas (one call/day)
  | 'mesocycle_architect'       // OP-8 · block-end next-mesocycle structured diff proposal (rare, high-value, approval-gated)
  | 'meal_vision_macro'         // Fuel Companion · meal-photo macro estimation (vision → Sonnet)
  | 'trilingual_content_adapt'  // Content Adapter · EN hook → culturally adapted ES/PT drafts (batch, low-stakes)
  // ── FABLE tier · narrative continuity · character + register fidelity ──
  | 'immersion_roleplay_turn'    // Immersion · live in-character roleplay turn (persona + register + closed error taxonomy)
  | 'narrative_curriculum_bake'  // BBF Fables · offline serialized-episode bake (founder-reviewed before publish; never a live call)
  // ── OPUS tier · peak reasoning · safety-critical only ─────────────
  // parq_assessment — MIGRATED off the LLM to the deterministic SQL engine
  //   (public.bbf_parq_assess · standardized PAR-Q+ 2014). No LLM route; was
  //   never AI-classified (client-side self-attest) — this is the authoritative
  //   server-side classifier.
  | 'wellbeing_escalation'    // ED triage / wellbeing halt
  | 'cardiac_intercept'       // Cardio routing engine
  | 'tier_upgrade_offer'      // Phase 8 · Sales Router · consistency→conversion analysis (CEO override 2026-06: Sonnet — margin protection)
  ;

// Authoritative routing table. Tunable in one place.
const MODEL_MAP: Record<UseCase, Model> = {
  vocab_retry:           MODELS.HAIKU,
  syntax_retry:          MODELS.HAIKU,
  mesocycle_rationale:   MODELS.HAIKU,
  snapshot_synthesis:    MODELS.HAIKU,
  sovereign_brief:       MODELS.HAIKU,
  i18n_translation:      MODELS.HAIKU,
  studio_voiceover_script: MODELS.HAIKU, // batch content-production VO script — low-stakes narration (CLAUDE.md §4 · margin protection)
  // forecast_1rm removed — now deterministic (see _shared/forecast-engine.mjs).
  // sport_immersion_seed removed — re-tagged immersion_roleplay_turn (FABLE tier).
  immersion_roleplay_turn:   MODELS.FABLE, // live roleplay must hold character/register across 12 turns AND sessions — the narrative tier's home turf. Fail-open default + CEO-only route bound the risk.
  narrative_curriculum_bake: MODELS.FABLE, // serialized curriculum fiction (recurring cast, arc continuity); offline bake, pending_review gate — zero live-latency exposure.
  kinematic_form_score:  MODELS.SONNET,
  novel_form_correction: MODELS.SONNET,
  onboarding_interview:  MODELS.SONNET,
  // prehab_assignment removed — now deterministic (see _shared/prehab-matrix.mjs).
  sales_chat:            MODELS.SONNET,
  concierge_greeting:    MODELS.SONNET,
  coach_research_ingest: MODELS.SONNET, // structured study summarization — mid-complexity, not safety-critical
  coach_case_generate:   MODELS.SONNET, // creative client-case generation
  coach_protocol_critique: MODELS.SONNET, // reasoned scorecard vs NASM/NSCA guidelines
  coach_broadcast_synthesis: MODELS.HAIKU, // reformatting structured summaries into newsletter prose (low-stakes)
  sovereign_audio_briefing: MODELS.SONNET, // Sovereign Audio graduation briefing — premium narration, NOT safety-critical → Sonnet (§4)
  premium_session_script: MODELS.SONNET, // Premium Audio Engine session narration — parity with sovereign_audio_briefing, NOT safety-critical → Sonnet
  premium_inflection_scripts: MODELS.HAIKU, // short fixed-slot inflection cues — low-stakes narration (margin protection)
  convai_dynamic_brief:  MODELS.HAIKU, // packaging structured facts for the live agent's context — low-stakes
  eagle_eye_alignment:   MODELS.SONNET, // secondary-brain cue-alignment synthesis — reasoned cross-check, NOT a live safety call (deterministic engine owns the verdict) → Sonnet (§4 margin)
  eagle_eye_intervention: MODELS.SONNET, // client-facing empathetic escalation script — warmth/nuance/trilingual matter (parity with sovereign_audio_briefing), NOT safety-critical → Sonnet
  sport_block_design:     MODELS.SONNET, // periodized block design needs real S&C reasoning; offline bake billed once per cell, deterministic Immutable-Laws validation after
  season_taper_adjustment: MODELS.SONNET, // game-week taper judgment over live telemetry — mid-complexity, proposal-only
  guardian_wire_digest:   MODELS.SONNET, // parent-facing monthly narrative — warmth + trust matter; volume is tiny (monthly per youth athlete)
  morning_command_brief:  MODELS.SONNET, // one executive synthesis call per day over pre-computed deltas
  mesocycle_architect:    MODELS.SONNET, // next-block structured design — block-end events only
  meal_vision_macro:      MODELS.SONNET, // vision estimation (Haiku image grounding unreliable — §4)
  trilingual_content_adapt: MODELS.HAIKU, // cultural ES/PT adaptation — i18n_translation parity, batch-baked
  // parq_assessment removed — now deterministic (see public.bbf_parq_assess).
  wellbeing_escalation:  MODELS.OPUS,
  cardiac_intercept:     MODELS.OPUS,
  tier_upgrade_offer:    MODELS.SONNET, // downgraded from Opus — margin (CEO override 2026-06)
};

// Selection options · `vision` upgrades a Haiku target to Sonnet since
// Haiku's image-grounding quality is unreliable for biomechanics.
// `override` lets the caller pin a specific tier in an emergency
// (e.g. founder ENV flag override · should be rare).
export interface RouteOptions {
  vision?:   boolean;
  override?: Model;
}

export function routeModel(useCase: UseCase, opts?: RouteOptions): Model {
  if (opts && opts.override) return opts.override;
  const base = MODEL_MAP[useCase];
  if (!base) {
    console.warn(`[model-router] unknown use case "${useCase}" · defaulting to Sonnet`);
    return MODELS.SONNET;
  }
  if (opts && opts.vision && base === MODELS.HAIKU) return MODELS.SONNET;
  return base;
}

// Lightweight observability hook · every Claude call should log the
// (function_name, use_case, model) triple so Workstream B follow-ups
// can correlate spend with use case.
export function logRouting(functionName: string, useCase: UseCase, model: Model): void {
  console.log(`[model-router] fn=${functionName} use_case=${useCase} model=${model}`);
}

// Sugar · combines routing + logging in one call.
export function routeAndLog(functionName: string, useCase: UseCase, opts?: RouteOptions): Model {
  const m = routeModel(useCase, opts);
  logRouting(functionName, useCase, m);
  return m;
}
