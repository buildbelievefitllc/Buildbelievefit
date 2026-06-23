// src/components/command/coachCaveData.js
// ─────────────────────────────────────────────────────────────────────────────
// The Coach's Cave — trilingual sport-psychology & motivation film library.
//
// A PRIVATE, admin-only knowledge vault inside the Sovereign Command Center (the
// whole /command route is AdminGuard-gated, so this surface only ever renders for
// the head coach). It mirrors the gated, curated-video pattern of the Parents'
// Well-Being deck, but scoped to ONE person: the founder, sharpening his coaching
// edge as the exercise science evolves.
//
// 90 hand-sourced films: 3 knowledge decks (subjects) × 3 languages (EN · ES · PT)
// × 10 films each. The roster BRANCHES on the active LanguageContext exactly like
// Champion Mindset — flip the in-Cave EN/ES/PT control and every deck swaps to the
// native-language films for that subject. Pure data (no JSX), so it never trips the
// react-refresh "components-only" boundary.
//
// ── Record shape (matches the film grid) ─────────────────────────────────────
//   { id, title, channel, youtubeId }
// id === youtubeId (unique, stable) — used as the React key and the
// expanded/active handle. title + channel are verbatim from the source library.
//
// ── DROP-IN: add a film ──────────────────────────────────────────────────────
// Push a { id, title, channel, youtubeId } record onto CAVE_LIBRARY[lang][deckKey]
// (id = the 11-char YouTube id). Nothing else changes — the grid, filter, and
// inline player all read these arrays generically.

// The three knowledge decks (subjects). `key` is shared across languages so the
// active deck survives a language flip; `label` + `blurb` localize. Numbered 01-03
// in the §10 deck tab bar.
export const CAVE_SUBJECTS = [
  {
    "key": "self-determination",
    "label": {
      "en": "Self-Determination & Motivation",
      "es": "Autodeterminación y Motivación",
      "pt": "Autodeterminação e Motivação"
    },
    "blurb": {
      "en": "Intrinsic motivation, autonomy, and the science of why athletes keep showing up — Self-Determination Theory taken from the lecture hall to the training floor.",
      "es": "Motivación intrínseca, autonomía y la ciencia de por qué los atletas siguen presentándose — la Teoría de la Autodeterminación llevada del aula al gimnasio.",
      "pt": "Motivação intrínseca, autonomia e a ciência de por que os atletas continuam aparecendo — a Teoria da Autodeterminação levada da sala de aula para o treino."
    }
  },
  {
    "key": "mind-muscle-flow",
    "label": {
      "en": "Mind-Muscle & Flow State",
      "es": "Mente-Músculo y Flow",
      "pt": "Mente-Músculo e Flow"
    },
    "blurb": {
      "en": "Neuromuscular focus, the mind-muscle connection, and accessing flow on command — the cognitive side of peak training output.",
      "es": "Enfoque neuromuscular, la conexión mente-músculo y cómo acceder al estado de flujo a voluntad — el lado cognitivo del máximo rendimiento.",
      "pt": "Foco neuromuscular, a conexão mente-músculo e como acessar o estado de flow sob comando — o lado cognitivo da máxima performance."
    }
  },
  {
    "key": "resistance-fatigue",
    "label": {
      "en": "Resistance & Mental Fatigue",
      "es": "Resistencia y Fatiga Mental",
      "pt": "Resistência e Fadiga Mental"
    },
    "blurb": {
      "en": "The neuroscience of fatigue, mental toughness, and breaking the subconscious resistance that quits long before the body has to.",
      "es": "La neurociencia de la fatiga, la fortaleza mental y cómo romper la resistencia subconsciente que se rinde mucho antes que el cuerpo.",
      "pt": "A neurociência da fadiga, a força mental e como quebrar a resistência subconsciente que desiste muito antes do corpo."
    }
  }
];

