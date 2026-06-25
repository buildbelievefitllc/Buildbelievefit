// src/components/vault/Prehab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Prehab & Recovery Matrix — Diagnostic Engine.
//
// Rebuilt from the basic yellow friction selector into a high-fidelity, dark-mode
// brutalist diagnostic engine (three wired modules):
//   1. Respiratory Infrastructure Coach — a static-release hold timer with an
//      expanding breathing orb (inhale/exhale cue), 30/45/60s presets, and
//      Start / Pause / Reset transport.
//   2. Dynamic Joint Symptom Mobility Planner — three biomechanical range
//      selectors that compile into a clinical DIAGNOSTIC REPORT (keyed codes).
//   3. Friction-Area Selector + Protocol for Selected Region — the joint/friction
//      area menu (Lower Back · Knee · Shoulder · Elbow · Wrist & Hand) drives the
//      corrective movement deck: pill data-chips (sets/reps/duration), cue
//      directives, a WIRED form-demo video player (thumbnail → autoplay embed, real
//      curated YouTube ids), and a circular "% PROTOCOL DONE" tracker.
//
// All copy + protocol data is static trilingual ground-truth (see prehabProtocol.js:
// REGIONS + PROTOCOLS per region + the EX_VIDEO map); the per-athlete read path is a
// backend follow-up. Mounted in ClientVault and the Command Center Player-Coach
// panel — both render <Prehab /> (no props).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { getPrehabCatalog, REGION_ICONS, EX_VIDEO } from './prehabProtocol.js';
import { resolveVideoId, thumbURL } from './exerciseVideos.js';
import { PlayIcon, ChevronIcon } from './icons.jsx';
import { pickLang } from '../../lib/pickLang.js';
import { requestPrehabMatrix } from '../../lib/prehabApi.js';
import { fetchSectionCoachAudio } from '../../lib/forecastApi.js';
import CoachAudioButton from './CoachAudioButton.jsx';
import { SequenceNext } from './SovereignSequence.jsx';
import { useDailyReadiness, handshakeChannel } from '../../lib/useDailyReadiness.js';
import { deriveVolumeDirective } from '../../lib/autoRegulation.js';
import PREHAB_MATRIX from '../../data/prehabDiagnosticMatrix.json';
import './prehab.css';

const PRESETS = [30, 45, 60];

