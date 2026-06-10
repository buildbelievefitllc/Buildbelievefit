// bbf-health-sync — Google Health Connect ingestion webhook (native, no aggregator)
// ─────────────────────────────────────────────────────────────────────────────
// Catches the POST pushed by the Android wrapper after it reads local Health
// Connect data (HRV RMSSD, resting HR, total sleep minutes), normalizes the
// payload onto the canonical reading shape, and upserts it into the EXISTING
// bbf_readiness table via SECURITY DEFINER RPCs. bbf-agentic-peaking reads the
// same row for the CNS Agent Override.
//
// DETERMINISTIC — there is NO Claude/LLM call here, so this function intentionally
// does NOT route through _shared/model-router.ts (that is reserved for model
// callers per CLAUDE.md §4). Same distinction as bbf-wearable-ingest.
//
// AUTH (two paths, identical model to bbf-wearable-ingest):
//   • Athlete sync  — body { session_token } → bbf_ingest_health_connect()
//   • Server/webhook — header X-BBF-Admin-Token validated against the Vault
//     secret `wearable_ingest_token` via the service_role-only RPC
//     bbf_check_ingest_token(); then body { uid } →
//     bbf_ingest_health_connect_admin().
//
// Request:  POST { session_token? , uid?, payload }
//   payload (flat):    { date, hrv_ms, resting_heart_rate, total_sleep_minutes }
//   payload (records): { date, records: { HeartRateVariabilityRmssd, RestingHeartRate, SleepSession } }
// Response: { ok:true, readiness_id, normalized, derived, cns_flags } | non-2xx { error }
//
// `cns_flags` gives the Android app instant feedback (compromised / triggers)
// using the SAME thresholds bbf-agentic-peaking enforces (HRV<35 · sleep<240).
// ─────────────────────────────────────────────────────────────────────────────

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { normalizeHealthConnect, cnsFlags } from '../_shared/health-connect-core.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
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
  if (!body?.payload || typeof body.payload !== 'object') {
    return jsonResponse({ error: 'missing_payload' }, 400);
  }

  // ── Normalize the Health Connect payload (deterministic) ──
  let reading;
  try {
    reading = normalizeHealthConnect(body.payload);
  } catch (err) {
    return jsonResponse({ error: 'invalid_payload', detail: String((err as Error)?.message || err) }, 400);
  }

  // ── Auth + ingest (athlete-token path, else admin/webhook path) ──
  let rpc;
  const adminToken = req.headers.get('x-bbf-admin-token');
  if (body?.session_token) {
    rpc = await supa.rpc('bbf_ingest_health_connect', {
      p_session_token: String(body.session_token),
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
    rpc = await supa.rpc('bbf_ingest_health_connect_admin', {
      p_uid: String(body.uid),
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
    const status = result.error === 'invalid_session' ? 401 : 400;
    return jsonResponse({ error: result.error || 'ingest_rejected' }, status);
  }

  // ── Instant CNS feedback for the Android app (same thresholds as peaking) ──
  const flags = cnsFlags(reading);
  console.log(
    `[bbf-health-sync] ingested · readiness_id=${result.readiness_id} · date=${reading.reading_date}` +
    ` · hrv=${reading.hrv_ms} rhr=${reading.resting_hr} sleep=${reading.sleep_minutes}` +
    ` · cns_compromised=${flags.compromised}`,
  );

  return jsonResponse({
    ok: true,
    readiness_id: result.readiness_id,
    normalized: {
      reading_date: reading.reading_date,
      hrv_ms: reading.hrv_ms,
      resting_hr: reading.resting_hr,
      sleep_minutes: reading.sleep_minutes,
    },
    derived: result.derived || null,
    cns_flags: flags,
  });
});