// The film roster, keyed by language → deck. 10 films per deck, 30 per language.
export const CAVE_LIBRARY = {
  "en": {
    "self-determination": [
      {
        "id": "II5h6uJPvvs",
        "title": "How to get motivated even when you don’t feel like it",
        "channel": "TED-Ed",
        "youtubeId": "II5h6uJPvvs"
      },
      {
        "id": "7sxpKhIbr0E",
        "title": "The psychology of self-motivation | Scott Geller | TEDxVirginiaTech",
        "channel": "TEDx Talks",
        "youtubeId": "7sxpKhIbr0E"
      },
      {
        "id": "xp0O2vi8DX4",
        "title": "How to motivate yourself to change your behavior | Tali Sharot | TEDxCambridge",
        "channel": "TEDx Talks",
        "youtubeId": "xp0O2vi8DX4"
      },
      {
        "id": "gKn_fV6PGGA",
        "title": "What’s the difference between Intrinsic Motivation and Extrinsic Motivation?",
        "channel": "Attuned",
        "youtubeId": "gKn_fV6PGGA"
      },
      {
        "id": "98zh3LrMyrw",
        "title": "The Psychology of People Who Train Alone in the Gym",
        "channel": "The Rare Trait",
        "youtubeId": "98zh3LrMyrw"
      },
      {
        "id": "_juPDoa3GBY",
        "title": "Self-Determination Theory Explained",
        "channel": "Sprouts",
        "youtubeId": "_juPDoa3GBY"
      },
      {
        "id": "ZpAwJKq8TOc",
        "title": "Self-Determination Theory Explained",
        "channel": "Psychology Exposed",
        "youtubeId": "ZpAwJKq8TOc"
      },
      {
        "id": "3sRBBNkSXpY",
        "title": "What is Self Determination Theory?",
        "channel": "Camp Stomping Ground",
        "youtubeId": "3sRBBNkSXpY"
      },
      {
        "id": "4WQJQUAFF6E",
        "title": "Motivation: Self Determination Theory in Sport",
        "channel": "Mentally Tough Coaching",
        "youtubeId": "4WQJQUAFF6E"
      },
      {
        "id": "pQX_YRu744I",
        "title": "Motivation: What moves us, and why? (Self-Determination Theory)",
        "channel": "RoninOwl",
        "youtubeId": "pQX_YRu744I"
      }
    ],
    "mind-muscle-flow": [
      {
        "id": "Yx3o60K3Wno",
        "title": "5 Secrets to Accessing Flow State Like Elite Athletes",
        "channel": "Performance Juice",
        "youtubeId": "Yx3o60K3Wno"
      },
      {
        "id": "-rZCYGeXPOw",
        "title": "Unlock Your Mind: Flow State Training with Colin O'Brady",
        "channel": "Allison Pelot",
        "youtubeId": "-rZCYGeXPOw"
      },
      {
        "id": "8h6IMYRoCZw",
        "title": "FLOW BY MIHALY CSIKSZENTMIHALYI | ANIMATED BOOK SUMMARY",
        "channel": "FightMediocrity",
        "youtubeId": "8h6IMYRoCZw"
      },
      {
        "id": "HnxbyuhvDDQ",
        "title": "How Does An Autotelic Experience Improve Athletic Flow?",
        "channel": "Sport Psychology Insights",
        "youtubeId": "HnxbyuhvDDQ"
      },
      {
        "id": "2T6lncfrI8M",
        "title": "The Flow Switch: Can We Actually Trigger Focus?",
        "channel": "scipod",
        "youtubeId": "2T6lncfrI8M"
      },
      {
        "id": "IvLiLewKRXA",
        "title": "Flow (psychology)",
        "channel": "Audiopedia",
        "youtubeId": "IvLiLewKRXA"
      },
      {
        "id": "cEEmu6xiLGQ",
        "title": "How To Get Into Flow State and Perform at Your VERY BEST Whenever YOU WANT!",
        "channel": "Strategic Profits",
        "youtubeId": "cEEmu6xiLGQ"
      },
      {
        "id": "F2ArrzybKBc",
        "title": "What Is The Neuroscience Of Flow State In Peak Sports Performance?",
        "channel": "Sport Psychology Insights",
        "youtubeId": "F2ArrzybKBc"
      },
      {
        "id": "znwUCNrjpD4",
        "title": "How to enter ‘flow state’ on command | Steven Kotler for Big Think",
        "channel": "Big Think",
        "youtubeId": "znwUCNrjpD4"
      },
      {
        "id": "zHWG6mWn75o",
        "title": "What Is The Neuroscience Behind Extreme Performance Flow State?",
        "channel": "Action Sports Arena",
        "youtubeId": "zHWG6mWn75o"
      }
    ],
    "resistance-fatigue": [
      {
        "id": "yxGupoarfII",
        "title": "What is Mental Fatigue and How to Fix It",
        "channel": "The Optimum Health Clinic",
        "youtubeId": "yxGupoarfII"
      },
      {
        "id": "GT8qV326V-8",
        "title": "The Neuroscience of Exhaustion: How to Stay Motivated",
        "channel": "Sense of Mind",
        "youtubeId": "GT8qV326V-8"
      },
      {
        "id": "rNxC16mlO60",
        "title": "The Secrets and Science of Mental Toughness | Joe Risser MD, MPH | TEDxSanDiego",
        "channel": "TEDx Talks",
        "youtubeId": "rNxC16mlO60"
      },
      {
        "id": "34cW5Dzykic",
        "title": "How To Build a Strong Mind: New Focus on Resilience",
        "channel": "Dr. Tracey Marks",
        "youtubeId": "34cW5Dzykic"
      },
      {
        "id": "3hyXVuO2Arc",
        "title": "How To Treat And Prevent Mental Exhaustion",
        "channel": "Medical Centric Podcast",
        "youtubeId": "3hyXVuO2Arc"
      },
      {
        "id": "A4Fouk1Yg9M",
        "title": "Mental Tricks To Run Faster & Longer!",
        "channel": "Ben Parkes",
        "youtubeId": "A4Fouk1Yg9M"
      },
      {
        "id": "4cmOf5nx5uo",
        "title": "The Psychology of Fatigue Why the Mind Quits Before the body",
        "channel": "ZeroedIn",
        "youtubeId": "4cmOf5nx5uo"
      },
      {
        "id": "hUA_k76x2uE",
        "title": "7 Secrets To Becoming Mentally Tougher",
        "channel": "Psych2Go",
        "youtubeId": "hUA_k76x2uE"
      },
      {
        "id": "OJfkSit3XSw",
        "title": "3 Pregame Mental Toughness Exercises",
        "channel": "Eli Straw",
        "youtubeId": "OJfkSit3XSw"
      },
      {
        "id": "Ea0fUDES1Hc",
        "title": "ANYONE can be mentally tough. It's easy.",
        "channel": "SpoonFedStudy",
        "youtubeId": "Ea0fUDES1Hc"
      }
    ]
  },
  "es": {
    "self-determination": [
      {
        "id": "GhZ5gzBe2f8",
        "title": "MOTIVACIÓN PARA ENTRENAR | CON EL PSICÓLOGO ARNAU SANZ",
        "channel": "Gabriel Gevatter",
        "youtubeId": "GhZ5gzBe2f8"
      },
      {
        "id": "qPcn2cGRbOY",
        "title": "Los mejores trucos de los psicólogos deportivos para mejorar el rendimiento de los deportistas",
        "channel": "Psicoactiva",
        "youtubeId": "qPcn2cGRbOY"
      },
      {
        "id": "HecSGNA4xAc",
        "title": "PSICOLOGÍA DEPORTIVA | MOTIVACIÓN DEPORTE Y SALUD ¿QUÉ TE MOTIVA?",
        "channel": "MyFitnessPatt",
        "youtubeId": "HecSGNA4xAc"
      },
      {
        "id": "TIrjeQNVl5g",
        "title": "LA MOTIVACIÓN DEPORTIVA | con Toni Gutierrez",
        "channel": "Cuerpos Perfectos TV",
        "youtubeId": "TIrjeQNVl5g"
      },
      {
        "id": "GADcWFJAR3o",
        "title": "La Psicología Secreta de las Apps que Usas para Cambiar tus Hábitos",
        "channel": "AudioArXiv",
        "youtubeId": "GADcWFJAR3o"
      },
      {
        "id": "oW3z5X2qgBs",
        "title": "Autonomía o Adiestramiento: ¿Estás eligiendo o simplemente obedeciendo?",
        "channel": "D'angello Quevedo",
        "youtubeId": "oW3z5X2qgBs"
      },
      {
        "id": "WQLKZMO2w7A",
        "title": "Domina la Escala de Logro de Metas (GAS)",
        "channel": "Happiness Hackers En Español",
        "youtubeId": "WQLKZMO2w7A"
      },
      {
        "id": "-FO_KjJ2FgE",
        "title": "No te obsesionas con el ejercicio… y esta es la razón REAL",
        "channel": "Tu Mente En Silencio",
        "youtubeId": "-FO_KjJ2FgE"
      },
      {
        "id": "SqssSB1yz3c",
        "title": "EL MITO DE LA MOTIVACIÓN INTRÍNSECA - MITOS DE LA MOTIVACIÓN",
        "channel": "BB Psicología Deportiva",
        "youtubeId": "SqssSB1yz3c"
      },
      {
        "id": "PY-dzwxIn9Q",
        "title": "PSICOLOGIA Y DEPORTE TEMA - MOTIVACION EN EL DEPORTE",
        "channel": "TELESUCESOS HD",
        "youtubeId": "PY-dzwxIn9Q"
      }
    ],
    "mind-muscle-flow": [
      {
        "id": "RAajp0qzvXs",
        "title": "CONEXIÓN MENTE-MÚSCULO: Mejora tu rendimiento deportivo",
        "channel": "EmbodyWay con Yassir Khrichef",
        "youtubeId": "RAajp0qzvXs"
      },
      {
        "id": "jKaWDGYPF90",
        "title": "La Conexión Mente-Músculo: Cómo Usarla a tu Favor",
        "channel": "Tengo un Plan",
        "youtubeId": "jKaWDGYPF90"
      },
      {
        "id": "yY8CEq8NGJI",
        "title": "Conexión Mente-Músculo vs Levantar Pesado",
        "channel": "La Verdad Sobre El Fitness",
        "youtubeId": "yY8CEq8NGJI"
      },
      {
        "id": "siyhdMNfUfo",
        "title": "APRENDE LA CONEXIÓN MENTE-MÚSCULO EN MINUTOS",
        "channel": "soyjosefitness",
        "youtubeId": "siyhdMNfUfo"
      },
      {
        "id": "c_kOcD747cA",
        "title": "Flow State x BJJ -Chapter 6 Flow Jiu Jitsu",
        "channel": "BJJ House Okinawa",
        "youtubeId": "c_kOcD747cA"
      },
      {
        "id": "X9UxTYNVPSU",
        "title": "La conexión MENTE MÚSCULO para mejor activación muscular",
        "channel": "Imparable.Tv",
        "youtubeId": "X9UxTYNVPSU"
      },
      {
        "id": "LFSoZ4kGLKw",
        "title": "MÁS HIPERTROFIA Y RENDIMIENTO: LA CONEXIÓN MENTE-MÚSCULO",
        "channel": "Powerexplosive",
        "youtubeId": "LFSoZ4kGLKw"
      },
      {
        "id": "vW4LUBPTvzw",
        "title": "Experto en psicología deportiva: visualización, neurociencia, mindfulness y gestión de emociones.",
        "channel": "Leo Opazo",
        "youtubeId": "vW4LUBPTvzw"
      },
      {
        "id": "s7n7EzS6Ye8",
        "title": "¿Que es el estado de FLUJO? (FLOW) - ¿Cómo mantenerse MOTIVADO en el trabajo?",
        "channel": "Victor Cepero",
        "youtubeId": "s7n7EzS6Ye8"
      },
      {
        "id": "UOYoqDasCmU",
        "title": "#26. Rinde al 100% alcanzando el estado de flow",
        "channel": "Inteligencia Deportiva",
        "youtubeId": "UOYoqDasCmU"
      }
    ],
    "resistance-fatigue": [
      {
        "id": "_9agX3gY1jU",
        "title": "Salud mental, la clase que nadie nos dió | Fernando Lemarroy | TEDxTecdeMty",
        "channel": "TEDx Talks",
        "youtubeId": "_9agX3gY1jU"
      },
      {
        "id": "qH-v3cmyaBs",
        "title": "Carlos Alanís: Cómo construir una mentalidad resiliente",
        "channel": "Aprendemos juntos Mex",
        "youtubeId": "qH-v3cmyaBs"
      },
      {
        "id": "SLQcdMgFr2Q",
        "title": "Estrategias para superar el \"burnout\" y transformar tu estado mental",
        "channel": "Mario Alonso Puig - Oficial",
        "youtubeId": "SLQcdMgFr2Q"
      },
      {
        "id": "-rD7COiH67I",
        "title": "Salud mental y resiliencia - los secretos del alma | DW Documental",
        "channel": "DW Documental",
        "youtubeId": "-rD7COiH67I"
      },
      {
        "id": "Dgj0X5KMkqE",
        "title": "¿Cómo ENTRENAR la mente para superar la FATIGA? Rendimiento Mental",
        "channel": "Rafeta Pallarés- Psicólogo",
        "youtubeId": "Dgj0X5KMkqE"
      },
      {
        "id": "bRvcsam7ZCA",
        "title": "¿Cómo entrenar la fortaleza mental en los corredores?",
        "channel": "Infobae",
        "youtubeId": "bRvcsam7ZCA"
      },
      {
        "id": "5d1IU5ukUbM",
        "title": "SÚPER AYUDA #299 Solución Al Síndrome de Fatiga Crónica",
        "channel": "MetabolismoTV",
        "youtubeId": "5d1IU5ukUbM"
      },
      {
        "id": "ojzmsHuYuEM",
        "title": "Fatiga mental: Qué es y cinco consejos para combatirla",
        "channel": "Jordi Wu",
        "youtubeId": "ojzmsHuYuEM"
      },
      {
        "id": "6WX3RH25o8M",
        "title": "Signos de que Tienes Burn Out, NO Pereza (y Cómo Resolverlo)",
        "channel": "DR LA ROSA",
        "youtubeId": "6WX3RH25o8M"
      },
      {
        "id": "7K3lSLXS6PY",
        "title": "Cansancio excesivo y fatiga mental",
        "channel": "Desansiedad",
        "youtubeId": "7K3lSLXS6PY"
      }
    ]
  },
  "pt": {
    "self-determination": [
      {
        "id": "dOLs5Ee5e1M",
        "title": "Você sabia? - Motivação na Psicologia do Esporte",
        "channel": "Academia Nacional de Psicologia",
        "youtubeId": "dOLs5Ee5e1M"
      },
      {
        "id": "ImBgfEctcqg",
        "title": "AÇÕES MOTIVACIONAIS NA PSICOLOGIA DO ESPORTE",
        "channel": "João Cozac Psicologia Esportiva",
        "youtubeId": "ImBgfEctcqg"
      },
      {
        "id": "cm5wG4KCNVg",
        "title": "Teoria da autodeterminação e o treinamento na água",
        "channel": "Prof. Henrique França Rodrigues",
        "youtubeId": "cm5wG4KCNVg"
      },
      {
        "id": "yOGls5h-y6Y",
        "title": "Aprendizagem Significativa - Parte V - Motivação e a Teoria da Autodeterminação (TAD).",
        "channel": "Fabrício Rios",
        "youtubeId": "yOGls5h-y6Y"
      },
      {
        "id": "KaoNFfbfz4c",
        "title": "O QUE É PSICOLOGIA DO ESPORTE - [SIMPLES]",
        "channel": "Pablo Franco - PSICOLOGIA E ESPORTE",
        "youtubeId": "KaoNFfbfz4c"
      },
      {
        "id": "thJtMM0blGo",
        "title": "COMO PREVENIR O ESTRESSE? A AUTODETERMINAÇÃO",
        "channel": "Veredas Treinamento",
        "youtubeId": "thJtMM0blGo"
      },
      {
        "id": "MGcLQbCYvXk",
        "title": "COMO SE MANTER MOTIVADO NA VIDA E NOS TREINOS? CARIANI DEU AULA",
        "channel": "Trechos Maromba",
        "youtubeId": "MGcLQbCYvXk"
      },
      {
        "id": "XAxU6roY_nU",
        "title": "FAÇA ISSO PARA TER MOTIVAÇÃO PARA IR NA ACADEMIA",
        "channel": "Cortes do Sem Groselha [OFICIAL]",
        "youtubeId": "XAxU6roY_nU"
      },
      {
        "id": "ocJ19AX88DQ",
        "title": "Explicando a teoria da autodeterminação (Self-determination theory)",
        "channel": "Futebol Mental Brasil",
        "youtubeId": "ocJ19AX88DQ"
      },
      {
        "id": "jaOprAo3MpU",
        "title": "Exercício físico e autodeterminação",
        "channel": "Psicólogo Jhonas Rodrigues",
        "youtubeId": "jaOprAo3MpU"
      }
    ],
    "mind-muscle-flow": [
      {
        "id": "PVOQ1EMWhoA",
        "title": "EP 07 - A PERSONALIDADE AUTOTÉLICA PERANTE A ADVERSIDADE",
        "channel": "Carlos Reis",
        "youtubeId": "PVOQ1EMWhoA"
      },
      {
        "id": "n8uZ6XFR5sU",
        "title": "Como vencer o nervosismo na competição e entrar no Flow",
        "channel": "Atleta Campeão",
        "youtubeId": "n8uZ6XFR5sU"
      },
      {
        "id": "P1njJiGT21k",
        "title": "Aspectos psicológicos do estado flow de performance",
        "channel": "João Cozac Psicologia Esportiva",
        "youtubeId": "P1njJiGT21k"
      },
      {
        "id": "bfGE40vC12U",
        "title": "Estado de Flow | Como ativá-lo quando quiser",
        "channel": "Vida de Titã",
        "youtubeId": "bfGE40vC12U"
      },
      {
        "id": "KEgpvGNur1M",
        "title": "Fique no Estado de FLUXO e seja FELIZ | Seja Uma Pessoa Melhor",
        "channel": "SejaUmaPessoaMelhor",
        "youtubeId": "KEgpvGNur1M"
      },
      {
        "id": "wpGQYB-SK4A",
        "title": "COMO FUNCIONA A CONEXÃO MENTE E MUSCULO ? FABIO GIGA E MARADONA EXPLICAM",
        "channel": "Growth Experts",
        "youtubeId": "wpGQYB-SK4A"
      },
      {
        "id": "ptcPaU76IFA",
        "title": "Conexão mente-músculo aumenta a ativação muscular / Co-contração - Eletromiografia #26",
        "channel": "Treino em FOCO",
        "youtubeId": "ptcPaU76IFA"
      },
      {
        "id": "KvGQ8Xkx4SM",
        "title": "Conexão mente - músculo: entenda CIENTIFICAMENTE como é e usar",
        "channel": "Diego Seu Personal",
        "youtubeId": "KvGQ8Xkx4SM"
      },
      {
        "id": "4M2DRmOgJhw",
        "title": "Conectando mente e músculo durante o exercício",
        "channel": "Dr. Paulo Gentil",
        "youtubeId": "4M2DRmOgJhw"
      },
      {
        "id": "T4SdlLe0WxM",
        "title": "COMO ATINGIR A CONEXÃO MENTE E MÚSCULO!",
        "channel": "Caio Bottura",
        "youtubeId": "T4SdlLe0WxM"
      }
    ],
    "resistance-fatigue": [
      {
        "id": "2g1_FIGjuvc",
        "title": "SAÚDE MENTAL NO TRABALHO | Série \"Profissional do Futuro”",
        "channel": "Prazer, Karnal - Canal Oficial de Leandro Karnal",
        "youtubeId": "2g1_FIGjuvc"
      },
      {
        "id": "d59KAq6iyX8",
        "title": "TREINAMENTO MENTAL NO ESPORTE: AUTOCONTROLE, RESILIÊNCIA",
        "channel": "João Cozac Psicologia Esportiva",
        "youtubeId": "d59KAq6iyX8"
      },
      {
        "id": "TKaBh_eKBlc",
        "title": "13 maneiras de FORTALECER SUA MENTE e aumentar sua RESILIÊNCIA",
        "channel": "NeuroVox",
        "youtubeId": "TKaBh_eKBlc"
      },
      {
        "id": "jJhEIBp0FF4",
        "title": "SUA MENTE PRECISA SER FORTE | 20 minutos de fortalecimento mental e disciplina",
        "channel": "MENTE FORTE",
        "youtubeId": "jJhEIBp0FF4"
      },
      {
        "id": "hzH7dB902es",
        "title": "FORÇA MENTAL: Construa a Resiliência Para Superar Qualquer Desafio",
        "channel": "BrainPower | A Academia Cerebral",
        "youtubeId": "hzH7dB902es"
      },
      {
        "id": "AwXdR24wWyE",
        "title": "A Arte da Resiliência: Treine Sua Mente Para Nunca Desistir | Audiolivro Completo",
        "channel": "Café & Capítulos Audiolivros",
        "youtubeId": "AwXdR24wWyE"
      },
      {
        "id": "yjB5tkMfkdY",
        "title": "Como ter disciplina na dieta e no treino | Passo a passo",
        "channel": "Leandro Twin",
        "youtubeId": "yjB5tkMfkdY"
      },
      {
        "id": "B57eOqeLVfc",
        "title": "O PODER DA DISCIPLINA (COM RENATO CARIANI) | Os Sócios 160",
        "channel": "Os Sócios Podcast",
        "youtubeId": "B57eOqeLVfc"
      },
      {
        "id": "bDc322gMbnc",
        "title": "Psicologia do Esporte e do Exercício",
        "channel": "O que o exercício físico tem a ver com isso ?",
        "youtubeId": "bDc322gMbnc"
      },
      {
        "id": "68ZkaWBOP7I",
        "title": "Entrevista - Afonso Machado - Psicologia do Esporte",
        "channel": "obsesporteunespfm",
        "youtubeId": "68ZkaWBOP7I"
      }
    ]
  }
};

