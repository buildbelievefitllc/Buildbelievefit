// supabase/functions/bbf-convai-provision/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// bbf-convai-provision — ONE-SHOT ADMIN BOOTSTRAP for Product 2's live coach.
// Creates the ElevenLabs Agents-platform agent "BBF Sovereign Accountability
// Coach" (Coach Akeem clone, voice ZbKDEqxkr8Ub4psNm5XD) from the config-as-code
// mirror in _shared/convai-agent-config.json, then stores the returned agent id
// in bbf_app_config.convai_agent_id (server-side only — never client-side).
//
// AUTH (defense in depth — this mints a paid platform resource):
//   · X-BBF-Admin-Token === BBF_COACH_AGENT_TOKEN, OR
//   · body.bootstrap_key === bbf_app_config.convai_bootstrap_key (transient key
//     an operator sets right before triggering, then deletes).
// IDEMPOTENT: refuses to create a second agent once convai_agent_id is set,
// unless { force: true }. Also wires the post-call settlement webhook to
// bbf-convai-postcall. Returns ElevenLabs' raw status/body for observability.
//
// Zero shared imports — inlines cleanly as a single-file MCP deploy bundle.
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const FN = 'bbf-convai-provision';
const AKEEM_VOICE_ID = 'ZbKDEqxkr8Ub4psNm5XD';

