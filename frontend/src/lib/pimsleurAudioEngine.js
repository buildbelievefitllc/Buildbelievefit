// src/lib/pimsleurAudioEngine.js
// ─────────────────────────────────────────────────────────────────────────────
// Turns pimsleurAudioCurriculum.json into a flat, playable dialogue script per
// lesson. Lesson 1 ships a fully hand-authored dialogue_flow — used verbatim.
// Every other lesson only ships objectives/vocabulary, so this module generates
// a script that follows the same three principles the curriculum declares
// (methodology.principles): Graduated Interval Recall (pulling review terms
// forward from earlier lessons), the Principle of Anticipation (a pause before
// every native-speaker confirmation), and Back-Chaining (deconstructing a phrase
// from its last word forward). Pure data-in/data-out — no TTS, no network.

// A lesson's shipped dialogue_flow is treated as "authored" (used as-is) only if
// it's long enough to actually drill every vocabulary item; a short/partial stub
// (as lesson 2's raw JSON originally was) is replaced by a generated one instead
// of teaching only part of the lesson's vocabulary.
const MIN_ENTRIES_PER_ITEM = 6;

function splitWords(phrase) {
  return String(phrase || '').trim().split(/\s+/).filter(Boolean);
}

// Back-chain a Portuguese phrase: isolate it growing from the LAST word forward
// ("nome" → "seu nome" → "o seu nome" → "Qual é o seu nome?"), the accent-contour
// drill lesson 1 demonstrates on "Bom dia" → "dia" → "bom" → "Bom dia."
function backChainChunks(phrase) {
  const w = splitWords(phrase);
  if (w.length <= 1) return [phrase];
  const chunks = [];
  for (let n = 1; n < w.length; n += 1) chunks.unshift(w.slice(w.length - n).join(' '));
  chunks.push(phrase);
  return chunks;
}

function pause(seconds) {
  return { speaker: 'silent_pause', duration_seconds: seconds };
}
function line(speaker, text) {
  return { speaker, text };
}

const LISTEN_INTROS = [
  'Listen only.',
  'Now, listen only.',
  "Here's the next phrase. Listen only.",
  'Listen carefully to the native speaker.',
  'One more — listen only.',
];

// One vocabulary item's full graduated-recall drill: listen → back-chain the
// pronunciation → anticipate (recall before hearing it again) → confirm.
function drillVocabItem(item, voiceKey, introText) {
  const flow = [line('narrator', introText), line(voiceKey, item.portuguese), pause(2)];
  const chunks = backChainChunks(item.portuguese);
  chunks.forEach((chunk, i) => {
    flow.push(line(voiceKey, chunk));
    flow.push(pause(i === chunks.length - 1 ? 2 : 3));
  });
  flow.push(line('narrator', `How do you say: ${item.english}?`));
  flow.push(pause(4));
  flow.push(line(voiceKey, item.portuguese));
  flow.push(pause(3));
  return flow;
}

// A short spaced-repetition callback to one earlier-lesson term — the
// Graduated Interval Recall pass across the whole 10-lesson arc.
function reviewCallback(item, voiceKey) {
  return [
    line('narrator', `Quick review — how do you say: ${item.english}?`),
    pause(4),
    line(voiceKey, item.portuguese),
    pause(3),
  ];
}

// Deterministic pick so the same lesson always reviews the same earlier term —
// stable, repeatable practice instead of a different pop quiz every replay.
function pickDeterministic(pool, seed) {
  if (!pool.length) return null;
  return pool[seed % pool.length];
}

export function generateDialogueFlow(lesson, priorLessons = []) {
  const vocabulary = lesson.vocabulary || [];
  const reviewPool = priorLessons.flatMap((l) => l.vocabulary || []);
  const flow = [line('narrator', `Lesson ${lesson.lesson_number}. ${lesson.description} Let's begin.`)];

  vocabulary.forEach((item, idx) => {
    const voiceKey = idx % 2 === 0 ? 'pt_native_male' : 'pt_native_female';
    flow.push(...drillVocabItem(item, voiceKey, LISTEN_INTROS[idx % LISTEN_INTROS.length]));
    if (reviewPool.length && idx > 0 && idx % 2 === 1) {
      const reviewItem = pickDeterministic(reviewPool, lesson.lesson_number * 31 + idx);
      const reviewVoice = voiceKey === 'pt_native_male' ? 'pt_native_female' : 'pt_native_male';
      flow.push(...reviewCallback(reviewItem, reviewVoice));
    }
  });

  flow.push(line('narrator', `That concludes Lesson ${lesson.lesson_number}. Great work — review these phrases before moving on.`));
  return flow;
}

// The dialogue_flow to actually play for a lesson: the authored script when it
// covers the full vocabulary list, otherwise a generated one built from the same
// principles. `priorLessons` (lessons before this one, in order) feeds the
// review pool for Graduated Interval Recall.
export function getLessonFlow(lesson, priorLessons = []) {
  const authored = Array.isArray(lesson.dialogue_flow) ? lesson.dialogue_flow : [];
  const vocabCount = (lesson.vocabulary || []).length;
  if (authored.length >= vocabCount * MIN_ENTRIES_PER_ITEM) return authored;
  return generateDialogueFlow(lesson, priorLessons);
}

// Speaker role → { lang, voiceGender } for speechFallback.speakWithBrowser.
export const SPEAKER_VOICE = {
  narrator: { lang: 'en', voiceGender: 'male' },
  pt_native_male: { lang: 'pt', voiceGender: 'male' },
  pt_native_female: { lang: 'pt', voiceGender: 'female' },
};

export const SPEAKER_LABEL = {
  narrator: 'Narrator',
  pt_native_male: 'Native Speaker (M)',
  pt_native_female: 'Native Speaker (F)',
  silent_pause: 'Your turn',
};
