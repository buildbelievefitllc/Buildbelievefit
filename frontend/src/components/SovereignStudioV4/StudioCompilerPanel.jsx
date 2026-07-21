// src/components/SovereignStudioV4/StudioCompilerPanel.jsx
// ─────────────────────────────────────────────────────────────────────────────
// AD COMPILER — the backend video-rendering pipeline's trigger surface.
//
// Feed it a background B-roll URL, an audio track URL, and hook/sub-line text —
// it stitches a unified 1080×1920 MP4 (text overlay + B-roll, NO AI avatars) and
// lands it in the Queue tab. Pipeline:
//   1. bbf-studio-compiler `create` — validates the payload, opens a job row.
//   2. THIS BROWSER renders the actual MP4 — SovereignFoundry (WebCodecs +
//      mp4-muxer, the same proven "Isolation Protocol" engine the Video Engine
//      tab uses) composites the footage + a purpose-built text overlay
//      (reelOverlayCanvas — no live stage/DOM needed, pure Canvas 2D) and
//      encodes with audioIsDurationMaster:true so the final runtime matches the
//      audio track exactly.
//   3. bbf-studio-compiler `sign` → PUT the finished blob → `complete` — lands
//      the MP4 in the public bbf_studio_exports bucket and returns its URL.
// A failure at any step reports through `fail` — never silent — and the panel
// always states exactly what went wrong (house rule).

import { useState } from 'react';
import { createCompileJob, signCompileUpload, uploadCompiledAsset, completeCompileJob, failCompileJob } from '../../lib/studioCompilerApi.js';
import { renderReelOverlay } from '../../lib/reelOverlayCanvas.js';

// Foundry failure slugs → operator-readable messages (the panel states exactly
// what went wrong — house rule). Unknown reasons pass through verbatim.
const COMPILE_ERRORS = {
  footage_load_failed: 'The background video URL could not be loaded/decoded — check the URL is a direct, publicly reachable MP4 and retry.',
  seek_stalled: 'The background video stopped responding mid-render — retry; if it repeats, re-host the file or use a shorter clip.',
  empty_recording: 'The render produced no data — try again, or use a recent desktop Chrome/Edge.',
};

const HOOK_FONTS = [['bebas', 'BEBAS'], ['anton', 'ANTON'], ['barlow', 'BARLOW']];
const TEXT_LAYOUTS = [['bottom', 'BOTTOM'], ['center', 'CENTER'], ['top', 'TOP']];

const EMPTY_FORM = {
  background_video_url: '',
  audio_track_url: '',
  hook_text: '',
  sub_line_text: '',
  hook_font: 'bebas',
  hook_font_size: 138,
  text_layout: 'bottom',
};

