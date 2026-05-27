// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/NutritionVision.tsx
//
// Phase 4.3e · Live wire to two edge functions · PASSOVER §5 step (c)
// final closeout. The Phase 4.3b/4.3c version of this component was
// visual-only (a state machine that flipped Idle → Awaiting Camera →
// Live → Analyzing → Result without any network IO). This rewrite:
//
//   · adds a meal-name input · both edge functions are NAME-driven
//     (not photo-driven · verified by reading supabase/functions/
//     bbf-meal-image/index.ts and bbf-meal-macros/index.ts which both
//     accept `{ name, ingredients? }` and return a stock-photo URL +
//     cached macro values respectively).
//   · wires the "Scan Meal" button to `generateMealImage(name)`
//     (POSTs `/functions/v1/bbf-meal-image` · cache-first, then
//     Gemini Imagen 3 · returns `image_url`).
//   · adds a "Generate Protocol" button wired to
//     `analyzeMealMacros(name)` (POSTs `/functions/v1/bbf-meal-macros`
//     · cache-first, then Claude Haiku · returns kcal/p/c/f/confidence).
//   · renders the returned image inside the bracketed viewport so the
//     scan flow has visual confirmation that the call resolved.
//   · surfaces both `source` discriminators ('cache' | 'gemini_imagen_3'
//     | 'claude_haiku') as small tags so the user can tell when the
//     value came from the warm cache (free) vs the LLM/image-gen path
//     (token cost).
//
// DOUBLE-SUBMIT SHIELD
// Two independent `scanning` + `analyzing` booleans · each button is
// `disabled={busy || !name.trim()}` and the label flips to
// "Scanning…" / "Analyzing…" for the full request duration. Early-
// returns in both handlers bounce spam-clicks before any state
// mutation.
//
// VISUAL CONTRACT (CEO directive · Phase 4.3 architecture preserved)
//   · Intrinsic CSS Grid + clamp() typography untouched.
//   · `.nameInput` gets the same containment discipline as
//     ProfileSettings (width: 100%; max-width: 100%; min-width: 0;
//     box-sizing: border-box) so the native browser intrinsic width
//     never bleeds.
//   · The metric strip + chips stay on the existing auto-fit grid
//     · the only DOM change is the macros now reflect REAL values
//     from the edge function instead of perpetual em-dashes.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from 'react';
import {
  analyzeMealMacros,
  generateMealImage,
  type MealImageResponse,
  type MealMacrosResponse,
} from '../services/supabaseClient';
import styles from './NutritionVision.module.css';

export interface NutritionVisionProps {
  initialName?: string;
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

export default function NutritionVision(props: NutritionVisionProps) {
  const [name, setName] = useState<string>(props.initialName ?? '');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageSource, setImageSource] = useState<MealImageResponse['source'] | null>(null);
  const [macros, setMacros] = useState<MealMacros>(EMPTY_MACROS);
  const [macrosSource, setMacrosSource] = useState<MealMacrosResponse['source'] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Synchronous shields · one per independent action button · React
  // state batching window protection · see PrehabReadiness for the
  // full rationale.
  const scanningRef = useRef(false);
  const analyzingRef = useRef(false);

  const trimmedName = name.trim();
  const canAct = trimmedName.length > 0;
  const hasScannedImage = imageUrl !== null;

