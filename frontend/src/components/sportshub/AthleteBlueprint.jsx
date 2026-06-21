// src/components/sportshub/AthleteBlueprint.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE ATHLETE BLUEPRINT — the Youth Sports Hub's unified Field Work / Weight Room /
// Fuel tab-deck. One profile (AthleteProfileContext) → three engines
// (athleteBlueprint.buildAthleteBlueprint) → three rooms.
//
//   01 Field Work  — buildSportsProtocol (skill/speed/agility/plyo/conditioning),
//                    rendered by the existing SportProtocol. Strength block stripped.
//   02 Weight Room — generateProgram → toAssignedPlan (the barbell pillar). Sets
//                    scale live with the morning CNS scan (volMultiplier).
//   03 Fuel        — bbf_compute_macro_targets RPC (TDEE) → buildMealPlan.
//
// The intake is collected ONCE into the global profile (pre-set by sport/position,
// overridable here) and the forged blueprint is persisted per-uid to localStorage.

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { useReadiness } from '../../context/ReadinessContext.jsx';
import { useAthleteProfile } from '../../context/AthleteProfileContext.jsx';
import { buildAthleteBlueprint, GOAL_LABEL } from '../../lib/athleteBlueprint.js';
import { getAthleteSync, saveAthleteBlueprint } from '../../lib/athleteSyncApi.js';
import { GOALS, LEVELS, SPLITS } from '../vault/generatorEngine.js';
import SportProtocol from './SportProtocol.jsx';
import './athleteBlueprint.css';

const DIETARY = {
  en: [['Omnivore', 'Omnivore'], ['Vegetarian', 'Vegetarian'], ['Vegan', 'Vegan']],
  es: [['Omnivore', 'Omnívoro'], ['Vegetarian', 'Vegetariano'], ['Vegan', 'Vegano']],
  pt: [['Omnivore', 'Onívoro'], ['Vegetarian', 'Vegetariano'], ['Vegan', 'Vegano']],
};
const VOL_BAND = { full: '#c9ff7a', reduced: '#ffd24d', recovery: '#ff5d5d' };

const BP_KEY = 'bbf.blueprint.v1';
function loadBlueprint(uid) {
  try { const all = JSON.parse(localStorage.getItem(BP_KEY) || '{}'); return (uid && all[uid]) || null; } catch { return null; }
}
function saveBlueprint(uid, bp) {
  if (!uid) return;
  try { const all = JSON.parse(localStorage.getItem(BP_KEY) || '{}'); all[uid] = bp; localStorage.setItem(BP_KEY, JSON.stringify(all)); } catch { /* quota */ }
}

