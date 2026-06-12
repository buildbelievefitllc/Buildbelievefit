// src/components/vault/Generator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Program Generator (Vault tab) — the Vault Roster Engine. React reconstruction of
// the legacy BBF_PROGRAM_GENERATOR studio surface, locked to the definitive UI blueprint:
//
//   • AKEEM'S SIGNATURE CHAMBER SPLITS (Overwatch Override) — 3 hard-wired chambers
//     (I · Arnold Era Classic, II · FST-7 Fascia Expand, III · Elite NASM Clinical).
//     One tap loads a coherent parameter envelope.
//   • 8 SIGNATURE SELECTORS: Training Priority · Athletic Gender Focus · Experience
//     Level · Destination Equip Priority · Weekly Frequency · Workout Pace Target ·
//     Splits Architecture · Intensifier Technique.
//   • ATTACH WARM-UPS & COOL-DOWNS toggle — prepends a dynamic prep block and appends
//     a decompression block to every training day.
//
// Output is a deterministic split built STRICTLY from the locked library, every
// movement carrying a hardwired form-demo video. Blacklisted lifts (barbell back
// squat, abdominal crunches) can never appear — enforced in the engine.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import {
  generateProgram, toAssignedPlan,
  GOALS, GENDERS, LEVELS, LOCATIONS, DAY_OPTIONS, PACES, SPLITS, INTENSIFIERS, PRESETS,
} from './generatorEngine.js';
import { resolveVideoId } from './exerciseVideos.js';
import FormDemoPlayer from './FormDemoPlayer.jsx';
import { localizeMuscle } from '../../lib/trainingI18n.js';
import { fetchRoster, assignWorkout, toErrorMessage } from '../../lib/rosterApi.js';
import './vault.css';

