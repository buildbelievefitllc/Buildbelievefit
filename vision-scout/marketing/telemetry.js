// Telemetry · Phase 0.2 of the BBF Master Plan.
//
// Single source of truth for "what did the agents do, and what did the
// LLMs cost". Every marketing module (scout/analyst/dispatcher/triage/
// unsubscribe/orchestrator) calls these two helpers:
//
//   logRun({ agent, runId, source, summary, ok, error, startedAt, finishedAt })
//   logLlmCall({ agent, runId, provider, model, promptName, promptVersion,
//                inputTokens, outputTokens, latencyMs, finishReason, ok, error })
//
// PHILOSOPHY · telemetry MUST NEVER take the caller down. Every write
// is wrapped in try/catch; failure is logged to console and swallowed.
// A telemetry outage cannot cascade into an outbound-email outage.
//
// COST ESTIMATION · estimateGeminiCost() encodes the publicly-listed
// rate card for gemini-3.5-flash (~$0.075/1M input, $0.30/1M output).
// Rates are conservative · re-tune when actuals land. Returns USD.
//
// RUN ID · helper newRunId() generates a short, sortable id so a single
// orchestrator pass can correlate scout -> analyst -> dispatch rows
// without inventing a UUID library. Format: "ISO-timestamp · 6 hex".

import { randomBytes } from 'node:crypto';
import { getSb } from './db.js';

const AGENT_RUNS_TABLE = 'bbf_agent_runs';
const LLM_CALLS_TABLE  = 'bbf_llm_calls';

// Disable knob for tests / local dev that doesn't want to hit Supabase.
// Defaults to ENABLED in any environment that has the service role key.
const TELEMETRY_ENABLED = String(process.env.BBF_TELEMETRY_DISABLED || '').toLowerCase() !== 'true';

// Public rate-card snapshot for the providers we currently call. Update
// when Google or Anthropic rev pricing. Numbers in USD per 1K tokens.
// Source: https://ai.google.dev/pricing (gemini-3.5-flash) ·
// https://www.anthropic.com/pricing (claude-sonnet-4-6, claude-haiku-4-5).
const PRICE_PER_1K_TOKENS = {
  'gemini-3.5-flash':  { input: 0.000075, output: 0.0003 },
  'gemini-3.5-pro':    { input: 0.00125,  output: 0.005  },
  'claude-sonnet-4-6': { input: 0.003,    output: 0.015  },
  'claude-haiku-4-5':  { input: 0.0008,   output: 0.004  },
};

// Public · short sortable correlation id.
// Example: 20260525T193011Z-3f1a9b
export function newRunId(prefix = 'run') {
  const ts  = new Date().toISOString().replace(/[-:.]/g, '').replace(/T/, 'T').slice(0, 15) + 'Z';
  const hex = randomBytes(3).toString('hex');
  return `${prefix}-${ts}-${hex}`;
}

// Public · best-effort cost estimate. Falls back to null when the
// model isn't priced; caller stores null and the dashboard reports
// "uncosted" so we know to add the entry.
export function estimateCostUsd(model, inputTokens, outputTokens) {
  if (!model) return null;
  const rates = PRICE_PER_1K_TOKENS[String(model).toLowerCase()];
  if (!rates) return null;
  const inK  = (Number(inputTokens)  || 0) / 1000;
  const outK = (Number(outputTokens) || 0) / 1000;
  const cost = (inK * rates.input) + (outK * rates.output);
  return Number(cost.toFixed(6));
}

// Public · write one agent-run row. Returns nothing of consequence ·
// don't await this in latency-sensitive code paths.
export async function logRun({
  agent,
  runId       = null,
  source      = null,
  summary     = {},
  ok          = null,
  error       = null,
  startedAt   = null,
  finishedAt  = null,
} = {}) {
  if (!TELEMETRY_ENABLED) return;
  if (!agent) {
    console.warn('[telemetry] logRun · missing agent · skipping');
    return;
  }
  const client = getSb();
  if (!client) {
    console.warn('[telemetry] logRun · supabase client unavailable · skipping (agent=' + agent + ')');
    return;
  }
  const startedIso  = startedAt  ? new Date(startedAt).toISOString()  : new Date().toISOString();
  const finishedIso = finishedAt ? new Date(finishedAt).toISOString() : new Date().toISOString();
  const durationMs  = (startedAt && finishedAt)
    ? (new Date(finishedAt).getTime() - new Date(startedAt).getTime())
    : null;

  try {
    const { error: dbErr } = await client.from(AGENT_RUNS_TABLE).insert({
      agent,
      run_id:      runId,
      source,
      started_at:  startedIso,
      finished_at: finishedIso,
      duration_ms: durationMs,
      ok,
      error:       error ? String(error).slice(0, 1000) : null,
      summary:     summary || {},
    });
    if (dbErr) {
      console.warn('[telemetry] logRun insert failed · agent=' + agent + ' detail=' + dbErr.message);
    }
  } catch (err) {
    console.warn('[telemetry] logRun threw · agent=' + agent + ' detail=' + (err?.message || String(err)));
  }
}

