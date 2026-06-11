// src/lib/autoRegulation.js
// ─────────────────────────────────────────────────────────────────────────────
// The Autoregulated Programming Pipeline — pure, deterministic transforms that
// wire the morning Client Hub check-in (readiness score + execution mode from
// bbf_daily_protocols) into the day's workout delivery. NO LLM (§4 untouched);
// no React; fully node-testable.
//
// ── VOLUME SCALING (ordered bands) ───────────────────────────────────────────
//   score ≥ 85            → FULL      ×1.00 working sets · target RPE intact
//   40 ≤ score < 85       → ADAPTIVE  ×0.80 working sets · RPE cap 8
//     (the order specifies 40–75; 76–84 folds into ADAPTIVE as the conservative
//      reading — never grant full volume below the PRIME threshold)
//   score < 40 OR SYSTEM_BREACH OR severe CNS suppression (HRV < 35 ms)
//                         → BREACH    ×0.50 working sets · RPE cap 6 ·
//                                      heavy axial training suspended (subs)
//   no / stale telemetry  → NONE      ×1.00 — missing data never punishes the
//                                      athlete (engine + hook share this stance)
//
// ── AXIAL LOAD SUBSTITUTION (zero hallucinated movements) ────────────────────
// During BREACH the engine protects the spine + CNS: heavy vertical, axially-
// loaded compound patterns swap to joint-friendly, unilateral, or machine-based
// alternatives. EVERY substitute below is a verbatim key of the authorized
// VIDEO_MAP allow-list (components/vault/exerciseVideos.js — "the map is the
// allow-list") AND appears in founder-audited catalog plans, so a swapped slot
// always resolves a form-demo video and never synthesizes an unverified
// movement. verifySubstitutionLibrary() proves this invariant in the test.
//
// ── PREHAB MATRIX INJECTION ──────────────────────────────────────────────────
// ADAPTIVE/BREACH days inject 2 targeted mobility drills into the warm-up and 1
// into the cooldown, selected deterministically from the trilingual prehab
// catalog (getPrehabCatalog(lang).PROTOCOLS) by the day's training focus.

// ── Volume directive ──────────────────────────────────────────────────────────
export const READINESS_FULL_MIN = 85;
export const READINESS_BREACH_MAX = 40; // exclusive lower bound of ADAPTIVE

export function deriveVolumeDirective({ score, mode, isSuppressed = false, hasData = true } = {}) {
  const s = Number.isFinite(Number(score)) ? Number(score) : null;
  const breach = mode === 'SYSTEM_BREACH' || isSuppressed === true || (s !== null && s < READINESS_BREACH_MAX);

  if (!hasData || (s === null && !breach)) {
    return {
      state: 'none', setFactor: 1, rpeCap: null,
      axialSwap: false, suspendHeavy: false,
      lockHiit: false, lockTempo: false, injectPrehab: false,
    };
  }
  if (breach) {
    return {
      state: 'breach', setFactor: 0.5, rpeCap: 6,
      axialSwap: true, suspendHeavy: true,
      lockHiit: true, lockTempo: true, injectPrehab: true,
    };
  }
  if (s !== null && s >= READINESS_FULL_MIN) {
    return {
      state: 'full', setFactor: 1, rpeCap: null,
      axialSwap: false, suspendHeavy: false,
      lockHiit: false, lockTempo: false, injectPrehab: false,
    };
  }
  // ADAPTIVE band (40–84). HIIT locks only in the lower half / SYSTEM_STRAIN.
  const strained = mode === 'SYSTEM_STRAIN' || (s !== null && s < 65);
  return {
    state: 'adaptive', setFactor: 0.8, rpeCap: 8,
    axialSwap: false, suspendHeavy: false,
    lockHiit: strained, lockTempo: false, injectPrehab: true,
  };
}

// ── Axial-load substitution map ───────────────────────────────────────────────
// detect: normalized-name regex for the heavy axial pattern.
// veto:   guard regex — a name matching the veto is NOT axial (e.g. a Hip
//         Thrust is supine, a Bulgarian Split Squat is already the unilateral
//         alternative, a seated press is already spine-supported).
// sub:    the verified replacement (VIDEO_MAP-keyed name + equipment + cue).
export const AXIAL_SUBSTITUTIONS = [
  {
    pattern: 'hinge_deadlift',
    detect: /\bdead\s?lifts?\b|\btrap\s?bar\b/i,
    veto: /\bromanian\b|\brdls?\b/i,
    sub: { name: 'Cable Pull-Through', equipment: 'Cable', notes: 'Hinge pattern preserved with zero axial compression — drive through the heels at lockout.' },
  },
  {
    pattern: 'hinge_rdl',
    detect: /\bromanian\s?dead\s?lifts?\b|\brdls?\b/i,
    veto: null,
    sub: { name: 'Seated Leg Curl', equipment: 'Machine', notes: 'Machine hamstring loading — spine fully unloaded, 2-sec hold at full curl.' },
  },
  {
    pattern: 'squat_axial',
    detect: /\bsquats?\b|\bhack\b/i,
    veto: /\bbulgarian\b|\bsplit\b|\bgoblet\b|\bspanish\b/i,
    sub: { name: 'Leg Press', equipment: 'Machine', notes: 'Back fully supported — quad drive without spinal compression. No locked knees.' },
  },
  {
    pattern: 'press_overhead',
    detect: /\boverhead\b|\bmilitary\b|\bohp\b|\bshoulder\s?press\b/i,
    // Seated presses are already spine-supported; an "Overhead Triceps
    // Extension" (or any extension/curl) is an isolation lift, not an axial press.
    veto: /\bseated\b|\btriceps?\b|\bextensions?\b|\bcurls?\b/i,
    sub: { name: 'Dumbbell Shoulder Press', equipment: 'Dumbbells (seated)', notes: 'Seated, back-supported press — vertical torso, no axial standing load.' },
  },
  {
    pattern: 'row_bent_over',
    detect: /\bbent[\s-]?over\b|\bbarbell\s?rows?\b/i,
    veto: null,
    sub: { name: 'Seated Cable Row', equipment: 'Cable', notes: 'Chest-tall seated pull — full scapular retraction without loaded spinal flexion.' },
  },
];

