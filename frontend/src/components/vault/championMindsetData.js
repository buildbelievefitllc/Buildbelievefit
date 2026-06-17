// src/components/vault/championMindsetData.js
// ─────────────────────────────────────────────────────────────────────────────
// Champion's Mindset — shared trilingual dataset + per-day "locked-in" persistence.
//
// Extracted verbatim from ChampionMindset.jsx so BOTH the full Champion Mindset
// cinema tab AND the slimmed single-card MindsetIntercept render from ONE source of
// truth (no roster drift, no duplicated locale data). The EN content remains the
// LOCKED ground-truth, byte-for-byte; ES / PT carry region-appropriate icons and
// native-language copy. Pure data + storage helpers (no JSX) — so it never trips
// the react-refresh "components-only" boundary the component files honor.

// ── Trilingual content + chrome ──────────────────────────────────────────────
// One entry per language: the roster (champions), the category taxonomy
// (buckets — shared keys, localized labels), the daily affirmation, the two
// cognitive-protocol decks, and every piece of surface chrome. EN content is the
// LOCKED ground-truth (kobe / goggins / et kept byte-for-byte); ES / PT carry
// region-appropriate icons and native-language copy.
//
// ── DROP-IN SCHEMA (trilingual scaling) ──────────────────────────────────────
// The roster is ALREADY cleanly separated by language key — each `L10N[lang]`
// owns its own `champions: []` array, so the incoming localized films (Canelo /
// Senna / Oliveira …) drop straight into the matching language array with zero
// structural friction. One champion record:
//
//   {
//     id:        'oliveira',              // unique within its language array;
//                                         //   reference it from a bucket's `ids`
//                                         //   to file it under a category filter.
//     category:  'Faixa-Preta Mental',    // localized badge string
//     title:     'Charles Oliveira: …',   // localized card title
//     youtubeId: 'XXXXXXXXXXX',           // 11-char native-language motivational cut
//     objective: '…',                     // localized Focus-Objective paragraph
//     dictums:   ['…', '…', '…'],          // localized cognitive dictums (any count)
//     lockIn:    'Forge This Mindset',     // OPTIONAL — persona-specific lock-in CTA;
//                                          //   omit to fall back to L.lockInBtn.
//   }
//
// To extend a category filter, add the new `id` to the relevant bucket's `ids`
// for that same language (buckets share KEYS across languages, so an active
// filter survives a language toggle). Nothing else needs to change — the cinema
// grid, search, accordion player and Focus-Objective panel all read these arrays
// generically.
export const L10N = {
  en: {
    pill: 'Cognitive Fortitude',
    title: 'Champion’s Mindset',
    sub: 'Physical strength is empty without robust mental resilience. Forge your mental armor here with daily expert cognitive conditioning.',
    affirmLabel: 'Daily Vault Affirmation',
    cinemaKicker: 'Championship Mindset Cinema',
    cinemaTitle: 'Advanced Cognitive Fortitude & Drive Players',
    obsession: 'Engage Obsession Cycle',
    searchPlaceholder: 'Search the vault — champion, theme, or tag…',
    searchAria: 'Search champion films',
    filterAria: 'Filter films by category',
    allFilms: 'All Films',
    showing: (v, t) => `Showing ${v} of ${t} films`,
    noFilmsTitle: 'No films match your search.',
    noFilmsSub: 'Try a different champion, theme, or tag.',
    clearFilters: 'Clear filters',
    streamNow: 'Stream Now',
    locked: 'Locked',
    collapse: 'Collapse video',
    playerNote: 'Note: Ensure audio/earphones are configured. Let the message echo in your subconsciousness.',
    focusObjective: 'Focus Objective',
    dictumsLabel: 'Cognitive Dictums for Internalization',
    lockInBtn: 'Lock In This Mindset Today',
    lockedBtn: 'Mindset Locked In Today',
    focusTitle: 'Focus Strategies',
    focusSub: 'Mental Efficiency Training',
    vizTitle: 'Visualization Drills',
    vizSub: 'Neuromuscular Pathing',
    affirmation:
      'I possess the strength to overcome every challenge and the discipline to master my craft today.',
    buckets: [
      { key: 'championship-drive', label: 'Championship Drive', ids: ['kobe', 'jordan', 'arnold', 'ali', 'raylewis'] },
      { key: 'stoic-grit', label: 'Stoic Heavy Grit', ids: ['goggins', 'et', 'jocko', 'ctfletcher', 'inky', 'lesbrown', 'denzel'] },
      { key: 'female-strength', label: 'Female Strength Grace', ids: ['serena', 'courtney'] },
      { key: 'neuro-synapse', label: 'Neurological Synapse', ids: ['huberman'] },
    ],
    champions: [
      {
        id: 'kobe',
        category: 'Mamba Mentality',
        title: 'Kobe Bryant: The Mamba Mentality',
        youtubeId: 'GE0UAdxPTc0',
        objective:
          'The relentless pursuit of being the best version of yourself. Obsessive ' +
          'preparation, zero excuses, and the will to outwork every opponent in the room.',
        dictums: [
          'The moment you give up is the moment you let someone else win.',
          'Everything negative — pressure, challenges — is a chance for me to rise.',
          'Dedicate yourself to the process, and the outcome takes care of itself.',
        ],
      },
      {
        id: 'jordan',
        category: 'Obsession & Competition',
        title: 'Michael Jordan: Driven From Within',
        youtubeId: '2g7yEljgdN0',
        objective:
          'Channel competitive fire into fuel. Take every slight personally, turn ' +
          'failure into evidence, and let an unbreakable will separate you from the field.',
        dictums: [
          'I have failed over and over — and that is precisely why I succeed.',
          "Obstacles don't have to stop you; if you hit a wall, find a way through it.",
          'I play to win, whether practice or the final. Accept nothing less.',
        ],
      },
      {
        id: 'goggins',
        category: 'Discipline & Willpower',
        title: 'David Goggins: The 40% Mind Rule',
        youtubeId: 'ocIWBpT-AGc',
        objective:
          'When your mind says you are finished, you are only at 40% of your true ' +
          'capacity. Callous the mind, embrace the suffering, and take souls in the darkroom.',
        dictums: [
          'When you think you are done, you are only at 40% of your capacity.',
          'Suffering is the true test of life — callous your mind against it.',
          'Hold yourself accountable in the mirror, every single day.',
        ],
      },
      {
        id: 'et',
        category: 'Relentless Execution',
        title: 'Discipline Yourself | Eric Thomas Motivation',
        youtubeId: 'jsabTHhM54A',
        objective:
          'Discipline is the bridge between your goals and your accomplishments. This ' +
          'module requires you to abandon the fleeting feeling of motivation and rely ' +
          'entirely on engineered consistency. Your emotions and fatigue are irrelevant; ' +
          'your execution of the standard is the only metric that matters.',
        dictums: [
          'Motivation is a feeling; discipline is an unshakeable standard.',
          'I do not negotiate with my own weakness or fatigue.',
          'The work is required whether I feel like executing it or not.',
          'I am the sole architect of my consistency and my outcomes.',
        ],
      },
      {
        id: 'jocko',
        category: 'Discipline = Freedom',
        title: 'Jocko Willink: Discipline Equals Freedom',
        youtubeId: 'eBmVv2P-v2s',
        objective:
          'Freedom is bought with discipline. The pre-dawn wake-up, the cold start, the ' +
          'rep you do not feel like doing — each is a deposit. Stop waiting on motivation ' +
          'and let the standard, not the mood, govern the day. When in doubt: default ' +
          'aggressive and attack the task in front of you.',
        dictums: [
          'Discipline equals freedom — the more you impose, the more you earn.',
          'Do not count on motivation; count on discipline.',
          'Hit snooze and you have already lost the first battle of the day.',
          'Whatever the setback: good. Find the advantage in it and move.',
        ],
      },
      {
        id: 'arnold',
        category: 'Rules of Success',
        title: 'Arnold Schwarzenegger: 6 Rules of Success',
        youtubeId: 'vdw_JvZOpwA',
        objective:
          'Hold a clear vision, then back it with relentless work. Trust yourself, ' +
          'break the rules, ignore the naysayers, and never fear failure — but above all, ' +
          'do not just take: give something back. The reps you fear most are the exact ' +
          'reps that build you.',
        dictums: [
          'Have a vision, trust yourself, and the body will follow.',
          'The last three reps are the ones that build the muscle.',
          'Ignore the naysayers; they cannot see what you can.',
          'There is no self-made success — give something back.',
        ],
      },
      {
        id: 'serena',
        category: 'Unbreakable Grace',
        title: 'Serena Williams: Still I Rise',
        youtubeId: '3sAckI5Ldyw',
        objective:
          'Greatness is a choice you defend every day, against every doubt and every ' +
          'count-out. Carry pressure as proof that you belong, answer adversity with ' +
          'poise, and rise — again and again — no matter who is watching or how steep ' +
          'the deficit on the board.',
        dictums: [
          'I am not lucky; I have earned every inch of this.',
          'Pressure is a privilege — it means you are in the arena.',
          'Believe in yourself when no one else will.',
          'Still I rise — the deficit is only the start of the comeback.',
        ],
      },
      {
        id: 'courtney',
        category: 'The Pain Cave',
        title: 'Courtney Dauwalter: Embracing the Pain Cave',
        youtubeId: 'IcZipDEeezI',
        objective:
          'The pain cave is not a place to escape — it is a place to explore and ' +
          'expand. When the body screams stop, go in, take the next step, and chip the ' +
          'wall back a little further. Your perceived limit is a room with far more ' +
          'space inside it than you think.',
        dictums: [
          'When it hurts, go into the pain cave and make it bigger.',
          'The next step is always possible — take it, then the next.',
          'Your mind quits long before your body has to.',
          'Meet your limit with curiosity, not fear.',
        ],
      },
      {
        id: 'huberman',
        category: 'Neuroscience of Will',
        title: 'Andrew Huberman: Building Extreme Willpower',
        youtubeId: '84dYijIpWjQ',
        objective:
          'Willpower is not a mood — it is a structure you can grow. The anterior ' +
          'midcingulate cortex strengthens each time you do the hard thing you would ' +
          'rather avoid. Lean into friction on purpose and you are not just finishing ' +
          'the rep — you are building the organ of tenacity itself.',
        dictums: [
          'Do the thing you resist; that is what grows the will.',
          'The anterior midcingulate cortex is the seat of the will — train it.',
          'Discomfort, chosen on purpose, is the stimulus for grit.',
          'Tenacity is a muscle of the mind; progressive overload applies.',
        ],
      },
      // ── Drop-in cohort · EN (CEO sourcing queue, 2026-06) ──────────────────
      {
        id: 'ctfletcher',
        category: 'Iron Willpower',
        title: 'CT Fletcher: Effort Is Everything',
        youtubeId: 'AJcarwO0BzE',
        objective:
          'Effort is the one currency nobody can ever take from you — and the iron never ' +
          'lies about how much you spent. A heart-transplant survivor, CT proves willpower ' +
          'outlasts anatomy: command your body to give one more when it begs to stop.',
        dictums: [
          'It’s still your set — I command you to grow.',
          'Effort is the one thing no one can take from you.',
          'Excuses move nothing; only the work moves the iron.',
        ],
        lockIn: 'Command One More Rep',
      },
      {
        id: 'ali',
        category: 'Supreme Self-Belief',
        title: 'Muhammad Ali: I Am the Greatest',
        youtubeId: '9kzMWUNbqGQ',
        objective:
          'You become great the moment you dare to declare it, then spend every day ' +
          'backing the claim. Speak the victory before the world believes it, and let ' +
          'relentless work turn the boast into the record.',
        dictums: [
          'I am the greatest — I said it before I knew I was.',
          'Don’t count the days; make the days count.',
          'Impossible is just a word small men hide behind.',
        ],
        lockIn: 'Declare Your Greatness',
      },
      {
        id: 'lesbrown',
        category: 'It’s Possible',
        title: 'Les Brown: It’s Possible',
        youtubeId: 'D4GXqPIYLNQ',
        objective:
          'Where you start is not who you are — no label gets the final word on your ' +
          'destiny. Stay hungry and aim for the moon, because even a miss lands you among ' +
          'the stars.',
        dictums: [
          'You have greatness in you — it’s possible.',
          'Shoot for the moon; a miss still lands among stars.',
          'Your story isn’t over because the start was hard.',
        ],
        lockIn: 'Claim What’s Possible',
      },
      {
        id: 'inky',
        category: 'Adversity Into Purpose',
        title: 'Inky Johnson: The Injury Became the Assignment',
        youtubeId: 'hW1Ie1q4e-8',
        objective:
          'One play ended the dream and revealed the assignment — adversity is not the ' +
          'detour, it is the path. Stay committed to the process long after the feeling ' +
          'that first sparked it is gone.',
        dictums: [
          'Stay committed long after the mood that made the promise fades.',
          'A closed door is often just a redirection.',
          'Pour into something bigger than yourself.',
        ],
        lockIn: 'Accept the Assignment',
      },
      {
        id: 'raylewis',
        category: 'Pre-Game Fire',
        title: 'Ray Lewis: Passion Over Everything',
        youtubeId: 'noKXhQsB6u8',
        objective:
          'Passion and effort are the edge talent alone can never manufacture. Empty ' +
          'everything you carry today — leave nothing in reserve, because tomorrow is ' +
          'promised to no one.',
        dictums: [
          'If you’ve got nothing left, give it anyway.',
          'Passion is the edge talent can’t fake.',
          'Greatness is a lot of small things done right every day.',
        ],
        lockIn: 'Unleash the Fire',
      },
      {
        id: 'denzel',
        category: 'Fall Forward',
        title: 'Denzel Washington: Fall Forward',
        youtubeId: 'K66EQqjFXvc',
        objective:
          'If you are going to fall, fall forward — failure is the road to greatness, not ' +
          'the end of it. Take the risk, dream big, and do the work, because a dream ' +
          'without effort stays a dream.',
        dictums: [
          'Fall forward — every setback points you toward the goal.',
          'Dreams without goals and work are just dreams.',
          'If you don’t fail, you’re not even trying.',
        ],
        lockIn: 'Fall Forward Today',
      },
    ],
    focusStrategies: [
      'Practice Box Breathing for four counts each to center your nervous system before starting your session.',
      'Identify one specific technical cue to focus on during high-intensity intervals to prevent mental fatigue.',
      'Establish a consistent pre-performance ritual that signals to your brain it is time to transition into a flow state.',
    ],
    visualizationDrills: [
      'Imagine yourself executing a perfect movement sequence with effortless precision and absolute confidence.',
      'Picture a high-pressure moment where you remain calm, composed, and successfully deliver a winning performance.',
      'Visualize the feeling of recovery after a hard workout, feeling your muscles growing stronger and your mind feeling satisfied.',
    ],
  },

  // ── ES · Spanish-speaking athletic icons ───────────────────────────────────
  es: {
    pill: 'Fortaleza Cognitiva',
    title: 'Mentalidad de Campeón',
    sub: 'La fuerza física está vacía sin una resiliencia mental robusta. Forja aquí tu armadura mental con acondicionamiento cognitivo experto cada día.',
    affirmLabel: 'Afirmación Diaria del Cofre',
    cinemaKicker: 'Cine de Mentalidad de Campeón',
    cinemaTitle: 'Reproductores Avanzados de Fortaleza Cognitiva y Drive',
    obsession: 'Activar Ciclo de Obsesión',
    searchPlaceholder: 'Busca en el cofre — campeón, tema o etiqueta…',
    searchAria: 'Buscar películas de campeones',
    filterAria: 'Filtrar películas por categoría',
    allFilms: 'Todas las Películas',
    showing: (v, t) => `Mostrando ${v} de ${t} películas`,
    noFilmsTitle: 'Ninguna película coincide con tu búsqueda.',
    noFilmsSub: 'Prueba con otro campeón, tema o etiqueta.',
    clearFilters: 'Limpiar filtros',
    streamNow: 'Reproducir Ahora',
    locked: 'Fijado',
    collapse: 'Cerrar video',
    playerNote: 'Nota: Asegura el audio/auriculares. Deja que el mensaje resuene en tu subconsciente.',
    focusObjective: 'Objetivo de Enfoque',
    dictumsLabel: 'Dictados Cognitivos para Internalizar',
    lockInBtn: 'Fijar Esta Mentalidad Hoy',
    lockedBtn: 'Mentalidad Fijada Hoy',
    focusTitle: 'Estrategias de Enfoque',
    focusSub: 'Entrenamiento de Eficiencia Mental',
    vizTitle: 'Ejercicios de Visualización',
    vizSub: 'Trazado Neuromuscular',
    affirmation:
      'Poseo la fuerza para superar cada desafío y la disciplina para dominar mi oficio hoy.',
    buckets: [
      { key: 'championship-drive', label: 'Impulso de Campeón', ids: ['canelo', 'messi', 'pau', 'moreno'] },
      { key: 'stoic-grit', label: 'Temple Estoico', ids: ['topuria', 'nadal', 'hernandez', 'rubengonzalez', 'cala', 'victorantonio', 'najera'] },
      { key: 'female-strength', label: 'Fuerza y Gracia Femenina', ids: ['carolina', 'mariamarin', 'guevara', 'longoria'] },
    ],
    champions: [
      {
        id: 'canelo',
        category: 'Disciplina Implacable',
        title: 'Canelo Álvarez: La Disciplina lo es Todo',
        youtubeId: 'ZWwL_ctuU_Q',
        objective:
          'La disciplina no nace de la noche a la mañana — se construye repitiendo las ' +
          'acciones correctas cada día. Mientras otros descansan, tú forjas la ventaja. El ' +
          'campeón se hace en el gimnasio vacío, no bajo las luces del estadio.',
        dictums: [
          'La disciplina es el único secreto del éxito.',
          'Mientras el rival duerme, yo entreno.',
          'No cuento las repeticiones; hago que cada una cuente.',
          'El sacrificio de hoy es el título de mañana.',
        ],
      },
      {
        id: 'topuria',
        category: 'Mentalidad Imparable',
        title: 'Ilia Topuria: La Mente de un Campeón',
        youtubeId: '3TuhVliMU_0',
        objective:
          'No te guíes por la motivación — guíate por la obsesión y la fe absoluta en tu ' +
          'trabajo. La duda no entra al octágono. Visualiza la victoria hasta que sea la ' +
          'única realidad posible, y luego ejecútala con frialdad.',
        dictums: [
          'No me dejo guiar por la motivación; tengo una obsesión.',
          'Creo en mí cuando nadie más lo hace.',
          'La nueva era empieza con una mente sin dudas.',
          'Visualizo el final antes de que comience el combate.',
        ],
      },
      {
        id: 'nadal',
        category: 'Resiliencia y Esfuerzo',
        title: 'Rafael Nadal: El Esfuerzo Siempre Vale la Pena',
        youtubeId: '2NQ1ErWVxRE',
        objective:
          'Cada punto se juega como si fuera el último, con humildad y entrega total. No ' +
          'controlas el marcador; controlas tu actitud y tu esfuerzo. Aguanta, recupérate y ' +
          'vuelve a empezar — punto a punto, sin rendirte jamás.',
        dictums: [
          'El esfuerzo siempre vale la pena.',
          'Juego cada punto como si fuera el último.',
          'Aguantar es también una forma de ganar.',
          'La humildad mantiene la mente en el presente.',
        ],
      },
      {
        id: 'carolina',
        category: 'Fuerza y Gracia',
        title: 'Carolina Marín: Puedo Porque Pienso que Puedo',
        youtubeId: 'ysR3b1Kj2_g',
        objective:
          'La mente se entrena igual que el cuerpo. Tras cada lesión y cada crítica, la ' +
          'confianza en el trabajo diario es lo que te devuelve a lo más alto. Confía en ti, ' +
          'en tu equipo y en cada hora que nadie ve.',
        dictums: [
          'Puedo porque pienso que puedo.',
          'Hay que confiar en el trabajo que haces a diario.',
          'Entreno la mente para superar cualquier crítica.',
          'Caer no es fracasar; rendirse sí.',
        ],
      },
      {
        id: 'messi',
        category: 'Perseverancia',
        title: 'Lionel Messi: Nunca Te Rindas',
        youtubeId: '3MPNKB7epi0',
        objective:
          'El talento sin trabajo no basta. Lo das todo, y el resultado es secundario frente ' +
          'a no rendirse jamás. Aprende de cada caída, levántate con más convicción y deja ' +
          'que la constancia hable por ti.',
        dictums: [
          'El resultado es secundario; lo importante es no rendirse nunca.',
          'El talento solo no basta; el trabajo lo completa.',
          'De cada caída se aprende y se sigue adelante.',
          'Trabajo en silencio y dejo que el juego hable.',
        ],
      },
      {
        id: 'pau',
        category: 'Cada Día es el Primer Día',
        title: 'Pau Gasol: El Viaje es lo que Importa',
        youtubeId: 'yFrOFINoc_w',
        objective:
          'La longevidad se construye tratando cada día como el primero: misma hambre, misma ' +
          'humildad, misma atención al detalle. Gestiona la crítica como combustible, cuida ' +
          'el cuerpo como un profesional y disfruta el viaje, no solo el destino.',
        dictums: [
          'Cada día es el primer día.',
          'Lo importante es el viaje, no solo el destino.',
          'La crítica se gestiona con trabajo, no con palabras.',
          'La constancia profesional supera al talento aislado.',
        ],
      },
      // ── Cohorte de incorporación · ES (cola del CEO, 2026-06) ──────────────
      {
        id: 'moreno',
        category: 'El Asesino Sonriente',
        title: 'Brandon Moreno: El Sueño del Underdog',
        youtubeId: '230g_GWbD5g',
        objective:
          'De vender productos en la calle a primer campeón mexicano de la UFC, Brandon ' +
          'jamás dejó de creer cuando lo cortaron. Cae siete veces y levántate ocho, ' +
          'siempre con una sonrisa y el doble de trabajo.',
        dictums: [
          'Nunca dejé de creer, ni cuando nadie creyó en mí.',
          'El que persevera alcanza — todo es posible.',
          'Cargo a México en cada golpe que tiro.',
        ],
        lockIn: 'Cree en el Sueño',
      },
      {
        id: 'hernandez',
        category: 'De los Campos a las Estrellas',
        title: 'José Hernández: El Astronauta que Nunca se Rindió',
        youtubeId: 'D_Y7N91W1QQ',
        objective:
          'Hijo de migrantes que pizcaba en los campos, aplicó once veces a la NASA antes ' +
          'de tocar las estrellas. El rechazo no es un final: es una instrucción para ' +
          'volver mejor preparado.',
        dictums: [
          'Me rechazaron once veces; lo intenté una doceava.',
          'El esfuerzo de hoy es la órbita de mañana.',
          'De dónde vienes no decide hasta dónde llegas.',
        ],
        lockIn: 'Apunta a las Estrellas',
      },
      {
        id: 'rubengonzalez',
        category: 'Garra Olímpica',
        title: 'Rubén González: Cuatro Veces Olímpico',
        youtubeId: 'uXoVm3vnq3E',
        objective:
          'Empezó el luge a los 21 años, sin experiencia en el hielo, y llegó a cuatro ' +
          'Juegos Olímpicos a pura terquedad. No necesitas ser grande para empezar, pero ' +
          'tienes que empezar para llegar a ser grande.',
        dictums: [
          'No hay que ser grande para empezar; hay que empezar para ser grande.',
          'Caí mil veces y me levanté mil una.',
          'La persistencia vence al talento que se rinde.',
        ],
        lockIn: 'Persiste Sin Rendirte',
      },
      {
        id: 'cala',
        category: 'Resiliencia Inquebrantable',
        title: 'Ismael Cala: De Frágil a Inquebrantable',
        youtubeId: 'fsfipPUZaMI',
        objective:
          'La resiliencia se entrena como un músculo: pasos concretos para ir de frágil a ' +
          'inquebrantable. Convierte el duelo y la presión en combustible, y reinvéntate ' +
          'cada vez que la vida te derribe.',
        dictums: [
          'No controlas la tormenta, pero sí cómo la navegas.',
          'Reinventarse es sobrevivir con propósito.',
          'El dolor es inevitable; el sufrimiento es opcional.',
        ],
        lockIn: 'Vuélvete Inquebrantable',
      },
      {
        id: 'mariamarin',
        category: 'Voz Latina Imparable',
        title: 'María Marín: El Poder de Empoderarte',
        youtubeId: 'UyDpS3oxIBM',
        objective:
          'El empujoncito que esperas no viene de afuera: nace cuando decides que mereces ' +
          'más. Suelta el miedo y la tristeza, y atrévete a pedir lo que vales sin pedir ' +
          'perdón por ello.',
        dictums: [
          'Si lo puedes soñar, lo puedes lograr.',
          'El miedo toca la puerta; déjalo afuera.',
          'Tu valor no se negocia ni se disculpa.',
        ],
        lockIn: 'Date el Empujoncito',
      },
      {
        id: 'victorantonio',
        category: 'Mentalidad Multiplicadora',
        title: 'Víctor Antonio: La Mentalidad lo Multiplica Todo',
        youtubeId: 'H1IR0nvTJcw',
        objective:
          'El talento sin la mentalidad correcta no llega lejos: tu marco mental es el ' +
          'multiplicador. De ejecutivo a motivador, demostró que el hambre y el enfoque ' +
          'son habilidades que se entrenan a diario.',
        dictums: [
          'Tu mentalidad es el multiplicador de tu talento.',
          'El hambre se entrena como cualquier músculo.',
          'Cambia tu mente y cambiarás tu resultado.',
        ],
        lockIn: 'Activa la Mentalidad',
      },
      {
        id: 'najera',
        category: 'Si Yo Puedo, Tú Puedes',
        title: 'Gabriel Najera: Sin Brazos, Sin Límites',
        youtubeId: 'ouwdF4VGerY',
        objective:
          'Nació sin brazos y convirtió su mayor barrera en su mensaje más poderoso: si yo ' +
          'puedo, tú puedes. El límite no vive en el cuerpo, vive en la mente que decide ' +
          'rendirse o seguir.',
        dictums: [
          'Si yo puedo, tú puedes — sin excusas.',
          'Los límites son mentales antes que físicos.',
          'Tu obstáculo es tu mensaje.',
        ],
        lockIn: 'Rompe Tus Límites',
      },
      // ── Reemplazos atléticos aprobados por el CEO (Inés Sainz → Guevara,
      //    Karla Souza → Longoria), 2026-06 ──────────────────────────────────
      {
        id: 'guevara',
        category: 'La Inmortal del Atletismo',
        title: 'Ana Guevara: La Fuerza de Nunca Rendirse',
        youtubeId: 'wNarmTLVhGQ',
        objective:
          'Campeona mundial de los 400 metros y plata olímpica, Ana volvió de un tendón ' +
          'roto con apenas 100 días de entrenamiento para subir al podio. La lesión no ' +
          'define al atleta; lo define lo que hace cuando todos lo dan por vencido.',
        dictums: [
          'La disciplina me llevó más lejos que el talento.',
          'Volví de la lesión porque me negué a rendirme.',
          'Corro por México en cada metro de la pista.',
        ],
        lockIn: 'Corre Tu Propia Carrera',
      },
      {
        id: 'longoria',
        category: 'La Reina del Raquetbol',
        title: 'Paola Longoria: La Mentalidad de una Campeona',
        youtubeId: 'aNJb76dV1Ow',
        objective:
          'La raquetbolista más dominante de la historia encadenó rachas invictas que ' +
          'parecían imposibles, número uno del mundo temporada tras temporada. La campeona ' +
          'no nace del talento, sino de la obsesión por entrenar cuando nadie la mira.',
        dictums: [
          'Cada entrenamiento es la final del mundo.',
          'La constancia construye lo que el talento solo empieza.',
          'Rompo barreras para que otras mexicanas las crucen.',
        ],
        lockIn: 'Entrena Como Campeona',
      },
    ],
    focusStrategies: [
      'Practica la Respiración en Caja, cuatro tiempos en cada fase, para centrar tu sistema nervioso antes de empezar la sesión.',
      'Identifica una sola señal técnica en la que concentrarte durante los intervalos de alta intensidad para evitar la fatiga mental.',
      'Establece un ritual previo constante que le indique a tu cerebro que es hora de entrar en estado de flujo.',
    ],
    visualizationDrills: [
      'Imagínate ejecutando una secuencia de movimiento perfecta, con precisión sin esfuerzo y confianza absoluta.',
      'Visualiza un momento de máxima presión en el que permaneces calmado, sereno y resuelves con una actuación ganadora.',
      'Visualiza la sensación de recuperación tras un entrenamiento duro: tus músculos se fortalecen y tu mente queda satisfecha.',
    ],
  },

  // ── PT · Brazilian / Lusophone athletic icons ──────────────────────────────
  pt: {
    pill: 'Fortaleza Cognitiva',
    title: 'Mentalidade de Campeão',
    sub: 'A força física é vazia sem uma resiliência mental robusta. Forje aqui sua armadura mental com condicionamento cognitivo especializado todos os dias.',
    affirmLabel: 'Afirmação Diária do Cofre',
    cinemaKicker: 'Cinema da Mentalidade de Campeão',
    cinemaTitle: 'Reprodutores Avançados de Fortaleza Cognitiva e Garra',
    obsession: 'Ativar Ciclo de Obsessão',
    searchPlaceholder: 'Busque no cofre — campeão, tema ou etiqueta…',
    searchAria: 'Buscar filmes de campeões',
    filterAria: 'Filtrar filmes por categoria',
    allFilms: 'Todos os Filmes',
    showing: (v, t) => `Mostrando ${v} de ${t} filmes`,
    noFilmsTitle: 'Nenhum filme corresponde à sua busca.',
    noFilmsSub: 'Tente outro campeão, tema ou etiqueta.',
    clearFilters: 'Limpar filtros',
    streamNow: 'Assistir Agora',
    locked: 'Fixado',
    collapse: 'Fechar vídeo',
    playerNote: 'Nota: Configure o áudio/fones de ouvido. Deixe a mensagem ecoar no seu subconsciente.',
    focusObjective: 'Objetivo de Foco',
    dictumsLabel: 'Ditames Cognitivos para Internalizar',
    lockInBtn: 'Fixar Esta Mentalidade Hoje',
    lockedBtn: 'Mentalidade Fixada Hoje',
    focusTitle: 'Estratégias de Foco',
    focusSub: 'Treinamento de Eficiência Mental',
    vizTitle: 'Exercícios de Visualização',
    vizSub: 'Mapeamento Neuromuscular',
    affirmation:
      'Possuo a força para superar cada desafio e a disciplina para dominar meu ofício hoje.',
    buckets: [
      { key: 'championship-drive', label: 'Garra de Campeão', ids: ['senna', 'pele', 'ronaldo', 'oliveira', 'aldo', 'medina'] },
      { key: 'stoic-grit', label: 'Disciplina Estoica', ids: ['anderson', 'cariani', 'franco', 'stronda', 'bottura'] },
      { key: 'female-strength', label: 'Força e Graça Feminina', ids: ['rebeca'] },
    ],
    champions: [
      {
        id: 'senna',
        category: 'A Vontade de Vencer',
        title: 'Ayrton Senna: A Vontade de Vencer',
        youtubeId: 'ltn3m2Au6kc',
        objective:
          'O foco absoluto não admite distração: quando os outros desistem, você encontra ' +
          'mais uma marcha dentro de si. Não corra para ser segundo. Entregue tudo a cada ' +
          'volta, com fé e concentração total, e o limite recua.',
        dictums: [
          'Se você quer ser bem-sucedido, precisa ter dedicação total.',
          'Não posso correr para ser segundo; corro para vencer.',
          'No momento em que você desiste, deixa outro vencer.',
          'O foco é o que separa o campeão do resto.',
        ],
      },
      {
        id: 'anderson',
        category: 'Disciplina e Mentalidade',
        title: 'Anderson Silva: Disciplina e Lições',
        youtubeId: 'WWzloCWYZlQ',
        objective:
          'Busque ser melhor do que ontem, todos os dias. A disciplina sustenta o talento ' +
          'quando a motivação some. Trate cada treino como o combate decisivo e deixe que a ' +
          'constância, não o impulso, defina o seu padrão.',
        dictums: [
          'Procuro ser melhor do que eu fui ontem.',
          'O sentido é seguir em frente, subir, alcançar e conquistar.',
          'A disciplina sustenta o talento quando a motivação acaba.',
          'Cada treino é o combate decisivo.',
        ],
      },
      {
        id: 'pele',
        category: 'A Lenda do Esforço',
        title: 'Pelé: O Rei e a Mentalidade Vencedora',
        youtubeId: 'oVgFc3iYUnw',
        objective:
          'Sucesso não é acidente — é trabalho duro, persistência, estudo, sacrifício e, ' +
          'acima de tudo, amor pelo que se faz. O talento abre a porta; a dedicação mantém ' +
          'você dentro. Honre o dom treinando mais do que todos.',
        dictums: [
          'Sucesso é trabalho duro, persistência e amor pelo que se faz.',
          'Quanto mais difícil a vitória, maior a felicidade em vencer.',
          'O talento sem trabalho é apenas potencial desperdiçado.',
          'Tudo é prática — nada substitui a repetição.',
        ],
      },
      {
        id: 'ronaldo',
        category: 'Mentalidade de Campeão',
        title: 'Cristiano Ronaldo: Mentalidade de Campeão',
        youtubeId: 'oUNBqQEhb0c',
        objective:
          'O talento conta, mas a obsessão pelos detalhes constrói o melhor do mundo. Na sua ' +
          'cabeça, você é o melhor — e treina para provar isso todos os dias. Recuperação, ' +
          'sono, dieta e repetição: o padrão nunca baixa.',
        dictums: [
          'Posso não ser, mas na minha cabeça eu sou o melhor.',
          'O talento sem trabalho não é nada.',
          'Sua carga de trabalho determina o seu teto.',
          'Dedicação, foco e sacrifício — sem atalhos.',
        ],
      },
      {
        id: 'rebeca',
        category: 'Superação e Graça',
        title: 'Rebeca Andrade: A Força da Superação',
        youtubeId: 'mfTxzQ3adPI',
        objective:
          'Depois de cada lesão, a fé no processo e o foco no que você realmente deseja levam ' +
          'além do que você mesmo imaginava. O sacrifício silencioso de anos vira ouro no ' +
          'instante decisivo. Mantenha o foco; o resto é consequência.',
        dictums: [
          'O foco no que desejo me leva além do que imaginei.',
          'Cada queda é parte do caminho até o pódio.',
          'Abdiquei de tudo que tirasse o meu foco.',
          'A superação começa na cabeça, muito antes do salto.',
        ],
      },
      // ── Lote de incorporação · PT (fila do CEO, 2026-06) ───────────────────
      {
        id: 'oliveira',
        category: 'A Favela Venceu',
        title: 'Charles do Bronx: A Favela Venceu',
        youtubeId: 'RoupcwdamkA',
        objective:
          'Da favela ao cinturão do UFC, o Do Bronx provou que fé e trabalho silencioso ' +
          'vencem qualquer placar. Acredite quando ninguém acredita, porque a virada mora ' +
          'exatamente onde os outros desistem.',
        dictums: [
          'A favela venceu — e vai vencer de novo.',
          'Nunca desisti, mesmo quando me deram como morto.',
          'A fé me sustenta quando a força acaba.',
        ],
        lockIn: 'Faça a Favela Vencer',
      },
      {
        id: 'aldo',
        category: 'Rei de Manaus',
        title: 'José Aldo: Da Favela ao Octógono',
        youtubeId: 'YmxPmbPo1CQ',
        objective:
          'Das ruas de Manaus à imortalidade no UFC, Aldo carregou a fome de quem não ' +
          'tinha nada a perder. Trate cada treino como o combate da sua vida e deixe a ' +
          'constância falar mais alto que o talento.',
        dictums: [
          'Quem vem de baixo não tem medo de cair.',
          'Cada treino é o combate decisivo.',
          'A fome me trouxe aqui; a disciplina me mantém.',
        ],
        lockIn: 'Lute Como um Rei',
      },
      {
        id: 'medina',
        category: 'Tricampeão Mundial',
        title: 'Gabriel Medina: Mentalidade de Tricampeão',
        youtubeId: 'N4YdvV1SmbQ',
        objective:
          'O primeiro brasileiro campeão mundial de surfe transformou pressão em poder e ' +
          'dúvida em troféu. Domine o jogo mental antes da onda, porque o campeão se decide ' +
          'na cabeça antes de se decidir na água.',
        dictums: [
          'Eu treino para vencer, não para participar.',
          'Pressão é privilégio de quem chegou ao topo.',
          'O jogo se ganha primeiro na mente.',
        ],
        lockIn: 'Dome a Sua Onda',
      },
      {
        id: 'cariani',
        category: 'Eu Quero, Eu Posso',
        title: 'Renato Cariani: Eu Quero, Eu Posso',
        youtubeId: 'EkPP6XVzWkE',
        objective:
          'O lema que move a cultura fitness brasileira é simples e implacável: eu quero, ' +
          'eu posso. Quando a vontade vira decisão e a decisão vira hábito, nenhuma desculpa ' +
          'sobrevive ao próximo treino.',
        dictums: [
          'Eu quero, eu posso — o resto é desculpa.',
          'Disciplina é treinar mesmo sem vontade.',
          'O treino não negocia; ele cobra.',
        ],
        lockIn: 'Eu Quero, Eu Posso',
      },
      {
        id: 'franco',
        category: 'The Chosen One',
        title: 'Felipe Franco: A Volta do Escolhido',
        youtubeId: 'x5eAWrsHXFM',
        objective:
          'Do fundo da depressão de volta ao palco dos campeões, Felipe provou que ' +
          'recomeçar é um ato de coragem. O fundo do poço não é o fim — é o lugar onde você ' +
          'decide subir.',
        dictums: [
          'Recomeçar é coragem, não fraqueza.',
          'O fundo do poço tem saída — para cima.',
          'Transformei a dor em combustível.',
        ],
        lockIn: 'Renasça Mais Forte',
      },
      {
        id: 'stronda',
        category: 'A História do Monstro',
        title: 'Leo Stronda: Do Fundo ao Topo',
        youtubeId: 'MigSghUkB-M',
        objective:
          'Venceu a obesidade e a depressão para construir, do zero, a versão mais forte de ' +
          'si mesmo. A transformação começa na decisão de não aceitar mais a vida que te ' +
          'adoecia.',
        dictums: [
          'Eu não nasci monstro; eu me construí.',
          'A mudança começa quando você para de aceitar menos.',
          'O corpo segue a mente que decide vencer.',
        ],
        lockIn: 'Construa o Monstro',
      },
      {
        id: 'bottura',
        category: 'Excelência Técnica',
        title: 'Caio Bottura: Mestria nos Detalhes',
        youtubeId: 'zTIOK1SBXpY',
        objective:
          'A grandeza mora no detalhe que ninguém vê: a técnica perfeita, repetida com ' +
          'paixão até virar arte. Ame o processo a ponto de chorar por ele, e o resultado ' +
          'vira consequência inevitável.',
        dictums: [
          'O detalhe invisível constrói o resultado visível.',
          'Treine com técnica, não só com vontade.',
          'Paixão pelo processo vence pressa pelo resultado.',
        ],
        lockIn: 'Domine Cada Detalhe',
      },
    ],
    focusStrategies: [
      'Pratique a Respiração em Caixa, quatro tempos em cada fase, para centrar o sistema nervoso antes de iniciar a sessão.',
      'Identifique um único comando técnico para focar durante os intervalos de alta intensidade e evitar a fadiga mental.',
      'Estabeleça um ritual pré-performance constante que sinalize ao seu cérebro que é hora de entrar em estado de fluxo.',
    ],
    visualizationDrills: [
      'Imagine-se executando uma sequência de movimento perfeita, com precisão sem esforço e confiança absoluta.',
      'Visualize um momento de alta pressão no qual você permanece calmo, sereno e entrega uma performance vencedora.',
      'Visualize a sensação de recuperação após um treino pesado: seus músculos ficam mais fortes e sua mente, satisfeita.',
    ],
  },
};

// ── Per-day "locked-in mindset" persistence (mirrors MindsetEngine) ──────────
const LOCK_KEY = 'bbf.vault.mindset.lockedin.v1';
function todayKey() { return new Date().toISOString().slice(0, 10); }

export function readLocked() {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    return all?.[todayKey()] ?? null;
  } catch { return null; }
}
export function writeLocked(id) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    all[todayKey()] = id;
    localStorage.setItem(LOCK_KEY, JSON.stringify(all));
  } catch { /* storage blocked — selection holds for the tab */ }
}
