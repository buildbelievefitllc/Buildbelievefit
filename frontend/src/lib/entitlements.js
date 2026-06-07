// src/lib/entitlements.js
// ─────────────────────────────────────────────────────────────────────────────
// Vault Upsell Funnel — the pure access-resolution brain (NO React, NO network).
//
// FEATURE-GRAINED (Phase 2): every gated surface is a FEATURE key (not just a tab),
// so a single tab can host several independently-gated tools (e.g. the Nutrition
// tab hosts base_nutrition for everyone + the advanced_nutrition Meal Scanner for
// Fuel/God only). The frontend consumes this via <TierGate feature="…">.
//
// ⚠️ SCOPE: the FRONTEND treatment is a COSMETIC, FAIL-OPEN upsell funnel — a
// network blip or unknown tier must NEVER padlock a paying customer. The
// SERVER-SIDE twin (supabase/functions/_shared/entitlement-gate.ts) enforces the
// SAME map FAIL-CLOSED and is the real security boundary. KEEP THE TWO MAPS IN
// LOCKSTEP — this file and entitlement-gate.ts share one canonical hierarchy.
//
// CEO MASTER FEATURE MAP (Final Gating Sweep — cumulative ladder):
//   Baseline   (catalyst, momentum, fuel_foundation)   → grid, form_videos, base_nutrition, readiness
//   Autonomous (autonomous, fuel_performance)          → Baseline + voice_coach, smart_cardio, prehab
//   Apex       (fuel_sovereign + 6 Hybrid protocols)   → Autonomous + advanced_nutrition (Meal Scanner), sovereign_comlink, coach_orchestration
//   Youth      (rising_athlete)                         → Baseline + sports_hub, roster
//   God Mode   (admins / coach / akeem / active trial) → everything (role-based, not a purchasable tier)

export const GROUP = {
  BASELINE:   'baseline',    // Baseline band — catalyst, momentum, fuel_foundation
  AUTONOMOUS: 'autonomous',  // Autonomous band — autonomous, fuel_performance (+ voice/cardio/prehab)
  APEX:       'apex',        // Apex band — fuel_sovereign + 6 Hybrid protocols (+ comlink/orchestration/meal-scanner)
  YOUTH:      'youth',       // Youth Athlete — Baseline + Sports Hub/roster
  ALL:        'allaccess',   // God Mode — admins + active trial (+ soft fail-open); no tier maps here
  NONE:       'none',        // no active subscription — everything sellable padlocked
};

// slug → access group. 13 canonical + 7 legacy. Anything NOT here is treated as
// fail-open (see resolveAccessGroup) so a future/unknown SKU never false-locks.
// CEO Phase-2 change: `momentum` is BASELINE (not PRO) — only Autonomous (and the
// Fuel/God tiers that inherit it) unlocks voice_coach / smart_cardio / prehab.
export const TIER_TO_GROUP = {
  // ── Baseline band — grid · form_videos · base_nutrition · readiness ──
  catalyst:         GROUP.BASELINE,   // $9.99 entry fitness
  momentum:         GROUP.BASELINE,   // $19.99 Baseline (CEO Phase 2)
  fuel_foundation:  GROUP.BASELINE,   // entry nutrition → Baseline band
  // ── Autonomous band — Baseline + voice_coach · smart_cardio · prehab ──
  autonomous:       GROUP.AUTONOMOUS, // $49.99 Autonomous
  fuel_performance: GROUP.AUTONOMOUS, // mid nutrition → training unlocks (no Meal Scanner)
  // ── Apex band — Autonomous + advanced_nutrition · sovereign_comlink · coach_orchestration ──
  fuel_sovereign:        GROUP.APEX,  // top nutrition → adds Meal Scanner + Comlink
  kickstart_6wk_3x:      GROUP.APEX,
  kickstart_6wk_4x:      GROUP.APEX,
  transformation_8wk_3x: GROUP.APEX,
  transformation_8wk_4x: GROUP.APEX,
  sovereign_12wk_3x:     GROUP.APEX,
  sovereign_12wk_4x:     GROUP.APEX,
  // ── Youth band — Baseline + sports_hub · roster ──
  rising_athlete:   GROUP.YOUTH,
  // ── Legacy storefront slugs → closest modern band (don't lock out legacy payers) ──
  lite:                 GROUP.BASELINE,   // entry fitness (≈ Catalyst/Momentum)
  gateway:              GROUP.AUTONOMOUS, // online-fitness gateway → Autonomous-level
  architect:            GROUP.AUTONOMOUS, // higher online fitness → Autonomous-level
  sovereign:            GROUP.APEX,       // legacy flagship → Apex band
  youth_athlete:        GROUP.YOUTH,      // ≈ Rising Athlete
  nutrition_essentials: GROUP.BASELINE,   // entry nutrition → Baseline
  nutrition_platinum:   GROUP.APEX,       // premium nutrition → Apex (Meal Scanner)
};

