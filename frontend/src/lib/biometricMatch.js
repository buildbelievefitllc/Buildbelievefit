// src/lib/biometricMatch.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure nearest-bucket matcher for the Sovereign biometric router. No JSON/data
// import — pool-parameterized so this is unit-testable in isolation (see
// biometricMatch.test.mjs) and reusable by biometricRouter.js.
//
// CNS-first, THEN vibe: every pre-recorded biometric clip's script speaks its
// CNS bucket out loud verbatim ("your CNS is at fifty..."), while sleep/stress/
// load are only ever described qualitatively. A flat 4-axis nearest-neighbor
// over the sparse 28-state grid can therefore pick a clip whose SPOKEN number
// is far from the athlete's true score whenever the sleep/stress/load axes
// pull harder than the CNS axis — e.g. a true CNS of 44 landing on a "sixty"
// clip instead of the much closer "forty" one, because no "forty" state
// happens to share this athlete's sleep/stress/load combo. So: narrow to
// whichever CNS bucket(s) are closest to the true score FIRST (never
// optional), then break ties among those with the full weighted distance for
// the best overall vibe.

// Axis normalizers. CNS/Sleep/Stress are 0..100; Load ~50..165.
const NORM = { cns: 100, sleep: 100, stress: 100, load: 165 };
const WEIGHT = { cns: 1, sleep: 1, stress: 1, load: 1 };

export function distance(a, b) {
  let sum = 0;
  for (const k of ['cns', 'sleep', 'stress', 'load']) {
    if (a[k] === null || a[k] === undefined) continue; // axis genuinely unmeasured (e.g. a bodyweight/rest day) → excluded, never defaulted
    const d = (Number(a[k]) - Number(b[k])) / NORM[k];
    sum += WEIGHT[k] * d * d;
  }
  return Math.sqrt(sum);
}

export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

// pool: array of { cns, sleep, stress, load, ... } states (any extra fields
// are carried through on the winner). Returns { best, distance } or null.
export function nearestByCnsThenVibe(target, pool) {
  if (!Array.isArray(pool) || !pool.length) return null;
  let minCnsDist = Infinity;
  for (const s of pool) { const d = Math.abs(target.cns - s.cns); if (d < minCnsDist) minCnsDist = d; }
  const narrowed = pool.filter((s) => Math.abs(target.cns - s.cns) === minCnsDist);
  let best = null; let bestD = Infinity;
  for (const s of narrowed) {
    const d = distance(target, s);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best ? { best, distance: bestD } : null;
}
