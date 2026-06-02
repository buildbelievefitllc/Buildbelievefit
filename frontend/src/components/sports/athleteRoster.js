// src/components/sports/athleteRoster.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF Sports Portal — Athlete roster fixtures.
//
// The legacy "Sports Hub" stored athlete telemetry dynamically (Supabase bbf_logs
// / bbf_readiness / bbf_active_clients) and carried NO hardcoded athlete sample.
// This file supplies the structural roster the portal renders — Marcus "Jet"
// Williams is the canonical TEMPLATE (authored 1:1 with the CEO wiretap); Leo,
// Sofia, and Kaden exercise the other legacy sports so every sport/position/age
// branch renders with real, sport-appropriate data.
//
// Section values that are DERIVABLE (age bracket, safe-HR cap, PHV guidance,
// active Lifeline phase, KPI chips, collegiate benchmarks) are NOT stored here —
// they resolve from sportsData.js so the admin override stays the single driver.
// What lives here is the athlete's own logged telemetry: biometrics, macro
// strategy, dietary exclusions, the drill scorecard, kinematics matrix, and the
// recruiting bio.

import { getPortalSport } from './sportsData.js';

// injuryRisk → status tone (LOW = green, MODERATE = gold, ELEVATED = red).
export const RISK_TONE = { LOW: 'grn', MODERATE: 'yel', ELEVATED: 'red' };

