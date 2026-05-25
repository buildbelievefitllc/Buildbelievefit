// Gemini wrapper · used by the Analyst (pitch writing) and Triage
// (intent classification + reply drafting). Native fetch, no SDK.
//
// Model: gemini-3.5-flash (matches the rest of the BBF stack · see
// index.js:1088, 1384, 1573). Override via GEMINI_MODEL env.
//
// THINKING DISABLED · gemini-3.x models include implicit thinking
// tokens that count against maxOutputTokens. Pitch generation hit
// a hard ~220-char ceiling regardless of token budget because the
// thinking budget consumed most of it. thinkingConfig:{thinkingBudget:0}
// turns it off so the full budget is available for visible output.
//
// MULTI-PART RESPONSES · concatenate every text part returned, not
// just parts[0] · Gemini occasionally splits long replies across
// multiple parts which would otherwise look like silent truncation.
//
// FINISH REASON · captured + returned in {finishReason} so the
// caller can distinguish natural completion (STOP) from token
// limit (MAX_TOKENS), safety filter (SAFETY), recitation, etc.

const GEMINI_API_KEY     = process.env.GEMINI_API_KEY;
const GEMINI_MODEL       = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const GEMINI_TIMEOUT_MS  = Number(process.env.GEMINI_TIMEOUT_MS) || 30_000;
const GEMINI_THINKING    = Number(process.env.GEMINI_THINKING_BUDGET ?? 0); // 0 = off

if (!GEMINI_API_KEY) {
  console.error('[marketing/gemini] WARN · GEMINI_API_KEY unset · analyst + triage will 500');
}

function endpointFor(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

export async function generate({ system, user, temperature = 0.7, maxOutputTokens = 512, responseSchema = null }) {
  const t0 = Date.now();
  if (!GEMINI_API_KEY) {
    return { ok: false, error: 'gemini_key_missing', provider: 'gemini', model: GEMINI_MODEL, latency_ms: 0 };
  }

  const generationConfig = {
    temperature,
    maxOutputTokens,
    thinkingConfig: { thinkingBudget: GEMINI_THINKING }, // 0 by default · pure output
    ...(responseSchema ? { responseMimeType: 'application/json', responseSchema } : {}),
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
    res = await fetch(`${endpointFor(GEMINI_MODEL)}?key=${encodeURIComponent(GEMINI_API_KEY)}`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    if (err?.name === 'AbortError') {
      return { ok: false, error: 'gemini_timeout', provider: 'gemini', model: GEMINI_MODEL, latency_ms };
    }
    return { ok: false, error: 'gemini_fetch_failed', detail: err?.message, provider: 'gemini', model: GEMINI_MODEL, latency_ms };
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error(`[marketing/gemini] status=${res.status} body=${detail.slice(0, 400)}`);
    return {
      ok: false,
      error: `gemini_${res.status}`,
      detail: detail.slice(0, 400),
      status: res.status,
      provider: 'gemini',
      model: GEMINI_MODEL,
      latency_ms: Date.now() - t0,
    };
  }

  const payload      = await res.json().catch(() => null);
  const candidate    = payload?.candidates?.[0];
  const finishReason = candidate?.finishReason || null;
  const parts        = candidate?.content?.parts || [];
  // usageMetadata is Gemini's official token accounting · prefer it.
  const usage         = payload?.usageMetadata || {};
  const inputTokens   = Number.isFinite(usage.promptTokenCount)     ? usage.promptTokenCount     : null;
  const outputTokens  = Number.isFinite(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null;

  // Concatenate EVERY text part · Gemini occasionally splits long
  // replies across multiple parts which would look like truncation.
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
      model:       GEMINI_MODEL,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      latency_ms,
    };
  }

  // Surface MAX_TOKENS even on apparent success so the caller can
  // detect mid-sentence cutoffs and decide whether to widen the budget.
  if (finishReason === 'MAX_TOKENS') {
    console.warn(`[marketing/gemini] finishReason=MAX_TOKENS · output may be truncated · chars=${text.length}`);
  }

  return {
    ok: true,
    text,
    finishReason,
    provider:      'gemini',
    model:         GEMINI_MODEL,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    latency_ms,
  };
}

export function extractJSON(text) {
  if (!text) return null;
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { return null; }
}

export const MODEL_NAME = GEMINI_MODEL;
