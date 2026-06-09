// src/lib/pricingMatrix.js
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for the live Stripe Payment Links (the Phase 15 Revenue
// Matrix). Extracted out of MarketingLanding.jsx so two surfaces consume ONE
// definition and the checkout URLs can never drift between them:
//
//   • MarketingLanding.jsx  — the public pricing cards.
//   • UpgradeOverlay (Vault Upsell Funnel) — the in-Vault padlock CTA.
//
// Every tier's purchase button is a LIVE Stripe Payment Link (buy.stripe.com),
// provisioned 2026-06-02 against acct_1TLzQCQ4j3uHTi7P ("Build Believe Fit llc").
// Price IDs are kept inline for traceability back to the Stripe dashboard. Feature
// copy is derived from existing brand surfaces (CLAUDE.md §1 + legacy tier copy) —
// no invented figures or guarantees. The category keys (fitness / nutrition /
// youth / hybrid) are the canonical "paths" the entitlement layer steers toward.

export const MATRIX_TABS = [
  { key: 'fitness', label: 'Online Fitness' },
  { key: 'nutrition', label: 'Online Nutrition' },
  { key: 'youth', label: 'Youth Athlete' },
  { key: 'hybrid', label: 'Hybrid Protocols' },
];

export const PRICING = {
  // ── CATEGORY 1 — Online Fitness · recurring monthly ──
  fitness: {
    note: 'Recurring · billed monthly · cancel anytime',
    tiers: [
      {
        name: 'BBF Catalyst', price: '$9.99', per: '/mo',
        priceId: 'price_1TdtVCQ4j3uHTi7PEjvMihnk',
        link: 'https://buy.stripe.com/fZu00lb71fMfcjE0sxaZi0k',
        feats: [
          'Adaptive training program — workout tracking + logging',
          'Cardio engine',
          'Champion Mindset coaching',
          'Trilingual — EN / ES / PT',
        ],
      },
      {
        name: 'BBF Momentum', price: '$19.99', per: '/mo',
        priceId: 'price_1TdtVDQ4j3uHTi7Pb2hGyXBi',
        link: 'https://buy.stripe.com/3cIcN7b719nR6ZkcbfaZi0l',
        feats: [
          'Everything in Catalyst',
          'AI Workout Generator — on-demand session builder',
          'Prehab suite — Friction Scanner + injury-prevention',
          'Periodization that adapts to your logged data',
        ],
      },
      {
        name: 'BBF Autonomous', price: '$49.99', per: '/mo',
        featured: true, badge: 'Most Chosen',
        priceId: 'price_1TdtVDQ4j3uHTi7PP2uWTj0y',
        link: 'https://buy.stripe.com/9B67sN8YT1VpdnIa37aZi0m',
        feats: [
          'Everything in Momentum',
          'Full Nutrition suite — TDEE macros + meal guidance',
          'Complete vault — program, cardio, mindset, generator, prehab + fuel',
          'Self-directed — the engine adapts to you',
        ],
      },
    ],
  },
  // ── CATEGORY 2 — Online Nutrition (Fuel) · recurring monthly ──
  nutrition: {
    note: 'Recurring · billed monthly · cancel anytime',
    tiers: [
      {
        name: 'Fuel Foundation', price: '$7.99', per: '/mo',
        priceId: 'price_1TdtVEQ4j3uHTi7PQ0fOArfI',
        link: 'https://buy.stripe.com/9B69AV8YTgQjabw6QVaZi0n',
        feats: [
          'TDEE-based macro blueprint',
          'Core meal guidance',
          'Daily macro targets',
          'Trilingual — EN / ES / PT',
        ],
      },
      {
        name: 'Fuel Performance', price: '$14.99', per: '/mo',
        priceId: 'price_1TdtVEQ4j3uHTi7PEvGYoQkW',
        link: 'https://buy.stripe.com/9B64gB2AvcA397s4INaZi0o',
        feats: [
          'Everything in Foundation',
          'Cardio engine unlocked',
          'Performance macro programming',
          'Hydration + fueling timing',
        ],
      },
      {
        name: 'Fuel Sovereign', price: '$29.99', per: '/mo',
        featured: true, badge: 'Most Chosen',
        priceId: 'price_1TdtVFQ4j3uHTi7PZ65aKtTI',
        link: 'https://buy.stripe.com/6oUbJ36QL2Ztabw4INaZi0p',
        feats: [
          'Everything in Performance',
          'Prehab suite — Friction Scanner + injury-prevention',
          'Champion Mindset coaching unlocked',
          'Premium nutrition programming + priority recalibration',
        ],
      },
    ],
  },
  // ── CATEGORY 3 — Youth Athlete · recurring monthly ──
  youth: {
    note: 'Recurring · billed monthly · cancel anytime',
    tiers: [
      {
        name: 'BBF Rising Athlete', price: '$14.99', per: '/mo',
        featured: true, badge: 'Youth Flagship',
        priceId: 'price_1TdtVFQ4j3uHTi7Ponk5039p',
        link: 'https://buy.stripe.com/aFa3cx5MH1Vp97sejnaZi0q',
        feats: [
          'Periodized sport training',
          'Kinematic Form HUD — movement screening',
          'Injury-prevention + prehab focus',
          'Position-specific blueprints',
          'Trilingual — EN / ES / PT',
        ],
      },
    ],
  },
  // ── CATEGORY 4 — Hybrid Protocols · one-time enrollment (3× or 4× / week) ──
  hybrid: {
    note: 'One-time enrollment · in-person + app · pick your weekly frequency',
    tiers: [
      {
        name: 'Kickstart', span: '6-Week Protocol',
        feats: [
          'Foundational 6-week block',
          'In-person + app hybrid',
          'Technique base + form correction',
          'Joint-first progression',
        ],
        options: [
          { label: '3× / week', price: '$399', priceId: 'price_1TdtVGQ4j3uHTi7P51mzlaCT', link: 'https://buy.stripe.com/5kQaEZejdbvZabwcbfaZi0r' },
          { label: '4× / week', price: '$499', priceId: 'price_1TdtVGQ4j3uHTi7P5AZSEOoS', link: 'https://buy.stripe.com/dRmaEZb710Rl5Vg2AFaZi0s' },
        ],
      },
      {
        name: 'Transformation', span: '8-Week Protocol',
        feats: [
          'Progressive 8-week block',
          'Hands-on biomechanics with Akeem',
          'Progressive overload + prehab',
          'Live form correction',
        ],
        options: [
          { label: '3× / week', price: '$499', priceId: 'price_1TdtVHQ4j3uHTi7PMh786BoK', link: 'https://buy.stripe.com/4gM7sN3EzfMf1F0a37aZi0t' },
          { label: '4× / week', price: '$649', priceId: 'price_1TdtVHQ4j3uHTi7PhOfSjE61', link: 'https://buy.stripe.com/6oUeVf4ID8jN6Zk6QVaZi0u' },
        ],
      },
      {
        name: 'Sovereign', span: '12-Week Protocol',
        featured: true, badge: 'Founder-Direct',
        feats: [
          'Apex 12-week protocol',
          'Founder-direct 1-on-1 coaching',
          'Joint protection + prehab architecture',
          'Maximum access — human-in-the-loop',
        ],
        options: [
          { label: '3× / week', price: '$699', priceId: 'price_1TdtVIQ4j3uHTi7POHmPRFGn', link: 'https://buy.stripe.com/3cI6oJ8YTeIbcjEgrvaZi0v' },
          { label: '4× / week', price: '$899', priceId: 'price_1TdtVIQ4j3uHTi7PYVF5s0dq', link: 'https://buy.stripe.com/4gMeVffnh7fJ83o0sxaZi0w' },
        ],
      },
    ],
  },
};

// The tier a category steers an un-entitled athlete toward: the FEATURED tier
// (the business's "Most Chosen" steer), else the first/only tier.
function featuredTier(category) {
  return category.tiers.find((tier) => tier.featured) || category.tiers[0];
}

// Resolve the upgrade CTA target for a pricing path (fitness / nutrition / youth /
// hybrid). Single-SKU paths return the tier's `priceId` — the in-Vault UpgradeOverlay
// mints a SCREENING-GATED Stripe Checkout Session server-side (bbf-create-checkout),
// so no raw buy.stripe.com link is ever exposed. The Hybrid path's protocols carry
// per-frequency options (no single price), so it returns the in-app pricing-matrix
// anchor ('/#programs') — which itself funnels through the Pathfinder before checkout.
//
//   → { path, tierName, price, priceId }  (single-SKU)
//   → { path, tierName, price, href, external }  (Hybrid matrix anchor)  |  null
export function upgradeTargetForPath(path) {
  const category = PRICING[path];
  if (!category) return null;
  const tier = featuredTier(category);

  if (tier.priceId) {
    return { path, tierName: tier.name, price: tier.price || '', priceId: tier.priceId };
  }

  // Multi-option (Hybrid) — no single price; route to the pricing matrix.
  const lowest = Array.isArray(tier.options) && tier.options.length ? tier.options[0] : null;
  return {
    path,
    tierName: tier.span ? `${tier.name} · ${tier.span}` : tier.name,
    price: lowest ? `from ${lowest.price}` : '',
    href: '/#programs',
    external: false,
  };
}
