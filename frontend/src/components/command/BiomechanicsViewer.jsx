// src/components/command/BiomechanicsViewer.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Anatomy Arena · 3D BIOMECHANICAL VIEWER — the surface that composes the (lazy,
// code-split) WebGL viewport with the native-React HUD: header + language, the
// left System/CNS panel, the right detail card, and the console footer.
//
// The WebGL module is lazy-loaded so three/drei never enter the main bundle, and
// wrapped in an error boundary so the HUD stays fully usable (and testable) even
// where WebGL can't initialize. Trilingual via the shared manifest + CNS hook.

import { Component, Suspense, lazy, useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { localizedSegment, ANATOMY_REGIONS, regionById } from './anatomyViewerData.js';
import { useCnsAutoregulator } from './useCnsAutoregulator.js';
import AnatomyHudLeft from './AnatomyHudLeft.jsx';
import AnatomyHudRight from './AnatomyHudRight.jsx';
import './anatomyViewer.css';

const AnatomyViewport3D = lazy(() => import('./AnatomyViewport3D.jsx'));

// Keeps the HUD alive if the WebGL layer throws (no GPU / headless / init fail).
class CanvasBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* non-fatal — HUD remains usable */ }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const LANGS = ['en', 'es', 'pt'];

export default function BiomechanicsViewer() {
  const ctx = useLang();
  const [lang, setLang] = useState(() => (LANGS.includes(ctx?.lang) ? ctx.lang : 'en'));
  const [activeSegment, setActiveSegment] = useState(null);
  const [systems, setSystems] = useState({ skeletal: true, muscular: true, neurological: true });
  const [resetSignal, setResetSignal] = useState(0);
  const [leftOpen, setLeftOpen] = useState(true);   // collapse the System Overlays rail
  const [rightOpen, setRightOpen] = useState(true);  // collapse the detail rail
  const [region, setRegion] = useState('');          // "Jump to Region" directory selection
  const [focusNonce, setFocusNonce] = useState(0);   // bumps to re-trigger a region camera focus
  const cns = useCnsAutoregulator(lang, 8);

  const segment = useMemo(() => (activeSegment ? localizedSegment(lang, activeSegment) : null), [lang, activeSegment]);
  const regionRec = useMemo(() => regionById(region), [region]);

  const toggleSystem = (key) => setSystems((s) => ({ ...s, [key]: !s[key] }));
  const resetCamera = () => { setActiveSegment(null); setRegion(''); setResetSignal((n) => n + 1); };
  const injectReadinessPrehab = () => {
    setActiveSegment(cns.score >= 8 ? 'hip' : cns.score >= 5 ? 'shoulder' : 'lumbar');
  };
  // Jump to a physiological region: focus the camera on its slab (imperative Bounds
  // fit) and light up its primary joint node + detail card. Empty → clears focus.
  const selectRegion = (id) => {
    const rec = regionById(id);
    setRegion(rec ? id : '');
    if (rec) { setActiveSegment(rec.primary); setFocusNonce((n) => n + 1); }
  };

  const statusText = segment ? `Focused Complex: ${segment.title}` : 'Sovereign WebGL Active (Procedural Joints Ready)';

  return (
    <div className="av-root" data-testid="biomechanics-viewer">
      <div className="av-stage">
        <CanvasBoundary fallback={<div className="av-canvas-fallback" data-testid="av-canvas-fallback">3D viewport unavailable in this environment — HUD active.</div>}>
          <Suspense fallback={<div className="av-canvas-fallback">Booting Sovereign WebGL…</div>}>
            <AnatomyViewport3D
              systems={systems}
              activeSegment={activeSegment}
              onSelect={setActiveSegment}
              resetSignal={resetSignal}
              regionFocus={regionRec?.focus || null}
              focusNonce={focusNonce}
              regionJoints={regionRec?.joints || []}
            />
          </Suspense>
        </CanvasBoundary>
      </div>

      <header className="av-header">
        <div className="av-brand">
          <span className="av-brand-name">BUILD BELIEVE FIT <span className="av-brand-lab">| LAB</span></span>
          <span className="av-brand-badge">3D ANATOMY ENGINE v2.0</span>
        </div>
        <div className="av-langs" role="tablist" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={lang === l}
              className={`av-lang${lang === l ? ' is-active' : ''}`}
              onClick={() => setLang(l)}
              data-testid={`av-lang-${l}`}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Rail collapse tabs — always on-screen so a hidden rail can be reopened.
          Collapsing both maximizes focus on the 3D figurine. */}
      <button
        type="button"
        className={`av-rail-tab av-rail-tab--left${leftOpen ? ' is-open' : ''}`}
        aria-expanded={leftOpen}
        aria-label={leftOpen ? 'Hide system panels' : 'Show system panels'}
        onClick={() => setLeftOpen((o) => !o)}
        data-testid="av-rail-toggle-left"
      >
        {leftOpen ? '‹' : '›'}
      </button>
      <button
        type="button"
        className={`av-rail-tab av-rail-tab--right${rightOpen ? ' is-open' : ''}`}
        aria-expanded={rightOpen}
        aria-label={rightOpen ? 'Hide detail panel' : 'Show detail panel'}
        onClick={() => setRightOpen((o) => !o)}
        data-testid="av-rail-toggle-right"
      >
        {rightOpen ? '›' : '‹'}
      </button>

      <AnatomyHudLeft
        open={leftOpen}
        systems={systems}
        onToggle={toggleSystem}
        cns={cns}
        onInjectPrehab={injectReadinessPrehab}
        regions={ANATOMY_REGIONS}
        activeRegion={region}
        onSelectRegion={selectRegion}
      />
      <AnatomyHudRight open={rightOpen} segment={segment} />

      <footer className="av-footer">
        <div className="av-console">
          <span className="av-console-live">● Sovereign Core Online</span>
          <span className="av-console-sep">|</span>
          <span className="av-console-status" data-testid="av-hud-status">{statusText}</span>
        </div>
        <div className="av-console">
          <button type="button" className="av-reset" onClick={resetCamera} data-testid="av-reset">↻ Reset Camera</button>
          <span className="av-console-sep">|</span>
          <span className="av-tonal">Target Tonal Volume: <strong data-testid="av-tonal-vol">{cns.volumePct}%</strong></span>
        </div>
      </footer>
    </div>
  );
}
