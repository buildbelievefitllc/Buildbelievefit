// src/components/SovereignStudioV4/StudioLayout.jsx
// Main UI grid: controls sidebar (left) + preview (right)

import { useRef, useState } from 'react';
import VibeSelector from './VibeSelector';
import ReelPreviewEngine from './ReelPreviewEngine';
import StageScaler from './StageScaler';
import QueueMonitor from './QueueMonitor';
import { renderMarkup } from './markup.jsx';
import { REEL_PHONE_SCREEN } from '../../lib/reelPhoneBackdrop.js';

const PLATFORMS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
];

const stripMarkup = (s) => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();

// Which phone frames to render for a given layout, front-to-back (CSS z-index/
// dimming makes the stacking read correctly regardless of array order). Position
// classes port the v3 reference's fan math (sovereignStudioV4.css) — dual = two
// overlapped screens, trio = a three-screen fan.
function phoneLayers({ layout, backgroundImage, backgroundImage2, backgroundImage3 }) {
  if (layout === 'dual') {
    return [
      { img: backgroundImage2, cls: 'is-back pos-dual-back', ph: '2ND SHOT' },
      { img: backgroundImage, cls: 'pos-dual-front', ph: 'SCREENSHOT' },
    ];
  }
  if (layout === 'trio') {
    return [
      { img: backgroundImage2, cls: 'is-back pos-trio-left', ph: '2ND SHOT' },
      { img: backgroundImage3, cls: 'is-back pos-trio-right', ph: '3RD SHOT' },
      { img: backgroundImage, cls: 'pos-trio-front', ph: 'SCREENSHOT' },
    ];
  }
  return [{ img: backgroundImage, cls: '', ph: 'SCREENSHOT' }];
}

// Per-session base for unique export filenames. Module scope so the timestamp is read
// once at load (the render-purity rule forbids Date.now() inside the component).
const SESSION_STAMP = Date.now();

function humanizePostErr(slug) {
  const map = {
    no_admin_session: 'No admin session in this browser — sign in to the Command Center, then retry.',
    not_admin: 'This session is not an authorized admin.',
    empty_asset: 'Nothing to post — render the card first.',
    no_platform: 'Enable at least one platform (Instagram / Facebook).',
  };
  return map[slug] || `Failed (${slug}). The asset may be saved — try QUEUE, or retry.`;
}

function humanizeReelErr(slug) {
  const map = {
    no_recorder: 'This browser can’t record canvas video — try Chrome or Safari on a recent device.',
    no_footage: 'Upload reel footage first (EXPORT still works for the cover).',
    no_stage: 'Reel preview not ready — switch to the Video Engine tab and retry.',
    empty_recording: 'The recording produced no data — try again, or use a different browser.',
    play_failed: 'Could not start footage playback — re-upload the clip and retry.',
    recorder_init: 'Recorder init failed — try a different browser.',
    no_admin_session: 'No admin session — sign in to the Command Center, then retry.',
    not_admin: 'This session is not an authorized admin.',
  };
  return map[slug] || `Reel export/post failed (${slug}).`;
}

