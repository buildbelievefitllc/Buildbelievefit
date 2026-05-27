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
//
// Phase 6.0h-followup (this commit) · raw fetch to Anthropic deleted ·
// canonical `callClaude` from _shared/anthropic-call.ts replaces it ·
// `cardiac_intercept` use-case routes to OPUS per model-router · the
// Opus-tier fallback policy is `null` (CEO directive · never demote
// medical reasoning to a weaker model on transient failure · retry
// on Opus and surface the failure if Anthropic itself is down).
// `fallbackOverride: null` is passed explicitly at the call site so a
// future edit to FALLBACK_POLICY can never silently demote this
// surface · code-as-policy defense in depth.
import { callClaude } from '../_shared/anthropic-call.ts';

const MAX_TOKENS         = 1024;
const CLAUDE_TIMEOUT_MS  = 12000;
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

// (legacy local `callClaude` + `extractTextBlock` removed in this commit ·
//  the canonical `_shared/anthropic-call.ts` helper handles fetch +
//  retry + per-use-case fallback + armor wrap + tool_use extraction.)

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

  const t0     = Date.now();
  const result = await callClaude({
    useCase:         'cardiac_intercept',
    system:          SYSTEM_PROMPT,
    userFields:      {
      athlete_uid:        uid,
      available_minutes:  String(minutes),
      strategy_tier:      strategyTier,
      tier_short_label:   shortLabel,
      task: [
        '1. Pick the best gym modality for this tier.',
        `2. Write a precise minute-by-minute protocol that fits EXACTLY into ${minutes} minutes.`,
        '3. Write a one-sentence Sovereign Toast explaining the physiological ROI.',
        `Append " — ${shortLabel}" to your modality string so the athlete sees the tier on screen.`,
      ].join('\n'),
    },
    toolSchema:      RESPONSE_SCHEMA,
    toolName:        'submit_cardio_protocol',
    toolDescription: 'Emit the cardio modality + minute-by-minute protocol + ROI toast for the deterministically routed strategy tier.',
    maxTokens:       MAX_TOKENS,
    agentTag:        'bbf-agentic-cardio',
    apiKey:          ANTHROPIC_API_KEY,
    // CEO directive · Opus-tier safety-critical · NEVER demote on
    // transient failure · the resilience layer retries on Opus and
    // surfaces the failure if Anthropic is fully down. Setting this
    // explicitly (rather than relying on the FALLBACK_POLICY default
    // for `cardiac_intercept`) is defense-in-depth code-as-policy.
    fallbackOverride: null,
    timeoutMs:       CLAUDE_TIMEOUT_MS,
  });
  const dur = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-cardio] Claude failed (${result.error}) after ${dur}ms · attempts=${result.attempts} fallback_used=${result.fallback_used} — returning default`);
    return jsonResponse(defaultCardioResponse(minutes, 'claude_failed'), 200);
  }

  const parsed = result.toolInput as { modality?: unknown; protocol?: unknown; roi_toast?: unknown } | null;
  if (
    !parsed ||
    typeof parsed.modality  !== 'string' ||
    typeof parsed.protocol  !== 'string' ||
    typeof parsed.roi_toast !== 'string'
  ) {
    console.warn(`[bbf-agentic-cardio] tool_use shape mismatch — returning default. got=${JSON.stringify(parsed).slice(0,200)}`);
    return jsonResponse(defaultCardioResponse(minutes, 'schema_mismatch'), 200);
  }

  console.log(`[bbf-agentic-cardio] uid=${uid} · minutes=${minutes} · tier=${shortLabel} · modality="${parsed.modality}" · model=${result.model} · attempts=${result.attempts} · fallback_used=${result.fallback_used} · duration=${dur}ms · usage=${JSON.stringify(result.usage)}`);

  return jsonResponse({
    modality:  parsed.modality,
    protocol:  parsed.protocol,
    roi_toast: parsed.roi_toast,
  }, 200);
});
