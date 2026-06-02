// src/components/vault/Generator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.5 — Program Generator (Vault tab). React reconstruction of the legacy
// BBF_PROGRAM_GENERATOR studio surface: pick goal / focus / level / location /
// days / duration → deterministic split built STRICTLY from the locked library,
// every movement carrying a hardwired form-demo video. Blacklisted lifts (barbell
// back squat, abdominal crunches) can never appear — enforced in the engine.

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  generateProgram, GOALS, FOCI, LEVELS, LOCATIONS, DAY_OPTIONS, DURATIONS,
} from './generatorEngine.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
import { rosterCall, assignProgram, toErrorMessage } from '../../lib/rosterApi.js';
import './vault.css';

const FIELDS = [
  { key: 'goal', label: 'Goal', options: GOALS },
  { key: 'focus', label: 'Focus', options: FOCI },
  { key: 'level', label: 'Level', options: LEVELS },
  { key: 'loc', label: 'Location', options: LOCATIONS },
  { key: 'days', label: 'Days / week', options: DAY_OPTIONS.map((v) => ({ v, l: v })) },
  { key: 'dur', label: 'Session length', options: DURATIONS },
];

const DEFAULTS = { goal: 'hypertrophy', focus: 'full', level: '2', loc: 'commercial', days: '4', dur: '60' };

