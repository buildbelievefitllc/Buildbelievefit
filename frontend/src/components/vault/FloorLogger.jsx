// src/components/vault/FloorLogger.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FLOOR MODE — the Local-First "Blackout" Active Workout Logger.
//
// Built for a network dead zone: this component NEVER queries Supabase. It binds
// strictly to the Dexie cache (useFloorSession → useLiveQuery); hydration and the
// background cloud flush live in floorSync.js. Every tap is optimistic — it writes
// to IndexedDB instantly and the row flips state with zero network on the path.
//
// Blackout UI (void/gold token system, no Tailwind):
//   • MASSIVE TOUCH TARGETS — the whole set row is a button; tapping it logs the
//     set (or un-logs it). Number fields stopPropagation so an edit never fires a
//     complete.
//   • CURRENT SET — the first un-logged set of an exercise is ringed in gold.
//   • COMPLETED SET — demoted to --void-text-muted with a check glyph.
//   • Pre-filled numeric inputs fire the native keypad (type=number, inputmode,
//     pattern="[0-9]*") for fast mid-set edits.
//   • Zero native emojis — established SVG glyphs only.

import { useEffect, useRef, useState } from 'react';
import { useFloorSession } from '../../lib/useFloorSession.js';
import { hydrateFloor, logSet, ensureFloorSyncWired } from '../../lib/floorSync.js';
import { CheckIcon, CloseIcon } from './icons.jsx';
import { SESSION_COMPLETE_EVENT } from '../../lib/sessionFeedbackApi.js';
import './floorLogger.css';

function fmtWeight(n) {
  return n === null || n === undefined || n === '' ? '' : String(n);
}

// One exercise block: target line + its set rows.
function FloorExercise({ uid, dayIdx, rx, setMap }) {
  const logged = setMap[rx.exKey] || {};
  // Current set = the lowest set number not yet done.
  const total = rx.setCount;
  let currentSet = null;
  for (let n = 1; n <= total; n += 1) {
    if (!(logged[n] && logged[n].done)) { currentSet = n; break; }
  }

  return (
    <section className="fl-ex" data-testid="fl-exercise">
      <header className="fl-ex-head">
        <h3 className="fl-ex-name">{rx.name}</h3>
        <div className="fl-ex-meta">
          {rx.equipment ? <span className="fl-ex-equip">{rx.equipment}</span> : null}
          <span className="fl-ex-target">
            {total} × {rx.targetReps || '—'}
            {rx.lastWeight != null ? <em> · last {rx.lastWeight} lb</em> : (rx.targetWeight != null ? <em> · {rx.targetWeight} lb</em> : null)}
          </span>
        </div>
      </header>

      <div className="fl-sets">
        {Array.from({ length: total }, (_, i) => i + 1).map((setNumber) => (
          <FloorSetRow
            key={setNumber}
            uid={uid}
            dayIdx={dayIdx}
            rx={rx}
            setNumber={setNumber}
            saved={logged[setNumber] || null}
            isCurrent={setNumber === currentSet}
          />
        ))}
      </div>
    </section>
  );
}

// A single set row — the massive touch target. Tap anywhere outside the inputs to
// log/unlog. The number fields are UNCONTROLLED (refs + a seed `key`), so tap-to-
// log reads the live DOM values and a fresh cache seed re-mounts the field with a
// new default — no setState-in-effect, no per-keystroke IndexedDB churn.
function FloorSetRow({ uid, dayIdx, rx, setNumber, saved, isCurrent }) {
  const done = !!(saved && saved.done);
  const weightRef = useRef(null);
  const repsRef = useRef(null);

  const seedWeight = fmtWeight(saved?.weightLbs ?? rx.lastWeight ?? rx.targetWeight ?? '');
  const seedReps = fmtWeight(saved?.reps ?? (rx.targetReps && /^\d+$/.test(rx.targetReps) ? Number(rx.targetReps) : ''));
  // Remount the inputs (fresh defaultValue) only when the SEED changes — i.e. a
  // hydrate folded in a new last-weight, or the set's done-state flipped.
  const seedKey = `${done}|${seedWeight}|${seedReps}`;

  const toggle = () => {
    const w = weightRef.current ? weightRef.current.value : seedWeight;
    const r = repsRef.current ? repsRef.current.value : seedReps;
    logSet({ uid, dayIdx, exIdx: rx.exIdx, setNumber, reps: r, weightLbs: w, done: !done })
      .catch(() => { /* optimistic; stays in cache for the next flush */ });
  };

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
  };

  const cls = `fl-row${done ? ' is-done' : ''}${isCurrent && !done ? ' is-current' : ''}`;
  return (
    <div
      className={cls}
      role="button"
      tabIndex={0}
      aria-pressed={done}
      onClick={toggle}
      onKeyDown={onKey}
      data-testid="fl-set-row"
    >
      <span className="fl-row-no">{done ? <CheckIcon size={18} /> : setNumber}</span>

      <label className="fl-field" onClick={(e) => e.stopPropagation()}>
        <span className="fl-field-k">Weight</span>
        <input
          ref={weightRef}
          key={`w-${seedKey}`}
          className="fl-input"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          step="any"
          defaultValue={seedWeight}
          placeholder="BW"
          disabled={done}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Set ${setNumber} weight in pounds`}
          data-testid="fl-weight"
        />
        <span className="fl-field-u">lb</span>
      </label>

      <label className="fl-field" onClick={(e) => e.stopPropagation()}>
        <span className="fl-field-k">Reps</span>
        <input
          ref={repsRef}
          key={`r-${seedKey}`}
          className="fl-input"
          type="number"
          inputMode="numeric"
          pattern="[0-9]*"
          min="0"
          step="1"
          defaultValue={seedReps}
          placeholder={rx.targetReps || '—'}
          disabled={done}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Set ${setNumber} reps`}
          data-testid="fl-reps"
        />
      </label>

      <span className="fl-row-cta">{done ? 'Logged' : 'Tap to log'}</span>
    </div>
  );
}

