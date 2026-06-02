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
import './vault.css';

const LANG_LABELS = { en: 'English', es: 'Español', pt: 'Português' };

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
        <div className="pg-set-title">{t('set-session')}</div>
        <button type="button" className="pg-set-signout" onClick={signOut}>{t('shell-signout')}</button>
      </div>
    </div>
  );
}

// ── Admin · Personal Threshold Settings dashboard ────────────────────────────
function AdminThresholds({ selfUid }) {
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
        <span className="cv-adm-kicker">Admin Level Dashboard Configuration</span>
        <h2 className="cv-adm-title">Personal Threshold Settings</h2>
        <p className="cv-adm-sub">
          Edit physical parameter baseline limits. Changes are bundled into a migration payload on save.
        </p>
      </header>

      {/* Client roster dropdown — switch the active athlete's profile. */}
      <div className="cv-adm-field cv-adm-roster">
        <label className="cv-adm-label" htmlFor="cv-adm-athlete">Active Athlete Profile</label>
        <select
          id="cv-adm-athlete"
          className="cv-adm-input cv-adm-select"
          value={activeUid}
          onChange={(e) => onPickAthlete(e.target.value)}
          disabled={!roster.length}
        >
          {!roster.length ? <option value="">{rosterError ? 'Roster unavailable' : 'Loading roster…'}</option> : null}
          {roster.map((c) => (
            <option key={c.uid} value={c.uid}>{c.name || c.uid}</option>
          ))}
        </select>
        {rosterError ? <span className="cv-adm-note is-warn">{rosterError}</span> : null}
      </div>

      {/* Identity */}
      <div className="cv-adm-grid cv-adm-grid-2">
        <Field id="athleteName" label="Athlete / Coach Name" value={form.athleteName} onChange={setField('athleteName')} placeholder="Akeem Brown" />
        <Field id="phaseName" label="Current Phase Name" value={form.phaseName} onChange={setField('phaseName')} placeholder="Phase 4 - Back & Biceps" />
        <Field id="age" label="Age Bracket (Years)" value={form.age} onChange={setField('age')} type="number" placeholder="34" />
        <Field id="restingHr" label="Resting Heart Rate (BPM)" value={form.restingHr} onChange={setField('restingHr')} type="number" placeholder="62" />
      </div>

      {/* Daily macronutrient targets */}
      <div className="cv-adm-section">Daily Macronutrient Targets</div>
      <div className="cv-adm-grid cv-adm-grid-4">
        <Field id="calories" label="Calories (kcal)" value={form.calories} onChange={setField('calories')} type="number" placeholder="2400" />
        <Field id="protein" label="Protein (g)" value={form.protein} onChange={setField('protein')} type="number" placeholder="210" />
        <Field id="carbs" label="Carbohydrates (g)" value={form.carbs} onChange={setField('carbs')} type="number" placeholder="240" />
        <Field id="fats" label="Fats (g)" value={form.fats} onChange={setField('fats')} type="number" placeholder="70" />
      </div>

      {/* Core lifelong lifting milestones (PR) */}
      <div className="cv-adm-section">Core Lifelong Lifting Milestones (PR)</div>
      <div className="cv-adm-grid cv-adm-grid-3">
        <Field id="bench" label="Bench Press (Max lbs)" value={form.bench} onChange={setField('bench')} type="number" placeholder="315" />
        <Field id="squat" label="Olympic Squat (Max lbs)" value={form.squat} onChange={setField('squat')} type="number" placeholder="425" />
        <Field id="deadlift" label="Conventional Deadlift (Max lbs)" value={form.deadlift} onChange={setField('deadlift')} type="number" placeholder="515" />
      </div>

      <div className="cv-adm-actions">
        <button type="submit" className="cv-adm-save">Save Thresholds</button>
        {saved ? (
          <span className="cv-adm-note is-ok">
            Payload emitted to console — schema migration pending (Age · Resting HR · 1RM columns).
          </span>
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