const L10N = {
  en: {
    kicker: 'The Athlete Blueprint · Unified Engine',
    titleA: 'Athlete', titleB: 'Blueprint',
    sub: 'One profile drives all three pillars — field work, the weight room, and fuel — built from the BBF engines.',
    calibrate: 'Calibrate Profile', presetNote: (pos, goal) => `Pre-set for ${pos}: ${goal}. Override anything below.`,
    age: 'Age', sex: 'Sex', male: 'Male', female: 'Female', height: 'Height', weight: 'Weight (lb)',
    level: 'Experience', goal: 'Training Goal', arch: 'Split', diet: 'Dietary',
    forge: 'Forge My Blueprint →', forging: 'Forging the Blueprint…', reforge: 'Re-Forge Blueprint →',
    err: 'Could not forge the blueprint. Try again.',
    tabs: { field: 'Field Work', weight: 'Weight Room', fuel: 'Fuel' },
    tabtags: { field: 'Skill · Speed · Agility', weight: 'The Iron', fuel: 'TDEE · Macros' },
    vol: (p, b) => `CNS Volume ${p}% · ${b} — set counts trimmed for today`,
    bands: { full: 'Full Volume', reduced: 'Reduced Volume', recovery: 'Prehab / Recovery' },
    rest: 'Rest / Active Recovery', sets: 'sets', was: 'was',
    cal: 'Daily Target', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', kcal: 'kcal', g: 'g',
    fuelNote: 'TDEE computed server-side (Mifflin-St Jeor) · youth lock: no fasting window.',
    needMetrics: 'Add your height, weight, age and sex above, then re-forge to compute your fuel.',
    placeholder: 'Calibrate your profile, then forge your blueprint — field work, weight room and fuel in one tap.',
  },
  es: {
    kicker: 'El Plan del Atleta · Motor Unificado',
    titleA: 'Plan del', titleB: 'Atleta',
    sub: 'Un perfil impulsa los tres pilares — trabajo de campo, sala de pesas y nutrición — con los motores BBF.',
    calibrate: 'Calibrar Perfil', presetNote: (pos, goal) => `Pre-ajustado para ${pos}: ${goal}. Modifica lo que quieras.`,
    age: 'Edad', sex: 'Sexo', male: 'Masculino', female: 'Femenino', height: 'Estatura', weight: 'Peso (lb)',
    level: 'Experiencia', goal: 'Objetivo', arch: 'División', diet: 'Dieta',
    forge: 'Forjar Mi Plan →', forging: 'Forjando el Plan…', reforge: 'Re-Forjar Plan →',
    err: 'No se pudo forjar el plan. Inténtalo de nuevo.',
    tabs: { field: 'Trabajo de Campo', weight: 'Sala de Pesas', fuel: 'Nutrición' },
    tabtags: { field: 'Técnica · Velocidad', weight: 'El Hierro', fuel: 'TDEE · Macros' },
    vol: (p, b) => `Volumen SNC ${p}% · ${b} — series reducidas para hoy`,
    bands: { full: 'Volumen Completo', reduced: 'Volumen Reducido', recovery: 'Prehab / Recuperación' },
    rest: 'Descanso / Recuperación Activa', sets: 'series', was: 'antes',
    cal: 'Meta Diaria', protein: 'Proteína', carbs: 'Carbos', fat: 'Grasa', kcal: 'kcal', g: 'g',
    fuelNote: 'TDEE calculado en el servidor (Mifflin-St Jeor) · bloqueo juvenil: sin ayuno.',
    needMetrics: 'Agrega tu estatura, peso, edad y sexo arriba, luego re-forja para calcular tu nutrición.',
    placeholder: 'Calibra tu perfil y forja tu plan — trabajo de campo, pesas y nutrición en un toque.',
  },
  pt: {
    kicker: 'O Plano do Atleta · Motor Unificado',
    titleA: 'Plano do', titleB: 'Atleta',
    sub: 'Um perfil impulsiona os três pilares — trabalho de campo, sala de musculação e nutrição — com os motores BBF.',
    calibrate: 'Calibrar Perfil', presetNote: (pos, goal) => `Pré-ajustado para ${pos}: ${goal}. Altere o que quiser.`,
    age: 'Idade', sex: 'Sexo', male: 'Masculino', female: 'Feminino', height: 'Altura', weight: 'Peso (lb)',
    level: 'Experiência', goal: 'Objetivo', arch: 'Divisão', diet: 'Dieta',
    forge: 'Forjar Meu Plano →', forging: 'Forjando o Plano…', reforge: 'Re-Forjar Plano →',
    err: 'Não foi possível forjar o plano. Tente novamente.',
    tabs: { field: 'Trabalho de Campo', weight: 'Sala de Musculação', fuel: 'Nutrição' },
    tabtags: { field: 'Técnica · Velocidade', weight: 'O Ferro', fuel: 'TDEE · Macros' },
    vol: (p, b) => `Volume SNC ${p}% · ${b} — séries reduzidas para hoje`,
    bands: { full: 'Volume Total', reduced: 'Volume Reduzido', recovery: 'Prehab / Recuperação' },
    rest: 'Descanso / Recuperação Ativa', sets: 'séries', was: 'antes',
    cal: 'Meta Diária', protein: 'Proteína', carbs: 'Carbos', fat: 'Gordura', kcal: 'kcal', g: 'g',
    fuelNote: 'TDEE calculado no servidor (Mifflin-St Jeor) · trava juvenil: sem jejum.',
    needMetrics: 'Adicione sua altura, peso, idade e sexo acima, depois re-forje para calcular sua nutrição.',
    placeholder: 'Calibre seu perfil e forje seu plano — trabalho de campo, musculação e nutrição num toque.',
  },
};

