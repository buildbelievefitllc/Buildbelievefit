// src/components/vault/CalibrationMilestones.jsx
// ─────────────────────────────────────────────────────────────────────────────
// One-time calibration milestone surfacing, mounted at the Vault shell so it overlays
// any tab. Two events, each fired EXACTLY ONCE per athlete:
//   • Day 15 — a dismissible toast: "Phase 10 Smart Cardio unlocked…"
//   • Day 30 — a full-screen congratulatory overlay: "Calibration Complete…"
//
// NO RETROACTIVE SPAM: a per-uid `firstSeenDay` baseline is recorded the first time
// this athlete is observed. A milestone only fires if the athlete was first seen
// BEFORE its threshold (i.e. we actually watched them cross it). An established user
// who arrives already past Day 15/30 silently baselines and never gets a surprise
// celebration. Flags persist in localStorage so each event survives reloads but never
// repeats.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCalibration } from '../../lib/useCalibration.js';
import { IGNITION_DAY, SOVEREIGN_DAY } from '../../lib/calibration.js';
import './calibration.css';

const STORE_KEY = 'bbf.calibration.v1';

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch { return {}; }
}
function writeStore(obj) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch { /* storage blocked */ }
}

export default function CalibrationMilestones() {
  const { t } = useLang();
  const { user } = useAuth();
  const cal = useCalibration();
  const uid = String(user?.username || user?.id || '').toLowerCase();
  const [active, setActive] = useState(null); // 15 | 30 | null

  useEffect(() => {
    if (!uid || !cal.hasAnchor || !Number.isFinite(cal.day)) return;
    const store = readStore();
    const rec = { ...(store[uid] || {}) };
    let changed = false;

    // Baseline the first day we ever observe this athlete — the anchor that prevents
    // retroactive fires for users who arrive already past a threshold.
    if (rec.firstSeenDay == null) { rec.firstSeenDay = cal.day; changed = true; }

    let toShow = null;
    if (cal.day >= SOVEREIGN_DAY && !rec.seen30) {
      if (rec.firstSeenDay < SOVEREIGN_DAY) toShow = 30; // only if we watched them cross it
      rec.seen30 = true;
      if (!rec.seen15) rec.seen15 = true; // crossing 30 makes the 15 toast moot
      changed = true;
    } else if (cal.day >= IGNITION_DAY && !rec.seen15) {
      if (rec.firstSeenDay < IGNITION_DAY) toShow = 15;
      rec.seen15 = true;
      changed = true;
    }

    if (changed) { store[uid] = rec; writeStore(store); }
    // Milestone firing is an external-system subscription: we read the per-uid seen
    // flags from localStorage and surface a one-time alert from them — the sanctioned
    // "setState from an external read" effect, not a render-derivable value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (toShow) setActive(toShow);
  }, [uid, cal.hasAnchor, cal.day]);

  // The Day-15 toast auto-dismisses; the Day-30 celebration waits for the athlete.
  useEffect(() => {
    if (active !== 15) return undefined;
    const id = setTimeout(() => setActive(null), 12000);
    return () => clearTimeout(id);
  }, [active]);

  if (!active) return null;

  if (active === 30) {
    return (
      <div
        className="cal-cele"
        role="dialog"
        aria-modal="true"
        aria-label={t('cal-m30-title')}
        data-testid="calibration-celebration"
      >
        <div className="cal-cele__scrim" onClick={() => setActive(null)} />
        <div className="cal-cele__card" role="document">
          <div className="cal-cele__mark" aria-hidden="true">★</div>
          <h2 className="cal-cele__title">{t('cal-m30-title')}</h2>
          <p className="cal-cele__body">{t('cal-m30-body')}</p>
          <button type="button" className="cal-cele__cta" onClick={() => setActive(null)}>
            {t('cal-dismiss')}
          </button>
        </div>
      </div>
    );
  }

  // Day 15 — dismissible banner toast.
  return (
    <div className="cal-toast" role="status" aria-live="polite" data-testid="calibration-toast">
      <div className="cal-toast__body">
        <span className="cal-toast__title">{t('cal-m15-title')}</span>
        <span className="cal-toast__text">{t('cal-m15-body')}</span>
      </div>
      <button
        type="button"
        className="cal-toast__x"
        aria-label={t('cal-dismiss')}
        onClick={() => setActive(null)}
      >
        ×
      </button>
    </div>
  );
}
