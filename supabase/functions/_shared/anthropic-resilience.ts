// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/anthropic-resilience.ts
//
// Phase 6.0j · Anthropic resilience middleware · per-use-case fallback
// policy adapted from the Gemini-side llm-resilience.js. Two key
// adaptations from the marketing-pipeline pattern:
//
//   1. PER-USE-CASE FALLBACK POLICY · the Gemini layer used a single
//      Flash→Pro rule. Anthropic agents have a tier hierarchy and
//      CEO routing rules that forbid demotion on safety-critical
//      use-cases:
//        · HAIKU  primary → SONNET fallback (escalate)
//        · SONNET primary → OPUS fallback (escalate)
//        · OPUS   primary → NO fallback (CEO directive · cardiac /
//                                        PAR-Q+ / wellbeing stay on
//                                        Opus regardless of cost)
//
//   2. ANTHROPIC ERROR TAXONOMY · different from Gemini · classified
//      from both HTTP status AND the response body's `stop_reason` +
//      content-block shape:
//        Retryable transient · 429 · 500 · 502 · 503 · 504 · 529
//                              (overloaded_error) · network/timeout
//        Permanent           · 400 (bad request · invalid schema)
//                              · 401 / 403 (auth)
//                              · 404 (model not found)
//                              · refusal content block (safety)
//                              · stop_reason='refusal' on newer APIs
//
// EXPORTS
//   · ANTHROPIC_RETRY_DEFAULTS
//   · FALLBACK_POLICY · UseCase → fallback Model | null
//   · isRetryableAnthropicFailure(result) · classification
//   · anthropicBackoffDelayMs(attempt, base, max, jitter)
//   · withAnthropicResilience(primaryFn, fallbackFn, opts) · the
//     middleware wrapper · returns augmented result with
//     { attempts, fallback_used, retry_history }
// ═══════════════════════════════════════════════════════════════════════

import { MODELS, type Model, type UseCase } from './model-router.ts';

// ─── Retry budget defaults ────────────────────────────────────────────
export interface AnthropicRetryOpts {
  maxAttempts:  number;
  baseDelayMs:  number;
  maxDelayMs:   number;
  jitterRatio:  number;
  tag:          string;
  fallbackOnPermanent?: boolean;
}

export const ANTHROPIC_RETRY_DEFAULTS = Object.freeze({
  maxAttempts:  3,         // primary attempts before fallback
  baseDelayMs:  1000,      // delay before 2nd attempt
  maxDelayMs:   8000,
  jitterRatio:  0.25,
  tag:          'anthropic',
}) as Readonly<AnthropicRetryOpts>;

// ─── Per-use-case fallback policy ─────────────────────────────────────
// HAIKU → SONNET (escalate up the tier ladder).
// SONNET → OPUS (escalate further).
// OPUS → null (CEO directive · do NOT demote safety-critical to a
//              weaker model · retry the same Opus tier and accept the
//              failure if Anthropic is fully down).
export const FALLBACK_POLICY: Readonly<Record<UseCase, Model | null>> = Object.freeze({
  // Haiku tier · escalate to Sonnet on transient failure
  vocab_retry:           MODELS.SONNET,
  syntax_retry:          MODELS.SONNET,
  mesocycle_rationale:   MODELS.SONNET,
  snapshot_synthesis:    MODELS.SONNET,
  sovereign_brief:       MODELS.SONNET,
  i18n_translation:      MODELS.SONNET,
  forecast_1rm:          MODELS.SONNET,
  sport_immersion_seed:  MODELS.SONNET,
  meal_macros_lookup:    MODELS.SONNET,
  // Sonnet tier · escalate to Opus on transient failure
  kinematic_form_score:  MODELS.OPUS,
  novel_form_correction: MODELS.OPUS,
  onboarding_interview:  MODELS.OPUS,
  prehab_assignment:     MODELS.OPUS,
  // Opus tier · NO fallback · safety-critical · CEO directive
  parq_assessment:       null,
  wellbeing_escalation:  null,
  cardiac_intercept:     null,
});

export function fallbackModelFor(useCase: UseCase): Model | null {
  return FALLBACK_POLICY[useCase];
}

// ─── Error classification ─────────────────────────────────────────────
const RETRYABLE_ERRORS = new Set([
  'anthropic_timeout',
  'anthropic_fetch_failed',
  'anthropic_429',
  'anthropic_500',
  'anthropic_502',
  'anthropic_503',
  'anthropic_504',
  'anthropic_529',           // Anthropic-specific · overloaded_error
  'overloaded_error',        // body.error.type variant of 529
]);

const PERMANENT_REFUSAL_REASONS = new Set([
  'refusal',                 // newer API · stop_reason='refusal'
  'safety',                  // some older paths
]);

export interface AnthropicCallResult {
  ok:              boolean;
  status?:         number;
  error?:          string;
  detail?:         string;
  raw?:            unknown;
  body?:           unknown;
  text?:           string;
  toolInput?:      unknown;
  stop_reason?:    string;
  model?:          string;
  usage?:          unknown;
  latency_ms?:     number;
  // augmented by withAnthropicResilience
  attempts?:       number;
  fallback_used?:  boolean;
  retry_history?:  Array<{ error: string; status: number | null; latency_ms: number | null }>;
}

