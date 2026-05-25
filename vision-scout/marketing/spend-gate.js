// vision-scout/marketing/spend-gate.js · Phase 1.4
// ─────────────────────────────────────────────────────────────────────
// Node-side mirror of supabase/functions/_shared/spend-gate.ts. Same
// semantics, same fail-closed posture, runs against the same
// bbf_system_config + bbf_check_daily_spend RPC.
//
// The Render-side orchestrator (marketing/orchestrator.js) calls
// `requireBudgetAvailable()` at the top of runOrchestrator() so a
// tripped kill-switch blocks scout → analyst → dispatch BEFORE any
// LLM tokens are spent.
//
// SHARED CLIENT · we reuse the marketing service-role client (db.js)
// so connection pooling stays consistent with the rest of the
// pipeline. No new credentials, no new client construction.
import { getSb } from './db.js';

export const SPEND_LIMIT_ERROR = 'SpendLimitExceeded';

// Returns { stopped, reason, spend_24h_usd, ceiling_usd, call_count_24h,
//           checked_at, source }. fail-CLOSED on any DB error.
export async function checkSpendGate({ refresh = true } = {}) {
  const sb = getSb();
  if (!sb) {
    return {
      stopped: true, reason: 'spend_gate_supabase_unavailable',
      spend_24h_usd: null, ceiling_usd: null, call_count_24h: null,
      checked_at: null, source: 'fail_closed',
    };
  }

  // Defense-in-depth refresh. The pg_cron daily tick is the floor; a
  // runaway started at 14:00 UTC should not have to wait until 00:05
  // next day for the kill-switch to trip.
  if (refresh) {
    const { data: rpc, error: rpcErr } = await sb.rpc('bbf_check_daily_spend');
    if (!rpcErr && rpc && typeof rpc.currently_stopped === 'boolean') {
      return {
        stopped:        rpc.currently_stopped,
        reason:         rpc.currently_stopped
                          ? (rpc.tripped_now
                              ? `ceiling_tripped_now: $${rpc.spend_24h_usd} > $${rpc.ceiling_usd}`
                              : 'emergency_stop_already_set')
                          : null,
        spend_24h_usd:  Number(rpc.spend_24h_usd ?? 0),
        ceiling_usd:    Number(rpc.ceiling_usd ?? 0),
        call_count_24h: Number(rpc.call_count_24h ?? 0),
        checked_at:     rpc.checked_at ?? null,
        source:         'rpc_refresh',
      };
    }
    if (rpcErr) {
      console.warn(`[marketing/spend-gate] rpc refresh failed · falling back to config read:`, rpcErr.message);
    }
  }

  // Fallback · direct config read.
  const { data: cfg, error: cfgErr } = await sb
    .from('bbf_system_config')
    .select('emergency_stop, daily_spend_ceiling_usd, emergency_stop_reason, emergency_stop_at')
    .eq('id', 1)
    .maybeSingle();
  if (cfgErr || !cfg) {
    console.warn('[marketing/spend-gate] config read failed · failing CLOSED:', cfgErr?.message);
    return {
      stopped: true, reason: 'spend_gate_unreachable',
      spend_24h_usd: null, ceiling_usd: null, call_count_24h: null,
      checked_at: null, source: 'fail_closed',
    };
  }
  return {
    stopped:        !!cfg.emergency_stop,
    reason:         cfg.emergency_stop ? (cfg.emergency_stop_reason || 'emergency_stop_set') : null,
    spend_24h_usd:  null,
    ceiling_usd:    Number(cfg.daily_spend_ceiling_usd ?? 0),
    call_count_24h: null,
    checked_at:     cfg.emergency_stop_at || null,
    source:         'config_read',
  };
}

// Convenience · throws a labelled error when the gate is tripped.
// Callers that have an HTTP response handy should prefer the
// checkSpendGate + manual 429 pattern; this throw form is for
// background loops (cron) where there is no response object.
export async function requireBudgetAvailable() {
  const verdict = await checkSpendGate();
  if (verdict.stopped) {
    const err = new Error(`${SPEND_LIMIT_ERROR}: ${verdict.reason || 'stopped'}`);
    err.code     = SPEND_LIMIT_ERROR;
    err.verdict  = verdict;
    throw err;
  }
  return verdict;
}
