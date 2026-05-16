// bbf-co-coach — Co-Coach Intelligence Agent Edge Function (Pivot 3).
// ─────────────────────────────────────────────────────────────────────
// Receives a Founder-5 telemetry bundle from BBF_COACH_AGENT in
// mastermind-portal.html, asks Claude Opus 4.7 to analyze it as a sharp
// assistant coach, and returns structured JSON insights ready for the
// frontend to render in Sprint 3.
//
// Request shape:
//   POST /functions/v1/bbf-co-coach
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret, see BBF_COACH_AGENT_TOKEN>
//   Body:
//   {
//     "bundles": [
//       { "uid": "ana_bbf", "name": "Ana", "uuid": "...",
//         "sessions": [...], "sets": [...], "readiness": [...],
//         "audits": [...], "somatic_readiness_score": 78 },
//       ...
//     ]
//   }
//
// Response shape (200 OK):
//   {
//     "ok": true,
//     "analysis": {
//       "headline": "...",
//       "insights": [
//         { "uid", "name", "category", "priority", "summary",
//           "evidence", "recommendation" }, ...
//       ]
//     },
//     "model": "claude-opus-4-7",
//     "usage": { input_tokens, output_tokens, cache_read_input_tokens, ... }
//   }
//
// Errors return non-2xx with { "error": "<slug>", "detail"?: "..." }.

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
// Per skill defaults: Claude Opus 4.7 is the most capable model and the
// recommended default for non-trivial reasoning. CEO directive emphasized
// "real, intelligent LLM" — Opus 4.7 honors that. Adaptive thinking is
// the only thinking mode supported on 4.7. Effort `high` is the minimum
// recommended for intelligence-sensitive work. Structured output via
// output_config.format guarantees the frontend gets a parseable JSON.
const MODEL          = 'claude-opus-4-7';
const MAX_TOKENS     = 8192;
const EFFORT_DEFAULT = 'high';

// Stable system prompt — cacheable. Changes here invalidate the cache,
// so resist the urge to tweak per-request.
const SYSTEM_PROMPT = [
  'You are the BBF Co-Coach Intelligence Agent — a sharp assistant coach reporting to Head Coach Akeem Brown, founder of Build Believe Fit. You analyze the Founder 5 client roster and surface the insights the head coach needs to act on TODAY.',
  '',
  '# DATA SHAPE',
  'You receive a JSON array of per-client bundles, each containing the last 21 days of telemetry:',
  '- uid (slug), name, uuid',
  '- sessions: bbf_logs rows (id, date, type, tier_phases, coach_notes)',
  '- sets:     bbf_sets rows (log_id FK, exercise_key like "ex_42", weight_lbs, reps, day_key)',
  '- readiness: bbf_readiness rows (date, sleep, stress, energy, score 0-100 CNS readiness)',
  '- audits:    open pain/concern signals (movement_name, tension_zone, coach_notes)',
  '- somatic_readiness_score: latest live profile CNS snapshot',
  '',
  '# WHAT TO ANALYZE',
  '1. CNS / Somatic readiness trends — 7d avg, consecutive sub-70 scores, deteriorating patterns',
  '2. Workout performance — flat weight progression on the same exercise_key across 3+ sessions, declining reps, plateau patterns',
  '3. Consistency — session count last 7d vs prior 7d, days since last session, hot streaks',
  '4. Pain / friction signals — keywords in audit fields or session coach_notes (knee, lower back, shoulder, tweak, sharp, twinge, flare, stiff)',
  '',
  '# WHAT TO REPORT',
  'Per CEO standing directives, the head coach wants:',
  '- Who is progressing well and WHY (specific evidence — numbers, dates, exercise IDs)',
  '- Who is struggling or plateauing and on WHAT (specific exercise, specific metric)',
  '- Recovery concerns with the specific readiness numbers',
  '- Clients needing special attention this week',
  '- Specific actionable recommendations — concrete next steps, not platitudes',
  '',
  '# PRIORITY WEIGHTING (CEO RULING)',
  'Pain/Friction and Recovery Risks carry the HIGHEST weight. Use the 0-100 integer:',
  '- Acute pain signals (sharp, tweak, sudden):    80-95',
  '- Multi-day recovery slump or pain audit:       70-90',
  '- Consistency drop ≥40% from prior week:        40-65',
  '- Plateau on a specific lift (3+ sessions flat): 25-55',
  '- Healthy progress worth surfacing:             15-40',
  'Sort insights by priority DESCENDING so the head coach sees urgent items first.',
  '',
  '# VOICE',
  '- Direct. Useful. Zero hedging or empty validation.',
  '- You report TO the head coach, not the client. Use first names ("Wayne", "Jordan").',
  '- Cite specific numbers, dates, and exercise IDs. Example: "Wayne averaged 64 readiness across May 8-14, with 4 consecutive sub-70 submits." NOT "Wayne\'s readiness is low."',
  '- Recommendations are concrete and immediate: "Drop Jordan\'s RDL to 85lb for the next session and add a tempo cue on the eccentric." NOT "Consider regression."',
  '- Exercise IDs come through as raw keys ("ex_42") — emit them verbatim; the frontend will resolve display names in Sprint 3.',
  '',
  '# CONSTRAINTS',
  '- Do NOT fabricate data. If a client has zero readiness submits, say so — don\'t invent trends.',
  '- Do NOT include clients with nothing actionable. The head coach reads every line — don\'t pad.',
  '- Do NOT moralize or apologize. No "It\'s important to note that...". Coaches don\'t have time.',
  '- Return ONLY structured JSON conforming to the response schema. No markdown, no preamble.',
].join('\n');

