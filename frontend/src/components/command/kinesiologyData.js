// src/components/command/kinesiologyData.js
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 2 — The Kinesiology Lab (gamified spaced repetition).
//
// Two drill decks for collegiate exercise science:
//   • match      — Match Madness: a prompt + 4 options, pick the right answer
//                  (muscle ↔ primary action, structure ↔ function).
//   • truefalse  — Speed Review: rapid bioenergetics / physiology true-false.
//
// Each concept carries a `why` (the teaching moment shown on reveal) and a
// `category`. Question CONTENT is English (the founder studies in EN at Rio
// Salado); the surface CHROME localizes EN·ES·PT below. Mastery is tracked
// client-side as a 1-5 spaced-repetition box per concept id (see KinesiologyLab).
//
// DROP-IN: add a record to KINESIO_DECKS.match / .truefalse — the game reads them
// generically. (ES/PT question localization can drop in later as { en, es, pt }.)

import { ANATOMY_IDS } from './anatomyData.js';

export const KINESIO_DECKS = {
  match: [
    { id: 'm_hamstrings', category: 'Anatomy', q: 'Primary action of the hamstrings at the knee?', answer: 'Knee flexion', options: ['Knee flexion', 'Knee extension', 'Hip flexion', 'Dorsiflexion'], why: 'The hamstrings flex the knee and assist hip extension.' },
    { id: 'm_glutemax', category: 'Anatomy', q: 'Primary action of the gluteus maximus?', answer: 'Hip extension', options: ['Hip extension', 'Hip flexion', 'Knee extension', 'Hip adduction'], why: 'The glute max is the prime hip extensor (and external rotator).' },
    { id: 'm_quads', category: 'Anatomy', q: 'Primary action of the quadriceps?', answer: 'Knee extension', options: ['Knee extension', 'Knee flexion', 'Hip extension', 'Plantarflexion'], why: 'The quads extend the knee; rectus femoris also flexes the hip.' },
    { id: 'm_gastroc', category: 'Anatomy', q: 'Primary action of the gastrocnemius?', answer: 'Plantarflexion', options: ['Plantarflexion', 'Dorsiflexion', 'Knee extension', 'Eversion'], why: 'Gastrocnemius plantarflexes the ankle and assists knee flexion.' },
    { id: 'm_antdelt', category: 'Anatomy', q: 'Primary action of the anterior deltoid?', answer: 'Shoulder flexion', options: ['Shoulder flexion', 'Shoulder extension', 'Elbow flexion', 'Shoulder adduction'], why: 'The anterior deltoid flexes and internally rotates the shoulder.' },
    { id: 'm_lats', category: 'Anatomy', q: 'Primary action of the latissimus dorsi?', answer: 'Shoulder adduction & extension', options: ['Shoulder adduction & extension', 'Shoulder abduction', 'Elbow extension', 'Scapular elevation'], why: 'The lats adduct, extend, and internally rotate the humerus.' },
    { id: 'm_biceps', category: 'Anatomy', q: 'Primary action of the biceps brachii?', answer: 'Elbow flexion & forearm supination', options: ['Elbow flexion & forearm supination', 'Elbow extension', 'Wrist flexion', 'Shoulder abduction'], why: 'Biceps brachii flexes the elbow and supinates the forearm.' },
    { id: 'm_cuff', category: 'Anatomy', q: 'Primary role of the rotator cuff?', answer: 'Glenohumeral stabilization', options: ['Glenohumeral stabilization', 'Hip stabilization', 'Knee extension', 'Scapular protraction'], why: 'The cuff centers the humeral head in the glenoid during motion.' },
    { id: 'm_tibant', category: 'Anatomy', q: 'Primary action of the tibialis anterior?', answer: 'Dorsiflexion', options: ['Dorsiflexion', 'Plantarflexion', 'Eversion', 'Knee flexion'], why: 'Tibialis anterior dorsiflexes and inverts the foot.' },
    { id: 'm_erector', category: 'Anatomy', q: 'Primary action of the erector spinae?', answer: 'Spinal extension', options: ['Spinal extension', 'Spinal flexion', 'Hip flexion', 'Hip abduction'], why: 'The erector spinae extends the spine and resists flexion.' },
    { id: 'm_glutemed', category: 'Anatomy', q: 'Primary action of the gluteus medius?', answer: 'Hip abduction', options: ['Hip abduction', 'Hip adduction', 'Hip flexion', 'Knee extension'], why: 'Glute med abducts the hip and stabilizes the pelvis in single-leg stance.' },
    { id: 'm_pecmaj', category: 'Anatomy', q: 'Primary action of the pectoralis major?', answer: 'Shoulder horizontal adduction', options: ['Shoulder horizontal adduction', 'Shoulder abduction', 'Elbow extension', 'Scapular retraction'], why: 'Pec major horizontally adducts, flexes, and internally rotates the shoulder.' },
  ],
  truefalse: [
    { id: 't_atppc', category: 'Bioenergetics', statement: 'The ATP-PC (phosphagen) system dominates during a 1-rep-max trap-bar deadlift.', answer: true, why: 'Maximal efforts under ~10s are powered by stored ATP and creatine phosphate.' },
    { id: 't_glyco', category: 'Bioenergetics', statement: 'Glycolysis is the primary system powering an all-out 400m sprint (~50s).', answer: true, why: 'Efforts of ~30s-2min are glycolytic-dominant.' },
    { id: 't_typei', category: 'Physiology', statement: 'Type I (slow-twitch) fibers fatigue faster than Type II fibers.', answer: false, why: 'Type I fibers are oxidative and fatigue-resistant; Type II fatigue faster.' },
    { id: 't_tension', category: 'Physiology', statement: 'Hypertrophy is driven ONLY by mechanical tension, never metabolic stress.', answer: false, why: 'Tension is primary, but metabolic stress and muscle damage also contribute.' },
    { id: 't_size', category: 'Physiology', statement: 'The size principle: motor units are recruited from smallest to largest.', answer: true, why: 'Low-threshold (small) units recruit first; high-threshold units join as demand rises.' },
    { id: 't_eccentric', category: 'Biomechanics', statement: 'Eccentric contractions produce LESS force than concentric at the same velocity.', answer: false, why: 'Eccentric actions can generate greater force than concentric.' },
    { id: 't_doms', category: 'Physiology', statement: 'DOMS typically peaks 24-72 hours after unaccustomed eccentric loading.', answer: true, why: 'Delayed-onset soreness peaks roughly 1-3 days post-exposure.' },
    { id: 't_vo2', category: 'Physiology', statement: 'VO2max is primarily a measure of anaerobic capacity.', answer: false, why: 'VO2max reflects aerobic / cardiorespiratory capacity.' },
    { id: 't_ssc', category: 'Biomechanics', statement: 'The stretch-shortening cycle stores elastic energy to enhance concentric output.', answer: true, why: 'A rapid eccentric pre-load stores elastic energy reused in the concentric phase.' },
    { id: 't_sarcopenia', category: 'Physiology', statement: 'Sarcopenia is the age-related loss of muscle mass and function.', answer: true, why: 'Resistance training is the most effective countermeasure.' },
    { id: 't_lactate', category: 'Bioenergetics', statement: 'Lactate is a metabolic waste product that directly causes muscle fatigue.', answer: false, why: 'Lactate is a usable fuel; fatigue is multifactorial (H+, Pi, Ca2+ handling).' },
    { id: 't_epoc', category: 'Bioenergetics', statement: 'EPOC ("afterburn") raises post-exercise oxygen consumption above rest.', answer: true, why: 'Excess post-exercise O2 consumption repays the metabolic debt and restores homeostasis.' },
  ],
};

