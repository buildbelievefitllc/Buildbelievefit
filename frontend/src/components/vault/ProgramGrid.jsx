// src/components/vault/ProgramGrid.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.1 — The 7-Day Program Grid (React reconstruction of the legacy
// monolith's live workout view: RW() + RDW() in bbf-app.html).
// Phase 20 — Visual reconstruction: presentation moved to the scoped vault.css
// stylesheet (.pg-*) so we get :hover/:focus rings, expand/rise animations, and
// gym-floor mobile breakpoints that inline styles can't express.
// Phase 23 — THE AUTOREGULATED PROGRAMMING PIPELINE: the grid now intercepts the
// baseline workout block with the morning Client Hub check-in (useDailyReadiness
// → bbf_daily_protocols). Volume scaling, axial-load substitution, and prehab
// matrix injection are pure transforms in lib/autoRegulation.js; this component
// only renders the regulated day + the clinical banner explaining every change.
// With NO (or stale) telemetry the grid renders byte-identically to the
// unregulated baseline — missing data never punishes the athlete, and the
// vault-logging E2E contract stays untouched.
//
// Faithful to the legacy dense, clinical layout:
//   • .pg-daynav2                — compact Today-default day navigator
//   • .pg-dayhead                — purple-gradient day header (day · focus · cue)
//   • .pg-autoreg                — the Sovereign Auto-Regulation clinical banner
//   • .pg-inject                 — prehab warm-up / cooldown injection blocks
//   • .pg-ex / .pg-ex-head       — collapsible exercise cards (name · equip · sets×reps)
//   • set table                  — Reps | Weight | RPE | Log Set
//   • .pg-input.is-done          — inputs go green once filled
//   • autoreg hint               — server last-working-weight per slot (bbf_get_last_weights)
//   • isRest                     — rest/active-recovery card instead of exercises
//
// CATALOG STRICTNESS: every exercise rendered here comes verbatim from the
// authorized programData catalog (a port of the founder-audited `WP`) — and every
// AXIAL-LOAD SUBSTITUTE is a verbatim key of the VIDEO_MAP allow-list, so a
// swapped slot still resolves a form-demo video. This component never
// synthesizes movements.
//
// TRILINGUAL (Triangle State sweep): every UI string below routes through the
// module-local STR dictionaries (the established vault-content convention —
// MindsetEngine/SmartCardio/Program), keyed off the global LangContext language.
// EN values are byte-verbatim to the prior hardcoded copy so the vault-logging
// E2E selectors (placeholders 'reps'/'BW', 'Complete & Sync Day', '.pg-*'
// classes) stay green.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProgram } from './programData.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { localizeDay, localizeFocus } from '../../lib/trainingI18n.js';
import { exKey, useLastWeights, readDayEntries, writeDayEntry, syncSessionToCloud } from './programApi.js';
import { resolveVideoId } from './exerciseVideos.js';
import FormDemoPlayer from './FormDemoPlayer.jsx';
import { useDailyReadiness } from '../../lib/useDailyReadiness.js';
import { deriveVolumeDirective, applyAutoRegulation, selectPrehabInjects } from '../../lib/autoRegulation.js';
import { getPrehabCatalog } from './prehabProtocol.js';
import './vault.css';

