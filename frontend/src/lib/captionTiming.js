// src/lib/captionTiming.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared karaoke-caption timing — the SINGLE source of truth for "which phrase is
// on screen, and which word is lit, at voice-time t". Imported by BOTH the live
// preview (ReelPreviewEngine) and the export baker (SovereignFoundry) so the
// downloaded MP4's captions are frame-for-frame identical to what the editor
// showed. Pure (no DOM / React) → unit-testable under bare node.
//
// `words` is the transcript: [{ text, start, end }] in seconds. Words are grouped
// into short phrases (CAP_CHUNK words) — a phrase shows while its words are being
// spoken, and the current word stays lit through the tiny gaps between words so
// the highlight never flickers.

export const CAP_CHUNK = 4; // words shown at once (a short 1–2 line phrase)

export function captionState(words, t) {
  if (!Array.isArray(words) || !words.length) return null;
  const first = words[0], last = words[words.length - 1];
  // Nothing until the voice is about to start; clear it shortly after it ends.
  if (t < first.start - 0.3 || t > last.end + 1) return null;
  // The current (or most-recently-spoken) word index.
  let idx = 0;
  for (let i = 0; i < words.length; i++) { if (words[i].start <= t) idx = i; else break; }
  const chunkStart = Math.floor(idx / CAP_CHUNK) * CAP_CHUNK;
  return { chunk: words.slice(chunkStart, chunkStart + CAP_CHUNK), active: idx - chunkStart };
}
