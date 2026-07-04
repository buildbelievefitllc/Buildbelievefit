// scripts/build-language-soundboard-cues.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Language Mastery soundboard — cue-table builder (no API, no network).
// ───────────────────────────────────────────────────────────────────────────
// Enumerates every distinct (lang, text) string the soundboard can ever speak —
// Vocab Gym, Rio Ready, Sentence Builder, Voice Studio, Immersion Lab (from
// scripts/language-soundboard-content.json, a hand-synced snapshot of the
// AdminLanguageRoadmap.jsx content arrays) and the Pimsleur Audio Lab dialogue +
// vocabulary preview (read directly from frontend/src/data/pimsleurAudioCurriculum.json).
//
// The fragment_key is a content hash — RDMP-<sha256(lang|text).slice(0,20)> — not a
// positional slug, so the SAME function (languageSoundboardVoice.js's staticKeyFor)
// run client-side derives the identical key with no shared manifest to keep in sync,
// and two call sites that happen to speak identical text automatically share one clip.
//
// Run: node scripts/build-language-soundboard-cues.mjs
// Emits: scripts/language-soundboard-cues.json — the flat {key, lang, text}[] the
// baker driver feeds to bbf-bake-language-soundboard.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const roadmap = JSON.parse(fs.readFileSync(path.join(__dirname, 'language-soundboard-content.json'), 'utf8'));
const curriculum = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/data/pimsleurAudioCurriculum.json'), 'utf8'));

function keyFor(lang, text) {
  const clean = String(text ?? '').trim();
  const hash = crypto.createHash('sha256').update(`${lang}|${clean}`).digest('hex');
  return `RDMP-${hash.slice(0, 20)}`;
}

const cues = new Map(); // key -> {key, lang, text}
function add(lang, text) {
  const clean = String(text ?? '').trim();
  if (!clean) return;
  const key = keyFor(lang, clean);
  if (!cues.has(key)) cues.set(key, { key, lang, text: clean });
}

// 1. Vocab Gym — the es term only (the en meaning is never spoken).
for (const terms of Object.values(roadmap.vocabData)) {
  for (const t of terms) add('es', t.es);
}

// 2. Sentence Builder scripts — es lines (a runtime filter speaks only a subset;
// baking the full set is harmless and guarantees no line ever falls through live).
for (const script of roadmap.scripts) {
  for (const line of script.lines) add('es', line.es);
}

// 3. Rio Ready phrase soundboard — pt phrases.
for (const p of roadmap.ptPhrases) add('pt', p.pt);

// 4. Voice Studio intentions — both languages.
for (const i of roadmap.intentions) { add('es', i.es); add('pt', i.pt); }

// 5. Immersion Lab — Cultural Context: the partner line + the target answer
// (alts are never spoken, only used for text-match scoring).
for (const sc of roadmap.CULTURAL_SCENARIOS) {
  for (const turn of sc.turns) { add(sc.lang, turn.text); add(sc.lang, turn.expected); }
}

// 6. Immersion Lab — Conversation Engine: opener + every possible response +
// every fallback line (any of these can be spoken at runtime).
for (const conv of roadmap.CONVERSATIONS) {
  add(conv.lang, conv.opener);
  for (const intent of conv.intents) for (const r of intent.responses) add(conv.lang, r);
  for (const f of conv.fallback) add(conv.lang, f);
}

// 7. Pimsleur Audio Lab — vocabulary preview button (pt term only).
for (const lesson of curriculum.lessons) {
  for (const v of lesson.vocabulary) add('pt', v.portuguese);
}

// 8. Pimsleur Audio Lab — dialogue_flow (narrator = en, both native speakers = pt).
for (const lesson of curriculum.lessons) {
  for (const entry of lesson.dialogue_flow) {
    if (entry.speaker === 'silent_pause') continue;
    add(entry.speaker === 'narrator' ? 'en' : 'pt', entry.text);
  }
}

const list = Array.from(cues.values());
const totalChars = list.reduce((n, c) => n + c.text.length, 0);
fs.writeFileSync(path.join(__dirname, 'language-soundboard-cues.json'), JSON.stringify(list, null, 2));
console.log(`✓ ${list.length} distinct cues · ${totalChars} characters → scripts/language-soundboard-cues.json`);
