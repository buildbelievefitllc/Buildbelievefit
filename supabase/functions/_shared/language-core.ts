// ═══════════════════════════════════════════════════════════════════════════
// _shared/language-core.ts — deterministic Language Mastery math (SRS · trend · gates)
// ───────────────────────────────────────────────────────────────────────────
// Pure functions shared by bbf-language-sentinel (nightly SRS/trend/gate), plus the
// closed error taxonomy (immersion) and the banned-lexeme / gram-slot gate (linguist).
// Zero I/O, zero Claude. Deterministic + replayable from the ledgers.
// ═══════════════════════════════════════════════════════════════════════════

// ── The fixed error-cluster taxonomy (§4.4 · lang_error_clusters_v1) ─────────
export const ERROR_CLUSTERS = [
  'ser_estar', 'gender_agreement', 'verb_conjugation', 'preposition',
  'false_friend', 'word_order', 'vocab_gap', 'register', 'pronunciation',
] as const;
export type ErrorCluster = typeof ERROR_CLUSTERS[number];
const CLUSTER_SET = new Set<string>(ERROR_CLUSTERS);
export function normalizeCluster(c: unknown): ErrorCluster {
  const t = String(c ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return (CLUSTER_SET.has(t) ? t : 'vocab_gap') as ErrorCluster; // closed list; unknown → vocab_gap
}

// ── The Gram cross-over gate (§0.1 · linguist) ───────────────────────────────
// Banned in stored templates/translations (both languages). Grams-only.
export const BANNED_LEXEME_RE = /\b(kilos?|kg|libras?|lbs?|quilos?|pounds?|gramos?|gramas?)\b/i;
export function hasBannedLexeme(s: string): boolean { return BANNED_LEXEME_RE.test(String(s ?? '')); }
export function hasMassSlot(s: string): boolean { return /\{(load_g|body_mass_g)\}/.test(String(s ?? '')); }

// ── SRS constants (srs_weights_v1) ───────────────────────────────────────────
export const INTERVAL_DAYS: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 7, 5: 14 };
export const W_BOX: Record<number, number> = { 1: 1.00, 2: 0.60, 3: 0.35, 4: 0.20, 5: 0.10 };
export const STALE_FORWARD_DAYS = 14;   // N1
export const MASTERY_DECAY_DAYS = 45;   // N2
export const BOOST_DECAY_RECENT_DAYS = 7; // N3
export const BOOST_DECAY_MULT = 0.9;
export const PRIORITY_BOOST_MAJOR = 0.50;
export const PRIORITY_BOOST_MINOR = 0.25;
export const PRIORITY_BOOST_MISS = 0.15;

export function daysBetween(a: string, b: string): number {
  const ta = new Date(a).getTime(), tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
  return Math.floor((tb - ta) / 86400000);
}
// N1 · STALE-FORWARD: a box-5 term unreviewed > 14 d is due again (maintenance).
export function isStaleForward(boxLevel: number, lastReviewed: string, now: string): boolean {
  return boxLevel >= 5 && daysBetween(lastReviewed, now) > STALE_FORWARD_DAYS;
}
// N2 · MASTERY DECAY: a box-5 term unreviewed > 45 d rots to box 4, due now.
export function masteryDecay(boxLevel: number, lastReviewed: string, now: string): { newBox: number } | null {
  return boxLevel >= 5 && daysBetween(lastReviewed, now) > MASTERY_DECAY_DAYS ? { newBox: 4 } : null;
}
// N3 · BOOST DECAY: a boosted term that behaved (reviewed < 7 d ago, correct) earns
// its way back toward normal (×0.9).
export function boostDecay(priorityBoost: number, lastReviewed: string, now: string, lastCorrect: boolean): number {
  if (priorityBoost > 0 && lastCorrect && daysBetween(lastReviewed, now) < BOOST_DECAY_RECENT_DAYS) {
    return Math.round(priorityBoost * BOOST_DECAY_MULT * 1000) / 1000;
  }
  return priorityBoost;
}

