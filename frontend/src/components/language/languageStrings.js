// src/components/language/languageStrings.js
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.2 — Language Mastery UI · trilingual chrome (Vocab Gym + Immersion).
//
// TWO languages are in play and MUST NOT be confused:
//   • the UI locale — en/es/pt — the language the CHROME renders in (buttons,
//     panel titles, "Flip Card", "Correct"). Resolved from preferred_locale via
//     useLang(). NOTHING here is hardcoded English.
//   • the TARGET language — es/pt — the language the athlete is STUDYING (the
//     vocab terms, the immersion roleplay). Passed as data, never localized away.
//
// The error-cluster taxonomy is the CLOSED §4.4 list from _shared/language-core.ts
// (ERROR_CLUSTERS) — the labels below localize those exact keys for the Grammar
// Correction panel; the keys themselves never change.

import { useLang } from '../../context/LangContext.jsx';

// Display name of the TARGET language, localized to the UI locale.
export const TARGET_LANG_LABEL = {
  en: { es: 'Spanish', pt: 'Portuguese' },
  es: { es: 'Español', pt: 'Portugués' },
  pt: { es: 'Espanhol', pt: 'Português' },
};

// The closed §4.4 error-cluster taxonomy → human labels per UI locale. Keys match
// ERROR_CLUSTERS exactly; an unknown key falls back to vocab_gap (as the core does).
export const CLUSTER_LABELS = {
  en: { ser_estar: 'Ser / Estar', gender_agreement: 'Gender agreement', verb_conjugation: 'Verb conjugation', preposition: 'Preposition', false_friend: 'False friend', word_order: 'Word order', vocab_gap: 'Vocabulary', register: 'Register', pronunciation: 'Pronunciation' },
  es: { ser_estar: 'Ser / Estar', gender_agreement: 'Concordancia de género', verb_conjugation: 'Conjugación verbal', preposition: 'Preposición', false_friend: 'Falso amigo', word_order: 'Orden de palabras', vocab_gap: 'Vocabulario', register: 'Registro', pronunciation: 'Pronunciación' },
  pt: { ser_estar: 'Ser / Estar', gender_agreement: 'Concordância de gênero', verb_conjugation: 'Conjugação verbal', preposition: 'Preposição', false_friend: 'Falso cognato', word_order: 'Ordem das palavras', vocab_gap: 'Vocabulário', register: 'Registro', pronunciation: 'Pronúncia' },
};

