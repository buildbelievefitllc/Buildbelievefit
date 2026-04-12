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

// ═══ NUTRITION ═══
'nut-lbl':         { en:'Nutrition Coaching', es:'Coaching Nutricional', pt:'Coaching Nutricional' },
'nut-h':           { en:'Fuel The <span class="y">Right Way</span>', es:'Alimenta De La <span class="y">Forma Correcta</span>', pt:'Alimente Da <span class="y">Forma Certa</span>' },
'nut-sub':         { en:'NASM-certified nutrition coaching. Personalized meal plans aligned with your training, lifestyle, and physique goals.', es:'Coaching nutricional certificado NASM. Planes alimenticios personalizados alineados con tu entrenamiento, estilo de vida y objetivos f\u00edsicos.', pt:'Coaching nutricional certificado NASM. Planos alimentares personalizados alinhados com seu treino, estilo de vida e objetivos f\u00edsicos.' },
'nut-n1':          { en:'Lite', es:'Lite', pt:'Lite' },
'nut-d1':          { en:'Self-starters who need a solid baseline. Use our free TDEE calculator and get your macro targets instantly.', es:'Para quienes inician solos y necesitan una base s\u00f3lida. Usa nuestra calculadora TDEE gratuita y obt\u00e9n tus metas de macros al instante.', pt:'Para quem inicia sozinho e precisa de uma base s\u00f3lida. Use nossa calculadora TDEE gratuita e obtenha suas metas de macros instantaneamente.' },
'nut-cta1':        { en:'Calculate Your TDEE \u2192', es:'Calcula Tu TDEE \u2192', pt:'Calcule Seu TDEE \u2192' },
'nut-n2':          { en:'Essentials', es:'Esenciales', pt:'Essenciais' },
'nut-d2':          { en:'Full nutrition system built around your training. Tracked inside your personalized client portal.', es:'Sistema nutricional completo construido alrededor de tu entrenamiento. Rastreado dentro de tu portal personalizado.', pt:'Sistema nutricional completo constru\u00eddo ao redor do seu treino. Rastreado dentro do seu portal personalizado.' },
'nut-cta2':        { en:'Access Client Portal \u2192', es:'Acceder al Portal \u2192', pt:'Acessar o Portal \u2192' },
'nut-n3':          { en:'Platinum', es:'Platinum', pt:'Platinum' },
'nut-d3':          { en:'Full-service. Training and nutrition fully integrated. Akeem manages and adjusts everything.', es:'Servicio completo. Entrenamiento y nutrici\u00f3n totalmente integrados. Akeem gestiona y ajusta todo.', pt:'Servi\u00e7o completo. Treino e nutri\u00e7\u00e3o totalmente integrados. Akeem gerencia e ajusta tudo.' },
'nut-cta3':        { en:'Apply for Platinum \u2192', es:'Solicitar Platinum \u2192', pt:'Solicitar Platinum \u2192' },
'tdee-h':          { en:'Calculate Your TDEE', es:'Calcula Tu TDEE', pt:'Calcule Seu TDEE' },
'tdee-btn':        { en:'Calculate My Targets \u2192', es:'Calcular Mis Metas \u2192', pt:'Calcular Minhas Metas \u2192' },