// Trilingual UI chrome for the Prehab & Recovery Matrix. The clinical PLANNER /
// PROTOCOL ground-truth (movement names, cues, rep schemes) lives in
// prehabProtocol.js and stays as authored; this dictionary covers the module's
// own headers, labels, and dynamic breathing cues. EN values are verbatim.
const STR = {
  en: {
    resp: {
      kicker: 'Decompression Engine',
      title: 'Respiratory Infrastructure Coach',
      badgeInhale: 'Inhale Phase',
      badgeExhale: 'Exhale Phase',
      desc: 'Performance breathing expands cellular water distribution, lowers cortisol parameters, and stabilizes muscle fibers. Synchronize your prehab holdings under the expanding respiratory cue below.',
      cueIdle: 'Hold ready — press start',
      cueInhale: 'Breathe in deeply (expand diaphragm)',
      cueExhale: 'Breathe out slowly (full release)',
      subIdle: 'Synchronize the hold under the expanding respiratory cue',
      subInhale: 'Focus on expanding intercostal rib structures wide',
      subExhale: 'Empty the lungs and sink the ribs down',
      timerLabel: 'Static Release Hold Timer',
      holdDuration: 'Hold duration',
      seconds: (s) => `${s} Seconds`,
      start: '▶ Start Hold',
      pause: '⏸ Pause',
      reset: '↻ Reset',
      ariaCoach: 'Respiratory Infrastructure Coach',
      secsRemaining: (n) => `${n} seconds remaining`,
    },
    mob: {
      kicker: 'Structural Assessment',
      title: 'Dynamic Joint Symptom Mobility Planner',
      desc: 'Evaluate physical thresholds before high-load squats or bench presses. Answer the biomechanical range selectors to compile a customized corrective activation protocol immediately.',
      run: 'Run Mobility Compilation',
      reportHead: '⚠ Diagnostic Report Keyed Codes:',
      compiled: '### BBF Biomechanical Correction Strategy Compiled',
      actionable: '↳ Actionable: Load your pre-selected Prehab Exercise protocols from the listing deck below to unlock these restricted pathways.',
      ariaPlanner: 'Dynamic Joint Symptom Mobility Planner',
    },
    deck: {
      kicker: 'Protocol for Selected Region',
      regionKicker: 'Select Friction Area',
      regionAria: 'Friction area selector',
      cues: 'Cues & Directives',
      done: '✓ Done',
      mark: '› Mark Done',
      sets: (n) => `${n} Sets`,
      videoCap: 'Video Directive',
      ariaRegion: 'Protocol for selected region',
      demoVideo: (name) => `${name} demonstration video`,
      playDemo: 'Play demonstration',
      ringL1: 'Protocol',
      ringL2: 'Done',
      scan: '◎ Run Friction Scanner',
      scanning: 'Scanning your training load…',
      rescan: '↻ Re-run Scanner',
      scanHint: 'Generate a personalized 3-movement recovery matrix from your profile and today’s training load.',
      liveSub: 'Live matrix — built from your profile and today’s load. Switch friction areas to return to the library.',
      live: '◆ Live',
      liveTitle: 'Live Recovery Matrix',
      scanEmpty: 'No live protocol came back — showing your library matrix.',
    },
  },
  es: {
    resp: {
      kicker: 'Motor de Descompresión',
      title: 'Coach de Infraestructura Respiratoria',
      badgeInhale: 'Fase de Inhalación',
      badgeExhale: 'Fase de Exhalación',
      desc: 'La respiración de rendimiento expande la distribución celular de agua, baja los parámetros de cortisol y estabiliza las fibras musculares. Sincroniza tus retenciones de prehab bajo la guía respiratoria expansiva de abajo.',
      cueIdle: 'Retención lista — presiona iniciar',
      cueInhale: 'Inhala profundamente (expande el diafragma)',
      cueExhale: 'Exhala lentamente (liberación total)',
      subIdle: 'Sincroniza la retención bajo la guía respiratoria expansiva',
      subInhale: 'Concéntrate en expandir las estructuras intercostales de par en par',
      subExhale: 'Vacía los pulmones y hunde las costillas',
      timerLabel: 'Temporizador de Retención de Liberación Estática',
      holdDuration: 'Duración de retención',
      seconds: (s) => `${s} Segundos`,
      start: '▶ Iniciar Retención',
      pause: '⏸ Pausar',
      reset: '↻ Reiniciar',
      ariaCoach: 'Coach de Infraestructura Respiratoria',
      secsRemaining: (n) => `${n} segundos restantes`,
    },
    mob: {
      kicker: 'Evaluación Estructural',
      title: 'Planificador Dinámico de Movilidad por Síntoma Articular',
      desc: 'Evalúa los umbrales físicos antes de sentadillas o press de banca de alta carga. Responde los selectores de rango biomecánico para compilar al instante un protocolo de activación correctiva personalizado.',
      run: 'Ejecutar Compilación de Movilidad',
      reportHead: '⚠ Códigos Clave del Informe Diagnóstico:',
      compiled: '### Estrategia de Corrección Biomecánica BBF Compilada',
      actionable: '↳ Accionable: Carga tus protocolos de Ejercicios de Prehab preseleccionados desde el panel de abajo para desbloquear estas vías restringidas.',
      ariaPlanner: 'Planificador Dinámico de Movilidad por Síntoma Articular',
    },
    deck: {
      kicker: 'Protocolo para la Región Seleccionada',
      regionKicker: 'Selecciona el Área de Fricción',
      regionAria: 'Selector de área de fricción',
      cues: 'Señales y Directivas',
      done: '✓ Hecho',
      mark: '› Marcar Hecho',
      sets: (n) => `${n} Series`,
      videoCap: 'Directiva en Video',
      ariaRegion: 'Protocolo para la región seleccionada',
      demoVideo: (name) => `Video de demostración: ${name}`,
      playDemo: 'Reproducir demostración',
      ringL1: 'Protocolo',
      ringL2: 'Hecho',
      scan: '◎ Ejecutar Escáner de Fricción',
      scanning: 'Escaneando tu carga de entrenamiento…',
      rescan: '↻ Re-ejecutar Escáner',
      scanHint: 'Genera una matriz de recuperación personalizada de 3 movimientos a partir de tu perfil y la carga de entrenamiento de hoy.',
      liveSub: 'Matriz en vivo — creada desde tu perfil y la carga de hoy. Cambia de área de fricción para volver a la biblioteca.',
      live: '◆ En Vivo',
      liveTitle: 'Matriz de Recuperación en Vivo',
      scanEmpty: 'No se recibió protocolo en vivo — mostrando tu matriz de biblioteca.',
    },
  },
  pt: {
    resp: {
      kicker: 'Motor de Descompressão',
      title: 'Coach de Infraestrutura Respiratória',
      badgeInhale: 'Fase de Inspiração',
      badgeExhale: 'Fase de Expiração',
      desc: 'A respiração de performance expande a distribuição celular de água, reduz os parâmetros de cortisol e estabiliza as fibras musculares. Sincronize suas retenções de prehab sob a guia respiratória expansiva abaixo.',
      cueIdle: 'Retenção pronta — pressione iniciar',
      cueInhale: 'Inspire profundamente (expanda o diafragma)',
      cueExhale: 'Expire lentamente (liberação total)',
      subIdle: 'Sincronize a retenção sob a guia respiratória expansiva',
      subInhale: 'Concentre-se em expandir bem as estruturas intercostais',
      subExhale: 'Esvazie os pulmões e afunde as costelas',
      timerLabel: 'Cronômetro de Retenção de Liberação Estática',
      holdDuration: 'Duração da retenção',
      seconds: (s) => `${s} Segundos`,
      start: '▶ Iniciar Retenção',
      pause: '⏸ Pausar',
      reset: '↻ Reiniciar',
      ariaCoach: 'Coach de Infraestrutura Respiratória',
      secsRemaining: (n) => `${n} segundos restantes`,
    },
    mob: {
      kicker: 'Avaliação Estrutural',
      title: 'Planejador Dinâmico de Mobilidade por Sintoma Articular',
      desc: 'Avalie os limiares físicos antes de agachamentos ou supinos de alta carga. Responda aos seletores de amplitude biomecânica para compilar imediatamente um protocolo de ativação corretiva personalizado.',
      run: 'Executar Compilação de Mobilidade',
      reportHead: '⚠ Códigos-Chave do Relatório Diagnóstico:',
      compiled: '### Estratégia de Correção Biomecânica BBF Compilada',
      actionable: '↳ Acionável: Carregue seus protocolos de Exercícios de Prehab pré-selecionados no painel abaixo para desbloquear estas vias restritas.',
      ariaPlanner: 'Planejador Dinâmico de Mobilidade por Sintoma Articular',
    },
    deck: {
      kicker: 'Protocolo para a Região Selecionada',
      regionKicker: 'Selecione a Área de Fricção',
      regionAria: 'Seletor de área de fricção',
      cues: 'Comandos e Diretrizes',
      done: '✓ Feito',
      mark: '› Marcar Feito',
      sets: (n) => `${n} Séries`,
      videoCap: 'Diretriz em Vídeo',
      ariaRegion: 'Protocolo para a região selecionada',
      demoVideo: (name) => `Vídeo de demonstração: ${name}`,
      playDemo: 'Reproduzir demonstração',
      ringL1: 'Protocolo',
      ringL2: 'Feito',
      scan: '◎ Executar Scanner de Fricção',
      scanning: 'Analisando sua carga de treino…',
      rescan: '↻ Reexecutar Scanner',
      scanHint: 'Gere uma matriz de recuperação personalizada de 3 movimentos a partir do seu perfil e da carga de treino de hoje.',
      liveSub: 'Matriz ao vivo — criada a partir do seu perfil e da carga de hoje. Troque a área de fricção para voltar à biblioteca.',
      live: '◆ Ao Vivo',
      liveTitle: 'Matriz de Recuperação ao Vivo',
      scanEmpty: 'Nenhum protocolo ao vivo retornou — mostrando sua matriz da biblioteca.',
    },
  },
};

