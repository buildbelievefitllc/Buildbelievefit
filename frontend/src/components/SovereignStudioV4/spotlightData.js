// src/components/SovereignStudioV4/spotlightData.js
// ─────────────────────────────────────────────────────────────────────────────
// Client Spotlight quote banks — ported VERBATIM from the legacy Sovereign Studio
// (bbf-studio.html · QUOTES1 / QUOTES2). QUOTE1 is the client-facing "proof" line;
// QUOTE2 is the coach's shoutout line. The 🎰 SPIN pairs one from each.

export const SPOT_QUOTES1 = [
  'This is what showing up — week after week — looks like.',
  'No shortcuts. No gimmicks. Just stacked days.',
  'Same person. Different decisions.',
  'The plan only works if you do — and you did.',
  'Every single session, logged. Every single week, earned.',
  'From day one to this — pure consistency.',
  'Proof that the process works when you work it.',
  'Built in the early mornings nobody saw.',
  'Trusting the process looks exactly like this.',
  'Discipline you can see from across the room.',
  'The before was the beginning. The after is just a checkpoint.',
  'Real food, real training, real life — no extremes.',
  'They kept the promise to themselves. Every week.',
  'What happens when excuses lose their seat at the table.',
  'Strength built around a full-time life.',
  'This transformation was decided months before it was visible.',
];

export const SPOT_QUOTES2 = [
  'Proud to be part of your journey.',
  'The Lab draws the map. You walked every mile.',
  'Honored to coach this kind of commitment.',
  'This is your win — I just held the clipboard.',
  "Can't wait to see the next chapter.",
  'Your consistency raised the standard for all of us.',
  'Coaching you has been the easy part.',
  'The work was yours. The applause is too.',
  "And we're just getting started.",
  'Champions are built like this — quietly, weekly.',
  'Thank you for trusting the process.',
  'Your future self is grateful. So am I.',
  'This is what believing looks like in the mirror.',
  'More proud than words can carry.',
  'The blueprint works because you did.',
  'Forever part of the BBF story now.',
];

// Sovereign Studio default Spotlight state — the legacy stage's opening values.
export const SPOT_DEFAULTS = {
  format: 'card',          // 'card' (before/after, 1080×1350) | 'video' (Tier 2 · 1080×1920)
  clientName: 'JACKY',
  subLine: 'Performance Laboratory • West Valley AZ',
  shoutout: 'INCREDIBLE WORK, JACKY.',
  quote1: SPOT_QUOTES1[0],
  quote2: SPOT_QUOTES2[0],
  achievement: '',        // context that seeds the AI shoutout (e.g. "-40 lbs in 6 months")
  cta: 'READY FOR YOURS?  DM "PATHFINDER"  •  buildbelievefit.fitness',
  beforeImage: null,       // blob-backed { url } — BEFORE photo
  afterImage: null,        // blob-backed { url } — AFTER photo
  spotLogo: null,          // blob-backed { url } — optional watermark logo

  // ── Tier 2 · VIDEO SPOTLIGHT (1080×1920, baked via SovereignFoundry) ──
  spotVideo: null,         // blob-backed { url } — the PR/live-feed clip (background)
  statNumber: '688',       // the hero number (weight / reps / distance) — blank hides it
  statUnit: 'LB',          // unit beside the number (LB, KG, MI, SEC, …)
  statLift: 'DEADLIFT',    // the lift / event name under the number
  prBadge: true,           // show the gold "NEW PR 🏆" pill
  repLine: '',             // secondary context line (e.g. "3×3 @ RPE 9", "2.4× bodyweight")
  statPos: 24,             // stat block vertical position, % of frame height (top-anchored)
};