const TAB_KEYS = ['field', 'weight', 'fuel'];

export default function AthleteBlueprint({ sportLabel, positionLabel }) {
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';
  const { profile, currentTier, setProfileField, setCurrentTier } = useAthleteProfile();
  const { volMultiplier, hasCheckedIn, band } = useReadiness();

  // localStorage seeds an INSTANT paint (offline cache); the server is the source of
  // truth and overrides it on mount via the bbf-athlete-sync bridge.
  const [blueprint, setBlueprint] = useState(() => loadBlueprint(uid));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  // Strict state-driven tab-deck (§10): ONE active panel mounts at a time — the other
  // data domains (field / weight / fuel) unmount entirely. String-keyed so intent is
  // explicit and the active panel is never index-fragile.
  const [activeTab, setActiveTab] = useState('field');

  // Server hydrate: pull the authoritative current_tier (computed server-side from
  // birth_date) + the last saved blueprint. State is only set inside the async
  // callback (house rule). A failure keeps the localStorage-seeded cache.
  useEffect(() => {
    let cancelled = false;
    getAthleteSync()
      .then((d) => {
        if (cancelled || !d?.ok) return;
        if (d.current_tier) setCurrentTier(d.current_tier);
        if (d.blueprint) setBlueprint(d.blueprint);
      })
      .catch(() => { /* offline / pre-intake — keep the offline cache */ });
    return () => { cancelled = true; };
  }, [setCurrentTier]);

  const diet = DIETARY[lang] || DIETARY.en;
  const goalLabel = (GOAL_LABEL[profile.goal] || GOAL_LABEL.general)[lang] || (GOAL_LABEL[profile.goal] || GOAL_LABEL.general).en;
  const scaling = hasCheckedIn && volMultiplier !== 1;
  const scaleInt = (n) => (scaling ? Math.max(1, Math.round(Number(n) * volMultiplier)) : Number(n));

  async function forge() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const bp = await buildAthleteBlueprint({ ...profile, currentTier });
      setBlueprint(bp);
      saveBlueprint(uid, bp);                 // offline cache (instant, survives reload)
      try { await saveAthleteBlueprint(bp); } // durable server record (source of truth)
      catch { /* server unreachable / pre-intake — the offline cache stands */ }
    } catch {
      setError(L.err);
    } finally {
      setBusy(false);
    }
  }

  const macros = blueprint?.macros || null;
  const nutrition = blueprint?.nutrition || null;
  const activeKey = activeTab;

  return (
    <section className="ab" data-testid="athlete-blueprint">
      <div className="ab-inner">
        <div className="ab-head">
          <div className="ab-kicker"><span aria-hidden="true">🧬</span> {L.kicker}</div>
          <h2 className="ab-title">{L.titleA} <span>{L.titleB}</span></h2>
          <p className="ab-sub">{L.sub}</p>
        </div>

        {/* ── Calibrate (the unified profile — pre-set, overridable) ─────────── */}
        <div className="ab-cal">
          <div className="ab-cal-top">
            <span className="ab-cal-kicker">{L.calibrate}</span>
            <span className="ab-cal-id">
              {sportLabel ? <span className="ab-chip">{sportLabel}</span> : null}
              {positionLabel ? <span className="ab-chip">{positionLabel}</span> : null}
              <span className="ab-chip is-tier" data-testid="ab-tier">{currentTier.replace('_', ' ')}</span>
            </span>
          </div>
          <div className="ab-cal-grid">
            <label className="ab-f">
              <span className="ab-f-k">{L.age}</span>
              <input className="ab-input" type="number" inputMode="numeric" min="6" max="30" value={profile.age ?? ''} onChange={(e) => setProfileField('age', e.target.value)} data-testid="ab-age" />
            </label>
            <div className="ab-f">
              <span className="ab-f-k">{L.sex}</span>
              <div className="ab-sex">
                {[['male', L.male], ['female', L.female]].map(([v, lbl]) => (
                  <button key={v} type="button" className={`ab-sex-btn${profile.sex === v ? ' is-on' : ''}`} onClick={() => setProfileField('sex', v)} data-testid={`ab-sex-${v}`}>{lbl}</button>
                ))}
              </div>
            </div>
            <div className="ab-f">
              <span className="ab-f-k">{L.height}</span>
              <div className="ab-hw">
                <input className="ab-input" type="number" inputMode="numeric" min="3" max="7" value={profile.heightFt ?? ''} onChange={(e) => setProfileField('heightFt', e.target.value)} aria-label="feet" data-testid="ab-height-ft" />
                <input className="ab-input" type="number" inputMode="numeric" min="0" max="11" value={profile.heightIn ?? ''} onChange={(e) => setProfileField('heightIn', e.target.value)} aria-label="inches" data-testid="ab-height-in" />
              </div>
            </div>
            <label className="ab-f">
              <span className="ab-f-k">{L.weight}</span>
              <input className="ab-input" type="number" inputMode="numeric" min="50" max="400" value={profile.weightLb ?? ''} onChange={(e) => setProfileField('weightLb', e.target.value)} data-testid="ab-weight" />
            </label>
            <label className="ab-f">
              <span className="ab-f-k">{L.level}</span>
              <select className="ab-select" value={String(profile.level)} onChange={(e) => setProfileField('level', e.target.value)} data-testid="ab-level">
                {LEVELS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
            <label className="ab-f">
              <span className="ab-f-k">{L.goal}</span>
              <select className="ab-select" value={profile.goal} onChange={(e) => setProfileField('goal', e.target.value)} data-testid="ab-goal">
                {GOALS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
            <label className="ab-f">
              <span className="ab-f-k">{L.arch}</span>
              <select className="ab-select" value={profile.arch} onChange={(e) => setProfileField('arch', e.target.value)} data-testid="ab-arch">
                {SPLITS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
            <label className="ab-f">
              <span className="ab-f-k">{L.diet}</span>
              <select className="ab-select" value={profile.dietary} onChange={(e) => setProfileField('dietary', e.target.value)} data-testid="ab-diet">
                {diet.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
              </select>
            </label>
          </div>
          <p className="ab-preset-note">{L.presetNote(positionLabel || profile.positionCode, goalLabel)}</p>
        </div>

        <button type="button" className="ab-forge" onClick={forge} disabled={busy} data-testid="ab-forge">
          {busy ? L.forging : (blueprint ? L.reforge : L.forge)}
        </button>
        {error ? <p className="ab-err" role="alert">{error}</p> : null}

        {/* ── The three rooms ───────────────────────────────────────────────── */}
        {blueprint ? (
          <>
            <div className="ab-tabbar" role="tablist" aria-label={L.kicker}>
              {TAB_KEYS.map((k, i) => (
                <button key={k} type="button" role="tab" aria-selected={k === activeTab} className={`ab-tab${k === activeTab ? ' is-active' : ''}`} onClick={() => setActiveTab(k)} data-testid={`ab-tab-${k}`}>
                  <span className="ab-tabidx">0{i + 1}</span>
                  <span className="ab-tablabel">{L.tabs[k]}</span>
                  <span className="ab-tabtag">{L.tabtags[k]}</span>
                </button>
              ))}
            </div>

            <div className="ab-panel" role="tabpanel" key={activeKey}>
              {/* 01 · FIELD WORK — reuse the canonical SportProtocol renderer */}
              {activeKey === 'field' ? (
                <SportProtocol protocol={blueprint.sportProtocol} />
              ) : null}

              {/* 02 · WEIGHT ROOM — the generated barbell program (sets CNS-scaled) */}
              {activeKey === 'weight' ? (
                <>
                  {scaling ? (
                    <div className="ab-vol" style={{ '--vol': VOL_BAND[band] || VOL_BAND.reduced }}>
                      <span aria-hidden="true">⚡</span> {L.vol(Math.round(volMultiplier * 100), L.bands[band] || L.bands.reduced)}
                    </div>
                  ) : null}
                  <div className="ab-wr-grid">
                    {(blueprint.assignedPlan || []).map((d, di) => (
                      <article className="ab-day" key={`${d.day}-${di}`}>
                        <div className="ab-day-head">
                          <span className="ab-day-n">{d.day}</span>
                          <span className="ab-day-f">{d.focus}</span>
                        </div>
                        {d.isRest ? (
                          <div className="ab-day-rest">{L.rest}{d.restNote ? ` — ${d.restNote}` : ''}</div>
                        ) : (
                          (d.exercises || []).map((ex, ei) => {
                            const shown = scaleInt(ex.sets);
                            const isScaled = scaling && shown !== Number(ex.sets);
                            return (
                              <div className="ab-ex" key={`${ex.name}-${ei}`}>
                                <div className="ab-ex-l">
                                  <div className="ab-ex-n">{ex.name}</div>
                                  <div className="ab-ex-eq">{ex.equipment}</div>
                                </div>
                                <div className="ab-ex-rx">
                                  <span className={`ab-ex-sets${isScaled ? ' is-scaled' : ''}`}>{shown}×{ex.reps}</span>
                                  {isScaled ? <span className="ab-ex-was">{L.was} {ex.sets}×{ex.reps}</span> : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </article>
                    ))}
                  </div>
                </>
              ) : null}

              {/* 03 · FUEL — server-computed TDEE + macros, then meal scaling */}
              {activeKey === 'fuel' ? (
                nutrition && macros ? (
                  <>
                    <div className="ab-macros">
                      <div className="ab-macro is-cal"><span className="ab-macro-v">{macros.tdee_target}<small> {L.kcal}</small></span><span className="ab-macro-k">{L.cal}</span></div>
                      <div className="ab-macro"><span className="ab-macro-v">{macros.macro_p}<small>{L.g}</small></span><span className="ab-macro-k">{L.protein}</span></div>
                      <div className="ab-macro"><span className="ab-macro-v">{macros.macro_c}<small>{L.g}</small></span><span className="ab-macro-k">{L.carbs}</span></div>
                      <div className="ab-macro"><span className="ab-macro-v">{macros.macro_f}<small>{L.g}</small></span><span className="ab-macro-k">{L.fat}</span></div>
                    </div>
                    <div className="ab-meals">
                      {(nutrition.days?.[0]?.meals || []).map((m, mi) => (
                        <article className="ab-meal" key={`${m.m}-${mi}`}>
                          <div className="ab-meal-slot">{m.m}</div>
                          <div className="ab-meal-name">{String(m.i).split(' — ')[0]}</div>
                          <div className="ab-meal-macros">
                            <span className="ab-meal-macro"><b>{m.calories}</b>{L.kcal}</span>
                            <span className="ab-meal-macro"><b>{m.protein_g}</b>P</span>
                            <span className="ab-meal-macro"><b>{m.carbs_g}</b>C</span>
                            <span className="ab-meal-macro"><b>{m.fat_g}</b>F</span>
                          </div>
                        </article>
                      ))}
                    </div>
                    <p className="ab-fuel-note">{L.fuelNote}</p>
                  </>
                ) : (
                  <div className="ab-empty">{L.needMetrics}</div>
                )
              ) : null}
            </div>
          </>
        ) : (
          <div className="ab-panel"><div className="ab-empty">{L.placeholder}</div></div>
        )}
      </div>
    </section>
  );
}