// JSON Schema for the structured response. Constrains the LLM output so
// the frontend can JSON.parse() without defensive code.
//
// Anthropic structured-output JSON Schema does NOT support numerical
// constraints (minimum / maximum / multipleOf) — the Python/TS SDKs
// strip them client-side, but raw fetch (our path) does not. Passing
// them through returns a 400. Constraints we'd like to enforce here
// live in the field `description` instead; the LLM respects them.
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: {
      type: 'string',
      description: 'One-sentence summary of the roster\'s state today, sharp-assistant-coach voice.',
    },
    insights: {
      type: 'array',
      description: 'Per-client actionable insights, sorted by priority descending.',
      items: {
        type: 'object',
        properties: {
          uid:    { type: 'string', description: 'Client slug, e.g. "jordan_bbf"' },
          name:   { type: 'string', description: 'Display first name' },
          category: {
            type: 'string',
            enum: ['progressing', 'plateau', 'consistency_drop', 'recovery_concern', 'pain_signal', 'needs_attention'],
            description: 'Insight category. Pain/recovery → highest priority.',
          },
          priority: {
            type: 'integer',
            description: 'Priority score on a 0-100 scale (inclusive). Higher = more urgent. Pain/recovery 70-95, consistency drop 40-65, plateau 25-55, healthy progress 15-40 per CEO ruling.',
          },
          summary: {
            type: 'string',
            description: 'One-line punchline the head coach can scan in 2 seconds.',
          },
          evidence: {
            type: 'string',
            description: 'Specific data points — numbers, dates, exercise_keys — backing the insight.',
          },
          recommendation: {
            type: 'string',
            description: 'Concrete, immediate next action for the head coach. Specific weight, set, or check-in.',
          },
        },
        required: ['uid', 'name', 'category', 'priority', 'summary', 'evidence', 'recommendation'],
        additionalProperties: false,
      },
    },
  },
  required: ['headline', 'insights'],
  additionalProperties: false,
};

