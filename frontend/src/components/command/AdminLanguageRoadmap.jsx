// src/components/command/AdminLanguageRoadmap.jsx
// ─────────────────────────────────────────────────────────────────────────────
// CEO Language Mastery Protocol — ADMIN-ONLY Command Center surface.
//
// A React port of the standalone "90-Day Language Mastery Protocol" prototype
// (legacy bbf-language-protocol.jsx): the CEO's personal Spanish + Brazilian
// Portuguese curriculum. Five sub-tabs, faithful to the ground truth:
//   1. Vocab Matrix    — Spanish fitness vocabulary (4 categories) + coach scripts.
//   2. Rio Ready       — 50 PT survival phrases + a Pimsleur ear-training schedule.
//   3. God-Mode Drills — copy-paste roleplay triggers for live ES/PT correction.
//   4. Intentions      — bilingual cardio intention statements (175 lb goal).
//   5. 90-Day Roadmap  — four-phase periodized study plan + success benchmarks.
//
// All copy/translations are static ground-truth, transcribed VERBATIM from the
// prototype — the 175 lb targets and ES/PT translations are intentionally left
// unaltered. The legacy inline <style> block was NOT copied; styling now lives in
// the co-located languageRoadmap.css, expressed through the LOCKED brand tokens
// (--pur / --yel / dark surfaces) per CLAUDE.md §2.
//
// ⚠️ ACCESS PERIMETER. This is a CEO-tier module. Its only mount point is the
// Command Center TABS array, and the entire /command/:tab? route is wrapped in
// <AdminGuard> (AuthContext.isAdmin → role admin/trainer or the `akeem` fallback)
// — a standard athlete can never route here, see the nav, or load this shell. The
// in-component isAdmin re-check below is fail-closed defense-in-depth on top of
// that route guard, so the module renders nothing if it is ever mounted outside
// the admin perimeter.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';
import { useSpeechEvaluator, comparePhrases } from '../../lib/useSpeechEvaluator.js';
import { loadLanguageProgress, saveLanguageScore, recordVocabAttempt } from '../../lib/languageProgressApi.js';
import languageVideoLibrary from '../../data/languageVideoLibrary.json';
import './languageRoadmap.css';

// ─── DATA (extracted verbatim from legacy bbf-language-protocol.jsx) ──────────

const vocabData = {
  'ANATOMY': [
    { es: 'músculo', en: 'muscle' },
    { es: 'bíceps', en: 'biceps' },
    { es: 'tríceps', en: 'triceps' },
    { es: 'cuádriceps', en: 'quadriceps' },
    { es: 'isquiotibiales', en: 'hamstrings' },
    { es: 'glúteos', en: 'glutes' },
    { es: 'pectorales', en: 'pectorals / chest' },
    { es: 'deltoides', en: 'deltoids / shoulders' },
    { es: 'espalda', en: 'back' },
    { es: 'abdominales', en: 'abs/core' },
    { es: 'pantorrilla', en: 'calf' },
    { es: 'antebrazo', en: 'forearm' },
    { es: 'columna vertebral', en: 'spine' },
    { es: 'articulación', en: 'joint' },
    { es: 'tendón', en: 'tendon' },
    { es: 'ligamento', en: 'ligament' },
    { es: 'núcleo', en: 'core' },
    { es: 'postura', en: 'posture' },
    { es: 'rango de movimiento', en: 'range of motion' },
    { es: 'conexión mente-músculo', en: 'mind-muscle connection' },
  ],
  'NUTRITION': [
    { es: 'macronutrientes', en: 'macros' },
    { es: 'proteína', en: 'protein' },
    { es: 'carbohidratos', en: 'carbohydrates' },
    { es: 'grasas saludables', en: 'healthy fats' },
    { es: 'calorías', en: 'calories' },
    { es: 'déficit calórico', en: 'caloric deficit' },
    { es: 'superávit calórico', en: 'caloric surplus' },
    { es: 'ayuno intermitente', en: 'intermittent fasting' },
    { es: 'ventana de alimentación', en: 'eating window' },
    { es: 'hidratación', en: 'hydration' },
    { es: 'suplemento', en: 'supplement' },
    { es: 'creatina', en: 'creatine' },
    { es: 'proteína de suero', en: 'whey protein' },
    { es: 'aminoácidos', en: 'amino acids' },
    { es: 'metabolismo', en: 'metabolism' },
    { es: 'composición corporal', en: 'body composition' },
    { es: 'grasa corporal', en: 'body fat' },
    { es: 'masa muscular', en: 'muscle mass' },
    { es: 'masa magra', en: 'lean mass' },
    { es: 'nutrición perientrenamiento', en: 'peri-workout nutrition' },
  ],
  'TRAINING': [
    { es: 'sobrecarga progresiva', en: 'progressive overload' },
    { es: 'volumen de entrenamiento', en: 'training volume' },
    { es: 'intensidad', en: 'intensity' },
    { es: 'frecuencia', en: 'frequency' },
    { es: 'repetición', en: 'rep' },
    { es: 'serie', en: 'set' },
    { es: 'fallo muscular', en: 'muscular failure' },
    { es: 'técnica', en: 'technique / form' },
    { es: 'calentamiento', en: 'warm-up' },
    { es: 'enfriamiento', en: 'cool-down' },
    { es: 'hipertrofia', en: 'hypertrophy' },
    { es: 'resistencia', en: 'endurance' },
    { es: 'fuerza', en: 'strength' },
    { es: 'cardio', en: 'cardio' },
    { es: 'división de entrenamiento', en: 'training split' },
    { es: 'descanso activo', en: 'active recovery' },
    { es: 'sobreentrenamiento', en: 'overtraining' },
    { es: 'periodización', en: 'periodization' },
    { es: 'tiempo bajo tensión', en: 'time under tension' },
    { es: 'velocidad de ejecución', en: 'rep tempo' },
  ],
  'MOTIVATION & CUES': [
    { es: '¡Tú puedes!', en: 'You can do it!' },
    { es: '¡Más peso!', en: 'More weight!' },
    { es: '¡Aprieta!', en: 'Squeeze!' },
    { es: 'Controla el movimiento', en: 'Control the movement' },
    { es: 'Respira', en: 'Breathe' },
    { es: 'Mantén la postura', en: 'Hold your form' },
    { es: 'Empuja', en: 'Push' },
    { es: 'Jala', en: 'Pull' },
    { es: 'Última repetición', en: 'Last rep' },
    { es: '¡Descansa!', en: 'Rest!' },
    { es: 'Concéntrate', en: 'Focus' },
    { es: 'Siente el músculo', en: 'Feel the muscle' },
    { es: 'Más profundo', en: 'Go deeper' },
    { es: 'Velocidad controlada', en: 'Controlled speed' },
    { es: '¡Excelente trabajo!', en: 'Excellent work!' },
    { es: 'Vamos a superar tus límites', en: "We're pushing your limits" },
    { es: 'Confía en el proceso', en: 'Trust the process' },
    { es: 'Disciplina es libertad', en: 'Discipline is freedom' },
    { es: 'Construye, cree, logra', en: 'Build, believe, achieve' },
    { es: 'El dolor es temporal', en: 'Pain is temporary' },
  ],
};

const scripts = [
  {
    title: 'SCRIPT 1 — Explaining 16/8 Fasting',
    label: 'Explica el Ayuno 16/8',
    lines: [
      { es: 'Hoy vamos a hablar de tu protocolo de ayuno.', en: "Today we're going to talk about your fasting protocol." },
      { es: 'El ayuno 16/8 significa que no comes durante 16 horas y tienes una ventana de alimentación de 8 horas.', en: "16/8 fasting means you don't eat for 16 hours and have an 8-hour eating window." },
      { es: 'Por ejemplo, si tu última comida es a las 8 de la noche, no comes hasta el mediodía del día siguiente.', en: "For example, if your last meal is at 8 PM, you don't eat until noon the next day." },
      { es: 'Durante el ayuno, puedes tomar agua, café negro, y té sin azúcar.', en: 'During the fast, you can have water, black coffee, and unsweetened tea.' },
      { es: 'Este método mejora la sensibilidad a la insulina y te ayuda a reducir la grasa corporal.', en: 'This method improves insulin sensitivity and helps you reduce body fat.' },
      { es: '¿Tienes preguntas sobre cómo empezar?', en: 'Do you have questions about how to start?' },
    ],
  },
  {
    title: 'SCRIPT 2 — The 5-Day Strength Split',
    label: 'Explica la División de 5 Días',
    lines: [
      { es: 'Tu programa de entrenamiento es una división de cinco días.', en: 'Your training program is a five-day split.' },
      { es: 'El lunes trabajamos el pecho y los tríceps.', en: 'Monday we work chest and triceps.' },
      { es: 'El martes es para la espalda y los bíceps.', en: 'Tuesday is for back and biceps.' },
      { es: 'El miércoles entrenamos los hombros y el núcleo.', en: 'Wednesday we train shoulders and core.' },
      { es: 'El jueves nos enfocamos en los glúteos y los isquiotibiales.', en: 'Thursday we focus on glutes and hamstrings.' },
      { es: 'El viernes es el día de cuádriceps y pantorrillas.', en: 'Friday is quadriceps and calves day.' },
      { es: 'El sábado y el domingo son días de descanso activo o cardio ligero.', en: 'Saturday and Sunday are active recovery or light cardio days.' },
      { es: 'Cada semana aumentamos el peso o las repeticiones — eso es la sobrecarga progresiva.', en: "Every week we increase the weight or reps — that's progressive overload." },
    ],
  },
  {
    title: 'SCRIPT 3 — Motivation & Check-In',
    label: 'Motivación y Revisión',
    lines: [
      { es: '¿Cómo te sientes hoy? ¿Tienes energía para entrenar?', en: 'How are you feeling today? Do you have energy to train?' },
      { es: 'Recuerda: la consistencia es más importante que la perfección.', en: 'Remember: consistency is more important than perfection.' },
      { es: 'Hoy vamos a trabajar en la conexión mente-músculo.', en: "Today we're going to work on the mind-muscle connection." },
      { es: 'Cada repetición debe ser intencional — siente el músculo trabajar.', en: 'Every rep must be intentional — feel the muscle working.' },
      { es: 'Tu objetivo es llegar a 175 libras de masa muscular limpia. Estamos construyendo ese físico.', en: 'Your goal is to reach 175 lbs of clean muscle mass. We are building that physique.' },
      { es: '¡Tú puedes! Construye, cree, logra.', en: 'You can do it! Build, believe, achieve.' },
    ],
  },
];

