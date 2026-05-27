// bbf-agentic-kinematics — Live Kinematic Mapping (Phase 6)
// ─────────────────────────────────────────────────────────────────────
// Receives a base64-encoded image of an athlete mid-lift and returns a
// biomechanics-grade form analysis via Claude Opus 4.7 with vision.
// Mounts as a "🎥 Form Check" button beneath each primary lift in the
// workout view (RDW); on click → camera/file input → base64 → POST here
// → renders into a .kinematic-results-panel below the lift block.
//
// Vision model rationale: every BBF agentic engine is on Claude Opus 4.7.
// Opus 4.7 supports native multimodal input via the messages API
// (content blocks of { type: 'image', source: { type: 'base64', media_type,
// data } }). Keeping namespace + model consistency over Gemini.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-kinematics
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",                  // required (slug or uuid)
//     "image_base64": "/9j/4AAQSk...",      // required (no data: prefix)
//     "mime_type": "image/jpeg",            // optional, defaults to image/jpeg
//     "lift_name": "Back Squat",            // required
//     "admin_override": false               // Omniscience bypass
//   }
//
// Response shape (200 OK):
//   {
//     "form_score":      number (0-100 integer),
//     "kinematic_flags": [string, string],   // exactly 2 specific observations
//     "correction_cue":  string              // one actionable correction
//   }
//
// FAILURE POSTURE: every failure path returns a safe default kinematic
// response at HTTP 200 so the client never sees an error state. The
// payload is shaped identically to a real Claude response so the UI
// render path is single-track.

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

// Phase 7 Workstream B · Single-image form scoring is a bounded vision
// task with a structured response (form_score + 2-3 cues). Sonnet 4.6
// is the right tier · Opus 4.7 was overspend for the bounded output.
// Phase 6.0h-followup · raw fetch → canonical callClaude · use-case
// `kinematic_form_score` routes to SONNET (vision-capable tier) ·
// fallback escalates to OPUS · helper's `userImages` parameter carries
// the base64-encoded form-check photo alongside the wrapped <user_input>
// armor block in one user-message content array.
import { callClaude } from '../_shared/anthropic-call.ts';

const MAX_TOKENS         = 1024;
const CLAUDE_TIMEOUT_MS  = 18000;        // vision calls are slower than text-only
const MAX_IMAGE_BYTES    = 4 * 1024 * 1024;  // 4MB base64-decoded ceiling

const SYSTEM_PROMPT = [
  'You are an elite biomechanics coach analyzing a single still image of an athlete performing a named lift. The athlete trains on the Build Believe Fit platform and is reviewing their form via the in-app Kinematic Scanner.',
  '',
  '# WHAT YOU RECEIVE',
  '- A single image of an athlete mid-rep (or paused at the working position).',
  '- The lift_name they were performing.',
  '',
  '# WHAT YOU ASSESS',
  '1. Joint angles and posture — spinal neutrality, knee tracking, hip hinge mechanics, head/neck position, shoulder packing.',
  '2. Bar path / load path and stability — vertical bar path for squats/deadlifts/press, controlled descent on eccentrics, asymmetries left vs right.',
  '',
  '# WHAT YOU RETURN',
  '- form_score — integer 0-100. Calibrate:',
  '  · 90-100 = competition-grade execution, nothing to refine.',
  '  · 75-89  = solid working form, minor refinements available.',
  '  · 55-74  = functional but with at least one technical issue limiting transfer or risking attrition.',
  '  · 30-54  = significant mechanical flaw present, regress load or fix pattern first.',
  '  · 0-29   = pattern is unsafe at any load; stop and reset.',
  '- kinematic_flags — EXACTLY 2 short, specific physical observations. Each cites an anatomic landmark or load-path detail. Examples: "Lumbar spine in mild flexion at the bottom of the descent." / "Bar drifting 4-6 inches forward of mid-foot at lockout." NOT "Watch your back" / "Bar path is off". Be concrete.',
  '- correction_cue — ONE actionable cue the athlete can apply on the very next rep. Imperative voice. Specific. Examples: "Brace and screw your feet into the floor before the descent — that will set your hip hinge." / "Drive your elbows under the bar 30% earlier on the catch."',
  '',
  '# CONSTRAINTS',
  '- Direct voice. No "consider", no hedging, no apologies.',
  '- If the image is unclear, mis-framed, or shows no athlete at all: form_score = 0, kinematic_flags describe what is missing/unclear, correction_cue says how to re-shoot (angle, distance, lighting).',
  '- If the lift_name does not match what is visibly happening: flag it explicitly and score against the visible movement.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    form_score: {
      type: 'integer',
      description: 'Integer 0-100. Calibrate per the system prompt scale.',
    },
    kinematic_flags: {
      type: 'array',
      description: 'EXACTLY 2 specific anatomic / load-path observations. Each cites a concrete landmark.',
      items: { type: 'string' },
    },
    correction_cue: {
      type: 'string',
      description: 'One actionable correction the athlete can apply on the next rep. Imperative voice.',
    },
  },
  required: ['form_score', 'kinematic_flags', 'correction_cue'],
  additionalProperties: false,
};

