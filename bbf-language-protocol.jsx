import { useState } from "react";

const PURPLE = "#6a0dad";
const YELLOW = "#f5c800";
const DARK = "#0a0a0a";
const CARD = "#111111";
const BORDER = "#1e1e1e";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${DARK}; }
  .bbf-app { font-family: 'Barlow Condensed', sans-serif; background: ${DARK}; color: #f0f0f0; min-height: 100vh; }
  .bebas { font-family: 'Bebas Neue', sans-serif; }
  .barlow { font-family: 'Barlow Condensed', sans-serif; }

  /* Header */
  .header { background: linear-gradient(135deg, #0a0a0a 0%, #1a0030 60%, #0a0a0a 100%); border-bottom: 2px solid ${YELLOW}; padding: 32px 24px 20px; position: relative; overflow: hidden; }
  .header::before { content:''; position:absolute; top:-40px; right:-60px; width:320px; height:320px; background: radial-gradient(circle, rgba(106,13,173,0.25) 0%, transparent 70%); pointer-events:none; }
  .header-brand { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:6px; color:${YELLOW}; margin-bottom:6px; opacity:0.9; }
  .header-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(38px,6vw,64px); line-height:1; color:#fff; }
  .header-title span { color:${YELLOW}; }
  .header-sub { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:500; letter-spacing:3px; color:#aaa; margin-top:8px; text-transform:uppercase; }
  .header-badges { display:flex; gap:10px; margin-top:16px; flex-wrap:wrap; }
  .badge { background:rgba(106,13,173,0.3); border:1px solid ${PURPLE}; color:${YELLOW}; font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:2px; padding:4px 12px; border-radius:2px; text-transform:uppercase; }

  /* Nav */
  .nav { display:flex; overflow-x:auto; background:#0d0d0d; border-bottom:1px solid ${BORDER}; scrollbar-width:none; }
  .nav::-webkit-scrollbar { display:none; }
  .nav-btn { flex-shrink:0; font-family:'Bebas Neue',sans-serif; font-size:15px; letter-spacing:2px; padding:14px 20px; background:none; border:none; color:#666; cursor:pointer; border-bottom:3px solid transparent; transition:all 0.2s; white-space:nowrap; }
  .nav-btn:hover { color:#ccc; }
  .nav-btn.active { color:${YELLOW}; border-bottom-color:${YELLOW}; background:rgba(245,200,0,0.05); }

  /* Content */
  .content { padding:24px 20px; max-width:900px; margin:0 auto; }

  /* Section */
  .section-label { font-family:'Bebas Neue',sans-serif; font-size:11px; letter-spacing:5px; color:${PURPLE}; margin-bottom:4px; text-transform:uppercase; }
  .section-title { font-family:'Bebas Neue',sans-serif; font-size:clamp(28px,4vw,42px); line-height:1.05; color:#fff; margin-bottom:16px; }
  .section-title span { color:${YELLOW}; }
  .section-desc { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:400; color:#bbb; line-height:1.6; margin-bottom:24px; }

  /* Cards */
  .card { background:${CARD}; border:1px solid ${BORDER}; border-radius:4px; padding:20px; margin-bottom:16px; }
  .card-title { font-family:'Bebas Neue',sans-serif; font-size:20px; letter-spacing:2px; color:${YELLOW}; margin-bottom:12px; }
  .card-subtitle { font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700; letter-spacing:3px; color:${PURPLE}; text-transform:uppercase; margin-bottom:10px; }

  /* Vocab grid */
  .vocab-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:8px; }
  .vocab-item { background:#161616; border:1px solid #222; border-radius:3px; padding:10px 14px; display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
  .vocab-es { font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:700; color:${YELLOW}; }
  .vocab-en { font-family:'Barlow Condensed',sans-serif; font-size:13px; color:#777; font-style:italic; }
  .vocab-cat { font-family:'Barlow Condensed',sans-serif; font-size:10px; letter-spacing:2px; color:${PURPLE}; font-weight:700; margin-top:2px; text-transform:uppercase; }

  /* Scripts */
  .script-block { background:#0d0d1a; border-left:4px solid ${PURPLE}; border-radius:3px; padding:16px; margin-bottom:12px; }
  .script-label { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:3px; color:${PURPLE}; margin-bottom:10px; }
  .script-line { font-family:'Barlow Condensed',sans-serif; font-size:15px; color:#e8e8e8; line-height:1.7; margin-bottom:4px; }
  .script-line .es { color:#fff; font-weight:600; }
  .script-line .en { color:#666; font-size:13px; font-style:italic; }

  /* Phrases */
  .phrase-item { background:#161616; border:1px solid #1e1e1e; border-radius:3px; padding:12px 14px; margin-bottom:8px; display:flex; gap:14px; align-items:flex-start; }
  .phrase-num { font-family:'Bebas Neue',sans-serif; font-size:20px; color:${PURPLE}; min-width:28px; line-height:1; }
  .phrase-pt { font-family:'Barlow Condensed',sans-serif; font-size:17px; font-weight:700; color:${YELLOW}; }
  .phrase-en { font-family:'Barlow Condensed',sans-serif; font-size:13px; color:#888; margin-top:2px; }
  .phrase-cat-tag { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:700; letter-spacing:2px; color:#fff; background:${PURPLE}; padding:2px 7px; border-radius:2px; margin-left:8px; text-transform:uppercase; vertical-align:middle; }

  /* Schedule */
  .week-row { background:#111; border:1px solid #1e1e1e; border-radius:3px; padding:14px 16px; margin-bottom:8px; display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; }
  .week-num { font-family:'Bebas Neue',sans-serif; font-size:22px; color:${YELLOW}; min-width:60px; }
  .week-content { flex:1; min-width:200px; }
  .week-title { font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:700; color:#fff; }
  .week-detail { font-family:'Barlow Condensed',sans-serif; font-size:14px; color:#999; line-height:1.6; margin-top:4px; }

  /* Roleplay */
  .roleplay-trigger { background:linear-gradient(135deg, ${PURPLE}, #3d0070); border:2px solid ${YELLOW}; border-radius:4px; padding:20px; margin-bottom:20px; text-align:center; cursor:pointer; transition:all 0.2s; }
  .roleplay-trigger:hover { background:linear-gradient(135deg, #7a1dc0, #4a0090); transform:translateY(-1px); }
  .roleplay-trigger-label { font-family:'Bebas Neue',sans-serif; font-size:14px; letter-spacing:4px; color:${YELLOW}; margin-bottom:4px; }
  .roleplay-trigger-title { font-family:'Bebas Neue',sans-serif; font-size:30px; color:#fff; }
  .scenario-card { background:#0f0f0f; border:1px solid #222; border-radius:4px; padding:18px; margin-bottom:12px; cursor:pointer; transition:border-color 0.2s; }
  .scenario-card:hover { border-color:${YELLOW}; }
  .scenario-card.selected { border-color:${YELLOW}; background:#141400; }
  .scenario-title { font-family:'Bebas Neue',sans-serif; font-size:18px; color:${YELLOW}; }
  .scenario-desc { font-family:'Barlow Condensed',sans-serif; font-size:14px; color:#888; margin-top:4px; }
  .scenario-prompt { font-family:'Barlow Condensed',sans-serif; font-size:15px; color:#ccc; background:#1a1a1a; border-left:3px solid ${YELLOW}; padding:12px 14px; border-radius:2px; margin-top:10px; line-height:1.6; }
  .correction-box { background:#1a0a00; border:1px solid #f5a500; border-radius:3px; padding:12px 14px; margin-top:10px; }
  .correction-label { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:3px; color:#f5a500; margin-bottom:6px; }
  .correction-text { font-family:'Barlow Condensed',sans-serif; font-size:14px; color:#ddd; line-height:1.6; }

  /* Intentions */
  .intention-card { background:linear-gradient(135deg, #0f0020 0%, #0a0a0a 100%); border:1px solid ${PURPLE}; border-radius:4px; padding:22px; margin-bottom:16px; }
  .intention-week { font-family:'Bebas Neue',sans-serif; font-size:12px; letter-spacing:4px; color:${PURPLE}; margin-bottom:6px; }
  .intention-theme { font-family:'Bebas Neue',sans-serif; font-size:26px; color:${YELLOW}; margin-bottom:14px; }
  .intention-lang { font-family:'Barlow Condensed',sans-serif; font-size:13px; letter-spacing:3px; font-weight:700; text-transform:uppercase; margin-bottom:4px; }
  .intention-es { color:#a855f7; }
  .intention-pt { color:#22d3ee; }
  .intention-text { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:500; color:#fff; line-height:1.5; font-style:italic; }

  /* Roadmap */
  .roadmap-phase { margin-bottom:24px; }
  .phase-header { background:linear-gradient(90deg, ${PURPLE}, transparent); padding:12px 18px; border-radius:3px; margin-bottom:12px; display:flex; align-items:center; gap:14px; }
  .phase-num { font-family:'Bebas Neue',sans-serif; font-size:42px; color:${YELLOW}; line-height:1; }
  .phase-info { flex:1; }
  .phase-name { font-family:'Bebas Neue',sans-serif; font-size:22px; color:#fff; letter-spacing:2px; }
  .phase-weeks { font-family:'Barlow Condensed',sans-serif; font-size:13px; color:#bbb; font-weight:600; letter-spacing:2px; }
  .day-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; margin-bottom:8px; }
  .day-header { font-family:'Bebas Neue',sans-serif; font-size:12px; letter-spacing:2px; color:${PURPLE}; text-align:center; padding:6px 2px; }
  .day-slot { background:#161616; border:1px solid #1e1e1e; border-radius:3px; padding:8px 6px; text-align:center; }
  .day-slot-lang { font-family:'Bebas Neue',sans-serif; font-size:13px; color:${YELLOW}; }
  .day-slot-act { font-family:'Barlow Condensed',sans-serif; font-size:11px; color:#888; line-height:1.3; margin-top:2px; }

  /* Utility */
  .copy-btn { font-family:'Bebas Neue',sans-serif; font-size:13px; letter-spacing:3px; background:${PURPLE}; color:${YELLOW}; border:none; padding:8px 16px; border-radius:3px; cursor:pointer; transition:all 0.2s; display:inline-block; margin-top:10px; }
  .copy-btn:hover { background:#8a1ddd; }
  .copy-btn.copied { background:#1a5c1a; color:#7fff7f; }
  .divider { border:none; border-top:1px solid #1e1e1e; margin:20px 0; }
  .tag { font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700; letter-spacing:2px; text-transform:uppercase; background:rgba(106,13,173,0.2); color:${PURPLE}; padding:3px 8px; border-radius:2px; display:inline-block; margin-right:6px; margin-bottom:6px; }
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
  @media(max-width:600px){ .two-col{grid-template-columns:1fr;} .day-grid{grid-template-columns:repeat(4,1fr);} }
  .highlight { color:${YELLOW}; font-weight:700; }
  .stat-row { display:flex; gap:20px; flex-wrap:wrap; margin-bottom:20px; }
  .stat { background:#111; border:1px solid #222; border-radius:3px; padding:14px 18px; flex:1; min-width:120px; text-align:center; }
  .stat-num { font-family:'Bebas Neue',sans-serif; font-size:36px; color:${YELLOW}; line-height:1; }
  .stat-label { font-family:'Barlow Condensed',sans-serif; font-size:12px; letter-spacing:2px; color:#888; text-transform:uppercase; margin-top:2px; }
`;

// ─── DATA ──────────────────────────────────────────────────────────────────

const vocabData = {
  "ANATOMY": [
    {es:"músculo",en:"muscle"},
    {es:"bíceps",en:"biceps"},
    {es:"tríceps",en:"triceps"},
    {es:"cuádriceps",en:"quadriceps"},
    {es:"isquiotibiales",en:"hamstrings"},
    {es:"glúteos",en:"glutes"},
    {es:"pectorales",en:"pectorals / chest"},
    {es:"deltoides",en:"deltoids / shoulders"},
    {es:"espalda",en:"back"},
    {es:"abdominales",en:"abs/core"},
    {es:"pantorrilla",en:"calf"},
    {es:"antebrazo",en:"forearm"},
    {es:"columna vertebral",en:"spine"},
    {es:"articulación",en:"joint"},
    {es:"tendón",en:"tendon"},
    {es:"ligamento",en:"ligament"},
    {es:"núcleo",en:"core"},
    {es:"postura",en:"posture"},
    {es:"rango de movimiento",en:"range of motion"},
    {es:"conexión mente-músculo",en:"mind-muscle connection"},
  ],
  "NUTRITION": [
    {es:"macronutrientes",en:"macros"},
    {es:"proteína",en:"protein"},
    {es:"carbohidratos",en:"carbohydrates"},
    {es:"grasas saludables",en:"healthy fats"},
    {es:"calorías",en:"calories"},
    {es:"déficit calórico",en:"caloric deficit"},
    {es:"superávit calórico",en:"caloric surplus"},
    {es:"ayuno intermitente",en:"intermittent fasting"},
    {es:"ventana de alimentación",en:"eating window"},
    {es:"hidratación",en:"hydration"},
    {es:"suplemento",en:"supplement"},
    {es:"creatina",en:"creatine"},
    {es:"proteína de suero",en:"whey protein"},
    {es:"aminoácidos",en:"amino acids"},
    {es:"metabolismo",en:"metabolism"},
    {es:"composición corporal",en:"body composition"},
    {es:"grasa corporal",en:"body fat"},
    {es:"masa muscular",en:"muscle mass"},
    {es:"masa magra",en:"lean mass"},
    {es:"nutrición perientrenamiento",en:"peri-workout nutrition"},
  ],
  "TRAINING": [
    {es:"sobrecarga progresiva",en:"progressive overload"},
    {es:"volumen de entrenamiento",en:"training volume"},
    {es:"intensidad",en:"intensity"},
    {es:"frecuencia",en:"frequency"},
    {es:"repetición",en:"rep"},
    {es:"serie",en:"set"},
    {es:"fallo muscular",en:"muscular failure"},
    {es:"técnica",en:"technique / form"},
    {es:"calentamiento",en:"warm-up"},
    {es:"enfriamiento",en:"cool-down"},
    {es:"hipertrofia",en:"hypertrophy"},
    {es:"resistencia",en:"endurance"},
    {es:"fuerza",en:"strength"},
    {es:"cardio",en:"cardio"},
    {es:"división de entrenamiento",en:"training split"},
    {es:"descanso activo",en:"active recovery"},
    {es:"sobreentrenamiento",en:"overtraining"},
    {es:"periodización",en:"periodization"},
    {es:"tiempo bajo tensión",en:"time under tension"},
    {es:"velocidad de ejecución",en:"rep tempo"},
  ],
  "MOTIVATION & CUES": [
    {es:"¡Tú puedes!",en:"You can do it!"},
    {es:"¡Más peso!",en:"More weight!"},
    {es:"¡Aprieta!",en:"Squeeze!"},
    {es:"Controla el movimiento",en:"Control the movement"},
    {es:"Respira",en:"Breathe"},
    {es:"Mantén la postura",en:"Hold your form"},
    {es:"Empuja",en:"Push"},
    {es:"Jala",en:"Pull"},
    {es:"Última repetición",en:"Last rep"},
    {es:"¡Descansa!",en:"Rest!"},
    {es:"Concéntrate",en:"Focus"},
    {es:"Siente el músculo",en:"Feel the muscle"},
    {es:"Más profundo",en:"Go deeper"},
    {es:"Velocidad controlada",en:"Controlled speed"},
    {es:"¡Excelente trabajo!",en:"Excellent work!"},
    {es:"Vamos a superar tus límites",en:"We're pushing your limits"},
    {es:"Confía en el proceso",en:"Trust the process"},
    {es:"Disciplina es libertad",en:"Discipline is freedom"},
    {es:"Construye, cree, logra",en:"Build, believe, achieve"},
    {es:"El dolor es temporal",en:"Pain is temporary"},
  ],
};

const scripts = [
  {
    title: "SCRIPT 1 — Explaining 16/8 Fasting",
    label: "Explica el Ayuno 16/8",
    lines: [
      {es:"Hoy vamos a hablar de tu protocolo de ayuno.", en:"Today we're going to talk about your fasting protocol."},
      {es:"El ayuno 16/8 significa que no comes durante 16 horas y tienes una ventana de alimentación de 8 horas.", en:"16/8 fasting means you don't eat for 16 hours and have an 8-hour eating window."},
      {es:"Por ejemplo, si tu última comida es a las 8 de la noche, no comes hasta el mediodía del día siguiente.", en:"For example, if your last meal is at 8 PM, you don't eat until noon the next day."},
      {es:"Durante el ayuno, puedes tomar agua, café negro, y té sin azúcar.", en:"During the fast, you can have water, black coffee, and unsweetened tea."},
      {es:"Este método mejora la sensibilidad a la insulina y te ayuda a reducir la grasa corporal.", en:"This method improves insulin sensitivity and helps you reduce body fat."},
      {es:"¿Tienes preguntas sobre cómo empezar?", en:"Do you have questions about how to start?"},
    ]
  },
  {
    title: "SCRIPT 2 — The 5-Day Strength Split",
    label: "Explica la División de 5 Días",
    lines: [
      {es:"Tu programa de entrenamiento es una división de cinco días.", en:"Your training program is a five-day split."},
      {es:"El lunes trabajamos el pecho y los tríceps.", en:"Monday we work chest and triceps."},
      {es:"El martes es para la espalda y los bíceps.", en:"Tuesday is for back and biceps."},
      {es:"El miércoles entrenamos los hombros y el núcleo.", en:"Wednesday we train shoulders and core."},
      {es:"El jueves nos enfocamos en los glúteos y los isquiotibiales.", en:"Thursday we focus on glutes and hamstrings."},
      {es:"El viernes es el día de cuádriceps y pantorrillas.", en:"Friday is quadriceps and calves day."},
      {es:"El sábado y el domingo son días de descanso activo o cardio ligero.", en:"Saturday and Sunday are active recovery or light cardio days."},
      {es:"Cada semana aumentamos el peso o las repeticiones — eso es la sobrecarga progresiva.", en:"Every week we increase the weight or reps — that's progressive overload."},
    ]
  },
  {
    title: "SCRIPT 3 — Motivation & Check-In",
    label: "Motivación y Revisión",
    lines: [
      {es:"¿Cómo te sientes hoy? ¿Tienes energía para entrenar?", en:"How are you feeling today? Do you have energy to train?"},
      {es:"Recuerda: la consistencia es más importante que la perfección.", en:"Remember: consistency is more important than perfection."},
      {es:"Hoy vamos a trabajar en la conexión mente-músculo.", en:"Today we're going to work on the mind-muscle connection."},
      {es:"Cada repetición debe ser intencional — siente el músculo trabajar.", en:"Every rep must be intentional — feel the muscle working."},
      {es:"Tu objetivo es llegar a 175 libras de masa muscular limpia. Estamos construyendo ese físico.", en:"Your goal is to reach 175 lbs of clean muscle mass. We are building that physique."},
      {es:"¡Tú puedes! Construye, cree, logra.", en:"You can do it! Build, believe, achieve."},
    ]
  }
];

const ptPhrases = [
  {n:1, pt:"Olá! Tudo bem?", en:"Hi! All good / How are you?", cat:"social"},
  {n:2, pt:"Tudo bem, obrigado!", en:"All good, thanks!", cat:"social"},
  {n:3, pt:"Como você se chama?", en:"What's your name?", cat:"social"},
  {n:4, pt:"Me chamo Akeem.", en:"My name is Akeem.", cat:"social"},
  {n:5, pt:"Prazer em te conhecer!", en:"Nice to meet you!", cat:"social"},
  {n:6, pt:"Você fala inglês?", en:"Do you speak English?", cat:"social"},
  {n:7, pt:"Falo pouco português.", en:"I speak a little Portuguese.", cat:"social"},
  {n:8, pt:"Pode falar mais devagar?", en:"Can you speak more slowly?", cat:"social"},
  {n:9, pt:"Não entendi. Pode repetir?", en:"I didn't understand. Can you repeat?", cat:"social"},
  {n:10, pt:"Onde fica o metrô?", en:"Where is the subway?", cat:"airport/nav"},
  {n:11, pt:"Onde fica o aeroporto?", en:"Where is the airport?", cat:"airport/nav"},
  {n:12, pt:"Preciso de um táxi.", en:"I need a taxi.", cat:"airport/nav"},
  {n:13, pt:"Chame um Uber, por favor.", en:"Please call an Uber.", cat:"airport/nav"},
  {n:14, pt:"Onde fica o hotel?", en:"Where is the hotel?", cat:"airport/nav"},
  {n:15, pt:"Qual é o endereço?", en:"What is the address?", cat:"airport/nav"},
  {n:16, pt:"Estou perdido(a).", en:"I'm lost.", cat:"airport/nav"},
  {n:17, pt:"Me leva para aqui, por favor.", en:"Take me here, please. [show map]", cat:"airport/nav"},
  {n:18, pt:"Quanto custa?", en:"How much does it cost?", cat:"airport/nav"},
  {n:19, pt:"Aceita cartão?", en:"Do you accept card?", cat:"airport/nav"},
  {n:20, pt:"Quero um açaí, por favor.", en:"I'd like an açaí, please.", cat:"food"},
  {n:21, pt:"Com granola e banana.", en:"With granola and banana.", cat:"food"},
  {n:22, pt:"Quero churrasco misto.", en:"I'd like a mixed churrasco.", cat:"food"},
  {n:23, pt:"Sem glúten, por favor.", en:"Gluten-free, please.", cat:"food"},
  {n:24, pt:"Mais proteína, menos carboidrato.", en:"More protein, less carb.", cat:"food"},
  {n:25, pt:"Água, por favor.", en:"Water, please.", cat:"food"},
  {n:26, pt:"A conta, por favor.", en:"The bill, please.", cat:"food"},
  {n:27, pt:"Está delicioso!", en:"It's delicious!", cat:"food"},
  {n:28, pt:"Quero um suco de maracujá.", en:"I'd like a passion fruit juice.", cat:"food"},
  {n:29, pt:"Tem opção sem açúcar?", en:"Is there a sugar-free option?", cat:"food"},
  {n:30, pt:"Onde fica a academia?", en:"Where is the gym?", cat:"gym"},
  {n:31, pt:"Você treina aqui todo dia?", en:"Do you train here every day?", cat:"gym"},
  {n:32, pt:"Posso treinar com você?", en:"Can I train with you?", cat:"gym"},
  {n:33, pt:"Qual músculo você está treinando hoje?", en:"Which muscle are you training today?", cat:"gym"},
  {n:34, pt:"Você pode me ajudar com a técnica?", en:"Can you help me with my form?", cat:"gym"},
  {n:35, pt:"Quanto tempo você treina?", en:"How long have you been training?", cat:"gym"},
  {n:36, pt:"Que suplementos você toma?", en:"What supplements do you take?", cat:"gym"},
  {n:37, pt:"Você é personal trainer?", en:"Are you a personal trainer?", cat:"gym"},
  {n:38, pt:"Sou personal trainer nos Estados Unidos.", en:"I'm a personal trainer from the US.", cat:"gym"},
  {n:39, pt:"Posso fazer uma série aqui?", en:"Can I use this [equipment]?", cat:"gym"},
  {n:40, pt:"Vamos treinar juntos!", en:"Let's train together!", cat:"gym"},
  {n:41, pt:"Você quer sair depois do treino?", en:"Do you want to hang out after the workout?", cat:"social+"},
  {n:42, pt:"Qual é seu Instagram?", en:"What's your Instagram?", cat:"social+"},
  {n:43, pt:"Me adiciona no Instagram!", en:"Add me on Instagram!", cat:"social+"},
  {n:44, pt:"Você mora aqui em São Paulo?", en:"Do you live here in São Paulo?", cat:"social+"},
  {n:45, pt:"Qual é o melhor restaurante aqui?", en:"What's the best restaurant here?", cat:"social+"},
  {n:46, pt:"Qual é a melhor praia perto daqui?", en:"What's the best beach near here?", cat:"social+"},
  {n:47, pt:"Obrigado por tudo!", en:"Thank you for everything!", cat:"social+"},
  {n:48, pt:"Foi um prazer!", en:"It was a pleasure!", cat:"social+"},
  {n:49, pt:"Até logo! / Tchau!", en:"See you! / Bye!", cat:"social+"},
  {n:50, pt:"Volto em breve.", en:"I'll be back soon.", cat:"social+"},
];

const pimsleurSchedule = [
  {week:"WEEK 1", title:"Foundation", detail:"Units 1–7 (30 min/day, post-workout cooldown). Focus: greetings, introductions, basic navigation. Shadowbox pronunciation daily. Repeat each unit twice before advancing."},
  {week:"WEEK 2", title:"Numbers, Time & Food", detail:"Units 8–14. Add food vocabulary from Survival Kit phrases 20–30 during sessions. Record yourself and compare to Pimsleur speaker."},
  {week:"WEEK 3", title:"Transportation & Location", detail:"Units 15–21. Pair with Google Maps Portuguese overlay. Walk through navigation scenarios with phrases 10–19. Speak aloud during cardio."},
  {week:"WEEK 4", title:"Gym Culture & Social", detail:"Units 22–28. Role-play gym conversations using phrases 30–40. Set phone language to Portuguese. Watch 1 Brazilian fitness YouTube video daily without subtitles."},
  {week:"WEEK 5–6", title:"Rapid Consolidation", detail:"Review Units 1–28. Start Pimsleur Level 2 Units 1–10. Add Memrise Brazilian Portuguese deck. Aim for 5-min unscripted monologue about your training day."},
  {week:"WEEK 7–8", title:"Ear Training Sprint", detail:"Podcast: 'PortuguesePod101' daily 20 min. Shadow native speakers on YouTube (Fitness Brasil channel). Journal 3 sentences in Portuguese every night."},
  {week:"WEEK 9–10", title:"Conversation Mode", detail:"Italki or Preply: 2× 30-min sessions with Brazilian tutor. Use ALL 50 survival kit phrases at least once per session. Bring a training topic every call."},
  {week:"WEEK 11–12", title:"Mastery Sprint", detail:"Pimsleur Level 2 final units. Full conversation: explain your 5-day split and 16/8 protocol in Portuguese. Record a 3-min Instagram Reel in Portuguese for BBF brand content."},
];

const scenarios = [
  {
    title:"🇨🇴 Lost in Medellín",
    lang:"ES",
    desc:"You're in El Poblado, can't find your hotel, phone is at 5%.",
    prompt:`Estoy en Medellín, en el barrio El Poblado. Perdí mi hotel — se llama Hotel Dann Carlton. Mi teléfono está a punto de morir. Necesito ayuda. ¿Puede ayudarme a llegar allí?`,
    correction:`❌ "Yo estar perdido" → ✅ "Estoy perdido" — ser/estar matters. ❌ "Busco el hotel mío" → ✅ "Busco mi hotel" — possessive before noun.`
  },
  {
    title:"🇧🇷 Gym in São Paulo",
    lang:"PT",
    desc:"You're looking for a CrossFit box in Vila Madalena, need directions & a day pass.",
    prompt:`Olá! Estou procurando uma academia de CrossFit aqui em Vila Madalena. Você conhece alguma perto daqui? Quanto custa uma diária? Posso pagar com cartão?`,
    correction:`❌ "Eu estar procurando" → ✅ "Estou procurando" — drop pronoun, use conjugated form. ❌ "Eu quero pagar com cartão de crédito meu" → ✅ "Quero pagar com meu cartão de crédito."`
  },
  {
    title:"🇲🇽 Ordering Nutrition at a Mexican Market",
    lang:"ES",
    desc:"You're at a Mercado in CDMX trying to find high-protein foods for your cut.",
    prompt:`Buenos días. Estoy buscando alimentos altos en proteína y bajos en carbohidratos. Necesito pollo, atún, huevos y verduras frescas. ¿Cuánto cuesta el kilo de pechuga de pollo?`,
    correction:`❌ "Alimentos con mucho proteína" → ✅ "Alimentos altos en proteína" — "proteína" is feminine: "alta en proteína." ❌ "Quiero pagar cara" → ✅ "No quiero pagar caro" — don't mix gender with adverbs.`
  },
  {
    title:"🇧🇷 Making Friends at a Rio Beach Gym",
    lang:"PT",
    desc:"You're at a calçadão workout station on Ipanema beach.",
    prompt:`Oi! Você treina aqui todo dia? Sou personal trainer americano, me chamo Akeem. Estou cortando peso agora — estou em déficit calórico. Você faz dieta também?`,
    correction:`❌ "Eu sou cortando" → ✅ "Estou cortando" — use estar for ongoing action. ❌ "Eu treino a musculação" → ✅ "Eu treino musculação" — no article needed here.`
  },
];

const intentions = [
  {week:"WEEKS 1–2", theme:"I AM DISCIPLINED",
   es:"Soy disciplinado. Mi cuerpo obedece mi mente. Cada cardio me acerca a 175 libras de poder.",
   pt:"Sou disciplinado. Meu corpo obedece à minha mente. Cada cardio me aproxima de 175 libras de poder."},
  {week:"WEEKS 3–4", theme:"I AM CUTTING CLEAN",
   es:"Corto con precisión quirúrgica. El déficit es mi herramienta. Cada libra perdida revela mi mejor versión.",
   pt:"Corto com precisão cirúrgica. O déficit é minha ferramenta. Cada quilo perdido revela minha melhor versão."},
  {week:"WEEKS 5–6", theme:"I AM RELENTLESS",
   es:"No paro. No me rindo. Soy un atleta de élite construyendo su legado en cada sesión de cardio.",
   pt:"Não paro. Não desisto. Sou um atleta de elite construindo meu legado a cada sessão de cardio."},
  {week:"WEEKS 7–8", theme:"175 IS MINE",
   es:"175 libras son mías. Mi masa muscular crece. Mi grasa disminuye. Soy el arquetipo del entrenador.",
   pt:"175 libras são minhas. Minha massa muscular cresce. Minha gordura diminui. Sou o arquétipo do treinador."},
  {week:"WEEKS 9–10", theme:"I SPEAK POWER",
   es:"Hablo dos idiomas del poder. Sirvo a más clientes. Expando Build Believe Fit sin fronteras.",
   pt:"Falo dois idiomas do poder. Sirvo mais clientes. Expando a Build Believe Fit sem fronteiras."},
  {week:"WEEKS 11–12", theme:"I AM THE BRAND",
   es:"Soy Build Believe Fit. Construyo. Creo. Logro. En 175 libras, con dos idiomas y sin límites.",
   pt:"Sou a Build Believe Fit. Construo. Acredito. Conquisto. Com 175 libras, dois idiomas e sem limites."},
];

const roadmapPhases = [
  {
    num:"01", name:"FOUNDATION", weeks:"WEEKS 1–3",
    es:"Duolingo 15 min (AM) + Pimsleur 30 min (post-workout cooldown) + Memrise fitness deck 10 min",
    pt:"Pimsleur Units 1–7 daily. Add 10 PT phrases/week from Survival Kit.",
    daily:["ES Duo","ES Pimsleur","PT Phrases","ES Duo","ES Vocab","PT Pimsleur","Rest / Review"]
  },
  {
    num:"02", name:"ACCELERATION", weeks:"WEEKS 4–7",
    es:"Script rehearsal 3×/week during warm-up. Begin recording short coaching clips in Spanish.",
    pt:"Pimsleur Level 2 begins. Add Brazilian YouTube (no subtitles). Start Italki tutor.",
    daily:["ES Script","PT Pimsleur","ES Vocab + PT Phrases","ES Script","PT Tutor","ES+PT Mixed","Rest / Audio"]
  },
  {
    num:"03", name:"IMMERSION", weeks:"WEEKS 8–11",
    es:"Full client roleplay in Spanish 2×/week. Translate one BBF social post per day.",
    pt:"Full gym convos in PT. Record 2-min PT monologue weekly. PT journal nightly.",
    daily:["ES Client RP","PT Pimsleur","ES Social Post","PT Tutor","ES Vocab Review","PT Monologue","Rest / Listen"]
  },
  {
    num:"04", name:"MASTERY SPRINT", weeks:"WEEK 12",
    es:"Record full Spanish coaching session. Post bilingual Instagram Reel.",
    pt:"Record full PT Reel for BBF brand. Explain split & fasting in PT without notes.",
    daily:["ES Reel Prep","PT Reel Prep","ES Record","PT Record","Edit + Post","Rest","Celebrate"]
  }
];

// ─── COMPONENTS ───────────────────────────────────────────────────────────────

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return <button className={`copy-btn${copied?" copied":""}`} onClick={copy}>{copied?"✓ COPIED":"COPY"}</button>;
}

function TabVocab() {
  const [activecat, setActivecat] = useState("ANATOMY");
  const cats = Object.keys(vocabData);
  return (
    <div>
      <div className="section-label">TASK 1 · BILINGUAL COACH ENGINE</div>
      <div className="section-title">FITNESS VOCABULARY <span>MATRIX</span></div>
      <div className="section-desc">100 critical Spanish terms across anatomy, nutrition, training science, and coaching cues — your daily language gym.</div>
      <div className="stat-row">
        <div className="stat"><div className="stat-num">100</div><div className="stat-label">Spanish Terms</div></div>
        <div className="stat"><div className="stat-num">4</div><div className="stat-label">Categories</div></div>
        <div className="stat"><div className="stat-num">3</div><div className="stat-label">Coach Scripts</div></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {cats.map(c => (
          <button key={c} onClick={() => setActivecat(c)}
            style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:2,padding:"7px 14px",
              background:activecat===c?PURPLE:"#1a1a1a",color:activecat===c?YELLOW:"#888",
              border:`1px solid ${activecat===c?PURPLE:"#2a2a2a"}`,borderRadius:3,cursor:"pointer"}}>
            {c}
          </button>
        ))}
      </div>
      <div className="vocab-grid">
        {vocabData[activecat].map((v,i) => (
          <div className="vocab-item" key={i}>
            <div>
              <div className="vocab-es">{v.es}</div>
              <div className="vocab-cat">{activecat}</div>
            </div>
            <div className="vocab-en">{v.en}</div>
          </div>
        ))}
      </div>

      <hr className="divider"/>
      <div className="card-title">COACHING SCRIPTS</div>
      {scripts.map((s,i) => (
        <div className="script-block" key={i}>
          <div className="script-label">{s.title}</div>
          {s.lines.map((l,j) => (
            <div className="script-line" key={j}>
              <span className="es">"{l.es}"</span><br/>
              <span className="en">{l.en}</span>
            </div>
          ))}
          <CopyBtn text={s.lines.map(l=>`ES: "${l.es}"\nEN: ${l.en}`).join("\n")} />
        </div>
      ))}
    </div>
  );
}

function TabPortuguese() {
  const [filter, setFilter] = useState("all");
  const cats = ["all","social","airport/nav","food","gym","social+"];
  const filtered = filter==="all" ? ptPhrases : ptPhrases.filter(p=>p.cat===filter);
  return (
    <div>
      <div className="section-label">TASK 2 · RIO READY PROTOCOL</div>
      <div className="section-title">SOCIAL <span>SURVIVAL KIT</span></div>
      <div className="section-desc">50 high-leverage Brazilian Portuguese phrases for airports, food, gym culture, and making connections. Memorize 10/week.</div>
      <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
        {cats.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,padding:"6px 12px",
              background:filter===c?"#0a2a2a":"#1a1a1a",color:filter===c?"#22d3ee":"#888",
              border:`1px solid ${filter===c?"#22d3ee":"#2a2a2a"}`,borderRadius:3,cursor:"pointer",textTransform:"uppercase"}}>
            {c==="all"?"ALL":c}
          </button>
        ))}
      </div>
      {filtered.map(p => (
        <div className="phrase-item" key={p.n}>
          <div className="phrase-num">{String(p.n).padStart(2,"0")}</div>
          <div style={{flex:1}}>
            <div>
              <span className="phrase-pt">{p.pt}</span>
              <span className="phrase-cat-tag">{p.cat}</span>
            </div>
            <div className="phrase-en">{p.en}</div>
          </div>
        </div>
      ))}
      <hr className="divider"/>
      <div className="card-title">30-DAY EAR TRAINING SCHEDULE · PIMSLEUR</div>
      {pimsleurSchedule.map((w,i) => (
        <div className="week-row" key={i}>
          <div className="week-num">{w.week}</div>
          <div className="week-content">
            <div className="week-title">{w.title}</div>
            <div className="week-detail">{w.detail}</div>
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
      <div className="section-label">TASK 3 · INTERACTIVE DRILLS</div>
      <div className="section-title">GOD-MODE <span>ROLEPLAY</span></div>
      <div className="section-desc">Select a scenario. Copy the trigger prompt — paste it to me and I'll respond ONLY in the target language with live correction if you make errors.</div>
      <div className="roleplay-trigger" onClick={() => setSelected(selected===null?0:null)}>
        <div className="roleplay-trigger-label">ACTIVATE IMMERSION MODE</div>
        <div className="roleplay-trigger-title">⚡ GOD MODE ENGAGED</div>
      </div>
      {scenarios.map((s,i) => (
        <div key={i} className={`scenario-card${selected===i?" selected":""}`} onClick={() => setSelected(selected===i?null:i)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div className="scenario-title">{s.title}</div>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,
              background:s.lang==="ES"?PURPLE:"#0a3a3a",color:s.lang==="ES"?YELLOW:"#22d3ee",
              padding:"3px 10px",borderRadius:2}}>{s.lang}</span>
          </div>
          <div className="scenario-desc">{s.desc}</div>
          {selected===i && (
            <>
              <div className="scenario-prompt">
                <strong style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,color:YELLOW,display:"block",marginBottom:6}}>📋 PASTE THIS PROMPT TO TRIGGER GOD MODE:</strong>
                "Act as a local in this scenario. Respond ONLY in {s.lang==="ES"?"Spanish":"Brazilian Portuguese"}. If I make a grammar mistake, stop and correct me immediately with the format: ❌ [my error] → ✅ [correction] + brief explanation. Then continue the scene. Here is the scenario: <br/>{s.prompt}"
              </div>
              <div className="correction-box">
                <div className="correction-label">⚡ COMMON ERRORS TO WATCH</div>
                <div className="correction-text">{s.correction}</div>
              </div>
              <CopyBtn text={`Act as a local in this scenario. Respond ONLY in ${s.lang==="ES"?"Spanish":"Brazilian Portuguese"}. If I make a grammar mistake, stop and correct me immediately with the format: ❌ [my error] → ✅ [correction] + brief explanation. Then continue the scene.\n\nScenario: ${s.desc}\n\nOpening: ${s.prompt}`} />
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
      <div className="section-label">TASK 4 · 175 LB GOAL INTEGRATION</div>
      <div className="section-title">CARDIO <span>INTENTION STATEMENTS</span></div>
      <div className="section-desc">Recite these during your cardio sessions. Spanish first, then Portuguese. Speak them out loud — this doubles as language practice and manifestation work. Own every word.</div>
      {intentions.map((item,i) => (
        <div className="intention-card" key={i}>
          <div className="intention-week">{item.week}</div>
          <div className="intention-theme">{item.theme}</div>
          <div className="two-col">
            <div>
              <div className="intention-lang intention-es">🇪🇸 ESPAÑOL</div>
              <div className="intention-text">"{item.es}"</div>
              <CopyBtn text={item.es} />
            </div>
            <div>
              <div className="intention-lang intention-pt">🇧🇷 PORTUGUÊS</div>
              <div className="intention-text">"{item.pt}"</div>
              <CopyBtn text={item.pt} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TabRoadmap() {
  const days = ["MON","TUE","WED","THU","FRI","SAT","SUN"];
  return (
    <div>
      <div className="section-label">90-DAY STRUCTURED ROADMAP</div>
      <div className="section-title">THE <span>PROTOCOL</span></div>
      <div className="section-desc">Four phases. Copy-pasteable weekly focus blocks. Integrate into your 2-hour bodybuilding sessions — warm-up for vocabulary, cooldown for Pimsleur, cardio for intentions.</div>

      <div className="stat-row">
        <div className="stat"><div className="stat-num">90</div><div className="stat-label">Days</div></div>
        <div className="stat"><div className="stat-num">2</div><div className="stat-label">Languages</div></div>
        <div className="stat"><div className="stat-num">4</div><div className="stat-label">Phases</div></div>
        <div className="stat"><div className="stat-num">3</div><div className="stat-label">Apps Used</div></div>
      </div>

      <div className="card" style={{background:"#0d0d1a",borderColor:PURPLE,marginBottom:24}}>
        <div className="card-title">DAILY INTEGRATION TEMPLATE</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:8}}>
          {[
            {time:"WARM-UP (10 MIN)",act:"Spanish vocab flashcards (Memrise) or script rehearsal"},
            {time:"WORKOUT (75 MIN)",act:"Pimsleur audio (PT) through ONE earbud during isolation sets"},
            {time:"CARDIO / COOLDOWN (20 MIN)",act:"Recite weekly Intention Statement in both languages. Shadow Pimsleur."},
          ].map((t,i)=>(
            <div key={i} style={{background:"#111",border:`1px solid #222`,borderRadius:3,padding:12}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:13,letterSpacing:2,color:YELLOW,marginBottom:6}}>{t.time}</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#ccc",lineHeight:1.5}}>{t.act}</div>
            </div>
          ))}
        </div>
      </div>

      {roadmapPhases.map((p,i) => (
        <div className="roadmap-phase" key={i}>
          <div className="phase-header">
            <div className="phase-num">{p.num}</div>
            <div className="phase-info">
              <div className="phase-name">{p.name}</div>
              <div className="phase-weeks">{p.weeks}</div>
            </div>
          </div>
          <div className="two-col" style={{marginBottom:12}}>
            <div className="card" style={{padding:14}}>
              <div className="card-subtitle">🇪🇸 ESPAÑOL FOCUS</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#ccc",lineHeight:1.6}}>{p.es}</div>
            </div>
            <div className="card" style={{padding:14,borderColor:"#0a3a3a"}}>
              <div className="card-subtitle" style={{color:"#22d3ee"}}>🇧🇷 PORTUGUÊS FOCUS</div>
              <div style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:14,color:"#ccc",lineHeight:1.6}}>{p.pt}</div>
            </div>
          </div>
          <div className="day-grid">
            {days.map(d => <div className="day-header" key={d}>{d}</div>)}
            {p.daily.map((act,j) => (
              <div className="day-slot" key={j}>
                <div className="day-slot-act">{act}</div>
              </div>
            ))}
          </div>
          <CopyBtn text={`PHASE ${p.num} — ${p.name} (${p.weeks})\n\nES: ${p.es}\nPT: ${p.pt}\n\nWeekly Daily Schedule:\n${days.map((d,j)=>`${d}: ${p.daily[j]}`).join("\n")}`} />
        </div>
      ))}

      <div className="card" style={{background:"linear-gradient(135deg,#1a0030,#0a0a0a)",borderColor:YELLOW,marginTop:8}}>
        <div className="card-title" style={{fontSize:22}}>✅ 90-DAY SUCCESS BENCHMARKS</div>
        {[
          "Hold a 5-minute Spanish coaching session without pausing",
          "Navigate a São Paulo gym entirely in Portuguese",
          "Recite all 6 intention statements from memory, both languages",
          "Post 1 bilingual BBF Instagram Reel",
          "Complete Pimsleur Brazilian Portuguese Level 2",
          "Land at 175 lbs — cut complete",
        ].map((b,i) => (
          <div key={i} style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:YELLOW,minWidth:28}}>{i+1}</span>
            <span style={{fontFamily:"'Barlow Condensed',sans-serif",fontSize:15,color:"#ddd"}}>{b}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  {id:"vocab",label:"🇪🇸 Vocab Matrix"},
  {id:"pt",label:"🇧🇷 Rio Ready"},
  {id:"roleplay",label:"⚡ God-Mode Drills"},
  {id:"intentions",label:"🎯 Intentions"},
  {id:"roadmap",label:"📋 90-Day Roadmap"},
];

export default function App() {
  const [tab, setTab] = useState("vocab");
  return (
    <>
      <style>{styles}</style>
      <div className="bbf-app">
        <div className="header">
          <div className="header-brand">BUILD BELIEVE FIT LLC · AKEEM</div>
          <div className="header-title">90-DAY LANGUAGE<br/><span>MASTERY PROTOCOL</span></div>
          <div className="header-sub">Spanish + Brazilian Portuguese · Bilingual Coach System</div>
          <div className="header-badges">
            <span className="badge">NASM Certified</span>
            <span className="badge">🇪🇸 Spanish</span>
            <span className="badge">🇧🇷 Portuguese</span>
            <span className="badge">175 LB Target</span>
          </div>
        </div>
        <nav className="nav">
          {TABS.map(t => (
            <button key={t.id} className={`nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
        <div className="content">
          {tab==="vocab" && <TabVocab/>}
          {tab==="pt" && <TabPortuguese/>}
          {tab==="roleplay" && <TabRoleplay/>}
          {tab==="intentions" && <TabIntentions/>}
          {tab==="roadmap" && <TabRoadmap/>}
        </div>
      </div>
    </>
  );
}