// ── Trilingual UI chrome (EN byte-verbatim to the prior hardcoded copy) ───────
const STR = {
  en: {
    kickerToday: 'Today’s Protocol', kickerDay: 'Protocol Day',
    todayTag: '● Today', todayBtn: 'Today',
    prevDay: 'Previous day', nextDay: 'Next day', selectDay: 'Select training day',
    restOpt: ' · Rest',
    restTitle: 'Rest & Recover', restNote: 'Active recovery — stretch, hydrate, sleep.',
    exCount: (n) => `${n} exercise${n === 1 ? '' : 's'}`,
    setsByReps: (n, reps) => `${n} set${n === 1 ? '' : 's'} × ${reps}`,
    formDemo: 'Form demo', watchDemo: (name) => `Watch the form demo for ${name}`,
    prescribed: 'Prescribed', lastWeight: 'Last working weight', matchBeat: 'match or beat it',
    noHistory: '◯ No history yet — log a weight to start autoregulation',
    setN: (n) => `Set ${n}`, reps: 'Reps', weight: 'Weight',
    logSet: '✓ Log Set', logSetAria: (n) => `Log set ${n}`, edit: 'Edit', lb: 'lb', bw: 'BW',
    repsAria: (name, n) => `${name} set ${n} reps`,
    weightAria: (name, n) => `${name} set ${n} weight in pounds`,
    rpeAria: (name, n) => `${name} set ${n} RPE`,
    syncBtn: '☁ Complete & Sync Day', syncBusy: 'Syncing…', syncAgain: '✓ Synced — sync again',
    syncedMsg: (n) => `${n} set${n === 1 ? '' : 's'} saved to your cloud history.`,
    syncEmpty: 'Log a weight or reps first, then sync.',
    syncFail: 'Sync failed — your sets are still saved on this device.',
    // Sovereign Auto-Regulation banner
    arKicker: 'Sovereign Auto-Regulation',
    arScore: (s) => (s === null ? 'No readiness score' : `Readiness ${s}/100`),
    arFull: 'Prime clearance — full prescribed volume and target RPEs hold.',
    arAdaptive: 'Adaptive state — working sets scaled to 80% to bank recovery without losing the stimulus.',
    arBreach: 'System breach — volume sliced 50%, heavy axial training suspended. Today protects the spine and the CNS.',
    arVolume: (b, a) => `Working sets ${b} → ${a}`,
    arRpe: (cap) => `RPE capped at ${cap}`,
    arSwapTitle: 'Axial-load substitutions (CNS shield)',
    arSuspend: 'Heavy vertical loading is suspended for today — every axial compound is swapped to a joint-friendly, spine-supported alternative.',
    swapChip: (from) => `⇄ Swapped from ${from}`,
    setsChip: (b, a) => `Sets ${b} → ${a}`,
    modes: {
      PRIME_EXECUTION: 'Prime Execution', STANDARD_OPERATIONS: 'Standard Operations',
      SYSTEM_STRAIN: 'System Strain', SYSTEM_BREACH: 'System Breach',
      INSUFFICIENT_TELEMETRY: 'Insufficient Telemetry',
    },
    injWarm: 'Prehab Warm-Up Injection', injCool: 'Cooldown Mobility',
    injWhy: 'Low readiness — targeted drills injected from the prehab matrix.',
    injMeta: (sets, reps) => `${sets} × ${reps}`,
  },
  es: {
    kickerToday: 'Protocolo de Hoy', kickerDay: 'Día del Protocolo',
    todayTag: '● Hoy', todayBtn: 'Hoy',
    prevDay: 'Día anterior', nextDay: 'Día siguiente', selectDay: 'Selecciona el día de entrenamiento',
    restOpt: ' · Descanso',
    restTitle: 'Descansa y Recupera', restNote: 'Recuperación activa — estira, hidrátate, duerme.',
    exCount: (n) => `${n} ejercicio${n === 1 ? '' : 's'}`,
    setsByReps: (n, reps) => `${n} serie${n === 1 ? '' : 's'} × ${reps}`,
    formDemo: 'Demo de técnica', watchDemo: (name) => `Ver la demostración de técnica de ${name}`,
    prescribed: 'Prescrito', lastWeight: 'Último peso de trabajo', matchBeat: 'iguálalo o supéralo',
    noHistory: '◯ Sin historial aún — registra un peso para iniciar la autorregulación',
    setN: (n) => `Serie ${n}`, reps: 'Reps', weight: 'Peso',
    logSet: '✓ Registrar Serie', logSetAria: (n) => `Registrar serie ${n}`, edit: 'Editar', lb: 'lb', bw: 'PC',
    repsAria: (name, n) => `${name} serie ${n} repeticiones`,
    weightAria: (name, n) => `${name} serie ${n} peso en libras`,
    rpeAria: (name, n) => `${name} serie ${n} RPE`,
    syncBtn: '☁ Completar y Sincronizar Día', syncBusy: 'Sincronizando…', syncAgain: '✓ Sincronizado — sincronizar de nuevo',
    syncedMsg: (n) => `${n} serie${n === 1 ? '' : 's'} guardada${n === 1 ? '' : 's'} en tu historial en la nube.`,
    syncEmpty: 'Registra un peso o repeticiones primero, luego sincroniza.',
    syncFail: 'Falló la sincronización — tus series siguen guardadas en este dispositivo.',
    arKicker: 'Autorregulación Soberana',
    arScore: (s) => (s === null ? 'Sin puntaje de preparación' : `Preparación ${s}/100`),
    arFull: 'Autorización óptima — se mantienen el volumen prescrito completo y los RPE objetivo.',
    arAdaptive: 'Estado adaptativo — series de trabajo escaladas al 80% para acumular recuperación sin perder el estímulo.',
    arBreach: 'Brecha del sistema — volumen reducido 50%, entrenamiento axial pesado suspendido. Hoy se protege la columna y el SNC.',
    arVolume: (b, a) => `Series de trabajo ${b} → ${a}`,
    arRpe: (cap) => `RPE limitado a ${cap}`,
    arSwapTitle: 'Sustituciones de carga axial (escudo del SNC)',
    arSuspend: 'La carga vertical pesada queda suspendida hoy — cada compuesto axial se cambia por una alternativa amigable con las articulaciones y con apoyo para la columna.',
    swapChip: (from) => `⇄ Sustituido de ${from}`,
    setsChip: (b, a) => `Series ${b} → ${a}`,
    modes: {
      PRIME_EXECUTION: 'Ejecución Óptima', STANDARD_OPERATIONS: 'Operación Estándar',
      SYSTEM_STRAIN: 'Sistema en Tensión', SYSTEM_BREACH: 'Brecha del Sistema',
      INSUFFICIENT_TELEMETRY: 'Telemetría Insuficiente',
    },
    injWarm: 'Inyección de Pre-Hab en Calentamiento', injCool: 'Movilidad de Enfriamiento',
    injWhy: 'Preparación baja — ejercicios dirigidos inyectados desde la matriz de pre-hab.',
    injMeta: (sets, reps) => `${sets} × ${reps}`,
  },
  pt: {
    kickerToday: 'Protocolo de Hoje', kickerDay: 'Dia do Protocolo',
    todayTag: '● Hoje', todayBtn: 'Hoje',
    prevDay: 'Dia anterior', nextDay: 'Próximo dia', selectDay: 'Selecione o dia de treino',
    restOpt: ' · Descanso',
    restTitle: 'Descanse e Recupere', restNote: 'Recuperação ativa — alongue, hidrate, durma.',
    exCount: (n) => `${n} exercício${n === 1 ? '' : 's'}`,
    setsByReps: (n, reps) => `${n} série${n === 1 ? '' : 's'} × ${reps}`,
    formDemo: 'Demo de técnica', watchDemo: (name) => `Assistir à demonstração de técnica de ${name}`,
    prescribed: 'Prescrito', lastWeight: 'Último peso de trabalho', matchBeat: 'iguale ou supere',
    noHistory: '◯ Sem histórico ainda — registre um peso para iniciar a autorregulação',
    setN: (n) => `Série ${n}`, reps: 'Reps', weight: 'Peso',
    logSet: '✓ Registrar Série', logSetAria: (n) => `Registrar série ${n}`, edit: 'Editar', lb: 'lb', bw: 'PC',
    repsAria: (name, n) => `${name} série ${n} repetições`,
    weightAria: (name, n) => `${name} série ${n} peso em libras`,
    rpeAria: (name, n) => `${name} série ${n} RPE`,
    syncBtn: '☁ Concluir e Sincronizar Dia', syncBusy: 'Sincronizando…', syncAgain: '✓ Sincronizado — sincronizar novamente',
    syncedMsg: (n) => `${n} série${n === 1 ? '' : 's'} salva${n === 1 ? '' : 's'} no seu histórico na nuvem.`,
    syncEmpty: 'Registre um peso ou repetições primeiro, depois sincronize.',
    syncFail: 'Falha na sincronização — suas séries continuam salvas neste dispositivo.',
    arKicker: 'Autorregulação Soberana',
    arScore: (s) => (s === null ? 'Sem pontuação de prontidão' : `Prontidão ${s}/100`),
    arFull: 'Liberação máxima — o volume prescrito completo e os RPEs alvo se mantêm.',
    arAdaptive: 'Estado adaptativo — séries de trabalho escaladas para 80% para acumular recuperação sem perder o estímulo.',
    arBreach: 'Violação do sistema — volume cortado em 50%, treino axial pesado suspenso. Hoje protege a coluna e o SNC.',
    arVolume: (b, a) => `Séries de trabalho ${b} → ${a}`,
    arRpe: (cap) => `RPE limitado a ${cap}`,
    arSwapTitle: 'Substituições de carga axial (escudo do SNC)',
    arSuspend: 'A carga vertical pesada está suspensa hoje — cada composto axial é trocado por uma alternativa amigável às articulações e com apoio para a coluna.',
    swapChip: (from) => `⇄ Substituído de ${from}`,
    setsChip: (b, a) => `Séries ${b} → ${a}`,
    modes: {
      PRIME_EXECUTION: 'Execução Máxima', STANDARD_OPERATIONS: 'Operação Padrão',
      SYSTEM_STRAIN: 'Sistema em Tensão', SYSTEM_BREACH: 'Violação do Sistema',
      INSUFFICIENT_TELEMETRY: 'Telemetria Insuficiente',
    },
    injWarm: 'Injeção de Pré-Hab no Aquecimento', injCool: 'Mobilidade de Desaquecimento',
    injWhy: 'Prontidão baixa — exercícios direcionados injetados da matriz de pré-hab.',
    injMeta: (sets, reps) => `${sets} × ${reps}`,
  },
};