// ─── Omniscience Mock (CEO spec, verbatim) ─────────────────────────────
function adminOverrideMock() {
  return {
    form_score: 98,
    kinematic_flags: [
      'ADMIN BYPASS: Perfect spinal alignment.',
      'ADMIN BYPASS: Optimal bar path.',
    ],
    correction_cue: 'Master Override Active. Mechanics flawless. Add 10 lbs.',
  };
}

// ─── Static "no-read" default ──────────────────────────────────────────
// Returned on any upstream failure or unparseable image. Shape matches the
// schema exactly so the UI render path is single-track.
function defaultKinematicResponse(reason: string) {
  return {
    form_score: 0,
    kinematic_flags: [
      'Image could not be analyzed.',
      'Engine returned no kinematic read — ' + reason + '.',
    ],
    correction_cue: 'Re-shoot from a 45-degree angle, well-lit, full body in frame, mid-rep. Then retry.',
  };
}

// ─── Anthropic vision call w/ AbortController timeout ──────────────────
// (legacy local `callClaudeVision` + `extractTextBlock` removed ·
//  canonical helper from _shared/anthropic-call.ts replaces both ·
//  vision input rides via the new `userImages` parameter.)

function stripDataUriPrefix(s: string): string {
  // Accept either "data:image/jpeg;base64,..." or raw base64.
  const m = /^data:[^;]+;base64,(.+)$/.exec(s);
  return m ? m[1] : s;
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-kinematics] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, image_base64, mime_type, lift_name, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  if (typeof lift_name !== 'string' || !lift_name) {
    return jsonResponse({ error: 'missing_lift_name' }, 400);
  }
  if (typeof image_base64 !== 'string' || !image_base64) {
    return jsonResponse({ error: 'missing_image_base64' }, 400);
  }

  const cleanBase64 = stripDataUriPrefix(image_base64);
  // Reject obviously-oversized payloads before burning a Claude credit.
  // base64 is ~4/3 the raw byte count; safe upper-bound check on the
  // string length itself.
  if (cleanBase64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3)) {
    console.warn(`[bbf-agentic-kinematics] image too large: b64_len=${cleanBase64.length}`);
    return jsonResponse(defaultKinematicResponse('image_too_large'), 200);
  }

  const cleanMime = (typeof mime_type === 'string' && /^image\/(jpeg|jpg|png|webp|gif)$/i.test(mime_type))
    ? mime_type.toLowerCase().replace('image/jpg', 'image/jpeg')
    : 'image/jpeg';

  // ─── 2. Claude vision call ─────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-kinematics] missing ANTHROPIC_API_KEY — returning default');
    return jsonResponse(defaultKinematicResponse('config_missing'), 200);
  }

  const t0     = Date.now();
  const result = await callClaude({
    useCase:         'kinematic_form_score',
    system:          SYSTEM_PROMPT,
    userFields:      {
      lift_name:    lift_name,
      task: 'Analyze the attached image per system instructions; emit exactly 2 kinematic_flags and 1 correction_cue.',
    },
    userImages: [{ mime_type: cleanMime, data: cleanBase64 }],
    toolSchema:      RESPONSE_SCHEMA,
    toolName:        'submit_kinematic_form_score',
    toolDescription: 'Emit the biomechanics form_score 0-100 + exactly 2 kinematic_flags + 1 correction_cue.',
    maxTokens:       MAX_TOKENS,
    agentTag:        'bbf-agentic-kinematics',
    apiKey:          ANTHROPIC_API_KEY,
    timeoutMs:       CLAUDE_TIMEOUT_MS,
  });
  const dur = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-kinematics] vision failed (${result.error}) after ${dur}ms · attempts=${result.attempts} fallback_used=${result.fallback_used} — returning default`);
    return jsonResponse(defaultKinematicResponse('vision_call_failed'), 200);
  }

  const parsed = result.toolInput as { form_score?: unknown; kinematic_flags?: unknown; correction_cue?: unknown } | null;

  // Shape check — enforce form_score range + 2-element kinematic_flags
  // (Anthropic tool_use schema can't express numerical min/max or array
  // length constraints; we enforce here at parse time).
  if (
    !parsed ||
    typeof parsed.form_score !== 'number' ||
    !Array.isArray(parsed.kinematic_flags) ||
    parsed.kinematic_flags.length !== 2 ||
    typeof parsed.correction_cue !== 'string'
  ) {
    console.warn(`[bbf-agentic-kinematics] tool_use shape mismatch (got ${JSON.stringify(parsed).slice(0,200)}) — returning default`);
    return jsonResponse(defaultKinematicResponse('schema_mismatch'), 200);
  }

  const clampedScore = Math.max(0, Math.min(100, Math.round(parsed.form_score)));

  console.log(`[bbf-agentic-kinematics] uid=${uid} · lift="${lift_name}" · score=${clampedScore} · b64_len=${cleanBase64.length} · model=${result.model} · attempts=${result.attempts} · fallback_used=${result.fallback_used} · duration=${dur}ms · usage=${JSON.stringify(result.usage)}`);

  return jsonResponse({
    form_score:      clampedScore,
    kinematic_flags: parsed.kinematic_flags.slice(0, 2),
    correction_cue:  parsed.correction_cue,
  }, 200);
});