// ═══ TESTIMONIALS ═══
'testi-lbl':       { en:'Client Results', es:'Resultados de Clientes', pt:'Resultados de Clientes' },
'testi-h':         { en:'Real People. <span class="y">Real Work.</span>', es:'Personas Reales. <span class="y">Trabajo Real.</span>', pt:'Pessoas Reais. <span class="y">Trabalho Real.</span>' },
'testi-q1':        { en:'Akeem built my program around my high-demand schedule. I\u2019m training 5 days a week, down 22 lbs, and hitting PRs I never thought possible. The system adapts to my life, not the other way around.', es:'Akeem construy\u00f3 mi programa alrededor de mi horario de alta demanda. Entreno 5 d\u00edas a la semana, baj\u00e9 22 lbs, y estoy logrando marcas que nunca cre\u00ed posibles. El sistema se adapta a mi vida, no al rev\u00e9s.', pt:'Akeem construiu meu programa ao redor da minha agenda de alta demanda. Treino 5 dias por semana, perdi 22 lbs, e estou batendo recordes que nunca achei poss\u00edveis. O sistema se adapta \u00e0 minha vida, n\u00e3o o contr\u00e1rio.' },
'testi-q2':        { en:'The app is insane \u2014 I can see my meal plan, log my workouts, and track my progress all in one place. But it\u2019s the coaching that makes the difference. Akeem is locked in.', es:'La app es incre\u00edble \u2014 puedo ver mi plan alimenticio, registrar mis entrenamientos y seguir mi progreso todo en un lugar. Pero es el coaching lo que marca la diferencia. Akeem est\u00e1 comprometido al 100%.', pt:'O app \u00e9 incr\u00edvel \u2014 posso ver meu plano alimentar, registrar meus treinos e acompanhar meu progresso tudo em um lugar. Mas \u00e9 o coaching que faz a diferen\u00e7a. Akeem \u00e9 100% comprometido.' },
'testi-q3':        { en:'I was skeptical at first but the results don\u2019t lie. Down 18 lbs, my energy is through the roof, and I finally feel confident in the gym. Akeem knows exactly how to push you without burning you out.', es:'Al principio era esc\u00e9ptico pero los resultados no mienten. Baj\u00e9 18 lbs, mi energ\u00eda est\u00e1 por los cielos, y finalmente me siento seguro en el gimnasio. Akeem sabe exactamente c\u00f3mo empujarte sin quemarte.', pt:'No in\u00edcio era c\u00e9tico mas os resultados n\u00e3o mentem. Perdi 18 lbs, minha energia est\u00e1 nas alturas, e finalmente me sinto confiante na academia. Akeem sabe exatamente como te empurrar sem te esgotar.' },

// ═══ TRANSFORMATION ═══
'trans-lbl':       { en:'The Origin of the System', es:'El Origen del Sistema', pt:'A Origem do Sistema' },
'trans-section-h': { en:'The System <span class="y">Was Born Here</span>', es:'El Sistema <span class="y">Naci\u00f3 Aqu\u00ed</span>', pt:'O Sistema <span class="y">Nasceu Aqui</span>' },
'trans-sub':       { en:'Not theory. Not a textbook protocol. A system discovered through lived experience and refined through science.', es:'No es teor\u00eda. No es un protocolo de libro. Un sistema descubierto a trav\u00e9s de la experiencia vivida y refinado por la ciencia.', pt:'N\u00e3o \u00e9 teoria. N\u00e3o \u00e9 um protocolo de livro. Um sistema descoberto atrav\u00e9s da experi\u00eancia vivida e refinado pela ci\u00eancia.' },

