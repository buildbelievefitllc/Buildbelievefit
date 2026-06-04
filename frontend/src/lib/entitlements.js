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
// Legacy slugs map to the smallest modern access group that still contains every
// tab they already unlocked — a grandfathered payer is NEVER downgraded.
//
// STRATEGIC PRICING LADDER (CEO order — Full Fleet Sync): access is no longer flat
// across a path. Each tier unlocks strictly MORE than the one below it, so the gaps
// ARE the upsell. Two ascending ladders:
//
//   Online Fitness:   Catalyst   (FITNESS_BASE,   $9.99)  → Program, Cardio, Mindset
//                     Momentum   (FITNESS_PRO,   $19.99)  → + Generator, Prehab
//                     Autonomous (FITNESS_APEX,  $49.99)  → + Nutrition (full vault)
//   Online Nutrition: Fuel Foundation  (NUTRITION_BASE,  $7.99)  → Nutrition
//                     Fuel Performance (NUTRITION_PRO,  $14.99)  → + Cardio
//                     Fuel Sovereign   (NUTRITION_APEX, $29.99)  → + Prehab, Mindset
//
// Generator is the Catalyst→Momentum hook; Nutrition is the Momentum→Autonomous hook.
// Cross-path reach at the top of each ladder (Autonomous gets Nutrition; Fuel
// Sovereign gets Cardio/Prehab/Mindset) makes the apex tiers feel like full access.

export const GROUP = {
  // Online Fitness path — three ascending tiers (the upsell ladder):
  FITNESS_BASE: 'fitnessbase',  // Catalyst   $9.99  — Program, Cardio, Mindset (Generator + Prehab padlocked)
  FITNESS_PRO: 'fitnesspro',    // Momentum   $19.99 — adds Generator + Prehab
  FITNESS_APEX: 'fitnessapex',  // Autonomous $49.99 — adds Nutrition (full vault across training + fuel)
  // Online Nutrition (Fuel) path — three ascending tiers:
  NUTRITION_BASE: 'nutritionbase', // Fuel Foundation  $7.99  — Nutrition only
  NUTRITION_PRO: 'nutritionpro',   // Fuel Performance $14.99 — adds Cardio
  NUTRITION_APEX: 'nutritionapex', // Fuel Sovereign   $29.99 — adds Prehab + Mindset
  YOUTH: 'youth',              // Youth Athlete path
  ALL: 'allaccess',            // Hybrid protocols + admins + active trial — God Mode
  NONE: 'none',                // no active subscription — everything sellable is padlocked
};

// slug → access group. 13 canonical + 7 legacy. Anything NOT here is treated as
// fail-open (see resolveAccessGroup) so a future/unknown SKU never false-locks.
export const TIER_TO_GROUP = {
  // ── Canonical · Online Fitness (ascending ladder — each adds to the one below) ──
  catalyst: GROUP.FITNESS_BASE,   // $9.99  — Program, Cardio, Mindset
  momentum: GROUP.FITNESS_PRO,    // $19.99 — + Generator, Prehab
  autonomous: GROUP.FITNESS_APEX, // $49.99 — + Nutrition (full vault)
  // ── Canonical · Online Nutrition (ascending ladder) ──
  fuel_foundation: GROUP.NUTRITION_BASE,  // $7.99  — Nutrition
  fuel_performance: GROUP.NUTRITION_PRO,  // $14.99 — + Cardio
  fuel_sovereign: GROUP.NUTRITION_APEX,   // $29.99 — + Prehab, Mindset
  // ── Canonical · Youth Athlete ──
  rising_athlete: GROUP.YOUTH,
  // ── Canonical · Hybrid Protocols (6 SKUs) — God Mode ──
  kickstart_6wk_3x: GROUP.ALL,
  kickstart_6wk_4x: GROUP.ALL,
  transformation_8wk_3x: GROUP.ALL,
  transformation_8wk_4x: GROUP.ALL,
  sovereign_12wk_3x: GROUP.ALL,
  sovereign_12wk_4x: GROUP.ALL,
  // ── Legacy storefront slugs → smallest NON-REGRESSING modern group ──
  // Grandfather law: map to the smallest new group whose tabs ⊇ what the slug used to
  // grant, so a legacy payer keeps everything they bought (never a downgrade).
  lite: GROUP.FITNESS_PRO,      // old entry fitness granted Generator; new BASE drops it → map up to PRO to preserve it (+Prehab)
  gateway: GROUP.FITNESS_PRO,   // old gateway == new FITNESS_PRO tab set exactly (Program/Cardio/Mindset/Generator/Prehab)
  architect: GROUP.FITNESS_PRO, // old higher fitness == new FITNESS_PRO tab set exactly
  sovereign: GROUP.ALL,         // legacy flagship — full access (unchanged)
  youth_athlete: GROUP.YOUTH,   // ≈ Rising Athlete (unchanged)
  nutrition_essentials: GROUP.NUTRITION_BASE, // old nutrition granted Nutrition only → NUTRITION_BASE preserves it exactly
  nutrition_platinum: GROUP.NUTRITION_BASE,   // old nutrition granted Nutrition only → NUTRITION_BASE preserves it exactly
};

