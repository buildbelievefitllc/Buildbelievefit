// bbf-agentic-prehab — Dynamic Prehab Matrix (Phase 4)
// ─────────────────────────────────────────────────────────────────────
// Reads the athlete's last 48 hours of bbf_readiness telemetry (sleep_quality,
// soreness_level), asks Claude Opus 4.7 to produce a 3-step daily recovery
// protocol prioritizing CNS recovery, tissue repair, and hypertrophy readiness.
//
// SCHEMA NOTES:
//   - bbf_readiness uses `timestamp` (timestamptz), NOT `created_at`. Confirmed
//     via information_schema; Phase B re-route (§12 PR #171) corrected the
//     column mapping in this session's prior work.
//   - 48-hour window: timestamp.gte.<now-48h> · order=timestamp.desc
//
// FAILURE POSTURE:
//   - Omniscience Protocol is the FIRST gate; admin_override=true skips BOTH
//     the DB read AND the Anthropic call, returning a multi-tier mock so the
//     UI render can be eyeballed without burning API credits.
//   - On any non-2xx, parse failure, missing config, or 12s timeout: return
//     the static "Default Baseline Recovery Protocol" payload with
//     source="fallback". Per directive: do NOT crash the client — every code
//     path returns a valid PrehabMatrix payload at HTTP 200.
//
// Request shape:
//   POST /functions/v1/bbf-agentic-prehab
//   Content-Type: application/json
//   X-BBF-Admin-Token: <optional shared secret>
//   Body:
//   {
//     "uid": "jacque_bbf",        // required (slug or UUID)
//     "admin_override": false     // optional · true → Omniscience bypass
//   }

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

const MODEL                  = 'claude-opus-4-7';
const MAX_TOKENS             = 2048;
const EFFORT_DEFAULT         = 'high';
const CLAUDE_TIMEOUT_MS      = 12000;
const READINESS_WINDOW_HOURS = 48;

