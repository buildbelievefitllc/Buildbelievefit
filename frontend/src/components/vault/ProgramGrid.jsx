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
import { useNavigate } from 'react-router-dom';
import { getProgram } from './programData.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLang } from '../../context/LangContext.jsx';
import { localizeDay } from '../../lib/trainingI18n.js';
import { exKey, useLastWeights, readDayEntries, writeDayEntry, syncSessionToCloud } from './programApi.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
import './vault.css';

// First trainable day (skip leading rest days) so the grid never opens on a
// blank rest card. Matches the spirit of the monolith's day-1 default.
function initialDayIndex(plan) {
  const i = plan.findIndex((d) => !d.isRest);
  return i === -1 ? 0 : i;
}

// "Today's Protocol" default. When the plan uses weekday names ("Monday"…) we snap
// to the real current weekday; otherwise (sequenced "Day N" plans, which carry no
// calendar weekday) we open on the first trainable day. Either way the grid lands on
// the day the athlete should execute now — no horizontal hunting.
function todayDayIndex(plan) {
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const i = plan.findIndex((d) => String(d.day || '').trim().toLowerCase() === weekday);
  return i !== -1 ? i : initialDayIndex(plan);
}

// Prescribed working-load target for a dynamic-plan exercise. The AI engine
// emits this as "weight" (~85% 1RM for primary lifts); tolerate the other field
// names a plan could carry. Returns a trimmed display string ("135 lb",
// "Bodyweight") or '' when the plan prescribes no explicit load.
function prescribedWeight(ex) {
  const raw = ex?.weight ?? ex?.target_weight ?? ex?.targetWeight ?? ex?.load ?? '';
  return String(raw).trim();
}

// Numeric placeholder for the weight input, seeded from the prescribed load
// ("135 lb" → "135"). Empty for non-numeric loads ("Bodyweight") so the input
// keeps its generic "lbs" prompt rather than a misleading number.
function weightPlaceholder(prescribed) {
  const m = String(prescribed).match(/\d+(?:\.\d+)?/);
  return m ? m[0] : '';
}

export default function ProgramGrid({ uid, programKey, dynamicPlan }) {
  const { lang } = useLang();
  // Prefer the user's assigned plan (structured AI payload) when present; fall
  // back to the authorized static catalog by persona. Either way the grid, the
  // per-set logging, and the form-demo video resolver work identically.
  const plan = useMemo(
    () => (Array.isArray(dynamicPlan) && dynamicPlan.length ? dynamicPlan : getProgram(programKey)),
    [dynamicPlan, programKey],
  );
  const todayIdx = useMemo(() => todayDayIndex(plan), [plan]);
  const [dayIdx, setDayIdx] = useState(todayIdx);
  const day = plan[dayIdx] || plan[0];

  return (
    <div className="pg">
      {/* ── Compact day navigator (Today-default · ‹ Prev | dropdown | Next ›) ──
          Replaces the horizontal Mon–Sun pill slider: opens on Today's Protocol,
          stays compact, and never forces a sideways scroll. */}
      <div className="pg-daynav2">
        <button
          type="button"
          className="pg-daynav-arrow"
          disabled={dayIdx <= 0}
          aria-label="Previous day"
          onClick={() => setDayIdx((i) => Math.max(0, i - 1))}
        >
          ‹
        </button>
        <div className="pg-daynav-center">
          <span className="pg-daynav-kicker">{dayIdx === todayIdx ? 'Today’s Protocol' : 'Protocol Day'}</span>
          <div className="pg-daynav-pickrow">
            <select
              className="pg-dayselect"
              value={dayIdx}
              aria-label="Select training day"
              onChange={(e) => setDayIdx(Number(e.target.value))}
            >
              {plan.map((d, i) => (
                <option key={d.day + i} value={i}>
                  {localizeDay(d.day, lang)}{d.isRest ? ' · Rest' : d.focus ? ` · ${d.focus}` : ''}
                </option>
              ))}
            </select>
            {dayIdx === todayIdx
              ? <span className="pg-todaytag" aria-hidden="true">● Today</span>
              : <button type="button" className="pg-todaybtn" onClick={() => setDayIdx(todayIdx)}>Today</button>}
          </div>
        </div>
        <button
          type="button"
          className="pg-daynav-arrow"
          disabled={dayIdx >= plan.length - 1}
          aria-label="Next day"
          onClick={() => setDayIdx((i) => Math.min(plan.length - 1, i + 1))}
        >
          ›
        </button>
      </div>

      {/* ── Day body — rest card or exercise list ────────────────────────── */}
      {day.isRest ? <RestCard day={day} /> : <DayView key={dayIdx} uid={uid} day={day} dayIdx={dayIdx} />}
    </div>
  );
}

