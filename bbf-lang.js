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

// ═══ FOUNDER ═══
'founder-lbl':     { en:'The Founder', es:'El Fundador', pt:'O Fundador' },
'founder-h':       { en:'The Story Behind <span class="y">BBF</span>', es:'La Historia Detr\u00e1s de <span class="y">BBF</span>', pt:'A Hist\u00f3ria Por Tr\u00e1s do <span class="y">BBF</span>' },
'cred-t1':         { en:'NASM Certified Personal Trainer', es:'Entrenador Personal Certificado NASM', pt:'Personal Trainer Certificado NASM' },
'cred-s1':         { en:'National Academy of Sports Medicine \u2014 Exercise Science', es:'Academia Nacional de Medicina Deportiva \u2014 Ciencias del Ejercicio', pt:'Academia Nacional de Medicina Esportiva \u2014 Ci\u00eancias do Exerc\u00edcio' },
'cred-t2':         { en:'12-Hour Manufacturing Shifts', es:'Turnos de Manufactura de 12 Horas', pt:'Turnos de Manufatura de 12 Horas' },
'cred-s2':         { en:'Human Performance Architect \u2022 Habit System Designer', es:'Arquitecto de Rendimiento Humano \u2022 Dise\u00f1ador de Sistemas de H\u00e1bitos', pt:'Arquiteto de Performance Humana \u2022 Designer de Sistemas de H\u00e1bitos' },
'cred-t3':         { en:'Fitness Enthusiast & Lifter', es:'Entusiasta del Fitness & Levantador', pt:'Entusiasta de Fitness & Levantador' },
'cred-s3':         { en:'Dedicated to the craft of human performance', es:'Dedicado al arte del rendimiento humano', pt:'Dedicado \u00e0 arte da performance humana' },
'cred-t4':         { en:'Business & Marketing Student', es:'Estudiante de Negocios & Marketing', pt:'Estudante de Neg\u00f3cios & Marketing' },
'cred-s4':         { en:'Chandler-Gilbert Community College', es:'Chandler-Gilbert Community College', pt:'Chandler-Gilbert Community College' },
'cred-t5':         { en:'Father of 4', es:'Padre de 4', pt:'Pai de 4' },
'cred-s5':         { en:'Coaches his son who plays football', es:'Entrena a su hijo que juega f\u00fatbol americano', pt:'Treina seu filho que joga futebol americano' },
'founder-p1':      { en:'I discovered the Human Habit Equation inside the most demanding laboratory imaginable \u2014 12-hour shifts and a family of four. That environment didn\u2019t limit me. It revealed the system. My life became the proving ground for every protocol I now deliver.', es:'Descubr\u00ed la Ecuaci\u00f3n del H\u00e1bito Humano dentro del laboratorio m\u00e1s exigente imaginable \u2014 turnos de 12 horas y una familia de cuatro. Ese entorno no me limit\u00f3. Revel\u00f3 el sistema. Mi vida se convirti\u00f3 en el campo de pruebas de cada protocolo que ahora entrego.', pt:'Descobri a Equa\u00e7\u00e3o do H\u00e1bito Humano dentro do laborat\u00f3rio mais exigente imagin\u00e1vel \u2014 turnos de 12 horas e uma fam\u00edlia de quatro. Esse ambiente n\u00e3o me limitou. Revelou o sistema. Minha vida se tornou o campo de provas de cada protocolo que agora entrego.' },
'founder-p2':      { en:'Build Believe Fit was born between obligations \u2014 in the windows of time most people overlook. I\u2019m a <strong>NASM-certified trainer, a passionate lifter, a father of 4</strong>, and an Exercise Science student becoming an Occupational Therapist. I understand the human body and the human schedule. That\u2019s the combination that makes this system work.', es:'Build Believe Fit naci\u00f3 entre obligaciones \u2014 en las ventanas de tiempo que la mayor\u00eda ignora. Soy un <strong>entrenador certificado NASM, un levantador apasionado, padre de 4</strong>, y estudiante de Ciencias del Ejercicio convirti\u00e9ndome en Terapeuta Ocupacional. Entiendo el cuerpo humano y el horario humano. Esa es la combinaci\u00f3n que hace funcionar este sistema.', pt:'Build Believe Fit nasceu entre obriga\u00e7\u00f5es \u2014 nas janelas de tempo que a maioria ignora. Sou um <strong>treinador certificado NASM, levantador apaixonado, pai de 4</strong>, e estudante de Ci\u00eancias do Exerc\u00edcio tornando-me Terapeuta Ocupacional. Entendo o corpo humano e a agenda humana. Essa \u00e9 a combina\u00e7\u00e3o que faz este sistema funcionar.' },
'founder-p3':      { en:'My clients aren\u2019t defined by their occupation. They\u2019re defined by their refusal to let their schedule become their ceiling. <strong>Executives. First responders. Parents. Everyday athletes.</strong> Every one of them runs on the same system because human performance architecture doesn\u2019t discriminate.', es:'Mis clientes no se definen por su ocupaci\u00f3n. Se definen por su negativa a dejar que su horario se convierta en su techo. <strong>Ejecutivos. Socorristas. Padres. Atletas cotidianos.</strong> Todos funcionan con el mismo sistema porque la arquitectura de rendimiento humano no discrimina.', pt:'Meus clientes n\u00e3o s\u00e3o definidos pela ocupa\u00e7\u00e3o. S\u00e3o definidos pela recusa em deixar sua agenda se tornar seu teto. <strong>Executivos. Socorristas. Pais. Atletas do dia a dia.</strong> Todos funcionam no mesmo sistema porque a arquitetura de performance humana n\u00e3o discrimina.' },
'founder-adv-title': { en:'The System Advantage:', es:'La Ventaja del Sistema:', pt:'A Vantagem do Sistema:' },
'founder-adv-text': { en:'My occupational therapy education and exercise science training allow me to engineer performance systems around your actual life \u2014 your schedule, your recovery, your joint health, and your long-term mobility. This is human performance architecture. Not just training.', es:'Mi educaci\u00f3n en terapia ocupacional y ciencias del ejercicio me permiten dise\u00f1ar sistemas de rendimiento alrededor de tu vida real \u2014 tu horario, tu recuperaci\u00f3n, tu salud articular y tu movilidad a largo plazo. Esto es arquitectura de rendimiento humano. No solo entrenamiento.', pt:'Minha educa\u00e7\u00e3o em terapia ocupacional e ci\u00eancias do exerc\u00edcio me permitem projetar sistemas de performance ao redor da sua vida real \u2014 sua agenda, sua recupera\u00e7\u00e3o, sua sa\u00fade articular e sua mobilidade a longo prazo. Isto \u00e9 arquitetura de performance humana. N\u00e3o apenas treino.' },
'founder-sig':     { en:'\u2014 Akeem Brown', es:'\u2014 Akeem Brown', pt:'\u2014 Akeem Brown' },

