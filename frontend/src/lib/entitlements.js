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
// CEO-APPROVED HIERARCHY (cumulative):
//   Baseline   (Catalyst / Momentum) → grid, form_videos, base_nutrition, readiness
//   Autonomous (Autonomous)          → Baseline + voice_coach, smart_cardio, prehab
//   Fuel Series(Fuel *)              → Autonomous + advanced_nutrition (Meal Scanner)
//   Youth      (Rising Athlete)      → Baseline + sports_hub, roster
//   God Tier   (Sovereign/Hybrids)   → all of the above + sovereign_comlink, coach_orchestration

export const GROUP = {
  FITNESS_BASE: 'fitnessbase', // Baseline online fitness (Catalyst, Momentum)
  FITNESS_PRO:  'fitnesspro',  // Autonomous online fitness (+ voice/cardio/prehab)
  NUTRITION:    'nutrition',   // Fuel Series (inherits Autonomous + Meal Scanner)
  YOUTH:        'youth',       // Youth Athlete (Baseline + Sports Hub/roster)
  ALL:          'allaccess',   // God Tier — hybrids + admins + active trial
  NONE:         'none',        // no active subscription — everything sellable padlocked
};

// slug → access group. 13 canonical + 7 legacy. Anything NOT here is treated as
// fail-open (see resolveAccessGroup) so a future/unknown SKU never false-locks.
// CEO Phase-2 change: `momentum` is BASELINE (not PRO) — only Autonomous (and the
// Fuel/God tiers that inherit it) unlocks voice_coach / smart_cardio / prehab.
export const TIER_TO_GROUP = {
  // ── Canonical · Online Fitness ──
  catalyst: GROUP.FITNESS_BASE,    // $9.99 Baseline
  momentum: GROUP.FITNESS_BASE,    // $19.99 Baseline (CEO Phase 2)
  autonomous: GROUP.FITNESS_PRO,   // $49.99 Autonomous — unlocks voice/cardio/prehab
  // ── Canonical · Online Nutrition (Fuel Series → inherits Autonomous + Meal Scanner) ──
  fuel_foundation: GROUP.NUTRITION,
  fuel_performance: GROUP.NUTRITION,
  fuel_sovereign: GROUP.NUTRITION,
  // ── Canonical · Youth Athlete ──
  rising_athlete: GROUP.YOUTH,
  // ── Canonical · Hybrid Protocols (6 SKUs) — God Tier ──
  kickstart_6wk_3x: GROUP.ALL,
  kickstart_6wk_4x: GROUP.ALL,
  transformation_8wk_3x: GROUP.ALL,
  transformation_8wk_4x: GROUP.ALL,
  sovereign_12wk_3x: GROUP.ALL,
  sovereign_12wk_4x: GROUP.ALL,
  // ── Legacy storefront slugs → closest modern group (don't lock out legacy payers) ──
  lite: GROUP.FITNESS_BASE,        // entry fitness (≈ Catalyst/Momentum Baseline)
  gateway: GROUP.FITNESS_PRO,      // online-fitness gateway → Autonomous-level (generous)
  architect: GROUP.FITNESS_PRO,    // higher online fitness → Autonomous-level
  sovereign: GROUP.ALL,            // legacy flagship — God Tier
  youth_athlete: GROUP.YOUTH,      // ≈ Rising Athlete
  nutrition_essentials: GROUP.NUTRITION,
  nutrition_platinum: GROUP.NUTRITION,
};

// ── FEATURE_ACCESS — the canonical feature → unlocking-groups map (CEO hierarchy).
// A feature absent for the active group renders its <TierGate> fallback. ALL (God
// Mode) is in every list. KEEP IN LOCKSTEP with entitlement-gate.ts FEATURE_ACCESS.
const EVERY_PAYING = [GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.NUTRITION, GROUP.YOUTH, GROUP.ALL];
const AUTONOMOUS_UP = [GROUP.FITNESS_PRO, GROUP.NUTRITION, GROUP.ALL]; // Autonomous, Fuel, God
export const FEATURE_ACCESS = {
  // Baseline — every paying path (Fuel/Youth inherit Baseline).
  grid:               EVERY_PAYING,
  form_videos:        EVERY_PAYING,
  base_nutrition:     EVERY_PAYING,
  readiness:          EVERY_PAYING,
  mindset:            EVERY_PAYING, // Champion Mindset rides the Baseline bundle
  // Autonomous tier and up (NOT Baseline Catalyst/Momentum, NOT Youth).
  voice_coach:        AUTONOMOUS_UP,
  smart_cardio:       AUTONOMOUS_UP,
  prehab:             AUTONOMOUS_UP,
  // Fuel Series + God only.
  advanced_nutrition: [GROUP.NUTRITION, GROUP.ALL],
  // Youth Division + God only.
  sports_hub:         [GROUP.YOUTH, GROUP.ALL],
  roster:             [GROUP.YOUTH, GROUP.ALL],
  // God Tier only.
  sovereign_comlink:  [GROUP.ALL],
  coach_orchestration:[GROUP.ALL],
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