// Trilingual UI chrome for the Vault Roster Engine. The signature-split preset
// content and the dropdown option values are engine data (generatorEngine.js) and
// stay as authored; this dictionary covers the surface's own headers, field
// labels, buttons, and status copy. EN values are verbatim to the prior strings.
const STR = {
  en: {
    head: '⚡ Vault Roster Engine',
    meta: 'Signature chamber splits · 8-parameter control · built strictly from the locked BBF library. Every lift ships a form demo.',
    chamberTitle: 'Akeem’s Signature Chamber Splits',
    chamberTag: '(Overwatch Override)',
    chamberSub: 'Pledge dynamic pre-compiled splits modeled directly on Akeem’s golden-era protocols. Zero AI waiting, maximum immediate cell recruitment.',
    chamberAria: 'Signature chamber splits',
    activate: 'Activate Split →',
    daysPerWeek: (v) => `${v} Days / Week`,
    attach: 'Attach Warm-Ups & Cool-Downs',
    genUnlimited: 'Generate Designed Program Blueprint',
    genToken: 'Generate Blueprint (1 Token Available)',
    genExhausted: 'Token Exhausted (Unlocks in 30 Days)',
    reshuffle: '↻ Reshuffle',
    revert: 'Out of tokens? Revert to your Saved Program Library →',
    guard: '🔒 Contraindicated movements (barbell back squat · abdominal crunches) are auto-excluded.',
    placeholder: 'Activate a signature chamber split or set your 8 parameters, then generate a fresh, video-backed program.',
    noMatch: 'No exercises matched those parameters — try a different equipment profile or architecture.',
    day: 'Day',
    warmup: 'Warm-Up',
    cooldown: 'Cool-Down',
    rest: 'Rest / Active Recovery',
    restLbl: 'rest',
    formDemo: (n) => `Form demo: ${n}`,
    fields: {
      goal: 'Training Priority', gender: 'Athletic Gender Focus', level: 'Experience Level',
      loc: 'Destination Equip Priority', days: 'Weekly Frequency', dur: 'Workout Pace Target',
      arch: 'Splits Architecture', intensifier: 'Intensifier Technique',
    },
  },
  es: {
    head: '⚡ Motor de Roster del Cofre',
    meta: 'Splits de cámara insignia · control de 8 parámetros · construidos estrictamente desde la biblioteca BBF bloqueada. Cada ejercicio incluye demo de técnica.',
    chamberTitle: 'Splits de Cámara Insignia de Akeem',
    chamberTag: '(Anulación Overwatch)',
    chamberSub: 'Despliega splits pre-compilados dinámicos modelados directamente en los protocolos de la era dorada de Akeem. Cero espera de IA, máximo reclutamiento celular inmediato.',
    chamberAria: 'Splits de cámara insignia',
    activate: 'Activar Split →',
    daysPerWeek: (v) => `${v} Días / Semana`,
    attach: 'Adjuntar Calentamientos y Enfriamientos',
    genUnlimited: 'Generar Plan de Programa Diseñado',
    genToken: 'Generar Plan (1 Token Disponible)',
    genExhausted: 'Token Agotado (Se Desbloquea en 30 Días)',
    reshuffle: '↻ Rebarajar',
    revert: '¿Sin tokens? Vuelve a tu Biblioteca de Programas Guardados →',
    guard: '🔒 Los movimientos contraindicados (sentadilla con barra trasera · abdominales crunch) se excluyen automáticamente.',
    placeholder: 'Activa un split de cámara insignia o ajusta tus 8 parámetros, luego genera un programa nuevo respaldado por video.',
    noMatch: 'Ningún ejercicio coincidió con esos parámetros — prueba un perfil de equipo o arquitectura diferente.',
    day: 'Día',
    warmup: 'Calentamiento',
    cooldown: 'Enfriamiento',
    rest: 'Descanso / Recuperación Activa',
    restLbl: 'descanso',
    formDemo: (n) => `Demo de técnica: ${n}`,
    fields: {
      goal: 'Prioridad de Entrenamiento', gender: 'Enfoque de Género Atlético', level: 'Nivel de Experiencia',
      loc: 'Prioridad de Equipo de Destino', days: 'Frecuencia Semanal', dur: 'Objetivo de Ritmo de Entrenamiento',
      arch: 'Arquitectura de Splits', intensifier: 'Técnica Intensificadora',
    },
  },
  pt: {
    head: '⚡ Motor de Roster do Cofre',
    meta: 'Splits de câmara assinatura · controle de 8 parâmetros · construídos estritamente a partir da biblioteca BBF bloqueada. Cada exercício inclui demo de técnica.',
    chamberTitle: 'Splits de Câmara Assinatura do Akeem',
    chamberTag: '(Substituição Overwatch)',
    chamberSub: 'Implante splits pré-compilados dinâmicos modelados diretamente nos protocolos da era de ouro do Akeem. Zero espera de IA, máximo recrutamento celular imediato.',
    chamberAria: 'Splits de câmara assinatura',
    activate: 'Ativar Split →',
    daysPerWeek: (v) => `${v} Dias / Semana`,
    attach: 'Anexar Aquecimentos e Desaquecimentos',
    genUnlimited: 'Gerar Plano de Programa Projetado',
    genToken: 'Gerar Plano (1 Token Disponível)',
    genExhausted: 'Token Esgotado (Desbloqueia em 30 Dias)',
    reshuffle: '↻ Reembaralhar',
    revert: 'Sem tokens? Volte à sua Biblioteca de Programas Salvos →',
    guard: '🔒 Movimentos contraindicados (agachamento com barra nas costas · abdominais crunch) são excluídos automaticamente.',
    placeholder: 'Ative um split de câmara assinatura ou ajuste seus 8 parâmetros, depois gere um programa novo com suporte de vídeo.',
    noMatch: 'Nenhum exercício correspondeu a esses parâmetros — tente um perfil de equipamento ou arquitetura diferente.',
    day: 'Dia',
    warmup: 'Aquecimento',
    cooldown: 'Desaquecimento',
    rest: 'Descanso / Recuperação Ativa',
    restLbl: 'descanso',
    formDemo: (n) => `Demo de técnica: ${n}`,
    fields: {
      goal: 'Prioridade de Treino', gender: 'Foco de Gênero Atlético', level: 'Nível de Experiência',
      loc: 'Prioridade de Equipamento de Destino', days: 'Frequência Semanal', dur: 'Alvo de Ritmo de Treino',
      arch: 'Arquitetura de Splits', intensifier: 'Técnica Intensificadora',
    },
  },
};

