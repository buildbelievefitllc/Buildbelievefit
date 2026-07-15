// src/components/command/SovereignStudio.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FRONT 5 — SOVEREIGN STUDIO. The CEO's private content studio for mass-producing
// social VO, local pitches, and Mindset tracks in the BBF Coach Akeem clone.
// Admin-only: rendered exclusively inside the AdminGuard-gated Command Center, and
// the webhook re-checks the admin's vault token server-side.
//
// Flow: write/Quick-Insert a script → pick a Vibe → Generate Preview (the only
// character spend) → hear it → Save to Vault (downloads the MP3 to the device for
// external video editing; zero extra spend).

import { useEffect, useRef, useState } from 'react';
import { generateStudioVoice } from '../../lib/studioApi.js';
import './sovereignStudio.css';

// The Vibe Matrix — mirrors the server's bbf-sovereign-studio vibes (BBF Lab
// vocal states). id MUST match the webhook.
const VIBES = [
  { id: 'the_mechanic',  label: 'The Mechanic',  desc: 'Energized, sharp, technical — drive the rep.' },
  { id: 'real_talk',     label: 'Real Talk',     desc: 'Relaxed, conversational — across the table.' },
  { id: 'the_sanctuary', label: 'The Sanctuary', desc: 'Deep, slow, therapeutic — lower the cortisol.' },
  { id: 'the_reframe',   label: 'The Reframe',   desc: 'Empathetic perspective-shift — flip the script.' },
  { id: 'the_architect', label: 'The Architect', desc: 'Resonant storytelling — build the philosophy.' },
];

// Vibe → native ElevenLabs baseline on the 0–100% UI scale. MUST mirror the
// bbf-sovereign-studio VIBES map (stability + style per vibe) and BASE_SETTINGS
// (similarity_boost 0.85, shared across every vibe today). Selecting a vibe snaps
// the Advanced Voice Tuning sliders to these; the admin can then override any axis.
// (Same preset map Studio V4 uses — kept in lockstep with the webhook.)
const VIBE_BASELINES = {
  the_mechanic:  { stability: 42, similarity: 85, style: 12 },
  real_talk:     { stability: 38, similarity: 85, style: 16 },
  the_sanctuary: { stability: 30, similarity: 85, style: 8 },
  the_reframe:   { stability: 35, similarity: 85, style: 28 },
  the_architect: { stability: 34, similarity: 85, style: 22 },
};
// resolveVibe() server-side defaults an unknown vibe to The Architect — mirror it.
const getVibeBaseline = (id) => VIBE_BASELINES[id] || VIBE_BASELINES.the_architect;

// Brand signatures (Quick Insert).
const INTRO = "Welcome to BBF Lab. Let's break the loop.";
const OUTRO = "Keep building. I'll see you in the Lab.";
const MAX_CHARS = 2400;

