// ═══════════════════════════════════════════════════════════════════════════
// bbf-smart-cardio-router — nightly cardio prescription + brief-context composer
// ───────────────────────────────────────────────────────────────────────────
// Pure deterministic Deno, zero Claude/TTS (CARDIO blueprint Parts 1–2 + §4.1). Runs
// after the workload/fueling sentinels: consumes athlete_recovery_state +
// athlete_workload_daily + prehab_queue + the shipped readiness band, derives the
// MECHANICAL CEILING, composes it (gentlest wins) with the readiness ceiling, resolves
// the PRESCRIPTION MATRIX (Work:Rest, Tanaka HR clamps), computes the GRAM outputs
// (EE, sweat, rehydration), writes bbf_cardio_prescription, and emits the deterministic
// bbf_daily_brief_context payload the stitch router consumes.
//
// ID SPACES: bbf_cardio_prescription keys on bbf_users.id (user_id); the workload/
// recovery/prehab/brief ledgers key on athlete_profiles.id. Resolves both.
// GRAM BOUNDARY: ee_kcal / sweat_loss_g_est / rehydration_g are integers (§0.1).
// IDEMPOTENT: supersede the day's active prescription + upsert the brief context.
// AUTH: X-BBF-Admin-Token OR X-Cron-Secret. POST { athlete_id?|user_id?, day?, available_minutes? }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CORS, jsonResponse, num, todayUTC, type SupabaseClient } from '../_shared/onboarding-core.ts';
import { deriveReadinessBand } from '../_shared/cardio-readiness.ts';
import {
  type CardioTier, type MechState, deriveMechState, mechCeiling, ageFromBirthDate, hrCapBpm,
  matrixFor, timeBasedTier, debtClass, debtScale, durationMin, eeKcal, sweatLossG, rehydrationG,
  sportProfile, composeEffectiveTier, MET_BY_TIER, TALK_TEST,
} from '../_shared/cardio-core.ts';
import type { BriefPayload } from '../_shared/stitch-core.ts';

