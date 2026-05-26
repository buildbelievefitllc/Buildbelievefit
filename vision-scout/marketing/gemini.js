// Gemini wrapper · used by the Analyst (pitch writing) and Triage
// (intent classification + reply drafting). Native fetch, no SDK.
//
// PRIMARY MODEL · gemini-3.5-flash (matches the rest of the BBF stack ·
// see index.js:1088, 1384, 1573). Override via GEMINI_MODEL env.
//
// FALLBACK MODEL · gemini-3.5-pro (default · ~16× pricier per 1K tokens
// but materially more reliable under load · only invoked when the
// primary exhausts its retry budget on retryable errors). Override via
// GEMINI_FALLBACK_MODEL env. The fallback uses an IDENTICAL request
// body (system, user, temperature, topP, topK, seed, maxOutputTokens,
// responseSchema, thinkingConfig) so byte-compatibility with downstream
// data tables is preserved · the caller can't tell the result came from
// pro vs flash from the result shape alone (only via `fallback_used`).
//
// THINKING DISABLED · gemini-3.x models include implicit thinking
// tokens that count against maxOutputTokens. thinkingConfig:{thinkingBudget:0}
// turns it off so the full budget is available for visible output.
//
// MULTI-PART RESPONSES · concatenate every text part returned, not
// just parts[0] · Gemini occasionally splits long replies across
// multiple parts which would otherwise look like silent truncation.
//
// FINISH REASON · captured + returned in {finishReason} so the caller
// can distinguish natural completion (STOP) from token limit
// (MAX_TOKENS), safety filter (SAFETY), recitation, etc.
//
// RESILIENCE (Phase 6.0e) · the public `generate()` wraps the underlying
// single-shot `_generateOnce()` with `withResilience` from
// llm-resilience.js · transient failures (429 / 5xx / timeout / network)
// retry up to 3× with exponential backoff (1s → 2s → 4s + jitter), then
// fall back to GEMINI_FALLBACK_MODEL once. Permanent failures (400 /
// auth / safety blocks) skip the retry loop and return immediately.

import { withResilience } from './llm-resilience.js';

const GEMINI_API_KEY        = process.env.GEMINI_API_KEY;
const GEMINI_MODEL          = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-pro';
const GEMINI_TIMEOUT_MS     = Number(process.env.GEMINI_TIMEOUT_MS) || 30_000;
const GEMINI_THINKING       = Number(process.env.GEMINI_THINKING_BUDGET ?? 0); // 0 = off

// Phase 6.0e resilience defaults · overridable per call via opts.retry.
const RETRY_MAX_ATTEMPTS = Number(process.env.GEMINI_RETRY_MAX_ATTEMPTS) || 3;
const RETRY_BASE_DELAY   = Number(process.env.GEMINI_RETRY_BASE_DELAY_MS) || 1000;
const RETRY_MAX_DELAY    = Number(process.env.GEMINI_RETRY_MAX_DELAY_MS)  || 8000;

if (!GEMINI_API_KEY) {
  console.error('[marketing/gemini] WARN · GEMINI_API_KEY unset · analyst + triage will 500');
}

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

