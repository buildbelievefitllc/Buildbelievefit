// src/components/command/AnatomyHudLeft.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Biomechanical Viewer · LEFT HUD — System Overlays (layer toggles) + the CNS
// Autoregulator (readiness → volume). Pure React/CSS (no WebGL), so it's fully
// verifiable on its own. Dynamic CNS state/instruction is trilingual via the hook.

const SYSTEMS = [
  { key: 'skeletal', label: 'Axial Skeletal Frame', dot: '#38bdf8' },
  { key: 'muscular', label: 'Myofascial Muscle Belts', dot: '#ef4444' },
  { key: 'neurological', label: 'CNS Readiness Uplink', dot: '#f5c800' },
];

export default function AnatomyHudLeft({ open = true, systems, onToggle, cns, onInjectPrehab, regions = [], activeRegion = '', onSelectRegion }) {
  return (
    <div className={`av-left${open ? '' : ' is-collapsed'}`} aria-hidden={!open}>
      {/* SYSTEM OVERLAYS */}
      <section className="av-panel">
        <h3 className="av-panel-h">▚ System Overlays</h3>
        <div className="av-toggles">
          {SYSTEMS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`av-toggle${systems[s.key] ? ' is-on' : ''}`}
              onClick={() => onToggle(s.key)}
              aria-pressed={systems[s.key]}
              data-testid={`av-toggle-${s.key}`}
            >
              <span className="av-toggle-name"><span className="av-dot" style={{ background: s.dot }} />{s.label}</span>
              <span className="av-toggle-eye">{systems[s.key] ? '◉' : '◯'}</span>
            </button>
          ))}
        </div>

        {/* SYSTEM DIRECTORY — jump the camera to a physiological region */}
        {regions.length ? (
          <div className="av-jump">
            <label className="av-field-lbl" htmlFor="av-jump-region">↴ Jump to Region</label>
            <select
              id="av-jump-region"
              className="av-jump-select"
              value={activeRegion}
              onChange={(e) => onSelectRegion?.(e.target.value)}
              data-testid="av-jump-region"
            >
              <option value="">Select a region…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        ) : null}
      </section>

      {/* CNS AUTOREGULATOR */}
      <section className="av-panel av-panel--grow">
        <h3 className="av-panel-h">♥ CNS Autoregulator</h3>
        <p className="av-panel-lead">Enter your morning CNS readiness / HRV score to automatically adjust daily volume targets.</p>

        <label className="av-field-lbl" htmlFor="av-cns-score">Readiness Score (1 – 10)</label>
        <div className="av-cns-row">
          <input
            id="av-cns-score"
            type="number"
            min="1"
            max="10"
            value={cns.score}
            onChange={(e) => cns.setScore(e.target.value)}
            className="av-cns-num"
            data-testid="av-cns-score"
          />
          <input
            type="range"
            min="1"
            max="10"
            value={cns.score}
            onChange={(e) => cns.setScore(e.target.value)}
            className="av-cns-slider"
            aria-label="Readiness score slider"
            data-testid="av-cns-slider"
          />
        </div>

        <div className="av-cns-readout">
          <div className="av-cns-line">
            <span className="av-cns-k">Vol Multiplier:</span>
            <span className="av-cns-mult" data-testid="av-cns-multiplier">{cns.multiplier}x</span>
          </div>
          <div className="av-cns-line">
            <span className="av-cns-k">CNS State:</span>
            <span className="av-cns-state" style={{ color: cns.color }} data-testid="av-cns-state">{cns.stateLabel}</span>
          </div>
          <p className="av-cns-instruction" data-testid="av-cns-instruction">{cns.instruction}</p>
        </div>

        <button type="button" className="av-inject" onClick={onInjectPrehab} data-testid="av-inject-prehab">
          ✚ Inject Readiness Prehab
        </button>
      </section>
    </div>
  );
}
