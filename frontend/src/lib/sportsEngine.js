// src/lib/sportsEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// NATIVE SPORTS ENGINE — deterministic, rule-based, ZERO AI spend. Compiles a
// `sports_protocol` JSON the Pathfinder intake stages into bbf_active_clients and
// the Athlete Portal (SportsHub → SportProtocol) renders.
//
// DYNAMIC / AGENTIC: the prior static general-athletic block is replaced by
// SPORT-SPECIFIC matrices keyed by sport, each carrying a `current_phase` and
// `progression_criteria` so the protocol is periodized, not a flat list. A shared,
// experience-scaled ATHLETIC_BASE (speed · agility · power · strength · conditioning)
// is merged with the sport's skill block. Unknown/unspecified sport → the `general`
// matrix (still dynamic — phase + progression), never a dead fallback.
//
// IMMUTABLE LAWS (enforced everywhere below): NO Barbell Back Squat, NO Abdominal
// Crunches — squat patterns use Front/Hack/Split/Trap-Bar; trunk work is anti-
// extension/anti-rotation (dead bug, plank, Pallof) only.

// ── Experience-scaled athletic base ──────────────────────────────────────────
const ATHLETIC_BASE = {
  beginner: {
    speed: { name: 'Acceleration Sprints', sets: 6, distance: '20 yd', rest: '60s', intensity: '80%', detail: 'Tall posture, full foot recovery; build up from a 2-point stance.' },
    agility: [
      { name: 'Ladder — Two-Foot Runs', sets: 3, reps: '2 lengths', detail: 'Quick feet, eyes up, soft contacts.' },
      { name: '5-10-5 Pro Agility (sub-max)', sets: 4, rest: '60s', detail: 'Plant outside the line; drive the hips through the turn.' },
    ],
    power: [
      { name: 'Box Jump (low box)', sets: 3, reps: 5, rest: '60s', detail: 'Land soft and stick — quality over height.' },
      { name: 'Med-Ball Chest Pass', sets: 3, reps: 8, detail: 'Explode through the legs into the throw.' },
    ],
    strength: [
      { name: 'Goblet Front Squat', sets: 3, reps: 8, detail: 'Knees track over toes; brace the trunk.' },
      { name: 'Dumbbell Romanian Deadlift', sets: 3, reps: 8, detail: 'Hinge from the hips; neutral spine.' },
      { name: 'Push-Up', sets: 3, reps: 10, detail: 'Ribs down, glutes tight, full range.' },
      { name: 'One-Arm Dumbbell Row', sets: 3, reps: 10, detail: 'Drive the elbow back; no torso twist.' },
      { name: 'Dead Bug', sets: 3, reps: '8/side', detail: 'Anti-extension trunk control — ribs down throughout.' },
    ],
    conditioning: { name: 'Tempo Runs', sets: 6, distance: '60 yd', rest: '45s', intensity: '70%', detail: 'Smooth, controlled — build the aerobic base without straining.' },
  },
  intermediate: {
    speed: { name: 'Acceleration Sprints', sets: 8, distance: '30 yd', rest: '75s', intensity: '90%', detail: 'Aggressive arm drive; progressive shin angles out of the start.' },
    agility: [
      { name: 'Ladder — Icky Shuffle', sets: 3, reps: '2 lengths', detail: 'Rhythmic, low hips, fast turnover.' },
      { name: '5-10-5 Pro Agility', sets: 5, rest: '75s', detail: 'Sharp plant, low hips through the cut, accelerate out.' },
      { name: 'T-Drill', sets: 3, rest: '75s', detail: 'Shuffle without crossing the feet; sprint the finish.' },
    ],
    power: [
      { name: 'Box Jump', sets: 4, reps: 4, rest: '75s', detail: 'Max intent; reset every rep.' },
      { name: 'Broad Jump', sets: 4, reps: 3, rest: '75s', detail: 'Drive horizontally; stick the landing.' },
      { name: 'Med-Ball Rotational Throw', sets: 3, reps: '6/side', detail: 'Sequence hips → trunk → arms.' },
    ],
    strength: [
      { name: 'Front Squat', sets: 4, reps: 5, intensity: 'RPE 7', detail: 'Tall chest, elbows high, full depth under control.' },
      { name: 'Barbell Romanian Deadlift', sets: 3, reps: 6, detail: 'Load the hamstrings; bar stays close.' },
      { name: 'Dumbbell Bench Press', sets: 4, reps: 6, detail: 'Controlled eccentric; powerful press.' },
      { name: 'Pull-Up', sets: 3, reps: 8, detail: 'Full hang to chin over bar; no kip.' },
      { name: 'Pallof Press', sets: 3, reps: '10/side', detail: 'Anti-rotation core — resist the twist.' },
    ],
    conditioning: { name: 'Sprint Intervals', sets: 8, distance: '100 yd', rest: '60s', intensity: '85%', detail: 'Repeatable speed — hold form as fatigue sets in.' },
  },
  advanced: {
    speed: { name: 'Max-Velocity Sprints', sets: 10, distance: '40 yd', rest: '90s', intensity: '95%+', detail: 'Full send through a 10-yd fly zone; full recovery between reps.' },
    agility: [
      { name: 'Reactive Mirror Drill', sets: 4, reps: '15s', rest: '60s', detail: 'React to a partner/cue — open the hips, drive the first step.' },
      { name: '5-10-5 Pro Agility (timed)', sets: 6, rest: '90s', detail: 'Compete the clock; minimize ground contact at the plant.' },
      { name: 'L-Drill (3-Cone)', sets: 4, rest: '90s', detail: 'Tight corners, low center of mass, accelerate the exits.' },
    ],
    power: [
      { name: 'Depth Jump', sets: 5, reps: 3, rest: '90s', detail: 'Minimal ground contact; explode up immediately.' },
      { name: 'Trap-Bar Jump', sets: 4, reps: 3, intensity: '20–30% BW', detail: 'Triple extension; land and reset each rep.' },
      { name: 'Med-Ball Rotational Throw', sets: 4, reps: '6/side', detail: 'Maximal hip-to-trunk sequencing.' },
    ],
    strength: [
      { name: 'Front Squat', sets: 5, reps: 3, intensity: 'RPE 8', detail: 'Heavy, crisp, full control — never grind technique.' },
      { name: 'Trap-Bar Deadlift', sets: 4, reps: 3, intensity: 'RPE 8', detail: 'Max force production; flat back, drive the floor away.' },
      { name: 'Weighted Pull-Up', sets: 4, reps: 5, detail: 'Add load; own every rep through full range.' },
      { name: 'Overhead Press', sets: 4, reps: 5, detail: 'Brace hard; press in a straight line.' },
      { name: 'Hanging Leg Raise', sets: 3, reps: 10, detail: 'Controlled trunk flexion from the hang — no swing (NOT a crunch).' },
    ],
    conditioning: { name: 'Repeat-Sprint Conditioning', sets: 10, distance: '120 yd', rest: '45s', intensity: '90%', detail: 'Game-speed repeatability; hold mechanics under heavy fatigue.' },
  },
};

