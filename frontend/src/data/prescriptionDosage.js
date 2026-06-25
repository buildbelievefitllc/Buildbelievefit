// src/data/prescriptionDosage.js
// ─────────────────────────────────────────────────────────────────────────────
// Recovery-appropriate dosage + a spoken coaching cue for each prescribed clinical
// movement. The clinical_exercises library carries NO reps/sets/duration, so we
// infer a sensible, conservative recovery dose from the movement's name + type
// (holds → seconds, mobility/strength → reps, breathing → minutes). These are
// gentle recovery targets, not maxes — editable here in one place. Trilingual.
//
// Shapes: 'mins' (breathwork) · 'hold' / 'holdEach' (stretches & isometrics) ·
//         'reps' / 'repsEach' (mobility & strengthening).

function classify(ex) {
  const name = String(ex?.name || '').toLowerCase();
  const type = ex?.type || ex?.kind || '';
  if (type === 'mental_wellness') return { shape: 'mins', a: 3, b: 5 };

  const unilateral = /(side-lying|single|unilateral|each|clamshell|fire hydrant|sleeper|cross-body|levator|scalene|it band|piriformis|hip flexor|thread the needle|open book|quad stretch|hamstring stretch|pendulum)/.test(name);
  const isHold = /(hold|isometric|plank|wall sit|hang|brace|chin tuck)/.test(name);
  const isStretch = type === 'recovery' || /(stretch|fold|pose|opener|reach|release|decompress|mobiliz|cat-cow|cobra|press-up)/.test(name);

  if (isHold || isStretch) return { shape: unilateral ? 'holdEach' : 'hold', sec: 30, sets: 2 };

  const REPS = { strengthening: [10, 12, 2], prehab: [10, 0, 2], mobility: [8, 10, 2], recovery: [8, 10, 1] };
  const [a, b, sets] = REPS[type] || [10, 12, 2];
  return { shape: unilateral ? 'repsEach' : 'reps', a, b, sets };
}

const FMT = {
  en: {
    mins: (a, b) => `${a}–${b} min`,
    hold: (s, n) => `Hold ${s}s · ${n} sets`,
    holdEach: (s) => `Hold ${s}s · each side`,
    reps: (a, b, n) => `${a}${b ? `–${b}` : ''} reps · ${n} ${n > 1 ? 'sets' : 'set'}`,
    repsEach: (a, b) => `${a}${b ? `–${b}` : ''} reps · each side`,
  },
  es: {
    mins: (a, b) => `${a}–${b} min`,
    hold: (s, n) => `Mantén ${s}s · ${n} series`,
    holdEach: (s) => `Mantén ${s}s · cada lado`,
    reps: (a, b, n) => `${a}${b ? `–${b}` : ''} reps · ${n} ${n > 1 ? 'series' : 'serie'}`,
    repsEach: (a, b) => `${a}${b ? `–${b}` : ''} reps · cada lado`,
  },
  pt: {
    mins: (a, b) => `${a}–${b} min`,
    hold: (s, n) => `Segure ${s}s · ${n} séries`,
    holdEach: (s) => `Segure ${s}s · cada lado`,
    reps: (a, b, n) => `${a}${b ? `–${b}` : ''} reps · ${n} ${n > 1 ? 'séries' : 'série'}`,
    repsEach: (a, b) => `${a}${b ? `–${b}` : ''} reps · cada lado`,
  },
};

// Short dosage chip, e.g. "Hold 30s · 2 sets" / "10–12 reps · 2 sets".
export function resolveDosage(ex, lang = 'en') {
  const c = classify(ex);
  const f = FMT[lang] || FMT.en;
  if (c.shape === 'mins') return f.mins(c.a, c.b);
  if (c.shape === 'hold') return f.hold(c.sec, c.sets);
  if (c.shape === 'holdEach') return f.holdEach(c.sec);
  if (c.shape === 'repsEach') return f.repsEach(c.a, c.b);
  return f.reps(c.a, c.b, c.sets);
}

const CUE = {
  en: { hold: 'Ease into the position, breathe slow, and hold without forcing it.', reps: 'Move with control — own every rep and keep your core braced.', mins: 'Settle in, soften your shoulders, and let the breath lead.' },
  es: { hold: 'Entra despacio, respira lento y mantén sin forzar.', reps: 'Muévete con control — domina cada repetición y activa el core.', mins: 'Acomódate, relaja los hombros y deja que la respiración guíe.' },
  pt: { hold: 'Entre devagar, respire lento e segure sem forçar.', reps: 'Mova com controle — domine cada repetição e trave o core.', mins: 'Acomode-se, relaxe os ombros e deixe a respiração conduzir.' },
};

// Natural spoken cue for the ElevenLabs coach button (locale-rendered server-side):
// "<name>. <dose>. <form line>." Falls back to EN copy for an unknown language.
export function coachCueText(ex, lang = 'en') {
  const c = classify(ex);
  const cue = (CUE[lang] || CUE.en)[c.shape === 'mins' ? 'mins' : (c.shape === 'hold' || c.shape === 'holdEach') ? 'hold' : 'reps'];
  return [String(ex?.name || '').trim(), resolveDosage(ex, lang), cue].filter(Boolean).join('. ');
}
