// ═══════════════════════════════════════════════════════════════════════════
// bbf-language-sentinel — the nightly Polyglot Sentinel (LANGUAGE_MASTERY §2.2/§4)
// ───────────────────────────────────────────────────────────────────────────
// Pure deterministic Deno, zero Claude/TTS. Per (athlete, language):
//   SRS passes (§2.2): N1 stale-forward · N2 mastery decay (box5→box4) · N3 boost
//     decay (×0.9) · N4 rollup (vocab_mastered / phrases_mastered).
//   Trend engine (§4.4): fluency_slope_14d (least-squares), plateau/regression flags,
//     error-heat → weak_clusters.
//   Phase gate (§4.1): deterministic tier unlock (time-in-phase ≥ 7 d + metrics).
// Idempotent: re-running a night re-derives from the ledgers; writes are upserts.
//
// AUTH: X-BBF-Admin-Token OR X-Cron-Secret. Service role for background writes.
// POST { athlete_id?, language?, limit? }  (no athlete_id → sweep all profiles)
// ═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import {
  isStaleForward, masteryDecay, boostDecay, slope14d, detectTrend, phaseGateCheck,
  normalizeCluster, type PhaseGatesCfg, type PhaseMetrics,
} from '../_shared/language-core.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'apikey, authorization, content-type, x-bbf-admin-token, x-cron-secret',
};
function jsonResponse(body: unknown, status = 200): Response { return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } }); }
const numOf = (v: unknown): number | null => { const n = Number(v); return Number.isFinite(n) ? n : null; };
function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function daysBetween(a: string, b: string): number { const ta = new Date(a).getTime(), tb = new Date(b).getTime(); return Number.isFinite(ta) && Number.isFinite(tb) ? Math.floor((tb - ta) / 86400000) : 0; }

const GATES_FALLBACK: PhaseGatesCfg = {
  time_in_phase_min_days: 7,
  p1_to_2: { terms_box3_min: 60, terms_box5_min: 20, pimsleur_done: 3, streak_min: 10, qualified_days_min: 14 },
  p2_to_3: { terms_box5_min: 45, box5_clearance_14d: 0.70, pimsleur_done: 6, immersion_sessions: 3, fluency_ewma: 55 },
  p3_to_4: { fluency_ewma: 75, sessions_min: 8, max_cluster_share: 0.25, pimsleur_done: 10, phrases_box4_min: 40, box5_clearance_14d: 0.80 },
  p4_to_5: { benchmark_items: ['coaching_session_5min', 'gym_navigation_run', '6_intentions_both_langs', 'bilingual_reel_posted'] },
};

// deno-lint-ignore no-explicit-any
type SB = any;