// ─── Private · single-shot Gemini call ───────────────────────────────
// Same logic as the pre-6.0e `generate()` body · now parameterised by
// `modelName` so the resilience layer can swap primary / fallback. All
// hyperparameter plumbing (Phase 6.0d) and responseSchema enforcement
// (Phase 6.0c) preserved verbatim · the only externally-visible delta
// is the `provider` and `model` fields in the returned object reflect
// which Gemini SKU actually answered.
async function _generateOnce(modelName, {
  system,
  user,
  temperature     = 0.7,
  maxOutputTokens = 512,
  responseSchema  = null,
  topP            = null,
  topK            = null,
  seed            = null,
}) {
  const t0 = Date.now();
  if (!GEMINI_API_KEY) {
    return { ok: false, error: 'gemini_key_missing', provider: 'gemini', model: modelName, latency_ms: 0 };
  }

  const generationConfig = {
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: GEMINI_THINKING }, // 0 by default · pure output
    ...(responseSchema ? { responseMimeType: 'application/json', responseSchema } : {}),
    // Phase 6.0d · only forward determinism levers when the caller set them
    // explicitly. null = "leave Gemini's default in place" so we don't
    // accidentally lock down unrelated callers.
    ...(topP !== null && Number.isFinite(topP) ? { topP } : {}),
    ...(topK !== null && Number.isFinite(topK) ? { topK } : {}),
    ...(seed !== null && Number.isFinite(seed) ? { seed } : {}),
  };

  const body = {
    system_instruction: { parts: [{ text: system }] },
    contents:           [{ role: 'user', parts: [{ text: user }] }],
    generationConfig,
  };

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(`${endpointFor(modelName)}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'gemini_timeout', provider: 'gemini', model: modelName, latency_ms };
    }
    return { ok: false, error: 'gemini_fetch_failed', detail: err?.message, provider: 'gemini', model: modelName, latency_ms };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[marketing/gemini] model=${modelName} status=${res.status} body=${detail.slice(0, 400)}`);
    return {
      ok: false,
      error: `gemini_${res.status}`,
      detail: detail.slice(0, 400),
      status: res.status,
      provider: 'gemini',
      model: modelName,
      latency_ms: Date.now() - t0,
    };
  }

  const payload      = await res.json().catch(() => null);
  const candidate    = payload?.candidates?.[0];
  const finishReason = candidate?.finishReason || null;
  const parts        = candidate?.content?.parts || [];
  const usage         = payload?.usageMetadata || {};
  const inputTokens   = Number.isFinite(usage.promptTokenCount)     ? usage.promptTokenCount     : null;
  const outputTokens  = Number.isFinite(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null;

  const text = parts
    .filter((p) => p && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();

  const latency_ms = Date.now() - t0;

  if (!text) {
    return {
      ok:          false,
      error:       'gemini_no_text',
      finishReason,
      detail:      JSON.stringify(payload).slice(0, 400),
      provider:    'gemini',
      model:       modelName,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      latency_ms,
    };
  }

  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[marketing/gemini] model=${modelName} finishReason=MAX_TOKENS · output may be truncated · chars=${text.length}`);
  }

  return {
    ok: true,
    text,
    finishReason,
    provider:      'gemini',
    model:         modelName,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    latency_ms,
  };
}

// ─── Public · resilient Gemini call ──────────────────────────────────
// Wraps `_generateOnce(PRIMARY)` in `withResilience` so transient errors
// retry with backoff, then fall back to `_generateOnce(FALLBACK)` once.
// Returns the same shape as `_generateOnce` plus three new fields:
//   - attempts        · primary attempts made
//   - fallback_used   · true iff the result came from the fallback model
//   - retry_history   · [{ error, status, latency_ms }] for failed primary attempts
//
// Callers can tally these into bbf_agent_runs.summary for drift detection
// without needing a schema change on bbf_llm_calls.
export async function generate(opts = {}) {
  const tag = opts.tag || 'gemini';
  return withResilience(
    () => _generateOnce(GEMINI_MODEL, opts),
    () => _generateOnce(GEMINI_FALLBACK_MODEL, opts),
    {
      tag,
      maxAttempts:        RETRY_MAX_ATTEMPTS,
      baseDelayMs:        RETRY_BASE_DELAY,
      maxDelayMs:         RETRY_MAX_DELAY,
      fallbackOnPermanent: false,
    }
  );
}

// ─── Public · single-shot (no resilience) ────────────────────────────
// Escape hatch for callers that need bare metal (e.g. one-shot diagnostic
// probes, /health endpoint test calls) where retry latency would mask
// the very signal the operator is probing for. Most production code
// should use `generate()` above.
export async function generateOnce(opts = {}) {
  return _generateOnce(GEMINI_MODEL, opts);
}

export function extractJSON(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { return null; }
}

export const MODEL_NAME          = GEMINI_MODEL;
export const FALLBACK_MODEL_NAME = GEMINI_FALLBACK_MODEL;
