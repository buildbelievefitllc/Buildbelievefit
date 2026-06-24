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
    es: 'Duolingo 15 min (AM) + Pimsleur 30 min (post-workout cooldown) + Memrise fitness deck 10 min',
    pt: 'Pimsleur Units 1–7 daily. Add 10 PT phrases/week from Survival Kit.',
    daily: ['ES Duo', 'ES Pimsleur', 'PT Phrases', 'ES Duo', 'ES Vocab', 'PT Pimsleur', 'Rest / Review'],
  },
  {
    num: '02', name: 'ACCELERATION', weeks: 'WEEKS 4–7',
    es: 'Script rehearsal 3×/week during warm-up. Begin recording short coaching clips in Spanish.',
    pt: 'Pimsleur Level 2 begins. Add Brazilian YouTube (no subtitles). Start Italki tutor.',
    daily: ['ES Script', 'PT Pimsleur', 'ES Vocab + PT Phrases', 'ES Script', 'PT Tutor', 'ES+PT Mixed', 'Rest / Audio'],
  },
  {
    num: '03', name: 'IMMERSION', weeks: 'WEEKS 8–11',
    es: 'Full client roleplay in Spanish 2×/week. Translate one BBF social post per day.',
    pt: 'Full gym convos in PT. Record 2-min PT monologue weekly. PT journal nightly.',
    daily: ['ES Client RP', 'PT Pimsleur', 'ES Social Post', 'PT Tutor', 'ES Vocab Review', 'PT Monologue', 'Rest / Listen'],
  },
  {
    num: '04', name: 'MASTERY SPRINT', weeks: 'WEEK 12',
    es: 'Record full Spanish coaching session. Post bilingual Instagram Reel.',
    pt: 'Record full PT Reel for BBF brand. Explain split & fasting in PT without notes.',
    daily: ['ES Reel Prep', 'PT Reel Prep', 'ES Record', 'PT Record', 'Edit + Post', 'Rest', 'Celebrate'],
  },
];

// Daily integration template + 90-day benchmarks (static ground-truth from the
// roadmap tab of the prototype).
const INTEGRATION_TEMPLATE = [
  { time: 'WARM-UP (10 MIN)', act: 'Spanish vocab flashcards (Memrise) or script rehearsal' },
  { time: 'WORKOUT (75 MIN)', act: 'Pimsleur audio (PT) through ONE earbud during isolation sets' },
  { time: 'CARDIO / COOLDOWN (20 MIN)', act: 'Recite weekly Intention Statement in both languages. Shadow Pimsleur.' },
];

const BENCHMARKS = [
  'Hold a 5-minute Spanish coaching session without pausing',
  'Navigate a São Paulo gym entirely in Portuguese',
  'Recite all 6 intention statements from memory, both languages',
  'Post 1 bilingual BBF Instagram Reel',
  'Complete Pimsleur Brazilian Portuguese Level 2',
  'Land at 175 lbs — cut complete',
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
        Four phases. Copy-pasteable weekly focus blocks. Integrate into your 2-hour
        bodybuilding sessions — warm-up for vocabulary, cooldown for Pimsleur,
        cardio for intentions.
      </div>

      <div className="lr-stats">
        <div className="lr-stat"><div className="lr-stat-num">90</div><div className="lr-stat-label">Days</div></div>
        <div className="lr-stat"><div className="lr-stat-num">2</div><div className="lr-stat-label">Languages</div></div>
        <div className="lr-stat"><div className="lr-stat-num">{roadmapPhases.length}</div><div className="lr-stat-label">Phases</div></div>
        <div className="lr-stat"><div className="lr-stat-num">3</div><div className="lr-stat-label">Apps Used</div></div>
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
  const correct = pool[Math.floor(Math.random() * pool.length)];
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

// Personal best per game mode (localStorage; higher = better). A light retention
// touch so a streak survives a refresh — no backend, device-local, quota-safe.
function readBest(mode) { try { return Number(localStorage.getItem(`bbf.lr.best.${mode}`)) || 0; } catch { return 0; } }
function saveBest(mode, val) { try { if (val > readBest(mode)) localStorage.setItem(`bbf.lr.best.${mode}`, String(val)); } catch { /* quota */ } }

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
  const correct = pool[Math.floor(Math.random() * pool.length)];
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
  useEffect(() => { if (phase === 'done') saveBest('listen', score); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const lockAnswer = (choice) => {
    if (picked !== null || !question) return;
    setPicked(choice);
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

  useEffect(() => { if (phase === 'done') saveBest('match', score); }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps
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

function TabVocabGym() {
  const [mode, setMode] = useState('speed');
  return (
    <div>
      <div className="lr-section-label">TASK 5 · THE VOCABULARY GYM</div>
      <div className="lr-section-title">VOCAB <span>GYM</span></div>
      <div className="lr-section-desc">
        Your daily reps. Train the {VOCAB_POOL.length}-term fitness matrix as an active game —
        read it, hear it, or race the clock. Four modes, zero tokens, fully on-device.
      </div>
      <div className="lr-chips">
        <button type="button" className={`lr-chip${mode === 'speed' ? ' is-active' : ''}`} onClick={() => setMode('speed')}>⚡ SPEED MATRIX</button>
        <button type="button" className={`lr-chip${mode === 'listen' ? ' is-active' : ''}`} onClick={() => setMode('listen')}>🎧 LISTENING LAB</button>
        <button type="button" className={`lr-chip${mode === 'match' ? ' is-active' : ''}`} onClick={() => setMode('match')}>🔗 MATCH MADNESS</button>
        <button type="button" className={`lr-chip${mode === 'flip' ? ' is-active' : ''}`} onClick={() => setMode('flip')}>🃏 FLIP DRILL</button>
      </div>
      {mode === 'speed' ? <SpeedMatrix />
        : mode === 'listen' ? <ListeningLab />
          : mode === 'match' ? <MatchMadness />
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

function VoiceDrill({ drill }) {
  const { supported, listening, transcript, interim, error, start, stop, reset } = useSpeechEvaluator(drill.lang);
  const result = useMemo(
    () => (transcript ? comparePhrases(drill.text, transcript) : null),
    [transcript, drill.text],
  );

  // Reset the captured transcript whenever the target drill changes.
  useEffect(() => { reset(); }, [drill.text]); // eslint-disable-line react-hooks/exhaustive-deps

  let scoreClass = '';
  if (result) scoreClass = result.score >= 80 ? 'lr-voice-score--green' : result.score >= 50 ? 'lr-voice-score--yellow' : 'lr-voice-score--red';

  return (
    <div className="lr-voice">
      <div className="lr-voice-target">
        <div className="lr-voice-target-label">{drill.label}</div>
        <div className="lr-voice-target-text">&ldquo;{drill.text}&rdquo;</div>
        <SpeakBtn text={drill.text} lang={drill.lang} label="🔊 HEAR TARGET" />
      </div>

      {!supported ? (
        <div className="lr-voice-unsupported">
          🎙️ Voice recognition isn’t available in this browser. Use Chrome or Safari to
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
            <div className="lr-voice-err">Mic error: {error}. Check microphone permissions.</div>
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
        and coaching cues. Recite out loud — it’s practice and manifestation in one.
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

const TABS = [
  { id: 'vocab', label: '🇪🇸 Vocab Matrix', Panel: TabVocab },
  { id: 'gym', label: '🏋️ Vocab Gym', Panel: TabVocabGym },
  { id: 'voice', label: '🎙️ Voice Studio', Panel: TabVoiceStudio },
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
