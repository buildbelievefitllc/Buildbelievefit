// bbf-agentic-prehab — Live Library Recovery Matrix (Phase 5, v2)
// ─────────────────────────────────────────────────────────────────────
// Phase 5 audible: scope reframed from autonomic-readiness-driven
// (sleep/soreness · 48h bbf_readiness window) to demographic + workload +
// friction-driven. Reads the user's profile from bbf_users, today's lifts
// from bbf_sets (day_key prefix match), and a free-text "Friction Scanner"
// string supplied by the client. Returns a 3-movement recovery matrix.
//
// SCOPE CHANGE: this engine is now a GLOBAL CORE FEATURE — available to
// every tier (gateway / youth_athlete / architect / sovereign), not just
// the Athlete Portal. Tier gate update in bbf-app.html ships alongside.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-prehab
//   Body:
//   {
//     "uid": "jacque_bbf",                    // required (slug or uuid)
//     "actual_uuid": "0df9a69a-...",          // optional · pre-resolved
//     "reported_friction": "tight low back",  // required · can be ""
//     "client_context": {                     // optional · frontend enrichment
//       "goal":  "recomp",                    // local state, not in bbf_users
//       "today": "2026-05-16",                // client-local date for day_key
//       "partner": "wayne_bbf"
//     },
//     "admin_override": false                 // Omniscience bypass
//   }
//
// Response shape (200 OK):
//   { matrix: [{ name, duration, focus, reason }, ...3 entries...] }
//
// FAILURE POSTURE: matches v1 — every code path returns a valid matrix
// at HTTP 200. Omniscience first-gate, static baseline matrix on any
// upstream failure. Client never sees an error state.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

const MODEL             = 'claude-opus-4-7';
const MAX_TOKENS        = 2048;
const EFFORT_DEFAULT    = 'high';
const CLAUDE_TIMEOUT_MS = 12000;

const SYSTEM_PROMPT = [
  'You are an elite physical therapist generating a tailored 3-movement recovery / prehab matrix for an athlete.',
  '',
  '# DECISION INPUTS YOU RECEIVE',
  '- profile — name, subscription_tier, metabolic_tier, current_streak, cns_friction_score (if present), and optional goal supplied by the client. Use this to read the athlete\'s context. A gateway-tier postpartum client gets different prescriptions than a sovereign-tier strength athlete or a youth-athlete tier (gateway/youth_athlete) recovering between practice and game-day.',
  '- today_workload — array of { exercise_key, weight_lbs, reps, day_key } for lifts the athlete completed TODAY. Empty array = non-training day → program for general recovery rather than post-session recovery.',
  '- reported_friction — free-text string from the athlete describing tightness, pain, fatigue, or specific zones. May be empty.',
  '',
  '# OUTPUT RULES',
  '- EXACTLY 3 movements.',
  '- Each movement object: { name, duration, focus, reason }.',
  '  · name: specific protocol (3-6 words). Examples: "90/90 Hip Capsule Mobilization", "Banded Pec Doorway Stretch".',
  '  · duration: time or rep prescription. Examples: "2 mins", "30 sec hold x 3 sides", "10 controlled reps".',
  '  · focus: anatomic target zone. Examples: "Hip flexors / TFL", "Thoracic spine", "Posterior chain".',
  '  · reason: ONE tactical sentence linking THIS movement to THE athlete\'s context — cite their friction text if present, OR the specific lift volume they did today, OR their demographic.',
  '',
  '# PRESCRIPTION LOGIC',
  '- Prioritize what reported_friction signals. If the athlete says "lower back tight", every movement should at least be back-aware.',
  '- If reported_friction is empty AND today_workload is non-empty, infer the dominant movement pattern (push / pull / squat / hinge) and prescribe complementary recovery for the antagonist / supporting tissue.',
  '- If reported_friction is empty AND today_workload is empty, default to a general posterior-chain / hip / thoracic reset protocol.',
  '',
  '# SAFETY (non-negotiable)',
  '- Never prescribe a loaded or end-range movement that would aggravate a stated friction zone. If pain is mentioned, prescribe decompression / capsule work / breath-driven mobilization — NOT loaded range-of-motion.',
  '- For postpartum-coded clients (e.g. metabolic_tier flagged postpartum, name matches Jacquelyn) avoid deep flexion of the rectus abdominis until cleared.',
  '- For youth athletes (gateway/youth_athlete tier with younger demographic signals) lean into mobility + neuromuscular reset, not strength holds.',
  '',
  '# VOICE',
  '- Direct. Imperative. No "consider", no "may want to", no hedging.',
  '- Reason field should reference SPECIFIC context (their friction text, the exercise_key they did) not generic platitudes.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    matrix: {
      type: 'array',
      description: 'Exactly 3 recovery movements tailored to the athlete\'s profile + today\'s workload + reported friction.',
      items: {
        type: 'object',
        properties: {
          name:     { type: 'string', description: 'Specific protocol name (3-6 words).' },
          duration: { type: 'string', description: 'Time or rep prescription. Examples: "2 mins", "30 sec hold x 3 sides".' },
          focus:    { type: 'string', description: 'Anatomic target zone. Examples: "Hip flexors / TFL", "Thoracic spine".' },
          reason:   { type: 'string', description: 'One tactical sentence linking this movement to the athlete\'s specific context.' },
        },
        required: ['name', 'duration', 'focus', 'reason'],
      },
    },
  },
  required: ['matrix'],
  additionalProperties: false,
};

