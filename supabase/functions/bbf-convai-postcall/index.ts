// supabase/functions/bbf-convai-postcall/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-convai-postcall — PRODUCT 2 · post-call SETTLEMENT webhook (blueprint
// c509f26 §3.5). Receives the ElevenLabs Agents `post_call_transcription`
// webhook, HMAC-verified against bbf_app_config.convai_webhook_secret, then:
//
//   1. Locates the bbf_convai_sessions row via the bbf_session_id dynamic
//      variable the mint stamped on the conversation.
//   2. Marks it completed: duration, transcript summary, structured
//      COMMITMENTS (the agent's log_commitment tool calls / data collection) —
//      the accountability memory the NEXT mint pipes back into the agent.
//   3. Commits metering: bbf_voice_session_commit for duration-derived tokens —
//      the same ledger every live-voice surface shares (no double standard).
//   4. Wellbeing escalation: a flag_wellbeing_concern tool call (or analysis
//      flag) sets wellbeing_flag and logs through the OPUS escalation route —
//      the low-latency agent never self-diagnoses; it flags and hands off.
//
// Webhook payloads are EXTERNAL INPUT: signature-verified, never executed,
// clamped before storage.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, elevenlabs-signature',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const FN = 'bbf-convai-postcall';
const TOKENS_PER_SEC = 40;            // duration → ledger tokens (speech-rate normalization)
const SIGNATURE_TOLERANCE_S = 30 * 60; // reject stamps older than 30 min (replay guard)

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function readConfig(url: string, key: string, name: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}
async function callRpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify(args) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}

// ── HMAC verification (ElevenLabs signature header: `t=<unix>,v0=<hex>`;
// v0 = HMAC-SHA256(secret, `${t}.${rawBody}`)) — constant-time compare. ────────
async function verifySignature(secret: string, header: string | null, rawBody: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => p.trim().split('=', 2)).filter((kv) => kv.length === 2),
  ) as Record<string, string>;
  const t = num(parts.t);
  const v0 = String(parts.v0 || '').toLowerCase();
  if (t === null || !v0) return false;
  if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;

  const keyData = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', keyData, new TextEncoder().encode(`${t}.${rawBody}`));
  const expected = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== v0.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ v0.charCodeAt(i);
  return diff === 0;
}

