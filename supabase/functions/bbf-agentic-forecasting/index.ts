// bbf-agentic-forecasting v6 — Predictive Trajectory + OT Signal (Phase 3 + Phase 4)
// ─────────────────────────────────────────────────────────────────────
// Reads the athlete's recent bbf_sets (last ~60 sets, descending by
// day_key for trajectory relevance), asks Claude Opus 4.7 to project
// their 1RM 30 days out for a named lift, returns a confidence score
// and a one-sentence training micro-adjustment.
//
// Phase 4 EXTENSION · Autonomous Periodization (Task 4):
//   · Computes a deterministic OT (overtraining) signal in parallel
//     with the 1RM forecast: 7-day acute set volume vs 28-day chronic
//     average + heaviest-set RPE trend.
//   · When OT signal is detected (acute_to_chronic > 1.4 with
//     sustained RPE ≥ 8.5 across the last 6 sessions), POSTs to
//     bbf-agentic-peaking with intent=restructure so the restructure
//     proposal is STAGED to bbf_pending_review for founder approval.
//     NEVER live · gated through the proposal queue.
//   · The 1RM response shape stays unchanged for backward compat;
//     `ot_signal` is an ADDITIONAL field (optional consumers can
//     ignore it).
//   · Explicit `intent: 'systemic_ot_scan'` skips the 1RM Claude call
//     entirely and returns just the OT signal for the BBF_PROGRAM_INTEL
//     dashboard widget.
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

// Phase 7 Workstream B · 1RM linear-regression narration · the math is
// deterministic upstream; Claude just narrates the trajectory. Haiku
// 4.5 is the right tier per CEO routing.
import { routeAndLog } from '../_shared/model-router.ts';
import { localeDirective, localeCode } from '../_shared/locale.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';

const MODEL          = routeAndLog('bbf-agentic-forecasting', 'forecast_1rm');
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

// ─── Phase 4 · Deterministic OT signal computation ────────────────────
// Pure math · no LLM. Acute (7d) vs chronic (28d) set volume ratio +
// heaviest-set RPE trend across the last 6 sessions. Triggers when:
//   · acute_to_chronic > 1.4  (volume spike past Gabbett caution zone)
//   · RPE_recent_avg ≥ 8.5    (sustained heavy intent)
//   · session_count_recent ≥ 6 (enough signal · avoid first-session false alarms)
const OT_ACUTE_DAYS         = 7;
const OT_CHRONIC_DAYS       = 28;
const OT_AC_RATIO_THRESHOLD = 1.4;
const OT_RPE_THRESHOLD      = 8.5;
const OT_MIN_SESSIONS       = 6;

function _dayKeyToTs(dk: string | null): number | null {
  if (!dk || typeof dk !== 'string') return null;
  const dayStr = dk.split('_d')[0] || '';
  if (!dayStr) return null;
  const ts = new Date(dayStr + 'T12:00:00').getTime();
  return isNaN(ts) ? null : ts;
}

