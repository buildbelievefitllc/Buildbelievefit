// bbf-agentic-peaking — Game-Day Peaking Engine Edge Function (Phase 2)
// ─────────────────────────────────────────────────────────────────────
// Intercepts the athlete's scheduled heavy workout when CNS readiness is
// compromised (sleep < 6 OR soreness > 7) and asks Claude Opus 4.7 to
// generate 2 CNS-friendly replacement lifts. Frontend renders the
// override on top of the static program.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-peaking
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",                 // required (slug or UUID)
//     "admin_override": false,             // optional · true → bypass engine
//     "scheduled_focus": "Push Day",       // optional · contextualizes prompt
//     "scheduled_lifts": ["Bench Press", "Incline DB Press", ...]  // optional
//   }
//
// Response shape (200 OK):
//   Bypass / no intercept:
//     { "override_active": false, [readiness_snapshot, message] }
//   Active intercept:
//     {
//       "override_active": true,
//       "warning_banner": "Sharp coach voice · 1 sentence",
//       "replacement_lifts": [{ name, reps, notes }, ...],
//       "readiness_snapshot": { sleep, stress },
//       "model": "claude-opus-4-7",
//       "duration_ms": 5230
//     }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: ... }.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization, x-bbf-admin-token',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ─── Model + request tuning ───────────────────────────────────────────
// Opus 4.7 with adaptive thinking + effort high — same defaults as
// bbf-co-coach. The peaking decision is high-stakes (you're overriding
// the athlete's prescribed training) so we don't downgrade intelligence.
const MODEL          = 'claude-opus-4-7';
const MAX_TOKENS     = 4096;
const EFFORT_DEFAULT = 'high';

// Trigger thresholds (CEO scaffold).
const SLEEP_FLOOR     = 6;   // sleep_quality < 6 → CNS compromised
const SORENESS_CEILING = 7;  // soreness_level > 7 → CNS compromised
// Defaults when no readiness data exists yet — bias toward "fine" so
// the engine doesn't intercept a brand-new client's first session on
// missing data.
const SLEEP_DEFAULT     = 8;
const SORENESS_DEFAULT  = 5;

// Stable system prompt — cacheable via cache_control: ephemeral.
const SYSTEM_PROMPT = [
  'You are the BBF Game-Day Peaking Engine. The athlete\'s CNS readiness has fallen below the safe threshold for heavy compound lifting today. Your job: replace their scheduled heavy session with 2 CNS-friendly recovery / mobility exercises that protect tomorrow\'s training capacity.',
  '',
  '# WHAT YOU RECEIVE',
  '- sleep_quality (1-10) — last night\'s recovery',
  '- soreness_level (1-10) — accumulated stress / soreness',
  '- scheduled_focus — what was originally planned (e.g. "Push Day", "Legs", "Pull")',
  '- scheduled_lifts — array of the day\'s heavy lift names',
  '',
  '# WHAT YOU RETURN',
  '- warning_banner — one short, direct sentence telling the athlete WHY their session is intercepted. Sharp coach voice. No platitudes. Example: "CNS readiness compromised. Today is recovery. Tomorrow we lift."',
  '- replacement_lifts — exactly 2 exercises, each with:',
  '    name:  specific movement (e.g. "Cat-Cow Spinal Mobilization")',
  '    reps:  prescription string (e.g. "3 x 10 slow tempo")',
  '    notes: 1-sentence cue or focus',
  '',
  '# CONSTRAINTS',
  '- Replacement movements must be LOW intensity, mobility / parasympathetic-focused.',
  '- Avoid heavy weight, plyometric, max-effort, eccentric overload, sprinting.',
  '- Target the same body region as the scheduled focus (e.g. Push Day → upper-back + thoracic mobility; Legs → hip mobility + light glute activation; Pull → lat / rear-delt mobility).',
  '- Direct voice. No "consider", "perhaps", "may want to". Imperatives only.',
  '- The banner is read aloud by the athlete in their head — keep it tight, no preamble.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    warning_banner: {
      type: 'string',
      description: 'One short, direct sentence. Sharp coach voice. No emoji. Why the session is intercepted.',
    },
    replacement_lifts: {
      type: 'array',
      description: 'Exactly 2 CNS-friendly mobility / recovery exercises.',
      items: {
        type: 'object',
        properties: {
          name:  { type: 'string', description: 'Specific movement name.' },
          reps:  { type: 'string', description: 'Prescription string, e.g. "3 x 10 slow tempo".' },
          notes: { type: 'string', description: '1-sentence cue or focus.' },
        },
        required: ['name', 'reps', 'notes'],
        additionalProperties: false,
      },
    },
  },
  required: ['warning_banner', 'replacement_lifts'],
  additionalProperties: false,
};