const ptPhrases = [
  { n: 1, pt: 'Olá! Tudo bem?', en: 'Hi! All good / How are you?', cat: 'social' },
  { n: 2, pt: 'Tudo bem, obrigado!', en: 'All good, thanks!', cat: 'social' },
  { n: 3, pt: 'Como você se chama?', en: "What's your name?", cat: 'social' },
  { n: 4, pt: 'Me chamo Akeem.', en: 'My name is Akeem.', cat: 'social' },
  { n: 5, pt: 'Prazer em te conhecer!', en: 'Nice to meet you!', cat: 'social' },
  { n: 6, pt: 'Você fala inglês?', en: 'Do you speak English?', cat: 'social' },
  { n: 7, pt: 'Falo pouco português.', en: 'I speak a little Portuguese.', cat: 'social' },
  { n: 8, pt: 'Pode falar mais devagar?', en: 'Can you speak more slowly?', cat: 'social' },
  { n: 9, pt: 'Não entendi. Pode repetir?', en: "I didn't understand. Can you repeat?", cat: 'social' },
  { n: 10, pt: 'Onde fica o metrô?', en: 'Where is the subway?', cat: 'airport/nav' },
  { n: 11, pt: 'Onde fica o aeroporto?', en: 'Where is the airport?', cat: 'airport/nav' },
  { n: 12, pt: 'Preciso de um táxi.', en: 'I need a taxi.', cat: 'airport/nav' },
  { n: 13, pt: 'Chame um Uber, por favor.', en: 'Please call an Uber.', cat: 'airport/nav' },
  { n: 14, pt: 'Onde fica o hotel?', en: 'Where is the hotel?', cat: 'airport/nav' },
  { n: 15, pt: 'Qual é o endereço?', en: 'What is the address?', cat: 'airport/nav' },
  { n: 16, pt: 'Estou perdido(a).', en: "I'm lost.", cat: 'airport/nav' },
  { n: 17, pt: 'Me leva para aqui, por favor.', en: 'Take me here, please. [show map]', cat: 'airport/nav' },
  { n: 18, pt: 'Quanto custa?', en: 'How much does it cost?', cat: 'airport/nav' },
  { n: 19, pt: 'Aceita cartão?', en: 'Do you accept card?', cat: 'airport/nav' },
  { n: 20, pt: 'Quero um açaí, por favor.', en: "I'd like an açaí, please.", cat: 'food' },
  { n: 21, pt: 'Com granola e banana.', en: 'With granola and banana.', cat: 'food' },
  { n: 22, pt: 'Quero churrasco misto.', en: "I'd like a mixed churrasco.", cat: 'food' },
  { n: 23, pt: 'Sem glúten, por favor.', en: 'Gluten-free, please.', cat: 'food' },
  { n: 24, pt: 'Mais proteína, menos carboidrato.', en: 'More protein, less carb.', cat: 'food' },
  { n: 25, pt: 'Água, por favor.', en: 'Water, please.', cat: 'food' },
  { n: 26, pt: 'A conta, por favor.', en: 'The bill, please.', cat: 'food' },
  { n: 27, pt: 'Está delicioso!', en: "It's delicious!", cat: 'food' },
  { n: 28, pt: 'Quero um suco de maracujá.', en: "I'd like a passion fruit juice.", cat: 'food' },
  { n: 29, pt: 'Tem opção sem açúcar?', en: 'Is there a sugar-free option?', cat: 'food' },
  { n: 30, pt: 'Onde fica a academia?', en: 'Where is the gym?', cat: 'gym' },
  { n: 31, pt: 'Você treina aqui todo dia?', en: 'Do you train here every day?', cat: 'gym' },
  { n: 32, pt: 'Posso treinar com você?', en: 'Can I train with you?', cat: 'gym' },
  { n: 33, pt: 'Qual músculo você está treinando hoje?', en: 'Which muscle are you training today?', cat: 'gym' },
  { n: 34, pt: 'Você pode me ajudar com a técnica?', en: 'Can you help me with my form?', cat: 'gym' },
  { n: 35, pt: 'Quanto tempo você treina?', en: 'How long have you been training?', cat: 'gym' },
  { n: 36, pt: 'Que suplementos você toma?', en: 'What supplements do you take?', cat: 'gym' },
  { n: 37, pt: 'Você é personal trainer?', en: 'Are you a personal trainer?', cat: 'gym' },
  { n: 38, pt: 'Sou personal trainer nos Estados Unidos.', en: "I'm a personal trainer from the US.", cat: 'gym' },
  { n: 39, pt: 'Posso fazer uma série aqui?', en: 'Can I use this [equipment]?', cat: 'gym' },
  { n: 40, pt: 'Vamos treinar juntos!', en: "Let's train together!", cat: 'gym' },
  { n: 41, pt: 'Você quer sair depois do treino?', en: 'Do you want to hang out after the workout?', cat: 'social+' },
  { n: 42, pt: 'Qual é seu Instagram?', en: "What's your Instagram?", cat: 'social+' },
  { n: 43, pt: 'Me adiciona no Instagram!', en: 'Add me on Instagram!', cat: 'social+' },
  { n: 44, pt: 'Você mora aqui em São Paulo?', en: 'Do you live here in São Paulo?', cat: 'social+' },
  { n: 45, pt: 'Qual é o melhor restaurante aqui?', en: "What's the best restaurant here?", cat: 'social+' },
  { n: 46, pt: 'Qual é a melhor praia perto daqui?', en: "What's the best beach near here?", cat: 'social+' },
  { n: 47, pt: 'Obrigado por tudo!', en: 'Thank you for everything!', cat: 'social+' },
  { n: 48, pt: 'Foi um prazer!', en: 'It was a pleasure!', cat: 'social+' },
  { n: 49, pt: 'Até logo! / Tchau!', en: 'See you! / Bye!', cat: 'social+' },
  { n: 50, pt: 'Volto em breve.', en: "I'll be back soon.", cat: 'social+' },
];

const pimsleurSchedule = [
  { week: 'WEEK 1', title: 'Foundation', detail: 'Units 1–7 (30 min/day, post-workout cooldown). Focus: greetings, introductions, basic navigation. Shadowbox pronunciation daily. Repeat each unit twice before advancing.' },
  { week: 'WEEK 2', title: 'Numbers, Time & Food', detail: 'Units 8–14. Add food vocabulary from Survival Kit phrases 20–30 during sessions. Record yourself and compare to Pimsleur speaker.' },
  { week: 'WEEK 3', title: 'Transportation & Location', detail: 'Units 15–21. Pair with Google Maps Portuguese overlay. Walk through navigation scenarios with phrases 10–19. Speak aloud during cardio.' },
  { week: 'WEEK 4', title: 'Gym Culture & Social', detail: 'Units 22–28. Role-play gym conversations using phrases 30–40. Set phone language to Portuguese. Watch 1 Brazilian fitness YouTube video daily without subtitles.' },
  { week: 'WEEK 5–6', title: 'Rapid Consolidation', detail: 'Review Units 1–28. Start Pimsleur Level 2 Units 1–10. Add Memrise Brazilian Portuguese deck. Aim for 5-min unscripted monologue about your training day.' },
  { week: 'WEEK 7–8', title: 'Ear Training Sprint', detail: "Podcast: 'PortuguesePod101' daily 20 min. Shadow native speakers on YouTube (Fitness Brasil channel). Journal 3 sentences in Portuguese every night." },
  { week: 'WEEK 9–10', title: 'Conversation Mode', detail: 'Italki or Preply: 2× 30-min sessions with Brazilian tutor. Use ALL 50 survival kit phrases at least once per session. Bring a training topic every call.' },
  { week: 'WEEK 11–12', title: 'Mastery Sprint', detail: 'Pimsleur Level 2 final units. Full conversation: explain your 5-day split and 16/8 protocol in Portuguese. Record a 3-min Instagram Reel in Portuguese for BBF brand content.' },
];

const scenarios = [
  {
    title: '🇨🇴 Lost in Medellín',
    lang: 'ES',
    desc: "You're in El Poblado, can't find your hotel, phone is at 5%.",
    prompt: `Estoy en Medellín, en el barrio El Poblado. Perdí mi hotel — se llama Hotel Dann Carlton. Mi teléfono está a punto de morir. Necesito ayuda. ¿Puede ayudarme a llegar allí?`,
    correction: `❌ "Yo estar perdido" → ✅ "Estoy perdido" — ser/estar matters. ❌ "Busco el hotel mío" → ✅ "Busco mi hotel" — possessive before noun.`,
  },
  {
    title: '🇧🇷 Gym in São Paulo',
    lang: 'PT',
    desc: "You're looking for a CrossFit box in Vila Madalena, need directions & a day pass.",
    prompt: `Olá! Estou procurando uma academia de CrossFit aqui em Vila Madalena. Você conhece alguma perto daqui? Quanto custa uma diária? Posso pagar com cartão?`,
    correction: `❌ "Eu estar procurando" → ✅ "Estou procurando" — drop pronoun, use conjugated form. ❌ "Eu quero pagar com cartão de crédito meu" → ✅ "Quero pagar com meu cartão de crédito."`,
  },
  {
    title: '🇲🇽 Ordering Nutrition at a Mexican Market',
    lang: 'ES',
    desc: "You're at a Mercado in CDMX trying to find high-protein foods for your cut.",
    prompt: `Buenos días. Estoy buscando alimentos altos en proteína y bajos en carbohidratos. Necesito pollo, atún, huevos y verduras frescas. ¿Cuánto cuesta el kilo de pechuga de pollo?`,
    correction: `❌ "Alimentos con mucho proteína" → ✅ "Alimentos altos en proteína" — "proteína" is feminine: "alta en proteína." ❌ "Quiero pagar cara" → ✅ "No quiero pagar caro" — don't mix gender with adverbs.`,
  },
  {
    title: '🇧🇷 Making Friends at a Rio Beach Gym',
    lang: 'PT',
    desc: "You're at a calçadão workout station on Ipanema beach.",
    prompt: `Oi! Você treina aqui todo dia? Sou personal trainer americano, me chamo Akeem. Estou cortando peso agora — estou em déficit calórico. Você faz dieta também?`,
    correction: `❌ "Eu sou cortando" → ✅ "Estou cortando" — use estar for ongoing action. ❌ "Eu treino a musculação" → ✅ "Eu treino musculação" — no article needed here.`,
  },
];

const intentions = [
  {
    week: 'WEEKS 1–2', theme: 'I AM DISCIPLINED',
    es: 'Soy disciplinado. Mi cuerpo obedece mi mente. Cada cardio me acerca a 175 libras de poder.',
    pt: 'Sou disciplinado. Meu corpo obedece à minha mente. Cada cardio me aproxima de 175 libras de poder.',
  },
  {
    week: 'WEEKS 3–4', theme: 'I AM CUTTING CLEAN',
    es: 'Corto con precisión quirúrgica. El déficit es mi herramienta. Cada libra perdida revela mi mejor versión.',
    pt: 'Corto com precisão cirúrgica. O déficit é minha ferramenta. Cada quilo perdido revela minha melhor versão.',
  },
  {
    week: 'WEEKS 5–6', theme: 'I AM RELENTLESS',
    es: 'No paro. No me rindo. Soy un atleta de élite construyendo su legado en cada sesión de cardio.',
    pt: 'Não paro. Não desisto. Sou um atleta de elite construindo meu legado a cada sessão de cardio.',
  },
  {
    week: 'WEEKS 7–8', theme: '175 IS MINE',
    es: '175 libras son mías. Mi masa muscular crece. Mi grasa disminuye. Soy el arquetipo del entrenador.',
    pt: '175 libras são minhas. Minha massa muscular cresce. Minha gordura diminui. Sou o arquétipo do treinador.',
  },
  {
    week: 'WEEKS 9–10', theme: 'I SPEAK POWER',
    es: 'Hablo dos idiomas del poder. Sirvo a más clientes. Expando Build Believe Fit sin fronteras.',
    pt: 'Falo dois idiomas do poder. Sirvo mais clientes. Expando a Build Believe Fit sem fronteiras.',
  },
  {
    week: 'WEEKS 11–12', theme: 'I AM THE BRAND',
    es: 'Soy Build Believe Fit. Construyo. Creo. Logro. En 175 libras, con dos idiomas y sin límites.',
    pt: 'Sou a Build Believe Fit. Construo. Acredito. Conquisto. Com 175 libras, dois idiomas e sem limites.',
  },
];

const roadmapPhases = [
  {
    num: '01', name: 'FOUNDATION', weeks: 'WEEKS 1–3',
    es: 'Vocab Gym daily — Speed Matrix + Flip Drill to plant the 80-term matrix; tap 🔊 on every new term. Drive each term to SRS Box 3.',
    pt: 'Rio Ready — 10 phrases/week with the 🔊 soundboard; a Listening Lab round daily to train the ear.',
    daily: ['Speed Matrix', 'Listening Lab', 'Rio Ready 🔊', 'Flip Drill', 'Match Madness', 'Voice Studio', 'Rest / SRS'],
  },
  {
    num: '02', name: 'ACCELERATION', weeks: 'WEEKS 4–7',
    es: 'Chase Speed Matrix combos (target a ×5 streak); rehearse the coach scripts aloud in Voice Studio 3×/week.',
    pt: 'Sentence Builder on the Rio Ready phrases daily; one Video Vault clip (no subtitles).',
    daily: ['Speed Combo', 'Sentence Builder', 'Voice Studio', 'Match Madness', 'Sentence (PT)', 'Video Vault', 'Rest / SRS'],
  },
  {
    num: '03', name: 'IMMERSION', weeks: 'WEEKS 8–11',
    es: 'God-Mode Drills 2×/week (Lost in Medellín); recite all 6 Intentions in Voice Studio; hold SRS terms at Box 4+.',
    pt: 'God-Mode "Gym in São Paulo" weekly; advanced Sentence Builder; PT Intentions in Voice Studio.',
    daily: ['God-Mode (ES)', 'Voice: Intentions', 'Sentence Builder', 'God-Mode (PT)', 'Speed + Listen', 'Video Vault', 'Rest / SRS'],
  },
  {
    num: '04', name: 'MASTERY SPRINT', weeks: 'WEEK 12',
    es: 'Clear Speed Matrix at 90%+; drive every matrix term to SRS Box 5; record a full Spanish coaching clip.',
    pt: 'Sentence Builder at 100%; God-Mode São Paulo unscripted; record a PT brand Reel.',
    daily: ['Speed 90%+', 'Sentence 100%', 'God-Mode RP', 'Voice: Record', 'Reel + Post', 'Rest', 'Celebrate 🎉'],
  },
];