function pgHeaders(key: string): HeadersInit {
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function readConfig(url: string, key: string, name: string): Promise<string | null> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?key=eq.${encodeURIComponent(name)}&select=value&limit=1`, { headers: pgHeaders(key) });
    if (!r.ok) return null;
    const rows = await r.json().catch(() => null);
    return Array.isArray(rows) && rows.length ? String(rows[0].value ?? '') : null;
  } catch { return null; }
}
async function writeConfig(url: string, key: string, name: string, value: string): Promise<boolean> {
  try {
    const r = await fetch(`${url}/rest/v1/bbf_app_config?on_conflict=key`, {
      method: 'POST',
      headers: { ...pgHeaders(key), Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key: name, value }),
    });
    return r.ok;
  } catch { return false; }
}

// The create body — a faithful projection of _shared/convai-agent-config.json onto
// the ElevenLabs POST /v1/convai/agents/create schema. Client tools are declared on
// the agent prompt so the agent can INVOKE log_commitment / flag_wellbeing_concern
// (the SDK registers the local handlers; the agent must know the tools exist).
function buildCreateBody(webhookUrl: string) {
  const SYSTEM_PROMPT =
    "You are scripting for the BBF Coach Akeem voice — an African, soulful, naturally rhythmic delivery. " +
    "A seasoned professional trainer; a father who understands chaotic schedules; a mentor dedicated to shattering " +
    "the 'box mentality.' Pitch is mid-to-deep with chest resonance, grounded and warm. Tempo is deliberate, unhurried, " +
    "with a rhythmic 'pocket.' The vibe is authentic, raw, empathetic — real aura, never corporate.\n\n" +
    "You are running a live {{mode}} accountability session with {{client_name}} (locale {{locale}}). Their current " +
    "readiness score: {{readiness_score}}. Check-in streak: {{streak_days}} days. Commitments from their LAST session: " +
    "{{last_commitments}} — open by holding them accountable to these, warmly but directly.\n\n" +
    "MINDSET mode: architect energy — resonant, story-driven, building intensity through cadence, never exclamation. " +
    "NUTRITION_AUDIT mode: lounge-talk energy — relaxed real-talk across the table, natural contractions. Keep turns " +
    "SHORT (2-4 sentences); this is a conversation, not a lecture. Ask one question at a time and actually listen.\n\n" +
    "When the client states a concrete commitment, call log_commitment. If anything suggests disordered eating, " +
    "self-harm, or acute distress, call flag_wellbeing_concern immediately and gently steer toward professional " +
    "support — you never diagnose.\n\n" +
    "Never discuss backend systems, AI models, or how you work internally (AI_DIRECTIVES §7).";

  const clientTools = [
    {
      type: 'client',
      name: 'log_commitment',
      description: 'Record a concrete commitment the client just made, in their own words.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The commitment, in the client’s own words.' },
          due: { type: 'string', description: 'When they committed to it (optional).' },
        },
        required: ['text'],
      },
    },
    {
      type: 'client',
      name: 'flag_wellbeing_concern',
      description: 'Flag the session for wellbeing escalation review (disordered eating, self-harm, acute distress).',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  ];

  return {
    name: 'BBF Sovereign Accountability Coach',
    conversation_config: {
      agent: {
        language: 'en',
        prompt: {
          prompt: SYSTEM_PROMPT,
          llm: 'gemini-2.0-flash',
          tools: clientTools,
        },
        first_message: "There he is. Talk to me — where's your head at today?",
      },
      tts: {
        voice_id: AKEEM_VOICE_ID,
        model_id: 'eleven_flash_v2',
        stability: 0.35,
        similarity_boost: 0.85,
        speed: 1.0,
      },
      turn: { turn_timeout: 10, mode: 'turn' },
      conversation: {
        max_duration_seconds: 600,
        client_events: ['audio', 'user_transcript', 'agent_response', 'interruption', 'agent_tool_response'],
      },
    },
    platform_settings: {
      auth: { enable_auth: true },
      ...(webhookUrl
        ? { post_call_webhook: { url: webhookUrl } }
        : {}),
    },
    tags: ['bbf', 'accountability-coach', 'akeem'],
  };
}

async function createAgent(apiKey: string, body: unknown): Promise<{ ok: boolean; status: number; agentId: string | null; raw: string }> {
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await r.text();
    let agentId: string | null = null;
    try {
      const j = JSON.parse(raw);
      agentId = (j?.agent_id ?? j?.agentId ?? null) as string | null;
    } catch { /* raw returned for diagnosis */ }
    return { ok: r.ok, status: r.status, agentId, raw: raw.slice(0, 2000) };
  } catch (e) {
    return { ok: false, status: 0, agentId: null, raw: (e as Error).message };
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); } catch { payload = {}; }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const ELEVENLABS_API_KEY = Deno.env.get('ELEVENLABS_API_KEY');
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);
  if (!ELEVENLABS_API_KEY) return jsonResponse({ error: 'tts_unconfigured', detail: 'ELEVENLABS_API_KEY is not set.' }, 503);

  // AUTH — admin header OR the transient bootstrap key in bbf_app_config.
  const sentAdmin = req.headers.get('x-bbf-admin-token');
  const bootstrapExpected = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_bootstrap_key');
  const adminOk = !!ADMIN_TOKEN && sentAdmin === ADMIN_TOKEN;
  const bootstrapOk = !!bootstrapExpected && String(payload?.bootstrap_key || '') === bootstrapExpected;
  if (!adminOk && !bootstrapOk) return jsonResponse({ error: 'unauthorized' }, 401);

  // VERIFY — confirm the stored agent mints a live conversation token.
  if (payload?.action === 'verify_token') {
    const agentId = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_agent_id');
    if (!agentId) return jsonResponse({ ok: false, error: 'agent_unconfigured' }, 503);
    try {
      const r = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { 'xi-api-key': ELEVENLABS_API_KEY } },
      );
      const raw = (await r.text()).slice(0, 400);
      let hasToken = false;
      try { hasToken = !!JSON.parse(raw)?.token; } catch { /* raw for diagnosis */ }
      return jsonResponse({ ok: r.ok && hasToken, agent_id: agentId, mint_status: r.status, has_token: hasToken, detail: hasToken ? undefined : raw });
    } catch (e) {
      return jsonResponse({ ok: false, error: 'mint_probe_failed', detail: (e as Error).message }, 502);
    }
  }

  const force = payload?.force === true;
  const existing = await readConfig(SUPABASE_URL, SERVICE_KEY, 'convai_agent_id');
  if (existing && !force) {
    return jsonResponse({ ok: true, existing: true, agent_id: existing });
  }

  const webhookUrl = `${SUPABASE_URL}/functions/v1/bbf-convai-postcall`;
  const createBody = buildCreateBody(webhookUrl);
  const res = await createAgent(ELEVENLABS_API_KEY, createBody);
  if (!res.ok || !res.agentId) {
    console.error(`[${FN}] create failed status=${res.status} raw=${res.raw}`);
    return jsonResponse({ ok: false, error: 'agent_create_failed', status: res.status, detail: res.raw }, 502);
  }

  const stored = await writeConfig(SUPABASE_URL, SERVICE_KEY, 'convai_agent_id', res.agentId);
  console.log(`[${FN}] created agent_id=${res.agentId} stored=${stored} webhook=${webhookUrl}`);
  return jsonResponse({ ok: true, created: true, agent_id: res.agentId, stored, webhook_url: webhookUrl });
});