const SYSTEM_PROMPT = [
  'You are the BBF Dynamic Prehab Matrix. The athlete is reviewing their recovery directive for the day. They are a hypertrophy-focused lifter and your prescription MUST prioritize central nervous system (CNS) recovery, tissue repair, and readiness for their next progressive-overload session.',
  '',
  '# WHAT YOU RECEIVE',
  '- A 48-hour rolling window of bbf_readiness rows: sleep_quality (0-10), soreness_level (0-10), timestamp.',
  '- Derived metrics: sleep_avg, soreness_avg, sample_count.',
  '',
  '# HOW TO READ THE TELEMETRY',
  '- sleep_quality_avg >= 7 AND soreness_level_avg <= 4 → Tier 1 (Active Recovery). Light mobility + standard hydration + low-intensity blood flow.',
  '- sleep_quality_avg 5-6 OR soreness_level_avg 5-7 → Tier 2 (Tissue Repair). Targeted mobility for the fatigued zones, electrolyte-forward rehydration, contrast modalities.',
  '- sleep_quality_avg < 5 OR soreness_level_avg > 7 → Tier 3 (Deload). Parasympathetic-priming mobility only, aggressive sodium-forward rehydration, NSDR or passive recovery.',
  '',
  '# WHAT YOU RETURN — EXACTLY 3 STEPS IN THIS ORDER',
  '1. mobility — title, detail (one tactical sentence: what to do, where, what to feel), duration_minutes (integer 5-25), intensity ("low" | "moderate" | "high")',
  '2. hydration — title, detail (one tactical sentence: what fluid, when, why now), target_oz (integer 16-128), electrolyte_focus ("sodium" | "potassium" | "magnesium" | "balanced")',
  '3. active_recovery — title, detail (one tactical sentence), duration_minutes (integer 10-45), modality (e.g. "walking", "swim", "cycling", "NSDR", "sauna", "cold plunge")',
  '',
  '# OUTPUT FIELDS',
  '- protocol_tier — exactly one of: "Tier 1 — Active Recovery", "Tier 2 — Tissue Repair", "Tier 3 — Deload".',
  '- cns_status — ONE sentence describing the athlete\'s current CNS state and what the protocol is targeting. Direct coach voice.',
  '- hypertrophy_priming — ONE sentence linking today\'s recovery to tomorrow\'s lift readiness. Example: "Clears posterior-chain DOMS so tomorrow\'s pull volume lands on fresh tissue."',
  '',
  '# CONSTRAINTS',
  '- Direct voice. No "consider", "perhaps", "you may". Imperatives only.',
  '- Never prescribe a movement that loads a fatigued joint. If soreness is high, the mobility vector is decompression / capsule work, NOT loaded ROM.',
  '- Numerical fields are integers within the given ranges. Never null, never strings.',
  '',
  'Return ONLY structured JSON matching the response schema. No markdown, no preamble.',
].join('\n');

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    protocol_tier: {
      type: 'string',
      description: 'One of "Tier 1 — Active Recovery", "Tier 2 — Tissue Repair", "Tier 3 — Deload" — matched to telemetry.',
    },
    cns_status: {
      type: 'string',
      description: 'One-sentence read on the athlete\'s current CNS state. Direct coach voice.',
    },
    steps: {
      type: 'array',
      description: 'Exactly 3 steps, in order: mobility, hydration, active_recovery.',
      items: {
        type: 'object',
        properties: {
          vector:            { type: 'string',  description: '"mobility" | "hydration" | "active_recovery"' },
          title:             { type: 'string',  description: 'Short directive title (3-6 words).' },
          detail:            { type: 'string',  description: 'One tactical sentence — what to do.' },
          duration_minutes:  { type: 'integer', description: 'Integer minutes. Omit for hydration step.' },
          intensity:         { type: 'string',  description: '"low" | "moderate" | "high" — mobility step only.' },
          target_oz:         { type: 'integer', description: 'Integer oz. Hydration step only.' },
          electrolyte_focus: { type: 'string',  description: '"sodium" | "potassium" | "magnesium" | "balanced" — hydration step only.' },
          modality:          { type: 'string',  description: 'e.g. "walking" — active_recovery step only.' },
        },
        required: ['vector', 'title', 'detail'],
      },
    },
    hypertrophy_priming: {
      type: 'string',
      description: 'One sentence linking today\'s recovery to tomorrow\'s lift readiness.',
    },
  },
  required: ['protocol_tier', 'cns_status', 'steps', 'hypertrophy_priming'],
  additionalProperties: false,
};

// ─── Static "Default Baseline Recovery Protocol" ───────────────────────
// Returned on ANY upstream failure (Anthropic non-2xx, timeout, parse fail,
// missing config, no readiness data, uid unresolvable). Per directive: do
// not crash the client — every code path must return a valid PrehabMatrix
// payload at HTTP 200.
function defaultBaselineProtocol() {
  return {
    protocol_tier: 'Default Baseline',
    cns_status:    'Insufficient telemetry — defaulting to the universal recovery floor. Log Morning Lab Audit to unlock personalized prescriptions.',
    steps: [
      {
        vector:           'mobility',
        title:            'Full-Body Reset Flow',
        detail:           'Cat-cow x10, 90/90 hip switches x8/side, wall slides x10. Slow tempo — feel each segment move.',
        duration_minutes: 8,
        intensity:        'low',
      },
      {
        vector:            'hydration',
        title:             'Electrolyte-Forward Rehydration',
        detail:            'Drink 32 oz water with a balanced electrolyte mix (sodium + potassium + magnesium) within the hour.',
        target_oz:         32,
        electrolyte_focus: 'balanced',
      },
      {
        vector:           'active_recovery',
        title:            'Zone 2 Walk',
        detail:           'Walk 20 minutes at conversational pace. Nasal breathing only — drives parasympathetic tone.',
        duration_minutes: 20,
        modality:         'walking',
      },
    ],
    hypertrophy_priming: 'Baseline recovery clears systemic fatigue and primes the CNS for the next progressive-overload session.',
    source:              'fallback',
    generated_at:        new Date().toISOString(),
  };
}

