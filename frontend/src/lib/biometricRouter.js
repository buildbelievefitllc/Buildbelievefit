// src/lib/biometricRouter.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3 — client-side biometric router (nearest-bucket matcher).
//
// The Sovereign biometric matrix (sovereignVaultManifest.json) is a SPARSE grid:
// 84 clips = 28 distinct states × 3 languages, each keyed
//   {LANG}_{CNS}_{SLEEP}_{STRESS}_{LOAD}_{category}   e.g. EN_80_100_40_100_strength
// (LOAD may be "151_plus"). Live telemetry rarely lands on an exact grid point, so
// the daily player snaps the athlete's four metrics to the CLOSEST available state
// via a weighted Euclidean distance — AFTER filtering the grid to the active locale
// (language parity), so an EN athlete is never routed to an ES/PT clip.
//
// Axis fidelity (see telemetryFromReadiness): CNS/Sleep/Stress come from the morning
// check-in ledger; LOAD is the program's prescribed top-set weight, threaded in from
// the Program plan (ClientVault → VaultHub). All four axes are now live and EQUALLY
// weighted; Load is excluded only on a bodyweight/rest day with no prescribed weight.

import manifest from '../data/sovereignVaultManifest.json';

const LANGS = new Set(['EN', 'ES', 'PT']);
const CATEGORIES = new Set(['strength', 'mobility', 'recovery', 'stability']);

// Parse a biometric subject_line into its axes, or null if it isn't one (e.g. a
// non-biometric clip that may share the manifest). "151_plus" → 165 (represents 151+).
export function parseScenario(subjectLine) {
  const parts = String(subjectLine || '').split('_');
  if (parts.length < 6) return null;
  const lang = parts[0].toUpperCase();
  const category = parts[parts.length - 1].toLowerCase();
  if (!LANGS.has(lang) || !CATEGORIES.has(category)) return null;
  const mid = parts.slice(1, parts.length - 1); // CNS, SLEEP, STRESS, LOAD[, plus]
  const cns = Number(mid[0]); const sleep = Number(mid[1]); const stress = Number(mid[2]);
  const plus = mid[mid.length - 1] === 'plus';
  const load = plus ? 165 : Number(mid[3]);
  if (![cns, sleep, stress, load].every(Number.isFinite)) return null;
  return { lang, category, cns, sleep, stress, load };
}

// Pre-parsed biometric states (id + url + axes), built once at module load.
const STATES = manifest
  .map((m) => { const p = parseScenario(m.subjectLine); return p ? { ...p, id: m.id, url: m.url, subjectLine: m.subjectLine } : null; })
  .filter(Boolean);

// Axis normalizers + weights. CNS/Sleep/Stress are 0..100; Load ~50..165. All four
// axes carry EQUAL weight — Load is now a live, threaded metric (today's prescribed
// top-set weight), not a defaulted placeholder.
const NORM = { cns: 100, sleep: 100, stress: 100, load: 165 };
const WEIGHT = { cns: 1, sleep: 1, stress: 1, load: 1 };

function distance(a, b) {
  let sum = 0;
  for (const k of ['cns', 'sleep', 'stress', 'load']) {
    if (a[k] === null || a[k] === undefined) continue; // axis genuinely unmeasured (e.g. a bodyweight/rest day) → excluded, never defaulted
    const d = (Number(a[k]) - Number(b[k])) / NORM[k];
    sum += WEIGHT[k] * d * d;
  }
  return Math.sqrt(sum);
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// Nearest scenario for live telemetry within the active locale. Optional `category`
// hard-filters to a training focus when supplied. Returns { id, url, subjectLine,
// distance, ...axes } or null when the locale subset is empty.
export function nearestScenario({ lang = 'en', cns, sleep, stress, load, category = null }) {
  const L = (['en', 'es', 'pt'].includes(String(lang)) ? String(lang) : 'en').toUpperCase();
  let pool = STATES.filter((s) => s.lang === L); // LANGUAGE PARITY — filter first
  if (category && CATEGORIES.has(category)) {
    const byCat = pool.filter((s) => s.category === category);
    if (byCat.length) pool = byCat;
  }
  if (!pool.length) return null;
  const hasLoad = load !== null && load !== undefined && Number.isFinite(Number(load));
  const target = {
    cns: clamp(Number(cns), 0, 100), sleep: clamp(Number(sleep), 0, 100),
    stress: clamp(Number(stress), 0, 100), load: hasLoad ? clamp(Number(load), 0, 200) : null,
  };
  let best = null; let bestD = Infinity;
  for (const s of pool) {
    const d = distance(target, s);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best ? { ...best, distance: bestD } : null;
}

// Derive the four router axes from the shared readiness view-model (useDailyReadiness)
// + the threaded prescribed Load. CNS = readiness score; Sleep = quality from logged
// sleep minutes (8h ≈ 100); Stress = subjective 1..10 scaled to 0..100; Load = today's
// prescribed top-set weight (lbs), passed in from the Program plan. Load is null only
// when the plan prescribes no explicit weight (bodyweight/rest) — the router then
// excludes that axis rather than inventing a value.
export function telemetryFromReadiness(vm, programLoad = null) {
  const v = vm?.vitals || {};
  const cns = Number.isFinite(Number(vm?.score)) ? clamp(Number(vm.score), 0, 100) : 70;
  const sleepMin = Number(v.sleep_minutes);
  const sleep = Number.isFinite(sleepMin) && sleepMin > 0 ? clamp(Math.round((sleepMin / 60 / 8) * 100), 0, 100) : 70;
  const sl = Number(v.stress_level);
  const stress = Number.isFinite(sl) && sl > 0 ? clamp(Math.round(sl * 10), 0, 100) : 50;
  const load = Number.isFinite(Number(programLoad)) ? Number(programLoad) : null;
  return { cns, sleep, stress, load };
}
