// supabase/functions/bbf-convai-session/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-convai-session — PRODUCT 2 · LIVE MINDSET & ACCOUNTABILITY COACH, the
// CONNECTION GATEWAY (blueprint c509f26 §3.4). THE MINT IS THE PAYWALL:
//
//   1. GATE    requireEntitlement('mindset_live') — fail-closed, Apex band.
//   2. METER   bbf_voice_session_precheck — the SAME monthly ledger every live
//              voice surface draws down (Autonomous 150k / Apex 750k / God ∞).
//   3. BRIEF   dynamic variables packaged server-side (name, streak, readiness,
//              the LAST session's commitments → the accountability loop).
//   4. TOKEN   ElevenLabs Agents platform (Conversational AI 2.0):
//                · WebRTC conversation token (primary — echo cancellation,
//                  noise removal, ~75ms eleven_flash_v2_5 TTS), and
//                · signed WebSocket URL (fallback transport).
//   5. LEDGER  bbf_convai_sessions row status='minted'; the post-call webhook
//              (bbf-convai-postcall) settles duration + token drawdown.
//
// The client NEVER holds the ElevenLabs API key; the agent id lives in
// bbf_app_config.convai_agent_id (server-side only). Tokens are short-TTL,
// single-conversation.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';
import { localeCode } from '../_shared/locale.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-vault-token, x-bbf-admin-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const FN = 'bbf-convai-session';
const MODES = new Set(['mindset', 'nutrition_audit', 'checkin']);
const TOKEN_TTL_S = 900;            // ElevenLabs signed URLs / tokens: 15-min start window
const EST_TOKENS_PER_MIN = 2400;    // metering estimate the precheck guards against
const UI_SESSION_CAP_MIN = 8;

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}
const num = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function callRpc(url: string, key: string, fn: string, args: Record<string, unknown>): Promise<any> {
  try {
    const r = await fetch(`${url}/rest/v1/rpc/${fn}`, { method: 'POST', headers: pgHeaders(key), body: JSON.stringify(args) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch { return null; }
}
async function readConfig(url: string, key: string, name: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value || '') : null;
  } catch { return null; }
}

// ── Dynamic-variable brief — the agent's server-packaged context ───────────────
async function buildDynamicVariables(url: string, key: string, userId: string, uid: string | null, mode: string, locale: string, sessionId: string) {
  const vars: Record<string, string | number | boolean> = {
    bbf_session_id: sessionId,
    bbf_uid: uid ?? '',
    mode,
    locale,
    client_name: uid ?? 'athlete',
    readiness_score: '',
    streak_days: '',
    last_commitments: '[]',
  };
  try {
    const today = new Date().toISOString().slice(0, 10);
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}&date=eq.${today}&select=readiness_score&limit=1`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? await r.json().catch(() => []) : [];
    const score = rows[0] ? num(rows[0].readiness_score) : null;
    if (score !== null) vars.readiness_score = score;
  } catch { /* readiness is best-effort context */ }
  try {
    // Streak = consecutive protocol days, capped at 30 for the prompt (cheap derivation).
    const r = await fetch(
      `${url}/rest/v1/bbf_daily_protocols?athlete_id=eq.${encodeURIComponent(userId)}&select=date&order=date.desc&limit=30`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? await r.json().catch(() => []) : [];
    let streak = 0;
    const oneDay = 86400000;
    let expect = new Date().setUTCHours(0, 0, 0, 0);
    for (const row of rows) {
      const d = Date.parse(row.date);
      if (!Number.isFinite(d)) break;
      if (Math.abs(d - expect) <= oneDay / 2) { streak += 1; expect -= oneDay; }
      else if (streak === 0 && Math.abs(d - (expect - oneDay)) <= oneDay / 2) { streak = 1; expect = d - oneDay; }
      else break;
    }
    vars.streak_days = streak;
  } catch { /* streak is best-effort context */ }
  try {
    // THE ACCOUNTABILITY LOOP — surface the last completed session's commitments.
    const r = await fetch(
      `${url}/rest/v1/bbf_convai_sessions?user_id=eq.${encodeURIComponent(userId)}&status=eq.completed&select=commitments,completed_at&order=completed_at.desc&limit=1`,
      { headers: pgHeaders(key) },
    );
    const rows: any[] = r.ok ? await r.json().catch(() => []) : [];
    const commitments = rows[0]?.commitments;
    if (Array.isArray(commitments) && commitments.length) {
      vars.last_commitments = JSON.stringify(commitments.slice(0, 5)).slice(0, 1200);
    }
  } catch { /* memory is best-effort context */ }
  return vars;
}

// ── ElevenLabs Agents platform token mints ─────────────────────────────────────
async function mintWebrtcToken(apiKey: string, agentId: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': apiKey } },
    );
    if (!r.ok) { console.error(`[${FN}] webrtc token ${r.status}`); return null; }
    const j = await r.json().catch(() => null);
    return typeof j?.token === 'string' && j.token ? j.token : null;
  } catch (e) {
    console.error(`[${FN}] webrtc token failed:`, (e as Error).message);
    return null;
  }
}
async function mintSignedWsUrl(apiKey: string, agentId: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
      { headers: { 'xi-api-key': apiKey } },
    );
    if (!r.ok) { console.error(`[${FN}] signed url ${r.status}`); return null; }
    const j = await r.json().catch(() => null);
    return typeof j?.signed_url === 'string' && j.signed_url ? j.signed_url : null;
  } catch (e) {
    console.error(`[${FN}] signed url failed:`, (e as Error).message);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  // ── ADMIN DIAGNOSTIC · { action: 'agent_audit' } ─────────────────────────────
  // Read-only ConvAI ↔ Akeem-clone sync probe: reports whether the live agent
  // (bbf_app_config.convai_agent_id) speaks with Coach Akeem's clone voice
  // (the soundboard/bake standard ZbKDEqxkr8Ub4psNm5XD). Never mutates the
  // agent, never returns secrets, never touches the paid mint path below.
  // X-BBF-Admin-Token gated (Command Center posture, fail-closed).
  if (payload?.action === 'agent_audit') {
    const AKEEM_CLONE_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';
    const expectedAdmin = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
    const sentAdmin = req.headers.get('x-bbf-admin-token') ?? '';
    if (!expectedAdmin || sentAdmin !== expectedAdmin) return jsonResponse({ error: 'unauthorized' }, 401);
    if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'agent_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
    const auditAgentId = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_agent_id');
    if (!auditAgentId) return jsonResponse({ error: 'agent_unconfigured', detail: 'convai_agent_id is not set in bbf_app_config.' }, 503);
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(auditAgentId)}`,
        { headers: { 'xi-api-key': ELEVENLABS_API_KEY } },
      );
      const text = await r.text();
      if (!r.ok) return jsonResponse({ error: 'agent_read_failed', detail: `elevenlabs ${r.status}` }, 502);
      const agent = JSON.parse(text);
      // Defensive plucks + a full-document sweep for every voice_id, so a
      // nested per-language override can never hide from the audit.
      const cc = agent?.conversation_config ?? {};
      const voiceIds = [...new Set([...text.matchAll(/"voice_id"\s*:\s*"([^"]+)"/g)].map((m) => m[1] as string))];
      const primaryVoice = String(cc?.tts?.voice_id ?? '');
      const locked = (primaryVoice === AKEEM_CLONE_VOICE_ID) ||
        (voiceIds.length > 0 && voiceIds.every((v) => v === AKEEM_CLONE_VOICE_ID));
      console.log(`[${FN}] agent_audit agent=${auditAgentId} voices=${voiceIds.join(',')} locked=${locked}`);
      return jsonResponse({
        ok: true,
        agent_id: auditAgentId,
        agent_name: String(agent?.name ?? ''),
        language: String(cc?.agent?.language ?? ''),
        tts_model: String(cc?.tts?.model_id ?? ''),
        voice_ids: voiceIds,
        akeem_clone_voice_id: AKEEM_CLONE_VOICE_ID,
        akeem_clone_locked: locked,
      });
    } catch (e) {
      return jsonResponse({ error: 'agent_read_failed', detail: String((e as Error)?.message ?? e).slice(0, 160) }, 502);
    }
  }

  // 1 · THE FAIL-CLOSED APEX GATE — an unauthenticated/underspending client
  // never reaches a paid token mint.
  const vaultToken = payload?.vault_token ?? req.headers.get('x-bbf-vault-token');
  const gate = await requireEntitlement({ supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY, vaultToken, feature: 'mindset_live' });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);
  const userId = gate.ctx.user_id;
  const uid = gate.ctx.uid;

  const mode = MODES.has(String(payload?.mode || '')) ? String(payload.mode) : 'mindset';
  const locale = localeCode(payload?.locale ?? payload?.lang);

  // 2 · METER — validate the athlete has live-voice budget BEFORE minting.
  // The precheck rejects on band ineligibility or an exhausted monthly ceiling
  // (bbf_voice_token_ledger); the estimated session cost frames the check.
  const pre = await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_precheck', {
    p_user_id: userId, p_estimated_tokens: EST_TOKENS_PER_MIN * UI_SESSION_CAP_MIN,
  }) ?? await callRpc(SUPABASE_URL, SERVICE_KEY, 'bbf_voice_session_precheck', { p_user_id: userId });
  if (!pre || pre.ok !== true) {
    const reason = String(pre?.reason || 'not_entitled');
    return jsonResponse(
      { error: reason, detail: reason === 'quota_exhausted' ? 'Monthly live-voice quota reached.' : 'Voice metering rejected the session.' },
      reason === 'quota_exhausted' ? 429 : 403,
    );
  }

  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'agent_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);
  const agentId = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_agent_id');
  if (!agentId) return jsonResponse({ error: 'agent_unconfigured', detail: 'convai_agent_id is not set in bbf_app_config.' }, 503);

  // 3 · SESSION ROW first (its id rides the dynamic variables so the post-call
  // webhook can settle the exact row even before the conversation id is known).
  const sessionId = crypto.randomUUID();
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bbf_convai_sessions`, {
      method: 'POST',
      headers: { ...pgHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({ id: sessionId, user_id: userId, mode, locale, status: 'minted' }),
    });
    if (!r.ok) return jsonResponse({ error: 'session_insert_failed' }, 503);
  } catch { return jsonResponse({ error: 'session_insert_failed' }, 503); }

  const dynamicVariables = await buildDynamicVariables(SUPABASE_URL, SERVICE_KEY, userId, uid, mode, locale, sessionId);

  // 4 · TOKEN MINTS — WebRTC primary, signed-WS fallback. Both short-TTL.
  const [conversationToken, signedWsUrl] = await Promise.all([
    mintWebrtcToken(ELEVENLABS_API_KEY, agentId),
    mintSignedWsUrl(ELEVENLABS_API_KEY, agentId),
  ]);
  if (!conversationToken && !signedWsUrl) {
    // Roll the minted row to failed so the ledger never shows a phantom session.
    fetch(`${SUPABASE_URL}/rest/v1/bbf_convai_sessions?id=eq.${sessionId}`, {
      method: 'PATCH', headers: { ...pgHeaders(SERVICE_KEY), Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed' }),
    }).catch(() => {});
    return jsonResponse({ error: 'token_mint_failed', detail: 'ElevenLabs did not issue a session token.' }, 502);
  }

  console.log(`[${FN}] minted uid=${uid} mode=${mode} locale=${locale} session=${sessionId} webrtc=${!!conversationToken} ws=${!!signedWsUrl}`);
  return jsonResponse({
    ok: true,
    session_id: sessionId,
    conversation_token: conversationToken,   // WebRTC transport (primary)
    signed_ws_url: signedWsUrl,              // WebSocket transport (fallback)
    dynamic_variables: dynamicVariables,
    expires_in_s: TOKEN_TTL_S,
    session_cap_min: UI_SESSION_CAP_MIN,
  });
});
