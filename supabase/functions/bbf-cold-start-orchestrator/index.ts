// ═══════════════════════════════════════════════════════════════════════════
// bbf-cold-start-orchestrator — the Day-1 cold-start cascade (blueprint §2.1)
// ───────────────────────────────────────────────────────────────────────────
// Runs immediately after `provisioned` commits (invoked by the webhook, re-runnable
// by the sweeper). Guarantees the Hub's day-1 rows EXIST before credentials are
// dispatched — so a first login can never race an empty database ("No Empty
// Dashboards", §0.3). Pure deterministic orchestration: ZERO Claude, ZERO TTS.
//
// Every step is an idempotent upsert keyed on (athlete, day) or (user) — re-running
// the cascade heals, never duplicates. The final act is the readiness gate check
// (§3.2): sets pipeline state cold_start_ready | cold_start_degraded and returns it.
//
// ID SPACES (deliberate, per the blueprints):
//   • cardio prescription + language profile key on bbf_users.id  (user_id)
//   • nutrition / metrics / prehab / brief / playlists key on athlete_profiles.id
// The orchestrator resolves BOTH and seeds each with the correct key.
//
// THE GRAM BOUNDARY: body_mass_g flows through as an integer BIGINT of grams; every
// macro/energy output is integer grams / kcal. No kg ever appears.
//
// AUTH: dual shared-secret (X-BBF-Admin-Token=BBF_COACH_AGENT_TOKEN for the webhook/
// manual path · X-Cron-Secret=CRON_SECRET for the sweeper). Deploy --no-verify-jwt.
//
// POST body: { user_id? | athlete_id? | email? | checkout_session_id?, intake_id?,
//              tier?, locale?, only_steps?: string[], source? }
// → { ok, user_id, profile_id, pipeline_id, state, steps, gate, source }
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  CORS, jsonResponse, normLocale, num, todayUTC, addDaysUTC,
  readConfigJson, onboardingGateCheck, languageEntitled,
  type SupabaseClient,
} from '../_shared/onboarding-core.ts';
import {
  FUEL_FALLBACK, CLAMP_FALLBACK, type FuelCfg, type ClampCfg,
  resolveProfileKey, foundationTargets,
} from '../_shared/fueling-core.ts';

// Tier-1 Foundation math (RMR/TDEE/macros + the RED-S/energy clamps) is centralized
// in _shared/fueling-core.ts — the single clamp engine bbf-fueling-sentinel also uses,
// so the RED-S floor can never drift between the cold-start seed and the live engine.

// ── Cardio · baseline gram outputs (blueprint cardio §0.1 · §2.3) ────────────
interface MetCfg { met: Record<string, number>; gram_met_kcal: number; k_sweat: Record<string, number>; rehydration_mult: number; }
interface HrCfg { tanaka_base: number; tanaka_age_coeff: number; cap_fraction: Record<string, number>; talk_test: Record<string, string>; }
const MET_FALLBACK: MetCfg = { met: { 'Zone 2': 6.0, 'Tempo': 8.5, 'HIIT': 11.0 }, gram_met_kcal: 0.0000175, k_sweat: { 'Zone 2': 0.00015, 'Tempo': 0.00022, 'HIIT': 0.00030 }, rehydration_mult: 1.5 };
const HR_FALLBACK: HrCfg = { tanaka_base: 208, tanaka_age_coeff: 0.7, cap_fraction: { 'Zone 2': 0.70, 'Tempo': 0.80, 'HIIT': 0.90 }, talk_test: { 'Zone 2': 'conversational pace — full sentences' } };

function ageFromBirthDate(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(`${birthDate.slice(0, 10)}T00:00:00Z`);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age >= 5 && age <= 100 ? age : null;
}

