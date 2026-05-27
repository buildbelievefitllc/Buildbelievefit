// ═══════════════════════════════════════════════════════════════════════
// Build Believe Fit · vault/src/components/WorkoutTracker.tsx
//
// Phase 4.3c · Today's Program · React port of the legacy bbf-app.html
// RW() render-workout flow. Today's plan renders as a list of exercises
// with the canonical four-column shape (Exercise · Sets · Reps ·
// Weight) and an inline per-row log button.
//
// RESPONSIVE CONTRACT (CEO directive · see .module.css)
//   · Wide layout (>600px): 4-column grid · column headers in
//     `.rowHeader` · each row a horizontal data line.
//   · Mobile layout (<=600px): @media flips each row into a
//     vertical-stacked data card · exercise name on top with
//     bottom-border separator · each metric becomes its own
//     "Label · Value" pair line · the column-header strip hides
//     because the per-cell labels carry meaning.
//   · clamp() typography on EVERY text scale · exercise titles use
//     clamp(0.95rem, 2.8vw, 1.15rem) so multi-word names read
//     cleanly at every breakpoint without truncation or overflow.
//
// DATA FLOW
// The component accepts a `plan` prop · for the Phase 4.3c scaffold
// it defaults to DEMO_PLAN (5 representative exercises). The next
// sprint will swap this for a derivation from
// `getUserRecord(getActiveUid())?.workout_plan` (the JSON column
// hydrated by `verifyUserPin` per Phase 4.1a). Per-row log state is
// local · the live wire to `bbf_logs` + `bbf_sets` lands in the
// PASSOVER §5d follow-up sprint.
// ═══════════════════════════════════════════════════════════════════════

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getActiveUid,
  insertWorkoutSession,
  type WorkoutSessionSetInsert,
} from '../services/supabaseClient';
import styles from './WorkoutTracker.module.css';

export interface ExerciseEntry {
  id: string;
  name: string;
  sets: number;
  reps: number | string;     // "5" or "8-10" or "AMRAP"
  weight: number | string;   // "225" or "bodyweight" or "RPE 8"
  weightUnit?: string;       // "lb" · "kg" · "%1RM" · etc.
  notes?: string;
}

export interface WorkoutPlan {
  title: string;
  sub?: string;
  exercises: ReadonlyArray<ExerciseEntry>;
}

export interface WorkoutTrackerProps {
  /** Optional plan override · defaults to the demo plan for the scaffold. */
  plan?: WorkoutPlan;
  /**
   * Per-set log hook · invoked when the user taps "Log" on a row.
   * Returning a promise lets the caller surface a busy state.
   * Live wire to `bbf_logs` + `bbf_sets` lands in PASSOVER §5d.
   */
  onLogExercise?: (entry: ExerciseEntry) => void | Promise<void>;
}

const DEMO_PLAN: WorkoutPlan = {
  title: "Today's Program",
  sub: 'Lower Body Strength · Block 2 · Day 3',
  exercises: [
    { id: 'squat',    name: 'Barbell Back Squat',     sets: 5, reps: 5,   weight: 225, weightUnit: 'lb',          notes: 'Hit depth · pause 1 ct at bottom' },
    { id: 'rdl',      name: 'Romanian Deadlift',      sets: 4, reps: 8,   weight: 185, weightUnit: 'lb',          notes: 'Slow eccentric · feel the hamstring lengthen' },
    { id: 'split',    name: 'Bulgarian Split Squat',  sets: 3, reps: 10,  weight: 50,  weightUnit: 'lb (DB each side)' },
    { id: 'lunges',   name: 'Walking Lunges',         sets: 3, reps: 20,  weight: 30,  weightUnit: 'lb DB' },
    { id: 'curl',     name: 'Lying Leg Curl',         sets: 3, reps: 12,  weight: 80,  weightUnit: 'lb' },
  ],
};

