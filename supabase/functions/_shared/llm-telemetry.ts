// ═══════════════════════════════════════════════════════════════════════════
// supabase/functions/_shared/llm-telemetry.ts
// Phase 10 · Smart Cardio Hardening — per-call LLM observability writer.
// ───────────────────────────────────────────────────────────────────────────
// The observability backbone (migration 20260525052255) provisioned
// public.bbf_llm_calls (one row per LLM call · agent · model · latency · tokens ·
// ok/error) but no agent was wired to write to it. This is the shared, dependency-
// light face every Claude-calling edge function uses to persist one row per call.
//
// CONTRACT: best-effort. logLlmCall NEVER throws and NEVER blocks the response
// path — a telemetry miss must not affect the user-facing call. RLS on
// bbf_llm_calls is service_role-only, so pass the function's service-role client.
// ═══════════════════════════════════════════════════════════════════════════

export interface LlmCallLog {
  agent:          string;                 // e.g. 'bbf-agentic-cardio'
  model:          string | null;          // resolved/responded model id
  ok:             boolean;                // did the call return usable output?
  provider?:      string;                 // default 'anthropic'
  latencyMs?:     number | null;          // measured wall time around the fetch
  inputTokens?:   number | null;          // usage.input_tokens
  outputTokens?:  number | null;          // usage.output_tokens
  finishReason?:  string | null;          // stop_reason (e.g. 'end_turn', 'max_tokens')
  error?:         string | null;          // slug/message when ok=false
  promptName?:    string | null;
  promptVersion?: number | null;
  costUsd?:       number | null;
  runId?:         string | null;
}

// Insert one telemetry row. `supa` is a supabase-js client (service_role). When
// it's null/absent (config-missing), this is a silent no-op.
export async function logLlmCall(supa: any, c: LlmCallLog): Promise<void> {
  if (!supa) return;
  try {
    await supa.from('bbf_llm_calls').insert({
      agent:          c.agent,
      run_id:         c.runId ?? null,
      provider:       c.provider ?? 'anthropic',
      model:          c.model ?? null,
      prompt_name:    c.promptName ?? null,
      prompt_version: c.promptVersion ?? null,
      input_tokens:   c.inputTokens ?? null,
      output_tokens:  c.outputTokens ?? null,
      cost_usd:       c.costUsd ?? null,
      latency_ms:     (c.latencyMs == null ? null : Math.round(c.latencyMs)),
      finish_reason:  c.finishReason ?? null,
      ok:             c.ok,
      error:          c.error ?? null,
    });
  } catch (e) {
    // Best-effort: a telemetry write must never break the caller.
    console.warn(`[llm-telemetry] insert failed (non-fatal): ${(e as Error).message}`);
  }
}
