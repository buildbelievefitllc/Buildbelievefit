// src/lib/entitlements.js
// ─────────────────────────────────────────────────────────────────────────────
// Vault Upsell Funnel — the pure access-resolution brain (NO React, NO network).
//
// "Visibility as a sales tool": every Vault tab stays VISIBLE to every athlete;
// tabs their tier doesn't unlock render a padlock + upgrade CTA in place of the
// tool (see UpgradeOverlay). This module is the single source of truth for WHICH
// tier unlocks WHICH surface. It is deliberately framework-free + side-effect-free
// so it stays trivially testable and reusable (ClientVault tabs + the /sports route).
//
// ⚠️ SCOPE (acknowledged with the CEO): this is a COSMETIC upsell funnel, not an
// access-control security boundary. The gated tools still call their (paid)
// backends; protecting paid compute requires server-side tier checks. Locking here
// only changes what the UI shows. FAIL-OPEN is therefore the rule — a network blip
// or an unknown tier must NEVER padlock a paying customer out of what they bought.
//
// TIER SLUGS — the resolver accepts BOTH families the webhook can write
// (supabase/functions/stripe-webhook ALLOWED_TIERS): the 13 canonical marketing
// slugs AND the 7 legacy storefront slugs (kept live until the monolith retires).
// Legacy slugs map to their closest modern access group so legacy payers keep
// exactly what they already bought.
//
// PREHAB AS A MID-TIER UPSELL (CEO Value Matrix): the Online Fitness path is split
// into two access tiers so Prehab converts at a mid price point instead of forcing
// the $699 God-Mode jump. Entry (Catalyst $9.99) → FITNESS_BASE keeps Prehab
// padlocked (the upsell hook). Momentum ($19.99) + Autonomous ($49.99) → FITNESS_PRO
// unlock Prehab. Both fitness tiers keep every other Online Fitness tab.

export const GROUP = {
  // Online Fitness path, split into two tiers so Prehab is a mid-tier upsell:
  FITNESS_BASE: 'fitnessbase', // entry Online Fitness (Catalyst) — Prehab padlocked
  FITNESS_PRO: 'fitnesspro',   // mid/top Online Fitness (Momentum, Autonomous) — Prehab unlocked
  NUTRITION: 'nutrition',      // Online Nutrition (Fuel) path
  YOUTH: 'youth',              // Youth Athlete path
  ALL: 'allaccess',            // Hybrid protocols + admins + active trial — God Mode
  NONE: 'none',                // no active subscription — everything sellable is padlocked
};

// slug → access group. 13 canonical + 7 legacy. Anything NOT here is treated as
// fail-open (see resolveAccessGroup) so a future/unknown SKU never false-locks.
export const TIER_TO_GROUP = {
  // ── Canonical · Online Fitness (BASE = entry; PRO = mid/top → adds Prehab) ──
  catalyst: GROUP.FITNESS_BASE,   // $9.99 entry — Prehab padlocked (the upsell hook)
  momentum: GROUP.FITNESS_PRO,    // $19.99 — unlocks Prehab
  autonomous: GROUP.FITNESS_PRO,  // $49.99 — unlocks Prehab
  // ── Canonical · Online Nutrition ──
  fuel_foundation: GROUP.NUTRITION,
  fuel_performance: GROUP.NUTRITION,
  fuel_sovereign: GROUP.NUTRITION,
  // ── Canonical · Youth Athlete ──
  rising_athlete: GROUP.YOUTH,
  // ── Canonical · Hybrid Protocols (6 SKUs) — God Mode ──
  kickstart_6wk_3x: GROUP.ALL,
  kickstart_6wk_4x: GROUP.ALL,
  transformation_8wk_3x: GROUP.ALL,
  transformation_8wk_4x: GROUP.ALL,
  sovereign_12wk_3x: GROUP.ALL,
  sovereign_12wk_4x: GROUP.ALL,
  // ── Legacy storefront slugs → closest modern group (don't lock out legacy payers) ──
  lite: GROUP.FITNESS_BASE,     // entry fitness (≈ Catalyst) → Prehab padlocked
  gateway: GROUP.FITNESS_PRO,   // online-fitness gateway (Phase 17 NULL grandfather) → keep Prehab (fail-open generous)
  architect: GROUP.FITNESS_PRO, // higher online fitness → unlocks Prehab
  sovereign: GROUP.ALL,         // legacy flagship — full access
  youth_athlete: GROUP.YOUTH,   // ≈ Rising Athlete
  nutrition_essentials: GROUP.NUTRITION,
  nutrition_platinum: GROUP.NUTRITION,
};

// Which groups unlock each Vault tab. A tab absent from the active group's reach
// renders the UpgradeOverlay. hub + settings are universal (never sell someone
// their own dashboard or account screen). ALL (God Mode) reaches everything.
//   Fitness BASE → program, generator, cardio, mindset  (padlock nutrition + prehab)
//   Fitness PRO  → the above PLUS prehab                 (padlock nutrition)
//   Nutrition    → nutrition                             (padlock all physical/cognitive)
//   Youth        → (advanced tabs all locked; routed to /sports — CEO ruling)
//   None         → (everything sellable padlocked)
const UNIVERSAL = [
  GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.NUTRITION, GROUP.YOUTH, GROUP.ALL, GROUP.NONE,
];
// Core Online Fitness tabs stay open to BOTH fitness tiers (BASE + PRO) + God Mode.
const FITNESS_ANY = [GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.ALL];
export const TAB_ACCESS = {
  hub: UNIVERSAL,
  settings: UNIVERSAL,
  program: FITNESS_ANY,
  generator: FITNESS_ANY,
  cardio: FITNESS_ANY,
  mindset: FITNESS_ANY,
  nutrition: [GROUP.NUTRITION, GROUP.ALL],
  // Mid-tier upsell: FITNESS_PRO (Momentum/Autonomous) + God Mode — NOT entry Catalyst.
  prehab: [GROUP.FITNESS_PRO, GROUP.ALL],
};

// For a locked tab, which pricing PATH the upgrade CTA steers toward. The target
// MUST be a path that actually unlocks the tab. Prehab is now a mid-tier Online
// Fitness upsell (Momentum $19.99 / Autonomous $49.99 unlock it), so a padlocked
// entry (Catalyst) athlete is steered to the 'fitness' path — NOT the old $699
// Hybrid jump. The featured fitness tier (Autonomous) genuinely unlocks Prehab,
// so the steer stays honest.
export const TAB_UPGRADE_PATH = {
  program: 'fitness',
  generator: 'fitness',
  cardio: 'fitness',
  mindset: 'fitness',
  nutrition: 'nutrition',
  prehab: 'fitness',
};

// The /sports route (Sports Hub) — Youth + God Mode only; others get the overlay.
const SPORTS_GROUPS = [GROUP.YOUTH, GROUP.ALL];
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

// Can this access group view this Vault tab? Unknown tabs are never gated.
export function canAccessTab(group, tabId) {
  const reach = TAB_ACCESS[tabId];
  if (!reach) return true;
  return reach.includes(group);
}

// Can this access group enter the Sports Hub (/sports)?
export function canAccessSports(group) {
  return SPORTS_GROUPS.includes(group);
}
