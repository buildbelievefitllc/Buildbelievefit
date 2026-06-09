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
import { getPrehabCatalog, compileReport, REGION_ICONS, EX_VIDEO } from './prehabProtocol.js';
import { resolveVideoId, thumbURL } from './exerciseVideos.js';
import { pickLang } from '../../lib/pickLang.js';
import { requestPrehabMatrix } from '../../lib/prehabApi.js';
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
    <section className="pde-card" aria-label={s.ariaCoach}>
      <div className="pde-kicker">{s.kicker}</div>
      <div className="pde-titlerow">
        <h3 className="pde-title"><span className="pde-spark">✦</span> {s.title}</h3>
        <span className="pde-badge">{inhaling ? s.badgeInhale : running ? s.badgeExhale : s.badgeInhale}</span>
      </div>
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
    </section>
  );
}

// ── Module 2 · Dynamic Joint Symptom Mobility Planner + Diagnostic Report ─────
function MobilityPlanner() {
  const s = usePrehabStr().mob;
  const { lang } = useLang();
  const { PLANNER } = getPrehabCatalog(lang);
  const [selections, setSelections] = useState(
    () => Object.fromEntries(PLANNER.map((q) => [q.id, q.default])),
  );
  const [compiled, setCompiled] = useState(false);

  // Report resolves off the language-invariant ids/values, then renders localized.
  const report = useMemo(() => compileReport(selections, lang), [selections, lang]);
  const setSel = (id, value) => { setSelections((p) => ({ ...p, [id]: value })); setCompiled(false); };

  return (
    <section className="pde-card" aria-label={s.ariaPlanner}>
      <div className="pde-kicker">{s.kicker}</div>
      <h3 className="pde-title"><span className="pde-spark">〽</span> {s.title}</h3>
      <p className="pde-desc">{s.desc}</p>

      <div className="pde-grid3">
        {PLANNER.map((q) => (
          <label key={q.id} className="pde-field">
            <span className="pde-field-lbl">{q.label}</span>
            <select
              className="pde-select"
              value={selections[q.id]}
              onChange={(e) => setSel(q.id, e.target.value)}
            >
              {q.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <button type="button" className="pde-run" onClick={() => setCompiled(true)}>
        {s.run}
      </button>

      {compiled ? (
        <div className="pde-report" role="status">
          <div className="pde-report-head">{s.reportHead}</div>
          <pre className="pde-report-body">
            <span className="h">{s.compiled}</span>
            {report.map((r, i) => (
              <span key={i}>
                {'\n\n'}
                <span className={r.status === 'ok' ? 'ok' : 'warn'}>{r.status === 'ok' ? '✅' : '⚠'} {r.title}:</span>
                {' '}{r.body}
              </span>
            ))}
            {'\n\n'}
            <span className="act">{s.actionable}</span>
          </pre>
        </div>
      ) : null}
    </section>
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
      className="pde-video pde-video--thumb"
      onClick={() => setPlaying(true)}
      aria-label={`${s.demoVideo(ex.name)} — ${s.playDemo}`}
    >
      <img className="pde-video-thumb" src={thumbURL(id)} alt="" loading="lazy" />
      <span className="pde-video-btn" aria-hidden="true">▶</span>
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

export default function Prehab() {
  return (
    <div className="pde" data-testid="prehab-module">
      <RespiratoryCoach />
      <MobilityPlanner />
      <ProtocolDeck />
    </div>
  );
}
