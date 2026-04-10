// ═══════════════════════════════════════════════════════════════════
// BBF TRILINGUAL ENGINE — bbf-lang.js
// Languages: English (EN) | Spanish (ES) | Brazilian Portuguese (PT)
// Handles: UI translation, TDEE labels, Formspree redirects,
//          persona messaging, success modal copy
// ═══════════════════════════════════════════════════════════════════

(function () {
  'use strict';

  // ─── CURRENT LANGUAGE STATE ──────────────────────────────────────
  var BBF_LANG = localStorage.getItem('bbf_lang') || 'en';

  // ─── FORMSPREE REDIRECT URLS ─────────────────────────────────────
  var REDIRECTS = {
    en: '/thank-you',
    es: '/gracias',
    pt: '/obrigado'
  };

  // ─── FULL TRANSLATION MAP ─────────────────────────────────────────
  var T = {

    // ── NAV ─────────────────────────────────────────────────────────
    'nav.services':     { en:'Services',      es:'Servicios',       pt:'Serviços' },
    'nav.programs':     { en:'Programs',      es:'Programas',       pt:'Programas' },
    'nav.nutrition':    { en:'Nutrition',     es:'Nutrición',       pt:'Nutrição' },
    'nav.results':      { en:'Results',       es:'Resultados',      pt:'Resultados' },
    'nav.about':        { en:'About',         es:'Sobre mí',        pt:'Sobre mim' },
    'nav.start':        { en:'Start',         es:'Empezar',         pt:'Começar' },
    'nav.getapp':       { en:'Get the App',   es:'La App',          pt:'O App' },

    // ── HERO ─────────────────────────────────────────────────────────
    'hero.badge':       {
      en:'NASM-Certified · Industrial Athlete Specialist',
      es:'Certificado NASM · Especialista en Atletas Industriales',
      pt:'Certificado NASM · Especialista em Atletas Industriais'
    },
    'hero.sub':         {
      en:'Elite performance for the <strong>high-demand life.</strong> Whether you\'re on the factory floor, in the boardroom, or on the front lines &mdash; <strong>your body deserves a system built for how you actually live.</strong>',
      es:'Rendimiento élite para la <strong>vida de alta demanda.</strong> Ya sea que estés en la línea de producción, en la sala de juntas, o en la primera línea &mdash; <strong>tu cuerpo merece un sistema construido para tu realidad.</strong>',
      pt:'Performance de elite para a <strong>vida de alta demanda.</strong> Seja no chão de fábrica, na sala de reuniões ou na linha de frente &mdash; <strong>seu corpo merece um sistema construído para sua realidade.</strong>'
    },
    'hero.cta1':        { en:'Start My Path →', es:'Comenzar Mi Camino →', pt:'Começar Meu Caminho →' },
    'hero.cta2':        { en:'Client Portal',   es:'Portal del Cliente',   pt:'Portal do Cliente' },
    'hero.stat1':       { en:'Active Clients',  es:'Clientes Activos',     pt:'Clientes Ativos' },
    'hero.stat2':       { en:'Certified CPT',   es:'CPT Certificado',      pt:'CPT Certificado' },
    'hero.stat3':       { en:'Custom Plans',    es:'Planes Personalizados',pt:'Planos Personalizados' },

    // ── MARQUEE ──────────────────────────────────────────────────────
    'marquee.1':        { en:'BUILT FOR HIGH-DEMAND LIVES', es:'CONSTRUIDO PARA VIDAS DE ALTA DEMANDA', pt:'CONSTRUÍDO PARA VIDAS DE ALTA DEMANDA' },
    'marquee.2':        { en:'BUILD BELIEVE FIT',           es:'BUILD BELIEVE FIT',                     pt:'BUILD BELIEVE FIT' },
    'marquee.3':        { en:'ELITE TRANSFORMATION',        es:'TRANSFORMACIÓN ÉLITE',                  pt:'TRANSFORMAÇÃO ELITE' },
    'marquee.4':        { en:'LINEMAN STRENGTH PROTOCOL',   es:'PROTOCOLO DE FUERZA LINEMAN',           pt:'PROTOCOLO DE FORÇA LINEMAN' },
    'marquee.5':        { en:'NASM CERTIFIED',              es:'CERTIFICADO NASM',                      pt:'CERTIFICADO NASM' },
    'marquee.6':        { en:'INDUSTRIAL ATHLETE',          es:'ATLETA INDUSTRIAL',                     pt:'ATLETA INDUSTRIAL' },

    // ── SERVICES ─────────────────────────────────────────────────────
    'sec.services.lbl': { en:'What We Offer',    es:'Lo Que Ofrecemos',   pt:'O Que Oferecemos' },
    'sec.services.h':   { en:'How We Get You There', es:'Cómo Te Llevamos Ahí', pt:'Como Te Levamos Lá' },

    // ── PROGRAMS / PRICING ───────────────────────────────────────────
    'sec.prog.lbl':     { en:'Choose Your Path',  es:'Elige Tu Camino',   pt:'Escolha Seu Caminho' },
    'sec.prog.h':       { en:'Spectrum of Success', es:'Espectro del Éxito', pt:'Espectro do Sucesso' },
    'sec.prog.sub':     {
      en:'We respect every dollar you invest. Whether it\'s $67 or $2,500, you receive a clinical, OT-informed return on that investment.',
      es:'Respetamos cada dólar que inviertes. Ya sea $67 o $2,500, recibes un retorno clínico e informado por OT en esa inversión.',
      pt:'Respeitamos cada dólar que você investe. Seja $67 ou $2.500, você recebe um retorno clínico e informado pela TO nesse investimento.'
    },
    'prog.t1.tier':     { en:'Community Tier',    es:'Nivel Comunitario',  pt:'Nível Comunitário' },
    'prog.t1.name':     { en:'Community Blueprint', es:'Plan Comunitario', pt:'Plano Comunitário' },
    'prog.t1.price':    { en:'$67 one-time',       es:'$67 único pago',    pt:'$67 pagamento único' },
    'prog.t2.tier':     { en:'Flagship Program',   es:'Programa Insignia', pt:'Programa Principal' },
    'prog.t2.name':     { en:'Elite 8-Week Challenge', es:'Desafío Élite 8 Semanas', pt:'Desafio Elite 8 Semanas' },
    'prog.t2.price':    { en:'$497',               es:'$497',              pt:'$497' },
    'prog.t3.tier':     { en:'Executive & Clinical', es:'Ejecutivo y Clínico', pt:'Executivo e Clínico' },
    'prog.t3.name':     { en:'Legacy Performance Protocol', es:'Protocolo de Rendimiento Legacy', pt:'Protocolo de Performance Legacy' },
    'prog.t3.price':    { en:'$1,500 – $2,500',    es:'$1,500 – $2,500',   pt:'$1.500 – $2.500' },

    // ── TESTIMONIALS ─────────────────────────────────────────────────
    'sec.results.lbl':  { en:'Client Results',    es:'Resultados Reales',  pt:'Resultados Reais' },
    'sec.results.h':    { en:'Real People. Real Work.', es:'Personas Reales. Trabajo Real.', pt:'Pessoas Reais. Trabalho Real.' },

    // ── PATHFINDER FORM ──────────────────────────────────────────────
    'sec.path.lbl':     { en:'Start Your Journey',  es:'Comienza Tu Viaje',  pt:'Comece Sua Jornada' },
    'sec.path.h':       { en:'The Pathfinder',       es:'El Buscador',        pt:'O Explorador' },
    'sec.path.sub':     {
      en:'4 quick steps. We\'ll calculate your personalized targets and Akeem will reach out within 24 hours.',
      es:'4 pasos rápidos. Calcularemos tus objetivos personalizados y Akeem se comunicará contigo en 24 horas.',
      pt:'4 passos rápidos. Calcularemos seus objetivos personalizados e Akeem entrará em contato em 24 horas.'
    },
    'step1.title':      { en:'Who Are You?',         es:'¿Quién Eres?',       pt:'Quem É Você?' },
    'step1.sub':        { en:'Tell us about yourself', es:'Cuéntanos sobre ti', pt:'Fale sobre você' },
    'step2.title':      { en:'Your Stats',            es:'Tus Estadísticas',   pt:'Seus Dados' },
    'step2.sub':        { en:'Used to calculate your TDEE', es:'Para calcular tu TDEE', pt:'Para calcular seu TDEE' },
    'step3.title':      { en:'Your Goal',             es:'Tu Objetivo',        pt:'Seu Objetivo' },
    'step4.title':      { en:'Final Details',         es:'Detalles Finales',   pt:'Detalhes Finais' },
    'form.fname':       { en:'First Name',            es:'Nombre',             pt:'Nome' },
    'form.lname':       { en:'Last Name',             es:'Apellido',           pt:'Sobrenome' },
    'form.email':       { en:'Email Address',         es:'Correo Electrónico', pt:'E-mail' },
    'form.phone':       { en:'Phone (optional)',       es:'Teléfono (opcional)',pt:'Telefone (opcional)' },
    'form.submit':      { en:'Calculate My Path & Submit →', es:'Calcular Mi Camino y Enviar →', pt:'Calcular Meu Caminho e Enviar →' },

    // ── GOAL CHIPS ───────────────────────────────────────────────────
    'goal.fat':         { en:'🔥 Fat Loss',        es:'🔥 Perder Grasa',    pt:'🔥 Perder Gordura' },
    'goal.muscle':      { en:'💪 Build Muscle',    es:'💪 Ganar Músculo',   pt:'💪 Ganhar Músculo' },
    'goal.recomp':      { en:'⚖ Body Recomp',     es:'⚖ Recomposición',   pt:'⚖ Recomposição' },
    'goal.strength':    { en:'🏋 Pure Strength',  es:'🏋 Fuerza Pura',    pt:'🏋 Força Pura' },
    'goal.endurance':   { en:'🏃 Endurance',       es:'🏃 Resistencia',     pt:'🏃 Resistência' },

    // ── SCHEDULE CHIPS ───────────────────────────────────────────────
    'sched.standard':   { en:'Standard Hours',     es:'Horario Estándar',   pt:'Horário Padrão' },
    'sched.9to5':       { en:'9-to-5 / Everyday',  es:'9-5 / Cotidiano',    pt:'9-5 / Cotidiano' },
    'sched.shifts':     { en:'8-Hour Shifts',       es:'Turnos de 8 Horas',  pt:'Turnos de 8 Horas' },
    'sched.12hr':       { en:'12-Hour Shifts',      es:'Turnos de 12 Horas', pt:'Turnos de 12 Horas' },
    'sched.overnight':  { en:'Overnight / Rotating',es:'Nocturno / Rotativo',pt:'Noturno / Rotativo' },
    'sched.executive':  { en:'Executive / Corporate',es:'Ejecutivo / Corporativo',pt:'Executivo / Corporativo' },
    'sched.medical':    { en:'Medical / Healthcare', es:'Médico / Salud',     pt:'Médico / Saúde' },
    'sched.responder':  { en:'First Responder',     es:'Primer Respondedor',  pt:'Primeiro Socorrista' },
    'sched.parent':     { en:'Full-Time Parent',    es:'Padre/Madre a Tiempo Completo', pt:'Pai/Mãe em Tempo Integral' },

    // ── TDEE CALCULATOR ──────────────────────────────────────────────
    'tdee.lbl':         { en:'Free Tool — Lite Tier', es:'Herramienta Gratuita', pt:'Ferramenta Gratuita' },
    'tdee.h':           { en:'Calculate Your TDEE',  es:'Calcula Tu TDEE',    pt:'Calcule Seu TDEE' },
    'tdee.age':         { en:'Age',                  es:'Edad',               pt:'Idade' },
    'tdee.sex':         { en:'Sex',                  es:'Sexo',               pt:'Sexo' },
    'tdee.male':        { en:'Male',                 es:'Masculino',          pt:'Masculino' },
    'tdee.female':      { en:'Female',               es:'Femenino',           pt:'Feminino' },
    'tdee.weight':      { en:'Weight (lbs)',         es:'Peso (lbs)',          pt:'Peso (lbs)' },
    'tdee.height':      { en:'Height (ft / in)',     es:'Altura (ft / in)',   pt:'Altura (ft / in)' },
    'tdee.activity':    { en:'Activity Level',       es:'Nivel de Actividad', pt:'Nível de Atividade' },
    'tdee.goal':        { en:'Goal',                 es:'Objetivo',           pt:'Objetivo' },
    'tdee.btn':         { en:'Calculate My Targets →', es:'Calcular Mis Objetivos →', pt:'Calcular Meus Objetivos →' },
    'tdee.unit.cal':    { en:'Calories / Day',       es:'Calorías / Día',     pt:'Calorias / Dia' },
    'tdee.protein':     { en:'Protein',              es:'Proteína',           pt:'Proteína' },
    'tdee.carbs':       { en:'Carbs',                es:'Carbohidratos',      pt:'Carboidratos' },
    'tdee.fats':        { en:'Fats',                 es:'Grasas',             pt:'Gorduras' },

    // ── SUCCESS MODAL ────────────────────────────────────────────────
    'modal.badge':      { en:'Your Personalized BBF Path', es:'Tu Camino BBF Personalizado', pt:'Seu Caminho BBF Personalizado' },
    'modal.sub':        { en:'Based on your stats, here are your daily targets:', es:'Basado en tus estadísticas, aquí están tus objetivos diarios:', pt:'Com base nos seus dados, aqui estão suas metas diárias:' },
    'modal.caltarget':  { en:'Daily Calorie Target', es:'Meta de Calorías Diarias', pt:'Meta de Calorias Diárias' },
    'modal.nextsteps':  { en:'Your Next Steps',      es:'Tus Próximos Pasos',       pt:'Seus Próximos Passos' },
    'modal.close':      { en:"Close — I'll check my email", es:'Cerrar — Revisaré mi correo', pt:'Fechar — Verei meu e-mail' },

    // ── PROTOCOLS ─────────────────────────────────────────────────────
    'proto.9to5':       { en:"WORKING MAN'S PROTOCOL ACTIVE", es:'PROTOCOLO HOMBRE TRABAJADOR', pt:'PROTOCOLO HOMEM TRABALHADOR' },
    'proto.executive':  { en:'EXECUTIVE PROTOCOL ACTIVE',     es:'PROTOCOLO EJECUTIVO ACTIVO',  pt:'PROTOCOLO EXECUTIVO ATIVO' },
    'proto.responder':  { en:'TACTICAL ATHLETE ACTIVE',       es:'ATLETA TÁCTICO ACTIVO',       pt:'ATLETA TÁTICO ATIVO' },
    'proto.medical':    { en:'HEALTHCARE PROTOCOL ACTIVE',    es:'PROTOCOLO SANITARIO ACTIVO',  pt:'PROTOCOLO DE SAÚDE ATIVO' },
    'proto.parent':     { en:'FAMILY WARRIOR PROTOCOL',       es:'PROTOCOLO GUERRERO FAMILIAR', pt:'PROTOCOLO GUERREIRO FAMILIAR' },
    'proto.shifts':     { en:'INDUSTRIAL ATHLETE ACTIVE',     es:'ATLETA INDUSTRIAL ACTIVO',    pt:'ATLETA INDUSTRIAL ATIVO' },

    // ── APP ──────────────────────────────────────────────────────────
    'app.welcome':      { en:'Welcome back',         es:'Bienvenido de vuelta', pt:'Bem-vindo de volta' },
    'app.streak':       { en:'Day Streak 🔥',        es:'Racha de Días 🔥',     pt:'Sequência de Dias 🔥' },
    'app.sessions':     { en:'Total Sessions',       es:'Sesiones Totales',     pt:'Sessões Totais' },
    'app.thisweek':     { en:'This Week',             es:'Esta Semana',          pt:'Esta Semana' },
    'app.weight':       { en:'Current Weight',        es:'Peso Actual',          pt:'Peso Atual' },
    'app.focus':        { en:"Today's Focus",         es:'Enfoque de Hoy',       pt:'Foco de Hoje' },
    'app.program':      { en:'Program',               es:'Programa',             pt:'Programa' },
    'app.masterclass':  { en:'Masterclass',           es:'Masterclass',          pt:'Masterclass' },
    'app.prehab':       { en:'Prehab',                es:'Prehabilitación',      pt:'Preabilitação' },
    'app.book':         { en:'Book',                  es:'Reservar',             pt:'Agendar' },
    'app.progress':     { en:'Progress',              es:'Progreso',             pt:'Progresso' },
    'app.log':          { en:'Log',                   es:'Registro',             pt:'Registro' },

    // ── PREHAB ───────────────────────────────────────────────────────
    'prehab.title':     { en:'Prehab & Recovery',    es:'Prehabilitación y Recuperación', pt:'Preabilitação e Recuperação' },
    'prehab.sub':       {
      en:'OT-informed joint health for industrial athletes',
      es:'Salud articular informada por TO para atletas industriales',
      pt:'Saúde articular baseada em TO para atletas industriais'
    },
    'prehab.lang':      { en:'Language / Idioma / Idioma', es:'Idioma', pt:'Idioma' },

    // ── FOUNDER ──────────────────────────────────────────────────────
    'found.lbl':        { en:'The Founder',          es:'El Fundador',         pt:'O Fundador' },
    'found.h':          { en:'The Story Behind BBF', es:'La Historia detrás de BBF', pt:'A História por trás da BBF' },

    // ── CONTACT ──────────────────────────────────────────────────────
    'contact.h':        { en:"Let's Build.",         es:'Construyamos.',       pt:'Vamos Construir.' },
    'contact.sub':      {
      en:'Ready to start? Have questions? Reach out directly — Akeem responds fast.',
      es:'¿Listo para comenzar? ¿Tienes preguntas? Contáctanos directamente — Akeem responde rápido.',
      pt:'Pronto para começar? Tem dúvidas? Entre em contato diretamente — Akeem responde rápido.'
    },
  };

  // ─── TRANSLATE FUNCTION ────────────────────────────────────────────
  function t(key) {
    var entry = T[key];
    if (!entry) return key;
    return entry[BBF_LANG] || entry['en'] || key;
  }

  // ─── APPLY TRANSLATIONS TO DOM ─────────────────────────────────────
  function applyTranslations() {
    // data-bbf-key attributes (simple text)
    document.querySelectorAll('[data-bbf-key]').forEach(function (el) {
      var key = el.getAttribute('data-bbf-key');
      var val = t(key);
      if (el.hasAttribute('data-bbf-html')) {
        el.innerHTML = val;
      } else {
        el.textContent = val;
      }
    });

    // Placeholders
    document.querySelectorAll('[data-bbf-placeholder]').forEach(function (el) {
      var key = el.getAttribute('data-bbf-placeholder');
      el.placeholder = t(key);
    });

    // html lang attribute
    document.documentElement.lang = BBF_LANG === 'pt' ? 'pt-BR' : BBF_LANG;

    // Update toggle button states
    ['en', 'es', 'pt'].forEach(function (lang) {
      var btn = document.getElementById('lang-btn-' + lang);
      if (btn) {
        btn.classList.toggle('lang-active', lang === BBF_LANG);
      }
    });

    // Update Formspree hidden redirect field if present
    var redirectField = document.getElementById('_next');
    if (redirectField) {
      redirectField.value = window.location.origin + (REDIRECTS[BBF_LANG] || '/thank-you');
    }
  }

  // ─── SET LANGUAGE ──────────────────────────────────────────────────
  function setLang(lang) {
    if (!['en', 'es', 'pt'].includes(lang)) return;
    BBF_LANG = lang;
    localStorage.setItem('bbf_lang', lang);
    applyTranslations();
    // Fire custom event so app can react
    document.dispatchEvent(new CustomEvent('bbf:langchange', { detail: { lang: lang } }));
  }

  // ─── LANG TOGGLE HTML GENERATOR ────────────────────────────────────
  function createLangToggle() {
    var wrap = document.createElement('div');
    wrap.id = 'bbf-lang-toggle';
    wrap.innerHTML =
      '<button id="lang-btn-en" onclick="BBF.setLang(\'en\')" aria-label="English">EN</button>' +
      '<button id="lang-btn-es" onclick="BBF.setLang(\'es\')" aria-label="Español">ES</button>' +
      '<button id="lang-btn-pt" onclick="BBF.setLang(\'pt\')" aria-label="Português">PT</button>';
    return wrap;
  }

  // ─── INIT ──────────────────────────────────────────────────────────
  function init() {
    // Detect browser language on first visit
    if (!localStorage.getItem('bbf_lang')) {
      var nav = navigator.language || '';
      if (nav.startsWith('es')) BBF_LANG = 'es';
      else if (nav.startsWith('pt')) BBF_LANG = 'pt';
      else BBF_LANG = 'en';
    }

    // Inject toggle into nav if placeholder exists
    var placeholder = document.getElementById('bbf-lang-placeholder');
    if (placeholder) {
      placeholder.appendChild(createLangToggle());
    }

    applyTranslations();
  }

  // ─── PUBLIC API ────────────────────────────────────────────────────
  window.BBF = window.BBF || {};
  window.BBF.setLang = setLang;
  window.BBF.t       = t;
  window.BBF.getLang = function () { return BBF_LANG; };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
