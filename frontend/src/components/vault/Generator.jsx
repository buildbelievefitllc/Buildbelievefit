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
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  generateProgram, GOALS, GENDERS, LEVELS, LOCATIONS, DAY_OPTIONS, PACES, SPLITS, INTENSIFIERS, PRESETS,
} from './generatorEngine.js';
import { resolveVideoId, watchURL, thumbURL } from './exerciseVideos.js';
import './vault.css';

// ── Token Economy (client-side monetization gate · 1 blueprint token / month) ────
// The Vault Roster Engine is a metered premium surface. ADMINS on the Command Center
// route (`onCommandSurface`) run UNLIMITED — it is their authoring console. A standard
// CLIENT gets ONE generation per calendar month: every code path that calls
// generateProgram (manual generate, signature preset, reshuffle, warm-up re-toggle)
// spends that single token, after which the whole engine locks until the next month.
//
// The spend is persisted per-uid + period so a page reload can't mint a fresh token —
// this is the frontend mock of the meter; the authoritative ledger lands server-side
// when the Token Economy ships. Private-mode / quota failures degrade to in-state only.
const TOKEN_KEY = 'bbf_gen_token_v1';

// Calendar-month stamp (YYYY-M) — the unit the monthly token resets on.
function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}

function tokenSpentThisPeriod(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
    return all?.[uid] === currentPeriod();
  } catch { return false; }
}

function spendToken(uid) {
  try {
    const all = JSON.parse(localStorage.getItem(TOKEN_KEY) || '{}');
    all[uid] = currentPeriod();
    localStorage.setItem(TOKEN_KEY, JSON.stringify(all));
  } catch { /* private-mode / quota — the in-component state still locks the button */ }
}

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

export default function Generator({ onRevertToLibrary }) {
  const [params, setParams] = useState(DEFAULTS);
  const [warmups, setWarmups] = useState(true);
  const [activePreset, setActivePreset] = useState(null);
  const [result, setResult] = useState(null);
  const [regen, setRegen] = useState(0);

  // ── Role gate ──────────────────────────────────────────────────────────────
  // Gate on the ROUTE, not the role: the CEO trains as a Player-Coach and reads as
  // admin everywhere, so a role-only check would hand his own client Vault unlimited
  // tokens and break the monetization demo. /command IS the admin authoring surface
  // (AdminGuard-gated) — only there is the engine unlimited. Mirrors the Nutrition
  // Locker surface gate.
  const onCommandSurface = useLocation().pathname.startsWith('/command');
  const { user } = useAuth();
  const uid = user?.username || user?.id || '';

  // Client token meter — seed from persisted spend so a reload can't reset it. Admins
  // never spend, so their meter is irrelevant (canGenerate is always true for them).
  const [tokenSpent, setTokenSpent] = useState(() => !onCommandSurface && tokenSpentThisPeriod(uid));
  const isUnlimited = onCommandSurface;
  const canGenerate = isUnlimited || !tokenSpent;

  // Any manual change drops the "active preset" highlight (the program no longer
  // matches a signature split verbatim).
  const set = (key, value) => { setParams((p) => ({ ...p, [key]: value })); setActivePreset(null); };

  // Single choke point for every generation path — enforces the client token gate
  // once, centrally, and burns the monthly token on the first successful run.
  const emit = (envelope) => {
    if (!canGenerate) return false;
    setResult(generateProgram(envelope));
    if (!isUnlimited) { spendToken(uid); setTokenSpent(true); }
    return true;
  };

  const run = (nextRegen = 0) => {
    if (!canGenerate) return;
    setRegen(nextRegen);
    emit({ ...params, warmups, regen: nextRegen });
  };

  // A signature preset overwrites the whole envelope (params + warm-up flag) and
  // generates immediately — computed from the preset values, not async state. Still
  // a metered generation: a client preset tap spends the monthly token like any run.
  const applyPreset = (preset) => {
    if (!canGenerate) return;
    setParams(preset.params);
    setWarmups(preset.warmups);
    setActivePreset(preset.id);
    setRegen(0);
    emit({ ...preset.params, warmups: preset.warmups, regen: 0 });
  };

  const toggleWarmups = () => {
    const next = !warmups;
    setWarmups(next);
    setActivePreset(null);
    // Re-toggling warm-ups re-runs the engine; honor the same token gate so it can't
    // be used to keep regenerating after the monthly token is exhausted.
    if (result && canGenerate) emit({ ...params, warmups: next, regen });
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
              disabled={!canGenerate}
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
          disabled={!canGenerate}
        >
          <span className={`gen-switch${warmups ? ' is-on' : ''}`}><span className="gen-switch-thumb" /></span>
          <span className="gen-toggle-lbl">Attach Warm-Ups &amp; Cool-Downs</span>
        </button>

        <div className="gen-actions">
          {/* Primary generate button. ADMIN (command surface): unlimited authoring.
              CLIENT: the monthly token state drives both the label and the lock. */}
          {isUnlimited ? (
            <button type="button" className="gen-run" onClick={() => run(0)}>
              <span aria-hidden="true">🏋 </span>Generate Designed Program Blueprint
            </button>
          ) : canGenerate ? (
            <button type="button" className="gen-run" onClick={() => run(0)}>
              <span aria-hidden="true">🏋 </span>Generate Blueprint (1 Token Available)
            </button>
          ) : (
            <button type="button" className="gen-run is-exhausted" disabled aria-disabled="true">
              <span aria-hidden="true">🔒 </span>Token Exhausted (Unlocks in 30 Days)
            </button>
          )}
          {/* Reshuffle is another full generation — admin-only, so it can never be
              used to bypass the client's one-token-per-month hard limit. */}
          {result && isUnlimited ? (
            <button type="button" className="gen-regen" onClick={() => run(regen + 1)}>↻ Reshuffle</button>
          ) : null}
        </div>

        {/* Failsafe (client, token spent) — route the athlete back to their assigned,
            saved routine instead of a dead end. */}
        {!isUnlimited && tokenSpent ? (
          <button
            type="button"
            className="gen-revert"
            onClick={() => onRevertToLibrary?.()}
          >
            Out of tokens? Revert to your Saved Program Library →
          </button>
        ) : null}

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