// ─── Anthropic call ────────────────────────────────────────────────────
async function callClaude(bundles: unknown[], apiKey: string) {
  const userPayload = JSON.stringify({ bundles }, null, 2);
  const userMessage =
    'Analyze the following Founder 5 roster telemetry (last 21 days) and report insights per your system instructions. ' +
    'Return ONLY JSON matching the response schema.\n\n' +
    '```json\n' + userPayload + '\n```';

  const requestBody = {
    model:      MODEL,
    max_tokens: MAX_TOKENS,
    thinking:   { type: 'adaptive' },
    output_config: {
      effort: EFFORT_DEFAULT,
      format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
    },
    // Cacheable system prompt — stable across requests, dominant cost.
    // Top-level cache_control auto-places on the last cacheable block.
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
    console.error(`[bbf-co-coach] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
    return { ok: false as const, status: res.status, error: errMsg, raw: body };
  }
  return { ok: true as const, status: res.status, body };
}

// Extract the first text-type content block. Opus 4.7 thinking blocks
// stream but are display: omitted by default — the response payload still
// has them as content blocks, just with empty text. Pick the first one
// where type === "text".
function extractTextBlock(content: any[]): string | null {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string') {
      return block.text;
    }
  }
  return null;
}

// ─── Omniscience Mock — Multi-Tier Stress Test ─────────────────────────
// Returned when admin_override=true. Exercises every UI surface in the
// Co-Coach narrative: headline hero, all 6 category enum values
// (progressing / plateau / consistency_drop / recovery_concern /
// pain_signal / needs_attention), priority spread from 95 down to 28,
// concrete evidence with exercise_keys + dates + numbers, direct-voice
// recommendations. Lets the head coach eyeball the render without
// burning Opus tokens.
function adminOverrideMock() {
  return {
    ok: true,
    analysis: {
      headline: 'OMNISCIENCE PROTOCOL ACTIVE — full-spectrum roster stress test, 6 insights across every category. Anthropic API spared.',
      insights: [
        {
          uid:            'wayne_bbf',
          name:           'Wayne',
          category:       'pain_signal',
          priority:       94,
          summary:        'Acute lower-back tweak on Day-2 RDLs — flagged twice this week.',
          evidence:       'Audit logged 2026-05-15 (movement_name=ex_42 RDL, tension_zone=lumbar). Coach_notes on 2026-05-13 + 2026-05-14 sessions both mention "low back tight, cut volume short".',
          recommendation: 'Pull Wayne off conventional RDL for the next 2 sessions. Sub in supported single-leg RDL at 50% load, 3x8. Re-evaluate Friday before reintroducing.',
        },
        {
          uid:            'jordan_bbf',
          name:           'Jordan',
          category:       'recovery_concern',
          priority:       87,
          summary:        '5 consecutive sub-65 readiness submits — CNS is buried.',
          evidence:       'bbf_readiness scores May 11-15: 62 / 58 / 64 / 61 / 59. Sleep_quality avg 4.2, soreness_level avg 7.4. Last full deload was 22 days ago.',
          recommendation: 'Cut next session\'s top set by 15% and add a 24-hour rest insertion. Hold Jordan\'s squat volume flat for the week — no PR attempts.',
        },
        {
          uid:            'jacque_bbf',
          name:           'Jacquelyn',
          category:       'plateau',
          priority:       54,
          summary:        'Incline DB Press stuck at 25lb x 8-10 for 4 consecutive sessions.',
          evidence:       'bbf_sets exercise_key=ex_3, sessions 2026-05-08, 05-10, 05-12, 05-14 all weight_lbs=25, reps=8-10. RPE trending 7.5 → 8.5 (subjective fatigue rising without weight progression).',
          recommendation: 'Drop to 22.5lb for 3x12 with a 3-second eccentric for one session to re-establish motor pattern, then re-attempt 27.5lb x 6-8 next week.',
        },
        {
          uid:            'ana_bbf',
          name:           'Ana',
          category:       'consistency_drop',
          priority:       48,
          summary:        '2 sessions logged last 7d vs 4 the prior week — 50% drop.',
          evidence:       'bbf_logs dates 2026-05-10, 2026-05-13 only. No readiness submits since 2026-05-14. Streak counter went from 11 to 0.',
          recommendation: 'Send Ana a check-in DM today. If life event, offer a 2-day mini-block to restore rhythm. If no response by tomorrow, escalate to call.',
        },
        {
          uid:            'jacky_bbf',
          name:           'Jacky',
          category:       'progressing',
          priority:       32,
          summary:        'Hit a new 5RM on ex_7 Goblet Squat — clean tempo, RPE 8.',
          evidence:       'bbf_sets 2026-05-14: weight_lbs=45, reps=5, day_key=2026-05-14_d1. Prior PR was 40lb x 5 on 2026-04-30. Treadmill cardio compliance 3/3 this week.',
          recommendation: 'Acknowledge the PR Friday. Next session, programmatically bump goblet to 47.5lb x 5 — momentum is real.',
        },
        {
          uid:            'wayne_bbf',
          name:           'Wayne',
          category:       'needs_attention',
          priority:       28,
          summary:        'Partner-mode set logging out of sync with Jordan\'s — audit if persistent.',
          evidence:       'Wayne\'s last 3 sessions show 0 partner-shared sets despite the partner=jordan_bbf link. Either Wayne is solo-lifting or _appendSetsForUid aggregator missed a write.',
          recommendation: 'Spot-check Wayne\'s session next time you\'re on the floor. Confirm the partner toggle is engaged in the UI before sets start.',
        },
      ],
    },
    model:       'admin_override_mock',
    usage:       { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
    duration_ms: 0,
    source:      'admin_override',
  };
}

// ─── Handler ───────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  // Optional admin-token gate. Matches Phase 10 Nutrition Rotator pattern.
  // Set BBF_COACH_AGENT_TOKEN in Supabase secrets and send it in the
  // X-BBF-Admin-Token header to lock the endpoint to admin callers.
  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-co-coach] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  // ─── OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ────────────────
  // Per CEO directive: admin_override=true bypasses BOTH the bundle
  // validation AND the Anthropic call. Returns the multi-tier stress-test
  // mock so the head coach can eyeball the narrative render without
  // burning Opus tokens on a 21-day, 5-client telemetry analysis.
  if (payload && payload.admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-co-coach] missing ANTHROPIC_API_KEY in Supabase secrets.');
    return jsonResponse({ error: 'config_missing_anthropic_key' }, 503);
  }

  const bundles = Array.isArray(payload?.bundles) ? payload.bundles : null;
  if (!bundles || bundles.length === 0) {
    return jsonResponse({ error: 'no_bundles', detail: 'POST body must include a non-empty `bundles` array.' }, 400);
  }
  if (bundles.length > 50) {
    return jsonResponse({ error: 'too_many_bundles', detail: 'Max 50 client bundles per call.' }, 400);
  }

  const t0 = Date.now();
  const result = await callClaude(bundles, ANTHROPIC_API_KEY);
  const dur = Date.now() - t0;

  if (!result.ok) {
    return jsonResponse({ error: 'anthropic_call_failed', detail: result.error, status: result.status, raw: result.raw }, 502);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.error(`[bbf-co-coach] no text block in Anthropic response. content=${JSON.stringify(respBody?.content)}`);
    return jsonResponse({ error: 'no_text_block_in_response', raw: respBody }, 502);
  }

  let analysis: unknown;
  try { analysis = JSON.parse(text); }
  catch (e) {
    console.error(`[bbf-co-coach] failed to parse JSON from Claude response: ${(e as Error).message}. text=${text.slice(0, 400)}`);
    return jsonResponse({ error: 'parse_failed', detail: (e as Error).message, raw_text: text }, 502);
  }

  console.log(`[bbf-co-coach] ok · bundles=${bundles.length} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);
  return jsonResponse({
    ok:       true,
    analysis,
    model:    respBody.model,
    usage:    respBody.usage,
    duration_ms: dur,
  }, 200);
});