// ── Sport matrices — skill emphasis + periodization (phase + progression) ─────
const SPORT_MATRICES = {
  basketball: {
    label: 'Basketball',
    current_phase: 'Off-Season — Foundation & Explosiveness',
    progression_criteria: 'Advance to Pre-Season when CMJ height holds across a full session and the 5-10-5 is repeatable within 5% — then bias toward reactive agility + conditioning density.',
    skill: [
      { name: 'Defensive Slide Series', sets: 3, reps: '20s', rest: '40s', detail: 'Low hips, no heel click; mirror a partner or cue.' },
      { name: 'Finishing Off Two Feet', sets: 4, reps: '6/side', detail: 'Gather → vertical; absorb and explode, both hands.' },
      { name: 'Closeout & Mirror', sets: 3, reps: '8', detail: 'High-to-low closeout, break down, react to the first step.' },
    ],
  },
  football: {
    label: 'Football',
    current_phase: 'Off-Season — Strength & First-Step Power',
    progression_criteria: 'Advance to Camp Prep once Trap-Bar pull hits target for the position and 10-yd splits stop improving — shift volume to repeat-effort conditioning + position drills.',
    skill: [
      { name: 'Get-Off & First-Step', sets: 6, reps: '10 yd', rest: '60s', detail: 'Stance → violent first step on the snap cue.' },
      { name: 'Backpedal & Break', sets: 4, reps: '6', detail: 'Smooth pedal, plant, drive at 45°; eyes up.' },
      { name: 'Bag Drill Footwork', sets: 3, reps: '2 lengths', detail: 'Quick, choppy feet over bags; stay square.' },
    ],
  },
  soccer: {
    label: 'Soccer',
    current_phase: 'Off-Season — Aerobic Base & Multi-Directional Speed',
    progression_criteria: 'Advance to Pre-Season when interval recovery HR drops and repeated-sprint drop-off is <10% — add match-pace small-sided volume.',
    skill: [
      { name: 'Cone Dribbling Gates', sets: 4, reps: '30s', rest: '45s', detail: 'Both feet, head up between touches.' },
      { name: 'First-Touch Wall Series', sets: 3, reps: '20/side', detail: 'Receive across the body into space.' },
      { name: 'Shuttle + Strike', sets: 4, reps: '6', detail: 'Sprint shuttle, plant, finish under fatigue.' },
    ],
  },
  track: {
    label: 'Track & Field',
    current_phase: 'General Prep — Mechanics & Elastic Strength',
    progression_criteria: 'Advance to Specific Prep when sprint mechanics hold at 95%+ velocity and depth-jump contact times drop — then sharpen blocks + event-specific volume.',
    skill: [
      { name: 'A-Skip / B-Skip', sets: 3, reps: '20 m', detail: 'Tall posture, dorsiflexed foot, punch down.' },
      { name: 'Wicket Runs', sets: 5, reps: '6 wickets', rest: '90s', detail: 'Rhythm + front-side mechanics at speed.' },
      { name: 'Block Starts', sets: 6, reps: '15 m', rest: '2 min', detail: 'Aggressive shin angles; full recovery between reps.' },
    ],
  },
  baseball: {
    label: 'Baseball / Softball',
    current_phase: 'Off-Season — Rotational Power & Arm Care',
    progression_criteria: 'Advance to Pre-Season once rotational med-ball velocity peaks and shoulder care volume is consistent — bias toward reactive lateral movement + bat/throw transfer.',
    skill: [
      { name: 'Rotational Med-Ball Series', sets: 4, reps: '6/side', rest: '60s', detail: 'Load the back hip; sequence into the throw.' },
      { name: 'Lateral Bound + Stick', sets: 4, reps: '5/side', detail: 'Cover ground, stick the landing under control.' },
      { name: 'Short-Box Reaction', sets: 3, reps: '8', detail: 'React to a cue, first-step quickness both directions.' },
    ],
  },
  general: {
    label: 'General Athletic Development',
    current_phase: 'Foundation — Build the Athletic Base',
    progression_criteria: 'Once movement quality is clean and the base lifts/sprints are repeatable, select a sport in the Athlete Portal to unlock position-specific work — or a coach can stage a sport-specific protocol.',
    skill: [
      { name: 'Multi-Directional Tag', sets: 3, reps: '20s', rest: '40s', detail: 'React and change direction off a partner/cue.' },
      { name: 'Reactive Shuffle', sets: 3, reps: '15s', detail: 'Low hips, fast feet, respond to the call.' },
      { name: 'Broad-Jump-to-Sprint', sets: 4, reps: '4', rest: '60s', detail: 'Stick the jump, immediately accelerate 10 yd.' },
    ],
  },
};

