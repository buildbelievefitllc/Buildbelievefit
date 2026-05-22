// bbf-agentic-interrogator — MOAB 3 · The Routine Interrogator
// ─────────────────────────────────────────────────────────────────────
// Public-facing lead-gen agent. The prospect pastes their current
// workout split; Claude Opus 4.7 plays the role of a ruthless but
// clinical exercise scientist who DOES NOT rewrite the routine —
// instead, it surfaces 2–3 specific programming gaps, contrasts BBF's
// proprietary systems against those gaps, and lands on a hard
// recommendation to upgrade to Gateway or Architect.
//
// Output shape — three required sections per CEO directive:
//   gaps              — 2-3 clinical programming failures
//   sovereign_contrast— how BBF's systems solve those gaps
//   verdict           — hard tier recommendation
//
// Frictionless: no email gate, no captcha, no rate limit beyond the
// shared apikey gate inherited from the public publishable key.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-interrogator
//   Content-Type: application/json
//   Body: { "routine": string, "session_id"?: string }
//
// Response shape (200 OK):
//   {
//     "gaps":               [{ title, body }, ...],
//     "sovereign_contrast": [{ system, body }, ...],
//     "verdict": {
//       "headline":     string,
//       "recommended_tier": "gateway" | "architect",
//       "rationale":    string
//     }
//   }
//
// FAILURE POSTURE: every code path returns HTTP 200 with a graceful
// fallback object explaining the engine couldn't process.

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

// Phase 7 Workstream B · Routine audit · single-turn interview with
// structured output. Sonnet 4.6 is the right tier per CEO routing.
import { routeAndLog } from '../_shared/model-router.ts';

const MODEL           = routeAndLog('bbf-agentic-interrogator', 'onboarding_interview');
const MAX_TOKENS      = 2048;
const EFFORT_DEFAULT  = 'high';
const CLAUDE_TIMEOUT_MS = 16000;
const MAX_ROUTINE_LEN = 4000;