// ── Trend engine (§4.4) — least-squares slope of fluency vs day, 14-day window ─
export function slope14d(points: Array<{ x: number; y: number }>): number {
  const n = points.length;
  if (n < 2) return 0;
  const mx = points.reduce((s, p) => s + p.x, 0) / n;
  const my = points.reduce((s, p) => s + p.y, 0) / n;
  let numr = 0, den = 0;
  for (const p of points) { numr += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  return den === 0 ? 0 : Math.round((numr / den) * 1000) / 1000;
}
export type TrendFlag = 'plateau' | 'regression' | 'velocity_ok';
export function detectTrend(slope: number, ewma: number | null, sessionCount: number): TrendFlag {
  if (sessionCount >= 4 && slope <= -1.0) return 'regression';
  if (sessionCount >= 4 && Math.abs(slope) < 0.3 && (ewma ?? 0) < 75) return 'plateau';
  return 'velocity_ok';
}
export function updateFluencyEwma(prior: number | null, avg: number, lambda = 0.30): number {
  if (prior == null) return Math.round(avg * 100) / 100;
  return Math.round((lambda * avg + (1 - lambda) * prior) * 100) / 100;
}

// ── Streak (§1.2) — one qualifying event per calendar day ────────────────────
export function updateStreak(streakCurrent: number, lastQualifiedOn: string | null, today: string): { streak_current: number; qualified: boolean } {
  if (lastQualifiedOn === today) return { streak_current: streakCurrent, qualified: false }; // already counted
  const gap = lastQualifiedOn ? daysBetween(lastQualifiedOn, today) : 999;
  if (gap === 1) return { streak_current: streakCurrent + 1, qualified: true };
  return { streak_current: 1, qualified: true }; // reset (no punishment beyond reset)
}

// ── Phase gate (§4.1) — deterministic tier unlock ────────────────────────────
export interface PhaseGatesCfg {
  time_in_phase_min_days: number;
  p1_to_2: { terms_box3_min: number; terms_box5_min: number; pimsleur_done: number; streak_min: number; qualified_days_min: number };
  p2_to_3: { terms_box5_min: number; box5_clearance_14d: number; pimsleur_done: number; immersion_sessions: number; fluency_ewma: number };
  p3_to_4: { fluency_ewma: number; sessions_min: number; max_cluster_share: number; pimsleur_done: number; phrases_box4_min: number; box5_clearance_14d: number };
  p4_to_5: { benchmark_items: string[] };
}
export interface PhaseMetrics {
  terms_box3: number; terms_box5: number; pimsleur_done: number; streak_current: number;
  qualified_days: number; box5_clearance_14d: number | null; immersion_sessions: number;
  fluency_ewma: number | null; max_cluster_share: number | null; phrases_box4: number;
  benchmark_done: number; days_in_phase: number;
}
export interface GateResult { met: boolean; missing: string[]; next_phase: number | null; detail: Record<string, unknown>; }

const insufficient = (v: number | null) => v == null; // 'insufficient_data' holds the gate open, never fails it

export function phaseGateCheck(phase: number, m: PhaseMetrics, g: PhaseGatesCfg): GateResult {
  const missing: string[] = [];
  const timeOk = m.days_in_phase >= g.time_in_phase_min_days;
  if (!timeOk) missing.push('time_in_phase');

  if (phase === 1) {
    const c = g.p1_to_2;
    if (m.terms_box3 < c.terms_box3_min) missing.push('V1_terms_box3');
    if (m.terms_box5 < c.terms_box5_min) missing.push('V2_terms_box5');
    if (m.pimsleur_done < c.pimsleur_done) missing.push('P1_pimsleur');
    if (!(m.streak_current >= c.streak_min || m.qualified_days >= c.qualified_days_min)) missing.push('S1_consistency');
    return finalize(missing, timeOk, 2);
  }
  if (phase === 2) {
    const c = g.p2_to_3;
    if (m.terms_box5 < c.terms_box5_min) missing.push('V3_terms_box5');
    if (insufficient(m.box5_clearance_14d)) missing.push('V4_insufficient_data');
    else if ((m.box5_clearance_14d as number) < c.box5_clearance_14d) missing.push('V4_box5_clearance');
    if (m.pimsleur_done < c.pimsleur_done) missing.push('P2_pimsleur');
    if (m.immersion_sessions < c.immersion_sessions) missing.push('I1_sessions');
    if ((m.fluency_ewma ?? 0) < c.fluency_ewma) missing.push('I1_fluency');
    return finalize(missing, timeOk, 3);
  }
  if (phase === 3) {
    const c = g.p3_to_4;
    if ((m.fluency_ewma ?? 0) < c.fluency_ewma) missing.push('I2_fluency');
    if (m.immersion_sessions < c.sessions_min) missing.push('I2_sessions');
    if (m.max_cluster_share != null && m.max_cluster_share >= c.max_cluster_share) missing.push('I3_dominant_cluster');
    if (m.pimsleur_done < c.pimsleur_done) missing.push('P3_pimsleur');
    if (m.phrases_box4 < c.phrases_box4_min) missing.push('R1_phrases');
    if (insufficient(m.box5_clearance_14d)) missing.push('V5_insufficient_data');
    else if ((m.box5_clearance_14d as number) < c.box5_clearance_14d) missing.push('V5_box5_clearance');
    return finalize(missing, timeOk, 4);
  }
  if (phase === 4) {
    if (m.benchmark_done < (g.p4_to_5.benchmark_items?.length ?? 4)) missing.push('B_benchmark');
    return finalize(missing, timeOk, 5);
  }
  return { met: false, missing: ['graduated'], next_phase: null, detail: { phase } }; // phase 5 = terminal
}
function finalize(missing: string[], timeOk: boolean, nextPhase: number): GateResult {
  const met = missing.length === 0 && timeOk;
  return { met, missing, next_phase: met ? nextPhase : null, detail: { time_ok: timeOk } };
}