// ═══ TRANSFORMATION — STORY PANELS ═══
'trans-step1':          { en:'STEP 1', es:'PASO 1', pt:'PASSO 1' },
'trans-step2':          { en:'STEP 2', es:'PASO 2', pt:'PASSO 2' },
'trans-step3':          { en:'STEP 3', es:'PASO 3', pt:'PASSO 3' },
'trans-card1-title':    { en:'The Starting Point', es:'El Punto de Partida', pt:'O Ponto de Partida' },
'trans-card1-quote':    { en:'\u201cLost. Depressed. No time for myself. Running out of chances to become who I knew I could be.\u201d', es:'\u201cPerdido. Deprimido. Sin tiempo para m\u00ed. Agotando las oportunidades de convertirme en quien sab\u00eda que pod\u00eda ser.\u201d', pt:'\u201cPerdido. Deprimido. Sem tempo para mim. Esgotando as chances de me tornar quem eu sabia que podia ser.\u201d' },
'trans-card2-title':    { en:'The System Discovery', es:'El Descubrimiento del Sistema', pt:'A Descoberta do Sistema' },
'trans-card2-quote':    { en:'\u201cI decided to go all in. NASM Certified. Exercise Science. The discipline to learn became as important as the discipline to train.\u201d', es:'\u201cDecid\u00ed ir con todo. Certificado NASM. Ciencias del Ejercicio. La disciplina de aprender se volvi\u00f3 tan importante como la disciplina de entrenar.\u201d', pt:'\u201cDecidi ir com tudo. Certificado NASM. Ci\u00eancias do Exerc\u00edcio. A disciplina de aprender se tornou t\u00e3o importante quanto a disciplina de treinar.\u201d' },
'trans-card3-title':    { en:'The Architecture Lives', es:'La Arquitectura Vive', pt:'A Arquitetura Vive' },
'trans-card3-quote':    { en:'\u201cOne decision changed everything. My body. My career. My family\u2019s future. Now that ripple reaches every client I coach.\u201d', es:'\u201cUna decisi\u00f3n lo cambi\u00f3 todo. Mi cuerpo. Mi carrera. El futuro de mi familia. Ahora esa onda alcanza a cada cliente que entreno.\u201d', pt:'\u201cUma decis\u00e3o mudou tudo. Meu corpo. Minha carreira. O futuro da minha fam\u00edlia. Agora essa onda alcança cada cliente que treino.\u201d' },
'trans-journey':        { en:'The Full Journey', es:'El Camino Completo', pt:'A Jornada Completa' },
'trans-narrative1':     { en:'I discovered these protocols while navigating the demands of 12-hour shifts and a family of four. I didn\u2019t build this from theory \u2014 I built it to solve the Human Habit Equation. The laboratory was my own life, and the results became the blueprint.', es:'Descubr\u00ed estos protocolos navegando las demandas de turnos de 12 horas y una familia de cuatro. No constru\u00ed esto desde la teor\u00eda \u2014 lo constru\u00ed para resolver la Ecuaci\u00f3n del H\u00e1bito Humano. El laboratorio fue mi propia vida, y los resultados se convirtieron en el plan maestro.', pt:'Descobri estes protocolos navegando as demandas de turnos de 12 horas e uma fam\u00edlia de quatro. N\u00e3o constru\u00ed isso a partir de teoria \u2014 constru\u00ed para resolver a Equa\u00e7\u00e3o do H\u00e1bito Humano. O laborat\u00f3rio foi minha pr\u00f3pria vida, e os resultados se tornaram o plano mestre.' },
'trans-narrative2':     { en:'Now I deliver that same blueprint to every human who refuses to let their schedule define their ceiling. <strong style="color:var(--wht)">The executive. The first responder. The parent. The everyday athlete.</strong> The system doesn\u2019t care about your title or your hours \u2014 it cares about your commitment.', es:'Ahora entrego ese mismo plan a cada ser humano que se niega a dejar que su horario defina su techo. <strong style="color:var(--wht)">El ejecutivo. El socorrista. El padre. El atleta cotidiano.</strong> Al sistema no le importa tu t\u00edtulo ni tus horas \u2014 le importa tu compromiso.', pt:'Agora entrego esse mesmo plano a cada ser humano que se recusa a deixar sua agenda definir seu teto. <strong style="color:var(--wht)">O executivo. O socorrista. O pai. O atleta do dia a dia.</strong> O sistema n\u00e3o se importa com seu t\u00edtulo ou suas horas \u2014 se importa com seu compromisso.' },
'trans-narrative3':     { en:'Build Believe Fit exists to deliver that system. <strong style="color:var(--yel)">Anchor habits become engine habits. Your context becomes your catalyst.</strong> No matter your schedule, your title, or your starting point \u2014 the architecture works when you commit to it.', es:'Build Believe Fit existe para entregar ese sistema. <strong style="color:var(--yel)">Los h\u00e1bitos ancla se convierten en h\u00e1bitos motor. Tu contexto se convierte en tu catalizador.</strong> Sin importar tu horario, tu t\u00edtulo o tu punto de partida \u2014 la arquitectura funciona cuando te comprometes.', pt:'Build Believe Fit existe para entregar esse sistema. <strong style="color:var(--yel)">H\u00e1bitos \u00e2ncora se tornam h\u00e1bitos motor. Seu contexto se torna seu catalisador.</strong> N\u00e3o importa sua agenda, seu t\u00edtulo ou seu ponto de partida \u2014 a arquitetura funciona quando voc\u00ea se compromete.' },
'trans-blockquote':     { en:'I Built The System For Myself. Then I Realized Every High-Demand Human Needed It Too.', es:'Constru\u00ed El Sistema Para M\u00ed Mismo. Luego Me Di Cuenta Que Cada Ser Humano De Alta Demanda Lo Necesitaba Tambi\u00e9n.', pt:'Constru\u00ed O Sistema Para Mim Mesmo. Ent\u00e3o Percebi Que Todo Ser Humano De Alta Demanda Precisava Dele Tamb\u00e9m.' },
'trans-cta':            { en:'Start Your Transformation \u2192', es:'Inicia Tu Transformaci\u00f3n \u2192', pt:'Inicie Sua Transforma\u00e7\u00e3o \u2192' },

