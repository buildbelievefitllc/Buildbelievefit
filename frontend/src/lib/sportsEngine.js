// src/lib/sportsEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// NATIVE SPORTS ENGINE — deterministic, rule-based, ZERO AI. Compiles a periodized
// `sports_protocol` JSON the Athlete Portal renders and the Autonomous Referee
// (bbf-evaluate-athlete-progress) regenerates at the next phase on promotion.
//
// PHASING: every sport carries Phase 1 → 2 → 3 with escalating SKILL + PLYOMETRIC
// difficulty (speed/agility/strength/conditioning stay experience-scaled). Each phase
// ships machine-checkable `progression_thresholds` the Referee evaluates against the
// athlete's telemetry (bbf_athlete_progression) to decide promotion.
//
// ⚠ LOCKSTEP: this file has a Deno twin at supabase/functions/_shared/sports-engine.ts
// (the edge runtime can't import this Vite module). Keep the two in sync — same
// matrices, same logic — exactly like entitlements.js ↔ entitlement-gate.ts.
//
// IMMUTABLE LAWS (enforced in every block/phase): NO Barbell Back Squat, NO Abdominal
// Crunches — Front/Hack/Split/Trap-Bar squats + anti-extension/rotation trunk work only.

const LABELS = {
  basketball: 'Basketball', football: 'Football', soccer: 'Soccer',
  track: 'Track & Field', baseball: 'Baseball / Softball', general: 'General Athletic Development',
};

// Experience-scaled base (speed · agility · strength · conditioning). Power is phase-driven below.
const ATHLETIC_BASE = {
  beginner: {
    speed: { name: 'Acceleration Sprints', sets: 6, distance: '20 yd', rest: '60s', intensity: '80%', detail: 'Tall posture, full foot recovery.' },
    agility: [
      { name: 'Ladder — Two-Foot Runs', sets: 3, reps: '2 lengths', detail: 'Quick feet, eyes up.' },
      { name: '5-10-5 Pro Agility (sub-max)', sets: 4, rest: '60s', detail: 'Plant outside the line.' },
    ],
    strength: [
      { name: 'Goblet Front Squat', sets: 3, reps: 8, detail: 'Brace the trunk.' },
      { name: 'Dumbbell Romanian Deadlift', sets: 3, reps: 8, detail: 'Hinge from the hips.' },
      { name: 'Push-Up', sets: 3, reps: 10 },
      { name: 'One-Arm Dumbbell Row', sets: 3, reps: 10 },
      { name: 'Dead Bug', sets: 3, reps: '8/side', detail: 'Anti-extension — ribs down.' },
    ],
    conditioning: { name: 'Tempo Runs', sets: 6, distance: '60 yd', rest: '45s', intensity: '70%' },
  },
  intermediate: {
    speed: { name: 'Acceleration Sprints', sets: 8, distance: '30 yd', rest: '75s', intensity: '90%', detail: 'Aggressive arm drive.' },
    agility: [
      { name: 'Ladder — Icky Shuffle', sets: 3, reps: '2 lengths', detail: 'Low hips, fast turnover.' },
      { name: '5-10-5 Pro Agility', sets: 5, rest: '75s', detail: 'Sharp plant, accelerate out.' },
      { name: 'T-Drill', sets: 3, rest: '75s', detail: 'No crossing the feet.' },
    ],
    strength: [
      { name: 'Front Squat', sets: 4, reps: 5, intensity: 'RPE 7', detail: 'Tall chest, full control.' },
      { name: 'Barbell Romanian Deadlift', sets: 3, reps: 6 },
      { name: 'Dumbbell Bench Press', sets: 4, reps: 6 },
      { name: 'Pull-Up', sets: 3, reps: 8 },
      { name: 'Pallof Press', sets: 3, reps: '10/side', detail: 'Anti-rotation — resist the twist.' },
    ],
    conditioning: { name: 'Sprint Intervals', sets: 8, distance: '100 yd', rest: '60s', intensity: '85%' },
  },
  advanced: {
    speed: { name: 'Max-Velocity Sprints', sets: 10, distance: '40 yd', rest: '90s', intensity: '95%+', detail: 'Full send through a fly zone.' },
    agility: [
      { name: 'Reactive Mirror Drill', sets: 4, reps: '15s', rest: '60s', detail: 'React, drive the first step.' },
      { name: '5-10-5 Pro Agility (timed)', sets: 6, rest: '90s', detail: 'Compete the clock.' },
      { name: 'L-Drill (3-Cone)', sets: 4, rest: '90s', detail: 'Tight corners, low COM.' },
    ],
    strength: [
      { name: 'Front Squat', sets: 5, reps: 3, intensity: 'RPE 8', detail: 'Heavy, crisp, full control.' },
      { name: 'Trap-Bar Deadlift', sets: 4, reps: 3, intensity: 'RPE 8' },
      { name: 'Weighted Pull-Up', sets: 4, reps: 5 },
      { name: 'Overhead Press', sets: 4, reps: 5 },
      { name: 'Hanging Leg Raise', sets: 3, reps: 10, detail: 'Controlled — no swing (NOT a crunch).' },
    ],
    conditioning: { name: 'Repeat-Sprint Conditioning', sets: 10, distance: '120 yd', rest: '45s', intensity: '90%' },
  },
};

