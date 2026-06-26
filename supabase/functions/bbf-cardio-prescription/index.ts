// supabase/functions/bbf-cardio-prescription/index.ts
// ═══════════════════════════════════════════════════════════════════════════
// THE CARDIO PRESCRIPTION ENGINE — Phase 10 recovery-band pre-compute. ZERO AI.
//
// Fired by the bbf_daily_protocols tripwire (pg_net → this webhook) on every
// morning readiness verdict. It:
//   1. Validates the shared-secret header (the trigger is the only caller;
//      manual/test calls pass the same X-BBF-Cardio-Secret).
//   2. Reads the day's vitals (bbf_daily_biometrics: hrv_ms, sleep_minutes) and
//      the verdict's mode + HRV baseline (from the protocol's directive_log).
//   3. Derives TODAY'S RECOVERY BAND deterministically (deriveReadinessBand —
//      the SAME band the live bbf-agentic-cardio engine computes) and CACHES it
//      in bbf_cardio_prescription (superseding any prior active row for the day).
//
// NO model-router (§4 N/A — no Claude call). Mirrors the deterministic clinical
// pattern of bbf-prescription-engine, including the bbf_app_config shared secret.
//
// LOOP-SAFE: writes ONLY bbf_cardio_prescription; the tripwire fires on
// bbf_daily_protocols → no recursion.
// Deploy with verify_jwt:false (server-to-server pg_net call; auth = shared secret).
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-cardio-secret',
};
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ══ RECOVERY BAND (inlined — canonical: _shared/cardio-readiness.ts) ══════════
type CardioTier = 'HIIT' | 'Tempo' | 'Zone 2';
type RecoveryState = 'breach' | 'strain' | 'standard' | 'prime' | 'unknown';
const STATE_RANK: Record<RecoveryState, number> = { breach: 0, strain: 1, standard: 2, prime: 3, unknown: 99 };

