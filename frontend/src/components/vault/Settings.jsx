// src/components/vault/Settings.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 25 — Vault · Settings.
//
// Two faces, gated by access tier:
//   • Admin / coach  → the "ADMIN LEVEL DASHBOARD CONFIGURATION · PERSONAL
//     THRESHOLD SETTINGS" dashboard from the AI Studio prototype: pick an athlete
//     from the live roster, then edit their baseline thresholds — identity, age /
//     resting HR, daily macro targets, and core 1RM milestones.
//   • Client         → the lightweight account / language / session surface.
//
// DATA ARCHITECTURE (CEO directive, 2026-06): Age, Resting HR, and the 1RM
// milestones do NOT have Supabase columns yet, and localStorage is explicitly
// OFF the table for administrative configuration. So every field is plain
// controlled React state, and the "Save" action bundles the whole profile into a
// single payload and emits it via console.warn("DB Migration Required: ", …).
// The CEO runs the schema migration that backs these columns afterwards; wiring
// the save to a real edge-function write is then a one-line swap at SAVE below.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { rosterCall, toErrorMessage } from '../../lib/rosterApi.js';
import { APP_VERSION } from '../../version.js';
import './vault.css';

const LANG_LABELS = { en: 'English', es: 'Español', pt: 'Português' };

// Trilingual chrome for the admin-only Personal Threshold Settings dashboard. The
// client surface above already routes through the shared t() dictionary; this
// covers the previously-hardcoded coach console. EN values are verbatim.
const ADM = {
  en: {
    kicker: 'Admin Level Dashboard Configuration',
    title: 'Personal Threshold Settings',
    sub: 'Edit physical parameter baseline limits. Changes are bundled into a migration payload on save.',
    rosterLabel: 'Active Athlete Profile',
    rosterUnavailable: 'Roster unavailable',
    rosterLoading: 'Loading roster…',
    fName: 'Athlete / Coach Name',
    fPhase: 'Current Phase Name',
    fAge: 'Age Bracket (Years)',
    fHr: 'Resting Heart Rate (BPM)',
    secMacros: 'Daily Macronutrient Targets',
    fKcal: 'Calories (kcal)',
    fProtein: 'Protein (g)',
    fCarbs: 'Carbohydrates (g)',
    fFats: 'Fats (g)',
    secPr: 'Core Lifelong Lifting Milestones (PR)',
    fBench: 'Bench Press (Max lbs)',
    fSquat: 'Olympic Squat (Max lbs)',
    fDead: 'Conventional Deadlift (Max lbs)',
    save: 'Save Thresholds',
    saved: 'Payload emitted to console — schema migration pending (Age · Resting HR · 1RM columns).',
  },
  es: {
    kicker: 'Configuración del Panel de Nivel Administrativo',
    title: 'Ajustes de Umbrales Personales',
    sub: 'Edita los límites base de los parámetros físicos. Los cambios se agrupan en un paquete de migración al guardar.',
    rosterLabel: 'Perfil del Atleta Activo',
    rosterUnavailable: 'Lista no disponible',
    rosterLoading: 'Cargando lista…',
    fName: 'Nombre del Atleta / Coach',
    fPhase: 'Nombre de la Fase Actual',
    fAge: 'Rango de Edad (Años)',
    fHr: 'Frecuencia Cardíaca en Reposo (LPM)',
    secMacros: 'Objetivos Diarios de Macronutrientes',
    fKcal: 'Calorías (kcal)',
    fProtein: 'Proteína (g)',
    fCarbs: 'Carbohidratos (g)',
    fFats: 'Grasas (g)',
    secPr: 'Marcas de Fuerza Fundamentales (PR)',
    fBench: 'Press de Banca (Máx lbs)',
    fSquat: 'Sentadilla Olímpica (Máx lbs)',
    fDead: 'Peso Muerto Convencional (Máx lbs)',
    save: 'Guardar Umbrales',
    saved: 'Paquete enviado a la consola — migración de esquema pendiente (Edad · FC en reposo · columnas 1RM).',
  },
  pt: {
    kicker: 'Configuração do Painel de Nível Administrativo',
    title: 'Ajustes de Limites Pessoais',
    sub: 'Edite os limites-base dos parâmetros físicos. As alterações são agrupadas em um pacote de migração ao salvar.',
    rosterLabel: 'Perfil do Atleta Ativo',
    rosterUnavailable: 'Lista indisponível',
    rosterLoading: 'Carregando lista…',
    fName: 'Nome do Atleta / Coach',
    fPhase: 'Nome da Fase Atual',
    fAge: 'Faixa Etária (Anos)',
    fHr: 'Frequência Cardíaca em Repouso (BPM)',
    secMacros: 'Metas Diárias de Macronutrientes',
    fKcal: 'Calorias (kcal)',
    fProtein: 'Proteína (g)',
    fCarbs: 'Carboidratos (g)',
    fFats: 'Gorduras (g)',
    secPr: 'Marcas de Força Fundamentais (PR)',
    fBench: 'Supino (Máx lbs)',
    fSquat: 'Agachamento Olímpico (Máx lbs)',
    fDead: 'Levantamento Terra Convencional (Máx lbs)',
    save: 'Salvar Limites',
    saved: 'Pacote enviado ao console — migração de esquema pendente (Idade · FC em repouso · colunas 1RM).',
  },
};