// Daily integration template + 90-day benchmarks — built around the BBF Lab's own
// in-app engine (Vocab Gym games · Voice Studio · soundboards · SRS mastery).
const INTEGRATION_TEMPLATE = [
  { time: 'WARM-UP (10 MIN)', act: 'Vocab Gym — a Speed Matrix or Flip Drill round to prime the brain.' },
  { time: 'WORKOUT (75 MIN)', act: 'Listening Lab + the 🔊 soundboard through ONE earbud between isolation sets.' },
  { time: 'CARDIO / COOLDOWN (20 MIN)', act: 'Recite the weekly Intention in Voice Studio (both languages); one Sentence Builder round.' },
];

const BENCHMARKS = [
  'Hold a 5-minute Spanish coaching session without pausing',
  'Navigate a São Paulo gym entirely in Portuguese',
  'All 6 Intention statements at 90%+ in Voice Studio — both languages',
  'Every Vocab Matrix term at SRS Box 5 — fully Mastered',
  'Clear a Speed Matrix round at 90%+ with a ×5 combo streak',
  'Post 1 bilingual BBF Reel — and land at 175 lbs',
];

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────

// Copy-to-clipboard button. Guards against non-secure contexts where
// navigator.clipboard is undefined so a missing API can never throw.
function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => { /* clipboard denied — leave the label untouched */ });
  };
  return (
    <button type="button" className={`lr-copy${copied ? ' is-copied' : ''}`} onClick={copy}>
      {copied ? '✓ COPIED' : 'COPY'}
    </button>
  );
}

// Native browser TTS button — speaks ES/PT terms in the device's stock voice
// (token-free, the same window.speechSynthesis path speechFallback.js owns). The
// lang prop is a BBF code ('es' | 'pt'); warmUpSpeech() primes the iOS engine
// inside the click gesture so the first utterance is never swallowed.
function SpeakBtn({ text, lang = 'es', label = '🔊' }) {
  const supported = browserSpeechSupported();
  if (!supported) return null;
  const speak = () => {
    warmUpSpeech();
    speakWithBrowser({ text, lang }).catch(() => { /* stock voice unavailable — silent */ });
  };
  return (
    <button type="button" className="lr-speak" onClick={speak} aria-label={`Listen: ${text}`}>
      {label}
    </button>
  );
}

// Token-free WebAudio cue — a short oscillator blip for game success/fail tones
// (no audio asset, no network). Resilient: a missing/locked AudioContext is a
// silent no-op so a denied audio permission never breaks the game loop.
let _audioCtx = null;
function playTone(kind) {
  try {
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    _audioCtx = _audioCtx || new Ctx();
    const ctx = _audioCtx;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (kind === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      osc.frequency.setValueAtTime(880, now + 0.08);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, now);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    osc.start(now);
    osc.stop(now + 0.24);
  } catch { /* audio blocked — silent */ }
}

// Deterministic-enough shuffle (Fisher–Yates) for option ordering / deck draws.
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Flatten the category map into a single pool of {es, en, cat} for the games.
const VOCAB_POOL = Object.entries(vocabData).flatMap(([cat, items]) =>
  items.map((v) => ({ ...v, cat })),
);

// ── Adaptive SRS selection ───────────────────────────────────────────────────
// The athlete's per-term Leitner boxes (es term → 1..5), hydrated from Supabase on
// Gym mount. A weaker/newer term is weighted heavier so the games serve the cards
// you're worst at FIRST — following the roadmap now feeds a real review engine.
let VOCAB_BOXES = {};
function setVocabBoxes(map) { VOCAB_BOXES = (map && typeof map === 'object') ? map : {}; }
// weight = 6 − box: an unseen term (box 0) is 6× as likely as a mastered one (box 5).
function weightedPick(pool) {
  let total = 0;
  const weights = pool.map((v) => { const w = 6 - (Number(VOCAB_BOXES[v.es]) || 0); total += w; return w; });
  let r = Math.random() * total;
  for (let i = 0; i < pool.length; i += 1) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[pool.length - 1];
}

// ─── TABS ───────────────────────────────────────────────────────────────────

