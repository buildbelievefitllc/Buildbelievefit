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

  // Own the object URL: revoke the previous take when a new one lands and on
  // unmount. No setState here — clean of the house set-state-in-effect rule.
  useEffect(() => () => { if (result?.url) URL.revokeObjectURL(result.url); }, [result]);

  const len = script.length;
  const over = len > MAX_CHARS;
  const activeVibe = VIBES.find((v) => v.id === vibe) || VIBES[0];

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
      const r = await generateStudioVoice({ script: text, vibe });
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
        <label className="sst-label" htmlFor="sst-vibe">Vibe Matrix</label>
        <select
          id="sst-vibe"
          className="sst-select"
          value={vibe}
          onChange={(e) => setVibe(e.target.value)}
        >
          {VIBES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
        <div className="sst-vibe-desc">{activeVibe.desc}</div>
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
