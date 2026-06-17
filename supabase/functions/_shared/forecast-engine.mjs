// supabase/functions/_shared/forecast-engine.mjs
// ─────────────────────────────────────────────────────────────────────────────
// BBF Deterministic 1RM Forecast Engine — Phase: calculator-off-LLM, wave 1.
// PURE MATH, ZERO AI. Replaces the Haiku narration that used to "estimate" the
// 1RM trajectory inside bbf-agentic-forecasting. Every number is grounded in a
// NAMED model — no invented coefficients:
//
//   · Epley (1985)    1RM = w · (1 + reps/30)
//   · Brzycki (1993)  1RM = w · 36 / (37 − reps)        (valid reps < 37)
//   · Ordinary Least Squares linear regression for the 30-day trajectory.
//
// Pure ESM, no Deno/node built-ins, so the SAME file runs under Deno (the edge
// function imports it) and under node (the .test.mjs asserts it) — mirroring the
// wearable-core.mjs / wearable-core.test.mjs cross-runtime pattern.

// ── Single-rep estimators (named models) ─────────────────────────────────────
// A true 1-rep set IS the 1RM, so reps<=1 short-circuits to the lifted weight
// (Epley would otherwise inflate it by 3.3%). Inputs are coerced + guarded.
export function epley1RM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0) return 0;
  if (r <= 1) return w;
  return w * (1 + r / 30);
}

export function brzycki1RM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0) return 0;
  if (r <= 1) return w;
  if (r >= 37) return epley1RM(w, r); // Brzycki diverges as reps→37
  return w * 36 / (37 - r);
}

// Blended single-set 1RM estimate — the average of the two named models, which
// brackets the true 1RM (Epley reads high at higher reps, Brzycki reads low).
export function estimate1RM(weight, reps) {
  const w = Number(weight) || 0;
  if (w <= 0) return 0;
  return (epley1RM(w, reps) + brzycki1RM(w, reps)) / 2;
}

// Commercial-plate granularity rounding (2.5 lb).
export function roundToPlate(x) {
  return Math.round((Number(x) || 0) / 2.5) * 2.5;
}

// ── day_key → epoch ms ───────────────────────────────────────────────────────
// bbf_sets.day_key is text shaped "YYYY-MM-DD_dN"; the date prefix is the order.
export function dayKeyToTs(dk) {
  if (!dk || typeof dk !== 'string') return null;
  const dayStr = dk.split('_d')[0] || '';
  if (!dayStr) return null;
  const ts = new Date(dayStr + 'T12:00:00Z').getTime();
  return Number.isNaN(ts) ? null : ts;
}

// ── OLS linear regression ────────────────────────────────────────────────────
// points: [{ x, y }]. Returns slope, intercept, r2, n. Guards zero-variance.
export function linearRegression(points) {
  const pts = (points || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: n === 1 ? pts[0].y : 0, r2: 0, n };
  let sx = 0, sy = 0;
  for (const p of pts) { sx += p.x; sy += p.y; }
  const mx = sx / n, my = sy / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pts) {
    const dx = p.x - mx, dy = p.y - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  // Epsilon snaps numerically-flat variance to zero. Real lifting variance is in
  // lb² (≫ 1e-6), so this only catches float dust from identical estimates.
  const EPS = 1e-6;
  if (sxx <= EPS) return { slope: 0, intercept: my, r2: 0, n }; // all same day
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const r2 = syy <= EPS ? 1 : (sxy * sxy) / (sxx * syy); // flat-but-consistent ⇒ 1
  return { slope, intercept, r2, n };
}

// ── Clustering ───────────────────────────────────────────────────────────────
// bbf_sets carries exercise_key (positional, e.g. "ex_0"), not a lift name. We
// group by exercise_key, then per cluster build a per-SESSION best-estimated-1RM
// series (the heaviest single-set 1RM logged that day).
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function clusterByExercise(setsData) {
  const clusters = new Map();
  for (const s of (setsData || [])) {
    const key = (s && s.exercise_key != null) ? String(s.exercise_key) : '__nokey__';
    const ts = dayKeyToTs(s && s.day_key);
    const e1rm = estimate1RM(s && s.weight_lbs, s && s.reps);
    if (ts == null || e1rm <= 0) continue;
    if (!clusters.has(key)) clusters.set(key, { key, byDay: new Map(), peak: 0, count: 0 });
    const cl = clusters.get(key);
    cl.count += 1;
    cl.peak = Math.max(cl.peak, e1rm);
    const day = Math.floor(ts / 86400000);
    cl.byDay.set(day, Math.max(cl.byDay.get(day) || 0, e1rm));
  }
  return clusters;
}