export default function StudioCompilerPanel() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [phase, setPhase] = useState('idle'); // idle | rendering | done | error
  const [progressPct, setProgressPct] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState(null); // { url, durationSec }
  const [error, setError] = useState(null);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const canSubmit = phase !== 'rendering'
    && form.background_video_url.trim().length > 0
    && form.audio_track_url.trim().length > 0;

  const compile = async () => {
    if (!canSubmit) return;
    setPhase('rendering');
    setProgressPct(0);
    setResult(null);
    setError(null);
    let jobId = null;

    try {
      const { SovereignFoundry } = await import('../../lib/SovereignFoundry.js');
      if (!SovereignFoundry.isSupported()) throw new Error('This browser lacks WebCodecs — use a recent Chrome/Edge (desktop) to compile.');

      setStatusText('Opening job…');
      const created = await createCompileJob(form);
      jobId = created.id;

      setStatusText('Rendering… (compositing footage + overlay + audio)');
      const overlay = renderReelOverlay({
        hookText: form.hook_text,
        subLineText: form.sub_line_text,
        hookFont: form.hook_font,
        hookFontSize: form.hook_font_size,
        textLayout: form.text_layout,
      });

      const foundry = new SovereignFoundry(document.body);
      const rendered = await foundry.render({
        videoUrl: form.background_video_url,
        voUrl: form.audio_track_url,
        overlay,
        audioIsDurationMaster: true, // final runtime = the audio track's length, per the compiler spec
        durationCap: 180,
        onProgress: (p) => setProgressPct(Math.round(p * 100)),
      });
      if (!rendered || !rendered.blob) throw new Error('empty_recording');

      setStatusText('Uploading compiled MP4…');
      const { uploadUrl } = await signCompileUpload(jobId);
      await uploadCompiledAsset(uploadUrl, rendered.blob);

      setStatusText('Finalizing…');
      const completed = await completeCompileJob(jobId, rendered.durationSec);

      setResult({ url: completed.output_url, durationSec: completed.duration_sec });
      setPhase('done');
      setStatusText('');
    } catch (e) {
      const reason = e?.message || String(e);
      if (jobId) await failCompileJob(jobId, reason); // the job row keeps the raw slug
      setError(COMPILE_ERRORS[reason] || reason);
      setPhase('error');
      setStatusText('');
    }
  };

  const reset = () => { setForm(EMPTY_FORM); setPhase('idle'); setResult(null); setError(null); setProgressPct(0); };

  return (
    <div className="sc-panel" data-testid="studio-compiler-panel">
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎞 Background Video URL</label>
        <input
          type="url"
          className="input-v4"
          value={form.background_video_url}
          onChange={(e) => set('background_video_url', e.target.value)}
          placeholder="https://…/broll.mp4"
          disabled={phase === 'rendering'}
          data-testid="sc-background-url"
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎙 Audio Track URL</label>
        <input
          type="url"
          className="input-v4"
          value={form.audio_track_url}
          onChange={(e) => set('audio_track_url', e.target.value)}
          placeholder="https://…/voiceover.mp3"
          disabled={phase === 'rendering'}
          data-testid="sc-audio-url"
        />
        <div className="hint-v4">The final MP4's runtime matches THIS track's length exactly.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Hook Text</label>
        <textarea
          className="textarea-v4"
          value={form.hook_text}
          onChange={(e) => set('hook_text', e.target.value)}
          placeholder="STOP WAITING\nFOR A SIGN."
          disabled={phase === 'rendering'}
          data-testid="sc-hook-text"
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Sub-line Text</label>
        <textarea
          className="textarea-v4"
          value={form.sub_line_text}
          onChange={(e) => set('sub_line_text', e.target.value)}
          placeholder="No pressure. No judgment. Just a conversation."
          disabled={phase === 'rendering'}
          data-testid="sc-sub-text"
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Hook Font</label>
        <div className="seg-v4">
          {HOOK_FONTS.map(([id, label]) => (
            <button key={id} type="button" className={form.hook_font === id ? 'active' : ''}
              onClick={() => set('hook_font', id)} disabled={phase === 'rendering'}>{label}</button>
          ))}
        </div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🔧 Hook Size — {form.hook_font_size}px</label>
        <input
          type="range" className="range-v4" min="50" max="180" step="2"
          value={form.hook_font_size}
          onChange={(e) => set('hook_font_size', Number(e.target.value))}
          disabled={phase === 'rendering'}
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Text Position</label>
        <div className="seg-v4">
          {TEXT_LAYOUTS.map(([val, label]) => (
            <button key={val} type="button" className={form.text_layout === val ? 'active' : ''}
              onClick={() => set('text_layout', val)} disabled={phase === 'rendering'}>{label}</button>
          ))}
        </div>
      </div>

      <button type="button" className="export-btn-v4" onClick={compile} disabled={!canSubmit} data-testid="sc-compile-btn">
        {phase === 'rendering' ? `… RENDERING ${progressPct}%` : '🎬 COMPILE AD'}
      </button>

      {phase === 'rendering' && (
        <div className="sc-render-status" role="status" data-testid="sc-rendering">
          <div className="sc-render-bar"><div className="sc-render-fill" style={{ width: `${progressPct}%` }} /></div>
          <div className="hint-v4">{statusText}</div>
        </div>
      )}

      {phase === 'error' && (
        <div className="sc-error" role="alert" data-testid="sc-error">⚠ {error}</div>
      )}

      {phase === 'done' && result && (
        <div className="sc-result" data-testid="sc-result">
          <div className="hint-v4" style={{ color: 'var(--green, #4ade80)' }}>
            ✓ Compiled{result.durationSec ? ` — ${result.durationSec}s` : ''}. Live in the Queue tab.
          </div>
          <video className="sc-result-video" src={result.url} controls playsInline data-testid="sc-result-video" />
          <button type="button" className="queue-btn-v4" onClick={reset}>Compile Another</button>
        </div>
      )}
    </div>
  );
}