// Phase-escalating plyometrics (shared across sports).
const PHASE_PLYO = {
  1: [
    { name: 'Box Jump (low box)', sets: 3, reps: 5, rest: '60s', detail: 'Land soft and stick.' },
    { name: 'Med-Ball Chest Pass', sets: 3, reps: 8, detail: 'Explode through the legs.' },
  ],
  2: [
    { name: 'Box Jump', sets: 4, reps: 4, rest: '75s', detail: 'Max intent; reset each rep.' },
    { name: 'Broad Jump', sets: 4, reps: 3, detail: 'Drive horizontally; stick it.' },
    { name: 'Med-Ball Rotational Throw', sets: 3, reps: '6/side', detail: 'Hips → trunk → arms.' },
  ],
  3: [
    { name: 'Depth Jump', sets: 5, reps: 3, rest: '90s', detail: 'Minimal ground contact; explode up.' },
    { name: 'Trap-Bar Jump', sets: 4, reps: 3, intensity: '20–30% BW', detail: 'Triple extension; land & reset.' },
    { name: 'Single-Leg Bound', sets: 4, reps: '4/side', detail: 'Cover ground; control the landing.' },
  ],
};

// Phase metadata — display label + prose + MACHINE-CHECKABLE thresholds (evaluated by
// the Referee against bbf_athlete_progression telemetry). Phase 3 thresholds=null →
// terminal/coach-gated (no auto-promotion past peak).
const PHASE_META = {
  1: { label: 'Phase 1 — Foundation', prose: 'Advance to Phase 2 after ≥4 weeks once the protocol is completed with manageable RPE and no joint-friction flags.',
       thresholds: { min_mesocycle_weeks: 4, require_protocol_completed: true, max_rpe_avg: 8.5, max_friction_avg: 4 } },
  2: { label: 'Phase 2 — Development', prose: 'Advance to Phase 3 after ≥4 weeks once the protocol is completed, RPE stays controlled, and friction stays low.',
       thresholds: { min_mesocycle_weeks: 4, require_protocol_completed: true, max_rpe_avg: 8.5, max_friction_avg: 4 } },
  3: { label: 'Phase 3 — Peak Performance', prose: 'Peak phase — hold and refine. Further promotion is coach-gated.', thresholds: null },
};