// ─── Omniscience Mock — Multi-Tier Stress Test ─────────────────────────
// Returned when admin_override=true. Designed to exercise every UI render
// surface: long titles, max-range numerical fields, atypical modality,
// saturated tier label, all step-shape fields populated.
function adminOverrideMock() {
  return {
    protocol_tier: 'ADMIN OVERRIDE — Multi-Tier Stress Test',
    cns_status:    'OMNISCIENCE PROTOCOL ACTIVE. CNS bypass engaged — rendering full UI stress matrix across all three recovery vectors. Telemetry pipeline skipped; Anthropic API spared.',
    steps: [
      {
        vector:           'mobility',
        title:            'Posterior-Chain Decompression Sweep',
        detail:           'Thoracic foam-roller passes x10, deep squat hold x60s, 90/90 hip mobilization x8/side. Find resistance, breathe through it for two cycles.',
        duration_minutes: 25,
        intensity:        'high',
      },
      {
        vector:            'hydration',
        title:             'Sodium-Forward Rehydration Bolus',
        detail:            'Drink 128 oz water across the next 4 hours with 1.5g sodium total. Front-load the first 32 oz within 20 minutes.',
        target_oz:         128,
        electrolyte_focus: 'sodium',
      },
      {
        vector:           'active_recovery',
        title:            'Contrast Sauna → Plunge Cycle',
        detail:           'Sauna 12 min at 180°F, cold plunge 2 min at 50°F, repeat for 3 rounds. Finish in the cold.',
        duration_minutes: 45,
        modality:         'contrast sauna/plunge',
      },
    ],
    hypertrophy_priming: 'ADMIN OVERRIDE: this stress-test payload exercises every visual surface — long titles, max numerical fields, saturated tier label — so the UI render can be verified end-to-end without burning a single API credit.',
    source:              'admin_override',
    generated_at:        new Date().toISOString(),
  };
}

// ─── Slug → UUID resolver (mirrors Phase 2/3 pattern) ──────────────────
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
      console.error(`[bbf-agentic-prehab] uid_map RPC failed: HTTP ${res.status}`);
      return null;
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) {
      if (r && r.uid === uid && r.id) return r.id;
    }
    return null;
  } catch (e) {
    console.error(`[bbf-agentic-prehab] uid_map RPC error: ${(e as Error).message}`);
    return null;
  }
}

// ─── 48-hour readiness fetch ───────────────────────────────────────────
async function fetchReadinessWindow(
  uuid: string,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<Array<{ sleep_quality: number | null; soreness_level: number | null; timestamp: string | null }> | null> {
  const sinceIso = new Date(Date.now() - READINESS_WINDOW_HOURS * 3600 * 1000).toISOString();
  const select = 'sleep_quality,soreness_level,timestamp';
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&timestamp=gte.${encodeURIComponent(sinceIso)}&select=${select}&order=timestamp.desc`;
  const url = `${supabaseUrl}/rest/v1/bbf_readiness?${qs}`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey':        supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
      },
    });
    if (!res.ok) {
      console.error(`[bbf-agentic-prehab] readiness fetch failed: HTTP ${res.status} ${await res.text()}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`[bbf-agentic-prehab] readiness fetch error: ${(e as Error).message}`);
    return null;
  }
}

