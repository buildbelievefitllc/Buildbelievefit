// src/components/command/commandInboxData.js
// ─────────────────────────────────────────────────────────────────────────────
// Static agentic card decks for the domain-aware Action Inbox (CONTENT + KNOWLEDGE
// domains). The COACHING domain stays server-driven (bbf-agent-brain sentinel
// inbox); these two decks are the founder's curated agentic playbook — insight
// cards with one-tap triggers, rendered client-side. Admin-only surface, so copy
// is inline English (parity with the existing ActionInbox cards).
//
// KNOWLEDGE readiness is BUILT dynamically (buildReadinessCard) from the admin's
// live somatic-readiness score; the language + coach-lab cards are curated here.

// ── CONTENT · Platform Growth + Content Strategy ─────────────────────────────
// Each card: { id, tone, tag, title, insight, detail, chips? }.
//   tone → left-accent color variant (growth = platform-tinted, strategy = gold).
export const CONTENT_INSIGHTS = [
  {
    id: 'growth-ig',
    tone: 'ig',
    tag: '📸 Instagram · Growth',
    title: 'Front-load the payoff',
    insight: 'Reels that open on the RESULT (the transformation, the number, the flex) hold the 3-second retention IG rewards — your setup-first hooks leak 40% before the value lands.',
    detail: 'Recut your top 3 reels to lead with the outcome frame, then reveal the how. Keep the first line of on-screen text under 6 words, high-contrast, upper-third.',
    chips: ['0.8s hook', '3s retention', 'result-first'],
  },
  {
    id: 'growth-tiktok',
    tone: 'tiktok',
    tag: '🎵 TikTok · Growth',
    title: 'Native audio + 2s pattern-interrupt',
    insight: 'TikTok completion rate climbs when a trending native audio rides under the clip and a caption pattern-interrupt hits at ~2s. West-Valley audience peaks 6–9pm MST.',
    detail: 'Pair each drop with 1 trending fitness audio (not an uploaded track), add a “wait for it” caption beat at 2s, and schedule the post into the 6–9pm MST window.',
    chips: ['native audio', '2s interrupt', '6–9pm MST'],
  },
  {
    id: 'growth-fb',
    tone: 'fb',
    tag: '📘 Facebook · Growth',
    title: 'Watch-time + comment-bait',
    insight: 'FB Page video favors longer watch-time and rewards a comment-bait question in the caption. Cross-posting reels as FB Stories adds a 24h reach surface you are not using.',
    detail: 'End each Page video on an open question (“Which one are you starting Monday?”), and mirror the vertical reel into a Facebook Story via Studio V4’s new Story dispatch.',
    chips: ['watch-time', 'comment-bait', 'FB Stories'],
  },
  {
    id: 'strategy-hashtags',
    tone: 'strategy',
    tag: '🏷️ Strategy · Hashtag Clusters',
    title: 'High-converting cluster stack',
    insight: 'Rotate three tiered clusters instead of one flat block: hyper-local reach, niche intent, and brand. The local cluster is your unfair advantage in the West Valley.',
    detail: 'Stack 3–4 tags per tier, cap at ~12 total, and swap the niche tier weekly to dodge shadow-staleness.',
    chips: ['#BuildBelieveFit', '#WestValleyAZ', '#IntermittentFasting', '#HypertrophyCoach', '#JointHealth', '#BuckeyeAZ'],
  },
  {
    id: 'strategy-audio-hooks',
    tone: 'strategy',
    tag: '🎧 Strategy · Audio + Hook Angles',
    title: 'BGM pairing + hook angles',
    insight: 'Match the BGM energy to the vibe, and lead with a proven hook angle. Sanctuary/recovery content wants a calm bed; Mechanic/strength cues want driving percussion.',
    detail: 'This week’s highest-converting hook angles to draft: the myth-bust, the “I was wrong about…”, and the 30-day receipt.',
    chips: ['myth-bust', '“I was wrong about…”', '30-day receipt', 'calm bed = recovery', 'driving = strength'],
  },
];

