// src/components/vault/Generator.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Program Generator (Vault tab) — the Vault Roster Engine. React reconstruction of
// the legacy BBF_PROGRAM_GENERATOR studio surface, locked to the definitive UI blueprint:
//
//   • AKEEM'S SIGNATURE CHAMBER SPLITS (Overwatch Override) — 3 hard-wired chambers
//     (I · Arnold Era Classic, II · FST-7 Fascia Expand, III · Elite NASM Clinical).
//     One tap loads a coherent parameter envelope.
//   • 8 SIGNATURE SELECTORS: Training Priority · Athletic Gender Focus · Experience
//     Level · Destination Equip Priority · Weekly Frequency · Workout Pace Target ·
//     Splits Architecture · Intensifier Technique.
//   • ATTACH WARM-UPS & COOL-DOWNS toggle — prepends a dynamic prep block and appends
//     a decompression block to every training day.
//
// Output is a deterministic split built STRICTLY from the locked library, every
// movement carrying a hardwired form-demo video. Blacklisted lifts (barbell back
// squat, abdominal crunches) can never appear — enforced in the engine.

import { useState } from 'react';
import {
  generateProgram, GOALS, GENDERS, LEVELS, LOCATIONS, DAY_OPTIONS, PACES, SPLITS, INTENSIFIERS, PRESETS,
} from './generatorEngine.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
import './vault.css';

// The 8 signature parameter selectors (exact Vault Roster Engine blueprint, in order).
const FIELDS = [
  { key: 'goal', label: 'Training Priority', options: GOALS },
  { key: 'gender', label: 'Athletic Gender Focus', options: GENDERS },
  { key: 'level', label: 'Experience Level', options: LEVELS },
  { key: 'loc', label: 'Destination Equip Priority', icon: '📍', options: LOCATIONS },
  { key: 'days', label: 'Weekly Frequency', options: DAY_OPTIONS.map((v) => ({ v, l: `${v} Days / Week` })) },
  { key: 'dur', label: 'Workout Pace Target', options: PACES },
  { key: 'arch', label: 'Splits Architecture', icon: '⚡', options: SPLITS },
  { key: 'intensifier', label: 'Intensifier Technique', icon: '🔥', options: INTENSIFIERS },
];

// Labels for any param value not present in its dropdown's option list — e.g. the
// Chamber II (FST-7) preset sets intensifier:'fst7', a signature preset rather than a
// standard Intensifier Technique. Rendering it keeps the <select> controlled & clear.
const EXTRA_OPTION_LABELS = { fst7: 'FST-7 Fascia Finisher' };

const DEFAULTS = {
  goal: 'hypertrophy', gender: 'any', level: '2', loc: 'any-home',
  days: '3', dur: '60', arch: 'full', intensifier: 'none',
};

