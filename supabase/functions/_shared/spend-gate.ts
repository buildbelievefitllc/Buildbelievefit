// supabase/functions/_shared/spend-gate.ts · Phase 1.4
// ─────────────────────────────────────────────────────────────────────
// Budget kill-switch gate. Every agentic edge function imports
// `requireBudgetAvailable(supabaseUrl, serviceRoleKey)` and calls it
// at the top of its serve() handler. If the global emergency_stop
// flag is set, returns a `{ stopped: true, ... }` shape and the
// caller surfaces it as HTTP 429 SpendLimitExceeded.
//
// FAIL-CLOSED POLICY · if the config read errors (DB blip, RLS
// misconfiguration, missing service role), treat that as stopped.
// The cost of one falsely-blocked agent run is trivial; the cost
// of an undetected runaway spend cycle is a $200 night.
//
// IDEMPOTENT REFRESH · the gate ALSO triggers a fresh
// bbf_check_daily_spend() RPC call BEFORE reading the flag · this
// is mid-day defense-in-depth: the daily 00:05 UTC cron job is
// the floor, not the ceiling. A runaway loop that starts at 14:00
// UTC won't wait until 00:05 next day to be caught.
//
// The RPC is cheap: one indexed sum() over the last 24h slice of
// bbf_llm_calls (a tiny table). p99 latency observed ~5ms on a
// freshly-seeded test set.

export interface SpendGateVerdict {
  stopped:           boolean;
  reason:            string | null;
  spend_24h_usd:     number | null;
  ceiling_usd:       number | null;
  call_count_24h:    number | null;
  checked_at:        string | null;
  source:            'config_read' | 'rpc_refresh' | 'fail_closed';
}

// CORS shape matches the rest of the agentic-* edge functions so
// the gate's 429 response surfaces correctly to browser callers.
const GATE_CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};

async function rpcCheckDailySpend(supabaseUrl: string, serviceRoleKey: string): Promise<any | null> {
  try {
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_check_daily_spend`, {
      method: 'POST',
      headers: {
        'apikey':        serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: '{}',
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error(`[spend-gate] bbf_check_daily_spend rpc non-2xx status=${r.status} body=${txt.slice(0, 240)}`);
      return null;
    }
    return await r.json().catch(() => null);
  } catch (e) {
    console.error('[spend-gate] bbf_check_daily_spend rpc threw:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

async function readConfig(supabaseUrl: string, serviceRoleKey: string): Promise<any | null> {
  try {
    const r = await fetch(
      `${supabaseUrl}/rest/v1/bbf_system_config?id=eq.1&select=emergency_stop,daily_spend_ceiling_usd,emergency_stop_reason,emergency_stop_at`,
      {
        headers: {
          'apikey':        serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Accept':        'application/json',
        },
      },
    );
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      console.error(`[spend-gate] config read non-2xx status=${r.status} body=${txt.slice(0, 240)}`);
      return null;
    }
    const rows = await r.json().catch(() => null) as any[];
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (e) {
    console.error('[spend-gate] config read threw:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// Public API · returns a verdict. Caller decides what HTTP status
// to map to (this module does NOT call res.send · keeps it
// runtime-agnostic).
export async function checkSpendGate(
  supabaseUrl: string,
  serviceRoleKey: string,
  opts: { refresh?: boolean } = {},
): Promise<SpendGateVerdict> {
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      stopped: true, reason: 'spend_gate_config_missing',
      spend_24h_usd: null, ceiling_usd: null, call_count_24h: null,
      checked_at: null, source: 'fail_closed',
    };
  }

  // Defense-in-depth: refresh the flag from bbf_llm_calls before
  // reading. Cheap. Catches runaway spend started after the last
  // daily cron tick.
  let rpc = null;
  if (opts.refresh !== false) {
    rpc = await rpcCheckDailySpend(supabaseUrl, serviceRoleKey);
  }
  if (rpc && typeof rpc.currently_stopped === 'boolean') {
    return {
      stopped:        rpc.currently_stopped,
      reason:         rpc.currently_stopped
                        ? (rpc.tripped_now
                            ? `ceiling_tripped_now: $${rpc.spend_24h_usd} > $${rpc.ceiling_usd}`
                            : 'emergency_stop_already_set')
                        : null,
      spend_24h_usd:  Number(rpc.spend_24h_usd ?? 0),
      ceiling_usd:    Number(rpc.ceiling_usd  ?? 0),
      call_count_24h: Number(rpc.call_count_24h ?? 0),
      checked_at:     rpc.checked_at ?? null,
      source:         'rpc_refresh',
    };
  }

  // RPC failed · fall back to a direct config read. The flag may
  // be stale by up to one cron tick (24h) here, but it's still the
  // current authoritative value.
  const cfg = await readConfig(supabaseUrl, serviceRoleKey);
  if (!cfg) {
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

// Convenience: wraps a 429 Response with a structured body
// matching SpendLimitExceeded semantics.
export function spendLimitResponse(verdict: SpendGateVerdict): Response {
  return new Response(JSON.stringify({
    ok:    false,
    error: 'SpendLimitExceeded',
    detail: verdict.reason,
    spend_24h_usd:  verdict.spend_24h_usd,
    ceiling_usd:    verdict.ceiling_usd,
    call_count_24h: verdict.call_count_24h,
    checked_at:     verdict.checked_at,
    gate_source:    verdict.source,
  }), {
    status: 429,
    headers: { ...GATE_CORS, 'Content-Type': 'application/json' },
  });
}
