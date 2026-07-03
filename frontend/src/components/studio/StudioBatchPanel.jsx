// src/components/studio/StudioBatchPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.5 — Command Center panel that wires the Content Studio V4 batch UI:
// PresetSelector (job config + gram_override) → useStudioBatch (admin-token compile)
// → StudioTimelineVisualizer (one z-ordered timeline per compiled job).
//
// Admin-only: mounted under the /command AdminGuard, and the compile call itself is
// X-BBF-Admin-Token gated (PresetSelector shows a localized locked state until the
// Command Center admin token is hydrated).

import { useStudioBatch } from './useStudioBatch.js';
import PresetSelector from './PresetSelector.jsx';
import StudioTimelineVisualizer from './StudioTimelineVisualizer.jsx';
import './studio.css';

export default function StudioBatchPanel() {
  const { compiling, results, authed, compile } = useStudioBatch();
  return (
    <div className="st-batch-panel">
      <PresetSelector onCompile={compile} compiling={compiling} authed={authed} />
      {results.length ? (
        <div className="st-batch-results">
          {results.map((r) => <StudioTimelineVisualizer key={r.id} result={r} />)}
        </div>
      ) : null}
    </div>
  );
}
