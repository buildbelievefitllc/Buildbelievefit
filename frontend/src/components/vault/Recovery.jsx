// src/components/vault/Recovery.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The dedicated Recovery vault tab — the full 3-Phase Sovereign Prep sequence as
// its own section (distinct from the quick-launch button in the Active Directive
// card; both call bbf-agentic-recovery and render the shared <SovereignPrepPanels>).
//
// Auto-loads on mount: resolves the athlete's T-0 (today) / T-1 (yesterday) muscle
// loads from the rotated plan queue, then fetches the prep envelope. `loading` is
// SEEDED true and the effect mutates state ONLY inside the promise callbacks —
// clear of react-hooks/set-state-in-effect (mirrors vaultApi.useVaultProfile).
// A retry bumps reloadKey to re-run the effect.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { parseWorkoutPlan } from '../../lib/vaultApi.js';
import { getProgram } from './programData.js';
import { resolvePrepLoads, generateSovereignPrep } from '../../lib/sovereignPrep.js';
import SovereignPrepPanels from './SovereignPrepPanels.jsx';
import { SequenceNext } from './SovereignSequence.jsx';
import CoachVoiceNote from './CoachVoiceNote.jsx';
import './sovereignPrep.css';

export default function Recovery({ plans = null, onSequence }) {
  const { user } = useAuth();
  const { t } = useLang();
  const uid = user?.username || user?.id || '';
  const programKey = user?.programKey || '';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loads = useMemo(() => {
    const assigned = parseWorkoutPlan(plans?.workoutPlan || '');
    const plan = Array.isArray(assigned) && assigned.length ? assigned : getProgram(programKey);
    return resolvePrepLoads(plan);
  }, [plans?.workoutPlan, programKey]);

  useEffect(() => {
    let cancelled = false;
    generateSovereignPrep({ uid, today: loads.today, yesterday: loads.yesterday })
      .then((res) => { if (!cancelled) { setData(res); setError(null); } })
      .catch((e) => { if (!cancelled) setError((e && e.message) || 'Could not generate your prep.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [uid, loads, reloadKey]);

  // Retry — state mutated in the event handler (not an effect), then re-run.
  const onRetry = () => { setError(null); setLoading(true); setReloadKey((k) => k + 1); };

  return (
    <section className="sp-section" data-testid="vault-recovery">
      <header className="sp-section-head">
        <div className="sp-kicker">{t('sp-kicker')}</div>
        <h2 className="sp-title">{t('sp-title')}</h2>
        <p className="sp-section-sub">{t('sp-section-sub')}</p>
      </header>

      {/* FRONT 4 · "Breaking the Loop" — The Primer: CNS wake-up framing, top of Recovery. */}
      <CoachVoiceNote module="primer" />

      {loading ? (
        <div className="sp-state" data-testid="sp-loading">
          <span className="sp-spinner" aria-hidden="true" />
          <p>{t('sp-loading')}</p>
        </div>
      ) : error ? (
        <div className="sp-state sp-state--error" role="alert" data-testid="sp-error">
          <p>{error}</p>
          <button type="button" className="sp-retry" onClick={onRetry}>{t('sp-retry')}</button>
        </div>
      ) : (
        <SovereignPrepPanels data={data} />
      )}

      {/* Sovereign Sequence · Step 3 — bottom of Recovery → the Program floor.
          Adult-only (gated on onSequence; the Command Center / prep overlay pass none). */}
      {onSequence ? (
        <SequenceNext label="Step 3: Enter the Floor (Program) ➔" onClick={() => onSequence('program')} testid="sovereign-step-3" />
      ) : null}
    </section>
  );
}
