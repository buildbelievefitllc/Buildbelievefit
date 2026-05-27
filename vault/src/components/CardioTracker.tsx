// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/CardioTracker.tsx
//
// Phase 4.3e · Cardio session logger · PASSOVER §5 step (c) closeout.
//
// Writes one row to `public.bbf_athlete_load_logs` per "Log session"
// tap. The schema (verified via Supabase MCP on the lab project):
//   · log_id           uuid NOT NULL          (client-generated)
//   · athlete_id       uuid NOT NULL          (resolved from active uid slug)
//   · session_timestamp timestamptz NOT NULL  (ISO now)
//   · session_type     text NOT NULL          ('cardio_run' | 'cardio_bike' | …)
//   · duration_minutes int  NOT NULL
//   · srpe_intensity   int  NOT NULL          (1-10)
//   · load_au          int                    (= duration × sRPE · Foster)
//
// VISUAL CONTRACT (CEO directive · Phase 4.3 architecture)
//   · Intrinsic CSS Grid throughout · activity picker uses auto-fit
//     `repeat(auto-fit, minmax(min(100%, 7rem), 1fr))` so the buttons
//     reflow from a single-column stack on phones to a 5-up row on
//     wide monitors with zero @media branches.
//   · sRPE slider repeats the Phase 4.3c containment-by-grid contract
//     (label + value on different grid columns of row 1 · track wrapper
//     spans both columns on row 2 · slider physically cannot overlap
//     the label).
//   · clamp() typography on every text scale · zero hardcoded font
//     sizes anywhere in the module.
//   · Submit button capped at `max-width: 400px; margin-inline: auto`
//     to match the brand primary-action envelope.
//
// DOUBLE-SUBMIT SHIELD
// `submitting` boolean guards the network round-trip · the button is
// `disabled={submitting}` and its label flips to "Logging…" for the
// full duration of the request · early-return in the handler bounces
// spam-clicks before any state mutation.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getActiveUid,
  insertCardioSession,
  type CardioSessionInsert,
} from '../services/supabaseClient';
import styles from './CardioTracker.module.css';

interface ActivityOption {
  value: CardioSessionInsert['session_type'];
  label: string;
}

const ACTIVITIES: ReadonlyArray<ActivityOption> = [
  { value: 'cardio_run',   label: 'Running' },
  { value: 'cardio_bike',  label: 'Cycling' },
  { value: 'cardio_swim',  label: 'Swimming' },
  { value: 'cardio_row',   label: 'Rowing' },
  { value: 'cardio_other', label: 'Steady-state' },
];

const RPE_BAND: Record<number, string> = {
  1: 'Very light · could continue all day',
  2: 'Very light · could continue all day',
  3: 'Light · easy conversation',
  4: 'Moderate · conversation but breathy',
  5: 'Moderate · short phrases only',
  6: 'Somewhat hard · breathing noticeably',
  7: 'Hard · short answers only',
  8: 'Very hard · single words',
  9: 'Very hard · cannot speak',
  10: 'Maximal · all-out effort',
};

export interface CardioTrackerProps {
  /** Optional override for the cardio insert · tests bypass the real RPC. */
  onLog?: (payload: CardioSessionInsert) => Promise<void> | void;
  initialActivity?: ActivityOption['value'];
  initialDuration?: number;
  initialSrpe?: number;
}

