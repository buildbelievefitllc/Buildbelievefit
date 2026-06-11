// src/components/vault/SmartCardio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 22 → 22.z — Smart Cardio (Client Vault surface). SURGICAL UI GRAFT:
// the visual configuration layer was rebuilt to the high-fidelity "Metabolic
// Pacer" prototype (kcal burn hero · gold drag slider · selectable Kinetic
// Apparatus card grid · purple RECONSTRUCT PROTOCOL · revealed Live Respiratory
// Sync active-session panel with a countdown pacer + metabolic timeline). The
// ENGINE underneath is untouched:
//   • bbf-agentic-cardio — RECONSTRUCT PROTOCOL fires the same generation call
//     (CNS-aware minute-by-minute protocol + Sovereign Toast + rate-limit toast).
//   • Backend logging/history (bbf_get_cardio / logCardio) — preserved below.
//   • The full Playwright QA contract (21 data-testid hooks) — preserved. The
//     athlete's time budget lives on the editable slider readout
//     (data-testid="cardio-gen-minutes"); RECONSTRUCT PROTOCOL is the submit
//     (data-testid="cardio-gen-submit"); LiveProtocol still carries every
//     cardio-gen-* result hook.
//
// ISOLATION: touches only cardioApi / agenticCardioApi + cardio.css. Never imports
// or edits T2's ProgramGrid / programData / programApi.

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { useCardio, logCardio, CARDIO_ZONES } from '../../lib/cardioApi.js';
import { generateCardio } from '../../lib/agenticCardioApi.js';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';
import { deriveVolumeDirective } from '../../lib/autoRegulation.js';
import './cardio.css';