export const ATHLETES = [
  {
    id: 'marcus',
    firstName: 'Marcus',
    nickname: 'Jet',
    lastName: 'Williams',
    initials: 'MJ',
    sportId: 'football',
    positionLabel: 'Wide Receiver',
    age: 17,
    focusDirective: 'Increase Acceleration & Route Break Fluidity',
    biometrics: { hrvRecovery: 82, fatigueDrift: 12, injuryRisk: 'LOW' },
    nutrition: {
      phase: 'High-Calorie Kinetic Loading Phase',
      hydration: '4.5 L / Day',
      macros: { carbs: 50, protein: 30, fats: 20 },
      foods: [
        { icon: '🥩', label: 'Grass-fed flank steak' },
        { icon: '🍠', label: 'Sweet potato mash' },
        { icon: '🍚', label: 'Quinoa bowls' },
        { icon: '🍯', label: 'Greek yogurt with local honey' },
        { icon: '🥤', label: 'Spinach-pineapple micro-shakes' },
      ],
    },
    exclusions: ['Tree Nuts (Severe Allergy)', 'Raw bell peppers (Dislike)'],
    assessment: {
      somaticReadiness: { value: 100, limit: 70 },
      movementQuality: { value: 92, limit: 75 },
      approved: true,
      verdict: 'All Somatic & Balance Conditions Within Sparing Limit',
      verdictNote:
        'Somatic parameters are excellent. Form stability is verified. The kinetic telemetry profile suggests high central-nervous-system capacitance levels. Athlete is permitted to advance phases.',
    },
    drills: [
      {
        name: 'Sled Tow-Sprint-Overloads',
        desc: 'Perform 4 reps of 20-meter sled drags at 60% bodyweight.',
        metricLabel: 'Sprint Time (seconds)',
        target: 4.0, achieved: 4.12, unit: 's', met: true,
      },
      {
        name: 'Hip-Extension-Kettlebell Snaps',
        desc: 'Triple extensions focusing on instant hip torque development.',
        metricLabel: 'Hip Velocity',
        target: 1.4, achieved: 1.48, unit: 'rad/s', met: true,
      },
      {
        name: 'Lateral Route Decelerations',
        desc: 'Sudden deceleration with hip drop and ankle preservation angles.',
        metricLabel: 'Contact Balance Index',
        target: 90, achieved: 89, unit: '%', met: true,
      },
    ],
    forecast:
      "All today's metrics attained. This maximum stimulation velocity will optimize neurological reflex speeds by 17%, and is projected to pull the next milestone stage 1 day ahead of estimate — under safe tendon-loading guidelines. Joint capsular wear minimized by 22%.",
    recruiting: {
      verified: true,
      visibility: 'PUBLIC PORTFOLIO ACTIVE',
      highlights: [
        { label: 'Exit-Force Vel', value: '1.48 rad/s' },
        { label: 'Spinal Deviation', value: '4.8° Stable' },
      ],
      bio: 'Marcus displays elite acceleration vectors. Dynamic deceleration figures sit in the 90th percentile of high-school skill-position athletes. — BBF AI Scout Draft Report',
      scoutSlug: 'marcus-jet-williams',
    },
    kinematics: [
      { label: 'COD L-Drill Velocity Splits', value: '4.12s · 4.05s · 3.89s', status: '92% Tier Rank', tone: 'grn' },
      { label: 'Explosive Hip Extension Velocity', value: '1.48 rad/s', status: 'High Pivot Torque', tone: 'yel' },
      { label: 'Contact Balance Stability Index', value: '89 / 100', status: 'Sufficient', tone: 'mut' },
      { label: 'Route-Break Posture Angle Drift', value: '4.8° dev', status: 'Stable Line-pull', tone: 'grn' },
    ],
  },

  {
    id: 'leo',
    firstName: 'Leo',
    nickname: 'Sky',
    lastName: 'Vance',
    initials: 'LV',
    sportId: 'basketball',
    positionLabel: 'Forward',
    age: 16,
    focusDirective: 'Explosive First-Step & Reaction Speed',
    biometrics: { hrvRecovery: 76, fatigueDrift: 18, injuryRisk: 'MODERATE' },
    nutrition: {
      phase: 'Lean Power Recomposition Phase',
      hydration: '4.0 L / Day',
      macros: { carbs: 45, protein: 35, fats: 20 },
      foods: [
        { icon: '🐟', label: 'Wild salmon fillet' },
        { icon: '🍚', label: 'Brown rice & black beans' },
        { icon: '🥛', label: 'Cottage cheese bowls' },
        { icon: '🍒', label: 'Tart cherry recovery juice' },
        { icon: '🍌', label: 'Almond-banana smoothies' },
      ],
    },
    exclusions: ['Lactose (Intolerance)'],
    assessment: {
      somaticReadiness: { value: 88, limit: 70 },
      movementQuality: { value: 84, limit: 75 },
      approved: true,
      verdict: 'Balance Conditions Within Sparing Limit',
      verdictNote:
        'Recovery markers are slightly compressed after the tournament block. Form stability holds above the sparing limit — athlete may advance with managed eccentric volume.',
    },
    drills: [
      {
        name: 'Approach Jump to Rim Touch',
        desc: 'Max-intent vertical approach for finishing height at the rim.',
        metricLabel: 'Vertical Reach',
        target: 34, achieved: 35, unit: 'in', met: true,
      },
      {
        name: 'Mirror Agility Drill',
        desc: 'Reactive multi-directional mirroring of an opponent.',
        metricLabel: 'Reaction Lag',
        target: 0.30, achieved: 0.28, unit: 's', met: true,
      },
      {
        name: 'Triple-Threat Jab Step Series',
        desc: 'Rotational power from catch to attack position.',
        metricLabel: 'Hip Torque',
        target: 1.30, achieved: 1.22, unit: 'rad/s', met: false,
      },
    ],
    forecast:
      'Two of three targets attained. First-step reactivity is trending up 11%; hold the rotational-torque block another microcycle before re-testing to protect the patellar tendon.',
    recruiting: {
      verified: true,
      visibility: 'PUBLIC PORTFOLIO ACTIVE',
      highlights: [
        { label: 'Standing Vert', value: '35 in' },
        { label: 'Lane Agility', value: '11.1 s' },
      ],
      bio: 'Leo projects as a positionless wing with a plus first step. Lateral closing speed sits in the top decile of regional 16U forwards. — BBF AI Scout Draft Report',
      scoutSlug: 'leo-sky-vance',
    },
    kinematics: [
      { label: 'Standing Vertical Displacement', value: '35.0 in', status: '88% Tier Rank', tone: 'grn' },
      { label: 'Lane Agility Closing Speed', value: '11.1 s', status: 'Plus First-Step', tone: 'yel' },
      { label: 'Eccentric Landing Control', value: '84 / 100', status: 'Monitor', tone: 'mut' },
      { label: 'Knee Valgus Angle Drift', value: '6.2° dev', status: 'Within Tolerance', tone: 'grn' },
    ],
  },

  {
    id: 'sofia',
    firstName: 'Sofia',
    nickname: 'Rey',
    lastName: 'Reyes',
    initials: 'SR',
    sportId: 'soccer',
    positionLabel: 'Midfielder',
    age: 15,
    focusDirective: 'Sport-Specific Conditioning & VO₂ Capacity',
    biometrics: { hrvRecovery: 84, fatigueDrift: 9, injuryRisk: 'LOW' },
    nutrition: {
      phase: 'Aerobic Engine Fueling Phase',
      hydration: '3.5 L / Day',
      macros: { carbs: 55, protein: 25, fats: 20 },
      foods: [
        { icon: '🍗', label: 'Grilled chicken & quinoa' },
        { icon: '🍠', label: 'Sweet potato & lentils' },
        { icon: '🫐', label: 'Greek yogurt & berries' },
        { icon: '🥤', label: 'Beetroot endurance shots' },
        { icon: '🌾', label: 'Oat & date energy bites' },
      ],
    },
    exclusions: ['Gluten (Sensitivity)'],
    assessment: {
      somaticReadiness: { value: 94, limit: 70 },
      movementQuality: { value: 90, limit: 75 },
      approved: true,
      verdict: 'All Balance Conditions Within Sparing Limit',
      verdictNote:
        'Aerobic recovery is exceptional for the adolescent bracket. PHV monitoring shows no growth-plate stress flags — athlete is cleared to progress interval density.',
    },
    drills: [
      {
        name: 'Yo-Yo IR1 Shuttle Loading',
        desc: 'Progressive interval shuttles for repeat-sprint capacity.',
        metricLabel: 'Distance',
        target: 2000, achieved: 2080, unit: 'm', met: true,
      },
      {
        name: 'Agility T-Test Circuit',
        desc: 'Multi-directional cutting with deceleration control.',
        metricLabel: 'T-Test',
        target: 9.3, achieved: 9.2, unit: 's', met: true,
      },
      {
        name: '30m Repeat Sprint',
        desc: 'Linear acceleration under accumulating fatigue.',
        metricLabel: 'Sprint',
        target: 4.2, achieved: 4.25, unit: 's', met: true,
      },
    ],
    forecast:
      'All targets attained inside the adolescent loading envelope. Projected VO₂max gain of 4% over the mesocycle with growth-safe interval density.',
    recruiting: {
      verified: true,
      visibility: 'PUBLIC PORTFOLIO ACTIVE',
      highlights: [
        { label: 'Yo-Yo IR1', value: '2080 m' },
        { label: 'Est. VO₂max', value: '54.1' },
      ],
      bio: 'Sofia is a box-to-box engine with elite repeat-sprint capacity for her age tier. Interception anticipation grades top-quartile among 15U midfielders. — BBF AI Scout Draft Report',
      scoutSlug: 'sofia-rey-reyes',
    },
    kinematics: [
      { label: 'Yo-Yo IR1 Total Distance', value: '2080 m', status: '90% Tier Rank', tone: 'grn' },
      { label: 'Agility T-Test Cut Speed', value: '9.20 s', status: 'Elite Transition', tone: 'yel' },
      { label: 'Repeat-Sprint Fatigue Index', value: '92 / 100', status: 'Sufficient', tone: 'mut' },
      { label: 'Pelvic Stability Drift', value: '3.6° dev', status: 'Growth-Safe', tone: 'grn' },
    ],
  },

  {
    id: 'kaden',
    firstName: 'Kaden',
    nickname: 'Cannon',
    lastName: 'Brooks',
    initials: 'KB',
    sportId: 'baseball',
    positionLabel: 'Pitcher',
    age: 17,
    focusDirective: 'Maximal Strength & Triple-Extension Power',
    biometrics: { hrvRecovery: 79, fatigueDrift: 14, injuryRisk: 'MODERATE' },
    nutrition: {
      phase: 'Rotational Power & Tissue Resilience Phase',
      hydration: '4.2 L / Day',
      macros: { carbs: 48, protein: 32, fats: 20 },
      foods: [
        { icon: '🦬', label: 'Lean bison burgers' },
        { icon: '🥑', label: 'Jasmine rice & avocado' },
        { icon: '🍲', label: 'Bone-broth collagen' },
        { icon: '🍯', label: 'Greek yogurt & honey' },
        { icon: '🍍', label: 'Pineapple-ginger anti-inflammatory shakes' },
      ],
    },
    exclusions: ['Shellfish (Severe Allergy)'],
    assessment: {
      somaticReadiness: { value: 91, limit: 70 },
      movementQuality: { value: 78, limit: 75 },
      approved: true,
      verdict: 'Balance Conditions Within Sparing Limit',
      verdictNote:
        'Shoulder deceleration control sits just above the sparing limit. Form stability is verified for advancement — maintain scapular eccentric prehab as a non-negotiable.',
    },
    drills: [
      {
        name: 'Med-Ball Rotational Scoop Toss',
        desc: 'Rotational med-ball release for hip-to-shoulder separation.',
        metricLabel: 'Throw Velocity',
        target: 68, achieved: 71, unit: 'mph', met: true,
      },
      {
        name: 'Scapular Deceleration Eccentrics',
        desc: 'Controlled eccentric load for arm-deceleration integrity.',
        metricLabel: 'Decel Control',
        target: 85, achieved: 82, unit: '%', met: false,
      },
      {
        name: '60-Yard Acceleration',
        desc: 'Linear sprint for base-running burst.',
        metricLabel: '60-yd',
        target: 7.0, achieved: 6.92, unit: 's', met: true,
      },
    ],
    forecast:
      'Velocity and burst targets attained; deceleration control trails by 3%. Hold throwing volume flat and bias eccentric scapular work to close the arm-health gap before the next bullpen.',
    recruiting: {
      verified: true,
      visibility: 'PUBLIC PORTFOLIO ACTIVE',
      highlights: [
        { label: 'Throw Velo', value: '88 mph' },
        { label: 'Exit Velo', value: '94 mph' },
      ],
      bio: 'Kaden pairs a low-effort 88 mph fastball with elite rotational sequencing. Kinetic-chain efficiency grades in the 88th percentile of 17U arms. — BBF AI Scout Draft Report',
      scoutSlug: 'kaden-cannon-brooks',
    },
    kinematics: [
      { label: 'Peak Throwing Velocity', value: '88 mph', status: '86% Tier Rank', tone: 'grn' },
      { label: 'Hip-to-Shoulder Separation', value: '52° sep', status: 'Elite Sequencing', tone: 'yel' },
      { label: 'Scapular Deceleration Control', value: '82 / 100', status: 'Monitor — Arm Health', tone: 'mut' },
      { label: 'Landing-Leg Block Drift', value: '5.1° dev', status: 'Stable Front-Side', tone: 'grn' },
    ],
  },
];

// Display name helper — "Marcus \"Jet\" Williams".
export function fullName(a) {
  return a.nickname ? `${a.firstName} "${a.nickname}" ${a.lastName}` : `${a.firstName} ${a.lastName}`;
}

// Uppercase sport label for the athlete-file tab chips ("FOOTBALL").
export function sportLabel(a) {
  return getPortalSport(a.sportId).label.toUpperCase();
}

export function getAthlete(id) {
  return ATHLETES.find((a) => a.id === id) || ATHLETES[0];
}

// Resolve the athlete a non-admin client should see. Best-effort match on the
// logged-in username/id against the fixture id or first name; falls back to the
// template athlete so the Client View is never empty.
export function resolveClientAthlete(user) {
  const key = String(user?.username || user?.id || '').trim().toLowerCase();
  if (!key) return ATHLETES[0];
  return (
    ATHLETES.find((a) => a.id === key || a.firstName.toLowerCase() === key) || ATHLETES[0]
  );
}
