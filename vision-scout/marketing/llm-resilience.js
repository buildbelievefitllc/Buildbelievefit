// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vision-scout/marketing/llm-resilience.js
//
// Phase 6.0e · Centralized LLM Resilience Middleware · `withResilience()`
// is a higher-order wrapper that takes any LLM call function and adds:
//   1. Retryable-vs-permanent error classification.
//   2. Exponential backoff with jitter between retry attempts.
//   3. Optional fallback to a backup model when the primary exhausts.
//   4. Augmented return shape carrying { attempts, fallback_used,
//      retry_history } so callers can tally interception telemetry into
//      bbf_agent_runs.summary without a schema migration on
//      bbf_llm_calls.
//
// CONTRACT
//   The wrapped function (primaryFn / fallbackFn) MUST return the same
//   shape as `gemini.js → _generateOnce()`: an object with at least an
//   `ok: boolean` field and (on failure) an `error: string` field and
//   optional `status: number`. The wrapper does not inspect any other
//   fields and preserves them verbatim on the way out so responseSchema
//   payloads, finishReason, token counts, etc. pass through unchanged.
//   This guarantees the operator's "100% byte-compatible with downstream
//   data tables" requirement: callers cannot tell whether the result
//   came from the primary or fallback model from the result shape alone
//   (they only know via the `fallback_used` flag).
//
// USAGE
//   import { withResilience } from '../llm-resilience.js';
//   const result = await withResilience(
//     () => _generateOnce(PRIMARY_MODEL, opts),
//     () => _generateOnce(FALLBACK_MODEL, opts),
//     { tag: 'gemini.analyst', maxAttempts: 3 }
//   );
// ═══════════════════════════════════════════════════════════════════════

// Errors that justify a retry · transient or load-related. Anything else
// (400 bad request, 401/403 auth, 404, parse failures, safety blocks) is
// permanent and skips the retry loop so we don't burn 7 seconds of
// backoff on a misconfigured request. `gemini_no_text` is handled
// separately by `isRetryableFailure` because its classification depends
// on the `finishReason` accompanying it (see Phase 6.0g calibration).
const RETRYABLE_ERRORS = new Set([
  'gemini_timeout',
  'gemini_fetch_failed',
  'gemini_429',
  'gemini_500',
  'gemini_502',
  'gemini_503',
  'gemini_504',
]);

// Phase 6.0g · `gemini_no_text` (HTTP 200 with empty `text` body) covers
// TWO distinct upstream causes with opposite remediation:
//   - finishReason ∈ { 'SAFETY', 'BLOCKLIST', 'RECITATION' } · model
//     REFUSED to emit content for this exact input · retrying burns
//     tokens for zero recovery upside · classified as PERMANENT.
//   - finishReason ∈ { null, undefined, 'OTHER' } · transient internal
//     error or unmapped finish state · retry plausibly helps · classified
//     as RETRYABLE.
//   - any other unknown finishReason value · treated as retryable by
//     default to lean toward recovery rather than silent loss.
const PERMANENT_NO_TEXT_FINISH_REASONS = new Set([
  'SAFETY',
  'BLOCKLIST',
  'RECITATION',
]);

export const RETRY_DEFAULTS = Object.freeze({
  maxAttempts:  3,        // total primary attempts before fallback
  baseDelayMs:  1000,     // delay before 2nd attempt
  maxDelayMs:   8000,     // cap for any single backoff
  jitterRatio:  0.25,     // ±25% randomized jitter
  tag:          'llm',
});

/**
 * Returns true when the supplied generate-result is a transient failure
 * that should be retried. False for permanent failures and for successes.
 *
 * Retry triggers:
 *   1. The known retryable error tag set above (timeout / 429 / 5xx).
 *   2. ANY HTTP status in the 500-599 range that wasn't enumerated, since
 *      Gemini occasionally surfaces ad-hoc 5xx codes.
 *   3. Phase 6.0g · `gemini_no_text` ONLY when the accompanying
 *      `finishReason` is NOT in `PERMANENT_NO_TEXT_FINISH_REASONS`
 *      (i.e. not a safety / blocklist / recitation refusal). Empty
 *      responses with finishReason ∈ { null, undefined, 'OTHER' } are
 *      transient internal errors and benefit from retry; safety-blocked
 *      empties always re-block on retry and waste tokens.
 */
export function isRetryableFailure(out) {
  if (!out || out.ok) return false;

  // Phase 6.0g · finishReason-aware classification for the
  // HTTP-200-with-empty-text case. Must precede the generic
  // RETRYABLE_ERRORS lookup because `gemini_no_text` is intentionally
  // NOT in that set anymore.
  if (out.error === 'gemini_no_text') {
    const fr = out.finishReason;
    if (fr && PERMANENT_NO_TEXT_FINISH_REASONS.has(fr)) return false;
    return true;
  }

  if (typeof out.error === 'string' && RETRYABLE_ERRORS.has(out.error)) return true;
  if (typeof out.status === 'number' && out.status >= 500 && out.status < 600) return true;
  return false;
}

