// bbf-coach-arena — Coach Lab · Pillar 3 (Coach's Arena) edge function.
// ─────────────────────────────────────────────────────────────────────────────
// A sparring sandbox: Claude generates a randomized client case study; the founder
// submits a training/nutrition protocol; Claude returns a scored critique against
// NASM / NSCA guidelines. Admin-only (same dual-auth as bbf-coach-vault). Stateless
// — a live decision-making drill, nothing persisted.
//
// Request:  POST /functions/v1/bbf-coach-arena   { action, ...args }
//   action: 'generate'                          → { ok, case, model, usage }
//   action: 'critique'  { case, protocol }      → { ok, critique, model, usage }
// Errors: non-2xx { error: "<slug>", detail?: "..." }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { routeAndLog } from '../_shared/model-router.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-session-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ── Auth (same pattern as bbf-coach-vault / bbf-command-feed) ──────────────────
async function uidFromSession(url: string, key: string, session: string): Promise<string | null> {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(`${url}/rest/v1/rpc/_bbf_uid_from_vault_token`, { method: 'POST', headers, body: JSON.stringify({ p_token: session }) });
    if (r.ok) { const v = await r.json(); const id = typeof v === 'string' ? v : (Array.isArray(v) && v.length ? v[0] : null); if (id) return String(id); }
  } catch (_) { /* fall through */ }
  try {
    const nowISO = new Date().toISOString();
    const r = await fetch(`${url}/rest/v1/bbf_vault_sessions?select=user_id&token=eq.${encodeURIComponent(session)}&expires_at=gt.${encodeURIComponent(nowISO)}&limit=1`, { headers });
    if (r.ok) { const rows = await r.json(); const row = Array.isArray(rows) && rows.length ? rows[0] : null; return row?.user_id ? String(row.user_id) : null; }
  } catch (_) { /* ignore */ }
  return null;
}
async function isAuthorized(req: Request, url: string, key: string, legacyToken: string): Promise<boolean> {
  const token = req.headers.get('x-bbf-admin-token') || '';
  if (legacyToken && token.length > 0 && token === legacyToken) return true;
  const session = req.headers.get('x-bbf-session-token') || '';
  if (!session || !url || !key) return false;
  const userId = await uidFromSession(url, key, session);
  if (!userId) return false;
  try {
    const r = await fetch(`${url}/rest/v1/bbf_users?select=uid,role&id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!r.ok) return false;
    const rows = await r.json(); const u = Array.isArray(rows) && rows.length ? rows[0] : null; if (!u) return false;
    const role = String(u.role ?? '').toLowerCase(); const uname = String(u.uid ?? '').toLowerCase();
    return role === 'admin' || role === 'trainer' || uname === 'akeem';
  } catch (_) { return false; }
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const b of content) if (b && b.type === 'text' && typeof b.text === 'string' && b.text) return b.text;
  return null;
}
async function callClaude(model: string, system: string, user: string, schema: unknown, apiKey: string, maxTokens = 1600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, max_tokens: maxTokens, thinking: { type: 'adaptive' },
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: user }],
    }),
  });
  let body: any = null; try { body = await res.json(); } catch (_) { /* non-JSON */ }
  if (!res.ok) { const msg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`; return { ok: false as const, status: res.status, error: msg }; }
  const text = extractTextBlock(body?.content);
  if (!text) return { ok: false as const, status: 502, error: 'no_text_block' };
  let parsed: any; try { parsed = JSON.parse(text); } catch (e) { return { ok: false as const, status: 502, error: `parse_failed: ${(e as Error).message}` }; }
  return { ok: true as const, parsed, model: body.model || model, usage: body.usage || null };
}

const CASE_SCHEMA = {
  type: 'object',
  properties: {
    scenario_title: { type: 'string', description: 'Punchy case title.' },
    client_profile: {
      type: 'object',
      properties: {
        age: { type: 'integer', description: 'Client age in years.' },
        background: { type: 'string', description: 'Who they are + relevant history in 1-2 sentences.' },
        training_age: { type: 'string', description: 'Experience level (novice / intermediate / advanced + years).' },
        primary_goal: { type: 'string', description: 'The headline goal.' },
        constraints: { type: 'array', items: { type: 'string' }, description: '2-4 real-world constraints (schedule, equipment, injury history).' },
        biomechanical_limitations: { type: 'array', items: { type: 'string' }, description: '1-3 movement/joint limitations to design around.' },
      },
      required: ['age', 'background', 'training_age', 'primary_goal', 'constraints', 'biomechanical_limitations'],
      additionalProperties: false,
    },
    the_ask: { type: 'string', description: 'The specific challenge posed to the coach (what to design and why it is non-trivial).' },
  },
  required: ['scenario_title', 'client_profile', 'the_ask'],
  additionalProperties: false,
};

const CRITIQUE_SCHEMA = {
  type: 'object',
  properties: {
    accuracy_score: { type: 'integer', description: 'Overall protocol quality 0-100 (safety + specificity + goal-fit + evidence alignment).' },
    verdict: { type: 'string', description: 'One-sentence headline verdict.' },
    strengths: { type: 'array', items: { type: 'string' }, description: 'What the coach got right, specifically.' },
    gaps: { type: 'array', items: { type: 'string' }, description: 'Concrete gaps, risks, or missed considerations.' },
    science_references: { type: 'array', items: { type: 'string' }, description: 'Guideline / principle citations (NASM, NSCA, ACSM) backing the critique.' },
    next_focus: { type: 'string', description: 'The single highest-leverage thing to improve next time.' },
  },
  required: ['accuracy_score', 'verdict', 'strengths', 'gaps', 'science_references', 'next_focus'],
  additionalProperties: false,
};

const POPULATIONS = ['a youth team-sport athlete', 'a masters (50+) lifter', 'a post-rehab return-to-play client', 'a desk-bound professional', 'a general-population fat-loss client', 'a tactical / first-responder client', 'a pregnant or postpartum client', 'an adolescent in early specialization'];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const legacyToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  if (!(await isAuthorized(req, SUPABASE_URL, SERVICE_KEY, legacyToken))) {
    console.warn('[bbf-coach-arena] auth rejected');
    return jsonResponse({ error: 'unauthorized' }, 401);
  }
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);

  let payload: any; try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }
  const action = String(payload?.action || '').toLowerCase();

  if (action === 'generate') {
    const model = routeAndLog('bbf-coach-arena', 'coach_case_generate');
    const pop = POPULATIONS[Math.floor(Math.random() * POPULATIONS.length)];
    const seed = Math.random().toString(36).slice(2, 8);
    const system = [
      'You are a master strength & conditioning examiner who writes realistic client case studies to sharpen a coach\'s decision-making.',
      'Generate ONE plausible, specific case. Make the constraints and biomechanical limitations create genuine programming tension (not a softball). Keep it concise and concrete. Return ONLY JSON matching the schema.',
    ].join('\n');
    const user = `Create a fresh case study for ${pop}. Vary it from typical examples (variation seed: ${seed}). Return ONLY JSON.`;
    const r = await callClaude(model, system, user, CASE_SCHEMA, ANTHROPIC_API_KEY, 1200);
    if (!r.ok) return jsonResponse({ error: 'generate_failed', detail: r.error, status: r.status }, 502);
    return jsonResponse({ ok: true, case: r.parsed, model: r.model, usage: r.usage }, 200);
  }

  if (action === 'critique') {
    const theCase = payload?.case;
    const protocol = String(payload?.protocol || '').trim();
    if (!theCase || protocol.length < 30) {
      return jsonResponse({ error: 'bad_input', detail: 'Provide the case object and a protocol (30+ chars).' }, 400);
    }
    const model = routeAndLog('bbf-coach-arena', 'coach_protocol_critique');
    const system = [
      'You are an elite strength & conditioning examiner (NSCA CSCS, NASM-CPT/CES). Evaluate the coach\'s submitted protocol against the case AND peer-reviewed guidelines.',
      'Be direct, specific, and fair. Reward sound reasoning; flag safety issues, missed constraints, and vague prescriptions. Cite the guideline/principle behind each major point. Score 0-100 on safety + specificity + goal-fit + evidence alignment. Return ONLY JSON matching the schema.',
    ].join('\n');
    const user = 'CASE:\n```json\n' + JSON.stringify(theCase, null, 2) + '\n```\n\nCOACH PROTOCOL:\n```\n' + protocol.slice(0, 8000) + '\n```\n\nReturn ONLY JSON matching the schema.';
    const r = await callClaude(model, system, user, CRITIQUE_SCHEMA, ANTHROPIC_API_KEY, 2000);
    if (!r.ok) return jsonResponse({ error: 'critique_failed', detail: r.error, status: r.status }, 502);
    return jsonResponse({ ok: true, critique: r.parsed, model: r.model, usage: r.usage }, 200);
  }

  return jsonResponse({ error: 'unknown_action', detail: "action must be 'generate' | 'critique'." }, 400);
});
