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
import { useAuth } from '../../context/AuthContext.jsx';
import PresetSelector from './PresetSelector.jsx';
import StudioTimelineVisualizer from './StudioTimelineVisualizer.jsx';
import './studio.css';

export default function StudioBatchPanel() {
  // Gate on the FOUNDER/ADMIN ROLE claim from the session (isAdmin) — not solely on a
  // typed admin token. The /command route is already AdminGuard-gated, so an athlete
  // never reaches this panel; a logged-in admin/founder must see the compile utilities
  // unlocked even before manually hydrating an admin token. (The compile POST still
  // attaches X-BBF-Admin-Token when present and the compiler re-gates server-side.)
  const { isAdmin } = useAuth();
  const { compiling, results, authed, compile } = useStudioBatch({ isAdmin });
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
