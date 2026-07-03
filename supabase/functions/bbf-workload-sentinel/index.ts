// ═══════════════════════════════════════════════════════════════════════════
// bbf-workload-sentinel — the "string" that pulls the ball (PREHAB blueprint Part 4)
// ───────────────────────────────────────────────────────────────────────────
// Pure deterministic Deno, zero Claude. Two triggers (hot-path floor sync + nightly
// cron). Per invocation: recompute the §1 workload rollups (gram tonnage, EWMA/ACWR,
// Foster monotony) → §2 joint risk + prehab_queue writes → §3 recovery-debt deposits
// + prep variants + the 48-hour shadow. Idempotent: UNIQUE (athlete,day,vector) /
// (athlete,day,muscle_group) are the keys; re-running a day overwrites, never dupes.
//
// ID SPACES: the workload/prehab/recovery tables key on athlete_profiles.id; the raw
// floor (bbf_logs/bbf_sets) keys on bbf_users.id. The sentinel resolves both.
// GRAM BOUNDARY: tonnage_g / load_g / effective_load_g are integer BIGINT grams.
// AUTH: X-BBF-Admin-Token=BBF_COACH_AGENT_TOKEN OR X-Cron-Secret=CRON_SECRET.
// POST body: { athlete_id? | user_id?, day? }  (day defaults to today UTC)
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { CORS, jsonResponse, num, todayUTC, addDaysUTC, readConfigJson, type SupabaseClient } from '../_shared/onboarding-core.ts';
import {
  VECTORS, type Vector, type TaxonomyRow, type RawSet, matchTaxonomy, computeSetStrain,
  rollEwma, acwr, monotony, rpeSpike, jointRisk, riskToPriority, historyFactor, type InjuryRow,
  JOINT_VECTOR_MAP, RISK_WEIGHTS_FALLBACK, type RiskWeights,
  overnightDecay, debtRatio, prepVariant,
} from '../_shared/workload-core.ts';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON = Deno.env.get('CRON_SECRET') ?? '';
  const adminOk = ADMIN && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN;
  const cronOk = CRON && (req.headers.get('x-cron-secret') ?? '') === CRON;
  if (!adminOk && !cronOk) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const day = /^\d{4}-\d{2}-\d{2}/.test(String(body.day ?? '')) ? String(body.day).slice(0, 10) : todayUTC();
  const inputId = String(body.athlete_id ?? body.user_id ?? '').trim();
  if (!inputId) return jsonResponse({ ok: false, error: 'missing_athlete' }, 400);

  try {
    // ── Resolve BOTH id-spaces (profile ↔ user) ──
    let profileId: string | null = null, userId: string | null = null;
    const { data: byProfile } = await supabase.from('athlete_profiles').select('id,user_id').eq('id', inputId).maybeSingle();
    if (byProfile?.id) { profileId = String(byProfile.id); userId = byProfile.user_id ? String(byProfile.user_id) : null; }
    else {
      const { data: byUser } = await supabase.from('athlete_profiles').select('id,user_id').eq('user_id', inputId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (byUser?.id) { profileId = String(byUser.id); userId = byUser.user_id ? String(byUser.user_id) : inputId; }
    }
    if (!profileId || !userId) return jsonResponse({ ok: false, error: 'athlete_unresolved', input: inputId }, 404);

    // C-1/H-1 · serialize overlapping runs (hot-path floor-sync vs nightly cron) for
    // this athlete before the workload read-modify-write + prehab_queue write.
    await supabase.rpc('bbf_try_athlete_lock', { p_athlete: profileId });

    // ── Body mass (grams) ──
    let bodyMassG = 0;
    const { data: bm } = await supabase.from('athlete_body_metrics').select('body_mass_g').eq('athlete_id', profileId).lte('measured_on', day).order('measured_on', { ascending: false }).limit(1).maybeSingle();
    bodyMassG = num(bm?.body_mass_g) ?? 0;
    if (!bodyMassG) { const { data: p } = await supabase.from('athlete_profiles').select('body_mass_g').eq('id', profileId).maybeSingle(); bodyMassG = num(p?.body_mass_g) ?? 0; }

    // ── Today's floor: the user's logs on `day` → sets joined to drill names ──
    const { data: logs } = await supabase.from('bbf_logs').select('id, drill_name').eq('user_id', userId).eq('date', day);
    const logIds = (logs ?? []).map((l: { id: string }) => l.id);
    const drillByLog = new Map<string, string | null>((logs ?? []).map((l: { id: string; drill_name: string | null }) => [l.id, l.drill_name]));
    let sets: Array<RawSet & { log_id: string }> = [];
    if (logIds.length) {
      const { data: setRows } = await supabase.from('bbf_sets').select('log_id, reps, weight_lbs, load_g, rpe').in('log_id', logIds);
      sets = (setRows ?? []).map((s: Record<string, unknown>) => ({
        log_id: String(s.log_id), drill_name: drillByLog.get(String(s.log_id)) ?? null,
        reps: num(s.reps), weight_lbs: num(s.weight_lbs), load_g: num(s.load_g), rpe: num(s.rpe),
      }));
    }

    // ── Taxonomy + config ──
    const { data: taxRows } = await supabase.from('movement_load_taxonomy').select('*');
    const taxonomy = (taxRows ?? []) as TaxonomyRow[];
    const weights = ((await readConfigJson<RiskWeights>(supabase, 'prehab_risk_weights_v1')) ?? RISK_WEIGHTS_FALLBACK) as RiskWeights;

    // ── Readiness (best-effort, for the risk readiness_component + debt sleep decay) ──
    let readinessScore: number | null = null, sleepHours: number | null = null;
    const { data: rd } = await supabase.from('bbf_daily_protocols').select('readiness_score').eq('athlete_id', userId).eq('date', day).maybeSingle();
    readinessScore = num(rd?.readiness_score);
    try {
      // athlete_readiness_logs keys on athlete_profiles.id (unlike bbf_daily_protocols → bbf_users.id)
      const { data: rl } = await supabase.from('athlete_readiness_logs').select('readiness_score, sleep_hours').eq('athlete_id', profileId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (readinessScore == null) readinessScore = num(rl?.readiness_score);
      sleepHours = num(rl?.sleep_hours);
    } catch { /* readiness is optional; missing data never punishes */ }

    // ══ §1 · TODAY'S PER-VECTOR ROLLUP ══════════════════════════════════════
    const perVector: Record<string, { tonnage_g: number; strain_au: number; sets: number; reps: number; rpeSum: number; rpeN: number }> = {};
    for (const v of [...VECTORS, 'total']) perVector[v] = { tonnage_g: 0, strain_au: 0, sets: 0, reps: 0, rpeSum: 0, rpeN: 0 };
    const muscleDeposit: Record<string, number> = {};
    for (const set of sets) {
      const row = matchTaxonomy(set.drill_name, taxonomy);
      if (!row) continue;
      const s = computeSetStrain(set, row, bodyMassG);
      // total
      perVector.total.tonnage_g += s.tonnage_g; perVector.total.strain_au += s.strain_au;
      perVector.total.sets += 1; perVector.total.reps += s.reps; perVector.total.rpeSum += s.rpe; perVector.total.rpeN += 1;
      // per vector (weighted)
      for (const v of VECTORS) {
        const vs = s.vector_strain[v];
        if (vs <= 0) continue;
        perVector[v].strain_au += vs;
        perVector[v].tonnage_g += Math.round(s.tonnage_g * (vs / s.strain_au || 0));
        perVector[v].sets += 1; perVector[v].reps += s.reps; perVector[v].rpeSum += s.rpe; perVector[v].rpeN += 1;
      }
      // recovery-debt deposit split across the movement's muscle groups (§3.2)
      const groups = s.muscle_groups ?? [];
      if (groups.length) for (const m of groups) muscleDeposit[m] = (muscleDeposit[m] ?? 0) + s.strain_au / groups.length;
    }

    // ── History (28d) for EWMA priors, monotony, 28d means ──
    const since = addDaysUTC(day, -28);
    const { data: hist } = await supabase.from('athlete_workload_daily')
      .select('day, load_vector, strain_au, mean_rpe, tonnage_g').eq('athlete_id', profileId).gte('day', since).lt('day', day).order('day', { ascending: true });
    const histByVector = new Map<string, Array<{ day: string; strain: number; rpe: number | null; tonnage: number }>>();
    for (const h of (hist ?? [])) {
      const arr = histByVector.get(h.load_vector) ?? [];
      arr.push({ day: h.day, strain: num(h.strain_au) ?? 0, rpe: num(h.mean_rpe), tonnage: num(h.tonnage_g) ?? 0 });
      histByVector.set(h.load_vector, arr);
    }
    const trainingDays = new Set((hist ?? []).filter((h: { load_vector: string; strain_au: number }) => h.load_vector === 'total' && (num(h.strain_au) ?? 0) > 0).map((h: { day: string }) => h.day)).size
      + (perVector.total.strain_au > 0 ? 1 : 0);

    // ══ WRITE §1 ROLLUPS (6 vectors + total) ════════════════════════════════
    const rows: Array<Record<string, unknown>> = [];
    const acwrByVector: Partial<Record<Vector, number | null>> = {};
    const spikeByVector: Partial<Record<Vector, boolean>> = {};
    const monoFlagByVector: Partial<Record<Vector, boolean>> = {};
    for (const v of [...VECTORS, 'total']) {
      const cur = perVector[v];
      const vhist = (histByVector.get(v) ?? []);
      const last = vhist[vhist.length - 1];
      const gapDays = last ? Math.round((new Date(`${day}T00:00:00Z`).getTime() - new Date(`${last.day}T00:00:00Z`).getTime()) / 86400000) : 1;
      const prior = last ? reconstructEwma(vhist) : null;
      const ew = rollEwma(prior, cur.strain_au, gapDays);
      // ACWR cold-start gate: null until ≥14 training days on record
      const acwrVal = trainingDays >= 14 ? Math.round(acwr(ew.a, ew.c) * 1000) / 1000 : null;
      const last7 = [...vhist.slice(-6).map((x) => x.strain), cur.strain_au];
      const mono = monotony(last7);
      const meanRpe = cur.rpeN ? cur.rpeSum / cur.rpeN : null;
      const rpe7 = meanOf([...vhist.slice(-6).map((x) => x.rpe), meanRpe]);
      const rpe28 = meanOf([...vhist.map((x) => x.rpe), meanRpe]);
      const meanDaily28 = vhist.length ? vhist.reduce((s, x) => s + x.strain, 0) / vhist.length : null;
      const spike = rpeSpike(rpe7, rpe28, cur.strain_au, meanDaily28);
      if (v !== 'total') { acwrByVector[v as Vector] = acwrVal; spikeByVector[v as Vector] = spike; monoFlagByVector[v as Vector] = mono.flag; }
      rows.push({
        athlete_id: profileId, day, load_vector: v,
        tonnage_g: Math.round(cur.tonnage_g), strain_au: round3(cur.strain_au),
        set_count: cur.sets, rep_count: cur.reps, mean_rpe: meanRpe != null ? round3(meanRpe) : null,
        ewma_acute_au: round3(ew.a), ewma_chronic_au: round3(ew.c), acwr: acwrVal,
        monotony: round3(mono.monotony), weekly_strain_au: round3(mono.weekly_strain),
        computed_at: new Date().toISOString(),
      });
    }
    const { error: wErr } = await supabase.from('athlete_workload_daily').upsert(rows, { onConflict: 'athlete_id,day,load_vector' });
    if (wErr) throw new Error(`workload:${wErr.message}`);
    const chronicTotal = round3((rows.find((r) => r.load_vector === 'total')?.ewma_chronic_au as number) ?? 0);

    // ══ §2 · JOINT RISK → PREHAB QUEUE ══════════════════════════════════════
    const scheduledFor = addDaysUTC(day, 1); // next session (proxy)
    const { data: injAll } = await supabase.from('athlete_injury_history').select('joint_zone, severity, resolved_on, recurrence_count, sensitivity_coefficient').eq('athlete_id', profileId);
    const injByJoint = new Map<string, InjuryRow[]>();
    for (const r of (injAll ?? [])) { const a = injByJoint.get(r.joint_zone) ?? []; a.push(r as InjuryRow); injByJoint.set(r.joint_zone, a); }

    const scored = Object.keys(JOINT_VECTOR_MAP).map((joint) => {
      const H = historyFactor(injByJoint.get(joint) ?? [], day);
      const R = jointRisk(joint, { acwrByVector, spikeByVector, monoFlagByVector, H_j: H, readinessScore, weights });
      return { joint, R, priority: riskToPriority(R) };
    }).filter((s) => s.priority !== 'baseline').sort((a, b) => b.R - a.R);

    // Conflict rule: at most TOP TWO mandatory; the rest degrade to 'strong' (§2.4).
    let mandatoryCount = 0;
    for (const s of scored) {
      if (s.priority === 'mandatory') { mandatoryCount++; if (mandatoryCount > 2) s.priority = 'strong'; }
    }

    const { data: existingQ } = await supabase.from('prehab_queue').select('id, joint_zone, priority').eq('athlete_id', profileId).eq('scheduled_for', scheduledFor).eq('status', 'queued');
    const existingByJoint = new Map<string, { id: string; priority: string }>((existingQ ?? []).map((q: { id: string; joint_zone: string; priority: string }) => [q.joint_zone, { id: q.id, priority: q.priority }]));
    let queued = 0;
    for (const s of scored) {
      const existing = existingByJoint.get(s.joint);
      if (existing && existing.priority === s.priority) continue; // no change → low churn
      if (existing) await supabase.from('prehab_queue').update({ status: 'superseded' }).eq('id', existing.id);
      await supabase.from('prehab_queue').insert({
        athlete_id: profileId, scheduled_for: scheduledFor, joint_zone: s.joint, priority: s.priority, risk_score: s.R,
        trigger_reason: { acwr: acwrByVector, spike: spikeByVector, history: historyFactor(injByJoint.get(s.joint) ?? [], day), readiness: readinessScore, monotony: monoFlagByVector, weights_version: 'v1' },
        protocol: { source: 'predictive', joint: s.joint, drills: [] }, status: 'queued',
      });
      queued++;
    }

    // ══ §3 · RECOVERY DEBT → PREP VARIANT + SHADOW ═════════════════════════
    const nowIso = new Date().toISOString();
    // 48-hour shadow: high-volume AND high-RPE day (§3.3)
    const totalTonnage = Math.round(perVector.total.tonnage_g);
    const meanRpeTotal = perVector.total.rpeN ? perVector.total.rpeSum / perVector.total.rpeN : 0;
    const mean28Tonnage = (histByVector.get('total') ?? []).length ? (histByVector.get('total') ?? []).reduce((s, x) => s + x.tonnage, 0) / (histByVector.get('total') ?? []).length : 0;
    const shadowActive = mean28Tonnage > 0 && totalTonnage >= 1.5 * mean28Tonnage && meanRpeTotal >= 8;
    const shadowUntil = shadowActive ? new Date(new Date(`${day}T00:00:00Z`).getTime() + 48 * 3600000).toISOString() : null;

    let debtRows = 0;
    for (const [m, deposit] of Object.entries(muscleDeposit)) {
      // prior debt for this group → overnight decay → + today's deposit
      const { data: prior } = await supabase.from('athlete_recovery_state').select('debt_au, computed_at').eq('athlete_id', profileId).eq('muscle_group', m).lt('day', day).order('day', { ascending: false }).limit(1).maybeSingle();
      let debt = deposit;
      if (prior) {
        const hoursElapsed = Math.max(0, (new Date(`${day}T00:00:00Z`).getTime() - new Date(String(prior.computed_at)).getTime()) / 3600000);
        debt = overnightDecay(num(prior.debt_au) ?? 0, sleepHours, hoursElapsed) + deposit;
      }
      const ratio = debtRatio(debt, chronicTotal);
      const { error: rsErr } = await supabase.from('athlete_recovery_state').upsert({
        athlete_id: profileId, day, muscle_group: m, debt_au: round3(debt), debt_ratio: round3(ratio),
        deposit_au: round3(deposit), prep_variant: prepVariant(ratio), recovery_shadow_until: shadowUntil, computed_at: nowIso,
      }, { onConflict: 'athlete_id,day,muscle_group' });
      if (!rsErr) debtRows++;
    }

    console.log(`[bbf-workload-sentinel] athlete=${profileId} day=${day} sets=${sets.length} total_tonnage_g=${totalTonnage} training_days=${trainingDays} queued=${queued} debt_groups=${debtRows} shadow=${shadowActive}`);
    return jsonResponse({
      ok: true, athlete_id: profileId, user_id: userId, day, sets: sets.length,
      total_tonnage_g: totalTonnage, training_days: trainingDays, acwr: acwrByVector,
      prehab_queued: queued, recovery_groups: debtRows, shadow_active: shadowActive,
    }, 200);
  } catch (e) {
    console.error('[bbf-workload-sentinel] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'sentinel_failed', detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});

// Reconstruct the prior EWMA from a vector's history by replaying its daily strains.
// (The stored ewma columns are the fast path; replay guarantees continuity if a row
//  was ever written without them.)
function reconstructEwma(vhist: Array<{ strain: number }>): { a: number; c: number } {
  let a = vhist[0]?.strain ?? 0, c = a;
  for (let i = 1; i < vhist.length; i++) { a = 0.25 * vhist[i].strain + 0.75 * a; c = 0.0689655 * vhist[i].strain + 0.9310345 * c; }
  return { a, c };
}
function meanOf(xs: Array<number | null>): number | null {
  const vals = xs.filter((x): x is number => x != null);
  return vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : null;
}
const round3 = (v: number): number => Math.round(v * 1000) / 1000;
