// src/lib/personalTouches.js
// ─────────────────────────────────────────────────────────────────────────────
// Per-ACCOUNT personalization — warm, account-specific verbiage layered over the
// shared Vault chrome. Gated strictly by login slug, so it ONLY ever appears on
// those accounts and returns null for everyone else (zero impact on other
// clients). It never changes data or logic — it only swaps in caring copy.
//
// Today: the founder's parents — `mom_bbf` and `dad_bbf`. Each Vault carries a
// personal dedication and a softened, caring re-script of the daily readiness
// verdict (the clinical "SYSTEM BREACH / Prime Execution" language reads gently
// and by name for them). Dad also gets a Nutrition awareness note (his plan is
// built for heart health + steady blood sugar). The shared "Parents' Well-Being"
// Champion Mindset module is gated by isParent() below.
//
// To tweak the words, add a real name, or change a sign-off, edit THIS file.

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

  dad_bbf: {
    tagline: 'Built by your son’s own hands — for you, Dad. 💜',
    dedication: {
      kicker: 'For My Father',
      title: 'This One’s For You, Dad',
      lines: [
        'Everything here — every protocol, every screen, every line of code — your son built with his own hands.',
        'You brought me into this world and showed me how to work for something. This is me working for you: strong heart, steady sugar, good years ahead.',
        'No need to rush it — just keep showing up. Steady and consistent wins. Your son’s got the rest.',
      ],
      sign: '— With everything, your son.',
    },
    readiness: {
      PRIME_EXECUTION: 'Strong and steady today, Dad — green light. Go enjoy the work. 💪',
      STANDARD_OPERATIONS: 'Good to move today, Dad — keep it steady and controlled.',
      SYSTEM_STRAIN: 'Ease up today, Dad — lighter is the smart play. Keep that blood pressure happy.',
      SYSTEM_BREACH: 'Rest day, Dad. Recovery is part of the plan — be good to your heart today.',
      INSUFFICIENT_TELEMETRY: 'Whenever you’re ready, Dad — tell me how you slept and I’ll set today around you.',
    },
    // Awareness note rendered at the top of the Nutrition tab (gated by uid).
    nutrition: {
      kicker: 'Built For Your Health, Dad',
      title: 'Heart-Smart & Blood-Sugar Steady',
      body:
        'This plan isn’t random, Dad — your son built it around you. It’s pescatarian and heart-healthy: low in sodium and cholesterol to protect your blood pressure, and built on low-glycemic, high-fiber foods to keep your blood sugar steady through the day. Lean protein, omega-3 fish, beans, whole grains, and greens — food that loves you back.',
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

// The founder's parents — the only accounts that see the shared "Parents'
// Well-Being" educational health module inside Champion Mindset.
const PARENTS = new Set(['mom_bbf', 'dad_bbf']);
export function isParent(uid) {
  return PARENTS.has(String(uid || '').trim().toLowerCase());
}
