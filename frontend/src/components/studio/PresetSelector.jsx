// src/components/studio/PresetSelector.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.3 — the Content Studio V4 job configurator (CONTENT_STUDIO_V4).
//
// The admin picks the base preset (+ audience / locale / device class) and may
// specify an optional gram_override — e.g. forcing a 150,000 g tonnage benchmark.
//
// THE GRAM BOUNDARY (non-negotiable): the override input is validated as INTEGER
// GRAMS (validateGrams) BEFORE the Edge Function is ever called; Compile is blocked
// until it passes. The field is unmistakably grams — a ' g' adornment, a "grams"
// unit label, and a locale-grouped live preview ("= 150,000 g").
//
// The preset catalog is parent-supplied (the Command Center owns that read); with
// none provided, the compiler's is_default preset is used.
//
// @param {{ presets?: Array<{id:string,label?:string,name?:string,is_default?:boolean}>,
//           onCompile:(jobs:Array<Object>)=>void, compiling?:boolean, authed?:boolean,
//           defaultLocale?:'en'|'es'|'pt' }} props

import { useState } from 'react';
import { useStudioStr, validateGrams, formatGrams, GRAM_SOURCES } from './studioStrings.js';
import './studio.css';

export default function PresetSelector({ presets = [], onCompile, compiling = false, authed = true, defaultLocale = 'en' }) {
  const { ss, sourceLabels, lang } = useStudioStr();

  const [presetId, setPresetId] = useState('');
  const [audience, setAudience] = useState('social');
  const [targetId, setTargetId] = useState('');
  const [locale, setLocale] = useState(defaultLocale);
  const [device, setDevice] = useState('mid');
  const [overrideOn, setOverrideOn] = useState(false);
  const [overrideSource, setOverrideSource] = useState(GRAM_SOURCES[0]);
  const [gramInput, setGramInput] = useState('');

  const gram = validateGrams(gramInput);
  const gramBad = overrideOn && !gram.valid;
  const directedBad = audience === 'directed' && !targetId.trim();
  const canCompile = authed && !compiling && !gramBad && !directedBad;

  function submit() {
    if (!canCompile) return;
    const job = { kind: 'reel', audience, locale, device_class: device };
    if (presetId) job.preset_id = presetId;
    if (audience === 'directed' && targetId.trim()) job.target_athlete_id = targetId.trim();
    if (overrideOn && gram.valid) job.gram_override = { [overrideSource]: gram.value };
    onCompile([job]);
  }

  if (!authed) {
    return (
      <section className="st-panel" aria-label={ss.title}>
        <div className="st-locked" role="note">{ss.locked}</div>
      </section>
    );
  }

  return (
    <section className="st-panel" aria-label={ss.title}>
      <header className="st-head">
        <span className="st-kicker">{ss.kicker}</span>
        <h3 className="st-title">{ss.title}</h3>
      </header>

      <div className="st-grid">
        <label className="st-field">
          <span className="st-label">{ss.preset}</span>
          <select className="st-select" value={presetId} onChange={(e) => setPresetId(e.target.value)}>
            <option value="">{ss.presetDefault}</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>{(p.label || p.name || p.id) + (p.is_default ? ' ★' : '')}</option>
            ))}
          </select>
        </label>

        <label className="st-field">
          <span className="st-label">{ss.audience}</span>
          <select className="st-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="social">{ss.audienceSocial}</option>
            <option value="directed">{ss.audienceDirected}</option>
          </select>
        </label>

        <label className="st-field">
          <span className="st-label">{ss.locale}</span>
          <select className="st-select" value={locale} onChange={(e) => setLocale(e.target.value)}>
            <option value="en">EN</option><option value="es">ES</option><option value="pt">PT</option>
          </select>
        </label>

        <label className="st-field">
          <span className="st-label">{ss.device}</span>
          <select className="st-select" value={device} onChange={(e) => setDevice(e.target.value)}>
            <option value="high">{ss.deviceHigh}</option>
            <option value="mid">{ss.deviceMid}</option>
            <option value="low">{ss.deviceLow}</option>
          </select>
        </label>
      </div>

      {audience === 'directed' ? (
        <label className="st-field st-field--wide">
          <span className="st-label">{ss.athleteId}</span>
          <input className="st-input" type="text" value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder={ss.athleteIdPh} />
          {directedBad ? <span className="st-err">{ss.directedNoAthlete}</span> : null}
        </label>
      ) : null}

      {/* ── gram_override — the Gram Boundary input ── */}
      <div className="st-override">
        <label className="st-toggle">
          <input type="checkbox" checked={overrideOn} onChange={(e) => setOverrideOn(e.target.checked)} />
          <span>{ss.overrideToggle}</span>
        </label>

        {overrideOn ? (
          <div className="st-override-body">
            <label className="st-field">
              <span className="st-label">{ss.overrideSource}</span>
              <select className="st-select" value={overrideSource} onChange={(e) => setOverrideSource(e.target.value)}>
                {GRAM_SOURCES.map((s) => <option key={s} value={s}>{sourceLabels[s] || s}</option>)}
              </select>
            </label>

            <label className="st-field">
              <span className="st-label">{ss.gramLabel} <span className="st-unit-tag">{ss.gramUnit}</span></span>
              <div className={`st-gram-input${gramBad ? ' is-bad' : ''}`}>
                <input
                  className="st-input st-input--gram"
                  type="text"
                  inputMode="numeric"
                  value={gramInput}
                  onChange={(e) => setGramInput(e.target.value)}
                  placeholder={ss.gramPh}
                  aria-label={`${ss.gramLabel} (${ss.gramUnit})`}
                  aria-invalid={gramBad}
                />
                <span className="st-gram-suffix" aria-hidden="true">g</span>
              </div>
              {gram.valid ? (
                <span className="st-gram-preview">= {formatGrams(gram.value, lang)}</span>
              ) : (
                <span className={gramInput ? 'st-err' : 'st-hint'}>{gramInput ? ss.gramInvalid : ss.gramHelp}</span>
              )}
            </label>
          </div>
        ) : null}
      </div>

      <button type="button" className="st-compile" onClick={submit} disabled={!canCompile}>
        {compiling ? ss.compiling : ss.compile}
      </button>
    </section>
  );
}