/**
 * Exponential backoff with bounded jitter. attemptIndex starts at 0 for
 * the delay BEFORE attempt 2 (so attempt 1 -> 0ms, attempt 2 -> baseMs,
 * attempt 3 -> 2*baseMs, etc.). Capped at maxMs before jitter is added.
 */
export function backoffDelayMs(attemptIndex, baseMs, maxMs, jitterRatio = 0.25) {
  if (attemptIndex < 0) return 0;
  const base    = baseMs * Math.pow(2, attemptIndex);
  const capped  = Math.min(base, maxMs);
  const jitter  = capped * jitterRatio * Math.random();
  return Math.max(0, Math.floor(capped + jitter));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * withResilience(primaryFn, fallbackFn, opts)
 *
 * primaryFn  · () => Promise<GenerateResult>
 *              Required. The main path. Called up to opts.maxAttempts
 *              times with exponential backoff between attempts.
 *
 * fallbackFn · () => Promise<GenerateResult>
 *              Optional. When the primary exhausts (or fails permanently
 *              and the operator opted in via `fallbackOnPermanent: true`),
 *              this is called once to attempt recovery on a different
 *              model / endpoint. Default behaviour: fallback only on
 *              primary EXHAUSTION (retryable-error chain · NOT permanent
 *              errors, since a permanent error on primary is almost
 *              always permanent on fallback too).
 *
 * opts ·       { maxAttempts, baseDelayMs, maxDelayMs, jitterRatio, tag,
 *                fallbackOnPermanent }
 *
 * Returns the underlying GenerateResult shape, augmented with:
 *   - attempts        · primary attempts made before fallback or success
 *   - fallback_used   · true iff fallbackFn was invoked AND succeeded
 *                       (or its result is the final return)
 *   - retry_history   · [{ error, status, latency_ms }] · one entry per
 *                       failed primary attempt
 *
 * Side effects · console.warn per retry attempt + fallback dispatch so
 * the cron logs surface the interception live without a DB query.
 */
export async function withResilience(primaryFn, fallbackFn, opts = {}) {
  if (typeof primaryFn !== 'function') {
    throw new Error('withResilience · primaryFn must be a function');
  }
  const config = { ...RETRY_DEFAULTS, ...opts };
  const tag    = config.tag;

  const history = [];
  let lastResult = null;
  let permanentBail = false;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    const result = await primaryFn();
    if (result?.ok) {
      return { ...result, attempts: attempt + 1, fallback_used: false, retry_history: history };
    }
    lastResult = result;
    history.push({
      error:      result?.error      || 'unknown',
      status:     typeof result?.status === 'number' ? result.status : null,
      latency_ms: typeof result?.latency_ms === 'number' ? result.latency_ms : null,
    });

    if (!isRetryableFailure(result)) {
      // Permanent failure · 400 bad request / safety block / parse fail.
      // Skip the rest of the retry loop · the same input will fail again.
      console.warn(`[${tag}] permanent failure attempt ${attempt + 1} · ` +
                   `error=${result?.error || 'unknown'} status=${result?.status || '?'} · skipping retry loop`);
      permanentBail = true;
      break;
    }

    if (attempt + 1 < config.maxAttempts) {
      const delay = backoffDelayMs(attempt, config.baseDelayMs, config.maxDelayMs, config.jitterRatio);
      console.warn(`[${tag}] attempt ${attempt + 1}/${config.maxAttempts} retryable · ` +
                   `error=${result?.error || 'unknown'} status=${result?.status || '?'} · ` +
                   `backing off ${delay}ms`);
      await sleep(delay);
    } else {
      console.warn(`[${tag}] attempt ${attempt + 1}/${config.maxAttempts} retryable · ` +
                   `error=${result?.error || 'unknown'} status=${result?.status || '?'} · ` +
                   `primary exhausted`);
    }
  }

  // Primary exhausted or bailed. Try fallback if configured AND eligible.
  const eligibleForFallback = !!fallbackFn && (!permanentBail || config.fallbackOnPermanent === true);

  if (eligibleForFallback) {
    console.warn(`[${tag}] routing to fallback after ${history.length} primary attempt(s)`);
    let fallbackResult = null;
    try {
      fallbackResult = await fallbackFn();
    } catch (err) {
      console.error(`[${tag}] fallback threw · ${err?.message || String(err)}`);
      fallbackResult = {
        ok:          false,
        error:       'fallback_threw',
        detail:      err?.message ? String(err.message).slice(0, 400) : null,
        provider:    null,
        model:       null,
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

  // No fallback eligible · return the last primary result with history.
  return {
    ...(lastResult || { ok: false, error: 'no_attempts_made' }),
    attempts:       history.length,
    fallback_used:  false,
    retry_history:  history,
  };
}