// Surface chrome (hero, controls, card labels), localized EN · ES · PT.
export const CAVE_L10N = {
  "en": {
    "kicker": "Coach’s Cave · Private Vault",
    "title": "The Coach’s Cave",
    "sub": "Your private edge. A sport-psychology and motivation film library — curated to keep your iron sharp as the exercise science evolves. Sealed to the head coach.",
    "lockChip": "Gated to Admin",
    "decksKicker": "Knowledge Decks",
    "langLabel": "Library Language",
    "statFilms": "Films",
    "statDecks": "Decks",
    "statLangs": "Languages",
    "searchPlaceholder": "Filter this deck — title or channel…",
    "searchAria": "Filter films in this deck",
    "showing": "Showing {v} of {t} films",
    "noFilms": "No films match your filter.",
    "clear": "Clear",
    "streamNow": "Stream Now",
    "channelLabel": "Channel",
    "collapse": "Close video",
    "playerNote": "Tip: settle in, audio on. Study the framing, then steal what sharpens your coaching."
  },
  "es": {
    "kicker": "La Cueva del Coach · Bóveda Privada",
    "title": "La Cueva del Coach",
    "sub": "Tu ventaja privada. Una biblioteca de películas de psicología deportiva y motivación — curada para mantener tu hierro afilado mientras evoluciona la ciencia del ejercicio. Sellada para el head coach.",
    "lockChip": "Solo Administrador",
    "decksKicker": "Mazos de Conocimiento",
    "langLabel": "Idioma de la Biblioteca",
    "statFilms": "Películas",
    "statDecks": "Mazos",
    "statLangs": "Idiomas",
    "searchPlaceholder": "Filtra este mazo — título o canal…",
    "searchAria": "Filtrar películas en este mazo",
    "showing": "Mostrando {v} de {t} películas",
    "noFilms": "Ninguna película coincide con tu filtro.",
    "clear": "Limpiar",
    "streamNow": "Reproducir",
    "channelLabel": "Canal",
    "collapse": "Cerrar video",
    "playerNote": "Consejo: acomódate, con audio. Estudia el enfoque y quédate con lo que afile tu coaching."
  },
  "pt": {
    "kicker": "A Caverna do Coach · Cofre Privado",
    "title": "A Caverna do Coach",
    "sub": "Sua vantagem privada. Uma biblioteca de filmes de psicologia esportiva e motivação — curada para manter seu ferro afiado enquanto a ciência do exercício evolui. Selada para o head coach.",
    "lockChip": "Apenas Administrador",
    "decksKicker": "Decks de Conhecimento",
    "langLabel": "Idioma da Biblioteca",
    "statFilms": "Filmes",
    "statDecks": "Decks",
    "statLangs": "Idiomas",
    "searchPlaceholder": "Filtre este deck — título ou canal…",
    "searchAria": "Filtrar filmes neste deck",
    "showing": "Mostrando {v} de {t} filmes",
    "noFilms": "Nenhum filme corresponde ao seu filtro.",
    "clear": "Limpar",
    "streamNow": "Assistir",
    "channelLabel": "Canal",
    "collapse": "Fechar vídeo",
    "playerNote": "Dica: acomode-se, com áudio. Estude a abordagem e fique com o que afia o seu coaching."
  }
};
