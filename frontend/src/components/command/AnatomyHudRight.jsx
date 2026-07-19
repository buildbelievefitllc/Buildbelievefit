// src/components/command/AnatomyHudRight.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Biomechanical Viewer · RIGHT HUD — the selection detail card (biomechanical
// assessment + OT-informed prehab protocols) and the LOCKED scope disclaimer.
// `segment` is the localized record (or null → the empty invitation state).

export default function AnatomyHudRight({ open = true, segment }) {
  return (
    <div className={`av-right${open ? '' : ' is-collapsed'}`} aria-hidden={!open}>
      <div className="av-panel av-detail">
        {!segment ? (
          <div className="av-detail-empty" data-testid="av-detail-empty">
            <span className="av-detail-empty-ic" aria-hidden="true">☝</span>
            <h3>Interactive Viewport</h3>
            <p>Click any joint or myofascial segment in the 3D viewport to inspect biomechanical cues, injury-prevention metrics, and OT-informed prehab protocols.</p>
          </div>
        ) : (
          <div className="av-detail-body" data-testid="av-detail-content">
            <div className="av-detail-head">
              <span className="av-detail-cat" data-testid="av-detail-category">{segment.category}</span>
              <h2 className="av-detail-title" data-testid="av-detail-title">{segment.title}</h2>
              <p className="av-detail-latin">{segment.latin}</p>
            </div>

            <div>
              <h4 className="av-detail-h">◆ Biomechanical Assessment</h4>
              <p className="av-detail-desc">{segment.desc}</p>
            </div>

            <div className="av-detail-grow">
              <h4 className="av-detail-h">✚ OT-Informed Prehab &amp; Joint Safety</h4>
              <ol className="av-prehab">
                {segment.prehab.map((step, i) => (
                  <li key={i} className="av-prehab-step">
                    <span className="av-prehab-n">{i + 1}</span>
                    <span className="av-prehab-t" data-testid={`av-prehab-${i + 1}`}>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* LOCKED OT scope disclaimer — always visible, never removed. */}
        <div className="av-scope" data-testid="av-scope">
          <strong>⚠ Scope Disclaimer:</strong> OT-informed coaching metrics are for recovery mapping. Do not diagnose injuries.
        </div>
      </div>
    </div>
  );
}
