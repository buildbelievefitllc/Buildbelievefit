// ═══════════════════════════════════════════════════════════════════════════
// bbf-fueling-sentinel — the 3-tier chronobiology fueling engine (FUEL blueprint §5)
// ───────────────────────────────────────────────────────────────────────────
// Pure deterministic Deno, zero Claude. Passes:
//   tier1   → 28-day Foundation baseline (RMR/TDEE/macros + clamps)
//   tier2   → recalibrate TOMORROW from the readiness state
//   nightly → Sovereign (Tier 3): weekday fingerprint → phase detect → arm/disarm the
//             48-HOUR CARB RAMP off the athlete's floor ledger + upcoming cardio, then
//             write the rolling 7-day macro schedule
//
// It reads athlete_workload_daily (ACWR/strain predictions) AND the upcoming
// bbf_cardio_prescription rows to shape the carb ramp. RED-S is a HARD floor enforced
// in _shared/fueling-core assembleMacros. Every macro touching the DB is an INTEGER
// of grams. Idempotent: UNIQUE (athlete,day) / (athlete,weekday) / active phase index.
//
// AUTH: X-BBF-Admin-Token OR X-Cron-Secret. POST: { athlete_id?|user_id?, day?, pass?,
//        readiness_state?, event_date? }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CORS, jsonResponse, num, todayUTC, addDaysUTC, readConfigJson, type SupabaseClient } from '../_shared/onboarding-core.ts';
import {
  FUEL_FALLBACK, CLAMP_FALLBACK, type FuelCfg, type ClampCfg, type Tier2Cfg, type Tier3Cfg,
  resolveProfileKey, foundationTargets, recalibrateTomorrow, assembleMacros, rmrKcal, activityFactor,
  carbCoeffForDay, proteinCoeffForPhase, predictedVolumeRatio, updateFingerprintEwma, fingerprintConfidence, isPredictedHeavy,
} from '../_shared/fueling-core.ts';