// Targeting i18n for the Command Center authoring surface (roster select + push).
// Kept as its own dictionary so the client-Vault token-economy strings above stay
// untouched; resolved by active lang with an EN fallback.
const ASSIGN_STR = {
  en: { head: '🎯 Roster Deployment Bay', sub: 'Target a live athlete, generate the blueprint, then push it straight to their program.', select: 'Select Athlete', placeholder: '— Select an athlete to target —', loading: 'Loading live roster…', error: 'Could not load the roster.', retry: 'Retry', push: '🚀 Push to Athlete', pushing: 'Pushing…', needResult: 'Generate a blueprint first, then push it.', needClient: 'Select an athlete to receive this program.', ok: (n) => `Program deployed — ${n} now holds this blueprint on their Program tab.` },
  es: { head: '🎯 Bahía de Despliegue del Roster', sub: 'Selecciona un atleta en vivo, genera el plan y envíalo directo a su programa.', select: 'Seleccionar Atleta', placeholder: '— Selecciona un atleta objetivo —', loading: 'Cargando roster en vivo…', error: 'No se pudo cargar el roster.', retry: 'Reintentar', push: '🚀 Enviar al Atleta', pushing: 'Enviando…', needResult: 'Genera un plan primero, luego envíalo.', needClient: 'Selecciona un atleta para recibir este programa.', ok: (n) => `Programa desplegado — ${n} ahora tiene este plan en su pestaña de Programa.` },
  pt: { head: '🎯 Baía de Implantação do Roster', sub: 'Selecione um atleta ao vivo, gere o plano e envie direto para o programa dele.', select: 'Selecionar Atleta', placeholder: '— Selecione um atleta alvo —', loading: 'Carregando roster ao vivo…', error: 'Não foi possível carregar o roster.', retry: 'Tentar novamente', push: '🚀 Enviar ao Atleta', pushing: 'Enviando…', needResult: 'Gere um plano primeiro, depois envie.', needClient: 'Selecione um atleta para receber este programa.', ok: (n) => `Programa implantado — ${n} agora tem este plano na aba Programa.` },
};

// ── Token Economy (client-side monetization gate · 1 blueprint token / month) ────
// The Vault Roster Engine is a metered premium surface. ADMINS on the Command Center
// route (`onCommandSurface`) run UNLIMITED — it is their authoring console. A standard
// CLIENT gets ONE generation per calendar month: every code path that calls
// generateProgram (manual generate, signature preset, reshuffle, warm-up re-toggle)
// spends that single token, after which the whole engine locks until the next month.
//
// The spend is persisted per-uid + period so a page reload can't mint a fresh token —
// this is the frontend mock of the meter; the authoritative ledger lands server-side
// when the Token Economy ships. Private-mode / quota failures degrade to in-state only.
const TOKEN_KEY = 'bbf_gen_token_v1';

// Calendar-month stamp (YYYY-M) — the unit the monthly token resets on.
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function tokenSpentThisPeriod(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
    return all?.[uid] === currentPeriod();
  } catch { return false; }
}

function spendToken(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
    all[uid] = currentPeriod();
    localStorage.setItem(TOKEN_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — the in-component state still locks the button */ }
}

// The 8 signature parameter selectors (exact Vault Roster Engine blueprint, in order).
const FIELDS = [
  { key: 'goal', label: 'Training Priority', options: GOALS },
  { key: 'gender', label: 'Athletic Gender Focus', options: GENDERS },
  { key: 'level', label: 'Experience Level', options: LEVELS },
  { key: 'loc', label: 'Destination Equip Priority', icon: '📍', options: LOCATIONS },
  { key: 'days', label: 'Weekly Frequency', options: DAY_OPTIONS.map((v) => ({ v, l: `${v} Days / Week` })) },
  { key: 'dur', label: 'Workout Pace Target', options: PACES },
  { key: 'arch', label: 'Splits Architecture', icon: '⚡', options: SPLITS },
  { key: 'intensifier', label: 'Intensifier Technique', icon: '🔥', options: INTENSIFIERS },
];

// Labels for any param value not present in its dropdown's option list — e.g. the
// Chamber II (FST-7) preset sets intensifier:'fst7', a signature preset rather than a
// standard Intensifier Technique. Rendering it keeps the <select> controlled & clear.
const EXTRA_OPTION_LABELS = { fst7: 'FST-7 Fascia Finisher' };

const DEFAULTS = {
  goal: 'hypertrophy', gender: 'any', level: '2', loc: 'any-home',
  days: '3', dur: '60', arch: 'full', intensifier: 'none',
};

// Roster-row identity + division label for the targeting dropdown (mirrors the
// NutritionLocker helpers so the two admin push surfaces read a client the same way).
const clientId = (c) => c?.id ?? c?.uid ?? c?.email ?? '';
const division = (c) => c?.metabolic_tier || c?.subscription_tier || c?.role || 'Sovereign Client';