function stateFromScore(score: number | null): RecoveryState | null {
  if (score === null) return null;
  if (score < 40) return 'breach';
  if (score < 65) return 'strain';
  if (score < 85) return 'standard';
  return 'prime';
}
function stateFromMode(mode: string | null): RecoveryState | null {
  switch (String(mode || '').toUpperCase()) {
    case 'SYSTEM_BREACH':       return 'breach';
    case 'SYSTEM_STRAIN':       return 'strain';
    case 'STANDARD_OPERATIONS': return 'standard';
    case 'PRIME_EXECUTION':     return 'prime';
    default:                    return null;
  }
}
function bandForState(state: RecoveryState): { tier_ceiling: CardioTier | null; rpe_ceiling: number | null; work_rest_ratio: string | null; interval_directive: string } {
  switch (state) {
    case 'breach':   return { tier_ceiling: 'Zone 2', rpe_ceiling: 5, work_rest_ratio: null,  interval_directive: 'Steady-state ONLY — no intervals, no surges. Hold an even, conversational effort the entire working block.' };
    case 'strain':   return { tier_ceiling: 'Tempo',  rpe_ceiling: 7, work_rest_ratio: '1:2', interval_directive: 'Conservative, long-rest intervals at a 1:2 work-to-rest ratio. Keep the work bouts honest and the recovery generous.' };
    case 'prime':    return { tier_ceiling: null,     rpe_ceiling: 10, work_rest_ratio: '2:1', interval_directive: 'Aggressive intervals at a 2:1 work-to-rest ratio with extended work blocks — the athlete is primed to attack.' };
    case 'standard': return { tier_ceiling: null,     rpe_ceiling: 8, work_rest_ratio: '1:1', interval_directive: 'Standard intervals at a 1:1 work-to-rest ratio.' };
    default:         return { tier_ceiling: null,     rpe_ceiling: null, work_rest_ratio: null, interval_directive: 'No morning readiness on file — write the full prescription for the mandated tier.' };
  }
}
function deriveReadinessBand(input: { score?: number | null; mode?: string | null; hrv_ms?: number | null; hrv_baseline_ms?: number | null; sleep_hours?: number | null }) {
  const score = num(input.score);
  const mode = (typeof input.mode === 'string' && input.mode) ? input.mode : null;
  const hrv = num(input.hrv_ms);
  const base = num(input.hrv_baseline_ms);
  const sleep = num(input.sleep_hours);
  const hrvPct = (hrv !== null && base !== null && base > 0) ? Math.round((hrv / base) * 100) : null;
  const hrvBreach = hrvPct !== null && hrvPct < 80;
  const candidates: RecoveryState[] = [];
  const s1 = stateFromScore(score); if (s1) candidates.push(s1);
  const s2 = stateFromMode(mode);   if (s2) candidates.push(s2);
  if (hrvBreach) candidates.push('breach');
  const state: RecoveryState = candidates.length
    ? candidates.reduce((a, b) => (STATE_RANK[b] < STATE_RANK[a] ? b : a))
    : 'unknown';
  const band = bandForState(state);
  const telem: string[] = [];
  if (score !== null) telem.push(`readiness ${score}/100`);
  if (mode) telem.push(String(mode).replace(/_/g, ' ').toLowerCase());
  if (hrv !== null && hrvPct !== null) telem.push(`HRV ${hrv}ms (${hrvPct}% of baseline)`);
  if (sleep !== null) telem.push(`sleep ${sleep}h`);
  const note =
    state === 'breach'   ? `Recovery breached (${telem.join(' · ')}). Capped at Zone 2, RPE 5.` :
    state === 'strain'   ? `System strained (${telem.join(' · ')}). Capped at Tempo, RPE 7.` :
    state === 'prime'    ? `Primed (${telem.join(' · ')}). Cleared for aggressive intervals.` :
    state === 'standard' ? `Standard recovery (${telem.join(' · ')}). Full standard prescription.` :
    'No morning readiness on file — full prescription, no recovery clamp.';
  return { recovery_state: state, ...band, recovery_note: note, inputs: { score, mode, hrv_ms: hrv, hrv_baseline_ms: base, hrv_pct_of_baseline: hrvPct, sleep_hours: sleep } };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: 'config_missing' }, 503);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── Shared-secret auth (mirrors bbf-prescription-engine). Secret lives in
  //    bbf_app_config; the deploy toolset can't set function env vars. ──
  const { data: cfg } = await supabase.from('bbf_app_config').select('value').eq('key', 'cardio_prescription_secret').maybeSingle();
  const SECRET = (cfg?.value as string) || '';
  if (!SECRET) return jsonResponse({ error: 'config_missing_secret' }, 503);
  if (req.headers.get('x-bbf-cardio-secret') !== SECRET) return jsonResponse({ error: 'unauthorized' }, 401);

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400); }

  const athleteId = String(payload.athlete_id || '').trim();
  const prescribedFor = String(payload.prescribed_for || '').trim(); // 'YYYY-MM-DD'
  if (!athleteId) return jsonResponse({ error: 'missing_athlete_id' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}/.test(prescribedFor)) return jsonResponse({ error: 'missing_date' }, 400);

  const score = num(payload.readiness_score);
  const log = (payload.directive_log && typeof payload.directive_log === 'object') ? payload.directive_log as Record<string, unknown> : {};
  const mode = typeof log.mode === 'string' ? log.mode : null;
  const baselineHrv = num(log.baseline_hrv_ms);

  // The verdict carries score + mode + HRV baseline; the matching vitals row carries
  // this morning's HRV + sleep. Read it (best-effort — fail-open if absent).
  let hrvMs: number | null = null;
  let sleepHours: number | null = null;
  try {
    const { data: bio } = await supabase
      .from('bbf_daily_biometrics')
      .select('hrv_ms, sleep_minutes')
      .eq('athlete_id', athleteId)
      .eq('date', prescribedFor.slice(0, 10))
      .maybeSingle();
    if (bio) {
      hrvMs = num(bio.hrv_ms);
      const sm = num(bio.sleep_minutes);
      sleepHours = sm !== null ? Math.round((sm / 60) * 10) / 10 : null;
    }
  } catch (e) {
    console.warn(`[bbf-cardio-prescription] vitals read failed (fail-open): ${(e as Error).message}`);
  }

  const band = deriveReadinessBand({ score, mode, hrv_ms: hrvMs, hrv_baseline_ms: baselineHrv, sleep_hours: sleepHours });

  // Supersede any prior ACTIVE row for the same athlete/day, then insert the fresh band.
  await supabase.from('bbf_cardio_prescription')
    .update({ status: 'superseded' })
    .eq('user_id', athleteId).eq('prescribed_for', prescribedFor.slice(0, 10)).eq('status', 'active');

  const { data: ins, error: insErr } = await supabase.from('bbf_cardio_prescription').insert({
    user_id: athleteId,
    prescribed_for: prescribedFor.slice(0, 10),
    readiness_score: score,
    readiness_mode: mode,
    hrv_ms: hrvMs,
    hrv_baseline_ms: baselineHrv,
    sleep_hours: sleepHours,
    recovery_state: band.recovery_state,
    tier_ceiling: band.tier_ceiling,
    rpe_ceiling: band.rpe_ceiling,
    work_rest_ratio: band.work_rest_ratio,
    interval_directive: band.interval_directive,
    recovery_note: band.recovery_note,
    status: 'active',
  }).select('id').maybeSingle();

  if (insErr) {
    console.error(`[bbf-cardio-prescription] insert failed: ${insErr.message}`);
    return jsonResponse({ error: 'insert_failed', detail: insErr.message }, 500);
  }

  console.log(`[bbf-cardio-prescription] athlete=${athleteId} day=${prescribedFor.slice(0, 10)} state=${band.recovery_state} ceiling=${band.tier_ceiling ?? 'none'} rpe=${band.rpe_ceiling ?? 'none'} engine=deterministic`);

  return jsonResponse({
    ok: true,
    prescription_id: ins?.id ?? null,
    prescribed_for: prescribedFor.slice(0, 10),
    recovery_state: band.recovery_state,
    tier_ceiling: band.tier_ceiling,
    rpe_ceiling: band.rpe_ceiling,
    work_rest_ratio: band.work_rest_ratio,
  }, 200);
});