const T2_FALLBACK: Tier2Cfg = {
  vol_anticipated: { prime: 1.0, standard: 1.0, strain: 0.8, breach: 0.5 },
  states: {
    prime: { protein_coeff: 0.0018, carb_mult: 1.0, fat_floor_pct: 0.20 },
    standard: { protein_coeff: 0.0018, carb_mult: 1.0, fat_floor_pct: 0.20 },
    strain: { protein_coeff: 0.0022, carb_mult: 0.85, fat_floor_pct: 0.20 },
    breach: { protein_coeff: 0.0024, carb_mult: 0.70, fat_floor_pct: 0.25 },
  },
};
const T3_FALLBACK: Tier3Cfg = {
  fingerprint: { lambda_fp: 0.25, heavy_mult: 1.30, confidence_gate: 0.5, min_obs: 4, cv_max: 1 },
  carb_modulation: { standard: 1.0, refeed_eve: 1.25, heavy_predicted: 1.15, post_heavy: 1.10, taper: 0.90 },
  carb_load_abs: { t48_t24: 0.0110, t24_t0: 0.0120, competition: 0.0120 },
  protein_by_phase: { maintenance: 0.0018, accumulation: 0.0020, intensification: 0.0022, taper: 0.0018, post_heavy_adder: 0.0002 } as Record<string, number>,
  predicted_volume_ratio: { clamp_min: 0.5, clamp_max: 1.5 },
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON = Deno.env.get('CRON_SECRET') ?? '';
  if (!(ADMIN && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN) && !(CRON && (req.headers.get('x-cron-secret') ?? '') === CRON)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const day = /^\d{4}-\d{2}-\d{2}/.test(String(body.day ?? '')) ? String(body.day).slice(0, 10) : todayUTC();
  const pass = String(body.pass ?? 'nightly');
  const inputId = String(body.athlete_id ?? body.user_id ?? '').trim();
  if (!inputId) return jsonResponse({ ok: false, error: 'missing_athlete' }, 400);

  try {
    // ── Resolve both id-spaces + body metrics + sport ──
    let profileId: string | null = null, userId: string | null = null, sport: string | null = null;
    const { data: byProfile } = await supabase.from('athlete_profiles').select('id,user_id,sport').eq('id', inputId).maybeSingle();
    if (byProfile?.id) { profileId = String(byProfile.id); userId = byProfile.user_id ? String(byProfile.user_id) : null; sport = byProfile.sport ?? null; }
    else {
      const { data: byUser } = await supabase.from('athlete_profiles').select('id,user_id,sport').eq('user_id', inputId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (byUser?.id) { profileId = String(byUser.id); userId = byUser.user_id ? String(byUser.user_id) : inputId; sport = byUser.sport ?? null; }
    }
    if (!profileId) return jsonResponse({ ok: false, error: 'athlete_unresolved', input: inputId }, 404);

    const { data: bm } = await supabase.from('athlete_body_metrics').select('body_mass_g, body_fat_pct').eq('athlete_id', profileId).lte('measured_on', day).order('measured_on', { ascending: false }).limit(1).maybeSingle();
    const bodyMassG = Math.round(num(bm?.body_mass_g) ?? 0);
    if (!bodyMassG) return jsonResponse({ ok: false, error: 'missing_body_mass', note: 'no athlete_body_metrics row' }, 200);
    const leanMassG = Math.round(bodyMassG * (1 - (num(bm?.body_fat_pct) ?? 20) / 100));

    // ── Config (fallbacks match the Phase-1 seeds exactly) ──
    const fuel = (await readConfigJson<FuelCfg>(supabase, 'fueling_coefficients_v1')) ?? FUEL_FALLBACK;
    const clamp = (await readConfigJson<ClampCfg>(supabase, 'fueling_safety_clamps_v1')) ?? CLAMP_FALLBACK;
    const t2 = (await readConfigJson<Tier2Cfg>(supabase, 'fueling_tier2_states_v1')) ?? T2_FALLBACK;
    const t3 = (await readConfigJson<Tier3Cfg>(supabase, 'fueling_tier3_modulation_v1')) ?? T3_FALLBACK;

    // training profile
    const { data: prof } = await supabase.from('athlete_profiles').select('body_mass_g').eq('id', profileId).maybeSingle();
    void prof;
    const sessionMinutes = 60; // baseline; the fingerprint refines timing, not macro coeffs
    const trainingDaysWk = 4;
    const profileKey = resolveProfileKey(sport, sessionMinutes);
    const atpPc = profileKey === 'atp_pc';

    // ═══ TIER 1 · FOUNDATION (28-day baseline) ═════════════════════════════
    if (pass === 'tier1') {
      const f = foundationTargets(fuel, clamp, { bodyMassG, leanMassG, trainingDaysWk, twiceDaily: false, profileKey, atpPc });
      const rows = Array.from({ length: 28 }, (_v, i) => ({
        athlete_id: profileId, day: addDaysUTC(day, i), tier: 'foundation',
        tdee_kcal: f.tdee_kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, creatine_g: f.creatine_g,
        coefficients: f.coefficients, day_type: 'standard', timing_plan: null,
        computation_trace: { source: 'fueling_sentinel_tier1', clamps_fired: f.clamps_fired, inputs: { bodyMassG, leanMassG, profileKey } },
      }));
      const { error } = await supabase.from('athlete_nutrition_targets_daily').upsert(rows, { onConflict: 'athlete_id,day' });
      if (error) throw new Error(`tier1:${error.message}`);
      return jsonResponse({ ok: true, pass, athlete_id: profileId, rows: rows.length, tdee_kcal: f.tdee_kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g, clamps_fired: f.clamps_fired }, 200);
    }

    // ═══ TIER 2 · PERFORMANCE (recalibrate tomorrow from readiness) ════════
    if (pass === 'tier2') {
      const state = String(body.readiness_state ?? 'standard');
      const r = recalibrateTomorrow(fuel, clamp, t2, { bodyMassG, leanMassG, trainingDaysWk, twiceDaily: false, profileKey, state });
      const tomorrow = addDaysUTC(day, 1);
      const { error } = await supabase.from('athlete_nutrition_targets_daily').upsert({
        athlete_id: profileId, day: tomorrow, tier: 'performance',
        tdee_kcal: r.tdee_kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, creatine_g: null,
        coefficients: r.coefficients, day_type: r.day_type, timing_plan: null,
        computation_trace: { source: 'fueling_sentinel_tier2', state, clamps_fired: r.clamps_fired, af_dyn: r.af },
      }, { onConflict: 'athlete_id,day' });
      if (error) throw new Error(`tier2:${error.message}`);
      return jsonResponse({ ok: true, pass, athlete_id: profileId, day: tomorrow, day_type: r.day_type, tdee_kcal: r.tdee_kcal, protein_g: r.protein_g, carbs_g: r.carbs_g, fat_g: r.fat_g, clamps_fired: r.clamps_fired }, 200);
    }

    // ═══ NIGHTLY · SOVEREIGN (Tier 3 · fingerprint → phase → carb ramp → 7-day) ═
    // C-1/H-4 · CRON IDEMPOTENCY LEDGER — the non-idempotent nightly writes (the EWMA
    // volume-fingerprint read-modify-write + the nutrition_phase_state supersede/insert)
    // must run EXACTLY ONCE per athlete per day. Claim (job, athlete, day); if a
    // concurrent/overlapping run already claimed it, skip (its DO-NOTHING returns no
    // row). tier1/tier2 are pure idempotent upserts and are deliberately NOT gated.
    const { data: claim } = await supabase.from('bbf_cron_ledger')
      .upsert({ job_name: 'bbf-fueling-sentinel-nightly', target_id: profileId, target_date: day },
        { onConflict: 'job_name,target_id,target_date', ignoreDuplicates: true })
      .select('target_id');
    if (!claim || (claim as unknown[]).length === 0) {
      return jsonResponse({ ok: true, pass: 'nightly', athlete_id: profileId, skipped: 'already_claimed', day }, 200);
    }

    // 1) weekday fingerprint update (on today's own weekday) from the floor ledger
    const todayWeekday = new Date(`${day}T00:00:00Z`).getUTCDay();
    const { data: totalHist } = await supabase.from('athlete_workload_daily')
      .select('day, strain_au, mean_rpe').eq('athlete_id', profileId).eq('load_vector', 'total')
      .gte('day', addDaysUTC(day, -70)).lte('day', day).order('day', { ascending: true });
    const totalRows: Array<{ day: string; strain: number; rpe: number | null; weekday: number }> =
      (totalHist ?? []).map((h: { day: string; strain_au: number; mean_rpe: number | null }) => ({ day: h.day, strain: num(h.strain_au) ?? 0, rpe: num(h.mean_rpe), weekday: new Date(`${h.day}T00:00:00Z`).getUTCDay() }));
    const todayStrain = totalRows.find((r) => r.day === day)?.strain ?? 0;

    const { data: fpRow } = await supabase.from('athlete_volume_fingerprint').select('*').eq('athlete_id', profileId).eq('weekday', todayWeekday).maybeSingle();
    const priorFp = num(fpRow?.ewma_strain_au) ?? 0;
    const newFp = fpRow ? updateFingerprintEwma(priorFp, todayStrain, t3.fingerprint.lambda_fp) : todayStrain;
    const sameWeekday = totalRows.filter((r) => r.weekday === todayWeekday).map((r) => r.strain);
    const cv = sameWeekday.length >= 2 ? coeffVar(sameWeekday) : null;
    await supabase.from('athlete_volume_fingerprint').upsert({
      athlete_id: profileId, weekday: todayWeekday, ewma_strain_au: round3(newFp),
      observation_count: (num(fpRow?.observation_count) ?? 0) + (todayStrain > 0 ? 1 : 0), cv: cv != null ? round3(cv) : null,
      computed_at: new Date().toISOString(),
    }, { onConflict: 'athlete_id,weekday' });

    // 2) load all 7 weekday fingerprints for the prediction mean
    const { data: allFp } = await supabase.from('athlete_volume_fingerprint').select('weekday, ewma_strain_au, observation_count, cv').eq('athlete_id', profileId);
    const fpByWeekday = new Map<number, { ewma: number; obs: number; cv: number | null }>();
    for (const f of (allFp ?? [])) fpByWeekday.set(f.weekday, { ewma: num(f.ewma_strain_au) ?? 0, obs: num(f.observation_count) ?? 0, cv: num(f.cv) });
    fpByWeekday.set(todayWeekday, { ewma: newFp, obs: (num(fpRow?.observation_count) ?? 0) + 1, cv });
    const fMean = fpByWeekday.size ? [...fpByWeekday.values()].reduce((s, f) => s + f.ewma, 0) / fpByWeekday.size : 0;

    // 3) phase detection from the 14-day ACWR + RPE trend (§4.3)
    const last14 = totalRows.slice(-14);
    const phase = detectPhase(last14, supabaseAcwrSeries(totalRows));

    // 4) competition-window inference (§4.4): declared beats signature
    const declared = /^\d{4}-\d{2}-\d{2}/.test(String(body.event_date ?? '')) ? String(body.event_date).slice(0, 10) : null;
    let t0: string | null = declared;
    let windowSource: 'declared' | 'signature' | null = declared ? 'declared' : null;
    if (!t0 && phase === 'taper') {
      // next predicted-heavy day within 7d with confidence ≥ 0.6 → treat as T0
      for (let i = 1; i <= 7; i++) {
        const d = addDaysUTC(day, i); const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
        const f = fpByWeekday.get(wd);
        if (f && isPredictedHeavy(t3, f.ewma, fMean) && fingerprintConfidence(t3, f.obs, f.cv) >= 0.6) { t0 = d; windowSource = 'signature'; break; }
      }
    }
    // persist phase state (supersede the prior active row → one live phase)
    if (t0 || phase) {
      await supabase.from('nutrition_phase_state').update({ status: 'superseded' }).eq('athlete_id', profileId).eq('status', 'active');
      const { error: npsErr } = await supabase.from('nutrition_phase_state').insert({
        athlete_id: profileId, phase, detected_on: day,
        carb_window_start: t0 ? new Date(new Date(`${t0}T00:00:00Z`).getTime() - 48 * 3600000).toISOString() : null,
        carb_window_end: t0 ? `${t0}T00:00:00Z` : null,
        window_source: windowSource, confidence: t0 ? 0.6 : null,
        signals: { f_mean: round3(fMean), phase, t0, source: windowSource }, status: 'active',
      });
      // H-4 · fail-soft: the ledger gates the common case, but if a run ever races the
      // uq_nutrition_phase_active (partial, status='active') slot, 23505 is a benign
      // no-op — never a 500 with the schedule half-written. (Partial index → PostgREST
      // can't arbiter it via onConflict, so we swallow the code app-side.)
      if (npsErr && npsErr.code !== '23505') throw new Error(`phase_state:${npsErr.message}`);
    }

    // 5) upcoming cardio (next 7d) — a prescribed HIIT/Tempo day is an extra heavy signal
    const { data: cardioUpcoming } = userId
      ? await supabase.from('bbf_cardio_prescription').select('prescribed_for, effective_tier, ee_kcal_est').eq('user_id', userId).gte('prescribed_for', day).lte('prescribed_for', addDaysUTC(day, 7)).eq('status', 'active')
      : { data: [] };
    const cardioByDay = new Map<string, { tier: string | null; ee: number | null }>();
    for (const c of (cardioUpcoming ?? [])) cardioByDay.set(String(c.prescribed_for).slice(0, 10), { tier: c.effective_tier ?? null, ee: num(c.ee_kcal_est) });

    // 6) write the rolling 7-day Sovereign schedule
    const baseState = String(body.readiness_state ?? 'standard');
    const tier2Base = recalibrateTomorrow(fuel, clamp, t2, { bodyMassG, leanMassG, trainingDaysWk, twiceDaily: false, profileKey, state: baseState });
    const tier2CarbCoeff = (tier2Base.coefficients.carb_coeff as number);
    let written = 0; const schedule: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 7; i++) {
      const d = addDaysUTC(day, i);
      const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
      const f = fpByWeekday.get(wd);
      const heavyToday = !!(f && isPredictedHeavy(t3, f.ewma, fMean)) || ['HIIT', 'Tempo'].includes(String(cardioByDay.get(d)?.tier ?? ''));
      const wdNext = new Date(`${addDaysUTC(d, 1)}T00:00:00Z`).getUTCDay();
      const heavyTomorrow = !!(fpByWeekday.get(wdNext) && isPredictedHeavy(t3, fpByWeekday.get(wdNext)!.ewma, fMean));
      const wdPrev = new Date(`${addDaysUTC(d, -1)}T00:00:00Z`).getUTCDay();
      const heavyYesterday = !!(fpByWeekday.get(wdPrev) && isPredictedHeavy(t3, fpByWeekday.get(wdPrev)!.ewma, fMean));

      // carb-load window position (the 48-hour ramp)
      const inWindow = carbWindowPosition(d, t0);
      let dayType = 'standard';
      if (inWindow === 'competition') dayType = 'competition';
      else if (inWindow) dayType = 'carb_load';
      else if (heavyTomorrow) dayType = 'refeed_eve';
      else if (heavyToday) dayType = 'heavy_predicted';
      else if (heavyYesterday) dayType = 'post_heavy';
      else if (phase === 'taper') dayType = 'taper';

      const carbCoeff = carbCoeffForDay(t3, { tier2CarbCoeff, dayType, inWindow });
      const proteinCoeff = proteinCoeffForPhase(t3, phase, dayType === 'post_heavy', tier2Base.coefficients.protein_coeff as number, clamp);
      const volRatio = predictedVolumeRatio(t3, f?.ewma ?? fMean, fMean);
      const afPred = 1 + (activityFactor(fuel, trainingDaysWk, false) - 1) * volRatio;
      const tdee = Math.round(rmrKcal(fuel, leanMassG) * afPred) + Math.round(cardioByDay.get(d)?.ee ?? 0); // + cardio EE
      const macros = assembleMacros({ rmrKcal: rmrKcal(fuel, leanMassG), tdeeKcal: tdee, bodyMassG, leanMassG, carbCoeff, proteinCoeff, fatFloorPct: 0.20, clamp });

      const row = {
        athlete_id: profileId, day: d, tier: 'sovereign',
        tdee_kcal: macros.tdee_kcal, protein_g: macros.protein_g, carbs_g: macros.carbs_g, fat_g: macros.fat_g,
        creatine_g: atpPc ? f?.ewma ? null : null : null, coefficients: { carb_coeff: carbCoeff, protein_coeff: proteinCoeff, af: round3(afPred), phase },
        day_type: dayType, timing_plan: null,
        computation_trace: {
          source: 'fueling_sentinel_sovereign', phase, day_type: dayType, in_carb_window: inWindow || false,
          predicted_heavy: heavyToday, vol_ratio: round3(volRatio), cardio_tier: cardioByDay.get(d)?.tier ?? null,
          cardio_ee: cardioByDay.get(d)?.ee ?? null, clamps_fired: macros.clamps_fired, t0, window_source: windowSource,
        },
      };
      const { error } = await supabase.from('athlete_nutrition_targets_daily').upsert(row, { onConflict: 'athlete_id,day' });
      if (!error) { written++; schedule.push({ day: d, day_type: dayType, carbs_g: macros.carbs_g, protein_g: macros.protein_g, tdee_kcal: macros.tdee_kcal }); }
    }

    console.log(`[bbf-fueling-sentinel] athlete=${profileId} pass=nightly phase=${phase} t0=${t0 ?? 'none'}(${windowSource ?? '—'}) f_mean=${round3(fMean)} rows=${written}`);
    return jsonResponse({ ok: true, pass: 'nightly', athlete_id: profileId, phase, carb_window_t0: t0, window_source: windowSource, f_mean: round3(fMean), fingerprint_weekday: todayWeekday, schedule }, 200);
  } catch (e) {
    console.error('[bbf-fueling-sentinel] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'sentinel_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// ── local helpers ────────────────────────────────────────────────────────────
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
function coeffVar(xs: number[]): number {
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  if (mean === 0) return 1;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
  return sd / mean;
}
// Position of day `d` in the [T0-48h, T0] carb-load window (or false).
function carbWindowPosition(d: string, t0: string | null): false | 't48_t24' | 't24_t0' | 'competition' {
  if (!t0) return false;
  if (d === t0) return 'competition';
  const dd = new Date(`${d}T00:00:00Z`).getTime();
  const t = new Date(`${t0}T00:00:00Z`).getTime();
  const hrs = (t - dd) / 3600000;
  if (hrs > 24 && hrs <= 48) return 't48_t24';
  if (hrs > 0 && hrs <= 24) return 't24_t0';
  return false;
}
// Simple ACWR series proxy from the total-vector strain (acute7 / chronic28 EWMA).
function supabaseAcwrSeries(rows: Array<{ day: string; strain: number }>): number[] {
  let a = rows[0]?.strain ?? 0, c = a; const out: number[] = [];
  for (const r of rows) { a = 0.25 * r.strain + 0.75 * a; c = 0.0689655 * r.strain + 0.9310345 * c; out.push(a / Math.max(c, 1)); }
  return out;
}
// Mesocycle phase from ACWR level + chronic/RPE slope (§4.3, tractable form).
function detectPhase(last14: Array<{ strain: number; rpe: number | null }>, acwrSeries: number[]): 'accumulation' | 'intensification' | 'taper' | 'maintenance' {
  const acwrNow = acwrSeries.length ? acwrSeries[acwrSeries.length - 1] : 1.0;
  const chronicSlope = slope(last14.map((x) => x.strain));
  const rpeSlope = slope(last14.map((x) => x.rpe ?? 0));
  if (acwrNow > 1.30) return 'intensification';
  if (acwrNow >= 1.00 && chronicSlope > 0) return 'accumulation';
  if (acwrNow < 0.80 && rpeSlope >= 0) return 'taper';
  return 'maintenance';
}
function slope(ys: number[]): number {
  const n = ys.length; if (n < 2) return 0;
  const xs = ys.map((_v, i) => i);
  const mx = xs.reduce((s, x) => s + x, 0) / n, my = ys.reduce((s, y) => s + y, 0) / n;
  let numr = 0, den = 0;
  for (let i = 0; i < n; i++) { numr += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return den === 0 ? 0 : numr / den;
}
