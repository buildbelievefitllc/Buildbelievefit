// src/components/sports/sportsData.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF Sports Portal — Legacy Data Fusion layer.
//
// This module does NOT invent sport data. It FUSES the existing legacy "Sports
// Hub" structures into one portal taxonomy the new UI can drive:
//
//   • SPORTS + POSITION_KPIS  ← src/data/positionalBlueprints.js
//        (migrated verbatim from the legacy index.html EXP_SPORTS + EXP_KPI)
//   • WORKOUT_CATALOG          ← src/data/workoutCatalog.js
//        (migrated verbatim from the legacy workout-data.js — 375 trilingual drills)
//   • COMBINE_BENCHMARKS       ← ported verbatim from the legacy sports-hub.html
//        global SPORTS[].benchmarks (the "Global Scouting Hub" monolith)
//
// The portal adds only a thin presentation taxonomy on top: a curated sport grid
// (the video's "Discipline Focal Sport") and friendly position labels (the
// "Position Alignment Calibration"), each mapping back onto a legacy data key so
// KPI chips, drills, and collegiate benchmarks all resolve from real data.

import { SPORTS as LEGACY_SPORTS, POSITION_KPIS } from '../../data/positionalBlueprints.js';
import { WORKOUT_CATALOG } from '../../data/workoutCatalog.js';

export { POSITION_KPIS, WORKOUT_CATALOG, LEGACY_SPORTS };

// ─── Collegiate combine benchmarks ───────────────────────────────────────────
// Ported VERBATIM from the legacy sports-hub.html `SPORTS[].benchmarks` (lines
// 98–160). Keyed by the legacy position abbreviation. Lower-is-better metrics
// (40-yd, shuttle, lane, t-test, sprint, 60-yd) are flagged in LOWER_IS_BETTER.
export const COMBINE_BENCHMARKS = {
  football: {
    QB: { forty: 4.75, vert: 32, broad: 108, bench: 14 },
    RB: { forty: 4.48, vert: 36, broad: 120, bench: 20 },
    WR: { forty: 4.45, vert: 38, broad: 124, bench: 15 },
    TE: { forty: 4.65, vert: 34, broad: 116, bench: 22 },
    OL: { forty: 5.20, vert: 28, broad: 96, bench: 30 },
    DL: { forty: 4.85, vert: 32, broad: 108, bench: 28 },
    LB: { forty: 4.60, vert: 35, broad: 118, bench: 24 },
    DB: { forty: 4.42, vert: 38, broad: 126, bench: 16 },
  },
  basketball: {
    PG: { height: 74, wingspan: 78, vert: 36, lane: 10.8 },
    SG: { height: 76, wingspan: 80, vert: 38, lane: 11.0 },
    SF: { height: 79, wingspan: 83, vert: 36, lane: 11.2 },
    PF: { height: 81, wingspan: 86, vert: 34, lane: 11.5 },
    C: { height: 83, wingspan: 88, vert: 32, lane: 11.8 },
  },
  soccer: {
    GK: { beep: 10, ttest: 10.0, sprint: 4.5 },
    CB: { beep: 11, ttest: 9.8, sprint: 4.3 },
    FB: { beep: 12, ttest: 9.5, sprint: 4.2 },
    CM: { beep: 13, ttest: 9.3, sprint: 4.2 },
    CAM: { beep: 12.5, ttest: 9.2, sprint: 4.1 },
    Winger: { beep: 12, ttest: 9.0, sprint: 4.0 },
    ST: { beep: 11.5, ttest: 9.4, sprint: 4.1 },
  },
  baseball: {
    P: { sixty: 7.0, velo: 88, medball: 70 },
    C: { sixty: 7.2, velo: 82, medball: 65 },
    IF: { sixty: 6.7, velo: 84, exit: 92, medball: 68 },
    OF: { sixty: 6.6, velo: 86, exit: 95, medball: 70 },
  },
  volleyball: {
    OH: { block: 112, approach: 120, vert: 26 },
    MB: { block: 118, approach: 126, vert: 24 },
    S: { block: 108, approach: 116, vert: 24 },
    OPP: { block: 114, approach: 122, vert: 26 },
  },
};

// Metric keys where a LOWER raw value is the better result (timed events).
export const LOWER_IS_BETTER = ['forty', 'shuttle', 'lane', 'ttest', 'sprint', 'sixty'];

