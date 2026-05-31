// src/context/LangContext.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 17 — Trilingual (EN / ES / PT) i18n for the React marketing surface.
//
// A lightweight state-dictionary solution (no react-i18next dependency needed for
// this scope): a flat key → { en, es, pt } map + a useLang() hook exposing
// { lang, setLang, t }. Translations are taken VERBATIM from the legacy
// bbf-lang.js trilingual dictionary (the strings BBF already ships) — NOT machine-
// translated here. Choice persists to localStorage under the monolith's own
// 'bbf_lang' key for cross-surface parity.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { LANGS } from './langs.js';

const STORAGE_KEY = 'bbf_lang';

// Verbatim from bbf-lang.js. Only the keys the React marketing surface renders.
const DICT = {
  // nav
  'nav-services': { en: 'Services', es: 'Servicios', pt: 'Serviços' },
  'nav-programs': { en: 'Programs', es: 'Programas', pt: 'Programas' },
  'nav-audit': { en: 'Audit', es: 'Auditoría', pt: 'Auditoria' },
  'nav-about': { en: 'About', es: 'Acerca', pt: 'Sobre' },
  'nav-signin': { en: 'Sign In', es: 'Entrar', pt: 'Entrar' },
  'nav-start': { en: 'Start', es: 'Comenzar', pt: 'Começar' },
  // hero
  'hero-badge': { en: 'Performance Architect · Sovereign Gold Standard', es: 'Arquitecto de Rendimiento · Estándar Soberano de Oro', pt: 'Arquiteto de Performance · Padrão Soberano de Ouro' },
  'hero-sub': { en: 'Universal performance for the high-demand human. We optimize the habit architecture of everyday athletes, executives, and first responders. Your schedule is the context. Your potential is the focus.', es: 'Rendimiento universal para el ser humano de alta demanda. Optimizamos la arquitectura de hábitos de atletas cotidianos, ejecutivos y socorristas. Tu horario es el contexto. Tu potencial es el enfoque.', pt: 'Performance universal para o ser humano de alta demanda. Otimizamos a arquitetura de hábitos de atletas do dia a dia, executivos e socorristas. Sua agenda é o contexto. Seu potencial é o foco.' },
  'hero-cta': { en: 'Start My Path →', es: 'Iniciar Mi Camino →', pt: 'Iniciar Meu Caminho →' },
  'stat-founded': { en: 'Est. · Founded', es: 'Est. · Fundado', pt: 'Est. · Fundado em' },
  'stat-standard': { en: 'Sovereign Standard', es: 'Estándar Soberano', pt: 'Padrão Soberano' },
  'stat-plans': { en: 'Custom Plans', es: 'Planes Personalizados', pt: 'Planos Personalizados' },
  'door-adults': { en: 'For Adults', es: 'Para Adultos', pt: 'Para Adultos' },
  'door-vault': { en: 'Enter The Vault', es: 'Entrar a La Bóveda', pt: 'Entrar no Cofre' },
  'door-vault-sub': { en: 'Sovereign Client Portal →', es: 'Portal del Cliente Soberano →', pt: 'Portal do Cliente Soberano →' },
  'door-youth': { en: 'Youth & Collegiate', es: 'Juvenil y Universitario', pt: 'Juvenil e Universitário' },
  'door-athlete': { en: 'Youth Athlete Portal', es: 'Portal del Atleta Juvenil', pt: 'Portal do Atleta Jovem' },
  'door-athlete-sub': { en: 'Performance & Pre-Hab →', es: 'Rendimiento y Pre-Hab →', pt: 'Performance e Pré-Hab →' },
  // services
  'svc-lbl': { en: 'What We Offer', es: 'Lo Que Ofrecemos', pt: 'O Que Oferecemos' },
  'svc-h': { en: 'How We Get You There', es: 'Cómo Te Llevamos Allí', pt: 'Como Te Levamos Lá' },
  // programs
  'prog-lbl': { en: 'Choose Your Path', es: 'Elige Tu Camino', pt: 'Escolha Seu Caminho' },
  'prog-h': { en: 'Two Paths. One Standard.', es: 'Dos Caminos. Un Estándar.', pt: 'Dois Caminhos. Um Padrão.' },
  'prog-sub': { en: 'Run the system yourself with the Autonomous Engine, or go Founder-Direct with the Sovereign Standard. Same biomechanical precision, same Sovereign Gold Standard — your choice of autonomy or access.', es: 'Ejecuta el sistema tú mismo con el Motor Autónomo, o ve directo con el Fundador con el Estándar Soberano. La misma precisión biomecánica, el mismo Estándar Soberano de Oro: tu elección de autonomía o acceso.', pt: 'Rode o sistema você mesmo com o Motor Autônomo, ou vá direto com o Fundador no Padrão Soberano. A mesma precisão biomecânica, o mesmo Padrão Soberano de Ouro — sua escolha de autonomia ou acesso.' },
  'prog-apply': { en: 'Apply →', es: 'Aplicar →', pt: 'Candidatar →' },
  // tdee
  'tdee-lbl': { en: 'Free Tool', es: 'Herramienta Gratis', pt: 'Ferramenta Grátis' },
  'tdee-h': { en: 'Calculate Your Targets', es: 'Calcula Tus Objetivos', pt: 'Calcule Suas Metas' },
  'tdee-sub': { en: 'Get your maintenance calories and macro split in seconds — then carry them straight into your application.', es: 'Obtén tus calorías de mantenimiento y tu división de macros en segundos, y llévalas directo a tu solicitud.', pt: 'Obtenha suas calorias de manutenção e divisão de macros em segundos — e leve-as direto para sua candidatura.' },
  'tdee-age': { en: 'Age', es: 'Edad', pt: 'Idade' },
  'tdee-sex': { en: 'Sex', es: 'Sexo', pt: 'Sexo' },
  'tdee-male': { en: 'Male', es: 'Masculino', pt: 'Masculino' },
  'tdee-female': { en: 'Female', es: 'Femenino', pt: 'Feminino' },
  'tdee-weight': { en: 'Weight (lbs)', es: 'Peso (lbs)', pt: 'Peso (lbs)' },
  'tdee-activity': { en: 'Activity Level', es: 'Nivel de Actividad', pt: 'Nível de Atividade' },
  'tdee-goal': { en: 'Goal', es: 'Objetivo', pt: 'Objetivo' },
  'tdee-goal-cut': { en: 'Fat Loss', es: 'Pérdida de Grasa', pt: 'Perda de Gordura' },
  'tdee-goal-maintain': { en: 'Maintain', es: 'Mantener', pt: 'Manter' },
  'tdee-goal-gain': { en: 'Build Muscle', es: 'Ganar Músculo', pt: 'Ganhar Músculo' },
  'tdee-calc': { en: 'Calculate →', es: 'Calcular →', pt: 'Calcular →' },
  'tdee-target': { en: 'Daily Target', es: 'Objetivo Diario', pt: 'Meta Diária' },
  'tdee-cta': { en: 'Use These In My Application →', es: 'Usar Estos En Mi Solicitud →', pt: 'Usar Estes Na Minha Candidatura →' },
  'tdee-act-sed': { en: 'Sedentary', es: 'Sedentario', pt: 'Sedentário' },
  'tdee-act-light': { en: 'Lightly Active (1-3x/week)', es: 'Ligeramente Activo (1-3x/sem)', pt: 'Levemente Ativo (1-3x/sem)' },
  'tdee-act-mod': { en: 'Moderately Active (3-5x/week)', es: 'Moderadamente Activo (3-5x/sem)', pt: 'Moderadamente Ativo (3-5x/sem)' },
  'tdee-act-very': { en: 'Very Active (6-7x/week)', es: 'Muy Activo (6-7x/sem)', pt: 'Muito Ativo (6-7x/sem)' },
  'tdee-act-extreme': { en: 'Extremely Active / Physical Job', es: 'Extremadamente Activo / Trabajo Físico', pt: 'Extremamente Ativo / Trabalho Físico' },
  // interrogator
  'intg-kicker': { en: 'Lead-Gen Audit · The Interrogator', es: 'Auditoría · El Interrogador', pt: 'Auditoria · O Interrogador' },
  'intg-sub': { en: 'Paste your current workout split. The audit engine surfaces the structural gaps your program is hiding and prescribes the exact BBF architecture that closes them. No email. No friction.', es: 'Pega tu rutina actual. El motor de auditoría revela los vacíos estructurales que tu programa esconde y prescribe la arquitectura BBF exacta que los cierra. Sin correo. Sin fricción.', pt: 'Cole sua rotina atual. O motor de auditoria revela as lacunas estruturais que seu programa esconde e prescreve a arquitetura BBF exata que as fecha. Sem e-mail. Sem fricção.' },
  'intg-go': { en: 'Audit My Protocol →', es: 'Auditar Mi Protocolo →', pt: 'Auditar Meu Protocolo →' },
  // chatbox
  'chat-title': { en: 'Ask BBF', es: 'Pregunta a BBF', pt: 'Pergunte à BBF' },
  'chat-greeting': { en: "Hey — I'm the BBF assistant. Ask me about programs, pricing, nutrition, or which path fits you. What's on your mind?", es: 'Hola, soy el asistente de BBF. Pregúntame sobre programas, precios, nutrición o qué camino te conviene. ¿Qué tienes en mente?', pt: 'Olá, sou o assistente da BBF. Pergunte sobre programas, preços, nutrição ou qual caminho serve para você. O que você tem em mente?' },
  'chat-placeholder': { en: 'Type your question…', es: 'Escribe tu pregunta…', pt: 'Digite sua pergunta…' },
  'chat-send': { en: 'Send', es: 'Enviar', pt: 'Enviar' },
  // pathfinder
  'pf-lbl': { en: 'Start Your Journey', es: 'Inicia Tu Camino', pt: 'Inicie Sua Jornada' },
  'pf-h': { en: 'The Pathfinder', es: 'El Explorador', pt: 'O Explorador' },
  'pf-sub': { en: "Tell us about yourself — we'll personalize everything and Akeem will reach out within 24 hours.", es: 'Cuéntanos sobre ti: personalizaremos todo y Akeem te contactará en 24 horas.', pt: 'Conte-nos sobre você — personalizaremos tudo e Akeem entrará em contato em 24 horas.' },

  // ── Phase 17.5 — long-form copy (verbatim from bbf-lang.js) ──────────────────
  // hero stats (stat-founded defined above; CPT cert + plans here)
  'stat-cert': { en: 'Certified CPT', es: 'CPT Certificado', pt: 'CPT Certificado' },
  'stat-plans-2': { en: 'Custom Plans', es: 'Planes Personalizados', pt: 'Planos Personalizados' },

  // services — names + descriptions
  'svc-n1': { en: 'Strength Coaching', es: 'Coaching de Fuerza', pt: 'Coaching de Força' },
  'svc-d1': { en: 'Progressive overload programming built around your schedule, recovery capacity, and goals. Not a template — a system designed for you.', es: 'Programación de sobrecarga progresiva construida alrededor de tu horario, capacidad de recuperación y objetivos. No es una plantilla — es un sistema diseñado para ti.', pt: 'Programação de sobrecarga progressiva construída ao redor da sua agenda, capacidade de recuperação e objetivos. Não é um modelo — é um sistema desenhado para você.' },
  'svc-n2': { en: 'Nutrition Coaching', es: 'Coaching Nutricional', pt: 'Coaching Nutricional' },
  'svc-d2': { en: 'Custom meal plans calibrated to your TDEE, your training intensity, and your real life — not a generic macro split from the internet.', es: 'Planes alimenticios personalizados calibrados a tu TDEE, tu intensidad de entrenamiento y tu vida real — no una división genérica de macros de internet.', pt: 'Planos alimentares personalizados calibrados ao seu TDEE, sua intensidade de treino e sua vida real — não uma divisão genérica de macros da internet.' },
  'svc-n3': { en: 'Program Design', es: 'Diseño de Programas', pt: 'Design de Programas' },
  'svc-d3': { en: 'Day-by-day periodized programs designed for real people with real jobs. Recovery built in. Progress guaranteed when you follow the plan.', es: 'Programas periodizados día a día diseñados para personas reales con trabajos reales. Recuperación integrada. Progreso garantizado cuando sigues el plan.', pt: 'Programas periodizados dia a dia desenhados para pessoas reais com trabalhos reais. Recuperação integrada. Progresso garantido quando você segue o plano.' },
  'svc-n4': { en: 'Elite Transformation', es: 'Transformación de Élite', pt: 'Transformação de Elite' },
  'svc-d4': { en: 'Full 90-day overhaul — body composition, movement quality, and habit architecture. The complete package for serious, lasting results.', es: 'Renovación completa de 90 días — composición corporal, calidad de movimiento y arquitectura de hábitos. El paquete completo para resultados serios y duraderos.', pt: 'Renovação completa de 90 dias — composição corporal, qualidade de movimento e arquitetura de hábitos. O pacote completo para resultados sérios e duradouros.' },
  'svc-n5': { en: 'Remote Coaching', es: 'Coaching Remoto', pt: 'Coaching Remoto' },
  'svc-d5': { en: 'Full access to your custom app portal, weekly check-ins, meal plan updates, and direct coach access — wherever you train.', es: 'Acceso completo a tu portal personalizado, revisiones semanales, actualizaciones de plan alimenticio y acceso directo al coach — donde sea que entrenes.', pt: 'Acesso completo ao seu portal personalizado, revisões semanais, atualizações do plano alimentar e acesso direto ao coach — onde quer que treine.' },
  'svc-n6': { en: 'Human Performance Protocol', es: 'Protocolo de Rendimiento Humano', pt: 'Protocolo de Performance Humana' },
  'svc-d6': { en: 'Performance architecture engineered around your life — your schedule, your recovery window, your occupation. Habit systems that compound over time.', es: 'Arquitectura de rendimiento diseñada alrededor de tu vida — tu horario, tu ventana de recuperación, tu ocupación. Sistemas de hábitos que se multiplican con el tiempo.', pt: 'Arquitetura de performance projetada ao redor da sua vida — sua agenda, sua janela de recuperação, sua ocupação. Sistemas de hábitos que se multiplicam com o tempo.' },

  // founder
  'founder-lbl': { en: 'The Founder', es: 'El Fundador', pt: 'O Fundador' },
  'founder-h': { en: 'The Story Behind BBF', es: 'La Historia Detrás de BBF', pt: 'A História Por Trás do BBF' },
  'founder-p1': { en: 'I built these protocols as a father and everyday athlete protecting my own joints through real life — not from a textbook. That environment didn’t limit me. It revealed the system. My life became the proving ground for every protocol I now deliver.', es: 'Construí estos protocolos como padre y atleta cotidiano protegiendo mis propias articulaciones a través de la vida real — no desde un libro de texto. Ese entorno no me limitó. Reveló el sistema. Mi vida se convirtió en el campo de pruebas de cada protocolo que ahora entrego.', pt: 'Construí estes protocolos como pai e atleta cotidiano protegendo minhas próprias articulações através da vida real — não de um livro didático. Esse ambiente não me limitou. Revelou o sistema. Minha vida se tornou o campo de provas de cada protocolo que agora entrego.' },
  'founder-p2': { en: 'Build Believe Fit was born between obligations — in the windows of time most people overlook. I’m a Performance Architect, a passionate lifter, a father of 4, and an Exercise Science student becoming an Occupational Therapist. I understand the human body and the human schedule. That’s the biomechanical precision that makes this system work.', es: 'Build Believe Fit nació entre obligaciones — en las ventanas de tiempo que la mayoría ignora. Soy un Arquitecto de Rendimiento, un levantador apasionado, padre de 4, y estudiante de Ciencias del Ejercicio convirtiéndome en Terapeuta Ocupacional. Entiendo el cuerpo humano y el horario humano. Esa es la precisión biomecánica que hace funcionar este sistema.', pt: 'Build Believe Fit nasceu entre obrigações — nas janelas de tempo que a maioria ignora. Sou um Arquiteto de Performance, levantador apaixonado, pai de 4, e estudante de Ciências do Exercício tornando-me Terapeuta Ocupacional. Entendo o corpo humano e a agenda humana. Essa é a precisão biomecânica que faz este sistema funcionar.' },
  'founder-p3': { en: 'My clients aren’t defined by their occupation. They’re defined by their refusal to let their schedule become their ceiling. Executives. First responders. Parents. Everyday athletes. Every one of them runs on the same system because human performance architecture doesn’t discriminate.', es: 'Mis clientes no se definen por su ocupación. Se definen por su negativa a dejar que su horario se convierta en su techo. Ejecutivos. Socorristas. Padres. Atletas cotidianos. Todos funcionan con el mismo sistema porque la arquitectura de rendimiento humano no discrimina.', pt: 'Meus clientes não são definidos pela ocupação. São definidos pela recusa em deixar sua agenda se tornar seu teto. Executivos. Socorristas. Pais. Atletas do dia a dia. Todos funcionam no mesmo sistema porque a arquitetura de performance humana não discrimina.' },
  'founder-sig-name': { en: '— Akeem Brown', es: '— Akeem Brown', pt: '— Akeem Brown' },
  'founder-sig-sub': { en: 'Owner, BBF LLC · Movement Specialist · Exercise Science · Future OT', es: 'Propietario, BBF LLC · Especialista en Movimiento · Ciencias del Ejercicio · Futuro TO', pt: 'Proprietário, BBF LLC · Especialista em Movimento · Ciências do Exercício · Futuro TO' },
  // credentials
  'cred-t1': { en: 'Movement Specialist', es: 'Especialista en Movimiento', pt: 'Especialista em Movimento' },
  'cred-s1': { en: 'OT-Focused Coaching — Exercise Science', es: 'Entrenamiento con Enfoque en TO — Ciencias del Ejercicio', pt: 'Treinamento com Foco em TO — Ciências do Exercício' },
  'cred-t2': { en: 'Joint Protection & Prehab Architect', es: 'Arquitecto de Protección Articular y Prehab', pt: 'Arquiteto de Proteção Articular e Prehab' },
  'cred-s2': { en: 'Human Performance Architect · Habit System Designer', es: 'Arquitecto de Rendimiento Humano · Diseñador de Sistemas de Hábitos', pt: 'Arquiteto de Performance Humana · Designer de Sistemas de Hábitos' },
  'cred-t3': { en: 'Fitness Enthusiast & Lifter', es: 'Entusiasta del Fitness & Levantador', pt: 'Entusiasta de Fitness & Levantador' },
  'cred-s3': { en: 'Dedicated to the craft of human performance', es: 'Dedicado al arte del rendimiento humano', pt: 'Dedicado à arte da performance humana' },
  'cred-t4': { en: 'Business & Marketing Student', es: 'Estudiante de Negocios & Marketing', pt: 'Estudante de Negócios & Marketing' },
  'cred-s4': { en: 'Chandler-Gilbert Community College', es: 'Chandler-Gilbert Community College', pt: 'Chandler-Gilbert Community College' },
  'cred-t5': { en: 'Father of 4', es: 'Padre de 4', pt: 'Pai de 4' },
  'cred-s5': { en: 'Coaches his son who plays football', es: 'Entrena a su hijo que juega fútbol americano', pt: 'Treina seu filho que joga futebol americano' },

  // origin / transformation
  'origin-lbl': { en: 'The Origin of the System', es: 'El Origen del Sistema', pt: 'A Origem do Sistema' },
  'origin-h': { en: 'The System Was Born Here', es: 'El Sistema Nació Aquí', pt: 'O Sistema Nasceu Aqui' },
  'origin-sub': { en: 'Not theory. Not a textbook protocol. A system discovered through lived experience and refined through science.', es: 'No es teoría. No es un protocolo de libro. Un sistema descubierto a través de la experiencia vivida y refinado por la ciencia.', pt: 'Não é teoria. Não é um protocolo de livro. Um sistema descoberto através da experiência vivida e refinado pela ciência.' },
  'origin-n1': { en: 'I built these protocols as a father and everyday athlete protecting my own joints through real life — not from a textbook. I didn’t build this from theory — I built it to solve the Human Habit Equation. The laboratory was my own life, and the results became the blueprint.', es: 'Construí estos protocolos como padre y atleta cotidiano protegiendo mis propias articulaciones a través de la vida real — no desde un libro de texto. No construí esto desde la teoría — lo construí para resolver la Ecuación del Hábito Humano. El laboratorio fue mi propia vida, y los resultados se convirtieron en el plan maestro.', pt: 'Construí estes protocolos como pai e atleta cotidiano protegendo minhas próprias articulações através da vida real — não de um livro didático. Não construí isso a partir de teoria — construí para resolver a Equação do Hábito Humano. O laboratório foi minha própria vida, e os resultados se tornaram o plano mestre.' },
  'origin-n2': { en: 'Now I deliver that same blueprint to every human who refuses to let their schedule define their ceiling. The executive. The first responder. The parent. The everyday athlete. The system doesn’t care about your title or your hours — it cares about your commitment.', es: 'Ahora entrego ese mismo plan a cada ser humano que se niega a dejar que su horario defina su techo. El ejecutivo. El socorrista. El padre. El atleta cotidiano. Al sistema no le importa tu título ni tus horas — le importa tu compromiso.', pt: 'Agora entrego esse mesmo plano a cada ser humano que se recusa a deixar sua agenda definir seu teto. O executivo. O socorrista. O pai. O atleta do dia a dia. O sistema não se importa com seu título ou suas horas — se importa com seu compromisso.' },
  'origin-n3': { en: 'Build Believe Fit exists to deliver that system. Anchor habits become engine habits. Your context becomes your catalyst. No matter your schedule, your title, or your starting point — the architecture works when you commit to it.', es: 'Build Believe Fit existe para entregar ese sistema. Los hábitos ancla se convierten en hábitos motor. Tu contexto se convierte en tu catalizador. Sin importar tu horario, tu título o tu punto de partida — la arquitectura funciona cuando te comprometes.', pt: 'Build Believe Fit existe para entregar esse sistema. Hábitos âncora se tornam hábitos motor. Seu contexto se torna seu catalisador. Não importa sua agenda, seu título ou seu ponto de partida — a arquitetura funciona quando você se compromete.' },
  'origin-cap-before': { en: 'Before', es: 'Antes', pt: 'Antes' },
  'origin-cap-after': { en: 'After', es: 'Después', pt: 'Depois' },

  // financial promise — Phase 15 two-pillar pricing (NOT the legacy $67/$1,197;
  // translated consistently with the current model).
  'promise-lbl': { en: 'The BBF Financial Integrity Promise', es: 'La Promesa de Integridad Financiera BBF', pt: 'A Promessa de Integridade Financeira BBF' },
  'promise-text': { en: 'Whether you run the Autonomous Engine at $47 a month or commit to the Sovereign Standard, you receive the same Founder-Verified attention to your joint safety, recovery, and long-term mobility. The price reflects access and depth — the Sovereign Gold Standard never changes.', es: 'Ya sea que uses el Motor Autónomo por $47 al mes o te comprometas con el Estándar Soberano, recibes la misma atención Verificada por el Fundador a tu seguridad articular, recuperación y movilidad a largo plazo. El precio refleja acceso y profundidad — el Estándar Soberano de Oro nunca cambia.', pt: 'Seja rodando o Motor Autônomo por $47 ao mês ou se comprometendo com o Padrão Soberano, você recebe a mesma atenção Verificada pelo Fundador à sua segurança articular, recuperação e mobilidade a longo prazo. O preço reflete acesso e profundidade — o Padrão Soberano de Ouro nunca muda.' },

  // contact / footer
  'foot-tag': { en: 'Performance Architecture & Movement Science · Est. 2021', es: 'Arquitectura de Rendimiento & Ciencia del Movimiento · Est. 2021', pt: 'Arquitetura de Performance & Ciência do Movimento · Est. 2021' },
  'foot-contact': { en: 'Contact', es: 'Contacto', pt: 'Contato' },

  // ── Phase 17.8 — Positional Blueprints (verbatim from bbf-lang.js) ───────────
  'pb-kicker': { en: 'Positional Blueprints', es: 'Planos Posicionales', pt: 'Planos Posicionais' },
  'pb-title': { en: 'Elite Position. Your Playbook.', es: 'Posición de Élite. Tu Manual.', pt: 'Posição de Elite. Seu Manual.' },
  'pb-sub': { en: 'Professional-grade programming, nutrition protocols, and recruitment targets for the high-performance household. 5 sports. 25 positions. Built in the Laboratory.', es: 'Programación profesional, protocolos nutricionales y objetivos de reclutamiento para el hogar de alto rendimiento. 5 deportes. 25 posiciones. Construido en el Laboratorio.', pt: 'Programação profissional, protocolos nutricionais e objetivos de recrutamento para o lar de alto desempenho. 5 esportes. 25 posições. Construído no Laboratório.' },
  'pb-cta': { en: 'Unlock Your Full Playbook →', es: 'Desbloquea Tu Manual Completo →', pt: 'Desbloqueie Seu Manual Completo →' },
  'pb-lab-verified': { en: 'Lab-Verified Drill', es: 'Ejercicio de Laboratorio', pt: 'Exercício de Laboratório' },
  'pb-founder-note': { en: 'Founder-Verified Protocols · The Sovereign Gold Standard.', es: 'Protocolos Verificados por el Fundador · El Estándar Soberano de Oro.', pt: 'Protocolos Verificados pelo Fundador · O Padrão Soberano de Ouro.' },
  'pb-sport-football': { en: 'Football', es: 'Fútbol Americano', pt: 'Futebol Americano' },
  'pb-sport-basketball': { en: 'Basketball', es: 'Baloncesto', pt: 'Basquete' },
  'pb-sport-soccer': { en: 'Soccer', es: 'Fútbol', pt: 'Futebol' },
  'pb-sport-baseball': { en: 'Baseball', es: 'Béisbol', pt: 'Beisebol' },
  'pb-sport-volleyball': { en: 'Volleyball', es: 'Voleibol', pt: 'Vôlei' },
};

const LangContext = createContext({ lang: 'en', setLang: () => {}, t: (k) => k });

function readLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return LANGS.includes(stored) ? stored : 'en';
  } catch { return 'en'; }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readLang);

  const setLang = useCallback((next) => {
    if (!LANGS.includes(next)) return;
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage blocked */ }
    setLangState(next);
  }, []);

  // t(key): returns the translation for the active language, falling back to EN,
  // then to the raw key (so a missing key is visible, never blank).
  const t = useCallback((key) => {
    const entry = DICT[key];
    if (!entry) return key;
    return entry[lang] ?? entry.en ?? key;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang() {
  return useContext(LangContext);
}