function normalizeSportKey(sport) {
  const s = String(sport || '').trim().toLowerCase();
  if (!s || s === 'none' || s === 'other') return 'general';
  if (s.includes('basket')) return 'basketball';
  if (s.includes('foot') || s.includes('gridiron')) return 'football';
  if (s.includes('soccer') || s.includes('futbol')) return 'soccer';
  if (s.includes('track') || s.includes('sprint') || s.includes('field')) return 'track';
  if (s.includes('base') || s.includes('soft')) return 'baseball';
  return SPORT_MATRICES[s] ? s : 'general';
}

// Build the sport-specific, periodized athletic protocol for an intake profile.
// Returns the sports_protocol object (carries current_phase + progression_criteria).
export function buildSportsProtocol({ sport, age, experience, goal } = {}) {
  const base = ATHLETIC_BASE[experience] || ATHLETIC_BASE.intermediate;
  const key = normalizeSportKey(sport);
  const matrix = SPORT_MATRICES[key] || SPORT_MATRICES.general;

  const blocks = [
    { title: `${matrix.label} — Skill & Position Work`, items: matrix.skill },
    { title: 'Speed & Acceleration', items: [base.speed] },
    { title: 'Agility & Change of Direction', items: base.agility },
    { title: 'Explosive Power', items: base.power },
    { title: 'Strength Foundation', items: base.strength },
    { title: 'Conditioning', items: [base.conditioning] },
    { title: 'Progression Criteria', items: [{ name: matrix.current_phase, detail: matrix.progression_criteria }] },
  ].filter((b) => Array.isArray(b.items) && b.items.length);

  if (!blocks.length) return null;
  return {
    engine: 'bbf-native-sports-engine',
    generated_at: new Date().toISOString(),
    sport: matrix.label,
    current_phase: matrix.current_phase,
    progression_criteria: matrix.progression_criteria,
    focus: `${matrix.label} · ${matrix.current_phase}`,
    summary: `Periodized ${matrix.label.toLowerCase()} protocol — sport skill work layered on a level-scaled athletic base. Excludes barbell back squats and crunches per BBF Immutable Laws.`,
    source_goal: goal || null,
    source_age: Number.isFinite(age) ? age : null,
    blocks,
  };
}