// ── Trilingual UI chrome for Smart Cardio (Metabolic Pacer) ──────────────────
// The physiological constants (vo2, efficiency, breath patterns, accents) stay in
// the option maps below; these dictionaries cover the surface's display labels.
// CARDIO_ZONES (legend / log / history) is shared lib data and stays as authored.
// EN values are verbatim to the prior hardcoded copy.
const CARDIO_STR = {
  en: {
    title: 'Smart Cardio', kicker: 'Metabolic Pacer',
    sub: 'The engine routes between HIIT (< 20 min), Tempo (20–35 min), and Zone 2 (> 35 min) — each protocol is built for your time budget. Log every session to keep your conditioning honest.',
    loading: 'Loading your cardio protocols…',
    cfgKicker: 'Smart Cardio · Metabolic Pacer', cfgTitle: 'Dial In the Prescription',
    cfgSub: 'Targeted low-zeal compression sequences — elevate mitochondrial respiration, accelerate thermogenesis, and stabilize the diaphragm after heavy barbell work. Tune the variables; reconstruct your protocol live.',
    burnTotal: 'Total Session Burn', kcal: ' kcal', min: 'min',
    timeDuration: 'Time Duration', availMinutes: 'Available minutes', minutes: 'Minutes',
    durSlider: 'Time duration slider',
    scaleOpener: (m) => `${m} Mins · Opener`, scaleLongevity: (m) => `${m} Mins · Longevity Endurance`,
    pacingTarget: 'Pacing Strategy Target', kineticModality: 'Kinetic Modality',
    selectApparatus: 'Select Active Kinetic Apparatus', curatedSuite: '● Curated suite for any / home / general gym',
    apparatusAria: 'Active kinetic apparatus',
    reconstruct: 'Reconstruct Protocol', routing: 'Routing…',
    errMinutes: 'Enter how many minutes you have.', errGenerate: 'Could not generate a protocol.',
    liveSync: 'Live Respiratory Sync',
    timeBlock: 'Time · Block', timeRemaining: 'Time remaining', elapsed: 'Elapsed', targetPulse: 'Target Pulse',
    burnRatio: 'Burn Ratio', effortState: 'Effort State', bpm: ' bpm', cpm: ' c/m',
    pausePacer: '❙❙ Pause Pacer', launchPacer: '▶ Launch Pacer', resetBlock: '↺ Reset Block',
    cnsTitle: 'CNS Protection Engaged', cnsFatigue: (s) => `fatigue ${s}/100`,
    cnsBody: (a, b) => <>Softened from <b>{a}</b> to <b>{b}</b> to protect tomorrow’s output.</>,
    timeline: 'Metabolic Timeline Breakdown', o2: (d, o) => `${d} min · ${o}% O₂`,
    sovToast: 'The Sovereign Toast', primaryRoi: 'Primary ROI',
    fallback: 'Generated from the deterministic engine (AI writer offline) — targets are sound.',
    crpKicker: 'Dynamic CRP Formula', crpFormulaAria: 'Cardio-Respiratory Prescription formula',
    crpNum: 'Duration × Intensity × Modality', crpDen: 'Mechanical Efficiency',
    crpSummary: (app, dur, zone) => <>Based on your <b>{app}</b> at <b>{dur} min</b> on the <b>{zone}</b> target, we map a multi-stage respiratory protocol.</>,
    crpIndex: 'CRP Index', crpVo2: 'Working VO₂max', crpHr: 'Target HRmax', crpBurn: 'Est. Burn',
    breathPacer: 'Breath Pacer', inhale: 'Inhale', hold: 'Hold', exhale: 'Exhale', paused: 'Paused',
    pattern: (i, h, e) => `Pattern · Inhale ${i}s${h > 0 ? ` · Hold ${h}s` : ''} · Exhale ${e}s`,
    cycle: (n) => ` (${n}s cycle)`, pausePacer2: 'Pause Pacer', startPacer: 'Start Breath Pacer →',
    activeProtocols: 'Active Protocols',
    noProtocol: 'No cardio protocol assigned yet — your coach is dialing in your conditioning. It will appear here once assigned.',
    targetDuration: 'Target Duration', intensity: 'Intensity',
    sessionHistory: 'Session History', noSessions: 'No sessions logged yet. Log your first cardio session below.',
    logSession: 'Log a Session', zone: 'Zone', durationMin: 'Duration (min)', avgHr: 'Avg HR (bpm)', notes: 'Notes',
    phNotes: 'How it felt, splits, terrain…', logBtn: 'Log Session →', logging: 'Logging…',
    errDur: 'Enter a duration between 1 and 600 minutes.', logged: 'Session logged. Conditioning stays honest. 🔥',
    errLog: 'Could not log session. Please try again.',
    // CNS telemetry — the daily auto-regulation payload driving the cardio lockout.
    rdyKicker: 'CNS Telemetry · Daily Auto-Regulation',
    rdyScore: 'Sovereign Readiness',
    rdyHrv: 'HRV vs Baseline', rdySleep: 'Sleep vs 8h Target',
    rdyBaseline: (b) => `baseline ${b} ms`, rdyMs: ' ms',
    rdySleepVal: (h, m) => `${h}h ${String(m).padStart(2, '0')}m`,
    rdyLocked: '🔒 Locked · CNS protection',
    rdyBreach: (s) => `System breach — readiness ${s == null ? '—' : s}/100. High-intensity and threshold tracks are locked: today defaults to Zone 2 aerobic capacity or active recovery. Rebuild the engine before you redline it.`,
    rdyStrain: (s) => `System strain — readiness ${s == null ? '—' : s}/100. Max-effort intervals are locked: cap today at tempo or below and bank recovery for tomorrow's output.`,
    rdyRedirect: (z) => `Pacing target redirected to ${z} by the morning check-in.`,
    modes: {
      PRIME_EXECUTION: 'Prime Execution', STANDARD_OPERATIONS: 'Standard Operations',
      SYSTEM_STRAIN: 'System Strain', SYSTEM_BREACH: 'System Breach',
      INSUFFICIENT_TELEMETRY: 'Insufficient Telemetry',
    },
  },
  es: {
    title: 'Cardio Inteligente', kicker: 'Marcapasos Metabólico',
    sub: 'El motor enruta entre HIIT (< 20 min), Tempo (20–35 min) y Zona 2 (> 35 min) — cada protocolo se construye para tu presupuesto de tiempo. Registra cada sesión para mantener tu acondicionamiento honesto.',
    loading: 'Cargando tus protocolos de cardio…',
    cfgKicker: 'Cardio Inteligente · Marcapasos Metabólico', cfgTitle: 'Ajusta la Prescripción',
    cfgSub: 'Secuencias de compresión de bajo desgaste dirigidas — elevan la respiración mitocondrial, aceleran la termogénesis y estabilizan el diafragma tras el trabajo pesado con barra. Ajusta las variables; reconstruye tu protocolo en vivo.',
    burnTotal: 'Quema Total de la Sesión', kcal: ' kcal', min: 'min',
    timeDuration: 'Duración de Tiempo', availMinutes: 'Minutos disponibles', minutes: 'Minutos',
    durSlider: 'Control deslizante de duración',
    scaleOpener: (m) => `${m} Min · Apertura`, scaleLongevity: (m) => `${m} Min · Resistencia de Longevidad`,
    pacingTarget: 'Objetivo de Estrategia de Ritmo', kineticModality: 'Modalidad Cinética',
    selectApparatus: 'Selecciona el Aparato Cinético Activo', curatedSuite: '● Suite curada para gimnasio en casa / general / cualquiera',
    apparatusAria: 'Aparato cinético activo',
    reconstruct: 'Reconstruir Protocolo', routing: 'Enrutando…',
    errMinutes: 'Ingresa cuántos minutos tienes.', errGenerate: 'No se pudo generar un protocolo.',
    liveSync: 'Sincronización Respiratoria en Vivo',
    timeBlock: 'Tiempo · Bloque', timeRemaining: 'Tiempo restante', elapsed: 'Transcurrido', targetPulse: 'Pulso Objetivo',
    burnRatio: 'Tasa de Quema', effortState: 'Estado de Esfuerzo', bpm: ' lpm', cpm: ' c/m',
    pausePacer: '❙❙ Pausar Marcapasos', launchPacer: '▶ Lanzar Marcapasos', resetBlock: '↺ Reiniciar Bloque',
    cnsTitle: 'Protección del SNC Activada', cnsFatigue: (s) => `fatiga ${s}/100`,
    cnsBody: (a, b) => <>Suavizado de <b>{a}</b> a <b>{b}</b> para proteger el rendimiento de mañana.</>,
    timeline: 'Desglose de Línea de Tiempo Metabólica', o2: (d, o) => `${d} min · ${o}% O₂`,
    sovToast: 'El Brindis Soberano', primaryRoi: 'ROI Principal',
    fallback: 'Generado por el motor determinista (escritor IA fuera de línea) — los objetivos son sólidos.',
    crpKicker: 'Fórmula CRP Dinámica', crpFormulaAria: 'Fórmula de Prescripción Cardio-Respiratoria',
    crpNum: 'Duración × Intensidad × Modalidad', crpDen: 'Eficiencia Mecánica',
    crpSummary: (app, dur, zone) => <>Según tu <b>{app}</b> a <b>{dur} min</b> en el objetivo <b>{zone}</b>, mapeamos un protocolo respiratorio multietapa.</>,
    crpIndex: 'Índice CRP', crpVo2: 'VO₂máx de Trabajo', crpHr: 'FCmáx Objetivo', crpBurn: 'Quema Est.',
    breathPacer: 'Marcapasos de Respiración', inhale: 'Inhala', hold: 'Mantén', exhale: 'Exhala', paused: 'Pausado',
    pattern: (i, h, e) => `Patrón · Inhala ${i}s${h > 0 ? ` · Mantén ${h}s` : ''} · Exhala ${e}s`,
    cycle: (n) => ` (ciclo de ${n}s)`, pausePacer2: 'Pausar Marcapasos', startPacer: 'Iniciar Marcapasos de Respiración →',
    activeProtocols: 'Protocolos Activos',
    noProtocol: 'Aún no hay protocolo de cardio asignado — tu coach está afinando tu acondicionamiento. Aparecerá aquí una vez asignado.',
    targetDuration: 'Duración Objetivo', intensity: 'Intensidad',
    sessionHistory: 'Historial de Sesiones', noSessions: 'Aún no hay sesiones registradas. Registra tu primera sesión de cardio abajo.',
    logSession: 'Registrar una Sesión', zone: 'Zona', durationMin: 'Duración (min)', avgHr: 'FC Prom (lpm)', notes: 'Notas',
    phNotes: 'Cómo se sintió, parciales, terreno…', logBtn: 'Registrar Sesión →', logging: 'Registrando…',
    errDur: 'Ingresa una duración entre 1 y 600 minutos.', logged: 'Sesión registrada. El acondicionamiento sigue honesto. 🔥',
    errLog: 'No se pudo registrar la sesión. Inténtalo de nuevo.',
    rdyKicker: 'Telemetría del SNC · Autorregulación Diaria',
    rdyScore: 'Preparación Soberana',
    rdyHrv: 'HRV vs Línea Base', rdySleep: 'Sueño vs Objetivo de 8h',
    rdyBaseline: (b) => `línea base ${b} ms`, rdyMs: ' ms',
    rdySleepVal: (h, m) => `${h}h ${String(m).padStart(2, '0')}m`,
    rdyLocked: '🔒 Bloqueado · Protección del SNC',
    rdyBreach: (s) => `Brecha del sistema — preparación ${s == null ? '—' : s}/100. Las pistas de alta intensidad y umbral están bloqueadas: hoy se trabaja en Zona 2 aeróbica o recuperación activa. Reconstruye el motor antes de exigirlo al máximo.`,
    rdyStrain: (s) => `Sistema en tensión — preparación ${s == null ? '—' : s}/100. Los intervalos de esfuerzo máximo están bloqueados: limita el día a tempo o menos y acumula recuperación para el rendimiento de mañana.`,
    rdyRedirect: (z) => `Objetivo de ritmo redirigido a ${z} por el registro matutino.`,
    modes: {
      PRIME_EXECUTION: 'Ejecución Óptima', STANDARD_OPERATIONS: 'Operación Estándar',
      SYSTEM_STRAIN: 'Sistema en Tensión', SYSTEM_BREACH: 'Brecha del Sistema',
      INSUFFICIENT_TELEMETRY: 'Telemetría Insuficiente',
    },
  },
  pt: {
    title: 'Cardio Inteligente', kicker: 'Marca-passo Metabólico',
    sub: 'O motor roteia entre HIIT (< 20 min), Tempo (20–35 min) e Zona 2 (> 35 min) — cada protocolo é construído para o seu orçamento de tempo. Registre cada sessão para manter seu condicionamento honesto.',
    loading: 'Carregando seus protocolos de cardio…',
    cfgKicker: 'Cardio Inteligente · Marca-passo Metabólico', cfgTitle: 'Ajuste a Prescrição',
    cfgSub: 'Sequências de compressão de baixo desgaste direcionadas — elevam a respiração mitocondrial, aceleram a termogênese e estabilizam o diafragma após trabalho pesado com barra. Ajuste as variáveis; reconstrua seu protocolo ao vivo.',
    burnTotal: 'Queima Total da Sessão', kcal: ' kcal', min: 'min',
    timeDuration: 'Duração de Tempo', availMinutes: 'Minutos disponíveis', minutes: 'Minutos',
    durSlider: 'Controle deslizante de duração',
    scaleOpener: (m) => `${m} Min · Abertura`, scaleLongevity: (m) => `${m} Min · Resistência de Longevidade`,
    pacingTarget: 'Alvo de Estratégia de Ritmo', kineticModality: 'Modalidade Cinética',
    selectApparatus: 'Selecione o Aparelho Cinético Ativo', curatedSuite: '● Suíte curada para academia em casa / geral / qualquer',
    apparatusAria: 'Aparelho cinético ativo',
    reconstruct: 'Reconstruir Protocolo', routing: 'Roteando…',
    errMinutes: 'Informe quantos minutos você tem.', errGenerate: 'Não foi possível gerar um protocolo.',
    liveSync: 'Sincronização Respiratória ao Vivo',
    timeBlock: 'Tempo · Bloco', timeRemaining: 'Tempo restante', elapsed: 'Decorrido', targetPulse: 'Pulso Alvo',
    burnRatio: 'Taxa de Queima', effortState: 'Estado de Esforço', bpm: ' bpm', cpm: ' c/m',
    pausePacer: '❙❙ Pausar Marca-passo', launchPacer: '▶ Lançar Marca-passo', resetBlock: '↺ Reiniciar Bloco',
    cnsTitle: 'Proteção do SNC Ativada', cnsFatigue: (s) => `fadiga ${s}/100`,
    cnsBody: (a, b) => <>Suavizado de <b>{a}</b> para <b>{b}</b> para proteger o desempenho de amanhã.</>,
    timeline: 'Detalhamento da Linha do Tempo Metabólica', o2: (d, o) => `${d} min · ${o}% O₂`,
    sovToast: 'O Brinde Soberano', primaryRoi: 'ROI Principal',
    fallback: 'Gerado pelo motor determinístico (escritor IA offline) — as metas são sólidas.',
    crpKicker: 'Fórmula CRP Dinâmica', crpFormulaAria: 'Fórmula de Prescrição Cardio-Respiratória',
    crpNum: 'Duração × Intensidade × Modalidade', crpDen: 'Eficiência Mecânica',
    crpSummary: (app, dur, zone) => <>Com base no seu <b>{app}</b> a <b>{dur} min</b> no alvo <b>{zone}</b>, mapeamos um protocolo respiratório de múltiplos estágios.</>,
    crpIndex: 'Índice CRP', crpVo2: 'VO₂máx de Trabalho', crpHr: 'FCmáx Alvo', crpBurn: 'Queima Est.',
    breathPacer: 'Marca-passo de Respiração', inhale: 'Inspire', hold: 'Segure', exhale: 'Expire', paused: 'Pausado',
    pattern: (i, h, e) => `Padrão · Inspire ${i}s${h > 0 ? ` · Segure ${h}s` : ''} · Expire ${e}s`,
    cycle: (n) => ` (ciclo de ${n}s)`, pausePacer2: 'Pausar Marca-passo', startPacer: 'Iniciar Marca-passo de Respiração →',
    activeProtocols: 'Protocolos Ativos',
    noProtocol: 'Ainda não há protocolo de cardio atribuído — seu coach está ajustando seu condicionamento. Ele aparecerá aqui assim que atribuído.',
    targetDuration: 'Duração Alvo', intensity: 'Intensidade',
    sessionHistory: 'Histórico de Sessões', noSessions: 'Ainda não há sessões registradas. Registre sua primeira sessão de cardio abaixo.',
    logSession: 'Registrar uma Sessão', zone: 'Zona', durationMin: 'Duração (min)', avgHr: 'FC Méd (bpm)', notes: 'Notas',
    phNotes: 'Como se sentiu, parciais, terreno…', logBtn: 'Registrar Sessão →', logging: 'Registrando…',
    errDur: 'Informe uma duração entre 1 e 600 minutos.', logged: 'Sessão registrada. O condicionamento segue honesto. 🔥',
    errLog: 'Não foi possível registrar a sessão. Tente novamente.',
    rdyKicker: 'Telemetria do SNC · Autorregulação Diária',
    rdyScore: 'Prontidão Soberana',
    rdyHrv: 'HRV vs Linha de Base', rdySleep: 'Sono vs Alvo de 8h',
    rdyBaseline: (b) => `linha de base ${b} ms`, rdyMs: ' ms',
    rdySleepVal: (h, m) => `${h}h ${String(m).padStart(2, '0')}m`,
    rdyLocked: '🔒 Bloqueado · Proteção do SNC',
    rdyBreach: (s) => `Violação do sistema — prontidão ${s == null ? '—' : s}/100. As faixas de alta intensidade e limiar estão bloqueadas: hoje o trabalho é Zona 2 aeróbica ou recuperação ativa. Reconstrua o motor antes de levá-lo ao limite.`,
    rdyStrain: (s) => `Sistema em tensão — prontidão ${s == null ? '—' : s}/100. Os intervalos de esforço máximo estão bloqueados: limite o dia a tempo ou menos e acumule recuperação para o desempenho de amanhã.`,
    rdyRedirect: (z) => `Alvo de ritmo redirecionado para ${z} pelo check-in matinal.`,
    modes: {
      PRIME_EXECUTION: 'Execução Máxima', STANDARD_OPERATIONS: 'Operação Padrão',
      SYSTEM_STRAIN: 'Sistema em Tensão', SYSTEM_BREACH: 'Violação do Sistema',
      INSUFFICIENT_TELEMETRY: 'Telemetria Insuficiente',
    },
  },
};