function usePrehabStr() {
  const { lang } = useLang();
  return STR[lang] || STR.en;
}

// ── Module 1 · Respiratory Infrastructure Coach ──────────────────────────────
function RespiratoryCoach() {
  const s = usePrehabStr().resp;
  const [open, setOpen] = useState(false); // collapsed by default — secondary to the diagnostic, parked at the bottom
  const [duration, setDuration] = useState(30); // mission default: 30s
  const [remaining, setRemaining] = useState(30);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(null);

  // Countdown — one interval, torn down on pause/unmount/completion.
  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { setRunning(false); return 0; }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, [running]);

  const selectPreset = (s) => {
    setRunning(false);
    setDuration(s);
    setRemaining(s);
  };
  const start = () => { if (remaining > 0) setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => { setRunning(false); setRemaining(duration); };

  // Breathing phase: 8s cycle (4s inhale / 4s exhale) while the hold runs.
  const elapsed = duration - remaining;
  const inhaling = running && (elapsed % 8) < 4;
  const orbState = !running ? 'is-idle' : (inhaling ? 'is-inhale' : 'is-exhale');
  const cue = !running ? s.cueIdle : (inhaling ? s.cueInhale : s.cueExhale);
  const sub = !running ? s.subIdle : (inhaling ? s.subInhale : s.subExhale);

  return (
    <section className={`pde-card pde-resp${open ? ' is-open' : ''}`} aria-label={s.ariaCoach}>
      {/* Collapsible header — collapsed by default so it stays out of the diagnostic's way */}
      <button type="button" className="pde-resp-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="pde-resp-head">
          <span className="pde-kicker">{s.kicker}</span>
          <span className="pde-title"><span className="pde-spark">✦</span> {s.title}</span>
        </span>
        <ChevronIcon className="pde-resp-chev" size={18} />
      </button>

      {open ? (
        <div className="pde-resp-body">
          <p className="pde-desc">{s.desc}</p>

          <div className="pde-orb-wrap">
            <div className={`pde-orb ${orbState}`} role="timer" aria-label={s.secsRemaining(remaining)}>
              <div className="pde-orb-core"><span className="pde-orb-count">{remaining}s</span></div>
            </div>
            <div className="pde-orb-cue"><span aria-hidden="true">🫁</span> {cue}</div>
            <div className="pde-orb-sub">{sub}</div>
          </div>

          <div className="pde-timer">
            <div className="pde-timer-top">
              <span className="pde-timer-lbl">{s.timerLabel}</span>
              <div className="pde-presets" role="group" aria-label={s.holdDuration}>
                {PRESETS.map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    className={`pde-preset${duration === sec ? ' is-active' : ''}`}
                    aria-pressed={duration === sec}
                    onClick={() => selectPreset(sec)}
                  >
                    {s.seconds(sec)}
                  </button>
                ))}
              </div>
            </div>
            <div className="pde-transport">
              <button type="button" className="pde-btn pde-btn--primary" onClick={start} disabled={running || remaining === 0}>
                {s.start}
              </button>
              <button type="button" className="pde-btn" onClick={pause} disabled={!running}>{s.pause}</button>
              <button type="button" className="pde-btn" onClick={reset}>{s.reset}</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Module 2 · Dynamic Joint Symptom Diagnostic — the Autonomous Physical Therapist ──
// A live 3-step diagnostic flow over prehabDiagnosticMatrix.json (Fable 5's 25-node
// clinical database): joint complex → pain profile → trigger mechanic → the matched
// node's diagnosis_hypothesis + its localized 3-drill corrective protocol. No static
// accordion — every option is derived from the matrix, narrowing to one diagnosis.
const uniq = (arr) => [...new Set(arr)];

// Extract the 11-char YouTube id from a standard watch / youtu.be / embed URL.
function youtubeId(url) {
  const m = String(url || '').match(/(?:v=|\/embed\/|youtu\.be\/|\/v\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
// Privacy-enhanced (no-cookie) AUTOPLAY embed src — only built once the athlete
// taps the branded cover (DrillVideo), so nothing streams on initial render.
function ytEmbedAutoplay(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

// Premium video wrapper (V8.7) — a branded preview cover (thumbnail + gold play
// button) that swaps to the autoplay iframe ONLY on tap. Replaces the raw iframe
// the corrective-protocol drills used to mount on load. No id → nothing.
function DrillVideo({ url, title }) {
  const [playing, setPlaying] = useState(false);
  const id = youtubeId(url);
  if (!id) return null;
  if (playing) {
    return (
      <div className="pdx-video is-playing">
        <iframe
          key={id}
          className="pdx-video-frame"
          src={ytEmbedAutoplay(id)}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button type="button" className="pdx-video bbf-video-cover" onClick={() => setPlaying(true)} aria-label={title}>
      <img className="pdx-video-thumb" src={thumbURL(id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="bbf-video-overlay" aria-hidden="true">
        <span className="bbf-video-play"><PlayIcon size={24} /></span>
      </span>
    </button>
  );
}

// UI-chrome localization (the matrix DRILLS carry their own en/es/pt; the clinical
// diagnosis_hypothesis is English in the data and rendered verbatim).
const DX_STR = {
  en: { kicker: 'Autonomous Physical Therapist', title: 'Joint Symptom Diagnostic', desc: 'Three inputs compile a clinical hypothesis and your corrective protocol. Isolate the joint, the pain signature, then the mechanic that provokes it.', step: 'Step', s1: 'Joint Complex', s2: 'Pain Profile', s3: 'Trigger Mechanic', h1: 'Where is the dysfunction?', h2: 'What does it feel like?', h3: 'What provokes it?', dx: 'Diagnosis Hypothesis', dxToggle: 'View Clinical Hypothesis', rx: 'Corrective Protocol', reset: '↻ New Diagnosis' },
  es: { kicker: 'Fisioterapeuta Autónomo', title: 'Diagnóstico por Síntoma Articular', desc: 'Tres entradas compilan una hipótesis clínica y tu protocolo correctivo. Aísla la articulación, el tipo de dolor y la mecánica que lo provoca.', step: 'Paso', s1: 'Complejo Articular', s2: 'Perfil del Dolor', s3: 'Mecánica Desencadenante', h1: '¿Dónde está la disfunción?', h2: '¿Qué sensación produce?', h3: '¿Qué lo provoca?', dx: 'Hipótesis Diagnóstica', dxToggle: 'Ver Hipótesis Clínica', rx: 'Protocolo Correctivo', reset: '↻ Nuevo Diagnóstico' },
  pt: { kicker: 'Fisioterapeuta Autônomo', title: 'Diagnóstico por Sintoma Articular', desc: 'Três entradas compilam uma hipótese clínica e o seu protocolo corretivo. Isole a articulação, o tipo de dor e a mecânica que o provoca.', step: 'Passo', s1: 'Complexo Articular', s2: 'Perfil da Dor', s3: 'Mecânica Desencadeante', h1: 'Onde está a disfunção?', h2: 'O que você sente?', h3: 'O que provoca?', dx: 'Hipótese Diagnóstica', dxToggle: 'Ver Hipótese Clínica', rx: 'Protocolo Corretivo', reset: '↻ Novo Diagnóstico' },
};

function MobilityPlanner() {
  const s = usePrehabStr().mob;
  const { lang } = useLang();
  const d = DX_STR[lang] || DX_STR.en;

  const [joint, setJoint] = useState(null);
  const [pain, setPain] = useState(null);
  const [trigger, setTrigger] = useState(null);

  // Options derived live from the matrix, narrowing at each step.
  const joints = useMemo(() => uniq(PREHAB_MATRIX.map((n) => n.joint_complex)), []);
  const pains = useMemo(
    () => (joint ? uniq(PREHAB_MATRIX.filter((n) => n.joint_complex === joint).map((n) => n.diagnostic_inputs.pain_profile)) : []),
    [joint],
  );
  const triggers = useMemo(
    () => (joint && pain
      ? uniq(PREHAB_MATRIX
        .filter((n) => n.joint_complex === joint && n.diagnostic_inputs.pain_profile === pain)
        .map((n) => n.diagnostic_inputs.trigger_mechanic))
      : []),
    [joint, pain],
  );
  const node = useMemo(
    () => (joint && pain && trigger
      ? PREHAB_MATRIX.find((n) => n.joint_complex === joint
        && n.diagnostic_inputs.pain_profile === pain
        && n.diagnostic_inputs.trigger_mechanic === trigger)
      : null),
    [joint, pain, trigger],
  );

  const pickJoint = (j) => { setJoint(j); setPain(null); setTrigger(null); };
  const pickPain = (p) => { setPain(p); setTrigger(null); };
  const reset = () => { setJoint(null); setPain(null); setTrigger(null); };

  return (
    <section className="pde-card" aria-label={s.ariaPlanner} data-testid="prehab-diagnostic">
      <div className="pde-kicker">{d.kicker}</div>
      <h3 className="pde-title"><span className="pde-spark">⚕</span> {d.title}</h3>
      <p className="pde-desc">{d.desc}</p>

      <div className="pdx-flow">
        <DiagStep n={1} stepWord={d.step} label={d.s1} hint={d.h1} options={joints} selected={joint} onPick={pickJoint} />
        {joint ? <DiagStep n={2} stepWord={d.step} label={d.s2} hint={d.h2} options={pains} selected={pain} onPick={pickPain} /> : null}
        {joint && pain ? <DiagStep n={3} stepWord={d.step} label={d.s3} hint={d.h3} options={triggers} selected={trigger} onPick={setTrigger} stack /> : null}
      </div>

      {node ? <DiagnosisResult node={node} lang={lang} d={d} onReset={reset} /> : null}
    </section>
  );
}

// One diagnostic step — numbered, with its matrix-derived options as selectable chips.
function DiagStep({ n, stepWord, label, hint, options, selected, onPick, stack }) {
  const done = selected != null;
  return (
    <div className={`pdx-step${done ? ' is-done' : ''}`}>
      <div className="pdx-step-head">
        <span className="pdx-step-n" aria-hidden="true">{done ? '✓' : n}</span>
        <div className="pdx-step-id">
          <span className="pdx-step-kicker">{stepWord} {n} · {label}</span>
          <span className="pdx-step-hint">{hint}</span>
        </div>
      </div>
      <div className={`pdx-opts${stack ? ' is-stack' : ''}`} role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === selected}
            className={`pdx-opt${o === selected ? ' is-on' : ''}`}
            onClick={() => onPick(o)}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// Matched node → the clinical hypothesis + the localized 3-drill corrective protocol.
function DiagnosisResult({ node, lang, d, onReset }) {
  const rx = node.prescription;
  // Phase 3 — the deep diagnostic theory is collapsed by DEFAULT so the corrective
  // protocol videos sit above the fold; the hypothesis is one tap away.
  const [dxOpen, setDxOpen] = useState(false);
  return (
    <div className="pdx-result" role="status" data-testid="prehab-diagnosis">
      <div className={`pdx-dx${dxOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="pdx-dx-toggle"
          onClick={() => setDxOpen((o) => !o)}
          aria-expanded={dxOpen}
          data-testid="prehab-dx-toggle"
        >
          <span className="pdx-dx-head">⚕ {d.dxToggle}</span>
          <ChevronIcon className="pdx-dx-chev" size={16} />
        </button>
        {dxOpen ? <p className="pdx-dx-body">{node.diagnosis_hypothesis}</p> : null}
      </div>

      <div className="pdx-rx-head">
        <span className="pdx-rx-kicker">{d.rx}</span>
        <span className="pdx-rx-name">{rx.protocol_name}</span>
      </div>

      <ol className="pdx-drills">
        {rx.drills.map((drill) => {
          const L = (drill.localization && (drill.localization[lang] || drill.localization.en)) || {};
          const cues = Array.isArray(L.cues) ? L.cues : [];
          return (
            <li key={drill.step} className="pdx-drill">
              <div className="pdx-drill-top">
                <span className="pdx-drill-step" aria-hidden="true">{drill.step}</span>
                <div className="pdx-drill-id">
                  <span className="pdx-drill-type">{drill.type}</span>
                  <div className="pdx-drill-name">{L.name}</div>
                </div>
                <span className="pdx-drill-vol">{drill.volume}</span>
              </div>
              {L.description ? <p className="pdx-drill-desc">{L.description}</p> : null}
              {(() => {
                const enName = (drill.localization && drill.localization.en && drill.localization.en.name) || drill.type || `step-${drill.step}`;
                const cueText = [L.name, L.description, ...cues].map((x) => String(x || '').trim()).filter(Boolean).join('. ');
                return cueText ? (
                  <CoachAudioButton
                    audioRequest={() => fetchSectionCoachAudio({ context: 'prehab', cueRef: `prehab:${enName}`, cueText, locale: lang })}
                    fallbackText={cueText}
                  />
                ) : null;
              })()}
              <DrillVideo url={drill.youtube_url} title={L.name || drill.type} />
              {cues.length ? (
                <ul className="pdx-cues">
                  {cues.map((c, i) => <li key={i} className="pdx-cue">{c}</li>)}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>

      <button type="button" className="pdx-reset" onClick={onReset}>{d.reset}</button>
    </div>
  );
}

// ── Circular % tracker ───────────────────────────────────────────────────────
function ProtocolRing({ pct }) {
  const s = usePrehabStr().deck;
  const SIZE = 52;
  const STROKE = 5;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="pde-ring-wrap">
      <div className="pde-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle className="pde-ring-track" cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" strokeWidth={STROKE} />
          <circle
            className="pde-ring-arc"
            cx={SIZE / 2} cy={SIZE / 2} r={r} fill="none" strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
          />
        </svg>
        <span className="pde-ring-num">{pct}%</span>
      </div>
      <span className="pde-ring-lbl">{s.ringL1}<br />{s.ringL2}</span>
    </div>
  );
}

// Resolve a demonstration video for ANY exercise — the static catalog OR a LIVE
// Recovery Matrix movement (whose synthetic `live_*` key isn't in EX_VIDEO). Order:
// exact catalog key → the movement NAME slugged to a catalog key (so "Glute Bridge"
// → glute_bridge resolves the curated clip) → the authorized lift VIDEO_MAP fuzzy
// resolver. No match → null (VideoSlot shows the clean caption-only state).
function slugifyName(name) {
  return String(name || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
// `lang` resolves each catalog entry (a flat id OR a localized { en, es, pt }
// object) to the active language via pickLang, with EN fallback — so a missing
// es/pt clip safely shows the EN demo instead of an empty slot.
function resolveExerciseVideo(ex, lang) {
  if (!ex) return null;
  if (ex.key && EX_VIDEO[ex.key]) return pickLang(EX_VIDEO[ex.key], lang);
  const slug = slugifyName(ex.name);
  if (slug && EX_VIDEO[slug]) return pickLang(EX_VIDEO[slug], lang);
  return resolveVideoId(ex.name, lang) || null;
}

// Form-demo video player — resolves each exercise to a real curated YouTube id
// (catalog key · live-name slug · fuzzy lift resolver). Shows the thumbnail with a
// play overlay; a tap swaps in an autoplay embed so the demo plays inside the card.
// No id → a clean caption-only state (never a dead button).
function VideoSlot({ ex, s }) {
  const { lang } = useLang();
  const [playing, setPlaying] = useState(false);
  const id = resolveExerciseVideo(ex, lang);

  if (!id) {
    return (
      <div className="pde-video is-empty" aria-label={s.demoVideo(ex.name)}>
        <span className="pde-video-cap">{s.videoCap}</span>
      </div>
    );
  }
  if (playing) {
    return (
      <div className="pde-video is-playing">
        <iframe
          key={id}
          className="pde-video-frame"
          src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
          title={s.demoVideo(ex.name)}
          loading="lazy"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      className="pde-video pde-video--thumb bbf-video-cover"
      onClick={() => setPlaying(true)}
      aria-label={`${s.demoVideo(ex.name)} — ${s.playDemo}`}
    >
      <img className="pde-video-thumb" src={thumbURL(id)} alt="" loading="lazy" />
      <span className="bbf-video-overlay" aria-hidden="true">
        <span className="bbf-video-play"><PlayIcon size={22} /></span>
      </span>
      <span className="pde-video-cap">{s.videoCap}</span>
    </button>
  );
}

// Inline styles for the live-scanner affordances — kept self-contained in this file (no
// prehab.css edits) and strictly on-palette: BBF purple #6a0dad, gold #f5c800, matte
// black #090909. Fallback vars degrade gracefully if a token is undefined.
const SCAN_STYLES = {
  wrap: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '.6rem', margin: '4px 0 12px' },
  hint: { flex: '1 1 12rem', minWidth: '10rem', fontSize: '.8rem', lineHeight: 1.35, color: 'var(--mut, #9aa)' },
  err: { margin: '0 0 12px', color: 'var(--red, #ff5d5d)', fontSize: '.85rem', fontWeight: 600 },
  badge: { marginLeft: '.5rem', padding: '.1rem .5rem', borderRadius: '999px', background: '#f5c800', color: '#090909', fontSize: '.68rem', fontWeight: 800, letterSpacing: '.4px', verticalAlign: 'middle' },
  focusChip: { borderColor: '#6a0dad', color: '#caa6ff' },
};

// BBF-gold SMIL spinner (self-animating SVG — no CSS keyframes needed). Renders inside
// the scan button while the Recovery Matrix engine is resolving.
function ScanSpinner() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" style={{ verticalAlign: '-2px', marginRight: '.35rem' }} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(245,200,0,.25)" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#f5c800" strokeWidth="3" strokeLinecap="round">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

// Adapt a live Recovery Matrix entry { name, duration, focus, reason } into the deck's
// exercise render shape. The engine returns no sets/reps/cues, so those are omitted (the
// deck renders each chip/section conditionally); `focus` becomes a chip and `reason` the
// description. A stable per-slot key drives the done-set + the React list.
function liveMatrixToExercises(matrix) {
  return matrix.map((m, i) => ({
    key: `live_${i}_${String(m.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`,
    name: m.name,
    duration: m.duration,
    focus: m.focus,
    desc: m.reason,
    cues: [],
    live: true,
  }));
}

// ── Module 3 · Friction-Area Selector + Protocol for Selected Region ──────────
function ProtocolDeck() {
  const s = usePrehabStr().deck;
  const { lang } = useLang();
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || '';
  const { REGIONS, PROTOCOLS } = getPrehabCatalog(lang);
  const [region, setRegion] = useState(REGIONS[0].id);
  const [done, setDone] = useState(() => new Set());

  // Live Recovery Matrix override (bbf-agentic-prehab via prehabApi). null ⇒ render the
  // static catalog protocol for the selected region; an array ⇒ the personalized,
  // token-gated 3-movement matrix replaces it. A failed scan leaves the static deck up.
  const [liveMatrix, setLiveMatrix] = useState(null);
  const [scan, setScan] = useState({ loading: false, error: null });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const protocol = PROTOCOLS[region] || PROTOCOLS[REGIONS[0].id];
  const usingLive = Array.isArray(liveMatrix);
  const exercises = usingLive ? liveMatrix : protocol.exercises;

  // Switching the friction area loads a fresh protocol — clear done AND any live matrix
  // so the deck reverts to that region's static catalog (and the % tracker resets).
  const selectRegion = (id) => {
    setRegion(id);
    setDone(new Set());
    setLiveMatrix(null);
    setScan({ loading: false, error: null });
  };
  const toggle = (key) => setDone((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  // Run the live Friction Scanner. The selected region label rides along as the free-text
  // friction signal; identity + the tier gate are resolved SERVER-SIDE from the vault
  // token (prehabApi attaches it — the client never asserts identity). Admins pass the
  // Omniscience override. On success the matrix overrides the static deck; on any failure
  // we surface prehabApi's already-friendly message and keep the static protocol visible.
  const runScanner = async () => {
    if (scan.loading) return;
    setScan({ loading: true, error: null });
    const friction = (REGIONS.find((r) => r.id === region) || {}).label || '';
    try {
      const matrix = await requestPrehabMatrix({ uid, friction, adminOverride: isAdmin });
      if (!mounted.current) return;
      if (matrix.length) {
        setLiveMatrix(liveMatrixToExercises(matrix));
        setDone(new Set());
        setScan({ loading: false, error: null });
      } else {
        setScan({ loading: false, error: s.scanEmpty });
      }
    } catch (e) {
      if (mounted.current) setScan({ loading: false, error: e?.message || s.scanEmpty });
    }
  };

  const total = exercises.length;
  const pct = total ? Math.round((done.size / total) * 100) : 0;

  return (
    <section className="pde-card" aria-label={s.ariaRegion}>
      {/* Friction-area selection menu — pick the painful joint to load its protocol. */}
      <div className="pde-kicker">{s.regionKicker}</div>
      <div className="pde-regions" role="tablist" aria-label={s.regionAria}>
        {REGIONS.map((r) => {
          const on = r.id === region;
          return (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={on}
              className={`pde-region${on ? ' is-active' : ''}`}
              data-testid={`prehab-region-${r.id}`}
              onClick={() => selectRegion(r.id)}
            >
              <span className="pde-region-ic" aria-hidden="true">{REGION_ICONS[r.id]}</span>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* ── Live Recovery Matrix · Friction Scanner trigger ─────────────────────── */}
      <div style={SCAN_STYLES.wrap}>
        <button
          type="button"
          className="pde-run"
          onClick={runScanner}
          disabled={scan.loading}
          aria-busy={scan.loading}
          data-testid="prehab-scan"
        >
          {scan.loading ? <><ScanSpinner />{s.scanning}</> : (usingLive ? s.rescan : s.scan)}
        </button>
        <span style={SCAN_STYLES.hint}>{usingLive ? s.liveSub : s.scanHint}</span>
      </div>
      {scan.error ? <div style={SCAN_STYLES.err} role="alert">⚠ {scan.error}</div> : null}

      <div className="pde-proto-head">
        <div>
          <div className="pde-kicker">{s.kicker}</div>
          <h3 className="pde-proto-title">
            <span aria-hidden="true">{REGION_ICONS[region]}</span> {usingLive ? s.liveTitle : protocol.title}
            {usingLive ? <span style={SCAN_STYLES.badge}>{s.live}</span> : null}
          </h3>
        </div>
        <ProtocolRing pct={pct} />
      </div>

      {!usingLive ? (
        <div className="pde-quote">
          <span className="pde-quote-ic" aria-hidden="true">ⓘ</span>
          <p className="pde-quote-txt">{protocol.quote}</p>
        </div>
      ) : null}

      {exercises.map((ex, i) => {
        const isDone = done.has(ex.key);
        return (
          <article
            key={ex.key}
            className={`pde-ex${isDone ? ' is-done' : ''}`}
            data-testid="prehab-routine"
          >
            <div className="pde-ex-main">
              <div className="pde-ex-top">
                <span className="pde-ex-idx">{i + 1}</span>
                <span className="pde-ex-name" data-testid="prehab-routine-name">{ex.name}</span>
                <button
                  type="button"
                  className="pde-mark"
                  aria-pressed={isDone}
                  onClick={() => toggle(ex.key)}
                >
                  {isDone ? s.done : s.mark}
                </button>
              </div>

              <div className="pde-chips">
                {ex.sets != null ? <span className="pde-chip" data-testid="prehab-routine-sets">{s.sets(ex.sets)}</span> : null}
                {ex.reps ? <span className="pde-chip" data-testid="prehab-routine-reps">{ex.reps}</span> : null}
                {ex.focus ? <span className="pde-chip" style={SCAN_STYLES.focusChip}>{ex.focus}</span> : null}
                {ex.duration ? <span className="pde-chip">{ex.duration}</span> : null}
              </div>

              {ex.desc ? <p className="pde-ex-desc" data-testid="prehab-routine-cue">{ex.desc}</p> : null}

              {ex.cues?.length ? (
                <div className="pde-cues">
                  <div className="pde-cues-head">{s.cues}</div>
                  {ex.cues.map((c, ci) => (
                    <div className="pde-cue" key={ci}>
                      <span className="pde-cue-arrow" aria-hidden="true">›</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>

            <VideoSlot ex={ex} s={s} />
          </article>
        );
      })}
    </section>
  );
}

// ── Sovereign Readiness banner ───────────────────────────────────────────────
// The morning check-in's verdict (wearable sync OR Manual Health Input — same
// shared store, useDailyReadiness) surfaced on the Prehab tab, so a low-readiness
// day visibly prioritizes recovery here too. Reuses the SAME directive transform
// (deriveVolumeDirective) that ProgramGrid / Smart Cardio regulate on, so all
// surfaces speak one verdict. No telemetry → renders nothing (never punishes).
const RDY_STR = {
  en: {
    kicker: 'Sovereign Readiness',
    score: (s) => (s == null ? 'No readiness score' : `Readiness ${s}/100`),
    breach: 'System breach — recovery is the priority today. Run the corrective protocol below and keep heavy axial load off the CNS.',
    adaptive: 'Adaptive state — bank recovery. The targeted mobility work below is recommended before you train.',
    full: 'Prime clearance — prehab is maintenance today. Keep the joints honest and proceed.',
    inject: 'Low readiness — targeted prehab drills are recommended before loading.',
  },
  es: {
    kicker: 'Preparación Soberana',
    score: (s) => (s == null ? 'Sin puntaje de preparación' : `Preparación ${s}/100`),
    breach: 'Brecha del sistema — hoy la recuperación es la prioridad. Ejecuta el protocolo correctivo de abajo y mantén la carga axial pesada fuera del SNC.',
    adaptive: 'Estado adaptativo — acumula recuperación. Se recomienda el trabajo de movilidad de abajo antes de entrenar.',
    full: 'Autorización óptima — hoy el prehab es mantenimiento. Mantén las articulaciones sanas y continúa.',
    inject: 'Baja preparación — se recomiendan drills de prehab específicos antes de cargar.',
  },
  pt: {
    kicker: 'Prontidão Soberana',
    score: (s) => (s == null ? 'Sem pontuação de prontidão' : `Prontidão ${s}/100`),
    breach: 'Violação do sistema — hoje a recuperação é a prioridade. Execute o protocolo corretivo abaixo e mantenha a carga axial pesada longe do SNC.',
    adaptive: 'Estado adaptativo — acumule recuperação. O trabalho de mobilidade abaixo é recomendado antes de treinar.',
    full: 'Liberação máxima — hoje o prehab é manutenção. Mantenha as articulações saudáveis e prossiga.',
    inject: 'Baixa prontidão — drills de prehab específicos são recomendados antes de carregar.',
  },
};
// Reuse the Check-In hub's trilingual mode chips — one source for the mode label.
const RDY_MODE_TKEY = {
  PRIME_EXECUTION: 'sch-mode-prime',
  STANDARD_OPERATIONS: 'sch-mode-standard',
  SYSTEM_STRAIN: 'sch-mode-strain',
  SYSTEM_BREACH: 'sch-mode-breach',
  INSUFFICIENT_TELEMETRY: 'sch-mode-insufficient',
};

function PrehabReadinessBanner({ readiness }) {
  const { lang, t } = useLang();
  const tr = RDY_STR[lang] || RDY_STR.en;
  const directive = deriveVolumeDirective({
    score: readiness?.score ?? null,
    mode: readiness?.mode ?? null,
    isSuppressed: readiness?.isSuppressed ?? false,
    hasData: readiness?.hasData ?? false,
  });
  // No usable telemetry → say nothing (same stance as the engine + the grid).
  if (!readiness?.hasData || directive.state === 'none') return null;

  const msg = directive.state === 'breach' ? tr.breach : directive.state === 'adaptive' ? tr.adaptive : tr.full;
  const modeLabel = readiness?.mode ? t(RDY_MODE_TKEY[readiness.mode] || 'sch-mode-insufficient') : null;

  return (
    <section
      className={`pde-card pde-rdy pde-rdy--${directive.state}`}
      role="status"
      data-testid="prehab-readiness"
      data-bbf-mode={handshakeChannel(readiness)}
    >
      <div className="pde-rdy-top">
        <span className="pde-rdy-kicker">{tr.kicker}</span>
        <span className="pde-rdy-score">{tr.score(readiness?.score ?? null)}</span>
        {modeLabel ? <span className="pde-rdy-mode">{modeLabel}</span> : null}
      </div>
      <p className="pde-rdy-msg">{msg}</p>
      {directive.injectPrehab ? <p className="pde-rdy-inject">↳ {tr.inject}</p> : null}
    </section>
  );
}

export default function Prehab({ onSequence }) {
  // The shared CNS telemetry channel — the EXACT store ProgramGrid / Smart Cardio
  // read, so a manual baseline (or a wearable sync) lights up this tab the moment
  // it lands, live, via PROTOCOL_UPDATED_EVENT (no reload).
  const { data: readiness } = useDailyReadiness();
  return (
    <div className="pde" data-testid="prehab-module" data-bbf-mode={handshakeChannel(readiness)}>
      <PrehabReadinessBanner readiness={readiness} />
      <MobilityPlanner />
      <ProtocolDeck />
      {/* Respiratory coach parked at the bottom (collapsed) so the symptom
          diagnostic + protocol path lead — it no longer hijacks the top. */}
      <RespiratoryCoach />
      {/* Sovereign Sequence · Prehab is the OPTIONAL fork (reached from Program's
          "Report Joint Friction / Pain" button); from here, flush the system with
          cardio. Adult-only (gated on onSequence; never in the Command Center mount). */}
      {onSequence ? (
        <SequenceNext label="Next: Flush the System (Cardio) ➔" onClick={() => onSequence('cardio')} testid="sovereign-prehab-cardio" />
      ) : null}
    </div>
  );
}