// ── Commitment extraction — the agent's log_commitment client-tool calls, with
// the analysis data-collection block as a secondary source. Clamped hard. ──────
function extractCommitments(data: any): Array<{ text: string; due: string | null }> {
  const out: Array<{ text: string; due: string | null }> = [];
  const push = (text: unknown, due: unknown) => {
    const t = String(text ?? '').trim().slice(0, 280);
    if (t) out.push({ text: t, due: due ? String(due).slice(0, 40) : null });
  };
  const transcript = Array.isArray(data?.transcript) ? data.transcript : [];
  for (const turn of transcript) {
    const calls = Array.isArray(turn?.tool_calls) ? turn.tool_calls : [];
    for (const call of calls) {
      if (String(call?.tool_name || call?.name || '') !== 'log_commitment') continue;
      let params: any = call?.params_as_json ?? call?.params ?? call?.arguments ?? null;
      if (typeof params === 'string') { try { params = JSON.parse(params); } catch { params = null; } }
      if (params) push(params.text ?? params.commitment, params.due ?? null);
    }
  }
  const collected = data?.analysis?.data_collection_results;
  if (!out.length && collected && typeof collected === 'object') {
    const c = (collected as any).commitments?.value ?? (collected as any).commitments;
    if (typeof c === 'string' && c.trim()) push(c, null);
    if (Array.isArray(c)) c.slice(0, 5).forEach((x: unknown) => push(x, null));
  }
  return out.slice(0, 8);
}
function wellbeingFlagged(data: any): boolean {
  const transcript = Array.isArray(data?.transcript) ? data.transcript : [];
  for (const turn of transcript) {
    const calls = Array.isArray(turn?.tool_calls) ? turn.tool_calls : [];
    for (const call of calls) {
      if (String(call?.tool_name || call?.name || '') === 'flag_wellbeing_concern') return true;
    }
  }
  return false;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  const rawBody = await req.text();
  const secret = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_webhook_secret');
  if (!secret) return jsonResponse({ error: 'webhook_unconfigured' }, 503);
  if (!(await verifySignature(secret, req.headers.get('elevenlabs-signature'), rawBody))) {
    return jsonResponse({ error: 'invalid_signature' }, 401);
  }

  let payload: any;
  try { payload = JSON.parse(rawBody); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }
  if (String(payload?.type || '') !== 'post_call_transcription') {
    return jsonResponse({ ok: true, skipped: 'unhandled_type' }); // ack other event types quietly
  }
  const data = payload?.data ?? {};

  // Locate the session — the mint stamped bbf_session_id into the dynamic vars.
  const dynVars = data?.conversation_initiation_client_data?.dynamic_variables ?? {};
  const sessionId = String(dynVars?.bbf_session_id || '').trim();
  const conversationId = String(data?.conversation_id || '').trim() || null;
  if (!sessionId) return jsonResponse({ ok: true, skipped: 'no_session_ref' });

  let session: Record<string, any> | null = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/bbf_convai_sessions?id=eq.${encodeURIComponent(sessionId)}&select=id,user_id,status&limit=1`,
      { headers: pgHeaders(SERVICE_KEY) },
    );
    const rows: any[] = r.ok ? await r.json().catch(() => []) : [];
    session = rows[0] ?? null;
  } catch { session = null; }
  if (!session) return jsonResponse({ ok: true, skipped: 'unknown_session' });
  if (session.status === 'completed') return jsonResponse({ ok: true, skipped: 'already_settled' }); // idempotent replay

  const durationS = Math.max(0, Math.min(3600, num(data?.metadata?.call_duration_secs) ?? 0));
  const summary = String(data?.analysis?.transcript_summary ?? '').slice(0, 4000) || null;
  const commitments = extractCommitments(data);
  const wellbeing = wellbeingFlagged(data);
  const tokens = durationS * TOKENS_PER_SEC;

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bbf_convai_sessions?id=eq.${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { ...pgHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({
        status: 'completed', conversation_id: conversationId, duration_s: durationS,
        tokens_charged: tokens, transcript_summary: summary, commitments,
        wellbeing_flag: wellbeing, completed_at: new Date().toISOString(),
      }),
    });
    if (!r.ok) return jsonResponse({ error: 'settlement_failed' }, 503);
  } catch { return jsonResponse({ error: 'settlement_failed' }, 503); }

  // Ledger drawdown — bbf_voice_session_commit keys on the uid slug.
  if (tokens > 0) {
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/bbf_users?id=eq.${encodeURIComponent(String(session.user_id))}&select=uid&limit=1`,
        { headers: pgHeaders(SERVICE_KEY) },
      );
      const rows: any[] = r.ok ? await r.json().catch(() => []) : [];
      const uid = rows[0]?.uid;
      if (uid) await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_commit', { p_uid: uid, p_tokens: tokens });
    } catch { /* metering is settled best-effort; the session row is authoritative */ }
  }

  // Wellbeing hand-off — the OPUS escalation route owns the follow-up. The
  // routing triple is the audit trail; the flagged row is the work queue.
  if (wellbeing) {
    const model = routeAndLog(FN, 'wellbeing_escalation'); // → OPUS
    console.warn(`[${FN}] WELLBEING FLAG session=${sessionId} conversation=${conversationId} escalation_model=${model}`);
  }

  console.log(`[${FN}] settled session=${sessionId} duration_s=${durationS} tokens=${tokens} commitments=${commitments.length} wellbeing=${wellbeing}`);
  return jsonResponse({ ok: true, session_id: sessionId, duration_s: durationS, tokens_charged: tokens, commitments: commitments.length });
});
