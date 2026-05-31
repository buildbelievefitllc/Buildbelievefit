// src/data/positionalBlueprints.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 17.8 — Positional Blueprints data (sport meta + per-position KPI traits).
//
// Extracted VERBATIM from the legacy index.html (EXP_SPORTS + EXP_KPI). The drill
// catalog itself lives in ./workoutCatalog.js (migrated verbatim from the legacy
// workout-data.js). NO data invented — 5 sports, 25 positions, traits as shipped.
//
// Sport display names resolve through i18n keys (pb-sport-*). Position cards show
// the abbreviation + KPI trait chips + the first Lab-Verified drill, exactly like
// the legacy pbRenderPositions().

// 5 sports, 25 positions — position order preserved from EXP_SPORTS.
export const SPORTS = [
  { id: 'football', icon: '🏈', nameKey: 'pb-sport-football', positions: ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'S'] },
  { id: 'basketball', icon: '🏀', nameKey: 'pb-sport-basketball', positions: ['PG', 'SG', 'SF', 'PF', 'C'] },
  { id: 'soccer', icon: '⚽', nameKey: 'pb-sport-soccer', positions: ['FW', 'MF', 'DEF', 'GK'] },
  { id: 'baseball', icon: '⚾', nameKey: 'pb-sport-baseball', positions: ['P', 'C', 'IF', 'OF'] },
  { id: 'volleyball', icon: '🏐', nameKey: 'pb-sport-volleyball', positions: ['S', 'OH', 'LIB', 'MB'] },
];

// Per-position KPI traits (3 each) — verbatim from legacy EXP_KPI. Keyed by the
// position abbreviation. NOTE: the legacy keys collide where abbreviations repeat
// (basketball 'C' / baseball 'C' share one entry; football 'S' / volleyball 'S'
// share one) — preserved exactly as the legacy data shipped.
export const POSITION_KPIS = {
  QB: ['Rotational Torque', 'Pocket Maneuverability', 'Throwing Velocity'],
  RB: ['Lateral Agility', 'Triple Extension Power', 'Ball Security'],
  WR: ['Linear Acceleration', 'Change of Direction', 'Grip Strength'],
  TE: ['Triple Extension Power', 'Blocking Leverage', 'Versatility Endurance'],
  OL: ['Static Strength', 'Lateral Displacement', 'Core Stability'],
  DL: ['Peak Explosive Power', 'Shedding Torque', 'First-Step Velocity'],
  LB: ['Lateral Tracking', 'Tackling Force', 'Reactive Agility'],
  S: ['Top-End Speed', 'Transition Velocity', 'Vertical Displacement'],
  PG: ['Repeat Sprint Ability', 'Ball Handling Precision', 'Peripheral Vision'],
  SG: ['Shooting Velocity', 'Transition Speed', 'Lateral Flow'],
  SF: ['Vertical Displacement', 'Multi-Directional Quickness', 'Triple-Threat Torque'],
  PF: ['Triple Extension Power', 'Rebounding Force', 'Post-Stability'],
  C: ['Rim Protection Power', 'Static Strength', 'Pivot Speed'],
  FW: ['Sprint Velocity', 'Shot Conversion Rate', 'Off-Ball Acceleration'],
  MF: ['Total Distance', 'Pass Completion', 'Interception Anticipation'],
  DEF: ['Aerial Duel Win%', 'Recovery Sprint Speed', 'Tackling Efficiency'],
  GK: ['Reaction Time', 'Lateral Displacement Power', 'Distribution Accuracy'],
  P: ['Pitch Velocity', 'Scapular Deceleration', 'Kinetic Sequencing'],
  IF: ['Lateral Agility', 'Ball Exchange Speed', 'Rotational Throw Force'],
  OF: ['Linear Acceleration', 'Drop-Step Efficiency', 'Arm Strength'],
  OH: ['Vertical Jump Height', 'Spike Velocity', 'Explosive Acceleration'],
  LIB: ['Agility / Reaction Speed', 'Dig Accuracy', 'Low-Center Stability'],
  MB: ['Block Reach Height', 'Lateral Closing Speed', 'Triple Extension Power'],
};
