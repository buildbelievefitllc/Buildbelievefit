// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/PrehabReadiness.tsx
//
// Phase 4.3c · Somatic Readiness Matrix · React port of the legacy
// bbf-app.html readiness survey · sliders for the 5 canonical
// readiness dimensions (sleep, soreness, energy, mood, stress) plus a
// composite 0-100 score derived from their arithmetic mean × 10.
//
// CONTAINMENT CONTRACT (CEO directive · see .module.css)
// Each slider row uses a strict CSS Grid with the label / value
// readout on row 1 (different columns) and the track wrapper spanning
// both columns on row 2 · labels and tracks NEVER share a grid cell ·
// the Z-index argument is moot because they are not co-located in
// the painting flow. The `<input type="range">` itself gets
// width:100% + max-width:100% + min-width:0 + display:block + margin:0
// + box-sizing:border-box to override the native inline-block intrinsic
// width that caused the prior bleed.
//
// DATA FLOW
// Slider state is local to the component. Composite is a useMemo
// derivation. onSubmit hook is the integration boundary for the
// follow-up bbf_readiness insert sprint (PASSOVER §5 step e). For now
// the submit handler stub fires the readiness payload to console.log
// and surfaces a "Pending live wire-up" footnote · the layout
// containment work this sprint addresses is independent of the
// submit-to-db wire.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import styles from './PrehabReadiness.module.css';

export interface ReadinessDimension {
  key: keyof ReadinessPayload['scores'];
  label: string;
  help: string;
  /** True when 10 = best · false when 10 = worst (inverted in composite). */
  positivePolarity: boolean;
}

const DIMENSIONS: ReadonlyArray<ReadinessDimension> = [
  { key: 'sleep',     label: 'Sleep quality',  help: '1 = restless · 10 = deep + restorative',  positivePolarity: true  },
  { key: 'soreness',  label: 'Muscle soreness', help: '1 = none · 10 = debilitating',           positivePolarity: false },
  { key: 'energy',    label: 'Energy',          help: '1 = depleted · 10 = peak',               positivePolarity: true  },
  { key: 'mood',      label: 'Mood',            help: '1 = low · 10 = high',                    positivePolarity: true  },
  { key: 'stress',    label: 'Stress',          help: '1 = calm · 10 = overwhelmed',            positivePolarity: false },
];

export interface ReadinessPayload {
  scores: {
    sleep: number;
    soreness: number;
    energy: number;
    mood: number;
    stress: number;
  };
  /** 0-100 · arithmetic mean × 10 with negative-polarity dimensions inverted. */
  composite: number;
  recorded_at: string;
}

export interface PrehabReadinessProps {
  /** Optional initial scores · defaults to a neutral 5 across the board. */
  initialScores?: Partial<ReadinessPayload['scores']>;
  /**
   * Submit hook · invoked with the full payload when the user taps
   * "Log readiness". Returning a promise allows the component to
   * surface a busy state. Live wire to `bbf_readiness` insert lands
   * in the PASSOVER §5e follow-up sprint.
   */
  onSubmit?: (payload: ReadinessPayload) => void | Promise<void>;
}

const DEFAULT_SCORES: ReadinessPayload['scores'] = {
  sleep: 5,
  soreness: 5,
  energy: 5,
  mood: 5,
  stress: 5,
};

export default function PrehabReadiness(props: PrehabReadinessProps) {
  const [scores, setScores] = useState<ReadinessPayload['scores']>(() => ({
    ...DEFAULT_SCORES,
    ...(props.initialScores ?? {}),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<string | null>(null);

  const composite = useMemo(() => calcComposite(scores), [scores]);

  const handleChange = useCallback(
    (key: keyof ReadinessPayload['scores'], value: number) => {
      setScores((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
    },
    []
  );

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    const payload: ReadinessPayload = {
      scores,
      composite,
      recorded_at: new Date().toISOString(),
    };
    try {
      if (props.onSubmit) {
        await props.onSubmit(payload);
      } else {
        // Stub · the live wire-up to bbf_readiness lands in PASSOVER §5e.
        if (typeof console !== 'undefined' && console.log) {
          console.log('[prehab-readiness] payload (stub · no live insert):', payload);
        }
      }
      setLastSubmittedAt(payload.recorded_at);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, scores, composite, props]);

  return (
    <section className={styles.root} aria-labelledby="prehab-readiness-title">
      <header className={styles.header}>
        <div className={styles.headerLabel}>Phase 4.3 Stage 2</div>
        <h2 id="prehab-readiness-title" className={styles.headerTitle}>
          Somatic Readiness Matrix
        </h2>
        <div className={styles.headerSub}>
          Calibrate today's training load · 5 dimensions roll up to a 0-100
          composite the coach uses to flag overtraining risk.
        </div>
      </header>

      <div className={styles.composite} role="status" aria-live="polite">
        <div className={styles.compositeLabel}>Composite score</div>
        <div className={styles.compositeSub}>
          {compositeBand(composite)} · {composite}/100
        </div>
        <div className={styles.compositeValue}>{composite}</div>
      </div>

      <div className={styles.matrix}>
        {DIMENSIONS.map((dim) => {
          const value = scores[dim.key];
          const sliderId = `prehab-slider-${dim.key}`;
          const helpId = `prehab-help-${dim.key}`;
          return (
            <div key={dim.key} className={styles.row}>
              <label htmlFor={sliderId} className={styles.rowLabel}>
                {dim.label}
              </label>
              <div className={styles.rowValue} aria-hidden="true">{value}/10</div>
              <div className={styles.trackWrap}>
                <input
                  id={sliderId}
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={value}
                  onChange={(e) => handleChange(dim.key, Number(e.target.value))}
                  className={styles.track}
                  aria-describedby={helpId}
                  aria-valuemin={1}
                  aria-valuemax={10}
                  aria-valuenow={value}
                />
              </div>
              <div id={helpId} className={styles.rowHelp}>{dim.help}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.submitWrap}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={styles.submit}
        >
          {submitting ? 'Logging…' : 'Log readiness'}
        </button>
      </div>

      <div className={styles.submitNote}>
        {lastSubmittedAt
          ? `Logged locally at ${formatTime(lastSubmittedAt)} · live wire to bbf_readiness pending`
          : 'Live wire to bbf_readiness pending · payload logs to console for now'}
      </div>
    </section>
  );
}

/**
 * Arithmetic mean × 10 with negative-polarity dimensions (soreness,
 * stress) inverted so a raw 10 = worst contributes only 1 to the
 * mean instead of 10. Returns a rounded integer in [10, 100] given
 * 1-10 slider inputs.
 */
function calcComposite(scores: ReadinessPayload['scores']): number {
  let sum = 0;
  let count = 0;
  for (const dim of DIMENSIONS) {
    const raw = scores[dim.key];
    const normalised = dim.positivePolarity ? raw : 11 - raw;
    sum += normalised;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round((sum / count) * 10);
}

function compositeBand(composite: number): string {
  if (composite >= 80) return 'Peak';
  if (composite >= 60) return 'Trainable';
  if (composite >= 40) return 'Moderate';
  if (composite >= 20) return 'Caution';
  return 'Recover';
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return iso;
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
