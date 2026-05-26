// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/NutritionVision.tsx
//
// Phase 4.3 · Layout Panel Componentization Pass · React/TS extraction
// of the Nutrition Vision Viewport at bbf-app.html lines 928-953
// (#nutrition-vision-module → .pe-widget → .pe-head + .pe-frame +
// .pe-hero + .pe-init-btn). The legacy markup wires camera capture
// through initLiveCoach('vision') which then calls getUserMedia at
// line 5442; this scaffold mirrors the LAYOUT shell so Phase 4.3+
// can drop the live-camera mount in without re-doing the chrome.
//
// VISUAL FIX (Phase 4.3 · mobile responsiveness)
// Legacy layout used fixed inline widths on the metric chips + media
// control buttons · on a narrow viewport (mobile portrait) the chip
// strip overflowed horizontally and the controls compressed into
// unreadable slivers. This component uses flex-wrap on every horizontal
// strip (.header, .controlBar, .metricStrip) plus `flex: 1 1 <basis>`
// on each child so:
//   - On wide viewports they sit side-by-side with even spacing.
//   - On narrow viewports each child wraps to its own row at the
//     basis-width threshold instead of being crushed.
//   - On very-narrow viewports (sub-280px) the chip strip collapses
//     to a single column with `minWidth: 0` preventing horizontal
//     scroll on the parent.
// No media queries needed · the wrap behaviour is intrinsic to the
// flex container + basis pair.
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import type { CSSProperties } from 'react';

export type NutritionVisionMode =
  | 'idle'
  | 'awaiting_camera'
  | 'live'
  | 'analyzing'
  | 'result';

export interface NutritionVisionProps {
  initialMode?: NutritionVisionMode;
}

export interface MealMacros {
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  confidence: number | null;
}

const EMPTY_MACROS: MealMacros = {
  calories: null,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  confidence: null,
};

const STATUS_LABEL: Record<NutritionVisionMode, string> = {
  idle: 'Idle',
  awaiting_camera: 'Requesting camera',
  live: 'Live',
  analyzing: 'Analyzing',
  result: 'Result',
};

const VIEWPORT_LABEL: Record<NutritionVisionMode, string> = {
  idle: '',
  awaiting_camera: 'Awaiting camera permission',
  live: 'Point camera at meal',
  analyzing: 'Estimating macros',
  result: 'Meal scanned',
};

export default function NutritionVision(props: NutritionVisionProps) {
  const [mode, setMode] = useState<NutritionVisionMode>(props.initialMode ?? 'idle');
  // Reserved for the Phase 4.3+ mount that will write real macros from
  // the bbf-meal-macros edge function · scaffold keeps it empty.
  const macros: MealMacros = EMPTY_MACROS;

  const handleStart = useCallback(() => setMode('awaiting_camera'), []);
  const handleStop = useCallback(() => setMode('idle'), []);
  const handleCapture = useCallback(() => setMode('analyzing'), []);

  const isStarted = mode !== 'idle';

  return (
    <section className="bbf-nutrition-vision" style={styles.root}>
      <header style={styles.header}>
        <div style={styles.label}>
          <span aria-hidden="true">{'\u{1F957}'}</span>
          <span>Nutrition Vision · Live Food Analysis</span>
        </div>
        <div style={styles.statusBadge} aria-live="polite">
          {STATUS_LABEL[mode]}
        </div>
      </header>

      <div style={styles.frame}>
        <span style={{ ...styles.bracket, ...styles.bracketTL }} aria-hidden="true" />
        <span style={{ ...styles.bracket, ...styles.bracketTR }} aria-hidden="true" />
        <span style={{ ...styles.bracket, ...styles.bracketBL }} aria-hidden="true" />
        <span style={{ ...styles.bracket, ...styles.bracketBR }} aria-hidden="true" />
        {isStarted ? (
          <div style={styles.viewport}>
            <div style={styles.scanline} aria-hidden="true" />
            <div style={styles.viewportLabel}>{VIEWPORT_LABEL[mode]}</div>
          </div>
        ) : (
          <div style={styles.hero}>
            <div style={styles.heroEye} aria-hidden="true">{'\u{1F441}\u{FE0F}'}</div>
            <div style={styles.heroKicker}>Multimodal AI Nutritionist</div>
            <div style={styles.heroTitle}>Real-time Nutrition Vision</div>
            <div style={styles.heroSub}>
              Point your camera at what you're about to eat. Instant macro
              + calorie estimates aligned with your day's TDEE target.
            </div>
          </div>
        )}
      </div>

      <div style={styles.controlBar}>
        {!isStarted && (
          <button type="button" onClick={handleStart} style={styles.btnPrimary}>
            <span aria-hidden="true">{'\u{1F441}\u{FE0F}'}</span>
            <span>Start Nutrition Vision</span>
          </button>
        )}
        {mode === 'live' && (
          <button type="button" onClick={handleCapture} style={styles.btnPrimary}>
            <span aria-hidden="true">{'\u{1F4F8}'}</span>
            <span>Capture Plate</span>
          </button>
        )}
        {isStarted && (
          <button type="button" onClick={handleStop} style={styles.btnGhost}>
            <span aria-hidden="true">{'\u{23F9}'}</span>
            <span>Stop</span>
          </button>
        )}
      </div>

      <div style={styles.metricStrip}>
        <MetricChip label="Calories"   value={fmtNum(macros.calories)} unit="kcal" />
        <MetricChip label="Protein"    value={fmtNum(macros.protein_g)} unit="g" />
        <MetricChip label="Carbs"      value={fmtNum(macros.carbs_g)} unit="g" />
        <MetricChip label="Fat"        value={fmtNum(macros.fat_g)} unit="g" />
        <MetricChip label="Confidence" value={fmtPct(macros.confidence)} unit="%" />
      </div>
    </section>
  );
}

