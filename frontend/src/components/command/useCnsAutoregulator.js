// src/components/command/useCnsAutoregulator.js
// ─────────────────────────────────────────────────────────────────────────────
// CNS AUTOREGULATOR — morning readiness / HRV score (1-10) → daily training-volume
// multiplier, localized state label + instruction, and the tonal-volume % surfaced
// across the app. Ported from the Gemini Spark mockup's calculateCNSAdjustment().
//
//   score ≥ 8 → 1.0x  · Sovereign Optimum   (green)
//   score ≥ 5 → 0.8x  · CNS Volume Alert     (gold)
//   else      → 0.5x  · CNS Redline Override  (red)
//
// `cnsPreset` is a pure function (unit-testable, reusable by other surfaces that
// want to react to readiness); the hook wraps it with clamped score state + L10n.

import { useCallback, useMemo, useState } from 'react';
import { ANATOMY_VIEWER_L10N } from './anatomyViewerData.js';

export function clampScore(n) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return 8;
  return Math.max(1, Math.min(10, v));
}

// Pure readiness → volume mapping (no React, no L10n) — the single source of the
// autoregulation math the whole ecosystem can read from.
export function cnsPreset(score) {
  const s = clampScore(score);
  if (s >= 8) return { key: 'optimal', multiplier: 1.0, color: '#2ecc71' };
  if (s >= 5) return { key: 'moderate', multiplier: 0.8, color: '#f5c800' };
  return { key: 'fatigue', multiplier: 0.5, color: '#ef5350' };
}

export function useCnsAutoregulator(lang = 'en', initialScore = 8) {
  const [score, setScoreState] = useState(() => clampScore(initialScore));
  const setScore = useCallback((v) => setScoreState(clampScore(v)), []);

  return useMemo(() => {
    const L = ANATOMY_VIEWER_L10N[lang] || ANATOMY_VIEWER_L10N.en;
    const preset = cnsPreset(score);
    return {
      score,
      setScore,
      multiplier: preset.multiplier,                          // 1.0 / 0.8 / 0.5
      volumePct: Math.round(preset.multiplier * 100),         // 100 / 80 / 50
      stateKey: preset.key,                                   // optimal | moderate | fatigue
      stateLabel: L.cnsState[preset.key],                     // localized state name
      instruction: L.cnsInstruction[preset.key],              // localized coaching cue
      color: preset.color,                                    // status color
    };
  }, [score, setScore, lang]);
}