// Localized display labels for the in-component option maps (keyed by lang → id).
// The numeric constants stay in PACING_OPTS / APPARATUS / MODALITY_OPTS below.
const PACING_LABELS = {
  en: { zone2: 'Zone 2 · Aerobic Base', tempo: 'Tempo · Threshold', hiit: 'HIIT · Max Effort', fasted: 'Fasted Steady-State' },
  es: { zone2: 'Zona 2 · Base Aeróbica', tempo: 'Tempo · Umbral', hiit: 'HIIT · Esfuerzo Máximo', fasted: 'Estado Estable en Ayunas' },
  pt: { zone2: 'Zona 2 · Base Aeróbica', tempo: 'Tempo · Limiar', hiit: 'HIIT · Esforço Máximo', fasted: 'Estado Estável em Jejum' },
};
const ZONE_SHORT = {
  en: { zone2: 'Zone 2', tempo: 'Tempo', hiit: 'HIIT', fasted: 'Fasted' },
  es: { zone2: 'Zona 2', tempo: 'Tempo', hiit: 'HIIT', fasted: 'Ayunas' },
  pt: { zone2: 'Zona 2', tempo: 'Tempo', hiit: 'HIIT', fasted: 'Jejum' },
};
const APPARATUS_LABELS = {
  en: {
    'flat-treadmill': { label: 'Flat Treadmill', sub: 'Speed-Play' },
    'incline-treadmill': { label: 'Incline Treadmill', sub: 'Glute / Core' },
    'stairmaster': { label: 'Standard Stairmaster', sub: 'Vertical Drive' },
    'concept2-rower': { label: 'Concept2 Rower', sub: 'Full-Body Pull' },
    'assault-bike': { label: 'Assault Bike', sub: 'Max EPOC' },
  },
  es: {
    'flat-treadmill': { label: 'Cinta Plana', sub: 'Juego de Velocidad' },
    'incline-treadmill': { label: 'Cinta Inclinada', sub: 'Glúteo / Core' },
    'stairmaster': { label: 'Escaladora Estándar', sub: 'Impulso Vertical' },
    'concept2-rower': { label: 'Remo Concept2', sub: 'Tracción de Cuerpo Completo' },
    'assault-bike': { label: 'Bici Assault', sub: 'EPOC Máximo' },
  },
  pt: {
    'flat-treadmill': { label: 'Esteira Plana', sub: 'Jogo de Velocidade' },
    'incline-treadmill': { label: 'Esteira Inclinada', sub: 'Glúteo / Core' },
    'stairmaster': { label: 'Escada Padrão', sub: 'Impulso Vertical' },
    'concept2-rower': { label: 'Remo Concept2', sub: 'Puxada de Corpo Inteiro' },
    'assault-bike': { label: 'Bike Assault', sub: 'EPOC Máximo' },
  },
};
const MODALITY_LABELS = {
  en: { cyclical: 'Cyclical · Low-Impact', ballistic: 'Ballistic · Plyometric', hybrid: 'Mixed-Modal · Hybrid', carry: 'Loaded Carry · Resisted' },
  es: { cyclical: 'Cíclico · Bajo Impacto', ballistic: 'Balístico · Pliométrico', hybrid: 'Modal Mixto · Híbrido', carry: 'Carga Cargada · Resistido' },
  pt: { cyclical: 'Cíclico · Baixo Impacto', ballistic: 'Balístico · Pliométrico', hybrid: 'Modal Misto · Híbrido', carry: 'Carregamento Carregado · Resistido' },
};
const PHASE_LABELS = {
  en: { warmup: '◐ Warm-Up', work: '▲ Work', recovery: '◡ Recovery', steady: '■ Steady', cooldown: '◑ Cool-Down' },
  es: { warmup: '◐ Calentamiento', work: '▲ Trabajo', recovery: '◡ Recuperación', steady: '■ Estable', cooldown: '◑ Enfriamiento' },
  pt: { warmup: '◐ Aquecimento', work: '▲ Trabalho', recovery: '◡ Recuperação', steady: '■ Estável', cooldown: '◑ Desaquecimento' },
};

