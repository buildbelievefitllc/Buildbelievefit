// src/components/explorer/GuestCheckInPreview.jsx
// ─────────────────────────────────────────────────────────────────────────────
// GUEST CHECK-IN PREVIEW — the Explorer Mode "Biometric Sync" pane: a
// high-fidelity, READ-ONLY presentational clone of the premium Client Hub
// Check-In (SovereignClientHub.jsx). The guest gets a physical look at the
// tracking ecosystem — the Sovereign Readiness dial, the mode verdict, the
// biometric telemetry strip, the daily directives, and the manual-input
// sliders — with every value pinned to a fixed demo snapshot:
//
//   score 89 · PRIME EXECUTION (engine band: ≥85) · volume ×1.00 · 50C/20F/30P
//
// ARCHITECTURAL RULE (per CEO directive): nothing here is live. No Supabase,
// no vitals pipeline, no Health Connect, no ledger reads, no readiness engine.
// The sliders are throwaway local state (they move, nothing computes), and the
// Save CTA routes to the conversion portal via `onUnlock`. Styling is the
// self-contained `xp-sch-*` clone sheet (explorerPreviews.css); the verdict
// column rides the GLOBAL [data-bbf-mode='prime'] token channel (index.css) so
// the dial glows exactly like the live surface. Localization reuses the SAME
// `sch-*` keys the live Client Hub reads from LangContext — zero string drift.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import './explorerPreviews.css';

const DIAL_R = 56;
const DIAL_C = 2 * Math.PI * DIAL_R;

// The fixed demo snapshot (mirrors the live view-model shape).
const MOCK = {
  score: 89,
  volume: 1.0,
  carb: 50, fat: 20, protein: 30,
  sleep: '7h 42m',
  burn: '540',
  steps: '8,200',
};

const MACRO_COLORS = { carb: '#4dc3ff', fat: '#ffb547', protein: '#ff5d5d' };

// Guest-only chrome + demo directive copy (the live directives are generated
// per-athlete by the readiness engine; these are representative stand-ins).
const L10N = {
  en: {
    stamp: 'Sandbox Preview',
    cardio: 'Cleared for high-intensity work — Zone 4–5 interval window open.',
    directives: [
      'HRV baseline 68.0 ms over 7 ledger days.',
      'Mode PRIME EXECUTION — volume ×1.00, fuel 50C/20F/30P.',
    ],
  },
  es: {
    stamp: 'Vista Previa',
    cardio: 'Autorizado para trabajo de alta intensidad — ventana de intervalos Zona 4–5 abierta.',
    directives: [
      'Línea base de VFC 68.0 ms en 7 días de registro.',
      'Modo EJECUCIÓN ÓPTIMA — volumen ×1.00, combustible 50C/20G/30P.',
    ],
  },
  pt: {
    stamp: 'Prévia',
    cardio: 'Liberado para trabalho de alta intensidade — janela de intervalos Zona 4–5 aberta.',
    directives: [
      'Linha de base de VFC 68.0 ms em 7 dias de registro.',
      'Modo EXECUÇÃO MÁXIMA — volume ×1.00, combustível 50C/20G/30P.',
    ],
  },
};

// The premium ReadinessDial, cloned: SVG arc ring, score core, /100 cap.
function GuestReadinessDial({ score }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="xp-sch-dial">
      <svg className="xp-sch-dial-svg" viewBox="0 0 128 128" aria-hidden="true">
        <circle className="xp-sch-dial-track" cx="64" cy="64" r={DIAL_R} />
        <circle
          className="xp-sch-dial-fill"
          cx="64" cy="64" r={DIAL_R}
          strokeDasharray={`${((pct / 100) * DIAL_C).toFixed(2)} ${DIAL_C.toFixed(2)}`}
        />
      </svg>
      <div className="xp-sch-dial-core">
        <span className="xp-sch-score" data-testid="explorer-sync-score">{score}</span>
        <span className="xp-sch-dial-cap">/ 100</span>
      </div>
    </div>
  );
}

/**
 * GuestCheckInPreview — read-only Client Hub Check-In clone for /explore.
 *
 * @param {object} props
 * @param {() => void} props.onUnlock - the Save CTA routes here (conversion portal)
 */