// ─── Omniscience Mock (CEO spec) ───────────────────────────────────────
// admin_override=true → return this verbatim. Skips DB + Claude call.
function adminOverrideMock() {
  return {
    matrix: [
      { name: 'ADMIN BYPASS: Psoas Release',         duration: '2 mins', focus: 'Hip flexors / Psoas major', reason: 'Master Key Active.' },
      { name: 'ADMIN BYPASS: Thoracic Extension',    duration: '2 mins', focus: 'Upper back / T-spine',      reason: 'Master Key Active.' },
      { name: 'ADMIN BYPASS: Posterior Chain Reset', duration: '90 sec', focus: 'Hamstrings / Glutes',       reason: 'Master Key Active.' },
    ],
  };
}

// ─── Static "Default Baseline" matrix ──────────────────────────────────
// Returned on ANY upstream failure. Per directive: never crash the
// client. Matches the response schema exactly.
function defaultBaselineMatrix() {
  return {
    matrix: [
      { name: 'Cat-Cow Spinal Flow',         duration: '2 mins',                focus: 'Full spine mobility',    reason: 'Universal baseline reset when telemetry is unavailable. Restores segmental motion top-to-bottom.' },
      { name: '90/90 Hip Switch',            duration: '30 sec hold x 3 sides', focus: 'Hip capsule + rotators', reason: 'Pairs internal + external hip rotation in a low-friction position. Safe for every demographic.' },
      { name: 'Childs Pose with Side Reach', duration: '60 sec total',          focus: 'Lats / lower back',      reason: 'Decompresses the lumbar segment and opens the lats. Safe finisher regardless of session load.' },
    ],
  };
}

// ─── Slug → UUID resolver (mirrors Phase 2/3/4 pattern) ────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }

async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`, {
      method: 'POST',
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type':  'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-prehab v2] uid_map RPC failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (r && r.uid === uid && r.id) return r.id;
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-prehab v2] uid_map RPC error: ${(e as Error).message}`);
    return null;
  }
}