  const handleScan = useCallback(async () => {
    if (scanningRef.current || !canAct) return;
    scanningRef.current = true;
    setScanning(true);
    setLastError(null);
    try {
      const result = await generateMealImage(trimmedName);
      if (result.ok) {
        setImageUrl(result.data.image_url);
        setImageSource(result.data.source);
      } else {
        setLastError(`Scan failed · ${result.error}`);
      }
    } catch (err) {
      setLastError(`Scan failed · ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      scanningRef.current = false;
      setScanning(false);
    }
  }, [canAct, trimmedName]);

  const handleProtocol = useCallback(async () => {
    if (analyzingRef.current || !canAct) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    setLastError(null);
    try {
      const result = await analyzeMealMacros(trimmedName);
      if (result.ok) {
        setMacros({
          calories:  numeric(result.data.kcal),
          protein_g: numeric(result.data.protein_g),
          carbs_g:   numeric(result.data.carbs_g),
          fat_g:     numeric(result.data.fat_g),
          confidence: numeric(result.data.confidence),
        });
        setMacrosSource(result.data.source);
      } else {
        setLastError(`Protocol failed · ${result.error}`);
      }
    } catch (err) {
      setLastError(`Protocol failed · ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [canAct, trimmedName]);

  const handleReset = useCallback(() => {
    setImageUrl(null);
    setImageSource(null);
    setMacros(EMPTY_MACROS);
    setMacrosSource(null);
    setLastError(null);
  }, []);

  const statusLabel = scanning
    ? 'Scanning'
    : analyzing
      ? 'Analyzing'
      : hasScannedImage || macrosSource
        ? 'Result'
        : 'Idle';

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.label}>
          <span aria-hidden="true">{'\u{1F957}'}</span>
          <span>Nutrition Vision · Live Food Analysis</span>
        </div>
        <div className={styles.statusBadge} aria-live="polite">
          {statusLabel}
        </div>
      </header>

      <div className={styles.nameField}>
        <label htmlFor="nutrition-name" className={styles.nameLabel}>What did you eat?</label>
        <input
          id="nutrition-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={styles.nameInput}
          placeholder="e.g. Chicken caesar salad"
          autoComplete="off"
        />
      </div>

      <div className={styles.frame}>
        <span className={`${styles.bracket} ${styles.bracketTL}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketTR}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketBL}`} aria-hidden="true" />
        <span className={`${styles.bracket} ${styles.bracketBR}`} aria-hidden="true" />
        {scanning && <div className={styles.scanline} aria-hidden="true" />}

        {hasScannedImage ? (
          <div className={styles.viewport}>
            <img
              src={imageUrl ?? ''}
              alt={`Generated photograph of ${trimmedName || 'meal'}`}
              className={styles.scannedImage}
              loading="lazy"
            />
            {imageSource && (
              <span className={styles.sourceTag}>
                {imageSource === 'cache' ? 'cache' : 'Imagen 3'}
              </span>
            )}
          </div>
        ) : (
          <div className={styles.hero}>
            <div className={styles.heroEye} aria-hidden="true">{'\u{1F441}\u{FE0F}'}</div>
            <div className={styles.heroKicker}>Multimodal AI Nutritionist</div>
            <div className={styles.heroTitle}>Real-time Nutrition Vision</div>
            <div className={styles.heroSub}>
              Enter what you’re about to eat. Tap Scan Meal for a stock plate photo,
              or Generate Protocol for an instant macro estimate aligned with your TDEE target.
            </div>
          </div>
        )}
      </div>

      <div className={styles.controlBar}>
        <button
          type="button"
          onClick={handleScan}
          disabled={scanning || !canAct}
          className={styles.btnPrimary}
        >
          <span aria-hidden="true">{'\u{1F441}\u{FE0F}'}</span>
          <span>{scanning ? 'Scanning…' : 'Scan Meal'}</span>
        </button>
        <button
          type="button"
          onClick={handleProtocol}
          disabled={analyzing || !canAct}
          className={styles.btnPrimary}
        >
          <span aria-hidden="true">{'\u{1F4CA}'}</span>
          <span>{analyzing ? 'Analyzing…' : 'Generate Protocol'}</span>
        </button>
        {(hasScannedImage || macrosSource) && (
          <button
            type="button"
            onClick={handleReset}
            disabled={scanning || analyzing}
            className={styles.btnGhost}
          >
            <span aria-hidden="true">{'\u{21BA}'}</span>
            <span>Reset</span>
          </button>
        )}
      </div>

      {lastError && <div className={styles.errorBanner} role="alert">{lastError}</div>}

      <div className={styles.metricStrip}>
        <MetricChip label="Calories"   value={fmtNum(macros.calories)} unit="kcal" />
        <MetricChip label="Protein"    value={fmtNum(macros.protein_g)} unit="g" />
        <MetricChip label="Carbs"      value={fmtNum(macros.carbs_g)} unit="g" />
        <MetricChip label="Fat"        value={fmtNum(macros.fat_g)} unit="g" />
        <MetricChip label="Confidence" value={fmtPct(macros.confidence)} unit="%" />
      </div>

      {macrosSource && (
        <div className={styles.confidenceCaption}>
          Macros from {macrosSource === 'cache' ? 'cache hit (free)' : 'Claude Haiku resolution'}
        </div>
      )}
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

function numeric(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return null;
}

function fmtNum(v: number | null): string {
  if (v === null) return '—';
  return Math.round(v).toString();
}

function fmtPct(v: number | null): string {
  if (v === null) return '—';
  return Math.round(v * 100).toString();
}
