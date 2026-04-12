// ═══════════════════════════════════════════════════════════════════
// BBF-LANG.JS — Build Believe Fit LLC
// Trilingual Dictionary & Language Engine (EN / ES / PT)
// Universal Human Performance Architecture
// ═══════════════════════════════════════════════════════════════════
(function() {
'use strict';

var LANG = localStorage.getItem('bbf_lang') || 'en';

// ─── TRILINGUAL DICTIONARY ─────────────────────────────────────
var D = {

// ═══ NAV ═══
'nav-services':    { en:'Services',   es:'Servicios',   pt:'Serviços' },
'nav-programs':    { en:'Programs',   es:'Programas',   pt:'Programas' },
'nav-nutrition':   { en:'Nutrition',  es:'Nutrición',   pt:'Nutrição' },
'nav-results':     { en:'Results',    es:'Resultados',  pt:'Resultados' },
'nav-mystory':     { en:'My Story',   es:'Mi Historia', pt:'Minha História' },
'nav-about':       { en:'About',      es:'Acerca',      pt:'Sobre' },
'nav-start':       { en:'Start',      es:'Comenzar',    pt:'Começar' },
'nav-cta':         { en:'Get the App',es:'Obtener App', pt:'Baixar App' },
'mnav-services':   { en:'Services',   es:'Servicios',   pt:'Serviços' },
'mnav-programs':   { en:'Programs',   es:'Programas',   pt:'Programas' },
'mnav-nutrition':  { en:'Nutrition',  es:'Nutrición',   pt:'Nutrição' },
'mnav-results':    { en:'Results',    es:'Resultados',  pt:'Resultados' },
'mnav-about':      { en:'About',      es:'Acerca',      pt:'Sobre' },
'mnav-start':      { en:'Start My Journey', es:'Iniciar Mi Camino', pt:'Iniciar Minha Jornada' },
'mnav-app':        { en:'Client App', es:'App del Cliente', pt:'App do Cliente' },

// ═══ HERO ═══
'hero-badge':      { en:'NASM-Certified \u2022 Human Performance Architect', es:'Certificado NASM \u2022 Arquitecto de Rendimiento Humano', pt:'Certificado NASM \u2022 Arquiteto de Performance Humana' },
'hero-sub':        { en:'Universal performance for the <strong>high-demand human.</strong> We optimize the habit architecture of everyday athletes, executives, and first responders. <strong>Your schedule is the context. Your potential is the focus.</strong>', es:'Rendimiento universal para el <strong>ser humano de alta demanda.</strong> Optimizamos la arquitectura de hábitos de atletas cotidianos, ejecutivos y socorristas. <strong>Tu horario es el contexto. Tu potencial es el enfoque.</strong>', pt:'Performance universal para o <strong>ser humano de alta demanda.</strong> Otimizamos a arquitetura de hábitos de atletas do dia a dia, executivos e socorristas. <strong>Sua agenda é o contexto. Seu potencial é o foco.</strong>' },
'hero-cta':        { en:'Start My Path', es:'Iniciar Mi Camino', pt:'Iniciar Meu Caminho' },
'hero-portal':     { en:'Client Portal', es:'Portal del Cliente', pt:'Portal do Cliente' },
'hero-accent':     { en:'ELITE STRENGTH & MOVEMENT', es:'FUERZA & MOVIMIENTO DE \u00c9LITE', pt:'FOR\u00c7A & MOVIMENTO DE ELITE' },
'stat-clients':    { en:'Active Clients', es:'Clientes Activos', pt:'Clientes Ativos' },
'stat-cert':       { en:'Certified CPT', es:'CPT Certificado', pt:'CPT Certificado' },
'stat-plans':      { en:'Custom Plans', es:'Planes Personalizados', pt:'Planos Personalizados' },

// ═══ SERVICES ═══
'svc-lbl':         { en:'What We Offer', es:'Lo Que Ofrecemos', pt:'O Que Oferecemos' },
'svc-h':           { en:'How We Get You <span class="y">There</span>', es:'C\u00f3mo Te Llevamos <span class="y">All\u00ed</span>', pt:'Como Levamos Voc\u00ea <span class="y">L\u00e1</span>' },
'svc-n1':          { en:'Strength Coaching', es:'Coaching de Fuerza', pt:'Coaching de For\u00e7a' },
'svc-d1':          { en:'Progressive overload programming built around your schedule, recovery capacity, and goals. Not a template \u2014 a system designed for you.', es:'Programaci\u00f3n de sobrecarga progresiva construida alrededor de tu horario, capacidad de recuperaci\u00f3n y objetivos. No es una plantilla \u2014 es un sistema dise\u00f1ado para ti.', pt:'Programa\u00e7\u00e3o de sobrecarga progressiva constru\u00edda ao redor da sua agenda, capacidade de recupera\u00e7\u00e3o e objetivos. N\u00e3o \u00e9 um modelo \u2014 \u00e9 um sistema desenhado para voc\u00ea.' },
'svc-n2':          { en:'Nutrition Coaching', es:'Coaching Nutricional', pt:'Coaching Nutricional' },
'svc-d2':          { en:'Custom meal plans calibrated to your TDEE, your training intensity, and your real life \u2014 not a generic macro split from the internet.', es:'Planes alimenticios personalizados calibrados a tu TDEE, tu intensidad de entrenamiento y tu vida real \u2014 no una divisi\u00f3n gen\u00e9rica de macros de internet.', pt:'Planos alimentares personalizados calibrados ao seu TDEE, sua intensidade de treino e sua vida real \u2014 n\u00e3o uma divis\u00e3o gen\u00e9rica de macros da internet.' },
'svc-n3':          { en:'Program Design', es:'Dise\u00f1o de Programas', pt:'Design de Programas' },
'svc-d3':          { en:'Day-by-day periodized programs designed for real people with real jobs. Recovery built in. Progress guaranteed when you follow the plan.', es:'Programas periodizados d\u00eda a d\u00eda dise\u00f1ados para personas reales con trabajos reales. Recuperaci\u00f3n integrada. Progreso garantizado cuando sigues el plan.', pt:'Programas periodizados dia a dia desenhados para pessoas reais com trabalhos reais. Recupera\u00e7\u00e3o integrada. Progresso garantido quando voc\u00ea segue o plano.' },
'svc-n4':          { en:'Elite Transformation', es:'Transformaci\u00f3n de \u00c9lite', pt:'Transforma\u00e7\u00e3o de Elite' },
'svc-d4':          { en:'Full 90-day overhaul \u2014 body composition, movement quality, and habit architecture. The complete package for serious, lasting results.', es:'Renovaci\u00f3n completa de 90 d\u00edas \u2014 composici\u00f3n corporal, calidad de movimiento y arquitectura de h\u00e1bitos. El paquete completo para resultados serios y duraderos.', pt:'Renova\u00e7\u00e3o completa de 90 dias \u2014 composi\u00e7\u00e3o corporal, qualidade de movimento e arquitetura de h\u00e1bitos. O pacote completo para resultados s\u00e9rios e duradouros.' },
'svc-n5':          { en:'Remote Coaching', es:'Coaching Remoto', pt:'Coaching Remoto' },
'svc-d5':          { en:'Full access to your custom app portal, weekly check-ins, meal plan updates, and direct coach access \u2014 wherever you train.', es:'Acceso completo a tu portal personalizado, revisiones semanales, actualizaciones de plan alimenticio y acceso directo al coach \u2014 donde sea que entrenes.', pt:'Acesso completo ao seu portal personalizado, revis\u00f5es semanais, atualiza\u00e7\u00f5es do plano alimentar e acesso direto ao coach \u2014 onde quer que treine.' },
'svc-n6':          { en:'Human Performance Protocol', es:'Protocolo de Rendimiento Humano', pt:'Protocolo de Performance Humana' },
'svc-d6':          { en:'Performance architecture engineered around your life \u2014 your schedule, your recovery window, your occupation. Habit systems that compound over time.', es:'Arquitectura de rendimiento dise\u00f1ada alrededor de tu vida \u2014 tu horario, tu ventana de recuperaci\u00f3n, tu ocupaci\u00f3n. Sistemas de h\u00e1bitos que se multiplican con el tiempo.', pt:'Arquitetura de performance projetada ao redor da sua vida \u2014 sua agenda, sua janela de recupera\u00e7\u00e3o, sua ocupa\u00e7\u00e3o. Sistemas de h\u00e1bitos que se multiplicam com o tempo.' },

// ═══ PLACEHOLDER — more keys injected below ═══
'_end': { en:'', es:'', pt:'' }
};

// ─── ENGINE ────────────────────────────────────────────────────
function apply() {
  var els = document.querySelectorAll('[data-lang-key]');
  for (var i = 0; i < els.length; i++) {
    var k = els[i].getAttribute('data-lang-key');
    if (D[k] && D[k][LANG] !== undefined && D[k][LANG] !== '') {
      if (D[k][LANG].indexOf('<') > -1) {
        els[i].innerHTML = D[k][LANG];
      } else {
        els[i].textContent = D[k][LANG];
      }
    }
  }
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('bbf_lang', l);
  apply();
  updateToggles(l);
}

function getLang() { return LANG; }

function t(key) {
  return (D[key] && D[key][LANG]) ? D[key][LANG] : key;
}

function updateToggles(l) {
  var ids = [
    ['lt-en','lt-es','lt-pt'],
    ['mob-lt-en','mob-lt-es','mob-lt-pt']
  ];
  ids.forEach(function(set) {
    set.forEach(function(id) {
      var el = document.getElementById(id);
      if (!el) return;
      var isOn = id.indexOf('-' + l) > -1;
      el.classList.toggle('lang-on', isOn);
      el.classList.toggle('lang-active', isOn);
      if (isOn) {
        el.style.background = 'var(--yel,#f5c800)';
        el.style.color = 'var(--blk,#060606)';
      } else {
        el.style.background = 'transparent';
        el.style.color = '';
      }
    });
  });
  var placeholder = document.getElementById('bbf-lang-placeholder');
  if (placeholder && !placeholder.querySelector('#bbf-lang-toggle')) {
    placeholder.innerHTML =
      '<div id="bbf-lang-toggle">' +
      '<button onclick="BBF_LANG.set(\'en\')" class="' + (l === 'en' ? 'lang-active' : '') + '">EN</button>' +
      '<button onclick="BBF_LANG.set(\'es\')" class="' + (l === 'es' ? 'lang-active' : '') + '">ES</button>' +
      '<button onclick="BBF_LANG.set(\'pt\')" class="' + (l === 'pt' ? 'lang-active' : '') + '">PT</button>' +
      '</div>';
  }
}

// ─── EXPORTS ───────────────────────────────────────────────────
window.BBF_LANG = { set: setLang, get: getLang, t: t, apply: apply, D: D };
window.BBF = { setLang: setLang, getLang: getLang, t: t };

// ─── AUTO-INIT ─────────────────────────────────────────────────
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() { updateToggles(LANG); apply(); });
} else {
  updateToggles(LANG); apply();
}

})();
