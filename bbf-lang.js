/* ============================================================
   BBF-LANG.JS — Build Believe Fit LLC
   Language Toggle + localStorage Bridge + Training Mode
   Formspree ID: mwvwjokw
   Include in: index.html AND bbf-app.html
   <script src="/bbf-lang.js" defer></script>
   ============================================================ */

const BBF = (() => {

  // ── Translation Data ────────────────────────────────────────
  const T = {
    en: {
      hero_headline:    "BUILD THE BODY YOUR CAREER DEMANDS.",
      hero_sub:         "OT-Informed Training for High-Output Lives.",
      hero_cta:         "START YOUR FREE PATHFINDER CALC",
      pf_q1:            "What is your current weight? (lbs)",
      pf_q2:            "What is your primary fitness goal?",
      pf_q3:            "How many days per week can you train?",
      pf_q4:            "What is your daily activity level?",
      pf_q5:            "What is your occupation type?",
      pf_opt_fat:       "Fat Loss",
      pf_opt_muscle:    "Muscle Gain",
      pf_opt_recomp:    "Body Recomp",
      pf_opt_perf:      "Performance",
      pf_submit:        "GET MY NUMBERS",
      nav_programs:     "Programs",
      nav_about:        "About",
      nav_app:          "The App",
      nav_apply:        "Apply",
      about_badge:      "FOUNDER · NASM-CPT · OT STUDIES",
      why_hook:         "Whether you're in the boardroom or on the floor, your time and money are assets. We don't waste either.",
      pricing_community:"Community Blueprint",
      pricing_elite:    "Elite Challenge",
      pricing_legacy:   "Legacy Protocol",
    },
    es: {
      hero_headline:    "CONSTRUYE EL CUERPO QUE TU CARRERA EXIGE.",
      hero_sub:         "Entrenamiento OT-Informado para Vidas de Alto Rendimiento.",
      hero_cta:         "INICIA TU CALCULADORA PATHFINDER GRATIS",
      pf_q1:            "¿Cuál es tu peso actual? (lbs)",
      pf_q2:            "¿Cuál es tu objetivo principal de fitness?",
      pf_q3:            "¿Cuántos días por semana puedes entrenar?",
      pf_q4:            "¿Cuál es tu nivel de actividad diaria?",
      pf_q5:            "¿Cuál es tu tipo de ocupación?",
      pf_opt_fat:       "Pérdida de Grasa",
      pf_opt_muscle:    "Ganancia Muscular",
      pf_opt_recomp:    "Recomposición Corporal",
      pf_opt_perf:      "Rendimiento",
      pf_submit:        "OBTENER MIS NÚMEROS",
      nav_programs:     "Programas",
      nav_about:        "Sobre",
      nav_app:          "La App",
      nav_apply:        "Aplicar",
      about_badge:      "FUNDADOR · NASM-CPT · ESTUDIOS DE TO",
      why_hook:         "Ya sea que estés en la sala de juntas o en el piso de trabajo, tu tiempo y dinero son activos. No desperdiciamos ninguno.",
      pricing_community:"Proyecto Comunitario",
      pricing_elite:    "Desafío Élite",
      pricing_legacy:   "Protocolo Legado",
    },
    pt: {
      hero_headline:    "CONSTRUA O CORPO QUE SUA CARREIRA EXIGE.",
      hero_sub:         "Treinamento Baseado em TO para Vidas de Alta Performance.",
      hero_cta:         "INICIE SUA CALCULADORA PATHFINDER GRÁTIS",
      pf_q1:            "Qual é o seu peso atual? (lbs)",
      pf_q2:            "Qual é o seu objetivo principal de fitness?",
      pf_q3:            "Quantos dias por semana você pode treinar?",
      pf_q4:            "Qual é o seu nível de atividade diária?",
      pf_q5:            "Qual é o seu tipo de ocupação?",
      pf_opt_fat:       "Perda de Gordura",
      pf_opt_muscle:    "Ganho Muscular",
      pf_opt_recomp:    "Recomposição Corporal",
      pf_opt_perf:      "Performance",
      pf_submit:        "OBTER MEUS NÚMEROS",
      nav_programs:     "Programas",
      nav_about:        "Sobre",
      nav_app:          "O App",
      nav_apply:        "Aplicar",
      about_badge:      "FUNDADOR · NASM-CPT · ESTUDOS DE TO",
      why_hook:         "Seja na sala de reuniões ou no chão de fábrica, seu tempo e dinheiro são ativos. Não desperdiçamos nenhum.",
      pricing_community:"Projeto Comunitário",
      pricing_elite:    "Desafio Elite",
      pricing_legacy:   "Protocolo Legado",
    }
  };

  // ── Exercise Cue Translations (Training Mode) ───────────────
  const CUES = {
    en: {
      core_tight:       "Core tight.",
      drive_heels:      "Drive through your heels.",
      chest_up:         "Chest up, proud posture.",
      squeeze_top:      "Squeeze hard at the top.",
      control_descent:  "Control the descent — own it.",
      full_rom:         "Full range of motion.",
      breathe_exertion: "Exhale on exertion.",
      hinge_hip:        "Hinge at the hip, not the spine.",
      neutral_spine:    "Neutral spine throughout.",
      pull_elbows:      "Pull your elbows, not your hands.",
      push_floor:       "Push the floor away from you.",
      brace_core:       "Brace like you're about to take a punch.",
    },
    es: {
      core_tight:       "Core firme.",
      drive_heels:      "Empuja con los talones.",
      chest_up:         "Pecho arriba, postura orgullosa.",
      squeeze_top:      "Aprieta fuerte en la cima.",
      control_descent:  "Controla la bajada — domínala.",
      full_rom:         "Rango completo de movimiento.",
      breathe_exertion: "Exhala en el esfuerzo.",
      hinge_hip:        "Bisagra en la cadera, no en la columna.",
      neutral_spine:    "Columna neutra en todo momento.",
      pull_elbows:      "Jala con los codos, no con las manos.",
      push_floor:       "Empuja el suelo lejos de ti.",
      brace_core:       "Contrae como si fueras a recibir un golpe.",
    },
    pt: {
      core_tight:       "Core firme.",
      drive_heels:      "Empurre pelos calcanhares.",
      chest_up:         "Peito para cima, postura orgulhosa.",
      squeeze_top:      "Contraia forte no topo.",
      control_descent:  "Controle a descida — domine-a.",
      full_rom:         "Amplitude total de movimento.",
      breathe_exertion: "Expire no esforço.",
      hinge_hip:        "Dobre no quadril, não na coluna.",
      neutral_spine:    "Coluna neutra o tempo todo.",
      pull_elbows:      "Puxe pelos cotovelos, não pelas mãos.",
      push_floor:       "Empurre o chão para longe de você.",
      brace_core:       "Contraia como se fosse levar uma pancada.",
    }
  };

  // ── Formspree Redirects ─────────────────────────────────────
  const REDIRECTS = {
    en: "https://buildbelievefit.fitness/thank-you.html",
    es: "https://buildbelievefit.fitness/gracias.html",
    pt: "https://buildbelievefit.fitness/obrigado.html"
  };

  // ── State (read from localStorage on load) ──────────────────
  let _lang  = localStorage.getItem("bbf_lang")     || "en";
  let _train = localStorage.getItem("bbf_train")    === "true";
  let _cue   = localStorage.getItem("bbf_cue_lang") || "es";

  // ── setLang ─────────────────────────────────────────────────
  function setLang(lang) {
    if (!T[lang]) return;
    _lang = lang;
    localStorage.setItem("bbf_lang", lang);
    document.querySelectorAll(".lang-btn").forEach(b => {
      const isActive = b.dataset.lang === lang;
      b.classList.toggle("active",   isActive);
      b.classList.toggle("lang-on",  isActive);  // index.html CSS hook
    });
    applyTranslations();
    updateFormspreeRedirect(lang);
    // If Training Mode is on, sync cue language to new lang
    if (_train && lang !== "en") {
      _cue = lang;
      localStorage.setItem("bbf_cue_lang", _cue);
      applyCueLanguage(_cue);
    }
    document.documentElement.setAttribute("lang", lang);
  }

  // ── applyTranslations ───────────────────────────────────────
  function applyTranslations() {
    const t = T[_lang] || T.en;
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const key = el.dataset.i18n;
      if (t[key] !== undefined) el.textContent = t[key];
    });
    document.querySelectorAll("[data-i18n-ph]").forEach(el => {
      const key = el.dataset.i18nPh;
      if (t[key] !== undefined) el.placeholder = t[key];
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const key = el.dataset.i18nHtml;
      if (t[key] !== undefined) el.innerHTML = t[key];
    });
  }

  // ── Training Mode ───────────────────────────────────────────
  function toggleTrainingMode(active) {
    _train = active;
    localStorage.setItem("bbf_train", String(active));
    if (active) {
      // Use current UI language if not English, else fall back to saved cue lang
      _cue = (_lang !== "en") ? _lang : _cue;
      applyCueLanguage(_cue);
    } else {
      applyCueLanguage("en");
    }
    // Update label
    const label = document.getElementById("trainingLabel");
    if (label) label.textContent = active ? "TRAINING MODE ON" : "TRAINING MODE";
  }

  // ── applyCueLanguage ────────────────────────────────────────
  function applyCueLanguage(lang) {
    const cues = CUES[lang] || CUES.en;
    document.querySelectorAll("[data-cue]").forEach(el => {
      const key = el.dataset.cue;
      if (cues[key] !== undefined) el.textContent = cues[key];
    });
  }

  // ── Formspree _next field ───────────────────────────────────
  function updateFormspreeRedirect(lang) {
    document.querySelectorAll("input[name='_next']").forEach(input => {
      input.value = REDIRECTS[lang] || REDIRECTS.en;
    });
    // Also sync hidden language field
    document.querySelectorAll("input[name='language']").forEach(input => {
      input.value = lang;
    });
  }

  // ── init ────────────────────────────────────────────────────
  function init() {
    const isApp = !!document.getElementById("bbfApp") || !!document.querySelector("[data-bbf-app]");

    // Restore language
    applyTranslations();
    updateFormspreeRedirect(_lang);
    document.querySelectorAll(".lang-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.lang === _lang);
    });
    document.documentElement.setAttribute("lang", _lang);

    // Restore training mode (app only)
    if (isApp) {
      const wrap  = document.getElementById("trainingModeWrap");
      const check = document.getElementById("trainingModeCheck");
      const label = document.getElementById("trainingLabel");
      if (wrap)  wrap.style.display  = "flex";
      if (check) check.checked       = _train;
      if (label) label.textContent   = _train ? "TRAINING MODE ON" : "TRAINING MODE";
      if (_train) applyCueLanguage(_cue);
    }
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    setLang,
    toggleTrainingMode,
    init,
    get lang()  { return _lang;  },
    get train() { return _train; },
    T,
    CUES,
    REDIRECTS,
  };

})();

// ── Auto-init on DOM ready ───────────────────────────────────
document.addEventListener("DOMContentLoaded", BBF.init);
