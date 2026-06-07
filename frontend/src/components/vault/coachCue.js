// src/components/vault/coachCue.js
// ─────────────────────────────────────────────────────────────────────────────
// Pure composer for the AI Voice Coach's spoken session briefing. Trilingual
// (EN / ES / PT) — BBF i18n is STRUCTURAL, not optional — and derived from the
// athlete's OWN program so the coach speaks the real session, not a canned line.
// Output is plain prose (never markdown/JSON), capped well under the TTS limit;
// ElevenLabs' multilingual model voices whichever language string we send.

const COPY = {
  en: { greet: 'Welcome back to the Vault', focusFallback: 'your training protocol', close: 'Breathe, brace, and own every rep. Let’s build.' },
  es: { greet: 'Bienvenido de nuevo a la Bóveda', focusFallback: 'tu protocolo de entrenamiento', close: 'Respira, activa el core y domina cada repetición. A construir.' },
  pt: { greet: 'Bem-vindo de volta ao Cofre', focusFallback: 'seu protocolo de treino', close: 'Respire, contraia o core e domine cada repetição. Vamos construir.' },
};

function streakLine(lang, streak) {
  if (!streak || streak < 1) return '';
  if (lang === 'es') return `Llevas una racha de ${streak} ${streak === 1 ? 'día' : 'días'} — protégela.`;
  if (lang === 'pt') return `Você está numa sequência de ${streak} ${streak === 1 ? 'dia' : 'dias'} — proteja-a.`;
  return `You’re on a ${streak}-day streak — protect it.`;
}

function focusLine(lang, focus, copy) {
  const f = String(focus || '').trim() || copy.focusFallback;
  if (lang === 'es') return `La sesión de hoy: ${f}.`;
  if (lang === 'pt') return `A sessão de hoje: ${f}.`;
  return `Today’s session: ${f}.`;
}

function movesLine(lang, exercises) {
  const list = (Array.isArray(exercises) ? exercises : [])
    .map((e) => (e && typeof e === 'object' ? e.name : e))
    .map((n) => String(n || '').trim())
    .filter(Boolean);
  const n = list.length;
  if (!n) return '';
  const named = list.slice(0, 3).join(', ');
  if (lang === 'es') return `Hoy trabajamos ${n} ${n === 1 ? 'movimiento' : 'movimientos'}: ${named}.`;
  if (lang === 'pt') return `Hoje fazemos ${n} ${n === 1 ? 'movimento' : 'movimentos'}: ${named}.`;
  return `We’re moving through ${n} ${n === 1 ? 'exercise' : 'exercises'}: ${named}.`;
}

// Pick the lead training day from a parsed dynamic plan (skip pure rest days);
// fall back to the first entry so the cue always has a focus to speak.
function leadDay(plan) {
  if (!Array.isArray(plan) || !plan.length) return null;
  return plan.find((d) => d && Array.isArray(d.exercises) && d.exercises.length) || plan[0] || null;
}

// Build the spoken briefing. `plan` is parseWorkoutPlan() output (or null), `profile`
// the vault profile (for the streak), `lang` one of en|es|pt.
export function buildCoachCue({ plan, profile, lang = 'en' } = {}) {
  const copy = COPY[lang] || COPY.en;
  const day = leadDay(plan);
  const focus = day?.focus || day?.day || '';
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];

  const cue = [
    `${copy.greet}.`,
    streakLine(lang, profile?.currentStreak),
    focusLine(lang, focus, copy),
    movesLine(lang, exercises),
    copy.close,
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  // Defensive cap well under the edge function's 2500-char ceiling.
  return cue.length > 1200 ? `${cue.slice(0, 1199)}…` : cue;
}