export default function FloorLogger({ uid, dayIdx, day, onClose }) {
  const { prescription, setMap } = useFloorSession(uid, dayIdx);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  // Holds the latest exit handler so the mount-once Escape listener always calls
  // current logic without re-subscribing each render.
  const exitRef = useRef(() => {});

  // Hydrate the cache for this session on open (idempotent) + wire the reconnect
  // flush. The component itself never touches the network beyond this kickoff.
  useEffect(() => {
    ensureFloorSyncWired();
    hydrateFloor({ uid, dayIdx, day }).catch(() => { /* offline → cached prescription stands */ });
  }, [uid, dayIdx, day]);

  // Live online/offline badge.
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  // Escape closes the blackout (routed through the exit handler so a completed
  // session still fires the post-workout check-in).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') exitRef.current(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const doneCount = Object.values(setMap).reduce(
    (acc, byNo) => acc + Object.values(byNo).filter((s) => s.done).length, 0,
  );
  const totalSets = prescription.reduce((acc, rx) => acc + rx.setCount, 0);

  // Exit Floor Mode → if real work was logged, fire the post-workout check-in
  // (feeds the prescription engine) before closing. The Vault shell opens the modal.
  const exitFloor = () => {
    if (doneCount > 0) {
      try {
        window.dispatchEvent(new CustomEvent(SESSION_COMPLETE_EVENT, { detail: { source: 'floor', sets: doneCount } }));
      } catch { /* SSR / no window — non-fatal */ }
    }
    onClose?.();
  };
  // Refs must be mutated outside render — keep the Escape listener pointed at the
  // latest exit handler via an effect, not the render body.
  useEffect(() => { exitRef.current = exitFloor; });

  return (
    <div className="fl-screen" data-testid="floor-logger">
      <header className="fl-top">
        <div className="fl-top-l">
          <span className="fl-kicker">Floor Mode · Local-First</span>
          <h2 className="fl-title">{day?.focus || 'Active Directive'}</h2>
        </div>
        <div className="fl-top-r">
          <span className={`fl-net${online ? ' is-online' : ' is-offline'}`} title={online ? 'Synced when stable' : 'Offline — saved locally'}>
            <span className="fl-net-dot" aria-hidden="true" />
            {online ? 'Online' : 'Offline'}
          </span>
          <button type="button" className="fl-close" onClick={exitFloor} aria-label="Exit Floor Mode" data-testid="fl-close">
            <CloseIcon size={18} />
          </button>
        </div>
      </header>

      <div className="fl-progress" aria-hidden="true">
        <span className="fl-progress-fill" style={{ width: totalSets ? `${(doneCount / totalSets) * 100}%` : '0%' }} />
      </div>
      <div className="fl-progress-label">{doneCount} / {totalSets} sets logged</div>

      <div className="fl-body">
        {prescription.length === 0 ? (
          <div className="fl-empty" data-testid="fl-empty">Loading today’s protocol into the local cache…</div>
        ) : (
          prescription.map((rx) => (
            <FloorExercise key={rx.id} uid={uid} dayIdx={dayIdx} rx={rx} setMap={setMap} />
          ))
        )}
      </div>
    </div>
  );
}