export default function Generator({ onRevertToLibrary }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const at = ASSIGN_STR[lang] || ASSIGN_STR.en;
  const [params, setParams] = useState(DEFAULTS);
  const [warmups, setWarmups] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [result, setResult] = useState(null);
  const [regen, setRegen] = useState(0);

  // ── Role gate (CEO override) ─────────────────────────────────────────────────
  // The governor is keyed on the ADMIN ROLE, not the route. The CEO trains as a
  // Player-Coach and reads as admin everywhere, so he runs UNLIMITED across the whole
  // platform — including his own /vault client surface: no localStorage deduction, no
  // "Token Exhausted" state, presets permanently live. The /command authoring surface
  // stays unlimited too (it's AdminGuard-gated, so this is belt-and-suspenders).
  // Standard, non-admin clients remain strictly clamped to 1 token / month.
  const onCommandSurface = useLocation().pathname.startsWith('/command');
  const { user, isAdmin } = useAuth();
  const uid = user?.username || user?.id || '';
  const isUnlimited = isAdmin || onCommandSurface;

  // Client token meter — seed from persisted spend so a reload can't reset it. Unlimited
  // users (admins) never read or write the meter, so it stays irrelevant for them.
  const [tokenSpent, setTokenSpent] = useState(() => !isUnlimited && tokenSpentThisPeriod(uid));
  const canGenerate = isUnlimited || !tokenSpent;

  // ── Command Center targeting (admin authoring surface only) ──────────────────
  // On /command the Generator is an authoring console: pick a live athlete and push
  // the generated blueprint straight to their program (bbf_users.workout_plan). The
  // client Vault surface never shows this — athletes generate only for themselves.
  const [clients, setClients] = useState([]);
  const [rosterState, setRosterState] = useState({ loading: onCommandSurface, error: null });
  const [targetId, setTargetId] = useState('');
  const [pushState, setPushState] = useState({ busy: false, ok: null, err: null });
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const loadRoster = useCallback(async () => {
    setRosterState({ loading: true, error: null });
    try {
      const body = await fetchRoster();
      if (mounted.current) { setClients(Array.isArray(body.clients) ? body.clients : []); setRosterState({ loading: false, error: null }); }
    } catch (e) {
      if (mounted.current) { setClients([]); setRosterState({ loading: false, error: toErrorMessage(e) }); }
    }
  }, []);

  // Auto-load the roster once, only on the command authoring surface. Deferred to a
  // microtask so the initial setState lands outside the effect body (matches
  // NutritionLocker — satisfies react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!onCommandSurface) return undefined;
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) loadRoster(); });
    return () => { cancelled = true; };
  }, [onCommandSurface, loadRoster]);

  const pushToAthlete = async () => {
    if (!result?.program?.length) { setPushState({ busy: false, ok: null, err: at.needResult }); return; }
    if (!targetId) { setPushState({ busy: false, ok: null, err: at.needClient }); return; }
    setPushState({ busy: true, ok: null, err: null });
    try {
      await assignWorkout(targetId, toAssignedPlan(result));
      if (!mounted.current) return;
      const who = clients.find((c) => clientId(c) === targetId);
      setPushState({ busy: false, ok: at.ok(who?.name || who?.uid || 'The athlete'), err: null });
    } catch (e) {
      if (mounted.current) setPushState({ busy: false, ok: null, err: toErrorMessage(e) });
    }
  };

  // Any manual change drops the "active preset" highlight (the program no longer
  // matches a signature split verbatim).
  const set = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setActivePreset(null); };

  // Single choke point for every generation path — enforces the client token gate
  // once, centrally, and burns the monthly token on the first successful run.
  const emit = (envelope) => {
    if (!canGenerate) return false;
    setResult(generateProgram(envelope));
    if (!isUnlimited) { spendToken(uid); setTokenSpent(true); }
    return true;
  };

  const run = (nextRegen = 0) => {
    if (!canGenerate) return;
    setRegen(nextRegen);
    emit({ ...params, warmups, regen: nextRegen });
  };

  // A signature preset overwrites the whole envelope (params + warm-up flag) and
  // generates immediately — computed from the preset values, not async state. Still
  // a metered generation: a client preset tap spends the monthly token like any run.
  const applyPreset = (preset) => {
    if (!canGenerate) return;
    setParams(preset.params);
    setWarmups(preset.warmups);
    setActivePreset(preset.id);
    setRegen(0);
    emit({ ...preset.params, warmups: preset.warmups, regen: 0 });
  };

  const toggleWarmups = () => {
    const next = !warmups;
    setWarmups(next);
    setActivePreset(null);
    // Re-toggling warm-ups re-runs the engine; honor the same token gate so it can't
    // be used to keep regenerating after the monthly token is exhausted.
    if (result && canGenerate) emit({ ...params, warmups: next, regen });
  };

  return (
    <div className="gen">
      <div>
        <h2 className="pg-nut-head">{tr.head}</h2>
        <div className="pg-nut-meta">{tr.meta}</div>
      </div>

      {/* ── Akeem's Signature Chamber Splits (Overwatch Override) — 3 hard-wired presets ── */}
      <div className="pg-card gen-chambers">
        <div className="gen-chambers-head">
          <h3 className="gen-chambers-title">
            <span aria-hidden="true">🏆</span> {tr.chamberTitle} <span className="gen-chambers-tag">{tr.chamberTag}</span>
          </h3>
          <p className="gen-chambers-sub">{tr.chamberSub}</p>
        </div>
        <div className="gen-presets" role="group" aria-label={tr.chamberAria}>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`gen-preset${activePreset === p.id ? ' is-active' : ''}`}
              aria-pressed={activePreset === p.id}
              onClick={() => applyPreset(p)}
              disabled={!canGenerate}
            >
              {p.chamber ? <span className="gen-preset-chamber">{p.chamber}</span> : null}
              <span className="gen-preset-name">{p.label}</span>
              <span className="gen-preset-sub">{p.blurb}</span>
              <span className="gen-preset-cta" aria-hidden="true">{tr.activate}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="gen-form pg-card">
        <div className="gen-controls">
          {FIELDS.map((f) => {
            const known = f.options.some((o) => o.v === params[f.key]);
            return (
              <label key={f.key} className="gen-field">
                <span className="gen-field-lbl">
                  {f.icon ? <span className="gen-field-ic" aria-hidden="true">{f.icon} </span> : null}{tr.fields[f.key] || f.label}
                </span>
                <select
                  className="gen-select"
                  value={params[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  {f.options.map((o) => <option key={o.v} value={o.v}>{f.key === 'days' ? tr.daysPerWeek(o.v) : o.l}</option>)}
                  {/* A preset can set a value outside this dropdown's list (e.g. FST-7). */}
                  {!known ? <option value={params[f.key]}>{EXTRA_OPTION_LABELS[params[f.key]] || params[f.key]}</option> : null}
                </select>
              </label>
            );
          })}
        </div>

        {/* ── ATTACH WARM-UPS & COOL-DOWN toggle ── */}
        <button
          type="button"
          role="switch"
          aria-checked={warmups}
          className={`gen-toggle${warmups ? ' is-on' : ''}`}
          onClick={toggleWarmups}
          disabled={!canGenerate}
        >
          <span className={`gen-switch${warmups ? ' is-on' : ''}`}><span className="gen-switch-thumb" /></span>
          <span className="gen-toggle-lbl">{tr.attach}</span>
        </button>

        <div className="gen-actions">
          {/* Primary generate button. ADMIN (command surface): unlimited authoring.
              CLIENT: the monthly token state drives both the label and the lock. */}
          {isUnlimited ? (
            <button type="button" className="gen-run" onClick={() => run(0)}>
              <span aria-hidden="true">🏋 </span>{tr.genUnlimited}
            </button>
          ) : canGenerate ? (
            <button type="button" className="gen-run" onClick={() => run(0)}>
              <span aria-hidden="true">🏋 </span>{tr.genToken}
            </button>
          ) : (
            <button type="button" className="gen-run is-exhausted" disabled aria-disabled="true">
              <span aria-hidden="true">🔒 </span>{tr.genExhausted}
            </button>
          )}
          {/* Reshuffle is another full generation — admin-only, so it can never be
              used to bypass the client's one-token-per-month hard limit. */}
          {result && isUnlimited ? (
            <button type="button" className="gen-regen" onClick={() => run(regen + 1)}>{tr.reshuffle}</button>
          ) : null}
        </div>

        {/* Failsafe (client, token spent) — route the athlete back to their assigned,
            saved routine instead of a dead end. */}
        {!isUnlimited && tokenSpent ? (
          <button
            type="button"
            className="gen-revert"
            onClick={() => onRevertToLibrary?.()}
          >
            {tr.revert}
          </button>
        ) : null}

        <div className="gen-guard">{tr.guard}</div>
      </div>

      {/* ── Roster Deployment Bay — Command Center authoring surface only ──────── */}
      {onCommandSurface ? (
        <section className="pg-card gen-assign" aria-label={at.head}>
          <div className="gen-assign-head">
            <h3 className="gen-assign-title">{at.head}</h3>
            <p className="gen-assign-sub">{at.sub}</p>
          </div>
          <div className="gen-assign-row">
            <label className="gen-field gen-assign-field">
              <span className="gen-field-lbl">{at.select}</span>
              {rosterState.loading ? (
                <div className="gen-assign-state">{at.loading}</div>
              ) : rosterState.error ? (
                <div className="gen-assign-state is-error">
                  {rosterState.error}{' '}
                  <button type="button" className="gen-assign-link" onClick={loadRoster}>{at.retry}</button>
                </div>
              ) : (
                <select
                  className="gen-select"
                  value={targetId}
                  onChange={(e) => { setTargetId(e.target.value); setPushState({ busy: false, ok: null, err: null }); }}
                >
                  <option value="">{at.placeholder}</option>
                  {clients.map((c) => (
                    <option key={clientId(c)} value={clientId(c)}>{(c.name || c.uid || 'Unnamed')} · {division(c)}</option>
                  ))}
                </select>
              )}
            </label>
            <button
              type="button"
              className="gen-assign-btn"
              onClick={pushToAthlete}
              disabled={pushState.busy || !result?.program?.length || !targetId}
            >
              {pushState.busy ? at.pushing : at.push}
            </button>
          </div>
          {pushState.ok ? <div className="gen-assign-msg is-ok" role="status">✓ {pushState.ok}</div> : null}
          {pushState.err ? <div className="gen-assign-msg is-err" role="alert">⚠ {pushState.err}</div> : null}
        </section>
      ) : null}

      {result ? <GeneratorOutput result={result} /> : (
        <div className="pg-card gen-placeholder">{tr.placeholder}</div>
      )}
    </div>
  );
}

