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

const ANALYZE_BATCH  = Number(process.env.BBF_ORCH_ANALYZE_BATCH)  || 25;
const DISPATCH_BATCH = Number(process.env.BBF_ORCH_DISPATCH_BATCH) || 25;

export async function runOrchestrator(meta = {}) {
  const startedAt = new Date().toISOString();
  const t0        = Date.now();
  console.log('[marketing/orchestrator] START source=' + (meta.source || 'unknown') +
              ' analyze_batch=' + ANALYZE_BATCH + ' dispatch_batch=' + DISPATCH_BATCH);

  const summary = {
    ok:         true,
    started_at: startedAt,
    source:     meta.source || 'unknown',
    steps:      {},
  };

  try {
    summary.steps.scout = await scoutRunOnce();
  } catch (err) {
    console.error('[marketing/orchestrator] scout threw:', err?.message);
    summary.steps.scout = { ok: false, error: 'threw', detail: err?.message };
  }

  try {
    summary.steps.analyze = await analystRunBatch({ batchSize: ANALYZE_BATCH });
  } catch (err) {
    console.error('[marketing/orchestrator] analyst threw:', err?.message);
    summary.steps.analyze = { ok: false, error: 'threw', detail: err?.message };
  }

  try {
    summary.steps.dispatch = await dispatcherRunBatch({ batchSize: DISPATCH_BATCH });
  } catch (err) {
    console.error('[marketing/orchestrator] dispatcher threw:', err?.message);
    summary.steps.dispatch = { ok: false, error: 'threw', detail: err?.message };
  }

  summary.duration_ms = Date.now() - t0;
  summary.finished_at = new Date().toISOString();
  summary.ok = ['scout', 'analyze', 'dispatch'].every((k) => summary.steps[k]?.ok !== false);

  console.log('[marketing/orchestrator] DONE ok=' + summary.ok +
              ' duration_ms=' + summary.duration_ms +
              ' · scout.accepted=' + (summary.steps.scout?.accepted ?? '?') +
              ' · analyze.succeeded=' + (summary.steps.analyze?.succeeded ?? '?') +
              ' · dispatch.succeeded=' + (summary.steps.dispatch?.succeeded ?? '?'));

  return summary;
}

// HTTP handler · POST /api/v1/marketing/run-orchestrator (admin-gated)
export async function runOrchestratorRoute(req, res) {
  const summary = await runOrchestrator({ source: 'manual' });
  return res.json(summary);
}