function computeOtSignal(setsData: Array<any>): {
  detected: boolean;
  ac_ratio: number | null;
  rpe_recent_avg: number | null;
  session_count_recent: number;
  rationale: string;
  acute_volume: number;
  chronic_volume: number;
} {
  if (!Array.isArray(setsData) || setsData.length === 0) {
    return {
      detected: false, ac_ratio: null, rpe_recent_avg: null,
      session_count_recent: 0, rationale: 'no_sets_data',
      acute_volume: 0, chronic_volume: 0,
    };
  }
  const nowMs = Date.now();
  const acuteCutoff   = nowMs - OT_ACUTE_DAYS   * 86400000;
  const chronicCutoff = nowMs - OT_CHRONIC_DAYS * 86400000;

  let acuteVol = 0, chronicVol = 0;
  const acuteSessions = new Set<string>();
  const rpeValues: number[] = [];

  for (const s of setsData) {
    const ts = _dayKeyToTs(s && s.day_key);
    if (ts == null) continue;
    const reps = Number(s.reps) || 0;
    const weight = Number(s.weight_lbs) || 0;
    const setVol = reps * (weight > 0 ? weight : 1);
    if (ts >= chronicCutoff) chronicVol += setVol;
    if (ts >= acuteCutoff) {
      acuteVol += setVol;
      acuteSessions.add(s.day_key);
      if (s.rpe != null && Number(s.rpe) > 0) rpeValues.push(Number(s.rpe));
    }
  }
  // Mean-daily normalization · acute/chronic ratio per Gabbett
  const acuteMean   = acuteVol   / OT_ACUTE_DAYS;
  const chronicMean = chronicVol / OT_CHRONIC_DAYS;
  const acRatio = chronicMean > 0 ? (acuteMean / chronicMean) : null;
  const rpeAvg  = rpeValues.length > 0
    ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length
    : null;
  const sessionCount = acuteSessions.size;

  const ratioBreach   = acRatio != null && acRatio > OT_AC_RATIO_THRESHOLD;
  const rpeBreach     = rpeAvg  != null && rpeAvg  >= OT_RPE_THRESHOLD;
  const enoughSignal  = sessionCount >= OT_MIN_SESSIONS;
  const detected      = enoughSignal && ratioBreach && rpeBreach;

  let rationale = 'no_breach';
  if (!enoughSignal) rationale = 'insufficient_sessions:' + sessionCount + '/' + OT_MIN_SESSIONS;
  else if (detected) rationale = 'ac_ratio=' + (acRatio || 0).toFixed(2) + ' (>' + OT_AC_RATIO_THRESHOLD + ') · rpe_recent=' + (rpeAvg || 0).toFixed(1) + ' (>=' + OT_RPE_THRESHOLD + ')';
  else if (ratioBreach && !rpeBreach) rationale = 'volume_spike_without_rpe_confirmation:ac=' + (acRatio || 0).toFixed(2);
  else if (rpeBreach && !ratioBreach) rationale = 'rpe_high_without_volume_spike:rpe=' + (rpeAvg || 0).toFixed(1);

  return {
    detected,
    ac_ratio:               acRatio,
    rpe_recent_avg:         rpeAvg,
    session_count_recent:   sessionCount,
    rationale,
    acute_volume:           acuteVol,
    chronic_volume:         chronicVol,
  };
}