// ── FEATURE_ACCESS — the canonical feature → unlocking-BANDS map (CEO Master Map).
// A feature absent for the active band renders its <TierGate> fallback. ALL (God
// Mode) is in every list; higher bands inherit everything below them. KEEP IN
// LOCKSTEP with entitlement-gate.ts FEATURE_ACCESS.
const BASE_BAND  = [GROUP.BASELINE, GROUP.AUTONOMOUS, GROUP.APEX, GROUP.YOUTH, GROUP.ALL]; // every paying path + God
const AUTO_BAND  = [GROUP.AUTONOMOUS, GROUP.APEX, GROUP.ALL]; // Autonomous + Apex + God
const APEX_BAND  = [GROUP.APEX, GROUP.ALL];                   // Apex + God
const YOUTH_BAND = [GROUP.YOUTH, GROUP.ALL];                  // Youth + God
export const FEATURE_ACCESS = {
  // Baseline — every paying path (Autonomous/Apex/Youth inherit it).
  grid:               BASE_BAND,
  form_videos:        BASE_BAND,
  base_nutrition:     BASE_BAND,
  readiness:          BASE_BAND,
  mindset:            BASE_BAND, // Champion Mindset rides the Baseline bundle
  // Autonomous band and up (NOT Baseline, NOT Youth).
  voice_coach:        AUTO_BAND,
  smart_cardio:       AUTO_BAND,
  cardio:             AUTO_BAND, // legacy alias for smart_cardio
  prehab:             AUTO_BAND,
  // Apex band only (+ God) — the premium adult unlocks.
  advanced_nutrition: APEX_BAND, // Meal Scanner
  nutrition_macros:   APEX_BAND,
  nutrition_image:    APEX_BAND, // Meal Scanner (image)
  sovereign_comlink:  APEX_BAND,
  coach_orchestration:APEX_BAND,
  // Youth band only (+ God) — the Athlete Portal suite.
  sports_hub:         YOUTH_BAND,
  roster:             YOUTH_BAND,
  kinematics:         YOUTH_BAND,
};

// Vault tab id → the FEATURE it gates on. hub + settings are universal (never sold).
export const TAB_FEATURE = {
  hub: null,
  settings: null,
  program: 'grid',
  generator: 'grid',
  cardio: 'smart_cardio',
  prehab: 'prehab',
  nutrition: 'base_nutrition',
  mindset: 'mindset',
};

// For a locked feature, which pricing PATH the upgrade CTA steers toward. The
// target MUST be a path that actually unlocks the feature.
export const FEATURE_UPGRADE_PATH = {
  grid: 'fitness',
  form_videos: 'fitness',
  base_nutrition: 'fitness',
  readiness: 'fitness',
  mindset: 'fitness',
  voice_coach: 'fitness',   // Autonomous unlocks it (featured fitness tier)
  smart_cardio: 'fitness',
  prehab: 'fitness',
  advanced_nutrition: 'nutrition', // Fuel Series
  sports_hub: 'youth',
  roster: 'youth',
  sovereign_comlink: 'hybrid',     // God Tier — purchasable via the Hybrid protocols
  coach_orchestration: 'hybrid',
};

// Back-compat path maps (kept for useEntitlement's tab/sports helpers).
export const TAB_UPGRADE_PATH = {
  program: 'fitness', generator: 'fitness', cardio: 'fitness',
  mindset: 'fitness', nutrition: 'nutrition', prehab: 'fitness',
};
export const SPORTS_UPGRADE_PATH = 'youth';

// Resolve the athlete's access group from the raw signals.
//   isAdmin / trialActive → God Mode (mirrors the monolith Iron-Vault bouncer).
//   soft (tier in-flight, RPC error, or no row) → fail-OPEN God Mode (never false-lock).
//   recognized tier → its mapped group.
//   present-but-unknown tier → fail-OPEN (warn) so a new SKU never locks a payer.
//   empty/null tier (a real row with no subscription) → NONE (the upsell state).
export function resolveAccessGroup({ tier, isAdmin = false, trialActive = false, soft = false } = {}) {
  if (isAdmin || trialActive) return GROUP.ALL;
  if (soft) return GROUP.ALL;
  const slug = String(tier || '').trim().toLowerCase();
  if (!slug) return GROUP.NONE;
  if (Object.prototype.hasOwnProperty.call(TIER_TO_GROUP, slug)) return TIER_TO_GROUP[slug];
  // Has a tier, but not one we map — don't punish a payer for a map gap. Fail open
  // and surface it so this file gets synced with the next new SKU.
  if (typeof console !== 'undefined') {
    console.warn(`[entitlements] unknown tier slug "${slug}" — failing open (God Mode).`);
  }
  return GROUP.ALL;
}

// Can this access group use this FEATURE? Unknown feature → never gated (UI safety;
// the server twin fails CLOSED on an unknown feature — that is the real boundary).
export function canAccessFeature(group, feature) {
  if (!feature) return true; // universal surface (hub/settings) — never gated
  const reach = FEATURE_ACCESS[feature];
  if (!reach) return true;
  return reach.includes(group);
}

// Can this access group view this Vault tab? Delegates to the feature map so there
// is ONE source of truth. Unknown/ungated tabs are never gated.
export function canAccessTab(group, tabId) {
  if (!Object.prototype.hasOwnProperty.call(TAB_FEATURE, tabId)) return true;
  return canAccessFeature(group, TAB_FEATURE[tabId]);
}

// Can this access group enter the Sports Hub (/sports)?
export function canAccessSports(group) {
  return canAccessFeature(group, 'sports_hub');
}