// ═══ PROGRAMS ═══
'prog-lbl':        { en:'Choose Your Path', es:'Elige Tu Camino', pt:'Escolha Seu Caminho' },
'prog-h':          { en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">\u00c9xito</span>', pt:'Espectro do <span class="y">Sucesso</span>' },
'prog-section-sub': { en:'We respect every dollar you invest. Whether it\u2019s $67 or $2,500, you receive a clinical, OT-informed return on that investment.', es:'Respetamos cada d\u00f3lar que inviertes. Sea $67 o $2,500, recibes un retorno cl\u00ednico e informado por TO sobre esa inversi\u00f3n.', pt:'Respeitamos cada d\u00f3lar que voc\u00ea investe. Seja $67 ou $2.500, voc\u00ea recebe um retorno cl\u00ednico e informado por TO sobre esse investimento.' },
'prog-t1-tier':    { en:'Community Tier', es:'Nivel Comunidad', pt:'N\u00edvel Comunidade' },
'prog-t1-name':    { en:'Community Blueprint', es:'Plan Comunitario', pt:'Plano Comunit\u00e1rio' },
'prog-t1-price':   { en:'$67', es:'$67', pt:'$67' },
'prog-t1-cta':     { en:'Start for $67 \u2192', es:'Comienza por $67 \u2192', pt:'Comece por $67 \u2192' },
'prog-t2-tier':    { en:'Flagship Program', es:'Programa Insignia', pt:'Programa Principal' },
'prog-t2-name':    { en:'Elite 8-Week Challenge', es:'Desaf\u00edo Elite de 8 Semanas', pt:'Desafio Elite de 8 Semanas' },
'prog-t2-price':   { en:'$497', es:'$497', pt:'$497' },
'prog-t2-cta':     { en:'Start Elite \u2192', es:'Iniciar Elite \u2192', pt:'Iniciar Elite \u2192' },
'prog-t3-tier':    { en:'Executive & Clinical', es:'Ejecutivo & Cl\u00ednico', pt:'Executivo & Cl\u00ednico' },
'prog-t3-name':    { en:'Legacy Performance Protocol', es:'Protocolo de Rendimiento Legacy', pt:'Protocolo de Performance Legacy' },
'prog-t3-price':   { en:'$1,500 \u2013 $2,500', es:'$1,500 \u2013 $2,500', pt:'$1.500 \u2013 $2.500' },
'prog-t3-cta':     { en:'Apply for Legacy \u2192', es:'Solicitar Legacy \u2192', pt:'Solicitar Legacy \u2192' },

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