// ─── Slug → UUID resolver ─────────────────────────────────────────────
// Frontend may pass either the slug ("jacque_bbf") or the UUID. The DB
// FK target is UUID. Resolve via the SECURITY DEFINER RPC bbf_get_uid_map
// (same mechanism bbf-sync.js uses, but server-side here).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }

async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  const url = `${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-peaking] uid_map RPC failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (r && r.uid === uid && r.id) return r.id;
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-peaking] uid_map RPC error: ${(e as Error).message}`);
    return null;
  }
}

// ─── Readiness fetch (Phase C schema) ─────────────────────────────────
async function fetchLatestReadiness(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<{ sleep_quality: number | null; soreness_level: number | null } | null> {
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&select=sleep_quality,soreness_level,timestamp&order=timestamp.desc&limit=1`;
  const url = `${supabaseUrl}/rest/v1/bbf_readiness?${qs}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-peaking] readiness fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return {
        sleep_quality:   typeof data[0].sleep_quality === 'number' ? data[0].sleep_quality : null,
        soreness_level:  typeof data[0].soreness_level === 'number' ? data[0].soreness_level : null,
      };
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-peaking] readiness fetch error: ${(e as Error).message}`);
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
        cache_control: { type: 'ephemeral' },
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
    console.error(`[bbf-agentic-peaking] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
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

  // Optional admin-token gate (same pattern as bbf-co-coach).
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-peaking] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uidRaw = payload?.uid;
  if (typeof uidRaw !== 'string' || !uidRaw) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  const adminOverride = !!payload?.admin_override;

  // ─── 1. Omniscience Protocol · Admin Override ──────────────────
  if (adminOverride) {
    return jsonResponse({
      override_active: false,
      message: 'ADMIN OVERRIDE: Static Protocol Active',
    });
  }

  // ─── 2. Pull Readiness (Phase C schema) ────────────────────────
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: 'config_missing_supabase' }, 503);
  }

  // Resolve the slug → UUID (bbf_readiness.user_id is uuid).
  const uuid = await resolveUuid(uidRaw, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!uuid) {
    return jsonResponse({ error: 'uid_not_resolvable', uid: uidRaw }, 400);
  }

  const readiness = await fetchLatestReadiness(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sleep  = (readiness && readiness.sleep_quality  != null) ? readiness.sleep_quality  : SLEEP_DEFAULT;
  const stress = (readiness && readiness.soreness_level != null) ? readiness.soreness_level : SORENESS_DEFAULT;
  const hasReadiness = !!readiness;

  // ─── 3. Trigger Condition ──────────────────────────────────────
  const isCnsCompromised = (sleep < SLEEP_FLOOR) || (stress > SORENESS_CEILING);

  if (!isCnsCompromised) {
    return jsonResponse({
      override_active:    false,
      readiness_snapshot: { sleep, stress, has_data: hasReadiness },
    });
  }

  // ─── 4. Claude API Call ────────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-peaking] missing ANTHROPIC_API_KEY');
    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  }

  const focus = (typeof payload?.scheduled_focus === 'string' && payload.scheduled_focus.trim())
    ? payload.scheduled_focus.trim()
    : 'unspecified';
  const lifts = Array.isArray(payload?.scheduled_lifts)
    ? payload.scheduled_lifts.filter((s: unknown) => typeof s === 'string' && s.length > 0)
    : [];

  const userMessage =
    'Athlete state today:\n' +
    '- sleep_quality: ' + sleep + '/10\n' +
    '- soreness_level: ' + stress + '/10\n' +
    '- scheduled_focus: ' + focus + '\n' +
    '- scheduled_lifts: ' + (lifts.length ? lifts.join(', ') : '(none provided)') + '\n\n' +
    'Generate the warning banner + 2 CNS-friendly replacement lifts per the schema.';

  const t0 = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({
      error: 'anthropic_call_failed',
      detail: result.error,
      status: result.status,
      raw: result.raw,
    }, 502);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.error(`[bbf-agentic-peaking] no text block in response. content=${JSON.stringify(respBody?.content)}`);
    return jsonResponse({ error: 'no_text_block_in_response', raw: respBody }, 502);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-agentic-peaking] parse failed: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'parse_failed', detail: (e as Error).message, raw_text: text }, 502);
  }

  console.log(`[bbf-agentic-peaking] intercept · uid=${uidRaw} · sleep=${sleep} stress=${stress} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    override_active:    true,
    warning_banner:     parsed.warning_banner,
    replacement_lifts:  parsed.replacement_lifts,
    readiness_snapshot: { sleep, stress, has_data: hasReadiness },
    model:              respBody.model,
    usage:              respBody.usage,
    duration_ms:        dur,
  }, 200);
});