function computeCardioBaseline(met: MetCfg, hr: HrCfg, args: { bodyMassG: number; age: number | null; sessionMinutes: number | null }) {
  const tier = 'Zone 2'; // safest cold-start default (no history, no readiness)
  const durationMin = Math.max(10, Math.min(args.sessionMinutes ?? 30, 90));
  const metVal = met.met[tier] ?? 6.0;
  const eeKcal = Math.round(metVal * args.bodyMassG * met.gram_met_kcal * durationMin);
  const sweatG = Math.round(args.bodyMassG * (met.k_sweat[tier] ?? 0.00015) * durationMin);
  const rehydrationG = Math.round(met.rehydration_mult * sweatG);
  const hrMax = args.age !== null ? Math.round(hr.tanaka_base - hr.tanaka_age_coeff * args.age) : null;
  const hrCap = hrMax !== null ? Math.round(hrMax * (hr.cap_fraction[tier] ?? 0.70)) : null;
  return {
    effective_tier: tier, duration_min: durationMin, ee_kcal_est: eeKcal,
    sweat_loss_g_est: sweatG, rehydration_g: rehydrationG, hr_cap_bpm: hrCap,
    talk_test: hr.talk_test[tier] ?? 'conversational pace — full sentences',
  };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);

  // ── Dual auth ──
  const ADMIN_TOKEN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '';
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  const adminOk = ADMIN_TOKEN.length > 0 && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN_TOKEN;
  const cronOk = CRON_SECRET.length > 0 && (req.headers.get('x-cron-secret') ?? '') === CRON_SECRET;
  if (!adminOk && !cronOk) return jsonResponse({ ok: false, error: 'unauthorized' }, 401);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE_ROLE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const source = String(body.source ?? 'manual');
  const onlySteps: string[] | null = Array.isArray(body.only_steps) ? (body.only_steps as string[]) : null;
  const runStep = (name: string) => !onlySteps || onlySteps.includes(name);

  const day = todayUTC();
  const steps: Record<string, unknown> = {};
  const failures: string[] = [];

  try {
    // ═══ RESOLVE IDENTITY ══════════════════════════════════════════════════
    let userId = String(body.user_id ?? body.athlete_id ?? '').trim() || null;
    const sessionId = String(body.checkout_session_id ?? '').trim() || null;
    const emailIn = String(body.email ?? '').trim().toLowerCase() || null;

    // Pipeline first (carries user_id + intake_id + tier).
    let pipeline: Record<string, unknown> | null = null;
    if (sessionId) {
      const { data } = await supabase.from('bbf_onboarding_pipeline').select('*').eq('checkout_session_id', sessionId).maybeSingle();
      pipeline = data ?? null;
    }
    if (!userId && pipeline?.user_id) userId = String(pipeline.user_id);
    if (!userId && emailIn) {
      const { data: u } = await supabase.from('bbf_users').select('id').eq('email', emailIn).maybeSingle();
      if (u?.id) userId = String(u.id);
    }
    if (!userId) return jsonResponse({ ok: false, error: 'unresolved_user' }, 400);

    const { data: user } = await supabase.from('bbf_users').select('*').eq('id', userId).maybeSingle();
    if (!user) return jsonResponse({ ok: false, error: 'user_not_found', user_id: userId }, 404);

    const locale = normLocale(body.locale ?? user.preferred_locale);
    const tier = String(body.tier ?? pipeline?.tier ?? user.current_tier ?? user.metabolic_tier ?? '').trim() || null;
    const role = (user.role as string | null) ?? null;

    // Resolve (or create) the pipeline row — the ledger the gate writes to.
    if (!pipeline) {
      const { data: existing } = await supabase.from('bbf_onboarding_pipeline')
        .select('*').eq('user_id', userId).neq('state', 'activated')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      pipeline = existing ?? null;
    }
    if (!pipeline) {
      const { data: created } = await supabase.from('bbf_onboarding_pipeline').insert({
        checkout_session_id: sessionId, user_id: userId, email: user.email ?? emailIn ?? 'unknown',
        tier: tier ?? 'unknown', state: 'provisioned',
        steps: { provisioned: { ok: true, at: new Date().toISOString() } },
        intake_id: (body.intake_id as string) ?? null,
      }).select('*').maybeSingle();
      pipeline = created ?? null;
    }
    const pipelineId = pipeline?.id ? String(pipeline.id) : null;

    // Resolve intake (explicit → pipeline → consumed_by_user → fuzzy unconsumed email <72h).
    let intake: Record<string, unknown> | null = null;
    const intakeId = String(body.intake_id ?? pipeline?.intake_id ?? '').trim() || null;
    if (intakeId) {
      const { data } = await supabase.from('bbf_pathfinder_intakes').select('*').eq('id', intakeId).maybeSingle();
      intake = data ?? null;
    }
    if (!intake) {
      const { data } = await supabase.from('bbf_pathfinder_intakes').select('*').eq('consumed_by_user', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      intake = data ?? null;
    }
    if (!intake && (user.email || emailIn)) {
      const cutoff = new Date(Date.now() - 72 * 3600_000).toISOString();
      const { data } = await supabase.from('bbf_pathfinder_intakes').select('*')
        .eq('email', (user.email ?? emailIn)).is('consumed_by_user', null).gte('created_at', cutoff)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      intake = data ?? null;
      if (intake?.id) await supabase.from('bbf_pathfinder_intakes').update({ consumed_by_user: userId }).eq('id', intake.id);
    }

    // Cold-start defaults (config), for the paid-without-questionnaire path (§2.4 A).
    const defaults = await readConfigJson<Record<string, unknown>>(supabase, 'cold_start_defaults_v1');
    const defPersona = (defaults?.default as Record<string, unknown> | undefined) ?? { body_mass_g: 81647, body_fat_pct: 18, training_days_wk: 4, session_minutes: 60, sport_profile: 'glycolytic' };

    const bodyMassG = Math.round(num(intake?.body_mass_g) ?? num(defPersona.body_mass_g) ?? 81647); // GRAM BOUNDARY: integer grams
    const bodyFatPct = num(intake?.body_fat_pct) ?? num(defPersona.body_fat_pct);
    const trainingDaysWk = num(intake?.training_days_wk) ?? num(defPersona.training_days_wk);
    const sessionMinutes = num(intake?.session_minutes) ?? num(defPersona.session_minutes);
    const sport = (intake?.sport as string | null) ?? null;
    const birthYear = num(intake?.birth_year);
    const metricsSource = intake?.body_mass_g ? 'intake' : 'default';

    // ═══ STEP 1 · IDENTITY & METRICS ═══════════════════════════════════════
    let profileId: string | null = null;
    if (runStep('metrics')) {
      // find-or-create athlete_profiles (no UNIQUE on user_id → existence check)
      const { data: prof } = await supabase.from('athlete_profiles').select('id').eq('user_id', userId).order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (prof?.id) {
        profileId = String(prof.id);
      } else {
        const birthDate = birthYear ? `${birthYear}-01-01` : `${new Date().getUTCFullYear() - 30}-01-01`;
        const { data: newProf, error: profErr } = await supabase.from('athlete_profiles').insert({
          user_id: userId, full_name: (user.name as string) || (intake?.email as string) || 'BBF Athlete',
          birth_date: birthDate, sport: sport || 'general', preferred_language: locale,
        }).select('id').maybeSingle();
        if (profErr) throw new Error(`profile:${profErr.message}`);
        profileId = newProf?.id ? String(newProf.id) : null;
      }
      if (profileId) {
        // athlete_body_metrics upsert (UNIQUE athlete_id, measured_on). Integer grams.
        const { error: bmErr } = await supabase.from('athlete_body_metrics').upsert({
          athlete_id: profileId, measured_on: day, body_mass_g: bodyMassG,
          body_fat_pct: bodyFatPct, source: metricsSource === 'intake' ? 'intake' : 'manual_checkin',
        }, { onConflict: 'athlete_id,measured_on' });
        if (bmErr) throw new Error(`metrics:${bmErr.message}`);
        // Mirror the gram body mass onto the profile (Prehab §1.3 column).
        await supabase.from('athlete_profiles').update({ body_mass_g: bodyMassG, body_mass_logged_at: new Date().toISOString() }).eq('id', profileId);
      }
      steps.metrics_seeded = { ok: !!profileId, at: new Date().toISOString(), source: metricsSource, body_mass_g: bodyMassG };
      if (!profileId) failures.push('metrics');
    } else {
      const { data: prof } = await supabase.from('athlete_profiles').select('id').eq('user_id', userId).limit(1).maybeSingle();
      profileId = prof?.id ? String(prof.id) : null;
    }

    const leanMassG = Math.round(bodyMassG * (1 - (bodyFatPct ?? 20) / 100)); // gram-pure

    // ═══ STEP 2 · FUELING SENTINEL — TIER 1 FOUNDATION (28-day horizon) ════
    if (runStep('nutrition') && profileId) {
      try {
        const fuel = (await readConfigJson<FuelCfg>(supabase, 'fueling_coefficients_v1')) ?? FUEL_FALLBACK;
        const clamp = (await readConfigJson<ClampCfg>(supabase, 'fueling_safety_clamps_v1')) ?? CLAMP_FALLBACK;
        const profileKey = resolveProfileKey(sport, sessionMinutes);
        const f = foundationTargets(fuel, clamp, { bodyMassG, leanMassG, trainingDaysWk, twiceDaily: false, profileKey, atpPc: profileKey === 'atp_pc' });
        const trace = { source: 'cold_start', inputs: { bodyMassG, leanMassG, trainingDaysWk, sessionMinutes, profileKey }, clamps_fired: f.clamps_fired };
        const rows = Array.from({ length: 28 }, (_v, i) => ({
          athlete_id: profileId, day: addDaysUTC(day, i), tier: 'foundation',
          tdee_kcal: f.tdee_kcal, protein_g: f.protein_g, carbs_g: f.carbs_g, fat_g: f.fat_g,
          creatine_g: f.creatine_g, coefficients: f.coefficients, day_type: 'standard',
          timing_plan: null, computation_trace: trace,
        }));
        const { error: nErr } = await supabase.from('athlete_nutrition_targets_daily').upsert(rows, { onConflict: 'athlete_id,day' });
        if (nErr) throw new Error(nErr.message);
        steps.nutrition_init = { ok: true, at: new Date().toISOString(), rows: rows.length, tdee_kcal: f.tdee_kcal };
      } catch (e) {
        steps.nutrition_init = { ok: false, at: new Date().toISOString(), error: (e as Error).message };
        failures.push('nutrition');
      }
    }

    // ═══ STEP 3 · CARDIO MATRIX — BASELINE PRESCRIPTION ════════════════════
    if (runStep('cardio')) {
      try {
        // resolve age from the profile's birth_date (authoritative) else intake birth_year
        let age: number | null = birthYear ? (new Date().getUTCFullYear() - birthYear) : null;
        if (profileId) {
          const { data: p } = await supabase.from('athlete_profiles').select('birth_date').eq('id', profileId).maybeSingle();
          const a = ageFromBirthDate(p?.birth_date as string | null);
          if (a !== null) age = a;
        }
        const met = (await readConfigJson<MetCfg>(supabase, 'cardio_met_values_v1')) ?? MET_FALLBACK;
        const hr = (await readConfigJson<HrCfg>(supabase, 'cardio_hr_model_v1')) ?? HR_FALLBACK;
        const c = computeCardioBaseline(met, hr, { bodyMassG, age, sessionMinutes });
        // Only seed if today has no active row (idempotent · gate G3 = row exists).
        const { data: existing } = await supabase.from('bbf_cardio_prescription')
          .select('id').eq('user_id', userId).eq('prescribed_for', day).eq('status', 'active').limit(1).maybeSingle();
        if (!existing?.id) {
          const { error: cErr } = await supabase.from('bbf_cardio_prescription').insert({
            user_id: userId, prescribed_for: day,
            recovery_state: 'unknown', tier_ceiling: null, rpe_ceiling: null, work_rest_ratio: null,
            interval_directive: 'No morning readiness on file — baseline Zone 2 prescription, no recovery clamp.',
            recovery_note: `Cold-start baseline · ${c.talk_test}`,
            mech_state: null, effective_tier: c.effective_tier, hr_cap_bpm: c.hr_cap_bpm,
            rpe_cap: null, duration_min: c.duration_min, ee_kcal_est: c.ee_kcal_est,
            sweat_loss_g_est: c.sweat_loss_g_est, rehydration_g: c.rehydration_g,
            prescription_trace: { source: 'cold_start', tier: c.effective_tier, met_based: true, age },
            status: 'active',
          });
          if (cErr) throw new Error(cErr.message);
        }
        steps.cardio_init = { ok: true, at: new Date().toISOString(), tier: c.effective_tier, ee_kcal: c.ee_kcal_est, rehydration_g: c.rehydration_g };
      } catch (e) {
        steps.cardio_init = { ok: false, at: new Date().toISOString(), error: (e as Error).message };
        failures.push('cardio');
      }
    }

    // ═══ STEP 4 · PREHAB BASELINE (friction flags → injury seeds + advisory) ═
    if (runStep('prehab') && profileId) {
      try {
        const flags: string[] = Array.isArray(intake?.friction_flags) ? (intake!.friction_flags as string[]) : [];
        const JOINT = new Set(['shoulder', 'knee', 'lower_back', 'elbow', 'hamstring', 'ankle', 'hip', 'wrist', 'neck', 'groin']);
        const mapFlag = (f: string): string | null => {
          const t = f.toLowerCase().replace(/\s+/g, '_');
          if (t.includes('low') && t.includes('back')) return 'lower_back';
          if (JOINT.has(t)) return t;
          if (t.includes('knee')) return 'knee'; if (t.includes('shoulder')) return 'shoulder';
          if (t.includes('back')) return 'lower_back'; if (t.includes('ankle')) return 'ankle';
          if (t.includes('hamstring')) return 'hamstring'; if (t.includes('elbow')) return 'elbow';
          return null;
        };
        const joints = Array.from(new Set(flags.map(mapFlag).filter((j): j is string => !!j)));
        for (const joint of joints) {
          const { data: inj } = await supabase.from('athlete_injury_history')
            .select('id').eq('athlete_id', profileId).eq('joint_zone', joint).eq('reported_by', 'intake').limit(1).maybeSingle();
          if (!inj?.id) {
            await supabase.from('athlete_injury_history').insert({
              athlete_id: profileId, joint_zone: joint, side: 'n/a', injury_type: 'friction_pattern',
              mechanism: 'unknown', severity: 4, occurred_on: day, reported_by: 'intake',
              notes: 'Seeded from Pathfinder intake friction flag (cold start).',
            });
          }
          const { data: pq } = await supabase.from('prehab_queue')
            .select('id').eq('athlete_id', profileId).eq('joint_zone', joint).eq('scheduled_for', day).in('status', ['queued', 'served']).limit(1).maybeSingle();
          if (!pq?.id) {
            await supabase.from('prehab_queue').insert({
              athlete_id: profileId, scheduled_for: day, joint_zone: joint, priority: 'advisory', risk_score: 25,
              trigger_reason: { source: 'cold_start', history_only: true, flag: joint, weights_version: 'v1' },
              protocol: { source: 'baseline', joint, drills: [] }, status: 'queued',
            });
          }
        }
        steps.prehab_init = { ok: true, at: new Date().toISOString(), mode: joints.length ? 'advisory' : 'baseline', joints };
      } catch (e) {
        steps.prehab_init = { ok: false, at: new Date().toISOString(), error: (e as Error).message };
        failures.push('prehab');
      }
    }

    // ═══ STEP 5 · LANGUAGE PHASE (entitled/admin only, else auto-pass) ═════
    if (runStep('language')) {
      try {
        if (languageEntitled(tier, role)) {
          const { error: lErr } = await supabase.from('bbf_language_profiles').upsert({
            athlete_id: userId, language: 'es', phase: 1, phase_started_on: day, protocol_started_on: day,
          }, { onConflict: 'athlete_id,language', ignoreDuplicates: true });
          if (lErr) throw new Error(lErr.message);
          steps.language_init = { ok: true, at: new Date().toISOString() };
        } else {
          steps.language_init = { skipped: 'not_entitled' };
        }
      } catch (e) {
        steps.language_init = { ok: false, at: new Date().toISOString(), error: (e as Error).message };
        failures.push('language');
      }
    }

    // ═══ STEP 6 · SOVEREIGN BRIEF (neutral S0 · fail-open base playlist) ════
    if (runStep('brief') && profileId) {
      try {
        // brief context (locale-neutral payload)
        await supabase.from('bbf_daily_brief_context').upsert({
          athlete_id: profileId, day, status: 'ready',
          payload: { source: 'cold_start', readiness: 'neutral', cardio: { tier: 'Zone 2' }, generated_at: new Date().toISOString() },
        }, { onConflict: 'athlete_id,day' });

        // base playlist [S0_NEUTRAL, S5_ZONE2_MID, S7_STEADY] — resolve URLs where baked.
        const wanted = [
          { slot: 'S0', variant_key: 'S0_NEUTRAL' },
          { slot: 'S5', variant_key: 'S5_ZONE2_MID' },
          { slot: 'S7', variant_key: 'S7_STEADY' },
        ];
        const playlist: Array<Record<string, unknown>> = [];
        let total = 0; let seq = 0;
        for (const w of wanted) {
          const { data: frag } = await supabase.from('sovereign_audio_fragments')
            .select('public_url, duration_ms, sha256').eq('variant_key', w.variant_key).eq('locale', locale).eq('status', 'active').limit(1).maybeSingle();
          const dur = num(frag?.duration_ms) ?? 0;
          playlist.push({
            seq: seq++, slot: w.slot, variant_key: w.variant_key,
            url: frag?.public_url ?? null, sha256: frag?.sha256 ?? null,
            duration_ms: dur, gap_after_ms: w.slot === 'S5' ? 400 : 240,
            fallback: frag?.public_url ? null : 'device_tts', screen_fact_ids: [],
          });
          total += dur + (w.slot === 'S5' ? 400 : 240);
        }
        const { error: plErr } = await supabase.from('sovereign_brief_playlists').upsert({
          athlete_id: profileId, day, locale, playlist, screen_facts: [],
          beats_selected: { source: 'cold_start', ranked: [], dropped: [], base_only: true },
          tone: 'steady', total_duration_ms: total, status: 'ready',
        }, { onConflict: 'athlete_id,day,locale' });
        if (plErr) throw new Error(plErr.message);
        const baked = playlist.filter((p) => p.url).length;
        steps.brief_init = { ok: true, at: new Date().toISOString(), fragments: playlist.length, baked_resolved: baked };
      } catch (e) {
        steps.brief_init = { ok: false, at: new Date().toISOString(), error: (e as Error).message };
        failures.push('brief');
      }
    }

    // ═══ STEP 7 · READINESS GATE CHECK ═════════════════════════════════════
    const gate = await onboardingGateCheck(supabase, { userId, profileId, locale, tier, role, day });
    const newState = gate.passed ? 'cold_start_ready' : 'cold_start_degraded';

    if (pipelineId) {
      const priorSteps = (pipeline?.steps && typeof pipeline.steps === 'object') ? pipeline.steps as Record<string, unknown> : {};
      await supabase.from('bbf_onboarding_pipeline').update({
        state: newState,
        steps: { ...priorSteps, ...steps, gate: { passed: gate.passed, failing: gate.failing, at: new Date().toISOString() } },
        failure_reason: gate.passed ? null : `gate_failed:${gate.failing.join(',')}`,
        state_entered_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', pipelineId);
    }

    console.log(`[bbf-cold-start-orchestrator] user=${userId} profile=${profileId} state=${newState} failing=[${gate.failing.join(',')}] cascade_failures=[${failures.join(',')}] source=${source}`);

    return jsonResponse({
      ok: true, user_id: userId, profile_id: profileId, pipeline_id: pipelineId,
      state: newState, steps, gate, cascade_failures: failures, source,
    }, 200);
  } catch (e) {
    console.error('[bbf-cold-start-orchestrator] fatal:', e instanceof Error ? e.message : String(e));
    return jsonResponse({ ok: false, error: 'orchestrator_failed', detail: e instanceof Error ? e.message : String(e), steps }, 500);
  }
});
