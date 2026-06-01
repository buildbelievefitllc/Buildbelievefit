// src/components/vault/ProgramGrid.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18.1 — The 7-Day Program Grid (React reconstruction of the legacy
// monolith's live workout view: RW() + RDW() in bbf-app.html).
//
// Faithful to the legacy dense, clinical layout:
//   • .dnav / .dbn  — horizontal day-selector pills (active = gold)
//   • .dh           — purple-gradient day header (day label · focus · meta cue)
//   • .eb / .eh     — collapsible exercise cards (name · equipment · sets×reps)
//   • set table     — 4-col grid: Set | Target | Reps Done | Weight(lbs)
//   • .sinp.done    — inputs go green once filled
//   • autoreg hint  — server last-working-weight per slot (bbf_get_last_weights)
//   • isRest        — rest/active-recovery card instead of exercises
//
// CATALOG STRICTNESS: every exercise rendered here comes verbatim from the
// authorized programData catalog (a port of the founder-audited `WP`). This
// component never synthesizes movements — there is no path by which a generic
// lift (e.g. a barbell back squat) could be inserted unless it exists in the
// authorized plan.

import { useMemo, useState } from 'react';
import { getProgram } from './programData.js';
import { exKey, useLastWeights, readDayEntries, writeDayEntry, syncSessionToCloud } from './programApi.js';

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
    <div>
      {/* ── Day selector pills (.dnav) ───────────────────────────────────── */}
      <nav style={styles.dnav} role="tablist" aria-label="Program days">
        {plan.map((d, i) => {
          const on = i === dayIdx;
          return (
            <button
              key={d.day + i}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setDayIdx(i)}
              style={{ ...styles.dbn, ...(on ? styles.dbnOn : null) }}
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
    <div style={styles.dh}>
      <div style={styles.dl}>{day.day}</div>
      <div style={styles.restWrap}>
        <div style={styles.restIcon} aria-hidden="true">😴</div>
        <div style={styles.restTitle}>{day.focus || 'Rest & Recover'}</div>
        <div style={styles.restSub}>
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
      <header style={styles.dh}>
        <div style={styles.dl}>{day.day}</div>
        <div style={styles.dn2}>{day.focus}</div>
        <div style={styles.df2}>
          {exercises.length} exercise{exercises.length === 1 ? '' : 's'}
          {day.focus_cue ? ` · 🎯 ${day.focus_cue}` : ''}
        </div>
      </header>

      {exercises.map((ex, i) => (
        <ExerciseCard key={ex.name + i} uid={uid} dayIdx={dayIdx} index={i} ex={ex} />
      ))}

      <div style={styles.syncBar}>
        <button
          type="button"
          style={{ ...styles.syncBtn, ...(sync.status === 'syncing' ? styles.syncBtnBusy : null) }}
          onClick={onSync}
          disabled={sync.status === 'syncing'}
        >
          {sync.status === 'syncing' ? 'Syncing…' : sync.status === 'synced' ? '✓ Synced — sync again' : '☁ Complete & Sync Day'}
        </button>
        {sync.msg ? (
          <div style={{ ...styles.syncMsg, color: sync.status === 'error' ? 'var(--red)' : sync.status === 'synced' ? 'var(--grn)' : 'var(--mut)' }}>
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
    <div style={styles.eb}>
      <button
        type="button"
        style={styles.eh}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span style={styles.ehMain}>
          <span style={styles.en}>{ex.name}</span>
          <span style={styles.em}>{ex.equipment} · {setCount} set{setCount === 1 ? '' : 's'} × {ex.reps}</span>
        </span>
        <span style={{ ...styles.ec, transform: open ? 'rotate(180deg)' : 'none' }} aria-hidden="true">▼</span>
      </button>

      {open ? (
        <div style={styles.ebody}>
          {/* Autoregulation target — the server's last working weight for this slot. */}
          <div style={{ ...styles.arTarget, ...(lastWeight ? styles.arTargetActive : styles.arTargetNone) }}>
            {lastWeight ? (
              <>↑ <strong>Last working weight</strong> <strong>{lastWeight} lb</strong> · match or beat it</>
            ) : (
              <>◯ No history yet — log a weight to start autoregulation</>
            )}
          </div>

          {ex.notes ? <div style={styles.enote}>💡 {ex.notes}</div> : null}

          <div style={styles.slbs}>
            <div style={styles.slb}>Set</div>
            <div style={styles.slb}>Target</div>
            <div style={styles.slb}>Reps Done</div>
            <div style={styles.slb}>Weight (lbs)</div>
          </div>

          {Array.from({ length: setCount }).map((_, s) => {
            const rVal = entries[s]?.r ?? '';
            const wVal = entries[s]?.w ?? '';
            return (
              <div style={styles.srow2} key={s}>
                <div style={styles.snum}>{s + 1}</div>
                <div style={styles.stgt}>{ex.reps}</div>
                <input
                  style={{ ...styles.sinp, ...(rVal !== '' ? styles.sinpDone : null) }}
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
                  style={{ ...styles.sinp, ...(wVal !== '' ? styles.sinpDone : null) }}
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

const styles = {
  // Day selector
  dnav: { display: 'flex', gap: '.4rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '.3rem' },
  dbn: {
    flexShrink: 0, padding: '.45rem .9rem', borderRadius: 20, border: '1px solid var(--line)',
    background: 'transparent', color: 'var(--mut)', cursor: 'pointer', fontFamily: 'var(--bd)',
    fontSize: '.78rem', fontWeight: 700, letterSpacing: '1px', whiteSpace: 'nowrap',
  },
  dbnOn: { borderColor: 'var(--yel)', background: 'rgba(245,200,0,.08)', color: 'var(--wht)' },

  // Day header
  dh: {
    background: 'linear-gradient(135deg, var(--purp), var(--purd))',
    borderRadius: 16, padding: '1.3rem', marginBottom: '1rem',
  },
  dl: { fontFamily: 'var(--hb)', fontSize: '.7rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)', marginBottom: '.2rem' },
  dn2: { fontFamily: 'var(--display)', fontSize: '1.8rem', fontWeight: 900, letterSpacing: '1px', color: 'var(--yel)', lineHeight: 1.05 },
  df2: { fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 600, color: 'rgba(255,255,255,.6)', marginTop: '.35rem' },

  // Rest card
  restWrap: { textAlign: 'center', padding: '.8rem 0 .2rem' },
  restIcon: { fontSize: '2.4rem', lineHeight: 1 },
  restTitle: { fontFamily: 'var(--display)', fontSize: '1.4rem', letterSpacing: '1px', color: 'var(--yel)', margin: '.5rem 0 .3rem' },
  restSub: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 600, color: 'rgba(255,255,255,.7)', lineHeight: 1.5 },

  // Exercise card
  eb: { background: 'var(--gry)', border: '1px solid #1a1a1a', borderRadius: 14, marginBottom: '.8rem', overflow: 'hidden' },
  eh: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
    padding: '1rem', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left',
  },
  ehMain: { display: 'flex', flexDirection: 'column', gap: '.15rem', minWidth: 0 },
  en: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 700, color: 'var(--wht)' },
  em: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 600, color: 'var(--mut)' },
  ec: { color: 'var(--mut)', fontSize: '1.05rem', flexShrink: 0, transition: 'transform .2s ease' },

  ebody: { padding: '0 1rem 1rem', borderTop: '1px solid #1a1a1a' },

  arTarget: {
    fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 600, borderRadius: 10,
    padding: '.6rem .8rem', margin: '.8rem 0', border: '1px solid transparent',
  },
  arTargetActive: { background: 'rgba(34,197,94,.06)', borderColor: 'rgba(34,197,94,.4)', color: 'var(--grn)' },
  arTargetNone: { background: 'rgba(80,80,80,.05)', borderColor: 'var(--line)', color: 'var(--mut)' },

  enote: {
    fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 600, lineHeight: 1.45, color: 'var(--wht)',
    background: 'rgba(245,200,0,.05)', border: '1px solid rgba(245,200,0,.15)', borderRadius: 10, padding: '.6rem .8rem',
  },

  slbs: { display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', gap: '.5rem', marginTop: '.8rem' },
  slb: { fontFamily: 'var(--hb)', fontSize: '.62rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--mut)', textAlign: 'center' },
  srow2: { display: 'grid', gridTemplateColumns: '36px 1fr 1fr 1fr', gap: '.5rem', alignItems: 'center', marginTop: '.5rem' },
  snum: { fontFamily: 'var(--display)', fontSize: '1rem', fontWeight: 900, color: 'var(--yel)', textAlign: 'center' },
  stgt: { fontFamily: 'var(--bd)', fontSize: '.95rem', fontWeight: 700, color: 'var(--mut)', textAlign: 'center' },
  sinp: {
    background: '#0c0c0c', border: '1px solid #222', color: 'var(--wht)', padding: '.55rem .5rem',
    fontFamily: 'var(--bd)', fontSize: '1rem', borderRadius: 8, outline: 'none', width: '100%',
    textAlign: 'center', boxSizing: 'border-box',
  },
  sinpDone: { borderColor: 'var(--grn)', background: 'rgba(34,197,94,.05)' },

  // Cloud sync
  syncBar: { marginTop: '1.1rem', display: 'flex', flexDirection: 'column', gap: '.5rem' },
  syncBtn: {
    width: '100%', fontFamily: 'var(--hb)', fontSize: '.85rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: 'var(--blk)', background: 'var(--yel)', border: 'none', borderRadius: 10, padding: '.9rem',
    cursor: 'pointer', fontWeight: 700,
  },
  syncBtnBusy: { opacity: 0.6, cursor: 'progress' },
  syncMsg: { fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 },
};
