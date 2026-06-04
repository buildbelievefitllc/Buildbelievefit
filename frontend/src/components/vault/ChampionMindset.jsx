// src/components/vault/ChampionMindset.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Champion's Mindset — Cognitive Conditioning module (client-facing Vault tab).
//
// A React reconstruction of the AI Studio "Champion's Mindset" prototype, now
// expanded into a Netflix-style "Premium Video Vault & Mind-Muscle
// Synchronization" surface: mental fortitude training, a daily valor
// affirmation, and a searchable/filterable "Championship Mindset Cinema" roster
// of motivational films. Four sections, faithful to the ground truth:
//   1. Hero          — Cognitive Fortitude pill + title + framing copy.
//   2. Affirmation   — the day's Daily Vault Affirmation quote block.
//   3. Cinema        — search + category-tag filters → a responsive film grid →
//                      a YouTube player + Focus Objective panel that both track
//                      the selected film.
//   4. Protocols     — the Focus Strategies / Visualization Drills split-pane.
//
// DYNAMIC REGIONAL ROSTER (Terminal India · trilingual mission): the entire
// module — affirmation, the cinema roster, category buckets, and the cognitive
// protocols — now BRANCHES on the active LanguageContext. Toggling EN · ES · PT
// instantly swaps the surface:
//   • EN — the Western canon (Kobe, Jordan, Goggins, Eric Thomas, Jocko, Arnold,
//          Serena, Courtney Dauwalter, Huberman). LOCKED data, byte-for-byte.
//   • ES — Spanish-speaking athletic icons (Canelo, Topuria, Nadal, Carolina
//          Marín, Messi, Pau Gasol) with native Spanish motivational content.
//   • PT — Brazilian / Lusophone icons (Ayrton Senna, Anderson Silva, Pelé,
//          Cristiano Ronaldo, Rebeca Andrade) with native Portuguese content.
// The `youtubeId` of every regional record is a real, verified motivational cut
// in that athlete's native language. The bucket KEYS are shared across languages
// so an active filter survives a language toggle; only the labels are localized.
//
// Selecting a champion locks the player + objective to that film; "Engage
// Obsession Cycle" advances through the films currently in view; "Lock In This
// Mindset Today" persists the day's pick to localStorage (per-day, mirroring
// MindsetEngine). Public to every authenticated client — mounted in ClientVault
// with no admin gate.

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './championMindset.css';

// ── Trilingual content + chrome ──────────────────────────────────────────────
// One entry per language: the roster (champions), the category taxonomy
// (buckets — shared keys, localized labels), the daily affirmation, the two
// cognitive-protocol decks, and every piece of surface chrome. EN content is the
// LOCKED ground-truth (kobe / goggins / et kept byte-for-byte); ES / PT carry
// region-appropriate icons and native-language copy.
const L10N = {
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
      { key: 'championship-drive', label: 'Championship Drive', ids: ['kobe', 'jordan', 'arnold'] },
      { key: 'stoic-grit', label: 'Stoic Heavy Grit', ids: ['goggins', 'et', 'jocko'] },
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
      { key: 'championship-drive', label: 'Impulso de Campeón', ids: ['canelo', 'messi', 'pau'] },
      { key: 'stoic-grit', label: 'Temple Estoico', ids: ['topuria', 'nadal'] },
      { key: 'female-strength', label: 'Fuerza y Gracia Femenina', ids: ['carolina'] },
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
      { key: 'championship-drive', label: 'Garra de Campeão', ids: ['senna', 'pele', 'ronaldo'] },
      { key: 'stoic-grit', label: 'Disciplina Estoica', ids: ['anderson'] },
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

// The bucket labels a given champion belongs to (used for the card badge search
// surface and for tag-aware text matching). Buckets are passed in so the lookup
// tracks the active language's taxonomy.
function bucketsFor(id, buckets) {
  return buckets.filter((b) => b.ids.includes(id)).map((b) => b.label);
}

// Case-insensitive search across title, category badge, and tag labels.
function matchesQuery(champion, query, buckets) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [champion.title, champion.category, ...bucketsFor(champion.id, buckets)]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

// ── Per-day "locked-in mindset" persistence (mirrors MindsetEngine) ──────────
const LOCK_KEY = 'bbf.vault.mindset.lockedin.v1';
function todayKey() { return new Date().toISOString().slice(0, 10); }

function readLocked() {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    return all?.[todayKey()] ?? null;
  } catch { return null; }
}
function writeLocked(id) {
  try {
    const all = JSON.parse(localStorage.getItem(LOCK_KEY) || '{}');
    all[todayKey()] = id;
    localStorage.setItem(LOCK_KEY, JSON.stringify(all));
  } catch { /* storage blocked — selection holds for the tab */ }
}