// Blank threshold profile — the controlled-state shape the dashboard edits.
const EMPTY_FORM = {
  athleteName: '',
  phaseName: '',
  age: '',
  restingHr: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
  bench: '',
  squat: '',
  deadlift: '',
};

// Seed the editable form from a roster row. Only Name + Calories have a backing
// column today (bbf_users.name / tdee_target); everything else starts blank
// until the pending migration lands.
function seedFromClient(c) {
  return {
    ...EMPTY_FORM,
    athleteName: c?.name || c?.uid || '',
    calories: c?.tdee_target != null ? String(c.tdee_target) : '',
  };
}

export default function Settings() {
  const { user, isAdmin, signOut } = useAuth();
  const { lang, setLang, t } = useLang();

  const username = user?.username || user?.id || '—';
  const role = isAdmin ? 'Admin · Coach' : (user?.role ? user.role : 'Client');

  return (
    <div className="pg-nut">
      {isAdmin ? <AdminThresholds selfUid={user?.username || ''} /> : (
        <>
          <div>
            <h2 className="pg-nut-head">{t('vault-tab-settings')}</h2>
            <div className="pg-nut-meta">{t('set-meta')}</div>
          </div>
          <div className="pg-card">
            <div className="pg-set-title">{t('set-account')}</div>
            <div className="pg-set-row">
              <span className="pg-set-k">{t('set-username')}</span>
              <span className="pg-set-v">@{username}</span>
            </div>
            <div className="pg-set-row">
              <span className="pg-set-k">{t('set-access-tier')}</span>
              <span className="pg-set-v">{role}</span>
            </div>
          </div>
        </>
      )}

      <div className="pg-card">
        <div className="pg-set-title">{t('set-language')}</div>
        <div className="pg-set-langs">
          {Object.keys(LANG_LABELS).map((code) => (
            <button
              key={code}
              type="button"
              className={`pg-set-lang${lang === code ? ' is-active' : ''}`}
              aria-pressed={lang === code}
              onClick={() => setLang(code)}
            >
              {LANG_LABELS[code]}
            </button>
          ))}
        </div>
      </div>

      <div className="pg-card">
        <div className="pg-set-title">{t('concierge-replay-h')}</div>
        <button
          type="button"
          className="pg-set-replay"
          data-testid="vault-concierge-summon"
          onClick={() => {
            // Decoupled summon — the Concierge (mounted at the ClientVault root)
            // listens for this and re-opens the welcome, bypassing the first-login gate.
            try { window.dispatchEvent(new CustomEvent('bbf:concierge:summon', { detail: { hub: 'vault' } })); } catch { /* no-op */ }
          }}
        >
          {t('concierge-replay')}
        </button>
      </div>

      <div className="pg-card">
        <div className="pg-set-title">{t('set-session')}</div>
        <button type="button" className="pg-set-signout" onClick={signOut}>{t('shell-signout')}</button>
      </div>

      {/* Build version stamp — the exact CI build this device is running (matches
          the Android versionName). Diagnostic-only, deliberately understated. */}
      <div
        data-testid="app-version-stamp"
        style={{
          textAlign: 'center',
          opacity: 0.5,
          fontSize: '0.72rem',
          letterSpacing: '0.06em',
          fontFamily: '"Barlow Condensed", sans-serif',
          paddingTop: 6,
        }}
      >
        v{APP_VERSION}
      </div>
    </div>
  );
}