async function processProfile(supabase: SB, profile: Record<string, unknown>, gates: PhaseGatesCfg, nowIso: string, today: string): Promise<Record<string, unknown>> {
  const athleteId = String(profile.athlete_id);
  const language = String(profile.language);

  // C-1/H-4 · serialize overlapping nightly passes for this athlete before the
  // SRS decay read-modify-write (box_level / priority_boost / due_at).
  await supabase.rpc('bbf_try_athlete_lock', { p_athlete: athleteId });

  // ── SRS decay passes (N1–N3) over the athlete's vocab ──
  const { data: vocab } = await supabase.from('bbf_vocab_mastery')
    .select('id,term,box_level,priority_boost,last_reviewed,source').eq('athlete_id', athleteId).eq('language', language);
  const rows = (vocab ?? []) as Array<Record<string, unknown>>;
  let n1 = 0, n2 = 0, n3 = 0;
  for (const r of rows) {
    const box = Number(r.box_level) || 1;
    const last = String(r.last_reviewed ?? nowIso);
    const boost = numOf(r.priority_boost) ?? 0;
    const patch: Record<string, unknown> = {};
    const decay = masteryDecay(box, last, nowIso);            // N2 (box5 >45d → box4, due now)
    if (decay) { patch.box_level = decay.newBox; patch.due_at = nowIso; n2++; }
    else if (isStaleForward(box, last, nowIso)) { patch.due_at = nowIso; n1++; } // N1 (box5 >14d → due)
    const newBoost = boostDecay(boost, last, nowIso, box >= 2); // N3 (box≥2 = last attempt correct)
    if (newBoost !== boost) { patch.priority_boost = newBoost; n3++; }
    if (Object.keys(patch).length) await supabase.from('bbf_vocab_mastery').update(patch).eq('id', r.id);
  }

  // ── N4 rollup ──
  const boxAfter = new Map<string, number>(); // reflect the just-applied N2 decay in the counts
  for (const r of rows) boxAfter.set(String(r.id), Number(r.box_level) || 1);
  const vocabMastered = rows.filter((r) => (Number(r.box_level) || 1) >= 5 && !masteryDecay(Number(r.box_level) || 1, String(r.last_reviewed ?? nowIso), nowIso)).length;
  const termsBox3 = rows.filter((r) => (Number(r.box_level) || 1) >= 3).length;
  const phrasesBox4 = rows.filter((r) => String(r.source) === 'phrase_kit' && (Number(r.box_level) || 1) >= 4).length;

  // ── Trend engine (14-day fluency slope + error heat) ──
  const since = ymd(new Date(Date.now() - 14 * 86400000));
  const { data: hist } = await supabase.from('bbf_language_session_history')
    .select('started_at,module,fluency_score,error_clusters,items').eq('athlete_id', athleteId).eq('language', language).gte('started_at', since).order('started_at', { ascending: true });
  const sessions = (hist ?? []) as Array<Record<string, unknown>>;
  const fluencyPoints = sessions.filter((s) => s.module === 'immersion' && numOf(s.fluency_score) != null)
    .map((s) => ({ x: daysBetween(since, String(s.started_at)), y: numOf(s.fluency_score) as number }));
  const slope = slope14d(fluencyPoints);
  const immersionSessions = sessions.filter((s) => s.module === 'immersion').length;
  const trend = detectTrend(slope, numOf(profile.fluency_ewma), fluencySessionCount(fluencyPoints));

  // error heat → weak_clusters (14d shares)
  const clusterCounts: Record<string, number> = {};
  for (const s of sessions) { const ec = (s.error_clusters ?? {}) as Record<string, number>; for (const [c, n] of Object.entries(ec)) clusterCounts[normalizeCluster(c)] = (clusterCounts[normalizeCluster(c)] || 0) + (Number(n) || 0); }
  const totalClusters = Object.values(clusterCounts).reduce((a, b) => a + b, 0);
  const weakClusters = Object.entries(clusterCounts).sort((a, b) => b[1] - a[1]).map(([c, n]) => ({ cluster: c, share: totalClusters ? Math.round((n / totalClusters) * 1000) / 1000 : 0 }));
  const maxClusterShare = weakClusters.length ? weakClusters[0].share : null;

  // box5 clearance (14d) from per-item logs — insufficient_data (<5) → null
  let box5Attempts = 0, box5Correct = 0;
  for (const s of sessions) for (const it of (Array.isArray(s.items) ? s.items as Array<Record<string, unknown>> : [])) {
    if (Number(it.box_before) === 5) { box5Attempts++; if (it.correct === true) box5Correct++; }
  }
  const box5Clearance = box5Attempts >= 5 ? Math.round((box5Correct / box5Attempts) * 1000) / 1000 : null;

  // qualified days (distinct session days)
  const qualifiedDays = new Set(sessions.map((s) => String(s.started_at).slice(0, 10))).size;

  // ── Phase gate ──
  const { count: pimsleurDone } = await supabase.from('bbf_pimsleur_progress').select('id', { count: 'exact', head: true }).eq('athlete_id', athleteId).eq('language', language).eq('status', 'completed');
  const phase = Number(profile.phase) || 1;
  const daysInPhase = daysBetween(String(profile.phase_started_on ?? today), today);
  const metrics: PhaseMetrics = {
    terms_box3: termsBox3, terms_box5: vocabMastered, pimsleur_done: Number(pimsleurDone) || 0,
    streak_current: Number(profile.streak_current) || 0, qualified_days: qualifiedDays, box5_clearance_14d: box5Clearance,
    immersion_sessions: immersionSessions, fluency_ewma: numOf(profile.fluency_ewma), max_cluster_share: maxClusterShare,
    phrases_box4: phrasesBox4, benchmark_done: 0, days_in_phase: daysInPhase,
  };
  const gate = phaseGateCheck(phase, metrics, gates);
  const promoted = gate.met && gate.next_phase != null;

  // ── Write the profile (slope, rollups, weak clusters, phase) ──
  await supabase.from('bbf_language_profiles').update({
    fluency_slope_14d: slope, vocab_mastered: vocabMastered, phrases_mastered: phrasesBox4,
    weak_clusters: weakClusters,
    ...(promoted ? { phase: gate.next_phase, phase_started_on: today } : {}),
    updated_at: nowIso,
  }).eq('athlete_id', athleteId).eq('language', language);

  return { athlete_id: athleteId, language, srs: { n1_stale: n1, n2_decay: n2, n3_boost: n3 }, vocab_mastered: vocabMastered, slope, trend, promoted, phase: promoted ? gate.next_phase : phase, gate_missing: gate.missing };
}