// Surface chrome — localized EN·ES·PT.
export const KINESIO_L10N = {
  en: {
    intro: 'Drill the science. Two gamified decks, spaced-repetition scored — keep your anatomy, physiology and bioenergetics razor-sharp.',
    modeMatch: 'Match Madness', modeMatchSub: 'Muscle ↔ action',
    modeSpeed: 'Speed Review', modeSpeedSub: 'Rapid true / false',
    modeAnatomy: 'Anatomy Arena', modeAnatomySub: 'Find it on the body',
    start: 'Start drill', round: 'Question', of: 'of', score: 'Score', streak: 'Streak',
    correct: 'Correct', incorrect: 'Not quite', answerWas: 'Answer', next: 'Next →',
    truth: 'True', falseh: 'False', timeUp: 'Time!',
    resultsTitle: 'Drill complete', accuracy: 'Accuracy', mastered: 'Concepts mastered',
    playAgain: 'Run it again', switchMode: 'Switch deck',
    masteryLabel: 'Mastery', boxOf: 'box',
    findThe: 'Locate the', tapHint: 'Tap the exact muscle', missedIt: 'Here it is', anatomyAction: 'Action',
    gateLead: 'Pick your training split — then locate each muscle in that lane.',
    lane_push: 'Push', lane_push_sub: 'Chest · Shoulders · Triceps',
    lane_pull: 'Pull', lane_pull_sub: 'Back · Rear Delts · Traps',
    lane_legs: 'Legs', lane_legs_sub: 'Quads · Hams · Glutes · Calves',
    changeSplit: 'Change split', laneLabel: 'Split',
    narration: 'Narration', replay: 'Replay',
  },
  es: {
    intro: 'Entrena la ciencia. Dos mazos gamificados con repetición espaciada — mantén tu anatomía, fisiología y bioenergética afiladas.',
    modeMatch: 'Match Madness', modeMatchSub: 'Músculo ↔ acción',
    modeSpeed: 'Repaso Rápido', modeSpeedSub: 'Verdadero / falso',
    modeAnatomy: 'Arena Anatómica', modeAnatomySub: 'Encuéntralo en el cuerpo',
    start: 'Comenzar', round: 'Pregunta', of: 'de', score: 'Puntos', streak: 'Racha',
    correct: 'Correcto', incorrect: 'Casi', answerWas: 'Respuesta', next: 'Siguiente →',
    truth: 'Verdadero', falseh: 'Falso', timeUp: '¡Tiempo!',
    resultsTitle: 'Drill completo', accuracy: 'Precisión', mastered: 'Conceptos dominados',
    playAgain: 'Otra vez', switchMode: 'Cambiar mazo',
    masteryLabel: 'Maestría', boxOf: 'caja',
    findThe: 'Localiza el', tapHint: 'Toca el músculo exacto', missedIt: 'Aquí está', anatomyAction: 'Acción',
    gateLead: 'Elige tu rutina — luego localiza cada músculo de esa vía.',
    lane_push: 'Empuje', lane_push_sub: 'Pecho · Hombros · Tríceps',
    lane_pull: 'Tirón', lane_pull_sub: 'Espalda · Deltoides post. · Trapecios',
    lane_legs: 'Piernas', lane_legs_sub: 'Cuádriceps · Isquios · Glúteos · Gemelos',
    changeSplit: 'Cambiar rutina', laneLabel: 'Rutina',
    narration: 'Narración', replay: 'Repetir',
  },
  pt: {
    intro: 'Treine a ciência. Dois decks gamificados com repetição espaçada — mantenha sua anatomia, fisiologia e bioenergética afiadas.',
    modeMatch: 'Match Madness', modeMatchSub: 'Músculo ↔ ação',
    modeSpeed: 'Revisão Rápida', modeSpeedSub: 'Verdadeiro / falso',
    modeAnatomy: 'Arena Anatômica', modeAnatomySub: 'Ache no corpo',
    start: 'Começar', round: 'Questão', of: 'de', score: 'Pontos', streak: 'Sequência',
    correct: 'Correto', incorrect: 'Quase', answerWas: 'Resposta', next: 'Próxima →',
    truth: 'Verdadeiro', falseh: 'Falso', timeUp: 'Tempo!',
    resultsTitle: 'Drill completo', accuracy: 'Precisão', mastered: 'Conceitos dominados',
    playAgain: 'De novo', switchMode: 'Trocar deck',
    masteryLabel: 'Maestria', boxOf: 'caixa',
    findThe: 'Localize o', tapHint: 'Toque no músculo exato', missedIt: 'Aqui está', anatomyAction: 'Ação',
    gateLead: 'Escolha seu treino — depois localize cada músculo dessa via.',
    lane_push: 'Empurrar', lane_push_sub: 'Peito · Ombros · Tríceps',
    lane_pull: 'Puxar', lane_pull_sub: 'Costas · Deltoides post. · Trapézios',
    lane_legs: 'Pernas', lane_legs_sub: 'Quadríceps · Posteriores · Glúteos · Panturrilhas',
    changeSplit: 'Trocar treino', laneLabel: 'Treino',
    narration: 'Narração', replay: 'Repetir',
  },
};

// ── Spaced-repetition box (1-5) persistence, per concept id (localStorage) ─────
const SRS_KEY = 'bbf.coachlab.kinesio.srs.v1';
export function readSrs() {
  try { return JSON.parse(localStorage.getItem(SRS_KEY) || '{}') || {}; } catch { return {}; }
}
// Correct → box +1 (max 5); wrong → reset to box 1. Returns the new map.
export function bumpSrs(conceptId, correct) {
  const all = readSrs();
  const cur = Number(all[conceptId] || 0);
  all[conceptId] = correct ? Math.min(5, cur + 1) : 1;
  try { localStorage.setItem(SRS_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
  return all;
}
// Mastery denominator = the UNION of every distinct concept id across all three
// games. The Anatomy Arena reuses Match-Madness muscle ids (shared SRS box), so a
// naive sum would double-count them — a Set keeps the total honest.
export const TOTAL_CONCEPTS = new Set([
  ...KINESIO_DECKS.match.map((c) => c.id),
  ...KINESIO_DECKS.truefalse.map((c) => c.id),
  ...ANATOMY_IDS,
]).size;
