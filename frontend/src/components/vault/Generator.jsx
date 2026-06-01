// src/components/vault/Generator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 21.5 — Program Generator (Vault tab). React reconstruction of the legacy
// BBF_PROGRAM_GENERATOR studio surface: pick goal / focus / level / location /
// days / duration → deterministic split built STRICTLY from the locked library,
// every movement carrying a hardwired form-demo video. Blacklisted lifts (barbell
// back squat, abdominal crunches) can never appear — enforced in the engine.

import { useState } from 'react';
import {
  generateProgram, GOALS, FOCI, LEVELS, LOCATIONS, DAY_OPTIONS, DURATIONS,
} from './generatorEngine.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
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

export default function Generator() {
  const [params, setParams] = useState(DEFAULTS);
  const [result, setResult] = useState(null);
  const [regen, setRegen] = useState(0);

  const set = (key, value) => setParams((p) => ({ ...p, [key]: value }));
  const run = (nextRegen) => {
    const r = nextRegen ?? 0;
    setRegen(r);
    setResult(generateProgram({ ...params, regen: r }));
  };

  return (
    <div className="gen">
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
