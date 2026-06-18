// src/components/vault/SovereignPrepOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 3-Phase Sovereign Prep overlay — a full-screen modal rendering the
// bbf-agentic-recovery envelope as a tab DECK (CLAUDE.md §10: modular tabs, never
// a tall vertical scroll). Only the active phase panel mounts.
//
//   Phase 1 · Tissue Release       → foam_rolling      (no emphasis)
//   Phase 2 · Static Elongation    → recovery_stretches (emphasis = yesterday)
//   Phase 3 · Dynamic Potentiation → prep_drills        (emphasis = today)
//
// emphasis_flag === true items are highlighted (ringed card + "Essential" tag) and
// already arrive sorted to the top of their phase by the edge function.
//
// Pure presentational: the parent owns the fetch + open/close state.

import { useCallback, useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './sovereignPrep.css';

const PHASES = [
  { id: 'release',  idx: '01', key: 'foam_rolling',       labelKey: 'sp-phase1', subKey: 'sp-phase1-sub' },
  { id: 'static',   idx: '02', key: 'recovery_stretches', labelKey: 'sp-phase2', subKey: 'sp-phase2-sub' },
  { id: 'dynamic',  idx: '03', key: 'prep_drills',        labelKey: 'sp-phase3', subKey: 'sp-phase3-sub' },
];

// Phase-specific prescription line. Each library family carries a different shape:
//   static → { light, standard, deep } seconds   drills → { reps, tempo }
//   foam   → { passes, dwell, timing }
function Prescription({ phaseId, prescription, t }) {
  const p = prescription || {};
  if (phaseId === 'static') {
    const seg = (k, lbl) => (p[k] != null ? <span className="sp-rx-seg" key={k}><em>{lbl}</em> {p[k]}s</span> : null);
    return (
      <div className="sp-rx">
        {seg('light', t('sp-hold-light'))}
        {seg('standard', t('sp-hold-standard'))}
        {seg('deep', t('sp-hold-deep'))}
      </div>
    );
  }
  if (phaseId === 'dynamic') {
    return (
      <div className="sp-rx">
        {p.reps ? <span className="sp-rx-seg"><em>{t('sp-reps')}</em> {p.reps}</span> : null}
        {p.tempo ? <span className="sp-rx-seg"><em>{t('sp-tempo')}</em> {p.tempo}</span> : null}
      </div>
    );
  }
  // release / foam
  return (
    <div className="sp-rx">
      {p.passes ? <span className="sp-rx-seg"><em>{t('sp-passes')}</em> {p.passes}</span> : null}
      {p.dwell ? <span className="sp-rx-seg"><em>{t('sp-dwell')}</em> {p.dwell}</span> : null}
      {p.timing ? <span className="sp-rx-seg"><em>{t('sp-timing')}</em> {p.timing}</span> : null}
    </div>
  );
}

// Pretty-print a snake_case muscle group → "Hip Adductors".
function groupLabel(g) {
  return String(g || '').split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function PrepCard({ item, phaseId, t }) {
  const emphasis = item.emphasis_flag === true;
  const cues = item.cues || {};
  return (
    <li className={`sp-card${emphasis ? ' is-essential' : ''}`} data-testid="sp-card">
      <div className="sp-card-head">
        <div className="sp-card-titles">
          <span className="sp-card-name">{item.name}</span>
          <span className="sp-card-meta">
            {groupLabel(item.muscle_group)}
            {item.tool ? ` · ${groupLabel(item.tool)}` : ''}
          </span>
        </div>
        {emphasis ? <span className="sp-tag" data-testid="sp-essential-tag">{t('sp-essential')}</span> : null}
      </div>

      <Prescription phaseId={phaseId} prescription={item.prescription} t={t} />

      <dl className="sp-cues">
        {cues.breathing ? (
          <div className="sp-cue"><dt>{t('sp-cue-breathing')}</dt><dd>{cues.breathing}</dd></div>
        ) : null}
        {cues.form ? (
          <div className="sp-cue"><dt>{t('sp-cue-form')}</dt><dd>{cues.form}</dd></div>
        ) : null}
        {cues.intensity ? (
          <div className="sp-cue"><dt>{t('sp-cue-intensity')}</dt><dd>{cues.intensity}</dd></div>
        ) : null}
      </dl>
    </li>
  );
}

export default function SovereignPrepOverlay({ open, loading, error, data, onClose, onRetry }) {
  const { t } = useLang();
  const [active, setActive] = useState('release');

  // Esc closes; lock body scroll while open.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  const stop = useCallback((e) => e.stopPropagation(), []);
  if (!open) return null;

  const activePhase = PHASES.find((p) => p.id === active) || PHASES[0];
  const items = data && Array.isArray(data[activePhase.key]) ? data[activePhase.key] : [];

  return (
    <div className="sp-scrim" role="dialog" aria-modal="true" aria-label={t('sp-title')} onClick={onClose} data-testid="sovereign-prep-overlay">
      <div className="sp-shell" onClick={stop}>
        <header className="sp-head">
          <div>
            <div className="sp-kicker">{t('sp-kicker')}</div>
            <h2 className="sp-title">{t('sp-title')}</h2>
          </div>
          <button type="button" className="sp-x" onClick={onClose} aria-label={t('sp-close')} data-testid="sp-close">×</button>
        </header>

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
          <>
            {/* ── Tab deck — numbered bar over a single active panel (§10) ── */}
            <div className="sp-tabs" role="tablist" aria-label={t('sp-title')}>
              {PHASES.map((p) => {
                const on = p.id === active;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    className={`sp-tab${on ? ' is-active' : ''}`}
                    onClick={() => setActive(p.id)}
                    data-testid={`sp-tab-${p.id}`}
                  >
                    <span className="sp-tab-idx">{p.idx}</span>
                    <span className="sp-tab-text">
                      <span className="sp-tab-label">{t(p.labelKey)}</span>
                      <span className="sp-tab-sub">{t(p.subKey)}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="sp-panel" role="tabpanel">
              {items.length ? (
                <ul className="sp-list">
                  {items.map((it) => <PrepCard key={it.id} item={it} phaseId={activePhase.id} t={t} />)}
                </ul>
              ) : (
                <p className="sp-empty">{t('sp-empty')}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
