// ═══════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/anthropic-call.ts
//
// Phase 6.0j · Canonical Anthropic call helper · ties anthropic-armor
// (XML wrap + sanitize + tool_use schema enforcement) and
// anthropic-resilience (retry + per-use-case fallback) into ONE entry
// point that every bbf-agentic-* / bbf-co-coach / bbf-midnight-haiku
// edge function will adopt as it gets converted.
//
// API
//   const result = await callClaude({
//     useCase:       'sovereign_brief',
//     system:        SYSTEM_PROMPT,
//     userFields:    { bundles_json: ... },     // wrapped in <user_input>
//     toolSchema:    RESPONSE_SCHEMA,            // optional · forces tool_use
//     toolName:      'submit_co_coach_analysis', // required if toolSchema present
//     toolDescription: 'Emit the analysis...',   // optional
//     maxTokens:     8192,
//     temperature:   undefined,                  // omitted → Anthropic default
//     apiKey:        Deno.env.get('ANTHROPIC_API_KEY')!,
//     systemCacheable: true,                     // cache_control on system
//     agentTag:      'bbf-co-coach.pitch',       // for resilience log lines
//   });
//
//   if (!result.ok)     { /* handle error · result.error, retry_history */ }
//   if (result.toolInput) { /* structured output from tool_use */ }
//   if (result.text)      { /* free text · only when toolSchema absent */ }
//
// RETURN SHAPE
//   AnthropicCallResult (re-exported from anthropic-resilience.ts) with
//   the `attempts` / `fallback_used` / `retry_history` augmentation.
// ═══════════════════════════════════════════════════════════════════════

import { routeAndLog, type Model, type UseCase } from './model-router.ts';
import {
  wrapUserBlock,
  toAnthropicInputSchema,
  extractTextBlock,
  extractToolUseBlock,
  extractRefusalBlock,
} from './anthropic-armor.ts';
import {
  withAnthropicResilience,
  fallbackModelFor,
  type AnthropicCallResult,
  type AnthropicRetryOpts,
} from './anthropic-resilience.ts';

export type { AnthropicCallResult } from './anthropic-resilience.ts';

const ANTHROPIC_API_VERSION = '2023-06-01';
const ANTHROPIC_ENDPOINT    = 'https://api.anthropic.com/v1/messages';
const DEFAULT_TIMEOUT_MS    = 60_000;

/**
 * Image attachment for vision-capable use cases (kinematic_form_score,
 * novel_form_correction, etc.). Each entry produces an
 * `image` content block alongside the wrapped <user_input> text in
 * the user message · the model sees the image + the sealed text
 * together. Base64-encoded raw bytes; the helper does NOT re-encode.
 */
export interface UserImageBlock {
  mime_type: string;   // 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data:      string;   // base64 bytes (no data:URI prefix)
}

export interface CallClaudeArgs {
  useCase:           UseCase;
  system:            string;
  userFields:        Record<string, unknown>;
  /** Optional vision input · enables kinematics + comlink form-score paths. */
  userImages?:       ReadonlyArray<UserImageBlock>;
  toolSchema?:       unknown;
  toolName?:         string;
  toolDescription?:  string;
  maxTokens:         number;
  temperature?:      number;
  topP?:             number;
  topK?:             number;
  systemCacheable?:  boolean;
  agentTag:          string;
  apiKey:            string;
  // resilience knobs · defaults from ANTHROPIC_RETRY_DEFAULTS apply
  retryOpts?:        Partial<AnthropicRetryOpts>;
  // tunable timeout per call (some agents have looser SLOs)
  timeoutMs?:        number;
  // override primary/fallback model resolution (rare · escape hatch)
  modelOverride?:    Model;
  fallbackOverride?: Model | null;
}

/**
 * Single-shot Anthropic call · returns the canonical AnthropicCallResult
 * shape. NOT wrapped in resilience · use `callClaude` below for the
 * production path.
 */