// ─── Phase 4 · Peaking fan-out for OT-triggered restructure ───────────
// Calls bbf-agentic-peaking with intent=restructure so the restructure
// is computed and STAGED to bbf_pending_review (founder approval).
// Best-effort · forecasting response succeeds even if this fails so
// the 1RM trajectory is never starved by a peaking outage.
async function fanOutToPeaking(
  uidRaw: string,
  otSignal: ReturnType<typeof computeOtSignal>,
  supabaseUrl: string,
): Promise<{ staged: boolean; proposal_id: string | null; error?: string }> {
  const adminToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
    const res = await fetch(`${supabaseUrl}/functions/v1/bbf-agentic-peaking`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        uid:    uidRaw,
        intent: 'restructure',
        ot_signal: otSignal,
        admin_override: false,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.error(`[bbf-agentic-forecasting] peaking fan-out HTTP ${res.status}: ${txt.slice(0,300)}`);
      return { staged: false, proposal_id: null, error: `peaking_http_${res.status}` };
    }
    const j = await res.json().catch(() => null) as any;
    return {
      staged:      !!(j && j.staged),
      proposal_id: (j && j.proposal_id) || null,
    };
  } catch (e) {
    console.error(`[bbf-agentic-forecasting] peaking fan-out threw: ${(e as Error).message}`);
    return { staged: false, proposal_id: null, error: (e as Error).message };
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
async function callClaude(userMessage: string, apiKey: string, localeInput: string) {
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
      { type: 'text', text: localeDirective(localeInput, 'the agent_insight narrative') },
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
  const locale = localeCode(payload?.locale ?? payload?.lang);
  const intent    = (payload && typeof payload.intent === 'string') ? payload.intent : null;
  const adminOverride = !!payload?.admin_override;

  if (typeof uidRaw !== 'string' || !uidRaw) {
    return jsonResponse({ error: 'missing_uid' }, 400);
  }
  // lift_name is required for the default 1RM forecast path · for the
  // pure OT-scan intent it's optional (the OT signal is lift-agnostic).
  if (intent !== 'systemic_ot_scan' && (typeof liftName !== 'string' || !liftName)) {
    return jsonResponse({ error: 'missing_lift_name' }, 400);
  }

  // ─── HARD ENTITLEMENT GATE (FAIL-CLOSED) — before ANY core logic ───────────────
  // Protects the JSON forecast engine from direct scraping. Identity is resolved
  // SERVER-SIDE from the vault bearer token (the body `uid` is never trusted for
  // auth); requires biokinetic_forecast (Autonomous+). God Mode passes. Missing
  // token → 401, invalid/expired → 401, unentitled/locked → 403 — before any DB
  // read or Claude call. (Runs before admin_override so the bypass can't be forged.)
  const gate = await requireEntitlement({
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    serviceKey:  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    vaultToken:  payload?.vault_token ?? req.headers.get('x-bbf-vault-token'),
    feature:     'biokinetic_forecast',
  });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);

  // ─── 1. ENFORCE OMNISCIENCE PROTOCOL ───────────────────────────
  if (adminOverride) {
    return jsonResponse({
      projected_1rm:    'ADMIN BYPASS: 500 lbs',
      confidence_score: '100%',
      agent_insight:    'Master Override Active. Trajectory limits removed.',
      ot_signal:        { detected: false, admin_override: true },
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

  // ─── Phase 4 · Compute OT signal in parallel · stage to peaking ──
  // Computed FIRST so it's available on both the early-return data-
  // insufficient path and the full Claude 1RM path. When detected,
  // fan out to peaking for restructure staging — best-effort.
  const otSignal = computeOtSignal(setsData || []);
  let peakingStaging: { staged: boolean; proposal_id: string | null; error?: string } | null = null;
  if (otSignal.detected) {
    peakingStaging = await fanOutToPeaking(uidRaw, otSignal, SUPABASE_URL);
    console.log(`[bbf-agentic-forecasting] OT detected · uid=${uidRaw} · ratio=${(otSignal.ac_ratio || 0).toFixed(2)} · rpe=${(otSignal.rpe_recent_avg || 0).toFixed(1)} · peaking_staged=${peakingStaging && peakingStaging.staged}`);
  }
  const otSignalForResponse = Object.assign({}, otSignal, {
    staged_proposal_id: peakingStaging ? peakingStaging.proposal_id : null,
    peaking_error:      peakingStaging && peakingStaging.error || null,
  });

  // ─── Phase 4 · systemic_ot_scan early exit · skip 1RM Claude ─────
  // BBF_PROGRAM_INTEL dashboard widget hits this path when it just
  // wants the OT signal · no need to burn tokens on the 1RM forecast.
  if (intent === 'systemic_ot_scan') {
    return jsonResponse({
      ot_signal:        otSignalForResponse,
      projected_1rm:    null,
      confidence_score: null,
      agent_insight:    null,
      sets_inspected:   (setsData || []).length,
    }, 200);
  }

  if (!setsData || setsData.length < MIN_SETS_REQUIRED) {
    return jsonResponse({
      projected_1rm:    'N/A',
      confidence_score: 'Low',
      agent_insight:    'Insufficient data velocity. Complete 3 more sessions to unlock forecasting.',
      ot_signal:        otSignalForResponse,
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
  const result = await callClaude(userMessage, ANTHROPIC_API_KEY, locale);
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

  // Frontend expects the bare 3-field shape per the original scaffold;
  // Phase 4 adds an OPTIONAL ot_signal field that consumers can ignore.
  // Surface the LLM fields directly; debug metadata stays in console.
  return jsonResponse({
    locale,
    projected_1rm:    parsed.projected_1rm,
    confidence_score: parsed.confidence_score,
    agent_insight:    parsed.agent_insight,
    ot_signal:        otSignalForResponse,
  }, 200);
});