// ═══ PATHFINDER ═══
'path-lbl':        { en:'Start Your Journey', es:'Inicia Tu Camino', pt:'Inicie Sua Jornada' },
'path-h':          { en:'The <span class="y">Pathfinder</span>', es:'El <span class="y">Pathfinder</span>', pt:'O <span class="y">Pathfinder</span>' },
'path-sub':        { en:'4 quick steps. We\u2019ll calculate your personalized targets and Akeem will reach out within 24 hours.', es:'4 pasos r\u00e1pidos. Calcularemos tus metas personalizadas y Akeem te contactar\u00e1 en 24 horas.', pt:'4 passos r\u00e1pidos. Calcularemos suas metas personalizadas e Akeem entrar\u00e1 em contato em 24 horas.' },
'path-s1-t':       { en:'Who Are You?', es:'\u00bfQui\u00e9n Eres?', pt:'Quem \u00c9 Voc\u00ea?' },
'path-s1-s':       { en:'Tell us about yourself \u2014 we\u2019ll personalize everything.', es:'Cu\u00e9ntanos sobre ti \u2014 personalizaremos todo.', pt:'Conte-nos sobre voc\u00ea \u2014 personalizaremos tudo.' },
'path-s2-t':       { en:'Your Stats', es:'Tus Datos', pt:'Seus Dados' },
'path-s2-s':       { en:'Used to calculate your personalized TDEE and calorie targets.', es:'Usados para calcular tu TDEE personalizado y metas cal\u00f3ricas.', pt:'Usados para calcular seu TDEE personalizado e metas cal\u00f3ricas.' },
'path-s3-t':       { en:'Your Goal', es:'Tu Objetivo', pt:'Seu Objetivo' },
'path-s3-s':       { en:'What are you training for?', es:'\u00bfPara qu\u00e9 entrenas?', pt:'Para que voc\u00ea treina?' },
'path-s4-t':       { en:'Final Details', es:'Detalles Finales', pt:'Detalhes Finais' },
'path-s4-s':       { en:'Almost there. This helps Akeem prepare before reaching out.', es:'Casi listo. Esto ayuda a Akeem a prepararse antes de contactarte.', pt:'Quase l\u00e1. Isso ajuda Akeem a se preparar antes de entrar em contato.' },
'path-submit':     { en:'Calculate My Path & Submit \u2192', es:'Calcular Mi Camino y Enviar \u2192', pt:'Calcular Meu Caminho e Enviar \u2192' },

// ═══ APP DOWNLOAD ═══
'app-lbl':         { en:'Client Portal', es:'Portal del Cliente', pt:'Portal do Cliente' },
'app-h':           { en:'Your Program. In Your <span class="y">Pocket.</span>', es:'Tu Programa. En Tu <span class="y">Bolsillo.</span>', pt:'Seu Programa. No Seu <span class="y">Bolso.</span>' },
'app-sub':         { en:'Access your personalized workout program, meal plan, progress tracking, and coach notes \u2014 all in one mobile app that works offline.', es:'Accede a tu programa de entrenamiento personalizado, plan alimenticio, seguimiento de progreso y notas del coach \u2014 todo en una app m\u00f3vil que funciona sin conexi\u00f3n.', pt:'Acesse seu programa de treino personalizado, plano alimentar, acompanhamento de progresso e notas do coach \u2014 tudo em um app m\u00f3vel que funciona offline.' },

