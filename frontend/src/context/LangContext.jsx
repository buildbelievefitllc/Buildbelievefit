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
  // Primary registration CTA — renamed to the 30-Day Calibration narrative (CEO order).
  'hero-cta': { en: 'BEGIN CALIBRATION ➔', es: 'INICIAR CALIBRACIÓN ➔', pt: 'INICIAR CALIBRAÇÃO ➔' },
  // ── "Earn The Vault" — 30-Day Biometric Calibration landing manifesto (the band
  // directly under the hero). {phase} marks where the bold calibration phrase renders. ──
  'cal-land-lbl': { en: 'Earn The Vault', es: 'Gana El Cofre', pt: 'Conquiste o Cofre' },
  'cal-land-h': { en: "YOU DON'T DOWNLOAD A FITNESS APP. YOU GET CALIBRATED.", es: 'NO DESCARGAS UNA APP DE FITNESS. TE CALIBRAS.', pt: 'VOCÊ NÃO BAIXA UM APP DE FITNESS. VOCÊ É CALIBRADO.' },
  'cal-land-p1': { en: "Most fitness apps give you 500 exercises on Day 1 and hope you figure it out. That's how you get injured. At BBF Lab, we don't guess. We engineer.", es: 'La mayoría de las apps de fitness te dan 500 ejercicios el Día 1 y esperan que te las arregles. Así es como te lesionas. En BBF Lab, no adivinamos. Diseñamos con ingeniería.', pt: 'A maioria dos apps de fitness te dá 500 exercícios no Dia 1 e torce para você se virar. É assim que você se machuca. No BBF Lab, não adivinhamos. Nós engenheiramos.' },
  'cal-land-p2': { en: 'When you join, your access is restricted. You enter a mandatory {phase}. We map your nervous system, track your joint friction, and build your baseline before we hand you the keys to the full Vault.', es: 'Cuando te unes, tu acceso está restringido. Entras en una {phase} obligatoria. Mapeamos tu sistema nervioso, rastreamos la fricción de tus articulaciones y construimos tu línea base antes de entregarte las llaves del Cofre completo.', pt: 'Quando você entra, seu acesso é restrito. Você inicia uma {phase} obrigatória. Mapeamos seu sistema nervoso, rastreamos o atrito das suas articulações e construímos sua linha de base antes de entregar as chaves do Cofre completo.' },
  'cal-land-phase': { en: '30-Day Biometric Calibration', es: 'Calibración Biométrica de 30 Días', pt: 'Calibração Biométrica de 30 Dias' },
  'cal-land-sub': { en: 'EARN YOUR PROGRAMMING:', es: 'GANA TU PROGRAMACIÓN:', pt: 'CONQUISTE SUA PROGRAMAÇÃO:' },
  'cal-land-b1-lead': { en: 'Days 1–14 (The Baseline)', es: 'Días 1–14 (La Base)', pt: 'Dias 1–14 (A Base)' },
  'cal-land-b1-body': { en: 'You are locked on the rails. The engine maps you through daily check-ins and strict, clinical prescriptions.', es: 'Estás fijo en los rieles. El motor te mapea a través de chequeos diarios y prescripciones estrictas y clínicas.', pt: 'Você está travado nos trilhos. O motor te mapeia através de check-ins diários e prescrições estritas e clínicas.' },
  'cal-land-b2-lead': { en: 'Days 15–29 (The Ignition)', es: 'Días 15–29 (La Ignición)', pt: 'Dias 15–29 (A Ignição)' },
  'cal-land-b2-body': { en: 'Your custom Phase 10 Smart Cardio unlocks. The engine dynamically routes your recovery.', es: 'Tu Cardio Inteligente Fase 10 personalizado se desbloquea. El motor enruta dinámicamente tu recuperación.', pt: 'Seu Cardio Inteligente Fase 10 personalizado é desbloqueado. O motor roteia dinamicamente sua recuperação.' },
  'cal-land-b3-lead': { en: 'Day 30 (The Vault Opens)', es: 'Día 30 (El Cofre se Abre)', pt: 'Dia 30 (O Cofre se Abre)' },
  'cal-land-b3-body': { en: 'You graduate. The full Library and dynamic AI audio coaching unlock. You earn your permanent badge as a Sovereign Athlete.', es: 'Te gradúas. La Biblioteca completa y el coaching de audio con IA se desbloquean. Ganas tu insignia permanente como Atleta Soberano.', pt: 'Você se forma. A Biblioteca completa e o coaching de áudio com IA são desbloqueados. Você conquista seu selo permanente como Atleta Soberano.' },
  // CTA-card state chips (the earn-it ladder: Locked → Unlocking → Open).
  'cal-card-state-locked': { en: 'Locked', es: 'Bloqueado', pt: 'Bloqueado' },
  'cal-card-state-ignite': { en: 'Unlocking', es: 'Desbloqueando', pt: 'Desbloqueando' },
  'cal-card-state-open': { en: 'Open', es: 'Abierto', pt: 'Aberto' },
  'cmd-tab-content': { en: 'Content', es: 'Contenido', pt: 'Conteúdo' },
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
  'prog-h': { en: 'Four Paths. One Standard.', es: 'Cuatro Caminos. Un Estándar.', pt: 'Quatro Caminhos. Um Padrão.' },
  'prog-sub': { en: 'Online fitness, nutrition fueling, youth athlete development, or a Founder-direct hybrid protocol. Every path runs on the same biomechanical precision — the same Sovereign Gold Standard.', es: 'Fitness en línea, nutrición y combustible, desarrollo del atleta juvenil, o un protocolo híbrido directo con el Fundador. Cada camino corre sobre la misma precisión biomecánica: el mismo Estándar Soberano de Oro.', pt: 'Fitness online, nutrição e combustível, desenvolvimento do atleta jovem, ou um protocolo híbrido direto com o Fundador. Cada caminho corre sobre a mesma precisão biomecânica — o mesmo Padrão Soberano de Ouro.' },
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
  'promise-text': { en: 'Whether you run the Autonomous Engine at $49.99 a month or commit to the Sovereign Standard, you receive the same Founder-Verified attention to your joint safety, recovery, and long-term mobility. The price reflects access and depth — the Sovereign Gold Standard never changes.', es: 'Ya sea que uses el Motor Autónomo por $49.99 al mes o te comprometas con el Estándar Soberano, recibes la misma atención Verificada por el Fundador a tu seguridad articular, recuperación y movilidad a largo plazo. El precio refleja acceso y profundidad — el Estándar Soberano de Oro nunca cambia.', pt: 'Seja rodando o Motor Autônomo por $49.99 ao mês ou se comprometendo com o Padrão Soberano, você recebe a mesma atenção Verificada pelo Fundador à sua segurança articular, recuperação e mobilidade a longo prazo. O preço reflete acesso e profundidade — o Padrão Soberano de Ouro nunca muda.' },

  // contact / footer
  'foot-tag': { en: 'Performance Architecture & Movement Science · Est. 2021', es: 'Arquitectura de Rendimiento & Ciencia del Movimiento · Est. 2021', pt: 'Arquitetura de Performance & Ciência do Movimento · Est. 2021' },
  'foot-contact': { en: 'Contact', es: 'Contacto', pt: 'Contato' },
  'foot-privacy': { en: 'Privacy Policy', es: 'Política de Privacidad', pt: 'Política de Privacidade' },
  'foot-terms': { en: 'Terms of Service', es: 'Términos de Servicio', pt: 'Termos de Serviço' },
  'app-band-h': { en: 'Take the Vault with you', es: 'Lleva el Vault contigo', pt: 'Leve o Vault com você' },
  'app-band-sub': { en: 'Get the Build Believe Fit companion app on Google Play — your program, fueling plan, and coaching in your pocket. Install it, then sign in with the username and PIN your coach sent you.', es: 'Descarga la app oficial de Build Believe Fit en Google Play — tu programa, plan de nutrición y coaching en tu bolsillo. Instálala e inicia sesión con el usuario y PIN que te envió tu coach.', pt: 'Baixe o app oficial Build Believe Fit no Google Play — seu programa, plano alimentar e coaching no seu bolso. Instale e entre com o usuário e PIN que seu coach enviou.' },
  'app-badge-alt': { en: 'Get it on Google Play', es: 'Disponible en Google Play', pt: 'Disponível no Google Play' },
  'app-pwa-tag': { en: 'No store needed', es: 'Sin tienda', pt: 'Sem loja' },
  'app-pwa-h': { en: 'Direct Web App Install', es: 'Instalación Directa de la Web App', pt: 'Instalação Direta do Web App' },
  'app-pwa-sub': { en: 'Waiting on the store? Install Build Believe Fit straight from your browser in seconds — it runs full-screen like a native app, right from your home screen.', es: '¿Esperando la tienda? Instala Build Believe Fit directamente desde tu navegador en segundos — funciona a pantalla completa como una app nativa, desde tu pantalla de inicio.', pt: 'Esperando a loja? Instale o Build Believe Fit direto do seu navegador em segundos — funciona em tela cheia como um app nativo, direto da sua tela inicial.' },
  'app-ios-h': { en: 'iPhone / iPad · Safari', es: 'iPhone / iPad · Safari', pt: 'iPhone / iPad · Safari' },
  'app-ios-1': { en: "Tap the Share icon at the bottom of Safari.", es: 'Toca el ícono de Compartir en la parte inferior de Safari.', pt: 'Toque no ícone de Compartilhar na parte inferior do Safari.' },
  'app-ios-2': { en: "Scroll down and tap 'Add to Home Screen'.", es: "Desplázate hacia abajo y toca 'Agregar a pantalla de inicio'.", pt: "Role para baixo e toque em 'Adicionar à Tela de Início'." },
  'app-ios-3': { en: "Tap 'Add' — the Vault lands on your home screen.", es: "Toca 'Agregar' — el Vault aparece en tu pantalla de inicio.", pt: "Toque em 'Adicionar' — o Vault aparece na sua tela inicial." },
  'app-android-h': { en: 'Android · Chrome', es: 'Android · Chrome', pt: 'Android · Chrome' },
  'app-android-1': { en: 'Tap the three-dot menu at the top right.', es: 'Toca el menú de tres puntos en la parte superior derecha.', pt: 'Toque no menu de três pontos no canto superior direito.' },
  'app-android-2': { en: "Tap 'Add to Home Screen' (or 'Install App').", es: "Toca 'Agregar a pantalla de inicio' (o 'Instalar app').", pt: "Toque em 'Adicionar à Tela de Início' (ou 'Instalar app')." },
  'app-android-3': { en: 'Confirm — it installs and opens like a native app.', es: 'Confirma — se instala y abre como una app nativa.', pt: 'Confirme — instala e abre como um app nativo.' },

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

  // ── Phase 17.9 — Pathfinder liability shield (verbatim from bbf-lang.js) ─────
  'f-name': { en: 'Full Name', es: 'Nombre Completo', pt: 'Nome Completo' },
  'f-email': { en: 'Email', es: 'Correo Electrónico', pt: 'E-mail' },
  'f-phone': { en: 'Phone (optional)', es: 'Teléfono (opcional)', pt: 'Telefone (opcional)' },
  'f-goal': { en: 'Primary Goal', es: 'Objetivo Principal', pt: 'Objetivo Principal' },
  'f-goal-ph': { en: 'Select your main goal…', es: 'Selecciona tu objetivo principal…', pt: 'Selecione seu objetivo principal…' },
  'f-goal-fatloss': { en: 'Fat Loss / Weight Management', es: 'Pérdida de Grasa / Control de Peso', pt: 'Perda de Gordura / Controle de Peso' },
  'f-goal-muscle': { en: 'Muscle Building', es: 'Desarrollo Muscular', pt: 'Construção Muscular' },
  'f-goal-perf': { en: 'Athletic Performance', es: 'Rendimiento Atlético', pt: 'Performance Atlética' },
  'f-goal-health': { en: 'General Health & Longevity', es: 'Salud General y Longevidad', pt: 'Saúde Geral e Longevidade' },
  'f-goal-recovery': { en: 'Injury Recovery / Rehab', es: 'Recuperación de Lesiones / Rehabilitación', pt: 'Recuperação de Lesões / Reabilitação' },
  'f-experience': { en: 'Training Experience', es: 'Experiencia de Entrenamiento', pt: 'Experiência de Treino' },
  'f-exp-ph': { en: 'Select…', es: 'Selecciona…', pt: 'Selecione…' },
  'f-exp-beg': { en: 'Beginner (0-1 yr)', es: 'Principiante (0-1 año)', pt: 'Iniciante (0-1 ano)' },
  'f-exp-int': { en: 'Intermediate (1-3 yrs)', es: 'Intermedio (1-3 años)', pt: 'Intermediário (1-3 anos)' },
  'f-exp-adv': { en: 'Advanced (3+ yrs)', es: 'Avanzado (3+ años)', pt: 'Avançado (3+ anos)' },
  'f-injuries': { en: 'Current Injuries or Physical Limitations', es: 'Lesiones Actuales o Limitaciones Físicas', pt: 'Lesões Atuais ou Limitações Físicas' },
  'f-injuries-ph': { en: 'List any injuries, surgeries, or limitations we should know about...', es: 'Enumera lesiones, cirugías o limitaciones que debamos conocer...', pt: 'Liste lesões, cirurgias ou limitações que devemos saber...' },
  'f-conditions': { en: 'Medical Conditions', es: 'Condiciones Médicas', pt: 'Condições Médicas' },
  'f-conditions-ph': { en: 'Diabetes, heart conditions, high blood pressure, etc...', es: 'Diabetes, condiciones cardíacas, presión alta, etc...', pt: 'Diabetes, condições cardíacas, pressão alta, etc...' },
  'f-medications': { en: 'Current Medications', es: 'Medicamentos Actuales', pt: 'Medicamentos Atuais' },
  'f-medications-ph': { en: 'List any medications that may affect your training...', es: 'Enumera medicamentos que puedan afectar tu entrenamiento...', pt: 'Liste medicamentos que possam afetar seu treino...' },
  'f-health-q': { en: 'Physical Activity Readiness (PAR-Q)', es: 'Preparación para la Actividad Física (PAR-Q)', pt: 'Prontidão para Atividade Física (PAR-Q)' },
  'f-parq-note': { en: 'Check any that apply to you.', es: 'Marca las que apliquen a ti.', pt: 'Marque as que se aplicam a você.' },
  // Standard PAR-Q questions (industry-standard physical-activity readiness
  // instrument). English is the standard wording; ES/PT are faithful translations.
  'f-parq1': { en: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?', es: '¿Su médico le ha dicho alguna vez que tiene una condición cardíaca y que solo debe realizar actividad física recomendada por un médico?', pt: 'O seu médico já disse que você tem uma condição cardíaca e que só deve fazer atividade física recomendada por um médico?' },
  'f-parq2': { en: 'Do you feel pain in your chest when you do physical activity?', es: '¿Siente dolor en el pecho cuando realiza actividad física?', pt: 'Você sente dor no peito quando faz atividade física?' },
  'f-parq3': { en: 'In the past month, have you had chest pain when you were not doing physical activity?', es: 'En el último mes, ¿ha tenido dolor en el pecho cuando no estaba realizando actividad física?', pt: 'No último mês, você teve dor no peito quando não estava fazendo atividade física?' },
  'f-parq4': { en: 'Do you lose your balance because of dizziness, or do you ever lose consciousness?', es: '¿Pierde el equilibrio debido a mareos o alguna vez pierde el conocimiento?', pt: 'Você perde o equilíbrio devido a tonturas ou já perdeu a consciência?' },
  'f-parq5': { en: 'Do you have a bone or joint problem that could be made worse by a change in your physical activity?', es: '¿Tiene algún problema óseo o articular que podría empeorar con un cambio en su actividad física?', pt: 'Você tem algum problema ósseo ou articular que poderia piorar com uma mudança na sua atividade física?' },
  'f-parq6': { en: 'Is your doctor currently prescribing drugs for your blood pressure or heart condition?', es: '¿Su médico le receta actualmente medicamentos para la presión arterial o una condición cardíaca?', pt: 'O seu médico está atualmente receitando medicamentos para a sua pressão arterial ou condição cardíaca?' },
  'f-parq7': { en: 'Do you know of any other reason why you should not do physical activity?', es: '¿Conoce alguna otra razón por la que no debería realizar actividad física?', pt: 'Você conhece alguma outra razão pela qual não deveria fazer atividade física?' },
  'f-waiver-title': { en: 'Build Believe Fit LLC Liability Waiver', es: 'Exención de Responsabilidad de Build Believe Fit LLC', pt: 'Isenção de Responsabilidade da Build Believe Fit LLC' },
  'f-liability': { en: 'I have read and agree to the Build Believe Fit LLC Liability Waiver and Terms of Service.', es: 'He leído y acepto la Exención de Responsabilidad y los Términos de Servicio de Build Believe Fit LLC.', pt: 'Li e concordo com a Isenção de Responsabilidade e os Termos de Serviço da Build Believe Fit LLC.' },
  'f-marketing': { en: 'Send me training tips and offers (optional).', es: 'Envíenme consejos de entrenamiento y ofertas (opcional).', pt: 'Envie-me dicas de treino e ofertas (opcional).' },
  'f-submit': { en: 'Apply Now →', es: 'Aplicar Ahora →', pt: 'Candidatar Agora →' },
  'f-submitting': { en: 'Securing your application…', es: 'Asegurando tu solicitud…', pt: 'Protegendo sua candidatura…' },
  'f-required': { en: 'Required', es: 'Obligatorio', pt: 'Obrigatório' },
  'f-must-agree': { en: 'You must confirm the liability waiver and Terms to apply.', es: 'Debes confirmar la exención de responsabilidad y los Términos para aplicar.', pt: 'Você deve confirmar a isenção de responsabilidade e os Termos para se candidatar.' },
  'f-success-title': { en: 'Application Received', es: 'Solicitud Recibida', pt: 'Candidatura Recebida' },
  'f-success-body': { en: 'Your intake is in and securely logged. The Build Believe Fit team will reach out shortly with your next steps. Welcome to the standard.', es: 'Tu solicitud está registrada de forma segura. El equipo de Build Believe Fit te contactará pronto con los próximos pasos. Bienvenido al estándar.', pt: 'Sua candidatura está registrada com segurança. A equipe Build Believe Fit entrará em contato em breve com os próximos passos. Bem-vindo ao padrão.' },
  // Pricing → Pathfinder → Pay gate (screen-before-checkout flow).
  'pf-enroll-kicker': { en: 'Selected Plan', es: 'Plan Seleccionado', pt: 'Plano Selecionado' },
  'pf-enroll-note': { en: 'Complete your readiness screening below to continue to secure checkout.', es: 'Completa tu evaluación de preparación a continuación para continuar al pago seguro.', pt: 'Conclua sua triagem de prontidão abaixo para continuar ao pagamento seguro.' },
  'pf-checkout-title': { en: 'Screening Complete', es: 'Evaluación Completa', pt: 'Triagem Concluída' },
  'pf-checkout-body': { en: 'Your readiness screening is on file. Complete your enrollment to unlock your plan.', es: 'Tu evaluación de preparación está registrada. Completa tu inscripción para desbloquear tu plan.', pt: 'Sua triagem de prontidão está registrada. Conclua sua inscrição para desbloquear seu plano.' },
  'pf-checkout-enrolling': { en: 'Enrolling in', es: 'Inscribiéndote en', pt: 'Inscrevendo-se em' },
  'pf-checkout-cta': { en: 'Proceed to Secure Checkout →', es: 'Continuar al Pago Seguro →', pt: 'Ir para o Pagamento Seguro →' },
  'pf-checkout-secured': { en: 'Secured by Stripe · cancel anytime', es: 'Asegurado por Stripe · cancela cuando quieras', pt: 'Protegido pela Stripe · cancele quando quiser' },
  'pf-checkout-loading': { en: 'Opening secure checkout…', es: 'Abriendo el pago seguro…', pt: 'Abrindo o pagamento seguro…' },
  // Post-checkout return banner (Stripe success_url / cancel_url).
  'co-success-title': { en: 'Payment Received — Welcome to the Standard', es: 'Pago Recibido — Bienvenido al Estándar', pt: 'Pagamento Recebido — Bem-vindo ao Padrão' },
  'co-success-body': { en: 'Check your email for your username + PIN, then sign in to unlock your vault.', es: 'Revisa tu correo para tu usuario + PIN, luego inicia sesión para desbloquear tu bóveda.', pt: 'Verifique seu e-mail para seu usuário + PIN, depois entre para desbloquear seu cofre.' },
  'co-success-cta': { en: 'Sign In', es: 'Iniciar Sesión', pt: 'Entrar' },
  'co-cancel-body': { en: 'Checkout cancelled — your selected plan is still waiting whenever you’re ready.', es: 'Pago cancelado — tu plan seleccionado sigue esperando cuando estés listo.', pt: 'Pagamento cancelado — seu plano selecionado continua esperando quando você quiser.' },

  // ── The Sports Hub — youth first-run intake gate (PAR-Q+ + guardian auth). ──
  'yi-title': { en: 'Athlete Intake — Required', es: 'Registro del Atleta — Obligatorio', pt: 'Cadastro do Atleta — Obrigatório' },
  'yi-sub': { en: 'Before your first session, complete this readiness screen. Your coach reviews every answer.', es: 'Antes de tu primera sesión, completa esta evaluación de preparación. Tu entrenador revisa cada respuesta.', pt: 'Antes da sua primeira sessão, complete esta triagem de prontidão. Seu treinador revisa cada resposta.' },
  'yi-guardian-head': { en: 'Parent / Guardian Authorization', es: 'Autorización del Padre / Tutor', pt: 'Autorização do Pai / Responsável' },
  'yi-guardian-name': { en: 'Parent / Guardian Full Name', es: 'Nombre Completo del Padre / Tutor', pt: 'Nome Completo do Pai / Responsável' },
  'yi-guardian-rel': { en: 'Relationship to Athlete', es: 'Relación con el Atleta', pt: 'Relação com o Atleta' },
  'yi-guardian-consent': { en: 'I am the parent/legal guardian of this athlete and I consent to their participation in BBF youth training.', es: 'Soy el padre/tutor legal de este atleta y consiento su participación en el entrenamiento juvenil de BBF.', pt: 'Sou o pai/responsável legal deste atleta e consinto sua participação no treinamento juvenil da BBF.' },
  'yi-clearance-flag': { en: "Based on your answers, a physician's clearance is required before training begins. Your coach will follow up.", es: 'Según tus respuestas, se requiere autorización médica antes de comenzar el entrenamiento. Tu entrenador hará seguimiento.', pt: 'Com base nas suas respostas, é necessária liberação médica antes de iniciar o treino. Seu treinador entrará em contato.' },
  'yi-submit': { en: 'Complete Intake & Enter Hub →', es: 'Completar Registro y Entrar al Hub →', pt: 'Concluir Cadastro e Entrar no Hub →' },
  'yi-submitting': { en: 'Securing your intake…', es: 'Asegurando tu registro…', pt: 'Protegendo seu cadastro…' },
  'yi-error': { en: 'Could not save your intake. Please retry.', es: 'No se pudo guardar tu registro. Inténtalo de nuevo.', pt: 'Não foi possível salvar seu cadastro. Tente novamente.' },
  // Youth intake — sport / position selection.
  'yi-sport-head': { en: 'Sport & Position', es: 'Deporte y Posición', pt: 'Esporte e Posição' },
  'yi-field-sport': { en: 'Primary Sport', es: 'Deporte Principal', pt: 'Esporte Principal' },
  'yi-field-position': { en: 'Position', es: 'Posición', pt: 'Posição' },
  'yi-field-event': { en: 'Event', es: 'Prueba', pt: 'Prova' },
  'yi-choose': { en: 'Select…', es: 'Selecciona…', pt: 'Selecione…' },
  // Youth intake — athlete details (feed athlete_profiles + tier calculation).
  'yi-field-birth': { en: 'Date of Birth', es: 'Fecha de Nacimiento', pt: 'Data de Nascimento' },
  'yi-field-gender': { en: 'Gender', es: 'Género', pt: 'Gênero' },
  'yi-gender-male': { en: 'Male', es: 'Masculino', pt: 'Masculino' },
  'yi-gender-female': { en: 'Female', es: 'Femenino', pt: 'Feminino' },
  'yi-gender-coed': { en: 'Coed', es: 'Mixto', pt: 'Misto' },
  'yi-diet-head': { en: 'Dietary & Allergies', es: 'Dieta y Alergias', pt: 'Dieta e Alergias' },
  'yi-diet-note': { en: 'Select all that apply — we build your meals around these.', es: 'Selecciona todo lo que corresponda — construimos tus comidas en torno a esto.', pt: 'Selecione tudo o que se aplica — montamos suas refeições com base nisso.' },
  'yi-diet-none': { en: 'None', es: 'Ninguna', pt: 'Nenhuma' },
  'yi-diet-peanut': { en: 'Peanut Allergy', es: 'Alergia al Maní', pt: 'Alergia a Amendoim' },
  'yi-diet-dairy': { en: 'Dairy-Free', es: 'Sin Lácteos', pt: 'Sem Laticínios' },
  'yi-diet-gluten': { en: 'Gluten-Free', es: 'Sin Gluten', pt: 'Sem Glúten' },
  'yi-diet-veg': { en: 'Vegetarian', es: 'Vegetariano', pt: 'Vegetariano' },
  'yi-diet-vegan': { en: 'Vegan', es: 'Vegano', pt: 'Vegano' },
  'yi-sport-football': { en: 'American Football', es: 'Fútbol Americano', pt: 'Futebol Americano' },
  'yi-sport-basketball': { en: 'Basketball', es: 'Baloncesto', pt: 'Basquete' },
  'yi-sport-soccer': { en: 'Soccer', es: 'Fútbol', pt: 'Futebol' },
  'yi-sport-baseball': { en: 'Baseball', es: 'Béisbol', pt: 'Beisebol' },
  'yi-sport-volleyball': { en: 'Volleyball', es: 'Voleibol', pt: 'Vôlei' },
  'yi-sport-track': { en: 'Track & Field', es: 'Atletismo', pt: 'Atletismo' },
  // Admin Sports Portal extras (kept beyond Echo's canonical 6 — additive).
  'yi-sport-softball': { en: 'Softball', es: 'Sóftbol', pt: 'Softbol' },
  'yi-sport-tennis': { en: 'Tennis', es: 'Tenis', pt: 'Tênis' },
  'yi-sport-boxing': { en: 'Boxing', es: 'Boxeo', pt: 'Boxe' },
  'yi-sport-mma': { en: 'Mixed Martial Arts (MMA)', es: 'Artes Marciales Mixtas (MMA)', pt: 'Artes Marciais Mistas (MMA)' },
  'yi-sport-multi': { en: 'Combat/Multi', es: 'Combate/Multi', pt: 'Combate/Multi' },

  // ── Phase 26 — Authenticated shell (Vault top bar · tabs · Command Center ·
  // MasterLayout · Settings). Wired so the chosen language follows the athlete
  // straight through the login gate. EN values are VERBATIM to the prior
  // hardcoded labels, which keeps the E2E selectors that assert English text
  // (.cv-brand "Sovereign Vault", the "Program" tab) green. ──
  'vault-kicker': { en: 'Sovereign Vault', es: 'Bóveda Soberana', pt: 'Cofre Soberano' },
  'vault-command': { en: 'Command Center', es: 'Centro de Comando', pt: 'Central de Comando' },
  'shell-signout': { en: 'Sign Out', es: 'Cerrar Sesión', pt: 'Sair' },
  'shell-athlete-vault': { en: '← Athlete Vault', es: '← Bóveda del Atleta', pt: '← Cofre do Atleta' },
  // Vault tab labels. NOTE: EN 'Program' is asserted by vault-logging.spec via
  // getByRole('tab', { name: 'Program' }) — do not change the English here.
  'vault-tab-hub': { en: 'Hub', es: 'Panel', pt: 'Painel' },
  'vault-tab-program': { en: 'Program', es: 'Programa', pt: 'Programa' },
  'vault-tab-generator': { en: 'Generator', es: 'Generador', pt: 'Gerador' },
  'vault-tab-cardio': { en: 'Smart Cardio', es: 'Cardio Inteligente', pt: 'Cardio Inteligente' },
  'vault-tab-prehab': { en: 'Prehab', es: 'Pre-Hab', pt: 'Pré-Hab' },
  'vault-tab-recovery': { en: 'Recovery', es: 'Recuperación', pt: 'Recuperação' },
  'vault-tab-nutrition': { en: 'Nutrition', es: 'Nutrición', pt: 'Nutrição' },
  'vault-tab-mindset': { en: 'Champion Mindset', es: 'Mentalidad de Campeón', pt: 'Mentalidade de Campeão' },
  'vault-tab-forecast': { en: 'Forecast', es: 'Pronóstico', pt: 'Previsão' },
  'vault-tab-settings': { en: 'Settings', es: 'Ajustes', pt: 'Configurações' },
  'vault-tab-checkin': { en: 'Check-In', es: 'Registro', pt: 'Check-In' },
  // ── 30-Day Biometric Calibration — staged unlock (calibration.js / useCalibration).
  // Dynamic values ({feature}/{day}) are token-replaced in the component (t() has no
  // interpolation), so word order stays natural per language. ──
  'cal-kicker': { en: 'Biometric Calibration', es: 'Calibración Biométrica', pt: 'Calibração Biométrica' },
  'cal-phase': { en: 'Phase', es: 'Fase', pt: 'Fase' },
  'cal-day': { en: 'Day', es: 'Día', pt: 'Dia' },
  // Locked-tab pane (shown in place of a calibration-gated tool — a TIME gate, no paywall).
  'cal-lock-mapping': { en: 'Engine is mapping your baseline.', es: 'El motor está mapeando tu línea base.', pt: 'O motor está mapeando sua linha de base.' },
  'cal-lock-ignition': { en: 'Ignition phase is live — recovery routing online.', es: 'La fase de ignición está activa — enrutamiento de recuperación en línea.', pt: 'A fase de ignição está ativa — roteamento de recuperação on-line.' },
  'cal-lock-unlock': { en: '{feature} unlocks on Day {day}.', es: '{feature} se desbloquea el Día {day}.', pt: '{feature} desbloqueia no Dia {day}.' },
  // Progress rail (days 1–30) + graduated badge.
  'cal-prog-label': { en: 'Calibration', es: 'Calibración', pt: 'Calibração' },
  'cal-prog-sub-1': { en: 'Building Central Nervous System Baseline.', es: 'Construyendo la Línea Base del Sistema Nervioso Central.', pt: 'Construindo a Linha de Base do Sistema Nervoso Central.' },
  'cal-prog-sub-2': { en: 'Ignition live — Smart Cardio online. The Library unlocks on Day 30.', es: 'Ignición activa — Cardio Inteligente en línea. La Biblioteca se desbloquea el Día 30.', pt: 'Ignição ativa — Cardio Inteligente on-line. A Biblioteca desbloqueia no Dia 30.' },
  'cal-badge': { en: 'Sovereign Athlete', es: 'Atleta Soberano', pt: 'Atleta Soberano' },
  'cal-badge-sub': { en: 'Calibration Complete · Full Access', es: 'Calibración Completa · Acceso Total', pt: 'Calibração Completa · Acesso Total' },
  // One-time milestone alerts (Day 15 toast, Day 30 overlay). CEO copy verbatim (EN).
  'cal-m15-title': { en: 'Calibration Update', es: 'Actualización de Calibración', pt: 'Atualização de Calibração' },
  'cal-m15-body': { en: 'Phase 10 Smart Cardio unlocked. The engine is now dynamically routing your recovery.', es: 'Cardio Inteligente de la Fase 10 desbloqueado. El motor ahora enruta dinámicamente tu recuperación.', pt: 'Cardio Inteligente da Fase 10 desbloqueado. O motor agora roteia dinamicamente sua recuperação.' },
  'cal-m30-title': { en: 'Calibration Complete', es: 'Calibración Completa', pt: 'Calibração Completa' },
  'cal-m30-body': { en: 'The Vault is open. You have earned full access.', es: 'La Bóveda está abierta. Has ganado acceso total.', pt: 'O Cofre está aberto. Você conquistou acesso total.' },
  'cal-dismiss': { en: 'Continue →', es: 'Continuar →', pt: 'Continuar →' },
  // ── Sovereign Client Hub (auto-regulation check-in). Mode names + 'Taco Switch'
  // are product proper nouns; surrounding copy is fully trilingual. ──
  'sch-kicker': { en: 'Sovereign Auto-Regulation', es: 'Autorregulación Soberana', pt: 'Autorregulação Soberana' },
  'sch-title': { en: 'Client Hub Check-In', es: 'Registro del Atleta', pt: 'Check-In do Atleta' },
  'sch-fc-expand': { en: 'Expand Biokinetic Forecast', es: 'Expandir Pronóstico Biocinético', pt: 'Expandir Previsão Biocinética' },
  'sch-fc-collapse': { en: 'Collapse Biokinetic Forecast', es: 'Contraer Pronóstico Biocinético', pt: 'Recolher Previsão Biocinética' },
  'sch-governor': { en: 'Taco Switch · Input Governor', es: 'Taco Switch · Gobernador de Entrada', pt: 'Taco Switch · Governador de Entrada' },
  'sch-gov-manual': { en: 'Manual Baseline', es: 'Línea Base Manual', pt: 'Linha de Base Manual' },
  'sch-gov-auto': { en: 'Autonomous Wearable Sync', es: 'Sincronización Autónoma', pt: 'Sincronização Autônoma' },
  'sch-manual-title': { en: 'Manual Baseline Governs', es: 'Rige la Línea Base Manual', pt: 'A Linha de Base Manual Governa' },
  'sch-manual-body': {
    en: 'Autonomous modulation is offline. Execute the assigned protocol as written. Flip the governor to Autonomous Wearable Sync to let your wearable steer daily volume and fueling.',
    es: 'La modulación autónoma está desactivada. Ejecuta el protocolo asignado tal como está escrito. Cambia el gobernador a Sincronización Autónoma para que tu wearable dirija el volumen y la nutrición diarios.',
    pt: 'A modulação autônoma está desativada. Execute o protocolo designado como está escrito. Mude o governador para Sincronização Autônoma para que seu wearable conduza o volume e a nutrição diários.',
  },
  'sch-platform': { en: 'Sync Platform', es: 'Plataforma de Sincronización', pt: 'Plataforma de Sincronização' },
  'sch-conduit-live': { en: 'Conduit Live', es: 'Conducto Activo', pt: 'Conduto Ativo' },
  'sch-conduit-pending': { en: 'Conduit Pending', es: 'Conducto Pendiente', pt: 'Conduto Pendente' },
  'sch-ios-title': { en: 'Deployment Pending', es: 'Despliegue Pendiente', pt: 'Implantação Pendente' },
  'sch-ios-body': {
    en: 'The HealthKit conduit is staged for a future deployment wave. Your platform is queued — autonomous sync remains locked until the conduit ships.',
    es: 'El conducto HealthKit está preparado para una próxima ola de despliegue. Tu plataforma está en cola — la sincronización autónoma permanece bloqueada hasta que el conducto se publique.',
    pt: 'O conduto HealthKit está preparado para uma próxima onda de implantação. Sua plataforma está na fila — a sincronização autônoma permanece bloqueada até o conduto ser lançado.',
  },
  'sch-sync': { en: 'Synchronize Vitals', es: 'Sincronizar Signos Vitales', pt: 'Sincronizar Sinais Vitais' },
  'sch-syncing': { en: 'Synchronizing…', es: 'Sincronizando…', pt: 'Sincronizando…' },
  'sch-bridge-note': {
    en: 'Native sync requires the BBF Android app with Health Connect.',
    es: 'La sincronización nativa requiere la app BBF para Android con Health Connect.',
    pt: 'A sincronização nativa requer o app BBF para Android com o Health Connect.',
  },
  'sch-stamp-live': { en: 'Live Sync', es: 'Sincronización en Vivo', pt: 'Sincronização ao Vivo' },
  'sch-stamp-ledger': { en: 'Ledger · Last Sync', es: 'Registro · Última Sincronización', pt: 'Registro · Última Sincronização' },
  'sch-readiness': { en: 'Sovereign Readiness', es: 'Preparación Soberana', pt: 'Prontidão Soberana' },
  'sch-vitals': { en: 'Biometrics', es: 'Biometría', pt: 'Biometria' },
  'sch-directives': { en: 'Daily Directives', es: 'Directivas del Día', pt: 'Diretivas do Dia' },
  'sch-volume': { en: 'Training Volume', es: 'Volumen de Entrenamiento', pt: 'Volume de Treino' },
  'sch-cardio': { en: 'Cardio Order', es: 'Orden de Cardio', pt: 'Ordem de Cardio' },
  'sch-hrv': { en: 'HRV', es: 'HRV', pt: 'HRV' },
  'sch-sleep': { en: 'Sleep', es: 'Sueño', pt: 'Sono' },
  'sch-burn': { en: 'Active Burn', es: 'Gasto Activo', pt: 'Queima Ativa' },
  'sch-steps': { en: 'Steps', es: 'Pasos', pt: 'Passos' },
  'sch-carbs': { en: 'Carbs', es: 'Carbohidratos', pt: 'Carboidratos' },
  'sch-fat': { en: 'Fat', es: 'Grasa', pt: 'Gordura' },
  'sch-protein': { en: 'Protein', es: 'Proteína', pt: 'Proteína' },
  'sch-mode-prime': { en: 'Prime Execution', es: 'Ejecución Óptima', pt: 'Execução Máxima' },
  'sch-mode-standard': { en: 'Standard Operations', es: 'Operación Estándar', pt: 'Operação Padrão' },
  'sch-mode-strain': { en: 'System Strain', es: 'Sistema en Tensión', pt: 'Sistema em Tensão' },
  'sch-mode-breach': { en: 'System Breach', es: 'Brecha del Sistema', pt: 'Violação do Sistema' },
  'sch-mode-insufficient': { en: 'Insufficient Telemetry', es: 'Telemetría Insuficiente', pt: 'Telemetria Insuficiente' },
  // Sovereign Dossier (Material Upgrade) — null-integrity ghost slots + the
  // premium awaiting-telemetry state (the pane is never blank).
  'sch-no-signal': { en: 'No Signal', es: 'Sin Señal', pt: 'Sem Sinal' },
  'sch-awaiting-title': { en: 'Awaiting First Telemetry', es: 'Esperando la Primera Telemetría', pt: 'Aguardando a Primeira Telemetria' },
  'sch-awaiting-body': {
    en: 'No vitals on the ledger yet. Wear your device overnight, then run Synchronize Vitals — the Sovereign engine renders its first verdict from real telemetry only.',
    es: 'Aún no hay signos vitales en el registro. Usa tu dispositivo durante la noche y luego ejecuta Sincronizar Signos Vitales — el motor Soberano emite su primer veredicto solo con telemetría real.',
    pt: 'Ainda não há sinais vitais no registro. Use seu dispositivo durante a noite e depois execute Sincronizar Sinais Vitais — o motor Soberano emite seu primeiro veredito apenas com telemetria real.',
  },
  // Launch-sync diagnostic banner (aggressive native error surfacing). The raw
  // native error string is shown verbatim (untranslated — it's a diagnostic);
  // only the chrome is trilingual.
  'sch-diag-title': { en: 'Live Sync Diagnostic', es: 'Diagnóstico de Sincronización', pt: 'Diagnóstico de Sincronização' },
  'sch-diag-launch': { en: 'Launch Auto-Pull', es: 'Extracción Automática al Iniciar', pt: 'Extração Automática ao Iniciar' },
  'sch-diag-hint': {
    en: 'The automatic launch sync failed, so the dashboard is showing the last stored reading. Tap Synchronize Vitals to retry, and check Health Connect permissions if this persists.',
    es: 'La sincronización automática al iniciar falló, por lo que el panel muestra la última lectura guardada. Toca Sincronizar Signos Vitales para reintentar y revisa los permisos de Health Connect si persiste.',
    pt: 'A sincronização automática ao iniciar falhou, então o painel mostra a última leitura salva. Toque em Sincronizar Sinais Vitais para tentar novamente e verifique as permissões do Health Connect se persistir.',
  },
  // ── Manual Health Input (governor = manual). Subjective baseline the athlete
  // types in; scored with equal validity to a wearable read. ──
  'sch-mi-title': { en: 'Manual Health Input', es: 'Entrada Manual de Salud', pt: 'Entrada Manual de Saúde' },
  'sch-mi-intro': {
    en: "No wearable today? Log your recovery by hand. The Sovereign engine scores a manual baseline with the same weight as a synced device — no missing data, no zeroed-out score.",
    es: '¿Sin wearable hoy? Registra tu recuperación a mano. El motor Soberano puntúa una línea base manual con el mismo peso que un dispositivo sincronizado — sin datos faltantes ni puntuación en cero.',
    pt: 'Sem wearable hoje? Registre sua recuperação manualmente. O motor Soberano pontua uma linha de base manual com o mesmo peso que um dispositivo sincronizado — sem dados faltando nem pontuação zerada.',
  },
  'sch-mi-sleep-h': { en: 'Sleep Duration · Hours', es: 'Duración del Sueño · Horas', pt: 'Duração do Sono · Horas' },
  'sch-mi-sleep-q': { en: 'Sleep Quality', es: 'Calidad del Sueño', pt: 'Qualidade do Sono' },
  'sch-mi-stress': { en: 'Subjective CNS Stress', es: 'Estrés Subjetivo del SNC', pt: 'Estresse Subjetivo do SNC' },
  'sch-mi-burn': { en: 'Active Burn · kcal', es: 'Gasto Activo · kcal', pt: 'Queima Ativa · kcal' },
  'sch-mi-steps': { en: 'Steps · End of Day', es: 'Pasos · Fin del Día', pt: 'Passos · Fim do Dia' },
  'sch-mi-save': { en: 'Save Baseline', es: 'Guardar Línea Base', pt: 'Salvar Linha de Base' },
  'sch-mi-saving': { en: 'Saving…', es: 'Guardando…', pt: 'Salvando…' },
  'sch-mi-saved': { en: 'Baseline saved · readiness updated', es: 'Línea base guardada · prontitud actualizada', pt: 'Linha de base salva · prontidão atualizada' },
  'sch-mi-hint': {
    en: 'Sliders run 1 (low) → 10 (high). Stress is inverted — lower stress lifts your score. Leave a field blank and the engine simply drops its weight. Your end-of-day step count is the final word — it overrides the wearable’s running estimate, never adds to it.',
    es: 'Los controles van de 1 (bajo) → 10 (alto). El estrés está invertido — menos estrés sube tu puntuación. Deja un campo en blanco y el motor simplemente descarta su peso. Tu conteo de pasos al final del día es la palabra final — reemplaza la estimación en curso del wearable, nunca la suma.',
    pt: 'Os controles vão de 1 (baixo) → 10 (alto). O estresse é invertido — menos estresse eleva sua pontuação. Deixe um campo em branco e o motor simplesmente descarta o peso dele. Sua contagem de passos no fim do dia é a palavra final — substitui a estimativa em andamento do wearable, nunca a soma.',
  },
  // ── Health Connect Status — the zero-guess handshake diagnostic. ──
  'sch-hc-title': { en: 'Health Connect Status', es: 'Estado de Health Connect', pt: 'Status do Health Connect' },
  'sch-hc-connected': { en: 'Connected', es: 'Conectado', pt: 'Conectado' },
  'sch-hc-disconnected': { en: 'Disconnected', es: 'Desconectado', pt: 'Desconectado' },
  'sch-hc-lastsync': { en: 'Last Sync Attempt', es: 'Último Intento de Sincronización', pt: 'Última Tentativa de Sincronização' },
  'sch-hc-never': { en: 'Never', es: 'Nunca', pt: 'Nunca' },
  'sch-hc-payload': { en: 'Payload Snapshot', es: 'Instantánea de Datos', pt: 'Instantâneo de Dados' },
  'sch-hc-hrv': { en: 'HRV', es: 'HRV', pt: 'HRV' },
  'sch-hc-cal': { en: 'Calories', es: 'Calorías', pt: 'Calorias' },
  'sch-hc-sleep': { en: 'Sleep', es: 'Sueño', pt: 'Sono' },
  'sch-hc-null': { en: 'Null', es: 'Nulo', pt: 'Nulo' },
  'sch-hc-bridge-off': {
    en: 'Health Connect needs the BBF Android app — on the web this native bridge stays disconnected by design.',
    es: 'Health Connect requiere la app BBF para Android — en la web este puente nativo permanece desconectado por diseño.',
    pt: 'O Health Connect precisa do app BBF para Android — na web esta ponte nativa permanece desconectada por design.',
  },
  'sch-hc-purpose': {
    en: 'If a metric is missing, this tells you whether the bridge handshake failed or the wearable simply logged nothing for the day.',
    es: 'Si falta una métrica, esto indica si falló el enlace del puente o si el wearable simplemente no registró nada en el día.',
    pt: 'Se uma métrica estiver faltando, isto indica se o handshake da ponte falhou ou se o wearable simplesmente não registrou nada no dia.',
  },
  'sch-hc-rawprobe': { en: 'Raw OS Probe', es: 'Sonda del SO', pt: 'Sonda do SO' },
  // Sports Hub readiness banner (wired to the SAME useDailyReadiness pipeline —
  // one source of truth for athlete biometrics). Mode chips reuse sch-mode-* keys.
  'sh-rdy-kicker': { en: 'Sovereign Readiness · Live Telemetry', es: 'Prontitud Soberana · Telemetría en Vivo', pt: 'Prontidão Soberana · Telemetria ao Vivo' },
  'sh-rdy-score': { en: 'Readiness', es: 'Prontitud', pt: 'Prontidão' },
  'sh-rdy-prime': {
    en: 'Cleared for full output — attack the session, then recover hard.',
    es: 'Listo para rendimiento total — ataca la sesión y luego recupérate bien.',
    pt: 'Liberado para desempenho total — ataque a sessão e depois recupere bem.',
  },
  'sh-rdy-standard': {
    en: 'Green to train as prescribed — hit your targets with clean technique.',
    es: 'Luz verde para entrenar según lo prescrito — cumple tus objetivos con técnica limpia.',
    pt: 'Sinal verde para treinar conforme prescrito — cumpra suas metas com técnica limpa.',
  },
  'sh-rdy-strain': {
    en: 'System strain — scale intensity back today and prioritize movement quality over load.',
    es: 'Sistema en tensión — reduce la intensidad hoy y prioriza la calidad del movimiento sobre la carga.',
    pt: 'Sistema em tensão — reduza a intensidade hoje e priorize a qualidade do movimento sobre a carga.',
  },
  'sh-rdy-breach': {
    en: 'System breach — recovery only. No max-effort work today; protect the long-term athlete.',
    es: 'Brecha del sistema — solo recuperación. Nada de esfuerzo máximo hoy; protege al atleta a largo plazo.',
    pt: 'Violação do sistema — apenas recuperação. Nada de esforço máximo hoje; proteja o atleta a longo prazo.',
  },
  // ── Vault header + Hub dossier chrome (Material Upgrade i18n enforcement) —
  // every shell string resolves here; the day-focus headline itself localizes
  // through trainingI18n.localizeFocus. ──
  'vh-head-aria': { en: 'Client profile header', es: 'Encabezado del perfil del cliente', pt: 'Cabeçalho do perfil do cliente' },
  'vh-access-admin': { en: 'Sovereign Vault Admin Portal', es: 'Portal Admin de la Bóveda Soberana', pt: 'Portal Admin do Cofre Soberano' },
  'vh-access-client': { en: 'Sovereign Client Access', es: 'Acceso de Cliente Soberano', pt: 'Acesso de Cliente Soberano' },
  'vh-portal-title': { en: 'My Client Profile Hub', es: 'Mi Panel de Perfil de Cliente', pt: 'Meu Painel de Perfil de Cliente' },
  'vh-portal-sub': {
    en: 'Configure, track, and optimize your elite lifestyle metrics. Balance raw loading program sets, biokinetic prehab targets, and pristine macro ledgers.',
    es: 'Configura, monitorea y optimiza tus métricas de estilo de vida de élite. Equilibra las series de carga del programa, los objetivos de prehabilitación biocinética y registros de macros impecables.',
    pt: 'Configure, acompanhe e otimize suas métricas de estilo de vida de elite. Equilibre as séries de carga do programa, as metas de pré-habilitação biocinética e registros de macros impecáveis.',
  },
  'vh-sessions': { en: 'Sessions Logged', es: 'Sesiones Registradas', pt: 'Sessões Registradas' },
  'vh-done': { en: 'Done', es: 'Hechas', pt: 'Feitas' },
  'vh-hydration': { en: 'Hydration Target', es: 'Meta de Hidratación', pt: 'Meta de Hidratação' },
  'vh-welcome': { en: 'Welcome,', es: 'Bienvenido,', pt: 'Bem-vindo,' },
  'vh-blueprint-k': { en: 'Active Directive', es: 'Directiva Activa', pt: 'Diretiva Ativa' },
  // Active Directive execute button + the readiness gate (advisory; never disabling).
  'vh-exec': { en: 'Open Program →', es: 'Abrir Programa →', pt: 'Abrir Programa →' },
  // ── Sovereign Prep — 3-phase pre-session protocol (bbf-agentic-recovery) ──
  'sp-cta': { en: 'Sovereign Prep', es: 'Preparación Soberana', pt: 'Preparação Soberana' },
  'sp-kicker': { en: '3-Phase Pre-Session Protocol', es: 'Protocolo Pre-Sesión de 3 Fases', pt: 'Protocolo Pré-Sessão de 3 Fases' },
  'sp-section-sub': { en: 'Yesterday’s soreness, prepped. Today’s session, primed. Soft-tissue, static stretch, and dynamic mobility — weighted to your load.', es: 'El dolor de ayer, preparado. La sesión de hoy, lista. Tejido blando, estiramiento estático y movilidad dinámica — según tu carga.', pt: 'A dor de ontem, preparada. A sessão de hoje, pronta. Tecido mole, alongamento estático e mobilidade dinâmica — conforme sua carga.' },
  'sp-title': { en: 'Sovereign Prep', es: 'Preparación Soberana', pt: 'Preparação Soberana' },
  'sp-loading': { en: 'Building your prep sequence…', es: 'Construyendo tu secuencia…', pt: 'Construindo sua sequência…' },
  'sp-retry': { en: 'Retry', es: 'Reintentar', pt: 'Tentar de Novo' },
  'sp-close': { en: 'Close', es: 'Cerrar', pt: 'Fechar' },
  'sp-empty': { en: 'No items for this phase.', es: 'Sin elementos para esta fase.', pt: 'Nenhum item para esta fase.' },
  'sp-essential': { en: 'Essential', es: 'Esencial', pt: 'Essencial' },
  'sp-watch': { en: 'Watch demo', es: 'Ver demo', pt: 'Ver demo' },
  'sp-watch-hide': { en: 'Hide demo', es: 'Ocultar demo', pt: 'Ocultar demo' },
  'sp-more': { en: 'More:', es: 'Más:', pt: 'Mais:' },
  'sp-phase1': { en: 'Tissue Release', es: 'Liberación de Tejido', pt: 'Liberação de Tecido' },
  'sp-phase1-sub': { en: 'Foam rolling & soft-tissue', es: 'Rodillo y tejido blando', pt: 'Rolo e tecido mole' },
  'sp-phase2': { en: 'Static Elongation', es: 'Elongación Estática', pt: 'Alongamento Estático' },
  'sp-phase2-sub': { en: "Today's load", es: 'Carga de hoy', pt: 'Carga de hoje' },
  'sp-phase3': { en: 'Dynamic Potentiation', es: 'Potenciación Dinámica', pt: 'Potenciação Dinâmica' },
  'sp-phase3-sub': { en: "Today's focus", es: 'Enfoque de hoy', pt: 'Foco de hoje' },
  'sp-cue-breathing': { en: 'Breathing', es: 'Respiración', pt: 'Respiração' },
  'sp-cue-form': { en: 'Form', es: 'Técnica', pt: 'Forma' },
  'sp-cue-intensity': { en: 'Intensity', es: 'Intensidad', pt: 'Intensidade' },
  'sp-reps': { en: 'Reps', es: 'Reps', pt: 'Reps' },
  'sp-tempo': { en: 'Tempo', es: 'Tempo', pt: 'Tempo' },
  'sp-passes': { en: 'Passes', es: 'Pasadas', pt: 'Passagens' },
  'sp-dwell': { en: 'Dwell', es: 'Pausa', pt: 'Pausa' },
  'sp-timing': { en: 'Timing', es: 'Momento', pt: 'Momento' },
  'sp-hold-light': { en: 'Light', es: 'Suave', pt: 'Leve' },
  'sp-hold-standard': { en: 'Standard', es: 'Estándar', pt: 'Padrão' },
  'sp-hold-deep': { en: 'Deep', es: 'Profundo', pt: 'Profundo' },
  'vh-gate-caution': {
    en: 'Readiness is low — a recovery pivot is advised before max effort. You keep the override.',
    es: 'Preparación baja — se aconseja un giro a recuperación antes del esfuerzo máximo. Mantienes el control.',
    pt: 'Prontidão baixa — recomenda-se uma virada para recuperação antes do esforço máximo. Você mantém o controle.',
  },
  'vh-gate-pivot': { en: 'Recovery Pivot →', es: 'Giro a Recuperación →', pt: 'Virada de Recuperação →' },
  'vh-gate-calibrate': {
    en: 'No readiness verdict yet — run a Check-In to calibrate this directive.',
    es: 'Aún sin veredicto de preparación — haz un Registro para calibrar esta directiva.',
    pt: 'Ainda sem veredito de prontidão — faça um Check-In para calibrar esta diretiva.',
  },
  'vh-gate-checkin': { en: 'Check-In →', es: 'Registro →', pt: 'Check-In →' },
  'vh-streak': { en: 'Streak', es: 'Racha', pt: 'Sequência' },
  'vh-day': { en: 'Day', es: 'Día', pt: 'Dia' },
  'vh-days': { en: 'Days', es: 'Días', pt: 'Dias' },
  'vh-rest-day': { en: 'Recovery / Rest Day', es: 'Recuperación / Día de Descanso', pt: 'Recuperação / Dia de Descanso' },
  'vh-training-day': { en: 'Training Day', es: 'Día de Entrenamiento', pt: 'Dia de Treino' },
  'vh-rest-note': {
    en: 'Active recovery — stretch, hydrate, sleep. Protect the work.',
    es: 'Recuperación activa — estira, hidrátate, duerme. Protege el trabajo.',
    pt: 'Recuperação ativa — alongue, hidrate-se, durma. Proteja o trabalho.',
  },
  'vh-ex-count': {
    en: 'movements queued in this directive.',
    es: 'movimientos en cola en esta directiva.',
    pt: 'movimentos na fila desta diretiva.',
  },
  'vh-m-cal': { en: 'Calories', es: 'Calorías', pt: 'Calorias' },
  'vh-m-protein': { en: 'Protein', es: 'Proteína', pt: 'Proteína' },
  'vh-m-carbs': { en: 'Carbs', es: 'Carbohidratos', pt: 'Carboidratos' },
  'vh-m-fat': { en: 'Fats', es: 'Grasas', pt: 'Gorduras' },
  'vh-perf-index': { en: 'Performance Index', es: 'Índice de Rendimiento', pt: 'Índice de Desempenho' },
  'vh-last30': { en: 'Last 30 Days', es: 'Últimos 30 Días', pt: 'Últimos 30 Dias' },
  'vh-stat-total': { en: 'Total Sessions', es: 'Sesiones Totales', pt: 'Sessões Totais' },
  'vh-stat-streak': { en: 'Current Streak', es: 'Racha Actual', pt: 'Sequência Atual' },
  'vh-stat-best': { en: 'Best Streak', es: 'Mejor Racha', pt: 'Melhor Sequência' },
  'vh-stat-week': { en: 'This Week', es: 'Esta Semana', pt: 'Esta Semana' },
  'vh-stat-month': { en: 'This Month', es: 'Este Mes', pt: 'Este Mês' },
  'vh-stat-avg': { en: 'Avg / Week', es: 'Prom / Semana', pt: 'Méd / Semana' },
  'vh-u-sessions': { en: 'sessions', es: 'sesiones', pt: 'sessões' },
  'vh-u-days': { en: 'days', es: 'días', pt: 'dias' },
  'vh-u-logged': { en: 'logged', es: 'registradas', pt: 'registradas' },
  'vh-loading': { en: 'Loading your Vault…', es: 'Cargando tu Bóveda…', pt: 'Carregando seu Cofre…' },
  'vh-noprofile': { en: 'No profile data yet.', es: 'Aún no hay datos de perfil.', pt: 'Ainda não há dados de perfil.' },
  'vh-heat-aria': { en: '30-day training consistency', es: 'Consistencia de entrenamiento de 30 días', pt: 'Consistência de treino de 30 dias' },
  'vh-heat-trained': { en: 'trained', es: 'entrenado', pt: 'treinado' },
  'vh-heat-fresh': {
    en: 'No sessions in the last 30 days — time to log one.',
    es: 'Sin sesiones en los últimos 30 días — es hora de registrar una.',
    pt: 'Sem sessões nos últimos 30 dias — hora de registrar uma.',
  },
  'vh-heat-first': {
    en: 'Your first logged session will light up here.',
    es: 'Tu primera sesión registrada se iluminará aquí.',
    pt: 'Sua primeira sessão registrada vai acender aqui.',
  },
  // Weekly Brief — top-of-fold Hub card (bbf-weekly-brief-scenario-engine). The
  // coach's Monday voice memo: scenario verdict + audio + transcript. Trilingual.
  'wb-title': { en: 'Your Weekly Brief', es: 'Tu Resumen Semanal', pt: 'Seu Resumo Semanal' },
  'wb-new': { en: 'New', es: 'Nuevo', pt: 'Novo' },
  'wb-play': { en: 'Play Weekly Brief', es: 'Reproducir Resumen', pt: 'Reproduzir Resumo' },
  'wb-pause': { en: 'Pause', es: 'Pausar', pt: 'Pausar' },
  'wb-replay': { en: 'Replay Brief', es: 'Repetir Resumen', pt: 'Repetir Resumo' },
  'wb-loading': { en: 'Cueing your brief…', es: 'Preparando tu resumen…', pt: 'Preparando seu resumo…' },
  'wb-transcript': { en: 'Transcript', es: 'Transcripción', pt: 'Transcrição' },
  'wb-transcript-title': { en: 'Weekly Brief Transcript', es: 'Transcripción del Resumen Semanal', pt: 'Transcrição do Resumo Semanal' },
  'wb-close': { en: 'Close', es: 'Cerrar', pt: 'Fechar' },
  'wb-locked-in': { en: 'Locked In', es: 'En Marcha', pt: 'Comprometido' },
  'wb-generated': { en: 'Generated', es: 'Generado', pt: 'Gerado' },
  'wb-unavailable': { en: 'Your weekly brief isn’t ready yet — check back soon.', es: 'Tu resumen semanal aún no está listo — vuelve pronto.', pt: 'Seu resumo semanal ainda não está pronto — volte em breve.' },
  // Scenario verdict chips (server scenario/substatus → spoken status line).
  'wb-sc-progression': { en: 'Progression', es: 'Progresión', pt: 'Progressão' },
  'wb-sc-compliance': { en: 'Lock In Your Logs', es: 'Registra Tus Datos', pt: 'Registre Seus Dados' },
  'wb-sc-plateau': { en: 'Strategic Deload', es: 'Descarga Estratégica', pt: 'Descarga Estratégica' },
  'wb-sc-neutral': { en: 'Stay Consistent', es: 'Mantén La Constancia', pt: 'Mantenha A Constância' },
  // ── The Sovereign Sequence ("Breaking the Loop") — adult Hub guided hand-off.
  // Anchor copy + the four-step homework shield + every step CTA across the flow
  // (Hub → Check-In → Prep → Program → Cardio). Trilingual so the chosen language
  // carries through the whole sequence, not just the chrome.
  'svs-kicker': { en: 'The Sovereign Sequence', es: 'La Secuencia Soberana', pt: 'A Sequência Soberana' },
  'svs-head': { en: 'Breaking the Loop', es: 'Rompiendo el Ciclo', pt: 'Quebrando o Ciclo' },
  'svs-listen': { en: 'Listen: Breaking the Loop', es: 'Escuchar: Rompiendo el Ciclo', pt: 'Ouvir: Quebrando o Ciclo' },
  'svs-card-title': { en: 'THE SOVEREIGN SEQUENCE: YOUR DAILY HOMEWORK', es: 'LA SECUENCIA SOBERANA: TU TAREA DIARIA', pt: 'A SEQUÊNCIA SOBERANA: SUA TAREFA DIÁRIA' },
  'svs-s1-h': { en: 'Data Capture (Check-In)', es: 'Captura de Datos (Check-In)', pt: 'Captura de Dados (Check-In)' },
  'svs-s1-d': { en: 'Nervous system scanning dictates training volume.', es: 'El escaneo del sistema nervioso dicta el volumen de entrenamiento.', pt: 'O escaneamento do sistema nervoso dita o volume de treino.' },
  'svs-s2-h': { en: 'Tissue Priming (Recovery)', es: 'Preparación de Tejidos (Recuperación)', pt: 'Preparação dos Tecidos (Recuperação)' },
  'svs-s2-d': { en: 'Equipment-free mobilization to prevent injury.', es: 'Movilización sin equipo para prevenir lesiones.', pt: 'Mobilização sem equipamento para prevenir lesões.' },
  'svs-s3-h': { en: 'Execution (Program)', es: 'Ejecución (Programa)', pt: 'Execução (Programa)' },
  'svs-s3-d': { en: 'Adaptive load protocols mapped to daily readiness.', es: 'Protocolos de carga adaptativa mapeados a tu preparación diaria.', pt: 'Protocolos de carga adaptativa mapeados à sua prontidão diária.' },
  'svs-s4-h': { en: 'System Flush (Cardio)', es: 'Drenaje del Sistema (Cardio)', pt: 'Dreno do Sistema (Cardio)' },
  'svs-s4-d': { en: 'Targeted work to accelerate recovery.', es: 'Trabajo dirigido para acelerar la recuperación.', pt: 'Trabalho direcionado para acelerar a recuperação.' },
  'svs-cta-1': { en: 'Step 1: Execute Check-In ➔', es: 'Paso 1: Ejecuta el Check-In ➔', pt: 'Passo 1: Execute o Check-In ➔' },
  'svs-cta-2': { en: 'Step 2: Prime the Engine (Prep) ➔', es: 'Paso 2: Prepara el Motor (Prep) ➔', pt: 'Passo 2: Prepare o Motor (Prep) ➔' },
  'svs-cta-3': { en: 'Step 3: Enter the Floor (Program) ➔', es: 'Paso 3: Entra a la Sala (Programa) ➔', pt: 'Passo 3: Entre na Sala (Programa) ➔' },
  'svs-cta-4': { en: 'Step 4: Dial in Cardio ➔', es: 'Paso 4: Ajusta el Cardio ➔', pt: 'Passo 4: Ajuste o Cardio ➔' },
  'svs-cta-prehab-fork': { en: 'Report Joint Friction / Pain ➔', es: 'Reporta Fricción / Dolor Articular ➔', pt: 'Relate Atrito / Dor Articular ➔' },
  'svs-cta-prehab-cardio': { en: 'Next: Flush the System (Cardio) ➔', es: 'Siguiente: Drena el Sistema (Cardio) ➔', pt: 'Próximo: Drene o Sistema (Cardio) ➔' },
  // Daily Affirmation Coach (Champion Mindset) — voice-coached trilingual affirmation.
  'aff-header': { en: "Today's Affirmation", es: 'Afirmación de Hoy', pt: 'Afirmação de Hoje' },
  'aff-new': { en: 'New', es: 'Nuevo', pt: 'Novo' },
  // Vault Upsell Funnel — the UpgradeOverlay padlock chrome (tier name + price are
  // interpolated from the live pricing matrix, so they stay out of the dictionary).
  'uplock-kicker': { en: 'Locked', es: 'Bloqueado', pt: 'Bloqueado' },
  'uplock-aria': { en: 'Locked feature — upgrade required', es: 'Función bloqueada — actualización requerida', pt: 'Recurso bloqueado — upgrade necessário' },
  'uplock-body-pre': { en: 'This is part of', es: 'Esto es parte de', pt: 'Isto faz parte de' },
  'uplock-body-post': { en: '. Upgrade to unlock it.', es: '. Mejora tu plan para desbloquearlo.', pt: '. Faça upgrade para desbloquear.' },
  'uplock-cta': { en: 'Unlock with', es: 'Desbloquear con', pt: 'Desbloquear com' },
  'uplock-compare': { en: 'Compare all plans →', es: 'Comparar todos los planes →', pt: 'Comparar todos os planos →' },
  'uplock-generic-tier': { en: 'a higher tier', es: 'un plan superior', pt: 'um plano superior' },
  'uplock-sports-feature': { en: 'Sports Hub', es: 'Centro Deportivo', pt: 'Central de Esportes' },
  // Command Center (admin) — header kicker + console tab labels. 'Founder Five'
  // and 'Comlink' are product proper nouns (kept identical across languages).
  'cmd-kicker': { en: 'Build Believe Fit · Admin', es: 'Build Believe Fit · Administración', pt: 'Build Believe Fit · Administração' },
  'cmd-tab-roster': { en: 'Founder Five', es: 'Founder Five', pt: 'Founder Five' },
  'cmd-tab-command': { en: 'Command', es: 'Comando', pt: 'Comando' },
  'cmd-tab-telemetry': { en: 'Risk Telemetry', es: 'Telemetría de Riesgo', pt: 'Telemetria de Risco' },
  // BBF Eagle Eye — secondary-brain cue-alignment oversight. Proper noun kept
  // identical across languages (like 'Founder Five' / 'Comlink').
  'cmd-tab-eagle-eye': { en: 'BBF Eagle Eye', es: 'BBF Eagle Eye', pt: 'BBF Eagle Eye' },
  'cmd-tab-analytics': { en: 'Analytics', es: 'Analíticas', pt: 'Análises' },
  'cmd-tab-comlink': { en: 'Comlink', es: 'Comlink', pt: 'Comlink' },
  'cmd-tab-nutrition-locker': { en: 'Nutrition Locker', es: 'Casillero de Nutrición', pt: 'Cofre Nutricional' },
  'cmd-tab-access': { en: 'Access Control', es: 'Control de Acceso', pt: 'Controle de Acesso' },
  'cmd-tab-sports': { en: 'Sports Portal', es: 'Portal Deportivo', pt: 'Portal Esportivo' },
  // CEO-only Language Mastery Protocol tab (Command Center + sidebar nav entry).
  'cmd-tab-language': { en: 'Language', es: 'Idioma', pt: 'Idioma' },
  // The Coach's Cave — admin-only sport-psychology film library (Command Center +
  // sidebar nav entry). Proper-noun feel kept; ES/PT localize the metaphor.
  'cmd-tab-coach-cave': { en: "Coach's Cave", es: 'La Cueva del Coach', pt: 'A Caverna do Coach' },
  // The Coach Lab — admin-only Continuous Knowledge Ecosystem. Proper noun, kept
  // identical across languages (like 'Founder Five' / 'Comlink').
  'cmd-tab-coach-lab': { en: 'Coach Lab', es: 'Coach Lab', pt: 'Coach Lab' },
  // Sovereign Studio — admin-only ElevenLabs voiceover producer (FRONT 5). Proper
  // noun feel; ES/PT localize lightly.
  'cmd-tab-studio': { en: 'Sovereign Studio', es: 'Estudio Soberano', pt: 'Estúdio Soberano' },
  'cmd-tab-studio-v4': { en: 'Studio V4', es: 'Studio V4', pt: 'Studio V4' },
  'cmd-tab-content-manager': { en: 'Content Manager', es: 'Gestor de Contenido', pt: 'Gestor de Conteúdo' },
  // Phase 3.5 — new Command Center surfaces (Language Mastery Lab · Studio Batch Compiler).
  'cmd-tab-language-lab': { en: 'Language Lab', es: 'Lab de Idiomas', pt: 'Lab de Idiomas' },
  'cmd-tab-studio-batch': { en: 'Studio Batch', es: 'Lote de Studio', pt: 'Lote de Studio' },
  // Content Studio launcher (admin sidebar) — opens the standalone
  // /bbf-studio.html "Sovereign Studio" content tool in a new tab.
  'cmd-studio': { en: 'Content Studio', es: 'Estudio de Contenido', pt: 'Estúdio de Conteúdo' },
  // Settings surface — client account · preferences · session chrome.
  'set-meta': { en: 'Account · preferences · session', es: 'Cuenta · preferencias · sesión', pt: 'Conta · preferências · sessão' },
  'set-account': { en: 'Account', es: 'Cuenta', pt: 'Conta' },
  'set-username': { en: 'Username', es: 'Usuario', pt: 'Usuário' },
  'set-access-tier': { en: 'Access tier', es: 'Nivel de acceso', pt: 'Nível de acesso' },
  'set-language': { en: 'Language', es: 'Idioma', pt: 'Idioma' },
  'set-session': { en: 'Session', es: 'Sesión', pt: 'Sessão' },

  // ── Self-Serve Concierge — first-login welcome modal chrome. The greeting,
  // feature titles/blurbs, and first-move are generated NATIVELY per locale by
  // the bbf-agentic-concierge edge fn; only this static chrome is dictionary-driven.
  'concierge-kicker': { en: 'BBF Lab Concierge', es: 'Conserje del Lab BBF', pt: 'Concierge do Lab BBF' },
  'concierge-access': { en: 'Your access', es: 'Tu acceso', pt: 'Seu acesso' },
  'concierge-unlocked-h': { en: 'Unlocked for you', es: 'Desbloqueado para ti', pt: 'Desbloqueado para você' },
  'concierge-firstmove-h': { en: 'Your first move', es: 'Tu primer paso', pt: 'Seu primeiro passo' },
  'concierge-dismiss': { en: "Let's get to work →", es: 'Manos a la obra →', pt: 'Vamos ao trabalho →' },
  // Concierge summon (Settings → replay the first-login welcome on demand).
  'concierge-replay-h': { en: 'Onboarding', es: 'Bienvenida', pt: 'Integração' },
  'concierge-replay': { en: 'Replay welcome tour', es: 'Repetir el recorrido de bienvenida', pt: 'Repetir o tour de boas-vindas' },

  // ── Pathfinder funnel hardening — explicit language selector (Phase A),
  // trilingual completion of the athlete/nutrition inputs (Phase B), and the
  // physician-clearance notice (Phase C). All previously hardcoded English. ──
  'pf-lang-label': { en: 'Preferred Language', es: 'Idioma Preferido', pt: 'Idioma Preferido' },
  'pf-lang-note': { en: 'Your portal and plans open in this language.', es: 'Tu portal y tus planes se abren en este idioma.', pt: 'Seu portal e seus planos abrem neste idioma.' },
  'pf-lang-en': { en: 'English', es: 'Inglés', pt: 'Inglês' },
  'pf-lang-es': { en: 'Spanish', es: 'Español', pt: 'Espanhol' },
  'pf-lang-pt': { en: 'Portuguese', es: 'Portugués', pt: 'Português' },
  // Sport — label + options (values: none/basketball/football/soccer/track/baseball/general).
  'pf-sport-label': { en: 'Sport (optional)', es: 'Deporte (opcional)', pt: 'Esporte (opcional)' },
  'pf-sport-none': { en: 'Not a sport athlete', es: 'No soy atleta de deporte', pt: 'Não sou atleta de esporte' },
  'pf-sport-basketball': { en: 'Basketball', es: 'Baloncesto', pt: 'Basquete' },
  'pf-sport-football': { en: 'Football', es: 'Fútbol Americano', pt: 'Futebol Americano' },
  'pf-sport-soccer': { en: 'Soccer', es: 'Fútbol', pt: 'Futebol' },
  'pf-sport-track': { en: 'Track & Field', es: 'Atletismo', pt: 'Atletismo' },
  'pf-sport-baseball': { en: 'Baseball / Softball', es: 'Béisbol / Sóftbol', pt: 'Beisebol / Softbol' },
  'pf-sport-general': { en: 'General Athletic', es: 'Atlético General', pt: 'Atlético Geral' },
  // Dietary profile — label + options.
  'pf-diet-label': { en: 'Dietary Profile', es: 'Perfil Dietético', pt: 'Perfil Alimentar' },
  'pf-diet-omnivore': { en: 'Omnivore', es: 'Omnívoro', pt: 'Onívoro' },
  'pf-diet-vegetarian': { en: 'Vegetarian', es: 'Vegetariano', pt: 'Vegetariano' },
  'pf-diet-vegan': { en: 'Vegan', es: 'Vegano', pt: 'Vegano' },
  // Fasting window — label + options + youth-lock note.
  'pf-fasting-label': { en: 'Fasting Window', es: 'Ventana de Ayuno', pt: 'Janela de Jejum' },
  'pf-fasting-none': { en: 'None', es: 'Ninguna', pt: 'Nenhuma' },
  'pf-fasting-1212': { en: '12 / 12', es: '12 / 12', pt: '12 / 12' },
  'pf-fasting-1410': { en: '14 / 10', es: '14 / 10', pt: '14 / 10' },
  'pf-fasting-168': { en: '16 / 8 (skip breakfast)', es: '16 / 8 (sin desayuno)', pt: '16 / 8 (sem café da manhã)' },
  'pf-fasting-youth-note': { en: 'Youth athletes train on continuous nutrient delivery — fasting is disabled for healthy CNS development.', es: 'Los atletas jóvenes entrenan con aporte continuo de nutrientes — el ayuno está desactivado para un desarrollo saludable del SNC.', pt: 'Atletas jovens treinam com fornecimento contínuo de nutrientes — o jejum está desativado para o desenvolvimento saudável do SNC.' },
  // Height — label + unit placeholders.
  'pf-height-label': { en: 'Height (ft / in)', es: 'Altura (pies / pulg)', pt: 'Altura (pés / pol)' },
  'pf-height-ft': { en: 'ft', es: 'pies', pt: 'pés' },
  'pf-height-in': { en: 'in', es: 'pulg', pt: 'pol' },
  // Phase C — physician-clearance notice (adult Pathfinder · matches Youth standard).
  'pf-clearance-flag': { en: "Based on your health answers, a physician's clearance is required before we generate your training program. Your coach will review your intake and follow up before any training begins.", es: 'Según tus respuestas de salud, se requiere autorización médica antes de generar tu programa de entrenamiento. Tu entrenador revisará tu registro y dará seguimiento antes de comenzar cualquier entrenamiento.', pt: 'Com base nas suas respostas de saúde, é necessária liberação médica antes de gerarmos seu programa de treino. Seu treinador revisará seu cadastro e entrará em contato antes de iniciar qualquer treino.' },
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
