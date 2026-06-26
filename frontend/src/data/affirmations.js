// src/data/affirmations.js
// ─────────────────────────────────────────────────────────────────────────────
// Daily Vault Affirmation library — pre-written, trilingual (EN/ES/PT). Spoken
// VERBATIM by the BBF Coach Akeem voice — ONE cloned voice for ALL locales (en/es/pt;
// multilingual_v2 voices ES/PT natively) — via the Universal Voice Coach
// (bbf-biokinetic-briefing · context='affirmation').
//
// Rotation: OPTION A (weekly) — one affirmation per ISO-style week, cycling
// through the library. Keeps it fresh without overwhelming, and keeps the TTS
// cache tiny (each line synthesizes once, ever, per locale — keyed by `aff:<id>`).

export const AFFIRMATIONS = [
  { id: 1,  en: 'Your discipline today builds your legacy tomorrow.',                   es: 'Tu disciplina hoy construye tu legado mañana.',                       pt: 'Sua disciplina hoje constrói seu legado amanhã.' },
  { id: 2,  en: 'You are stronger than your excuses.',                                   es: 'Eres más fuerte que tus excusas.',                                    pt: 'Você é mais forte que suas desculpas.' },
  { id: 3,  en: 'Progress over perfection. Show up every day.',                          es: 'Progreso sobre perfección. Preséntate cada día.',                     pt: 'Progresso sobre perfeição. Apareça todos os dias.' },
  { id: 4,  en: 'The body achieves what the mind believes.',                             es: 'El cuerpo logra lo que la mente cree.',                               pt: 'O corpo alcança aquilo em que a mente acredita.' },
  { id: 5,  en: 'One more rep. One more day. One percent better.',                       es: 'Una repetición más. Un día más. Un uno por ciento mejor.',            pt: 'Mais uma repetição. Mais um dia. Um por cento melhor.' },
  { id: 6,  en: 'Comfort is the enemy of growth. Choose the hard road.',                 es: 'La comodidad es enemiga del crecimiento. Elige el camino difícil.',   pt: 'O conforto é inimigo do crescimento. Escolha o caminho difícil.' },
  { id: 7,  en: 'You do not rise to your goals. You fall to your habits.',               es: 'No te elevas a tus metas. Caes al nivel de tus hábitos.',             pt: 'Você não sobe até suas metas. Você cai ao nível dos seus hábitos.' },
  { id: 8,  en: 'Discipline is the bridge between goals and results.',                    es: 'La disciplina es el puente entre las metas y los resultados.',         pt: 'A disciplina é a ponte entre as metas e os resultados.' },
  { id: 9,  en: 'Train so the person you are becoming is proud of you.',                 es: 'Entrena para que la persona en la que te conviertes esté orgullosa.', pt: 'Treine para que a pessoa que você está se tornando se orgulhe de você.' },
  { id: 10, en: 'Your only competition is who you were yesterday.',                      es: 'Tu única competencia es quien fuiste ayer.',                          pt: 'Sua única competição é quem você foi ontem.' },
  { id: 11, en: 'Pain is temporary. Quitting lasts forever.',                            es: 'El dolor es temporal. Rendirse dura para siempre.',                   pt: 'A dor é temporária. Desistir dura para sempre.' },
  { id: 12, en: 'Show up for yourself the way you show up for everyone else.',           es: 'Preséntate por ti como te presentas por los demás.',                  pt: 'Apareça por você como você aparece pelos outros.' },
  { id: 13, en: 'Strength is built in the reps no one sees.',                            es: 'La fuerza se construye en las repeticiones que nadie ve.',            pt: 'A força é construída nas repetições que ninguém vê.' },
  { id: 14, en: 'Believe it, build it, become it.',                                      es: 'Créelo, constrúyelo, conviértete en ello.',                           pt: 'Acredite, construa, torne-se.' },
];

const DAY_MS = 86400000;

// Whole weeks since the Unix epoch — a stable, timezone-light bucket for rotation.
function weekIndex(date = new Date()) {
  return Math.floor(Math.floor(date.getTime() / DAY_MS) / 7);
}

// This week's affirmation record (cycles through the library).
export function affirmationForToday(date = new Date()) {
  return AFFIRMATIONS[weekIndex(date) % AFFIRMATIONS.length];
}

// Stable per-week key for the "New" badge (compare against the last week the
// athlete viewed, persisted in localStorage by the component).
export function currentWeekKey(date = new Date()) {
  return `w${weekIndex(date)}`;
}

// The localized spoken/displayed line for a record, EN fallback.
export function affirmationText(aff, lang) {
  if (!aff) return '';
  return aff[lang] || aff.en || '';
}
