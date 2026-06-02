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

export const GROUP = {
  FITNESS: 'fitness',     // Online Fitness path
  NUTRITION: 'nutrition', // Online Nutrition (Fuel) path
  YOUTH: 'youth',         // Youth Athlete path
  ALL: 'allaccess',       // Hybrid protocols + admins + active trial — God Mode
  NONE: 'none',           // no active subscription — everything sellable is padlocked
};

// slug → access group. 13 canonical + 7 legacy. Anything NOT here is treated as
// fail-open (see resolveAccessGroup) so a future/unknown SKU never false-locks.
export const TIER_TO_GROUP = {
  // ── Canonical · Online Fitness ──
  catalyst: GROUP.FITNESS,
  momentum: GROUP.FITNESS,
  autonomous: GROUP.FITNESS,
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
  lite: GROUP.FITNESS,         // entry fitness (≈ Catalyst)
  gateway: GROUP.FITNESS,      // online-fitness gateway (the Phase 17 NULL grandfather)
  architect: GROUP.FITNESS,    // higher online fitness
  sovereign: GROUP.ALL,        // legacy flagship — full access
  youth_athlete: GROUP.YOUTH,  // ≈ Rising Athlete
  nutrition_essentials: GROUP.NUTRITION,
  nutrition_platinum: GROUP.NUTRITION,
};

// Which groups unlock each Vault tab. A tab absent from the active group's reach
// renders the UpgradeOverlay. hub + settings are universal (never sell someone
// their own dashboard or account screen). ALL (God Mode) reaches everything.
//   Fitness   → program, generator, cardio, mindset   (padlock nutrition, prehab)
//   Nutrition → nutrition                              (padlock all physical/cognitive)
//   Youth     → (advanced tabs all locked; routed to /sports — CEO ruling)
//   None      → (everything sellable padlocked)
const UNIVERSAL = [GROUP.FITNESS, GROUP.NUTRITION, GROUP.YOUTH, GROUP.ALL, GROUP.NONE];
export const TAB_ACCESS = {
  hub: UNIVERSAL,
  settings: UNIVERSAL,
  program: [GROUP.FITNESS, GROUP.ALL],
  generator: [GROUP.FITNESS, GROUP.ALL],
  cardio: [GROUP.FITNESS, GROUP.ALL],
  mindset: [GROUP.FITNESS, GROUP.ALL],
  nutrition: [GROUP.NUTRITION, GROUP.ALL],
  prehab: [GROUP.ALL],
};

// For a locked tab, which pricing PATH the upgrade CTA steers toward. The target
// MUST be a path that actually unlocks the tab — e.g. prehab is God-Mode-only, so
// it steers to Hybrid; steering to Online Fitness would sell a plan that STILL
// leaves prehab locked (a dishonest upsell).
export const TAB_UPGRADE_PATH = {
  program: 'fitness',
  generator: 'fitness',
  cardio: 'fitness',
  mindset: 'fitness',
  nutrition: 'nutrition',
  prehab: 'hybrid',
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
