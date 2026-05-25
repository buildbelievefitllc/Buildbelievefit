// Agent 2 · The Performance Analyst · pitch generation worker.
// POST /api/v1/marketing/analyze
//   { batch_size?: 1-50, lead_id?: uuid }
//
// Pulls raw leads, generates hyper-technical pitches via gemini-3.5-flash,
// flips status to 'analyzed'. Also exposes runBatch() so the daily
// orchestrator can drive it in-process without an HTTP round-trip.
import { sb, requireSb, getSb, TABLE } from '../db.js';
import { generate, MODEL_NAME } from '../gemini.js';
import { logRun, logLlmCall, newRunId } from '../telemetry.js';

const AGENT = 'marketing.analyst';
const PROMPT_NAME    = 'marketing.analyst.system';
const PROMPT_VERSION = 1;

const DEFAULT_BATCH = 5;
const MAX_BATCH     = 50;

// CEO-mandated system prompt · verbatim from the original directive.
// Sets a hyper-technical, sports-science register; bans corporate filler.
const SYSTEM_PROMPT = [
  'You are the Lead Systems Analyst for Build Believe Fit. Critique this athlete\'s public training metrics. Write a hyper-technical, 3-sentence, zero-fluff email hook showing how the BBF Smart Cardio engine and BBF Nutrition Tracker math engine eliminate their exact performance plateaus. Speak strictly in advanced sports-science terms; ban all generic corporate marketing filler.',
].join('\n');

function buildUserPrompt(lead) {
  return [
    `Athlete:     ${lead.athlete_name}`,
    `Discipline:  ${lead.discipline         || 'unspecified'}`,
    `Profile:     ${lead.public_profile_url || 'n/a'}`,
    `Public training metrics & observed plateaus:`,
    lead.performance_notes || '(minimal data · infer from discipline)',
  ].join('\n');
}

async function analyzeOne(client, lead, runId) {
  const out = await generate({
    system:          SYSTEM_PROMPT,
    user:            buildUserPrompt(lead),
    temperature:     0.7,
    // 1024 tokens of pure output (thinking is disabled in gemini.js)
    // is plenty for a 3-sentence pitch (~80 words / ~120 tokens) plus
    // any restatement preamble.
    maxOutputTokens: 1024,
  });
  // Record the LLM call regardless of outcome · cost + latency telemetry
  // matters even (especially) on failure.
  await logLlmCall({
    agent:          AGENT,
    runId,
    provider:       out.provider || 'gemini',
    model:          out.model    || MODEL_NAME,
    promptName:     PROMPT_NAME,
    promptVersion:  PROMPT_VERSION,
    inputTokens:    out.input_tokens,
    outputTokens:   out.output_tokens,
    latencyMs:      out.latency_ms,
    finishReason:   out.finishReason,
    ok:             out.ok,
    error:          out.ok ? null : `${out.error}: ${out.detail || ''}`,
  });

  if (!out.ok) {
    await client.from(TABLE).update({ last_error: `${out.error}: ${out.detail || ''}`.slice(0, 500) }).eq('id', lead.id);
    return { id: lead.id, email: lead.email, ok: false, error: out.error };
  }
  const { error: updErr } = await client.from(TABLE).update({
    personalized_pitch: out.text,
    status:             'analyzed',
    last_error:         null,
  }).eq('id', lead.id);
  if (updErr) return { id: lead.id, email: lead.email, ok: false, error: 'db_update_failed', detail: updErr.message };
  return { id: lead.id, email: lead.email, ok: true, finishReason: out.finishReason, pitch_chars: out.text.length };
}

// runBatch · pure worker · used by both the HTTP handler and the
// orchestrator. Does not depend on a request/response pair.
//
// Telemetry · accepts an optional runId from the caller (orchestrator
// passes its own so the scout/analyze/dispatch trio share one id);
// generates a fresh id when called standalone (HTTP /analyze).
export async function runBatch({ batchSize, leadId, runId, source } = {}) {
  const startedAt = Date.now();
  const client    = getSb();
  if (!client) {
    return { ok: false, error: 'supabase_unconfigured' };
  }

  const effectiveRunId = runId || newRunId('analyst');
  const size           = Math.min(MAX_BATCH, Math.max(1, Number(batchSize) || DEFAULT_BATCH));

  let q = client.from(TABLE).select('id, athlete_name, email, discipline, public_profile_url, performance_notes');
  if (leadId) q = q.eq('id', String(leadId));
  else        q = q.eq('status', 'raw').order('created_at', { ascending: true }).limit(size);

  const { data: leads, error } = await q;
  if (error) {
    const result = { ok: false, error: 'db_fetch_failed', detail: error.message };
    await logRun({
      agent: AGENT, runId: effectiveRunId, source: source || 'standalone',
      startedAt, finishedAt: Date.now(), ok: false, error: result.detail,
      summary: { phase: 'fetch' },
    });
    return result;
  }
  if (!leads?.length) {
    const result = { ok: true, processed: 0, results: [], model: MODEL_NAME, note: 'no raw leads' };
    await logRun({
      agent: AGENT, runId: effectiveRunId, source: source || 'standalone',
      startedAt, finishedAt: Date.now(), ok: true,
      summary: { processed: 0, succeeded: 0, note: 'no_raw_leads', model: MODEL_NAME },
    });
    return result;
  }

  // Run in parallel · Gemini Flash is fast and tolerates concurrency.
  const results = await Promise.all(leads.map((l) => analyzeOne(client, l, effectiveRunId)));
  const ok      = results.filter((r) => r.ok).length;

  console.log(`[marketing/analyst] processed=${results.length} ok=${ok} model=${MODEL_NAME}`);
  await logRun({
    agent:      AGENT,
    runId:      effectiveRunId,
    source:     source || 'standalone',
    startedAt,
    finishedAt: Date.now(),
    ok:         true,
    summary:    {
      processed: results.length,
      succeeded: ok,
      failed:    results.length - ok,
      model:     MODEL_NAME,
      batch_size: size,
      lead_id:   leadId || null,
    },
  });
  return { ok: true, processed: results.length, succeeded: ok, results, model: MODEL_NAME, run_id: effectiveRunId };
}

// HTTP handler · thin wrapper around runBatch.
export async function analyze(req, res) {
  if (!requireSb(res)) return;
  const body      = req.body || {};
  const leadId    = body.lead_id ? String(body.lead_id) : null;
  const batchSize = Number(body.batch_size) || DEFAULT_BATCH;
  const summary   = await runBatch({ batchSize, leadId, source: 'http' });
  return res.json(summary);
}