function GeneratorOutput({ result }) {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  if (!result.program?.length) {
    return <div className="pg-card gen-placeholder">{tr.noMatch}</div>;
  }
  return (
    <div className="gen-out">
      {result.program.map((day, di) => (
        <div className="gen-day pg-card" key={day.label + di}>
          <div className="gen-dayhead">
            <span className="gen-dayn">{tr.day} {di + 1}</span>
            <span className="gen-dayf">{day.label}</span>
            {day.rx?.technique ? <span className="gen-tech">{day.rx.technique}</span> : null}
          </div>
          {day.rx?.techniqueCue ? <div className="gen-techcue">⚡ {day.rx.techniqueCue}</div> : null}

          {day.warmup?.length ? (
            <div className="gen-warm">
              <div className="gen-warm-h">{tr.warmup}</div>
              <ul className="gen-warm-list">{day.warmup.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}

          {day.exercises.length === 0 ? (
            <div className="gen-ex"><div className="gen-exname">{tr.rest}</div></div>
          ) : day.exercises.map((ex, ei) => {
            const vid = resolveVideoId(ex.n, lang);
            const exRx = ex.rx || day.rx;
            return (
              <div className="gen-ex" key={ex.n + ei}>
                {vid ? (
                  /* Inline tap-to-play embed — same player skin as the Program
                     grid; .is-playing spans the roster row (session retention). */
                  <FormDemoPlayer videoId={vid} title={tr.formDemo(ex.n)} />
                ) : null}
                <div className="gen-exmain">
                  <div className="gen-exname">{ex.n}{ex.fst7 ? <span className="gen-fst7">FST-7</span> : null}</div>
                  <div className="gen-exmeta"><span className="gen-mg">{localizeMuscle(ex.g, lang).toUpperCase()}</span> · {ex.p}</div>
                </div>
                <div className="gen-rx">
                  <div className="gen-sr">{exRx.sets}×{exRx.reps}</div>
                  <div className="gen-rest">{tr.restLbl} {exRx.rest}</div>
                </div>
              </div>
            );
          })}

          {day.cooldown?.length ? (
            <div className="gen-warm gen-warm--cool">
              <div className="gen-warm-h">{tr.cooldown}</div>
              <ul className="gen-warm-list">{day.cooldown.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