/**
 * Returns true when the supplied Anthropic call result represents a
 * transient failure that should be retried. False for permanent
 * failures and for successes.
 */
export function isRetryableAnthropicFailure(out: AnthropicCallResult | null | undefined): boolean {
  if (!out || out.ok) return false;

  // Refusal stop reason · permanent (same input always re-refuses)
  if (out.stop_reason && PERMANENT_REFUSAL_REASONS.has(out.stop_reason)) {
    return false;
  }

  // Explicit error tag match
  if (typeof out.error === 'string' && RETRYABLE_ERRORS.has(out.error)) return true;

  // Any 5xx + 429 status
  if (typeof out.status === 'number') {
    if (out.status === 429) return true;
    if (out.status >= 500 && out.status < 600) return true;
  }

  return false;
}

// ─── Backoff math ─────────────────────────────────────────────────────
export function anthropicBackoffDelayMs(
  attemptIndex: number,
  baseMs: number,
  maxMs: number,
  jitterRatio = 0.25,
): number {
  if (attemptIndex < 0) return 0;
  const base   = baseMs * Math.pow(2, attemptIndex);
  const capped = Math.min(base, maxMs);
  const jitter = capped * jitterRatio * Math.random();
  return Math.max(0, Math.floor(capped + jitter));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── withAnthropicResilience(primary, fallback, opts) ─────────────────
/**
 * Higher-order resilience wrapper · same contract as the Gemini-side
 * llm-resilience.js withResilience but Anthropic-specific:
 *   · classification uses isRetryableAnthropicFailure
 *   · jitter / backoff use the same exponential curve
 *   · fallback is OPTIONAL · OPUS-tier use cases pass null
 *
 * Returns the underlying AnthropicCallResult augmented with:
 *   - attempts        · primary attempts made before fallback / success
 *   - fallback_used   · true iff result came from the fallback model
 *   - retry_history   · per-attempt failure breadcrumb
 */
export async function withAnthropicResilience(
  primaryFn: () => Promise<AnthropicCallResult>,
  fallbackFn: (() => Promise<AnthropicCallResult>) | null,
  opts: Partial<AnthropicRetryOpts> = {},
): Promise<AnthropicCallResult> {
  if (typeof primaryFn !== 'function') {
    throw new Error('withAnthropicResilience · primaryFn must be a function');
  }
  const config: AnthropicRetryOpts = { ...ANTHROPIC_RETRY_DEFAULTS, ...opts };
  const tag = config.tag;

  const history: Array<{ error: string; status: number | null; latency_ms: number | null }> = [];
  let lastResult: AnthropicCallResult | null = null;
  let permanentBail = false;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const result = await primaryFn();
    if (result?.ok) {
      return {
        ...result,
        attempts: attempt + 1,
        fallback_used: false,
        retry_history: history,
      };
    }
    lastResult = result;
    history.push({
      error:      (result && result.error) || 'unknown',
      status:     (result && typeof result.status === 'number') ? result.status : null,
      latency_ms: (result && typeof result.latency_ms === 'number') ? result.latency_ms : null,
    });

    if (!isRetryableAnthropicFailure(result)) {
      console.warn(
        `[${tag}] permanent failure attempt ${attempt + 1} · ` +
        `error=${(result && result.error) || 'unknown'} status=${(result && result.status) || '?'} · ` +
        `skipping retry loop`,
      );
      permanentBail = true;
      break;
    }

    if (attempt + 1 < config.maxAttempts) {
      const delay = anthropicBackoffDelayMs(
        attempt,
        config.baseDelayMs,
        config.maxDelayMs,
        config.jitterRatio,
      );
      console.warn(
        `[${tag}] attempt ${attempt + 1}/${config.maxAttempts} retryable · ` +
        `error=${(result && result.error) || 'unknown'} status=${(result && result.status) || '?'} · ` +
        `backing off ${delay}ms`,
      );
      await sleep(delay);
    } else {
      console.warn(
        `[${tag}] attempt ${attempt + 1}/${config.maxAttempts} retryable · ` +
        `error=${(result && result.error) || 'unknown'} · primary exhausted`,
      );
    }
  }

  const eligibleForFallback =
    !!fallbackFn && (!permanentBail || config.fallbackOnPermanent === true);

  if (eligibleForFallback && fallbackFn) {
    console.warn(`[${tag}] routing to fallback after ${history.length} primary attempt(s)`);
    let fallbackResult: AnthropicCallResult;
    try {
      fallbackResult = await fallbackFn();
    } catch (err) {
      console.error(`[${tag}] fallback threw · ${err instanceof Error ? err.message : String(err)}`);
      fallbackResult = {
        ok:          false,
        error:       'anthropic_fallback_threw',
        detail:      err instanceof Error ? err.message.slice(0, 400) : null as unknown as string,
        latency_ms:  0,
      };
    }
    return {
      ...fallbackResult,
      attempts:       history.length,
      fallback_used:  true,
      retry_history:  history,
    };
  }

  // No fallback eligible · return last failure with full history
  return {
    ...(lastResult || { ok: false, error: 'anthropic_no_attempts_made' }),
    attempts:       history.length,
    fallback_used:  false,
    retry_history:  history,
  };
}