// ═══ CONTACT ═══
'contact-h':       { en:'Let\u2019s Build. Today.', es:'Construyamos. Hoy.', pt:'Vamos Construir. Hoje.' },
'contact-sub':     { en:'Ready to start? Have questions? Reach out directly \u2014 Akeem responds fast.', es:'\u00bfListo para comenzar? \u00bfTienes preguntas? Contacta directamente \u2014 Akeem responde r\u00e1pido.', pt:'Pronto para come\u00e7ar? Tem perguntas? Entre em contato diretamente \u2014 Akeem responde r\u00e1pido.' },

// ═══ FOOTER ═══
'footer-tag':      { en:'Universal Human Performance Architecture. Elite coaching for the high-demand life. Built for real results.', es:'Arquitectura Universal de Rendimiento Humano. Coaching de \u00e9lite para la vida de alta demanda. Construido para resultados reales.', pt:'Arquitetura Universal de Performance Humana. Coaching de elite para a vida de alta demanda. Constru\u00eddo para resultados reais.' },
'footer-copy':     { en:'\u00a9 2026 Build Believe Fit LLC \u2022 All Rights Reserved \u2022 NASM Certified \u2022 buildbelievefit.fitness', es:'\u00a9 2026 Build Believe Fit LLC \u2022 Todos los Derechos Reservados \u2022 Certificado NASM \u2022 buildbelievefit.fitness', pt:'\u00a9 2026 Build Believe Fit LLC \u2022 Todos os Direitos Reservados \u2022 Certificado NASM \u2022 buildbelievefit.fitness' },

