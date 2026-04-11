// BBF-LANG.JS v6 — Build Believe Fit LLC — COMPLETE TRILINGUAL ENGINE
(function() {
  'use strict';
  var LANG = localStorage.getItem('bbf_lang') || 'en';

  var T = {
    // ── NAV ──────────────────────────────────────────────────────────
    'nav-services': { en:'Services', es:'Servicios', pt:'Serviços' },
    'nav-programs': { en:'Programs', es:'Programas', pt:'Programas' },
    'nav-nutrition':{ en:'Nutrition', es:'Nutrición', pt:'Nutrição' },
    'nav-results':  { en:'Results',  es:'Resultados', pt:'Resultados' },
    'nav-about':    { en:'About',    es:'Sobre mí',   pt:'Sobre mim' },
    'nav-start':    { en:'Start',    es:'Empezar',    pt:'Começar' },
    'nav-mystory':  { en:'My Story', es:'Mi Historia', pt:'Minha História' },

    // ── HERO ─────────────────────────────────────────────────────────
    'hero-badge':  { en:'&#x26A1; NASM-Certified &bull; Industrial Athlete Specialist', es:'&#x26A1; Certificado NASM &bull; Especialista en Atletas Industriales', pt:'&#x26A1; Certificado NASM &bull; Especialista em Atletas Industriais' },
    'hero-sub':    { en:'Elite performance for the <strong>high-demand life.</strong> Whether you\'re on the factory floor, in the boardroom, or on the front lines &mdash; <strong>your body deserves a system built for how you actually live.</strong>', es:'Rendimiento élite para la <strong>vida de alta demanda.</strong> Ya sea en la línea de producción, en la sala de juntas, o en la primera línea &mdash; <strong>tu cuerpo merece un sistema construido para tu realidad.</strong>', pt:'Performance de elite para a <strong>vida de alta demanda.</strong> Seja no chão de fábrica, na sala de reuniões ou na linha de frente &mdash; <strong>seu corpo merece um sistema construído para sua realidade.</strong>' },
    'hero-cta':    { en:'Start My Path &#x2192;', es:'Comienza Tu Camino &#x2192;', pt:'Comece Sua Jornada &#x2192;' },
    'hero-portal': { en:'&#x1F4F2; Client Portal', es:'&#x1F4F2; Portal del Cliente', pt:'&#x1F4F2; Portal do Cliente' },
    'stat-clients':{ en:'Active Clients', es:'Clientes Activos', pt:'Clientes Ativos' },
    'stat-cert':   { en:'Certified CPT', es:'Certificado CPT', pt:'CPT Certificado' },
    'stat-plans':  { en:'Custom Plans', es:'Planes Personalizados', pt:'Planos Personalizados' },

    // ── SERVICES ─────────────────────────────────────────────────────
    'svc-lbl': { en:'What We Offer', es:'Lo Que Ofrecemos', pt:'O Que Oferecemos' },
    'svc-h':   { en:'How We Get You There', es:'Cómo Llegamos Juntos', pt:'Como Chegamos Juntos' },
    'svc-n1':  { en:'Strength Coaching', es:'Entrenamiento de Fuerza', pt:'Treinamento de Força' },
    'svc-n2':  { en:'Nutrition Coaching', es:'Coaching Nutricional', pt:'Coaching Nutricional' },
    'svc-n3':  { en:'Program Design', es:'Diseño de Programa', pt:'Design de Programa' },
    'svc-n4':  { en:'Elite Transformation', es:'Transformación Élite', pt:'Transformação Elite' },
    'svc-n5':  { en:'Remote Coaching', es:'Coaching Remoto', pt:'Coaching Remoto' },
    'svc-n6':  { en:'High-Demand Life Protocol', es:'Protocolo de Vida de Alta Demanda', pt:'Protocolo de Vida de Alta Demanda' },
    'svc-d1':  { en:'Progressive overload programming built around your schedule, recovery capacity, and goals. Not a template — a system designed for you.', es:'Programación de sobrecarga progresiva diseñada para tu horario, capacidad de recuperación y objetivos. No es una plantilla — es un sistema para ti.', pt:'Programação de sobrecarga progressiva construída ao redor do seu horário, capacidade de recuperação e objetivos. Não é um modelo — é um sistema para você.' },
    'svc-d2':  { en:'Custom meal plans calibrated to your TDEE, your training intensity, and your real life — not a generic macro split from the internet.', es:'Planes de alimentación personalizados calibrados a tu TDEE, intensidad de entrenamiento y vida real — no un macro split genérico del internet.', pt:'Planos alimentares personalizados calibrados ao seu TDEE, intensidade de treinamento e vida real — não uma divisão de macros genérica da internet.' },
    'svc-d3':  { en:'Day-by-day periodized programs designed for real people with real jobs. Recovery built in. Progress guaranteed when you follow the plan.', es:'Programas periodizados día a día diseñados para personas reales con trabajos reales. Recuperación integrada. Progreso garantizado cuando sigues el plan.', pt:'Programas periodizados dia a dia projetados para pessoas reais com trabalhos reais. Recuperação integrada. Progresso garantido quando você segue o plano.' },
    'svc-d4':  { en:'Full 90-day overhaul — body composition, movement quality, and habit architecture. The complete package for serious, lasting results.', es:'Revisión completa de 90 días — composición corporal, calidad de movimiento y arquitectura de hábitos. El paquete completo para resultados serios y duraderos.', pt:'Revisão completa de 90 dias — composição corporal, qualidade de movimento e arquitetura de hábitos. O pacote completo para resultados sérios e duradouros.' },
    'svc-d5':  { en:'Full access to your custom app portal, weekly check-ins, meal plan updates, and direct coach access — wherever you train.', es:'Acceso completo a tu portal de app personalizado, check-ins semanales, actualizaciones del plan de comidas y acceso directo al entrenador — donde quiera que entrenes.', pt:'Acesso completo ao seu portal de app personalizado, check-ins semanais, atualizações do plano alimentar e acesso direto ao treinador — onde quer que você treine.' },
    'svc-d6':  { en:'Programming built around YOUR reality — rotating shifts, executive travel, hospital floors, emergency calls, or raising kids full-time. Train smarter, not just harder.', es:'Programación construida alrededor de TU realidad — turnos rotativos, viajes ejecutivos, pisos hospitalarios, llamadas de emergencia, o criar hijos a tiempo completo. Entrena más inteligente, no solo más duro.', pt:'Programação construída ao redor da SUA realidade — turnos rotativos, viagens executivas, andares hospitalares, chamadas de emergência ou criar filhos em tempo integral. Treine mais inteligente, não apenas mais duro.' },

    // ── FOUNDER ───────────────────────────────────────────────────────
    'founder-lbl': { en:'The Founder', es:'El Fundador', pt:'O Fundador' },
    'founder-h':   { en:'The Story<br>Behind <span class="y">BBF</span>', es:'La Historia<br>Detrás de <span class="y">BBF</span>', pt:'A História<br>Por Trás do <span class="y">BBF</span>' },
    'founder-p1':  { en:'I run <strong>12-hour shifts on the manufacturing floor.</strong> I come home tired, feet sore, body taxed. And then I train. Not because I have to &mdash; because I <strong>choose to.</strong> Because I refuse to let the grind define my ceiling.', es:'Trabajo <strong>turnos de 12 horas en el piso de manufactura.</strong> Llego a casa cansado, pies adoloridos, cuerpo agotado. Y luego entreno. No porque tenga que hacerlo &mdash; sino porque <strong>elijo hacerlo.</strong> Porque me niego a que el trabajo duro defina mi techo.', pt:'Trabalho <strong>turnos de 12 horas no chão de fábrica.</strong> Chego em casa cansado, pés doloridos, corpo esgotado. E então treino. Não porque preciso &mdash; mas porque <strong>escolho.</strong> Porque me recuso a deixar que a luta defina meu limite.' },
    'founder-p2':  { en:'Build Believe Fit wasn\'t born in a fancy gym with unlimited time and energy. It was built between shifts, in parking lots, in the 45 minutes I carved out when everyone else was resting. I\'m a <strong>NASM-certified trainer, a competitive bodybuilder, a father of 4</strong>, and an industrial athlete who understands what it actually costs to change your body when life doesn\'t pause.', es:'Build Believe Fit no nació en un gimnasio elegante con tiempo y energía ilimitados. Se construyó entre turnos, en estacionamientos, en los 45 minutos que encontré cuando todos los demás descansaban. Soy un <strong>entrenador certificado por NASM, culturista competitivo, padre de 4</strong> y atleta industrial que entiende lo que realmente cuesta cambiar tu cuerpo cuando la vida no hace pausa.', pt:'Build Believe Fit não nasceu em uma academia luxuosa com tempo e energia ilimitados. Foi construído entre turnos, em estacionamentos, nos 45 minutos que encontrei quando todos os outros estavam descansando. Sou um <strong>treinador certificado pela NASM, fisiculturista competitivo, pai de 4</strong> e atleta industrial que entende o que realmente custa mudar seu corpo quando a vida não faz pausa.' },
    'founder-p3':  { en:'My clients aren\'t influencers. They\'re <strong>workers. Grinders. People who show up.</strong> I build systems that work for real lives &mdash; because mine is one of them.', es:'Mis clientes no son influencers. Son <strong>trabajadores. Luchadores. Personas que se presentan.</strong> Construyo sistemas que funcionan para vidas reales &mdash; porque la mía es una de ellas.', pt:'Meus clientes não são influenciadores. São <strong>trabalhadores. Guerreiros. Pessoas que aparecem.</strong> Construo sistemas que funcionam para vidas reais &mdash; porque a minha é uma delas.' },

    // ── PROGRAMS ──────────────────────────────────────────────────────
    'prog-path-lbl':  { en:'Choose Your Path', es:'Elige Tu Camino', pt:'Escolha Seu Caminho' },
    'prog-section-h': { en:'Spectrum of <span class="y">Success</span>', es:'Espectro del <span class="y">Éxito</span>', pt:'Espectro do <span class="y">Sucesso</span>' },
    'prog-section-sub':{ en:'We respect every dollar you invest. Whether it\'s $67 or $2,500, you receive a clinical, OT-informed return on that investment.', es:'Respetamos cada dólar que inviertes. Ya sea $67 o $2,500, recibes un retorno clínico e informado por TO en esa inversión.', pt:'Respeitamos cada dólar que você investe. Seja $67 ou $2.500, você recebe um retorno clínico e baseado em TO nesse investimento.' },
    'prog-t1-tier':  { en:'Community Tier', es:'Nivel Comunitario', pt:'Nível Comunitário' },
    'prog-t1-price': { en:'$67 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">one-time</span>', es:'$67 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">único pago</span>', pt:'$67 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">pagamento único</span>' },
    'prog-n1':       { en:'Community<br>Blueprint', es:'Proyecto<br>Comunitario', pt:'Projeto<br>Comunitário' },
    'prog-t1-badge': { en:'🌱 Self-Guided Roadmap — High Value, Zero Fluff', es:'🌱 Hoja de Ruta Autoguiada — Alto Valor, Sin Relleno', pt:'🌱 Roteiro Autoguiado — Alto Valor, Sem Enrolação' },
    'prog-t1-f1':    { en:'Full self-guided 8-week training plan', es:'Plan de entrenamiento autoguiado completo de 8 semanas', pt:'Plano de treinamento autoguiado completo de 8 semanas' },
    'prog-t1-f2':    { en:'TDEE calculator + macro blueprint', es:'Calculadora de TDEE + plan de macros', pt:'Calculadora de TDEE + plano de macros' },
    'prog-t1-f3':    { en:'BBF App access (workout tracking)', es:'Acceso a la app BBF (seguimiento de entrenamientos)', pt:'Acesso ao app BBF (rastreamento de treinos)' },
    'prog-t1-f4':    { en:'Community Resource video modules', es:'Módulos de video de recursos comunitarios', pt:'Módulos de vídeo de recursos comunitários' },
    'prog-t1-f5':    { en:'OT-informed joint health guide (PDF)', es:'Guía de salud articular informada por TO (PDF)', pt:'Guia de saúde articular baseado em TO (PDF)' },
    'prog-t1-no1':   { en:'Live coaching sessions', es:'Sesiones de coaching en vivo', pt:'Sessões de coaching ao vivo' },
    'prog-t1-no2':   { en:'Custom meal plan', es:'Plan de comidas personalizado', pt:'Plano alimentar personalizado' },
    'prog-t1-cta':   { en:'Start for $67 →', es:'Comenzar por $67 →', pt:'Começar por $67 →' },
    'prog-t2-tier':  { en:'Flagship Program', es:'Programa Principal', pt:'Programa Principal' },
    'prog-t2-price': { en:'$497', es:'$497', pt:'$497' },
    'prog-n2':       { en:'Elite 8-Week<br>Challenge', es:'Desafío Élite<br>8 Semanas', pt:'Desafio Elite<br>8 Semanas' },
    'prog-t2-badge': { en:'⚡ Group + Hybrid — The Flagship Transformation', es:'⚡ Grupal + Híbrido — La Transformación Principal', pt:'⚡ Grupo + Híbrido — A Transformação Principal' },
    'prog-t2-f1':    { en:'Everything in Community Blueprint', es:'Todo en el Proyecto Comunitario', pt:'Tudo no Projeto Comunitário' },
    'prog-t2-f2':    { en:'Custom 7-day meal plan (yours specifically)', es:'Plan de comidas personalizado de 7 días (el tuyo específicamente)', pt:'Plano alimentar personalizado de 7 dias (o seu especificamente)' },
    'prog-t2-f3':    { en:'Full BBF App — all features unlocked', es:'App BBF completa — todas las funciones desbloqueadas', pt:'App BBF completo — todos os recursos desbloqueados' },
    'prog-t2-f4':    { en:'Bi-weekly group coaching sessions', es:'Sesiones de coaching grupal quincenales', pt:'Sessões de coaching em grupo quinzenais' },
    'prog-t2-f5':    { en:'Progressive overload tracking built in', es:'Seguimiento de sobrecarga progresiva integrado', pt:'Rastreamento de sobrecarga progressiva integrado' },
    'prog-t2-f6':    { en:'Masterclass Vault — all 6 modules', es:'Bóveda Masterclass — los 6 módulos', pt:'Vault de Masterclass — todos os 6 módulos' },
    'prog-t2-f7':    { en:'Trilingual support (EN / ES / PT)', es:'Soporte trilingüe (EN / ES / PT)', pt:'Suporte trilíngue (EN / ES / PT)' },
    'prog-t2-cta':   { en:'Start Elite →', es:'Comenzar Élite →', pt:'Começar Elite →' },
    'prog-t3-tier':  { en:'Executive &amp; Clinical', es:'Ejecutivo y Clínico', pt:'Executivo e Clínico' },
    'prog-t3-price': { en:'$1,500 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">– $2,500</span>', es:'$1,500 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">– $2,500</span>', pt:'$1.500 <span style="font-size:.7rem;font-weight:600;color:var(--mut2)">– $2.500</span>' },
    'prog-n3':       { en:'Legacy Performance<br>Protocol', es:'Protocolo de<br>Legado', pt:'Protocolo de<br>Legado' },
    'prog-t3-badge': { en:'🏛 1-on-1 Bespoke — Clinical OT-Informed Coaching', es:'🏛 1 a 1 a Medida — Coaching Clínico Informado por TO', pt:'🏛 1 a 1 Sob Medida — Coaching Clínico Baseado em TO' },
    'prog-t3-f1':    { en:'Everything in Elite Challenge', es:'Todo en el Desafío Élite', pt:'Tudo no Desafio Elite' },
    'prog-t3-f2':    { en:'Fully bespoke weekly program design', es:'Diseño de programa semanal completamente personalizado', pt:'Design de programa semanal totalmente personalizado' },
    'prog-t3-f3':    { en:'OT-clinical movement &amp; longevity assessment', es:'Evaluación de movimiento clínico-TO y longevidad', pt:'Avaliação de movimento clínico-TO e longevidade' },
    'prog-t3-f4':    { en:'Weekly 1-on-1 coaching sessions with Akeem', es:'Sesiones semanales de coaching 1 a 1 con Akeem', pt:'Sessões semanais de coaching 1 a 1 com Akeem' },
    'prog-t3-f5':    { en:'Executive travel &amp; schedule adaptation', es:'Adaptación a viajes ejecutivos y horarios', pt:'Adaptação a viagens executivas e horários' },
    'prog-t3-f6':    { en:'Priority 24-hour direct access', es:'Acceso directo prioritario 24 horas', pt:'Acesso direto prioritário 24 horas' },
    'prog-t3-f7':    { en:'Multi-language sessions available', es:'Sesiones en múltiples idiomas disponibles', pt:'Sessões em múltiplos idiomas disponíveis' },
    'prog-t3-cta':   { en:'Apply for Legacy →', es:'Aplicar para Legado →', pt:'Aplicar para Legado →' },
    'fin-title':     { en:'The BBF Financial Integrity Promise', es:'La Promesa de Integridad Financiera de BBF', pt:'A Promessa de Integridade Financeira do BBF' },
    'fin-quote':     { en:'&ldquo;Whether you invest $67 or $2,500 — you receive the same clinical-level OT-informed attention to your joint safety, your recovery, and your long-term mobility. The price reflects access. The standard never changes.&rdquo;', es:'&ldquo;Ya sea que inviertas $67 o $2,500 — recibes la misma atención clínica informada por TO para la seguridad de tus articulaciones, tu recuperación y tu movilidad a largo plazo. El precio refleja el acceso. El estándar nunca cambia.&rdquo;', pt:'&ldquo;Seja você invista $67 ou $2.500 — você recebe a mesma atenção clínica baseada em TO para a segurança das suas articulações, sua recuperação e sua mobilidade a longo prazo. O preço reflete o acesso. O padrão nunca muda.&rdquo;' },

    // ── NUTRITION ─────────────────────────────────────────────────────
    'nut-lbl':   { en:'Nutrition Coaching', es:'Coaching Nutricional', pt:'Coaching Nutricional' },
    'nut-h':     { en:'Fuel The <span class="y">Right Way</span>', es:'Combustible de la <span class="y">Manera Correcta</span>', pt:'Combustível do <span class="y">Jeito Certo</span>' },
    'nut-sub':   { en:'NASM-certified nutrition coaching. Personalized meal plans aligned with your training, lifestyle, and physique goals.', es:'Coaching nutricional certificado por NASM. Planes de comidas personalizados alineados con tu entrenamiento, estilo de vida y objetivos físicos.', pt:'Coaching nutricional certificado pela NASM. Planos alimentares personalizados alinhados ao seu treinamento, estilo de vida e objetivos físicos.' },
    'nut-n1':    { en:'Lite', es:'Básico', pt:'Básico' },
    'nut-n2':    { en:'Essentials', es:'Esenciales', pt:'Essenciais' },
    'nut-n3':    { en:'Platinum', es:'Platino', pt:'Platina' },
    'nut-t1-f1': { en:'TDEE &amp; Calorie Target', es:'TDEE y Objetivo Calórico', pt:'TDEE e Meta Calórica' },
    'nut-t1-f2': { en:'Macro breakdown (P/C/F)', es:'Desglose de macros (P/C/G)', pt:'Detalhamento de macros (P/C/G)' },
    'nut-t1-f3': { en:'General food guidance', es:'Orientación general de alimentación', pt:'Orientação geral de alimentação' },
    'nut-t1-f4': { en:'One-time setup consultation', es:'Consulta de configuración única', pt:'Consulta de configuração única' },
    'nut-t2-f1': { en:'Everything in Lite', es:'Todo en Básico', pt:'Tudo em Básico' },
    'nut-t2-f2': { en:'Custom 7-day meal plan', es:'Plan de comidas personalizado de 7 días', pt:'Plano alimentar personalizado de 7 dias' },
    'nut-t2-f3': { en:'Food swap guide by portion', es:'Guía de sustitución de alimentos por porción', pt:'Guia de substituição de alimentos por porção' },
    'nut-t2-f4': { en:'Nutrition portal access', es:'Acceso al portal de nutrición', pt:'Acesso ao portal de nutrição' },
    'nut-t2-f5': { en:'Bi-weekly plan updates', es:'Actualizaciones quincenales del plan', pt:'Atualizações quinzenais do plano' },
    'nut-t3-f1': { en:'Everything in Essentials', es:'Todo en Esenciales', pt:'Tudo em Essenciais' },
    'nut-t3-f2': { en:'Weekly adaptive meal updates', es:'Actualizaciones semanales adaptativas de comidas', pt:'Atualizações semanais adaptativas de refeições' },
    'nut-t3-f3': { en:'Training + Nutrition synced', es:'Entrenamiento + Nutrición sincronizados', pt:'Treino + Nutrição sincronizados' },
    'nut-t3-f4': { en:'Priority daily messaging', es:'Mensajería diaria prioritaria', pt:'Mensagens diárias prioritárias' },
    'nut-t3-f5': { en:'Weekly progress reviews', es:'Revisiones semanales de progreso', pt:'Revisões semanais de progresso' },
    'tdee-h':    { en:'Calculate Your TDEE', es:'Calcula Tu TDEE', pt:'Calcule Seu TDEE' },

    // ── TESTIMONIALS ──────────────────────────────────────────────────
    'testi-lbl': { en:'Client Results', es:'Resultados de Clientes', pt:'Resultados de Clientes' },
    'testi-h':   { en:'Real People. <span class="y">Real Work.</span>', es:'Personas Reales. <span class="y">Trabajo Real.</span>', pt:'Pessoas Reais. <span class="y">Trabalho Real.</span>' },
    'testi-q1':  { en:'"Akeem built my program around my factory schedule. I\'m training 5 days a week, down 22 lbs, and hitting PRs I never thought possible. He knows what it actually takes."', es:'"Akeem construyó mi programa alrededor de mi horario de fábrica. Entreno 5 días a la semana, bajé 22 lbs y estoy logrando récords que nunca creí posibles. Él sabe lo que realmente se necesita."', pt:'"Akeem construiu meu programa ao redor do meu horário de fábrica. Estou treinando 5 dias por semana, perdi 22 lbs e estou batendo recordes que nunca achei possíveis. Ele sabe o que realmente é necessário."' },
    'testi-m1':  { en:'Lost 22 lbs &bull; 6 months', es:'Perdió 22 lbs &bull; 6 meses', pt:'Perdeu 22 lbs &bull; 6 meses' },
    'testi-q2':  { en:'"The app is insane &mdash; I can see my meal plan, log my workouts, and track my progress all in one place. But it\'s the coaching that makes the difference. Akeem is locked in."', es:'"La app es increíble &mdash; puedo ver mi plan de comidas, registrar mis entrenamientos y seguir mi progreso todo en un lugar. Pero es el coaching lo que marca la diferencia. Akeem está totalmente comprometido."', pt:'"O app é incrível &mdash; posso ver meu plano alimentar, registrar meus treinos e acompanhar meu progresso em um só lugar. Mas é o coaching que faz a diferença. Akeem está totalmente comprometido."' },
    'testi-m2':  { en:'Body recomposition &bull; 4 months', es:'Recomposición corporal &bull; 4 meses', pt:'Recomposição corporal &bull; 4 meses' },
    'testi-q3':  { en:'"I was skeptical at first but the results don\'t lie. Down 18 lbs, my energy is through the roof, and I finally feel confident in the gym. Akeem knows exactly how to push you without burning you out."', es:'"Al principio era escéptica pero los resultados no mienten. Bajé 18 lbs, mi energía está por las nubes y finalmente me siento segura en el gimnasio. Akeem sabe exactamente cómo empujarte sin agotarte."', pt:'"No começo era cética mas os resultados não mentem. Perdi 18 lbs, minha energia está nas alturas e finalmente me sinto confiante na academia. Akeem sabe exatamente como te empurrar sem te esgotar."' },
    'testi-m3':  { en:'Strength &bull; 3 months', es:'Fuerza &bull; 3 meses', pt:'Força &bull; 3 meses' },

    // ── TRANSFORMATION ────────────────────────────────────────────────
    'trans-proof-lbl': { en:'The Proof Is In The Work', es:'La Prueba Está en el Trabajo', pt:'A Prova Está no Trabalho' },
    'trans-section-h': { en:'This Is Why <span class="y">BBF Exists</span>', es:'Por Eso Existe <span class="y">BBF</span>', pt:'Por Isso Existe o <span class="y">BBF</span>' },
    'trans-tagline':   { en:'Not a program built from a textbook. Built from rock bottom &mdash; and back.', es:'No es un programa construido desde un libro de texto. Construido desde el fondo &mdash; y de vuelta.', pt:'Não é um programa construído de um livro didático. Construído do fundo &mdash; e de volta.' },
    'panel-feeling':   { en:'The Feeling', es:'El Sentimiento', pt:'O Sentimento' },
    'panel-q1':        { en:'&ldquo;Lost. Depressed. No time for myself. Running out of chances to become who I knew I could be.&rdquo;', es:'&ldquo;Perdido. Deprimido. Sin tiempo para mí mismo. Agotando las oportunidades de convertirme en quien sabía que podía ser.&rdquo;', pt:'&ldquo;Perdido. Deprimido. Sem tempo para mim mesmo. Esgotando as chances de me tornar quem eu sabia que poderia ser.&rdquo;' },
    'panel-craft':     { en:'Learning The Craft', es:'Aprendiendo el Arte', pt:'Aprendendo a Arte' },
    'panel-q2':        { en:'&ldquo;I decided to go all in. NASM Certified. Exercise Science. The discipline to learn became as important as the discipline to train.&rdquo;', es:'&ldquo;Decidí apostarlo todo. Certificado NASM. Ciencias del Ejercicio. La disciplina para aprender se volvió tan importante como la disciplina para entrenar.&rdquo;', pt:'&ldquo;Decidi apostar tudo. Certificado NASM. Ciências do Exercício. A disciplina para aprender tornou-se tão importante quanto a disciplina para treinar.&rdquo;' },
    'panel-ripple':    { en:'The Ripple Effect', es:'El Efecto Dominó', pt:'O Efeito Cascata' },
    'panel-q3':        { en:'&ldquo;One decision changed everything. My body. My career. My family\'s future. Now that ripple reaches every client I coach.&rdquo;', es:'&ldquo;Una decisión lo cambió todo. Mi cuerpo. Mi carrera. El futuro de mi familia. Ahora ese efecto dominó llega a cada cliente que entreno.&rdquo;', pt:'&ldquo;Uma decisão mudou tudo. Meu corpo. Minha carreira. O futuro da minha família. Agora esse efeito cascata chega a cada cliente que treino.&rdquo;' },
    'journey-lbl':     { en:'The Full Journey', es:'El Viaje Completo', pt:'A Jornada Completa' },
    'trans-p1': { en:'I know what it feels like to look in the mirror and not recognize yourself. To feel like time is the enemy — like between the job, the kids, the shifts, and just surviving — there\'s nothing left for <em>you.</em>', es:'Sé lo que se siente al mirarse al espejo y no reconocerse. Sentir que el tiempo es el enemigo — que entre el trabajo, los hijos, los turnos y solo sobrevivir — no queda nada para <em>ti.</em>', pt:'Eu sei como é olhar no espelho e não se reconhecer. Sentir que o tempo é o inimigo — que entre o trabalho, os filhos, os turnos e apenas sobreviver — não sobra nada para <em>você.</em>' },
    'trans-p2': { en:'That picture on the left is not just a body. That\'s someone who had stopped believing the window was still open. Someone who felt <strong style="color:var(--wht)">alone in the journey.</strong>', es:'Esa foto de la izquierda no es solo un cuerpo. Es alguien que había dejado de creer que la ventana aún estaba abierta. Alguien que se sentía <strong style="color:var(--wht)">solo en el camino.</strong>', pt:'Aquela foto à esquerda não é apenas um corpo. É alguém que havia parado de acreditar que a janela ainda estava aberta. Alguém que se sentia <strong style="color:var(--wht)">sozinho na jornada.</strong>' },
    'trans-p3': { en:'Build Believe Fit exists because of that feeling. Because <strong style="color:var(--yel)">nobody should feel like there isn\'t enough time, enough energy, or enough support to become who they\'re meant to be.</strong> The window is always open. You just need the right system and someone who actually gets it.', es:'Build Believe Fit existe por ese sentimiento. Porque <strong style="color:var(--yel)">nadie debería sentir que no hay suficiente tiempo, energía ni apoyo para convertirse en quien está destinado a ser.</strong> La ventana siempre está abierta. Solo necesitas el sistema correcto y a alguien que realmente lo entienda.', pt:'Build Believe Fit existe por causa desse sentimento. Porque <strong style="color:var(--yel)">ninguém deveria sentir que não há tempo suficiente, energia suficiente ou apoio suficiente para se tornar quem deve ser.</strong> A janela está sempre aberta. Você só precisa do sistema certo e de alguém que realmente entenda.' },
    'enough-quote': { en:'Enough Is Enough Was The Most Powerful Decision I Ever Made. Now I Help Others Make It Too.', es:'Suficiente Es Suficiente Fue La Decisión Más Poderosa Que Tomé. Ahora Ayudo a Otros a Hacer Lo Mismo.', pt:'Chega É Chega Foi a Decisão Mais Poderosa Que Tomei. Agora Ajudo Outros a Fazerem o Mesmo.' },

    // ── PATHFINDER ────────────────────────────────────────────────────
    'sec-path-lbl':  { en:'Start Your Journey', es:'Comienza Tu Viaje', pt:'Comece Sua Jornada' },
    'path-h':        { en:'The <span class="y">Pathfinder</span>', es:'El <span class="y">Buscador</span>', pt:'O <span class="y">Explorador</span>' },
    'path-sub':      { en:'4 quick steps. We\'ll calculate your personalized targets and Akeem will reach out within 24 hours.', es:'4 pasos rápidos. Calcularemos tus objetivos personalizados y Akeem se comunicará contigo en 24 horas.', pt:'4 passos rápidos. Calcularemos seus objetivos e Akeem entrará em contato em 24 horas.' },
    'fs0-title':     { en:'Who Are You?', es:'¿Quién Eres?', pt:'Quem Você É?' },
    'fs0-sub':       { en:'Tell us about yourself — we\'ll personalize everything.', es:'Cuéntanos sobre ti — personalizaremos todo.', pt:'Nos conte sobre você — personalizaremos tudo.' },
    'fs1-title':     { en:'Your Stats', es:'Tus Estadísticas', pt:'Suas Estatísticas' },
    'fs1-sub':       { en:'Used to calculate your personalized TDEE and calorie targets.', es:'Usadas para calcular tu TDEE personalizado y objetivos calóricos.', pt:'Usadas para calcular seu TDEE personalizado e metas calóricas.' },
    'fs2-title':     { en:'Your Goal', es:'Tu Objetivo', pt:'Seu Objetivo' },
    'fs2-sub':       { en:'What are you training for?', es:'¿Para qué estás entrenando?', pt:'Para que você está treinando?' },
    'fs3-title':     { en:'Final Details', es:'Detalles Finales', pt:'Detalhes Finais' },
    'fs3-sub':       { en:'Almost there. This helps Akeem prepare before reaching out.', es:'Casi listo. Esto ayuda a Akeem a prepararse antes de comunicarse.', pt:'Quase lá. Isso ajuda Akeem a se preparar antes de entrar em contato.' },
    'btn-next-stats':{ en:'Next: Your Stats &#x2192;', es:'Siguiente: Tus Estadísticas &#x2192;', pt:'Próximo: Suas Estatísticas &#x2192;' },
    'btn-next-goal': { en:'Next: Your Goal &#x2192;', es:'Siguiente: Tu Objetivo &#x2192;', pt:'Próximo: Seu Objetivo &#x2192;' },
    'btn-next-final':{ en:'Next: Final Step &#x2192;', es:'Siguiente: Paso Final &#x2192;', pt:'Próximo: Passo Final &#x2192;' },
    'btn-back':      { en:'&#x2190; Back', es:'&#x2190; Atrás', pt:'&#x2190; Voltar' },
    'btn-submit':    { en:'Calculate My Path &amp; Submit &#x2192;', es:'Calcular Mi Camino y Enviar &#x2192;', pt:'Calcular Meu Caminho e Enviar &#x2192;' },

    // ── FORM LABELS ───────────────────────────────────────────────────
    'lbl-age':       { en:'Age', es:'Edad', pt:'Idade' },
    'lbl-sex':       { en:'Sex', es:'Sexo', pt:'Sexo' },
    'lbl-weight':    { en:'Weight (lbs)', es:'Peso (lbs)', pt:'Peso (lbs)' },
    'lbl-height':    { en:'Height (ft / in)', es:'Altura (ft / in)', pt:'Altura (ft / pol)' },
    'lbl-activity':  { en:'Activity Level', es:'Nivel de Actividad', pt:'Nível de Atividade' },
    'lbl-goal':      { en:'Goal', es:'Objetivo', pt:'Objetivo' },
    'lbl-firstname': { en:'First Name', es:'Nombre', pt:'Nome' },
    'lbl-lastname':  { en:'Last Name', es:'Apellido', pt:'Sobrenome' },
    'lbl-email':     { en:'Email Address', es:'Correo Electrónico', pt:'Endereço de E-mail' },
    'lbl-phone':     { en:'Phone (optional)', es:'Teléfono (opcional)', pt:'Telefone (opcional)' },
    'lbl-primgoal':  { en:'Primary Goal', es:'Objetivo Principal', pt:'Objetivo Principal' },
    'lbl-experience':{ en:'Training Experience', es:'Experiencia de Entrenamiento', pt:'Experiência de Treino' },
    'lbl-schedule':  { en:'Work Schedule', es:'Horario de Trabajo', pt:'Horário de Trabalho' },
    'lbl-program':   { en:'Program Interest', es:'Programa de Interés', pt:'Programa de Interesse' },
    'lbl-health':    { en:'Health Notes &amp; Injuries', es:'Notas de Salud y Lesiones', pt:'Notas de Saúde e Lesões' },
    'lbl-referral':  { en:'How did you hear about us?', es:'¿Cómo nos conociste?', pt:'Como você nos conheceu?' },

    // ── APP DOWNLOAD ──────────────────────────────────────────────────
    'app-lbl':    { en:'Client Portal', es:'Portal del Cliente', pt:'Portal do Cliente' },
    'app-h':      { en:'Your Program.<br><span class="y">In Your Pocket.</span>', es:'Tu Programa.<br><span class="y">En Tu Bolsillo.</span>', pt:'Seu Programa.<br><span class="y">No Seu Bolso.</span>' },
    'app-sub':    { en:'Access your personalized workout program, meal plan, progress tracking, and coach notes — all in one mobile app that works offline.', es:'Accede a tu programa de entrenamiento personalizado, plan de comidas, seguimiento del progreso y notas del entrenador — todo en una app móvil que funciona sin conexión.', pt:'Acesse seu programa de treino personalizado, plano alimentar, acompanhamento de progresso e notas do treinador — tudo em um app móvel que funciona offline.' },
    'app-step1':  { en:'Open the link in your browser', es:'Abre el enlace en tu navegador', pt:'Abra o link no seu navegador' },
    'app-step2':  { en:'Tap menu then "Add to Home Screen"', es:'Toca el menú y "Agregar a pantalla"', pt:'Toque no menu e "Adicionar à tela"' },
    'app-step3':  { en:'Use like a real app — works offline too', es:'Úsalo como una app real — funciona sin conexión', pt:'Use como um app real — funciona offline também' },

    // ── CONTACT ───────────────────────────────────────────────────────
    'contact-h':   { en:"Let's Build.", es:'Construyamos.', pt:'Vamos Construir.' },
    'contact-sub': { en:'Ready to start? Have questions? Reach out directly — Akeem responds fast.', es:'¿Listo para comenzar? ¿Tienes preguntas? Contáctanos directamente — Akeem responde rápido.', pt:'Pronto para começar? Tem perguntas? Entre em contato diretamente — Akeem responde rápido.' },

    // ── FOOTER ────────────────────────────────────────────────────────
    'ft-about':  { en:'About Akeem', es:'Sobre Akeem', pt:'Sobre Akeem' },
    'ft-start':  { en:'Start My Path', es:'Comienza Tu Camino', pt:'Comece Sua Jornada' }
  };

  // ── Apply Translations ────────────────────────────────────────────
  function applyTranslations(lang) {
    document.querySelectorAll('[data-lang-key]').forEach(function(el) {
      var key = el.getAttribute('data-lang-key');
      if (T[key] && T[key][lang] !== undefined) {
        el.innerHTML = T[key][lang];
      }
    });
    // Update globe button label
    var globe = document.getElementById('lang-current');
    if (globe) globe.textContent = lang.toUpperCase();
    document.documentElement.lang = (lang==='pt') ? 'pt-BR' : lang;
  }

  function setLang(l) {
    if (!['en','es','pt'].includes(l)) return;
    LANG = l;
    localStorage.setItem('bbf_lang', l);
    // Use requestAnimationFrame to ensure DOM is fully painted before translating
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(function() { applyTranslations(l); });
    } else {
      applyTranslations(l);
    }
  }

  function init() {
    if (!localStorage.getItem('bbf_lang')) {
      var nav = (navigator.language||'en').toLowerCase();
      if (nav.startsWith('es')) LANG = 'es';
      else if (nav.startsWith('pt')) LANG = 'pt';
      localStorage.setItem('bbf_lang', LANG);
    }
    applyTranslations(LANG);
  }

  window.BBF_LANG = { set: setLang, get: function(){ return LANG; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

    // ── PATHFINDER CHIPS ──────────────────────────────────────────────
    ,'chip-fatloss':      { en:'&#x1F525; Fat Loss', es:'&#x1F525; Pérdida de Grasa', pt:'&#x1F525; Perda de Gordura' }
    ,'chip-muscle':       { en:'&#x1F4AA; Build Muscle', es:'&#x1F4AA; Ganar Músculo', pt:'&#x1F4AA; Ganho Muscular' }
    ,'chip-recomp':       { en:'&#x2696; Body Recomp', es:'&#x2696; Recomposición Corporal', pt:'&#x2696; Recomposição Corporal' }
    ,'chip-strength':     { en:'&#x1F3CB; Pure Strength', es:'&#x1F3CB; Fuerza Pura', pt:'&#x1F3CB; Força Pura' }
    ,'chip-endurance':    { en:'&#x1F3C3; Endurance', es:'&#x1F3C3; Resistencia', pt:'&#x1F3C3; Resistência' }
    ,'chip-beginner':     { en:'Beginner', es:'Principiante', pt:'Iniciante' }
    ,'chip-intermediate': { en:'Intermediate', es:'Intermedio', pt:'Intermediário' }
    ,'chip-advanced':     { en:'Advanced', es:'Avanzado', pt:'Avançado' }
    ,'chip-returning':    { en:'Returning After Break', es:'Regresando Después de un Descanso', pt:'Voltando Após Pausa' }
    ,'chip-postinjury':   { en:'Post-Injury / Rehab', es:'Post-Lesión / Rehabilitación', pt:'Pós-Lesão / Reabilitação' }
    ,'chip-standard':     { en:'Standard Hours', es:'Horario Estándar', pt:'Horário Padrão' }
    ,'chip-9to5':         { en:'9-to-5 / Everyday Athlete', es:'9 a 5 / Atleta Cotidiano', pt:'9 às 5 / Atleta do Dia a Dia' }
    ,'chip-8hr':          { en:'8-Hour Shifts', es:'Turnos de 8 Horas', pt:'Turnos de 8 Horas' }
    ,'chip-12hr':         { en:'12-Hour Shifts', es:'Turnos de 12 Horas', pt:'Turnos de 12 Horas' }
    ,'chip-overnight':    { en:'Overnight / Rotating', es:'Nocturno / Rotativo', pt:'Noturno / Rotativo' }
    ,'chip-executive':    { en:'Executive / Corporate', es:'Ejecutivo / Corporativo', pt:'Executivo / Corporativo' }
    ,'chip-medical':      { en:'Medical / Healthcare', es:'Médico / Salud', pt:'Médico / Saúde' }
    ,'chip-firstresponder':{ en:'First Responder', es:'Primer Respondedor', pt:'Primeiro Respondedor' }
    ,'chip-parent':       { en:'Full-Time Parent', es:'Padre/Madre a Tiempo Completo', pt:'Pai/Mãe em Tempo Integral' }
    // ── TDEE WIDGET LABELS ────────────────────────────────────────────
    ,'tdee-cal-lbl':  { en:'Calories / Day', es:'Calorías / Día', pt:'Calorias / Dia' }
    ,'mac-protein':   { en:'Protein', es:'Proteína', pt:'Proteína' }
    ,'mac-carbs':     { en:'Carbs', es:'Carbos', pt:'Carbos' }
    ,'mac-fats':      { en:'Fats', es:'Grasas', pt:'Gorduras' }
    // ── MODAL LABELS ──────────────────────────────────────────────────
    ,'modal-cal-lbl': { en:'Daily Calorie Target', es:'Objetivo Calórico Diario', pt:'Meta Calórica Diária' }
    ,'modal-protein': { en:'Protein (g)', es:'Proteína (g)', pt:'Proteína (g)' }
    ,'modal-carbs':   { en:'Carbs (g)', es:'Carbos (g)', pt:'Carbos (g)' }
    ,'modal-fats':    { en:'Fats (g)', es:'Grasas (g)', pt:'Gorduras (g)' }
    ,'modal-close':   { en:'Close &mdash; I\'ll check my email', es:'Cerrar &mdash; Revisaré mi correo', pt:'Fechar &mdash; Verei meu e-mail' }

    // ── SELECT OPTIONS ────────────────────────────────────────────────
    ,'opt-male':             { en:'Male', es:'Masculino', pt:'Masculino' }
    ,'opt-female':           { en:'Female', es:'Femenino', pt:'Feminino' }
    ,'opt-sedentary':        { en:'Sedentary', es:'Sedentario', pt:'Sedentário' }
    ,'opt-lightly':          { en:'Lightly Active (1-3x/week)', es:'Poco Activo (1-3x/semana)', pt:'Levemente Ativo (1-3x/semana)' }
    ,'opt-moderate':         { en:'Moderately Active (3-5x/week)', es:'Moderadamente Activo (3-5x/semana)', pt:'Moderadamente Ativo (3-5x/semana)' }
    ,'opt-veryactive':       { en:'Very Active (6-7x/week)', es:'Muy Activo (6-7x/semana)', pt:'Muito Ativo (6-7x/semana)' }
    ,'opt-extreme':          { en:'Extremely Active / Physical Job', es:'Extremadamente Activo / Trabajo Físico', pt:'Extremamente Ativo / Trabalho Físico' }
    ,'opt-prog-foundation':  { en:'Foundation &mdash; Getting Started', es:'Fundamento &mdash; Empezando', pt:'Fundação &mdash; Começando' }
    ,'opt-prog-elite':       { en:'Elite Transformation &mdash; Full Commitment', es:'Transformación Élite &mdash; Compromiso Total', pt:'Transformação Elite &mdash; Compromisso Total' }
    ,'opt-prog-remote':      { en:'Remote Coaching &mdash; Anywhere', es:'Coaching Remoto &mdash; En Cualquier Lugar', pt:'Coaching Remoto &mdash; Em Qualquer Lugar' }
    ,'opt-ref-select':       { en:'Select...', es:'Seleccionar...', pt:'Selecionar...' }
    ,'opt-ref-instagram':    { en:'Instagram', es:'Instagram', pt:'Instagram' }
    ,'opt-ref-friend':       { en:'Referral from a friend', es:'Referido por un amigo', pt:'Indicação de um amigo' }
    ,'opt-ref-qr':           { en:'QR Code / Business Card', es:'Código QR / Tarjeta de Presentación', pt:'QR Code / Cartão de Visita' }
    ,'opt-ref-google':       { en:'Google Search', es:'Búsqueda en Google', pt:'Busca no Google' }
    ,'opt-ref-tiktok':       { en:'TikTok', es:'TikTok', pt:'TikTok' }
    ,'opt-ref-other':        { en:'Other', es:'Otro', pt:'Outro' }
