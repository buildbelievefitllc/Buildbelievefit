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
