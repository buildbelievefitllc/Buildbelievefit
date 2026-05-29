// bbf-agentic-cardio — Smart Cardio Engine (Phase 10)
// ─────────────────────────────────────────────────────────────────────
// Proactive cardio protocol generator. The athlete inputs how many
// minutes they have. The edge function uses DETERMINISTIC LOGIC to pick
// the modality tier (HIIT vs Tempo vs LISS) — the strategy is not left
// to Claude. Claude then generates a specific minute-by-minute protocol
// + a "Sovereign Toast" explaining the physiological ROI.
//
// Deterministic router (CEO spec):
//   available_minutes < 20  → HIIT  (Max EPOC)
//   available_minutes <= 35 → Tempo (Caloric Burn)
//   available_minutes > 35  → LISS / Zone 2 (Fat Oxidation & CNS Sparing)
//
// Request shape:
//   POST /functions/v1/bbf-agentic-cardio
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "akeem",
//     "available_minutes": 18,
//     "admin_override": false
//   }
//
// Response shape (200 OK):
//   {
//     "modality":  string,   // gym machine + tier label e.g. "Assault Bike — HIIT"
//     "protocol":  string,   // minute-by-minute breakdown, multiline allowed
//     "roi_toast": string    // one-sentence physiological ROI summary
//   }

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

// Phase 7 Workstream B · Cardio routing is PAR-Q+ adjacent (cardiac
// inference is forbidden to AI; the engine pre-filters via PAR-Q+
// classification then asks Claude to ONLY narrate the routing).
// Opus 4.7 stays per CEO routing rules · cardiac safety is one of
// the three categories that earn peak reasoning.
import { routeAndLog } from '../_shared/model-router.ts';

const MODEL              = routeAndLog('bbf-agentic-cardio', 'cardiac_intercept');
const MAX_TOKENS         = 1024;
const EFFORT_DEFAULT     = 'high';
const CLAUDE_TIMEOUT_MS  = 20000;
const MIN_MINUTES        = 5;
const MAX_MINUTES        = 120;

const SYSTEM_PROMPT = [
  'You are the BBF Smart Cardio Engine — an elite endurance coach generating a precise, minute-by-minute cardio protocol that fits PERFECTLY into the athlete\'s available time window. The strategy tier (HIIT / Tempo / LISS) has already been deterministically chosen by the platform; you do NOT override it. Your job is to pick the best gym modality and write the protocol.',
  '',
  '# WHAT YOU RECEIVE',
  '- available_minutes — exact time budget (integer).',
  '- strategy_tier — the mandated approach. One of:',
  '  · "High-Intensity Interval Training (Max EPOC)" — work/rest ratios favoring 1:1 or 2:1, total work output capped by anaerobic capacity. Choose modalities that can sustain near-maximal output safely (assault bike, rower, sled, kettlebell complex, jump rope, sprint intervals).',
  '  · "Moderate/Tempo Work (Caloric Burn)" — sustained 75-85% effort. Choose modalities that hold tempo cleanly (treadmill incline walk-run, stair mill, elliptical, rower at steady pace).',
  '  · "Low-Intensity Steady State / Zone 2 (Fat Oxidation & CNS Sparing)" — conversational pace, 60-70% effort. Choose modalities that minimize joint stress and let the athlete sustain for the full duration (incline walk, stationary bike Zone 2, swim, elliptical).',
  '',
  '# WHAT YOU RETURN',
  '- modality — gym machine + tier-label appended. Format: "<Machine name> — <Tier short label>". Examples: "Assault Bike — HIIT", "Treadmill — Tempo", "Incline Walk — Zone 2". Pick ONE modality; do not list options.',
  '- protocol — minute-by-minute (or interval-by-interval) breakdown. Use compact lines, one per phase. Examples:',
  '  · "0:00–2:00   Warm-up · easy pace, RPE 4"',
  '  · "2:00–3:00   Sprint #1 · max effort, 90% incline / 8 mph"',
  '  · "3:00–4:00   Recovery · walk 3.5 mph"',
  '  ... fitting EXACTLY into the available_minutes total. The last line\'s end-time MUST equal available_minutes.',
  '- roi_toast — ONE sentence explaining the specific physiological return on investment for THIS session. Example: "9 mins of work above ventilatory threshold triggers 12-18h of elevated EPOC — fat oxidation continues long after you step off."',
  '',
  '# CONSTRAINTS',
  '- Total protocol duration MUST equal available_minutes. Do the arithmetic.',
  '- Include a warm-up phase (1-3 min) and a cool-down phase (1-3 min) where the strategy allows it. For sub-12-minute sessions, compress warm-up to 1 min.',
  '- Use real gym equipment. Don\'t invent novel machines.',
  '- Direct voice. Imperative. No hedging.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    modality:  { type: 'string', description: 'Single gym modality with tier label appended. Format: "<Machine> — <Tier>".' },
    protocol:  { type: 'string', description: 'Minute-by-minute breakdown. Multiline. Total duration must equal available_minutes.' },
    roi_toast: { type: 'string', description: 'One-sentence physiological ROI summary.' },
  },
  required: ['modality', 'protocol', 'roi_toast'],
  additionalProperties: false,
};

