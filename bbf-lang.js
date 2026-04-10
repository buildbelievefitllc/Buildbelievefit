// ═══════════════════════════════════════════════════════════════════
// BBF-LANG.JS — Build Believe Fit LLC
// Trilingual Engine: English | Español | Português (BR)
// ═══════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  var LANG = localStorage.getItem('bbf_lang') || 'en';
  var REDIRECTS = { en:'thank-you', es:'gracias', pt:'obrigado' };

  var T = {
    'nav-services': { en:'Services',  es:'Servicios', pt:'Serviços'  },
    'nav-programs': { en:'Programs',  es:'Programas', pt:'Programas' },
    'nav-results':  { en:'Results',   es:'Resultados',pt:'Resultados'},
    'nav-about':    { en:'About',     es:'Sobre mí',  pt:'Sobre mim' },
    'nav-start':    { en:'Start',     es:'Empezar',   pt:'Começar'   },
    'nav-mystory':  { en:'My Story',  es:'Mi Historia',pt:'Minha História'},
    'sec-path-lbl':     { en:'Start Your Journey', es:'Comienza Tu Viaje', pt:'Comece Sua Jornada'},
    'prog-section-h':{ en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">Éxito</span>', pt:'Espectro do <span class="y">Sucesso</span>'},
    'hero-sub':{
      en:'Elite performance for the <strong>high-demand life.</strong> Whether you\'re on the factory floor, in the boardroom, or on the front lines &mdash; <strong>your body deserves a system built for how you actually live.</strong>',
      es:'Rendimiento élite para la <strong>vida de alta demanda.</strong> Ya sea en la línea de producción, en la sala de juntas, o en la primera línea &mdash; <strong>tu cuerpo merece un sistema construido para tu realidad.</strong>',
      pt:'Performance de elite para a <strong>vida de alta demanda.</strong> Seja no chão de fábrica, na sala de reuniões ou na linha de frente &mdash; <strong>seu corpo merece um sistema construído para sua realidade.</strong>'
    },
    'prog-section-sub':{
      en:'We respect every dollar you invest. Whether it\'s $67 or $2,500, you receive a clinical, OT-informed return on that investment.',
      es:'Respetamos cada dólar que inviertes. Ya sea $67 o $2,500, recibes un retorno clínico e informado por TO en esa inversión.',
      pt:'Respeitamos cada dólar que você investe. Seja $67 ou $2.500, você recebe um retorno clínico e baseado em TO nesse investimento.'
    },
    'path-h':{en:'The <span class="y">Pathfinder</span>',es:'El <span class="y">Buscador</span>',pt:'O <span class="y">Explorador</span>'},
    'path-sub':{
      en:'4 quick steps. We\'ll calculate your personalized targets and Akeem will reach out within 24 hours.',
      es:'4 pasos rápidos. Calcularemos tus objetivos personalizados y Akeem se comunicará contigo en 24 horas.',
      pt:'4 passos rápidos. Calcularemos seus objetivos e Akeem entrará em contato em 24 horas.'
    },
    'path-submit':{en:'Calculate My Path &amp; Submit &#x2192;',es:'Calcular Mi Camino y Enviar &#x2192;',pt:'Calcular Meu Caminho e Enviar &#x2192;'},
    'trans-section-h':{en:'This Is Why <span class="y">BBF Exists</span>',es:'Por Eso Existe <span class="y">BBF</span>',pt:'Por Isso Existe o <span class="y">BBF</span>'},
    'contact-h':{en:"Let's Build.",es:'Construyamos.',pt:'Vamos Construir.'},
    'modal-close':{en:"Close &mdash; I'll check my email",es:'Cerrar &mdash; Revisaré mi correo',pt:'Fechar &mdash; Verei meu e-mail'},
    'app-prehab-sub':{
      en:'OT-Informed joint health for high-demand athletes',
      es:'Salud articular informada por TO para atletas de alta demanda',
      pt:'Saúde articular baseada em TO para atletas de alta demanda'
    },
    'app-ot-advantage':{
      en:'Your coach is an <strong>Exercise Science student and future Occupational Therapist.</strong> Every recovery cue is grounded in OT principles — joint mechanics, movement longevity, and occupation-specific load patterns. Clinical-level precision most trainers cannot offer.',
      es:'Tu entrenador es <strong>estudiante de Ciencias del Ejercicio y futuro Terapeuta Ocupacional.</strong> Cada señal de recuperación se basa en principios de TO — mecánica articular, longevidad del movimiento y patrones de carga específicos de tu ocupación.',
      pt:'Seu treinador é <strong>estudante de Ciências do Exercício e futuro Terapeuta Ocupacional.</strong> Cada indicação de recuperação é baseada em princípios de TO — mecânica articular, longevidade do movimento e padrões de carga específicos da sua ocupação.'
    }
  };

  function apply() {
    // Translate by data-lang-key attribute
    document.querySelectorAll('[data-lang-key]').forEach(function(el) {
      var key = el.getAttribute('data-lang-key');
      if (T[key] && T[key][LANG]) el.innerHTML = T[key][LANG];
    });
    // Translate by ID
    Object.keys(T).forEach(function(key) {
      var el = document.getElementById(key);
      if (el && T[key][LANG]) el.innerHTML = T[key][LANG];
    });
    // Update nav toggle buttons
    ['en','es','pt'].forEach(function(l) {
      var b1 = document.getElementById('lt-'+l);
      if (b1) b1.className = (l===LANG) ? 'lang-on' : '';
      var b2 = document.getElementById('mob-lt-'+l);
      if (b2) { b2.style.background=(l===LANG)?'rgba(245,200,0,.3)':'transparent'; b2.style.color=(l===LANG)?'#f5c800':'rgba(255,255,255,.45)'; }
    });
    document.documentElement.lang = LANG==='pt'?'pt-BR':LANG;
    // Update Formspree redirect
    var nf = document.getElementById('_next');
    if (nf) nf.value = window.location.origin+'/'+(REDIRECTS[LANG]||'thank-you');
  }

  function setLang(l) {
    if (!['en','es','pt'].includes(l)) return;
    LANG = l;
    localStorage.setItem('bbf_lang', l);
    apply();
  }

  function init() {
    if (!localStorage.getItem('bbf_lang')) {
      var nav = (navigator.language||'en').toLowerCase();
      if (nav.startsWith('es')) LANG='es';
      else if (nav.startsWith('pt')) LANG='pt';
      else LANG='en';
      localStorage.setItem('bbf_lang', LANG);
    }
    apply();
  }

  window.BBF_LANG = { set:setLang, get:function(){return LANG;}, init:init, apply:apply };

  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
