// src/lib/sportsEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// NATIVE SPORTS ENGINE (intake-time). Deterministic, rule-based, ZERO AI spend —
// the athletic-development sibling of generatorEngine (workout) and nutritionEngine
// (meal). Compiles a `sports_protocol` JSON the Pathfinder intake stages into
// bbf_active_clients (alongside workout_plan / meal_plan), so a youth/collegiate
// performance athlete's Sports Hub hydrates with a real protocol on first login.
//
// The public intake captures NO sport/position (only age · goal · experience), so
// this emits a SPORT-AGNOSTIC general athletic base (speed · agility · power ·
// strength · conditioning), scaled by experience level. The athlete refines to a
// sport/position post-login via the Youth Intake gate; a coach can later stage a
// sport-specific protocol that overrides this. Output shape matches what
// components/sportshub/SportProtocol.jsx renders: { sport, focus, blocks:[…] }.
//
// IMMUTABLE LAWS honored: the strength block never prescribes the Barbell Back
// Squat or crunches — it uses Front Squat / hinge / press / pull patterns.

const LEVELS = {
  beginner: {
    label: 'Foundational',
    sprint: { name: 'Acceleration Sprints', sets: 6, distance: '20 yd', rest: '60s', intensity: '80%',
      detail: 'Build-up starts from a 2-point stance; focus on a tall posture and full foot recovery.' },
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
      { name: 'Push-Up', sets: 3, reps: 10, detail: 'Full range, ribs down, glutes tight.' },
      { name: 'One-Arm Dumbbell Row', sets: 3, reps: 10, detail: 'Drive the elbow back; no torso twist.' },
    ],
    conditioning: { name: 'Tempo Runs', sets: 6, distance: '60 yd', rest: '45s', intensity: '70%',
      detail: 'Smooth, controlled pace — build the aerobic base without straining.' },
  },
  intermediate: {
    label: 'Developmental',
    sprint: { name: 'Acceleration Sprints', sets: 8, distance: '30 yd', rest: '75s', intensity: '90%',
      detail: 'Aggressive arm drive; progressive shin angles out of the start.' },
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
    ],
    conditioning: { name: 'Sprint Intervals', sets: 8, distance: '100 yd', rest: '60s', intensity: '85%',
      detail: 'Repeatable speed — hold form as fatigue sets in.' },
  },
  advanced: {
    label: 'High-Performance',
    sprint: { name: 'Max-Velocity Sprints', sets: 10, distance: '40 yd', rest: '90s', intensity: '95%+',
      detail: 'Full send through a 10-yd fly zone; full recovery between reps.' },
    agility: [
      { name: 'Reactive Mirror Drill', sets: 4, reps: '15s', rest: '60s', detail: 'React to a partner/cue — open hips, drive the first step.' },
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
    ],
    conditioning: { name: 'Repeat-Sprint Conditioning', sets: 10, distance: '120 yd', rest: '45s', intensity: '90%',
      detail: 'Game-speed repeatability; hold mechanics under heavy fatigue.' },
  },
};

// Build the sport-agnostic athletic-development protocol for an intake profile.
// Returns the sports_protocol object (or null if inputs are unusable).
export function buildSportsProtocol({ age, experience, goal } = {}) {
  const level = LEVELS[experience] || LEVELS.intermediate;
  const blocks = [
    { title: 'Speed & Acceleration', items: [level.sprint] },
    { title: 'Agility & Change of Direction', items: level.agility },
    { title: 'Explosive Power', items: level.power },
    { title: 'Strength Foundation', items: level.strength },
    { title: 'Conditioning', items: [level.conditioning] },
  ].filter((b) => Array.isArray(b.items) && b.items.length);

  if (!blocks.length) return null;
  return {
    engine: 'bbf-native-sports-engine',
    generated_at: new Date().toISOString(),
    sport: 'General Athletic Development',
    focus: `${level.label} athletic base — speed, power, agility & strength`,
    summary: 'Sport-agnostic foundation staged at intake. Select your sport in the Athlete Portal to refine into position-specific work; a coach can override this with a sport-specific protocol.',
    source_goal: goal || null,
    source_age: Number.isFinite(age) ? age : null,
    blocks,
  };
}
