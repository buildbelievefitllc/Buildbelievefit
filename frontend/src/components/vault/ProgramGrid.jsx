// src/components/vault/ProgramGrid.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.1 — The 7-Day Program Grid (React reconstruction of the legacy
// monolith's live workout view: RW() + RDW() in bbf-app.html).
// Phase 20 — Visual reconstruction: presentation moved to the scoped vault.css
// stylesheet (.pg-*) so we get :hover/:focus rings, expand/rise animations, and
// gym-floor mobile breakpoints that inline styles can't express. Structure and
// logic are unchanged — this is a pure restyle.
//
// Faithful to the legacy dense, clinical layout:
//   • .pg-daynav / .pg-day-pill  — horizontal day-selector pills (active = gold)
//   • .pg-dayhead                — purple-gradient day header (day · focus · cue)
//   • .pg-ex / .pg-ex-head       — collapsible exercise cards (name · equip · sets×reps)
//   • set table                  — 4-col grid: Set | Target | Reps Done | Weight(lbs)
//   • .pg-input.is-done          — inputs go green once filled
//   • autoreg hint               — server last-working-weight per slot (bbf_get_last_weights)
//   • isRest                     — rest/active-recovery card instead of exercises
//
// CATALOG STRICTNESS: every exercise rendered here comes verbatim from the
// authorized programData catalog (a port of the founder-audited `WP`). This
// component never synthesizes movements — there is no path by which a generic
// lift (e.g. a barbell back squat) could be inserted unless it exists in the
// authorized plan.

import { useMemo, useState } from 'react';
import { getProgram } from './programData.js';
import { exKey, useLastWeights, readDayEntries, writeDayEntry, syncSessionToCloud } from './programApi.js';
import './vault.css';

// First trainable day (skip leading rest days) so the grid never opens on a
// blank rest card. Matches the spirit of the monolith's day-1 default.
function initialDayIndex(plan) {
  const i = plan.findIndex((d) => !d.isRest);
  return i === -1 ? 0 : i;
}

export default function ProgramGrid({ uid, programKey }) {
  const plan = useMemo(() => getProgram(programKey), [programKey]);
  const [dayIdx, setDayIdx] = useState(() => initialDayIndex(plan));
  const day = plan[dayIdx] || plan[0];

  return (
    <div className="pg">
      {/* ── Day selector pills ───────────────────────────────────────────── */}
      <nav className="pg-daynav" role="tablist" aria-label="Program days">
        {plan.map((d, i) => {
          const on = i === dayIdx;
          return (
            <button
              key={d.day + i}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDayIdx(i)}
              className={`pg-day-pill${on ? ' is-on' : ''}`}
            >
              {d.day}
            </button>
          );
        })}
      </nav>

      {/* ── Day body — rest card or exercise list ────────────────────────── */}
      {day.isRest ? <RestCard day={day} /> : <DayView key={dayIdx} uid={uid} day={day} dayIdx={dayIdx} />}
    </div>
  );
}

function RestCard({ day }) {
  return (
    <div className="pg-dayhead">
      <div className="pg-day-kicker">{day.day}</div>
      <div className="pg-rest">
        <div className="pg-rest-icon" aria-hidden="true">😴</div>
        <div className="pg-rest-title">{day.focus || 'Rest & Recover'}</div>
        <div className="pg-rest-sub">
          {day.restNote || 'Active recovery — stretch, hydrate, sleep.'}
        </div>
      </div>
    </div>
  );
}

