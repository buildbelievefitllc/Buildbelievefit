// scripts/build-audio-dojo-cues.mjs
// ═══════════════════════════════════════════════════════════════════════════
// Audio Dojo curriculum — cue-table builder (no API, no network).
// ───────────────────────────────────────────────────────────────────────────
// Reads frontend/src/data/audioDojoCurriculum.json (languages.portuguese[] /
// .spanish[], each 10 lessons of {vocabulary, challenges[]}) and enumerates
// every distinct audio fragment the Pimsleur-style recall loop needs per
// challenge: English prompt (narrator) -> native target -> back-chaining
// breakdown (or, when a challenge ships none, the target is simply replayed —
// no separate clip baked for that, see AudioDojo.jsx's lessonFragments()).
//
// Fragment keys are DETERMINISTIC from each challenge's own stable challenge_id
// (e.g. "PT_L1_C1") — DOJO-<challenge_id>-PROMPT / -TARGET / -BC<i> — so
// AudioDojo.jsx derives the identical key with no shared manifest.
//
// Voice assignment: one fixed narrator (English) for every prompt; the native
// speaker alternates female/male BY LESSON NUMBER PARITY per language, so a
// full 10-lesson arc uses both a genuine native female and male voice.
//
// Run: node scripts/build-audio-dojo-cues.mjs
// Emits: scripts/audio-dojo-cues.json — the flat {key, lang, text, voice_id,
// speaker_role}[] the baker driver feeds to bbf-bake-language-soundboard.
// ═══════════════════════════════════════════════════════════════════════════

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const curriculum = JSON.parse(fs.readFileSync(path.join(ROOT, 'frontend/src/data/audioDojoCurriculum.json'), 'utf8'));

// ElevenLabs voice roster — see supabase/functions/bbf-bake-language-soundboard
// (?list_voices=1). Two are genuinely native (pt_female, es_female); the male
// slots + narrator reuse clean premade English voices via eleven_multilingual_v2.
const VOICE_IDS = {
  narrator:  'Xb7hH8MSUJpSbSDYk0k2', // Alice — clear, engaging educator (EN)
  pt_female: 'ORgG8rwdAiMYRug8RJwR', // Ana Alice — native Brazilian Portuguese
  pt_male:   'iP95p4xoKVk53GoZ742B', // Chris — natural, down-to-earth (EN, multilingual)
  es_female: 'm7yTemJqdIqrcNleANfX', // Ana María — native Mexican Spanish
  es_male:   'cjVigY5qzO86Huf0OWal', // Eric — smooth, trustworthy (EN, multilingual)
};

const LANG_KEY = { portuguese: 'pt', spanish: 'es' };

const cues = new Map(); // key -> {key, lang, text, voice_id, speaker_role}
function add(key, lang, text, voiceId, speakerRole) {
  const clean = String(text ?? '').trim();
  if (!clean) return;
  if (cues.has(key)) return; // challenge_ids are unique by construction — guard anyway
  cues.set(key, { key, lang, text: clean, voice_id: voiceId, speaker_role: speakerRole });
}

for (const [langName, langCode] of Object.entries(LANG_KEY)) {
  const lessons = curriculum.languages[langName] || [];
  for (const lesson of lessons) {
    const gender = lesson.lesson_number % 2 === 1 ? 'female' : 'male';
    const nativeRole = `${langCode}_${gender}`;
    const nativeVoiceId = VOICE_IDS[nativeRole];

    for (const c of lesson.challenges) {
      add(`DOJO-${c.challenge_id}-PROMPT`, 'en', c.prompt_english, VOICE_IDS.narrator, 'narrator');
      add(`DOJO-${c.challenge_id}-TARGET`, langCode, c.native_target, nativeVoiceId, nativeRole);
      const bc = Array.isArray(c.back_chaining) ? c.back_chaining : [];
      bc.forEach((text, i) => add(`DOJO-${c.challenge_id}-BC${i}`, langCode, text, nativeVoiceId, nativeRole));
    }
  }
}

const list = Array.from(cues.values());
const totalChars = list.reduce((n, c) => n + c.text.length, 0);
fs.writeFileSync(path.join(__dirname, 'audio-dojo-cues.json'), JSON.stringify(list, null, 2));
console.log(`✓ ${list.length} distinct cues · ${totalChars} characters → scripts/audio-dojo-cues.json`);
