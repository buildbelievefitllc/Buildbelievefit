// bbf-agentic-forecasting — Predictive Trajectory Forecaster (Phase 3)
// ─────────────────────────────────────────────────────────────────────
// Reads the athlete's recent bbf_sets (last ~60 sets, descending by
// day_key for trajectory relevance), asks Claude Opus 4.7 to project
// their 1RM 30 days out for a named lift, returns a confidence score
// and a one-sentence training micro-adjustment.
//
// SCHEMA NOTES (deviations from the CEO scaffold, called out in PR):
//   - bbf_sets has no `created_at` column — substituted `day_key` (text,
//     "YYYY-MM-DD_dN" shape) for temporal ordering
//   - Scaffold's ascending+limit-20 returned oldest sets (wrong direction
//     for trajectory); switched to descending and bumped to 60 for
//     richer velocity data
//   - bbf_sets carries exercise_key (e.g. "ex_0") not lift_name. We pass
//     all recent sets to the LLM and let it cluster by exercise_key +
//     reason about which cluster matches the named lift
//
// Request shape:
//   POST /functions/v1/bbf-agentic-forecasting
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",         // required (slug or UUID)
//     "lift_name": "Back Squat",   // required (human name)
//     "admin_override": false      // optional · true → Omniscience bypass
//   }
//
// Response shape (200 OK):
//   { "projected_1rm": "string", "confidence_score": "string", "agent_insight": "string" }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: ... }.

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

const MODEL          = 'claude-opus-4-7';
const MAX_TOKENS     = 2048;
const EFFORT_DEFAULT = 'high';
const SET_LIMIT      = 60;           // descending by day_key, sufficient for 30-day forecast
const MIN_SETS_REQUIRED = 3;         // matches CEO scaffold threshold

const SYSTEM_PROMPT = [
  'You are the BBF Predictive Trajectory Forecaster. The head coach (or athlete) is reviewing a specific lift\'s progress and wants a data-driven 30-day projection. You produce a single 1RM projection, a confidence score, and ONE concrete training micro-adjustment.',
  '',
  '# WHAT YOU RECEIVE',
  '- lift_name — the lift the athlete is asking about (e.g. "Back Squat", "Bench Press")',
  '- sets[] — most recent ~60 working sets across all exercises, with: day_key (text date), exercise_key (positional id like "ex_0"), weight_lbs, reps, rpe (optional, often null)',
  '',
  '# HOW TO ANALYZE',
  '- bbf_sets does NOT carry the lift name. Cluster the sets by exercise_key + day_key to identify which cluster matches the requested lift_name. Heuristic: the cluster with the heaviest weights + most consistent occurrence is usually the main compound lift the athlete asked about.',
  '- Estimate current 1RM from the heaviest recent set using the Epley formula: weight × (1 + reps/30).',
  '- Compute velocity: look at the trend of weight × reps (volume) and top-set weight across the last 4-6 sessions of the target cluster. Trending up = positive velocity.',
  '- Project 30 days forward using a linear extrapolation of velocity, capped to realistic gains (intermediate lifters: 2-5% / month; advanced: 0.5-2% / month).',
  '',
  '# WHAT YOU RETURN',
  '- projected_1rm — STRING with units. Example: "315 lbs" or "142 lbs (est.)". Round to nearest 2.5 lb. If the lift isn\'t clearly present in the data, use "N/A".',
  '- confidence_score — STRING qualifier. One of: "Low", "Moderate", "High". Based on sample size + trend consistency + RPE availability.',
  '- agent_insight — ONE sentence. Direct coach voice. A specific, actionable micro-adjustment to hit the projection. Example: "Add a 3rd working set at 90% for the next 4 sessions to consolidate the rep-volume base before chasing the 5lb jump." NOT "Consider doing more sets."',
  '',
  '# CONSTRAINTS',
  '- Direct voice. No "consider", "perhaps", "may want to". Imperatives only.',
  '- If <3 sets total OR no cluster matches the lift_name, set projected_1rm="N/A", confidence_score="Low", and use agent_insight to tell them what to log to unlock the forecast.',
  '- Round weights to nearest 2.5 lb (commercial gym plate granularity).',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    projected_1rm: {
      type: 'string',
      description: 'Projected 1RM 30 days from now, formatted as "X lbs" (round to 2.5 lb). "N/A" if the lift isn\'t present or data is insufficient.',
    },
    confidence_score: {
      type: 'string',
      description: 'Qualitative confidence: "Low", "Moderate", or "High". Based on sample size + trend consistency.',
    },
    agent_insight: {
      type: 'string',
      description: 'One-sentence concrete training micro-adjustment to hit the projection. Direct coach voice. No hedging.',
    },
  },
  required: ['projected_1rm', 'confidence_score', 'agent_insight'],
  additionalProperties: false,
};

