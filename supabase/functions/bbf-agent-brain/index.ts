// bbf-agent-brain — Agentic Command Center · the autonomous coaching brain
// ----------------------------------------------------------------------------
// The generation core of the agent loop:
//
//   sentinels (DB trigger + nightly cron)  →  THIS FN  →  coach_action_inbox
//                                              ↑ Gemini Flash (structured JSON)
//
// Four actions, TWO auth audiences (both enforced in-function; verify_jwt off):
//   • generate — sentinel-only. Guarded by the Vault shared secret
//     (x-agent-secret === bbf_agent_webhook_secret, Phase 1.6 pattern). Fails
//     closed if the expected secret cannot be resolved.
//   • list / resolve / health — coach UI. Guarded by the bbf-admin-roster dual
//     gate: X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN, OR a validated admin
//     session token (X-BBF-Session-Token → bbf_users role admin/trainer).
//
// coach_action_inbox is RLS-sealed (no policies) — every read/write in here runs
// as service_role; the browser NEVER touches the table directly.
//
// Gemini via zero-dependency fetch (no npm boot cost on cold start). MODEL NOTE
// (deliberate deviation from the brief): gemini-1.5-flash was retired for new
// API projects in 2025 and 404s on fresh keys, so the default is
// gemini-2.5-flash (same speed/cost class). Override with the GEMINI_MODEL env
// var — one flip, no redeploy of callers. The API key travels in the
// x-goog-api-key HEADER, never the query string (keeps it out of URL logs).
// Structured output is enforced with responseMimeType + responseSchema — no
// format hallucinations to parse around.
// ----------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-bbf-admin-token, x-bbf-session-token, x-agent-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const SUPABASE_URL   = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const ADMIN_TOKEN    = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const GEMINI_MODEL   = Deno.env.get('GEMINI_MODEL') || 'gemini-2.5-flash';

// ── Service-role PostgREST helpers (bypass RLS) ─────────────────────────────
async function pgGet(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` },
  });
  if (!res.ok) throw new Error(`pg_get_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function pgRpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rpc_${res.status}:${text.slice(0, 300)}`);
  try { return text ? JSON.parse(text) : null; } catch { return text; }
}

async function pgWrite(method: 'POST' | 'PATCH', path: string, body: unknown): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`pg_${method.toLowerCase()}_${res.status}:${(await res.text()).slice(0, 200)}`);
  return res.json();
}

// ── Coach authorization (parity with bbf-admin-roster / bbf-athlete-acwr) ───
async function uidFromSession(session: string): Promise<string | null> {
  try {
    const r = await pgRpc('_bbf_uid_from_vault_token', { p_session_token: session });
    const id = typeof r === 'string' ? r : (Array.isArray(r) && r.length ? r[0] : null);
    if (id) return String(id);
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const rows = await pgGet(
      `bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}` +
      `&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length ? rows[0] : null;
    return row?.user_id ? String(row.user_id) : null;
  } catch (_) { return null; }
}

async function isCoachAuthorized(req: Request): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') ?? '';
  if (ADMIN_TOKEN && token.length > 0 && token === ADMIN_TOKEN) return true;
  const session = req.headers.get('x-bbf-session-token') ?? '';
  if (!session) return false;
  const userId = await uidFromSession(session);
  if (!userId) return false;
  try {
    const rows = await pgGet(
      `bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`,
    );
    const u = Array.isArray(rows) && rows.length ? rows[0] : null;
    if (!u) return false;
    const role = String(u.role ?? '').toLowerCase();
    const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

// ── Sentinel authorization — the Vault shared secret, fail-closed ───────────
async function isSentinelAuthorized(req: Request): Promise<{ ok: boolean; status: number; error?: string }> {
  const provided = req.headers.get('x-agent-secret') ?? '';
  let expected: string | null = null;
  try { expected = await pgRpc('bbf_agent_webhook_secret', {}); } catch (_) { expected = null; }
  if (!expected || typeof expected !== 'string' || !expected.trim()) {
    console.error('[bbf-agent-brain] cannot resolve agent webhook secret — failing closed');
    return { ok: false, status: 500, error: 'secret_unavailable' };
  }
  if (!provided || provided !== expected) {
    console.warn('[bbf-agent-brain] rejected: bad or missing x-agent-secret');
    return { ok: false, status: 401, error: 'unauthorized' };
  }
  return { ok: true, status: 200 };
}

// ── The Compact Dossier ──────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Dossier = {
  name: string;
  profileLine: string;
  acwr: { acute: number; chronic: number; ratio: number } | null;
  recentSessions: string[];
  lastLoggedAt: string | null;
};

