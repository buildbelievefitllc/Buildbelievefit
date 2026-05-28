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
'hero-badge':      { en:'Performance Architect \u2022 Sovereign Gold Standard', es:'Arquitecto de Rendimiento \u2022 Est\u00e1ndar Soberano de Oro', pt:'Arquiteto de Performance \u2022 Padr\u00e3o Soberano de Ouro' },
'hero-sub':        { en:'Universal performance for the <strong>high-demand human.</strong> We optimize the habit architecture of everyday athletes, executives, and first responders. <strong>Your schedule is the context. Your potential is the focus.</strong>', es:'Rendimiento universal para el <strong>ser humano de alta demanda.</strong> Optimizamos la arquitectura de hábitos de atletas cotidianos, ejecutivos y socorristas. <strong>Tu horario es el contexto. Tu potencial es el enfoque.</strong>', pt:'Performance universal para o <strong>ser humano de alta demanda.</strong> Otimizamos a arquitetura de hábitos de atletas do dia a dia, executivos e socorristas. <strong>Sua agenda é o contexto. Seu potencial é o foco.</strong>' },
'hero-cta':        { en:'Start My Path', es:'Iniciar Mi Camino', pt:'Iniciar Meu Caminho' },
'hero-portal':     { en:'Client Portal', es:'Portal del Cliente', pt:'Portal do Cliente' },
'hero-accent':     { en:'ELITE STRENGTH & MOVEMENT', es:'FUERZA & MOVIMIENTO DE \u00c9LITE', pt:'FOR\u00c7A & MOVIMENTO DE ELITE' },
'stat-clients':    { en:'Est. \u2022 Founded', es:'Est. \u2022 Fundado', pt:'Est. \u2022 Fundado em' },
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
'cred-t1':         { en:'Movement Specialist', es:'Especialista en Movimiento', pt:'Especialista em Movimento' },
'cred-s1':         { en:'OT-Focused Coaching \u2014 Exercise Science', es:'Entrenamiento con Enfoque en TO \u2014 Ciencias del Ejercicio', pt:'Treinamento com Foco em TO \u2014 Ci\u00eancias do Exerc\u00edcio' },
'cred-t2':         { en:'Joint Protection & Prehab Architect', es:'Arquitecto de Protecci\u00f3n Articular y Prehab', pt:'Arquiteto de Prote\u00e7\u00e3o Articular e Prehab' },
'cred-s2':         { en:'Human Performance Architect \u2022 Habit System Designer', es:'Arquitecto de Rendimiento Humano \u2022 Dise\u00f1ador de Sistemas de H\u00e1bitos', pt:'Arquiteto de Performance Humana \u2022 Designer de Sistemas de H\u00e1bitos' },
'cred-t3':         { en:'Fitness Enthusiast & Lifter', es:'Entusiasta del Fitness & Levantador', pt:'Entusiasta de Fitness & Levantador' },
'cred-s3':         { en:'Dedicated to the craft of human performance', es:'Dedicado al arte del rendimiento humano', pt:'Dedicado \u00e0 arte da performance humana' },
'cred-t4':         { en:'Business & Marketing Student', es:'Estudiante de Negocios & Marketing', pt:'Estudante de Neg\u00f3cios & Marketing' },
'cred-s4':         { en:'Chandler-Gilbert Community College', es:'Chandler-Gilbert Community College', pt:'Chandler-Gilbert Community College' },
'cred-t5':         { en:'Father of 4', es:'Padre de 4', pt:'Pai de 4' },
'cred-s5':         { en:'Coaches his son who plays football', es:'Entrena a su hijo que juega f\u00fatbol americano', pt:'Treina seu filho que joga futebol americano' },
'founder-p1':      { en:'I built these protocols as a father and everyday athlete protecting my own joints through real life \u2014 not from a textbook. That environment didn\u2019t limit me. It revealed the system. My life became the proving ground for every protocol I now deliver.', es:'Constru\u00ed estos protocolos como padre y atleta cotidiano protegiendo mis propias articulaciones a trav\u00e9s de la vida real \u2014 no desde un libro de texto. Ese entorno no me limit\u00f3. Revel\u00f3 el sistema. Mi vida se convirti\u00f3 en el campo de pruebas de cada protocolo que ahora entrego.', pt:'Constru\u00ed estes protocolos como pai e atleta cotidiano protegendo minhas pr\u00f3prias articula\u00e7\u00f5es atrav\u00e9s da vida real \u2014 n\u00e3o de um livro did\u00e1tico. Esse ambiente n\u00e3o me limitou. Revelou o sistema. Minha vida se tornou o campo de provas de cada protocolo que agora entrego.' },
'founder-p2':      { en:'Build Believe Fit was born between obligations \u2014 in the windows of time most people overlook. I\u2019m a <strong>Performance Architect, a passionate lifter, a father of 4</strong>, and an Exercise Science student becoming an Occupational Therapist. I understand the human body and the human schedule. That\u2019s the biomechanical precision that makes this system work.', es:'Build Believe Fit naci\u00f3 entre obligaciones \u2014 en las ventanas de tiempo que la mayor\u00eda ignora. Soy un <strong>Arquitecto de Rendimiento, un levantador apasionado, padre de 4</strong>, y estudiante de Ciencias del Ejercicio convirti\u00e9ndome en Terapeuta Ocupacional. Entiendo el cuerpo humano y el horario humano. Esa es la precisi\u00f3n biomec\u00e1nica que hace funcionar este sistema.', pt:'Build Believe Fit nasceu entre obriga\u00e7\u00f5es \u2014 nas janelas de tempo que a maioria ignora. Sou um <strong>Arquiteto de Performance, levantador apaixonado, pai de 4</strong>, e estudante de Ci\u00eancias do Exerc\u00edcio tornando-me Terapeuta Ocupacional. Entendo o corpo humano e a agenda humana. Essa \u00e9 a precis\u00e3o biomec\u00e2nica que faz este sistema funcionar.' },
'founder-p3':      { en:'My clients aren\u2019t defined by their occupation. They\u2019re defined by their refusal to let their schedule become their ceiling. <strong>Executives. First responders. Parents. Everyday athletes.</strong> Every one of them runs on the same system because human performance architecture doesn\u2019t discriminate.', es:'Mis clientes no se definen por su ocupaci\u00f3n. Se definen por su negativa a dejar que su horario se convierta en su techo. <strong>Ejecutivos. Socorristas. Padres. Atletas cotidianos.</strong> Todos funcionan con el mismo sistema porque la arquitectura de rendimiento humano no discrimina.', pt:'Meus clientes n\u00e3o s\u00e3o definidos pela ocupa\u00e7\u00e3o. S\u00e3o definidos pela recusa em deixar sua agenda se tornar seu teto. <strong>Executivos. Socorristas. Pais. Atletas do dia a dia.</strong> Todos funcionam no mesmo sistema porque a arquitetura de performance humana n\u00e3o discrimina.' },
'founder-adv-title': { en:'The System Advantage:', es:'La Ventaja del Sistema:', pt:'A Vantagem do Sistema:' },
'founder-adv-text': { en:'My occupational therapy education and exercise science training allow me to engineer performance systems around your actual life \u2014 your schedule, your recovery, your joint health, and your long-term mobility. This is human performance architecture. Not just training.', es:'Mi educaci\u00f3n en terapia ocupacional y ciencias del ejercicio me permiten dise\u00f1ar sistemas de rendimiento alrededor de tu vida real \u2014 tu horario, tu recuperaci\u00f3n, tu salud articular y tu movilidad a largo plazo. Esto es arquitectura de rendimiento humano. No solo entrenamiento.', pt:'Minha educa\u00e7\u00e3o em terapia ocupacional e ci\u00eancias do exerc\u00edcio me permitem projetar sistemas de performance ao redor da sua vida real \u2014 sua agenda, sua recupera\u00e7\u00e3o, sua sa\u00fade articular e sua mobilidade a longo prazo. Isto \u00e9 arquitetura de performance humana. N\u00e3o apenas treino.' },
'founder-sig':     { en:'\u2014 Akeem Brown', es:'\u2014 Akeem Brown', pt:'\u2014 Akeem Brown' },