export default function GuestCheckInPreview({ onUnlock }) {
  const { lang, t } = useLang();
  const L = L10N[lang] || L10N.en;
  // Throwaway sandbox state — the sliders move, nothing computes or persists.
  const [sleepQ, setSleepQ] = useState(8);
  const [stress, setStress] = useState(3);
  const [sleepH, setSleepH] = useState('7.5');
  const [burn, setBurn] = useState('540');
  const [steps, setSteps] = useState('8200');

  const vitals = [
    { k: t('sch-sleep'), v: MOCK.sleep },
    { k: t('sch-burn'), v: MOCK.burn },
    { k: t('sch-steps'), v: MOCK.steps },
  ];
  const macros = [
    { key: 'carb', label: t('sch-carbs'), pct: MOCK.carb },
    { key: 'fat', label: t('sch-fat'), pct: MOCK.fat },
    { key: 'protein', label: t('sch-protein'), pct: MOCK.protein },
  ];

  return (
    <div className="xp-sch" data-testid="explorer-sync-preview">
      <header className="xp-sch-head">
        <div>
          <div className="xp-sch-kicker">{t('sch-kicker')}</div>
          <h3 className="xp-sch-title">{t('sch-title')}</h3>
        </div>
        <span className="xp-sch-stamp">◇ {L.stamp}</span>
      </header>

      {/* The Sovereign Dossier — verdict dial + intel columns, gold prime channel */}
      <div className="xp-sch-dossier" data-bbf-mode="prime">
        <div className="xp-card xp-sch-verdict">
          <div className="xp-sch-label">{t('sch-readiness')}</div>
          <GuestReadinessDial score={MOCK.score} />
          <span className="xp-sch-mode xp-sch-mode--prime" data-testid="explorer-sync-mode">
            {t('sch-mode-prime')}
          </span>
          <div className="xp-sch-volume">
            <span className="xp-sch-volume-k">{t('sch-volume')}</span>
            <span className="xp-sch-volume-v">×{MOCK.volume.toFixed(2)}</span>
          </div>
        </div>

        <div className="xp-sch-intel">
          <div className="xp-card">
            <div className="xp-sch-label">{t('sch-vitals')}</div>
            <div className="xp-sch-vitals">
              {vitals.map((s) => (
                <div key={s.k} className="xp-sch-vital">
                  <span className="xp-sch-vital-k">{s.k}</span>
                  <span className="xp-sch-vital-v">{s.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="xp-card">
            <div className="xp-sch-label">{t('sch-directives')}</div>
            <div className="xp-sch-macro-bar">
              {macros.map((m) => (
                <div key={m.key} className="xp-sch-macro-seg" style={{ width: `${m.pct}%`, background: MACRO_COLORS[m.key] }} />
              ))}
            </div>
            <div className="xp-sch-macro-legend">
              {macros.map((m) => (
                <span key={m.key} className="xp-nl-ratio-key">
                  <span className="xp-nl-ratio-dot" style={{ background: MACRO_COLORS[m.key] }} />
                  {m.label} {m.pct}%
                </span>
              ))}
            </div>
            <p className="xp-sch-cardio"><b>{t('sch-cardio')}:</b> {L.cardio}</p>
            <ol className="xp-sch-log">
              {L.directives.map((d, i) => <li key={i}>{d}</li>)}
            </ol>
          </div>
        </div>
      </div>

      {/* Manual Health Input — the slider form, sandboxed (Save → conversion) */}
      <div className="xp-card" data-testid="explorer-sync-manual">
        <div className="xp-sch-manual-title">{t('sch-mi-title')}</div>
        <p className="xp-sch-body">{t('sch-mi-intro')}</p>
        <div className="xp-sch-mi-grid">
          <label className="xp-sch-field">
            <span className="xp-sch-field-k">{t('sch-mi-sleep-h')}</span>
            <input
              className="xp-sch-num" type="number" min="0" max="24" step="0.5" placeholder="7.5"
              value={sleepH} onChange={(e) => setSleepH(e.target.value)}
            />
          </label>
          <label className="xp-sch-field">
            <span className="xp-sch-field-k">
              {t('sch-mi-sleep-q')} <span className="xp-sch-field-val">{sleepQ}/10</span>
            </span>
            <input
              type="range" min="1" max="10" step="1" className="xp-sch-range"
              value={sleepQ}
              onChange={(e) => setSleepQ(Number(e.target.value))}
              aria-valuetext={`${sleepQ} / 10`}
              data-testid="explorer-sync-sleep-q"
            />
          </label>
          <label className="xp-sch-field">
            <span className="xp-sch-field-k">
              {t('sch-mi-stress')} <span className="xp-sch-field-val">{stress}/10</span>
            </span>
            <input
              type="range" min="1" max="10" step="1" className="xp-sch-range"
              value={stress}
              onChange={(e) => setStress(Number(e.target.value))}
              aria-valuetext={`${stress} / 10`}
              data-testid="explorer-sync-stress"
            />
          </label>
          <label className="xp-sch-field">
            <span className="xp-sch-field-k">{t('sch-mi-burn')}</span>
            <input
              className="xp-sch-num" type="number" min="0" max="20000" step="10" placeholder="350"
              value={burn} onChange={(e) => setBurn(e.target.value)}
            />
          </label>
          <label className="xp-sch-field">
            <span className="xp-sch-field-k">{t('sch-mi-steps')}</span>
            <input
              className="xp-sch-num" type="number" min="0" max="200000" step="100" placeholder="8,000"
              value={steps} onChange={(e) => setSteps(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className="xp-sch-save" onClick={onUnlock} data-testid="explorer-sync-save">
          {t('sch-mi-save')} 🔒
        </button>
        <p className="xp-sch-mi-hint">{t('sch-mi-hint')}</p>
      </div>
    </div>
  );
}
