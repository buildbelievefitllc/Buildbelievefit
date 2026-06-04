// src/components/vault/HypertrophyBalanceAnalyzer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Command Center — Hypertrophy Balance Analyzer.
//
// The admin/coach counterpart to the client Vault's Sovereign Sentinel. Where the
// Sentinel shows the athlete a kinetic blueprint, the Analyzer gives the coach a
// brutalist read-out of weekly set-volume distribution across muscle groups —
// the "volume ratio" of the assigned program — so imbalances are visible at a
// glance from the Command Center's Program tab.
//
// NOTE: this is a PRESENTATION component on STATIC MOCK DATA. There is no live
// volume-ratio data source yet; the values below are placeholders pending the
// real per-program aggregation. Conditionally rendered for admins only (see
// Program.jsx) so the client Vault keeps the Sentinel untouched.

import { useLang } from '../../context/LangContext.jsx';
import { localizeMuscle } from '../../lib/trainingI18n.js';
import './vault.css';

// Mock volume-ratio indicators (share of weekly working sets per muscle group).
// Ordered high → low so the dominant movers read first.
const VOLUME_RATIO = [
  { muscle: 'Back', pct: 33 },
  { muscle: 'Shoulders', pct: 33 },
  { muscle: 'Quads', pct: 20 },
  { muscle: 'Hamstrings / Glutes', pct: 13 },
  { muscle: 'Core', pct: 13 },
  { muscle: 'Chest', pct: 7 },
  { muscle: 'Arms', pct: 7 },
  { muscle: 'Calves', pct: 7 },
];

export default function HypertrophyBalanceAnalyzer() {
  const { lang } = useLang();
  return (
    <div className="hba">
      <div className="hba-kicker">Volume Ratio</div>
      <div className="hba-head">
        <h3 className="hba-title">Hypertrophy Balance Analyzer</h3>
        <span className="hba-sub">Weekly set distribution</span>
      </div>

      <div className="hba-bars" role="list">
        {VOLUME_RATIO.map(({ muscle, pct }) => {
          const label = localizeMuscle(muscle, lang);
          return (
            <div className="hba-row" role="listitem" key={muscle}>
              <span className="hba-muscle">{label}</span>
              <div className="hba-track" aria-hidden="true">
                <div className="hba-fill" style={{ width: `${pct}%` }} />
              </div>
              <span
                className="hba-pct"
                role="img"
                aria-label={`${label}: ${pct}%`}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>

      <div className="hba-foot">Static reference — live program aggregation pending</div>
    </div>
  );
}
