export interface SpendGateVerdict {
  stopped:           boolean;
  reason:            string | null;
  spend_24h_usd:     number | null;
  ceiling_usd:       number | null;
  call_count_24h:    number | null;
  checked_at:        string | null;
  source:            'config_read' | 'rpc_refresh' | 'fail_closed';
}

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

export async function checkSpendGate(
  supabaseUrl: string,
  serviceRoleKey: string,
  opts: { refresh?: boolean } = {},
): Promise<SpendGateVerdict> {
  if (!supabaseUrl || !serviceRoleKey) {
    return { stopped: true, reason: 'spend_gate_config_missing', spend_24h_usd: null, ceiling_usd: null, call_count_24h: null, checked_at: null, source: 'fail_closed' };
  }

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

  const cfg = await readConfig(supabaseUrl, serviceRoleKey);
  if (!cfg) {
    return { stopped: true, reason: 'spend_gate_unreachable', spend_24h_usd: null, ceiling_usd: null, call_count_24h: null, checked_at: null, source: 'fail_closed' };
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