function avg(nums: Array<number | null | undefined>): number | null {
  const clean = nums.filter((n) => typeof n === 'number' && !Number.isNaN(n)) as number[];
  if (!clean.length) return null;
  return clean.reduce((a, b) => a + b, 0) / clean.length;
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
      console.error(`[bbf-agentic-prehab] Anthropic API error: status=${res.status} body=${JSON.stringify(body)}`);
      return { ok: false as const, status: res.status, error: errMsg, raw: body };
    }
    return { ok: true as const, status: res.status, body };
  } catch (e) {
    const err = e as Error;
    const reason = err.name === 'AbortError' ? `timeout_${CLAUDE_TIMEOUT_MS}ms` : err.message;
    console.error(`[bbf-agentic-prehab] Claude fetch threw: ${reason}`);
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
      console.warn('[bbf-agentic-prehab] rejected: bad/missing X-BBF-Admin-Token');
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); }
  catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uidRaw        = payload?.uid;
  const adminOverride = !!payload?.admin_override;

  if (typeof uidRaw !== 'string' || !uidRaw) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }

  // ─── 1. OMNISCIENCE PROTOCOL — ABSOLUTE FIRST GATE ─────────────
  // Per CEO directive: admin_override=true bypasses BOTH the DB read AND
  // the Anthropic call. Returns the multi-tier stress-test mock so the UI
  // render can be eyeballed at full resolution without burning credits.
  if (adminOverride) {
    return jsonResponse(adminOverrideMock(), 200);
  }

  // ─── 2. Pull last 48h of readiness ─────────────────────────────
  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('[bbf-agentic-prehab] missing Supabase config — returning baseline fallback');
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  const uuid = await resolveUuid(uidRaw, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!uuid) {
    console.warn(`[bbf-agentic-prehab] uid not resolvable: ${uidRaw} — returning baseline fallback`);
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  const readiness = await fetchReadinessWindow(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!readiness || !readiness.length) {
    console.warn(`[bbf-agentic-prehab] no readiness rows in last ${READINESS_WINDOW_HOURS}h for ${uidRaw} — returning baseline fallback`);
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  const sleepAvg    = avg(readiness.map((r) => r.sleep_quality));
  const sorenessAvg = avg(readiness.map((r) => r.soreness_level));
  const sampleCount = readiness.length;

  // ─── 3. Claude call ────────────────────────────────────────────
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) {
    console.error('[bbf-agentic-prehab] missing ANTHROPIC_API_KEY — returning baseline fallback');
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  const userMessage =
    'Athlete telemetry — last ' + READINESS_WINDOW_HOURS + ' hours of bbf_readiness rows:\n\n' +
    '```json\n' + JSON.stringify({
      sleep_avg:    sleepAvg,
      soreness_avg: sorenessAvg,
      sample_count: sampleCount,
      rows:         readiness,
    }, null, 2) + '\n```\n\n' +
    'Hypertrophy-focused lifter. Generate today\'s 3-step recovery protocol. Return ONLY the JSON schema response.';

  const t0     = Date.now();
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY);
  const dur    = Date.now() - t0;

  if (!result.ok) {
    console.warn(`[bbf-agentic-prehab] Claude failed (${result.error}) after ${dur}ms — returning baseline fallback`);
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  const respBody: any = result.body;
  const text = extractTextBlock(respBody?.content);
  if (!text) {
    console.warn('[bbf-agentic-prehab] no text block in response — returning baseline fallback');
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch (e) {
    console.warn(`[bbf-agentic-prehab] parse failed (${(e as Error).message}) — returning baseline fallback`);
    return jsonResponse(defaultBaselineProtocol(), 200);
  }

  console.log(`[bbf-agentic-prehab] uid=${uidRaw} · samples=${sampleCount} · sleep_avg=${sleepAvg?.toFixed(1)} · soreness_avg=${sorenessAvg?.toFixed(1)} · tier=${parsed.protocol_tier} · model=${respBody.model} · duration=${dur}ms · usage=${JSON.stringify(respBody.usage)}`);

  return jsonResponse({
    protocol_tier:       parsed.protocol_tier,
    cns_status:          parsed.cns_status,
    steps:               parsed.steps,
    hypertrophy_priming: parsed.hypertrophy_priming,
    source:              'claude',
    generated_at:        new Date().toISOString(),
  }, 200);
});