const SYSTEM_PROMPT = [
  'You are the BBF Routine Interrogator — a ruthless but clinically precise exercise scientist auditing a prospect\'s current training routine. You hold credentials in occupational therapy, exercise physiology, and NASM-CPT biomechanics. You speak with the directness of a strength coach who has audited 10,000 programs and knows exactly where they fail.',
  '',
  '# CRITICAL CONSTRAINTS',
  '- You DO NOT rewrite the prospect\'s workout. You do not prescribe replacement exercises, sets, or reps. That is paid work.',
  '- You DO NOT hedge, soften, or congratulate. No "great start", no "solid foundation". The prospect came here for a clinical audit, not validation.',
  '- You DO surface the specific structural gaps in their programming and contrast them against BBF\'s proprietary systems.',
  '- You DO end with a hard recommendation to upgrade.',
  '',
  '# REQUIRED OUTPUT STRUCTURE — three sections, no preamble',
  '',
  '## (1) GAPS — 2 to 3 entries',
  'Identify SPECIFIC programming failures in the routine they pasted. Each entry has a short `title` (3-6 words, all caps, clinical) and a `body` (1-3 sentences) explaining the failure in measurable, biomechanical terms. Draw from this audit framework:',
  '  · JUNK VOLUME — sets that don\'t contribute to the stated stimulus (e.g. 4 sets of cable lateral raises after a heavy push day).',
  '  · MISSING OT PREHAB — no joint capsule work, no thoracic mobility, no scapular control work between heavy compound days.',
  '  · OVERLAPPING JOINT STRESS — back-to-back days that load the same joint (e.g. heavy squats then heavy deadlifts with no decompression).',
  '  · NO PERIODIZATION — same load / volume week to week with no taper, deload, or wave progression.',
  '  · ENERGY-SYSTEM MISMATCH — heavy strength work on the same day as long Zone-2 cardio (cancels the strength signal).',
  '  · UNILATERAL BLIND SPOT — only bilateral compounds, no single-leg or single-arm work to correct asymmetries.',
  '  · VOLUME / FREQUENCY INVERSION — too few weekly sets per muscle group for hypertrophy, OR too many to recover from.',
  '  · NEURAL OVERLOAD — daily CNS-demanding work (squats, deadlifts, oly lifts) with no parasympathetic shift programmed in.',
  '  · NUTRITION OMISSION — no fueling or recovery nutrition mentioned alongside the loading pattern.',
  'Pick the 2-3 failures that are the LOUDEST in the actual text the prospect pasted. Quote or reference specific exercises/days from their routine when you can — it proves you read it.',
  '',
  '## (2) SOVEREIGN CONTRAST — 2 to 3 entries (mirror the GAPS count)',
  'For each gap, name ONE BBF proprietary system that solves it. Each entry has a `system` field (the proprietary name, exactly as listed below) and a `body` (1-3 sentences) explaining the mechanism by which that system closes the gap. Available systems — use the exact name:',
  '  · DYNAMIC PREHAB MATRIX — daily 3-movement OT-informed recovery protocol that adapts to the day\'s load and the athlete\'s reported friction zone. Closes the prehab gap before it becomes injury.',
  '  · HYPERTROPHY HEATMAP — 4-week axial load + volume tracker per muscle group + joint. Surfaces junk volume and overlapping joint stress in real time. Architect-tier and above.',
  '  · MIDNIGHT HAIKU ENGINE — nightly briefing engine that reads the prospect\'s 24h log + readiness state and writes the next day\'s adjustment. Eliminates the "same routine every week" inversion.',
  '  · SOVEREIGN COMLINK — voice-rewrite agent. State a friction or constraint mid-session; the engine rewrites the day\'s exercises while preserving the stimulus.',
  '  · CNS FRICTION SCORE — autonomic readiness reading that gates heavy CNS work when systemic load is already redlined.',
  '  · BIOMECHANICAL HEALTH MATRIX — 4-week per-lift heatmap (squat, deadlift, OHP, bench). Flags repeated joint stress before tissue debt compounds.',
  '  · OT-INFORMED FRICTION SCANNER — keyword-aware override that swaps heavy compounds for decompression + mobility when CNS or spinal load is flagged.',
  '  · POSITIONAL INTELLIGENCE COMLINK — athletic-improvement query that returns founder-verified drills filtered to the prospect\'s sport + position.',
  '  · KINEMATIC FORM HUD — vision-agent form audit that flags valgus collapse, anterior pelvic tilt, and ACL shear during the actual lift.',
  '',
  '## (3) VERDICT — single object',
  'A hard tier recommendation, no hedging.',
  '  · `headline` — ONE direct sentence (under 110 chars) naming the tier and the verdict (e.g. "Architect Hybrid. Stop guessing — start auditing every variable.").',
  '  · `recommended_tier` — exactly "gateway" OR "architect".',
  '    Pick gateway when the routine shows basic structural issues + the prospect is solo / self-coaching and needs the habit architecture engine + Dynamic Prehab Matrix.',
  '    Pick architect when the routine shows compounded gaps (3 of the failures above) + the prospect needs the full Hypertrophy Heatmap + Midnight Haiku + coach check-ins.',
  '  · `rationale` — 1-2 sentences explaining why that specific tier closes the specific gaps you surfaced above. Reference at least one gap and one system by name.',
  '',
  '# VOICE',
  '- Clinical. Direct. Sovereign brand voice.',
  '- No exclamation marks. No emoji. No "consider", no "may want to", no "honestly".',
  '- Quote the prospect\'s specific exercises / days when you can.',
  '- If the input is empty, gibberish, or not a workout (e.g. "test", "abc", a sentence asking a question): return a graceful audit explaining you need a real routine to audit, with a verdict pointing to Gateway as the entry path.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown headings, no preamble, no closing remarks.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      description: '2-3 clinical programming failures in the prospect\'s routine.',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short all-caps title (3-6 words).' },
          body:  { type: 'string', description: 'Clinical 1-3 sentence explanation referencing specific exercises/days from the prospect\'s routine.' },
        },
        required: ['title', 'body'],
      },
    },
    sovereign_contrast: {
      type: 'array',
      description: 'BBF proprietary systems that solve each gap. Same count as gaps.',
      minItems: 2,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          system: { type: 'string', description: 'BBF system name, exactly as listed in the prompt.' },
          body:   { type: 'string', description: '1-3 sentence explanation of how this system closes the matched gap.' },
        },
        required: ['system', 'body'],
      },
    },
    verdict: {
      type: 'object',
      properties: {
        headline:         { type: 'string', description: 'One direct sentence naming the tier and the verdict. Under 110 chars.' },
        recommended_tier: { type: 'string', enum: ['gateway', 'architect'], description: 'Exactly "gateway" or "architect".' },
        rationale:        { type: 'string', description: '1-2 sentences linking gap → system → tier.' },
      },
      required: ['headline', 'recommended_tier', 'rationale'],
    },
  },
  required: ['gaps', 'sovereign_contrast', 'verdict'],
  additionalProperties: false,
};