// Names of every substitute (for the library-membership invariant test).
export function substitutionTargets() {
  return AXIAL_SUBSTITUTIONS.map((r) => r.sub.name);
}

// Match one exercise name against the substitution rules. null when no swap.
export function findAxialSubstitution(name) {
  const n = String(name || '');
  if (!n) return null;
  for (const rule of AXIAL_SUBSTITUTIONS) {
    if (rule.detect.test(n) && !(rule.veto && rule.veto.test(n))) return rule;
  }
  return null;
}

// Round a scaled set count — never below 1 working set.
export function scaleSetCount(sets, factor) {
  const s = Number(sets) > 0 ? Number(sets) : 1;
  return Math.max(1, Math.round(s * factor));
}

// Cardio/circuit slots are conditioning blocks, not loaded sets — volume scaling
// and axial substitution leave them untouched (the cardio surface governs them).
function isConditioningSlot(ex) {
  return /\bcardio\b|\bcircuit\b/i.test(String(ex?.name || ''));
}

// ── The interceptor ───────────────────────────────────────────────────────────
// Takes the day object (programData/dynamic-plan shape) + a volume directive and
// returns the regulated day plus a modification manifest for the clinical banner.
// Pure: never mutates the input; exercise order/indexes are preserved 1:1 so the
// per-set logging keys (exKey(index)) stay aligned.
export function applyAutoRegulation(day, directive) {
  const base = {
    day,
    modified: false,
    swaps: [],
    setsBefore: 0,
    setsAfter: 0,
    state: directive?.state || 'none',
  };
  if (!day || day.isRest || !Array.isArray(day.exercises) || !day.exercises.length) return base;
  if (!directive || directive.state === 'none' || directive.state === 'full') {
    const total = day.exercises.reduce((acc, ex) => acc + (Number(ex.sets) > 0 ? Number(ex.sets) : 1), 0);
    return { ...base, setsBefore: total, setsAfter: total };
  }

  const swaps = [];
  let setsBefore = 0;
  let setsAfter = 0;

  const exercises = day.exercises.map((ex) => {
    const baseSets = Number(ex.sets) > 0 ? Number(ex.sets) : 1;
    setsBefore += baseSets;

    if (isConditioningSlot(ex)) {
      setsAfter += baseSets;
      return ex;
    }

    let next = ex;
    let auto = null;

    if (directive.axialSwap) {
      const rule = findAxialSubstitution(ex.name);
      if (rule) {
        auto = { swappedFrom: ex.name, pattern: rule.pattern };
        next = {
          ...ex,
          name: rule.sub.name,
          equipment: rule.sub.equipment,
          notes: rule.sub.notes,
        };
        swaps.push({ from: ex.name, to: rule.sub.name, pattern: rule.pattern });
      }
    }

    const scaled = scaleSetCount(baseSets, directive.setFactor);
    setsAfter += scaled;
    if (scaled !== baseSets) {
      auto = { ...(auto || {}), setsFrom: baseSets };
    }
    if (auto || scaled !== baseSets) {
      next = { ...next, sets: scaled, _autoreg: auto || { setsFrom: baseSets } };
    }
    return next;
  });

  const modified = swaps.length > 0 || setsAfter !== setsBefore;
  return {
    ...base,
    day: modified ? { ...day, exercises } : day,
    modified,
    swaps,
    setsBefore,
    setsAfter,
  };
}

// ── Prehab Matrix Injection ───────────────────────────────────────────────────
// Map the day's training focus onto a prehab catalog region, deterministically.
export function prehabRegionForFocus(focus) {
  const f = String(focus || '').toLowerCase();
  if (/push|chest|shoulder|press|delt/.test(f)) return 'shoulder';
  if (/leg|quad|squat|thigh|calf|knee/.test(f)) return 'knee';
  // Pull / back days decompress the spine — checked BEFORE the arm rule so
  // "Pull — Back & Biceps" routes to the spine, not the biceps' elbow drills.
  if (/pull|\bback\b|\brow\b|\blats?\b/.test(f)) return 'lower_back';
  if (/arm|bicep|tricep|elbow/.test(f)) return 'elbow';
  // Glute / posterior-chain / core / full-body days decompress the spine too.
  return 'lower_back';
}

// Pick 2 warm-up + 1 cooldown drill from the (already-localized) prehab catalog
// protocols for the day's focus. Every drill is a real library entry — name,
// sets/reps, and execution cues come verbatim from prehabProtocol.js.
export function selectPrehabInjects(protocols, focus) {
  const region = prehabRegionForFocus(focus);
  const proto = protocols?.[region];
  const drills = Array.isArray(proto?.exercises) ? proto.exercises : [];
  if (!drills.length) return { region, warmup: [], cooldown: [] };
  return {
    region,
    regionTitle: proto.title || '',
    warmup: drills.slice(0, 2),
    cooldown: drills.slice(2, 3),
  };
}