// Public · write one llm-call row. Cost auto-estimated if not provided.
export async function logLlmCall({
  agent,
  runId          = null,
  provider       = null,
  model,
  promptName     = null,
  promptVersion  = null,
  inputTokens    = null,
  outputTokens   = null,
  costUsd        = null,
  latencyMs      = null,
  finishReason   = null,
  ok             = null,
  error          = null,
} = {}) {
  if (!TELEMETRY_ENABLED) return;
  if (!agent || !model) {
    console.warn('[telemetry] logLlmCall · missing agent/model · skipping');
    return;
  }
  const client = getSb();
  if (!client) {
    console.warn('[telemetry] logLlmCall · supabase client unavailable · skipping (agent=' + agent + ')');
    return;
  }
  const finalCost = (costUsd != null)
    ? Number(costUsd)
    : estimateCostUsd(model, inputTokens, outputTokens);

  try {
    const { error: dbErr } = await client.from(LLM_CALLS_TABLE).insert({
      agent,
      run_id:         runId,
      provider,
      model,
      prompt_name:    promptName,
      prompt_version: promptVersion,
      input_tokens:   inputTokens,
      output_tokens:  outputTokens,
      cost_usd:       finalCost,
      latency_ms:     latencyMs,
      finish_reason:  finishReason,
      ok,
      error:          error ? String(error).slice(0, 1000) : null,
    });
    if (dbErr) {
      console.warn('[telemetry] logLlmCall insert failed · agent=' + agent + ' detail=' + dbErr.message);
    }
  } catch (err) {
    console.warn('[telemetry] logLlmCall threw · agent=' + agent + ' detail=' + (err?.message || String(err)));
  }
}

// Public · fetch aggregated telemetry for the admin dashboard.
// hours · lookback window (default 24).
// Returns { window_hours, generated_at, agent_runs:{...}, llm_calls:{...} }.
export async function summarizeTelemetry({ hours = 24 } = {}) {
  const client = getSb();
  if (!client) return { ok: false, error: 'supabase_unconfigured' };

  const windowHours = Math.max(1, Math.min(168, Number(hours) || 24));
  const since       = new Date(Date.now() - (windowHours * 3600 * 1000)).toISOString();

  // Run rollup · grouped by agent. Two passes (count, sum) because PostgREST
  // doesn't expose GROUP BY directly · we pull rows and aggregate in-process.
  const { data: runs, error: runsErr } = await client
    .from(AGENT_RUNS_TABLE)
    .select('agent, ok, duration_ms, started_at')
    .gte('started_at', since)
    .limit(5000);
  if (runsErr) return { ok: false, error: 'agent_runs_query_failed', detail: runsErr.message };

  const runRollup = {};
  for (const r of (runs || [])) {
    const a = r.agent || '(unknown)';
    const o = runRollup[a] || (runRollup[a] = { runs: 0, ok: 0, failed: 0, avg_duration_ms: 0, _sum: 0, _n: 0 });
    o.runs += 1;
    if (r.ok === true)  o.ok     += 1;
    if (r.ok === false) o.failed += 1;
    if (Number.isFinite(r.duration_ms)) { o._sum += r.duration_ms; o._n += 1; }
  }
  for (const a of Object.keys(runRollup)) {
    const o = runRollup[a];
    o.avg_duration_ms = o._n ? Math.round(o._sum / o._n) : null;
    delete o._sum; delete o._n;
  }

  // LLM rollup · grouped by provider+model.
  const { data: calls, error: callsErr } = await client
    .from(LLM_CALLS_TABLE)
    .select('agent, provider, model, input_tokens, output_tokens, cost_usd, latency_ms, ok, ts')
    .gte('ts', since)
    .limit(10000);
  if (callsErr) return { ok: false, error: 'llm_calls_query_failed', detail: callsErr.message };

  const llmRollup = {};
  let totalCost = 0;
  for (const c of (calls || [])) {
    const key = `${c.provider || '?'}::${c.model || '?'}`;
    const o = llmRollup[key] || (llmRollup[key] = {
      provider: c.provider, model: c.model,
      calls: 0, ok: 0, failed: 0,
      input_tokens: 0, output_tokens: 0,
      cost_usd: 0, avg_latency_ms: 0, _sum: 0, _n: 0,
    });
    o.calls += 1;
    if (c.ok === true)  o.ok     += 1;
    if (c.ok === false) o.failed += 1;
    o.input_tokens  += Number(c.input_tokens)  || 0;
    o.output_tokens += Number(c.output_tokens) || 0;
    o.cost_usd      += Number(c.cost_usd)      || 0;
    if (Number.isFinite(c.latency_ms)) { o._sum += c.latency_ms; o._n += 1; }
    totalCost += Number(c.cost_usd) || 0;
  }
  for (const key of Object.keys(llmRollup)) {
    const o = llmRollup[key];
    o.avg_latency_ms = o._n ? Math.round(o._sum / o._n) : null;
    o.cost_usd       = Number(o.cost_usd.toFixed(6));
    delete o._sum; delete o._n;
  }

  return {
    ok: true,
    window_hours:  windowHours,
    generated_at:  new Date().toISOString(),
    agent_runs: {
      total:      runs?.length || 0,
      by_agent:   runRollup,
    },
    llm_calls: {
      total:      calls?.length || 0,
      total_cost_usd: Number(totalCost.toFixed(6)),
      by_model:   llmRollup,
    },
  };
}
