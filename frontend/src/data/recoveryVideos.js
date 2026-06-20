// src/data/recoveryVideos.js
// ─────────────────────────────────────────────────────────────────────────────
// BBF Recovery Video Catalog — trilingual demo videos per exercise (EN/ES/PT).
// Generated from BBFRecoveryVideoCatalog.xlsx (508 curated YouTube videos across
// 53 exercises). Keyed by the recovery library exercise id (same id the
// bbf-agentic-recovery edge fn returns), so cards look up videos client-side —
// no edge payload bloat. Each entry: { id: <youtubeId>, t: <title>, q: <stars 0-5> }.
// Lists are ordered best-first (by quality). ES/PT fall back to EN when absent.

export const RECOVERY_VIDEOS = {
  stat_calf_001: { // Wall Calf Stretch (Gastrocnemius)
    en: [{ id: "mtVqe4CR_60", t: "Wall Calf Stretch - soleus and gastrocnemius assisted stretch for ankle Dorsiflexion", q: 5 }, { id: "y01ri_43G50", t: "How to do a calf (gastrocnemius) stretch | Bupa Health", q: 5 }, { id: "DG99LVYOY9M", t: "How to Stretch Your Calf - with a Focus on the Gastrocnemius Muscle | Exercise Tutorial", q: 5 }, { id: "YTYQo4WvJHA", t: "Stretch Tutorial: Standing Calf Stretch On Wall", q: 5 }, { id: "DcnlrEs986s", t: "Calf Muscle Stretch (gastrocnemius)", q: 4 }],
    es: [{ id: "qxVUlsEeDbM", t: "COMO ESTIRAR GEMELOS EN LA PARED (MOVILIDAD DE TOBILLO)", q: 5 }, { id: "nJNGMK7_Pj4", t: "Estiramiento correcto de musculos gemelo y el soleo", q: 5 }, { id: "TyZAmDcD6mM", t: "Estiramiento de gemelos en la pared", q: 4 }, { id: "1-uPT7huss0", t: "Estiramiento de gemelo en posicion bipedo con apoyo en pared", q: 4 }],
    pt: [{ id: "ltH2dnWUnPY", t: "ALONGAMENTO DA PANTURRILHA NA PAREDE - METODO YOUFISIO", q: 5 }, { id: "kc2glDjeNfQ", t: "Alongamento Panturrilhas na Parede", q: 4 }, { id: "zWKZO-SSIic", t: "Alongamento de panturrilha (parede)", q: 4 }, { id: "MXkSRlrTQ00", t: "Alongamento De Panturrilha Em Pe Apoio Na Parede", q: 4 }],
  },
  stat_calf_002: { // Bent-Knee Calf Stretch (Soleus)
    en: [{ id: "vzg233ClYdU", t: "Soleus Calf Stretch with a bent knee", q: 5 }, { id: "ajJDppnp3_0", t: "Bent-Knee Calf Stretch for the Soleus", q: 5 }, { id: "eM3OBEIvHdE", t: "Stretch Tutorial: Single Leg Soleus Stretch On Step", q: 5 }],
    es: [{ id: "admR8YJOvXw", t: "Estiramiento del musculo soleo - FisioClinics", q: 5 }, { id: "dxLH3lzHXZA", t: "Estiramiento de soleo", q: 5 }, { id: "nJNGMK7_Pj4", t: "Estiramiento correcto de musculos gemelo y el soleo", q: 4 }, { id: "k4yLrSx0880", t: "Los Mejores ESTIRAMIENTOS para GEMELO y SOLEO", q: 4 }],
    pt: [{ id: "C-SOz-slJuE", t: "Alongamento De Panturrilha Em Pe Joelho Flexionado", q: 5 }, { id: "TeOC9Tb8DKI", t: "Como Alongar Panturrilha?", q: 3 }],
  },
  stat_calf_003: { // Step-Drop Calf Hang
    en: [{ id: "yhnBpnrhRpk", t: "Stretch Tutorial: Calf Stretch On A Step", q: 5 }, { id: "vO-U9MBCOQk", t: "How to Perform the Standing Step Stretch (Heel Drop) Correctly", q: 5 }, { id: "iCWJFwK1ad0", t: "Physiotherapy: Calf stretch over edge of step", q: 5 }, { id: "drJYhTQWcAk", t: "Calf Stretch on a Step | Double Heel Stretch", q: 4 }, { id: "8PQleXdrnXg", t: "An amazing way to stretch your calf muscles", q: 4 }],
    es: [{ id: "qxVUlsEeDbM", t: "COMO ESTIRAR GEMELOS EN LA PARED (MOVILIDAD DE TOBILLO)", q: 3 }],
    pt: [{ id: "MXkSRlrTQ00", t: "Alongamento De Panturrilha Em Pe Apoio Na Parede", q: 3 }],
  },
  stat_quad_001: { // Standing Quad Stretch
    en: [{ id: "kia2OzZiwqw", t: "Standing Quad Stretch Tutorial - Proper Form and Technique", q: 5 }, { id: "Td-9CSgSFhs", t: "Standing Quadriceps Stretch", q: 5 }, { id: "kzAsm4WQqvQ", t: "How To Do A Standing Quad Stretch", q: 5 }, { id: "kWH5pFx2Itc", t: "How To Static Stretch The Quadriceps (From A Standing Position)", q: 5 }, { id: "zi5__zBRzYc", t: "Standing Quadricep Stretch", q: 4 }],
    es: [{ id: "xpKhkq39-As", t: "Estiramiento de cuadriceps de pie", q: 5 }, { id: "-CdDxLtwhKo", t: "ESTIRAMIENTO DEL CUADRICEPS DE PIE (UNILATERAL)", q: 5 }, { id: "1XFcTwgtIik", t: "319. Estiramiento de cuadriceps de pie", q: 4 }, { id: "xsyaGS6N1yw", t: "Como Estirar los Cuadriceps - 5 Ejercicios", q: 4 }],
    pt: [{ id: "4sEq7OYYee0", t: "Alongamento de quadriceps (em pe)", q: 5 }, { id: "oNm3_Ce6IDg", t: "Alongamento de quadriceps em pe unilateral", q: 5 }, { id: "gnuvd9POYWk", t: "COMO ALONGAR A COXA I QUADRICEPS CORRETAMEMENTE", q: 5 }, { id: "0mM7a5fUabQ", t: "Como fazer ALONGAMENTO para o Quadriceps?", q: 4 }],
  },
  stat_quad_002: { // Couch Stretch (Wall-Assisted)
    en: [{ id: "Sa6R_rYjux0", t: "Couch Stretch on Wall | Modifications for Tight Hip Flexors", q: 5 }, { id: "WKo4APrwfXQ", t: "Couch Stretch Progressions: Beginner To Advanced", q: 5 }, { id: "ca54fyiIq2I", t: "Wall quad hip flexor: if you do only one stretch today this is the one", q: 5 }, { id: "nTJaGnjUkTY", t: "How to Do a Couch Stretch | Quad & Hip Flexor Mobility", q: 5 }],
    es: [{ id: "PyAGiPG53qM", t: "Como estirar flexores de cadera? (psoas iliaco y cuadriceps)", q: 5 }, { id: "8vuGIAvnkoQ", t: "El Mejor Estiramiento para Flexores de la Cadera Si Pasas el Dia Sentado", q: 4 }, { id: "3vnKWdqLTB4", t: "La guia completa de estiramientos || Flexores de Cadera", q: 4 }],
    pt: [{ id: "AQbLwqxTaIw", t: "Mobilidade - flexor de quadril na parede", q: 5 }, { id: "j_GJLEz-X9Q", t: "4 top alongamentos para quadriceps e flexores de quadril", q: 4 }, { id: "5766kVO5AqI", t: "Como Alongar os Flexores do Quadril para Aliviar a Dor Lombar", q: 4 }],
  },
  stat_quad_003: { // Side-Lying Quad Stretch
    en: [{ id: "C2IuPAdGzjI", t: "Side-Lying Quad Stretch Tutorial | Improve Flexibility & Relieve Tightness", q: 5 }, { id: "uRRwljV-Nlk", t: "Quad Stretch in Sidelying - Ask Doctor Jo", q: 5 }, { id: "NgEJPddtovQ", t: "Easy & Safe Side Lying Quad Stretch for Tight Hips and Thighs", q: 5 }, { id: "Z9NPI_3HXUY", t: "Quadriceps Stretch- Sidelying", q: 4 }, { id: "tlG6A8CqClk", t: "Side-Lying Quad Stretch", q: 4 }],
    es: [{ id: "GztbzAlc2Y0", t: "Estiramiento Cuadriceps decubito lateral", q: 5 }, { id: "fFppaA5IjGA", t: "Estiramiento Dinamico de Cuadriceps - De lateral Nivel 1", q: 4 }, { id: "w2n_Hf-q76w", t: "FISIOTERAPIA EN CASA: Estiramiento de cuadriceps", q: 4 }],
    pt: [{ id: "t6-Z1-Ocflk", t: "ALONGAMENTO QUADRICEPS DEITADO LATERAL", q: 5 }, { id: "tfbWThpdsA4", t: "Alongamento do quadriceps e flexores do quadril - deitado no solo", q: 5 }, { id: "keVZOIUeed4", t: "Alongamento Unilateral De Quadriceps Deitado", q: 4 }],
  },
  stat_ham_001: { // Seated Forward Fold
    en: [{ id: "oJX8EKF3TqM", t: "Seated Forward Fold - Beginner Hamstring Stretch", q: 5 }, { id: "d-Hu3ZwV0m8", t: "Seated Forward Fold", q: 5 }, { id: "-xLL6MbExc4", t: "Hamstrings in Seated Forward Bend | YogaUOnline", q: 5 }, { id: "UuYDj4YibVQ", t: "Single Leg Forward Fold for Tight Hamstrings", q: 5 }],
    es: [{ id: "_d7yEj2DCzU", t: "Estiramiento de isquiotibiales sentado", q: 5 }, { id: "FyNxSg4YyDA", t: "ESTIRAMIENTO DE ISQUIOTIBIALES SENTADO", q: 5 }, { id: "qCuDJkgt8N8", t: "Estiramiento femoral sentado", q: 4 }, { id: "AN8eTwCfeL4", t: "Formas fundamentales de estirar los isquiotibiales", q: 4 }],
    pt: [{ id: "mtEddr5CF7c", t: "ALONGAMENTO DOS ISQUIOTIBIAIS SENTADO - METODO YOUFISIO", q: 5 }, { id: "iPBFhstjoZc", t: "ALONGAMENTO DE ISQUIOTIBIAIS SENTADO (TOCAR OS PES)", q: 5 }, { id: "XY6ly6taxH0", t: "Alongamento dos isquios Tibiais - unilateral e sentado no solo", q: 4 }],
  },
  stat_ham_002: { // Supine Strap Hamstring Stretch
    en: [{ id: "Il1L75v6gq0", t: "Hamstring Stretch with a Strap Supine - Ask Doctor Jo", q: 5 }, { id: "r7Of03DkVMA", t: "Supine Hamstring Stretch With Strap", q: 5 }, { id: "VSoNl_WSCiI", t: "Beginner Hamstring Stretch with Strap | Tight Hamstrings", q: 5 }, { id: "LY_VQkm2yrk", t: "How to do a Hamstring Stretch with Strap - Flexibility - Wellen", q: 5 }, { id: "iUNc_M2VvIU", t: "Supine Hamstring Stretch", q: 4 }],
    es: [{ id: "CLQUOJZlJNM", t: "Estiramiento de isquiotibiales en supino", q: 5 }, { id: "65x3Gh7Qnwk", t: "Estiramiento de isquiotibiales en decubito con toalla", q: 5 }, { id: "Ntt0Fq-268g", t: "ESTIRAMIENTO de ISQUIOTIBIALES con BANDA ELASTICA | Pilates", q: 4 }, { id: "JEhFGnmRNFk", t: "Como hacer el estiramiento de isquiotibiales tumbado", q: 4 }],
    pt: [{ id: "oH8NrbkSEtw", t: "EXERCICIO ALONGAMENTO DOS ISQUIOTIBIAIS COM FAIXA EM DECUBITO DORSAL", q: 5 }, { id: "DRaXCfb7b_Y", t: "Alongamento de ISQUIOTIBIAIS e de CADEIA MUSCULAR POSTERIOR", q: 4 }, { id: "7F1jXnsM_8Y", t: "Como alongar Posterior de Coxa - Isquiotibiais?", q: 4 }],
  },
  stat_ham_003: { // Single-Leg Toe-Touch (Staggered)
    en: [{ id: "Grhufztdqg8", t: "Standing Single Leg Hamstring Stretch", q: 5 }, { id: "wokZdvOSat4", t: "Stagger Stance Hamstring Stretch", q: 5 }, { id: "3NXHvJl0GsI", t: "Best Single Leg Hamstring Stretch", q: 5 }, { id: "2s2t3mEYZNo", t: "Standing Hamstring Stretch", q: 4 }],
    es: [{ id: "t19U1wN2mHE", t: "Estiramientos isquiotibiales como hacerlo correctamente", q: 4 }, { id: "1kFspUd21gA", t: "Estiramiento eficaz de isquiotibiales y cadena posterior de la pierna", q: 4 }, { id: "iR1A9qAYJN4", t: "Como estirar los isquiotibiales adecuadamente", q: 4 }],
    pt: [{ id: "LEuNrkj_FPY", t: "Como Fazer Alongamento de Posterior de Coxa", q: 4 }, { id: "-rKLG1dl3kE", t: "3 exercicios para flexibilidade dos isquiotibiais", q: 4 }, { id: "mtEddr5CF7c", t: "ALONGAMENTO DOS ISQUIOTIBIAIS SENTADO - METODO YOUFISIO", q: 3 }],
  },
  stat_add_001: { // Butterfly Stretch
    en: [{ id: "cjFTsl5sG5E", t: "Butterfly Stretch | A Tutorial", q: 5 }, { id: "1ZbyKG0LoSc", t: "Butterfly Stretch - Inner thigh groin and hip adductor stretch", q: 5 }, { id: "DqkNkG72H_k", t: "Adductor Stretch (Butterfly Stretch)", q: 5 }, { id: "MdE_Cj6ChLo", t: "Butterfly Stretch for Better Hip Mobility - CORE Chiropractic", q: 4 }, { id: "Xf8W0Q3MePE", t: "Sitting Adductor Stretch or Butterfly Stretch", q: 4 }],
    es: [{ id: "WqgWfMHyX5o", t: "COMO ESTIRAR LOS ADUCTORES? LA MARIPOSA", q: 5 }, { id: "10lIDPgZwKQ", t: "Mariposa PNF Estiramiento de Aductores", q: 5 }, { id: "0-7HPcJbXiU", t: "Estiramiento de aductores", q: 5 }, { id: "JVA133q_jqc", t: "La guia completa de estiramientos || Aductores", q: 4 }],
    pt: [{ id: "OGJzqvXQ3jo", t: "Como alongar interno de quadril (adutores) | BORBOLETINHA", q: 5 }, { id: "V5u7-lKrtvs", t: "Alongamento De Adutores Da Coxa Sentado Borboleta", q: 5 }, { id: "8xnhUqiILcE", t: "Alongamento Adutores Borboleta", q: 4 }, { id: "AnW0cSpcxy8", t: "Como Alongar os Adutores do Quadril? - TEF Flexibilidade", q: 4 }],
  },
  stat_add_002: { // Side-Lunge Adductor Hold
    en: [{ id: "kEVDDL26qv8", t: "Get a Deeper Stretch: Side Lunge for Adductor Flexibility", q: 5 }, { id: "nV3RsHokRqw", t: "How to do a side lunge adductor stretch", q: 5 }, { id: "WYcF_smoZ9c", t: "Lunge: Adductor (Inner Thigh) Mobility", q: 5 }, { id: "uy2j5BpOaVw", t: "TRX Side Lunge - Adductor Stretch", q: 4 }],
    es: [{ id: "0ghr8RgtL_E", t: "ADUCTORES: estocadas laterales", q: 5 }, { id: "JVA133q_jqc", t: "La guia completa de estiramientos || Aductores", q: 4 }, { id: "t_28IxeuMGE", t: "Como estirar los Aductores? Truco para reducir las pubalgias!", q: 4 }],
    pt: [{ id: "MfYOWF9Mxa8", t: "COMO ALONGAR A PARTE INTERNA DA COXA CORRETAMENTE", q: 5 }, { id: "lmdPqK7QmIE", t: "Como fazer alongamento adutor coxa", q: 5 }, { id: "IcygCD-yvLc", t: "ALONGAMENTO ADUTOR E LATERAL COXA | TREINO", q: 4 }],
  },
  stat_abd_001: { // Figure-4 Glute/Abductor Stretch
    en: [{ id: "-g0nuyTHMrI", t: "Piriformis Figure 4 Stretch - Ask Doctor Jo", q: 5 }, { id: "VgjgTGnBkx0", t: "How To Do Figure 4 Stretch", q: 5 }, { id: "E6sqUHFt6Ng", t: "Figure 4 (Piriformis) Stretch for Sciatica Pain", q: 5 }, { id: "2E8WWX4cOc4", t: "Seated Figure Four Stretch for Piriformis", q: 5 }, { id: "xVq2-g_leTI", t: "Supine Piriformis Stretch (Figure 4)", q: 4 }],
    es: [{ id: "ettY0W0qswA", t: "Estiramiento para el piramidal gluteos y musculos pelvitrocantéreos", q: 5 }, { id: "C12bTqPVGDs", t: "Estiramientos del piramidal y gluteos", q: 4 }, { id: "7LYztX1VQLE", t: "TRX FIGURE-4 STRETCH / Estiramiento gluteo", q: 4 }],
    pt: [{ id: "bF6KGwoxXBM", t: "Alongamento gluteo no solo figura 4 (decubito dorsal)", q: 5 }, { id: "IVyMV-O4BwM", t: "PIRIFORME INFLAMADO 3 MELHORES EXERCICIOS DE ALONGAMENTO", q: 5 }, { id: "mWNjEt0Nz1A", t: "Auto-alongamentos gluteo medio e piriforme", q: 4 }],
  },
  stat_abd_002: { // Standing Cross-Body IT/Abductor Stretch
    en: [{ id: "wzDoSQ8-GWY", t: "IT Band Stretch Standing - Ask Doctor Jo", q: 5 }, { id: "LYbDMGYDn-4", t: "How to Stretch IT Band and Sides of Hips (Standing Cross Over)", q: 5 }, { id: "58jzhFwZdGs", t: "How To Do Hip Abductor & ITB Stretch; Standing | Stretching Demo", q: 5 }, { id: "Cb5GaOIIdg0", t: "Standing IT Band Stretch - Hip Exercise - CORE Chiropractic", q: 5 }, { id: "ZMR40rOmE94", t: "Best Abductor Stretch Standing Leg-cross Abductor Stretch", q: 5 }],
    es: [{ id: "NoVttpb5hxA", t: "799. Estiramiento de la banda iliotibial de pie", q: 5 }, { id: "RBkCy36eUuA", t: "Estiramiento Cintilla iliotibial de pie", q: 5 }, { id: "c39TM6q1L60", t: "Estiramiento cintilla iliotibial de pie vista lateral", q: 5 }, { id: "RspDFNrgYVY", t: "Estiramiento cintilla iliotibial apoyado en pared", q: 4 }],
    pt: [{ id: "uI_JsAkhgE8", t: "Alongamento dos abdutores do quadril com perna cruzada", q: 5 }, { id: "G6UBKHN1Y2c", t: "Alongamento da banda iliotibial para aliviar joelho e quadril", q: 5 }, { id: "EjwzUb_CvQk", t: "Alongamento dos abdutores do quadril e periforme", q: 4 }],
  },
  stat_sho_001: { // Cross-Body Shoulder Stretch
    en: [{ id: "1Sfl3iYM1Jg", t: "Cross Body Shoulder Stretch Tutorial Flexibility Guide", q: 5 }, { id: "O5bFanxcpWE", t: "A Guide to the Cross Body Shoulder Stretch", q: 5 }, { id: "uNmWSg705JA", t: "How To Do A Cross Body Shoulder Stretch", q: 4 }, { id: "pD236y4-YRc", t: "Cross-Body Shoulder Stretch Quick and Easy", q: 4 }],
    es: [{ id: "RaODfAptWSg", t: "One-armed shoulder stretch Estiramiento de hombro con brazo cruzado", q: 4 }, { id: "ghgBBQQMY8g", t: "Estiramientos de Hombro Para aliviar el dolor y mejorar la flexibilidad", q: 3 }, { id: "DxK-XWpBxKM", t: "RUTINA de ESTIRAMIENTOS para el HOMBRO 30 minutos", q: 3 }],
    pt: [{ id: "0BmhNwyg0hc", t: "Mobilidade 17 Alongamento de ombro com o braco cruzado", q: 4 }, { id: "pw4Noz6PAmM", t: "Alongamento com bracos cruzados", q: 4 }, { id: "nVv_uog4o8Y", t: "DOR NO OMBRO 7 Melhores Alongamentos p Ombros Tensos", q: 3 }],
  },
  stat_sho_002: { // Doorway Pec/Front-Delt Stretch
    en: [{ id: "M850sCj9LHQ", t: "How to Do a Doorway Pec Stretch Exercise 90 Degrees Abduction MedBridge", q: 5 }, { id: "bZ-eaBPOGiM", t: "How to do Doorway Pec Stretch Flexibility Wellen", q: 5 }, { id: "jOdUiWMfWlw", t: "Doorway Chest Stretch Two Ways Pec Major and Pec Minor", q: 5 }, { id: "CEQMx4zFwYs", t: "Doorway Pec Stretch", q: 4 }],
    es: [{ id: "2Z3DNkZ6V0k", t: "Estiramiento Pectoral Marco Puerta", q: 5 }, { id: "LVZZCk7mijw", t: "5 EJERCICIOS PARA ESTIRAR PECTORALES COMO ELONGAR el PECHO", q: 4 }, { id: "fGRtFJhhCmk", t: "Estiramientos de los Pectorales Fisaude", q: 4 }],
    pt: [{ id: "gBvv8NRTIII", t: "COMO FAZER O ALONGAMENTO PEITORAL MENOR Fisioprev", q: 5 }, { id: "wVqivQADUfo", t: "Alongamento peitoral na parede", q: 4 }, { id: "6Be-s3RwVp4", t: "Alongamento de peitoral parede", q: 4 }],
  },
  stat_sho_003: { // Overhead Triceps/Lat Reach
    en: [{ id: "cPTrm13hSSo", t: "How To Do Overhead Tricep Stretch", q: 5 }, { id: "R0V4ldEg5ug", t: "Overhead Lat and Tricep Stretch", q: 5 }, { id: "nxo1JJoFd1Q", t: "Increase Overhead Mobility Loaded Lat and Tricep Stretch", q: 4 }, { id: "3_eaPeNRpzk", t: "Overhead Tricep Stretch", q: 4 }],
    es: [{ id: "NUmJkdFMRho", t: "Estiramiento de triceps por encima de la cabeza", q: 4 }, { id: "TEKJt1PaN0s", t: "Estiramiento dinamico de triceps y dorsal", q: 3 }, { id: "3E2djihwUMg", t: "Estiramiento dorsal ancho triceps oblicuos", q: 3 }],
    pt: [{ id: "hCC4kISP4zU", t: "Como alongar o Triceps TEF Flexibilidade", q: 5 }, { id: "yvnnMu8PfY0", t: "Como fazer ALONGAMENTO para o Triceps", q: 4 }, { id: "T4KOPrmWYV8", t: "Alongamento de Triceps com Professor Luis Felipe Sibioni", q: 4 }],
  },
  stat_chest_001: { // Wall Pec Stretch
    en: [{ id: "7yJ1357Hj5M", t: "WALL PEC STRETCH Chest stretch on wall for improved shoulder and pec mobility", q: 5 }, { id: "IOZJyvCwQ6I", t: "How To Do a Proper Pec Stretch Using a Wall", q: 5 }, { id: "X27ASvkYUUc", t: "How To Wall Chest Stretch Pec Contract-Relax Flexopedia Entry 128", q: 5 }, { id: "p6rzT9-xnQs", t: "Wall Chest Stretch Pec Stretch", q: 4 }],
    es: [{ id: "EauhryUmS7A", t: "ESTIRAMIENTO DE PECHO CONTRA LA PARED", q: 4 }, { id: "TufwPKlp31w", t: "Estiramiento de pectoral en la pared", q: 4 }, { id: "EAVXZ3a10BI", t: "Estiramiento pectoral con el brazo flexionado y apoyado", q: 4 }],
    pt: [{ id: "6Be-s3RwVp4", t: "Alongamento de peitoral parede", q: 4 }, { id: "wVqivQADUfo", t: "Alongamento peitoral na parede", q: 4 }, { id: "FwvrxUNwyIY", t: "Alongamento Peitoral Parede", q: 4 }],
  },
  stat_chest_002: { // Floor Snow-Angel (Supine Pec Opener)
    en: [{ id: "sl2TU1EPoWY", t: "Supine Snow Angels A great exercise to improve overhead shoulder mobility", q: 5 }, { id: "IEI1a5kie3s", t: "Snow Angel Stretch Anchorage Alaska Chiropractor", q: 5 }, { id: "ujPhX-RuBFc", t: "Snow Angel Supine", q: 4 }, { id: "uSnJ_CzIiWM", t: "Movement Demo Snow Angel Supine", q: 4 }],
    es: [{ id: "YwjethwlqPs", t: "Ejercicios para los hombros Angel de Nieve", q: 3 }, { id: "RvUrLmdckfM", t: "PECHO CERRADO 4 EJERCICIOS PARA ABRIR Y DESCOMPRIMIR", q: 3 }, { id: "0YZ44uO3y7U", t: "Yoga para Apertura de Pecho Mejorar la Postura", q: 3 }],
    pt: [{ id: "p2qNW8XR5Tc", t: "POSTURA ABERTA com facil alongamento de Peitoral", q: 4 }, { id: "EcWqsbnJq5A", t: "Alongamento para peitoral melhora da POSTURA", q: 3 }],
  },
  stat_neck_001: { // Lateral Neck Stretch
    en: [{ id: "GSoXPJRnR6E", t: "Levator Scapula Stretch Ask Doctor Jo", q: 5 }, { id: "U9tijfMcfP8", t: "How to do a Levator Scapulae Stretch Proper Form and Technique NASM", q: 5 }, { id: "NLyZZ97UDd8", t: "Levator Scapulae NECK Stretch for All sitting iStretch", q: 4 }, { id: "TyH7ow8SsJ0", t: "Instant Relief for Neck and Shoulder Tension Levator Scapulae Stretch", q: 4 }],
    es: [{ id: "RIvdhEsd_2M", t: "Estiramiento cervical lateral Trapecio superior y cuello", q: 5 }, { id: "dx-zSyVV6OU", t: "Estiramiento lateral de cuello", q: 4 }, { id: "HuM2vN1dqOc", t: "ESTIRAMIENTO CUELLO LATERAL TRAPECIOS", q: 4 }, { id: "bgURkoGJ0hs", t: "Ejercicios para el dolor en el elevador de la escapula o cuello", q: 4 }],
    pt: [{ id: "8qE4CT_wNZQ", t: "3 Alongamento do musculo elevador da escapula", q: 5 }, { id: "_PexSgCYsPE", t: "Alongamento Elevador da Escapula Saude Minuto", q: 4 }, { id: "tIUvzon-xiw", t: "Dor no pescoco Alongamentos para aliviar a tensao muscular na cervical", q: 4 }],
  },
  stat_neck_002: { // Levator/Upper-Trap Stretch
    en: [{ id: "yho44869qPw", t: "Upper Trap Stretch for Neck Stiffness and Headaches San Diego Chiropractic", q: 5 }, { id: "-r0eoFS7_5Q", t: "Upper Trapezius Stretch Ask Doctor Jo", q: 5 }, { id: "4GcL9EScCKA", t: "Neck Stretches Levator Scapulae and Upper Trapezius", q: 5 }, { id: "iwIiqaTXAq4", t: "RELEASE Upper Trapezius and Levator Scapulae Muscle Tension FOR GOOD", q: 5 }, { id: "_f0jjpWp9NA", t: "3 Neck Stretches Levator Scapulae Upper Trapezius and Scalenes", q: 5 }],
    es: [{ id: "sqbwBPsygkg", t: "Estiramiento optimo de cuello y trapecio superior Roots videotips", q: 5 }, { id: "3LIhdRvaUSU", t: "Upper trapezius stretch Estiramiento trapecio superior", q: 5 }, { id: "oG7IrloR7Fo", t: "Estiramiento del musculo Angular de la Escapula o Elevador de la Escapula", q: 4 }],
    pt: [{ id: "vv87bdo0TTw", t: "Alongamento de Trapezio Superior e Elevador da Escapula", q: 5 }, { id: "2-jACcOLho8", t: "Alongamento para Trapezio Superior e Pescoco", q: 5 }, { id: "BKLEdWHeyhw", t: "IMPORTANTE MANEIRA CORRETA DE ALONGAR O TRAPEZIO SUPERIOR", q: 5 }],
  },
  stat_uback_001: { // Child's Pose Reach
    en: [{ id: "EniGBCHAEVQ", t: "How to Do Childs Pose PROPERLY Yoga for Beginners Pose Tutorial", q: 5 }, { id: "VH-Ws3K-x7k", t: "Are you doing childs pose correctly Try this yoga pose tutorial", q: 5 }, { id: "Ndhfm1Jxu2U", t: "Childs Pose with 3 Variations Low Back Pain Decompression", q: 5 }, { id: "jaCOZJPSy2g", t: "How to Do Childs Pose Stretch Properly for Yoga Beginners", q: 4 }],
    es: [{ id: "PC1IkjO1k5Q", t: "Estiramiento del nino para espalda", q: 4 }, { id: "0WoxPLRRbJU", t: "POSICION DEL NINO PARA ESTIRAR LA ESPALDA", q: 4 }, { id: "1bEZAIQbAxY", t: "Balasana la postura del nino Lucia Liencres yoga", q: 4 }],
    pt: [{ id: "bUibpFGSSnI", t: "Postura da crianca Utthita Balasana e Balasana Tutorial Pri Leite", q: 5 }, { id: "Lk5lVVIM3JM", t: "Balasana Postura da crianca Carla Bricaire Yoga em Casa", q: 5 }, { id: "X9sIjOhpofk", t: "Posicao de yoga postura da crianca balasana Gustavo Ponce", q: 4 }],
  },
  stat_uback_002: { // Thread-the-Needle
    en: [{ id: "7C8-zj3nRro", t: "Thread The Needle For Thoracic Rotation", q: 5 }, { id: "JPK24P1JD6s", t: "Thread the Needle IMPROVE Thoracic Rotation Mobility", q: 5 }, { id: "uenqxybA9kU", t: "Thread the Needle Exercise for the Thoracic Spine", q: 5 }, { id: "UomKzkyp6kQ", t: "How to Thread-the-Needle The Right Way Well+Good", q: 5 }, { id: "2WRRcsa1e5M", t: "Thread the Needle Pose Tutorial", q: 4 }],
    es: [{ id: "DxRXSFJuYFQ", t: "862 Estiramiento enhebrar aguja", q: 5 }, { id: "WNp3ZDFJQC4", t: "ENEBRAR LA AGUJA", q: 5 }],
    pt: [{ id: "wdplejKF1iA", t: "Alongamento para Coluna Toracica Explicando o Exercicio", q: 4 }, { id: "OyrqPJSeTl4", t: "Thread the Needle Pose Shoulder and Upper Back Release", q: 4 }],
  },
  stat_lback_001: { // Supine Knees-to-Chest
    en: [{ id: "bHxbbdJGhH4", t: "Supine Knees to Chest Stretch for Low Back", q: 5 }, { id: "bUHjaXGDm_E", t: "How to Do a Supine Single Knee to Chest Stretch Exercise MedBridge", q: 5 }, { id: "Yd9wY25koVk", t: "Single Knee to Chest Ask Doctor Jo", q: 5 }, { id: "LugNxxfIdvo", t: "Double Knee to Chest", q: 4 }],
    es: [{ id: "bqW9Y8JaVdY", t: "RODILLAS AL PECHO ACOSTADO", q: 4 }, { id: "LWTq1jPdzRo", t: "Estiramiento lumbar con las dos piernas al pecho", q: 4 }, { id: "Y9G2GpODWmk", t: "Postura de Rodillas al Pecho Apanasana", q: 4 }],
    pt: [{ id: "rLDqCqdHXrY", t: "Apptiva Exercicio FLEXIBILIDADE Alongamento de joelhos ao peito", q: 5 }, { id: "L7mcmARAoqw", t: "Alongamento com o joelho no peito knee to chest", q: 5 }, { id: "TajqJjwJqYw", t: "ALONGAMENTO PARA COLUNA LOMBAR DEITADO", q: 4 }],
  },
  stat_lback_002: { // Supine Spinal Twist
    en: [{ id: "mNdJti7ZwKI", t: "Supine Spinal Twist for Spine Mobility", q: 5 }, { id: "hZduN8rruKM", t: "How To Supine Spinal Twist YogaRenew Yoga Poses", q: 5 }, { id: "aRSPMMYOXZI", t: "Supine Twist for Beginners Step-By-Step Yoga Tutorial", q: 5 }, { id: "2SCXbr33pRw", t: "Lying Spinal Twist Stretch for lower back mobility clinical yoga", q: 5 }],
    es: [{ id: "JVurMdFG-CM", t: "Torsion espinal supina", q: 4 }, { id: "kfmHGHrD3pE", t: "Estiramiento dorso lumbar con torsion", q: 4 }],
    pt: [{ id: "GYuMqIMYYWY", t: "posturas de torcao da coluna vertebral Yoga", q: 4 }, { id: "gAL7B2dZEvg", t: "Alongamento lombar rotacao de tronco deitado Otto", q: 4 }],
  },
  stat_groin_001: { // Frog Stretch
    en: [{ id: "5cO9GW9xRzM", t: "The Frog Stretch A Deep Hip Opener", q: 5 }, { id: "MLTBWj_7v1s", t: "Frog Pose Stretch Release Groin and Inner Thigh Tension", q: 5 }, { id: "vDC0FoknW-w", t: "Master Frog Pose Open Hips and Avoid Mistakes", q: 5 }, { id: "20ZWXZPQbpI", t: "How To Stretch A TIGHT GROIN Frog Stretch", q: 4 }],
    es: [{ id: "DyGWaJABeuY", t: "Estiramiento de la rana", q: 5 }, { id: "qpTQhbHQ-0Q", t: "5 EJERCICIOS para AUMENTAR la FLEXIBILIDAD de las CADERAS", q: 3 }],
    pt: [{ id: "VejRU7YJBnY", t: "Exercicio mobilidade de quadril posicao sapo em 3 angulos", q: 5 }, { id: "X1xuLlDjh24", t: "MOBILIDADE DE QUADRIL SAPO COMO FAZER", q: 5 }, { id: "P1fgfL5dG6w", t: "Sapinho Alongamento adutores da coxa", q: 5 }],
  },
  stat_groin_002: { // Seated Wide-Leg Fold
    en: [{ id: "SpOwFLqRflc", t: "Seated Wide Forward Fold Tutorial Beginner", q: 5 }, { id: "mDWiZ5QwSC0", t: "How To Wide Legged Seated Forward Fold Pose Modifications and Tips", q: 5 }, { id: "YwK_wan3aRg", t: "Seated Straddle Yoga Poses YogaRenew", q: 5 }, { id: "Z816IGgrfxc", t: "How To Do A SEATED STRADDLE FORWARD BEND Exercise Demonstration", q: 5 }],
    es: [{ id: "RfnOSqF_X_o", t: "Estiramiento aductores sentado con piernas abiertas", q: 5 }, { id: "YWKrR5_iKFk", t: "Estiramientos aductores basicos", q: 4 }],
    pt: [{ id: "YLKi4MAgymw", t: "Alongamento sentado com as pernas afastadas", q: 5 }, { id: "fU8MFG0z6kU", t: "Como alongar a virilha para diminuir dores nas pernas e lombar", q: 4 }, { id: "zmvRahiwUTc", t: "Alongamento sentado pernas abertas adutor", q: 4 }],
  },
  dyn_calf_001: { // Ankle Rocks (Knee-Over-Toe)
    en: [{ id: "Hm_Iu72bJJg", t: "Half Kneeling Ankle Rocks - Ankle Mobility", q: 5 }, { id: "W-zRyLyuAZ8", t: "Ankle Knee-Over-Toe Rockers | Paragon Training Methods", q: 4 }, { id: "ElrpduJn92Y", t: "Knee To Wall Exercise for Ankle Mobility", q: 4 }, { id: "1HFRia-08_g", t: "Knee over toe rocks", q: 3 }],
    es: [{ id: "QcOZ4QzG_Vs", t: "DESBLOQUEA la movilidad del TOBILLO", q: 4 }, { id: "mQG16sTkmNc", t: "Top 3 Ejercicios de Movilidad de Tobillo", q: 4 }, { id: "jHXLUgegy1E", t: "5 ejercicios para mejorar la movilidad de tobillo", q: 4 }],
    pt: [{ id: "fQrQw0ATrLQ", t: "5 exercicios para trabalhar a Mobilidade de Tornozelo", q: 4 }, { id: "M189NnxuG5E", t: "Um Exercicio para melhorar a Mobilidade do Tornozelo", q: 4 }, { id: "lS_Nii0VOZI", t: "8 exercicios para mobilidade do tornozelo", q: 4 }],
  },
  dyn_calf_002: { // Walking Heel-to-Toe Rolls
    en: [{ id: "x_AuawYz2NA", t: "Heel Walks Tutorial - Proper Form and Technique", q: 5 }, { id: "ZRI899Xv8PE", t: "Exercises with an Athletic Trainer: Heel Walking", q: 5 }, { id: "xQpM_iqBiLo", t: "Heel Walking - Running Warm-up Exercise", q: 4 }],
    es: [{ id: "_CCSbLloUtI", t: "Aprender a caminar - Talon planta puntera", q: 4 }, { id: "T-mjCqED1ug", t: "Caminar de puntillas y talones para recuperar lesiones", q: 4 }],
    pt: [{ id: "cklp_Xh5V8M", t: "Elevacao de Panturrilha em Pe", q: 3 }, { id: "ZkJ2LBYq0oE", t: "Midway Action - Elevacao de Calcanhar para Panturrilha", q: 3 }],
  },
  dyn_quad_001: { // Walking Quad Pull
    en: [{ id: "h-V9FaF96Go", t: "Walking Quad Stretch - Dynamic Warm-Up for Quads Balance & Mobility", q: 5 }, { id: "A31mTSNAH6o", t: "Walking High Knee/Quad Pull Stretch Exercise", q: 5 }, { id: "yjILII-tA9U", t: "WALKING QUAD STRETCH - SPEED TRAINING WARMUP", q: 4 }, { id: "A785Q-954IU", t: "Walking Quad Pull", q: 4 }, { id: "I-iC_CEj3lU", t: "Walking Quad Pull + Reach", q: 4 }],
    es: [{ id: "HyOv2Cs7DaA", t: "Ejercicios para CUADRICEPS Clasificados MEJOR A PEOR", q: 3 }, { id: "-VwC2baVOAc", t: "16 ejercicios para CUADRICEPS EN CASA", q: 3 }],
    pt: [{ id: "j_GJLEz-X9Q", t: "4 top alongamentos para quadriceps e flexores de quadril", q: 3 }],
  },
  dyn_quad_002: { // Reverse Lunge with Reach
    en: [{ id: "eVz_IfpHO6E", t: "Reverse Lunge + Reach | Full Body Mobility Exercise", q: 5 }, { id: "EX30JRb_0u0", t: "Hip Flexor Tight? Try This Lunge + Reach Stretch", q: 5 }, { id: "WMeiaZWCX0I", t: "How To Do A REVERSE LUNGE OVERHEAD SIDE REACH", q: 5 }, { id: "zy0nmSy7Piw", t: "Reverse Lunge with Overhead Reach", q: 4 }],
    es: [{ id: "NWynqLpSsbc", t: "CAF Virtual Estocada inversa con control de tronco", q: 4 }, { id: "POoO7Ca8tOY", t: "Movilidad toracica en rotaciones en posicion de estocada", q: 4 }],
    pt: [{ id: "FuHPSRIoa-M", t: "Rotacao de tronco e quadril em posicao afundo - mobilidade", q: 4 }, { id: "mtlf-wmHzMU", t: "Como melhorar o afundo/Avanco com mobilidade", q: 4 }],
  },
  dyn_ham_001: { // Leg Swings (Front-to-Back)
    en: [{ id: "difYoBtZi2s", t: "How To Do Leg Swings", q: 5 }, { id: "NYn9R3WyKzI", t: "Front leg swing - dynamic warm up for the quadriceps and hamstrings", q: 5 }, { id: "MNLP2Qhnvks", t: "Leg Swing - Dynamic Hamstring Stretch", q: 5 }, { id: "pY_UBTQtml4", t: "Leg Swings | TriDot Run Drill Series", q: 4 }],
    es: [{ id: "KJKoCnhMrYQ", t: "FORWARD LEG SWING / BALANCEO FRONTAL DE PIERNA", q: 5 }, { id: "nJxfSzASuCA", t: "Como hacer el balanceo de piernas", q: 4 }],
    pt: [{ id: "NLAAZMULpP8", t: "Balanco das Pernas", q: 3 }, { id: "EpKF5Tjhnc0", t: "COMO AQUECER PARA O TREINO DE PERNAS - mobilidade articular", q: 3 }],
  },
  dyn_ham_002: { // Toy-Soldier Walks (Straight-Leg Kicks)
    en: [{ id: "gJSuM_dCyr4", t: "How To Do A WALKING TOY SOLDIER", q: 5 }, { id: "RJrGfziKeCA", t: "How To Do WALKING TOY SOLDIER KICKS", q: 5 }, { id: "FMNNFtEeUDo", t: "The Best Dynamic Warm-Up for Hamstrings - Toy Soldier", q: 5 }, { id: "cIqzwOUilR4", t: "Toy Soldier is One of The Most Important Warm-Up Exercises For Runners", q: 4 }],
    es: [{ id: "MXZdRWzox1k", t: "Marcha elevando rodillas", q: 3 }],
    pt: [{ id: "VVk-dJOiWlQ", t: "Toy Soldiers Dynamic Warmup", q: 4 }],
  },
  dyn_add_001: { // Cossack Squat Shifts
    en: [{ id: "tpczTeSkHz0", t: "How to Cossack Squat Mobility Exercise: Tutorial & Progressions", q: 5 }, { id: "JaCbmoDqUc4", t: "How To Cossack Squat (Beginner to Advanced)", q: 5 }, { id: "d4IPCXI8GQc", t: "How To COSSACK Squat Tutorial // School of Calisthenics", q: 5 }, { id: "W-KbaAOpMhM", t: "Cossack Squats: GOAT leg strength & mobility exercise!", q: 4 }],
    es: [{ id: "nHOxc19X6ZQ", t: "El mejor ejercicio para tu cadera: rotaciones articulares controladas", q: 3 }, { id: "UI7tZ4mmBOY", t: "Rutina de movilidad de cadera de 5 minutos", q: 3 }],
    pt: [{ id: "hQ-AqY_BEmk", t: "Como fazer o agachamento lateral COSSACK | Aprenda em 2 minutos", q: 5 }, { id: "xrZH9GeZqec", t: "TUTORIAL: COMO FAZER UM COSSACK SQUAT PERFEITO?", q: 5 }, { id: "t2WQy_Oh4nQ", t: "COSSACK SQUAT Mobilidade e Aquecimento", q: 5 }],
  },
  dyn_add_002: { // Lateral Leg Swings
    en: [{ id: "6aw8CAH_65Y", t: "Side Leg Swings Tutorial - Proper Form and Technique", q: 5 }, { id: "U3Px6O-4M1E", t: "How To: Standing Side To Side Leg Swing", q: 5 }, { id: "ZNpRO--nSN8", t: "Lateral Leg Swings | Legs for Days | 24Life", q: 4 }, { id: "-SvV1cPts6s", t: "Side Leg Swings", q: 4 }],
    es: [{ id: "c3_3Uy6uMLA", t: "LEG LATERAL SWING / BALANCEO LATERAL DE PIERNA", q: 5 }, { id: "xJF4pRLyujU", t: "Balanceo Lateral Pierna", q: 4 }, { id: "aG4AoCV2T_8", t: "Balanceo lateral y frontal de piernas", q: 4 }],
    pt: [{ id: "NLAAZMULpP8", t: "Balanco das Pernas", q: 3 }, { id: "iNUPCyneFT4", t: "TREINO DE MOBILIDADE PARA PERNAS - MEMBROS INFERIORES", q: 3 }],
  },
  dyn_abd_001: { // Hip CARs (Controlled Circles)
    en: [{ id: "5kM-o61Z14I", t: "Controlled Articular Rotations (CARs) - Hips", q: 5 }, { id: "PwxO_Zn4hI4", t: "Hips CARs (Controlled Articular Rotations)", q: 5 }, { id: "zbH4XmSREoc", t: "How To Do Hip CARS (Controlled Articular Rotations) | Movement Breakdown", q: 5 }, { id: "-zVPL8WPdaE", t: "Quadruped Hip CARs (Controlled Articular Rotations)", q: 5 }, { id: "byI2LURovNo", t: "Hip CARs Exercise: Aspire PT & Wellness", q: 4 }],
    es: [{ id: "nHOxc19X6ZQ", t: "El mejor ejercicio para tu cadera: rotaciones articulares controladas // QIMOVEMENT", q: 5 }, { id: "1eRJY4hG960", t: "10 min CARS de cadera (rotaciones articulares controladas)", q: 5 }, { id: "qiIacArPfe0", t: "Rotaciones Articulares Controladas (CARs) : Movilidad para todo tu cuerpo", q: 4 }],
    pt: [{ id: "urPHpKncUpk", t: "MOBILIDADE DE QUADRIL - Sequencia de exercicios para progredir", q: 4 }, { id: "ftnIXavt1yM", t: "CIRCUNDUCAO DO QUADRIL (ART. COXOFEMORAL)", q: 4 }],
  },
  dyn_abd_002: { // Lateral Band/Bodyweight Walks
    en: [{ id: "5wUk8wQNUT8", t: "Lateral Band Walks for Glute Medius Activation | GPS Human Performance", q: 5 }, { id: "sWVAy6_Gafo", t: "Lateral Band Walks - Variations for Athletes | Glute Med. Activation", q: 5 }, { id: "x8DFUsLq8t8", t: "Banded Lateral Walk (Hip Loading Glute Activation and Lateral Strength)", q: 5 }, { id: "YCqrtnr6g5g", t: "How to Do a Lateral Band Walk (Glute Activation Exercise for Leg Day!)", q: 4 }],
    es: [{ id: "RQNKFemP6vo", t: "Caminata Lateral con Banda #ejercicio", q: 5 }, { id: "TvP6iLcGNP0", t: "Caminata lateral con banda - Ejercicio efectivo para activar gluteos", q: 4 }, { id: "WISZki61dRY", t: "MONSTER WALK ACTIVA tu GLUTEO MEDIO con este Ejercicio", q: 4 }],
    pt: [{ id: "2z5sw4TbeMA", t: "Caminhada lateral com elastico", q: 4 }, { id: "e2SJvb2Ujzc", t: "Caminhada lateral com mini band acima do joelho - execucao", q: 4 }, { id: "d6FLLM8uDlo", t: "Fortalecimento Quadril | Passada lateral com mini band", q: 4 }],
  },
  dyn_sho_001: { // Arm Circles (Small to Large)
    en: [{ id: "RN40wyH6x9o", t: "How To Do Arm Circles Properly for Beginners | Easy Shoulder Warm-Up", q: 5 }, { id: "P3dzI9opLGE", t: "Arm Circles Dynamic Warmup", q: 4 }, { id: "tYo5ghpLksg", t: "Dynamic Warm-Up Exercise: Big Arm Circles (30 Secs)", q: 4 }, { id: "vPDvVzEjijQ", t: "Backward Arm Circles | Shoulder Warm-Up & Mobility Exercise", q: 4 }],
    es: [{ id: "pdNSBEkdK3M", t: "Como Hacer Circulos con los Brazos | Calentamiento para Hombros", q: 5 }, { id: "YTueIW_xapc", t: "Como Hacer Circulos con los Brazos (Tutorial Paso a Paso)", q: 5 }, { id: "gMfCj-0NO-E", t: "Rotaciones de hombros en circulos / CALENTAMIENTO", q: 4 }],
    pt: [{ id: "4yPoBcn5ycA", t: "Aquecimento Dinamico: Rotacao de Bracos para Ombros Saudaveis", q: 5 }, { id: "dLWh8g3v5QE", t: "CIRCUNDUCAO DOS OMBROS COM ELASTICO / MOBILIDADE DE OMBRO", q: 4 }, { id: "AdGIW9C4OqY", t: "CIRCUNDUCAO DOS OMBROS - LIVRE - EXECUCAO", q: 4 }],
  },
  dyn_sho_002: { // Band/Towel Pass-Throughs
    en: [{ id: "xaSsrvN9Bv0", t: "Improve Your Shoulder Mobility In Seconds with the Banded Pass Throughs", q: 5 }, { id: "DzNCBJuhq10", t: "Banded Shoulder Pass Throughs | Shoulder Mobilization Exercise", q: 5 }, { id: "znyg8MLHozE", t: "The best exercise before overhead lifts—the Band Pass-through", q: 5 }],
    es: [{ id: "izPCk7TliTk", t: "CALENTAMIENTO PARA HOMBROS", q: 3 }],
    pt: [{ id: "rpLDEAGtJrM", t: "Alivio DOR NO OMBRO c/ uma TOALHA - Mobilidade Articular e flexibilidade", q: 4 }, { id: "XN0J-hI17SU", t: "18 Exercicios de Mobilidade e Forca do Ombro com Faixa Elastica", q: 4 }],
  },
  dyn_chest_001: { // Open-Book Rotations
    en: [{ id: "rDviWORCWEw", t: "Open Books (Sidelying Thoracic Rotation)", q: 5 }, { id: "peeW19ofFUg", t: "Thoracic Rotation Open Book", q: 5 }, { id: "5TdmVlQe64c", t: "How to Do T-Spine Rotation (Open Book) | Thoracic Mobility & Postural Reset", q: 5 }, { id: "fBPoTgQRL6g", t: "Open Book Stretch | Thoracic Spine Mobility Exercise", q: 5 }],
    es: [{ id: "qhv5Z9aFgKc", t: "Movilidad Toracica: Abrir el Libro en Decubito Lateral", q: 5 }, { id: "SMUiYjw6fRg", t: "Estiramiento de Espalda Dorsal: Libro Abierto", q: 4 }, { id: "gl8jSyYg2YQ", t: "MOVILIDAD COLUMNA DORSAL: LIBRO ABIERTO", q: 4 }],
    pt: [{ id: "c4RvgBK7GC4", t: "Mobilidade de rotacao de tronco Open Book", q: 5 }, { id: "REpqRDCFVgg", t: "Mobilidade de coluna com LIVRO ABERTO - Como fazer corretamente?", q: 5 }, { id: "tme41YNa-Z0", t: "Mobilidade toracica - open the book", q: 4 }],
  },
  dyn_neck_001: { // Neck Yes/No/Maybe Mobility
    en: [{ id: "JhNr4Nws48w", t: "Neck Yes/Nos", q: 5 }, { id: "cUteHlKEuXg", t: "The Complete Neck Fix: 6 Exercises for Strength and Mobility", q: 5 }, { id: "eeGOQfeYUuo", t: "2 Minute Neck Mobility That Fixes Everything", q: 4 }, { id: "_uWblWalXIE", t: "Best Upper Cervical Mobility Exercises for Neck Stiffness and Headaches", q: 4 }],
    es: [{ id: "CJ70VDEmf1E", t: "5 EJERCICIOS para MEJORAR la MOVILIDAD de tu CUELLO", q: 5 }, { id: "yWtqdgapSsE", t: "Ejercicio Movilidad Cervical", q: 4 }, { id: "gj50wDpQ07A", t: "Rutina de MOVILIDAD para CUELLO y DORSALES SENTADO", q: 4 }],
    pt: [{ id: "LHWWMv-JEio", t: "5 Movimentos Para Melhorar a Mobilidade da Cervical - QueroQuiro", q: 5 }, { id: "FnCXDY9bCgc", t: "Mobilidade Cervical - Exercicio para ALIVIO DA DOR e TENSAO NO PESCOCO", q: 4 }, { id: "bolyL-Q6KPU", t: "DOR E RIGIDEZ NO PESCOCO - EXERCICIO PARA MOBILIDADE CERVICAL", q: 4 }],
  },
  dyn_uback_001: { // Cat-Cow Flow
    en: [{ id: "xyNwxiuERXc", t: "Cat-Cow Stretch | Proper Form Tutorial for Spinal Mobility", q: 5 }, { id: "MTOkhs3euvk", t: "How Do You Do The Cat-Cow Stretch Correctly?", q: 5 }, { id: "EFatHkDBSe8", t: "Cat-Cow Tutorial: Teach Spinal Mobility for All Abilities", q: 5 }, { id: "R6xN7m2eOtE", t: "Cat Cow | Spine Mobility & Core Control Demonstration", q: 4 }],
    es: [{ id: "1YT7HwNmDSQ", t: "GATO-VACA (CAT-COW) correcciones y variantes", q: 5 }, { id: "QgG4XZNVq-w", t: "El MEJOR ejercicio para Aliviar tu DOLOR DE ESPALDA - Tutorial Cat Cow", q: 5 }, { id: "Zhdxam2D8VY", t: "Como realizar el Cat-Cow correctamente", q: 5 }],
    pt: [{ id: "ohfiTnNHcHw", t: "COMO FAZER as Posturas do Gato e da Vaca TUTORIAL COMPLETO", q: 5 }, { id: "e7WOpeqxOgI", t: "Mobilidade da coluna: GATO/VACA", q: 4 }, { id: "BMdYxIDt5Ys", t: "Gato-Vaca: Mobilidade da Coluna | Yoga para Iniciantes", q: 4 }],
  },
  dyn_uback_002: { // Quadruped Thoracic Rotation
    en: [{ id: "snzLuyYgbVI", t: "Thoracic Rotation in Quadruped - Ask Doctor Jo", q: 5 }, { id: "AzCghjjWt5k", t: "Quadruped Thoracic Rotation for Spine Mobility", q: 5 }, { id: "mGtD0v5uOiQ", t: "Quadruped Thoracic Rotation Tutorial | HNL Movement", q: 5 }, { id: "sm9pm3d6kO8", t: "Quadruped Thoracic Spine Rotation | Mobility Drill", q: 4 }],
    es: [{ id: "IMirvX4trqE", t: "ROTACION TORACICA EN CUADRUPEDIA (QUADRUPED THORACIC ROTATION)", q: 5 }, { id: "iZhVleHrQA8", t: "Rotacion toracica en cuadrupedia I Pildorabreve", q: 4 }, { id: "5kwx1UU5exI", t: "Rotaciones toracicas en cuadrupedia", q: 4 }],
    pt: [{ id: "xdvzTRson2Q", t: "Quadruped Thoracic Rotation - Rotacao quadrupede", q: 5 }, { id: "RWNNwH04Lu0", t: "Mobilidade - Toracica (4 apoios)", q: 4 }],
  },
  dyn_lback_001: { // Standing Pelvic Tilts
    en: [{ id: "jjLy--g4DHc", t: "Proper Posture for a Standing Pelvic Tilt", q: 5 }, { id: "YCHUhG-VG0M", t: "Pelvic Tilting in Standing Exercise", q: 4 }, { id: "De8zi_3cY6E", t: "Functional Training Exercise - Pelvic tilts standing", q: 4 }, { id: "Lka__f3YOcY", t: "Standing Pelvic Tilts - Pilates style", q: 4 }],
    es: [{ id: "_7Ha-0IwkqE", t: "Ejercicio para Lumbalgia ejercicio de inclinacion pelvica posterior", q: 5 }, { id: "Sgr5Y2d_YrU", t: "Corregir la inclinacion pelvica anterior de forma permanente", q: 4 }, { id: "GCQW1wFMYaU", t: "Corrige tu inclinacion pelvica - Como corregir para siempre una mala postura lumbar", q: 4 }],
    pt: [{ id: "YFz1c5xsOYE", t: "Dica de exercicio - inclinacao anterior e posterior da pelve", q: 4 }, { id: "EOjo3Z02nQE", t: "Core 4 | 02- Inclinacao Pelvica", q: 4 }, { id: "T0rUQG__5LI", t: "Os MELHORES Exercicios Para Inclinacao da Pelve!", q: 4 }],
  },
  dyn_lback_002: { // World's Greatest Stretch
    en: [{ id: "-CiWQ2IvY34", t: "The World's Greatest Stretch (Mobility Exercise) by Squat University", q: 5 }, { id: "T6j7BpxeqqU", t: "World's Greatest Stretch | Tutorial", q: 5 }, { id: "uIFKmkvgw8w", t: "How To Do The World's Greatest Stretch | Full Body Mobility", q: 5 }, { id: "B8Xdkd8icPA", t: "Catch All Mobility Tutorial - Worlds Greatest Stretch", q: 4 }],
    es: [{ id: "ElbQE69lMXE", t: "El mejor estiramiento del mundo", q: 4 }],
    pt: [{ id: "Xxo2TLngeB8", t: "MAIOR ALONGAMENTO DO MUNDO COM ROTACAO DE COLUNA / MOBILIDADE DE QUADRIL E TORACICA", q: 5 }, { id: "cjylpJdlu3I", t: "O melhor alongamento do mundo MESMO! Como fazer corretamente?", q: 5 }, { id: "bMMr8E_DiN8", t: "O Melhor Alongamento do Mundo: Aprenda o passo a passo!", q: 4 }],
  },
  roll_calf_001: { // Calf Roll
    en: [{ id: "_gHnz4GpRYI", t: "How to Foam Roll Calves", q: 5 }, { id: "MuPVRt6_BV8", t: "Calf Foam Rolling - When To Avoid It When It Can Be Useful How To Do It", q: 5 }, { id: "ybGIhEekSTc", t: "How to Use a Foam Roller for Calf Muscles | Achilles Warm-Up & Ankle Mobility", q: 5 }, { id: "MYSFw-AwJCs", t: "How to Foam Roll the Calf Muscle", q: 4 }],
    es: [{ id: "Np8a3zoUK_g", t: "Ejercicios FOAM ROLLER para PIERNAS | Automasaje", q: 4 }, { id: "tNw76NuDndg", t: "Como usar un Foam Roller? Ejercicios de piernas", q: 4 }, { id: "2IMzjrqYH1U", t: "Rutina FOAM ROLLER para PIERNAS - Como Usar Foam Roller Piernas", q: 4 }],
    pt: [{ id: "IKTSlGKecHM", t: "Liberacao miofascial com o rolo para os membros inferiores", q: 4 }, { id: "Gqg5HsCGCR4", t: "Alivie Pernas Cansadas com Rolo de Espuma: Tecnicas de Liberacao Miofascial!", q: 4 }],
  },
  roll_quad_001: { // Quad Roll
    en: [{ id: "7FoLY0EgdqI", t: "The RIGHT Way To Foam Roll Your Quads | Physical Therapist Teaches Foam Rolling Technique", q: 5 }, { id: "ERTVBjwgPS4", t: "Self Myofascial Release: Foam Rolling - Quadriceps", q: 5 }, { id: "fvVua1NNzC4", t: "How to Foam Roll your Quads", q: 4 }, { id: "cv57kA6rktc", t: "Foam Roller: Quads", q: 4 }],
    es: [{ id: "tJtKedA53Kk", t: "Los 3 mejores ejercicios con FOAM ROLLER para tus CUADRICEPS", q: 5 }, { id: "EgBzzNSDsEQ", t: "Automasaje con Foam Roller para Cuadriceps", q: 5 }, { id: "_kSkh5ryGgA", t: "CURSO FOAM ROLLER | Modulo 1 Leccion 6 | Cuadriceps", q: 5 }],
    pt: [{ id: "Gqg5HsCGCR4", t: "Alivie Pernas Cansadas com Rolo de Espuma: Tecnicas de Liberacao Miofascial!", q: 4 }, { id: "0w3pYqBZSlc", t: "5 Exercicios no ROLO DE LIBERACAO MIOFASCIAL - Melhore sua mobilidade", q: 4 }],
  },
  roll_ham_001: { // Hamstring Roll
    en: [{ id: "fwDNdgKnTsY", t: "Foam Rolling for Hamstrings BEST Techniques | San Diego Chiropractic", q: 5 }, { id: "jV9SSJ3OkcA", t: "Foam Rolling Hamstrings: Dos Don'ts & How To", q: 5 }, { id: "mEnpZf-wivM", t: "How to Foam Roll Hamstring", q: 5 }, { id: "6NxiLQ5FpeI", t: "Foam Roller: Hamstrings", q: 4 }],
    es: [{ id: "MHZhfehfjaE", t: "Los 3 mejores ejercicios con FOAM ROLLER para tus ISQUIOTIBIALES", q: 5 }, { id: "pn8mmWxm7mA", t: "CURSO FOAM ROLLER | Modulo 1 Leccion 3 | Isquiotibiales", q: 5 }, { id: "Rk6qgwvQJR4", t: "AUTOMASAJE con Foam Roller en ISQUIOTIBIALES", q: 4 }],
    pt: [{ id: "IKTSlGKecHM", t: "Liberacao miofascial com o rolo para os membros inferiores", q: 4 }, { id: "Gqg5HsCGCR4", t: "Alivie Pernas Cansadas com Rolo de Espuma: Tecnicas de Liberacao Miofascial!", q: 4 }],
  },
  roll_add_001: { // Inner-Thigh / Adductor Roll
    en: [{ id: "_2PpoGQLJSM", t: "Foam Roll Adductors and Tight Groin Muscles | San Diego Sports Chiropractic", q: 5 }, { id: "56c--tqvOiI", t: "Tight Adductors? How to Stretch and Foam Roll Your Inner Thighs", q: 5 }, { id: "Yb9pA1IOLqE", t: "How To Do The FOAM ROLLER ADDUCTOR INNER THIGH MASSAGE", q: 5 }, { id: "WKILdrjWmBE", t: "How to foam roll adductors/inner thigh for pain in lower back & knee", q: 4 }],
    es: [{ id: "DnuupceRjs0", t: "Los 3 mejores ejercicios con FOAM ROLLER para tus ADUCTORES", q: 5 }, { id: "iWgzdslDw6M", t: "AUTOMASAJE con Foam Roller en ADUCTORES", q: 5 }, { id: "wPz6Jgj1nEk", t: "Como descargar los aductores con FoamRoller", q: 4 }],
    pt: [{ id: "WR-90N1gJgo", t: "Como aliviar a tensao muscular com Rolo de espuma", q: 3 }, { id: "wRCqsIHWagk", t: "5 exercicios para liberacao miofascial com o Rolo", q: 3 }],
  },
  roll_itb_001: { // Outer-Hip / IT Band & Glute-Med Roll
    en: [{ id: "jVvUW4SAMuk", t: "How To Foam Roll Your IT Band | Home Treatment For IT Band Pain", q: 5 }, { id: "Xl_L0o5N0bw", t: "How To Foam Roll Your IT Band The RIGHT Way [Fast Knee Pain Relief!]", q: 5 }, { id: "i9DvJa0mZQA", t: "Foam Rolling Your IT Band - Dos & Don'ts", q: 5 }, { id: "_4qpVDDBEq0", t: "Foam Rolling for IT Band Relief | Reduce Tension & Improve Mobility!", q: 4 }],
    es: [{ id: "2IMzjrqYH1U", t: "Rutina FOAM ROLLER para PIERNAS - Como Usar Foam Roller Piernas", q: 3 }, { id: "tNw76NuDndg", t: "Como usar un Foam Roller? Ejercicios de piernas I", q: 3 }],
    pt: [{ id: "WR-90N1gJgo", t: "Como aliviar a tensao muscular com Rolo de espuma", q: 3 }, { id: "0w3pYqBZSlc", t: "5 Exercicios no ROLO DE LIBERACAO MIOFASCIAL - Melhore sua mobilidade", q: 3 }],
  },
  roll_glute_001: { // Glute / Piriformis Ball Release
    en: [{ id: "PoM5BvqavcY", t: "Glute Max & Piriformis Tennis Ball Self Massage On The Floor", q: 5 }, { id: "l3flN43z-EQ", t: "Tennis Ball Self-Massage for Your Glutes and Piriformis", q: 5 }, { id: "h0QxWjB7n94", t: "PiRIFORMIS & Glute self myofascial release", q: 5 }, { id: "-vZhEMCHZ4A", t: "Glute and Hip Rotator (Piriformis) Massage Using Tennis Ball", q: 4 }],
    es: [{ id: "jMMWol3C_EQ", t: "Automasaje de gluteos y piramidales con pelota", q: 5 }, { id: "hPGte3Y1-_M", t: "Como relajar el PIRAMIDAL con PELOTA DE TENIS (EFECTIVO)", q: 5 }, { id: "MvITFZkjhbM", t: "AUTOMASAJE CIATICA para PIRIFORME y GLUTEO | Aliviar SINDROME PIRAMIDAL", q: 5 }],
    pt: [{ id: "XXaJpqROSIQ", t: "LIBERACAO MIOFASCIAL GLUTEO MEDIO e PIRIFORME COM BOLINHA", q: 5 }, { id: "5iSMiA1AZiI", t: "Liberacao Miofascial - Serie - Gluteos e Piriforme", q: 5 }, { id: "s2yj-sdnqMQ", t: "Pratica Completa de Liberacao Miofascial com Bolinha", q: 4 }],
  },
  roll_uback_001: { // Upper-Back / Thoracic Roll
    en: [{ id: "NS73eSohTbc", t: "Self Myofascial Release: Foam Rolling- Thoracic Spine", q: 5 }, { id: "dBdlv1sv144", t: "Thoracic Extension with Foam Roller | Improve Upper Back Mobility", q: 5 }, { id: "SxQkVD0UQNg", t: "Thoracic Spine Mobilizations with Foam Roller", q: 5 }, { id: "81kPLsMt6wY", t: "Foam Roller Thoracic Spine Extensions", q: 4 }],
    es: [{ id: "49jvExsBYPs", t: "Los 3 mejores ejercicios con FOAM ROLLER para tu ESPALDA", q: 5 }, { id: "nOSrTD19hv0", t: "Automasaje de ESPALDA con RODILLO - Como DESCARGAR la zona DORSAL con FOAMROLLER", q: 5 }, { id: "k2iK4jG4rrY", t: "Evita la espalda encorvada con el rodillo de espuma", q: 4 }],
    pt: [{ id: "Iel1pCUQrgw", t: "4 Exercicios para postura e dor nas costas - Rolo de Liberacao Miofascial", q: 4 }, { id: "dG31aV81dF8", t: "8 MELHORES POSICOES no ROLO de MASSAGEM miofascial! Como fazer automassagem?", q: 4 }],
  },
  roll_lback_001: { // Lower-Back QL Ball Release
    en: [{ id: "ay-1j6QKZF0", t: "QL Lacrosse Ball Release - How to Release The Quadratus Lumborum With A Lacrosse Ball", q: 5 }, { id: "xJGYfDZEPrg", t: "QL Soft Tissue Release with One Tennis Ball (Trigger Point / Quadratus Lumborum / Back Pain)", q: 5 }, { id: "woX-IZfYd_g", t: "QL Release with Lacrosse Ball -MoveU", q: 5 }, { id: "GJlBuOQDhyE", t: "Relieve Lower Back Tension: Self Myofascial Release for the Quadratus Lumborum (QL)", q: 5 }],
    es: [{ id: "GQqYmyCFmA8", t: "Masaje con pelota para el dolor lumbar", q: 5 }, { id: "iH3pk-fqtC4", t: "Automasaje con pelota para relajar y aliviar el dolor en la zona lumbar", q: 4 }, { id: "vC6jwmPe15I", t: "Liberacion miofascial con pelotas pequenas", q: 4 }],
    pt: [{ id: "s2yj-sdnqMQ", t: "Pratica Completa de Liberacao Miofascial com Bolinha", q: 4 }, { id: "dG31aV81dF8", t: "8 MELHORES POSICOES no ROLO de MASSAGEM miofascial! Como fazer automassagem?", q: 3 }],
  },
  roll_chest_001: { // Pec / Chest Ball Release
    en: [{ id: "B8HwNQt9C7I", t: "Chest and Pec Stretch/Massage with Therapy Balls", q: 5 }, { id: "1l4TcN7rl5Y", t: "Pecs self myofascial release using lacrosse ball", q: 5 }, { id: "LzEW0lhYUmE", t: "Self-Massage Your Pectoral Muscles With a Ball | Alleviate Neck Shoulder Back Pain & Tension", q: 5 }, { id: "CBAh4OePgBQ", t: "Chest Self Massage - Fix Rounded Shoulders - Chest Release Pec Major and Minor", q: 5 }],
    es: [{ id: "h3qYRK_g73U", t: "Liberacion de pectorales", q: 5 }, { id: "lDn077CPaPg", t: "Pectoral menor. Auto-masaje para soltar y relajar este musculo", q: 5 }, { id: "jdgKQomV8Gs", t: "Automasaje para la relajacion y recuperacion el pectoral mayor", q: 4 }],
    pt: [{ id: "A-v5k6SnZv4", t: "LIBERACAO MIOFASCIAL de PEITORAL e OMBROS", q: 5 }, { id: "9zpg5pgSdXI", t: "Liberacao Miofascial do Peitorais", q: 5 }, { id: "aU6NApoGJmY", t: "Tres tecnicas de liberacao Miofascial para o musculo peitoral maior", q: 5 }],
  },
};

// All videos for an exercise in the requested language; EN fallback when the
// language has none. Returns [] when the exercise has no catalog entry.
export function recoveryVideosFor(id, lang) {
  const e = RECOVERY_VIDEOS[id];
  if (!e) return [];
  const want = e[lang];
  return want && want.length ? want : (e.en || []);
}

// The single best (top-rated) demo for an exercise + language, or null.
export function primaryRecoveryVideo(id, lang) {
  const list = recoveryVideosFor(id, lang);
  return list.length ? list[0] : null;
}