export default function WorkoutTracker(props: WorkoutTrackerProps) {
  const plan = props.plan ?? DEMO_PLAN;
  const [loggedIds, setLoggedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorsById, setErrorsById] = useState<Record<string, string>>({});

  // Synchronous shield · the `busyId` React state guards via the
  // `disabled` attribute + the closure-captured early-return below,
  // but React batches state updates so a sub-millisecond spam burst
  // (10 clicks in one event-loop tick) sees the OLD busyId in every
  // handler invocation and bypasses both guards. This ref locks
  // synchronously the moment the FIRST click enters the handler ·
  // immune to React's scheduling window.
  const busyRef = useRef<string | null>(null);
  const loggedRef = useRef<Set<string>>(new Set());

  const totalExercises = plan.exercises.length;
  const completed = useMemo(
    () => plan.exercises.reduce((n, e) => n + (loggedIds.has(e.id) ? 1 : 0), 0),
    [plan.exercises, loggedIds]
  );

  const handleLog = useCallback(
    async (entry: ExerciseEntry) => {
      // Synchronous shield · these refs update inside the same JS tick
      // so a spam burst sees the locked state on click #2-N without
      // waiting for React to re-render. The React state mirrors them
      // for the disabled attribute + the "Logging…" label · the refs
      // are the actual race-immune guard.
      if (busyRef.current === entry.id) return;
      if (loggedRef.current.has(entry.id)) return;
      busyRef.current = entry.id;

      setBusyId(entry.id);
      setErrorsById((prev) => {
        if (!prev[entry.id]) return prev;
        const next = { ...prev };
        delete next[entry.id];
        return next;
      });
      try {
        if (props.onLogExercise) {
          await props.onLogExercise(entry);
          loggedRef.current.add(entry.id);
          setLoggedIds((prev) => addId(prev, entry.id));
        } else {
          const uid = getActiveUid();
          if (!uid) {
            setErrorsById((prev) => ({ ...prev, [entry.id]: 'No active session · sign in to log this set.' }));
            return;
          }
          const reps   = coerceNumber(entry.reps);
          const weight = coerceNumber(entry.weight);
          const sets: WorkoutSessionSetInsert[] = [];
          const total = Math.max(1, Math.floor(entry.sets) || 1);
          for (let i = 1; i <= total; i++) {
            sets.push({
              set_number: i,
              reps,
              weight_lbs: weight,
              exercise_key: entry.id,
            });
          }
          const result = await insertWorkoutSession(
            uid,
            { drill_name: entry.name, coach_notes: entry.notes, language: 'en' },
            sets
          );
          if (result.ok) {
            loggedRef.current.add(entry.id);
            setLoggedIds((prev) => addId(prev, entry.id));
          } else {
            setErrorsById((prev) => ({ ...prev, [entry.id]: result.error }));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorsById((prev) => ({ ...prev, [entry.id]: msg }));
      } finally {
        busyRef.current = null;
        setBusyId(null);
      }
    },
    [props]
  );

  return (
    <section className={styles.root} aria-labelledby="workout-tracker-title">
      <header className={styles.header}>
        <div className={styles.headerKicker}>Phase 4.3 Stage 2</div>
        <h2 id="workout-tracker-title" className={styles.headerTitle}>{plan.title}</h2>
        <div className={styles.headerMeta} aria-label="progress">
          {completed}/{totalExercises} logged
        </div>
        {plan.sub && <div className={styles.headerSub}>{plan.sub}</div>}
      </header>

      {plan.exercises.length === 0 ? (
        <div className={styles.empty}>
          No exercises queued for today · check the program page once your coach updates the block.
        </div>
      ) : (
        <>
          <div className={styles.rowHeader} role="row" aria-hidden="true">
            <div className={styles.rowHeaderName}>Exercise</div>
            <div className={styles.rowHeaderSets}>Sets</div>
            <div className={styles.rowHeaderReps}>Reps</div>
            <div className={styles.rowHeaderWeight}>Weight</div>
            <div />
          </div>

          <div className={styles.list} role="list">
            {plan.exercises.map((entry) => {
              const isLogged = loggedIds.has(entry.id);
              const isBusy   = busyId === entry.id;
              const rowError = errorsById[entry.id];
              return (
                <article
                  key={entry.id}
                  role="listitem"
                  className={`${styles.row} ${isLogged ? styles.logged : ''}`}
                >
                  <div className={styles.exerciseName}>{entry.name}</div>
                  {entry.notes && <div className={styles.exerciseNotes}>{entry.notes}</div>}

                  <div className={`${styles.metricCell} ${styles.sets}`}>
                    <span className={styles.metricLabel}>Sets</span>
                    <span className={styles.metricValue}>{entry.sets}</span>
                  </div>

                  <div className={`${styles.metricCell} ${styles.reps}`}>
                    <span className={styles.metricLabel}>Reps</span>
                    <span className={styles.metricValue}>{entry.reps}</span>
                  </div>

                  <div className={`${styles.metricCell} ${styles.weight}`}>
                    <span className={styles.metricLabel}>Weight</span>
                    <span className={styles.metricValue}>{entry.weight}</span>
                    {entry.weightUnit && <span className={styles.metricUnit}>{entry.weightUnit}</span>}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleLog(entry)}
                    disabled={isBusy || isLogged}
                    className={`${styles.logBtn} ${isLogged ? styles.loggedBtn : ''}`}
                    aria-label={isLogged ? `Logged · ${entry.name}` : `Log ${entry.name}`}
                  >
                    {isLogged ? 'Logged' : isBusy ? 'Logging…' : 'Log'}
                  </button>

                  {rowError && (
                    <div className={styles.rowError} role="alert">{rowError}</div>
                  )}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (isFinite(n)) return n;
  }
  return null;
}

function addId(prev: ReadonlySet<string>, id: string): ReadonlySet<string> {
  if (prev.has(id)) return prev;
  const next = new Set(prev);
  next.add(id);
  return next;
}
