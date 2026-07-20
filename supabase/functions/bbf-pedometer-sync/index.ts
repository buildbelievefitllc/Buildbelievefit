// bbf-pedometer-sync — Daily pedometer / step-aggregation sync RECEIVER.
// ─────────────────────────────────────────────────────────────────────────────
// The backend landing pad for the `pedometer-sync.yml` GitHub Actions scheduler
// (daily 05:00 UTC + workflow_dispatch). That workflow POSTs here so athlete step
// / activity rollups can be refreshed server-side even when the app never opens.
//
// DETERMINISTIC — no Claude/LLM call, so this function intentionally does NOT
// route through _shared/model-router.ts (that is reserved for model callers per
// CLAUDE.md §4). The name is `bbf-pedometer-sync`, not `bbf-agentic-*`, to keep
// that distinction honest.
//
// AUTH: server/webhook only — header `X-BBF-Admin-Token` is validated (constant
// time) against the `BBF_COACH_AGENT_TOKEN` Supabase secret, the same shared-secret
// convention used by bbf-fueling-sentinel / bbf-co-coach (CLAUDE.md §5). There is
// no user-token path: this endpoint is unattended-caller only.
//
// Request:
//   GET                       → lightweight health probe (no side effects).
//   POST { action?, source? } → accept the background handshake. `action` defaults
//                               to "daily_sync"; the body is optional and tolerated
//                               empty (a bare cron ping is valid).
// Response: { ok:true, service, received, action, source, processed, at } | non-2xx { error }
//
// AGGREGATION: on POST this invokes the SECURITY DEFINER RPC
// public.bbf_aggregate_pedometer_daily(p_source) via the service-role client,
// which sweeps trailing 30-day step data from bbf_daily_biometrics into the
// per-athlete rollup ledger bbf_pedometer_daily and returns the row count.
// (Migration: 20260720000000_bbf_pedometer_daily_aggregate.sql, applied via
// apply_migration per DATABASE_SAFETY.md — `db push` is forbidden.)
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  // List every non-safelisted header a caller may send, or a browser/WebView
  // preflight fails before the request is sent. `x-bbf-admin-token` is the
  // server/webhook auth header; the rest are stamped by supabase-js callers.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Constant-time string comparison — avoids leaking the secret via response timing.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405);
  }

  // Health probe — reachable without the admin secret so the scheduler / uptime
  // checks can confirm the receiver is deployed. No state is touched.
  if (req.method === 'GET') {
    return jsonResponse({ ok: true, service: 'bbf-pedometer-sync', status: 'ready' });
  }

  // ── Auth: shared-secret gate (server/webhook only) ──
  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  if (!ADMIN) {
    // Secret not provisioned → the endpoint cannot authorize anyone. 503 (not 401)
    // so a missing-secret misconfig is distinguishable from a bad caller token.
    return jsonResponse({ error: 'config_unavailable', detail: 'Admin secret not provisioned.' }, 503);
  }
  const provided = req.headers.get('x-bbf-admin-token') ?? '';
  if (!provided || !safeEqual(provided, ADMIN)) {
    return jsonResponse({ error: 'unauthorized', detail: 'Missing or invalid X-BBF-Admin-Token.' }, 401);
  }

  // ── Parse the background handshake (body optional; a bare cron ping is valid) ──
  let body: Record<string, unknown> = {};
  const raw = await req.text();
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return jsonResponse({ error: 'invalid_json' }, 400);
    }
  }
  const action = String(body?.action ?? 'daily_sync');
  const source = String(body?.source ?? 'unknown');
  const startedAt = new Date().toISOString();

  console.log(`[bbf-pedometer-sync] handshake · action=${action} · source=${source}`);

  // ── Service-role client (RLS-bypass; the RPC is granted to service_role only).
  // SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected by the edge runtime.
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'config_unavailable', detail: 'Server identity store is unreachable.' }, 503);
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Step aggregation — sweep trailing pedometer data into the rollup ledger.
  const { data, error } = await supa.rpc('bbf_aggregate_pedometer_daily', { p_source: source });
  if (error) {
    console.error(`[bbf-pedometer-sync] aggregate failed: ${error.message}`);
    return jsonResponse({ error: 'aggregate_failed', detail: error.message }, 502);
  }
  const processed = typeof data === 'number' ? data : Number(data ?? 0);
  console.log(`[bbf-pedometer-sync] rolled up ${processed} athlete(s)`);

  return jsonResponse({
    ok: true,
    service: 'bbf-pedometer-sync',
    received: true,
    action,
    source,
    processed,
    at: startedAt,
  });
});
