// src/components/language/funnelStrings.js
// ─────────────────────────────────────────────────────────────────────────────
// Shared, component-free config for the 5-Phase Skill Funnel — the trilingual
// drill chrome (FX_STR) and the ordered phase list (PHASES). Kept out of the
// component files so those stay component-only (Fast Refresh house rule, same
// reason LanguageLabContext isolates its non-component exports).

// Trilingual funnel + drill chrome (UI locale en/es/pt). The TARGET term (es/pt)
// is always data — never localized here.
export const FX_STR = {
  en: {
    phase: { vocabulary: 'Vocabulary', listening: 'Listening', reading: 'Reading', memory: 'Memory', writing: 'Writing' },
    listen: '🔊 Listen', slow: '🐌 Slow-mo', flip: 'Reveal', next: 'Next', check: 'Check',
    back: '‹ Categories', exit: '‹ Phases', pick: 'Which one?', pickMeaning: 'What does it mean?',
    typePrompt: 'Spell it in the target language…', matchAll: 'Match every pair',
    right: '✓ Correct', wrong: '✗ Not quite', answerWas: (t) => `Answer: ${t}`,
    progress: (i, n) => `${i} / ${n}`, done: 'Phase complete', score: (c, t) => `${c} / ${t} correct`,
    replay: 'Play again', moves: 'moves', tapReveal: 'Tap to flip',
    blind: 'Blind Mode', blindHint: 'Listen first — tap to reveal',
    speak: '🎤 Speak', speechListening: '🎙 Listening…', confidence: 'confidence', cadence: 'ch/s',
    speechUnsupported: 'Speech capture unavailable on this browser.', speechError: 'Mic capture failed — try again.',
  },
  es: {
    phase: { vocabulary: 'Vocabulario', listening: 'Escucha', reading: 'Lectura', memory: 'Memoria', writing: 'Escritura' },
    listen: '🔊 Escuchar', slow: '🐌 Cámara lenta', flip: 'Revelar', next: 'Siguiente', check: 'Comprobar',
    back: '‹ Categorías', exit: '‹ Fases', pick: '¿Cuál es?', pickMeaning: '¿Qué significa?',
    typePrompt: 'Escríbelo en el idioma objetivo…', matchAll: 'Empareja cada par',
    right: '✓ Correcto', wrong: '✗ Casi', answerWas: (t) => `Respuesta: ${t}`,
    progress: (i, n) => `${i} / ${n}`, done: 'Fase completa', score: (c, t) => `${c} / ${t} correctas`,
    replay: 'Jugar de nuevo', moves: 'jugadas', tapReveal: 'Toca para girar',
    blind: 'Modo Ciego', blindHint: 'Escucha primero — toca para revelar',
    speak: '🎤 Hablar', speechListening: '🎙 Escuchando…', confidence: 'confianza', cadence: 'car/s',
    speechUnsupported: 'Captura de voz no disponible en este navegador.', speechError: 'Fallo de micrófono — inténtalo de nuevo.',
  },
  pt: {
    phase: { vocabulary: 'Vocabulário', listening: 'Escuta', reading: 'Leitura', memory: 'Memória', writing: 'Escrita' },
    listen: '🔊 Ouvir', slow: '🐌 Câmera lenta', flip: 'Revelar', next: 'Próximo', check: 'Verificar',
    back: '‹ Categorias', exit: '‹ Fases', pick: 'Qual é?', pickMeaning: 'O que significa?',
    typePrompt: 'Escreva no idioma-alvo…', matchAll: 'Combine cada par',
    right: '✓ Correto', wrong: '✗ Quase', answerWas: (t) => `Resposta: ${t}`,
    progress: (i, n) => `${i} / ${n}`, done: 'Fase completa', score: (c, t) => `${c} / ${t} corretas`,
    replay: 'Jogar de novo', moves: 'jogadas', tapReveal: 'Toque para virar',
    blind: 'Modo Cego', blindHint: 'Ouça primeiro — toque para revelar',
    speak: '🎤 Falar', speechListening: '🎙 Ouvindo…', confidence: 'confiança', cadence: 'car/s',
    speechUnsupported: 'Captura de voz indisponível neste navegador.', speechError: 'Falha no microfone — tente de novo.',
  },
};

// The five phases, in funnel order (labels resolve from FX_STR.phase[key]).
export const PHASES = [
  { id: 'vocab', emoji: '📇', key: 'vocabulary' },
  { id: 'listen', emoji: '🔊', key: 'listening' },
  { id: 'read', emoji: '👁️', key: 'reading' },
  { id: 'memory', emoji: '🧠', key: 'memory' },
  { id: 'write', emoji: '📝', key: 'writing' },
];
