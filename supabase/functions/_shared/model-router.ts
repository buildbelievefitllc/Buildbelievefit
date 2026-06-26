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
  // forecast_1rm — MIGRATED off the LLM to the deterministic engine
  //   (_shared/forecast-engine.mjs · Epley + Brzycki + OLS regression). No LLM route.
  | 'sport_immersion_seed'    // Immersion · static sport-immersion seed
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
  // forecast_1rm removed — now deterministic (see _shared/forecast-engine.mjs).
  sport_immersion_seed:  MODELS.HAIKU,
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