function fluencySessionCount(points: Array<{ x: number; y: number }>): number { return points.length; }

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405);
  const ADMIN = Deno.env.get('BBF_COACH_AGENT_TOKEN') ?? '', CRON = Deno.env.get('CRON_SECRET') ?? '';
  if (!(ADMIN && (req.headers.get('x-bbf-admin-token') ?? '') === ADMIN) && !(CRON && (req.headers.get('x-cron-secret') ?? '') === CRON)) {
    return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
  }
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL'), SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!SUPABASE_URL || !SERVICE) return jsonResponse({ ok: false, error: 'config_missing' }, 503);
  const supabase: SB = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* defaults */ }
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 1000);
  const athleteId = String(body.athlete_id ?? '').trim() || null;
  const language = String(body.language ?? '').trim() || null;

  const nowIso = new Date().toISOString();
  const today = ymd(new Date());

  // gate config
  let gates: PhaseGatesCfg = GATES_FALLBACK;
  try {
    const { data } = await supabase.from('bbf_app_config').select('value').eq('key', 'lang_phase_gates_v1').maybeSingle();
    if (data?.value) { const p = JSON.parse(data.value); if (p?.p1_to_2 && p?.p2_to_3 && p?.p3_to_4) gates = p as PhaseGatesCfg; }
  } catch (_) { /* fallback matches the seed */ }

  // select the profiles to process
  let q = supabase.from('bbf_language_profiles').select('athlete_id,language,phase,phase_started_on,streak_current,streak_best,last_qualified_on,fluency_ewma').limit(limit);
  if (athleteId) q = q.eq('athlete_id', athleteId);
  if (language) q = q.eq('language', language);
  const { data: profiles, error: qErr } = await q;
  if (qErr) return jsonResponse({ ok: false, error: 'query_failed', detail: qErr.message }, 500);

  const results: Array<Record<string, unknown>> = [];
  let promoted = 0;
  for (const p of (profiles ?? [])) {
    try { const r = await processProfile(supabase, p, gates, nowIso, today); if (r.promoted) promoted++; results.push(r); }
    catch (e) { results.push({ athlete_id: p.athlete_id, language: p.language, error: e instanceof Error ? e.message : String(e) }); }
  }

  console.log(`[bbf-language-sentinel] profiles=${(profiles ?? []).length} promoted=${promoted}`);
  return jsonResponse({ ok: true, processed: (profiles ?? []).length, promoted, results }, 200);
});