// ── Admin · Personal Threshold Settings dashboard ────────────────────────────
function AdminThresholds({ selfUid }) {
  const { lang } = useLang();
  const a = ADM[lang] || ADM.en;
  const [roster, setRoster] = useState([]);
  const [rosterError, setRosterError] = useState('');
  const [activeUid, setActiveUid] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saved, setSaved] = useState(false);

  // Load the live roster once (anon-key pattern, identical to Client Analytics).
  useEffect(() => {
    let cancelled = false;
    rosterCall('roster')
      .then((body) => {
        if (cancelled) return;
        const clients = Array.isArray(body.clients) ? body.clients : [];
        setRoster(clients);
        const initial = clients.find((c) => c.uid === selfUid) || clients[0];
        if (initial) {
          setActiveUid(initial.uid);
          setForm(seedFromClient(initial));
        }
      })
      .catch((e) => { if (!cancelled) setRosterError(toErrorMessage(e)); });
    return () => { cancelled = true; };
  }, [selfUid]);

  const activeClient = useMemo(
    () => roster.find((c) => c.uid === activeUid) || null,
    [roster, activeUid],
  );

  const onPickAthlete = (uid) => {
    setActiveUid(uid);
    setSaved(false);
    const c = roster.find((r) => r.uid === uid);
    setForm(seedFromClient(c));
  };

  const setField = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setSaved(false);
  };

  // SAVE — bundle the threshold profile and emit it for the pending migration.
  // (Swap this console.warn for the edge-function write once the columns exist.)
  const onSave = (e) => {
    e.preventDefault();
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const payload = {
      uid: activeUid || null,
      id: activeClient?.id || null,
      athlete_name: form.athleteName || null,
      current_phase: form.phaseName || null,
      age_years: num(form.age),
      resting_hr_bpm: num(form.restingHr),
      macro_targets: {
        calories_kcal: num(form.calories),
        protein_g: num(form.protein),
        carbs_g: num(form.carbs),
        fats_g: num(form.fats),
      },
      one_rep_max_lbs: {
        bench_press: num(form.bench),
        olympic_squat: num(form.squat),
        conventional_deadlift: num(form.deadlift),
      },
    };
    console.warn('DB Migration Required: ', payload);
    setSaved(true);
  };

  return (
    <form className="cv-adm" onSubmit={onSave}>
      <header className="cv-adm-head">
        <span className="cv-adm-kicker">{a.kicker}</span>
        <h2 className="cv-adm-title">{a.title}</h2>
        <p className="cv-adm-sub">{a.sub}</p>
      </header>

      {/* Client roster dropdown — switch the active athlete's profile. */}
      <div className="cv-adm-field cv-adm-roster">
        <label className="cv-adm-label" htmlFor="cv-adm-athlete">{a.rosterLabel}</label>
        <select
          id="cv-adm-athlete"
          className="cv-adm-input cv-adm-select"
          value={activeUid}
          onChange={(e) => onPickAthlete(e.target.value)}
          disabled={!roster.length}
        >
          {!roster.length ? <option value="">{rosterError ? a.rosterUnavailable : a.rosterLoading}</option> : null}
          {roster.map((c) => (
            <option key={c.uid} value={c.uid}>{c.name || c.uid}</option>
          ))}
        </select>
        {rosterError ? <span className="cv-adm-note is-warn">{rosterError}</span> : null}
      </div>

      {/* Identity */}
      <div className="cv-adm-grid cv-adm-grid-2">
        <Field id="athleteName" label={a.fName} value={form.athleteName} onChange={setField('athleteName')} placeholder="Akeem Brown" />
        <Field id="phaseName" label={a.fPhase} value={form.phaseName} onChange={setField('phaseName')} placeholder="Phase 4 - Back & Biceps" />
        <Field id="age" label={a.fAge} value={form.age} onChange={setField('age')} type="number" placeholder="34" />
        <Field id="restingHr" label={a.fHr} value={form.restingHr} onChange={setField('restingHr')} type="number" placeholder="62" />
      </div>

      {/* Daily macronutrient targets */}
      <div className="cv-adm-section">{a.secMacros}</div>
      <div className="cv-adm-grid cv-adm-grid-4">
        <Field id="calories" label={a.fKcal} value={form.calories} onChange={setField('calories')} type="number" placeholder="2400" />
        <Field id="protein" label={a.fProtein} value={form.protein} onChange={setField('protein')} type="number" placeholder="210" />
        <Field id="carbs" label={a.fCarbs} value={form.carbs} onChange={setField('carbs')} type="number" placeholder="240" />
        <Field id="fats" label={a.fFats} value={form.fats} onChange={setField('fats')} type="number" placeholder="70" />
      </div>

      {/* Core lifelong lifting milestones (PR) */}
      <div className="cv-adm-section">{a.secPr}</div>
      <div className="cv-adm-grid cv-adm-grid-3">
        <Field id="bench" label={a.fBench} value={form.bench} onChange={setField('bench')} type="number" placeholder="315" />
        <Field id="squat" label={a.fSquat} value={form.squat} onChange={setField('squat')} type="number" placeholder="425" />
        <Field id="deadlift" label={a.fDead} value={form.deadlift} onChange={setField('deadlift')} type="number" placeholder="515" />
      </div>

      <div className="cv-adm-actions">
        <button type="submit" className="cv-adm-save">{a.save}</button>
        {saved ? (
          <span className="cv-adm-note is-ok">{a.saved}</span>
        ) : null}
      </div>
    </form>
  );
}

function Field({ id, label, value, onChange, type = 'text', placeholder }) {
  return (
    <div className="cv-adm-field">
      <label className="cv-adm-label" htmlFor={`cv-adm-${id}`}>{label}</label>
      <input
        id={`cv-adm-${id}`}
        className="cv-adm-input"
        type={type}
        inputMode={type === 'number' ? 'numeric' : undefined}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
