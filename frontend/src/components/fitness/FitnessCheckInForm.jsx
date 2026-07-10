// src/components/fitness/FitnessCheckInForm.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.4 — the daily set logger (PREHAB_RECOVERY_LOOP §1.3).
//
// Captures movement_vector · weight_lbs · reps · rpe, shows the LIVE integer-gram
// conversion (load_g = round(weight_lbs · 453.59237)) as a real-time validation
// indicator, and — per the Gram Boundary — SUBMITS weight_lbs (the bbf_sets.load_g
// column is generated server-side; pounds die at the DB boundary, exactly the
// Phase 2.2 cast). movement_vector is UI context (no bbf_sets column) and rides the
// exercise_key so the athlete keeps it.
//
// AUTH: standard Vault Token API — bbf_sync_vault_session(p_uid, p_session_token,
// p_session, p_sets), the same durable RPC the Floor logger flushes to.
// TRILINGUAL: all chrome resolves through useFitnessStr by preferred_locale.

import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient.js';
import { useAuth, getStoredVaultToken } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { useFitnessStr, computeLoadG, formatGrams, MOVEMENT_VECTORS } from './fitnessStrings.js';
import { GuideLauncher } from '../BbfMediaPortal.jsx';
import './fitness.css';

function todayISO() { return new Date().toISOString().slice(0, 10); }

export default function FitnessCheckInForm() {
  const { fs, lang } = useFitnessStr();
  const { lang: uiLang } = useLang();
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';

  const [vector, setVector] = useState(MOVEMENT_VECTORS[0]);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState(7);
  const [sets, setSets] = useState([]); // { vector, weightLbs, reps, rpe, loadG }
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { kind:'ok'|'err', msg }

  // Live integer-gram conversion of the current input — the validation indicator.
  const liveLoadG = computeLoadG(weight);
  const weightOk = weight !== '' && liveLoadG !== null;
  const repsOk = reps !== '' && Number(reps) > 0;

  function addSet() {
    if (!weightOk || !repsOk) return;
    setSets((s) => [...s, { vector, weightLbs: Number(weight), reps: Math.round(Number(reps)), rpe: Math.round(Number(rpe)), loadG: liveLoadG }]);
    setWeight(''); setReps('');
    setStatus(null);
  }

  function removeSet(i) { setSets((s) => s.filter((_, idx) => idx !== i)); }

  async function logSession() {
    if (busy || !sets.length) return;
    const token = getStoredVaultToken();
    if (!uid || !token) { setStatus({ kind: 'err', msg: fs.signInFirst }); return; }
    setBusy(true);
    setStatus(null);

    const dayKey = `ci-${todayISO()}`;
    const p_sets = sets.map((s, i) => ({
      day_key: dayKey,
      exercise_key: `vec_${s.vector}`,   // movement_vector context (no bbf_sets column)
      set_number: i + 1,
      reps: s.reps,
      weight_lbs: s.weightLbs,           // GRAM BOUNDARY: submit lbs; DB generates load_g
      rpe: s.rpe,
    }));

    try {
      const { data, error } = await supabase.rpc('bbf_sync_vault_session', {
        p_uid: String(uid).trim().toLowerCase(),
        p_session_token: token,
        p_session: { date: todayISO(), day_key: dayKey, drill_name: 'daily_check_in', language: uiLang },
        p_sets,
      });
      if (error || !data?.ok) { setStatus({ kind: 'err', msg: fs.logError }); }
      else { setSets([]); setStatus({ kind: 'ok', msg: fs.logged }); }
    } catch {
      setStatus({ kind: 'err', msg: fs.logError });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="ft-card" data-testid="fitness-checkin" aria-label={fs.fitTitle}>
      <header className="ft-head">
        <span className="ft-kicker">{fs.fitKicker}</span>
        <h3 className="ft-title">{fs.fitTitle}</h3>
      </header>

      {/* 4K module guide — high-visibility intro banner before the screening fields. */}
      <GuideLauncher module="weekly_checkin" testId="checkin-guide" />

      <div className="ft-inputs">
        <label className="ft-field ft-field--vector">
          <span className="ft-label">{fs.vector}</span>
          <select className="ft-select" value={vector} onChange={(e) => setVector(e.target.value)}>
            {MOVEMENT_VECTORS.map((v) => <option key={v} value={v}>{fs.vectors[v]}</option>)}
          </select>
        </label>

        <label className="ft-field">
          <span className="ft-label">{fs.weight} <span className="ft-unit">{fs.weightUnit}</span></span>
          <input className="ft-input" type="number" min="0" step="0.5" inputMode="decimal" value={weight}
            onChange={(e) => setWeight(e.target.value)} placeholder="135" aria-label={`${fs.weight} (${fs.weightUnit})`} />
        </label>

        <label className="ft-field ft-field--sm">
          <span className="ft-label">{fs.reps}</span>
          <input className="ft-input" type="number" min="1" step="1" inputMode="numeric" value={reps}
            onChange={(e) => setReps(e.target.value)} placeholder="8" aria-label={fs.reps} />
        </label>

        <label className="ft-field ft-field--sm">
          <span className="ft-label">{fs.rpe}</span>
          <select className="ft-select" value={rpe} onChange={(e) => setRpe(Number(e.target.value))} aria-label={fs.rpe}>
            {[5, 6, 7, 8, 9, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* live load_g validation indicator — the Gram Boundary, real-time */}
      <div className={`ft-load${weightOk ? ' is-live' : ''}`} aria-live="polite">
        <span className="ft-load-label">{fs.loadPreview}</span>
        <span className="ft-load-value">{weightOk ? formatGrams(liveLoadG, lang) : '—'}</span>
      </div>

      <button type="button" className="ft-add" onClick={addSet} disabled={!weightOk || !repsOk}>
        {fs.addSet}
      </button>

      {sets.length ? (
        <ul className="ft-setlist">
          {sets.map((s, i) => (
            <li key={i} className="ft-setrow">
              <span className="ft-set-vec">{fs.vectors[s.vector]}</span>
              <span className="ft-set-detail">{fs.setLine(s.reps, s.weightLbs)} · RPE {s.rpe}</span>
              <span className="ft-set-load">{formatGrams(s.loadG, lang)}</span>
              <button type="button" className="ft-set-rm" onClick={() => removeSet(i)} aria-label={fs.removeSet}>✕</button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ft-empty">{fs.noSets}</div>
      )}

      <button type="button" className="ft-log" onClick={logSession} disabled={busy || !sets.length}>
        {busy ? fs.logging : fs.logSession(sets.length)}
      </button>

      {status ? <div className={`ft-status is-${status.kind}`} role="status">{status.msg}</div> : null}
    </section>
  );
}