export default function ChampionMindset() {
  // Active language drives the entire roster + chrome. A toggle re-renders this
  // component with a different L, instantly swapping every champion and string.
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const { champions, buckets } = L;

  // Restore today's locked-in champion (if any). Validation against the active
  // roster happens at render via `activeId`, so a stored id from another language
  // simply falls back to the roster head rather than throwing.
  const [selectedId, setSelectedId] = useState(() => readLocked());
  const [lockedToday, setLockedToday] = useState(() => readLocked());

  // Search + category-tag filter state for the cinema grid. The bucket KEYS are
  // shared across languages, so an active filter survives a language toggle.
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  // The effective selection is the stored pick when it exists in the active
  // roster; otherwise the roster head. Keeps the player + highlight coherent the
  // instant the language (and therefore the roster) changes — no effect needed.
  const activeId = champions.some((c) => c.id === selectedId) ? selectedId : champions[0].id;
  const active = champions.find((c) => c.id === activeId) ?? champions[0];

  // Films currently in view, after applying the active tag filter + search.
  const visible = useMemo(() => {
    const bucket = buckets.find((b) => b.key === filter);
    return champions.filter((c) => {
      const inBucket = !bucket || bucket.ids.includes(c.id);
      return inBucket && matchesQuery(c, query, buckets);
    });
  }, [champions, buckets, filter, query]);

  // "Engage Obsession Cycle" — advance through the films currently in view.
  const cycle = () => {
    const pool = visible.length ? visible : champions;
    const i = pool.findIndex((c) => c.id === activeId);
    setSelectedId(pool[(i + 1) % pool.length].id);
  };

  const clearFilters = () => { setQuery(''); setFilter('all'); };

  // "Lock In This Mindset Today" — persist the active pick as the day's mindset.
  const lockIn = () => { writeLocked(active.id); setLockedToday(active.id); };
  const isLockedIn = lockedToday === active.id;

  return (
    <div className="cm" data-testid="champion-mindset-module">
      {/* ── 1 · Hero ──────────────────────────────────────────────────────── */}
      <section className="cm-hero">
        <span className="cm-pill">{L.pill}</span>
        <h2 className="cm-title">
          <span className="cm-spark" aria-hidden="true">✦</span> {L.title}
        </h2>
        <p className="cm-sub">{L.sub}</p>
      </section>

      {/* ── 2 · Daily Vault Affirmation ───────────────────────────────────── */}
      <section className="cm-affirm" aria-label={L.affirmLabel}>
        <div className="cm-affirm-orb" aria-hidden="true">✦</div>
        <div className="cm-affirm-lbl">{L.affirmLabel}</div>
        <blockquote className="cm-affirm-quote">&ldquo;{L.affirmation}&rdquo;</blockquote>
      </section>

      {/* ── 3 · Championship Mindset Cinema ───────────────────────────────── */}
      <section className="cm-cinema">
        <div className="cm-cinema-head">
          <div>
            <div className="cm-kicker"><span aria-hidden="true">🏆</span> {L.cinemaKicker}</div>
            <h3 className="cm-cinema-title">{L.cinemaTitle}</h3>
          </div>
          <button type="button" className="cm-obsession" onClick={cycle}>
            <span aria-hidden="true">🔥</span> {L.obsession}
          </button>
        </div>

        {/* Search + category-tag filter toolbar */}
        <div className="cm-toolbar">
          <div className="cm-search">
            <span className="cm-search-ic" aria-hidden="true">⌕</span>
            <input
              type="search"
              className="cm-search-input"
              placeholder={L.searchPlaceholder}
              aria-label={L.searchAria}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="cm-filters" role="group" aria-label={L.filterAria}>
            <button
              type="button"
              className={`cm-chip${filter === 'all' ? ' is-active' : ''}`}
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              {L.allFilms}
            </button>
            {buckets.map((b) => (
              <button
                key={b.key}
                type="button"
                className={`cm-chip${filter === b.key ? ' is-active' : ''}`}
                aria-pressed={filter === b.key}
                onClick={() => setFilter(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <div className="cm-count" aria-live="polite">
          {L.showing(visible.length, champions.length)}
        </div>

        {/* Responsive film grid */}
        {visible.length > 0 ? (
          <div className="cm-grid" role="tablist" aria-label={L.searchAria}>
            {visible.map((c) => {
              const on = c.id === activeId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  className={`cm-vcard${on ? ' is-active' : ''}`}
                  data-testid={`cm-film-${c.id}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="cm-vcard-cat">{c.category}</span>
                  <span className="cm-vcard-title">{c.title}</span>
                  <span className="cm-vcard-foot">
                    <span className="cm-vcard-stream"><span aria-hidden="true">▷</span> {L.streamNow}</span>
                    {on ? <span className="cm-vcard-locked"><span aria-hidden="true">✓</span> {L.locked}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="cm-empty" role="status">
            <p className="cm-empty-title">{L.noFilmsTitle}</p>
            <p className="cm-empty-sub">{L.noFilmsSub}</p>
            <button type="button" className="cm-empty-clear" onClick={clearFilters}>
              {L.clearFilters}
            </button>
          </div>
        )}

        {/* Video player — tracks the selected champion */}
        <div className="cm-player">
          <div className="cm-player-frame">
            <iframe
              key={active.youtubeId}
              className="cm-player-iframe"
              src={`https://www.youtube.com/embed/${active.youtubeId}`}
              title={active.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <p className="cm-player-note">
            <span aria-hidden="true">ⓘ</span> {L.playerNote}
          </p>
        </div>

        {/* Focus Objective — tracks the selected champion */}
        <div className="cm-objective">
          <div className="cm-obj-lbl"><span className="cm-obj-ic" aria-hidden="true">▶</span> {L.focusObjective}</div>
          <h4 className="cm-obj-title">{active.title}</h4>
          <p className="cm-obj-desc">{active.objective}</p>

          <div className="cm-obj-dictums-lbl">{L.dictumsLabel}</div>
          <ul className="cm-dictums">
            {active.dictums.map((d, i) => (
              <li className="cm-dictum" key={i}>
                <span className="cm-dictum-arrow" aria-hidden="true">›</span>
                <span className="cm-dictum-txt">&ldquo;{d}&rdquo;</span>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className={`cm-lockin${isLockedIn ? ' is-locked' : ''}`}
            aria-pressed={isLockedIn}
            onClick={lockIn}
          >
            <span aria-hidden="true">{isLockedIn ? '✓' : '⚡'}</span>{' '}
            {isLockedIn ? L.lockedBtn : L.lockInBtn}
          </button>
        </div>
      </section>

      {/* ── 4 · Cognitive Action Protocols (split-pane) ───────────────────── */}
      <section className="cm-protocols">
        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--focus" aria-hidden="true">⚡</span>
            <div>
              <h4 className="cm-pane-title">{L.focusTitle}</h4>
              <div className="cm-pane-sub">{L.focusSub}</div>
            </div>
          </div>
          <ul className="cm-list">
            {L.focusStrategies.map((s, i) => (
              <li className="cm-list-item cm-list-item--focus" key={i}>
                <span className="cm-bullet cm-bullet--focus" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cm-pane">
          <div className="cm-pane-head">
            <span className="cm-pane-ic cm-pane-ic--viz" aria-hidden="true">👁</span>
            <div>
              <h4 className="cm-pane-title">{L.vizTitle}</h4>
              <div className="cm-pane-sub">{L.vizSub}</div>
            </div>
          </div>
          <ul className="cm-list">
            {L.visualizationDrills.map((s, i) => (
              <li className="cm-list-item cm-list-item--viz" key={i}>
                <span className="cm-bullet cm-bullet--viz" aria-hidden="true" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