// ─── Discipline Focal Sport grid ─────────────────────────────────────────────
// The admin override's sport grid, exactly as shown in the wiretap. Each tile
// maps to a `legacy` key (the positionalBlueprints / workoutCatalog / benchmark
// id) so the rest of the portal resolves real data. Softball reuses the legacy
// Baseball corpus (the legacy hub combined them: "Baseball / Softball"); the
// Combat/Multi slot is a cross-discipline extensibility node with no single
// legacy sport, so it carries its own generic position set below.
// `labelKey` resolves the trilingual sport name (yi-sport-* in LangContext) so the
// admin grid matches Echo's canonical taxonomy; `label` is the English fallback. The
// first six are Echo's canonical youth set, in Echo's order; Softball + Combat/Multi
// are kept (additive, admin-only) per CEO directive.
export const PORTAL_SPORTS = [
  { id: 'football', label: 'American Football', labelKey: 'yi-sport-football', icon: '🏈', legacy: 'football' },
  { id: 'basketball', label: 'Basketball', labelKey: 'yi-sport-basketball', icon: '🏀', legacy: 'basketball' },
  { id: 'soccer', label: 'Soccer', labelKey: 'yi-sport-soccer', icon: '⚽', legacy: 'soccer' },
  { id: 'baseball', label: 'Baseball', labelKey: 'yi-sport-baseball', icon: '⚾', legacy: 'baseball' },
  { id: 'volleyball', label: 'Volleyball', labelKey: 'yi-sport-volleyball', icon: '🏐', legacy: 'volleyball' },
  { id: 'track', label: 'Track & Field', labelKey: 'yi-sport-track', icon: '🏃', legacy: 'track' },
  { id: 'softball', label: 'Softball', labelKey: 'yi-sport-softball', icon: '🥎', legacy: 'baseball' },
  { id: 'multi', label: 'Combat/Multi', labelKey: 'yi-sport-multi', icon: '🥊', legacy: null },
];

// ─── Position Alignment Calibration ──────────────────────────────────────────
// Curated, human-readable position groups per portal sport (the video's clean
// 4-item lists), each mapping to a LEGACY position key so KPI traits, the drill
// catalog, and collegiate benchmarks resolve from real data. Where the portal
// merges legacy roles (football "Linebacker/Secondary" = LB+DB), `legacy` points
// at the primary key and `also` lists the merged partners.
export const POSITION_GROUPS = {
  football: [
    { label: 'Quarterback', legacy: 'QB' },
    { label: 'Wide Receiver', legacy: 'WR' },
    { label: 'Lineman', legacy: 'OL', also: ['DL'] },
    { label: 'Linebacker/Secondary', legacy: 'LB', also: ['S', 'DB'] },
  ],
  basketball: [
    { label: 'Point Guard', legacy: 'PG' },
    { label: 'Shooting Guard', legacy: 'SG' },
    { label: 'Forward', legacy: 'SF', also: ['PF'] },
    { label: 'Center', legacy: 'C' },
  ],
  soccer: [
    { label: 'Forward', legacy: 'FW' },
    { label: 'Midfielder', legacy: 'MF' },
    { label: 'Defender', legacy: 'DEF' },
    { label: 'Goalkeeper', legacy: 'GK' },
  ],
  baseball: [
    { label: 'Pitcher', legacy: 'P' },
    { label: 'Infielder', legacy: 'IF' },
    { label: 'Outfielder', legacy: 'OF' },
    { label: 'Catcher', legacy: 'C' },
  ],
  softball: [
    { label: 'Pitcher', legacy: 'P' },
    { label: 'Infielder', legacy: 'IF' },
    { label: 'Outfielder', legacy: 'OF' },
    { label: 'Catcher', legacy: 'C' },
  ],
  tennis: [
    { label: 'Singles', legacy: 'singles' },
    { label: 'Doubles', legacy: 'doubles' },
  ],
  mma: [
    { label: 'Striker', legacy: 'striker' },
    { label: 'Grappler', legacy: 'grappler' },
    { label: 'Wrestler', legacy: 'wrestler' },
    { label: 'All-Rounder', legacy: 'all_rounder' },
  ],
  volleyball: [
    { label: 'Outside Hitter', legacy: 'OH' },
    { label: 'Middle Blocker', legacy: 'MB' },
    { label: 'Setter', legacy: 'S' },
    { label: 'Libero', legacy: 'LIB' },
  ],
  // Track & Field — Echo's canonical EVENT groups (the secondary input is an Event,
  // not a position). Codes resolve the Hub's TRACK_BENCHMARKS; this is the single
  // taxonomy youthSports.YOUTH_SPORTS reuses, so the admin Portal and the youth
  // intake share ONE position/event-id system.
  track: [
    { label: 'Sprints (100 / 200m)', legacy: 'sprints' },
    { label: 'Distance (800m+)', legacy: 'distance' },
    { label: 'Jumps', legacy: 'jumps' },
    { label: 'Throws', legacy: 'throws' },
  ],
  // Cross-discipline node — no single legacy sport. Generic KPI traits are
  // supplied here since positionalBlueprints has no entries for these roles.
  multi: [
    { label: 'Striker', legacy: null, kpis: ['Rotational Torque', 'Reactive Agility', 'Anaerobic Repeat Power'] },
    { label: 'Grappler', legacy: null, kpis: ['Static Strength', 'Hip Displacement', 'Grip Endurance'] },
    { label: 'Hybrid Athlete', legacy: null, kpis: ['Triple Extension Power', 'Multi-Directional Quickness', 'VO2 Capacity'] },
    { label: 'Conditioning Base', legacy: null, kpis: ['Aerobic Base', 'Tendon Resilience', 'Movement Quality'] },
  ],
};