export const LANG_STR = {
  en: {
    // Vocab Gym
    gymKicker: 'Vocab Gym', gymTitle: 'Spaced Repetition',
    dueLabel: 'due', masteredLabel: 'mastered', totalLabel: 'terms',
    boxLabel: 'Box', boxOf: 'of', leitnerAria: (b) => `Leitner box ${b} of 5`,
    boxNames: { 1: 'Learning', 2: 'Seen', 3: 'Familiar', 4: 'Strong', 5: 'Mastered' },
    flip: 'Flip Card', recallPrompt: 'Did you recall it?',
    correct: 'I knew it', incorrect: 'I missed it', flag: 'Flag',
    flagged: 'Flagged for review', tapToFlip: 'Tap to reveal',
    injectedFrom: 'From immersion miss', priorityTag: 'Priority',
    emptyQueue: 'Queue clear — no terms due right now. Come back after your next session.',
    loadingQueue: 'Loading your queue…', queueError: 'Could not load the queue. Retry.',
    retry: 'Retry', progress: (i, n) => `${i} of ${n}`, sessionDone: 'Session complete',
    sessionDoneSub: 'You cleared every due term. The engine reschedules them automatically.',
    // Immersion
    immKicker: 'Immersion Simulator', immTitle: 'Live Roleplay',
    scenarioLabel: 'Scenario', targetLabel: 'Practicing',
    placeholder: 'Type your reply in the target language…', send: 'Send', sending: 'Sending…',
    grammarPanel: 'Grammar Correction', perfect: 'Perfect — no corrections.',
    fluencyLabel: 'Fluency', errorsLabel: 'Flagged', severityMajor: 'major', severityMinor: 'minor',
    injectedNote: (n) => `${n} term${n === 1 ? '' : 's'} added to your Vocab Gym.`,
    startHint: 'Say something to your conversation partner to begin.',
    engineOffline: 'The engine is offline for a moment. Try again.',
    locked: 'Immersion is a Command Center surface — unlock admin access to run it.',
    endSession: 'End session', you: 'You', partner: 'Partner',
  },
  es: {
    gymKicker: 'Gimnasio de Vocabulario', gymTitle: 'Repetición Espaciada',
    dueLabel: 'pendientes', masteredLabel: 'dominados', totalLabel: 'términos',
    boxLabel: 'Caja', boxOf: 'de', leitnerAria: (b) => `Caja Leitner ${b} de 5`,
    boxNames: { 1: 'Aprendiendo', 2: 'Visto', 3: 'Familiar', 4: 'Fuerte', 5: 'Dominado' },
    flip: 'Girar Tarjeta', recallPrompt: '¿Lo recordaste?',
    correct: 'Lo sabía', incorrect: 'Fallé', flag: 'Marcar',
    flagged: 'Marcado para repaso', tapToFlip: 'Toca para revelar',
    injectedFrom: 'De un error en inmersión', priorityTag: 'Prioridad',
    emptyQueue: 'Cola vacía — no hay términos pendientes ahora. Vuelve tras tu próxima sesión.',
    loadingQueue: 'Cargando tu cola…', queueError: 'No se pudo cargar la cola. Reintenta.',
    retry: 'Reintentar', progress: (i, n) => `${i} de ${n}`, sessionDone: 'Sesión completa',
    sessionDoneSub: 'Despejaste todos los términos pendientes. El motor los reprograma automáticamente.',
    immKicker: 'Simulador de Inmersión', immTitle: 'Juego de Rol en Vivo',
    scenarioLabel: 'Escenario', targetLabel: 'Practicando',
    placeholder: 'Escribe tu respuesta en el idioma objetivo…', send: 'Enviar', sending: 'Enviando…',
    grammarPanel: 'Corrección Gramatical', perfect: 'Perfecto — sin correcciones.',
    fluencyLabel: 'Fluidez', errorsLabel: 'Marcados', severityMajor: 'grave', severityMinor: 'leve',
    injectedNote: (n) => `${n} término${n === 1 ? '' : 's'} añadido${n === 1 ? '' : 's'} a tu Gimnasio de Vocabulario.`,
    startHint: 'Dile algo a tu interlocutor para comenzar.',
    engineOffline: 'El motor está fuera de línea un momento. Inténtalo de nuevo.',
    locked: 'La inmersión es una superficie del Centro de Comando — desbloquea el acceso de administrador para usarla.',
    endSession: 'Terminar sesión', you: 'Tú', partner: 'Interlocutor',
  },
  pt: {
    gymKicker: 'Academia de Vocabulário', gymTitle: 'Repetição Espaçada',
    dueLabel: 'pendentes', masteredLabel: 'dominados', totalLabel: 'termos',
    boxLabel: 'Caixa', boxOf: 'de', leitnerAria: (b) => `Caixa Leitner ${b} de 5`,
    boxNames: { 1: 'Aprendendo', 2: 'Visto', 3: 'Familiar', 4: 'Forte', 5: 'Dominado' },
    flip: 'Virar Cartão', recallPrompt: 'Você lembrou?',
    correct: 'Eu sabia', incorrect: 'Errei', flag: 'Sinalizar',
    flagged: 'Sinalizado para revisão', tapToFlip: 'Toque para revelar',
    injectedFrom: 'De um erro na imersão', priorityTag: 'Prioridade',
    emptyQueue: 'Fila vazia — nenhum termo pendente agora. Volte após sua próxima sessão.',
    loadingQueue: 'Carregando sua fila…', queueError: 'Não foi possível carregar a fila. Tente novamente.',
    retry: 'Tentar de novo', progress: (i, n) => `${i} de ${n}`, sessionDone: 'Sessão completa',
    sessionDoneSub: 'Você limpou todos os termos pendentes. O motor os reagenda automaticamente.',
    immKicker: 'Simulador de Imersão', immTitle: 'Roleplay ao Vivo',
    scenarioLabel: 'Cenário', targetLabel: 'Praticando',
    placeholder: 'Digite sua resposta no idioma-alvo…', send: 'Enviar', sending: 'Enviando…',
    grammarPanel: 'Correção Gramatical', perfect: 'Perfeito — sem correções.',
    fluencyLabel: 'Fluência', errorsLabel: 'Sinalizados', severityMajor: 'grave', severityMinor: 'leve',
    injectedNote: (n) => `${n} termo${n === 1 ? '' : 's'} adicionado${n === 1 ? '' : 's'} à sua Academia de Vocabulário.`,
    startHint: 'Diga algo ao seu interlocutor para começar.',
    engineOffline: 'O motor está offline por um momento. Tente novamente.',
    locked: 'A imersão é uma superfície do Centro de Comando — desbloqueie o acesso de administrador para usá-la.',
    endSession: 'Encerrar sessão', you: 'Você', partner: 'Interlocutor',
  },
};

// Resolve the active-UI-locale string table + cluster labels + target-lang labels.
export function useLangUiStr() {
  const { lang } = useLang();
  const ui = LANG_STR[lang] || LANG_STR.en;
  return {
    ls: ui, lang,
    clusters: CLUSTER_LABELS[lang] || CLUSTER_LABELS.en,
    targetName: TARGET_LANG_LABEL[lang] || TARGET_LANG_LABEL.en,
  };
}