// ═══ BBF CLIENT APP (bbf-app.html) ═══
'app-splash-tag':       { en:'Elite Strength & Movement', es:'Fuerza & Movimiento de \u00c9lite', pt:'For\u00e7a & Movimento de Elite' },
'app-splash-enter':     { en:'ENTER \u2192', es:'ENTRAR \u2192', pt:'ENTRAR \u2192' },
'app-nav-home':         { en:'Home', es:'Inicio', pt:'In\u00edcio' },
'app-nav-program':      { en:'Program', es:'Programa', pt:'Programa' },
'app-nav-nutrition':    { en:'Nutrition', es:'Nutrici\u00f3n', pt:'Nutri\u00e7\u00e3o' },
'app-nav-log':          { en:'Log', es:'Registro', pt:'Registro' },
'app-nav-prehab':       { en:'Prehab', es:'Prehab', pt:'Prehab' },
'app-nav-book':         { en:'Book', es:'Reservar', pt:'Agendar' },
'app-nav-profile':      { en:'Profile', es:'Perfil', pt:'Perfil' },
'app-welcome':          { en:'Welcome back', es:'Bienvenido de vuelta', pt:'Bem-vindo de volta' },
'app-total-sessions':   { en:'Total Sessions', es:'Sesiones Totales', pt:'Sess\u00f5es Totais' },
'app-this-week':        { en:'This Week', es:'Esta Semana', pt:'Esta Semana' },
'app-current-weight':   { en:'Current Weight', es:'Peso Actual', pt:'Peso Atual' },
'app-today-focus':      { en:"Today's Focus", es:'Enfoque de Hoy', pt:'Foco de Hoje' },
'app-quick-actions':    { en:'Quick Actions', es:'Acciones R\u00e1pidas', pt:'A\u00e7\u00f5es R\u00e1pidas' },
'app-qa-plan':          { en:"Today's Plan", es:'Plan de Hoy', pt:'Plano de Hoje' },
'app-qa-plan-sub':      { en:'Follow your program', es:'Sigue tu programa', pt:'Siga seu programa' },
'app-qa-log':           { en:'Free Log', es:'Registro Libre', pt:'Registro Livre' },
'app-qa-log-sub':       { en:'Log any workout', es:'Registra cualquier sesi\u00f3n', pt:'Registre qualquer treino' },
'app-qa-nutrition':     { en:'Nutrition', es:'Nutrici\u00f3n', pt:'Nutri\u00e7\u00e3o' },
'app-qa-nutrition-sub': { en:'Your meal plan', es:'Tu plan alimenticio', pt:'Seu plano alimentar' },
'app-qa-progress':      { en:'My Progress', es:'Mi Progreso', pt:'Meu Progresso' },
'app-qa-progress-sub':  { en:'View stats', es:'Ver estad\u00edsticas', pt:'Ver estat\u00edsticas' },
'app-book-title':       { en:'Book a Session', es:'Reservar una Sesi\u00f3n', pt:'Agendar uma Sess\u00e3o' },
'app-book-sub':         { en:'Reach out to Akeem directly.', es:'Contacta a Akeem directamente.', pt:'Contacte Akeem diretamente.' },
'app-wo-title':         { en:"Today's Program", es:'Programa de Hoy', pt:'Programa de Hoje' },
'app-wo-sub':           { en:'Log your sets, reps & weight', es:'Registra tus series, reps y peso', pt:'Registre suas s\u00e9ries, reps e peso' },
'app-progress-title':   { en:'My Progress', es:'Mi Progreso', pt:'Meu Progresso' },
'app-progress-sub':     { en:'Track your fitness journey', es:'Sigue tu camino fitness', pt:'Acompanhe sua jornada fitness' },
'app-tab-overview':     { en:'Overview', es:'Resumen', pt:'Resumo' },
'app-tab-sessions':     { en:'Sessions', es:'Sesiones', pt:'Sess\u00f5es' },
'app-tab-strength':     { en:'Strength', es:'Fuerza', pt:'For\u00e7a' },
'app-tab-body':         { en:'Body', es:'Cuerpo', pt:'Corpo' },
'app-settings':         { en:'Settings', es:'Configuraci\u00f3n', pt:'Configura\u00e7\u00f5es' },
'app-set-goal':         { en:'My Goal', es:'Mi Objetivo', pt:'Meu Objetivo' },
'app-set-goal-sub':     { en:'Tap to set', es:'Toca para configurar', pt:'Toque para configurar' },
'app-set-profession':   { en:'My Profession / Schedule', es:'Mi Profesi\u00f3n / Horario', pt:'Minha Profiss\u00e3o / Hor\u00e1rio' },
'app-set-profession-sub': { en:'Tap to update', es:'Toca para actualizar', pt:'Toque para atualizar' },
'app-set-recovery':     { en:'Recovery Mode', es:'Modo de Recuperaci\u00f3n', pt:'Modo de Recupera\u00e7\u00e3o' },
'app-set-recovery-sub': { en:'Tap to set your recovery protocol', es:'Toca para configurar tu protocolo', pt:'Toque para configurar seu protocolo' },
'app-set-waiver':       { en:'Liability Waiver', es:'Exoneraci\u00f3n de Responsabilidad', pt:'Termo de Responsabilidade' },
'app-set-waiver-sub':   { en:'View & download PDF', es:'Ver y descargar PDF', pt:'Ver e baixar PDF' },
'app-set-signout':      { en:'Sign Out', es:'Cerrar Sesi\u00f3n', pt:'Sair' },
'app-set-signout-sub':  { en:'Log out of your account', es:'Cerrar tu cuenta', pt:'Sair da sua conta' },
'app-nutr-title':       { en:'Nutrition Plan', es:'Plan Nutricional', pt:'Plano Nutricional' },
'app-nutr-sub':         { en:'Your personalized 7-day meal plan', es:'Tu plan alimenticio personalizado de 7 d\u00edas', pt:'Seu plano alimentar personalizado de 7 dias' },
'app-log-title':        { en:'Log a Session', es:'Registrar una Sesi\u00f3n', pt:'Registrar uma Sess\u00e3o' },
'app-log-date':         { en:'Date', es:'Fecha', pt:'Data' },
'app-log-type':         { en:'Session Type', es:'Tipo de Sesi\u00f3n', pt:'Tipo de Sess\u00e3o' },
'app-log-duration':     { en:'Duration (mins)', es:'Duraci\u00f3n (min)', pt:'Dura\u00e7\u00e3o (min)' },
'app-log-intensity':    { en:'Intensity (1-10)', es:'Intensidad (1-10)', pt:'Intensidade (1-10)' },
'app-log-feel':         { en:'How did you feel?', es:'\u00bfC\u00f3mo te sentiste?', pt:'Como se sentiu?' },
'app-log-notes':        { en:'Notes', es:'Notas', pt:'Notas' },
'app-log-save':         { en:'Save Session \u2713', es:'Guardar Sesi\u00f3n \u2713', pt:'Salvar Sess\u00e3o \u2713' },
'app-prehab-title':     { en:'Prehab & Recovery', es:'Prehab & Recuperaci\u00f3n', pt:'Prehab & Recupera\u00e7\u00e3o' },
'app-prehab-sub':       { en:'OT-Informed joint health for high-demand athletes', es:'Salud articular con base en TO para atletas de alta demanda', pt:'Sa\u00fade articular com base em TO para atletas de alta demanda' },
'app-book-text':        { en:'Text to Book', es:'Enviar Mensaje', pt:'Enviar Mensagem' },
'app-book-call':        { en:'Call', es:'Llamar', pt:'Ligar' },
'app-an-alltime':       { en:'\ud83d\udcca All-Time Stats', es:'\ud83d\udcca Estad\u00edsticas Totales', pt:'\ud83d\udcca Estat\u00edsticas Gerais' },
'app-an-total':         { en:'Total Sessions', es:'Sesiones Totales', pt:'Sess\u00f5es Totais' },
'app-an-streak':        { en:'Day Streak', es:'Racha de D\u00edas', pt:'Sequ\u00eancia de Dias' },
'app-an-thisweek':      { en:'This Week', es:'Esta Semana', pt:'Esta Semana' },
'app-an-month':         { en:'This Month', es:'Este Mes', pt:'Este M\u00eas' },
'app-an-best':          { en:'Best Streak', es:'Mejor Racha', pt:'Melhor Sequ\u00eancia' },
'app-an-avg':           { en:'Avg/Week', es:'Prom/Semana', pt:'M\u00e9d/Semana' },
'app-an-last10':        { en:'\ud83d\udcc5 Last 10 Sessions', es:'\ud83d\udcc5 \u00daltimas 10 Sesiones', pt:'\ud83d\udcc5 \u00daltimas 10 Sess\u00f5es' },
'app-an-heatmap':       { en:'\ud83d\udd25 Activity Heatmap \u2014 Last 30 Days', es:'\ud83d\udd25 Mapa de Actividad \u2014 \u00daltimos 30 D\u00edas', pt:'\ud83d\udd25 Mapa de Atividade \u2014 \u00daltimos 30 Dias' },
'app-an-logged':        { en:'Logged', es:'Registrado', pt:'Registrado' },
'app-an-today':         { en:'Today', es:'Hoy', pt:'Hoje' },
'app-an-muscles':       { en:'\ud83d\udcaa Most Trained Muscle Groups', es:'\ud83d\udcaa Grupos Musculares M\u00e1s Entrenados', pt:'\ud83d\udcaa Grupos Musculares Mais Treinados' },
'app-an-history':       { en:'\ud83d\udccb Session History', es:'\ud83d\udccb Historial de Sesiones', pt:'\ud83d\udccb Hist\u00f3rico de Sess\u00f5es' },
'app-an-strength':      { en:'\ud83c\udfcb Workout Log Progress', es:'\ud83c\udfcb Progreso de Entrenamiento', pt:'\ud83c\udfcb Progresso de Treino' },
'app-an-weight':        { en:'\u2696\ufe0f Weight Progress', es:'\u2696\ufe0f Progreso de Peso', pt:'\u2696\ufe0f Progresso de Peso' },
'app-an-current':       { en:'Current', es:'Actual', pt:'Atual' },
'app-an-starting':      { en:'Starting', es:'Inicial', pt:'Inicial' },
'app-an-change':        { en:'Change', es:'Cambio', pt:'Mudan\u00e7a' },
'app-an-bodyfat':       { en:'\ud83d\udcc8 Body Fat % History', es:'\ud83d\udcc8 Historial de % Grasa', pt:'\ud83d\udcc8 Hist\u00f3rico de % Gordura' },
'app-an-logmetrics':    { en:'\ud83e\uddae Log Body Metrics', es:'\ud83e\uddae Registrar M\u00e9tricas Corporales', pt:'\ud83e\uddae Registrar M\u00e9tricas Corporais' },
'app-an-savemetrics':   { en:'Save Metrics', es:'Guardar M\u00e9tricas', pt:'Salvar M\u00e9tricas' },
'app-coach-notes':      { en:'\ud83d\udccb Coach Notes', es:'\ud83d\udccb Notas del Coach', pt:'\ud83d\udccb Notas do Coach' },
'app-add-note':         { en:'Add Coach Note', es:'Agregar Nota del Coach', pt:'Adicionar Nota do Coach' },
'app-save-note':        { en:'Save Note', es:'Guardar Nota', pt:'Salvar Nota' },
'app-recent-sessions':  { en:'Recent Sessions', es:'Sesiones Recientes', pt:'Sess\u00f5es Recentes' },
'app-wo-noprogram':     { en:'No Program', es:'Sin Programa', pt:'Sem Programa' },
'app-wo-noprogram-sub': { en:'Akeem will assign your workout plan.', es:'Akeem te asignar\u00e1 tu plan de entrenamiento.', pt:'Akeem vai atribuir seu plano de treino.' },
'app-wo-restday':       { en:'Rest Day', es:'D\u00eda de Descanso', pt:'Dia de Descanso' },
'app-wo-restrecover':   { en:'Rest & Recover', es:'Descanso & Recuperaci\u00f3n', pt:'Descanso & Recupera\u00e7\u00e3o' },
'app-wo-restdefault':   { en:'Active recovery, stretch, hydrate.', es:'Recuperaci\u00f3n activa, estira, hidrata.', pt:'Recupera\u00e7\u00e3o ativa, alongue, hidrate.' },
'app-wo-exercises':     { en:'exercises', es:'ejercicios', pt:'exerc\u00edcios' },
'app-wo-set':           { en:'Set', es:'Serie', pt:'S\u00e9rie' },
'app-wo-target':        { en:'Target', es:'Meta', pt:'Meta' },
'app-wo-repsdone':      { en:'Reps Done', es:'Reps Hechas', pt:'Reps Feitas' },
'app-wo-weightlbs':     { en:'Weight (lbs)', es:'Peso (lbs)', pt:'Peso (lbs)' },
'app-wo-complete':      { en:'Mark Session Complete', es:'Marcar Sesi\u00f3n Completada', pt:'Marcar Sess\u00e3o Conclu\u00edda' },
'app-nutr-noplan':      { en:'No meal plan assigned yet', es:'Sin plan alimenticio asignado', pt:'Nenhum plano alimentar atribu\u00eddo' },
'app-nutr-contact':     { en:'Contact Akeem to get your plan set up.', es:'Contacta a Akeem para configurar tu plan.', pt:'Contacte Akeem para configurar seu plano.' },
'app-victory-title':    { en:'CRUSHED IT!', es:'\u00a1LO LOGRASTE!', pt:'ARRASOU!' },
'app-victory-complete': { en:'Complete', es:'Completado', pt:'Conclu\u00eddo' },
'app-victory-great':    { en:'Great work!', es:'\u00a1Gran trabajo!', pt:'\u00d3timo trabalho!' }
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
  // Index.html toggles (desktop + mobile)
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
  // bbf-app.html toggle (rendered into #bbf-lang-placeholder)
  var placeholder = document.getElementById('bbf-lang-placeholder');
  if (placeholder) {
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
