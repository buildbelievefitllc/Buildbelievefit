// src/lib/hyperframe.js
// ─────────────────────────────────────────────────────────────────────────────
// KINETIC HYPERFRAME — shared, deterministic core for the Studio V4 native text-reel
// engine. The SINGLE source of truth for the brand background palette, the hook →
// kinetic-card segmentation, and "which card is on screen at voice-time t", imported
// by BOTH the live preview (ReelPreviewEngine) and the export baker (SovereignFoundry)
// so the downloaded MP4 is frame-for-frame identical to the editor.
//
// CALCULATOR-OFF-LLM (CLAUDE.md §4/§8): every number here — palette resolution,
// phrase indices, word grouping — is computed by this native module. The AI layer
// only ever supplies raw copy (the hook) and the voiceover word-timings; it never
// decides layout, timing, or color. Pure (no DOM / React) → unit-testable in node.
//
// The kinetic words ARE the voiceover script: the Creative Wizard voices the hook
// verbatim, so ElevenLabs' per-word timings (captions.words) drive the highlight of
// the exact words on screen. That reuses the karaoke caption timing wholesale
// (captionState) — the hyperframe is that system promoted to the hero visual.
// ─────────────────────────────────────────────────────────────────────────────

// LOCKED brand identity (CLAUDE.md §2). Matte black is an approved SURFACE only,
// which is exactly how the 'ink' card uses it — never as a brand mark or CTA.
const BBF_PURPLE = '#6a0dad';
const BBF_GOLD = '#f5c800';
const BBF_INK = '#090909';
const WHITE = '#f9f5ff';

// Background styles offered in the Video Engine's Hyperframe picker. `id` is the
// persisted reelData.hyperframeBg value; `label` is the button copy.
export const HYPERFRAME_STYLES = [
  { id: 'alt', label: 'Purple ⇄ Gold' },
  { id: 'purple', label: 'Purple' },
  { id: 'gold', label: 'Gold' },
  { id: 'ink', label: 'Matte Ink' },
];
const STYLE_IDS = new Set(HYPERFRAME_STYLES.map((s) => s.id));

export const DEFAULT_HYPERFRAME_BG = 'alt';

// Resolve the concrete palette for a card. `phraseIndex` only matters for 'alt',
// which flips purple↔gold every card so the reel reads as the high-tempo Instagram
// text-reel format. Returns canvas-ready hex plus a `card` gradient pair the preview
// paints as a CSS background. `text` = base word fill, `accent` = active-word box,
// `on` = text color that sits legibly ON the accent box.
export function hyperframeColors(style, phraseIndex = 0) {
  const s = STYLE_IDS.has(style) ? style : DEFAULT_HYPERFRAME_BG;
  const purple = { bg: BBF_PURPLE, bg2: '#4a0980', text: WHITE, accent: BBF_GOLD, on: BBF_INK };
  const gold = { bg: BBF_GOLD, bg2: '#d9b200', text: BBF_INK, accent: BBF_PURPLE, on: WHITE };
  const ink = { bg: BBF_INK, bg2: '#17101f', text: WHITE, accent: BBF_GOLD, on: BBF_INK };
  if (s === 'purple') return purple;
  if (s === 'gold') return gold;
  if (s === 'ink') return ink;
  // 'alt' — even cards purple, odd cards gold.
  return (Math.abs(Math.round(phraseIndex)) % 2 === 0) ? purple : gold;
}

// Deterministic hook → kinetic cards. Splits on the operator's own line breaks
// first (they authored the beats), then on sentence punctuation, then packs loose
// words into ~maxWords cards so nothing runs long. Drives the pre-voiceover static
// preview and the Wizard's card breakdown. Never throws — bad input → [].
export function hyperframeSegments(text, maxWords = 4) {
  const raw = String(text || '').replace(/\r/g, '').trim();
  if (!raw) return [];
  const cap = Math.max(2, Math.min(6, Math.round(Number(maxWords) || 4)));
  const beats = [];
  for (const line of raw.split('\n')) {
    // Sentence-ish fragments within a line keep their own card.
    for (const frag of line.split(/(?<=[.!?…])\s+/)) {
      const words = frag.trim().split(/\s+/).filter(Boolean);
      for (let i = 0; i < words.length; i += cap) {
        const card = words.slice(i, i + cap).join(' ').trim();
        if (card) beats.push(card);
      }
    }
  }
  return beats;
}

// Which card index is live at voice-time t, given the caption word list and the
// words-per-card. Mirrors captionState's chunking exactly (floor(idx/size)), so the
// 'alt' background flips in lock-step with the phrase the karaoke engine shows.
// Returns -1 before the voice starts / after it ends (caller paints card 0 idle).
export function phraseIndexAt(words, t, chunkSize = 4) {
  if (!Array.isArray(words) || !words.length) return -1;
  const size = Math.max(2, Math.min(6, Math.round(Number(chunkSize) || 4)));
  const first = words[0], last = words[words.length - 1];
  if (t < first.start - 0.3 || t > last.end + 1) return -1;
  let idx = 0;
  for (let i = 0; i < words.length; i++) { if (words[i].start <= t) idx = i; else break; }
  return Math.floor(idx / size);
}

// A concise CTA line derived from the hook — deterministic, no AI. Takes the last
// punchy fragment (the "payoff" line creators end on) and uppercases it, capped so
// it never overflows the footer chip. Falls back to a brand-safe default.
export function hyperframeCta(text) {
  const beats = hyperframeSegments(text, 6);
  const tail = beats.length ? beats[beats.length - 1] : '';
  const cta = tail.replace(/[.!?…]+$/, '').trim().toUpperCase();
  return cta && cta.length <= 24 ? cta : 'START TODAY';
}
