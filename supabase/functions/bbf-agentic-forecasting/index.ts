// bbf-agentic-forecasting — Predictive Trajectory + OT Signal (gated).
// ─────────────────────────────────────────────────────────────────────
// CALCULATOR-OFF-LLM (wave 1): the 1RM projection is now produced by the
// deterministic BBF forecast engine (_shared/forecast-engine.mjs) —
// Epley + Brzycki 1RM estimation and OLS linear-regression trend. NO
// Anthropic call. The OT (overtraining) signal and the 6-week progression
// were already pure math; this removes the last LLM dependency here.
//
// HARD ENTITLEMENT GATE: requires biokinetic_forecast (Autonomous+) before any
// DB read. LIVE: returns a real 6-week progression from bbf_sets.
//
// Response shape (unchanged · drop-in):
//   { locale, projected_1rm, confidence_score, agent_insight, ot_signal, progression }

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { localeCode } from '../_shared/locale.ts';
import { requireEntitlement } from '../_shared/entitlement-gate.ts';
import { forecastLift } from '../_shared/forecast-engine.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-bbf-vault-token, x-client-info',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const SET_LIMIT = 60;
const MIN_SETS_REQUIRED = 3;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(s: string): boolean { return UUID_RE.test(s); }
async function resolveUuid(uid: string, supabaseUrl: string, supabaseKey: string): Promise<string | null> {
  if (isUuid(uid)) return uid;
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/bbf_get_uid_map`, {
      method: 'POST',
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) { console.error(`[bbf-agentic-forecasting] uid_map RPC failed: HTTP ${res.status}`); return null; }
    const rows = await res.json();
    if (!Array.isArray(rows)) return null;
    for (const r of rows) { if (r && r.uid === uid && r.id) return r.id; }
    return null;
  } catch (e) { console.error(`[bbf-agentic-forecasting] uid_map RPC error: ${(e as Error).message}`); return null; }
}

const OT_ACUTE_DAYS = 7;
const OT_CHRONIC_DAYS = 28;
const OT_AC_RATIO_THRESHOLD = 1.4;
const OT_RPE_THRESHOLD = 8.5;
const OT_MIN_SESSIONS = 6;
function _dayKeyToTs(dk: string | null): number | null {
  if (!dk || typeof dk !== 'string') return null;
  const dayStr = dk.split('_d')[0] || '';
  if (!dayStr) return null;
  const ts = new Date(dayStr + 'T12:00:00').getTime();
  return isNaN(ts) ? null : ts;
}
function computeOtSignal(setsData: Array<any>): { detected: boolean; ac_ratio: number | null; rpe_recent_avg: number | null; session_count_recent: number; rationale: string; acute_volume: number; chronic_volume: number; } {
  if (!Array.isArray(setsData) || setsData.length === 0) {
    return { detected: false, ac_ratio: null, rpe_recent_avg: null, session_count_recent: 0, rationale: 'no_sets_data', acute_volume: 0, chronic_volume: 0 };
  }
  const nowMs = Date.now();
  const acuteCutoff = nowMs - OT_ACUTE_DAYS * 86400000;
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
    if (ts >= acuteCutoff) { acuteVol += setVol; acuteSessions.add(s.day_key); if (s.rpe != null && Number(s.rpe) > 0) rpeValues.push(Number(s.rpe)); }
  }
  const acuteMean = acuteVol / OT_ACUTE_DAYS;
  const chronicMean = chronicVol / OT_CHRONIC_DAYS;
  const acRatio = chronicMean > 0 ? (acuteMean / chronicMean) : null;
  const rpeAvg = rpeValues.length > 0 ? rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length : null;
  const sessionCount = acuteSessions.size;
  const ratioBreach = acRatio != null && acRatio > OT_AC_RATIO_THRESHOLD;
  const rpeBreach = rpeAvg != null && rpeAvg >= OT_RPE_THRESHOLD;
  const enoughSignal = sessionCount >= OT_MIN_SESSIONS;
  const detected = enoughSignal && ratioBreach && rpeBreach;
  let rationale = 'no_breach';
  if (!enoughSignal) rationale = 'insufficient_sessions:' + sessionCount + '/' + OT_MIN_SESSIONS;
  else if (detected) rationale = 'ac_ratio=' + (acRatio || 0).toFixed(2) + ' rpe_recent=' + (rpeAvg || 0).toFixed(1);
  else if (ratioBreach && !rpeBreach) rationale = 'volume_spike_without_rpe_confirmation:ac=' + (acRatio || 0).toFixed(2);
  else if (rpeBreach && !ratioBreach) rationale = 'rpe_high_without_volume_spike:rpe=' + (rpeAvg || 0).toFixed(1);
  return { detected, ac_ratio: acRatio, rpe_recent_avg: rpeAvg, session_count_recent: sessionCount, rationale, acute_volume: acuteVol, chronic_volume: chronicVol };
}

// Real 6-week progression from the athlete's logged sets (drives the LIVE chart).
function computeProgression(setsData: Array<any>): { weight: number[]; intensity: number[]; weeks: string[]; has_data: boolean } {
  const WEEKS = 6;
  const nowMs = Date.now();
  const topW: (number | null)[] = Array(WEEKS).fill(null);
  const rpeSum: number[] = Array(WEEKS).fill(0);
  const rpeCnt: number[] = Array(WEEKS).fill(0);
  let any = false;
  for (const s of (setsData || [])) {
    const ts = _dayKeyToTs(s && s.day_key);
    if (ts == null) continue;
    const ageDays = Math.floor((nowMs - ts) / 86400000);
    if (ageDays < 0 || ageDays >= WEEKS * 7) continue;
    const bucket = (WEEKS - 1) - Math.floor(ageDays / 7);
    const w = Number(s.weight_lbs) || 0;
    if (w > 0) { topW[bucket] = Math.max(topW[bucket] ?? 0, w); any = true; }
    const rpe = Number(s.rpe);
    if (isFinite(rpe) && rpe > 0) { rpeSum[bucket] += rpe; rpeCnt[bucket] += 1; }
  }
  let last: number | null = null;
  for (let i = 0; i < WEEKS; i++) { if (topW[i] == null) topW[i] = last; else last = topW[i]; }
  const firstKnown = topW.find((v) => v != null) ?? 0;
  const weight = topW.map((v) => (v == null ? firstKnown : v) as number);
  const maxW = Math.max(1, ...weight);
  const intensity = weight.map((w, i) => rpeCnt[i] > 0 ? Math.round((rpeSum[i] / rpeCnt[i]) / 10 * 100) : Math.round((w / maxW) * 100));
  const weeks = Array.from({ length: WEEKS }, (_, i) => `W${i + 1}`);
  return { weight, intensity, weeks, has_data: any };
}

async function fanOutToPeaking(uidRaw: string, otSignal: ReturnType<typeof computeOtSignal>, supabaseUrl: string): Promise<{ staged: boolean; proposal_id: string | null; error?: string }> {
  const adminToken = Deno.env.get('BBF_COACH_AGENT_TOKEN') || '';
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (adminToken) headers['X-BBF-Admin-Token'] = adminToken;
    const res = await fetch(`${supabaseUrl}/functions/v1/bbf-agentic-peaking`, {
      method: 'POST', headers,
      body: JSON.stringify({ uid: uidRaw, intent: 'restructure', ot_signal: otSignal, admin_override: false }),
    });
    if (!res.ok) { const txt = await res.text(); console.error(`[bbf-agentic-forecasting] peaking fan-out HTTP ${res.status}: ${txt.slice(0,300)}`); return { staged: false, proposal_id: null, error: `peaking_http_${res.status}` }; }
    const j = await res.json().catch(() => null) as any;
    return { staged: !!(j && j.staged), proposal_id: (j && j.proposal_id) || null };
  } catch (e) { console.error(`[bbf-agentic-forecasting] peaking fan-out threw: ${(e as Error).message}`); return { staged: false, proposal_id: null, error: (e as Error).message }; }
}

async function fetchRecentSets(uuid: string, supabaseUrl: string, supabaseKey: string): Promise<Array<{ weight_lbs: number | null; reps: number | null; day_key: string | null; exercise_key: string | null; rpe: number | null }> | null> {
  const select = 'weight_lbs,reps,day_key,exercise_key,rpe';
  const qs = `user_id=eq.${encodeURIComponent(uuid)}&select=${select}&order=day_key.desc&limit=${SET_LIMIT}`;
  const url = `${supabaseUrl}/rest/v1/bbf_sets?${qs}`;
  try {
    const res = await fetch(url, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } });
    if (!res.ok) { console.error(`[bbf-agentic-forecasting] sets fetch failed: HTTP ${res.status} ${await res.text()}`); return null; }
    return await res.json();
  } catch (e) { console.error(`[bbf-agentic-forecasting] sets fetch error: ${(e as Error).message}`); return null; }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return jsonResponse({ error: 'method_not_allowed' }, 405);

  const expectedToken = Deno.env.get('BBF_COACH_AGENT_TOKEN');
  if (expectedToken) {
    const sent = req.headers.get('x-bbf-admin-token') || '';
    if (sent && sent !== expectedToken) {
      return jsonResponse({ error: 'unauthorized' }, 401);
    }
  }

  let payload: any;
  try { payload = await req.json(); } catch (_) { return jsonResponse({ error: 'invalid_json' }, 400); }

  const uidRaw    = payload?.uid;
  const liftName  = payload?.lift_name;
  const locale = localeCode(payload?.locale ?? payload?.lang);
  const intent    = (payload && typeof payload.intent === 'string') ? payload.intent : null;
  const adminOverride = !!payload?.admin_override;

  if (typeof uidRaw !== 'string' || !uidRaw) return jsonResponse({ error: 'missing_uid' }, 400);
  if (intent !== 'systemic_ot_scan' && (typeof liftName !== 'string' || !liftName)) {
    return jsonResponse({ error: 'missing_lift_name' }, 400);
  }

  // HARD ENTITLEMENT GATE (FAIL-CLOSED) - before ANY core logic / DB read.
  const gate = await requireEntitlement({
    supabaseUrl: Deno.env.get('SUPABASE_URL'),
    serviceKey:  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    vaultToken:  payload?.vault_token ?? req.headers.get('x-bbf-vault-token'),
    feature:     'biokinetic_forecast',
  });
  if (!gate.ok) return jsonResponse({ error: gate.denial.error, detail: gate.denial.detail }, gate.denial.status);

  if (adminOverride) {
    return jsonResponse({
      projected_1rm: 'ADMIN BYPASS: 500 lbs', confidence_score: '100%',
      agent_insight: 'Master Override Active. Trajectory limits removed.',
      ot_signal: { detected: false, admin_override: true },
    });
  }

  const SUPABASE_URL         = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY');
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return jsonResponse({ error: 'config_missing_supabase' }, 503);

  const uuid = await resolveUuid(uidRaw, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  if (!uuid) return jsonResponse({ error: 'uid_not_resolvable', uid: uidRaw }, 400);

  const setsData = await fetchRecentSets(uuid, SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const otSignal = computeOtSignal(setsData || []);
  let peakingStaging: { staged: boolean; proposal_id: string | null; error?: string } | null = null;
  if (otSignal.detected) {
    peakingStaging = await fanOutToPeaking(uidRaw, otSignal, SUPABASE_URL);
  }
  const otSignalForResponse = Object.assign({}, otSignal, {
    staged_proposal_id: peakingStaging ? peakingStaging.proposal_id : null,
    peaking_error: peakingStaging && peakingStaging.error || null,
  });
  const progression = computeProgression(setsData || []);

  if (intent === 'systemic_ot_scan') {
    return jsonResponse({ ot_signal: otSignalForResponse, projected_1rm: null, confidence_score: null, agent_insight: null, sets_inspected: (setsData || []).length, progression }, 200);
  }

  if (!setsData || setsData.length < MIN_SETS_REQUIRED) {
    return jsonResponse({ projected_1rm: 'N/A', confidence_score: 'Low', agent_insight: 'Insufficient data velocity. Complete 3 more sessions to unlock forecasting.', ot_signal: otSignalForResponse, progression });
  }

  // ─── Deterministic 1RM forecast (Epley + Brzycki + OLS regression) ──
  // Drop-in replacement for the former Haiku call. Same 3-field shape.
  const parsed = forecastLift(setsData, liftName, locale);

  return jsonResponse({
    locale,
    projected_1rm: parsed.projected_1rm,
    confidence_score: parsed.confidence_score,
    agent_insight: parsed.agent_insight,
    ot_signal: otSignalForResponse,
    progression,
  }, 200);
});
