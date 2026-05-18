// bbf-agentic-comlink — Sovereign Comlink (Phase 7)
// ─────────────────────────────────────────────────────────────────────
// Voice-activated workout rewriter. The athlete taps a microphone FAB,
// speaks a constraint ("I only have 20 minutes", "all the barbells are
// taken", "my left knee is flared up"), and Claude Opus 4.7 dynamically
// rewrites the day's exercise array to accommodate while preserving
// the physiological stimulus.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-comlink
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",
//     "transcript": "I only have 20 minutes",
//     "current_workout": [
//       { "name": "Back Squat", "sets": 4, "reps": "8-10", "equipment": "barbell", "notes": "..." },
//       ...
//     ],
//     "client_context": { "goal": "recomp", "partner": "wayne_bbf" },  // optional
//     "admin_override": false
//   }
//
// Response shape (200 OK):
//   {
//     "comlink_verdict": string,                                      // short radio reply
//     "updated_workout": [{ "name", "target", "weight_lbs" }, ...]    // new array
//   }
//
// FAILURE POSTURE: every code path returns a valid response at HTTP 200.
// On any upstream failure, returns the original workout unchanged with
// a verdict explaining the engine couldn't process the transcript.

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

const MODEL              = 'claude-opus-4-7';
const MAX_TOKENS         = 2048;
const EFFORT_DEFAULT     = 'high';
const CLAUDE_TIMEOUT_MS  = 14000;
const MAX_TRANSCRIPT_LEN = 800;

const SYSTEM_PROMPT = [
  'You are the BBF Sovereign Comlink — an elite strength coach receiving a real-time radio transmission from an athlete already mid-session. They state a constraint (time, equipment availability, pain, environmental factor). You dynamically rewrite the day\'s workout to perfectly accommodate the constraint while preserving the intended physiological stimulus.',
  '',
  '# WHAT YOU RECEIVE',
  '- transcript — the athlete\'s spoken constraint (transcribed by Web Speech API; expect noisy / fragmented). Examples: "I only have 20 minutes", "the squat rack is taken", "my left knee is acting up", "I have an EZ curl bar and a flat bench, that\'s it".',
  '- current_workout — the day\'s planned exercises. Array of { name, sets, reps, equipment, notes, ... }. THIS is your starting point — preserve as much as you safely can.',
  '- profile context — uid, optional goal / partner.',
  '',
  '# REWRITE PRINCIPLES',
  '1. PRESERVE THE STIMULUS. If the original is a lower-body strength day, the rewrite is still lower-body strength. Don\'t swap a leg day into mobility just because the rack is taken — find a substitute (Bulgarian split squat, goblet squat, etc.).',
  '2. RESPECT THE CONSTRAINT VERBATIM. "20 minutes" means the new workout fits in ≤20 minutes including warm-up. Cut volume, supersede with supersets, choose efficient movements — but stay inside the budget. "All barbells taken" means zero exercises requiring a barbell.',
  '3. SAFETY OVERRIDES EVERYTHING. If pain is mentioned, no movement that loads the painful joint. Always.',
  '4. KEEP NAMES SPECIFIC AND COACHED. "DB Romanian Deadlift" not "Hamstring Exercise". "Tempo Goblet Squat (3-1-1)" not "Goblet Squat".',
  '',
  '# OUTPUT FIELDS',
  '- comlink_verdict — ONE short radio-style sentence (under 90 chars). Direct coach voice, references the constraint explicitly. Examples: "Compressed to 18min. Pivoting to a DB-only push circuit." / "Knee-safe rebuild — pulling all knee-flexion loads."',
  '- updated_workout — array of { name, target, weight_lbs } objects.',
  '  · name: specific movement name, including any tempo/variation cue if relevant.',
  '  · target: rep/set/duration prescription as a free-form string. Examples: "3x10", "5x5", "30 sec hold x 3 sides", "AMRAP in 90 sec", "100 reps total".',
  '  · weight_lbs: numeric string ("100"), or "BW" (bodyweight), or "" (no specific load — e.g. duration drills).',
  '- Array length: 3 to 8 entries. Match the constraint — compressed sessions get 3-4 movements, full constraints (equipment-only) keep close to the original count.',
  '',
  '# CONSTRAINTS',
  '- If the transcript is unclear / nonsensical / clearly not a workout constraint: return the current_workout unchanged (mapped into the new schema shape) and use comlink_verdict to ask the athlete to repeat the request.',
  '- Never increase load relative to the original plan. Always equal or reduced.',
  '- Direct voice. No hedging. No "consider", no "may want to".',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    comlink_verdict: {
      type: 'string',
      description: 'Short radio-style coach reply referencing the constraint. Under 90 chars.',
    },
    updated_workout: {
      type: 'array',
      description: '3-8 rewritten exercises preserving the physiological stimulus.',
      items: {
        type: 'object',
        properties: {
          name:       { type: 'string', description: 'Specific movement name including variation/tempo cue.' },
          target:     { type: 'string', description: 'Rep/set/duration prescription as a free-form string.' },
          weight_lbs: { type: 'string', description: 'Numeric weight as a string, or "BW", or "".' },
        },
        required: ['name', 'target', 'weight_lbs'],
      },
    },
  },
  required: ['comlink_verdict', 'updated_workout'],
  additionalProperties: false,
};

