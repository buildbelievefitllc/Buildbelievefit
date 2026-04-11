// ═══════════════════════════════════════════════════════════════════
// BBF-LANG.JS — Build Believe Fit LLC  (UNIFIED v4 — no patches)
// Trilingual Engine: English | Español | Português (BR)
// All keys in one dictionary. Applies on DOMContentLoaded.
// ═══════════════════════════════════════════════════════════════════
(function() {
  'use strict';

  var LANG = localStorage.getItem('bbf_lang') || 'en';

  // ── Full Translation Dictionary ─────────────────────────────────
  var T = {
    // NAV
    'nav-services':      { en:'Services',      es:'Servicios',     pt:'Serviços'       },
    'nav-programs':      { en:'Programs',       es:'Programas',     pt:'Programas'      },
    'nav-nutrition':     { en:'Nutrition',      es:'Nutrición',     pt:'Nutrição'       },
    'nav-results':       { en:'Results',        es:'Resultados',    pt:'Resultados'     },
    'nav-about':         { en:'About',          es:'Sobre mí',      pt:'Sobre mim'      },
    'nav-start':         { en:'Start',          es:'Empezar',       pt:'Começar'        },
    'nav-mystory':       { en:'My Story',       es:'Mi Historia',   pt:'Minha História' },

    // HERO
    'hero-sub': {
      en: 'Elite performance for the <strong>high-demand life.</strong> Whether you\'re on the factory floor, in the boardroom, or on the front lines &mdash; <strong>your body deserves a system built for how you actually live.</strong>',
      es: 'Rendimiento élite para la <strong>vida de alta demanda.</strong> Ya sea en la línea de producción, en la sala de juntas, o en la primera línea &mdash; <strong>tu cuerpo merece un sistema construido para tu realidad.</strong>',
      pt: 'Performance de elite para a <strong>vida de alta demanda.</strong> Seja no chão de fábrica, na sala de reuniões ou na linha de frente &mdash; <strong>seu corpo merece um sistema construído para sua realidade.</strong>'
    },

    // SERVICES
    'svc-lbl':  { en:'What We Offer',          es:'Lo Que Ofrecemos',         pt:'O Que Oferecemos'          },
    'svc-h':    { en:'How We Get You There',    es:'Cómo Llegamos Juntos',     pt:'Como Chegamos Juntos'      },
    'svc-n1':   { en:'Strength Coaching',       es:'Entrenamiento de Fuerza',  pt:'Treinamento de Força'      },
    'svc-n2':   { en:'Nutrition Coaching',      es:'Coaching Nutricional',     pt:'Coaching Nutricional'      },
    'svc-n3':   { en:'Program Design',          es:'Diseño de Programa',       pt:'Design de Programa'        },
    'svc-n4':   { en:'Elite Transformation',    es:'Transformación Élite',     pt:'Transformação Elite'       },
    'svc-n5':   { en:'Remote Coaching',         es:'Coaching Remoto',          pt:'Coaching Remoto'           },
    'svc-n6':   { en:'High-Demand Life Protocol', es:'Protocolo de Vida de Alta Demanda', pt:'Protocolo de Vida de Alta Demanda' },
    'svc-d1':   { en:'Progressive overload programming built around your schedule, recovery capacity, and goals. Not a template — a system designed for you.', es:'Programación de sobrecarga progresiva diseñada para tu horario, capacidad de recuperación y objetivos. No es una plantilla — es un sistema para ti.', pt:'Programação de sobrecarga progressiva construída ao redor do seu horário, capacidade de recuperação e objetivos. Não é um modelo — é um sistema para você.' },
    'svc-d2':   { en:'Custom meal plans calibrated to your TDEE, your training intensity, and your real life — not a generic macro split from the internet.', es:'Planes de alimentación personalizados calibrados a tu TDEE, intensidad de entrenamiento y vida real — no un macro split genérico del internet.', pt:'Planos alimentares personalizados calibrados ao seu TDEE, intensidade de treinamento e vida real — não uma divisão de macros genérica da internet.' },
    'svc-d3':   { en:'Day-by-day periodized programs designed for real people with real jobs. Recovery built in. Progress guaranteed when you follow the plan.', es:'Programas periodizados día a día diseñados para personas reales con trabajos reales. Recuperación integrada. Progreso garantizado cuando sigues el plan.', pt:'Programas periodizados dia a dia projetados para pessoas reais com trabalhos reais. Recuperação integrada. Progresso garantido quando você segue o plano.' },
    'svc-d4':   { en:'Full 90-day overhaul — body composition, movement quality, and habit architecture. The complete package for serious, lasting results.', es:'Revisión completa de 90 días — composición corporal, calidad de movimiento y arquitectura de hábitos. El paquete completo para resultados serios y duraderos.', pt:'Revisão completa de 90 dias — composição corporal, qualidade de movimento e arquitetura de hábitos. O pacote completo para resultados sérios e duradouros.' },
    'svc-d5':   { en:'Full access to your custom app portal, weekly check-ins, meal plan updates, and direct coach access — wherever you train.', es:'Acceso completo a tu portal de app personalizado, check-ins semanales, actualizaciones del plan de comidas y acceso directo al entrenador — donde quiera que entrenes.', pt:'Acesso completo ao seu portal de app personalizado, check-ins semanais, atualizações do plano alimentar e acesso direto ao treinador — onde quer que você treine.' },
    'svc-d6':   { en:'Programming built around YOUR reality — rotating shifts, executive travel, hospital floors, emergency calls, or raising kids full-time.', es:'Programación construida alrededor de TU realidad — turnos rotativos, viajes ejecutivos, pisos hospitalarios, llamadas de emergencia, o criar hijos a tiempo completo.', pt:'Programação construída ao redor da SUA realidade — turnos rotativos, viagens executivas, andares hospitalares, chamadas de emergência ou criar filhos em tempo integral.' },

    // FOUNDER
    'founder-h': { en:'The Story<br>Behind <span class="y">BBF</span>', es:'La Historia<br>Detrás de <span class="y">BBF</span>', pt:'A História<br>Por Trás do <span class="y">BBF</span>' },
    'founder-p1': {
      en: 'I run <strong>12-hour shifts on the manufacturing floor.</strong> I come home tired, feet sore, body taxed. And then I train. Not because I have to &mdash; because I <strong>choose to.</strong> Because I refuse to let the grind define my ceiling.',
      es: 'Trabajo <strong>turnos de 12 horas en el piso de manufactura.</strong> Llego a casa cansado, pies adoloridos, cuerpo agotado. Y luego entreno. No porque tenga que hacerlo &mdash; sino porque <strong>elijo hacerlo.</strong> Porque me niego a que el trabajo duro defina mi techo.',
      pt: 'Trabalho <strong>turnos de 12 horas no chão de fábrica.</strong> Chego em casa cansado, pés doloridos, corpo esgotado. E então treino. Não porque preciso &mdash; mas porque <strong>escolho.</strong> Porque me recuso a deixar que a luta defina meu limite.'
    },
    'founder-p2': {
      en: 'Build Believe Fit wasn\'t born in a fancy gym with unlimited time and energy. It was built between shifts, in parking lots, in the 45 minutes I carved out when everyone else was resting. I\'m a <strong>NASM-certified trainer, a competitive bodybuilder, a father of 4</strong>, and an industrial athlete who understands what it actually costs to change your body when life doesn\'t pause.',
      es: 'Build Believe Fit no nació en un gimnasio elegante con tiempo y energía ilimitados. Se construyó entre turnos, en estacionamientos, en los 45 minutos que encontré cuando todos los demás descansaban. Soy un <strong>entrenador certificado por NASM, culturista competitivo, padre de 4</strong> y atleta industrial que entiende lo que realmente cuesta cambiar tu cuerpo cuando la vida no hace pausa.',
      pt: 'Build Believe Fit não nasceu em uma academia luxuosa com tempo e energia ilimitados. Foi construído entre turnos, em estacionamentos, nos 45 minutos que encontrei quando todos os outros estavam descansando. Sou um <strong>treinador certificado pela NASM, fisiculturista competitivo, pai de 4</strong> e atleta industrial que entende o que realmente custa mudar seu corpo quando a vida não faz pausa.'
    },
    'founder-p3': {
      en: 'My clients aren\'t influencers. They\'re <strong>workers. Grinders. People who show up.</strong> I build systems that work for real lives &mdash; because mine is one of them.',
      es: 'Mis clientes no son influencers. Son <strong>trabajadores. Luchadores. Personas que se presentan.</strong> Construyo sistemas que funcionan para vidas reales &mdash; porque la mía es una de ellas.',
      pt: 'Meus clientes não são influenciadores. São <strong>trabalhadores. Guerreiros. Pessoas que aparecem.</strong> Construo sistemas que funcionam para vidas reais &mdash; porque a minha é uma delas.'
    },

    // PROGRAMS
    'prog-section-h':   { en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">Éxito</span>', pt:'Espectro do <span class="y">Sucesso</span>' },
    'prog-section-sub': { en:'We respect every dollar you invest. Whether it\'s $67 or $2,500, you receive a clinical, OT-informed return on that investment.', es:'Respetamos cada dólar que inviertes. Ya sea $67 o $2,500, recibes un retorno clínico e informado por TO en esa inversión.', pt:'Respeitamos cada dólar que você investe. Seja $67 ou $2.500, você recebe um retorno clínico e baseado em TO nesse investimento.' },
    'prog-n1':  { en:'Community<br>Blueprint',        es:'Proyecto<br>Comunitario',       pt:'Projeto<br>Comunitário'         },
    'prog-n2':  { en:'Elite 8-Week<br>Challenge',      es:'Desafío Élite<br>8 Semanas',    pt:'Desafio Elite<br>8 Semanas'     },
    'prog-n3':  { en:'Legacy Performance<br>Protocol', es:'Protocolo de<br>Legado',        pt:'Protocolo de<br>Legado'         },

    // FINANCIAL INTEGRITY
    'fin-title': { en:'The BBF Financial Integrity Promise', es:'La Promesa de Integridad Financiera de BBF', pt:'A Promessa de Integridade Financeira do BBF' },
    'fin-quote': {
      en: '&ldquo;Whether you invest $67 or $2,500 — you receive the same clinical-level OT-informed attention to your joint safety, your recovery, and your long-term mobility. The price reflects access. The standard never changes.&rdquo;',
      es: '&ldquo;Ya sea que inviertas $67 o $2,500 — recibes la misma atención clínica informada por TO para la seguridad de tus articulaciones, tu recuperación y tu movilidad a largo plazo. El precio refleja el acceso. El estándar nunca cambia.&rdquo;',
      pt: '&ldquo;Seja você invista $67 ou $2.500 — você recebe a mesma atenção clínica baseada em TO para a segurança das suas articulações, sua recuperação e sua mobilidade a longo prazo. O preço reflete o acesso. O padrão nunca muda.&rdquo;'
    },

    // NUTRITION
    'nut-lbl':  { en:'Nutrition Coaching',  es:'Coaching Nutricional', pt:'Coaching Nutricional' },
    'nut-h':    { en:'Fuel The <span class="y">Right Way</span>', es:'Combustible de la <span class="y">Manera Correcta</span>', pt:'Combustível do <span class="y">Jeito Certo</span>' },
    'nut-sub':  { en:'NASM-certified nutrition coaching. Personalized meal plans aligned with your training, lifestyle, and physique goals.', es:'Coaching nutricional certificado por NASM. Planes de comidas personalizados alineados con tu entrenamiento, estilo de vida y objetivos físicos.', pt:'Coaching nutricional certificado pela NASM. Planos alimentares personalizados alinhados ao seu treinamento, estilo de vida e objetivos físicos.' },
    'nut-n1':   { en:'Lite',       es:'Básico',    pt:'Básico'    },
    'nut-n2':   { en:'Essentials', es:'Esenciales', pt:'Essenciais' },
    'nut-n3':   { en:'Platinum',   es:'Platino',   pt:'Platina'   },
    'tdee-h':   { en:'Calculate Your TDEE', es:'Calcula Tu TDEE', pt:'Calcule Seu TDEE' },

    // TESTIMONIALS
    'testi-lbl': { en:'Client Results',        es:'Resultados de Clientes',   pt:'Resultados de Clientes'   },
    'testi-h':   { en:'Real People. <span class="y">Real Work.</span>', es:'Personas Reales. <span class="y">Trabajo Real.</span>', pt:'Pessoas Reais. <span class="y">Trabalho Real.</span>' },

    // TRANSFORMATION SECTION
    'trans-section-h': { en:'This Is Why <span class="y">BBF Exists</span>', es:'Por Eso Existe <span class="y">BBF</span>', pt:'Por Isso Existe o <span class="y">BBF</span>' },
    'panel-feeling': { en:'The Feeling',        es:'El Sentimiento',     pt:'O Sentimento'       },
    'panel-craft':   { en:'Learning The Craft', es:'Aprendiendo el Arte', pt:'Aprendendo a Arte'  },
    'panel-ripple':  { en:'The Ripple Effect',  es:'El Efecto Dominó',   pt:'O Efeito Cascata'   },
    'journey-lbl':   { en:'The Full Journey',   es:'El Viaje Completo',  pt:'A Jornada Completa' },
    'trans-p1': {
      en: 'I know what it feels like to look in the mirror and not recognize yourself. To feel like time is the enemy — like between the job, the kids, the shifts, and just surviving — there\'s nothing left for <em>you.</em>',
      es: 'Sé lo que se siente al mirarse al espejo y no reconocerse. Sentir que el tiempo es el enemigo — que entre el trabajo, los hijos, los turnos y solo sobrevivir — no queda nada para <em>ti.</em>',
      pt: 'Eu sei como é olhar no espelho e não se reconhecer. Sentir que o tempo é o inimigo — que entre o trabalho, os filhos, os turnos e apenas sobreviver — não sobra nada para <em>você.</em>'
    },
    'trans-p2': {
      en: 'That picture on the left is not just a body. That\'s someone who had stopped believing the window was still open. Someone who felt <strong style="color:var(--wht)">alone in the journey.</strong>',
      es: 'Esa foto de la izquierda no es solo un cuerpo. Es alguien que había dejado de creer que la ventana aún estaba abierta. Alguien que se sentía <strong style="color:var(--wht)">solo en el camino.</strong>',
      pt: 'Aquela foto à esquerda não é apenas um corpo. É alguém que havia parado de acreditar que a janela ainda estava aberta. Alguém que se sentia <strong style="color:var(--wht)">sozinho na jornada.</strong>'
    },
    'trans-p3': {
      en: 'Build Believe Fit exists because of that feeling. Because <strong style="color:var(--yel)">nobody should feel like there isn\'t enough time, enough energy, or enough support to become who they\'re meant to be.</strong> The window is always open. You just need the right system and someone who actually gets it.',
      es: 'Build Believe Fit existe por ese sentimiento. Porque <strong style="color:var(--yel)">nadie debería sentir que no hay suficiente tiempo, energía ni apoyo para convertirse en quien está destinado a ser.</strong> La ventana siempre está abierta. Solo necesitas el sistema correcto y a alguien que realmente lo entienda.',
      pt: 'Build Believe Fit existe por causa desse sentimento. Porque <strong style="color:var(--yel)">ninguém deveria sentir que não há tempo suficiente, energia suficiente ou apoio suficiente para se tornar quem deve ser.</strong> A janela está sempre aberta. Você só precisa do sistema certo e de alguém que realmente entenda.'
    },
    'enough-quote': {
      en: 'Enough Is Enough Was The Most Powerful Decision I Ever Made. Now I Help Others Make It Too.',
      es: 'Suficiente Es Suficiente Fue La Decisión Más Poderosa Que Tomé. Ahora Ayudo a Otros a Hacer Lo Mismo.',
      pt: 'Chega É Chega Foi a Decisão Mais Poderosa Que Tomei. Agora Ajudo Outros a Fazerem o Mesmo.'
    },

    // PATHFINDER
    'sec-path-lbl': { en:'Start Your Journey', es:'Comienza Tu Viaje',    pt:'Comece Sua Jornada'   },
    'path-h':    { en:'The <span class="y">Pathfinder</span>', es:'El <span class="y">Buscador</span>', pt:'O <span class="y">Explorador</span>' },
    'path-sub':  { en:'4 quick steps. We\'ll calculate your personalized targets and Akeem will reach out within 24 hours.', es:'4 pasos rápidos. Calcularemos tus objetivos personalizados y Akeem se comunicará contigo en 24 horas.', pt:'4 passos rápidos. Calcularemos seus objetivos e Akeem entrará em contato em 24 horas.' },
    'fs0-title': { en:'Who Are You?',    es:'¿Quién Eres?',      pt:'Quem Você É?'       },
    'fs0-sub':   { en:'Tell us about yourself — we\'ll personalize everything.', es:'Cuéntanos sobre ti — personalizaremos todo.', pt:'Nos conte sobre você — personalizaremos tudo.' },
    'fs1-title': { en:'Your Stats',      es:'Tus Estadísticas',  pt:'Suas Estatísticas'  },
    'fs1-sub':   { en:'Used to calculate your personalized TDEE and calorie targets.', es:'Usadas para calcular tu TDEE personalizado y objetivos calóricos.', pt:'Usadas para calcular seu TDEE personalizado e metas calóricas.' },
    'fs2-title': { en:'Your Goal',       es:'Tu Objetivo',       pt:'Seu Objetivo'       },
    'fs2-sub':   { en:'What are you training for?', es:'¿Para qué estás entrenando?', pt:'Para que você está treinando?' },
    'fs3-title': { en:'Final Details',   es:'Detalles Finales',  pt:'Detalhes Finais'    },
    'fs3-sub':   { en:'Almost there. This helps Akeem prepare before reaching out.', es:'Casi listo. Esto ayuda a Akeem a prepararse antes de comunicarse.', pt:'Quase lá. Isso ajuda Akeem a se preparar antes de entrar em contato.' },

    // APP DOWNLOAD
    'app-lbl':   { en:'Client Portal',       es:'Portal del Cliente',     pt:'Portal do Cliente'       },
    'app-h':     { en:'Your Program.<br><span class="y">In Your Pocket.</span>', es:'Tu Programa.<br><span class="y">En Tu Bolsillo.</span>', pt:'Seu Programa.<br><span class="y">No Seu Bolso.</span>' },
    'app-sub':   { en:'Access your personalized workout program, meal plan, progress tracking, and coach notes — all in one mobile app that works offline.', es:'Accede a tu programa de entrenamiento personalizado, plan de comidas, seguimiento del progreso y notas del entrenador — todo en una app móvil que funciona sin conexión.', pt:'Acesse seu programa de treino personalizado, plano alimentar, acompanhamento de progresso e notas do treinador — tudo em um app móvel que funciona offline.' },
    'app-step1': { en:'Open the link in your browser',           es:'Abre el enlace en tu navegador',               pt:'Abra o link no seu navegador'               },
    'app-step2': { en:'Tap menu then "Add to Home Screen"',      es:'Toca el menú y luego "Agregar a pantalla"',    pt:'Toque no menu e depois "Adicionar à tela"'  },
    'app-step3': { en:'Use like a real app — works offline too', es:'Úsalo como una app real — funciona sin conexión', pt:'Use como um app real — funciona offline também' },

    // CONTACT
    'contact-h':   { en:"Let's Build.",    es:'Construyamos.',    pt:'Vamos Construir.' },
    'contact-sub': { en:'Ready to start? Have questions? Reach out directly — Akeem responds fast.', es:'¿Listo para comenzar? ¿Tienes preguntas? Contáctanos directamente — Akeem responde rápido.', pt:'Pronto para começar? Tem perguntas? Entre em contato diretamente — Akeem responde rápido.' },

    // FOOTER LINKS
    'mob-nav-services':  { en:'Services',      es:'Servicios',        pt:'Serviços'          },
    'mob-nav-programs':  { en:'Programs',      es:'Programas',        pt:'Programas'         },
    'mob-nav-nutrition': { en:'Nutrition',     es:'Nutrición',        pt:'Nutrição'          },
    'mob-nav-results':   { en:'Results',       es:'Resultados',       pt:'Resultados'        },
    'ft-about':          { en:'About Akeem',   es:'Sobre Akeem',      pt:'Sobre Akeem'       },
    'ft-start':          { en:'Start My Path', es:'Comienza Tu Camino', pt:'Comece Sua Jornada' }
  };

  // ── Apply All Translations ───────────────────────────────────────
  function apply(lang) {
    // 1. Translate by data-lang-key attribute
    document.querySelectorAll('[data-lang-key]').forEach(function(el) {
      var key = el.getAttribute('data-lang-key');
      if (T[key] && T[key][lang]) el.innerHTML = T[key][lang];
    });
    // 2. Translate by matching element ID
    Object.keys(T).forEach(function(key) {
      var el = document.getElementById(key);
      if (el && T[key][lang]) el.innerHTML = T[key][lang];
    });
    // 3. Update nav toggle buttons
    ['en','es','pt'].forEach(function(l) {
      var b1 = document.getElementById('lt-'+l);
      if (b1) b1.className = (l===lang) ? 'lang-on' : '';
      var b2 = document.getElementById('mob-lt-'+l);
      if (b2) {
        b2.style.background = (l===lang) ? 'rgba(245,200,0,.3)' : 'transparent';
        b2.style.color = (l===lang) ? '#f5c800' : 'rgba(255,255,255,.45)';
      }
    });
    document.documentElement.lang = (lang==='pt') ? 'pt-BR' : lang;
    // 4. Update Formspree redirect
    var nf = document.getElementById('_next');
    if (nf) nf.value = window.location.origin+'/'+(lang==='es'?'gracias.html':lang==='pt'?'obrigado.html':'thank-you.html');
  }

  // ── Set Language ─────────────────────────────────────────────────
  function setLang(l) {
    if (!['en','es','pt'].includes(l)) return;
    LANG = l;
    localStorage.setItem('bbf_lang', l);
    apply(l);
  }

  // ── Init ─────────────────────────────────────────────────────────
  function init() {
    if (!localStorage.getItem('bbf_lang')) {
      var nav = (navigator.language||'en').toLowerCase();
      if (nav.startsWith('es')) LANG='es';
      else if (nav.startsWith('pt')) LANG='pt';
      localStorage.setItem('bbf_lang', LANG);
    }
    apply(LANG);
  }

  // ── Export ───────────────────────────────────────────────────────
  window.BBF_LANG = {
    set: setLang,
    get: function() { return LANG; },
    init: init,
    apply: apply
  };

  // ── Auto-init on DOM ready ───────────────────────────────────────
  if (document.readyState==='loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