function TabVocab() {
  const cats = Object.keys(vocabData);
  const [activeCat, setActiveCat] = useState(cats[0]);
  // Stats derived from the live data so they never drift from the arrays.
  const termCount = cats.reduce((n, c) => n + vocabData[c].length, 0);
  return (
    <div>
      <div className="lr-section-label">TASK 1 · BILINGUAL COACH ENGINE</div>
      <div className="lr-section-title">FITNESS VOCABULARY <span>MATRIX</span></div>
      <div className="lr-section-desc">
        Critical Spanish terms across anatomy, nutrition, training science, and
        coaching cues — your daily language gym.
      </div>
      <div className="lr-stats">
        <div className="lr-stat"><div className="lr-stat-num">{termCount}</div><div className="lr-stat-label">Spanish Terms</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{cats.length}</div><div className="lr-stat-label">Categories</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{scripts.length}</div><div className="lr-stat-label">Coach Scripts</div></div>
      </div>
      <div className="lr-chips">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={`lr-chip${activeCat === c ? ' is-active' : ''}`}
            onClick={() => setActiveCat(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="lr-vocab-grid">
        {vocabData[activeCat].map((v, i) => (
          <div className="lr-vocab-item" key={i}>
            <div>
              <div className="lr-vocab-es">{v.es}</div>
              <div className="lr-vocab-cat">{activeCat}</div>
            </div>
            <div className="lr-vocab-rhs">
              <div className="lr-vocab-en">{v.en}</div>
              <SpeakBtn text={v.es} lang="es" />
            </div>
          </div>
        ))}
      </div>

      <hr className="lr-divider" />
      <div className="lr-card-title">COACHING SCRIPTS</div>
      {scripts.map((s, i) => (
        <div className="lr-script" key={i}>
          <div className="lr-script-label">{s.title}</div>
          {s.lines.map((l, j) => (
            <div className="lr-script-line" key={j}>
              <span className="es">&ldquo;{l.es}&rdquo;</span><br />
              <span className="en">{l.en}</span>
            </div>
          ))}
          <CopyBtn text={s.lines.map((l) => `ES: "${l.es}"\nEN: ${l.en}`).join('\n')} />
        </div>
      ))}
    </div>
  );
}

function TabPortuguese() {
  const cats = ['all', 'social', 'airport/nav', 'food', 'gym', 'social+'];
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? ptPhrases : ptPhrases.filter((p) => p.cat === filter);
  return (
    <div>
      <div className="lr-section-label">TASK 2 · RIO READY PROTOCOL</div>
      <div className="lr-section-title">SOCIAL <span>SURVIVAL KIT</span></div>
      <div className="lr-section-desc">
        {ptPhrases.length} high-leverage Brazilian Portuguese phrases for airports,
        food, gym culture, and making connections. Memorize 10/week.
      </div>
      <div className="lr-chips">
        {cats.map((c) => (
          <button
            key={c}
            type="button"
            className={`lr-chip lr-chip--pt${filter === c ? ' is-active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c === 'all' ? 'ALL' : c}
          </button>
        ))}
      </div>
      {filtered.map((p) => (
        <div className="lr-phrase" key={p.n}>
          <div className="lr-phrase-num">{String(p.n).padStart(2, '0')}</div>
          <div style={{ flex: 1 }}>
            <div>
              <span className="lr-phrase-pt">{p.pt}</span>
              <span className="lr-phrase-tag">{p.cat}</span>
            </div>
            <div className="lr-phrase-en">{p.en}</div>
          </div>
          <SpeakBtn text={p.pt} lang="pt" />
        </div>
      ))}
      <hr className="lr-divider" />
      <div className="lr-card-title">30-DAY EAR TRAINING SCHEDULE · PIMSLEUR</div>
      {pimsleurSchedule.map((w, i) => (
        <div className="lr-week" key={i}>
          <div className="lr-week-num">{w.week}</div>
          <div className="lr-week-content">
            <div className="lr-week-title">{w.title}</div>
            <div className="lr-week-detail">{w.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabRoleplay() {
  const [selected, setSelected] = useState(null);
  return (
    <div>
      <div className="lr-section-label">TASK 3 · INTERACTIVE DRILLS</div>
      <div className="lr-section-title">GOD-MODE <span>ROLEPLAY</span></div>
      <div className="lr-section-desc">
        Select a scenario. Copy the trigger prompt — paste it to your coach AI and
        it responds ONLY in the target language with live correction on errors.
      </div>
      <div
        className="lr-rp-trigger"
        role="button"
        tabIndex={0}
        onClick={() => setSelected(selected === null ? 0 : null)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(selected === null ? 0 : null); } }}
      >
        <div className="lr-rp-trigger-label">ACTIVATE IMMERSION MODE</div>
        <div className="lr-rp-trigger-title">⚡ GOD MODE ENGAGED</div>
      </div>
      {scenarios.map((s, i) => (
        <div
          key={i}
          className={`lr-scenario${selected === i ? ' is-selected' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => setSelected(selected === i ? null : i)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(selected === i ? null : i); } }}
        >
          <div className="lr-scenario-head">
            <div className="lr-scenario-title">{s.title}</div>
            <span className={`lr-scenario-lang lr-scenario-lang--${s.lang === 'ES' ? 'es' : 'pt'}`}>{s.lang}</span>
          </div>
          <div className="lr-scenario-desc">{s.desc}</div>
          {selected === i && (
            <>
              <div className="lr-scenario-prompt">
                <strong className="lr-prompt-label">📋 PASTE THIS PROMPT TO TRIGGER GOD MODE:</strong>
                &ldquo;Act as a local in this scenario. Respond ONLY in {s.lang === 'ES' ? 'Spanish' : 'Brazilian Portuguese'}. If I make a grammar mistake, stop and correct me immediately with the format: ❌ [my error] → ✅ [correction] + brief explanation. Then continue the scene. Here is the scenario: <br />{s.prompt}&rdquo;
              </div>
              <div className="lr-correction">
                <div className="lr-correction-label">⚡ COMMON ERRORS TO WATCH</div>
                <div className="lr-correction-text">{s.correction}</div>
              </div>
              <CopyBtn text={`Act as a local in this scenario. Respond ONLY in ${s.lang === 'ES' ? 'Spanish' : 'Brazilian Portuguese'}. If I make a grammar mistake, stop and correct me immediately with the format: ❌ [my error] → ✅ [correction] + brief explanation. Then continue the scene.\n\nScenario: ${s.desc}\n\nOpening: ${s.prompt}`} />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function TabIntentions() {
  return (
    <div>
      <div className="lr-section-label">TASK 4 · 175 LB GOAL INTEGRATION</div>
      <div className="lr-section-title">CARDIO <span>INTENTION STATEMENTS</span></div>
      <div className="lr-section-desc">
        Recite these during your cardio sessions. Spanish first, then Portuguese.
        Speak them out loud — this doubles as language practice and manifestation
        work. Own every word.
      </div>
      {intentions.map((item, i) => (
        <div className="lr-intention" key={i}>
          <div className="lr-intention-week">{item.week}</div>
          <div className="lr-intention-theme">{item.theme}</div>
          <div className="lr-two-col">
            <div className="lr-intention-col">
              <div className="lr-intention-lang lr-intention-lang--es">🇪🇸 ESPAÑOL</div>
              <div className="lr-intention-text">&ldquo;{item.es}&rdquo;</div>
              <CopyBtn text={item.es} />
            </div>
            <div className="lr-intention-col">
              <div className="lr-intention-lang lr-intention-lang--pt">🇧🇷 PORTUGUÊS</div>
              <div className="lr-intention-text">&ldquo;{item.pt}&rdquo;</div>
              <CopyBtn text={item.pt} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabRoadmap() {
  return (
    <div>
      <div className="lr-section-label">90-DAY STRUCTURED ROADMAP</div>
      <div className="lr-section-title">THE <span>PROTOCOL</span></div>
      <div className="lr-section-desc">
        Four phases, each built around the BBF Lab&rsquo;s own engine — the Vocab Gym games,
        Voice Studio, 🔊 soundboards, and your spaced-repetition mastery. Slot it into your
        2-hour sessions: warm-up for the Vocab Gym, cooldown for Voice Studio + Sentence
        Builder, cardio for Intentions.
      </div>

      <div className="lr-stats">
        <div className="lr-stat"><div className="lr-stat-num">90</div><div className="lr-stat-label">Days</div></div>
        <div className="lr-stat"><div className="lr-stat-num">2</div><div className="lr-stat-label">Languages</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{roadmapPhases.length}</div><div className="lr-stat-label">Phases</div></div>
        <div className="lr-stat"><div className="lr-stat-num">5</div><div className="lr-stat-label">Game Modes</div></div>
      </div>

      <div className="lr-template">
        <div className="lr-card-title">DAILY INTEGRATION TEMPLATE</div>
        <div className="lr-template-grid">
          {INTEGRATION_TEMPLATE.map((t, i) => (
            <div className="lr-template-cell" key={i}>
              <div className="lr-template-time">{t.time}</div>
              <div className="lr-template-act">{t.act}</div>
            </div>
          ))}
        </div>
      </div>

      {roadmapPhases.map((p, i) => (
        <div className="lr-phase" key={i}>
          <div className="lr-phase-header">
            <div className="lr-phase-num">{p.num}</div>
            <div className="lr-phase-info">
              <div className="lr-phase-name">{p.name}</div>
              <div className="lr-phase-weeks">{p.weeks}</div>
            </div>
          </div>
          <div className="lr-two-col lr-phase-focus">
            <div className="lr-focus-card lr-focus-card--es">
              <div className="lr-card-subtitle">🇪🇸 ESPAÑOL FOCUS</div>
              <div className="lr-focus-text">{p.es}</div>
            </div>
            <div className="lr-focus-card lr-focus-card--pt">
              <div className="lr-card-subtitle lr-card-subtitle--pt">🇧🇷 PORTUGUÊS FOCUS</div>
              <div className="lr-focus-text">{p.pt}</div>
            </div>
          </div>
          <div className="lr-day-grid">
            {DAYS.map((d) => <div className="lr-day-header" key={d}>{d}</div>)}
            {p.daily.map((act, j) => (
              <div className="lr-day-slot" key={j}>
                <div className="lr-day-slot-act">{act}</div>
              </div>
            ))}
          </div>
          <CopyBtn text={`PHASE ${p.num} — ${p.name} (${p.weeks})\n\nES: ${p.es}\nPT: ${p.pt}\n\nWeekly Daily Schedule:\n${DAYS.map((d, j) => `${d}: ${p.daily[j]}`).join('\n')}`} />
        </div>
      ))}

      <div className="lr-benchmarks">
        <div className="lr-card-title">✅ 90-DAY SUCCESS BENCHMARKS</div>
        {BENCHMARKS.map((b, i) => (
          <div className="lr-benchmark" key={i}>
            <span className="lr-benchmark-num">{i + 1}</span>
            <span className="lr-benchmark-text">{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── VOCAB GYM (Pillar 1 · gamified quizzing) ────────────────────────────────
// Turns the static Vocabulary Matrix into an active "language gym" with two play
// styles from the BBF Lab directive: Speed Matrix (multiple-choice time attack
// with combo streaks + countdown + WebAudio tones) and Flip Drill (flashcard
// recall with native TTS). All client-side over the existing VOCAB_POOL.

const SPEED_ROUND = 10;       // questions per Speed Matrix round
const SPEED_SECONDS = 8;      // seconds allotted per question

// Build one Speed Matrix question: an English prompt + 4 ES options (1 correct,
// 3 distractors drawn from the rest of the pool, de-duplicated on translation).
function makeQuestion(pool) {
  const correct = weightedPick(pool); // adaptive: weak/unseen terms surface first
  const distractors = shuffle(pool.filter((v) => v.es !== correct.es)).slice(0, 3);
  const options = shuffle([correct, ...distractors]);
  return { prompt: correct.en, answer: correct.es, cat: correct.cat, options };
}

function SpeedMatrix() {
  const [phase, setPhase] = useState('idle'); // idle | playing | done
  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState(null);
  const [picked, setPicked] = useState(null);   // selected es string (locks the row)
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(SPEED_SECONDS);
  const advanceRef = useRef(null);

  const begin = () => {
    setScore(0); setStreak(0); setBest(0); setCorrectCount(0);
    setQIndex(0); setPicked(null);
    setQuestion(makeQuestion(VOCAB_POOL));
    setTimeLeft(SPEED_SECONDS);
    setPhase('playing');
  };

  // Lock the answer, score it, then queue the next question.
  const lockAnswer = (choice) => {
    if (picked !== null || !question) return;
    setPicked(choice ?? '__timeout__');
    const right = choice === question.answer;
    recordVocabAttempt(question.answer, right); // SRS: the ES term tested
    if (right) {
      playTone('success');
      setStreak((s) => {
        const ns = s + 1;
        setBest((b) => Math.max(b, ns));
        // Combo bonus: +10 base, +2 per prior streak link.
        setScore((sc) => sc + 10 + s * 2);
        return ns;
      });
      setCorrectCount((c) => c + 1);
    } else {
      playTone('fail');
      setStreak(0);
    }
    advanceRef.current = setTimeout(() => {
      const next = qIndex + 1;
      if (next >= SPEED_ROUND) { setPhase('done'); return; }
      setQIndex(next);
      setQuestion(makeQuestion(VOCAB_POOL));
      setPicked(null);
      setTimeLeft(SPEED_SECONDS);
    }, 900);
  };

  // Per-question countdown. Re-armed on every new question (keyed by qIndex), and
  // a timeout auto-locks as a miss. Cleared when an answer is picked.
  useEffect(() => {
    if (phase !== 'playing' || picked !== null) return undefined;
    const t = setTimeout(() => {
      // Tick down; on the final second auto-lock the question as a miss. Keeping
      // the setState inside the timeout (never in the effect body) avoids the
      // cascading-render lint and is the genuine async source here anyway.
      if (timeLeft <= 1) lockAnswer(null);
      else setTimeLeft((s) => s - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [phase, picked, timeLeft, qIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist the personal best + fire-and-forget cloud sync once the round settles.
  useEffect(() => { if (phase === 'done') recordGameResult('speed', score, best); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  // Clean up a pending advance on unmount.
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  if (phase === 'idle') {
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">⚡ SPEED MATRIX</div>
        <div className="lr-game-start-desc">
          {SPEED_ROUND} rapid questions · {SPEED_SECONDS}s each. Match the English term to
          the correct Spanish. Build a combo streak — every consecutive hit is worth more.
        </div>
        {readBest('speed') > 0 ? <div className="lr-game-best">🏆 BEST {readBest('speed')}</div> : null}
        <button type="button" className="lr-game-btn" onClick={begin}>START ROUND</button>
      </div>
    );
  }

  if (phase === 'done') {
    const pct = Math.round((correctCount / SPEED_ROUND) * 100);
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">ROUND COMPLETE</div>
        <div className="lr-game-score-final">{score}<span> PTS</span></div>
        <div className="lr-game-summary">
          <div><strong>{correctCount}/{SPEED_ROUND}</strong> correct ({pct}%)</div>
          <div>Best combo: <strong>×{best}</strong></div>
        </div>
        <button type="button" className="lr-game-btn" onClick={begin}>PLAY AGAIN</button>
      </div>
    );
  }

  const pct = (timeLeft / SPEED_SECONDS) * 100;
  return (
    <div className="lr-game">
      <div className="lr-game-hud">
        <div className="lr-game-hud-cell"><span>SCORE</span><strong>{score}</strong></div>
        <div className="lr-game-hud-cell"><span>STREAK</span><strong className={streak >= 3 ? 'lr-hot' : ''}>×{streak}</strong></div>
        <div className="lr-game-hud-cell"><span>Q</span><strong>{qIndex + 1}/{SPEED_ROUND}</strong></div>
      </div>
      <div className="lr-game-timer"><div className="lr-game-timer-bar" style={{ width: `${pct}%` }} /></div>
      <div className="lr-game-prompt">
        <div className="lr-game-prompt-cat">{question.cat}</div>
        <div className="lr-game-prompt-term">{question.prompt}</div>
      </div>
      <div className="lr-game-options">
        {question.options.map((opt) => {
          let cls = 'lr-game-opt';
          if (picked !== null) {
            if (opt.es === question.answer) cls += ' is-correct';
            else if (opt.es === picked) cls += ' is-wrong';
          }
          return (
            <button
              key={opt.es}
              type="button"
              className={cls}
              disabled={picked !== null}
              onClick={() => lockAnswer(opt.es)}
            >
              {opt.es}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FlipDrill() {
  const [deck, setDeck] = useState(() => shuffle(VOCAB_POOL));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [seen, setSeen] = useState(0);
  const card = deck[idx];

  const next = (gotIt) => {
    setSeen((s) => s + 1);
    if (gotIt) setKnown((k) => k + 1);
    setFlipped(false);
    setIdx((i) => (i + 1) % deck.length);
  };
  const reshuffle = () => { setDeck(shuffle(VOCAB_POOL)); setIdx(0); setFlipped(false); setKnown(0); setSeen(0); };

  return (
    <div className="lr-flip">
      <div className="lr-flip-stats">
        <span>Known <strong>{known}</strong></span>
        <span>Seen <strong>{seen}</strong></span>
        <button type="button" className="lr-flip-shuffle" onClick={reshuffle}>↻ SHUFFLE</button>
      </div>
      <div
        className={`lr-flip-card${flipped ? ' is-flipped' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); } }}
      >
        {!flipped ? (
          <>
            <div className="lr-flip-side-label">🇪🇸 ESPAÑOL</div>
            <div className="lr-flip-term">{card.es}</div>
            <div className="lr-flip-hint">tap to reveal</div>
          </>
        ) : (
          <>
            <div className="lr-flip-side-label">🇬🇧 ENGLISH</div>
            <div className="lr-flip-term lr-flip-term--en">{card.en}</div>
            <div className="lr-flip-cat">{card.cat}</div>
          </>
        )}
      </div>
      <div className="lr-flip-actions">
        <SpeakBtn text={card.es} lang="es" label="🔊 HEAR IT" />
        <button type="button" className="lr-flip-miss" onClick={() => next(false)}>↻ REVIEW</button>
        <button type="button" className="lr-flip-got" onClick={() => next(true)}>✓ GOT IT</button>
      </div>
    </div>
  );
}

// Personal best per game mode. localStorage is the INSTANT layer (best shows with
// zero latency); Supabase is the cross-device source of truth (loaded on mount,
// written on completion). Both keep the max, so they converge.
function readBest(mode) { try { return Number(localStorage.getItem(`bbf.lr.best.${mode}`)) || 0; } catch { return 0; } }
function saveBest(mode, val) { try { if (val > readBest(mode)) localStorage.setItem(`bbf.lr.best.${mode}`, String(val)); } catch { /* quota */ } }
// Pull a server best down into localStorage (cross-device sync IN, on login).
function hydrateBest(mode, val) { try { if (Number(val) > readBest(mode)) localStorage.setItem(`bbf.lr.best.${mode}`, String(Math.round(Number(val)))); } catch { /* quota */ } }
// A finished round → localStorage best + a fire-and-forget cloud upsert (sync OUT).
function recordGameResult(mode, score, streak) {
  saveBest(mode, score);
  saveLanguageScore(mode, score, streak); // best-effort; resolves {ok:false} off-session
}

// Speak an ES term in the free on-device voice (the same speechFallback path SpeakBtn
// owns); warmUpSpeech primes iOS inside the gesture so the first cue isn't swallowed.
function speakEs(text) {
  warmUpSpeech();
  speakWithBrowser({ text, lang: 'es' }).catch(() => { /* stock voice unavailable — silent */ });
}

// ─── LISTENING LAB (ear-training · the soundboard AS a game) ─────────────────
// The free voice SPEAKS a Spanish term; the athlete taps the English it means.
// Untimed (replay as needed) so it trains the ear, not reading speed.
const LISTEN_ROUND = 10;
function makeListenQuestion(pool) {
  const correct = weightedPick(pool); // adaptive: weak/unseen terms surface first
  const distractors = shuffle(pool.filter((v) => v.en !== correct.en)).slice(0, 3);
  return { audio: correct.es, answer: correct.en, cat: correct.cat, options: shuffle([correct, ...distractors]) };
}

function ListeningLab() {
  const [phase, setPhase] = useState('idle');
  const [qIndex, setQIndex] = useState(0);
  const [question, setQuestion] = useState(null);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const advanceRef = useRef(null);

  const begin = () => {
    setScore(0); setStreak(0); setBest(0); setCorrectCount(0); setQIndex(0); setPicked(null);
    setQuestion(makeListenQuestion(VOCAB_POOL));
    setPhase('playing');
  };

  // The prompt IS the audio: speak the term on each new question.
  useEffect(() => { if (phase === 'playing' && question) speakEs(question.audio); }, [question, phase]);
  // Persist the personal best once the round settles (score is final by now).
  useEffect(() => { if (phase === 'done') recordGameResult('listen', score, best); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const lockAnswer = (choice) => {
    if (picked !== null || !question) return;
    setPicked(choice);
    recordVocabAttempt(question.audio, choice === question.answer); // SRS: the ES term just heard
    if (choice === question.answer) {
      playTone('success');
      setStreak((s) => { const ns = s + 1; setBest((b) => Math.max(b, ns)); setScore((sc) => sc + 10 + s * 2); return ns; });
      setCorrectCount((c) => c + 1);
    } else { playTone('fail'); setStreak(0); }
    advanceRef.current = setTimeout(() => {
      const next = qIndex + 1;
      if (next >= LISTEN_ROUND) { setPhase('done'); return; }
      setQIndex(next); setQuestion(makeListenQuestion(VOCAB_POOL)); setPicked(null);
    }, 1000);
  };

  if (phase === 'idle') {
    const pb = readBest('listen');
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">🎧 LISTENING LAB</div>
        <div className="lr-game-start-desc">
          {LISTEN_ROUND} rounds. The coach <strong>speaks a Spanish term</strong> in the free
          on-device voice — tap the English it means. Pure ear-training; replay the audio as
          often as you need.
        </div>
        {pb > 0 ? <div className="lr-game-best">🏆 BEST {pb}</div> : null}
        <button type="button" className="lr-game-btn" onClick={begin}>START ROUND</button>
      </div>
    );
  }
  if (phase === 'done') {
    const pct = Math.round((correctCount / LISTEN_ROUND) * 100);
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">ROUND COMPLETE</div>
        <div className="lr-game-score-final">{score}<span> PTS</span></div>
        <div className="lr-game-summary">
          <div><strong>{correctCount}/{LISTEN_ROUND}</strong> correct ({pct}%)</div>
          <div>Best combo: <strong>×{best}</strong></div>
        </div>
        <button type="button" className="lr-game-btn" onClick={begin}>PLAY AGAIN</button>
      </div>
    );
  }
  return (
    <div className="lr-game">
      <div className="lr-game-hud">
        <div className="lr-game-hud-cell"><span>SCORE</span><strong>{score}</strong></div>
        <div className="lr-game-hud-cell"><span>STREAK</span><strong className={streak >= 3 ? 'lr-hot' : ''}>×{streak}</strong></div>
        <div className="lr-game-hud-cell"><span>Q</span><strong>{qIndex + 1}/{LISTEN_ROUND}</strong></div>
      </div>
      <div className="lr-listen-cue">
        <button type="button" className="lr-listen-play" onClick={() => speakEs(question.audio)} aria-label="Replay the Spanish term">🔊</button>
        <div className="lr-listen-hint">{question.cat} · tap to replay</div>
      </div>
      <div className="lr-game-options">
        {question.options.map((opt) => {
          let cls = 'lr-game-opt';
          if (picked !== null) {
            if (opt.en === question.answer) cls += ' is-correct';
            else if (opt.en === picked) cls += ' is-wrong';
          }
          return (
            <button key={opt.en} type="button" className={cls} disabled={picked !== null} onClick={() => lockAnswer(opt.en)}>
              {opt.en}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MATCH MADNESS (timed ES↔EN pairing) ─────────────────────────────────────
const MATCH_PAIRS = 6;
function dealMatch() {
  return shuffle(VOCAB_POOL).slice(0, MATCH_PAIRS).map((v, i) => ({ id: i, es: v.es, en: v.en }));
}

function MatchMadness() {
  const [phase, setPhase] = useState('idle');
  const [esCol, setEsCol] = useState([]);
  const [enCol, setEnCol] = useState([]);
  const [selEs, setSelEs] = useState(null);
  const [selEn, setSelEn] = useState(null);
  const [matchedIds, setMatchedIds] = useState([]);
  const [wrong, setWrong] = useState(false);
  const [misses, setMisses] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const clearRef = useRef(null);
  const score = Math.max(0, MATCH_PAIRS * 100 - misses * 15 - elapsed * 2);

  const begin = () => {
    const pairs = dealMatch();
    setEsCol(shuffle(pairs.map((p) => ({ id: p.id, es: p.es }))));
    setEnCol(shuffle(pairs.map((p) => ({ id: p.id, en: p.en }))));
    setSelEs(null); setSelEn(null); setMatchedIds([]); setWrong(false); setMisses(0); setElapsed(0);
    setPhase('playing');
  };

  // Count-up timer while playing.
  useEffect(() => {
    if (phase !== 'playing') return undefined;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Resolve a pair in the CLICK handler (never in an effect — synchronous setState
  // inside an effect cascades renders). pick() reads the other column's current
  // selection; resolve() scores the pair.
  const resolve = (esId, enId) => {
    if (esId === enId) {
      playTone('success');
      recordVocabAttempt(esCol.find((t) => t.id === esId)?.es, true); // SRS: a clean pair
      const willComplete = matchedIds.length + 1 >= MATCH_PAIRS;
      setMatchedIds((m) => (m.includes(esId) ? m : [...m, esId]));
      setSelEs(null); setSelEn(null);
      if (willComplete) setPhase('done');
    } else {
      playTone('fail');
      setSelEs(esId); setSelEn(enId); setWrong(true); setMisses((x) => x + 1);
      clearRef.current = setTimeout(() => { setSelEs(null); setSelEn(null); setWrong(false); }, 650);
    }
  };
  const pick = (col, id) => {
    if (wrong || matchedIds.includes(id)) return;
    if (col === 'es') {
      if (selEn === null) setSelEs(id); else resolve(id, selEn);
    } else if (selEs === null) {
      setSelEn(id);
    } else {
      resolve(selEs, id);
    }
  };

  useEffect(() => { if (phase === 'done') recordGameResult('match', score, 0); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (clearRef.current) clearTimeout(clearRef.current); }, []);

  if (phase === 'idle') {
    const pb = readBest('match');
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">🔗 MATCH MADNESS</div>
        <div className="lr-game-start-desc">
          Pair all {MATCH_PAIRS} Spanish terms to their English meaning, fast. Tap a Spanish
          word, then its match. Fewer misses + a quicker clock = a higher score.
        </div>
        {pb > 0 ? <div className="lr-game-best">🏆 BEST {pb}</div> : null}
        <button type="button" className="lr-game-btn" onClick={begin}>START ROUND</button>
      </div>
    );
  }
  if (phase === 'done') {
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">ALL MATCHED</div>
        <div className="lr-game-score-final">{score}<span> PTS</span></div>
        <div className="lr-game-summary">
          <div>Time: <strong>{elapsed}s</strong></div>
          <div>Misses: <strong>{misses}</strong></div>
        </div>
        <button type="button" className="lr-game-btn" onClick={begin}>PLAY AGAIN</button>
      </div>
    );
  }
  const cellCls = (id, sel) => {
    let c = 'lr-match-cell';
    if (matchedIds.includes(id)) c += ' is-matched';
    else if (sel === id) c += wrong ? ' is-wrong' : ' is-sel';
    return c;
  };
  const frozen = wrong; // brief input freeze during the mismatch flash
  return (
    <div className="lr-game">
      <div className="lr-game-hud">
        <div className="lr-game-hud-cell"><span>MATCHED</span><strong>{matchedIds.length}/{MATCH_PAIRS}</strong></div>
        <div className="lr-game-hud-cell"><span>MISSES</span><strong className={misses === 0 ? 'lr-hot' : ''}>{misses}</strong></div>
        <div className="lr-game-hud-cell"><span>TIME</span><strong>{elapsed}s</strong></div>
      </div>
      <div className="lr-match-cols">
        <div className="lr-match-col">
          {esCol.map((it) => (
            <button key={`es-${it.id}`} type="button" className={cellCls(it.id, selEs)}
              disabled={frozen || matchedIds.includes(it.id)} onClick={() => pick('es', it.id)}>
              {it.es}
            </button>
          ))}
        </div>
        <div className="lr-match-col">
          {enCol.map((it) => (
            <button key={`en-${it.id}`} type="button" className={cellCls(it.id, selEn)}
              disabled={frozen || matchedIds.includes(it.id)} onClick={() => pick('en', it.id)}>
              {it.en}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── SENTENCE BUILDER (tap-to-arrange · real sentences, not bare terms) ──────
// Data source: the Rio Ready / Social Survival Kit (Portuguese) + the Spanish coach
// scripts — both are complete sentences. Words are scrambled into a bank; the user
// taps them into the correct order. Filtered to 3–9 words: long enough to scramble
// meaningfully, short enough to solve.
function sentencePool() {
  const fromPt = ptPhrases.map((p) => ({ text: p.pt, en: p.en, lang: 'pt' }));
  const fromEs = scripts.flatMap((sc) => sc.lines.map((l) => ({ text: l.es, en: l.en, lang: 'es' })));
  return [...fromPt, ...fromEs].filter((s) => {
    const w = String(s.text).trim().split(/\s+/).length;
    return w >= 3 && w <= 9;
  });
}
const SENTENCE_POOL = sentencePool();
const SENTENCE_ROUND = 8;

function SentenceBuilder() {
  const [phase, setPhase] = useState('idle');
  const [pool, setPool] = useState([]);
  const [rIdx, setRIdx] = useState(0);
  const [bank, setBank] = useState([]);    // [{ id, word }] — fixed token identities
  const [built, setBuilt] = useState([]);  // [id...] — the user's arrangement
  const [checked, setChecked] = useState(null); // null | 'correct' | 'wrong'
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const advanceRef = useRef(null);
  const current = pool[rIdx] || null;

  const load = (sentence) => {
    const toks = String(sentence.text).trim().split(/\s+/).map((w, i) => ({ id: i, word: w }));
    setBank(shuffle(toks)); setBuilt([]); setChecked(null);
  };
  const begin = () => {
    const p = shuffle(SENTENCE_POOL).slice(0, SENTENCE_ROUND);
    setPool(p); setRIdx(0); setScore(0); setStreak(0); setBest(0); setCorrectCount(0);
    load(p[0]); setPhase('playing');
  };
  useEffect(() => { if (phase === 'done') recordGameResult('sentence', score, best); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const tapBank = (id) => { if (checked === 'correct' || built.includes(id)) return; setBuilt((b) => [...b, id]); setChecked(null); };
  const tapBuilt = (id) => { if (checked === 'correct') return; setBuilt((b) => b.filter((x) => x !== id)); setChecked(null); };
  const clearBuilt = () => { if (checked === 'correct') return; setBuilt([]); setChecked(null); };

  const check = () => {
    if (!current || checked === 'correct' || built.length === 0) return;
    const builtText = built.map((id) => bank.find((t) => t.id === id)?.word).join(' ');
    if (builtText === String(current.text).trim()) {
      playTone('success'); setChecked('correct');
      setStreak((s) => { const ns = s + 1; setBest((b) => Math.max(b, ns)); setScore((sc) => sc + 15 + s * 3); return ns; });
      setCorrectCount((c) => c + 1);
      advanceRef.current = setTimeout(() => {
        const next = rIdx + 1;
        if (next >= pool.length) { setPhase('done'); return; }
        setRIdx(next); load(pool[next]);
      }, 1100);
    } else { playTone('fail'); setChecked('wrong'); setStreak(0); }
  };
  const skip = () => {
    if (checked === 'correct') return;
    setStreak(0);
    const next = rIdx + 1;
    if (next >= pool.length) { setPhase('done'); return; }
    setRIdx(next); load(pool[next]);
  };

  if (phase === 'idle') {
    const pb = readBest('sentence');
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">🧩 SENTENCE BUILDER</div>
        <div className="lr-game-start-desc">
          {SENTENCE_ROUND} real sentences from the Rio Ready kit + coach scripts. The words are
          scrambled — tap them into the correct order. Hear the target in the free voice any time.
        </div>
        {pb > 0 ? <div className="lr-game-best">🏆 BEST {pb}</div> : null}
        <button type="button" className="lr-game-btn" onClick={begin}>START ROUND</button>
      </div>
    );
  }
  if (phase === 'done') {
    const pct = Math.round((correctCount / Math.max(1, pool.length)) * 100);
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">ROUND COMPLETE</div>
        <div className="lr-game-score-final">{score}<span> PTS</span></div>
        <div className="lr-game-summary">
          <div><strong>{correctCount}/{pool.length}</strong> built ({pct}%)</div>
          <div>Best combo: <strong>×{best}</strong></div>
        </div>
        <button type="button" className="lr-game-btn" onClick={begin}>PLAY AGAIN</button>
      </div>
    );
  }
  const flag = current.lang === 'pt' ? '🇧🇷' : '🇪🇸';
  return (
    <div className="lr-game">
      <div className="lr-game-hud">
        <div className="lr-game-hud-cell"><span>SCORE</span><strong>{score}</strong></div>
        <div className="lr-game-hud-cell"><span>STREAK</span><strong className={streak >= 3 ? 'lr-hot' : ''}>×{streak}</strong></div>
        <div className="lr-game-hud-cell"><span>#</span><strong>{rIdx + 1}/{pool.length}</strong></div>
      </div>
      <div className="lr-sb-prompt">
        <span className="lr-sb-flag" aria-hidden="true">{flag}</span>
        <span className="lr-sb-en">{current.en}</span>
        <SpeakBtn text={current.text} lang={current.lang} label="🔊" />
      </div>
      <div className={`lr-sb-built${checked === 'correct' ? ' is-correct' : ''}${checked === 'wrong' ? ' is-wrong' : ''}`} data-testid="lr-sb-built">
        {built.length === 0 ? (
          <span className="lr-sb-placeholder">tap words below to build the sentence…</span>
        ) : built.map((id) => {
          const t = bank.find((x) => x.id === id);
          return <button key={id} type="button" className="lr-sb-word" onClick={() => tapBuilt(id)}>{t?.word}</button>;
        })}
      </div>
      <div className="lr-sb-bank" data-testid="lr-sb-bank">
        {bank.filter((t) => !built.includes(t.id)).map((t) => (
          <button key={t.id} type="button" className="lr-sb-word lr-sb-word--bank" onClick={() => tapBank(t.id)}>{t.word}</button>
        ))}
      </div>
      <div className="lr-sb-actions">
        <button type="button" className="lr-sb-btn lr-sb-btn--ghost" onClick={clearBuilt} disabled={checked === 'correct'}>CLEAR</button>
        <button type="button" className="lr-sb-btn lr-sb-btn--ghost" onClick={skip} disabled={checked === 'correct'}>SKIP →</button>
        <button type="button" className="lr-sb-btn lr-sb-btn--go" onClick={check} disabled={checked === 'correct' || built.length === 0}>CHECK</button>
      </div>
    </div>
  );
}

function TabVocabGym() {
  const [mode, setMode] = useState('speed');
  const [mastery, setMastery] = useState(null);

  // Cross-device sync: on mount + each mode switch, pull the athlete's bests into
  // localStorage and refresh the spaced-repetition mastery summary. Best-effort —
  // a missing session/server just leaves the local-only experience intact.
  useEffect(() => {
    let alive = true;
    loadLanguageProgress().then((res) => {
      if (!alive || !res || !res.ok) return;
      Object.entries(res.scores || {}).forEach(([m, s]) => { if (s && s.best_score != null) hydrateBest(m, s.best_score); });
      setMastery(res.mastery || null);
      setVocabBoxes(res.boxes || {}); // adaptive SRS weighting for Speed Matrix + Listening Lab
    });
    return () => { alive = false; };
  }, [mode]);

  const m = mastery;
  return (
    <div>
      <div className="lr-section-label">TASK 5 · THE VOCABULARY GYM</div>
      <div className="lr-section-title">VOCAB <span>GYM</span></div>
      <div className="lr-section-desc">
        Your daily reps. Train the {VOCAB_POOL.length}-term matrix as an active game — read it,
        hear it, race the clock, or rebuild the sentence. Five modes, zero tokens; your scores +
        spaced-repetition mastery sync to your account across every device.
      </div>
      {m && m.terms > 0 ? (
        <div className="lr-mastery" data-testid="lr-mastery">
          <div className="lr-mastery-cell"><strong>{m.terms}</strong><span>SEEN</span></div>
          <div className="lr-mastery-cell"><strong className="lr-mastery-grn">{m.mastered}</strong><span>MASTERED</span></div>
          <div className="lr-mastery-cell"><strong className="lr-mastery-yel">{m.reviewing}</strong><span>REVIEWING</span></div>
          <div className="lr-mastery-cell"><strong>{m.attempts ? Math.round((m.correct / m.attempts) * 100) : 0}%</strong><span>ACCURACY</span></div>
        </div>
      ) : null}
      <div className="lr-chips">
        <button type="button" className={`lr-chip${mode === 'speed' ? ' is-active' : ''}`} onClick={() => setMode('speed')}>⚡ SPEED MATRIX</button>
        <button type="button" className={`lr-chip${mode === 'listen' ? ' is-active' : ''}`} onClick={() => setMode('listen')}>🎧 LISTENING LAB</button>
        <button type="button" className={`lr-chip${mode === 'match' ? ' is-active' : ''}`} onClick={() => setMode('match')}>🔗 MATCH MADNESS</button>
        <button type="button" className={`lr-chip${mode === 'sentence' ? ' is-active' : ''}`} onClick={() => setMode('sentence')}>🧩 SENTENCE BUILDER</button>
        <button type="button" className={`lr-chip${mode === 'flip' ? ' is-active' : ''}`} onClick={() => setMode('flip')}>🃏 FLIP DRILL</button>
      </div>
      {mode === 'speed' ? <SpeedMatrix />
        : mode === 'listen' ? <ListeningLab />
          : mode === 'match' ? <MatchMadness />
            : mode === 'sentence' ? <SentenceBuilder />
              : <FlipDrill />}
    </div>
  );
}

// ─── VOICE STUDIO (Pillar 2 · pronunciation evaluator) ───────────────────────
// Real-time speech-to-text scoring via webkitSpeechRecognition (useSpeechEvaluator).
// The user reads a target phrase aloud; the transcript is diffed word-by-word and
// color-coded green (matched) / red (missed). Drills draw from the Cardio Intention
// statements and the coaching cues — recite-out-loud practice that doubles as the
// manifestation work in the Intentions tab.

const VOICE_DRILLS = [
  ...intentions.flatMap((it) => ([
    { lang: 'es', text: it.es, label: `🇪🇸 ${it.theme}`, group: 'Intentions' },
    { lang: 'pt', text: it.pt, label: `🇧🇷 ${it.theme}`, group: 'Intentions' },
  ])),
  ...vocabData['MOTIVATION & CUES'].map((v) => ({ lang: 'es', text: v.es, label: `🇪🇸 ${v.en}`, group: 'Coach Cues' })),
];

const ERROR_MESSAGES = {
  network: "Network connection issue. Check your internet and try again.",
  "network-offline": "You appear to be offline. Check your internet connection.",
  "network-blocked": "Speech recognition is blocked by your network. This feature requires access to Google's speech API, which may be restricted by your network policy or proxy settings. Try using a different network, or contact your network administrator.",
  "not-allowed": "Microphone permission denied. Enable permissions in your browser settings.",
  "permission-denied": "Microphone permission denied. Enable permissions in your browser settings.",
  "network-timeout": "Connection timeout. Check your internet and try again.",
  start_failed: "Failed to start microphone. Ensure permissions are granted.",
  unsupported: "Voice recognition not available in this browser.",
};

function VoiceDrill({ drill }) {
  const { supported, listening, transcript, interim, error, start, stop, reset, retry, retryCount } = useSpeechEvaluator(drill.lang);
  const result = useMemo(
    () => (transcript ? comparePhrases(drill.text, transcript) : null),
    [transcript, drill.text],
  );

  // Reset the captured transcript whenever the target drill changes.
  useEffect(() => { reset(); }, [drill.text]); // eslint-disable-line react-hooks/exhaustive-deps

  let scoreClass = '';
  if (result) scoreClass = result.score >= 80 ? 'lr-voice-score--green' : result.score >= 50 ? 'lr-voice-score--yellow' : 'lr-voice-score--red';

  const errorMessage = ERROR_MESSAGES[error] || `Microphone error: ${error}. Please try again.`;

  return (
    <div className="lr-voice">
      <div className="lr-voice-target">
        <div className="lr-voice-target-label">{drill.label}</div>
        <div className="lr-voice-target-text">&ldquo;{drill.text}&rdquo;</div>
        <SpeakBtn text={drill.text} lang={drill.lang} label="🔊 HEAR TARGET" />
      </div>

      {!supported ? (
        <div className="lr-voice-unsupported">
          🎙️ Voice recognition isn't available in this browser. Use Chrome or Safari to
          enable the pronunciation evaluator.
        </div>
      ) : (
        <>
          <div className="lr-voice-controls">
            {!listening ? (
              <button type="button" className="lr-voice-mic" onClick={start}>🎙️ SPEAK</button>
            ) : (
              <button type="button" className="lr-voice-mic is-live" onClick={stop}>
                <span className="lr-voice-wave"><i /><i /><i /><i /><i /></span> LISTENING — TAP TO STOP
              </button>
            )}
            {(transcript || interim) && (
              <button type="button" className="lr-voice-reset" onClick={reset}>↻ CLEAR</button>
            )}
          </div>

          {interim && !result && <div className="lr-voice-interim">{interim}…</div>}

          {result && (
            <div className="lr-voice-result">
              <div className={`lr-voice-score ${scoreClass}`}>{result.score}<span>%</span></div>
              <div className="lr-voice-diff">
                {result.words.map((w, i) => (
                  <span key={i} className={w.matched ? 'lr-word-hit' : 'lr-word-miss'}>{w.text}</span>
                ))}
              </div>
              <div className="lr-voice-heard">You said: <em>{transcript}</em></div>
            </div>
          )}

          {error && error !== 'no-speech' && (
            <div className="lr-voice-err">
              <div>{errorMessage}</div>
              <button type="button" onClick={retry} className="lr-voice-retry">🔄 Try Again{retryCount > 0 ? ` (${retryCount})` : ''}</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TabVoiceStudio() {
  const [i, setI] = useState(0);
  const groups = [...new Set(VOICE_DRILLS.map((d) => d.group))];
  return (
    <div>
      <div className="lr-section-label">TASK 5 · THE VOICE STUDIO</div>
      <div className="lr-section-title">VOICE <span>STUDIO</span></div>
      <div className="lr-section-desc">
        Speak the phrase. The on-device recognizer scores your pronunciation word-by-word —
        green is locked in, red needs another rep. Drills pull from your Cardio Intentions
        and coaching cues. Recite out loud — it's practice and manifestation in one.
      </div>
      <div className="lr-chips">
        {VOICE_DRILLS.map((d, idx) => (
          <button
            key={idx}
            type="button"
            className={`lr-chip${i === idx ? ' is-active' : ''}${d.lang === 'pt' ? ' lr-chip--pt' : ''}`}
            onClick={() => setI(idx)}
          >
            {d.lang === 'es' ? '🇪🇸' : '🇧🇷'} {d.group === 'Intentions' ? d.label.replace(/^🇪🇸 |^🇧🇷 /, '') : d.label.replace(/^🇪🇸 /, '')}
          </button>
        ))}
      </div>
      <div className="lr-voice-meta">{groups.join(' · ')} · {VOICE_DRILLS.length} drills</div>
      <VoiceDrill drill={VOICE_DRILLS[i]} />
    </div>
  );
}

// ─── BBF VIDEO VAULT (Task 6) ────────────────────────────────────────────────
// Token-free, fully client-side language video library — the CEO's curated
// 90-Day Mastery curriculum (languageVideoLibrary.json): 100 lessons, 50 Spanish +
// 50 Brazilian Portuguese, spanning Beginner → Advanced across the four periodized
// study phases. Embedded as native YouTube <iframe>s (the ChampionMindset embed
// pattern — no backend, no API tokens). Each card also carries a direct "Watch on
// YouTube" link as a fallback if an embed is ever restricted.

// Pull the YouTube video id out of a watch URL (?v=…). Resilient to malformed
// rows — returns '' so a bad entry renders a link-only card instead of throwing.
function ytId(url) {
  const m = String(url || '').match(/[?&]v=([^&]+)/);
  return m ? m[1] : '';
}

const LEVEL_ORDER = { Beginner: 0, Intermediate: 1, Advanced: 2 };
const VIDEO_LIB = [...languageVideoLibrary].sort(
  (a, b) => (a.phase - b.phase) || (LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]),
);

function TabVideoVault() {
  const [lang, setLang] = useState('all');   // all | Spanish | Portuguese
  const [level, setLevel] = useState('all'); // all | Beginner | Intermediate | Advanced

  const filtered = VIDEO_LIB.filter(
    (v) => (lang === 'all' || v.language === lang) && (level === 'all' || v.level === level),
  );
  const esCount = VIDEO_LIB.filter((v) => v.language === 'Spanish').length;
  const ptCount = VIDEO_LIB.filter((v) => v.language === 'Portuguese').length;

  return (
    <div>
      <div className="lr-section-label">TASK 6 · BBF VIDEO VAULT</div>
      <div className="lr-section-title">🎬 VIDEO <span>CURRICULUM</span></div>
      <div className="lr-section-desc">
        The curated 90-Day curriculum — {VIDEO_LIB.length} hand-picked lessons streaming
        natively from YouTube, structured by language, level, and study phase. Nothing
        touches the backend or consumes API tokens.
      </div>

      <div className="lr-stats">
        <div className="lr-stat"><div className="lr-stat-num">{VIDEO_LIB.length}</div><div className="lr-stat-label">Lessons</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{esCount}</div><div className="lr-stat-label">🇪🇸 Spanish</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{ptCount}</div><div className="lr-stat-label">🇧🇷 Portuguese</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{filtered.length}</div><div className="lr-stat-label">Showing</div></div>
      </div>

      <div className="lr-chips">
        {['all', 'Spanish', 'Portuguese'].map((c) => (
          <button
            key={c}
            type="button"
            className={`lr-chip${c === 'Portuguese' ? ' lr-chip--pt' : ''}${lang === c ? ' is-active' : ''}`}
            onClick={() => setLang(c)}
          >
            {c === 'all' ? 'ALL LANGUAGES' : c === 'Spanish' ? '🇪🇸 SPANISH' : '🇧🇷 PORTUGUÊS'}
          </button>
        ))}
      </div>
      <div className="lr-chips">
        {['all', 'Beginner', 'Intermediate', 'Advanced'].map((c) => (
          <button
            key={c}
            type="button"
            className={`lr-chip${level === c ? ' is-active' : ''}`}
            onClick={() => setLevel(c)}
          >
            {c === 'all' ? 'ALL LEVELS' : c.toUpperCase()}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="lr-video-empty">No lessons match this filter. Reset a chip above.</div>
      ) : (
        <div className="lr-video-grid">
          {filtered.map((v) => {
            const id = ytId(v.url);
            const es = v.language === 'Spanish';
            return (
              <div className="lr-video-card" key={v.id}>
                <div className="lr-video-frame">
                  {id ? (
                    <iframe
                      className="lr-video-iframe"
                      src={`https://www.youtube.com/embed/${id}`}
                      title={v.title}
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  ) : (
                    <div className="lr-video-noembed">Open on YouTube ↗</div>
                  )}
                </div>
                <div className="lr-video-meta">
                  <div className="lr-video-tags">
                    <span className={`lr-video-flag lr-video-flag--${es ? 'es' : 'pt'}`}>
                      {es ? '🇪🇸 Español' : '🇧🇷 Português'}
                    </span>
                    <span className="lr-video-level">{v.level}</span>
                    <span className="lr-video-phase">Phase {v.phase}</span>
                  </div>
                  <div className="lr-video-title">{v.title}</div>
                  <div className="lr-video-focus">{v.focus_areas}</div>
                  <div className="lr-video-channel">▶ {v.channel}</div>
                  <a
                    className="lr-video-link"
                    href={v.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Watch on YouTube ↗
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── IMMERSION LAB · Cultural Context + Conversation Engine ──────────────────
// Real-world practice, compute-first + ZERO API cost: device-native TTS
// (speechFallback) is the partner's voice, the Web Speech API (useSpeechEvaluator)
// is the athlete's voice input, comparePhrases does the fuzzy scoring, and every
// line feeds the same Supabase SRS the Vocab Gym uses. No LLM, no ElevenLabs.

const CULTURAL_SCENARIOS = [
  {
    id: 'restaurant-es', lang: 'es', title: 'Ordering at a Taquería', setting: '🌮 Mexico City',
    turns: [
      { text: 'Buenas tardes, ¿qué desea ordenar?', cue: 'Ask for tacos al pastor and a water', expected: 'Quiero tacos al pastor y un agua, por favor', alts: ['Me trae tacos al pastor y un agua', 'Tacos al pastor y un agua por favor'] },
      { text: '¿Algo más?', cue: 'Say no thanks, nothing else', expected: 'No, gracias. Nada más.', alts: ['Nada más gracias', 'No, está bien'] },
      { text: '¿Para comer aquí o para llevar?', cue: 'Say to-go, please', expected: 'Para llevar, por favor', alts: ['Para llevar', 'Para llevar gracias'] },
      { text: 'Son cien pesos.', cue: 'Ask if they accept card', expected: '¿Aceptan tarjeta?', alts: ['¿Puedo pagar con tarjeta?', '¿Toman tarjeta?'] },
    ],
  },
  {
    id: 'directions-pt', lang: 'pt', title: 'Asking Directions', setting: '🏖️ Rio de Janeiro',
    turns: [
      { text: 'Oi! Posso ajudar?', cue: 'Ask how to get to Copacabana', expected: 'Como eu chego em Copacabana?', alts: ['Como chego à Copacabana?', 'Onde fica Copacabana?'] },
      { text: 'É longe daqui a pé.', cue: 'Ask if there is a bus', expected: 'Tem ônibus?', alts: ['Tem algum ônibus?', 'Qual ônibus eu pego?'] },
      { text: 'Pega o 583 ali na esquina.', cue: 'Ask how much the fare costs', expected: 'Quanto custa a passagem?', alts: ['Quanto é a passagem?', 'Quanto custa?'] },
      { text: 'Cinco reais. Boa viagem!', cue: 'Thank them a lot', expected: 'Muito obrigado!', alts: ['Obrigado!', 'Valeu, obrigado!'] },
    ],
  },
  {
    id: 'market-es', lang: 'es', title: 'Negotiating at the Market', setting: '🧶 Oaxaca',
    turns: [
      { text: '¡Pásele! ¿Le gusta este tapete?', cue: 'Ask how much it costs', expected: '¿Cuánto cuesta?', alts: ['¿Cuánto vale?', '¿Qué precio tiene?'] },
      { text: 'Quinientos pesos, joven.', cue: 'Say it is a bit expensive', expected: 'Está un poco caro.', alts: ['Es un poco caro', 'Está caro'] },
      { text: '¿Cuánto me ofrece?', cue: 'Offer three hundred', expected: 'Le doy trescientos.', alts: ['Trescientos', 'Le ofrezco trescientos'] },
      { text: 'Cuatrocientos y es suyo.', cue: 'Agree and say you will take it', expected: 'Está bien, me lo llevo.', alts: ['Me lo llevo', 'De acuerdo, me lo llevo'] },
    ],
  },
];

const CONVERSATIONS = [
  {
    id: 'casual-chat-es', lang: 'es', title: 'Casual Chat', setting: '☕ Coffee shop', opener: 'Hola, ¿cómo estás?', turnLimit: 8,
    intents: [
      { name: 'how_are', patterns: /bien|mal|cansad|más o menos|regular|excelente/i, responses: ['Me alegro. ¿De dónde eres?', 'Qué bueno. ¿Y a qué te dedicas?'] },
      { name: 'origin', patterns: /soy de|vengo de|estados unidos|méxico|de aquí/i, responses: ['Ah, ¡qué bien! ¿Qué te trae por aquí?', 'Genial. ¿Hace cuánto que viajas?'] },
      { name: 'job', patterns: /entrenador|trabajo|me dedico|soy/i, responses: ['Interesante. ¿Te gusta tu trabajo?', '¡Qué bueno! Suena emocionante.'] },
      { name: 'greeting', patterns: /hola|buenas|buenos|qué tal/i, responses: ['¡Hola! ¿Qué tal tu día?', 'Buenas. ¿Cómo va todo?'] },
      { name: 'thanks', patterns: /gracias/i, responses: ['¡De nada! Un placer.', 'Con gusto.'] },
    ],
    fallback: ['Mmm, no te entendí bien. ¿Puedes repetir?', 'Perdona, ¿cómo dijiste?'],
  },
  {
    id: 'cafe-pt', lang: 'pt', title: 'Café Order', setting: '🥐 Padaria', opener: 'Bom dia! O que vai querer?', turnLimit: 8,
    intents: [
      { name: 'order', patterns: /quero|me vê|um café|pão|vou querer|prefiro/i, responses: ['Saiu! Mais alguma coisa?', 'Pode deixar. Algo mais?'] },
      { name: 'price', patterns: /quanto|preço|custa/i, responses: ['São oito reais.', 'Fica dez reais no total.'] },
      { name: 'no_more', patterns: /só isso|nada mais|mais nada|tá bom|é isso/i, responses: ['Beleza! Já trago.', 'Perfeito, um instante.'] },
      { name: 'thanks', patterns: /obrigad|valeu/i, responses: ['Imagina! Bom apetite.', 'De nada, volte sempre!'] },
      { name: 'greeting', patterns: /oi|olá|bom dia|boa tarde/i, responses: ['Oi! Tudo bem? O que vai querer?', 'Olá! Pois não?'] },
    ],
    fallback: ['Desculpa, não entendi. Pode repetir?', 'Como assim? Fala de novo.'],
  },
  {
    id: 'market-haggle-es', lang: 'es', title: 'Market Haggle', setting: '🧺 Mercado', opener: '¡Pásele! ¿Qué busca hoy?', turnLimit: 8,
    intents: [
      { name: 'ask_price', patterns: /cuánto|precio|vale|cuesta/i, responses: ['Le dejo en doscientos.', 'Para usted, ciento ochenta.'] },
      { name: 'too_much', patterns: /caro|mucho|no tengo tanto/i, responses: ['¿Cuánto me ofrece?', 'Ándele, ¿cuánto le pongo?'] },
      { name: 'offer', patterns: /le doy|le ofrezco|cien|ciento|\d+/i, responses: ['Mmm... que sean ciento veinte.', 'Está bien, ¡trato hecho!'] },
      { name: 'deal', patterns: /me lo llevo|trato hecho|de acuerdo|está bien/i, responses: ['¡Excelente elección! Gracias.', '¡Va! Que lo disfrute.'] },
      { name: 'greeting', patterns: /hola|buenas/i, responses: ['¡Buenas! Pásele, pásele.', '¡Hola! ¿Le muestro algo?'] },
    ],
    fallback: ['No le entendí, joven. ¿Mande?', '¿Cómo dice?'],
  },
];

// Reusable voice-input button (Web Speech API). Fills the parent input via onText.
function MicButton({ lang, onText, error: externalError }) {
  const { supported, listening, transcript, error, start, stop, reset } = useSpeechEvaluator(lang);
  useEffect(() => { if (transcript) onText(transcript); }, [transcript]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!supported) return null;
  const hasError = error || externalError;
  return (
    <button
      type="button"
      className={`lr-mic${listening ? ' is-live' : ''}${hasError ? ' has-error' : ''}`}
      onClick={() => { if (listening) stop(); else { reset(); start(); } }}
      aria-label="Speak your answer"
      title={hasError ? 'Click to retry microphone' : 'Click to speak'}
    >
      {listening ? '● REC' : hasError ? '⚠️' : '🎙️'}
    </button>
  );
}

function CulturalContext() {
  const [phase, setPhase] = useState('idle');
  const [scenario, setScenario] = useState(null);
  const [turnIdx, setTurnIdx] = useState(0);
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [hits, setHits] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const lang = scenario ? scenario.lang : 'es';
  const turn = scenario ? scenario.turns[turnIdx] : null;

  // Partner speaks each new line; the personal best persists once the scenario ends.
  useEffect(() => { if (phase === 'playing' && turn) { warmUpSpeech(); speakWithBrowser({ text: turn.text, lang }).catch(() => {}); } }, [turnIdx, phase, scenario]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (phase === 'done' && scenario) recordGameResult('cultural', Math.round((hits / scenario.turns.length) * 100), best); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (sc) => { setScenario(sc); setTurnIdx(0); setInput(''); setResult(null); setHits(0); setStreak(0); setBest(0); setPhase('playing'); };
  const submit = () => {
    if (!turn || !input.trim() || result) return;
    const cands = [turn.expected, ...(turn.alts || [])];
    const score = Math.max(...cands.map((c) => comparePhrases(c, input).score));
    const ok = score >= 70;
    playTone(ok ? 'success' : 'fail');
    recordVocabAttempt(turn.expected, ok);
    if (ok) { setHits((h) => h + 1); setStreak((s) => { const ns = s + 1; setBest((b) => Math.max(b, ns)); return ns; }); } else setStreak(0);
    setResult({ ok, score });
    speakWithBrowser({ text: turn.expected, lang }).catch(() => {}); // native pronunciation
  };
  const next = () => {
    const ni = turnIdx + 1;
    if (ni >= scenario.turns.length) { setPhase('done'); return; }
    setTurnIdx(ni); setInput(''); setResult(null);
  };

  if (phase === 'idle') {
    return (
      <div className="lr-cc-pick">
        {CULTURAL_SCENARIOS.map((sc) => (
          <button type="button" key={sc.id} className="lr-cc-card" onClick={() => begin(sc)}>
            <span className="lr-cc-card-emoji" aria-hidden="true">{sc.setting.split(' ')[0]}</span>
            <span className="lr-cc-card-title">{sc.title}</span>
            <span className="lr-cc-card-set">{sc.setting.slice(2)} · {sc.lang === 'pt' ? '🇧🇷' : '🇪🇸'} · {sc.turns.length} turns</span>
          </button>
        ))}
      </div>
    );
  }
  if (phase === 'done') {
    const acc = Math.round((hits / scenario.turns.length) * 100);
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">SCENARIO COMPLETE</div>
        <div className="lr-game-score-final">{acc}<span>% ACCURACY</span></div>
        <div className="lr-game-summary"><div><strong>{hits}/{scenario.turns.length}</strong> turns nailed</div><div>Best combo: <strong>×{best}</strong></div></div>
        <button type="button" className="lr-game-btn" onClick={() => begin(scenario)}>RETRY</button>
        <button type="button" className="lr-sb-btn lr-sb-btn--ghost" style={{ marginLeft: '.6rem' }} onClick={() => setPhase('idle')}>← SCENARIOS</button>
      </div>
    );
  }
  return (
    <div className="lr-game">
      <div className="lr-game-hud">
        <div className="lr-game-hud-cell"><span>{scenario.setting.split(' ')[0]} SCENE</span><strong style={{ fontSize: '.95rem' }}>{scenario.title}</strong></div>
        <div className="lr-game-hud-cell"><span>TURN</span><strong>{turnIdx + 1}/{scenario.turns.length}</strong></div>
        <div className="lr-game-hud-cell"><span>STREAK</span><strong className={streak >= 3 ? 'lr-hot' : ''}>×{streak}</strong></div>
      </div>
      <div className="lr-cc-line">
        <span className="lr-cc-flag" aria-hidden="true">{lang === 'pt' ? '🇧🇷' : '🇪🇸'}</span>
        <span className="lr-cc-text">{turn.text}</span>
        <SpeakBtn text={turn.text} lang={lang} label="🔊" />
      </div>
      <div className="lr-cc-cue"><span>YOUR TURN ·</span> {turn.cue}</div>
      {!result ? (
        <>
          <div className="lr-cc-input-row">
            <input className="lr-cc-input" value={input} placeholder={lang === 'pt' ? 'Digite ou fale…' : 'Escribe o habla…'} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            <MicButton lang={lang} onText={setInput} />
          </div>
          <button type="button" className="lr-game-btn" onClick={submit} disabled={!input.trim()}>SUBMIT</button>
        </>
      ) : (
        <div className={`lr-cc-result${result.ok ? ' is-ok' : ' is-bad'}`}>
          <div className="lr-cc-result-head">{result.ok ? '✅ ¡Bien!' : '❌ Close'} · {result.score}%</div>
          <div className="lr-cc-result-exp">{turn.expected} <SpeakBtn text={turn.expected} lang={lang} label="🔊" /></div>
          {!result.ok ? <div className="lr-cc-result-you">You said: &ldquo;{input}&rdquo;</div> : null}
          <button type="button" className="lr-game-btn" onClick={next}>{turnIdx + 1 >= scenario.turns.length ? 'FINISH' : 'NEXT →'}</button>
        </div>
      )}
    </div>
  );
}

function matchIntent(conv, text) {
  for (let i = 0; i < conv.intents.length; i += 1) { if (conv.intents[i].patterns.test(text)) return conv.intents[i]; }
  return null;
}

function ConversationEngine() {
  const [phase, setPhase] = useState('idle');
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState(0);
  const [matched, setMatched] = useState(0);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const lang = conv ? conv.lang : 'es';
  const scrollRef = useRef(null);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs]);
  useEffect(() => { if (phase === 'done' && conv) recordGameResult('conversation', turns ? Math.round((matched / turns) * 100) : 0, best); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (c) => {
    setConv(c); setMsgs([{ who: 'partner', text: c.opener }]); setInput(''); setTurns(0); setMatched(0); setStreak(0); setBest(0); setPhase('playing');
    warmUpSpeech(); speakWithBrowser({ text: c.opener, lang: c.lang }).catch(() => {});
  };
  const send = () => {
    if (!input.trim() || phase !== 'playing') return;
    const userText = input.trim();
    const it = matchIntent(conv, userText);
    const hit = !!it;
    playTone(hit ? 'success' : 'fail');
    recordVocabAttempt(userText, hit);
    const poolR = it ? it.responses : conv.fallback;
    const reply = poolR[Math.floor(Math.random() * poolR.length)];
    const nTurns = turns + 1;
    setMsgs((mm) => [...mm, { who: 'you', text: userText }, { who: 'partner', text: reply }]);
    setInput('');
    setTurns(nTurns);
    if (hit) { setMatched((x) => x + 1); setStreak((s) => { const ns = s + 1; setBest((b) => Math.max(b, ns)); return ns; }); } else setStreak(0);
    speakWithBrowser({ text: reply, lang }).catch(() => {});
    if (nTurns >= conv.turnLimit) setTimeout(() => setPhase('done'), 1000);
  };

  if (phase === 'idle') {
    return (
      <div className="lr-cc-pick">
        {CONVERSATIONS.map((c) => (
          <button type="button" key={c.id} className="lr-cc-card" onClick={() => begin(c)}>
            <span className="lr-cc-card-emoji" aria-hidden="true">{c.setting.split(' ')[0]}</span>
            <span className="lr-cc-card-title">{c.title}</span>
            <span className="lr-cc-card-set">{c.setting.slice(2)} · {c.lang === 'pt' ? '🇧🇷' : '🇪🇸'} · {c.turnLimit} turns</span>
          </button>
        ))}
      </div>
    );
  }
  if (phase === 'done') {
    const acc = turns ? Math.round((matched / turns) * 100) : 0;
    return (
      <div className="lr-game-start">
        <div className="lr-game-start-title">CONVERSATION DONE</div>
        <div className="lr-game-score-final">{acc}<span>% MATCHED</span></div>
        <div className="lr-game-summary"><div><strong>{matched}/{turns}</strong> intents understood</div><div>Best combo: <strong>×{best}</strong></div></div>
        <button type="button" className="lr-game-btn" onClick={() => begin(conv)}>AGAIN</button>
        <button type="button" className="lr-sb-btn lr-sb-btn--ghost" style={{ marginLeft: '.6rem' }} onClick={() => setPhase('idle')}>← SETS</button>
      </div>
    );
  }
  const acc = turns ? Math.round((matched / turns) * 100) : 0;
  return (
    <div className="lr-game">
      <div className="lr-chat-top">
        <span className="lr-chat-title">{conv.setting} · {conv.title}</span>
        <span className="lr-chat-acc">Accuracy {acc}%{streak >= 2 ? ` · 🔥×${streak}` : ''} · {turns}/{conv.turnLimit}</span>
      </div>
      <div className="lr-chat" ref={scrollRef}>
        {msgs.map((mm, i) => (
          <div key={i} className={`lr-chat-msg lr-chat-msg--${mm.who}`}>
            <span className="lr-chat-bubble">{mm.text}{mm.who === 'partner' ? <SpeakBtn text={mm.text} lang={lang} label="🔊" /> : null}</span>
          </div>
        ))}
      </div>
      <div className="lr-cc-input-row">
        <input className="lr-cc-input" value={input} placeholder={lang === 'pt' ? 'Responda…' : 'Responde…'} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send(); }} />
        <MicButton lang={lang} onText={setInput} />
        <button type="button" className="lr-game-btn lr-chat-send" onClick={send} disabled={!input.trim()}>SEND</button>
      </div>
    </div>
  );
}

function TabImmersion() {
  const [mode, setMode] = useState('cultural');
  return (
    <div>
      <div className="lr-section-label">TASK 6 · REAL-WORLD IMMERSION</div>
      <div className="lr-section-title">IMMERSION <span>LAB</span></div>
      <div className="lr-section-desc">
        Practice the real thing — order, ask directions, haggle, and hold a live chat. The
        partner speaks in the free on-device voice; you reply by voice or text. Pure compute,
        zero tokens; every line you produce feeds your spaced-repetition mastery.
      </div>
      <div className="lr-chips">
        <button type="button" className={`lr-chip${mode === 'cultural' ? ' is-active' : ''}`} onClick={() => setMode('cultural')}>🌮 CULTURAL CONTEXT</button>
        <button type="button" className={`lr-chip${mode === 'convo' ? ' is-active' : ''}`} onClick={() => setMode('convo')}>💬 CONVERSATION</button>
      </div>
      {mode === 'cultural' ? <CulturalContext /> : <ConversationEngine />}
    </div>
  );
}

const TABS = [
  { id: 'vocab', label: '🇪🇸 Vocab Matrix', Panel: TabVocab },
  { id: 'gym', label: '🏋️ Vocab Gym', Panel: TabVocabGym },
  { id: 'voice', label: '🎙️ Voice Studio', Panel: TabVoiceStudio },
  { id: 'immersion', label: '🌎 Immersion', Panel: TabImmersion },
  { id: 'pt', label: '🇧🇷 Rio Ready', Panel: TabPortuguese },
  { id: 'roleplay', label: '⚡ God-Mode Drills', Panel: TabRoleplay },
  { id: 'intentions', label: '🎯 Intentions', Panel: TabIntentions },
  { id: 'roadmap', label: '📋 90-Day Roadmap', Panel: TabRoadmap },
  { id: 'videos', label: '🎬 BBF VIDEO VAULT', Panel: TabVideoVault },
];

// ─── SHELL ────────────────────────────────────────────────────────────────────

export default function AdminLanguageRoadmap() {
  // Defense-in-depth. The /command route is already AdminGuard-gated, so isAdmin is
  // guaranteed true here in practice; this fail-closed re-check guarantees the
  // module renders nothing if it is ever mounted outside the admin perimeter.
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(TABS[0].id);

  if (!isAdmin) {
    return (
      <div className="lr lr-locked" role="alert">
        <div className="lr-locked-mark" aria-hidden="true">🔒</div>
        <div className="lr-locked-text">This module is restricted to the administrative tier.</div>
      </div>
    );
  }

  const ActivePanel = (TABS.find((t) => t.id === tab) ?? TABS[0]).Panel;

  return (
    <div className="lr" data-testid="admin-language-roadmap">
      <header className="lr-hero">
        <div className="lr-hero-brand">BUILD BELIEVE FIT LLC · AKEEM</div>
        <h2 className="lr-hero-title">90-DAY LANGUAGE<br /><span>MASTERY PROTOCOL</span></h2>
        <div className="lr-hero-sub">Spanish + Brazilian Portuguese · Bilingual Coach System</div>
        <div className="lr-badges">
          <span className="lr-badge">NASM Certified</span>
          <span className="lr-badge">🇪🇸 Spanish</span>
          <span className="lr-badge">🇧🇷 Portuguese</span>
          <span className="lr-badge">175 LB Target</span>
        </div>
      </header>

      <nav className="lr-nav" role="tablist" aria-label="Language protocol surfaces">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`lr-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="lr-content" key={tab}>
        <ActivePanel />
      </div>
    </div>
  );
}