export default function StudioLayout({
  mode,
  ctaData,
  handleCtaChange,
  spinCard,
  phoneData,
  handlePhoneChange,
  reelData,
  handleReelChange,
}) {
  // Ref to the active export stage (the un-scaled 1080-wide node). The preview
  // shows it visually shrunk via StageScaler's transform; for export/post we
  // briefly neutralize that transform so html2canvas captures at full resolution.
  const stageRef = useRef(null);
  const exportSeqRef = useRef(0); // bumps per export → unique filename
  const [exporting, setExporting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postNote, setPostNote] = useState(null); // { ok: boolean, text: string }
  // Reel MediaRecorder state (drives the hard UI lock + progress overlay).
  const [recording, setRecording] = useState(false);
  const [recordPct, setRecordPct] = useState(0);
  // Social auto-post target toggles (V3 parity → server distributors route the post).
  const [targets, setTargets] = useState({ instagram: true, facebook: true, tiktok: false });
  const toggleTarget = (k) => setTargets((t) => ({ ...t, [k]: !t[k] }));
  const selectedPlatforms = () => PLATFORMS.map(([k]) => k).filter((k) => targets[k]);
  // CSV of selected platforms → platform_target (persists TikTok intent too); null = none.
  const platformTarget = () => (selectedPlatforms().join(',') || null);
  const platformLabel = () => selectedPlatforms().map((k) => PLATFORMS.find(([p]) => p === k)[1]).join(' + ');

  // Render the active 1080-res stage to a canvas (transform neutralized).
  const renderStageCanvas = async () => {
    const node = stageRef.current;
    if (!node) return null;
    const scaler = node.closest('.stage-scaler-inner');
    const prevTransform = scaler ? scaler.style.transform : null;
    if (scaler) scaler.style.transform = 'none';
    try {
      const { default: html2canvas } = await import('html2canvas');
      return await html2canvas(node, {
        backgroundColor: '#0a0a0a',
        scale: 1,
        useCORS: true,
        imageTimeout: 4000,
        width: node.offsetWidth,
        height: node.offsetHeight,
      });
    } finally {
      if (scaler) scaler.style.transform = prevTransform || '';
    }
  };

  const exportPNG = async (slug) => {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = await renderStageCanvas();
      if (!canvas) return;
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bbf-${slug}-${canvas.width}x${canvas.height}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      console.error('[StudioV4] PNG export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  // Bake the current image stage → Blob (for queue/post upload).
  const getStageBlob = async () => {
    const canvas = await renderStageCanvas();
    if (!canvas) return null;
    return new Promise((res) => canvas.toBlob(res, 'image/png'));
  };

  // QUEUE (drip) or POST NOW (immediate) the current image card → IG/FB.
  const postCard = async (fields, now) => {
    if (posting) return;
    const target = platformTarget();
    if (!target) { setPostNote({ ok: false, text: humanizePostErr('no_platform') }); return; }
    if (now) {
      const cap = (fields.caption || '').slice(0, 600) || '(no caption)';
      if (!window.confirm(`POST NOW to ${platformLabel()}?\n\nPublishes immediately and cannot be undone.\n\n— CAPTION —\n${cap}`)) {
        setPostNote({ ok: true, text: 'Cancelled — nothing was posted.' });
        return;
      }
    }
    setPosting(true);
    setPostNote({ ok: true, text: now ? `Posting to ${platformLabel()} now…` : 'Queuing…' });
    try {
      const { queuePost } = await import('../../lib/studioQueueApi.js');
      const r = await queuePost({ kind: 'image', fields: { ...fields, platform_target: target }, getBlob: getStageBlob, now });
      if (r.status === 'posted') setPostNote({ ok: true, text: '✓ Posted to IG/FB now.' });
      else if (r.status === 'posting') setPostNote({ ok: true, text: 'Posting… Meta is finishing — check IG/FB shortly.' });
      else setPostNote({ ok: true, text: '✓ Queued for IG/FB — posts on the next daily drip.' });
    } catch (e) {
      setPostNote({ ok: false, text: humanizePostErr(e?.message) });
    } finally {
      setPosting(false);
    }
  };

  // Build the IG/FB post metadata (caption etc.) from a card's fields.
  const cardFields = (eyebrow, headline, body, cta, palette) => {
    const hl = stripMarkup(headline);
    const bd = stripMarkup(body);
    return {
      headline: hl,
      body: bd,
      eye_label: stripMarkup(eyebrow),
      cta: stripMarkup(cta),
      color_palette: palette || 'custom',
      caption: [hl, bd, '', '#BuildBelieveFit'].filter(Boolean).join('\n'),
    };
  };

  // Shared social target toggles (Instagram / Facebook / TikTok). Plain render
  // helper (NOT a nested component) so the inputs don't remount.
  const socialToggles = () => (
    <div className="post-toggles-v4">
      {PLATFORMS.map(([k, label]) => (
        <label key={k} className={`post-toggle-v4 ${targets[k] ? 'on' : ''}`}>
          <input type="checkbox" checked={targets[k]} onChange={() => toggleTarget(k)} /> {label}
        </label>
      ))}
    </div>
  );

  // Image panels (CTA / Phone): toggles + QUEUE + POST NOW.
  const postControls = (fields) => (
    <>
      {socialToggles()}
      <button className="queue-btn-v4" onClick={() => postCard(fields, false)} disabled={posting}>
        {posting ? '… WORKING' : '📡 QUEUE → SOCIAL'}
      </button>
      <button className="postnow-btn-v4" onClick={() => postCard(fields, true)} disabled={posting}>
        {posting ? '… WORKING' : '🚀 POST NOW → SOCIAL'}
      </button>
      {postNote && (
        <div className="hint-v4" style={{ color: postNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{postNote.text}</div>
      )}
    </>
  );

  // ── REEL: record (MediaRecorder) → export-only or post, driven by toggle state ──
  const reelFields = () => {
    const hl = (reelData.hook || '').replace(/\n/g, ' ').trim();
    const bd = (reelData.hookSub || '').trim();
    return {
      headline: hl,
      body: bd,
      eye_label: reelData.series || '',
      color_palette: 'custom',
      caption: [hl, bd, '', '#BuildBelieveFit'].filter(Boolean).join('\n'),
    };
  };

  const exportOrPostReel = async () => {
    if (recording || posting) return;
    const target = platformTarget();
    const hasVideo = !!reelData.videoFile?.url;
    setPostNote(null);

    // No footage → fall back to the cover frame (export PNG, or post as image).
    if (!hasVideo) {
      if (!target) { await exportPNG('reel-cover'); setPostNote({ ok: true, text: 'Exported reel cover (PNG). Upload footage to record/post video.' }); return; }
      await postCard(reelFields(), true);
      return;
    }

    setRecording(true);
    setRecordPct(0);
    try {
      // THE ISOLATION PROTOCOL (CEO order): the export runs in a pure Vanilla JS class
      // (SovereignFoundry) that operates 100% independently of the React virtual DOM —
      // it owns its own off-DOM <video>, SEEKS the footage frame-by-frame, composites the
      // branded overlay, encodes (H.264+AAC, VP9+Opus fallback) and muxes one clean,
      // UNFRAGMENTED, faststart MP4. React just hands it { videoUrl, voUrl, overlay,
      // container } and steps out of the way.
      const { SovereignFoundry } = await import('../../lib/SovereignFoundry.js');
      if (!SovereignFoundry.isSupported()) {
        setPostNote({ ok: false, text: 'This browser lacks WebCodecs — use a recent Chrome/Edge (desktop).' });
        return;
      }
      setPostNote({ ok: true, text: 'Rendering reel (seeking + encoding frames + voiceover)…' });
      const videoUrl = stageRef.current?.querySelector('.reel-video-v4')?.src || reelData.videoFile?.url;
      const overlay = await SovereignFoundry.captureOverlay(stageRef.current);
      const foundry = new SovereignFoundry(document.body);
      const result = await foundry.render({
        videoUrl,
        // Voice wins the export bake; with no voiceover the backing track carries it.
        voUrl: reelData.voUrl || reelData.musicFile?.url || null,
        overlay,
        // Phone backdrop → clip the footage into the same rect the DOM preview used
        // (reelPhoneBackdrop.js — shared with ReelPreviewEngine so they can't drift).
        videoRect: reelData.phoneBackdrop ? REEL_PHONE_SCREEN : null,
        durationCap: target ? 90 : 1200,
        onProgress: (p) => setRecordPct(Math.round(p * 100)),
      });
      if (!result || !result.blob) throw new Error('record_failed');

      exportSeqRef.current += 1;
      const stamp = `${SESSION_STAMP}-${exportSeqRef.current}`;
      const downloadBlob = (blob, name) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = u; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 120000);
      };

      // Audio status line — explicit, never silent (CEO order: bubble the reason).
      const audioMsg = result.audio
        ? '🎙 Voiceover baked in.'
        : (reelData.voUrl
            ? `⚠ Audio failed: ${result.audioError || 'unknown'} — video exported without voiceover.`
            : 'No voiceover was attached.');

      // EXPORT ONLY (no targets) → download the clean MP4.
      if (!target) {
        downloadBlob(result.blob, `bbf-reel-${stamp}.mp4`);
        const dur = result.durationSec ? `${result.durationSec}s` : '';
        const frm = result.frames ? `${result.frames} real frames` : '';
        const stats = [dur, frm].filter(Boolean).join(', ');
        setPostNote({
          ok: !!result.audio || !reelData.voUrl,
          text: `✓ Exported bbf-reel-${stamp}.mp4 — clean MP4${stats ? ` (${stats})` : ''}, plays everywhere. ${audioMsg}`,
        });
        return;
      }

      // POST → the WebCodecs output is a standard MP4 IG/FB/TikTok accept.
      setPosting(true);
      setPostNote({ ok: true, text: `Posting reel to ${platformLabel()}…` });
      const { queuePost, pollPostStatus } = await import('../../lib/studioQueueApi.js');
      const res = await queuePost({ kind: 'video', fields: { ...reelFields(), platform_target: target }, getBlob: async () => result.blob, now: true });
      if (res.status === 'posting') {
        setPostNote({ ok: true, text: 'Posting reel… Meta is transcoding (~60–90s).' });
        const verdict = await pollPostStatus({ kind: 'video', id: res.id });
        setPostNote({ ok: verdict === 'posted', text: verdict === 'posted' ? `✓ Reel posted. ${audioMsg}` : verdict === 'failed' ? 'Meta rejected the reel — the asset is saved.' : 'Still finishing at Meta — check IG/FB shortly.' });
      } else {
        setPostNote({ ok: true, text: `✓ Reel posted. ${audioMsg}` });
      }
    } catch (e) {
      setPostNote({ ok: false, text: humanizeReelErr(e?.message) });
    } finally {
      setRecording(false);
      setPosting(false);
    }
  };

  return (
    <div className="layout-v4">
      <div className="controls-v4">
        {mode === 'cta' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">⚡ Catalog — pick a vibe, spin</label>
              <select
                value={ctaData.lane}
                onChange={(e) => handleCtaChange('lane', e.target.value)}
                className="select-v4"
              >
                <option value="all">ALL LANES (full shuffle)</option>
                <option value="fence">FEAR & THE FENCE</option>
                <option value="identity">IDENTITY & LEGACY</option>
                <option value="parent">THE WORKING PARENT</option>
                <option value="responder">FIRST RESPONDER</option>
                <option value="vision">VISION & MANIFESTATION</option>
                <option value="comeback">THE COMEBACK</option>
              </select>
            </div>

            <div className="ctl-group-v4">
              <button className="spin-btn-v4" onClick={spinCard}>
                🎰 SPIN A CARD
              </button>
              <div className="hint-v4">Pulls a headline, body &amp; CTA from the selected lane (or shuffles all). Everything stays editable.</div>
            </div>

            <div className="divider-v4"></div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Format</label>
              <div className="seg-v4">
                <button
                  className={ctaData.format === 'feed' ? 'active' : ''}
                  onClick={() => handleCtaChange('format', 'feed')}
                >
                  FEED 4:5
                </button>
                <button
                  className={ctaData.format === 'story' ? 'active' : ''}
                  onClick={() => handleCtaChange('format', 'story')}
                >
                  STORY 9:16
                </button>
              </div>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Eyebrow</label>
              <input
                type="text"
                value={ctaData.eyebrow}
                onChange={(e) => handleCtaChange('eyebrow', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Headline — *stars* = highlight</label>
              <textarea
                value={ctaData.headline}
                onChange={(e) => handleCtaChange('headline', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Body — **double stars** = bold white</label>
              <textarea
                value={ctaData.body}
                onChange={(e) => handleCtaChange('body', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">CTA Button</label>
              <input
                type="text"
                value={ctaData.buttonText}
                onChange={(e) => handleCtaChange('buttonText', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">🎨 Raw Accent Override</label>
              <div className="color-row-v4">
                <div className="color-cell-v4">
                  <input
                    type="color"
                    value={ctaData.primaryColor}
                    onChange={(e) => handleCtaChange('primaryColor', e.target.value)}
                    className="color-input-v4"
                  />
                  <div className="cc-meta-v4">
                    <span className="cc-k-v4">Primary</span>
                    <span className="cc-v-v4">{ctaData.primaryColor}</span>
                  </div>
                </div>
                <div className="color-cell-v4">
                  <input
                    type="color"
                    value={ctaData.secondaryColor}
                    onChange={(e) => handleCtaChange('secondaryColor', e.target.value)}
                    className="color-input-v4"
                  />
                  <div className="cc-meta-v4">
                    <span className="cc-k-v4">Secondary</span>
                    <span className="cc-v-v4">{ctaData.secondaryColor}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ctl-group-v4">
              <button className="export-btn-v4" onClick={() => exportPNG('cta')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT PNG'}
              </button>
              {postControls(cardFields(ctaData.eyebrow, ctaData.headline, ctaData.body, ctaData.buttonText, ctaData.primaryColor))}
            </div>
          </div>
        )}

        {mode === 'phone' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Layout</label>
              <div className="seg-v4">
                <button
                  className={phoneData.layout === 'single' ? 'active' : ''}
                  onClick={() => handlePhoneChange('layout', 'single')}
                >
                  SINGLE
                </button>
                <button
                  className={phoneData.layout === 'dual' ? 'active' : ''}
                  onClick={() => handlePhoneChange('layout', 'dual')}
                >
                  DUAL
                </button>
                <button
                  className={phoneData.layout === 'trio' ? 'active' : ''}
                  onClick={() => handlePhoneChange('layout', 'trio')}
                >
                  TRIO
                </button>
              </div>
              <div className="hint-v4">Single = centered hero. Dual = two screens overlapped. Trio = three-screen fan.</div>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Device Frame Style</label>
              <select
                value={phoneData.frame}
                onChange={(e) => handlePhoneChange('frame', e.target.value)}
                className="select-v4"
              >
                <option value="sleek">Sleek Modern</option>
                <option value="gold">Sovereign Gold</option>
                <option value="carbon">Matte Black Carbon</option>
              </select>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📱 Screen Content — upload a screenshot</label>
              <input
                type="file"
                accept="image/*"
                className="input-v4"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (phoneData.backgroundImage?.url) URL.revokeObjectURL(phoneData.backgroundImage.url);
                  handlePhoneChange('backgroundImage', { file, url: URL.createObjectURL(file) });
                }}
              />
              {phoneData.backgroundImage?.url && (
                <button
                  type="button"
                  className="ph-clear-v4"
                  onClick={() => {
                    if (phoneData.backgroundImage?.url) URL.revokeObjectURL(phoneData.backgroundImage.url);
                    handlePhoneChange('backgroundImage', null);
                  }}
                >
                  ✕ Remove screenshot
                </button>
              )}
              <div className="hint-v4">Drops your screenshot straight into the phone screen — it exports baked into the mock-up.</div>
            </div>

            {(phoneData.layout === 'dual' || phoneData.layout === 'trio') && (
              <div className="ctl-group-v4">
                <label className="ctl-label-v4">📱 2nd Screenshot (dual / trio)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input-v4"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (phoneData.backgroundImage2?.url) URL.revokeObjectURL(phoneData.backgroundImage2.url);
                    handlePhoneChange('backgroundImage2', { file, url: URL.createObjectURL(file) });
                  }}
                />
                {phoneData.backgroundImage2?.url && (
                  <button
                    type="button"
                    className="ph-clear-v4"
                    onClick={() => {
                      if (phoneData.backgroundImage2?.url) URL.revokeObjectURL(phoneData.backgroundImage2.url);
                      handlePhoneChange('backgroundImage2', null);
                    }}
                  >
                    ✕ Remove 2nd screenshot
                  </button>
                )}
              </div>
            )}

            {phoneData.layout === 'trio' && (
              <div className="ctl-group-v4">
                <label className="ctl-label-v4">📱 3rd Screenshot (trio)</label>
                <input
                  type="file"
                  accept="image/*"
                  className="input-v4"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (phoneData.backgroundImage3?.url) URL.revokeObjectURL(phoneData.backgroundImage3.url);
                    handlePhoneChange('backgroundImage3', { file, url: URL.createObjectURL(file) });
                  }}
                />
                {phoneData.backgroundImage3?.url && (
                  <button
                    type="button"
                    className="ph-clear-v4"
                    onClick={() => {
                      if (phoneData.backgroundImage3?.url) URL.revokeObjectURL(phoneData.backgroundImage3.url);
                      handlePhoneChange('backgroundImage3', null);
                    }}
                  >
                    ✕ Remove 3rd screenshot
                  </button>
                )}
              </div>
            )}

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Eyebrow</label>
              <input
                type="text"
                value={phoneData.eyebrow}
                onChange={(e) => handlePhoneChange('eyebrow', e.target.value)}
                className="input-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Headline</label>
              <textarea
                value={phoneData.headline}
                onChange={(e) => handlePhoneChange('headline', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Benefit</label>
              <textarea
                value={phoneData.benefit}
                onChange={(e) => handlePhoneChange('benefit', e.target.value)}
                className="textarea-v4"
              />
            </div>

            <div className="ctl-group-v4">
              <button className="export-btn-v4" onClick={() => exportPNG('phone')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT 1080×1350'}
              </button>
              {postControls(cardFields(phoneData.eyebrow, phoneData.headline, phoneData.benefit, '', 'custom'))}
            </div>
          </div>
        )}

        {mode === 'queue' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📡 Supabase Auto-Post Queue</label>
              <div className="hint-v4">Live monitor of cards &amp; reels queued or posted to IG/FB — the right pane lists active &amp; pending jobs and auto-refreshes every 15s.</div>
            </div>
          </div>
        )}

        {mode === 'reel' && (
          <div className="panel-v4 active">
            <VibeSelector
              reelData={reelData}
              handleReelChange={handleReelChange}
            />
            <div className="divider-v4"></div>
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📤 Distribute Reel</label>
              {socialToggles()}
              <button className="postnow-btn-v4" onClick={exportOrPostReel} disabled={recording || posting}>
                {recording ? `🎬 RECORDING… ${recordPct}%` : platformTarget() ? `🚀 EXPORT & POST → ${platformLabel()}` : '⬇ EXPORT VIDEO'}
              </button>
              <div className="hint-v4">
                Toggles OFF → records &amp; downloads the reel. Toggles ON → records &amp; posts it. Needs uploaded footage (else exports the cover frame).
              </div>
              {postNote && (
                <div className="hint-v4" style={{ color: postNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{postNote.text}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="preview-wrap-v4">
        {mode === 'cta' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={ctaData.format === 'story' ? 1920 : 1350}>
              <div
                ref={stageRef}
                className={`stage-cta-v4 ${ctaData.format === 'story' ? 'story' : ''}`}
                style={{
                  '--primary-color': ctaData.primaryColor,
                  '--secondary-color': ctaData.secondaryColor,
                }}
              >
                {/* on-brand accent bar + ambient glow (v3 parity) */}
                <div className="cta-tbar-v4" />
                <div className="cta-glow-v4" />
                <div className="cta-z-v4">
                  <div className="cta-eye-v4">{ctaData.eyebrow}</div>
                  <div className="cta-hl-v4">{renderMarkup(ctaData.headline, ctaData.primaryColor)}</div>
                </div>
                <div className="cta-z-v4">
                  <div className="cta-rule-v4" />
                  <div className="cta-body-v4">{renderMarkup(ctaData.body, ctaData.primaryColor)}</div>
                  <div className="cta-foot-v4">
                    <span className="cta-brand-v4">BUILD<span>BELIEVE</span>FIT</span>
                    <span className="cta-btn-v4">{ctaData.buttonText}</span>
                  </div>
                </div>
              </div>
            </StageScaler>
          </div>
        )}

        {mode === 'phone' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1350}>
              <div className="stage-phone-v4" ref={stageRef}>
                <div className="phone-strip-v4" />
                <div className="phone-text-v4">
                  <div className="phone-eye-v4">{phoneData.eyebrow}</div>
                  <div className="phone-hl-v4">{phoneData.headline}</div>
                  <div className="phone-benefit-v4">{phoneData.benefit}</div>
                </div>
                {phoneLayers(phoneData).map((p, i) => (
                  <div key={i} className={`phone-frame-v4 frame-${phoneData.frame} ${p.cls}`}>
                    <div className="phone-notch-v4" />
                    <div className="phone-screen-v4">
                      {p.img?.url
                        ? <img src={p.img.url} alt="App screenshot" className="phone-screen-img-v4" crossOrigin="anonymous" />
                        : <div className="phone-screen-ph-v4">{p.ph}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </StageScaler>
          </div>
        )}

        {mode === 'reel' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1920}>
              <ReelPreviewEngine reelData={reelData} handleReelChange={handleReelChange} stageRef={stageRef} />
            </StageScaler>
          </div>
        )}

        {mode === 'queue' && (
          <div className="queue-host-v4">
            <QueueMonitor />
          </div>
        )}
      </div>

      {/* Hard UI lock + encoding overlay while the MediaRecorder runs in real time. */}
      {recording && (
        <div className="rec-lock-v4" role="alertdialog" aria-busy="true" aria-label="Recording reel">
          <div className="rec-lock-card">
            <div className="rec-spinner" />
            <div className="rec-title">RECORDING REEL</div>
            <div className="rec-sub">Encoding the canvas in real time — please keep this tab open.</div>
            <div className="rec-bar"><div className="rec-bar-fill" style={{ width: `${recordPct}%` }} /></div>
            <div className="rec-pct">{recordPct}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