function RestCard({ day }) {
  const { lang } = useLang();
  return (
    <div className="pg-dayhead">
      <div className="pg-day-kicker">{localizeDay(day.day, lang)}</div>
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
  const { lang } = useLang();
  const exercises = day.exercises || [];
  // Cloud-sync status for this day's session. Local buffer persists on every
  // keystroke regardless; this drives the explicit "push session" action.
  const [sync, setSync] = useState({ status: 'idle', msg: '' });
  const navigate = useNavigate();
  const { signOut } = useAuth();

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
      // Expired/missing vault token → clear the stale session and route back to
      // the PIN screen to mint a fresh one. The local set buffer is untouched,
      // so re-syncing after re-login pushes the same sets — nothing is lost.
      if (e?.code === 'SESSION_EXPIRED') {
        signOut();
        navigate('/login', { replace: true });
        return;
      }
      // Any other failure — local buffer is intact; the athlete can retry.
      setSync({ status: 'error', msg: e.message || 'Sync failed — your sets are still saved on this device.' });
    }
  };

  return (
    <div>
      <header className="pg-dayhead">
        <div className="pg-day-kicker">{localizeDay(day.day, lang)}</div>
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
  const { lang } = useLang();
  const [open, setOpen] = useState(index === 0); // first card open, like the legacy default
  // Server last-working-weights for this day (cross-device autoregulation target).
  const { weights } = useLastWeights(uid, dayIdx);
  // Local per-set entries for today, seeded once from localStorage.
  const [entries, setEntries] = useState(() => readDayEntries(uid, dayIdx)[exKey(index)] || []);

  const setCount = Number(ex.sets) > 0 ? Number(ex.sets) : 1;
  const lastWeight = weights?.[exKey(index)];
  // Coach-prescribed target load from the athlete's assigned plan. When present
  // it pre-fills the grid (target chip + two-line target cell) so the athlete
  // opens to real numbers, not a blank canvas.
  const target = prescribedWeight(ex);
  // ── Pre-fill engine ─────────────────────────────────────────────────────────
  // Inject the smart defaults the athlete would otherwise have to guess straight
  // into the input affordances — as PLACEHOLDERS, never the controlled `value`.
  // That is the state-safe contract: `value` stays the athlete's real entry ('')
  // until they type, so (a) overriding is frictionless, (b) the controlled-state
  // hooks never fight a synthetic value, and (c) syncSessionToCloud only ever
  // pushes sets actually logged — a placeholder never becomes a phantom row in
  // the cloud history.
  //
  // Reps box hints the assigned rep range straight from the workout_plan slot.
  const repPlaceholder = ex.reps != null && String(ex.reps).trim() !== '' ? String(ex.reps) : 'reps';
  // Weight box hints the autoregulation truth first — the server's last working
  // weight (bbf_get_last_weights), the "match or beat it" number — then falls
  // back to the coach-prescribed load for a lift with no history yet, then the
  // generic prompt. weightPlaceholder() (from the prescribed-weight UI) strips
  // "135 lb" → "135" so a non-numeric load like "Bodyweight" keeps "lbs".
  const wPlaceholder = lastWeight != null ? `${lastWeight}` : (weightPlaceholder(target) || 'BW');
  // Hardwired form-demo video for this movement (fuzzy-resolved against the
  // authorized video map), localized to the active language with EN fallback.
  // null for the few cardio/circuit entries with no demo.
  const videoId = resolveVideoId(ex.name, lang);

  const onField = (setIdx, field, value) => {
    writeDayEntry(uid, dayIdx, exKey(index), setIdx, field, value);
    setEntries((prev) => {
      const next = prev.slice();
      const row = { ...(next[setIdx] || {}) };
      if (value === '' || value == null) delete row[field];
      else row[field] = value;
      next[setIdx] = row;
      return next;
    });
  };

  // Log Set → mark the set complete (collapses to a green summary). Defaults an
  // untouched RPE slider to 7 so a logged set always carries a perceived-exertion
  // value (the metric the Referee/coach reads). Edit (clearing `done`) re-expands it.
  const logSet = (setIdx) => {
    const cur = entries[setIdx] || {};
    if (cur.rpe == null || cur.rpe === '') onField(setIdx, 'rpe', '7');
    onField(setIdx, 'done', 'true');
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
          {/* Form-demo video — clickable thumbnail opening the hardwired YouTube
              demo in a new tab. Only rendered when the movement resolves to a
              mapped video (cardio/circuit blocks have none). */}
          {videoId ? (
            <a
              className="pg-video"
              href={watchURL(videoId)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Watch the form demo for ${ex.name}`}
            >
              <img className="pg-video-thumb" src={thumbURL(videoId)} alt="" loading="lazy" />
              <span className="pg-video-play" aria-hidden="true">▶</span>
              <span className="pg-video-label">Form demo</span>
            </a>
          ) : null}

          {/* Coach-prescribed target — reps × prescribed load from the assigned
              plan. Always rendered when the plan carries a load, so the athlete
              sees their pre-filled numbers even with no logged history yet. */}
          {target ? (
            <div className="pg-target is-prescribed">
              🎯 <strong>Prescribed</strong> {setCount} × {ex.reps} @ <strong>{target}</strong>
            </div>
          ) : null}

          {/* Autoregulation target — the server's last working weight for this slot. */}
          <div className={`pg-target ${lastWeight ? 'is-active' : 'is-none'}`}>
            {lastWeight ? (
              <>↑ <strong>Last working weight</strong> <strong>{lastWeight} lb</strong> · match or beat it</>
            ) : (
              <>◯ No history yet — log a weight to start autoregulation</>
            )}
          </div>

          {ex.notes ? <div className="pg-note">💡 {ex.notes}</div> : null}

          {/* ── Per-set logbook — Weight (BW default) · RPE · Log Set. A logged set
              collapses to a green summary; Edit re-opens it. Reps + weight keep the
              .pg-input / is-done contract (green-on-fill) the autoreg sync reads. ── */}
          <div className="pg-logsets">
            {Array.from({ length: setCount }).map((_, s) => {
              const row = entries[s] || {};
              const rVal = row.r ?? '';
              const wVal = row.w ?? '';
              const rpeVal = row.rpe ?? '';
              const done = row.done === true || row.done === 'true';

              if (done) {
                return (
                  <div className="pg-logset is-done" key={s}>
                    <span className="pg-logset-check" aria-hidden="true">✓</span>
                    <span className="pg-logset-summary">
                      <strong>Set {s + 1}</strong> — {wVal !== '' ? `${wVal} lb` : 'BW'}
                      {rVal !== '' ? ` · ${rVal} reps` : ''}
                      {rpeVal !== '' ? ` · RPE ${rpeVal}` : ''}
                    </span>
                    <button type="button" className="pg-logset-edit" onClick={() => onField(s, 'done', '')}>
                      Edit
                    </button>
                  </div>
                );
              }

              return (
                <div className="pg-logset" key={s}>
                  <span className="pg-logset-num">{s + 1}</span>
                  <label className="pg-logfield">
                    <span className="pg-logfield-l">Reps</span>
                    <input
                      className={`pg-input${rVal !== '' ? ' is-done' : ''}`}
                      type="number" inputMode="numeric" min="0" step="1"
                      placeholder={repPlaceholder}
                      value={rVal}
                      onChange={(e) => onField(s, 'r', e.target.value)}
                      aria-label={`${ex.name} set ${s + 1} reps`}
                    />
                  </label>
                  <label className="pg-logfield">
                    <span className="pg-logfield-l">Weight</span>
                    <input
                      className={`pg-input${wVal !== '' ? ' is-done' : ''}`}
                      type="number" inputMode="decimal" min="0" step="0.5"
                      placeholder={wPlaceholder}
                      value={wVal}
                      onChange={(e) => onField(s, 'w', e.target.value)}
                      aria-label={`${ex.name} set ${s + 1} weight in pounds`}
                    />
                  </label>
                  <label className="pg-logfield pg-logfield-rpe">
                    <span className="pg-logfield-l">RPE <b className={rpeToneClass(rpeVal)}>{rpeVal === '' ? '—' : rpeVal}</b><small className="pg-logfield-cap"> / 10</small></span>
                    <input
                      className="pg-rpe-range"
                      type="range" min="1" max="10" step="0.5"
                      value={rpeVal === '' ? 7 : rpeVal}
                      onChange={(e) => onField(s, 'rpe', e.target.value)}
                      aria-label={`${ex.name} set ${s + 1} RPE`}
                    />
                  </label>
                  <button type="button" className="pg-logbtn" onClick={() => logSet(s)} aria-label={`Log set ${s + 1}`}>
                    ✓ Log Set
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// RPE tone — green comfortable · gold working · red at/over the Referee's 8.5 gate.
function rpeToneClass(v) {
  const n = Number(v);
  if (!v || Number.isNaN(n)) return '';
  if (n >= 9) return 'is-max';
  if (n >= 7) return 'is-hot';
  return 'is-ok';
}