// ─── User profile fetch ────────────────────────────────────────────────
async function fetchUserProfile(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Record<string, unknown> | null> {
  const select = 'name,subscription_tier,metabolic_tier,current_streak,cns_friction_score';
  const url = `${supabaseUrl}/rest/v1/bbf_users?id=eq.${encodeURIComponent(uuid)}&select=${select}&limit=1`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-prehab v2] user fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    const rows = await res.json();
    return (Array.isArray(rows) && rows[0]) || null;
  } catch (e) {
    console.error(`[bbf-agentic-prehab v2] user fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Today's sets fetch ────────────────────────────────────────────────
// bbf_sets.day_key is text shaped "YYYY-MM-DD_dN". Filter via like prefix
// match on the client-supplied date (preferred — uses athlete's local TZ)
// or UTC today as fallback.
async function fetchTodaySets(
  uuid: string,
  todayDate: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Array<Record<string, unknown>> | null> {
  const select = 'exercise_key,weight_lbs,reps,day_key';
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&day_key=like.${encodeURIComponent(todayDate + '%')}&select=${select}&order=day_key.desc&limit=80`;
  const url = `${supabaseUrl}/rest/v1/bbf_sets?${qs}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-prehab v2] sets fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[bbf-agentic-prehab v2] sets fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Anthropic call w/ 12s AbortController timeout ─────────────────────
async function callClaude(userMessage: string, apiKey: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: EFFORT_DEFAULT,
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    system: [
      {
        type:          'text',
        text:          SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },  // CEO directive
      },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  };

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body:   JSON.stringify(requestBody),
      signal: controller.signal,
    });

    let body: any;
    try { body = await res.json(); }
    catch (_) { body = null; }

    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-prehab v2] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-prehab v2] Claude fetch threw: ${reason}`);
    return { ok: false as const, status: 0, error: reason, raw: null };
  } finally {
    clearTimeout(timeout);
  }
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

function utcToday(): string {
  const d = new Date();
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-prehab v2] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, actual_uuid, reported_friction, client_context, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  const friction = typeof reported_friction === 'string' ? reported_friction : '';
  const ctx      = (client_context && typeof client_context === 'object') ? client_context : {};
  const todayDate = (typeof ctx.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ctx.today)) ? ctx.today : utcToday();

  // ─── 2. Resolve uuid + pull demographics & today's workload ────
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[bbf-agentic-prehab v2] missing Supabase config — returning baseline fallback');
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  let uuid: string | null = null;
  if (typeof actual_uuid === 'string' && isUuid(actual_uuid)) {
    uuid = actual_uuid;
  } else {
    uuid = await resolveUuid(uid, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  }
  if (!uuid) {
    console.warn(`[bbf-agentic-prehab v2] uid not resolvable: ${uid} — returning baseline fallback`);
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  // Pull profile + today's sets in parallel for latency.
  const [userRow, todaySets] = await Promise.all([
    fetchUserProfile(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY),
    fetchTodaySets(uuid, todayDate, SUPABASE_URL, SUPABASE_SERVICE_KEY),
  ]);

  // Merge: server profile (canonical) + client_context (local enrichment
  // like `goal` which doesn't exist on bbf_users).
  const userProfile: Record<string, unknown> = Object.assign(
    {},
    userRow || { uid },
    { uid, goal: ctx.goal || null, partner: ctx.partner || null },
  );
  const todayWorkload = Array.isArray(todaySets) ? todaySets : [];

  // ─── 3. Claude call ────────────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-prehab v2] missing ANTHROPIC_API_KEY — returning baseline fallback');
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  const userMessage =
    'Generate a 3-movement recovery / prehab matrix for this athlete.\n\n' +
    '## profile\n```json\n' + JSON.stringify(userProfile, null, 2) + '\n```\n\n' +
    '## today_workload (' + todayWorkload.length + ' set' + (todayWorkload.length === 1 ? '' : 's') + ' completed on ' + todayDate + ')\n' +
    '```json\n' + JSON.stringify(todayWorkload, null, 2) + '\n```\n\n' +
    '## reported_friction\n' + (friction ? '"' + friction + '"' : '(none reported)') + '\n\n' +
    'Return ONLY the JSON schema response. Exactly 3 entries in matrix.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-prehab v2] Claude failed (${result.error}) after ${dur}ms — returning baseline fallback`);
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-prehab v2] no text block in response — returning baseline fallback');
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-prehab v2] parse failed (${(e as Error).message}) — returning baseline fallback`);
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  if (!parsed || !Array.isArray(parsed.matrix) || parsed.matrix.length !== 3) {
    console.warn(`[bbf-agentic-prehab v2] schema shape mismatch (got ${JSON.stringify(parsed).slice(0,200)}) — returning baseline fallback`);
    return jsonResponse(defaultBaselineMatrix(), 200);
  }

  console.log(`[bbf-agentic-prehab v2] uid=${uid} · today=${todayDate} · sets=${todayWorkload.length} · friction_len=${friction.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  // Strict response per CEO spec — only { matrix }. No extra metadata.
  return jsonResponse({ matrix: parsed.matrix }, 200);
});