const LOWER_BODY = new Set(['quads', 'hamstrings', 'glutes', 'calves', 'lower_back', 'adductors', 'groin']);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '', CRON = Deno.env.get('CRON_SECRET') ?? '';
  if (!(ADMIN && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN) && !(CRON && (req.headers.get('x-cron-secret') ?? '') === CRON)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL'), SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const day = /^\d{4}-\d{2}-\d{2}/.test(String(body.day ?? '')) ? String(body.day).slice(0, 10) : todayUTC();
  const inputId = String(body.athlete_id ?? body.user_id ?? '').trim();
  if (!inputId) return jsonResponse({ ok: false, error: 'missing_athlete' }, 400);

  try {
    // ── Resolve both id-spaces + profile ──
    let profileId: string | null = null, userId: string | null = null, sport: string | null = null, birthDate: string | null = null;
    const { data: byProfile } = await supabase.from('athlete_profiles').select('id,user_id,sport,birth_date,preferred_language').eq('id', inputId).maybeSingle();
    let locale = 'en';
    if (byProfile?.id) { profileId = String(byProfile.id); userId = byProfile.user_id ? String(byProfile.user_id) : null; sport = byProfile.sport ?? null; birthDate = byProfile.birth_date ?? null; locale = byProfile.preferred_language ?? 'en'; }
    else {
      const { data: byUser } = await supabase.from('athlete_profiles').select('id,user_id,sport,birth_date,preferred_language').eq('user_id', inputId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (byUser?.id) { profileId = String(byUser.id); userId = byUser.user_id ? String(byUser.user_id) : inputId; sport = byUser.sport ?? null; birthDate = byUser.birth_date ?? null; locale = byUser.preferred_language ?? 'en'; }
    }
    if (!profileId || !userId) return jsonResponse({ ok: false, error: 'athlete_unresolved', input: inputId }, 404);

    // ── Body mass (grams) ──
    const { data: bm } = await supabase.from('athlete_body_metrics').select('body_mass_g').eq('athlete_id', profileId).lte('measured_on', day).order('measured_on', { ascending: false }).limit(1).maybeSingle();
    let bodyMassG = num(bm?.body_mass_g) ?? 0;
    if (!bodyMassG) { const { data: p } = await supabase.from('athlete_profiles').select('body_mass_g').eq('id', profileId).maybeSingle(); bodyMassG = num(p?.body_mass_g) ?? 0; }
    if (!bodyMassG) return jsonResponse({ ok: false, error: 'missing_body_mass' }, 200);

    // ── Readiness band (latest on file) ──
    let readinessScore: number | null = null, readinessMode: string | null = null;
    const { data: prot } = await supabase.from('bbf_daily_protocols').select('readiness_score, directive_log').eq('athlete_id', userId).lte('date', day).order('date', { ascending: false }).limit(1).maybeSingle();
    if (prot) { readinessScore = num(prot.readiness_score); const dl = prot.directive_log as Record<string, unknown> | null; readinessMode = dl && typeof dl.mode === 'string' ? dl.mode : null; }
    const band = deriveReadinessBand({ score: readinessScore, mode: readinessMode });
    const readinessState = band.recovery_state;

    // ── Workload (latest day's per-vector ACWR + monotony + chronic_total) ──
    const { data: wlLatest } = await supabase.from('athlete_workload_daily').select('day').eq('athlete_id', profileId).lte('day', day).order('day', { ascending: false }).limit(1).maybeSingle();
    const wlDay = wlLatest?.day ?? null;
    const acwr: Record<string, number | null> = { axial: null, impact: null, knee_dominant: null, hip_hinge: null, total: null };
    let monotonyTotal: number | null = null, chronicTotal: number | null = null;
    if (wlDay) {
      const { data: wlRows } = await supabase.from('athlete_workload_daily').select('load_vector, acwr, monotony, ewma_chronic_au').eq('athlete_id', profileId).eq('day', wlDay);
      for (const r of (wlRows ?? [])) {
        if (r.load_vector in acwr) acwr[r.load_vector] = num(r.acwr);
        if (r.load_vector === 'total') { monotonyTotal = num(r.monotony); chronicTotal = num(r.ewma_chronic_au); }
      }
    }

    // ── Recovery (debt sum, max lower-body debt ratio, shadow) ──
    const { data: rsLatest } = await supabase.from('athlete_recovery_state').select('day').eq('athlete_id', profileId).lte('day', day).order('day', { ascending: false }).limit(1).maybeSingle();
    let debtSum: number | null = null, maxLowerDebtRatio: number | null = null, shadowActive = false, deepDebt: 'lower' | 'upper' | null = null;
    if (rsLatest?.day) {
      const { data: rsRows } = await supabase.from('athlete_recovery_state').select('muscle_group, debt_au, debt_ratio, recovery_shadow_until').eq('athlete_id', profileId).eq('day', rsLatest.day);
      let sum = 0; let sawAny = false; let maxUpper = 0;
      for (const r of (rsRows ?? [])) {
        const dAu = num(r.debt_au) ?? 0; sum += dAu; sawAny = true;
        const ratio = num(r.debt_ratio) ?? 0;
        if (LOWER_BODY.has(r.muscle_group)) maxLowerDebtRatio = Math.max(maxLowerDebtRatio ?? 0, ratio);
        else maxUpper = Math.max(maxUpper, ratio);
        if (r.recovery_shadow_until && new Date(String(r.recovery_shadow_until)).getTime() > Date.now()) shadowActive = true;
      }
      if (sawAny) debtSum = sum;
      if ((maxLowerDebtRatio ?? 0) >= 1.40) deepDebt = 'lower'; else if (maxUpper >= 1.40) deepDebt = 'upper';
    }

    // ── Mandatory prehab today ──
    const { data: pq } = await supabase.from('prehab_queue').select('joint_zone, priority').eq('athlete_id', profileId).eq('scheduled_for', day).in('status', ['queued', 'served']);
    const queued: Array<{ joint: string; priority: string }> = (pq ?? []).map((q: { joint_zone: string; priority: string }) => ({ joint: q.joint_zone, priority: q.priority }));
    const mandatoryToday = queued.some((q) => q.priority === 'mandatory');

    // ══ PART 1 · mechanical ceiling ══
    const mech = deriveMechState({
      acwr_axial: acwr.axial, acwr_impact: acwr.impact, acwr_knee: acwr.knee_dominant, acwr_total: acwr.total,
      monotony_total: monotonyTotal, debt_sum_au: debtSum, chronic_total_au: chronicTotal,
      max_lower_debt_ratio: maxLowerDebtRatio, shadow_active: shadowActive, mandatory_prehab_today: mandatoryToday,
    });
    const mc = mechCeiling(mech.state);

    // ══ PART 2 · composition + matrix + dose ══
    const availableMinutes = Math.max(10, Math.min(num(body.available_minutes) ?? 30, 120));
    const timeTier = timeBasedTier(availableMinutes);
    const effectiveTier: CardioTier = composeEffectiveTier(timeTier, band.tier_ceiling, mc.tier);
    const profile = sportProfile(sport, null);
    const matrix = matrixFor(effectiveTier, profile);
    const cls = debtClass(maxLowerDebtRatio);
    const dur = durationMin(availableMinutes, debtScale(cls));
    const age = ageFromBirthDate(birthDate);
    const hrCap = hrCapBpm(age, effectiveTier, mech.state);
    const rpeCap = minNullable(band.rpe_ceiling, mc.rpe_cap);
    const workRest = mc.work_rest ?? matrix.work_rest;

    // ── Gram outputs (§0.1) ──
    const ee = eeKcal(effectiveTier, bodyMassG, dur);
    const sweat = sweatLossG(effectiveTier, bodyMassG, dur);
    const rehydration = rehydrationG(sweat);

    // ══ WRITE bbf_cardio_prescription (supersede active → insert; single active row) ══
    await supabase.from('bbf_cardio_prescription').update({ status: 'superseded' }).eq('user_id', userId).eq('prescribed_for', day).eq('status', 'active');
    const { data: ins, error: insErr } = await supabase.from('bbf_cardio_prescription').insert({
      user_id: userId, prescribed_for: day,
      readiness_score: readinessScore, readiness_mode: readinessMode,
      recovery_state: band.recovery_state, tier_ceiling: band.tier_ceiling, rpe_ceiling: band.rpe_ceiling,
      work_rest_ratio: workRest, interval_directive: band.interval_directive,
      recovery_note: `${band.recovery_note} · Mech: ${mech.state}${mech.fired.length ? ' [' + mech.fired.join(',') + ']' : ''}`,
      mech_state: mech.state, mech_ceiling: mc.tier, effective_tier: effectiveTier,
      hr_cap_bpm: hrCap, rpe_cap: rpeCap, duration_min: dur,
      ee_kcal_est: ee, sweat_loss_g_est: sweat, rehydration_g: rehydration,
      mech_signals: { acwr, monotony_total: monotonyTotal, debt_sum_ratio: debtSum != null && chronicTotal ? round3(debtSum / Math.max(chronicTotal, 1)) : null, shadow: shadowActive, fired: mech.fired },
      prescription_trace: {
        source: 'smart_cardio_router', time_tier: timeTier, readiness_ceiling: band.tier_ceiling, mech_ceiling: mc.tier,
        effective_tier: effectiveTier, profile, debt_class: cls, met: MET_BY_TIER[effectiveTier], available_minutes: availableMinutes, matrix: matrix.structure,
      },
      status: 'active',
    }).select('id').maybeSingle();
    if (insErr) throw new Error(`prescription:${insErr.message}`);

    // ── Nutrition day_type + macros (for the brief) ──
    const { data: nut } = await supabase.from('athlete_nutrition_targets_daily').select('day_type, protein_g, carbs_g').eq('athlete_id', profileId).eq('day', day).maybeSingle();

    // ══ COMPOSE the deterministic brief-context payload (§3.4 router input) ══
    const spiking = Object.entries(acwr).filter(([k, v]) => k !== 'total' && v != null && (v as number) > 1.30).map(([vector, v]) => ({ vector, acwr: v as number })).sort((a, b) => b.acwr - a.acwr);
    const payload: BriefPayload = {
      day,
      readiness: { state: readinessState, score: readinessScore },
      cardio: {
        effective_tier: effectiveTier, duration_min: dur, mech_state: mech.state,
        mech_ceiling_bound: mech.state === 'danger', caution_vector: mech.state === 'caution',
        hr_cap_bpm: hrCap, talk_test: TALK_TEST[effectiveTier], ee_kcal: ee, rehydration_g: rehydration,
      },
      workload: { spiking_vectors: spiking },
      prehab: { queued },
      nutrition: { day_type: (nut?.day_type as string) ?? 'standard', protein_g: num(nut?.protein_g), carbs_g: num(nut?.carbs_g) },
      recovery: { shadow_active: shadowActive, deep_debt: deepDebt },
      forecast: {
        heavy_day_soon: ['heavy_predicted', 'refeed_eve'].includes(String(nut?.day_type ?? '')),
        refeed_tomorrow: String(nut?.day_type ?? '') === 'refeed_eve',
        carb_window_open: String(nut?.day_type ?? '') === 'carb_load',
      },
    };
    const { error: bcErr } = await supabase.from('bbf_daily_brief_context').upsert({ athlete_id: profileId, day, status: 'ready', payload }, { onConflict: 'athlete_id,day' });
    if (bcErr) throw new Error(`brief_context:${bcErr.message}`);

    console.log(`[bbf-smart-cardio-router] user=${userId} day=${day} mech=${mech.state}[${mech.fired.join(',')}] tier=${effectiveTier} dur=${dur}m ee=${ee}kcal sweat=${sweat}g rehy=${rehydration}g`);
    return jsonResponse({
      ok: true, user_id: userId, athlete_id: profileId, day, prescription_id: ins?.id ?? null,
      mech_state: mech.state, effective_tier: effectiveTier, duration_min: dur, work_rest_ratio: workRest,
      hr_cap_bpm: hrCap, rpe_cap: rpeCap, ee_kcal: ee, sweat_loss_g: sweat, rehydration_g: rehydration,
    }, 200);
  } catch (e) {
    console.error('[bbf-smart-cardio-router] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'router_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function minNullable(a: number | null, b: number | null): number | null {
  if (a == null) return b; if (b == null) return a; return Math.min(a, b);
}
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