// ═══ PROGRAMS ═══
'prog-lbl':        { en:'Choose Your Path', es:'Elige Tu Camino', pt:'Escolha Seu Caminho' },
'prog-h':          { en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">\u00c9xito</span>', pt:'Espectro do <span class="y">Sucesso</span>' },
'prog-section-sub': { en:'We respect every dollar you invest. Whether it\u2019s $67/month or a $1,197 flat-fee Apex Protocol, you receive a clinical, OT-informed return backed by the same system that produced Founder-Verified Biomechanical Protocols.', es:'Respetamos cada d\u00f3lar que inviertes. Sea $67/mes o un Protocolo Apex de tarifa \u00fanica de $1,197, recibes un retorno cl\u00ednico respaldado por el mismo sistema que produjo Protocolos Biomec\u00e1nicos Verificados por el Fundador.', pt:'Respeitamos cada d\u00f3lar que voc\u00ea investe. Seja $67/m\u00eas ou um Protocolo Apex de taxa \u00fanica de $1,197, voc\u00ea recebe um retorno cl\u00ednico respaldado pelo mesmo sistema que produziu Protocolos Biomec\u00e1nicos Verificados por el Fundador.' },
'prog-t1-tier':    { en:'Gateway Tier', es:'Nivel Gateway', pt:'N\u00edvel Gateway' },
'prog-t1-name':    { en:'Gateway', es:'Gateway', pt:'Gateway' },
'prog-t1-price':   { en:'$67 /mo', es:'$67 /mes', pt:'$67 /m\u00eas' },
'prog-t1-cta':     { en:'Start Gateway \u2192', es:'Comienza Gateway \u2192', pt:'Comece Gateway \u2192' },
'prog-t2-tier':    { en:'Flagship Program', es:'Programa Insignia', pt:'Programa Principal' },
'prog-t2-name':    { en:'Architect Hybrid', es:'Architect Hybrid', pt:'Architect Hybrid' },
'prog-t2-price':   { en:'$697 Flat Fee / 12-Week Protocol', es:'$697 Tarifa \u00danica / Protocolo de 12 Semanas', pt:'$697 Taxa \u00danica / Protocolo de 12 Semanas' },
'prog-t2-cta':     { en:'Start Architect Hybrid \u2192', es:'Iniciar Architect Hybrid \u2192', pt:'Iniciar Architect Hybrid \u2192' },
'prog-t3-tier':    { en:'Executive & Clinical', es:'Ejecutivo & Cl\u00ednico', pt:'Executivo & Cl\u00ednico' },
'prog-t3-name':    { en:'Sovereign', es:'Sovereign', pt:'Sovereign' },
'prog-t3-price':   { en:'$1,197 Flat Fee / 12-Week Apex Protocol', es:'$1,197 Tarifa \u00danica / Protocolo Apex de 12 Semanas', pt:'$1,197 Taxa \u00danica / Protocolo Apex de 12 Semanas' },
'prog-t3-cta':     { en:'Apply for Sovereign \u2192', es:'Solicitar Sovereign \u2192', pt:'Solicitar Sovereign \u2192' },

// ═══ NUTRITION ═══
'nut-lbl':         { en:'Nutrition Coaching', es:'Coaching Nutricional', pt:'Coaching Nutricional' },
'nut-h':           { en:'Fuel The <span class="y">Right Way</span>', es:'Alimenta De La <span class="y">Forma Correcta</span>', pt:'Alimente Da <span class="y">Forma Certa</span>' },
'nut-sub':         { en:'Precision nutrition architecture. Personalized meal plans aligned with your training, metabolic profile, and the demands of your schedule.', es:'Arquitectura nutricional de precisi\u00f3n. Planes alimenticios personalizados alineados con tu entrenamiento, perfil metab\u00f3lico y las demandas de tu horario.', pt:'Arquitetura nutricional de precis\u00e3o. Planos alimentares personalizados alinhados com seu treino, perfil metab\u00f3lico e as demandas da sua agenda.' },
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
'trans-card2-quote':    { en:'\u201cI decided to go all in. Exercise Science. Biomechanical Precision. The discipline to learn the math became as important as the discipline to train.\u201d', es:'\u201cDecid\u00ed ir con todo. Ciencias del Ejercicio. Precisi\u00f3n Biomec\u00e1nica. La disciplina de aprender la matem\u00e1tica se volvi\u00f3 tan importante como la disciplina de entrenar.\u201d', pt:'\u201cDecidi ir com tudo. Ci\u00eancias do Exerc\u00edcio. Precis\u00e3o Biomec\u00e2nica. A disciplina de aprender a matem\u00e1tica se tornou t\u00e3o importante quanto a disciplina de treinar.\u201d' },
'trans-card3-title':    { en:'The Architecture Lives', es:'La Arquitectura Vive', pt:'A Arquitetura Vive' },
'trans-card3-quote':    { en:'\u201cOne decision changed everything. My body. My career. My family\u2019s future. Now that ripple reaches every client I coach.\u201d', es:'\u201cUna decisi\u00f3n lo cambi\u00f3 todo. Mi cuerpo. Mi carrera. El futuro de mi familia. Ahora esa onda alcanza a cada cliente que entreno.\u201d', pt:'\u201cUma decis\u00e3o mudou tudo. Meu corpo. Minha carreira. O futuro da minha fam\u00edlia. Agora essa onda alcança cada cliente que treino.\u201d' },
'trans-journey':        { en:'The Full Journey', es:'El Camino Completo', pt:'A Jornada Completa' },
'trans-narrative1':     { en:'I built these protocols as a father and everyday athlete protecting my own joints through real life \u2014 not from a textbook. I didn\u2019t build this from theory \u2014 I built it to solve the Human Habit Equation. The laboratory was my own life, and the results became the blueprint.', es:'Constru\u00ed estos protocolos como padre y atleta cotidiano protegiendo mis propias articulaciones a trav\u00e9s de la vida real \u2014 no desde un libro de texto. No constru\u00ed esto desde la teor\u00eda \u2014 lo constru\u00ed para resolver la Ecuaci\u00f3n del H\u00e1bito Humano. El laboratorio fue mi propia vida, y los resultados se convirtieron en el plan maestro.', pt:'Constru\u00ed estes protocolos como pai e atleta cotidiano protegendo minhas pr\u00f3prias articula\u00e7\u00f5es atrav\u00e9s da vida real \u2014 n\u00e3o de um livro did\u00e1tico. N\u00e3o constru\u00ed isso a partir de teoria \u2014 constru\u00ed para resolver a Equa\u00e7\u00e3o do H\u00e1bito Humano. O laborat\u00f3rio foi minha pr\u00f3pria vida, e os resultados se tornaram o plano mestre.' },
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
'footer-tag':      { en:'Sovereign Performance Architecture. Metabolic efficiency for executives, first responders, and high-demand parents. Founder-Verified Protocols.', es:'Arquitectura Soberana de Rendimiento. Eficiencia metab\u00f3lica para ejecutivos, socorristas y padres de alta demanda. Protocolos Verificados por el Fundador.', pt:'Arquitetura Soberana de Performance. Efici\u00eancia metab\u00f3lica para executivos, socorristas e pais de alta demanda. Protocolos Verificados pelo Fundador.' },
'footer-copy':     { en:'\u00a9 2021\u20132026 Build Believe Fit LLC \u2022 Est. 2021 \u2022 Performance Architecture & Movement Science \u2022 buildbelievefit.fitness', es:'\u00a9 2021\u20132026 Build Believe Fit LLC \u2022 Est. 2021 \u2022 Arquitectura de Rendimiento & Ciencia del Movimiento \u2022 buildbelievefit.fitness', pt:'\u00a9 2021\u20132026 Build Believe Fit LLC \u2022 Fundado em 2021 \u2022 Arquitetura de Performance & Ci\u00eancia do Movimento \u2022 buildbelievefit.fitness' },

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
'app-qa-log-sub':       { en:'Log any Clinical Protocol', es:'Registra cualquier sesi\u00f3n', pt:'Registre qualquer treino' },
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
'app-an-strength':      { en:'\ud83c\udfcb Clinical Protocol Log', es:'\ud83c\udfcb Progreso de Entrenamiento', pt:'\ud83c\udfcb Progresso de Treino' },
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
'app-victory-great':    { en:'Great work!', es:'\u00a1Gran trabajo!', pt:'\u00d3timo trabalho!' },

// ═══ BUSY PARENT TRANSFORMATION ═══
'bpt-stamp':        { en:'Build Believe Fit LLC \u00b7 Family Performance Series', es:'Build Believe Fit LLC \u00b7 Serie de Rendimiento Familiar', pt:'Build Believe Fit LLC \u00b7 S\u00e9rie de Performance Familiar' },
'bpt-h1':           { en:'The Busy<br><span>Parent</span><br>Transformation', es:'La Transformaci\u00f3n<br>del <span>Padre</span><br>Ocupado', pt:'A Transforma\u00e7\u00e3o<br>do <span>Pai</span><br>Ocupado' },
'bpt-sub':          { en:'Elite Fitness Engineered for the Fullest Life', es:'Fitness de \u00c9lite Dise\u00f1ado para la Vida M\u00e1s Plena', pt:'Fitness de Elite Projetado para a Vida Mais Plena' },
'bpt-lead':         { en:'You are running kids to practice, managing a household, holding down a career, and somewhere in between all of it \u2014 <strong>you lost yourself in the schedule.</strong> This is how you take that back without dropping a single ball.', es:'Llevas ni\u00f1os a entrenar, manejas un hogar, mantienes una carrera, y en alg\u00fan punto \u2014 <strong>te perdiste en el horario.</strong> As\u00ed es como lo recuperas sin soltar ninguna responsabilidad.', pt:'Voc\u00ea leva crian\u00e7as para treinar, gerencia um lar, mant\u00e9m uma carreira, e em algum ponto \u2014 <strong>voc\u00ea se perdeu na agenda.</strong> \u00c9 assim que voc\u00ea recupera isso sem largar nenhuma responsabilidade.' },
'bpt-cta':          { en:'Claim Your Copy \u2014 $147', es:'Obt\u00e9n Tu Copia \u2014 $147', pt:'Garanta Sua C\u00f3pia \u2014 $147' },
'bpt-ghost':        { en:'See What\u2019s Inside \u2193', es:'Ver Contenido \u2193', pt:'Ver Conte\u00fado \u2193' },
'bpt-pain-tag':     { en:'Sound Familiar?', es:'\u00bfTe Suena Familiar?', pt:'Parece Familiar?' },
'bpt-pain-h':       { en:'Your Schedule Is<br><span class="yellow">Running You</span>', es:'Tu Horario Te Est\u00e1<br><span class="yellow">Controlando</span>', pt:'Sua Agenda Est\u00e1<br><span class="yellow">Te Controlando</span>' },
'bpt-pain-sub':     { en:'The fitness industry was designed for people without kids, without car pools, and without a second full-time job called parenting. This program was not.', es:'La industria del fitness fue dise\u00f1ada para personas sin hijos, sin viajes compartidos y sin un segundo trabajo llamado crianza. Este programa no.', pt:'A ind\u00fastria fitness foi projetada para pessoas sem filhos, sem caronas e sem um segundo trabalho chamado pater/maternidade. Este programa n\u00e3o.' },
'bpt-guide-tag':    { en:'Inside the Guide', es:'Dentro de la Gu\u00eda', pt:'Dentro do Guia' },
'bpt-guide-h':      { en:'Everything Built<br><span class="yellow">Around Your Life,</span><br>Not Despite It', es:'Todo Construido<br><span class="yellow">Alrededor de Tu Vida,</span><br>No a Pesar de Ella', pt:'Tudo Constru\u00eddo<br><span class="yellow">Ao Redor da Sua Vida,</span><br>N\u00e3o Apesar Dela' },
'bpt-guide-sub':    { en:'No 5am wake-up mandates. No 2-hour sessions. No meal-prep Sundays that require a second kitchen. Just an intelligent system that fits inside the life you already have.', es:'Sin mandatos de despertar a las 5am. Sin sesiones de 2 horas. Sin domingos de preparaci\u00f3n que requieren una segunda cocina. Solo un sistema inteligente que cabe en la vida que ya tienes.', pt:'Sem obriga\u00e7\u00e3o de acordar \u00e0s 5h. Sem sess\u00f5es de 2 horas. Sem domingos de prepara\u00e7\u00e3o que exigem uma segunda cozinha. Apenas um sistema inteligente que cabe na vida que voc\u00ea j\u00e1 tem.' },
'bpt-prog-tag':     { en:'The 4-Week Blueprint', es:'El Plan de 4 Semanas', pt:'O Plano de 4 Semanas' },
'bpt-prog-h':       { en:'One Month.<br><span class="yellow">Four Phases.</span><br>Zero Fluff.', es:'Un Mes.<br><span class="yellow">Cuatro Fases.</span><br>Cero Relleno.', pt:'Um M\u00eas.<br><span class="yellow">Quatro Fases.</span><br>Zero Enrola\u00e7\u00e3o.' },
'bpt-split-tag':    { en:'3-Day Minimum Effective Dose Split (Split MED de 3 D\u00edas / Split MED de 3 Dias)', es:'Split MED de 3 D\u00edas \u2014 Dosis M\u00ednima Efectiva', pt:'Split MED de 3 Dias \u2014 Dose M\u00ednima Efetiva' },
'bpt-split-h':      { en:'Three Sessions.<br><span class="yellow">Every Muscle.</span><br>Under 60 Minutes.', es:'Tres Sesiones.<br><span class="yellow">Cada M\u00fasculo.</span><br>Menos de 60 Minutos.', pt:'Tr\u00eas Sess\u00f5es.<br><span class="yellow">Cada M\u00fasculo.</span><br>Menos de 60 Minutos.' },
'bpt-if-tag':       { en:'Nutrition Protocol (Protocolo Nutricional)', es:'Protocolo Nutricional', pt:'Protocolo Nutricional' },
'bpt-if-h':         { en:'16/8 Designed for<br><span class="yellow">Real Mornings,</span><br>Not Instagram Ones', es:'16/8 Dise\u00f1ado para<br><span class="yellow">Ma\u00f1anas Reales,</span><br>No de Instagram', pt:'16/8 Projetado para<br><span class="yellow">Manh\u00e3s Reais,</span><br>N\u00e3o de Instagram' },
'bpt-mind-tag':     { en:'The Psychology', es:'La Psicolog\u00eda', pt:'A Psicologia' },
'bpt-mind-h':       { en:'The Caregiver<br>Mindset', es:'La Mentalidad<br>del Cuidador', pt:'A Mentalidade<br>do Cuidador' },
'bpt-mind-quote':   { en:'\u201cYou cannot pour from an empty cup. But nobody told you that rebuilding the cup is part of the job description.\u201d', es:'\u201cNo puedes servir de una taza vac\u00eda. Pero nadie te dijo que reconstruir la taza es parte de la descripci\u00f3n del trabajo.\u201d', pt:'\u201cVoc\u00ea n\u00e3o pode servir de um copo vazio. Mas ningu\u00e9m te disse que reconstruir o copo faz parte da descri\u00e7\u00e3o do trabalho.\u201d' },
'bpt-proof-tag':    { en:'From Parents Who Did It', es:'De Padres Que Lo Lograron', pt:'De Pais Que Conseguiram' },
'bpt-proof-h':      { en:'Real Schedules.<br><span class="yellow">Real Results.</span><br>Real Families.', es:'Horarios Reales.<br><span class="yellow">Resultados Reales.</span><br>Familias Reales.', pt:'Agendas Reais.<br><span class="yellow">Resultados Reais.</span><br>Fam\u00edlias Reais.' },
'bpt-del-tag':      { en:'What\u2019s Included', es:'Qu\u00e9 Incluye', pt:'O Que Inclui' },
'bpt-del-h':        { en:'Everything You<br><span class="yellow">Actually Need.</span><br>Nothing You Don\u2019t.', es:'Todo Lo Que<br><span class="yellow">Realmente Necesitas.</span><br>Nada Que No.', pt:'Tudo Que Voc\u00ea<br><span class="yellow">Realmente Precisa.</span><br>Nada Que N\u00e3o.' },
'bpt-purchase-h':   { en:'Your Schedule Is<br>Not an Excuse<br><span class="yellow">Anymore.</span>', es:'Tu Horario Ya<br>No Es una Excusa<br><span class="yellow">M\u00e1s.</span>', pt:'Sua Agenda N\u00e3o<br>\u00c9 Mais uma Desculpa<br><span class="yellow">Agora.</span>' },
'bpt-faq-tag':      { en:'FAQ', es:'Preguntas Frecuentes', pt:'Perguntas Frequentes' },
'bpt-faq-h':        { en:'Questions<br><span class="yellow">Parents Ask</span>', es:'Preguntas Que<br><span class="yellow">Hacen los Padres</span>', pt:'Perguntas Que<br><span class="yellow">os Pais Fazem</span>' },

// ═══ PAYMENT SUCCESS ═══
'ps-badge':         { en:'TRANSACTION VERIFIED', es:'TRANSACCI\u00d3N VERIFICADA', pt:'TRANSA\u00c7\u00c3O VERIFICADA' },
'ps-h1':            { en:'Welcome to<br>the <span>Laboratory.</span>', es:'Bienvenido al<br><span>Laboratorio.</span>', pt:'Bem-vindo ao<br><span>Laborat\u00f3rio.</span>' },
'ps-sub':           { en:'Your investment is confirmed. The system is now yours. Check your email for your Day 1 Roadmap and full access credentials.', es:'Tu inversi\u00f3n est\u00e1 confirmada. El sistema ahora es tuyo. Revisa tu email para tu Hoja de Ruta del D\u00eda 1 y credenciales de acceso.', pt:'Seu investimento est\u00e1 confirmado. O sistema agora \u00e9 seu. Verifique seu email para seu Roteiro do Dia 1 e credenciais de acesso.' },
'ps-anchor-lbl':    { en:'THE SOVEREIGN GOLD STANDARD', es:'EL EST\u00c1NDAR SOBERANO DE ORO', pt:'O PADR\u00c3O SOBERANO DE OURO' },
'ps-anchor-msg':    { en:'You are now training with the same system I used to reach <strong>the Sovereign Gold Standard of performance.</strong> This isn\u2019t a template \u2014 it\u2019s the architecture that changed my body, my career, and my family\u2019s future. <strong>Now it\u2019s yours. Let\u2019s work.</strong>', es:'Ahora est\u00e1s entrenando con el mismo sistema que us\u00e9 para llegar a <strong>el Est\u00e1ndar Soberano de Oro del rendimiento.</strong> Esto no es una plantilla \u2014 es la arquitectura que cambi\u00f3 mi cuerpo, mi carrera y el futuro de mi familia. <strong>Ahora es tuyo. A trabajar.</strong>', pt:'Agora voc\u00ea est\u00e1 treinando com o mesmo sistema que usei para chegar a <strong>o Padr\u00e3o Soberano de Ouro da performance.</strong> Isso n\u00e3o \u00e9 um modelo \u2014 \u00e9 a arquitetura que mudou meu corpo, minha carreira e o futuro da minha fam\u00edlia. <strong>Agora \u00e9 seu. Vamos trabalhar.</strong>' },
'ps-steps-t':       { en:'WHAT HAPPENS NEXT', es:'QU\u00c9 SIGUE', pt:'O QUE ACONTECE AGORA' },
'ps-step1':         { en:'<strong>Email confirmation</strong> \u2014 Your receipt and access credentials are being sent now. Check your inbox (and spam).', es:'<strong>Confirmaci\u00f3n por email</strong> \u2014 Tu recibo y credenciales de acceso se est\u00e1n enviando ahora. Revisa tu bandeja (y spam).', pt:'<strong>Confirma\u00e7\u00e3o por email</strong> \u2014 Seu recibo e credenciais de acesso est\u00e3o sendo enviados agora. Verifique sua caixa (e spam).' },
'ps-step2':         { en:'<strong>Day 1 Roadmap</strong> \u2014 Akeem sends your personalized starting plan within 24 hours.', es:'<strong>Hoja de Ruta del D\u00eda 1</strong> \u2014 Akeem env\u00eda tu plan personalizado en 24 horas.', pt:'<strong>Roteiro do Dia 1</strong> \u2014 Akeem envia seu plano personalizado em 24 horas.' },
'ps-step3':         { en:'<strong>App access</strong> \u2014 Open the BBF Client App to start logging workouts immediately.', es:'<strong>Acceso a la app</strong> \u2014 Abre la app BBF para comenzar a registrar entrenamientos de inmediato.', pt:'<strong>Acesso ao app</strong> \u2014 Abra o app BBF para come\u00e7ar a registrar treinos imediatamente.' },
'ps-countdown':     { en:'REDIRECTING TO YOUR DASHBOARD IN', es:'REDIRIGIENDO A TU PANEL EN', pt:'REDIRECIONANDO PARA SEU PAINEL EM' },
'ps-cta':           { en:'\ud83d\udcf2 OPEN CLIENT APP NOW', es:'\ud83d\udcf2 ABRIR APP AHORA', pt:'\ud83d\udcf2 ABRIR APP AGORA' },
'ps-note':          { en:'Questions? Text Akeem at <strong>623-340-9254</strong> or email through buildbelievefit.fitness.', es:'\u00bfPreguntas? Env\u00eda un mensaje a Akeem al <strong>623-340-9254</strong> o por email en buildbelievefit.fitness.', pt:'Perguntas? Envie mensagem para Akeem no <strong>623-340-9254</strong> ou por email em buildbelievefit.fitness.' },
'ps-download':      { en:'\ud83d\udce5 DOWNLOAD BLUEPRINT', es:'\ud83d\udce5 DESCARGAR PLAN', pt:'\ud83d\udce5 BAIXAR PLANO' },

// ═══ READINESS ENGINE ═══
'app-ready-title':      { en:'\ud83e\uddea Morning Lab Audit', es:'\ud83e\uddea Auditor\u00eda Matutina del Laboratorio', pt:'\ud83e\uddea Auditoria Matinal do Laborat\u00f3rio' },
'app-ready-sub':        { en:'Rate your current state. The system adapts your training intensity automatically.', es:'Eval\u00faa tu estado actual. El sistema adapta tu intensidad de entrenamiento autom\u00e1ticamente.', pt:'Avalie seu estado atual. O sistema adapta sua intensidade de treino automaticamente.' },
'app-ready-sleep':      { en:'Sleep Quality', es:'Calidad del Sue\u00f1o', pt:'Qualidade do Sono' },
'app-ready-sleep-lo':   { en:'Restless', es:'Inquieto', pt:'Inquieto' },
'app-ready-sleep-hi':   { en:'Deep Rest', es:'Descanso Profundo', pt:'Descanso Profundo' },
'app-ready-stress':     { en:'Stress Level', es:'Nivel de Estr\u00e9s', pt:'N\u00edvel de Estresse' },
'app-ready-stress-lo':  { en:'Calm', es:'Tranquilo', pt:'Tranquilo' },
'app-ready-stress-hi':  { en:'High Pressure', es:'Alta Presi\u00f3n', pt:'Alta Press\u00e3o' },
'app-ready-energy':     { en:'Physical Energy', es:'Energ\u00eda F\u00edsica', pt:'Energia F\u00edsica' },
'app-ready-energy-lo':  { en:'Exhausted', es:'Agotado', pt:'Esgotado' },
'app-ready-energy-hi':  { en:'Fresh', es:'Fresco', pt:'Descansado' },
'app-ready-coefficient': { en:'Readiness Coefficient', es:'Coeficiente de Preparaci\u00f3n', pt:'Coeficiente de Prontid\u00e3o' },
'app-ready-skip':       { en:'Skip', es:'Omitir', pt:'Pular' },
'app-ready-lock':       { en:'Lock In \ud83d\udd12', es:'Confirmar \ud83d\udd12', pt:'Confirmar \ud83d\udd12' },
'app-ready-god':        { en:'CNS Peak Detected. Add 5% to your primary lifts today. Go for the PR.', es:'Pico del SNC Detectado. A\u00f1ade 5% a tus levantamientos principales hoy. Ve por el r\u00e9cord.', pt:'Pico do SNC Detectado. Adicione 5% aos seus levantamentos principais hoje. V\u00e1 pelo recorde.' },
'app-ready-standard':   { en:'Laboratory Protocol Active. Execute the session as written.', es:'Protocolo del Laboratorio Activo. Ejecuta la sesi\u00f3n como est\u00e1 escrita.', pt:'Protocolo do Laborat\u00f3rio Ativo. Execute a sess\u00e3o como escrita.' },
'app-ready-recovery':   { en:'Fatigue Detected. Cap intensity at 70%. Prioritize longevity.', es:'Fatiga Detectada. Limita la intensidad al 70%. Prioriza la longevidad.', pt:'Fadiga Detectada. Limite a intensidade a 70%. Priorize a longevidade.' },
'app-ready-seal':       { en:'Architecture by Akeem. Sovereign Gold Standard Achieved. This system protects your gains.', es:'Arquitectura por Akeem. Est\u00e1ndar Soberano de Oro Alcanzado. Este sistema protege tus ganancias.', pt:'Arquitetura por Akeem. Padr\u00e3o Soberano de Ouro Alcan\u00e7ado. Este sistema protege seus ganhos.' },

// ═══ ACCESS GATEKEEPER ═══
'app-gate-title':       { en:'ACCESS PAUSED', es:'ACCESO PAUSADO', pt:'ACESSO PAUSADO' },
'app-gate-msg':         { en:'Your session access is currently paused. Contact the Founder to reactivate your spot in the Laboratory.', es:'Tu acceso est\u00e1 actualmente pausado. Contacta al Fundador para reactivar tu lugar en el Laboratorio.', pt:'Seu acesso est\u00e1 atualmente pausado. Contacte o Fundador para reativar seu lugar no Laborat\u00f3rio.' },
'app-gate-anchor':      { en:'This system was built at the Sovereign Gold Standard. When your access is restored, you rejoin a system with a proven track record.', es:'Este sistema fue construido a el Est\u00e1ndar Soberano de Oro. Cuando tu acceso sea restaurado, te reincorporas a un sistema con resultados comprobados.', pt:'Este sistema foi constru\u00eddo a o Padr\u00e3o Soberano de Ouro. Quando seu acesso for restaurado, voc\u00ea retorna a um sistema com resultados comprovados.' },
'app-gate-contact':     { en:'\ud83d\udcac TEXT AKEEM', es:'\ud83d\udcac MENSAJE A AKEEM', pt:'\ud83d\udcac MENSAGEM PARA AKEEM' },
'app-gate-signout':     { en:'SIGN OUT', es:'CERRAR SESI\u00d3N', pt:'SAIR' },
'app-gate-recovery-toast': { en:'Recovery Mode Active. Heavy lifting modules locked. Mobility protocol only.', es:'Modo Recuperaci\u00f3n Activo. M\u00f3dulos de levantamiento pesado bloqueados. Solo protocolo de movilidad.', pt:'Modo Recupera\u00e7\u00e3o Ativo. M\u00f3dulos de levantamento pesado bloqueados. Apenas protocolo de mobilidade.' },
'app-sync-status':      { en:'Data Secured in the Lab', es:'Datos Asegurados en el Laboratorio', pt:'Dados Seguros no Laborat\u00f3rio' },
'app-tournament-on':    { en:'TOURNAMENT MODE: ON \u2014 Road-Ready Meals Only', es:'MODO TORNEO: ON \u2014 Solo Comidas de Viaje', pt:'MODO TORNEIO: ON \u2014 Apenas Refei\u00e7\u00f5es de Viagem' },
'app-tournament-off':   { en:'TOURNAMENT MODE: OFF \u2014 All Meals', es:'MODO TORNEO: OFF \u2014 Todas las Comidas', pt:'MODO TORNEIO: OFF \u2014 Todas as Refei\u00e7\u00f5es' },
'app-tournament-label': { en:'Tournament Mode', es:'Modo Torneo', pt:'Modo Torneio' },
'app-road-badge':       { en:'ROAD', es:'VIAJE', pt:'VIAGEM' },
'app-prehab-audit-btn': { en:'\ud83e\uddea PRE-HAB AUDIT \u2014 START HERE', es:'\ud83e\uddea AUDITOR\u00cdA PRE-HAB \u2014 EMPIEZA AQU\u00cd', pt:'\ud83e\uddea AUDITORIA PRE-HAB \u2014 COMECE AQUI' },

// ═══ SOVEREIGN INTAKE MATRIX ═════════════════════════════════
'intake-step1-tag': { en:'STEP 1 OF 3', es:'PASO 1 DE 3', pt:'ETAPA 1 DE 3' },
'intake-step1-h':   { en:'YOUR FOUNDATION', es:'TU FUNDAMENTO', pt:'SUA FUNDA\u00c7\u00c3O' },
'intake-step1-sub': { en:'We calibrate every protocol to your biology. This takes 30 seconds.', es:'Calibramos cada protocolo a tu biolog\u00eda. Esto toma 30 segundos.', pt:'Calibramos cada protocolo \u00e0 sua biologia. Isso leva 30 segundos.' },
'intake-lbl-age':   { en:'Age', es:'Edad', pt:'Idade' },
'intake-lbl-goal':  { en:'Primary Goal', es:'Objetivo Principal', pt:'Objetivo Principal' },
'intake-chip-hypertrophy': { en:'\ud83d\udcaa Hypertrophy', es:'\ud83d\udcaa Hipertrofia', pt:'\ud83d\udcaa Hipertrofia' },
'intake-chip-fatloss':     { en:'\ud83d\udd25 Fat Loss', es:'\ud83d\udd25 P\u00e9rdida de Grasa', pt:'\ud83d\udd25 Perda de Gordura' },
'intake-chip-longevity':   { en:'\ud83e\uddec Longevity', es:'\ud83e\uddec Longevidad', pt:'\ud83e\uddec Longevidade' },
'intake-chip-performance': { en:'\u26a1 Performance', es:'\u26a1 Rendimiento', pt:'\u26a1 Desempenho' },
'intake-chip-recomp':      { en:'\u2696 Recomposition', es:'\u2696 Recomposici\u00f3n', pt:'\u2696 Recomposi\u00e7\u00e3o' },
'intake-next-exp':    { en:'NEXT: EXPERIENCE \u2192', es:'SIGUIENTE: EXPERIENCIA \u2192', pt:'PR\u00d3XIMO: EXPERI\u00caNCIA \u2192' },
'intake-step2-tag':   { en:'STEP 2 OF 3', es:'PASO 2 DE 3', pt:'ETAPA 2 DE 3' },
'intake-step2-h':     { en:'YOUR EXPERIENCE', es:'TU EXPERIENCIA', pt:'SUA EXPERI\u00caNCIA' },
'intake-step2-sub':   { en:'This determines your starting intensity and progression speed.', es:'Esto determina tu intensidad inicial y velocidad de progresi\u00f3n.', pt:'Isto determina sua intensidade inicial e velocidade de progress\u00e3o.' },
'intake-lbl-exp':     { en:'Training Experience', es:'Experiencia de Entrenamiento', pt:'Experi\u00eancia de Treinamento' },
'intake-chip-beginner':     { en:'\ud83c\udf31 Beginner (0-1 yr)',     es:'\ud83c\udf31 Principiante (0-1 a\u00f1o)', pt:'\ud83c\udf31 Iniciante (0-1 ano)' },
'intake-chip-intermediate': { en:'\ud83d\udcca Intermediate (1-3 yr)', es:'\ud83d\udcca Intermedio (1-3 a\u00f1os)', pt:'\ud83d\udcca Intermedi\u00e1rio (1-3 anos)' },
'intake-chip-allpro':       { en:'\ud83d\udc51 All-Pro (3+ yr)',       es:'\ud83d\udc51 \u00c9lite (3+ a\u00f1os)',     pt:'\ud83d\udc51 Elite (3+ anos)' },
'intake-back':              { en:'\u2190 BACK', es:'\u2190 ATR\u00c1S', pt:'\u2190 VOLTAR' },
'intake-next-friction':     { en:'NEXT: FRICTION \u2192', es:'SIGUIENTE: FRICCI\u00d3N \u2192', pt:'PR\u00d3XIMO: FRIC\u00c7\u00c3O \u2192' },
'intake-step3-tag':         { en:'STEP 3 OF 3', es:'PASO 3 DE 3', pt:'ETAPA 3 DE 3' },
'intake-step3-h':           { en:'BIOMECHANICAL FRICTION', es:'FRICCI\u00d3N BIOMEC\u00c1NICA', pt:'FRIC\u00c7\u00c3O BIOMEC\u00c2NICA' },
'intake-step3-sub':         { en:'Select any current joint issues. This protects you from day one.', es:'Selecciona cualquier problema articular actual. Esto te protege desde el primer d\u00eda.', pt:'Selecione quaisquer problemas articulares atuais. Isso o protege desde o primeiro dia.' },
'intake-lbl-friction':      { en:'Current Issues (select all that apply)', es:'Problemas Actuales (selecciona todos los que apliquen)', pt:'Problemas Atuais (selecione todos os aplic\u00e1veis)' },
'intake-chip-fric-none':      { en:'\u2705 None',        es:'\u2705 Ninguno',       pt:'\u2705 Nenhum' },
'intake-chip-fric-knee':      { en:'\ud83e\uddb5 Knee',  es:'\ud83e\uddb5 Rodilla', pt:'\ud83e\uddb5 Joelho' },
'intake-chip-fric-lowerback': { en:'\ud83e\uddb4 Lower Back', es:'\ud83e\uddb4 Zona Lumbar', pt:'\ud83e\uddb4 Lombar' },
'intake-chip-fric-shoulder':  { en:'\ud83e\uddb6 Shoulder',   es:'\ud83e\uddb6 Hombro',      pt:'\ud83e\uddb6 Ombro' },
'intake-chip-fric-hip':       { en:'\ud83e\uddce Hip',        es:'\ud83e\uddce Cadera',      pt:'\ud83e\uddce Quadril' },
'intake-chip-fric-ankle':     { en:'\ud83e\uddb6 Ankle',      es:'\ud83e\uddb6 Tobillo',     pt:'\ud83e\uddb6 Tornozelo' },
'intake-generate':            { en:'GENERATE SOVEREIGN BLUEPRINT \u2192', es:'GENERAR PLANO SOBERANO \u2192', pt:'GERAR PLANO SOBERANO \u2192' },
'intake-need-age':  { en:'Enter your age', es:'Ingresa tu edad', pt:'Insira sua idade' },
'intake-need-goal': { en:'Select a goal', es:'Selecciona un objetivo', pt:'Selecione um objetivo' },
'intake-need-exp':  { en:'Select your experience level', es:'Selecciona tu nivel de experiencia', pt:'Selecione seu n\u00edvel de experi\u00eancia' },
'intake-toast-blueprint': { en:'\ud83c\udfaf Sovereign Blueprint generated. Welcome to the Laboratory.', es:'\ud83c\udfaf Plano Soberano generado. Bienvenido al Laboratorio.', pt:'\ud83c\udfaf Plano Soberano gerado. Bem-vindo ao Laborat\u00f3rio.' },

// ═══ GHOST PROTOCOL INTERCEPT ════════════════════════════════
'gp-badge':    { en:'\u26a0 Mastermind Alert', es:'\u26a0 Alerta Mastermind', pt:'\u26a0 Alerta Mastermind' },
'gp-headline': { en:'CNS De-conditioning Detected', es:'Desacondicionamiento del SNC Detectado', pt:'Descondicionamento do SNC Detectado' },
'gp-body':     { en:'Mastermind Alert: CNS De-conditioning detected. Your progressive overload has been temporarily paused to protect joint integrity. Tap below to initiate a Sovereign Recovery protocol and restore your baseline.', es:'Alerta Mastermind: Desacondicionamiento del SNC detectado. Tu sobrecarga progresiva ha sido pausada temporalmente para proteger la integridad articular. Pulsa abajo para iniciar un protocolo de Recuperaci\u00f3n Soberana y restaurar tu l\u00ednea base.', pt:'Alerta Mastermind: Descondicionamento do SNC detectado. Sua sobrecarga progressiva foi temporariamente pausada para proteger a integridade articular. Toque abaixo para iniciar um protocolo de Recupera\u00e7\u00e3o Soberana e restaurar sua linha de base.' },
'gp-cta':      { en:'\u26a1 Restore Sovereign Baseline', es:'\u26a1 Restaurar L\u00ednea Base Soberana', pt:'\u26a1 Restaurar Linha de Base Soberana' },

// ═══ HIGH-TICKET SNIPER (static labels) ══════════════════════
'hts-badge':     { en:'Private Invitation', es:'Invitaci\u00f3n Privada', pt:'Convite Privado' },
'hts-sig':       { en:'\u2014 Akeem, Head Coach', es:'\u2014 Akeem, Entrenador Principal', pt:'\u2014 Akeem, Treinador-Chefe' },
'hts-cta':       { en:'Apply for Mastermind Roster', es:'Aplicar al Roster Mastermind', pt:'Candidatar-se ao Roster Mastermind' },
'hts-dismiss':   { en:'Dismiss', es:'Descartar', pt:'Dispensar' },
// Dynamic copy keys (consumed by openSniperModal)
'hts-graduate-h':    { en:'Mastermind Protocol Complete',                                                                                                                                                   es:'Protocolo Mastermind Completo',                                                                                                                                             pt:'Protocolo Mastermind Conclu\u00eddo' },
'hts-graduate-sub':  { en:'The Laboratory \u00b7 By Invitation Only',                                                                                                                                        es:'El Laboratorio \u00b7 Solo por Invitaci\u00f3n',                                                                                                                              pt:'O Laborat\u00f3rio \u00b7 Somente por Convite' },
'hts-graduate-body': { en:'Mastermind Protocol Complete. You have outgrown the automated blueprint. Tap below to apply for Akeem\u2019s Private 1-on-1 Clinical Roster.',                                    es:'Protocolo Mastermind Completo. Has superado el plano automatizado. Pulsa abajo para aplicar al Roster Cl\u00ednico Privado 1-a-1 de Akeem.',                                    pt:'Protocolo Mastermind Conclu\u00eddo. Voc\u00ea superou o plano automatizado. Toque abaixo para candidatar-se ao Roster Cl\u00ednico Privado 1-a-1 do Akeem.' },
'hts-plateau-h':     { en:'Biomechanical Plateau Detected',                                                                                                                                                  es:'Meseta Biomec\u00e1nica Detectada',                                                                                                                                          pt:'Plat\u00f4 Biomec\u00e2nico Detectado' },
'hts-plateau-sub':   { en:'Clinical Intervention Required',                                                                                                                                                  es:'Intervenci\u00f3n Cl\u00ednica Requerida',                                                                                                                                    pt:'Interven\u00e7\u00e3o Cl\u00ednica Necess\u00e1ria' },
'hts-plateau-body':  { en:'Mastermind Alert: Biomechanical plateau detected. Automated programming is no longer sufficient. Tap below to apply for clinical 1-on-1 intervention.',                           es:'Alerta Mastermind: Meseta biomec\u00e1nica detectada. La programaci\u00f3n automatizada ya no es suficiente. Pulsa abajo para aplicar a la intervenci\u00f3n cl\u00ednica 1-a-1.', pt:'Alerta Mastermind: Plat\u00f4 biomec\u00e2nico detectado. A programa\u00e7\u00e3o automatizada n\u00e3o \u00e9 mais suficiente. Toque abaixo para candidatar-se \u00e0 interven\u00e7\u00e3o cl\u00ednica 1-a-1.' },

// ═══ BIOMECHANICAL HEAT MAP (Kinematic Auditor) ══════════════
'bhm-label':       { en:'\ud83e\uddec Biomechanical Health Matrix', es:'\ud83e\uddec Matriz de Salud Biomec\u00e1nica', pt:'\ud83e\uddec Matriz de Sa\u00fade Biomec\u00e2nica' },
'bhm-rec-sleep':   { en:'Sleep 7d',       es:'Sue\u00f1o 7d',          pt:'Sono 7d' },
'bhm-rec-cns':     { en:'CNS Depleted',   es:'SNC Agotado',            pt:'SNC Esgotado' },
'bhm-rec-capacity':{ en:'Recovery',       es:'Recuperaci\u00f3n',      pt:'Recupera\u00e7\u00e3o' },
'bhm-redline-text':{ en:'\u26A0 Biomechanical Redline: high tonnage accumulated without the recovery capacity to absorb it. Mobility prescribed for the dominant axial load.', es:'\u26A0 L\u00ednea Roja Biomec\u00e1nica: tonelaje alto acumulado sin la capacidad de recuperaci\u00f3n para absorberlo. Movilidad prescrita para la carga axial dominante.', pt:'\u26A0 Linha Vermelha Biomec\u00e2nica: tonelagem alta acumulada sem a capacidade de recupera\u00e7\u00e3o para absorv\u00ea-la. Mobilidade prescrita para a carga axial dominante.' },
'bhm-window':      { en:'4-Week Axial Load', es:'Carga Axial \u00b7 4 Semanas', pt:'Carga Axial \u00b7 4 Semanas' },
'bhm-score-label': { en:'Friction Score \u00a0\u00b7\u00a0 threshold 100', es:'Puntaje de Fricci\u00f3n \u00a0\u00b7\u00a0 umbral 100', pt:'Pontua\u00e7\u00e3o de Fric\u00e7\u00e3o \u00a0\u00b7\u00a0 limite 100' },
'bhm-lift-squat':    { en:'SQUAT',    es:'SENTADILLA',    pt:'AGACHAMENTO' },
'bhm-lift-deadlift': { en:'DEADLIFT', es:'PESO MUERTO',   pt:'LEVANTAMENTO' },
'bhm-lift-ohp':      { en:'OHP',      es:'PRESS MILITAR', pt:'DESENVOLVIMENTO' },
'bhm-stat-sets':     { en:'Sets',      es:'Series',   pt:'S\u00e9ries' },
'bhm-stat-sessions': { en:'Sessions',  es:'Sesiones', pt:'Sess\u00f5es' },
'bhm-stat-tier':     { en:'Tier',      es:'Nivel',    pt:'N\u00edvel' },
'bhm-warn-text':     { en:'\u26a0 CNS friction elevated. Progressive axial loading exceeds safe tonnage for this 4-week block.', es:'\u26a0 Fricci\u00f3n del SNC elevada. La carga axial progresiva excede el tonelaje seguro para este bloque de 4 semanas.', pt:'\u26a0 Fric\u00e7\u00e3o do SNC elevada. A carga axial progressiva excede a tonelagem segura para este bloco de 4 semanas.' },
'bhm-mobility-btn':  { en:'\ud83e\uddb5 Prescribed Occupational Mobility', es:'\ud83e\uddb5 Movilidad Ocupacional Prescrita', pt:'\ud83e\uddb5 Mobilidade Ocupacional Prescrita' },
'bhm-friction-title':    { en:'Joint Friction · Recovery Trajectory', es:'Fricción Articular · Trayectoria de Recuperación', pt:'Fricção Articular · Trajetória de Recuperação' },
'bhm-friction-week-tpl': { en:'Currently · Week {N} of 4', es:'Actualmente · Semana {N} de 4', pt:'Atualmente · Semana {N} de 4' },
'bhm-friction-pain':     { en:'Pain',     es:'Dolor',      pt:'Dor' },
'bhm-friction-easing':   { en:'Easing',   es:'Aliviando',  pt:'Aliviando' },
'bhm-friction-reduced':  { en:'Reduced',  es:'Reducido',   pt:'Reduzido' },
'bhm-friction-cleared':  { en:'Cleared',  es:'Despejado',  pt:'Limpo' },

// ═══ SOMATIC MAP (Somatic Sync) ══════════════════════════════
'som-label':       { en:'\ud83e\uddA0 Somatic Readiness Matrix', es:'\ud83e\uddA0 Matriz de Preparaci\u00f3n Som\u00e1tica', pt:'\ud83e\uddA0 Matriz de Prontid\u00e3o Som\u00e1tica' },
'som-lbl-stress':  { en:'Stress Level',    es:'Nivel de Estr\u00e9s',   pt:'N\u00edvel de Estresse' },
'som-tier-flow':   { en:'FLOW',            es:'FLUJO',                  pt:'FLUXO' },
'som-flow-banner': { en:'<b>\uD83D\uDD25 FLOW STATE</b> \u2014 Every biomarker aligned. Push for a personal record today \u2014 the CNS is ready to adapt.', es:'<b>\uD83D\uDD25 ESTADO DE FLUJO</b> \u2014 Todos los biomarcadores alineados. Busca un r\u00e9cord personal hoy \u2014 el SNC est\u00e1 listo para adaptarse.', pt:'<b>\uD83D\uDD25 ESTADO DE FLUXO</b> \u2014 Todos os biomarcadores alinhados. Busque um recorde pessoal hoje \u2014 o SNC est\u00e1 pronto para se adaptar.' },
'seq-badge':       { en:'\u26A0 System Emergency', es:'\u26A0 Emergencia del Sistema', pt:'\u26A0 Emerg\u00eancia do Sistema' },
'seq-h':           { en:'System Emergency Deload', es:'Descarga de Emergencia del Sistema', pt:'Descarga de Emerg\u00eancia do Sistema' },
'seq-body':        { en:'<b>Biomechanical Redline</b> and <b>low Somatic Readiness</b> have fired simultaneously. Accumulated axial tonnage has outpaced your recovery capacity, and today\u2019s biomarkers confirm the CNS cannot safely absorb progressive overload. The system is halting prescriptive load and routing you to a protected mobility protocol.', es:'<b>L\u00ednea Roja Biomec\u00e1nica</b> y <b>Preparaci\u00f3n Som\u00e1tica baja</b> se han activado simult\u00e1neamente. El tonelaje axial acumulado ha superado tu capacidad de recuperaci\u00f3n, y los biomarcadores de hoy confirman que el SNC no puede absorber la sobrecarga progresiva de forma segura. El sistema est\u00e1 deteniendo la carga prescrita y te dirige a un protocolo de movilidad protegido.', pt:'<b>Linha Vermelha Biomec\u00e2nica</b> e <b>baixa Prontid\u00e3o Som\u00e1tica</b> dispararam simultaneamente. A tonelagem axial acumulada superou sua capacidade de recupera\u00e7\u00e3o, e os biomarcadores de hoje confirmam que o SNC n\u00e3o pode absorver a sobrecarga progressiva com seguran\u00e7a. O sistema est\u00e1 interrompendo a carga prescrita e direcionando voc\u00ea a um protocolo de mobilidade protegido.' },
'seq-cta':         { en:'Initialise Mobility + Recovery Protocol', es:'Iniciar Protocolo de Movilidad + Recuperaci\u00f3n', pt:'Iniciar Protocolo de Mobilidade + Recupera\u00e7\u00e3o' },
'seq-dismiss':     { en:'Acknowledge \u0026 Continue with Caution', es:'Reconocer y Continuar con Precauci\u00f3n', pt:'Reconhecer e Continuar com Cautela' },


// ═══ PHANTOM EYE — Live AI Coach hub (Phase 15) ═════════════
'pe-label':        { en:'👁 Phantom Eye Viewport · Live Biomechanical & Nutritional Analysis', es:'👁 Viewport del Ojo Fantasma · Análisis Biomecánico y Nutricional en Vivo', pt:'👁 Viewport do Olho Fantasma · Análise Biomecânica e Nutricional ao Vivo' },
'pe-badge-idle':   { en:'Idle',                es:'En Reposo',            pt:'Em Repouso' },
'pe-badge-live':   { en:'Live',                es:'En Vivo',              pt:'Ao Vivo' },
'pe-hero-kicker':  { en:'Multimodal AI Coach', es:'Coach IA Multimodal',  pt:'Coach IA Multimodal' },
'pe-hero-title':   { en:'Real-time form audit + nutrition vision', es:'Auditoría de técnica + visión nutricional en tiempo real', pt:'Auditoria de técnica + visão nutricional em tempo real' },
'pe-hero-sub':     { en:'Stream your camera to the BBF Intelligence Engine. Instant biomechanical cues + macro estimates from what you are holding, lifting, or eating.', es:'Transmite tu cámara al Motor de Inteligencia BBF. Señales biomecánicas instantáneas + estimaciones de macros de lo que sostienes, levantas o comes.', pt:'Transmita sua câmera para o Motor de Inteligência BBF. Dicas biomecânicas instantâneas + estimativas de macros do que você segura, levanta ou come.' },
'pe-init':         { en:'🎬 Initialize Live Coach →', es:'🎬 Iniciar Coach en Vivo →', pt:'🎬 Iniciar Coach ao Vivo →' },
'pe-init-vision':       { en:'BBF Phantom Eye', es:'BBF Phantom Eye', pt:'BBF Phantom Eye' },
'pe-init-vision-sub':   { en:'Live Vision Check', es:'Chequeo Visual en Vivo', pt:'Verificação Visual ao Vivo' },
'pe-init-voice':        { en:'BBF Virtual Coach', es:'BBF Virtual Coach', pt:'BBF Virtual Coach' },
'pe-init-voice-sub':    { en:'Audio Only', es:'Solo Audio', pt:'Somente Áudio' },
'pe-perm-prompt':       { en:'Requesting camera + microphone…', es:'Solicitando cámara + micrófono…', pt:'Solicitando câmera + microfone…' },
'pe-perm-prompt-voice': { en:'Requesting microphone…', es:'Solicitando micrófono…', pt:'Solicitando microfone…' },
'pe-terminate':    { en:'Terminate Session',   es:'Terminar Sesión', pt:'Encerrar Sessão' },
'pe-perm-denied':  { en:'Camera/microphone access denied. Enable permissions in your browser settings to use the Live Coach.', es:'Acceso a cámara/micrófono denegado. Habilita los permisos en la configuración del navegador para usar el Coach en Vivo.', pt:'Acesso à câmera/microfone negado. Ative as permissões nas configurações do navegador para usar o Coach ao Vivo.' },
'pe-perm-unsupported': { en:'Live Coach requires a browser with camera + microphone APIs. Please update your browser.', es:'El Coach en Vivo requiere un navegador con APIs de cámara y micrófono. Actualiza tu navegador.', pt:'O Coach ao Vivo requer um navegador com APIs de câmera e microfone. Atualize seu navegador.' },
'pe-status-connecting':   { en:'Connecting to Sovereign Coach…', es:'Conectando con el Coach Soberano…', pt:'Conectando ao Coach Soberano…' },
'pe-status-coach-ready':  { en:'Sovereign Coach connected. Speak when ready.', es:'Coach Soberano conectado. Habla cuando estés listo.', pt:'Coach Soberano conectado. Fale quando estiver pronto.' },
'pe-status-bridge-fail':  { en:'Sovereign Coach unavailable. Camera streaming locally only.', es:'Coach Soberano no disponible. La cámara transmite solo localmente.', pt:'Coach Soberano indisponível. A câmera transmite apenas localmente.' },
'pe-status-idle-terminated': { en:'Session auto-terminated to save battery and bandwidth.', es:'Sesión terminada automáticamente para ahorrar batería y ancho de banda.', pt:'Sessão encerrada automaticamente para economizar bateria e largura de banda.' },

// ═══ BIOMETRIC YIELD REPORT — Titan Follow-up ═══════════════
'byr-launch':     { en:'\uD83E\uDDEC View Clinical Yield', es:'\uD83E\uDDEC Ver Rendimiento Cl\u00ednico', pt:'\uD83E\uDDEC Ver Rendimento Cl\u00ednico' },
'byr-launch-sub': { en:'11 biomarkers \u00b7 Sovereign Radar synthesis', es:'11 biomarcadores \u00b7 s\u00edntesis Soberana', pt:'11 biomarcadores \u00b7 s\u00edntese Soberana' },
'byr-decrypt':    { en:'Decrypting Clinical Yield...', es:'Descifrando Rendimiento Cl\u00ednico...', pt:'Descriptografando Rendimento Cl\u00ednico...' },
'byr-tag':        { en:'Sovereign \u00b7 Clinical Yield', es:'Soberano \u00b7 Rendimiento Cl\u00ednico', pt:'Soberano \u00b7 Rendimento Cl\u00ednico' },
'byr-heading':    { en:'Biometric Yield Report',  es:'Informe de Rendimiento Biom\u00e9trico', pt:'Relat\u00f3rio de Rendimento Biom\u00e9trico' },
'byr-tap-hint':   { en:'Tap for Cluster View',    es:'Toca para Vista por Cl\u00faster',       pt:'Toque para Vis\u00e3o por Cluster' },
'byr-back':       { en:'Radar Web',               es:'Red Radar',                              pt:'Rede Radar' },
'byr-sys':        { en:'System Notification',     es:'Notificaci\u00f3n del Sistema',          pt:'Notifica\u00e7\u00e3o do Sistema' },
// Marker + cluster labels
'byr-cluster-autonomic':     { en:'Autonomic',     es:'Auton\u00f3mico',         pt:'Auton\u00f4mico' },
'byr-cluster-biomechanical': { en:'Biomechanical', es:'Biomec\u00e1nico',         pt:'Biomec\u00e2nico' },
'byr-cluster-performance':   { en:'Performance',   es:'Rendimiento',              pt:'Desempenho' },
'byr-m-hrv':       { en:'HRV Index',             es:'\u00cdndice HRV',                 pt:'\u00cdndice HRV' },
'byr-m-sleep':     { en:'Sleep Quality',         es:'Calidad del Sue\u00f1o',          pt:'Qualidade do Sono' },
'byr-m-cns':       { en:'CNS Readiness',         es:'Preparaci\u00f3n del SNC',        pt:'Prontid\u00e3o do SNC' },
'byr-m-stress':    { en:'Stress Tolerance',      es:'Tolerancia al Estr\u00e9s',       pt:'Toler\u00e2ncia ao Estresse' },
'byr-m-rom':       { en:'Joint ROM',             es:'Amplitud Articular',              pt:'Amplitude Articular' },
'byr-m-recovery':  { en:'Recovery Capacity',     es:'Capacidad de Recuperaci\u00f3n',  pt:'Capacidade de Recupera\u00e7\u00e3o' },
'byr-m-movement':  { en:'Movement Quality',      es:'Calidad de Movimiento',           pt:'Qualidade de Movimento' },
'byr-m-axial':     { en:'Axial Load Tolerance',  es:'Tolerancia a Carga Axial',        pt:'Toler\u00e2ncia \u00e0 Carga Axial' },
'byr-m-overload':  { en:'Progressive Overload',  es:'Sobrecarga Progresiva',           pt:'Sobrecarga Progressiva' },
'byr-m-fast':      { en:'Fasting Adaptation',    es:'Adaptaci\u00f3n al Ayuno',        pt:'Adapta\u00e7\u00e3o ao Jejum' },
'byr-m-neural':    { en:'Neural Drive',          es:'Impulso Neural',                  pt:'Impulso Neural' },

// ═══ ROI SYNTHESIS — Weekly Executive Yield Brief ═══════════
'roi-locked':      { en:'SYSTEM NOTIFICATION: Biomarkers actively compiling. Next Executive Yield Brief unlocks on Sunday.', es:'NOTIFICACI\u00d3N DEL SISTEMA: Biomarcadores compilando activamente. El pr\u00f3ximo Informe Ejecutivo de Rendimiento se desbloquea el domingo.', pt:'NOTIFICA\u00c7\u00c3O DO SISTEMA: Biomarcadores compilando ativamente. O pr\u00f3ximo Relat\u00f3rio Executivo de Rendimento desbloqueia no domingo.' },

'som-window':      { en:'Today \u00b7 Readiness Sync', es:'Hoy \u00b7 Sincronizaci\u00f3n de Preparaci\u00f3n', pt:'Hoje \u00b7 Sincroniza\u00e7\u00e3o de Prontid\u00e3o' },
'som-score-label': { en:'Somatic Readiness \u00b7 threshold 60%', es:'Preparaci\u00f3n Som\u00e1tica \u00b7 umbral 60%', pt:'Prontid\u00e3o Som\u00e1tica \u00b7 limite 60%' },
'som-lbl-sleep':   { en:'Sleep Quality', es:'Calidad del Sue\u00f1o', pt:'Qualidade do Sono' },
'som-lbl-cog':     { en:'Cognitive Load', es:'Carga Cognitiva', pt:'Carga Cognitiva' },
'som-lbl-fast':    { en:'Fasting Window', es:'Ventana de Ayuno', pt:'Janela de Jejum' },
'som-save-btn':    { en:'\u269b Sync Somatic Readiness', es:'\u269b Sincronizar Preparaci\u00f3n Som\u00e1tica', pt:'\u269b Sincronizar Prontid\u00e3o Som\u00e1tica' },
'som-wearable-btn':              { en:'⌚ Sync Wearable', es:'⌚ Sincronizar Wearable', pt:'⌚ Sincronizar Wearable' },
'som-wearable-syncing':          { en:'Syncing Health Connect…', es:'Sincronizando Health Connect…', pt:'Sincronizando Health Connect…' },
'som-wearable-status-syncing':   { en:'Handshaking with Samsung Health…', es:'Conectando con Samsung Health…', pt:'Conectando com Samsung Health…' },
'som-wearable-status-ok':        { en:'Synced · {SCORE}% · {TIER}', es:'Sincronizado · {SCORE}% · {TIER}', pt:'Sincronizado · {SCORE}% · {TIER}' },
'som-wearable-status-err':       { en:'Sync failed — tap to retry', es:'Sincronización fallida — toca para reintentar', pt:'Falha na sincronização — toque para tentar novamente' },
'som-wearable-tier-cleared':     { en:'Cleared',   es:'Despejado',  pt:'Liberado' },
'som-wearable-tier-caution':     { en:'Caution',   es:'Precaución', pt:'Cautela' },
'som-wearable-tier-depleted':    { en:'Depleted',  es:'Agotado',    pt:'Esgotado' },
'som-override-banner': { en:'<b>\u26a1 Somatic Override Active</b> \u2014 intensity capped at 70% 1RM (from 85%), volume down-regulated by 1 set per exercise to protect CNS.', es:'<b>\u26a1 Anulaci\u00f3n Som\u00e1tica Activa</b> \u2014 intensidad limitada al 70% del 1RM (desde 85%), volumen reducido en 1 serie por ejercicio para proteger el SNC.', pt:'<b>\u26a1 Override Som\u00e1tico Ativo</b> \u2014 intensidade limitada a 70% do 1RM (de 85%), volume reduzido em 1 s\u00e9rie por exerc\u00edcio para proteger o SNC.' },
'som-tier-optimal':  { en:'OPTIMAL',  es:'\u00d3PTIMO',    pt:'\u00d3TIMO' },
'som-tier-ready':    { en:'READY',    es:'PREPARADO',     pt:'PRONTO' },
'som-tier-caution':  { en:'CAUTION',  es:'PRECAUCI\u00d3N', pt:'CAUTELA' },
'som-tier-depleted': { en:'DEPLETED', es:'AGOTADO',       pt:'ESGOTADO' },
'som-rdw-h':    { en:'SOMATIC OVERRIDE', es:'ANULACI\u00d3N SOM\u00c1TICA', pt:'OVERRIDE SOM\u00c1TICO' },
'som-rdw-body': { en:'CNS-protective cap: intensity prescriptions capped at 70% 1RM today (from 85%). Drop 1 working set per exercise. Resume full protocol when Somatic Readiness \u2265 60%.', es:'L\u00edmite protector del SNC: las prescripciones de intensidad est\u00e1n limitadas al 70% del 1RM hoy (desde 85%). Reduce 1 serie efectiva por ejercicio. Reanuda el protocolo completo cuando la Preparaci\u00f3n Som\u00e1tica sea \u2265 60%.', pt:'Limite protetor do SNC: as prescri\u00e7\u00f5es de intensidade est\u00e3o limitadas a 70% do 1RM hoje (de 85%). Reduza 1 s\u00e9rie efetiva por exerc\u00edcio. Retome o protocolo completo quando a Prontid\u00e3o Som\u00e1tica for \u2265 60%.' },

// ═══ RENDER-ENGINE TOASTS ════════════════════════════════════
'render-welcome-toast':     { en:'\ud83c\udfaf Mastermind Diagnostic Complete. Your 12-Week Sovereign Blueprint has been deployed.', es:'\ud83c\udfaf Diagn\u00f3stico Mastermind Completo. Tu Plano Soberano de 12 Semanas ha sido desplegado.', pt:'\ud83c\udfaf Diagn\u00f3stico Mastermind Conclu\u00eddo. Seu Plano Soberano de 12 Semanas foi implantado.' },
'render-recovery-toast':    { en:'\u26a1 Sovereign Recovery active. Today is Mobility + Pre-Hab.', es:'\u26a1 Recuperaci\u00f3n Soberana activa. Hoy es Movilidad + Pre-Hab.', pt:'\u26a1 Recupera\u00e7\u00e3o Soberana ativa. Hoje \u00e9 Mobilidade + Pre-Hab.' },
'render-application-toast': { en:'\u2728 Application received. The Mastermind will review your clinical data.', es:'\u2728 Aplicaci\u00f3n recibida. El Mastermind revisar\u00e1 tus datos cl\u00ednicos.', pt:'\u2728 Candidatura recebida. O Mastermind revisar\u00e1 seus dados cl\u00ednicos.' },
'render-no-user':      { en:'\u26a0 No active user. Sign in to deploy blueprint.', es:'\u26a0 No hay usuario activo. Inicia sesi\u00f3n para desplegar el plano.', pt:'\u26a0 Nenhum usu\u00e1rio ativo. Entre para implantar o plano.' },
'render-engine-offline': { en:'\u26a0 Blueprint engine offline.', es:'\u26a0 Motor de plano sin conexi\u00f3n.', pt:'\u26a0 Motor do plano offline.' },
'render-generate-failed': { en:'\u26a0 Blueprint generation failed.', es:'\u26a0 Generaci\u00f3n del plano fallida.', pt:'\u26a0 Falha na gera\u00e7\u00e3o do plano.' },
'render-sync-offline': { en:'\u26a0 Sync engine offline.', es:'\u26a0 Motor de sincronizaci\u00f3n sin conexi\u00f3n.', pt:'\u26a0 Motor de sincroniza\u00e7\u00e3o offline.' },
'render-app-offline':  { en:'\u26a0 Application engine offline.', es:'\u26a0 Motor de aplicaciones sin conexi\u00f3n.', pt:'\u26a0 Motor de candidaturas offline.' },
'render-recovery-offline': { en:'\u26a0 Recovery engine offline.', es:'\u26a0 Motor de recuperaci\u00f3n sin conexi\u00f3n.', pt:'\u26a0 Motor de recupera\u00e7\u00e3o offline.' },
'render-restoring':    { en:'\u26a1 Restoring...',  es:'\u26a1 Restaurando...', pt:'\u26a1 Restaurando...' },
'render-submitting':   { en:'Submitting\u2026',     es:'Enviando\u2026',         pt:'Enviando\u2026' },
'render-syncing':      { en:'\u26a1 Syncing...',    es:'\u26a1 Sincronizando...', pt:'\u26a1 Sincronizando...' },
'som-sync-failed':     { en:'\u26a0 Somatic sync failed.', es:'\u26a0 Sincronizaci\u00f3n som\u00e1tica fallida.', pt:'\u26a0 Falha na sincroniza\u00e7\u00e3o som\u00e1tica.' },
'som-toast-synced':    { en:'\u269b Somatic SYNCED', es:'\u269b Som\u00e1tico SINCRONIZADO', pt:'\u269b Som\u00e1tico SINCRONIZADO' },

// \u2550\u2550\u2550 PHASE 2 \u00b7 TRILINGUAL COVERAGE EXTENSION (2026-05-27) \u2550\u2550\u2550
// Orphan fix \u00b7 was referenced in bbf-app.html:1687 but missing from D
'app-nav-cardio':              { en:'Smart Cardio',             es:'Cardio Inteligente',                  pt:'Cardio Inteligente' },

// Login screen \u00b7 paying-client surface \u00b7 placeholders + labels + CTAs
'app-login-user-label':        { en:'Username',                 es:'Usuario',                              pt:'Usu\u00e1rio' },
'app-login-user-placeholder':  { en:'your username',            es:'tu usuario',                           pt:'seu usu\u00e1rio' },
'app-login-pin-label':         { en:'PIN (6 digits)',           es:'PIN (6 d\u00edgitos)',                 pt:'PIN (6 d\u00edgitos)' },
'app-login-pin-placeholder':   { en:'enter PIN',                es:'ingresa el PIN',                       pt:'digite o PIN' },
'app-login-signin':            { en:'Sign In \u2192',           es:'Iniciar Sesi\u00f3n \u2192',           pt:'Entrar \u2192' },
'app-login-forgot':            { en:'Forgot PIN?',              es:'\u00bfOlvidaste tu PIN?',              pt:'Esqueceu o PIN?' },

// New client registration form \u00b7 admin-only surface but still part of the legacy DOM
'app-newclient-name-label':       { en:'Full Name',                es:'Nombre Completo',                      pt:'Nome Completo' },
'app-newclient-name-placeholder': { en:'e.g. Marcus Johnson',      es:'ej. Marcus Johnson',                   pt:'ex. Marcus Johnson' },
'app-newclient-user-label':       { en:'Username (no spaces)',     es:'Usuario (sin espacios)',               pt:'Usu\u00e1rio (sem espa\u00e7os)' },
'app-newclient-user-placeholder': { en:'e.g. marcus_j',            es:'ej. marcus_j',                         pt:'ex. marcus_j' },
'app-newclient-pin-label':        { en:'6-digit PIN',              es:'PIN de 6 d\u00edgitos',                pt:'PIN de 6 d\u00edgitos' },
'app-newclient-pin-placeholder':  { en:'choose a PIN',             es:'elige un PIN',                         pt:'escolha um PIN' },
'app-newclient-type-label':       { en:'Training Type',            es:'Tipo de Entrenamiento',                pt:'Tipo de Treino' },
'app-newclient-type-inperson':    { en:'In-Person',                es:'Presencial',                           pt:'Presencial' },
'app-newclient-type-remote':      { en:'Online / Remote',          es:'En L\u00ednea / Remoto',               pt:'Online / Remoto' },
'app-newclient-goal-label':       { en:'Goal (optional)',          es:'Meta (opcional)',                      pt:'Meta (opcional)' },
'app-newclient-goal-placeholder': { en:'e.g. Lose 20lbs by summer',es:'ej. Bajar 20 lbs antes del verano',    pt:'ex. Perder 20 lbs at\u00e9 o ver\u00e3o' },
'app-newclient-submit':           { en:'Create Profile \u2192',    es:'Crear Perfil \u2192',                  pt:'Criar Perfil \u2192' },

// Intake form validation TOASTs \u00b7 every new client hits these
'intake-validate-age':            { en:'Enter your age',           es:'Ingresa tu edad',                      pt:'Digite sua idade' },
'intake-validate-goal':           { en:'Select a goal',            es:'Selecciona una meta',                  pt:'Selecione uma meta' },
'intake-validate-exp':            { en:'Select your experience level', es:'Selecciona tu nivel de experiencia', pt:'Selecione seu n\u00edvel de experi\u00eancia' },

// \u2550\u2550\u2550 PHASE 3 \u00b7 INDEX.HTML LEGACY GAPS (2026-05-27) \u2550\u2550\u2550
// Accessibility \u00b7 skip-link + hamburger Menu aria
'a11y-skip-main':              { en:'Skip to main content',     es:'Saltar al contenido principal',        pt:'Pular para o conte\u00fado principal' },
'a11y-menu':                   { en:'Menu',                     es:'Men\u00fa',                            pt:'Menu' },

// Hero marquee \u00b7 6 unique scrolling phrases
'mq-habit-arch':               { en:'HUMAN HABIT ARCHITECTURE', es:'ARQUITECTURA DE H\u00c1BITOS HUMANOS', pt:'ARQUITETURA DE H\u00c1BITOS HUMANOS' },
'mq-elite-trans':              { en:'ELITE TRANSFORMATION',     es:'TRANSFORMACI\u00d3N DE \u00c9LITE',         pt:'TRANSFORMA\u00c7\u00c3O DE ELITE' },
'mq-peak-perf':                { en:'PEAK PERFORMANCE ARCHITECTURE', es:'ARQUITECTURA DE M\u00c1XIMO RENDIMIENTO', pt:'ARQUITETURA DE PERFORMANCE M\u00c1XIMA' },
'mq-sovereign':                { en:'SOVEREIGN PERFORMANCE',    es:'RENDIMIENTO SOBERANO',                 pt:'PERFORMANCE SOBERANA' },
'mq-universal':                { en:'UNIVERSAL HUMAN PERFORMANCE', es:'RENDIMIENTO HUMANO UNIVERSAL',       pt:'PERFORMANCE HUMANA UNIVERSAL' },
'mq-engine-anchor':            { en:'ENGINE HABITS OVER ANCHOR HABITS', es:'H\u00c1BITOS MOTOR SOBRE H\u00c1BITOS ANCLA', pt:'H\u00c1BITOS MOTOR SOBRE H\u00c1BITOS \u00c2NCORA' },

// TDEE quick-calculator form \u00b7 widely used free tool
'tdee-tag-lite':               { en:'Free Tool \u2014 Lite Tier',  es:'Herramienta Gratis \u2014 Nivel Lite',   pt:'Ferramenta Gr\u00e1tis \u2014 N\u00edvel Lite' },
'tdee-lbl-age':                { en:'Age',                      es:'Edad',                                 pt:'Idade' },
'tdee-lbl-sex':                { en:'Sex',                      es:'Sexo',                                 pt:'Sexo' },
'tdee-opt-male':               { en:'Male',                     es:'Masculino',                            pt:'Masculino' },
'tdee-opt-female':             { en:'Female',                   es:'Femenino',                             pt:'Feminino' },
'tdee-lbl-weight':             { en:'Weight (lbs)',             es:'Peso (lbs)',                           pt:'Peso (lbs)' },
'tdee-lbl-height':             { en:'Height (ft / in)',         es:'Altura (pies / pulg)',                 pt:'Altura (p\u00e9s / pol)' },
'tdee-ph-ft':                  { en:'ft',                       es:'pies',                                 pt:'p\u00e9s' },
'tdee-ph-in':                  { en:'in',                       es:'pulg',                                 pt:'pol' },
'tdee-lbl-activity':           { en:'Activity Level',           es:'Nivel de Actividad',                   pt:'N\u00edvel de Atividade' },
'tdee-act-sed':                { en:'Sedentary',                es:'Sedentario',                           pt:'Sedent\u00e1rio' },
'tdee-act-light':              { en:'Lightly Active (1-3x/week)', es:'Poco Activo (1-3x/sem)',             pt:'Pouco Ativo (1-3x/sem)' },
'tdee-act-mod':                { en:'Moderately Active (3-5x/week)', es:'Moderadamente Activo (3-5x/sem)', pt:'Moderadamente Ativo (3-5x/sem)' },
'tdee-act-very':               { en:'Very Active (6-7x/week)',  es:'Muy Activo (6-7x/sem)',                pt:'Muito Ativo (6-7x/sem)' },
'tdee-act-extreme':            { en:'Extremely Active / Physical Job', es:'Extremadamente Activo / Trabajo F\u00edsico', pt:'Extremamente Ativo / Trabalho F\u00edsico' },
'tdee-lbl-goal':               { en:'Goal',                     es:'Meta',                                 pt:'Meta' },
'tdee-goal-lose':              { en:'\ud83d\udd25 Lose Fat',           es:'\ud83d\udd25 Bajar Grasa',                    pt:'\ud83d\udd25 Perder Gordura' },
'tdee-goal-maintain':          { en:'\u2696 Maintain',            es:'\u2696 Mantener',                        pt:'\u2696 Manter' },
'tdee-goal-build':             { en:'\ud83d\udcaa Build Muscle',       es:'\ud83d\udcaa Ganar M\u00fasculo',                pt:'\ud83d\udcaa Ganhar M\u00fasculo' },
'tdee-cal-day':                { en:'Calories / Day',           es:'Calor\u00edas / D\u00eda',                  pt:'Calorias / Dia' },
'tdee-mac-protein':            { en:'Protein',                  es:'Prote\u00edna',                            pt:'Prote\u00edna' },
'tdee-mac-carbs':              { en:'Carbs',                    es:'Carbohidratos',                        pt:'Carboidratos' },
'tdee-mac-fats':               { en:'Fats',                     es:'Grasas',                               pt:'Gorduras' },
'tdee-cta-plan':               { en:'Get a Custom Meal Plan \u2192', es:'Obt\u00e9n un Plan Alimenticio \u2192',  pt:'Obtenha um Plano Alimentar \u2192' },

// \u2550\u2550\u2550 PHASE 4 \u00b7 TACTICAL STRIKE \u00b7 OPERATOR VIDEO-AUDIT GAPS (2026-05-27) \u2550\u2550\u2550

// Nav \u00b7 Playbooks (desktop + mobile) + Scouting Hub (mobile only)
'nav-playbooks':                   { en:'\ud83d\udcda Playbooks',         es:'\ud83d\udcda Manuales',                pt:'\ud83d\udcda Manuais' },
'mnav-playbooks':                  { en:'\ud83d\udcda Playbooks',         es:'\ud83d\udcda Manuales',                pt:'\ud83d\udcda Manuais' },
'mnav-scouting':                   { en:'\ud83c\udfc6 Scouting Hub',      es:'\ud83c\udfc6 Centro de Scouting',      pt:'\ud83c\udfc6 Centro de Scouting' },

// Playbooks section \u00b7 static headers (dynamic sport/position cards are JS-rendered, deferred)
'pb-kicker':                       { en:'Positional Blueprints',     es:'Planos Posicionales',         pt:'Planos Posicionais' },
'pb-title':                        { en:'ELITE POSITION.<br><span style="color:#f5c800">YOUR PLAYBOOK.</span>', es:'POSICI\u00d3N DE \u00c9LITE.<br><span style="color:#f5c800">TU MANUAL.</span>', pt:'POSI\u00c7\u00c3O DE ELITE.<br><span style="color:#f5c800">SEU MANUAL.</span>' },
'pb-sub':                          { en:'Professional-grade programming, nutrition protocols, and recruitment targets for the high-performance household. 5 sports. 25 positions. Built in the Laboratory.', es:'Programaci\u00f3n profesional, protocolos nutricionales y objetivos de reclutamiento para el hogar de alto rendimiento. 5 deportes. 25 posiciones. Construido en el Laboratorio.', pt:'Programa\u00e7\u00e3o profissional, protocolos nutricionais e objetivos de recrutamento para o lar de alto desempenho. 5 esportes. 25 posi\u00e7\u00f5es. Constru\u00eddo no Laborat\u00f3rio.' },
'pb-cta':                          { en:'UNLOCK YOUR FULL PLAYBOOK \u2192', es:'DESBLOQUEA TU MANUAL COMPLETO \u2192', pt:'DESBLOQUEIE SEU MANUAL COMPLETO \u2192' },

// Testimonials \u00b7 metric subtitles under each client name
'testi-1-meta':                    { en:'Lost 22 lbs \u2022 6 months',     es:'Baj\u00f3 22 lbs \u2022 6 meses',           pt:'Perdeu 22 lbs \u2022 6 meses' },
'testi-2-meta':                    { en:'Body recomposition \u2022 4 months', es:'Recomposici\u00f3n corporal \u2022 4 meses', pt:'Recomposi\u00e7\u00e3o corporal \u2022 4 meses' },
'testi-3-meta':                    { en:'Strength \u2022 3 months',         es:'Fuerza \u2022 3 meses',                pt:'For\u00e7a \u2022 3 meses' },

// Interrogator form \u00b7 full coverage (kicker, title, sub, label, placeholder, aria, counter, button)
'intg-kicker':                     { en:'MOAB 3 \u00b7 Lead-Gen Audit',     es:'MOAB 3 \u00b7 Auditor\u00eda de Captaci\u00f3n', pt:'MOAB 3 \u00b7 Auditoria de Capta\u00e7\u00e3o' },
'intg-title':                      { en:'The Routine <b>Interrogator</b>', es:'El <b>Interrogador</b> de Rutina', pt:'O <b>Interrogador</b> de Rotina' },
'intg-sub':                        { en:'Paste your current workout split. The audit engine surfaces the structural gaps your program is hiding and prescribes the exact BBF architecture that closes them. No email. No friction.', es:'Pega tu rutina actual. El motor de auditor\u00eda revela los vac\u00edos estructurales que tu programa esconde y prescribe la arquitectura BBF exacta que los cierra. Sin email. Sin fricci\u00f3n.', pt:'Cole sua rotina atual. O motor de auditoria revela as lacunas estruturais que seu programa esconde e prescreve a arquitetura BBF exata que as fecha. Sem email. Sem fric\u00e7\u00e3o.' },
'intg-label-l':                    { en:'> PASTE YOUR PROTOCOL',       es:'> PEGA TU PROTOCOLO',             pt:'> COLE SEU PROTOCOLO' },
'intg-placeholder':                { en:'MON \u2014 Chest + Triceps\nBench Press 4x8 / Incline DB 3x10 / Cable Fly 3x12 / Skullcrushers 4x10 / Pushdowns 3x15\n\nTUE \u2014 Back + Biceps\nPull-ups 4xAMRAP / Barbell Row 4x8 / Lat Pulldown 3x12 / DB Curl 4x10 / Hammer Curl 3x12\n\nWED \u2014 Legs\nSquat 5x5 / RDL 4x8 / Leg Press 3x12 / Calf Raises 4x15\n\nTHU \u2014 Shoulders\nOHP 4x6 / Lateral Raise 4x12 / Rear Delt Fly 3x15 / Shrugs 4x10\n\nFRI \u2014 Arms\nCable Curl 4x12 / Tricep Pushdown 4x12 / Hammer Curl 3x10 / Overhead Tricep 3x12\n\nSAT \u2014 Cardio (45 min Zone 2)\nSUN \u2014 Rest', es:'LUN \u2014 Pecho + Tr\u00edceps\nPress Banca 4x8 / Inclinado DB 3x10 / Aperturas 3x12 / Patada Trasera 4x10 / Triceps Polea 3x15\n\nMAR \u2014 Espalda + B\u00edceps\nDominadas 4xAMRAP / Remo Barra 4x8 / Polea al Pecho 3x12 / Curl DB 4x10 / Curl Martillo 3x12\n\nMIE \u2014 Piernas\nSentadilla 5x5 / Peso Muerto Rumano 4x8 / Prensa 3x12 / Pantorrillas 4x15\n\nJUE \u2014 Hombros\nPress Militar 4x6 / Elevaci\u00f3n Lateral 4x12 / Posterior 3x15 / Encogimientos 4x10\n\nVIE \u2014 Brazos\nCurl Polea 4x12 / Triceps Polea 4x12 / Curl Martillo 3x10 / Triceps Sobre Cabeza 3x12\n\nSAB \u2014 Cardio (45 min Zona 2)\nDOM \u2014 Descanso', pt:'SEG \u2014 Peito + Tr\u00edceps\nSupino 4x8 / Inclinado Halteres 3x10 / Crucifixo Cabo 3x12 / Coice 4x10 / Tr\u00edceps Pulley 3x15\n\nTER \u2014 Costas + B\u00edceps\nBarra 4xAMRAP / Remada Curvada 4x8 / Pulldown 3x12 / Rosca Halteres 4x10 / Rosca Martelo 3x12\n\nQUA \u2014 Pernas\nAgachamento 5x5 / Stiff 4x8 / Leg Press 3x12 / Panturrilha 4x15\n\nQUI \u2014 Ombros\nDesenvolvimento 4x6 / Eleva\u00e7\u00e3o Lateral 4x12 / Crucifixo Inverso 3x15 / Encolhimento 4x10\n\nSEX \u2014 Bra\u00e7os\nRosca Pulley 4x12 / Tr\u00edceps Pulley 4x12 / Rosca Martelo 3x10 / Tr\u00edceps Franc\u00eas 3x12\n\nSAB \u2014 Cardio (45 min Zona 2)\nDOM \u2014 Descanso' },
'intg-aria':                       { en:'Paste your current workout routine for clinical audit', es:'Pega tu rutina actual para auditor\u00eda cl\u00ednica', pt:'Cole sua rotina atual para auditoria cl\u00ednica' },
'intg-counter-tmpl':               { en:'0 / 4000 chars',              es:'0 / 4000 carac',                  pt:'0 / 4000 carac' },
'intg-button':                     { en:'Audit My Protocol \u2192',       es:'Auditar Mi Protocolo \u2192',        pt:'Auditar Meu Protocolo \u2192' },
'intg-button-sub':                 { en:'Clinical breakdown \u00b7 ~10-second read', es:'An\u00e1lisis cl\u00ednico \u00b7 lectura de ~10 seg', pt:'An\u00e1lise cl\u00ednica \u00b7 leitura de ~10 seg' },

// Athlete Portal (Vault tp-athlete panel) \u00b7 header + 3 setup steps + protocol grid
'ap-kicker':                       { en:'Athlete Portal \u2022 Phase 1',   es:'Portal de Atleta \u2022 Fase 1',      pt:'Portal do Atleta \u2022 Fase 1' },
'ap-title-html':                   { en:'Athlete Portal<span class="y">:</span> Prepare for <span class="y">Game Day</span>', es:'Portal de Atleta<span class="y">:</span> Prep\u00e1rate para el <span class="y">D\u00eda del Juego</span>', pt:'Portal do Atleta<span class="y">:</span> Prepare-se para o <span class="y">Dia do Jogo</span>' },
'ap-sub':                          { en:'A dedicated command deck for youth and collegiate athletes. Dial in your sport, position, and season phase \u2014 we\'ll do the rest.', es:'Una plataforma de comando dedicada para atletas juveniles y universitarios. Ajusta tu deporte, posici\u00f3n y fase de temporada \u2014 nosotros hacemos el resto.', pt:'Uma plataforma de comando dedicada para atletas jovens e universit\u00e1rios. Ajuste seu esporte, posi\u00e7\u00e3o e fase da temporada \u2014 n\u00f3s cuidamos do resto.' },
'ap-step1-badge':                  { en:'Step 1',                      es:'Paso 1',                          pt:'Passo 1' },
'ap-step1-label':                  { en:'Select Sport',                es:'Selecciona Deporte',              pt:'Selecione o Esporte' },
'ap-sport-opt-choose':             { en:'\u2014 Choose sport \u2014',            es:'\u2014 Elige deporte \u2014',               pt:'\u2014 Escolha o esporte \u2014' },
'ap-sport-opt-football':           { en:'\ud83c\udfc8 American Football',        es:'\ud83c\udfc8 F\u00fatbol Americano',           pt:'\ud83c\udfc8 Futebol Americano' },
'ap-sport-opt-soccer':             { en:'\u26bd Soccer',                  es:'\u26bd F\u00fatbol',                       pt:'\u26bd Futebol' },
'ap-sport-opt-basketball':         { en:'\ud83c\udfc0 Basketball',              es:'\ud83c\udfc0 Baloncesto',                   pt:'\ud83c\udfc0 Basquete' },
'ap-sport-opt-baseball':           { en:'\u26be Baseball',                es:'\u26be B\u00e9isbol',                     pt:'\u26be Beisebol' },
'ap-sport-opt-volleyball':         { en:'\ud83c\udfd0 Volleyball',              es:'\ud83c\udfd0 Voleibol',                     pt:'\ud83c\udfd0 V\u00f4lei' },
'ap-sport-hint':                   { en:'Your sport shapes force-curve demands.', es:'Tu deporte define las demandas de curva de fuerza.', pt:'Seu esporte define as demandas de curva de for\u00e7a.' },
'ap-step2-badge':                  { en:'Step 2',                      es:'Paso 2',                          pt:'Passo 2' },
'ap-step2-label':                  { en:'Select Position Group',       es:'Selecciona Grupo de Posici\u00f3n',    pt:'Selecione o Grupo de Posi\u00e7\u00e3o' },
'ap-position-opt-choose':          { en:'\u2014 Choose sport first \u2014',      es:'\u2014 Elige deporte primero \u2014',       pt:'\u2014 Escolha o esporte primeiro \u2014' },
'ap-position-hint':                { en:'Position groups share training demands.', es:'Los grupos de posici\u00f3n comparten demandas de entrenamiento.', pt:'Grupos de posi\u00e7\u00e3o compartilham demandas de treino.' },
'ap-step3-badge':                  { en:'Step 3',                      es:'Paso 3',                          pt:'Passo 3' },
'ap-step3-label':                  { en:'Current Season Phase',        es:'Fase de Temporada Actual',        pt:'Fase Atual da Temporada' },
'ap-toggle-off-t':                 { en:'Off-Season',                  es:'Pretemporada',                    pt:'Pr\u00e9-Temporada' },
'ap-toggle-off-s':                 { en:'Hypertrophy',                 es:'Hipertrofia',                     pt:'Hipertrofia' },
'ap-toggle-in-t':                  { en:'In-Season',                   es:'En Temporada',                    pt:'Em Temporada' },
'ap-toggle-in-s':                  { en:'Game Day',                    es:'D\u00eda del Juego',                   pt:'Dia do Jogo' },
'ap-toggle-hint':                  { en:'Toggle anytime \u2014 protocol updates live.', es:'Cambia en cualquier momento \u2014 el protocolo se actualiza al instante.', pt:'Alterne a qualquer momento \u2014 o protocolo atualiza ao vivo.' },
'ap-protocol-kicker':              { en:'Clinical Protocol',           es:'Protocolo Cl\u00ednico',               pt:'Protocolo Cl\u00ednico' },
'ap-protocol-title-empty':         { en:'Awaiting Selection',          es:'Esperando Selecci\u00f3n',             pt:'Aguardando Sele\u00e7\u00e3o' },
'ap-protocol-meta-empty':          { en:'Choose your sport, position, and season phase to unlock your protocol.', es:'Elige tu deporte, posici\u00f3n y fase de temporada para desbloquear tu protocolo.', pt:'Escolha seu esporte, posi\u00e7\u00e3o e fase da temporada para desbloquear seu protocolo.' },
'ap-empty-t':                      { en:'Protocol locked',             es:'Protocolo bloqueado',             pt:'Protocolo bloqueado' },
'ap-empty-s':                      { en:'Complete all three selections above to reveal your Clinical Goal, Primary Lifts, Movement Science Drills, and Nutrition Protocol.', es:'Completa las tres selecciones arriba para revelar tu Meta Cl\u00ednica, Levantamientos Principales, Drills de Ciencia del Movimiento y Protocolo de Nutrici\u00f3n.', pt:'Complete as tr\u00eas sele\u00e7\u00f5es acima para revelar sua Meta Cl\u00ednica, Levantamentos Principais, Drills de Ci\u00eancia do Movimento e Protocolo de Nutri\u00e7\u00e3o.' },
'ap-proto-goal-h':                 { en:'Clinical Goal',               es:'Meta Cl\u00ednica',                    pt:'Meta Cl\u00ednica' },
'ap-proto-lifts-h':                { en:'Primary Lifts',               es:'Levantamientos Principales',      pt:'Levantamentos Principais' },
'ap-proto-drills-h':               { en:'Movement Science Drills',     es:'Drills de Ciencia del Movimiento', pt:'Drills de Ci\u00eancia do Movimento' },
'ap-proto-nutri-h':                { en:'Nutrition Protocol',          es:'Protocolo de Nutrici\u00f3n',          pt:'Protocolo de Nutri\u00e7\u00e3o' },
'pic-kicker':                      { en:'Positional Intelligence',     es:'Inteligencia Posicional',         pt:'Intelig\u00eancia Posicional' },
'pic-title':                       { en:'Explore Your Position',       es:'Explora Tu Posici\u00f3n',             pt:'Explore Sua Posi\u00e7\u00e3o' },
'pic-sub':                         { en:'State an athletic improvement you want to develop. The comlink queries the BBF founder-verified drill catalog for your sport & position and surfaces the right drill.', es:'Indica una mejora atl\u00e9tica que quieras desarrollar. El comlink consulta el cat\u00e1logo de drills verificado por el fundador BBF para tu deporte y posici\u00f3n y muestra el drill adecuado.', pt:'Indique uma melhoria atl\u00e9tica que queira desenvolver. O comlink consulta o cat\u00e1logo de drills verificado pelo fundador BBF para seu esporte e posi\u00e7\u00e3o e mostra o drill certo.' },
'pic-input-placeholder':           { en:'e.g. "I need a faster first step"', es:'ej. "Necesito un primer paso m\u00e1s r\u00e1pido"', pt:'ex. "Preciso de um primeiro passo mais r\u00e1pido"' },
'pic-input-aria':                  { en:'Athletic improvement query',  es:'Consulta de mejora atl\u00e9tica',     pt:'Consulta de melhoria atl\u00e9tica' },
'pic-submit':                      { en:'Query',                       es:'Consultar',                       pt:'Consultar' },
'pic-hint':                        { en:'Try: faster first step \u00b7 higher vertical \u00b7 lateral agility \u00b7 more rotational power', es:'Prueba: primer paso m\u00e1s r\u00e1pido \u00b7 salto vertical m\u00e1s alto \u00b7 agilidad lateral \u00b7 m\u00e1s potencia rotacional', pt:'Tente: primeiro passo mais r\u00e1pido \u00b7 salto vertical maior \u00b7 agilidade lateral \u00b7 mais pot\u00eancia rotacional' },
'ap-prog-cta-t':                   { en:'Mark Protocol Complete',      es:'Marcar Protocolo Completo',       pt:'Marcar Protocolo Completo' },
'ap-prog-cta-s':                   { en:'Unlocks the Athlete Form HUD', es:'Desbloquea el HUD de Forma del Atleta', pt:'Desbloqueia o HUD de Forma do Atleta' },
'ap-lock-t':                       { en:'Phase 2 \u00b7 Form HUD Locked',   es:'Fase 2 \u00b7 HUD de Forma Bloqueado', pt:'Fase 2 \u00b7 HUD de Forma Bloqueado' },
'ap-lock-s':                       { en:'Acknowledge protocol completion above to unlock the Athlete Kinematic Form HUD \u2014 biomechanical scanner with valgus collapse and ACL shear detection.', es:'Confirma la finalizaci\u00f3n del protocolo arriba para desbloquear el HUD de Forma Cinem\u00e1tica del Atleta \u2014 esc\u00e1ner biomec\u00e1nico con detecci\u00f3n de colapso de valgo y cizallamiento del LCA.', pt:'Confirme a conclus\u00e3o do protocolo acima para desbloquear o HUD de Forma Cinem\u00e1tica do Atleta \u2014 scanner biomec\u00e2nico com detec\u00e7\u00e3o de colapso de valgo e cisalhamento do LCA.' },

// Omniscience Toggle \u00b7 JS-rendered button (admin-only floating control \u00b7 paying clients never see it \u00b7 operator does)
'omni-title-on':                   { en:'Omniscience ON \u2014 all 4 agents bypassed with admin mocks. Tap to disengage.', es:'Omnisciencia ACTIVA \u2014 los 4 agentes bypassados con mocks de admin. Toca para desactivar.', pt:'Onisci\u00eancia ATIVA \u2014 todos os 4 agentes desviados com mocks de admin. Toque para desativar.' },
'omni-title-off':                  { en:'Omniscience OFF \u2014 agents fire live Claude calls. Tap to engage admin mock mode.', es:'Omnisciencia INACTIVA \u2014 los agentes disparan llamadas Claude en vivo. Toca para activar modo mock de admin.', pt:'Onisci\u00eancia INATIVA \u2014 os agentes disparam chamadas Claude ao vivo. Toque para ativar modo mock de admin.' },
'omni-label-on':                   { en:'OMNISCIENCE&nbsp;ON',         es:'OMNISCIENCIA&nbsp;ACTIVA',        pt:'ONISCI\u00caNCIA&nbsp;ATIVA' },
'omni-sub-on':                     { en:'all agents bypassed',         es:'todos los agentes bypassados',    pt:'todos os agentes desviados' },
'omni-label-off':                  { en:'OMNISCIENCE',                 es:'OMNISCIENCIA',                    pt:'ONISCI\u00caNCIA' },
'omni-sub-off':                    { en:'tap to engage',               es:'toca para activar',               pt:'toque para ativar' }
};