// ─── Slug → UUID resolver (mirrors Phase 2 pattern) ───────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }

async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-forecasting] uid_map RPC failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (r && r.uid === uid && r.id) return r.id;
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-forecasting] uid_map RPC error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Recent-sets fetch ────────────────────────────────────────────────
async function fetchRecentSets(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Array<{ weight_lbs: number | null; reps: number | null; day_key: string | null; exercise_key: string | null; rpe: number | null }> | null> {
  // descending by day_key, limit 60 — gives the LLM the most recent
  // velocity window without bloating the prompt. We include
  // exercise_key + day_key so the LLM can cluster sets by lift and
  // identify which cluster maps to the requested lift_name.
  const select = 'weight_lbs,reps,day_key,exercise_key,rpe';
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&select=${select}&order=day_key.desc&limit=${SET_LIMIT}`;
  const url = `${supabaseUrl}/rest/v1/bbf_sets?${qs}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-forecasting] sets fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[bbf-agentic-forecasting] sets fetch error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Anthropic call ────────────────────────────────────────────────────
async function callClaude(userMessage: string, apiKey: string) {
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
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },  // CEO directive
      },
    ],
    messages: [
      { role: 'user', content: userMessage },
    ],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  let body: any;
  try { body = await res.json(); }
  catch (_) { body = null; }

  if (!res.ok) {
    const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
    console.error(`[bbf-agentic-forecasting] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
    return { ok: false as const, status: res.status, error: errMsg, raw: body };
  }
  return { ok: true as const, status: res.status, body };
}

function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') return block.text;
  }
  return null;
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-forecasting] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uidRaw    = payload?.uid;
  const liftName  = payload?.lift_name;
  const adminOverride = !!payload?.admin_override;

  if (typeof uidRaw !== 'string' || !uidRaw) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  if (typeof liftName !== 'string' || !liftName) {
    return jsonResponse({ error: 'missing_lift_name' }, 400);
  }

  // ─── 1. ENFORCE OMNISCIENCE PROTOCOL ───────────────────────────
  if (adminOverride) {
    return jsonResponse({
      projected_1rm:    'ADMIN BYPASS: 500 lbs',
      confidence_score: '100%',
      agent_insight:    'Master Override Active. Trajectory limits removed.',
    });
  }

  // ─── 2. Pull Historical Lift Data ──────────────────────────────
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  const uuid = await resolveUuid(uidRaw, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!uuid) {
    return jsonResponse({ error: 'uid_not_resolvable', uid: uidRaw }, 400);
  }

  const setsData = await fetchRecentSets(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (!setsData || setsData.length < MIN_SETS_REQUIRED) {
    return jsonResponse({
      projected_1rm:    'N/A',
      confidence_score: 'Low',
      agent_insight:    'Insufficient data velocity. Complete 3 more sessions to unlock forecasting.',
    });
  }

  // ─── 3. The Claude API Call ────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-forecasting] missing ANTHROPIC_API_KEY');
    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  }

  const userMessage =
    'Athlete asks about: ' + liftName + '\n\n' +
    'Recent training data (most-recent first, all lifts mixed — cluster by exercise_key + day_key to identify the target cluster):\n\n' +
    '```json\n' + JSON.stringify(setsData, null, 2) + '\n```\n\n' +
    'Return ONLY the JSON schema response. Project the 30-day 1RM, score your confidence, and give ONE direct micro-adjustment to hit the projection.';

  const t0 = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({
      error:  'anthropic_call_failed',
      detail: result.error,
      status: result.status,
      raw:    result.raw,
    }, 502);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.error(`[bbf-agentic-forecasting] no text block in response. content=${JSON.stringify(respBody?.content)}`);
    return jsonResponse({ error: 'no_text_block_in_response', raw: respBody }, 502);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-agentic-forecasting] parse failed: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'parse_failed', detail: (e as Error).message, raw_text: text }, 502);
  }

  console.log(`[bbf-agentic-forecasting] uid=${uidRaw} · lift=${liftName} · sets=${setsData.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  // Frontend expects the bare 3-field shape per the scaffold. Surface
  // the LLM fields directly; debug metadata goes in console only.
  return jsonResponse({
    projected_1rm:    parsed.projected_1rm,
    confidence_score: parsed.confidence_score,
    agent_insight:    parsed.agent_insight,
  }, 200);
});
