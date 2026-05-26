// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/NutritionVision.tsx
//
// Phase 4.3 Stage 2 · Front-end Visual Purge
// Rewrite of the previous flexbox-based scaffold (Phase 4.3a · 431b053)
// using a strict CSS-module-driven intrinsic Grid layout per CEO
// directive. The fragile `flex: 1 1 8rem` + `flex: 1 1 10rem` rules
// that horizontally clipped the macro numbers on sub-320px viewports
// are gone. The macro chip strip now uses
//   `grid-template-columns: repeat(auto-fit, minmax(min(100%, 100px), 1fr))`
// (see NutritionVision.module.css `.metricStrip`) which:
//   · caps each column's minimum at 100% of the container so narrow
//     screens never demand more space than is available (no clipping)
//   · lets the strip expand to 5 chips on wide monitors (auto-fit)
//   · scales macro numbers fluidly via clamp(1.2rem, 3vw, 1.8rem)
//     so 4-digit kcal counts read cleanly at every breakpoint
//   · constrains the primary action buttons to max-width: 400px with
//     margin-inline: auto to restore visual negative space on desktop
// ═══════════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import styles from './NutritionVision.module.css';

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

  const handleStart   = useCallback(() => setMode('awaiting_camera'), []);
  const handleStop    = useCallback(() => setMode('idle'), []);
  const handleCapture = useCallback(() => setMode('analyzing'), []);

  const isStarted = mode !== 'idle';

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.label}>
          <span aria-hidden="true">{'\u{1F957}'}</span>
          <span>Nutrition Vision · Live Food Analysis</span>
        </div>
        <div className={styles.statusBadge} aria-live="polite">
          {STATUS_LABEL[mode]}
        </div>
      </header>

      <div className={styles.frame}>
        <span className={`${styles.bracket} ${styles.bracketTL}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketTR}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketBL}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketBR}`} aria-hidden="true" />
        {isStarted ? (
          <div className={styles.viewport}>
            <div className={styles.scanline} aria-hidden="true" />
            <div className={styles.viewportLabel}>{VIEWPORT_LABEL[mode]}</div>
          </div>
        ) : (
          <div className={styles.hero}>
            <div className={styles.heroEye} aria-hidden="true">{'\u{1F441}\u{FE0F}'}</div>
            <div className={styles.heroKicker}>Multimodal AI Nutritionist</div>
            <div className={styles.heroTitle}>Real-time Nutrition Vision</div>
            <div className={styles.heroSub}>
              Point your camera at what you're about to eat. Instant macro
              + calorie estimates aligned with your day's TDEE target.
            </div>
          </div>
        )}
      </div>

      <div className={styles.controlBar}>
        {!isStarted && (
          <button type="button" onClick={handleStart} className={styles.btnPrimary}>
            <span aria-hidden="true">{'\u{1F441}\u{FE0F}'}</span>
            <span>Scan Meal</span>
          </button>
        )}
        {mode === 'live' && (
          <button type="button" onClick={handleCapture} className={styles.btnPrimary}>
            <span aria-hidden="true">{'\u{1F4F8}'}</span>
            <span>Capture Plate</span>
          </button>
        )}
        {isStarted && (
          <button type="button" onClick={handleStop} className={styles.btnGhost}>
            <span aria-hidden="true">{'\u{23F9}'}</span>
            <span>Stop</span>
          </button>
        )}
      </div>

      <div className={styles.metricStrip}>
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
    <div className={styles.chip}>
      <div className={styles.chipLabel}>{label}</div>
      <div className={styles.chipValueRow}>
        <span className={styles.chipValue}>{value}</span>
        <span className={styles.chipUnit}>{unit}</span>
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