interface MetricChipProps {
  label: string;
  value: string;
  unit: string;
}

function MetricChip({ label, value, unit }: MetricChipProps) {
  return (
    <div style={styles.chip}>
      <div style={styles.chipLabel}>{label}</div>
      <div style={styles.chipValueRow}>
        <span style={styles.chipValue}>{value}</span>
        <span style={styles.chipUnit}>{unit}</span>
      </div>
    </div>
  );
}

function fmtNum(v: number | null): string {
  if (v === null) return '—';
  return Math.round(v).toString();
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return Math.round(v * 100).toString();
}

// ─── Styles ──────────────────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    background: '#11151a',
    color: '#e8eaed',
    borderRadius: '0.75rem',
    border: '1px solid #1f262f',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    flexWrap: 'wrap',                 // visual fix · header wraps on narrow screens
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.5rem',
  },
  label: {
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '0.9rem',
    fontWeight: 600,
    letterSpacing: '0.03em',
    color: '#fbbf24',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
  },
  statusBadge: {
    fontSize: '0.72rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    padding: '0.25rem 0.55rem',
    borderRadius: '999px',
    background: '#1f262f',
    color: '#a3e635',
  },
  frame: {
    position: 'relative',
    background: '#0a0f14',
    borderRadius: '0.75rem',
    padding: '1.5rem',
    minHeight: '13rem',
    overflow: 'hidden',
  },
  bracket: {
    position: 'absolute',
    width: '24px',
    height: '24px',
    borderColor: '#34d399',
    borderStyle: 'solid',
  },
  bracketTL: { top: 8, left: 8, borderWidth: '2px 0 0 2px' },
  bracketTR: { top: 8, right: 8, borderWidth: '2px 2px 0 0' },
  bracketBL: { bottom: 8, left: 8, borderWidth: '0 0 2px 2px' },
  bracketBR: { bottom: 8, right: 8, borderWidth: '0 2px 2px 0' },
  scanline: {
    position: 'absolute',
    inset: 0,
    background:
      'linear-gradient(to bottom, transparent 0%, rgba(52, 211, 153, 0.15) 50%, transparent 100%)',
    pointerEvents: 'none',
  },
  viewport: {
    position: 'relative',
    minHeight: '10rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewportLabel: { opacity: 0.85, fontWeight: 500 },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '0.4rem',
  },
  heroEye: { fontSize: '2.6rem' },
  heroKicker: {
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    opacity: 0.6,
  },
  heroTitle: { fontSize: '1.2rem', fontWeight: 600 },
  heroSub: { fontSize: '0.85rem', opacity: 0.72, maxWidth: '32ch' },
  controlBar: {
    display: 'flex',
    flexWrap: 'wrap',                  // visual fix · controls wrap on narrow screens
    gap: '0.5rem',
  },
  btnPrimary: {
    flex: '1 1 10rem',                 // visual fix · grows to fill row, wraps when crowded
    minWidth: 0,
    appearance: 'none',
    background: '#34d399',
    color: '#062e1e',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    fontWeight: 700,
    fontSize: '0.92rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
  },
  btnGhost: {
    flex: '0 0 auto',
    appearance: 'none',
    background: 'transparent',
    color: '#e8eaed',
    border: '1px solid #2a323d',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontWeight: 600,
  },
  metricStrip: {
    display: 'flex',
    flexWrap: 'wrap',                  // visual fix · metrics wrap onto multiple rows
    gap: '0.5rem',
  },
  chip: {
    flex: '1 1 8rem',                  // visual fix · 8rem basis · 5 chips reflow 5→3→2→1 cols
    minWidth: 0,                       // prevent horizontal overflow on sub-280px viewports
    background: '#1a2028',
    border: '1px solid #2a323d',
    borderRadius: '0.5rem',
    padding: '0.55rem 0.7rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
  },
  chipLabel: {
    fontSize: '0.7rem',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  chipValueRow: { display: 'flex', alignItems: 'baseline', gap: '0.25rem' },
  chipValue: { fontSize: '1.1rem', fontWeight: 700 },
  chipUnit: { fontSize: '0.72rem', opacity: 0.7 },
};