// ─── ENGINE ────────────────────────────────────────────────────
// Element-level: data-lang-key="K"   → swaps textContent (or innerHTML if value contains '<').
// Attribute-level: data-lang-attr-<NAME>="K" → swaps the <NAME> attribute.
//   Supported NAMEs: placeholder, aria-label, title, alt, value · cover the
//   gaps that pure textContent translation can't reach (form inputs, ARIA,
//   image alts, button value attrs).
// Both can coexist on the same element. Missing dict entries are skipped
// silently so partial coverage during a rollout doesn't blank the UI.
var LANG_ATTR_TARGETS = ['placeholder', 'aria-label', 'title', 'alt', 'value'];

function apply() {
  // 1 · Text content
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
  // 2 · Attribute translations
  for (var a = 0; a < LANG_ATTR_TARGETS.length; a++) {
    var attrName = LANG_ATTR_TARGETS[a];
    var dataAttr = 'data-lang-attr-' + attrName;
    var attrEls  = document.querySelectorAll('[' + dataAttr + ']');
    for (var j = 0; j < attrEls.length; j++) {
      var ak = attrEls[j].getAttribute(dataAttr);
      if (D[ak] && D[ak][LANG] !== undefined && D[ak][LANG] !== '') {
        attrEls[j].setAttribute(attrName, D[ak][LANG]);
      }
    }
  }
}

function setLang(l) {
  LANG = l;
  localStorage.setItem('bbf_lang', l);
  apply();
  updateToggles(l);
  // Notify JS-rendered UIs that build innerHTML via _t() lookups · they don't
  // carry data-lang-key tags so apply() doesn't reach them. Listeners should
  // re-render themselves to pick up the new language.
  try {
    if (typeof document !== 'undefined' && typeof document.dispatchEvent === 'function') {
      document.dispatchEvent(new CustomEvent('bbf-lang-changed', { detail: { lang: l } }));
    }
  } catch (_) {}
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