function useGridStr() {
  const { lang } = useLang();
  return { lang, tr: STR[lang] || STR.en };
}

// First trainable day (skip leading rest days) so the grid never opens on a
// blank rest card. Matches the spirit of the monolith's day-1 default.
function initialDayIndex(plan) {
  const i = plan.findIndex((d) => !d.isRest);
  return i === -1 ? 0 : i;
}

// "Today's Protocol" default. When the plan uses weekday names ("Monday"…) we snap
// to the real current weekday; otherwise (sequenced "Day N" plans, which carry no
// calendar weekday) we open on the first trainable day. Either way the grid lands on
// the day the athlete should execute now — no horizontal hunting.
function todayDayIndex(plan) {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const i = plan.findIndex((d) => String(d.day || '').trim().toLowerCase() === weekday);
  return i !== -1 ? i : initialDayIndex(plan);
}

// Prescribed working-load target for a dynamic-plan exercise. The AI engine
// emits this as "weight" (~85% 1RM for primary lifts); tolerate the other field
// names a plan could carry. Returns a trimmed display string ("135 lb",
// "Bodyweight") or '' when the plan prescribes no explicit load.
function prescribedWeight(ex) {
  const raw = ex?.weight ?? ex?.target_weight ?? ex?.targetWeight ?? ex?.load ?? '';
  return String(raw).trim();
}

