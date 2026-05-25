// Marketing engine · daily orchestrator.
// Sequences the three agents in order, returning a structured
// summary the cron logs + the manual trigger route can show.
//
// Sequence:
//   1. Scout Engine    · ingest top-of-funnel from registered sources
//   2. Performance Analyst · batch up to BBF_ORCH_ANALYZE_BATCH 'raw' rows
//   3. Dispatcher      · batch up to BBF_ORCH_DISPATCH_BATCH 'analyzed' rows
//
// Each step runs independently · a failure in one does NOT block the
// next. If scout has zero candidates but the analyst has unprocessed
// raw rows from a previous day, step 2 still picks them up.
import { runOnce as scoutRunOnce }       from './agents/scout-engine.js';
import { runBatch as analystRunBatch }   from './agents/analyst.js';
import { runBatch as dispatcherRunBatch } from './agents/dispatcher.js';
import { logRun, newRunId }              from './telemetry.js';
import { checkSpendGate, SPEND_LIMIT_ERROR } from './spend-gate.js';

const AGENT          = 'marketing.orchestrator';
const ANALYZE_BATCH  = Number(process.env.BBF_ORCH_ANALYZE_BATCH)  || 25;
const DISPATCH_BATCH = Number(process.env.BBF_ORCH_DISPATCH_BATCH) || 25;

export async function runOrchestrator(meta = {}) {
  // One run_id threaded through scout → analyst → dispatcher so
  // bbf_agent_runs rows for a single orchestrator pass share a key.
  const runId     = newRunId('orch');
  const source    = meta.source || 'unknown';
  const startedAt = new Date().toISOString();
  const t0        = Date.now();
  console.log('[marketing/orchestrator] START source=' + source +
              ' run_id=' + runId +
              ' analyze_batch=' + ANALYZE_BATCH + ' dispatch_batch=' + DISPATCH_BATCH);

  const summary = {
    ok:         true,
    run_id:     runId,
    started_at: startedAt,
    source,
    steps:      {},
  };

  // ── Phase 1.4 · Budget kill-switch gate · BEFORE scout/analyze/dispatch ──
  // Hard-stop the entire daily pipeline if the cross-system
  // emergency_stop is set. Returns a structured summary the cron caller
  // (and HTTP route) can render as-is · also written to bbf_agent_runs
  // so the abort is auditable.
  const gateVerdict = await checkSpendGate();
  if (gateVerdict.stopped) {
    summary.ok               = false;
    summary.spend_limit_hit  = true;
    summary.gate_verdict     = gateVerdict;
    summary.error            = SPEND_LIMIT_ERROR;
    summary.duration_ms      = Date.now() - t0;
    summary.finished_at      = new Date().toISOString();
    console.warn(`[marketing/orchestrator] ABORTED · ${SPEND_LIMIT_ERROR} · reason=${gateVerdict.reason} source=${gateVerdict.source}`);
    await logRun({
      agent: AGENT, runId, source,
      startedAt: t0, finishedAt: Date.now(), ok: false,
      error: SPEND_LIMIT_ERROR,
      summary: {
        aborted_before:      'scout',
        gate_reason:         gateVerdict.reason,
        gate_source:         gateVerdict.source,
        spend_24h_usd:       gateVerdict.spend_24h_usd,
        ceiling_usd:         gateVerdict.ceiling_usd,
        call_count_24h:      gateVerdict.call_count_24h,
      },
    });
    return summary;
  }

  try {
    summary.steps.scout = await scoutRunOnce({ runId, source });
  } catch (err) {
    console.error('[marketing/orchestrator] scout threw:', err?.message);
    summary.steps.scout = { ok: false, error: 'threw', detail: err?.message };
  }

  try {
    summary.steps.analyze = await analystRunBatch({ batchSize: ANALYZE_BATCH, runId, source });
  } catch (err) {
    console.error('[marketing/orchestrator] analyst threw:', err?.message);
    summary.steps.analyze = { ok: false, error: 'threw', detail: err?.message };
  }

  try {
    summary.steps.dispatch = await dispatcherRunBatch({ batchSize: DISPATCH_BATCH, runId, source });
  } catch (err) {
    console.error('[marketing/orchestrator] dispatcher threw:', err?.message);
    summary.steps.dispatch = { ok: false, error: 'threw', detail: err?.message };
  }

  summary.duration_ms = Date.now() - t0;
  summary.finished_at = new Date().toISOString();
  summary.ok = ['scout', 'analyze', 'dispatch'].every((k) => summary.steps[k]?.ok !== false);

  console.log('[marketing/orchestrator] DONE ok=' + summary.ok +
              ' run_id=' + runId +
              ' duration_ms=' + summary.duration_ms +
              ' · scout.accepted=' + (summary.steps.scout?.accepted ?? '?') +
              ' · analyze.succeeded=' + (summary.steps.analyze?.succeeded ?? '?') +
              ' · dispatch.succeeded=' + (summary.steps.dispatch?.succeeded ?? '?'));

  // Wrapper row · one per orchestrator invocation. Step rows are written
  // by each agent so this stays a thin summary referencing the same runId.
  await logRun({
    agent: AGENT, runId, source,
    startedAt: t0, finishedAt: Date.now(), ok: summary.ok,
    error: summary.ok ? null : 'one_or_more_steps_failed',
    summary: {
      analyze_batch:  ANALYZE_BATCH,
      dispatch_batch: DISPATCH_BATCH,
      scout: {
        ok:       summary.steps.scout?.ok,
        accepted: summary.steps.scout?.accepted,
        rejected: Array.isArray(summary.steps.scout?.rejected) ? summary.steps.scout.rejected.length : null,
      },
      analyze: {
        ok:        summary.steps.analyze?.ok,
        processed: summary.steps.analyze?.processed,
        succeeded: summary.steps.analyze?.succeeded,
      },
      dispatch: {
        ok:         summary.steps.dispatch?.ok,
        dispatched: summary.steps.dispatch?.dispatched,
        succeeded:  summary.steps.dispatch?.succeeded,
      },
    },
  });

  return summary;
}

// HTTP handler · POST /api/v1/marketing/run-orchestrator (admin-gated)
// Phase 1.4 · spend-limit aborts surface as 429 SpendLimitExceeded so
// the operator's curl distinguishes "stopped" from "ran-and-failed".
export async function runOrchestratorRoute(req, res) {
  const summary = await runOrchestrator({ source: 'manual' });
  if (summary.spend_limit_hit) {
    return res.status(429).json(summary);
  }
  return res.json(summary);
}
