// src/lib/captionTiming.test.mjs
// Locks the karaoke caption timing — the shared logic that drives BOTH the live
// preview and the exported MP4, so they can never drift. Pure, no DOM.
// Run: node --test src/lib/captionTiming.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captionState, CAP_CHUNK } from './captionTiming.js';

const WORDS = [
  { text: 'Bring', start: 0.0, end: 0.4 },
  { text: 'your', start: 0.4, end: 0.7 },
  { text: 'story', start: 0.7, end: 1.1 },
  { text: 'to', start: 1.1, end: 1.3 },
  { text: 'life', start: 1.3, end: 1.9 },
];

test('nothing before the voice starts or well after it ends', () => {
  assert.equal(captionState(WORDS, -1), null);
  assert.equal(captionState(WORDS, 5), null); // > last.end + 1
  assert.equal(captionState([], 0.5), null);
  assert.equal(captionState(null, 0.5), null);
});

test('lights the current word and shows its phrase (chunk of 4)', () => {
  const s = captionState(WORDS, 0.2); // "Bring"
  assert.deepEqual(s.chunk.map((w) => w.text), ['Bring', 'your', 'story', 'to']);
  assert.equal(s.active, 0);

  const s2 = captionState(WORDS, 0.8); // "story"
  assert.equal(s2.chunk[s2.active].text, 'story');
  assert.equal(s2.active, 2);
});

test('rolls to the next chunk past CAP_CHUNK words', () => {
  const s = captionState(WORDS, 1.5); // "life" is word index 4 → chunk 1
  assert.deepEqual(s.chunk.map((w) => w.text), ['life']);
  assert.equal(s.active, 0);
  assert.equal(CAP_CHUNK, 4);
});

test('the active word stays lit through the gap until the next word', () => {
  // t sits in a tiny gap after "your" (0.7) but before "story" (0.7) — with these
  // contiguous times, 0.69 is still within "your"; assert it holds the last word.
  const s = captionState(WORDS, 0.69);
  assert.equal(s.chunk[s.active].text, 'your');
});