function DayView({ uid, day, dayIdx }) {
  const exercises = day.exercises || [];
  // Cloud-sync status for this day's session. Local buffer persists on every
  // keystroke regardless; this drives the explicit "push session" action.
  const [sync, setSync] = useState({ status: 'idle', msg: '' });

  const onSync = async () => {
    setSync({ status: 'syncing', msg: '' });
    try {
      const res = await syncSessionToCloud(uid, dayIdx);
      if (res.ok) {
        setSync({ status: 'synced', msg: `${res.count} set${res.count === 1 ? '' : 's'} saved to your cloud history.` });
      } else {
        setSync({ status: 'idle', msg: 'Log a weight or reps first, then sync.' });
      }
    } catch (e) {
      // Local buffer is untouched — the athlete can retry once back online.
      setSync({ status: 'error', msg: e.message || 'Sync failed — your sets are still saved on this device.' });
    }
  };

  return (
    <div>
      <header className="pg-dayhead">
        <div className="pg-day-kicker">{day.day}</div>
        <div className="pg-day-focus">{day.focus}</div>
        <div className="pg-day-meta">
          {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          {day.focus_cue ? ` · 🎯 ${day.focus_cue}` : ''}
        </div>
      </header>

      {exercises.map((ex, i) => (
        <ExerciseCard key={ex.name + i} uid={uid} dayIdx={dayIdx} index={i} ex={ex} />
      ))}

      <div className="pg-syncbar">
        <button
          type="button"
          className={`pg-syncbtn${sync.status === 'syncing' ? ' is-busy' : ''}`}
          onClick={onSync}
          disabled={sync.status === 'syncing'}
        >
          {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'synced' ? '✓ Synced — sync again' : '☁ Complete & Sync Day'}
        </button>
        {sync.msg ? (
          <div className={`pg-syncmsg${sync.status === 'error' ? ' is-error' : sync.status === 'synced' ? ' is-synced' : ''}`}>
            {sync.msg}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ExerciseCard({ uid, dayIdx, index, ex }) {
  const [open, setOpen] = useState(index === 0); // first card open, like the legacy default
  // Server last-working-weights for this day (cross-device autoregulation target).
  const { weights } = useLastWeights(uid, dayIdx);
  // Local per-set entries for today, seeded once from localStorage.
  const [entries, setEntries] = useState(() => readDayEntries(uid, dayIdx)[exKey(index)] || []);

  const setCount = Number(ex.sets) > 0 ? Number(ex.sets) : 1;
  const lastWeight = weights?.[exKey(index)];

  const onField = (setIdx, field, value) => {
    writeDayEntry(uid, dayIdx, exKey(index), setIdx, field, value);
    setEntries((prev) => {
      const next = prev.slice();
      next[setIdx] = { ...(next[setIdx] || {}), [field]: value };
      return next;
    });
  };

  return (
    <div className={`pg-ex${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="pg-ex-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="pg-ex-main">
          <span className="pg-ex-name">{ex.name}</span>
          <span className="pg-ex-sub">{ex.equipment} · {setCount} set{setCount === 1 ? '' : 's'} × {ex.reps}</span>
        </span>
        <span className="pg-ex-chevron" aria-hidden="true">▼</span>
      </button>

      {open ? (
        <div className="pg-ex-body">
          {/* Autoregulation target — the server's last working weight for this slot. */}
          <div className={`pg-target ${lastWeight ? 'is-active' : 'is-none'}`}>
            {lastWeight ? (
              <>↑ <strong>Last working weight</strong> <strong>{lastWeight} lb</strong> · match or beat it</>
            ) : (
              <>◯ No history yet — log a weight to start autoregulation</>
            )}
          </div>

          {ex.notes ? <div className="pg-note">💡 {ex.notes}</div> : null}

          <div className="pg-setgrid pg-sethead">
            <div className="pg-setlabel">Set</div>
            <div className="pg-setlabel">Target</div>
            <div className="pg-setlabel">Reps Done</div>
            <div className="pg-setlabel">Weight (lbs)</div>
          </div>

          {Array.from({ length: setCount }).map((_, s) => {
            const rVal = entries[s]?.r ?? '';
            const wVal = entries[s]?.w ?? '';
            return (
              <div className="pg-setgrid" key={s}>
                <div className="pg-setnum">{s + 1}</div>
                <div className="pg-settgt">{ex.reps}</div>
                <input
                  className={`pg-input${rVal !== '' ? ' is-done' : ''}`}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  placeholder="reps"
                  value={rVal}
                  onChange={(e) => onField(s, 'r', e.target.value)}
                  aria-label={`${ex.name} set ${s + 1} reps`}
                />
                <input
                  className={`pg-input${wVal !== '' ? ' is-done' : ''}`}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.5"
                  placeholder="lbs"
                  value={wVal}
                  onChange={(e) => onField(s, 'w', e.target.value)}
                  aria-label={`${ex.name} set ${s + 1} weight in pounds`}
                />
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