function humanizeError(slug) {
  const map = {
    not_admin: 'This surface is restricted to the administrative tier.',
    missing_session: 'Your session expired — sign in again.',
    invalid_session: 'Your session expired — sign in again.',
    script_too_long: `Script exceeds the ${MAX_CHARS}-character limit.`,
    missing_script: 'Write a script first.',
    tts_unconfigured: 'The voice engine is not configured (ElevenLabs key missing).',
    studio_no_audio: 'The voice engine returned no audio — try again.',
  };
  return map[slug] || (slug?.startsWith('tts_failed') ? 'ElevenLabs could not synthesize this take — try again.' : 'Generation failed — try again.');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function SovereignStudio() {
  const [script, setScript] = useState('');
  const [vibe, setVibe] = useState('the_architect');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState(null); // { url, blob, billedChars, vibe }
  const taRef = useRef(null);

  // ── Advanced Voice Tuning (0–100% UI scale). Sliders live in local state and
  // snap to the active vibe's baseline whenever the Vibe Matrix changes; any manual
  // slide flags the preset "MODIFIED" and lights the Reset button. Initialized to
  // the default vibe's baseline so an untouched panel exactly mirrors the preset. ──
  const [advOpen, setAdvOpen] = useState(false);
  const [stability, setStability] = useState(() => getVibeBaseline('the_architect').stability);
  const [similarity, setSimilarity] = useState(() => getVibeBaseline('the_architect').similarity);
  const [style, setStyle] = useState(() => getVibeBaseline('the_architect').style);

  // Own the object URL: revoke the previous take when a new one lands and on
  // unmount. No setState here — clean of the house set-state-in-effect rule.
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const len = script.length;
  const over = len > MAX_CHARS;
  const activeVibe = VIBES.find((v) => v.id === vibe) || VIBES[0];

  // Preset drift: true once any axis leaves the current vibe's baseline.
  const base = getVibeBaseline(vibe);
  const tuningModified = stability !== base.stability || similarity !== base.similarity || style !== base.style;

  // Selecting a vibe snaps all three sliders to that vibe's baseline, wiping any
  // prior manual override (spec: "automatically snap … to that card's baseline").
  function selectVibe(id) {
    const b = getVibeBaseline(id);
    setVibe(id);
    setStability(b.stability);
    setSimilarity(b.similarity);
    setStyle(b.style);
  }
  function resetTuning() {
    const b = getVibeBaseline(vibe);
    setStability(b.stability);
    setSimilarity(b.similarity);
    setStyle(b.style);
  }

  function insertIntro() {
    setScript((s) => (s.startsWith(INTRO) ? s : `${INTRO}${s ? `\n\n${s}` : ''}`));
    setErr('');
    requestAnimationFrame(() => taRef.current?.focus());
  }
  function insertOutro() {
    setScript((s) => (s.trimEnd().endsWith(OUTRO) ? s : `${s ? `${s.trimEnd()}\n\n` : ''}${OUTRO}`));
    setErr('');
    requestAnimationFrame(() => taRef.current?.focus());
  }

  async function onGenerate() {
    const text = script.trim();
    if (busy || !text || over) return;
    setBusy(true);
    setErr('');
    setResult(null); // triggers the effect cleanup → revokes the prior URL
    try {
      const r = await generateStudioVoice({
        script: text,
        vibe,
        // Only forward overrides when the admin deviated from the preset — normalize
        // the 0–100% sliders to ElevenLabs' 0.0–1.0 scale. An un-tuned generate sends
        // nothing, so the webhook uses the clean vibe baseline (+ cached routes).
        ...(tuningModified
          ? { stability: stability / 100, similarityBoost: similarity / 100, style: style / 100 }
          : {}),
      });
      setResult(r);
      requestAnimationFrame(() => {
        const el = document.getElementById('studio-audio');
        if (el) el.play().catch(() => {});
      });
    } catch (e) {
      setErr(humanizeError(e?.message));
    } finally {
      setBusy(false);
    }
  }

  function onSave() {
    if (!result?.url) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `bbf-${result.vibe || vibe}-${stamp()}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <section className="sst" aria-label="Sovereign Studio">
      <header className="sst-head">
        <div className="sst-kicker">Sovereign Studio · Creator Webhook</div>
        <h2 className="sst-title">Voice Production Console</h2>
        <p className="sst-sub">
          Mass-produce social voiceovers, local pitches, and Mindset tracks in the
          BBF Coach Akeem clone. Pick a vibe, generate a preview, then save the take
          to your device for editing.
        </p>
      </header>

      {/* Vibe Matrix */}
      <div className="sst-field">
        <label className="sst-label" htmlFor="sst-vibe">
          Vibe Matrix
          {tuningModified ? (
            <span className="sst-mod-pill" data-testid="sst-vibe-modified">MODIFIED PRESET</span>
          ) : null}
        </label>
        <select
          id="sst-vibe"
          className="sst-select"
          value={vibe}
          onChange={(e) => selectVibe(e.target.value)}
        >
          {VIBES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <div className="sst-vibe-desc">{activeVibe.desc}</div>
      </div>

      {/* ── ADVANCED VOICE TUNING — native ElevenLabs fine-tuning sliders. Snaps to
          the selected vibe's baseline; any manual slide overrides it for this render
          (and flags the Vibe Matrix above as "Modified"). Mirrors Studio V4. ── */}
      <div className="sst-field">
        <button
          type="button"
          className={`sst-advtune-head${advOpen ? ' is-open' : ''}`}
          aria-expanded={advOpen}
          onClick={() => setAdvOpen((v) => !v)}
          data-testid="sst-advtune-toggle"
        >
          <span className="sst-advtune-ic" aria-hidden="true">🎛</span>
          <span className="sst-advtune-title">Advanced Voice Tuning</span>
          {tuningModified ? <span className="sst-advtune-badge">MODIFIED</span> : null}
          <span className="sst-advtune-chev" aria-hidden="true">{advOpen ? '▾' : '▸'}</span>
        </button>
        {advOpen ? (
          <div className="sst-advtune-body" data-testid="sst-advtune-panel">
            <p className="sst-advtune-hint">
              Native ElevenLabs physics. Picking a vibe snaps these to its baseline —
              slide any axis to override for this render.
            </p>

            <div className="sst-slider">
              <div className="sst-slider-top">
                <span>Stability</span>
                <span className="sst-slider-val">{stability}%</span>
              </div>
              <input
                type="range" className="sst-range" min="0" max="100" step="1"
                value={stability}
                onChange={(e) => setStability(Number(e.target.value))}
                aria-label="Voice stability"
                data-testid="sst-vo-stability"
              />
              <div className="sst-slider-hint">Vocal emotional variance &amp; natural pauses — lower is more expressive, higher is steadier.</div>
            </div>

            <div className="sst-slider">
              <div className="sst-slider-top">
                <span>Clarity / Similarity Boost</span>
                <span className="sst-slider-val">{similarity}%</span>
              </div>
              <input
                type="range" className="sst-range" min="0" max="100" step="1"
                value={similarity}
                onChange={(e) => setSimilarity(Number(e.target.value))}
                aria-label="Clarity / similarity boost"
                data-testid="sst-vo-similarity"
              />
              <div className="sst-slider-hint">High-fidelity clone precision — how closely the engine matches the Akeem clone.</div>
            </div>

            <div className="sst-slider">
              <div className="sst-slider-top">
                <span>Style Exaggeration</span>
                <span className="sst-slider-val">{style}%</span>
              </div>
              <input
                type="range" className="sst-range" min="0" max="100" step="1"
                value={style}
                onChange={(e) => setStyle(Number(e.target.value))}
                aria-label="Style exaggeration"
                data-testid="sst-vo-style"
              />
              <div className="sst-slider-hint">Dramatic / theatrical delivery scaling — higher pushes a more theatrical read.</div>
            </div>

            <button
              type="button"
              className="sst-advtune-reset"
              onClick={resetTuning}
              disabled={!tuningModified}
              data-testid="sst-advtune-reset"
            >
              ↺ Reset to “{activeVibe.label}” baseline
            </button>
          </div>
        ) : null}
      </div>

      {/* Quick Insert brand signatures */}
      <div className="sst-quick" role="group" aria-label="Quick Insert">
        <span className="sst-quick-lbl">Quick Insert</span>
        <button type="button" className="sst-chip" onClick={insertIntro}>＋ Intro Signature</button>
        <button type="button" className="sst-chip" onClick={insertOutro}>＋ Outro Signature</button>
      </div>

      {/* Script input */}
      <div className="sst-field">
        <label className="sst-label" htmlFor="sst-script">Script</label>
        <textarea
          id="sst-script"
          ref={taRef}
          className={`sst-textarea${over ? ' is-over' : ''}`}
          value={script}
          onChange={(e) => { setScript(e.target.value); if (err) setErr(''); }}
          placeholder="Write the exact words Akeem will speak. Punctuation and ellipses (…) shape the pacing; the studio adds breathing room at the start and end automatically."
          rows={8}
          spellCheck
        />
        <div className="sst-meter">
          <span className={`sst-count${over ? ' is-over' : ''}`}>{len.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters</span>
          <span className="sst-cost">Generating a preview spends ~{len.toLocaleString()} ElevenLabs characters · saving the take is free.</span>
        </div>
      </div>

      {/* Generate */}
      <div className="sst-actions">
        <button
          type="button"
          className="sst-generate"
          onClick={onGenerate}
          disabled={busy || !script.trim() || over}
          aria-busy={busy}
        >
          {busy ? '◌ Synthesizing…' : '▶ Generate Preview'}
        </button>
        {err ? <span className="sst-err" role="alert">⚠ {err}</span> : null}
      </div>

      {/* Preview & Play + Save to Vault */}
      {result ? (
        <div className="sst-preview" role="status">
          <div className="sst-preview-top">
            <span className="sst-preview-kicker">🎙 Preview · {activeVibe.label}</span>
            {result.billedChars ? <span className="sst-preview-billed">{result.billedChars.toLocaleString()} characters billed</span> : null}
          </div>
          <audio id="studio-audio" className="sst-audio" src={result.url} controls preload="auto" />
          <button type="button" className="sst-save" onClick={onSave}>⬇ Save to Vault (.mp3)</button>
          <p className="sst-save-note">Downloads the approved take to this device for external video editing.</p>
        </div>
      ) : null}
    </section>
  );
}