// ─── Omniscience Mock (CEO spec, verbatim) ─────────────────────────────
function adminOverrideMock() {
  return {
    comlink_verdict: 'MASTER KEY: Protocol compressed for time.',
    updated_workout: [
      { name: 'ADMIN BYPASS: 100x Pushups', target: '100', weight_lbs: 'BW' },
    ],
  };
}

// ─── Fallback — preserve the original workout when LLM fails ───────────
function defaultPassThrough(currentWorkout: any[], reason: string) {
  const mapped = (Array.isArray(currentWorkout) ? currentWorkout : []).slice(0, 8).map((ex: any) => {
    const sets = ex && (ex.sets != null) ? String(ex.sets) : '1';
    const reps = ex && (ex.reps != null) ? String(ex.reps) : '';
    return {
      name:       String((ex && ex.name) || 'Exercise'),
      target:     reps ? sets + 'x' + reps : sets,
      weight_lbs: '',
    };
  });
  return {
    comlink_verdict: 'Comlink offline (' + reason + '). Holding original protocol — radio in again.',
    updated_workout: mapped.length ? mapped : [{ name: 'Active recovery', target: '20 min walk', weight_lbs: 'BW' }],
  };
}

// ─── Anthropic call w/ AbortController timeout ─────────────────────────
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
        cache_control: { type: 'ephemeral' },
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
      console.error(`[bbf-agentic-comlink] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-comlink] Claude fetch threw: ${reason}`);
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

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-comlink] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, transcript, current_workout, client_context, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid) return jsonResponse({ error: 'missing_uid' }, 400);
  if (typeof transcript !== 'string' || !transcript.trim()) return jsonResponse({ error: 'missing_transcript' }, 400);

  const safeTranscript = transcript.slice(0, MAX_TRANSCRIPT_LEN);
  const workout = Array.isArray(current_workout) ? current_workout : [];
  const ctx     = (client_context && typeof client_context === 'object') ? client_context : {};

  // ─── 2. Claude call ────────────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-comlink] missing ANTHROPIC_API_KEY — passing through');
    return jsonResponse(defaultPassThrough(workout, 'config_missing'), 200);
  }

  const userMessage =
    '## athlete profile\n' +
    '```json\n' + JSON.stringify({ uid: uid, goal: ctx.goal || null, partner: ctx.partner || null }, null, 2) + '\n```\n\n' +
    '## current_workout (' + workout.length + ' planned exercises)\n' +
    '```json\n' + JSON.stringify(workout, null, 2) + '\n```\n\n' +
    '## transcript (athlete radio transmission)\n' +
    '"' + safeTranscript + '"\n\n' +
    'Rewrite the workout per your system instructions. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-comlink] Claude failed (${result.error}) after ${dur}ms — passing through`);
    return jsonResponse(defaultPassThrough(workout, 'claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-comlink] no text block in response — passing through');
    return jsonResponse(defaultPassThrough(workout, 'no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-comlink] parse failed (${(e as Error).message}) — passing through`);
    return jsonResponse(defaultPassThrough(workout, 'parse_failed'), 200);
  }

  if (
    !parsed ||
    typeof parsed.comlink_verdict !== 'string' ||
    !Array.isArray(parsed.updated_workout) ||
    parsed.updated_workout.length === 0
  ) {
    console.warn(`[bbf-agentic-comlink] schema shape mismatch — passing through. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultPassThrough(workout, 'schema_mismatch'), 200);
  }

  // Defensive shape coercion — guarantee every exercise has the 3 fields
  // as strings. Slice to 8 max (matches schema description).
  const cleanWorkout = parsed.updated_workout.slice(0, 8).map((ex: any) => ({
    name:       String((ex && ex.name) || 'Exercise'),
    target:     String((ex && ex.target) || ''),
    weight_lbs: String((ex && ex.weight_lbs) || ''),
  }));

  console.log(`[bbf-agentic-comlink] uid=${uid} · transcript_len=${safeTranscript.length} · workout_in=${workout.length} · workout_out=${cleanWorkout.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    comlink_verdict: parsed.comlink_verdict.slice(0, 200),
    updated_workout: cleanWorkout,
  }, 200);
});
