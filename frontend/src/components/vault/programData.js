// src/components/vault/programData.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.1 — Authorized Program Catalog (the 7-day grid's source of truth).
//
// ⚠️ VERBATIM PORT of the canonical `WP` object in the legacy monolith
// (bbf-data.js, lines 23–175). This is the AUTHORIZED exercise catalog — the
// dense clinical 7-day grid renders STRICTLY from this data and nothing else.
// The Vault must never autonomously synthesize movements (e.g. it will not
// invent a "barbell back squat" that is not in an authorized plan). When the
// founder audits/changes a plan, regenerate this file from `WP` — do NOT
// hand-author new exercises here.
//
// Shape (identical to WP[persona][dayIdx]):
//   { day, focus, focus_cue?, isRest?, restNote?,
//     exercises: [ { name, equipment, sets, reps, notes } ] }
//
// Persona selection mirrors the monolith: a client is mapped to a plan key.
// Until per-user persona mapping lands in the auth payload, the Vault renders
// DEFAULT_PROGRAM_KEY. Exposed as a catalog so a future selector can switch.

export const PROGRAM_CATALOG = {
  ana_spring: [
    { day: 'Monday', focus: 'Arms & Back', exercises: [
      { name: 'Biceps Curls', equipment: 'Dumbbells or Cable', sets: 4, reps: '10-12', notes: 'Control the eccentric — slow on the way down' },
      { name: 'Triceps Pushdowns', equipment: 'Cable', sets: 4, reps: '10-12', notes: 'Pin elbows to ribs, extend fully' },
      { name: 'Shoulder Press', equipment: 'Dumbbells or Machine', sets: 4, reps: '10-12', notes: 'Keep core tight, no arching' },
      { name: 'Lat Pulldown', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Drive elbows down, lean back slightly' },
      { name: 'Seated Cable Rows', equipment: 'Cable', sets: 4, reps: '10-12', notes: 'Squeeze shoulder blades at the top' },
      { name: 'Abs', equipment: 'Mat or Machine', sets: 3, reps: '12-15', notes: 'Controlled, exhale on contraction' },
    ] },
    { day: 'Tuesday', focus: 'Glutes', exercises: [
      { name: 'Hip Thrust', equipment: 'Barbell or Machine', sets: 4, reps: '12-15', notes: '2-second squeeze at the top' },
      { name: 'Hip Abduction', equipment: 'Machine', sets: 4, reps: '12-15', notes: 'Slow and controlled' },
      { name: 'Back Extensions', equipment: 'Machine', sets: 4, reps: '12-15', notes: 'Glute focus, not lower back' },
      { name: 'Romanian Deadlifts', equipment: 'Dumbbells', sets: 3, reps: '12-15', notes: 'Hinge at hips, feel the stretch' },
    ] },
    { day: 'Wednesday', focus: 'Chest & Arms', exercises: [
      { name: 'Incline Dumbbell Press', equipment: 'Dumbbells or Machine', sets: 4, reps: '10-12', notes: 'Elbows at 45 degrees' },
      { name: 'Dumbbell Flyes', equipment: 'Dumbbells or Pec Deck', sets: 3, reps: '12-15', notes: 'Wide arc, feel the chest stretch' },
      { name: 'Overhead Triceps Extension', equipment: 'Cable', sets: 3, reps: '12-15', notes: 'Keep elbows forward' },
      { name: 'Hammer Curls', equipment: 'Dumbbells', sets: 3, reps: '10-12', notes: 'Neutral grip, no swinging' },
      { name: 'Abdominal Crunches', equipment: 'Mat', sets: 3, reps: '15-20', notes: 'Exhale at top' },
    ] },
    { day: 'Thursday', focus: 'Full Leg Day', exercises: [
      { name: 'Leg Press', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Higher foot placement, no locked knees' },
      { name: 'Hack Squats', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Feet shoulder-width' },
      { name: 'Hamstring Curls', equipment: 'Machine', sets: 3, reps: '12-15', notes: 'Full ROM, squeeze at top' },
      { name: 'Cable Hip Extension', equipment: 'Cable', sets: 3, reps: '12-15', notes: 'Full glute squeeze' },
      { name: 'Bulgarian Split Squats', equipment: 'Dumbbells', sets: 3, reps: '10-12 per leg', notes: 'Chest up, knee tracks over toes' },
    ] },
    { day: 'Friday', focus: 'Arms & Back', exercises: [
      { name: 'Chest Press', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Full ROM' },
      { name: 'Shoulder Press', equipment: 'Machine', sets: 3, reps: '10-12', notes: 'Core tight' },
      { name: 'Triceps Extension', equipment: 'Machine', sets: 3, reps: '10-12', notes: 'Elbows fixed' },
      { name: 'Lat Pulldown', equipment: 'Machine', sets: 3, reps: '10-12', notes: 'Drive elbows down' },
      { name: 'Bicep Curl', equipment: 'Machine', sets: 3, reps: '10-12', notes: 'Slow negative' },
      { name: 'Back Extension', equipment: 'Machine', sets: 3, reps: '15-20', notes: 'Controlled' },
    ] },
    { day: 'Saturday', focus: 'Rest', exercises: [], isRest: true },
    { day: 'Sunday', focus: 'Rest', exercises: [], isRest: true },
  ],
  jacky_plan: [
    { day: 'Day 1', focus: 'Glute Focus', exercises: [
      { name: 'Hip Thrusts', equipment: 'Barbell or Machine', sets: 4, reps: '12', notes: '2-second hold at top' },
      { name: 'Romanian Deadlifts', equipment: 'Barbell or Dumbbells', sets: 4, reps: '12', notes: 'Feel the hamstring stretch' },
      { name: 'Bulgarian Split Squats', equipment: 'Dumbbells', sets: 4, reps: '12', notes: 'Chest up' },
      { name: 'Hip Abductions', equipment: 'Machine', sets: 4, reps: '12', notes: 'Controlled tempo' },
      { name: 'Back Extensions', equipment: 'Machine', sets: 4, reps: '12', notes: 'Glute focus' },
      { name: 'Cardio', equipment: 'Treadmill', sets: 1, reps: '30 min', notes: '3 mph, Level 6 incline' },
    ] },
    { day: 'Day 2', focus: 'Push — Chest/Shoulders/Triceps', exercises: [
      { name: 'Chest Press', equipment: 'Bench/Smith/Dumbbell', sets: 4, reps: '12', notes: 'Elbows at 45 degrees' },
      { name: 'Incline Press', equipment: 'Dumbbells', sets: 4, reps: '12', notes: 'Upper chest focus' },
      { name: 'Triceps Overhead Extension', equipment: 'Cable', sets: 4, reps: '12', notes: 'Elbows forward' },
      { name: 'Triceps Pushdowns', equipment: 'Cable', sets: 4, reps: '12', notes: 'Pin elbows' },
      { name: 'Shoulder Circuit', equipment: 'Dumbbells', sets: 4, reps: '12', notes: 'Lead with elbows' },
      { name: 'Cardio', equipment: 'Treadmill', sets: 1, reps: '30 min', notes: '3 mph, Level 6' },
    ] },
    { day: 'Day 3', focus: 'Full Leg Day', exercises: [
      { name: 'Squat Variations', equipment: 'Barbell/Smith/Hack', sets: 4, reps: '12', notes: 'Below parallel' },
      { name: 'Leg Extensions', equipment: 'Machine', sets: 4, reps: '12', notes: 'Squeeze at top' },
      { name: 'Reverse Kickbacks', equipment: 'Cable', sets: 4, reps: '12', notes: 'Glute squeeze' },
      { name: 'Hip Abductors', equipment: 'Machine', sets: 4, reps: '12', notes: 'Controlled' },
      { name: 'Seated Calf Raises', equipment: 'Machine', sets: 4, reps: '12', notes: 'Full ROM' },
      { name: 'Cardio', equipment: 'Treadmill', sets: 1, reps: '30 min', notes: '3 mph, Level 6' },
    ] },
    { day: 'Day 4', focus: 'Pull — Back & Biceps', exercises: [
      { name: 'Lat Pulldown', equipment: 'Machine', sets: 4, reps: '12', notes: 'Drive elbows down' },
      { name: 'Seated Row', equipment: 'Cable', sets: 4, reps: '12', notes: 'Squeeze shoulder blades' },
      { name: 'MTS Pulldown', equipment: 'Machine', sets: 4, reps: '12', notes: 'Full stretch at top' },
      { name: 'Preacher Curls', equipment: 'Machine', sets: 4, reps: '12', notes: 'No swinging' },
      { name: 'Cardio', equipment: 'Treadmill', sets: 1, reps: '30 min', notes: '3 mph, Level 6' },
    ] },
    { day: 'Day 5', focus: 'Cardio & Abs', exercises: [
      { name: 'Cardio', equipment: 'Bike/Elliptical/Treadmill', sets: 1, reps: '30 min', notes: 'Low-impact preferred' },
      { name: 'Abs Circuit', equipment: 'Mat', sets: 3, reps: '15-20', notes: '3-4 exercises, controlled' },
    ] },
    { day: 'Day 6', focus: 'Rest', exercises: [], isRest: true, restNote: 'Active recovery. Hydration and stretching.' },
    { day: 'Day 7', focus: 'Rest', exercises: [], isRest: true, restNote: 'Complete rest.' },
  ],
  jacque_plan: [
    { day: 'Day 1', focus: 'Push + Core — Chest, Shoulders, Triceps & Upper Abs', exercises: [
      { name: 'Dumbbell Chest Press', equipment: 'Dumbbells', sets: 3, reps: '12', notes: 'Controlled tempo — feel the chest stretch at the bottom' },
      { name: 'Dumbbell Overhead Press', equipment: 'Dumbbells', sets: 3, reps: '12', notes: 'Core tight, no arching the lower back' },
      { name: 'Tricep Cable Pushdowns', equipment: 'Cable', sets: 3, reps: '15', notes: 'Pin elbows to ribs, extend fully at the bottom' },
      { name: 'Incline DB Press', equipment: 'Dumbbells', sets: 3, reps: '8-12', notes: 'Bench at 30-45° — controlled descent, drive through the chest at the top. Hypertrophy protocol — load to RPE 7-8.' },
      { name: 'Planks', equipment: 'Bodyweight', sets: 3, reps: '45 sec hold', notes: 'Ribcage down, glutes engaged, breathe through the brace' },
      { name: 'Supported Knee Raises', equipment: "Captain's chair or bench", sets: 3, reps: '12', notes: 'Pelvic tilt before each rep — engage lower abs, no leg swing' },
    ] },
    { day: 'Day 2', focus: 'Pull + Core — Back, Biceps & Obliques', exercises: [
      { name: 'Lat Pulldowns', equipment: 'Machine', sets: 3, reps: '12', notes: 'Drive elbows down, lean back slightly' },
      { name: 'Seated Cable Rows', equipment: 'Cable', sets: 3, reps: '12', notes: 'Squeeze shoulder blades together at the top' },
      { name: 'Dumbbell Bicep Curls', equipment: 'Dumbbells', sets: 3, reps: '12', notes: 'No swinging — strict, controlled form' },
      { name: 'Face Pulls', equipment: 'Cable', sets: 3, reps: '15', notes: 'Pull toward the forehead, elbows high — rear-delt focus' },
      { name: 'Bird-Dogs', equipment: 'Bodyweight', sets: 3, reps: '12 per side', notes: 'Opposite arm + leg — pause at full extension, ribs locked' },
      { name: 'Russian Twists', equipment: 'Bodyweight or light DB', sets: 3, reps: '20', notes: 'Rotate from the obliques, not the arms' },
    ] },
    { day: 'Day 3', focus: 'Glutes + Core — Booty Building & Pelvic Floor', exercises: [
      { name: 'Barbell or DB Hip Thrusts', equipment: 'Barbell or Dumbbell', sets: 4, reps: '10-12', notes: 'Heels close to hips, ribs down — drive glutes through the bar with a 2-sec squeeze at the top' },
      { name: 'Romanian Deadlifts (RDLs)', equipment: 'Dumbbells or Barbell', sets: 3, reps: '12', notes: 'Hip hinge — push butt back, slight knee bend, neutral spine, feel the hamstring stretch' },
      { name: 'Cable Pull-Throughs', equipment: 'Cable', sets: 3, reps: '15', notes: 'Same hinge pattern as RDLs — stand 2 ft from the stack, drive through the heels at lockout' },
      { name: 'Abductor Machine', equipment: 'Machine', sets: 3, reps: '15-20', notes: 'Slight forward lean targets glute medius — slow on the way in, 1-sec hold at full open' },
      { name: 'Heel Taps', equipment: 'Bodyweight (supine)', sets: 3, reps: '20', notes: 'Lower back pressed to the floor — alternate tapping each heel down, lower abs do the work' },
      { name: 'Russian Twists', equipment: 'Bodyweight or light DB', sets: 3, reps: '20', notes: 'Rotate from the obliques, not the arms — feet grounded if pelvic floor cues firing' },
    ] },
    { day: 'Day 4', focus: 'Legs (Quads & Hams) + Core — Thigh Development & Lower Abs', exercises: [
      { name: 'Goblet Squats', equipment: 'Dumbbell or Kettlebell', sets: 3, reps: '12-15', notes: 'Chest up, knees track over toes — sit between the hips, full depth without compromising posture' },
      { name: 'Leg Press', equipment: 'Machine', sets: 3, reps: '15', notes: 'Mid-foot placement — quad bias, knees track in line with toes, controlled descent' },
      { name: 'Leg Extensions', equipment: 'Machine', sets: 3, reps: '15', notes: 'Full extension, 1-sec squeeze at the top, slow eccentric — control the negative' },
      { name: 'Seated Leg Curls', equipment: 'Machine', sets: 3, reps: '15', notes: 'Drive heels down + back, 2-sec hold at full curl — feel the hamstrings, not the lower back' },
      { name: 'Supported Knee Raises', equipment: "Captain's chair or bench", sets: 3, reps: '12', notes: 'Pelvic tilt before each rep — lower abs lift the legs, no swinging' },
      { name: 'Planks', equipment: 'Bodyweight', sets: 3, reps: '45 sec hold', notes: 'Ribcage down, glutes engaged, breathe through the brace — 360° core tension' },
    ] },
    { day: 'Day 5', focus: 'Active Recovery', exercises: [], isRest: true, restNote: 'Off-day protocol — 8,000–10,000 steps · 20–30 min walking or light cycling · 3 L water minimum.' },
    { day: 'Day 6', focus: 'Active Recovery', exercises: [], isRest: true, restNote: 'Off-day protocol — 8,000–10,000 steps · 20–30 min walking or light cycling · 3 L water minimum.' },
    { day: 'Day 7', focus: 'Full Rest', exercises: [], isRest: true, restNote: 'Full rest — sleep, hydrate, recover. 3 L water minimum still applies.' },
  ],
  jordan_wayne: [
    { day: 'Day 1', focus: 'Upper Body Push', focus_cue: 'Time Under Tension — 3-second eccentric every rep', exercises: [
      { name: 'DB Flat Bench Press', equipment: 'Dumbbells', sets: 4, reps: '10-12', notes: 'Full ROM — pause at bottom. 3-sec eccentric.' },
      { name: 'Seated DB Shoulder Press', equipment: 'Dumbbells', sets: 4, reps: '10-12', notes: 'Vertical torso — no arching.' },
      { name: 'Machine Chest Flys', equipment: 'Machine', sets: 4, reps: '10-12', notes: '1-second squeeze at peak.' },
      { name: 'Lateral Raises', equipment: 'Dumbbells', sets: 4, reps: '10-12', notes: 'Lead with elbows.' },
      { name: 'Rope Tricep Pushdowns', equipment: 'Cable', sets: 4, reps: '10-12', notes: 'Flare rope at bottom. 3-sec return.' },
    ] },
    { day: 'Day 2', focus: 'Upper Body Pull', focus_cue: 'Postural Health — scapular retraction every rep', exercises: [
      { name: 'Lat Pulldowns', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Drive elbows — no momentum.' },
      { name: 'Seated Cable Rows', equipment: 'Cable', sets: 4, reps: '10-12', notes: 'Full scapular retraction.' },
      { name: 'Face Pulls', equipment: 'Cable', sets: 4, reps: '10-12', notes: 'External rotation focus.' },
      { name: 'Hammer Curls', equipment: 'Dumbbells', sets: 4, reps: '10-12', notes: 'Neutral grip — no swinging.' },
      { name: 'Back Extensions', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Glute and erector focus.' },
    ] },
    { day: 'Day 3', focus: 'Lower Body', focus_cue: 'Control descent — drive through mid-foot/heel', exercises: [
      { name: 'Heavy Leg Press', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Feet shoulder-width — no locked knees.' },
      { name: 'Goblet Squats', equipment: 'Dumbbell', sets: 4, reps: '10-12', notes: 'Chest high — depth and knee tracking.' },
      { name: 'Leg Extensions', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Superset with Leg Curls — no rest.' },
      { name: 'Leg Curls', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Slow eccentric — hips into pad.' },
      { name: 'Calf Raises', equipment: 'Machine', sets: 4, reps: '10-12', notes: 'Full stretch — 2-sec hold at peak.' },
    ] },
    { day: 'Day 4', focus: 'Full Body & Core', focus_cue: 'Quality over Quantity — high stability', exercises: [
      { name: 'Incline DB Press', equipment: 'Dumbbells', sets: 4, reps: '10-12', notes: 'Target clavicular pec.' },
      { name: 'Single Arm DB Rows', equipment: 'Dumbbell', sets: 4, reps: '10-12', notes: 'Anti-rotation — hips square.' },
      { name: 'Walking Lunges', equipment: 'Dumbbells', sets: 4, reps: '20 steps', notes: 'Balance and knee stability.' },
      { name: 'Plank', equipment: 'Bodyweight', sets: 3, reps: '60 sec', notes: 'Hollow body — squeeze glutes.' },
      { name: 'Supported Knee Raises', equipment: 'Dip Bars', sets: 3, reps: '12-15', notes: 'Vertical compression.' },
    ] },
    { day: 'Day 5', focus: 'Rest', exercises: [], isRest: true, restNote: 'Active recovery. Hydrate and stretch.' },
    { day: 'Day 6', focus: 'Rest', exercises: [], isRest: true },
    { day: 'Day 7', focus: 'Rest', exercises: [], isRest: true },
  ],
};

// Until per-user persona mapping arrives in the auth payload, the Vault renders
// this authorized plan. jacque_plan is a complete 7-day split (rest days + rich
// coaching cues), so it is the canonical default.
export const DEFAULT_PROGRAM_KEY = 'jacque_plan';

// Resolve a plan array for a persona key, falling back to the default. Never
// returns undefined — the grid always has an authorized plan to render.
export function getProgram(key) {
  return PROGRAM_CATALOG[key] || PROGRAM_CATALOG[DEFAULT_PROGRAM_KEY];
}