function fmtDate(d) {
  if (!d) return '—';
  const t = Date.parse(d);
  if (Number.isNaN(t)) return String(d);
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function zoneMeta(z) {
  return CARDIO_ZONES[z] || { label: z, blurb: '', accent: '#FF4500' };
}

export default function SmartCardio() {
  const { data, isLoading, error, refetch } = useCardio();
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;

  return (
    <div className="bbf-cardio" data-testid="smart-cardio-module">
      <div className="bbf-cardio__head">
        <h2 className="bbf-cardio__title">{tr.title}</h2>
        <span className="bbf-cardio__kicker">{tr.kicker}</span>
      </div>
      <p className="bbf-cardio__sub">{tr.sub}</p>

      {/* Metabolic Pacer — the rebuilt configuration layer (kcal hero · slider ·
          apparatus grid) wired straight into the live bbf-agentic-cardio engine. */}
      <CardioConfigurator />

      {/* Zone legend */}
      <div className="bbf-cardio__zones">
        {Object.entries(CARDIO_ZONES).map(([id, z]) => (
          <div key={id} className="bbf-cardio__zone" style={{ '--zone-accent': z.accent }}>
            <div className="bbf-cardio__zone-name">{z.label}</div>
            <div className="bbf-cardio__zone-blurb">{z.blurb}</div>
          </div>
        ))}
      </div>

      {isLoading ? <div className="bbf-cardio__loading">{tr.loading}</div> : null}
      {!isLoading && error ? <div className="bbf-cardio__error" role="alert">{error}</div> : null}

      {!isLoading && !error && data ? (
        <>
          <ActiveProtocols protocols={data.protocols} />
          <LogSession onLogged={refetch} />
          <History logs={data.logs} />
        </>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Configurator domain + derivation (pure, client-side)
// ─────────────────────────────────────────────────────────────────────────────

const DURATION_MIN = 10;
const DURATION_MAX = 60;
const DURATION_STEP = 5;

// Each pacing tier carries the physiological constants the formula reads:
//   vo2 = working %VO₂max · hr = %HRmax label · breath = inhale/hold/exhale (s)
const PACING_OPTS = {
  zone2: { label: 'Zone 2 · Aerobic Base', zone: 'Zone 2', accent: '#22c55e', vo2: 0.65, hr: '60–70%', breath: [4, 0, 6], intensity: 1.0 },
  tempo: { label: 'Tempo · Threshold', zone: 'Tempo', accent: '#F59E0B', vo2: 0.80, hr: '76–85%', breath: [3, 0, 4], intensity: 1.35 },
  hiit: { label: 'HIIT · Max Effort', zone: 'HIIT', accent: '#FF4500', vo2: 0.92, hr: '86–95%', breath: [2, 1, 2], intensity: 1.7 },
  fasted: { label: 'Fasted Steady-State', zone: 'Fasted', accent: '#9D27C9', vo2: 0.60, hr: '55–65%', breath: [4, 2, 6], intensity: 0.9 },
};

// Active Kinetic Apparatus — the selectable card grid (replaces the equipment
// dropdown). `efficiency` is the mechanical-efficiency term the CRP formula reads.
const APPARATUS_ORDER = ['flat-treadmill', 'incline-treadmill', 'stairmaster', 'concept2-rower', 'assault-bike'];
const APPARATUS = {
  'flat-treadmill': { label: 'Flat Treadmill', sub: 'Speed-Play', glyph: '🏃', efficiency: 1.0 },
  'incline-treadmill': { label: 'Incline Treadmill', sub: 'Glute / Core', glyph: '⛰', efficiency: 1.1 },
  'stairmaster': { label: 'Standard Stairmaster', sub: 'Vertical Drive', glyph: '🪜', efficiency: 1.1 },
  'concept2-rower': { label: 'Concept2 Rower', sub: 'Full-Body Pull', glyph: '🚣', efficiency: 1.15 },
  'assault-bike': { label: 'Assault Bike', sub: 'Max EPOC', glyph: '🚲', efficiency: 1.2 },
};

const MODALITY_OPTS = {
  cyclical: { label: 'Cyclical · Low-Impact', factor: 1.0 },
  ballistic: { label: 'Ballistic · Plyometric', factor: 1.3 },
  hybrid: { label: 'Mixed-Modal · Hybrid', factor: 1.15 },
  carry: { label: 'Loaded Carry · Resisted', factor: 1.4 },
};

// The Dynamic CRP (Cardio-Respiratory Prescription) index. Deterministic:
//   CRP = Duration × Intensity × Modality ÷ Mechanical-Efficiency
function computeCRP({ duration, pacing, apparatus, modality }) {
  const p = PACING_OPTS[pacing];
  const a = APPARATUS[apparatus];
  const m = MODALITY_OPTS[modality];
  const raw = (duration * p.intensity * m.factor) / a.efficiency;
  const index = Math.round(raw);
  // Crude steady-state kcal proxy: ~9 kcal/CRP-unit, rounded to the nearest 5.
  const kcal = Math.round((raw * 9) / 5) * 5;
  return {
    index,
    kcal,
    vo2: Math.round(p.vo2 * 100),
    hr: p.hr,
    bpm: Math.round(p.vo2 * 200), // target pulse proxy from working %VO₂max
    intensity: p.intensity,
    modalityFactor: m.factor,
    efficiency: a.efficiency,
  };
}

function pad(n) { return String(Number(n) || 0).padStart(2, '0'); }
function clampDuration(n) { return Math.min(DURATION_MAX, Math.max(DURATION_MIN, n || DURATION_MIN)); }

// ─────────────────────────────────────────────────────────────────────────────
// CardioConfigurator — the grafted Metabolic Pacer. Owns the configuration state
// AND the live engine call (lifted from the old CardioEngine), so the slider +
// apparatus cards feed bbf-agentic-cardio directly and RECONSTRUCT PROTOCOL is the
// single generation trigger. Maps 429 → a clean rate-limit toast.
// ─────────────────────────────────────────────────────────────────────────────
function CardioConfigurator() {
  const { user } = useAuth();
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  const PL = PACING_LABELS[lang] || PACING_LABELS.en;
  const AL = APPARATUS_LABELS[lang] || APPARATUS_LABELS.en;
  const ML = MODALITY_LABELS[lang] || MODALITY_LABELS.en;
  const ZS = ZONE_SHORT[lang] || ZONE_SHORT.en;
  const uid = user?.username || user?.id || '';

  // ── CNS-driven lockout — the daily auto-regulation payload (biometric ledger).
  // BREACH locks HIIT + Tempo (Zone 2 / aerobic / recovery only); STRAIN locks
  // HIIT. With no / stale telemetry every track stays open (never punish missing
  // data). The lock is enforced on the DERIVED pacing, not by mutating state in
  // an effect — a locked selection simply resolves to Zone 2 (no setState loops).
  const { data: readiness } = useDailyReadiness();
  const directive = deriveVolumeDirective({
    score: readiness?.score ?? null,
    mode: readiness?.mode ?? null,
    isSuppressed: readiness?.isSuppressed ?? false,
    hasData: readiness?.hasData ?? false,
  });
  const lockedPacing = new Set([
    ...(directive.lockHiit ? ['hiit'] : []),
    ...(directive.lockTempo ? ['tempo'] : []),
  ]);

  // Athlete time budget — string so the editable readout (cardio-gen-minutes)
  // accepts free entry; the slider mirrors the same value.
  const [minutes, setMinutes] = useState('30');
  const [pacing, setPacing] = useState('zone2');
  const [apparatus, setApparatus] = useState('assault-bike');
  const [modality, setModality] = useState('cyclical');

  // Live engine state (was CardioEngine).
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null); // rate-limit toast message | null
  const [plan, setPlan] = useState(null);
  const [revealed, setRevealed] = useState(false);

  // Effective pacing: a CNS-locked selection redirects to Zone 2 (pure derivation).
  const effectivePacing = lockedPacing.has(pacing) ? 'zone2' : pacing;
  const redirected = effectivePacing !== pacing;
  const duration = Math.round(Number(minutes) || 0);
  const pacingMeta = PACING_OPTS[effectivePacing];
  const crp = computeCRP({ duration: duration || DURATION_MIN, pacing: effectivePacing, apparatus, modality });

  async function reconstruct(e) {
    e?.preventDefault?.();
    if (busy) return;
    const m = Math.round(Number(minutes) || 0);
    if (!m || m <= 0) { setError(tr.errMinutes); setRevealed(true); return; }
    setBusy(true);
    setError(null);
    setRevealed(true);
    try {
      setPlan(await generateCardio(uid, m));
    } catch (err) {
      // 429 → clean toast (resets at midnight UTC); everything else → inline error.
      if (err?.code === 'rate_limited') { setToast(err.message); setError(null); }
      else setError(err?.message || tr.errGenerate);
      setPlan(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bbf-cfg" style={{ '--cfg-accent': pacingMeta.accent }}>
      <div className="bbf-cfg__head">
        <span className="bbf-cardio__kicker" style={{ color: pacingMeta.accent }}>{tr.cfgKicker}</span>
        <h3 className="bbf-cardio__title" style={{ fontSize: '1.35rem' }}>{tr.cfgTitle}</h3>
        <p className="bbf-cfg__sub">{tr.cfgSub}</p>
      </div>

      {/* ── CNS Telemetry dashboard — the morning check-in's verdict + gauges ── */}
      <CnsTelemetry readiness={readiness} directive={directive} redirected={redirected} zoneLabel={ZS.zone2} />

      {/* ── Dynamic caloric hero — reacts to the time slider + apparatus ── */}
      <div className="bbf-burn" data-testid="cardio-burn-hero">
        <span className="bbf-burn__icon" aria-hidden="true">🔥</span>
        <div className="bbf-burn__body">
          <span className="bbf-burn__label">{tr.burnTotal}</span>
          <span className="bbf-burn__val">~{crp.kcal}<span className="bbf-burn__unit">{tr.kcal}</span></span>
        </div>
        <span className="bbf-burn__ctx">{AL[apparatus].label} · {duration || DURATION_MIN} {tr.min}</span>
      </div>

      {/* ── Configuration layer ── */}
      <div className="bbf-cfg__layer">
        {/* Time duration — gold drag slider with an editable minutes readout. */}
        <div className="bbf-slider">
          <div className="bbf-slider__top">
            <label className="bbf-slider__lbl" htmlFor="cfg-mins-num">{tr.timeDuration}</label>
            <span className="bbf-slider__readout">
              <input
                id="cfg-mins-num"
                className="bbf-slider__num"
                type="number"
                inputMode="numeric"
                min="1"
                max="120"
                value={minutes}
                disabled={busy}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label={tr.availMinutes}
                data-testid="cardio-gen-minutes"
              />
              <span className="bbf-slider__num-unit">{tr.minutes}</span>
            </span>
          </div>
          <input
            className="bbf-slider__range"
            type="range"
            min={DURATION_MIN}
            max={DURATION_MAX}
            step={DURATION_STEP}
            value={clampDuration(duration)}
            disabled={busy}
            onChange={(e) => setMinutes(e.target.value)}
            aria-label={tr.durSlider}
          />
          <div className="bbf-slider__scale">
            <span>{tr.scaleOpener(DURATION_MIN)}</span>
            <span>{tr.scaleLongevity(DURATION_MAX)}</span>
          </div>
        </div>

        {/* Pacing + kinetic modality — the two strategy dropdowns. */}
        <div className="bbf-cfg__selectors">
          <div className="bbf-cardio__field">
            <label htmlFor="cfg-pace">{tr.pacingTarget}</label>
            <select
              id="cfg-pace"
              className="bbf-input"
              value={effectivePacing}
              disabled={busy}
              onChange={(e) => { if (!lockedPacing.has(e.target.value)) setPacing(e.target.value); }}
            >
              {Object.keys(PACING_OPTS).map((id) => (
                <option key={id} value={id} disabled={lockedPacing.has(id)}>
                  {lockedPacing.has(id) ? `🔒 ${PL[id]}` : PL[id]}
                </option>
              ))}
            </select>
            {redirected ? (
              <div className="bbf-rdy__redirect" role="status" data-testid="cardio-cns-redirect">
                {tr.rdyRedirect(ZS.zone2)}
              </div>
            ) : null}
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="cfg-mod">{tr.kineticModality}</label>
            <select id="cfg-mod" className="bbf-input" value={modality} disabled={busy} onChange={(e) => setModality(e.target.value)}>
              {Object.keys(MODALITY_OPTS).map((id) => <option key={id} value={id}>{ML[id]}</option>)}
            </select>
          </div>
        </div>
      </div>

      <CRPFormulaCard crp={crp} duration={duration || DURATION_MIN} apparatusLabel={AL[apparatus].label} zoneLabel={ZS[effectivePacing]} />

      {/* ── Select Active Kinetic Apparatus — selectable card grid ── */}
      <div className="bbf-app">
        <div className="bbf-app__head">
          <span className="bbf-app__kicker">{tr.selectApparatus}</span>
          <span className="bbf-app__suite">{tr.curatedSuite}</span>
        </div>
        <div className="bbf-app__grid" role="radiogroup" aria-label={tr.apparatusAria}>
          {APPARATUS_ORDER.map((id) => {
            const a = APPARATUS[id];
            const active = apparatus === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={busy}
                className={`bbf-app__card${active ? ' is-active' : ''}`}
                onClick={() => setApparatus(id)}
                data-testid={`cardio-apparatus-${id}`}
              >
                <span className="bbf-app__glyph" aria-hidden="true">{a.glyph}</span>
                <span className="bbf-app__name">{AL[id].label}</span>
                <span className="bbf-app__sub">{AL[id].sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RECONSTRUCT PROTOCOL — the single generation trigger (cardio-gen-submit) ── */}
      <div className="bbf-cfg__actions">
        <button
          type="button"
          className="bbf-reconstruct"
          onClick={reconstruct}
          disabled={busy}
          data-testid="cardio-gen-submit"
        >
          {busy ? tr.routing : tr.reconstruct}
        </button>
      </div>

      {/* ── Revealed active-session panel — Live Respiratory Sync ── */}
      {revealed ? (
        <div className="bbf-session" data-testid="cardio-session-panel">
          <div className="bbf-session__kicker">{tr.liveSync}</div>
          <PacerTimer duration={duration || DURATION_MIN} crp={crp} pacing={pacingMeta} accent={pacingMeta.accent} zoneLabel={ZS[effectivePacing]} />
          {/* key={effectivePacing} remounts the breath pacer with fresh state when
              the pattern changes — avoids a synchronous setState-in-effect reset. */}
          <RespiratorySync key={effectivePacing} breath={pacingMeta.breath} accent={pacingMeta.accent} />

          {error ? <div className="bbf-cardio__error" role="alert" style={{ marginTop: '.9rem' }}>{error}</div> : null}
          {plan ? <LiveProtocol plan={plan} /> : null}
          {toast ? <RateLimitToast message={toast} onClose={() => setToast(null)} /> : null}
        </div>
      ) : null}
    </section>
  );
}

// ── CNS Telemetry dashboard — readiness verdict + biometric target gauges ─────
// Renders ONLY when the ledger holds a fresh verdict (hasData). Gauges are pure
// derivations of the stored vitals: readiness 0–100, HRV as % of the athlete's
// own rolling baseline (capped at 130 for display), sleep as % of the 8h target.
// When the directive locks tracks, the authoritative clinical summary states
// exactly why the prescription was altered.
function CnsTelemetry({ readiness, directive, redirected, zoneLabel }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  if (!readiness?.hasData) return null;

  const score = readiness.score;
  const hrv = readiness.vitals ? Number(readiness.vitals.hrv_ms) : NaN;
  const sleep = readiness.vitals ? Number(readiness.vitals.sleep_minutes) : NaN;
  const base = Number(readiness.baselineHrv);
  const scorePct = Number.isFinite(Number(score)) ? Math.max(0, Math.min(100, Math.round(Number(score)))) : null;
  const hrvPct = Number.isFinite(hrv) && Number.isFinite(base) && base > 0
    ? Math.min(130, Math.round((hrv / base) * 100))
    : null;
  const sleepPct = Number.isFinite(sleep) ? Math.min(100, Math.round((sleep / 480) * 100)) : null;
  const modeLabel = readiness.mode ? (tr.modes[readiness.mode] || readiness.mode) : null;
  const state = directive.state;
  const summary = directive.lockTempo ? tr.rdyBreach(scorePct) : directive.lockHiit ? tr.rdyStrain(scorePct) : null;

  return (
    <div className={`bbf-rdy is-${state}`} data-testid="cardio-cns-telemetry">
      <div className="bbf-rdy__top">
        <span className="bbf-rdy__kicker">{tr.rdyKicker}</span>
        {modeLabel ? <span className={`bbf-rdy__mode is-${state}`}>{modeLabel}</span> : null}
        {directive.lockHiit || directive.lockTempo ? <span className="bbf-rdy__lock">{tr.rdyLocked}</span> : null}
      </div>

      <div className="bbf-rdy__gauges">
        <div className="bbf-rdy__gauge">
          <div className="bbf-rdy__gauge-top">
            <span className="bbf-rdy__gauge-lbl">{tr.rdyScore}</span>
            <span className="bbf-rdy__gauge-val">{scorePct === null ? '—' : `${scorePct}/100`}</span>
          </div>
          <div className="bbf-rdy__track">
            <div className="bbf-rdy__fill is-score" style={{ width: `${scorePct ?? 0}%` }} />
          </div>
        </div>
        <div className="bbf-rdy__gauge">
          <div className="bbf-rdy__gauge-top">
            <span className="bbf-rdy__gauge-lbl">{tr.rdyHrv}</span>
            <span className="bbf-rdy__gauge-val">
              {hrvPct === null ? '—' : `${hrvPct}%`}
              {Number.isFinite(base) && base > 0 ? <small> · {tr.rdyBaseline(Math.round(base))}</small> : null}
            </span>
          </div>
          <div className="bbf-rdy__track">
            <div className="bbf-rdy__fill is-hrv" style={{ width: `${Math.min(100, ((hrvPct ?? 0) / 130) * 100)}%` }} />
            <span className="bbf-rdy__tick" style={{ left: `${(100 / 130) * 100}%` }} aria-hidden="true" />
          </div>
        </div>
        <div className="bbf-rdy__gauge">
          <div className="bbf-rdy__gauge-top">
            <span className="bbf-rdy__gauge-lbl">{tr.rdySleep}</span>
            <span className="bbf-rdy__gauge-val">
              {Number.isFinite(sleep)
                ? tr.rdySleepVal(Math.floor(sleep / 60), Math.round(sleep % 60))
                : '—'}
            </span>
          </div>
          <div className="bbf-rdy__track">
            <div className="bbf-rdy__fill is-sleep" style={{ width: `${sleepPct ?? 0}%` }} />
          </div>
        </div>
      </div>

      {summary ? (
        <div className="bbf-rdy__summary" role="status" data-testid="cardio-cns-summary">
          {summary}
          {redirected ? <> {tr.rdyRedirect(zoneLabel)}</> : null}
        </div>
      ) : null}
    </div>
  );
}

// ── Pacer countdown timer — the active-session block clock + controls ─────────
// Counts the session down from `duration` minutes. LAUNCH PACER toggles the run;
// RESET BLOCK returns to the top. Pure: a single monotonic `elapsed` counter.
function PacerTimer({ duration, crp, pacing, zoneLabel }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  const total = Math.max(1, duration) * 60; // seconds
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running) return undefined;
    // Tick once a second; stop the run when we hit the finish line. The stop
    // lives inside the timer callback (not the effect body) to stay pure.
    const id = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        if (next >= total) { setRunning(false); return total; }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, total]);

  const remaining = Math.max(0, total - elapsed);
  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const burnRatio = Math.round(crp.kcal / Math.max(1, duration));

  function reset() { setRunning(false); setElapsed(0); }

  return (
    <div className="bbf-pacer" style={{ '--pacer-accent': pacing.accent }}>
      <div className="bbf-pacer__dial">
        <div className="bbf-pacer__ring" aria-hidden="true" />
        <div className="bbf-pacer__time">
          <span className="bbf-pacer__time-kicker">{tr.timeBlock}</span>
          <span className="bbf-pacer__clock" role="timer" aria-label={tr.timeRemaining}>{pad(mm)}:{pad(ss)}</span>
          <span className="bbf-pacer__elapsed">{tr.elapsed} · {pad(Math.floor(elapsed / 60))}:{pad(elapsed % 60)}</span>
        </div>
      </div>

      <div className="bbf-pacer__stats">
        <div className="bbf-pacer__stat">
          <span className="bbf-pacer__stat-val">🔥 {crp.bpm}<span className="bbf-pacer__stat-unit">{tr.bpm}</span></span>
          <span className="bbf-pacer__stat-lbl">{tr.targetPulse}</span>
        </div>
        <div className="bbf-pacer__stat">
          <span className="bbf-pacer__stat-val">{burnRatio}<span className="bbf-pacer__stat-unit">{tr.cpm}</span></span>
          <span className="bbf-pacer__stat-lbl">{tr.burnRatio}</span>
        </div>
        <div className="bbf-pacer__stat">
          <span className="bbf-pacer__stat-val">{zoneLabel || pacing.zone}</span>
          <span className="bbf-pacer__stat-lbl">{tr.effortState}</span>
        </div>
      </div>

      <div className="bbf-pacer__controls">
        <button type="button" className="bbf-pacer__launch" onClick={() => setRunning((r) => !r)}>
          {running ? tr.pausePacer : tr.launchPacer}
        </button>
        <button type="button" className="bbf-pacer__reset" onClick={reset}>{tr.resetBlock}</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveProtocol — bbf-agentic-cardio result. Carries the cardio-gen-* QA contract.
// (Preserved verbatim from the engine; it IS the Metabolic Timeline Breakdown.)
// ─────────────────────────────────────────────────────────────────────────────
const LIVE_PHASE = {
  warmup: { accent: '#F5CF60', label: '◐ Warm-Up', o2: 45 },
  work: { accent: '#FF4500', label: '▲ Work', o2: 88 },
  recovery: { accent: '#22c55e', label: '◡ Recovery', o2: 60 },
  steady: { accent: '#9D27C9', label: '■ Steady', o2: 72 },
  cooldown: { accent: '#8b1abf', label: '◑ Cool-Down', o2: 38 },
};
function livePhase(p) { return LIVE_PHASE[p] || { accent: '#FF4500', label: p, o2: 70 }; }

function LiveProtocol({ plan }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  const PHL = PHASE_LABELS[lang] || PHASE_LABELS.en;
  const cns = plan.cns_downregulation || {};
  const modality = plan.modality || {};
  const roi = plan.roi || {};
  const steps = Array.isArray(plan.protocol_steps) ? plan.protocol_steps : [];
  // The modality badge must reflect the EFFECTIVE (possibly down-regulated) tier.
  const tier = modality.tier || cns.effective_tier || '';

  return (
    <div className="bbf-gps__result">
      <div className="bbf-gps__modality">
        <span className="bbf-gps__modality-label" data-testid="cardio-gen-modality" data-tier={tier}>
          {modality.label || modality.machine || tier}
        </span>
        {plan.available_minutes ? <span className="bbf-gps__modality-mins">{plan.available_minutes} min</span> : null}
      </div>
      {modality.strategy ? <div className="bbf-gps__strategy">{modality.strategy}</div> : null}

      {cns.down_regulated ? (
        <div className="bbf-gps__cns" role="status"
          data-testid="cardio-gen-softened"
          data-base-tier={cns.base_tier} data-effective-tier={cns.effective_tier}>
          <div className="bbf-gps__cns-top">
            <span className="bbf-gps__cns-icon" aria-hidden="true">🛡</span>
            <span className="bbf-gps__cns-title">{tr.cnsTitle}</span>
            {Number.isFinite(Number(cns.score)) ? <span className="bbf-gps__cns-score">{tr.cnsFatigue(cns.score)}</span> : null}
          </div>
          <div className="bbf-gps__cns-body">
            {tr.cnsBody(cns.base_tier, cns.effective_tier)}
          </div>
        </div>
      ) : null}

      <div className="bbf-gps__grid-h">{tr.timeline}</div>
      <div className="bbf-gps__grid" role="list">
        {steps.map((s, i) => {
          const pm = livePhase(s.phase);
          const dur = Math.max(0, (Number(s.end_min) || 0) - (Number(s.start_min) || 0));
          return (
            <div key={i} className="bbf-gps__step" role="listitem"
              data-testid="cardio-gen-step" data-phase={s.phase} data-zone={tier}
              style={{ '--phase-accent': pm.accent }}>
              <div className="bbf-gps__step-time" data-testid="cardio-gen-step-time">
                <span className="bbf-gps__step-range">{pad(s.start_min)}–{pad(s.end_min)}</span>
                <span className="bbf-gps__step-dur">{tr.o2(dur, pm.o2)}</span>
              </div>
              <div className="bbf-gps__step-main">
                <span className="bbf-gps__step-phase">{PHL[s.phase] || pm.label}</span>
                <span className="bbf-gps__step-label" data-testid="cardio-gen-step-label">{s.label}</span>
                {s.target ? <span className="bbf-gps__step-target" data-testid="cardio-gen-step-target">{s.target}</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      {roi.toast ? (
        <div className="bbf-gps__toast">
          <div className="bbf-gps__toast-glow" aria-hidden="true" />
          <div className="bbf-gps__toast-body">
            <div className="bbf-gps__toast-kicker">{tr.sovToast}</div>
            <div className="bbf-gps__toast-headline" data-testid="cardio-gen-roi-toast">{roi.toast}</div>
            {roi.detail ? <div className="bbf-gps__toast-detail">{roi.detail}</div> : null}
            {roi.primary_metric ? (
              <div className="bbf-gps__toast-metric">
                <span className="bbf-gps__toast-metric-lbl">{tr.primaryRoi}</span>
                <span className="bbf-gps__toast-metric-val" data-testid="cardio-gen-roi-metric">{roi.primary_metric}</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {plan.meta?.source === 'fallback' ? (
        <div className="bbf-gps__fallback">{tr.fallback}</div>
      ) : null}
    </div>
  );
}

// Rate-limit toast — clean, auto-dismissing (8s), dismissible.
function RateLimitToast({ message, onClose }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  useEffect(() => {
    const id = setTimeout(onClose, 8000);
    return () => clearTimeout(id);
  }, [onClose]);
  return (
    <div className="bbf-toast" role="status" aria-live="polite" data-testid="cardio-rate-toast">
      <span className="bbf-toast__icon" aria-hidden="true">⏳</span>
      <div className="bbf-toast__body">
        <span className="bbf-toast__title">{tr.title}</span>
        <span className="bbf-toast__msg">{message}</span>
      </div>
      <button type="button" className="bbf-toast__close" onClick={onClose} aria-label="Dismiss">×</button>
    </div>
  );
}

// ── Dynamic CRP Formula card ─────────────────────────────────────────────────
function CRPFormulaCard({ crp, duration, apparatusLabel, zoneLabel }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  return (
    <div className="bbf-crp">
      <div className="bbf-crp__glow" aria-hidden="true" />
      <div className="bbf-crp__body">
        <div className="bbf-crp__kicker">{tr.crpKicker}</div>
        <div className="bbf-crp__formula" aria-label={tr.crpFormulaAria}>
          <span className="bbf-crp__term">CRP</span>
          <span className="bbf-crp__op">=</span>
          <span className="bbf-crp__frac">
            <span className="bbf-crp__num">{tr.crpNum}</span>
            <span className="bbf-crp__bar" />
            <span className="bbf-crp__den">{tr.crpDen}</span>
          </span>
        </div>
        <div className="bbf-crp__plug" aria-hidden="true">
          {duration} × {crp.intensity.toFixed(2)} × {crp.modalityFactor.toFixed(2)} ÷ {crp.efficiency.toFixed(2)}
        </div>
        <div className="bbf-crp__summary">
          {tr.crpSummary(apparatusLabel, duration, zoneLabel)}
        </div>
        <div className="bbf-crp__metrics">
          <div className="bbf-crp__metric bbf-crp__metric--hero">
            <span className="bbf-crp__metric-val">{crp.index}</span>
            <span className="bbf-crp__metric-lbl">{tr.crpIndex}</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.vo2}<span className="bbf-crp__metric-unit">%</span></span>
            <span className="bbf-crp__metric-lbl">{tr.crpVo2}</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.hr}</span>
            <span className="bbf-crp__metric-lbl">{tr.crpHr}</span>
          </div>
          <div className="bbf-crp__metric">
            <span className="bbf-crp__metric-val">{crp.kcal}<span className="bbf-crp__metric-unit">{tr.kcal}</span></span>
            <span className="bbf-crp__metric-lbl">{tr.crpBurn}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Respiratory Sync visual timer ────────────────────────────────────────────
// Drives a breath-pacer orb through inhale → hold → exhale, each step lasting the
// pacing tier's prescribed seconds. The whole state machine is derived purely from
// a single monotonic `elapsed` seconds counter (modulo the cycle length) — the
// only state updater is `e => e + 1`, which keeps it pure and StrictMode-safe. The
// orb scales via an inline CSS transition whose duration matches the active step,
// so the animation stays synced to the countdown. A 0-second step (no hold) is
// skipped.
function RespiratorySync({ breath, accent }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  const [inhale, hold, exhale] = breath;
  const steps = [
    { label: tr.inhale, secs: inhale, scale: 1, key: 'in' },
    ...(hold > 0 ? [{ label: tr.hold, secs: hold, scale: 1, key: 'hold' }] : []),
    { label: tr.exhale, secs: exhale, scale: 0.55, key: 'out' },
  ];
  const cycleSecs = steps.reduce((s, st) => s + st.secs, 0);

  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds since the current run began

  // 1-second tick — the sole, pure state update while running.
  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  // Derive the active step + its remaining seconds purely from `elapsed`.
  const tInCycle = cycleSecs ? elapsed % cycleSecs : 0;
  let acc = 0;
  let active = steps[0];
  let remaining = steps[0].secs;
  for (const st of steps) {
    if (tInCycle < acc + st.secs) {
      active = st;
      remaining = st.secs - (tInCycle - acc);
      break;
    }
    acc += st.secs;
  }

  function toggle() {
    if (running) {
      setRunning(false);
      return;
    }
    setElapsed(0); // (re)start from the top of the cycle
    setRunning(true);
  }

  return (
    <div className="bbf-resp" style={{ '--resp-accent': accent }}>
      <div className="bbf-resp__kicker">{tr.breathPacer}</div>
      <div className="bbf-resp__stage">
        <div
          className={`bbf-resp__orb${running ? ' is-running' : ''}`}
          style={{
            transform: `scale(${running ? active.scale : 0.78})`,
            transitionDuration: `${running ? active.secs : 0.4}s`,
          }}
          aria-hidden="true"
        >
          <span className="bbf-resp__count">{running ? remaining : '↺'}</span>
        </div>
      </div>
      <div className="bbf-resp__phase" role="status">
        {running ? active.label : tr.paused}
      </div>
      <div className="bbf-resp__pattern">
        {tr.pattern(inhale, hold, exhale)}
        <span className="bbf-resp__cycle">{tr.cycle(cycleSecs)}</span>
      </div>
      <button type="button" className="bbf-resp__btn" onClick={toggle}>
        {running ? tr.pausePacer2 : tr.startPacer}
      </button>
    </div>
  );
}

function ActiveProtocols({ protocols }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  return (
    <section>
      <h3 className="bbf-cardio__section-h">{tr.activeProtocols}</h3>
      {protocols.length === 0 ? (
        <div className="bbf-cardio__empty" data-testid="cardio-empty">
          {tr.noProtocol}
        </div>
      ) : (
        <div className="bbf-cardio__protocols">
          {protocols.map((p) => {
            const z = zoneMeta(p.zone);
            return (
              <article key={p.id} className="bbf-cardio__protocol" data-testid="cardio-protocol" data-zone={p.zone}>
                <div className="bbf-cardio__protocol-top">
                  <span className="bbf-cardio__protocol-title" data-testid="cardio-protocol-title">{p.title || z.label}</span>
                  <span className="bbf-cardio__pill" style={{ color: z.accent }} data-testid="cardio-protocol-zone">{z.label}</span>
                </div>
                <div className="bbf-cardio__targets">
                  <div className="bbf-cardio__target">
                    <span className="bbf-cardio__target-val" data-testid="cardio-protocol-duration">{p.target_duration_min}<span style={{ fontSize: '.9rem' }}> {tr.min}</span></span>
                    <span className="bbf-cardio__target-lbl">{tr.targetDuration}</span>
                  </div>
                  {p.intensity ? (
                    <div className="bbf-cardio__target">
                      <span className="bbf-cardio__target-val" style={{ fontSize: '1.2rem' }} data-testid="cardio-protocol-intensity">{p.intensity}</span>
                      <span className="bbf-cardio__target-lbl">{tr.intensity}</span>
                    </div>
                  ) : null}
                </div>
                {p.protocol_detail ? <div className="bbf-cardio__detail" data-testid="cardio-protocol-detail">{p.protocol_detail}</div> : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function History({ logs }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  return (
    <section>
      <h3 className="bbf-cardio__section-h">{tr.sessionHistory}</h3>
      {logs.length === 0 ? (
        <div className="bbf-cardio__empty">{tr.noSessions}</div>
      ) : (
        <div className="bbf-cardio__logs">
          {logs.map((l) => {
            const z = zoneMeta(l.zone);
            const meta = [l.intensity, l.avg_hr ? `${l.avg_hr} bpm` : null, l.notes].filter(Boolean).join(' · ');
            return (
              <div key={l.id} className="bbf-cardio__log" style={{ '--zone-accent': z.accent }} data-testid="cardio-log">
                <span className="bbf-cardio__log-date" data-testid="cardio-log-date">{fmtDate(l.session_date)}</span>
                <span className="bbf-cardio__log-main">
                  <span className="bbf-cardio__log-zone">{z.label}</span>
                  {meta ? <span className="bbf-cardio__log-meta">{meta}</span> : null}
                </span>
                <span className="bbf-cardio__log-dur" data-testid="cardio-log-duration">{l.duration_min}<span> min</span></span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function LogSession({ onLogged }) {
  const { lang } = useLang();
  const tr = CARDIO_STR[lang] || CARDIO_STR.en;
  const [zone, setZone] = useState('zone2');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState('');
  const [avgHr, setAvgHr] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'ok'|'err', text }

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const dur = parseInt(duration, 10);
    if (!dur || dur <= 0 || dur > 600) {
      setMsg({ kind: 'err', text: tr.errDur });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await logCardio({
        zone,
        duration_min: dur,
        intensity: intensity.trim() || undefined,
        avg_hr: avgHr.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setMsg({ kind: 'ok', text: tr.logged });
      setDuration(''); setIntensity(''); setAvgHr(''); setNotes('');
      onLogged?.();
    } catch (err) {
      setMsg({ kind: 'err', text: err?.message || tr.errLog });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3 className="bbf-cardio__section-h">{tr.logSession}</h3>
      <form className="bbf-cardio__logger" onSubmit={submit}>
        <div className="bbf-cardio__row">
          <div className="bbf-cardio__field">
            <label htmlFor="bc-zone">{tr.zone}</label>
            <select id="bc-zone" className="bbf-input" value={zone} disabled={busy} onChange={(e) => setZone(e.target.value)}>
              {Object.entries(CARDIO_ZONES).map(([id, z]) => <option key={id} value={id}>{z.label}</option>)}
            </select>
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-dur">{tr.durationMin}</label>
            <input id="bc-dur" className="bbf-input" type="number" inputMode="numeric" min="1" max="600"
              value={duration} disabled={busy} onChange={(e) => setDuration(e.target.value)} placeholder="40" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-int">{tr.intensity}</label>
            <input id="bc-int" className="bbf-input" type="text" value={intensity} disabled={busy}
              onChange={(e) => setIntensity(e.target.value)} placeholder="RPE 7 / 65-75% HRmax" />
          </div>
          <div className="bbf-cardio__field">
            <label htmlFor="bc-hr">{tr.avgHr}</label>
            <input id="bc-hr" className="bbf-input" type="number" inputMode="numeric" min="40" max="230"
              value={avgHr} disabled={busy} onChange={(e) => setAvgHr(e.target.value)} placeholder="142" />
          </div>
        </div>
        <div className="bbf-cardio__field" style={{ marginBottom: '.8rem' }}>
          <label htmlFor="bc-notes">{tr.notes}</label>
          <input id="bc-notes" className="bbf-input" type="text" value={notes} disabled={busy}
            onChange={(e) => setNotes(e.target.value)} placeholder={tr.phNotes} />
        </div>
        <div className="bbf-cardio__actions">
          <button type="submit" className="bbf-cardio__btn" disabled={busy}>{busy ? tr.logging : tr.logBtn}</button>
          {msg ? <span className={`bbf-cardio__msg bbf-cardio__msg--${msg.kind}`} role="status">{msg.text}</span> : null}
        </div>
      </form>
    </section>
  );
}