// ─── Deterministic Router (CEO directive — do NOT let Claude pick) ─────
function routeStrategy(minutes: number): { tier: string; shortLabel: string } {
  if (minutes < 20) {
    return { tier: 'High-Intensity Interval Training (Max EPOC)', shortLabel: 'HIIT' };
  }
  if (minutes <= 35) {
    return { tier: 'Moderate/Tempo Work (Caloric Burn)', shortLabel: 'Tempo' };
  }
  return { tier: 'Low-Intensity Steady State / Zone 2 (Fat Oxidation & CNS Sparing)', shortLabel: 'Zone 2' };
}

// ─── Omniscience Mock (CEO spec, verbatim) ─────────────────────────────
function adminOverrideMock() {
  return {
    modality:  'ADMIN BYPASS: Assault Bike',
    protocol:  '10x 30s Sprint / 30s Rest',
    roi_toast: 'Master Key Active. EPOC triggered. Fat oxidation maximized.',
  };
}

// ─── Static fallback by tier — protocol matches the router's pick ──────
function defaultCardioResponse(minutes: number, reason: string) {
  const { shortLabel } = routeStrategy(minutes);
  if (shortLabel === 'HIIT') {
    const intervals = Math.max(4, Math.floor((minutes - 4) / 1));  // 1-min cycles after warm-up/cool-down
    return {
      modality:  'Assault Bike — HIIT',
      protocol:
        '0:00–2:00   Warm-up · easy pace, RPE 4\n' +
        '2:00–' + (2 + intervals) + ':00   ' + intervals + ' rounds · 30s max effort / 30s recovery\n' +
        (2 + intervals) + ':00–' + minutes + ':00   Cool-down · easy spin',
      roi_toast: 'Sub-' + minutes + 'min EPOC bomb (' + reason + ' fallback). Anaerobic capacity work triggers prolonged post-session fat oxidation.',
    };
  }
  if (shortLabel === 'Tempo') {
    return {
      modality:  'Treadmill — Tempo',
      protocol:
        '0:00–3:00     Warm-up walk · 3.5 mph, 2% incline\n' +
        '3:00–' + (minutes - 3) + ':00   Tempo · 6.0 mph at 4% incline, hold RPE 7\n' +
        (minutes - 3) + ':00–' + minutes + ':00   Cool-down · 3.0 mph flat',
      roi_toast: minutes + '-min tempo block (' + reason + ' fallback) hits the caloric-burn sweet spot without redlining the CNS.',
    };
  }
  return {
    modality:  'Incline Walk — Zone 2',
    protocol:
      '0:00–3:00     Warm-up · 3.0 mph, flat\n' +
      '3:00–' + (minutes - 3) + ':00   Zone 2 · 3.5 mph at 8% incline, nasal breathing only\n' +
      (minutes - 3) + ':00–' + minutes + ':00   Cool-down · 3.0 mph flat',
    roi_toast: minutes + '-min Zone 2 (' + reason + ' fallback) maximizes mitochondrial density and fat oxidation while sparing CNS for tomorrow\'s lift.',
  };
}

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
      { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
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
    try { body = await res.json(); } catch (_) { body = null; }

    if (!res.ok) {
      const errMsg = (body && body.error && (body.error.message || body.error.type)) || `anthropic_${res.status}`;
      console.error(`[bbf-agentic-cardio] Anthropic API error: status=${res.status} body=${JSON.stringify(body).slice(0,600)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-cardio] Claude fetch threw: ${reason}`);
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent !== expectedToken) {
      console.warn('[bbf-agentic-cardio] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const { uid, available_minutes, admin_override } = payload || {};

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  if (admin_override === true) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  if (typeof uid !== 'string' || !uid) return jsonResponse({ error: 'missing_uid' }, 400);

  // Coerce + clamp available_minutes into [MIN, MAX]. Treats strings,
  // floats, garbage all defensively. CEO didn't spec floor/ceiling but
  // a 0-min or 999-min request is nonsensical for cardio programming.
  let minutes = Number(available_minutes);
  if (!isFinite(minutes) || minutes <= 0) {
    return jsonResponse({ error: 'invalid_minutes' }, 400);
  }
  minutes = Math.max(MIN_MINUTES, Math.min(MAX_MINUTES, Math.round(minutes)));

  // ─── 2. Deterministic Router (NEVER delegated to Claude) ───────
  const { tier: strategyTier, shortLabel } = routeStrategy(minutes);

  // ─── 3. Claude call — generates modality + protocol + ROI toast ─
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-cardio] missing ANTHROPIC_API_KEY — returning default');
    return jsonResponse(defaultCardioResponse(minutes, 'config_missing'), 200);
  }

  const userMessage =
    'available_minutes: ' + minutes + '\n' +
    'strategy_tier (mandated by deterministic router — DO NOT OVERRIDE): "' + strategyTier + '"\n' +
    'tier_short_label: "' + shortLabel + '"\n\n' +
    '1. Pick the best gym modality for this tier.\n' +
    '2. Write a precise minute-by-minute protocol that fits EXACTLY into ' + minutes + ' minutes.\n' +
    '3. Write a one-sentence Sovereign Toast explaining the physiological ROI.\n\n' +
    'Append " — ' + shortLabel + '" to your modality string so the athlete sees the tier on screen.\n\n' +
    'Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-cardio] Claude failed (${result.error}) after ${dur}ms — returning default`);
    return jsonResponse(defaultCardioResponse(minutes, 'claude_failed'), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-cardio] no text block in response — returning default');
    return jsonResponse(defaultCardioResponse(minutes, 'no_text_block'), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); } catch (e) {
    console.warn(`[bbf-agentic-cardio] parse failed (${(e as Error).message}) — returning default`);
    return jsonResponse(defaultCardioResponse(minutes, 'parse_failed'), 200);
  }

  if (
    !parsed ||
    typeof parsed.modality !== 'string'  ||
    typeof parsed.protocol !== 'string'  ||
    typeof parsed.roi_toast !== 'string'
  ) {
    console.warn(`[bbf-agentic-cardio] schema shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultCardioResponse(minutes, 'schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-cardio] uid=${uid} · minutes=${minutes} · tier=${shortLabel} · modality="${parsed.modality}" · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    modality:  parsed.modality,
    protocol:  parsed.protocol,
    roi_toast: parsed.roi_toast,
  }, 200);
});