// Pick the cluster that best matches the requested lift. With only positional
// keys we follow the documented heuristic: most consistent occurrence (most
// sessions), tie-broken by the heaviest estimated 1RM ("the main compound").
// If an exercise_key happens to be human-readable and matches the lift name, it
// wins outright.
export function selectTargetCluster(clusters, liftName) {
  const wantTokens = normalize(liftName).split(' ').filter(Boolean);
  let best = null;
  for (const cl of clusters.values()) {
    const sessions = cl.byDay.size;
    const keyNorm = normalize(cl.key);
    const nameMatch = wantTokens.length > 0 && wantTokens.every((t) => keyNorm.includes(t));
    const score = { nameMatch: nameMatch ? 1 : 0, sessions, peak: cl.peak };
    if (!best) { best = { cl, score }; continue; }
    const b = best.score;
    if (score.nameMatch !== b.nameMatch) { if (score.nameMatch > b.nameMatch) best = { cl, score }; continue; }
    if (sessions !== b.sessions) { if (sessions > b.sessions) best = { cl, score }; continue; }
    if (score.peak > b.peak) best = { cl, score };
  }
  return best ? best.cl : null;
}

// ── Trilingual, deterministic coach insight ──────────────────────────────────
const INSIGHT = {
  uptrend: {
    en: 'Add a third top set at 90% for the next four sessions to consolidate the base before chasing the next jump.',
    es: 'Agrega una tercera serie principal al 90% durante las próximas cuatro sesiones para consolidar la base antes de buscar el siguiente salto.',
    pt: 'Adicione uma terceira série principal a 90% nas próximas quatro sessões para consolidar a base antes de buscar o próximo salto.',
  },
  stall: {
    en: 'Your top-set load has plateaued — drive one heavy single at ~95% each week to break through.',
    es: 'Tu carga de serie principal se ha estancado: ejecuta una serie pesada de una repetición al ~95% cada semana para romper la meseta.',
    pt: 'Sua carga de série principal estagnou — execute uma única série pesada a ~95% por semana para romper o platô.',
  },
  lowdata: {
    en: 'Log a few more sessions of this lift to sharpen the projection.',
    es: 'Registra algunas sesiones más de este ejercicio para afinar la proyección.',
    pt: 'Registre mais algumas sessões deste exercício para refinar a projeção.',
  },
};
function pickInsight(kind, locale) {
  const loc = (locale === 'es' || locale === 'pt') ? locale : 'en';
  return INSIGHT[kind][loc];
}

// ── Confidence grade ─────────────────────────────────────────────────────────
// Deterministic from sample size + regression fit. Conservative by default.
export function gradeConfidence(sessions, r2) {
  if (sessions >= 5 && r2 >= 0.5) return 'High';
  if (sessions >= 4 || (sessions >= 3 && r2 >= 0.2)) return 'Moderate';
  return 'Low';
}

// ── Top-level forecast ───────────────────────────────────────────────────────
// Returns the SAME 3-field shape the LLM used to emit:
//   { projected_1rm: string, confidence_score: string, agent_insight: string }
// Horizon = 30 days past the most recent session. Monthly change is clamped to
// a sane band (−2%…+5%) so a noisy regression can't print an absurd projection.
export function forecastLift(setsData, liftName, locale = 'en') {
  const clusters = clusterByExercise(setsData);
  const target = selectTargetCluster(clusters, liftName);
  if (!target || target.byDay.size === 0) {
    return { projected_1rm: 'N/A', confidence_score: 'Low', agent_insight: pickInsight('lowdata', locale) };
  }

  // Per-session series, ordered by day, x in days from the first session.
  const days = [...target.byDay.keys()].sort((a, b) => a - b);
  const firstDay = days[0];
  const points = days.map((d) => ({ x: d - firstDay, y: target.byDay.get(d) }));
  const current = points[points.length - 1].y; // most-recent session best e1RM
  const sessions = points.length;

  const { slope, r2 } = linearRegression(points);

  let projected;
  if (sessions >= 2) {
    const lastX = points[points.length - 1].x;
    const raw = (linearRegression(points).intercept) + slope * (lastX + 30);
    const delta = raw - current;
    const hi = current * 0.05;   // ≤ +5% / month
    const lo = current * -0.02;  // ≥ −2% / month
    projected = current + Math.max(lo, Math.min(hi, delta));
  } else {
    projected = current; // single session: report the current estimate, low confidence
  }

  const confidence = gradeConfidence(sessions, r2);
  let kind;
  if (sessions < 3) kind = 'lowdata';
  else if (slope > 0 && projected > current) kind = 'uptrend';
  else kind = 'stall';

  return {
    projected_1rm: `${roundToPlate(projected)} lbs`,
    confidence_score: confidence,
    agent_insight: pickInsight(kind, locale),
  };
}
