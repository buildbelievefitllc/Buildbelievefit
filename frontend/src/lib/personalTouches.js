// src/lib/personalTouches.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-ACCOUNT personalization — warm, account-specific verbiage layered over the
// shared Vault chrome. Gated strictly by login slug, so it ONLY ever appears on
// that one account and returns null for everyone else (zero impact on other
// clients). It never changes data or logic — it only swaps in caring copy.
//
// Today: `mom_bbf` — the founder's mother. Her Vault carries a personal dedication
// and a softened, caring re-script of the daily readiness verdict (the clinical
// "SYSTEM BREACH / Prime Execution" language reads gently for her).
//
// To tweak the words, add her real name, or change the sign-off, edit THIS file.

const TOUCHES = {
  mom_bbf: {
    // Shown small, under "WELCOME, <NAME>" in the persistent header (every tab).
    tagline: 'Your son built every inch of this — for you. 💜',
    // The dedication card at the top of the Check-In / readiness surface.
    dedication: {
      kicker: 'For My Mother',
      title: 'This One’s For You, Mom',
      lines: [
        'Everything here — every protocol, every screen, every line of code — your son built with his own hands.',
        'You raised the discipline that made it. Now it’s yours: move easy, move strong, and stay the powerhouse you’ve always been.',
        'No pressure, no rush — just show up for you. Your son’s got the rest.',
      ],
      sign: '— With everything, your son.',
    },
    // Caring re-script of the readiness verdict, keyed by the engine's mode.
    readiness: {
      PRIME_EXECUTION: 'You’re firing on all cylinders today, Mom — go enjoy it. 💪',
      STANDARD_OPERATIONS: 'Steady and strong today, Mom — a good day to move.',
      SYSTEM_STRAIN: 'Your body’s asking for a lighter touch today, Mom — ease in, no pushing.',
      SYSTEM_BREACH: 'Today’s a rest-and-recover day, Mom. Be gentle with yourself — that’s strength too.',
      INSUFFICIENT_TELEMETRY: 'Whenever you’re ready, Mom — tell me how you slept and I’ll tune today around you.',
    },
  },
};

// The personalization config for a login slug, or null when there is none.
export function personalFor(uid) {
  const k = String(uid || '').trim().toLowerCase();
  return TOUCHES[k] || null;
}

// Caring readiness line for a slug + engine mode (empty string when not personalized).
export function personalReadiness(uid, mode) {
  const p = personalFor(uid);
  if (!p || !p.readiness) return '';
  return p.readiness[mode] || p.readiness.INSUFFICIENT_TELEMETRY || '';
}