// First number of a prescription range ("3-4" → 3) — the grid renders one logging
// row per set, so this must be a count, not the range text.
function setCountFrom(setsRx) {
  const m = String(setsRx ?? '').match(/\d+/);
  return m ? parseInt(m[0], 10) : 3;
}
function titleCase(s) {
  const t = String(s ?? '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}

// Serialize a generated split into the structured workout_plan the athlete's Vault
// renders (vaultApi.parseWorkoutPlan → ProgramGrid): an array of day objects
// { day, focus, exercises:[{ name, equipment, sets, reps }] }. Empty days become
// rest cards. `name` is what the server blacklist-scrub keys on, so the contract is
// exact end-to-end.
function toWorkoutPlan(result) {
  const days = Array.isArray(result?.program) ? result.program : [];
  return days.map((day, di) => {
    const exercises = (day.exercises || []).map((ex) => ({
      name: ex.n,
      equipment: titleCase(Array.isArray(ex.eq) ? ex.eq[0] : (ex.p || '')),
      sets: setCountFrom(day.rx?.sets),
      reps: day.rx?.reps ?? '',
    }));
    if (!exercises.length) {
      return { day: `Day ${di + 1}`, focus: day.label || 'Rest', isRest: true, restNote: 'Active recovery — stretch, hydrate, sleep.' };
    }
    return { day: `Day ${di + 1}`, focus: day.label || `Day ${di + 1}`, exercises };
  });
}

export default function Generator() {
  const { isAdmin } = useAuth();
  const [params, setParams] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [regen, setRegen] = useState(0);

  // ── Admin targeting (roster → assign) ──────────────────────────────────────
  // The whole Generator tab is admin-gated by the shell, but we still source the
  // roster + assignment through the admin gateway here so the cross-user write is
  // never possible without the runtime admin token (§7). Seed loading from isAdmin
  // so the effect mutates state ONLY in its async callbacks (react-hooks safe).
  const [roster, setRoster] = useState([]);
  const [rosterErr, setRosterErr] = useState(null);
  const [loadingRoster, setLoadingRoster] = useState(isAdmin);
  const [selectedId, setSelectedId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignStatus, setAssignStatus] = useState(null); // { kind:'ok'|'err', msg }

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    rosterCall('roster')
      .then((b) => { if (!cancelled) setRoster(Array.isArray(b.clients) ? b.clients : []); })
      .catch((e) => { if (!cancelled) setRosterErr(toErrorMessage(e)); })
      .finally(() => { if (!cancelled) setLoadingRoster(false); });
    return () => { cancelled = true; };
  }, [isAdmin]);

  const selected = roster.find((c) => String(c.id) === String(selectedId)) || null;
  const selectedName = selected ? (selected.name || selected.uid) : '';

  const set = (key, value) => setParams((p) => ({ ...p, [key]: value }));
  const run = (nextRegen) => {
    const r = nextRegen ?? 0;
    setRegen(r);
    setResult(generateProgram({ ...params, regen: r }));
    setAssignStatus(null); // a fresh/reshuffled split invalidates the prior assign note
  };

  // Preview → Assign: push the CURRENTLY-PREVIEWED split to the selected athlete's
  // uid via the service-role edge action. Never writes the logged-in admin's plan.
  async function assign() {
    if (assigning || !result || !selectedId) return;
    setAssigning(true);
    setAssignStatus(null);
    try {
      const b = await assignProgram(selectedId, toWorkoutPlan(result));
      const stripped = b?.blacklist_scrubbed ? ` · ${b.blacklist_scrubbed} contraindicated lift(s) auto-stripped` : '';
      setAssignStatus({ kind: 'ok', msg: `Program pushed to ${selectedName} (@${b?.target?.uid || selected?.uid || ''}).${stripped}` });
    } catch (e) {
      setAssignStatus({ kind: 'err', msg: toErrorMessage(e) });
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="gen">
      {isAdmin ? (
        <div className="pg-card gen-roster" data-testid="gen-roster">
          <div className="gen-roster-head">
            <span className="gen-roster-badge">Admin · Targeting</span>
            <h3 className="gen-roster-title">Select Athlete to Program</h3>
          </div>
          <label className="gen-field gen-field-wide">
            <span className="gen-field-lbl">Client Roster</span>
            <select
              className="gen-select"
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setAssignStatus(null); }}
              disabled={loadingRoster || assigning}
              aria-label="Select an athlete to program"
              data-testid="gen-athlete-select"
            >
              <option value="">{loadingRoster ? 'Loading roster…' : 'Select an athlete…'}</option>
              {roster.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.uid}{c.uid ? ` · @${c.uid}` : ''}</option>
              ))}
            </select>
          </label>
          {rosterErr ? <div className="gen-status is-err" role="alert">{rosterErr}</div> : null}
          {selected ? (
            <div className="gen-roster-target">◎ Generated programs assign to <strong>{selectedName}</strong>.</div>
          ) : (
            <div className="gen-roster-hint">Pick an athlete, generate a split, then push it straight to their Vault.</div>
          )}
        </div>
      ) : null}

      <div>
        <h2 className="pg-nut-head">Program Generator</h2>
        <div className="pg-nut-meta">Built from the locked BBF library — every lift ships a form demo.</div>
      </div>

      <div className="gen-form pg-card">
        <div className="gen-controls">
          {FIELDS.map((f) => (
            <label key={f.key} className="gen-field">
              <span className="gen-field-lbl">{f.label}</span>
              <select
                className="gen-select"
                value={params[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              >
                {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
            </label>
          ))}
        </div>
        <div className="gen-actions">
          <button type="button" className="gen-run" onClick={() => run(0)}>Generate Program</button>
          {result ? (
            <button type="button" className="gen-regen" onClick={() => run(regen + 1)}>↻ Reshuffle</button>
          ) : null}
        </div>
        <div className="gen-guard">
          🔒 Contraindicated movements (barbell back squat · abdominal crunches) are auto-excluded.
        </div>
      </div>

      {/* Preview → Assign: the write is a deliberate second step, so a one-click
          Generate can never silently overwrite an athlete's coach-authored plan. */}
      {result && isAdmin ? (
        <div className="pg-card gen-assignbar" data-testid="gen-assignbar">
          <div className="gen-assign-copy">
            <span className="gen-assign-lbl">Deploy Protocol</span>
            <span className="gen-assign-sub">
              {selectedId
                ? <>Push this {result.program.length}-day split to <strong>{selectedName}</strong>’s Vault.</>
                : 'Select an athlete above to enable assignment.'}
            </span>
          </div>
          <button
            type="button"
            className="gen-assign"
            onClick={assign}
            disabled={!selectedId || assigning}
            data-testid="gen-assign-program"
          >
            {assigning ? 'Assigning…' : selectedId ? `Assign to ${selectedName}` : 'Assign to Athlete'}
          </button>
          {assignStatus ? (
            <div className={`gen-status ${assignStatus.kind === 'ok' ? 'is-ok' : 'is-err'}`} role="status">
              {assignStatus.msg}
            </div>
          ) : null}
        </div>
      ) : null}

      {result ? <GeneratorOutput result={result} /> : (
        <div className="pg-card gen-placeholder">
          Set your parameters and generate a fresh, video-backed split.
        </div>
      )}
    </div>
  );
}

function GeneratorOutput({ result }) {
  if (!result.program?.length) {
    return <div className="pg-card gen-placeholder">No exercises matched those parameters — try a different location or focus.</div>;
  }
  return (
    <div className="gen-out">
      {result.program.map((day, di) => (
        <div className="gen-day pg-card" key={day.label + di}>
          <div className="gen-dayhead">
            <span className="gen-dayn">Day {di + 1}</span>
            <span className="gen-dayf">{day.label}</span>
          </div>
          {day.exercises.length === 0 ? (
            <div className="gen-ex"><div className="gen-exname">Rest / Active Recovery</div></div>
          ) : day.exercises.map((ex, ei) => {
            const vid = resolveVideoId(ex.n);
            return (
              <div className="gen-ex" key={ex.n + ei}>
                {vid ? (
                  <a className="gen-vid" href={watchURL(vid)} target="_blank" rel="noopener noreferrer" aria-label={`Form demo: ${ex.n}`}>
                    <img src={thumbURL(vid)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    <span className="gen-vid-play" aria-hidden="true">▶</span>
                  </a>
                ) : null}
                <div className="gen-exmain">
                  <div className="gen-exname">{ex.n}</div>
                  <div className="gen-exmeta"><span className="gen-mg">{ex.g.toUpperCase()}</span> · {ex.p}</div>
                </div>
                <div className="gen-rx">
                  <div className="gen-sr">{day.rx.sets}×{day.rx.reps}</div>
                  <div className="gen-rest">rest {day.rx.rest}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