// ─── Static fallback if the upstream call fails ───────────────────────
function defaultFallback(reason: string) {
  return {
    gaps: [
      { title: 'AUDIT ENGINE OFFLINE',     body: 'The interrogator could not complete the clinical read (reason: ' + reason + '). Your routine was received but not analyzed in this transmission.' },
      { title: 'PROGRAMMING UNCERTAINTY',  body: 'Without the audit, the structural risk in your current split is unknown. Most routines we receive show at least two of the eight common failures: junk volume, missing prehab, overlapping joint stress, or no periodization.' },
    ],
    sovereign_contrast: [
      { system: 'DYNAMIC PREHAB MATRIX',   body: 'Daily 3-movement OT-informed recovery protocol — runs regardless of the audit so the prehab gap closes from day one.' },
      { system: 'MIDNIGHT HAIKU ENGINE',   body: 'Nightly readiness briefing that adjusts the next day\'s load based on actual recovery state. Eliminates the same-week-every-week trap.' },
    ],
    verdict: {
      headline:         'Gateway tier. Open the architecture — the audit re-runs the moment the engine\'s back online.',
      recommended_tier: 'gateway',
      rationale:        'The Dynamic Prehab Matrix and Midnight Haiku Engine are the two systems every BBF tier starts with — they close the universal gaps before custom programming layers on top.',
    },
  };
}

// ─── Anthropic call w/ AbortController timeout ────────────────────────
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
      console.error(`[bbf-agentic-interrogator] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-interrogator] Claude fetch threw: ${reason}`);
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

// ─── Handler ──────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { routine, session_id } = payload || {};
  if (typeof routine !== 'string' || !routine.trim()) {
    return jsonResponse({ error: 'missing_routine' }, 400);
  }

  const safeRoutine = routine.slice(0, MAX_ROUTINE_LEN);
  const safeSession = (typeof session_id === 'string' && session_id) ? session_id.slice(0, 64) : 'anonymous';

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-interrogator] missing ANTHROPIC_API_KEY — returning fallback');
    return jsonResponse(defaultFallback('config_missing'), 200);
  }

  const userMessage =
    '## prospect routine submission\n' +
    'session_id: ' + safeSession + '\n' +
    'length_chars: ' + safeRoutine.length + '\n\n' +
    '```\n' + safeRoutine + '\n```\n\n' +
    'Audit per your system instructions. Return ONLY the JSON schema response — { gaps, sovereign_contrast, verdict }.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-interrogator] Claude failed (${result.error}) after ${dur}ms — returning fallback`);
    return jsonResponse(defaultFallback('claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-interrogator] no text block in response — returning fallback');
    return jsonResponse(defaultFallback('no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-interrogator] parse failed (${(e as Error).message}) — returning fallback`);
    return jsonResponse(defaultFallback('parse_failed'), 200);
  }

  if (
    !parsed ||
    !Array.isArray(parsed.gaps) || parsed.gaps.length < 2 ||
    !Array.isArray(parsed.sovereign_contrast) || parsed.sovereign_contrast.length < 2 ||
    !parsed.verdict || typeof parsed.verdict !== 'object' ||
    typeof parsed.verdict.headline !== 'string' ||
    (parsed.verdict.recommended_tier !== 'gateway' && parsed.verdict.recommended_tier !== 'architect') ||
    typeof parsed.verdict.rationale !== 'string'
  ) {
    console.warn(`[bbf-agentic-interrogator] schema shape mismatch — fallback. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultFallback('schema_mismatch'), 200);
  }

  // Defensive shape coercion — trim and stringify every field.
  const cleanGaps = parsed.gaps.slice(0, 3).map((g: any) => ({
    title: String((g && g.title) || 'Gap').slice(0, 80),
    body:  String((g && g.body)  || '').slice(0, 600),
  }));
  const cleanContrast = parsed.sovereign_contrast.slice(0, 3).map((c: any) => ({
    system: String((c && c.system) || 'BBF System').slice(0, 80),
    body:   String((c && c.body)   || '').slice(0, 600),
  }));
  const cleanVerdict = {
    headline:         String(parsed.verdict.headline).slice(0, 200),
    recommended_tier: parsed.verdict.recommended_tier,
    rationale:        String(parsed.verdict.rationale).slice(0, 400),
  };

  console.log(`[bbf-agentic-interrogator] session=${safeSession} · routine_len=${safeRoutine.length} · gaps=${cleanGaps.length} · contrast=${cleanContrast.length} · tier=${cleanVerdict.recommended_tier} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    gaps:               cleanGaps,
    sovereign_contrast: cleanContrast,
    verdict:            cleanVerdict,
  }, 200);
});
