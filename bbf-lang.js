// ═══════════════════════════════════════════════════════════════════
// BBF-LANG.JS — Build Believe Fit LLC
// Trilingual Engine: English | Español | Português (BR)
// ═══════════════════════════════════════════════════════════════════
(function() {
  'use strict';
  var LANG = localStorage.getItem('bbf_lang') || 'en';
  var REDIRECTS = { en:'thank-you.html', es:'gracias.html', pt:'obrigado.html' };

  var T = {
    // ── NAV ────────────────────────────────────────────────────
    'nav-services':  { en:'Services',    es:'Servicios',   pt:'Serviços'      },
    'nav-programs':  { en:'Programs',    es:'Programas',   pt:'Programas'     },
    'nav-results':   { en:'Results',     es:'Resultados',  pt:'Resultados'    },
    'nav-about':     { en:'About',       es:'Sobre mí',    pt:'Sobre mim'     },
    'nav-start':     { en:'Start',       es:'Empezar',     pt:'Começar'       },
    'nav-mystory':   { en:'My Story',    es:'Mi Historia', pt:'Minha História'},
    'nav-nutrition': { en:'Nutrition',   es:'Nutrición',   pt:'Nutrição'      },

    // ── HERO ───────────────────────────────────────────────────
    'hero-sub': {
      en:'Elite performance for the <strong>high-demand life.</strong> Whether you\'re on the factory floor, in the boardroom, or on the front lines &mdash; <strong>your body deserves a system built for how you actually live.</strong>',
      es:'Rendimiento élite para la <strong>vida de alta demanda.</strong> Ya sea en la línea de producción, en la sala de juntas, o en la primera línea &mdash; <strong>tu cuerpo merece un sistema construido para tu realidad.</strong>',
      pt:'Performance de elite para a <strong>vida de alta demanda.</strong> Seja no chão de fábrica, na sala de reuniões ou na linha de frente &mdash; <strong>seu corpo merece um sistema construído para sua realidade.</strong>'
    },

    // ── SERVICES ───────────────────────────────────────────────
    'svc-lbl':  { en:'What We Offer',      es:'Lo Que Ofrecemos',    pt:'O Que Oferecemos'     },
    'svc-h':    { en:'How We Get You There', es:'Cómo Llegamos Juntos', pt:'Como Chegamos Juntos' },
    'svc-n1':   { en:'Strength Coaching',  es:'Entrenamiento de Fuerza', pt:'Treinamento de Força' },
    'svc-n2':   { en:'Nutrition Coaching', es:'Coaching Nutricional',  pt:'Coaching Nutricional' },
    'svc-n3':   { en:'Program Design',     es:'Diseño de Programa',    pt:'Design de Programa'   },
    'svc-n4':   { en:'Elite Transformation', es:'Transformación Élite', pt:'Transformação Elite'  },
    'svc-n5':   { en:'Remote Coaching',    es:'Coaching Remoto',       pt:'Coaching Remoto'      },
    'svc-n6':   { en:'High-Demand Life Protocol', es:'Protocolo de Vida de Alta Demanda', pt:'Protocolo de Vida de Alta Demanda' },
    'svc-d1':   { en:'Progressive overload programming built around your schedule, recovery capacity, and goals. Not a template — a system designed for you.', es:'Programación de sobrecarga progresiva diseñada para tu horario, capacidad de recuperación y objetivos. No es una plantilla — es un sistema para ti.', pt:'Programação de sobrecarga progressiva construída ao redor do seu horário, capacidade de recuperação e objetivos. Não é um modelo — é um sistema para você.' },
    'svc-d2':   { en:'Custom meal plans calibrated to your TDEE, your training intensity, and your real life — not a generic macro split from the internet.', es:'Planes de alimentación personalizados calibrados a tu TDEE, intensidad de entrenamiento y vida real — no un macro split genérico del internet.', pt:'Planos alimentares personalizados calibrados ao seu TDEE, intensidade de treinamento e vida real — não uma divisão de macros genérica da internet.' },
    'svc-d3':   { en:'Day-by-day periodized programs designed for real people with real jobs. Recovery built in. Progress guaranteed when you follow the plan.', es:'Programas periodizados día a día diseñados para personas reales con trabajos reales. Recuperación integrada. Progreso garantizado cuando sigues el plan.', pt:'Programas periodizados dia a dia projetados para pessoas reais com trabalhos reais. Recuperação integrada. Progresso garantido quando você segue o plano.' },
    'svc-d4':   { en:'Full 90-day overhaul — body composition, movement quality, and habit architecture. The complete package for serious, lasting results.', es:'Revisión completa de 90 días — composición corporal, calidad de movimiento y arquitectura de hábitos. El paquete completo para resultados serios y duraderos.', pt:'Revisão completa de 90 dias — composição corporal, qualidade de movimento e arquitetura de hábitos. O pacote completo para resultados sérios e duradouros.' },
    'svc-d5':   { en:'Full access to your custom app portal, weekly check-ins, meal plan updates, and direct coach access — wherever you train.', es:'Acceso completo a tu portal de app personalizado, check-ins semanales, actualizaciones del plan de comidas y acceso directo al entrenador — donde quiera que entrenes.', pt:'Acesso completo ao seu portal de app personalizado, check-ins semanais, atualizações do plano alimentar e acesso direto ao treinador — onde quer que você treine.' },
    'svc-d6':   { en:'Programming built around YOUR reality — rotating shifts, executive travel, hospital floors, emergency calls, or raising kids full-time. Train smarter, not just harder.', es:'Programación construida alrededor de TU realidad — turnos rotativos, viajes ejecutivos, pisos hospitalarios, llamadas de emergencia, o criar hijos a tiempo completo. Entrena más inteligente, no solo más duro.', pt:'Programação construída ao redor da SUA realidade — turnos rotativos, viagens executivas, andares hospitalares, chamadas de emergência ou criar filhos em tempo integral. Treine mais inteligente, não apenas mais duro.' },

    // ── PROGRAMS ───────────────────────────────────────────────
    'prog-section-h':   { en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">Éxito</span>', pt:'Espectro do <span class="y">Sucesso</span>' },
    'prog-section-sub': { en:'We respect every dollar you invest. Whether it\'s $67 or $2,500, you receive a clinical, OT-informed return on that investment.', es:'Respetamos cada dólar que inviertes. Ya sea $67 o $2,500, recibes un retorno clínico e informado por TO en esa inversión.', pt:'Respeitamos cada dólar que você investe. Seja $67 ou $2.500, você recebe um retorno clínico e baseado em TO nesse investimento.' },

    // ── NUTRITION ──────────────────────────────────────────────
    'nut-lbl':  { en:'Nutrition Coaching',  es:'Coaching Nutricional', pt:'Coaching Nutricional' },
    'nut-h':    { en:'Fuel The <span class="y">Right Way</span>', es:'Combustible de la <span class="y">Manera Correcta</span>', pt:'Combustível do <span class="y">Jeito Certo</span>' },
    'nut-sub':  { en:'NASM-certified nutrition coaching. Personalized meal plans aligned with your training, lifestyle, and physique goals.', es:'Coaching nutricional certificado por NASM. Planes de comidas personalizados alineados con tu entrenamiento, estilo de vida y objetivos físicos.', pt:'Coaching nutricional certificado pela NASM. Planos alimentares personalizados alinhados ao seu treinamento, estilo de vida e objetivos físicos.' },
    'nut-n1':   { en:'Lite',       es:'Básico',    pt:'Básico'    },
    'nut-n2':   { en:'Essentials', es:'Esenciales', pt:'Essenciais' },
    'nut-n3':   { en:'Platinum',   es:'Platino',   pt:'Platina'   },
    'tdee-h':   { en:'Calculate Your TDEE', es:'Calcula Tu TDEE', pt:'Calcule Seu TDEE' },

    // ── TESTIMONIALS ───────────────────────────────────────────
    'testi-lbl': { en:'Client Results',        es:'Resultados de Clientes',   pt:'Resultados de Clientes'   },
    'testi-h':   { en:'Real People. <span class="y">Real Work.</span>', es:'Personas Reales. <span class="y">Trabajo Real.</span>', pt:'Pessoas Reais. <span class="y">Trabalho Real.</span>' },

    // ── PATHFINDER ─────────────────────────────────────────────
    'sec-path-lbl': { en:'Start Your Journey',  es:'Comienza Tu Viaje',    pt:'Comece Sua Jornada'    },
    'path-h':    { en:'The <span class="y">Pathfinder</span>', es:'El <span class="y">Buscador</span>', pt:'O <span class="y">Explorador</span>' },
    'path-sub':  { en:'4 quick steps. We\'ll calculate your personalized targets and Akeem will reach out within 24 hours.', es:'4 pasos rápidos. Calcularemos tus objetivos personalizados y Akeem se comunicará contigo en 24 horas.', pt:'4 passos rápidos. Calcularemos seus objetivos e Akeem entrará em contato em 24 horas.' },
    'fs0-title': { en:'Who Are You?',    es:'¿Quién Eres?',     pt:'Quem Você É?'      },
    'fs0-sub':   { en:'Tell us about yourself — we\'ll personalize everything.', es:'Cuéntanos sobre ti — personalizaremos todo.', pt:'Nos conte sobre você — personalizaremos tudo.' },
    'fs1-title': { en:'Your Stats',      es:'Tus Estadísticas', pt:'Suas Estatísticas'  },
    'fs1-sub':   { en:'Used to calculate your personalized TDEE and calorie targets.', es:'Usadas para calcular tu TDEE personalizado y objetivos calóricos.', pt:'Usadas para calcular seu TDEE personalizado e metas calóricas.' },
    'fs2-title': { en:'Your Goal',       es:'Tu Objetivo',      pt:'Seu Objetivo'       },
    'fs2-sub':   { en:'What are you training for?', es:'¿Para qué estás entrenando?', pt:'Para que você está treinando?' },
    'fs3-title': { en:'Final Details',   es:'Detalles Finales', pt:'Detalhes Finais'    },
    'fs3-sub':   { en:'Almost there. This helps Akeem prepare before reaching out.', es:'Casi listo. Esto ayuda a Akeem a prepararse antes de comunicarse.', pt:'Quase lá. Isso ajuda Akeem a se preparar antes de entrar em contato.' },
    'path-submit':{ en:'Calculate My Path &amp; Submit &#x2192;', es:'Calcular Mi Camino y Enviar &#x2192;', pt:'Calcular Meu Caminho e Enviar &#x2192;' },

    // ── APP DOWNLOAD ───────────────────────────────────────────
    'app-lbl':  { en:'Client Portal',       es:'Portal del Cliente',     pt:'Portal do Cliente'       },
    'app-h':    { en:'Your Program.<br><span class="y">In Your Pocket.</span>', es:'Tu Programa.<br><span class="y">En Tu Bolsillo.</span>', pt:'Seu Programa.<br><span class="y">No Seu Bolso.</span>' },
    'app-sub':  { en:'Access your personalized workout program, meal plan, progress tracking, and coach notes — all in one mobile app that works offline.', es:'Accede a tu programa de entrenamiento personalizado, plan de comidas, seguimiento del progreso y notas del entrenador — todo en una app móvil que funciona sin conexión.', pt:'Acesse seu programa de treino personalizado, plano alimentar, acompanhamento de progresso e notas do treinador — tudo em um app móvel que funciona offline.' },

    // ── CONTACT ────────────────────────────────────────────────
    'contact-h': { en:"Let's Build.", es:'Construyamos.', pt:'Vamos Construir.' },

    // ── TRANSFORMATION ─────────────────────────────────────────
    'trans-section-h': { en:'This Is Why <span class="y">BBF Exists</span>', es:'Por Eso Existe <span class="y">BBF</span>', pt:'Por Isso Existe o <span class="y">BBF</span>' },

    // ── MODAL ──────────────────────────────────────────────────
    'modal-close': { en:"Close &mdash; I'll check my email", es:'Cerrar &mdash; Revisaré mi correo', pt:'Fechar &mdash; Verei meu e-mail' },

    // ── APP PREHAB ─────────────────────────────────────────────
    'app-prehab-sub': {
      en:'OT-Informed joint health for high-demand athletes',
      es:'Salud articular informada por TO para atletas de alta demanda',
      pt:'Saúde articular baseada em TO para atletas de alta demanda'
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
      if (b2) {
        b2.style.background = (l===LANG) ? 'rgba(245,200,0,.3)' : 'transparent';
        b2.style.color = (l===LANG) ? '#f5c800' : 'rgba(255,255,255,.45)';
      }
    });
    document.documentElement.lang = LANG==='pt' ? 'pt-BR' : LANG;
    // Update Formspree redirect
    var nf = document.getElementById('_next');
    if (nf) nf.value = window.location.origin+'/'+(REDIRECTS[LANG]||'thank-you.html');
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