// ─── Strategic Focus Directive options ───────────────────────────────────────
// The "Bespoke Strategic Focus Directive" goal dropdown. The first entry is the
// directive shown in the wiretap for Marcus.
export const GOAL_DIRECTIVES = [
  'Increase Acceleration & Route Break Fluidity',
  'Maximal Strength & Triple-Extension Power',
  'Explosive First-Step & Reaction Speed',
  'Injury-Prevention & Joint Armor',
  'Hypertrophy & Lean Mass Accrual',
  'Sport-Specific Conditioning & VO₂ Capacity',
];

// ─── Age → development bracket model ─────────────────────────────────────────
// One source of truth for everything the Biological Age slider drives: the
// dossier bracket chip, the Era Phase, the Age-Comp safe heart-rate cap + PHV
// guidance, and which Lifeline phase is the active target. Sovereign safe-peak
// HR uses a youth-protective cap of (218 − age) — at the wiretap's age 17 this
// yields the shown 201 BPM.
export function ageProfile(age) {
  const a = Number(age) || 0;
  const maxHR = 218 - a; // Sovereign safe-peak cap (217.. → 201 @ 17, per wiretap)

  if (a <= 12) {
    return {
      eraPhase: 1,
      headerLabel: 'Youth Bracket',
      bracketLabel: 'Foundational Motor Base (Ages 6–12)',
      lifelinePhaseId: 'youth',
      maxHR,
      skeletal: 'Foundational — no maximal axial loading',
      complianceRate: 100,
      phvNote:
        'Pre-PHV window. Prioritize gamified coordination, dynamic spatial feedback, and strict skeletal safety boundaries. No maximal loading — movement quality first.',
    };
  }
  if (a <= 15) {
    return {
      eraPhase: 2,
      headerLabel: 'Developmental Bracket',
      bracketLabel: 'Adolescent Periodization (Ages 13–15)',
      lifelinePhaseId: 'scholastic',
      maxHR,
      skeletal: 'Monitoring — growth-plate caution',
      complianceRate: 90,
      phvNote:
        'Active PHV (Peak Height Velocity) window. Introduce periodization loading conservatively and track growth velocity to offset micro-tears around the growth plates.',
    };
  }
  return {
    eraPhase: 3,
    headerLabel: 'Highschool Bracket',
    bracketLabel: 'Senior Scholastic Peak (Ages 16–18)',
    lifelinePhaseId: 'club',
    maxHR,
    skeletal: 'Verified Compliance Rate: 100%',
    complianceRate: 100,
    phvNote:
      'Skeletal structures fully stabilized. Training focus is on peak Rate of Force Development (RFD) and explosive elastic loading. Implement patellar tendon prehab as static overload triggers.',
  };
}

// ─── Lifeline (lifelong) phase roadmap ───────────────────────────────────────
// The age-tiered development ladder. `id` aligns with ageProfile().lifelinePhaseId
// so the dossier can mark the athlete's current rung as the ACTIVE TARGET.
export const LIFELINE_PHASES = [
  {
    id: 'youth',
    label: 'Youth Era (Ages 6–12)',
    desc: 'Gamified coordination, dynamic spatial feedback, and skeletal safety boundaries.',
  },
  {
    id: 'scholastic',
    label: 'Scholastic (Ages 13–15)',
    desc: 'Introduction to periodization loading. PHV (Peak Height Velocity) tracking to offset growth micro-tears.',
  },
  {
    id: 'club',
    label: 'High School & Club (Ages 16–18)',
    desc: 'Full velocity profiles, elite power optimization, and an active public recruiting dashboard.',
  },
];

export const LIFELINE_TAGS = ['VBT Profiling', 'Recruiting Live Portfolio', 'Rate of Force Vectors'];

// ─── Resolvers ───────────────────────────────────────────────────────────────
export function getPortalSport(sportId) {
  return PORTAL_SPORTS.find((s) => s.id === sportId) || PORTAL_SPORTS[0];
}

export function getPositions(sportId) {
  return POSITION_GROUPS[sportId] || POSITION_GROUPS.football;
}

export function getPosition(sportId, label) {
  const list = getPositions(sportId);
  return list.find((p) => p.label === label) || list[0];
}

// KPI traits for a portal position — pulled from the legacy POSITION_KPIS by the
// mapped legacy key, or the position's own `kpis` for the Combat/Multi node.
export function kpisFor(position) {
  if (!position) return [];
  if (position.kpis) return position.kpis;
  return (POSITION_KPIS[position.legacy] || []).slice(0, 3);
}

// Lab-Verified drills for a portal sport+position, straight from WORKOUT_CATALOG.
export function drillsFor(sportId, position) {
  const sport = getPortalSport(sportId);
  if (!sport.legacy || !position?.legacy) return [];
  const catalog = WORKOUT_CATALOG[sport.legacy] || {};
  return catalog[position.legacy] || [];
}

// Collegiate benchmark row for a portal sport+position, where legacy keys align.
export function benchmarkFor(sportId, position) {
  const sport = getPortalSport(sportId);
  if (!sport.legacy || !position?.legacy) return null;
  return (COMBINE_BENCHMARKS[sport.legacy] || {})[position.legacy] || null;
}