// Which groups unlock each Vault tab. A tab absent from the active group's reach
// renders the UpgradeOverlay. hub + settings are universal (never sell someone
// their own dashboard or account screen). ALL (God Mode) reaches everything.
//   FITNESS_BASE   (Catalyst)         → program, cardio, mindset
//   FITNESS_PRO    (Momentum)         → + generator, prehab
//   FITNESS_APEX   (Autonomous)       → + nutrition (every sellable tab)
//   NUTRITION_BASE (Fuel Foundation)  → nutrition
//   NUTRITION_PRO  (Fuel Performance) → + cardio
//   NUTRITION_APEX (Fuel Sovereign)   → + prehab, mindset
//   YOUTH                             → (advanced tabs locked; routed to /sports — CEO ruling)
//   NONE                              → (everything sellable padlocked)
const UNIVERSAL = [
  GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.FITNESS_APEX,
  GROUP.NUTRITION_BASE, GROUP.NUTRITION_PRO, GROUP.NUTRITION_APEX,
  GROUP.YOUTH, GROUP.ALL, GROUP.NONE,
];
// Every Online Fitness tier (BASE/PRO/APEX) + God Mode — the shared floor of the fitness ladder.
const FITNESS_ANY = [GROUP.FITNESS_BASE, GROUP.FITNESS_PRO, GROUP.FITNESS_APEX, GROUP.ALL];
export const TAB_ACCESS = {
  hub: UNIVERSAL,
  settings: UNIVERSAL,
  // Program — the training core: every Online Fitness tier + God Mode.
  program: FITNESS_ANY,
  // Generator — the Catalyst→Momentum hook: mid/top fitness (Momentum/Autonomous) only.
  generator: [GROUP.FITNESS_PRO, GROUP.FITNESS_APEX, GROUP.ALL],
  // Cardio — every fitness tier + Nutrition PRO/APEX (Fuel Performance/Sovereign) + God Mode.
  cardio: [...FITNESS_ANY, GROUP.NUTRITION_PRO, GROUP.NUTRITION_APEX],
  // Mindset — every fitness tier + Nutrition APEX (Fuel Sovereign) + God Mode.
  mindset: [...FITNESS_ANY, GROUP.NUTRITION_APEX],
  // Nutrition — Autonomous (top fitness) + every Online Nutrition tier + God Mode.
  nutrition: [GROUP.FITNESS_APEX, GROUP.NUTRITION_BASE, GROUP.NUTRITION_PRO, GROUP.NUTRITION_APEX, GROUP.ALL],
  // Prehab — mid/top fitness (Momentum/Autonomous) + Nutrition APEX (Fuel Sovereign) + God Mode.
  prehab: [GROUP.FITNESS_PRO, GROUP.FITNESS_APEX, GROUP.NUTRITION_APEX, GROUP.ALL],
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