// Sport-specific skill work, escalating per phase (2 movements per phase).
const SPORT_SKILL = {
  basketball: {
    1: [{ name: 'Defensive Slide Series', sets: 3, reps: '20s', detail: 'Low hips, no heel click.' }, { name: 'Form Shooting Footwork', sets: 3, reps: 10, detail: 'Balanced, repeatable base.' }],
    2: [{ name: 'Closeout & Live Mirror', sets: 4, reps: 8, detail: 'Break down, react to the first step.' }, { name: 'Finishing Off Two Feet', sets: 4, reps: '6/side', detail: 'Absorb and explode, both hands.' }],
    3: [{ name: 'Reactive 1-on-1 Series', sets: 4, reps: '20s', detail: 'Read & counter at game speed.' }, { name: 'Transition Finishing at Speed', sets: 4, reps: 6, detail: 'Decelerate, finish through contact.' }],
  },
  football: {
    1: [{ name: 'Stance & First-Step', sets: 6, reps: '10 yd', rest: '60s' }, { name: 'Bag Drill Footwork', sets: 3, reps: '2 lengths' }],
    2: [{ name: 'Get-Off vs Cue', sets: 6, reps: '10 yd', rest: '60s', detail: 'React to the snap.' }, { name: 'Backpedal & Break', sets: 4, reps: 6 }],
    3: [{ name: 'Reactive Block/Shed', sets: 4, reps: 8, detail: 'Hands inside, react live.' }, { name: 'Route / Pursuit at Speed', sets: 5, reps: '15 yd', rest: '75s' }],
  },
  soccer: {
    1: [{ name: 'Cone Dribbling Gates', sets: 4, reps: '30s' }, { name: 'First-Touch Wall Series', sets: 3, reps: '20/side' }],
    2: [{ name: 'Shuttle + Strike', sets: 4, reps: 6, detail: 'Finish under fatigue.' }, { name: '1v1 Change-of-Direction', sets: 4, reps: '20s' }],
    3: [{ name: 'Reactive Small-Sided Transitions', sets: 4, reps: '30s' }, { name: 'Repeated-Sprint Finishing', sets: 6, reps: '20 yd', rest: '45s' }],
  },
  track: {
    1: [{ name: 'A-Skip / B-Skip', sets: 3, reps: '20 m' }, { name: 'Wicket Runs', sets: 5, reps: '6 wickets', rest: '90s' }],
    2: [{ name: 'Block Starts', sets: 6, reps: '15 m', rest: '2 min' }, { name: 'Flying 20s', sets: 4, reps: '20 m', rest: '2 min' }],
    3: [{ name: 'Max-Velocity Fly 30s', sets: 5, reps: '30 m', rest: '3 min', detail: 'Full recovery.' }, { name: 'Speed-Endurance Reps', sets: 4, reps: '120 m', rest: '4 min' }],
  },
  baseball: {
    1: [{ name: 'Rotational Med-Ball Series', sets: 4, reps: '6/side', rest: '60s' }, { name: 'Lateral Bound + Stick', sets: 4, reps: '5/side' }],
    2: [{ name: 'Short-Box Reaction', sets: 3, reps: 8 }, { name: 'Crossover & Go', sets: 4, reps: '6/side' }],
    3: [{ name: 'Reactive First-Step (live cue)', sets: 4, reps: 8 }, { name: 'Rotational Power Throws (max)', sets: 4, reps: '5/side', rest: '75s' }],
  },
  general: {
    1: [{ name: 'Multi-Directional Tag', sets: 3, reps: '20s' }, { name: 'Reactive Shuffle', sets: 3, reps: '15s' }],
    2: [{ name: 'Broad-Jump-to-Sprint', sets: 4, reps: 4, rest: '60s' }, { name: 'Mirror Drill', sets: 4, reps: '15s' }],
    3: [{ name: 'Reactive Cone Series', sets: 4, reps: '20s' }, { name: 'Accel–Decel Repeats', sets: 5, reps: '15 yd', rest: '75s' }],
  },
};

export function normalizeSportKey(sport) {
  const s = String(sport || '').trim().toLowerCase();
  if (!s || s === 'none' || s === 'other') return 'general';
  if (s.includes('basket')) return 'basketball';
  if (s.includes('foot') || s.includes('gridiron')) return 'football';
  if (s.includes('soccer') || s.includes('futbol')) return 'soccer';
  if (s.includes('track') || s.includes('sprint') || s.includes('field')) return 'track';
  if (s.includes('base') || s.includes('soft')) return 'baseball';
  return SPORT_SKILL[s] ? s : 'general';
}