async function compileDossier(athleteId: string): Promise<Dossier | null> {
  const users = await pgGet(
    `bbf_users?select=name,uid,sport,position,metabolic_tier,subscription_tier,block_priority` +
    `&id=eq.${encodeURIComponent(athleteId)}&deleted_at=is.null&limit=1`,
  );
  const u = Array.isArray(users) && users.length ? users[0] : null;
  if (!u) return null;

  let acwr: Dossier['acwr'] = null;
  try {
    const r = await pgRpc('bbf_compute_acwr', { p_athlete_id: athleteId });
    const row = Array.isArray(r) && r.length ? r[0] : (r && typeof r === 'object' ? r : null);
    if (row) {
      acwr = {
        acute: Number(row.acute_ewma) || 0,
        chronic: Number(row.chronic_ewma) || 0,
        ratio: Number(row.acwr) || 0,
      };
    }
  } catch (_) { /* dossier survives without the ratio */ }

  let recentSessions: string[] = [];
  let lastLoggedAt: string | null = null;
  try {
    const logs = await pgGet(
      `bbf_athlete_load_logs?select=session_timestamp,session_type,duration_minutes,srpe_intensity,load_au` +
      `&athlete_id=eq.${encodeURIComponent(athleteId)}&order=session_timestamp.desc&limit=5`,
    );
    recentSessions = (Array.isArray(logs) ? logs : []).map((l: any) =>
      `${String(l.session_timestamp).slice(0, 10)} · ${l.session_type} · ${l.duration_minutes}min @ sRPE ${l.srpe_intensity} (load ${l.load_au} AU)`,
    );
    lastLoggedAt = Array.isArray(logs) && logs.length ? String(logs[0].session_timestamp) : null;
  } catch (_) { /* dossier survives without session history */ }

  const profileBits = [u.sport, u.position, u.metabolic_tier, u.subscription_tier, u.block_priority]
    .filter(Boolean).map(String);
  return {
    name: String(u.name || u.uid || 'Athlete'),
    profileLine: profileBits.length ? profileBits.join(' · ') : 'general population client',
    acwr,
    recentSessions,
    lastLoggedAt,
  };
}

// ── Gemini Flash · structured coaching diagnostic ────────────────────────────
const GEMINI_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    insight_summary: { type: 'STRING', description: 'Clear sports-science summary of training fatigue or lack of logging.' },
    proposed_action: { type: 'STRING', description: 'Surgical physical training modification.' },
    draft_message:   { type: 'STRING', description: 'Direct, empathetic, high-accountability SMS-length message to the athlete.' },
  },
  required: ['insight_summary', 'proposed_action', 'draft_message'],
};

function buildPrompt(d: Dossier, triggerType: string, riskScore: number | null): string {
  const trigger = triggerType === 'ACWR_SPIKE'
    ? `TRIGGER: ACWR SPIKE. The athlete's acute:chronic workload ratio just hit ${riskScore ?? d.acwr?.ratio ?? 'unknown'} (>= 1.5 = elevated injury-risk zone; sweet spot is 0.8–1.3).`
    : `TRIGGER: STAGNANCY. No training log, check-in, or readiness entry for ${riskScore != null ? `${Math.round(Number(riskScore))} hours` : 'over 48 hours'} — adherence is slipping.`;
  return [
    'You are the AI performance co-coach inside Build Believe Fit, a human-optimization coaching platform.',
    'Write for the COACH (insight + action) and for the ATHLETE (draft message). Never mention AI, systems, or internal tooling.',
    '',
    trigger,
    '',
    `ATHLETE DOSSIER`,
    `Name: ${d.name}`,
    `Profile: ${d.profileLine}`,
    `Subjective ACWR (Foster sRPE): ${d.acwr ? `acute ${d.acwr.acute} AU · chronic ${d.acwr.chronic} AU · ratio ${d.acwr.ratio}` : 'no load data yet'}`,
    `Last 5 sessions:`,
    ...(d.recentSessions.length ? d.recentSessions.map((s) => `  - ${s}`) : ['  - (none logged)']),
    '',
    'Respond with the required JSON only:',
    '- insight_summary: 2-3 sentence sports-science read of what the data shows (fatigue accumulation, ramp rate, or the logging gap).',
    '- proposed_action: one surgical training modification the coach can apply this week (e.g. "Reduce CNS load 20%: cut top-set intensity to RPE 7 and drop one accessory day").',
    `- draft_message: an SMS to ${d.name.split(/\s+/)[0]} in the coach's voice — direct, empathetic, high-accountability, under 320 characters, no emojis-spam, signed "Build Believe Fit".`,
  ].join('\n');
}

async function callGemini(prompt: string): Promise<{ insight_summary: string; proposed_action: string; draft_message: string }> {
  if (!GEMINI_API_KEY) throw new Error('gemini_key_missing');
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_RESPONSE_SCHEMA,
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`gemini_${res.status}:${text.slice(0, 300)}`);
  const data = JSON.parse(text);
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error(`gemini_empty:${JSON.stringify(data?.promptFeedback ?? {}).slice(0, 200)}`);
  const parsed = JSON.parse(raw);
  const clean = (v: unknown, cap: number) => String(v ?? '').trim().slice(0, cap);
  const out = {
    insight_summary: clean(parsed.insight_summary, 2000),
    proposed_action: clean(parsed.proposed_action, 2000),
    draft_message:   clean(parsed.draft_message, 1000),
  };
  if (!out.insight_summary || !out.proposed_action || !out.draft_message) throw new Error('gemini_schema_violation');
  return out;
}