async function _callClaudeOnce(
  modelName: Model,
  args: CallClaudeArgs,
): Promise<AnthropicCallResult> {
  const t0 = Date.now();

  if (!args.apiKey) {
    return {
      ok:          false,
      error:       'anthropic_key_missing',
      model:       modelName,
      latency_ms:  0,
    };
  }

  // Build the user message · always wrap user-controlled fields in the
  // sealed <user_input> shell. Optional image blocks ride alongside
  // the wrapped text so vision-capable agents (kinematics + comlink
  // form-score) get the canonical armor without losing image input.
  const wrappedUser = wrapUserBlock(args.userFields);
  const userText = args.toolSchema
    ? wrappedUser + `\n\nReturn the result by calling the ${args.toolName} tool. Do not emit prose.`
    : wrappedUser;
  const userContent: unknown = args.userImages && args.userImages.length > 0
    ? [
        ...args.userImages.map((img) => ({
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: img.mime_type, data: img.data },
        })),
        { type: 'text' as const, text: userText },
      ]
    : userText;

  // System block · optional prompt-caching wrapper.
  const systemBlock = args.systemCacheable === false
    ? [{ type: 'text', text: args.system }]
    : [{ type: 'text', text: args.system, cache_control: { type: 'ephemeral' } }];

  // Tools · only when caller wants structured output.
  const tools = args.toolSchema && args.toolName
    ? [{
        name:         args.toolName,
        description:  args.toolDescription || `Emit the response per ${args.toolName}.`,
        input_schema: toAnthropicInputSchema(args.toolSchema),
      }]
    : undefined;

  const tool_choice = tools
    ? { type: 'tool' as const, name: args.toolName! }
    : undefined;

  const requestBody: Record<string, unknown> = {
    model:      modelName,
    max_tokens: args.maxTokens,
    system:     systemBlock,
    messages:   [{ role: 'user', content: userContent }],
  };
  if (tools)                              requestBody.tools       = tools;
  if (tool_choice)                        requestBody.tool_choice = tool_choice;
  if (Number.isFinite(args.temperature))  requestBody.temperature = args.temperature;
  if (Number.isFinite(args.topP))         requestBody.top_p       = args.topP;
  if (Number.isFinite(args.topK))         requestBody.top_k       = args.topK;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_ENDPOINT, {
      method:  'POST',
      headers: {
        'x-api-key':         args.apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
        'content-type':      'application/json',
      },
      body:    JSON.stringify(requestBody),
      signal:  controller.signal,
    });
  } catch (err) {
    const latency_ms = Date.now() - t0;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    return {
      ok:          false,
      error:       isAbort ? 'anthropic_timeout' : 'anthropic_fetch_failed',
      detail:      err instanceof Error ? err.message.slice(0, 400) : null as unknown as string,
      model:       modelName,
      latency_ms,
    };
  } finally {
    clearTimeout(timer);
  }

  let body: any;
  try { body = await res.json(); } catch (_) { body = null; }

  if (!res.ok) {
    // Anthropic-specific error-shape: { error: { type, message } }
    const errType   = body?.error?.type;
    const errMsg    = body?.error?.message;
    const tag       = errType === 'overloaded_error'
      ? 'overloaded_error'
      : `anthropic_${res.status}`;
    console.error(
      `[anthropic-call] status=${res.status} type=${errType || '?'} msg=${(errMsg || '').slice(0, 200)}`,
    );
    return {
      ok:          false,
      error:       tag,
      detail:      (errMsg || '').slice(0, 400),
      status:      res.status,
      raw:         body,
      model:       modelName,
      latency_ms:  Date.now() - t0,
    };
  }

  // Success path · pick text or tool_use block depending on the call
  // shape. Also surface stop_reason + usage for telemetry.
  const stop_reason = body?.stop_reason as string | undefined;
  const usage       = body?.usage as unknown;
  const content     = body?.content;

  // Refusal block → permanent failure (handled by resilience classifier)
  const refusal = extractRefusalBlock(content);
  if (refusal) {
    return {
      ok:          false,
      error:       'anthropic_refusal',
      detail:      refusal.slice(0, 400),
      status:      res.status,
      stop_reason: stop_reason || 'refusal',
      raw:         body,
      model:       modelName,
      usage,
      latency_ms:  Date.now() - t0,
    };
  }

  if (args.toolSchema && args.toolName) {
    const toolInput = extractToolUseBlock(content, args.toolName);
    if (toolInput === null) {
      // Tool was forced but model didn't emit it · usually a
      // transient model-routing issue · treat as no_content (retryable).
      return {
        ok:          false,
        error:       'anthropic_no_tool_use',
        detail:      `expected tool_use block for ${args.toolName}`,
        status:      res.status,
        stop_reason: stop_reason || null as unknown as string,
        raw:         body,
        model:       modelName,
        usage,
        latency_ms:  Date.now() - t0,
      };
    }
    return {
      ok:          true,
      toolInput,
      status:      res.status,
      stop_reason,
      body,
      model:       (body?.model as string) || modelName,
      usage,
      latency_ms:  Date.now() - t0,
    };
  }

  const text = extractTextBlock(content);
  if (!text) {
    return {
      ok:          false,
      error:       'anthropic_no_text',
      detail:      `no text content block · stop_reason=${stop_reason || 'unknown'}`,
      status:      res.status,
      stop_reason: stop_reason || null as unknown as string,
      raw:         body,
      model:       modelName,
      usage,
      latency_ms:  Date.now() - t0,
    };
  }

  return {
    ok:          true,
    text,
    status:      res.status,
    stop_reason,
    body,
    model:       (body?.model as string) || modelName,
    usage,
    latency_ms:  Date.now() - t0,
  };
}

/**
 * Production Anthropic call · routes via model-router (logs the
 * routing decision), resolves the per-use-case fallback model, and
 * wraps the single-shot call in withAnthropicResilience.
 *
 * THIS is the function every bbf-agentic-* / bbf-co-coach edge
 * function should call. Single-shot _callClaudeOnce is exported only
 * for the bypass case (diagnostic probes that need raw latency).
 */
export async function callClaude(args: CallClaudeArgs): Promise<AnthropicCallResult> {
  const primaryModel  = args.modelOverride ?? routeAndLog(args.agentTag, args.useCase);
  const fallbackModel = args.fallbackOverride !== undefined
    ? args.fallbackOverride
    : fallbackModelFor(args.useCase);

  const primaryFn  = () => _callClaudeOnce(primaryModel, args);
  const fallbackFn = fallbackModel
    ? () => _callClaudeOnce(fallbackModel, args)
    : null;

  return withAnthropicResilience(primaryFn, fallbackFn, {
    ...args.retryOpts,
    tag: args.agentTag,
  });
}

/** Escape hatch · single-shot call without resilience wrapping. */
export async function callClaudeOnce(args: CallClaudeArgs): Promise<AnthropicCallResult> {
  const primaryModel = args.modelOverride ?? routeAndLog(args.agentTag, args.useCase);
  return _callClaudeOnce(primaryModel, args);
}
