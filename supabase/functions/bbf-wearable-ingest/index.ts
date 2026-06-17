// bbf-wearable-ingest — Wearable / ACWR ingestion engine (Brief 2)
// ─────────────────────────────────────────────────────────────────────────────
// Normalizes an incoming Whoop / Apple / Oura (or manual) payload onto the
// canonical readings shape, upserts it through a SECURITY DEFINER RPC, and
// computes the acute:chronic workload ratio (ACWR) from the athlete's trailing
// 28-day strain series.
//
// DETERMINISTIC — there is NO Claude/LLM call here, so this function intentionally
// does NOT route through _shared/model-router.ts (that is reserved for model
// callers per CLAUDE.md §4). The name is `bbf-wearable-ingest`, not `bbf-agentic-*`,
// to keep that distinction honest.
//
// AUTH (two paths):
//   • Athlete sync  — body { session_token } → bbf_ingest_wearable_reading()
//   • Server/webhook — header X-BBF-Admin-Token validated against the Vault secret
//                      `wearable_ingest_token` via the service_role-only RPC
//                      bbf_check_ingest_token(); then body { uid } →
//                      bbf_ingest_wearable_reading_admin(). No Deno.env secret —
//                      the shared secret lives in Supabase Vault, rotatable via SQL.
//
// Request:  POST { source, session_token? , uid?, payload }
// Response: { ok:true, reading_id, source, normalized, acwr } | non-2xx { error }
//
// The READ BOUNDARY for future orchestrator use is the SQL RPC
// bbf_get_wearable_readiness(session_token, as_of) — defined in the migration,
// not wired here.
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { normalizeReading, computeAcwr, SOURCES } from '../_shared/wearable-core.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // Must list EVERY non-safelisted header the caller sends, or the browser/WebView
  // preflight fails before the request is sent (FunctionsFetchError). supabase-js
  // stamps `x-client-info` (+ `x-retry-count` on postgrest retries) on every call —
  // the native app's functions.invoke() is the first real browser caller, which is
  // why this surfaced now. `x-bbf-admin-token` stays for the server/webhook path.
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-retry-count, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: 'server_misconfigured' }, 500);
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Parse + validate the request envelope ──
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: 'invalid_json' }, 400);
  }

  const source = String(body?.source || '').toLowerCase();
  if (!SOURCES.includes(source)) {
    return jsonResponse({ error: 'invalid_source', detail: `expected one of ${SOURCES.join(', ')}` }, 400);
  }
  if (!body?.payload || typeof body.payload !== 'object') {
    return jsonResponse({ error: 'missing_payload' }, 400);
  }

  // ── Normalize the raw source payload (deterministic) ──
  let reading;
  try {
    reading = normalizeReading(source, body.payload);
  } catch (err) {
    return jsonResponse({ error: 'invalid_payload', detail: String((err as Error)?.message || err) }, 400);
  }

  // ── Auth + ingest (athlete-token path, else admin/webhook path) ──
  let rpc;
  const adminToken = req.headers.get('x-bbf-admin-token');
  if (body?.session_token) {
    rpc = await supa.rpc('bbf_ingest_wearable_reading', {
      p_session_token: String(body.session_token),
      p_source: source,
      p_reading: reading,
    });
  } else if (adminToken && body?.uid) {
    // Validate the webhook header against the Vault secret (service_role-only RPC).
    const chk = await supa.rpc('bbf_check_ingest_token', { p_token: String(adminToken) });
    if (chk.error) {
      return jsonResponse({ error: 'auth_check_failed', detail: chk.error.message }, 502);
    }
    if (chk.data !== true) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
    rpc = await supa.rpc('bbf_ingest_wearable_reading_admin', {
      p_uid: String(body.uid),
      p_source: source,
      p_reading: reading,
    });
  } else {
    return jsonResponse({ error: 'unauthorized' }, 401);
  }

  if (rpc.error) {
    return jsonResponse({ error: 'ingest_failed', detail: rpc.error.message }, 502);
  }
  const result = rpc.data || {};
  if (!result.ok) {
    // Surface the RPC's own slug (invalid_session / invalid_strain / unknown_user…).
    const status = result.error === 'invalid_session' ? 401 : 400;
    return jsonResponse({ error: result.error || 'ingest_rejected' }, status);
  }

  // ── Compute ACWR from the returned trailing strain series ──
  const acwr = computeAcwr(result.series || [], { asOf: reading.reading_date });

  return jsonResponse({
    ok: true,
    reading_id: result.reading_id,
    source,
    normalized: {
      reading_date: reading.reading_date,
      readiness_score: reading.readiness_score,
      strain: reading.strain,
      resting_hr: reading.resting_hr,
      hrv_ms: reading.hrv_ms,
      active_kcal: reading.active_kcal,
      bmr: reading.bmr,
      total_kcal: reading.total_kcal,
      sleep_minutes: reading.sleep_minutes,
    },
    acwr,
  });
});