// ── Actions ──────────────────────────────────────────────────────────────────
const TRIGGER_TYPES = new Set(['ACWR_SPIKE', 'STAGNANCY_ALERT']);

async function actGenerate(body: Record<string, unknown>): Promise<Response> {
  const athleteId = String(body?.athlete_id ?? '');
  const triggerType = String(body?.trigger_type ?? '');
  const riskRaw = Number(body?.risk_score);
  const riskScore = Number.isFinite(riskRaw) ? riskRaw : null;

  if (!UUID_RE.test(athleteId)) return jsonResponse({ error: 'invalid_athlete_id' }, 400);
  if (!TRIGGER_TYPES.has(triggerType)) return jsonResponse({ error: 'invalid_trigger_type' }, 400);

  // Authoritative dedup (the sentinels also guard, but the brain is the last line):
  // one live PENDING card per athlete+type.
  const dupes = await pgGet(
    `coach_action_inbox?select=id&athlete_id=eq.${encodeURIComponent(athleteId)}` +
    `&type=eq.${encodeURIComponent(triggerType)}&status=eq.PENDING&limit=1`,
  );
  if (Array.isArray(dupes) && dupes.length) {
    return jsonResponse({ ok: true, deduped: true, existing_id: dupes[0].id });
  }

  const dossier = await compileDossier(athleteId);
  if (!dossier) return jsonResponse({ error: 'athlete_not_found' }, 404);

  console.log(`[bbf-agent-brain] (bbf-agent-brain, ${triggerType.toLowerCase()}, ${GEMINI_MODEL}) → ${athleteId}`);
  const gen = await callGemini(buildPrompt(dossier, triggerType, riskScore));

  const inserted = await pgWrite('POST', 'coach_action_inbox', [{
    athlete_id: athleteId,
    type: triggerType,
    risk_score: riskScore,
    insight_summary: gen.insight_summary,
    proposed_action: gen.proposed_action,
    draft_message: gen.draft_message,
  }]);
  const row = Array.isArray(inserted) && inserted.length ? inserted[0] : null;
  return jsonResponse({ ok: true, id: row?.id ?? null, model: GEMINI_MODEL });
}

async function actList(): Promise<Response> {
  const rows = await pgGet(
    `coach_action_inbox?select=id,athlete_id,type,status,risk_score,insight_summary,proposed_action,draft_message,created_at,` +
    `athlete:bbf_users(name,uid)&status=eq.PENDING&order=created_at.desc&limit=50`,
  );
  return jsonResponse({ ok: true, count: Array.isArray(rows) ? rows.length : 0, actions: rows ?? [] });
}

async function actResolve(body: Record<string, unknown>): Promise<Response> {
  const id = String(body?.id ?? '');
  const status = String(body?.status ?? '').toUpperCase();
  if (!UUID_RE.test(id)) return jsonResponse({ error: 'invalid_id' }, 400);
  if (status !== 'APPROVED' && status !== 'DISMISSED') return jsonResponse({ error: 'invalid_status' }, 400);
  const updated = await pgWrite('PATCH',
    `coach_action_inbox?id=eq.${encodeURIComponent(id)}&status=eq.PENDING`,
    { status, processed_at: new Date().toISOString() },
  );
  if (!Array.isArray(updated) || !updated.length) return jsonResponse({ error: 'not_found_or_processed' }, 404);
  return jsonResponse({ ok: true, id, status });
}

function actHealth(): Response {
  return jsonResponse({
    ok: true,
    gemini_key_configured: Boolean(GEMINI_API_KEY),
    model: GEMINI_MODEL,
  });
}

// ── Router ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ error: 'backend_unconfigured' }, 503);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return jsonResponse({ error: 'bad_json' }, 400); }
  const action = String(body?.action ?? 'generate');

  try {
    if (action === 'generate') {
      const gate = await isSentinelAuthorized(req);
      if (!gate.ok) return jsonResponse({ error: gate.error }, gate.status);
      return await actGenerate(body);
    }
    if (action === 'list' || action === 'resolve' || action === 'health') {
      if (!(await isCoachAuthorized(req))) return jsonResponse({ error: 'unauthorized' }, 401);
      if (action === 'list') return await actList();
      if (action === 'resolve') return await actResolve(body);
      return actHealth();
    }
    return jsonResponse({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('[bbf-agent-brain] fatal:', e);
    return jsonResponse({ error: 'server_error', detail: String(e).slice(0, 300) }, 500);
  }
});