export default function Generator() {
  const [params, setParams] = useState(DEFAULTS);
  const [warmups, setWarmups] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [result, setResult] = useState(null);
  const [regen, setRegen] = useState(0);

  // Any manual change drops the "active preset" highlight (the program no longer
  // matches a signature split verbatim).
  const set = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setActivePreset(null); };

  const run = (nextRegen = 0) => {
    setRegen(nextRegen);
    setResult(generateProgram({ ...params, warmups, regen: nextRegen }));
  };

  // A signature preset overwrites the whole envelope (params + warm-up flag) and
  // generates immediately — computed from the preset values, not async state.
  const applyPreset = (preset) => {
    setParams(preset.params);
    setWarmups(preset.warmups);
    setActivePreset(preset.id);
    setRegen(0);
    setResult(generateProgram({ ...preset.params, warmups: preset.warmups, regen: 0 }));
  };

  const toggleWarmups = () => {
    const next = !warmups;
    setWarmups(next);
    setActivePreset(null);
    if (result) setResult(generateProgram({ ...params, warmups: next, regen }));
  };

  return (
    <div className="gen">
      <div>
        <h2 className="pg-nut-head">⚡ Vault Roster Engine</h2>
        <div className="pg-nut-meta">
          Signature chamber splits · 8-parameter control · built strictly from the locked BBF library. Every lift ships a form demo.
        </div>
      </div>

      {/* ── Akeem's Signature Chamber Splits (Overwatch Override) — 3 hard-wired presets ── */}
      <div className="pg-card gen-chambers">
        <div className="gen-chambers-head">
          <h3 className="gen-chambers-title">
            <span aria-hidden="true">🏆</span> Akeem&apos;s Signature Chamber Splits <span className="gen-chambers-tag">(Overwatch Override)</span>
          </h3>
          <p className="gen-chambers-sub">
            Pledge dynamic pre-compiled splits modeled directly on Akeem&apos;s golden-era protocols. Zero AI waiting, maximum immediate cell recruitment.
          </p>
        </div>
        <div className="gen-presets" role="group" aria-label="Signature chamber splits">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`gen-preset${activePreset === p.id ? ' is-active' : ''}`}
              aria-pressed={activePreset === p.id}
              onClick={() => applyPreset(p)}
            >
              {p.chamber ? <span className="gen-preset-chamber">{p.chamber}</span> : null}
              <span className="gen-preset-name">{p.label}</span>
              <span className="gen-preset-sub">{p.blurb}</span>
              <span className="gen-preset-cta" aria-hidden="true">Activate Split →</span>
            </button>
          ))}
        </div>
      </div>

      <div className="gen-form pg-card">
        <div className="gen-controls">
          {FIELDS.map((f) => {
            const known = f.options.some((o) => o.v === params[f.key]);
            return (
              <label key={f.key} className="gen-field">
                <span className="gen-field-lbl">
                  {f.icon ? <span className="gen-field-ic" aria-hidden="true">{f.icon} </span> : null}{f.label}
                </span>
                <select
                  className="gen-select"
                  value={params[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                >
                  {f.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  {/* A preset can set a value outside this dropdown's list (e.g. FST-7). */}
                  {!known ? <option value={params[f.key]}>{EXTRA_OPTION_LABELS[params[f.key]] || params[f.key]}</option> : null}
                </select>
              </label>
            );
          })}
        </div>

        {/* ── ATTACH WARM-UPS & COOL-DOWN toggle ── */}
        <button
          type="button"
          role="switch"
          aria-checked={warmups}
          className={`gen-toggle${warmups ? ' is-on' : ''}`}
          onClick={toggleWarmups}
        >
          <span className={`gen-switch${warmups ? ' is-on' : ''}`}><span className="gen-switch-thumb" /></span>
          <span className="gen-toggle-lbl">Attach Warm-Ups &amp; Cool-Downs</span>
        </button>

        <div className="gen-actions">
          <button type="button" className="gen-run" onClick={() => run(0)}><span aria-hidden="true">🏋 </span>Generate Designed Program Blueprint</button>
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
          Activate a signature chamber split or set your 8 parameters, then generate a fresh, video-backed program.
        </div>
      )}
    </div>
  );
}

function GeneratorOutput({ result }) {
  if (!result.program?.length) {
    return <div className="pg-card gen-placeholder">No exercises matched those parameters — try a different equipment profile or architecture.</div>;
  }
  return (
    <div className="gen-out">
      {result.program.map((day, di) => (
        <div className="gen-day pg-card" key={day.label + di}>
          <div className="gen-dayhead">
            <span className="gen-dayn">Day {di + 1}</span>
            <span className="gen-dayf">{day.label}</span>
            {day.rx?.technique ? <span className="gen-tech">{day.rx.technique}</span> : null}
          </div>
          {day.rx?.techniqueCue ? <div className="gen-techcue">⚡ {day.rx.techniqueCue}</div> : null}

          {day.warmup?.length ? (
            <div className="gen-warm">
              <div className="gen-warm-h">Warm-Up</div>
              <ul className="gen-warm-list">{day.warmup.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}

          {day.exercises.length === 0 ? (
            <div className="gen-ex"><div className="gen-exname">Rest / Active Recovery</div></div>
          ) : day.exercises.map((ex, ei) => {
            const vid = resolveVideoId(ex.n);
            const exRx = ex.rx || day.rx;
            return (
              <div className="gen-ex" key={ex.n + ei}>
                {vid ? (
                  <a className="gen-vid" href={watchURL(vid)} target="_blank" rel="noopener noreferrer" aria-label={`Form demo: ${ex.n}`}>
                    <img src={thumbURL(vid)} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    <span className="gen-vid-play" aria-hidden="true">▶</span>
                  </a>
                ) : null}
                <div className="gen-exmain">
                  <div className="gen-exname">{ex.n}{ex.fst7 ? <span className="gen-fst7">FST-7</span> : null}</div>
                  <div className="gen-exmeta"><span className="gen-mg">{ex.g.toUpperCase()}</span> · {ex.p}</div>
                </div>
                <div className="gen-rx">
                  <div className="gen-sr">{exRx.sets}×{exRx.reps}</div>
                  <div className="gen-rest">rest {exRx.rest}</div>
                </div>
              </div>
            );
          })}

          {day.cooldown?.length ? (
            <div className="gen-warm gen-warm--cool">
              <div className="gen-warm-h">Cool-Down</div>
              <ul className="gen-warm-list">{day.cooldown.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