export function clampPhase(p) {
  const n = parseInt(p, 10) || 1;
  return n < 1 ? 1 : n > 3 ? 3 : n;
}

// Build the periodized, sport-specific protocol for a target phase (1–3).
export function buildSportsProtocol({ sport, age, experience, goal, targetPhase = 1 } = {}) {
  const phase = clampPhase(targetPhase);
  const base = ATHLETIC_BASE[experience] || ATHLETIC_BASE.intermediate;
  const key = normalizeSportKey(sport);
  const skill = (SPORT_SKILL[key] || SPORT_SKILL.general)[phase];
  const meta = PHASE_META[phase];

  const blocks = [
    { title: `${LABELS[key]} — Skill & Position Work (P${phase})`, items: skill },
    { title: 'Speed & Acceleration', items: [base.speed] },
    { title: 'Agility & Change of Direction', items: base.agility },
    { title: `Explosive Power (Phase ${phase})`, items: PHASE_PLYO[phase] },
    { title: 'Strength Foundation', items: base.strength },
    { title: 'Conditioning', items: [base.conditioning] },
    { title: 'Progression Criteria', items: [{ name: meta.label, detail: meta.prose }] },
  ].filter((b) => Array.isArray(b.items) && b.items.length);

  return {
    engine: 'bbf-native-sports-engine',
    generated_at: new Date().toISOString(),
    sport: LABELS[key],
    phase_number: phase,
    current_phase: meta.label,
    progression_criteria: meta.prose,
    progression_thresholds: meta.thresholds, // machine-checkable; null at Phase 3 (terminal)
    experience: experience || 'intermediate',
    focus: `${LABELS[key]} · ${meta.label}`,
    summary: `Periodized ${LABELS[key].toLowerCase()} protocol (Phase ${phase}/3) — sport skill + phase-escalated plyometrics on a level-scaled athletic base. Excludes barbell back squats and crunches per BBF Immutable Laws.`,
    source_goal: goal || null,
    source_age: Number.isFinite(age) ? age : null,
    blocks,
  };
}

// ── Intake-staged protocol (Command Center oversight) ─────────────────────────────
// Display label for a youth sport id — accurate even when the engine normalizes an
// uncovered sport (volleyball / tennis / mma) onto the general matrices, so the
// Command Center roster always shows the athlete's TRUE discipline.
const YOUTH_SPORT_LABEL = {
  football: 'American Football', basketball: 'Basketball', soccer: 'Soccer',
  baseball: 'Baseball', softball: 'Softball', volleyball: 'Volleyball',
  track: 'Track & Field', tennis: 'Tennis', boxing: 'Boxing', mma: 'Mixed Martial Arts',
};

// Age → { phase, experience } via the Blueprint progression bands (youth/middle → P1
// beginner, high school → P2 intermediate, collegiate → P3 advanced). Mirrors
// athleteBlueprint.tierToPhase + levelForTier, kept pure so this module ships clean.
function phaseAndExperienceForAge(age) {
  const a = Number(age);
  if (!Number.isFinite(a) || a < 15) return { phase: 1, experience: 'beginner' };
  if (a < 18) return { phase: 2, experience: 'intermediate' };
  return { phase: 3, experience: 'advanced' };
}

// Build the protocol staged into bbf_active_clients at intake — the SAME engine output
// the Pathfinder funnel stages, with the athlete's true sport label applied so the
// Command Center reflects their current discipline the moment intake is submitted.
export function buildIntakeProtocol({ sportId, age, goal = 'general' } = {}) {
  const { phase, experience } = phaseAndExperienceForAge(age);
  const proto = buildSportsProtocol({ sport: sportId, age: Number(age) || null, experience, goal, targetPhase: phase });
  const label = YOUTH_SPORT_LABEL[sportId] || proto.sport;
  return { ...proto, sport: label, focus: `${label} · ${proto.current_phase}` };
}