export default function CardioTracker(props: CardioTrackerProps) {
  const [activity, setActivity] = useState<ActivityOption['value']>(
    props.initialActivity ?? 'cardio_run'
  );
  const [duration, setDuration] = useState<number>(props.initialDuration ?? 30);
  const [srpe, setSrpe] = useState<number>(props.initialSrpe ?? 6);
  const [submitting, setSubmitting] = useState(false);
  const [lastLoggedAt, setLastLoggedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Synchronous shield · React state batching window protection · see
  // PrehabReadiness for the full rationale.
  const submittingRef = useRef(false);

  const loadAu = useMemo(() => duration * srpe, [duration, srpe]);

  const handleDuration = useCallback((raw: string) => {
    const n = Number(raw);
    if (!isFinite(n)) return;
    const clamped = Math.max(1, Math.min(600, Math.round(n)));
    setDuration(clamped);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setLastError(null);
    const payload: CardioSessionInsert = {
      session_type: activity,
      duration_minutes: duration,
      srpe_intensity: srpe,
      load_au: loadAu,
      session_timestamp: new Date().toISOString(),
    };
    try {
      if (props.onLog) {
        await props.onLog(payload);
        setLastLoggedAt(payload.session_timestamp ?? new Date().toISOString());
      } else {
        const uid = getActiveUid();
        if (!uid) {
          setLastError('No active session · sign in to log this cardio block.');
          return;
        }
        const result = await insertCardioSession(uid, payload);
        if (result.ok) {
          setLastLoggedAt(payload.session_timestamp ?? new Date().toISOString());
        } else {
          setLastError(result.error);
        }
      }
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [activity, duration, srpe, loadAu, props]);

  const rpeBand = RPE_BAND[srpe] ?? '';

  return (
    <section className={styles.root} aria-labelledby="cardio-tracker-title">
      <header className={styles.header}>
        <div className={styles.headerKicker}>Phase 4.3 Stage 2</div>
        <h2 id="cardio-tracker-title" className={styles.headerTitle}>
          Cardio Session
        </h2>
        <div className={styles.headerSub}>
          Log today's steady-state · the Foster sRPE-load (minutes × RPE) feeds the
          ACWR + ATP-PC micro-recovery audit the coach reads from bbf_athlete_load_logs.
        </div>
      </header>

      <div className={styles.activityGroup} role="radiogroup" aria-label="Activity type">
        {ACTIVITIES.map((opt) => {
          const selected = opt.value === activity;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setActivity(opt.value)}
              className={`${styles.activityBtn} ${selected ? styles.activitySelected : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className={styles.fieldRow}>
        <label htmlFor="cardio-duration" className={styles.fieldLabel}>Duration</label>
        <div className={styles.numberWrap}>
          <input
            id="cardio-duration"
            type="number"
            min={1}
            max={600}
            step={1}
            value={duration}
            onChange={(e) => handleDuration(e.target.value)}
            className={styles.numberInput}
          />
          <span className={styles.unit}>min</span>
        </div>
        <div className={styles.fieldHint}>
          Total continuous work · warm-up and cool-down included.
        </div>
      </div>

      <div className={styles.sliderRow}>
        <label htmlFor="cardio-srpe" className={styles.sliderLabel}>Session RPE</label>
        <div className={styles.sliderValue} aria-hidden="true">{srpe}/10</div>
        <div className={styles.trackWrap}>
          <input
            id="cardio-srpe"
            type="range"
            min={1}
            max={10}
            step={1}
            value={srpe}
            onChange={(e) => setSrpe(Number(e.target.value))}
            className={styles.track}
            aria-describedby="cardio-srpe-help"
            aria-valuemin={1}
            aria-valuemax={10}
            aria-valuenow={srpe}
          />
        </div>
        <div id="cardio-srpe-help" className={styles.sliderHelp}>{rpeBand}</div>
      </div>

      <div className={styles.loadBox} role="status" aria-live="polite">
        <div className={styles.loadLabel}>Session load</div>
        <div className={styles.loadSub}>duration × sRPE · Foster</div>
        <div className={styles.loadValue}>
          {loadAu}
          <span className={styles.loadUnit}>AU</span>
        </div>
      </div>

      <div className={styles.submitWrap}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className={styles.submit}
        >
          {submitting ? 'Logging…' : 'Log session'}
        </button>
      </div>

      {lastError && <div className={styles.errorBanner} role="alert">{lastError}</div>}

      <div className={styles.submitNote}>
        {lastLoggedAt
          ? `Logged to bbf_athlete_load_logs at ${formatTime(lastLoggedAt)}`
          : 'Tap "Log session" to write a load row · powers ACWR + recovery audits'}
      </div>
    </section>
  );
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