// Numeric placeholder for the weight input, seeded from the prescribed load
// ("135 lb" → "135"). Empty for non-numeric loads ("Bodyweight") so the input
// keeps its generic prompt rather than a misleading number.
function weightPlaceholder(prescribed) {
  const m = String(prescribed).match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

export default function ProgramGrid({ uid, programKey, dynamicPlan }) {
  const { lang, tr } = useGridStr();
  // Prefer the user's assigned plan (structured AI payload) when present; fall
  // back to the authorized static catalog by persona. Either way the grid, the
  // per-set logging, and the form-demo video resolver work identically.
  const plan = useMemo(
    () => (Array.isArray(dynamicPlan) && dynamicPlan.length ? dynamicPlan : getProgram(programKey)),
    [dynamicPlan, programKey],
  );
  const todayIdx = useMemo(() => todayDayIndex(plan), [plan]);
  const [dayIdx, setDayIdx] = useState(todayIdx);
  const day = plan[dayIdx] || plan[0];

  // ── CNS telemetry → volume directive (the morning check-in's verdict) ──
  const { data: readiness } = useDailyReadiness();
  const directive = useMemo(
    () => deriveVolumeDirective({
      score: readiness?.score ?? null,
      mode: readiness?.mode ?? null,
      isSuppressed: readiness?.isSuppressed ?? false,
      hasData: readiness?.hasData ?? false,
    }),
    [readiness],
  );

  // The regulated day: pure transform; with state 'none'/'full' it returns the
  // baseline day object untouched (and the banner stays hidden).
  const regulated = useMemo(() => applyAutoRegulation(day, directive), [day, directive]);

  // Prehab matrix injection — localized catalog, deterministic per day focus.
  const injects = useMemo(() => {
    if (!directive.injectPrehab || day.isRest) return null;
    const catalog = getPrehabCatalog(lang);
    const picked = selectPrehabInjects(catalog?.PROTOCOLS, day.focus);
    return picked.warmup.length || picked.cooldown.length ? picked : null;
  }, [directive.injectPrehab, day, lang]);

  return (
    <div className="pg">
      {/* ── Compact day navigator (Today-default · ‹ Prev | dropdown | Next ›) ── */}
      <div className="pg-daynav2">
        <button
          type="button"
          className="pg-daynav-arrow"
          disabled={dayIdx <= 0}
          aria-label={tr.prevDay}
          onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
        >
          ‹
        </button>
        <div className="pg-daynav-center">
          <span className="pg-daynav-kicker">{dayIdx === todayIdx ? tr.kickerToday : tr.kickerDay}</span>
          <div className="pg-daynav-pickrow">
            <select
              className="pg-dayselect"
              value={dayIdx}
              aria-label={tr.selectDay}
              onChange={(e) => setDayIdx(Number(e.target.value))}
            >
              {plan.map((d, i) => (
                <option key={d.day + i} value={i}>
                  {localizeDay(d.day, lang)}{d.isRest ? tr.restOpt : d.focus ? ` · ${d.focus}` : ''}
                </option>
              ))}
            </select>
            {dayIdx === todayIdx
              ? <span className="pg-todaytag" aria-hidden="true">{tr.todayTag}</span>
              : <button type="button" className="pg-todaybtn" onClick={() => setDayIdx(todayIdx)}>{tr.todayBtn}</button>}
          </div>
        </div>
        <button
          type="button"
          className="pg-daynav-arrow"
          disabled={dayIdx >= plan.length - 1}
          aria-label={tr.nextDay}
          onClick={() => setDayIdx((i) => Math.min(plan.length - 1, i + 1))}
        >
          ›
        </button>
      </div>

      {/* ── Day body — rest card or the regulated exercise list ──────────── */}
      {day.isRest
        ? <RestCard day={day} tr={tr} />
        : (
          <DayView
            key={dayIdx}
            uid={uid}
            day={regulated.day}
            dayIdx={dayIdx}
            regulated={regulated}
            directive={directive}
            readiness={readiness}
            injects={injects}
            tr={tr}
          />
        )}
    </div>
  );
}

function RestCard({ day, tr }) {
  const { lang } = useLang();
  return (
    <div className="pg-dayhead">
      <div className="pg-day-kicker">{localizeDay(day.day, lang)}</div>
      <div className="pg-rest">
        <div className="pg-rest-icon" aria-hidden="true">😴</div>
        <div className="pg-rest-title">{day.focus || tr.restTitle}</div>
        <div className="pg-rest-sub">
          {day.restNote || tr.restNote}
        </div>
      </div>
    </div>
  );
}

// ── The clinical auto-regulation banner — WHY today's protocol was altered ────
function AutoRegBanner({ regulated, directive, readiness, tr }) {
  if (!directive || directive.state === 'none') return null;
  const state = directive.state;
  const summary = state === 'breach' ? tr.arBreach : state === 'adaptive' ? tr.arAdaptive : tr.arFull;
  const modeLabel = readiness?.mode ? (tr.modes[readiness.mode] || readiness.mode) : null;

  return (
    <div className={`pg-autoreg is-${state}`} role="status" data-testid="pg-autoreg">
      <div className="pg-autoreg-top">
        <span className="pg-autoreg-kicker">{tr.arKicker}</span>
        <span className="pg-autoreg-score">{tr.arScore(readiness?.score ?? null)}</span>
        {modeLabel ? <span className="pg-autoreg-mode">{modeLabel}</span> : null}
      </div>
      <div className="pg-autoreg-body">{summary}</div>
      {regulated.modified || directive.rpeCap ? (
        <div className="pg-autoreg-chips">
          {regulated.setsAfter !== regulated.setsBefore ? (
            <span className="pg-autoreg-chip">{tr.arVolume(regulated.setsBefore, regulated.setsAfter)}</span>
          ) : null}
          {directive.rpeCap ? <span className="pg-autoreg-chip">{tr.arRpe(directive.rpeCap)}</span> : null}
        </div>
      ) : null}
      {regulated.swaps.length ? (
        <div className="pg-autoreg-swaps">
          <div className="pg-autoreg-swaps-title">{tr.arSwapTitle}</div>
          <ul>
            {regulated.swaps.map((s, i) => (
              <li key={i}>{s.from} → <strong>{s.to}</strong></li>
            ))}
          </ul>
          <div className="pg-autoreg-suspend">{tr.arSuspend}</div>
        </div>
      ) : null}
    </div>
  );
}

// ── Prehab injection block — real drills from the trilingual prehab catalog ───
function InjectBlock({ title, drills, why, tr }) {
  if (!drills || !drills.length) return null;
  return (
    <div className="pg-inject" data-testid="pg-inject">
      <div className="pg-inject-head">
        <span className="pg-inject-title">{title}</span>
        {why ? <span className="pg-inject-why">{why}</span> : null}
      </div>
      {drills.map((d) => (
        <div key={d.key} className="pg-inject-card">
          <div className="pg-inject-name">{d.name}</div>
          <div className="pg-inject-meta">{tr.injMeta(d.sets, d.reps)}{d.duration ? ` · ${d.duration}` : ''}</div>
          {Array.isArray(d.cues) && d.cues.length ? (
            <div className="pg-inject-cue">▸ {d.cues[0]}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function DayView({ uid, day, dayIdx, regulated, directive, readiness, injects, tr }) {
  const { lang } = useLang();
  const exercises = day.exercises || [];
  // Cloud-sync status for this day's session. Local buffer persists on every
  // keystroke regardless; this drives the explicit "push session" action.
  const [sync, setSync] = useState({ status: 'idle', msg: '' });
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const onSync = async () => {
    setSync({ status: 'syncing', msg: '' });
    try {
      const res = await syncSessionToCloud(uid, dayIdx);
      if (res.ok) {
        setSync({ status: 'synced', msg: tr.syncedMsg(res.count) });
      } else {
        setSync({ status: 'idle', msg: tr.syncEmpty });
      }
    } catch (e) {
      // Expired/missing vault token → clear the stale session and route back to
      // the PIN screen to mint a fresh one. The local set buffer is untouched,
      // so re-syncing after re-login pushes the same sets — nothing is lost.
      if (e?.code === 'SESSION_EXPIRED') {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      // Any other failure — local buffer is intact; the athlete can retry.
      setSync({ status: 'error', msg: e.message || tr.syncFail });
    }
  };

  return (
    <div>
      <header className="pg-dayhead">
        <div className="pg-day-kicker">{localizeDay(day.day, lang)}</div>
        <div className="pg-day-focus">{localizeFocus(day.focus, lang)}</div>
        <div className="pg-day-meta">
          {tr.exCount(exercises.length)}
          {day.focus_cue ? ` · 🎯 ${day.focus_cue}` : ''}
        </div>
      </header>

      {/* The clinical banner — renders ONLY when telemetry actually regulates. */}
      <AutoRegBanner regulated={regulated} directive={directive} readiness={readiness} tr={tr} />

      {/* Prehab matrix → warm-up injection (2 drills, localized catalog). */}
      {injects ? <InjectBlock title={tr.injWarm} drills={injects.warmup} why={tr.injWhy} tr={tr} /> : null}

      {exercises.map((ex, i) => (
        <ExerciseCard key={ex.name + i} uid={uid} dayIdx={dayIdx} index={i} ex={ex} rpeCap={directive.rpeCap} tr={tr} />
      ))}

      {/* Prehab matrix → cooldown injection (1 drill). */}
      {injects ? <InjectBlock title={tr.injCool} drills={injects.cooldown} why={null} tr={tr} /> : null}

      <div className="pg-syncbar">
        <button
          type="button"
          className={`pg-syncbtn${sync.status === 'syncing' ? ' is-busy' : ''}`}
          onClick={onSync}
          disabled={sync.status === 'syncing'}
        >
          {sync.status === 'syncing' ? tr.syncBusy : sync.status === 'synced' ? tr.syncAgain : tr.syncBtn}
        </button>
        {sync.msg ? (
          <div className={`pg-syncmsg${sync.status === 'error' ? ' is-error' : sync.status === 'synced' ? ' is-synced' : ''}`}>
            {sync.msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ExerciseCard({ uid, dayIdx, index, ex, rpeCap, tr }) {
  const { lang } = useLang();
  const [open, setOpen] = useState(index === 0); // first card open, like the legacy default
  // Server last-working-weights for this day (cross-device autoregulation target).
  const { weights } = useLastWeights(uid, dayIdx);
  // Local per-set entries for today, seeded once from localStorage.
  const [entries, setEntries] = useState(() => readDayEntries(uid, dayIdx)[exKey(index)] || []);

  const setCount = Number(ex.sets) > 0 ? Number(ex.sets) : 1;
  const lastWeight = weights?.[exKey(index)];
  // Coach-prescribed target load from the athlete's assigned plan. When present
  // it pre-fills the grid (target chip + two-line target cell) so the athlete
  // opens to real numbers, not a blank canvas.
  const target = prescribedWeight(ex);
  // ── Pre-fill engine ─────────────────────────────────────────────────────────
  // Smart defaults land as PLACEHOLDERS, never the controlled `value` — the
  // state-safe contract (override-friendly; sync only pushes real entries).
  // NOTE: 'reps' / 'BW' placeholders are notation, deliberately language-
  // invariant (and pinned by the vault-logging E2E getByPlaceholder selectors).
  const repPlaceholder = ex.reps != null && String(ex.reps).trim() !== '' ? String(ex.reps) : 'reps';
  const wPlaceholder = lastWeight != null ? `${lastWeight}` : (weightPlaceholder(target) || 'BW');
  // Hardwired form-demo video for this movement (fuzzy-resolved against the
  // authorized video map), localized to the active language with EN fallback.
  // A substituted movement resolves too — every substitute is a VIDEO_MAP key.
  const videoId = resolveVideoId(ex.name, lang);
  // Auto-regulation provenance for this slot (set by applyAutoRegulation).
  const auto = ex._autoreg || null;

  const onField = (setIdx, field, value) => {
    writeDayEntry(uid, dayIdx, exKey(index), setIdx, field, value);
    setEntries((prev) => {
      const next = prev.slice();
      const row = { ...(next[setIdx] || {}) };
      if (value === '' || value == null) delete row[field];
      else row[field] = value;
      next[setIdx] = row;
      return next;
    });
  };

  // Log Set → mark the set complete (collapses to a green summary). An untouched
  // RPE slider defaults to 7 — or the auto-regulation cap when today is capped
  // below that — so a logged set always carries a perceived-exertion value.
  const logSet = (setIdx) => {
    const cur = entries[setIdx] || {};
    if (cur.rpe == null || cur.rpe === '') {
      onField(setIdx, 'rpe', String(rpeCap ? Math.min(7, rpeCap) : 7));
    }
    onField(setIdx, 'done', 'true');
  };

  return (
    <div className={`pg-ex${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pg-ex-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="pg-ex-main">
          <span className="pg-ex-name">{ex.name}</span>
          <span className="pg-ex-sub">{ex.equipment} · {tr.setsByReps(setCount, ex.reps)}</span>
          {auto?.swappedFrom || auto?.setsFrom ? (
            <span className="pg-ex-autoreg">
              {auto.swappedFrom ? <span className="pg-swap-chip">{tr.swapChip(auto.swappedFrom)}</span> : null}
              {auto.setsFrom ? <span className="pg-sets-chip">{tr.setsChip(auto.setsFrom, setCount)}</span> : null}
            </span>
          ) : null}
        </span>
        <span className="pg-ex-chevron" aria-hidden="true">▼</span>
      </button>

      {open ? (
        <div className="pg-ex-body">
          {/* Form-demo video — tap-to-play INLINE embed inside the execution
              card (session retention: the athlete never leaves the app). Only
              rendered when the movement resolves to a mapped video. */}
          {videoId ? (
            <FormDemoPlayer videoId={videoId} title={tr.watchDemo(ex.name)} label={tr.formDemo} />
          ) : null}

          {/* Coach-prescribed target — reps × prescribed load from the assigned
              plan. Always rendered when the plan carries a load, so the athlete
              sees their pre-filled numbers even with no logged history yet. */}
          {target ? (
            <div className="pg-target is-prescribed">
              🎯 <strong>{tr.prescribed}</strong> {setCount} × {ex.reps} @ <strong>{target}</strong>
            </div>
          ) : null}

          {/* Autoregulation target — the server's last working weight for this slot. */}
          <div className={`pg-target ${lastWeight ? 'is-active' : 'is-none'}`}>
            {lastWeight ? (
              <>↑ <strong>{tr.lastWeight}</strong> <strong>{lastWeight} {tr.lb}</strong> · {tr.matchBeat}</>
            ) : (
              <>{tr.noHistory}</>
            )}
          </div>

          {ex.notes ? <div className="pg-note">💡 {ex.notes}</div> : null}

          {/* ── Per-set logbook — Weight (BW default) · RPE · Log Set. A logged set
              collapses to a green summary; Edit re-opens it. Reps + weight keep the
              .pg-input / is-done contract (green-on-fill) the autoreg sync reads. ── */}
          <div className="pg-logsets">
            {Array.from({ length: setCount }).map((_, s) => {
              const row = entries[s] || {};
              const rVal = row.r ?? '';
              const wVal = row.w ?? '';
              const rpeVal = row.rpe ?? '';
              const done = row.done === true || row.done === 'true';

              if (done) {
                return (
                  <div className="pg-logset is-done" key={s}>
                    <span className="pg-logset-check" aria-hidden="true">✓</span>
                    <span className="pg-logset-summary">
                      <strong>{tr.setN(s + 1)}</strong> — {wVal !== '' ? `${wVal} ${tr.lb}` : tr.bw}
                      {rVal !== '' ? ` · ${rVal} ${tr.reps.toLowerCase()}` : ''}
                      {rpeVal !== '' ? ` · RPE ${rpeVal}` : ''}
                    </span>
                    <button type="button" className="pg-logset-edit" onClick={() => onField(s, 'done', '')}>
                      {tr.edit}
                    </button>
                  </div>
                );
              }

              return (
                <div className="pg-logset" key={s}>
                  <span className="pg-logset-num">{s + 1}</span>
                  <label className="pg-logfield">
                    <span className="pg-logfield-l">{tr.reps}</span>
                    <input
                      className={`pg-input${rVal !== '' ? ' is-done' : ''}`}
                      type="number" inputMode="numeric" min="0" step="1"
                      placeholder={repPlaceholder}
                      value={rVal}
                      onChange={(e) => onField(s, 'r', e.target.value)}
                      aria-label={tr.repsAria(ex.name, s + 1)}
                    />
                  </label>
                  <label className="pg-logfield">
                    <span className="pg-logfield-l">{tr.weight}</span>
                    <input
                      className={`pg-input${wVal !== '' ? ' is-done' : ''}`}
                      type="number" inputMode="decimal" min="0" step="0.5"
                      placeholder={wPlaceholder}
                      value={wVal}
                      onChange={(e) => onField(s, 'w', e.target.value)}
                      aria-label={tr.weightAria(ex.name, s + 1)}
                    />
                  </label>
                  <label className="pg-logfield pg-logfield-rpe">
                    <span className="pg-logfield-l">RPE <b className={rpeToneClass(rpeVal, rpeCap)}>{rpeVal === '' ? '—' : rpeVal}</b><small className="pg-logfield-cap"> / 10</small></span>
                    <input
                      className="pg-rpe-range"
                      type="range" min="1" max="10" step="0.5"
                      value={rpeVal === '' ? 7 : rpeVal}
                      onChange={(e) => onField(s, 'rpe', e.target.value)}
                      aria-label={tr.rpeAria(ex.name, s + 1)}
                    />
                  </label>
                  <button type="button" className="pg-logbtn" onClick={() => logSet(s)} aria-label={tr.logSetAria(s + 1)}>
                    {tr.logSet}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// RPE tone — green comfortable · gold working · red at/over the Referee's 8.5
// gate. A day-level auto-regulation cap tightens the red line to the cap itself.
function rpeToneClass(v, rpeCap) {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '';
  const redLine = rpeCap ? rpeCap : 9;
  if (n >= redLine) return 'is-max';
  if (n >= 7) return 'is-hot';
  return 'is-ok';
}
