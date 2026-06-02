// src/components/vault/HypertrophyBalance.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 23.2 — Hypertrophy Balance Analyzer. Replaces the obsolete Sovereign
// Sentinel canvas wireframe at the top of the Training Protocol. Surfaces weekly
// VOLUME-RATIO per muscle group (Chest, Shoulders, Back, Legs, Arms, Core) against
// an evidence-based optimal set band, flagging under/over-trained groups so the
// athlete keeps their physique balanced.
//
// Data is a static placeholder for now (flagged below) — a future phase wires the
// per-group set counts from bbf_sets. Pure presentation, LOCKED brand (purple/gold).

import './vault.css';

// Weekly working-set volume vs. the optimal hypertrophy band per group.
// STATIC PLACEHOLDER — replace with live bbf_sets aggregation in a later phase.
const MUSCLE_VOLUME = [
  { group: 'Chest', sets: 14, min: 12, max: 20 },
  { group: 'Back', sets: 18, min: 14, max: 22 },
  { group: 'Shoulders', sets: 10, min: 12, max: 18 },
  { group: 'Legs', sets: 16, min: 14, max: 22 },
  { group: 'Arms', sets: 9, min: 8, max: 16 },
  { group: 'Core', sets: 6, min: 6, max: 12 },
];

const STATUS = {
  under: { label: 'Under', color: '#F59E0B' },
  optimal: { label: 'Optimal', color: 'var(--grn)' },
  over: { label: 'Over', color: '#FF4500' },
};

function statusOf(sets, min, max) {
  if (sets < min) return 'under';
  if (sets > max) return 'over';
  return 'optimal';
}

export default function HypertrophyBalance() {
  // Shared scale so every bar reads on the same axis.
  const scaleMax = Math.max(...MUSCLE_VOLUME.map((m) => Math.max(m.sets, m.max))) || 1;
  const optimalCount = MUSCLE_VOLUME.filter((m) => statusOf(m.sets, m.min, m.max) === 'optimal').length;
  const balanceIndex = Math.round((optimalCount / MUSCLE_VOLUME.length) * 100);

  return (
    <section className="hba" aria-label="Hypertrophy balance analyzer">
      <div className="hba-head">
        <div>
          <div className="hba-kicker">Hypertrophy Balance Analyzer</div>
          <div className="hba-sub">Weekly working-set volume vs. the optimal hypertrophy band</div>
        </div>
        <div className="hba-index">
          <span className="hba-index-val">{balanceIndex}<span className="hba-index-pct">%</span></span>
          <span className="hba-index-lbl">Balance Index</span>
        </div>
      </div>

      <div className="hba-rows">
        {MUSCLE_VOLUME.map((m) => {
          const st = statusOf(m.sets, m.min, m.max);
          const meta = STATUS[st];
          const fill = Math.min(100, (m.sets / scaleMax) * 100);
          const bandL = (m.min / scaleMax) * 100;
          const bandR = (m.max / scaleMax) * 100;
          return (
            <div className="hba-row" key={m.group}>
              <span className="hba-row-name">{m.group}</span>
              <div className="hba-track" role="img" aria-label={`${m.group}: ${m.sets} sets, ${meta.label}`}>
                {/* optimal band marker */}
                <span className="hba-band" style={{ left: `${bandL}%`, width: `${bandR - bandL}%` }} />
                <span className="hba-fill" style={{ width: `${fill}%`, background: meta.color }} />
              </div>
              <span className="hba-row-sets">{m.sets}<span className="hba-row-unit"> sets</span></span>
              <span className="hba-row-status" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
