// src/components/vault/SovereignPrepOverlay.jsx
// ─────────────────────────────────────────────────────────────────────────────
// The 3-Phase Sovereign Prep overlay — a full-screen modal launched from the
// "SOVEREIGN PREP" button in the Active Directive card. Modal chrome only; the
// actual phase deck is the shared <SovereignPrepPanels> (same renderer the
// dedicated Recovery tab uses). Parent owns the fetch + open/close state.

import { useCallback, useEffect } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import SovereignPrepPanels from './SovereignPrepPanels.jsx';
import './sovereignPrep.css';

export default function SovereignPrepOverlay({ open, loading, error, data, onClose, onRetry }) {
  const { t } = useLang();

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
          <SovereignPrepPanels data={data} />
        )}
      </div>
    </div>
  );
}