// ── KNOWLEDGE · Founder Assistant ────────────────────────────────────────────
// The recovery itinerary links to REAL Coach's Cave films (id === youtubeId). The
// Cave is a sport-PSYCHOLOGY library, so the reset targets nervous-system / mental
// down-regulation (mental-fatigue + flow-state decks) — the recovery-adjacent clips
// the Cave actually holds. Each film carries its deck so the launcher can jump the
// Cave straight to it (localStorage `bbf.cave.jump`).
export const RECOVERY_FILMS = [
  { deck: 'resistance-fatigue', id: 'yxGupoarfII', title: 'What is Mental Fatigue and How to Fix It' },
  { deck: 'resistance-fatigue', id: 'GT8qV326V-8', title: 'The Neuroscience of Exhaustion' },
  { deck: 'mind-muscle-flow', id: 'znwUCNrjpD4', title: "How to enter ‘flow state’ on command" },
];

// readinessScore is 1–10; the founder's brief speaks in %. <85% (score < 8.5) trips
// the recovery itinerary. band 'idle' / null score = no check-in logged today.
export function readinessPct(readinessScore) {
  return readinessScore == null ? null : Math.round(Number(readinessScore) * 10);
}

// Build the KNOWLEDGE deck from the admin's live readiness + roster size. Returns
// card objects the drawer renders (variant drives layout + the primary trigger).
export function buildKnowledgeDeck({ readinessScore = null, band = 'idle', rosterCount = 0 } = {}) {
  const pct = readinessPct(readinessScore);
  const logged = band !== 'idle' && pct != null;
  const low = logged && pct < 85;

  const readiness = low
    ? {
        id: 'kn-readiness',
        variant: 'readiness',
        tone: 'auto',
        tag: '🧠 Somatic Readiness',
        title: `Readiness ${pct}% — recovery protocol`,
        insight: `Your somatic readiness is ${pct}% (below the 85% line). Down-regulate the CNS before you coach or train — a low-arousal reset restores decision quality and drops injury risk.`,
        detail: 'Auto-curated reset from Coach’s Cave — tap a film to open it straight in the Cave:',
        films: RECOVERY_FILMS,
      }
    : {
        id: 'kn-readiness',
        variant: 'readiness',
        tone: 'auto',
        tag: '🧠 Somatic Readiness',
        title: logged ? `Readiness ${pct}% — primed` : 'Readiness — not logged today',
        insight: logged
          ? `You’re at ${pct}% — above the 85% line. No recovery itinerary needed. Bank a Coach’s Cave film if you want to sharpen focus before sessions.`
          : 'No Sovereign Readiness check-in logged today. Run the morning check-in in the Vault to unlock an auto-curated recovery itinerary — or bank a Cave reset proactively.',
        films: RECOVERY_FILMS.slice(0, 1),
      };

  const language = {
    id: 'kn-language',
    variant: 'language',
    tone: 'lang',
    tag: '🌐 Language Lab',
    title: 'Daily language rep (ES / PT)',
    insight: 'Keep your Spanish + Portuguese coaching cues sharp. Today’s 10-minute module: Vocab Forge (training-floor imperatives) → one Echo Chamber shadowing set.',
    detail: 'Consistency compounds — a daily rep keeps you fluent enough to coach a trilingual floor without hesitation.',
  };

  const coachLab = {
    id: 'kn-coachlab',
    variant: 'coachlab',
    tone: 'lab',
    tag: '🔬 Coach Lab Briefing',
    title: 'Prehab + clinical rotation',
    insight: 'This week’s prehab focus: lumbar bracing + shoulder external-rotation. Review the Biomechanics prehab map and the latest Research Vault module before Monday’s sessions.',
    detail: rosterCount > 0
      ? `Coverage check: ${rosterCount} active athlete${rosterCount === 1 ? '' : 's'} on the roster — confirm each flagged joint has a prehab movement assigned.`
      : 'Confirm each flagged joint across the roster has a prehab movement assigned.',
  };

  return [readiness, language, coachLab];
}

