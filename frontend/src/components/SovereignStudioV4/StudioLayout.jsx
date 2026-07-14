// src/components/SovereignStudioV4/StudioLayout.jsx
// Main UI grid: controls sidebar (left) + preview (right)

import { useEffect, useRef, useState } from 'react';
import VibeSelector from './VibeSelector';
import ReelPreviewEngine from './ReelPreviewEngine';
import SpotlightVideoStage from './SpotlightVideoStage';
import StageScaler from './StageScaler';
import QueueMonitor from './QueueMonitor';
import CompilerQueue from './CompilerQueue';
import { renderMarkup } from './markup.jsx';
import { REEL_PHONE_FRAME, REEL_PHONE_SCREEN } from '../../lib/reelPhoneBackdrop.js';
import { seriesLabel } from '../../lib/reelSeriesLabels.js';
import { saveBlobToDevice, isMobileish } from '../../lib/exportDelivery.js';
import { SPOT_QUOTES1, SPOT_QUOTES2 } from './spotlightData';

const PLATFORMS = [
  ['instagram', 'Instagram'],
  ['facebook', 'Facebook'],
  ['tiktok', 'TikTok'],
];

const stripMarkup = (s) => String(s || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1').trim();

// TikTok has no connected posting API yet (Meta only) — this is the manual
// bridge: export the reel and jump straight to TikTok's own upload screen so
// the operator just picks the file that's about to land in Downloads/the
// share sheet. @build.believe.fit is the BBF TikTok handle.
const TIKTOK_UPLOAD_URL = 'https://www.tiktok.com/upload?lang=en';

// Auto-caption — v3 parity restore: headline/body, a one-line "advertisement" (CTA /
// link-in-bio / series tag), then hashtags. Every mode shares the brand + local-area
// tags so IG/FB discovery always includes the service area, on top of a mode-flavored
// trio.
const LOCAL_HASHTAGS = '#Buckeye #Avondale #Goodyear #WestValleyAZ';
const HASHTAGS = {
  cta: `#BuildBelieveFit #MindsetMatters #DisciplineEqualsFreedom ${LOCAL_HASHTAGS}`,
  phone: `#BuildBelieveFit #AICoach #FitnessApp #SmartTraining ${LOCAL_HASHTAGS}`,
  reel: `#BuildBelieveFit #FitnessReels #FormCheck #TrainSmarter ${LOCAL_HASHTAGS}`,
  spot: `#BuildBelieveFit #ClientSpotlight #Transformation #ProgressNotPerfection ${LOCAL_HASHTAGS}`,
};

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
    no_webcodecs: 'This browser lacks WebCodecs — use a recent Chrome/Edge.',
    no_footage: 'Upload reel footage first (EXPORT still works for the cover).',
    no_stage: 'Reel preview not ready — switch to the Video Engine tab and retry.',
    empty_recording: 'The render produced no data — try again, or use a different browser.',
    play_failed: 'Could not start footage playback — re-upload the clip and retry.',
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
  undoSpin,
  phoneData,
  handlePhoneChange,
  reelData,
  handleReelChange,
  spotData,
  handleSpotChange,
}) {
  // Ref to the active export stage (the un-scaled 1080-wide node). The preview
  // shows it visually shrunk via StageScaler's transform; for export/post we
  // briefly neutralize that transform so html2canvas captures at full resolution.
  const stageRef = useRef(null);
  const exportSeqRef = useRef(0); // bumps per export → unique filename
  const [exporting, setExporting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postNote, setPostNote] = useState(null); // { ok: boolean, text: string }
  const [captionCopied, setCaptionCopied] = useState(false);
  const copiedTimerRef = useRef(null);
  // Reel MediaRecorder state (drives the hard UI lock + progress overlay).
  const [recording, setRecording] = useState(false);
  const [recordPct, setRecordPct] = useState(0);
  // The last finished export, kept alive so a FRESH tap can re-deliver it. On
  // Android (S25-class), the auto blob-anchor dies silently in the installed PWA
  // and navigator.share() needs transient activation the long render already
  // burned — so the file's guaranteed exit is the ⬇ SAVE TO PHONE button below,
  // whose own tap drives the share sheet (see lib/exportDelivery.js).
  const [lastExport, setLastExport] = useState(null); // { blob, name }
  const saveLastExport = async () => {
    if (!lastExport) return;
    const how = await saveBlobToDevice(lastExport.blob, lastExport.name);
    if (how === 'cancelled') return; // user closed the share sheet on purpose
    setPostNote({
      ok: how !== 'failed',
      text: how === 'shared'
        ? '✓ Share sheet opened — pick “Save to Files” / Gallery, or send it straight to IG/TikTok.'
        : how === 'downloaded'
          ? `✓ ${lastExport.name} downloaded — check your Downloads.`
          : how === 'opened'
            ? 'Opened in a new tab — long-press the file to save it.'
            : 'Could not hand the file to this device — try again.',
    });
  };
  const saveToPhoneBtn = lastExport ? (
    <button type="button" className="queue-btn-v4" onClick={saveLastExport} data-testid="save-to-phone">
      ⬇ SAVE TO PHONE
    </button>
  ) : null;
  // VAULT HISTORY auto-backup — every finished export is ALSO pushed (best-effort,
  // in the background) to the private studio-drafts-v1 vault, so even when the
  // phone-side save dies (the S25 Ultra failure) the render survives server-side
  // and any device — e.g. the laptop — can pull it back down from the 🗂 HISTORY
  // tab. A vault hiccup never blocks the local download path.
  const [vaultNote, setVaultNote] = useState(null); // { ok, text } | null
  const vaultDraft = (kind, blob, meta) => {
    setVaultNote({ ok: true, text: '☁ Backing up to Vault History…' });
    import('../../lib/studioDraftsApi.js')
      .then(({ saveDraft }) => saveDraft({ kind, blob, meta }))
      .then(() => setVaultNote({ ok: true, text: '✓ Backed up to Vault History — retrievable from any device via the 🗂 HISTORY tab.' }))
      .catch((e) => setVaultNote({ ok: false, text: `⚠ Vault backup failed (${e?.message || 'error'}) — this file only exists on this device right now.` }));
  };
  const vaultNoteLine = vaultNote ? (
    <div className="hint-v4" data-testid="vault-note" style={{ color: vaultNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>
      {vaultNote.text}
    </div>
  ) : null;
  // PRE-EXPORT CODEC PROBE — runs once on mount, BEFORE any render. Warns
  // (non-blocking) when this browser has no H.264 encoder and the reel would export
  // via the VP9/AV1 fallback (which IG/TikTok/YouTube recompress hard → softer post).
  // Best-effort: a probe failure never blocks the studio.
  const [codecProbe, setCodecProbe] = useState(null); // { supported, willFallback } | null
  useEffect(() => {
    let alive = true;
    import('../../lib/SovereignFoundry.js')
      .then(({ SovereignFoundry }) => SovereignFoundry.probeVideoCodec())
      .then((r) => { if (alive) setCodecProbe(r); })
      .catch(() => { /* probe is advisory only */ });
    return () => { alive = false; };
  }, []);
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

  // Cards are baked as JPEG, not PNG: Instagram's Content Publishing API rejects
  // PNG (400 at container creation) — it only accepts JPEG for image posts, while
  // Facebook tolerates either. 0.92 quality keeps text/logo crisp at a fraction of
  // PNG's byte weight. (See getStageBlob for the upload path.)
  const exportImage = async (slug) => {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = await renderStageCanvas();
      if (!canvas) return;
      const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
      const name = `bbf-${slug}-${canvas.width}x${canvas.height}.jpg`;
      // Keep the finished blob so ⬇ SAVE TO PHONE can re-deliver it from a fresh
      // tap even if this immediate attempt dies silently (Android PWA anchors do).
      setLastExport({ blob, name });
      vaultDraft('image', blob, { file_name: name, mode });
      // Image renders are fast enough that the click's activation is usually still
      // live — share-first on mobile lands the file in the sheet right away; the
      // ladder falls back to the classic anchor on desktop (exportDelivery.js).
      await saveBlobToDevice(blob, name);
    } catch (e) {
      console.error('[StudioV4] image export failed:', e);
    } finally {
      setExporting(false);
    }
  };

  // Bake the current image stage → Blob (for queue/post upload). JPEG, not PNG —
  // Instagram rejects PNG image posts (see exportImage). The queue/distributor
  // pipeline is JPEG-aware end-to-end (bbf-studio-queue stamps image/jpeg + .jpg).
  const getStageBlob = async () => {
    const canvas = await renderStageCanvas();
    if (!canvas) return null;
    return new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.92));
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

  // Build the IG/FB post metadata (caption etc.) from a card's fields. `mode`
  // ('cta' | 'phone') picks the ad-line + hashtag flavor — see HASHTAGS above.
  const cardFields = (eyebrow, headline, body, cta, palette, mode = 'cta') => {
    const hl = stripMarkup(headline).replace(/\n/g, ' ');
    const bd = stripMarkup(body);
    const ctaTxt = stripMarkup(cta);
    const adLine = mode === 'phone' ? '📲 Link in bio.' : (ctaTxt ? `👉 ${ctaTxt}` : '');
    // Each entry is one paragraph — blank entries drop out instead of leaving a
    // stray double blank line when a field (body/cta) is empty.
    const blocks = [hl, bd, [adLine, '🌐 buildbelievefit.fitness'].filter(Boolean).join('\n'), HASHTAGS[mode] || HASHTAGS.cta];
    return {
      headline: hl,
      body: bd,
      eye_label: stripMarkup(eyebrow),
      cta: ctaTxt,
      color_palette: palette || 'custom',
      caption: blocks.filter(Boolean).join('\n\n'),
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

  const copyCaption = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { return; }
    setCaptionCopied(true);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCaptionCopied(false), 1800);
  };

  // Read-only auto-caption preview + copy button (v3 parity restore) — shared by the
  // CTA/Phone/Reel panels. Recomputes live from cardFields()/reelFields() on every
  // render, so it always mirrors whatever the post/queue buttons would actually send.
  const captionBox = (caption) => (
    <div className="ctl-group-v4">
      <label className="ctl-label-v4">📋 Auto-Caption</label>
      <div className="caption-box-v4" data-testid="caption-box">{caption}</div>
      <button type="button" className="copycap-btn-v4" onClick={() => copyCaption(caption)} data-testid="copy-caption-btn">
        {captionCopied ? '✓ COPIED' : '📋 COPY CAPTION'}
      </button>
    </div>
  );

  // Image panels (CTA / Phone): caption preview + toggles + QUEUE + POST NOW.
  const postControls = (fields) => (
    <>
      {captionBox(fields.caption)}
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
      {vaultNoteLine}
      {saveToPhoneBtn}
    </>
  );

  // ── REEL: record (MediaRecorder) → export-only or post, driven by toggle state ──
  const reelFields = () => {
    const hl = (reelData.hook || '').replace(/\n/g, ' ').trim();
    const bd = (reelData.hookSub || '').trim();
    const tag = reelData.series ? seriesLabel(reelData.series) : '';
    const blocks = [hl ? `${hl} 🎬` : '', bd, [tag ? `[${tag}]` : '', '🌐 buildbelievefit.fitness'].filter(Boolean).join('\n'), HASHTAGS.reel];
    return {
      headline: hl,
      body: bd,
      eye_label: reelData.series || '',
      color_palette: 'custom',
      caption: blocks.filter(Boolean).join('\n\n'),
    };
  };

  // ── 🏆 CLIENT SPOTLIGHT (image card) ──────────────────────────────────────
  // Auto-caption mirrors the legacy buildSpCaption(): gold shoutout 🏆, the two
  // quote lines, the CTA + site, then the spotlight hashtag flavor.
  const spotFields = () => {
    const name = (spotData.clientName || '').trim();
    const shout = (spotData.shoutout || '').trim();
    const q1 = (spotData.quote1 || '').trim();
    const q2 = (spotData.quote2 || '').trim();
    const cta = (spotData.cta || '').trim();
    const blocks = [
      shout ? `${shout} 🏆` : '🏆 CLIENT SPOTLIGHT',
      [q1, q2].filter(Boolean).join('\n'),
      [cta, '🌐 buildbelievefit.fitness'].filter(Boolean).join('\n'),
      HASHTAGS.spot,
    ];
    return {
      headline: shout || (name ? `Client Spotlight — ${name}` : 'Client Spotlight'),
      body: [q1, q2].filter(Boolean).join(' '),
      eye_label: name ? `CLIENT SPOTLIGHT — ${name}` : 'CLIENT SPOTLIGHT',
      color_palette: 'custom',
      caption: blocks.filter(Boolean).join('\n\n'),
    };
  };

  // 🎰 SPIN — pull a fresh proof line (bank 1) + coach shoutout (bank 2). Two
  // functional updates so the pair lands atomically without a lost-update race.
  const spinSpotQuotes = () => {
    handleSpotChange('quote1', SPOT_QUOTES1[Math.floor(Math.random() * SPOT_QUOTES1.length)]);
    handleSpotChange('quote2', SPOT_QUOTES2[Math.floor(Math.random() * SPOT_QUOTES2.length)]);
  };

  // Single writer for a spotlight photo slot (before / after / logo). Revokes the
  // prior object URL before swapping so repeated uploads never leak.
  const setSpotPhoto = (key, file) => {
    if (spotData[key]?.url) URL.revokeObjectURL(spotData[key].url);
    handleSpotChange(key, file ? { file, url: URL.createObjectURL(file) } : null);
  };

  // 🧾 ROSTER PULL (Tier 3) — lazily fetch the Command Center client roster so the
  // operator can auto-fill the client name from a real client instead of typing it.
  const [spotRoster, setSpotRoster] = useState([]);
  const [spotRosterBusy, setSpotRosterBusy] = useState(false);
  const [spotRosterLoaded, setSpotRosterLoaded] = useState(false);
  async function loadSpotRoster() {
    if (spotRosterLoaded || spotRosterBusy) return;
    setSpotRosterBusy(true);
    try {
      const { rosterCall } = await import('../../lib/rosterApi.js');
      const body = await rosterCall('roster');
      const list = (Array.isArray(body?.clients) ? body.clients : [])
        .map((c) => String(c?.name || '').trim()).filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i).sort();
      setSpotRoster(list);
      setSpotRosterLoaded(true);
    } catch { /* leave empty — manual entry still works */ } finally {
      setSpotRosterBusy(false);
    }
  }

  // 🤖 AI SHOUTOUT (Tier 3) — Haiku writes the gold shoutout + both quote lines from
  // the client name + achievement, in-language. Fills the three fields in one tap.
  const [spotAiBusy, setSpotAiBusy] = useState(false);
  const [spotAiNote, setSpotAiNote] = useState(null); // { ok, text } | null
  async function generateSpotlightAi() {
    if (spotAiBusy) return;
    const clientName = (spotData.clientName || '').trim();
    if (!clientName) { setSpotAiNote({ ok: false, text: 'Add the client name first — it seeds the shoutout.' }); return; }
    setSpotAiBusy(true);
    setSpotAiNote(null);
    try {
      const { generateSpotlightCopy } = await import('../../lib/studioApi.js');
      const r = await generateSpotlightCopy({ clientName, achievement: spotData.achievement, lang: 'en' });
      handleSpotChange('shoutout', r.shoutout);
      if (r.quote1) handleSpotChange('quote1', r.quote1);
      if (r.quote2) handleSpotChange('quote2', r.quote2);
      setSpotAiNote({ ok: true, text: `Shoutout + quotes written for ${clientName} via Haiku.` });
    } catch (e) {
      setSpotAiNote({ ok: false, text: e?.message === 'no_admin_session' ? 'Sign in to the Command Center first.' : 'AI shoutout failed — try again, or write it by hand.' });
    } finally {
      setSpotAiBusy(false);
    }
  }

  // 🎙 AI VOICEOVER + CAPTIONS (Tier 3b) — voice a short hype line built from the
  // client + stat + shoutout, then bake it (with its free ElevenLabs word timings)
  // as karaoke captions onto the video spotlight. Reuses the whole VO/caption pipeline.
  const [spotVoBusy, setSpotVoBusy] = useState(false);
  const [spotVoNote, setSpotVoNote] = useState(null); // { ok, text } | null
  function spotVoScript() {
    const name = (spotData.clientName || '').trim();
    const num = (spotData.statNumber || '').trim();
    const unit = (spotData.statUnit || '').trim();
    const lift = (spotData.statLift || '').trim();
    const parts = [];
    if (name) parts.push(`${name}.`);
    if (num) parts.push(`${num} ${unit} ${lift}.`.replace(/\s+/g, ' ').trim());
    if (spotData.prBadge) parts.push('New personal record.');
    if (spotData.shoutout) parts.push(spotData.shoutout);
    return parts.join(' ').replace(/\s+/g, ' ').trim() || 'Client spotlight. A new personal record.';
  }
  async function generateSpotlightVo() {
    if (spotVoBusy) return;
    const script = spotVoScript();
    setSpotVoBusy(true);
    setSpotVoNote(null);
    try {
      const { generateStudioVoiceover } = await import('../../lib/studioApi.js');
      // Fold the script into the topic so the cache key is content-addressed (a
      // reworded line = a new slug, never a stale cache hit on the old audio).
      const r = await generateStudioVoiceover({ topic: `spotlight ${script}`.slice(0, 120), targetDuration: 15, series: 'spotlight', vibe: 'the_mechanic', lang: 'en', providedScript: script });
      handleSpotChange('spotVoUrl', r.url);
      const words = Array.isArray(r.words) ? r.words : null;
      if (words && words.length) {
        handleSpotChange('spotCaptions', { words });
        handleSpotChange('spotCaptionsEnabled', true);
        setSpotVoNote({ ok: true, text: `Voiceover ready + captions auto-timed (${words.length} words). Press ▶ to preview.` });
      } else {
        setSpotVoNote({ ok: true, text: 'Voiceover ready. (No caption timings returned — generate captions separately if needed.)' });
      }
    } catch (e) {
      setSpotVoNote({ ok: false, text: `Voiceover failed (${humanizeReelErr(e?.message)}).` });
    } finally {
      setSpotVoBusy(false);
    }
  }

  // Bake the reel via SovereignFoundry — the shared core behind the plain
  // EXPORT/POST flow and the TikTok bridge (which always renders a full,
  // un-posted export regardless of the IG/FB toggle state). Throws on failure
  // (no_webcodecs / record_failed) — callers catch it themselves.
  const renderReelMp4 = async ({ durationCapSec }) => {
    // THE ISOLATION PROTOCOL (CEO order): the export runs in a pure Vanilla JS class
    // (SovereignFoundry) that operates 100% independently of the React virtual DOM —
    // it owns its own off-DOM <video>, SEEKS the footage frame-by-frame, composites the
    // branded overlay, encodes (H.264+AAC, VP9+Opus fallback) and muxes one clean,
    // UNFRAGMENTED, faststart MP4. React just hands it { videoUrl, voUrl, overlay,
    // container } and steps out of the way.
    const { SovereignFoundry } = await import('../../lib/SovereignFoundry.js');
    if (!SovereignFoundry.isSupported()) throw new Error('no_webcodecs');
    const videoUrl = stageRef.current?.querySelector('.reel-video-v4')?.src || reelData.videoFile?.url;
    // THE REAL AUDIO MIX: voice, music, AND the footage's own baked-in sound ride
    // as THREE SEPARATE tracks at the Audio Mix Console's slider levels — the
    // foundry mixes them (music + clip audio looped and ducked under the voice) so
    // the export sounds like the preview. Footage audio is now a first-class channel
    // (Clip Volume), not just a no-voice/no-music fallback: an uploaded clip with
    // prebaked music can sit UNDER a voiceover at a level the user dials in, instead
    // of the old all-or-nothing collapse that dropped it entirely once any voice or
    // music track existed. The capture <video> stays muted (Chrome suspends decode
    // on inaudible elements), so the clip's sound is remixed from its URL, not the
    // silent capture element.
    const voiceUrl = reelData.voUrl || null;
    const musicUrl = reelData.musicFile?.url || null;
    const footageVol = Number(reelData.footageVolume ?? 100);
    // 0% Clip Volume → skip the footage-audio decode entirely (nothing to mix).
    const footageUrl = (footageVol > 0 && reelData.videoFile?.url) ? reelData.videoFile.url : null;
    const audioUrl = voiceUrl || musicUrl || footageUrl;
    const overlay = await SovereignFoundry.captureOverlay(stageRef.current);
    const foundry = new SovereignFoundry(document.body);
    const result = await foundry.render({
      videoUrl,
      voUrl: voiceUrl,
      musicUrl,
      footageUrl,
      voGain: Number(reelData.voiceVolume ?? 100) / 100,
      musicGain: Number(reelData.musicVolume ?? 80) / 100,
      footageGain: footageVol / 100,
      // Karaoke captions baked per-frame (same transcript + timing the preview shows).
      captions: reelData.captions,
      captionsEnabled: !!reelData.captionsEnabled,
      captionPos: reelData.captionPos ?? 62,
      overlay,
      // Phone backdrop → clip the footage into the same rect the DOM preview used, and
      // have the export draw the matching bezel/notch itself (reelPhoneBackdrop.js —
      // shared with ReelPreviewEngine so preview and export can't drift apart).
      videoRect: reelData.phoneBackdrop ? REEL_PHONE_SCREEN : null,
      frameRect: reelData.phoneBackdrop ? REEL_PHONE_FRAME : null,
      phoneFrame: reelData.phoneFrame || 'sleek',
      durationCap: durationCapSec,
      onProgress: (p) => setRecordPct(Math.round(p * 100)),
    });
    if (!result || !result.blob) throw new Error('record_failed');
    // Audio status line — explicit, never silent (CEO order: bubble the reason).
    // Name the channels that actually made it into the mix so the export is legible.
    const chans = [voiceUrl && 'voice', musicUrl && 'music', footageUrl && 'clip sound'].filter(Boolean);
    const audioMsg = result.audio
      ? (chans.length > 1
          ? `🎙 ${chans.join(' + ')} mix baked in (console levels, backing ducked under the voice).`
          : '🎙 Audio baked in.')
      : (audioUrl
          ? `⚠ Audio failed: ${result.audioError || 'unknown'} — video exported without sound.`
          : 'No voiceover, music, or clip audio was available — video exported silent.');
    return { result, audioUrl, audioMsg };
  };

  const exportOrPostReel = async () => {
    if (recording || posting) return;
    const target = platformTarget();
    const hasVideo = !!reelData.videoFile?.url;
    setPostNote(null);

    // No footage → fall back to the cover frame (export JPEG, or post as image).
    if (!hasVideo) {
      if (!target) { await exportImage('reel-cover'); setPostNote({ ok: true, text: 'Exported reel cover (JPEG). Upload footage to record/post video.' }); return; }
      await postCard(reelFields(), true);
      return;
    }

    setRecording(true);
    setRecordPct(0);
    try {
      setPostNote({ ok: true, text: 'Rendering reel (seeking + encoding frames + voiceover)…' });
      const { result, audioUrl, audioMsg } = await renderReelMp4({ durationCapSec: target ? 90 : 1200 });

      exportSeqRef.current += 1;
      const stamp = `${SESSION_STAMP}-${exportSeqRef.current}`;

      // EXPORT ONLY (no targets) → deliver the clean MP4.
      if (!target) {
        const name = `bbf-reel-${stamp}.mp4`;
        setLastExport({ blob: result.blob, name });
        vaultDraft('video', result.blob, {
          file_name: name,
          mode: 'reel',
          caption: reelFields().caption,
          duration_sec: result.durationSec || null,
          frames: result.frames || null,
        });
        const dur = result.durationSec ? `${result.durationSec}s` : '';
        const frm = result.frames ? `${result.frames} real frames` : '';
        const stats = [dur, frm].filter(Boolean).join(', ');
        if (isMobileish()) {
          // The multi-second render burned the tap's transient activation, so an
          // auto share() would be refused AND the blob anchor dies silently in the
          // installed PWA (the S25 failure). Don't fake a download — hand the user
          // the guaranteed exit: a fresh tap on ⬇ SAVE TO PHONE (share sheet).
          setPostNote({
            ok: !!result.audio || !audioUrl,
            text: `✓ ${name} rendered${stats ? ` (${stats})` : ''}. Tap ⬇ SAVE TO PHONE below to save it. ${audioMsg}`,
          });
        } else {
          await saveBlobToDevice(result.blob, name, { preferShare: false });
          setPostNote({
            ok: !!result.audio || !audioUrl,
            text: `✓ Exported ${name} — clean MP4${stats ? ` (${stats})` : ''}, plays everywhere. ${audioMsg}`,
          });
        }
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

  // TIKTOK MANUAL BRIDGE — there's no connected TikTok posting API for video yet
  // (Meta only), so this is the honest interim: export the reel and jump straight
  // to TikTok's own upload screen, so the operator just has to pick the file that's
  // about to land in Downloads / the share sheet.
  const exportForTikTok = async () => {
    if (recording || posting) return;
    if (!reelData.videoFile?.url) {
      setPostNote({ ok: false, text: 'Upload reel footage first — TikTok needs a rendered video, not the cover image.' });
      return;
    }
    // Open TikTok's upload tab FIRST — synchronously, in direct response to this
    // tap. The render below takes 10-60s; opening AFTER it finished would burn the
    // tap's transient activation and most browsers block that as an unrequested
    // popup (the same physics exportDelivery.js documents for navigator.share). A
    // blocked/failed open is non-fatal — the render and save still proceed.
    try { window.open(TIKTOK_UPLOAD_URL, '_blank', 'noopener'); } catch { /* popup blocked — non-fatal */ }

    setRecording(true);
    setRecordPct(0);
    setPostNote({ ok: true, text: 'Opened TikTok in a new tab — rendering your reel now (seeking + encoding + audio mix)…' });
    try {
      const { result, audioUrl, audioMsg } = await renderReelMp4({ durationCapSec: 1200 });
      exportSeqRef.current += 1;
      const stamp = `${SESSION_STAMP}-${exportSeqRef.current}`;
      const name = `bbf-reel-tiktok-${stamp}.mp4`;
      setLastExport({ blob: result.blob, name });
      vaultDraft('video', result.blob, {
        file_name: name,
        mode: 'reel',
        caption: reelFields().caption,
        duration_sec: result.durationSec || null,
        frames: result.frames || null,
      });
      const dur = result.durationSec ? `${result.durationSec}s` : '';
      if (isMobileish()) {
        setPostNote({
          ok: !!result.audio || !audioUrl,
          text: `✓ ${name} rendered${dur ? ` (${dur})` : ''}. Tap ⬇ SAVE TO PHONE, then switch to the TikTok tab and pick it from your Downloads/Gallery. ${audioMsg}`,
        });
      } else {
        await saveBlobToDevice(result.blob, name, { preferShare: false });
        setPostNote({
          ok: !!result.audio || !audioUrl,
          text: `✓ Downloaded ${name}${dur ? ` (${dur})` : ''} — switch to the TikTok tab and select it from your Downloads. ${audioMsg}`,
        });
      }
    } catch (e) {
      setPostNote({ ok: false, text: humanizeReelErr(e?.message) });
    } finally {
      setRecording(false);
    }
  };

  // ── 🏆 VIDEO SPOTLIGHT (Tier 2) — bake the PR clip + Spotlight frame → MP4 ──
  // Reuses the exact SovereignFoundry pipeline the Video Engine runs. The overlay
  // (stat callout, name, CTA, brand) is STATIC, so it's captured once and composited
  // onto every frame; the clip's own audio rides the footage channel.
  const renderSpotlightMp4 = async ({ durationCapSec }) => {
    const { SovereignFoundry } = await import('../../lib/SovereignFoundry.js');
    if (!SovereignFoundry.isSupported()) throw new Error('no_webcodecs');
    const videoUrl = spotData.spotVideo?.url;
    if (!videoUrl) throw new Error('no_footage');
    const overlay = await SovereignFoundry.captureOverlay(stageRef.current);
    const foundry = new SovereignFoundry(document.body);
    const voiceUrl = spotData.spotVoUrl || null;
    const result = await foundry.render({
      videoUrl,
      voUrl: voiceUrl,                        // AI voiceover (drives the baked captions)
      footageUrl: videoUrl,                   // the clip's own sound
      voGain: 1,
      footageGain: voiceUrl ? 0.35 : 1,       // duck the clip under the voiceover when present
      captions: spotData.spotCaptions,
      captionsEnabled: !!spotData.spotCaptionsEnabled,
      captionPos: spotData.spotCaptionPos ?? 78,
      overlay,
      durationCap: durationCapSec,
      onProgress: (p) => setRecordPct(Math.round(p * 100)),
    });
    if (!result || !result.blob) throw new Error('record_failed');
    const chans = [voiceUrl && 'voice', 'clip sound'].filter(Boolean);
    const audioMsg = result.audio ? `🎙 ${chans.join(' + ')} baked in.` : 'Clip had no audio track — exported silent.';
    return { result, audioMsg };
  };

  const exportOrPostSpotlight = async () => {
    if (recording || posting) return;
    const target = platformTarget();
    setPostNote(null);
    if (!spotData.spotVideo?.url) {
      setPostNote({ ok: false, text: 'Upload a PR clip first — the video spotlight needs footage to bake the frame onto.' });
      return;
    }
    setRecording(true);
    setRecordPct(0);
    try {
      setPostNote({ ok: true, text: 'Rendering spotlight (seeking + encoding frames + clip audio)…' });
      const { result, audioMsg } = await renderSpotlightMp4({ durationCapSec: target ? 90 : 1200 });
      exportSeqRef.current += 1;
      const stamp = `${SESSION_STAMP}-${exportSeqRef.current}`;
      const fields = spotFields();

      if (!target) {
        const name = `bbf-spotlight-${stamp}.mp4`;
        setLastExport({ blob: result.blob, name });
        vaultDraft('video', result.blob, { file_name: name, mode: 'spot', caption: fields.caption, duration_sec: result.durationSec || null, frames: result.frames || null });
        const dur = result.durationSec ? `${result.durationSec}s` : '';
        if (isMobileish()) {
          setPostNote({ ok: true, text: `✓ ${name} rendered${dur ? ` (${dur})` : ''}. Tap ⬇ SAVE TO PHONE below to save it. ${audioMsg}` });
        } else {
          await saveBlobToDevice(result.blob, name, { preferShare: false });
          setPostNote({ ok: true, text: `✓ Exported ${name} — clean MP4${dur ? ` (${dur})` : ''}. ${audioMsg}` });
        }
        return;
      }

      setPosting(true);
      setPostNote({ ok: true, text: `Posting spotlight to ${platformLabel()}…` });
      const { queuePost, pollPostStatus } = await import('../../lib/studioQueueApi.js');
      const res = await queuePost({ kind: 'video', fields: { ...fields, platform_target: target }, getBlob: async () => result.blob, now: true });
      if (res.status === 'posting') {
        setPostNote({ ok: true, text: 'Posting spotlight… Meta is transcoding (~60–90s).' });
        const verdict = await pollPostStatus({ kind: 'video', id: res.id });
        setPostNote({ ok: verdict === 'posted', text: verdict === 'posted' ? `✓ Spotlight posted. ${audioMsg}` : verdict === 'failed' ? 'Meta rejected the video — the asset is saved.' : 'Still finishing at Meta — check IG/FB shortly.' });
      } else {
        setPostNote({ ok: true, text: `✓ Spotlight posted. ${audioMsg}` });
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
              {undoSpin && (
                <button type="button" className="ph-clear-v4" onClick={undoSpin} data-testid="undo-spin">
                  ↩ Undo spin — restore previous copy
                </button>
              )}
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
              <button className="export-btn-v4" onClick={() => exportImage('cta')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT JPG'}
              </button>
              {postControls(cardFields(ctaData.eyebrow, ctaData.headline, ctaData.body, ctaData.buttonText, ctaData.primaryColor, 'cta'))}
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
              <button className="export-btn-v4" onClick={() => exportImage('phone')} disabled={exporting}>
                {exporting ? '… RENDERING' : '⬇ EXPORT 1080×1350'}
              </button>
              {postControls(cardFields(phoneData.eyebrow, phoneData.headline, phoneData.benefit, '', 'custom', 'phone'))}
            </div>
          </div>
        )}

        {mode === 'spot' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">🏆 Client Spotlight</label>
              <div className="seg-v4" data-testid="spot-format">
                <button className={spotData.format !== 'video' ? 'active' : ''} onClick={() => handleSpotChange('format', 'card')}>CARD 4:5</button>
                <button className={spotData.format === 'video' ? 'active' : ''} onClick={() => handleSpotChange('format', 'video')}>VIDEO 9:16</button>
              </div>
              <div className="hint-v4">
                {spotData.format === 'video'
                  ? 'Run a client PR clip as the background with the stat + Spotlight frame baked over it → 1080×1920 MP4.'
                  : 'A before / after win card — shoutout, quote pair, export a 1080×1350 post.'}
              </div>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Client Name</label>
              <input type="text" value={spotData.clientName} onChange={(e) => handleSpotChange('clientName', e.target.value)} className="input-v4" data-testid="spot-name" />
              <select
                className="select-v4"
                style={{ marginTop: 6 }}
                value=""
                data-testid="spot-roster"
                onMouseDown={loadSpotRoster}
                onFocus={loadSpotRoster}
                onChange={(e) => { if (e.target.value) handleSpotChange('clientName', e.target.value); }}
              >
                <option value="">{spotRosterBusy ? '… loading roster' : spotRosterLoaded ? `— pull from roster (${spotRoster.length}) —` : '— pull client from roster —'}</option>
                {spotRoster.map((n, i) => <option key={i} value={n}>{n}</option>)}
              </select>
            </div>

            {spotData.format === 'video' ? (
              <>
                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">🎬 PR Clip — upload the lift / run</label>
                  <input
                    type="file"
                    accept="video/*"
                    className="input-v4"
                    data-testid="spot-video-input"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) setSpotPhoto('spotVideo', f); }}
                  />
                  {spotData.spotVideo?.url && (
                    <button type="button" className="ph-clear-v4" onClick={() => setSpotPhoto('spotVideo', null)}>✕ Remove clip</button>
                  )}
                </div>

                <div className="divider-v4"></div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">🏆 Stat Callout</label>
                  <div className="stat-row-v4">
                    <input type="text" value={spotData.statNumber} onChange={(e) => handleSpotChange('statNumber', e.target.value)} className="input-v4" placeholder="688" data-testid="spot-stat-number" style={{ flex: 2 }} />
                    <input type="text" value={spotData.statUnit} onChange={(e) => handleSpotChange('statUnit', e.target.value)} className="input-v4" placeholder="LB" style={{ flex: 1 }} />
                  </div>
                  <input type="text" value={spotData.statLift} onChange={(e) => handleSpotChange('statLift', e.target.value)} className="input-v4" placeholder="DEADLIFT" style={{ marginTop: 6 }} />
                  <div className="hint-v4">Leave the number blank for a training clip with no headline stat.</div>
                </div>

                <div className="ctl-group-v4">
                  <label className="post-toggle-v4 spot-toggle-v4" style={{ display: 'inline-flex' }}>
                    <input type="checkbox" checked={!!spotData.prBadge} onChange={(e) => handleSpotChange('prBadge', e.target.checked)} data-testid="spot-pr-toggle" /> 🏆 NEW PR badge
                  </label>
                </div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">Rep / Set Line (optional)</label>
                  <input type="text" value={spotData.repLine} onChange={(e) => handleSpotChange('repLine', e.target.value)} className="input-v4" placeholder="3×3 @ RPE 9  ·  2.4× bodyweight" data-testid="spot-rep-line" />
                </div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">Stat Position — {spotData.statPos ?? 24}% from top</label>
                  <input type="range" min="8" max="70" value={spotData.statPos ?? 24} onChange={(e) => handleSpotChange('statPos', Number(e.target.value))} className="range-v4" data-testid="spot-stat-pos" />
                </div>

                <div className="divider-v4"></div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">🎙 AI Voiceover + Captions</label>
                  <button type="button" className="spin-btn-v4" onClick={generateSpotlightVo} disabled={spotVoBusy} data-testid="spot-gen-vo">
                    {spotVoBusy ? '… VOICING' : '🎙 VOICE THE STAT + BAKE CAPTIONS'}
                  </button>
                  <div className="hint-v4">Coach Akeem voices the client + stat + shoutout; the karaoke captions bake into the export automatically.</div>
                  {spotVoNote && (<div className="hint-v4" style={{ color: spotVoNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{spotVoNote.text}</div>)}
                  {spotData.spotCaptions?.words?.length ? (
                    <>
                      <label className="post-toggle-v4 spot-toggle-v4" style={{ display: 'inline-flex', marginTop: 8 }}>
                        <input type="checkbox" checked={!!spotData.spotCaptionsEnabled} onChange={(e) => handleSpotChange('spotCaptionsEnabled', e.target.checked)} data-testid="spot-captions-toggle" /> Show / bake captions
                      </label>
                      <label className="ctl-label-v4" style={{ marginTop: 8 }}>Caption Position — {spotData.spotCaptionPos ?? 78}% from top</label>
                      <input type="range" min="30" max="90" value={spotData.spotCaptionPos ?? 78} onChange={(e) => handleSpotChange('spotCaptionPos', Number(e.target.value))} className="range-v4" data-testid="spot-caption-pos" />
                    </>
                  ) : null}
                </div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">CTA Line</label>
                  <input type="text" value={spotData.cta} onChange={(e) => handleSpotChange('cta', e.target.value)} className="input-v4" />
                </div>

                <div className="ctl-group-v4">
                  <label className="ctl-label-v4">📤 Distribute Spotlight</label>
                  {captionBox(spotFields().caption)}
                  {socialToggles()}
                  {codecProbe && codecProbe.willFallback ? (
                    <div className="hint-v4" role="alert" style={{ color: '#fb923c', border: '1px solid rgba(251,146,60,.5)', background: 'rgba(251,146,60,.08)', borderRadius: 8, padding: '8px 10px', margin: '0 0 8px' }}>
                      ⚠ Hardware H.264 not detected. Video exports via a fallback codec, which social platforms recompress harder. For maximum quality, use a supported browser.
                    </div>
                  ) : null}
                  <button className="postnow-btn-v4" onClick={exportOrPostSpotlight} disabled={recording || posting} data-testid="spot-export-video">
                    {recording ? `🎬 RENDERING… ${recordPct}%` : platformTarget() ? `🚀 EXPORT & POST → ${platformLabel()}` : '⬇ EXPORT SPOTLIGHT MP4'}
                  </button>
                  <div className="hint-v4">Toggles OFF → records &amp; downloads. Toggles ON → records &amp; posts. Needs an uploaded clip.</div>
                  {postNote && (<div className="hint-v4" style={{ color: postNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{postNote.text}</div>)}
                  {vaultNoteLine}
                  {saveToPhoneBtn}
                </div>
              </>
            ) : (
              <>
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📷 Before Photo</label>
              <input
                type="file"
                accept="image/*"
                className="input-v4"
                data-testid="spot-before-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSpotPhoto('beforeImage', f); }}
              />
              {spotData.beforeImage?.url && (
                <button type="button" className="ph-clear-v4" onClick={() => setSpotPhoto('beforeImage', null)}>✕ Remove before photo</button>
              )}
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📷 After Photo</label>
              <input
                type="file"
                accept="image/*"
                className="input-v4"
                data-testid="spot-after-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSpotPhoto('afterImage', f); }}
              />
              {spotData.afterImage?.url && (
                <button type="button" className="ph-clear-v4" onClick={() => setSpotPhoto('afterImage', null)}>✕ Remove after photo</button>
              )}
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">🏷 Logo / Watermark (optional)</label>
              <input
                type="file"
                accept="image/*"
                className="input-v4"
                data-testid="spot-logo-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setSpotPhoto('spotLogo', f); }}
              />
              {spotData.spotLogo?.url && (
                <button type="button" className="ph-clear-v4" onClick={() => setSpotPhoto('spotLogo', null)}>✕ Remove logo</button>
              )}
            </div>

            <div className="divider-v4"></div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Sub-line</label>
              <input type="text" value={spotData.subLine} onChange={(e) => handleSpotChange('subLine', e.target.value)} className="input-v4" />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Achievement / context (seeds the AI shoutout)</label>
              <input type="text" value={spotData.achievement} onChange={(e) => handleSpotChange('achievement', e.target.value)} className="input-v4" placeholder='e.g. "-40 lbs in 6 months" or "first-ever pull-up"' data-testid="spot-achievement" />
              <button type="button" className="spin-btn-v4" onClick={generateSpotlightAi} disabled={spotAiBusy} data-testid="spot-ai-shoutout">
                {spotAiBusy ? '… WRITING' : '🤖 AI SHOUTOUT + QUOTES'}
              </button>
              {spotAiNote && (<div className="hint-v4" style={{ color: spotAiNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{spotAiNote.text}</div>)}
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Gold Shoutout</label>
              <input type="text" value={spotData.shoutout} onChange={(e) => handleSpotChange('shoutout', e.target.value)} className="input-v4" />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Quote Line 1 — proof (pick from the bank or write your own)</label>
              <select className="select-v4" value="" onChange={(e) => { if (e.target.value) handleSpotChange('quote1', e.target.value); }}>
                <option value="">— quote bank (16) —</option>
                {SPOT_QUOTES1.map((q, i) => <option key={i} value={q}>{q}</option>)}
              </select>
              <input type="text" style={{ marginTop: 6 }} value={spotData.quote1} onChange={(e) => handleSpotChange('quote1', e.target.value)} className="input-v4" />
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">Quote Line 2 — coach shoutout (pick from the bank or write your own)</label>
              <select className="select-v4" value="" onChange={(e) => { if (e.target.value) handleSpotChange('quote2', e.target.value); }}>
                <option value="">— quote bank (16) —</option>
                {SPOT_QUOTES2.map((q, i) => <option key={i} value={q}>{q}</option>)}
              </select>
              <input type="text" style={{ marginTop: 6 }} value={spotData.quote2} onChange={(e) => handleSpotChange('quote2', e.target.value)} className="input-v4" />
            </div>

            <div className="ctl-group-v4">
              <button type="button" className="spin-btn-v4" onClick={spinSpotQuotes} data-testid="spot-spin-quotes">🎰 SPIN QUOTE PAIR</button>
            </div>

            <div className="ctl-group-v4">
              <label className="ctl-label-v4">CTA Line</label>
              <input type="text" value={spotData.cta} onChange={(e) => handleSpotChange('cta', e.target.value)} className="input-v4" />
            </div>

            <div className="ctl-group-v4">
              <button className="export-btn-v4" onClick={() => exportImage('spotlight')} disabled={exporting} data-testid="spot-export">
                {exporting ? '… RENDERING' : '⬇ EXPORT 1080×1350'}
              </button>
              {postControls(spotFields())}
            </div>
              </>
            )}
          </div>
        )}

        {mode === 'queue' && (
          <div className="panel-v4 active">
            <div className="ctl-group-v4">
              <label className="ctl-label-v4">📡 Supabase Auto-Post Queue</label>
              <div className="hint-v4">Live monitor of cards &amp; reels queued or posted to IG/FB, plus every Ad Compiler render — the right pane lists active &amp; pending jobs and auto-refreshes every 15s.</div>
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
              {captionBox(reelFields().caption)}
              {socialToggles()}
              <button
                type="button"
                className="queue-btn-v4"
                onClick={exportForTikTok}
                disabled={recording || posting}
                data-testid="tiktok-bridge-btn"
              >
                {recording ? '🎬 RENDERING…' : '🎵 EXPORT & OPEN TIKTOK'}
              </button>
              <div className="hint-v4">
                Direct TikTok posting isn’t connected yet — this renders the reel, opens
                @build.believe.fit’s upload screen in a new tab, and saves the file so you
                can drop it straight in.
              </div>
              {/* VP9 fallback guardrail — non-blocking, shown BEFORE the render when
                  this browser has no H.264 encoder (Linux/headless/some Chromium). */}
              {codecProbe && codecProbe.willFallback ? (
                <div
                  className="hint-v4"
                  role="alert"
                  data-testid="codec-fallback-warning"
                  style={{ color: '#fb923c', border: '1px solid rgba(251,146,60,.5)', background: 'rgba(251,146,60,.08)', borderRadius: 8, padding: '8px 10px', margin: '0 0 8px' }}
                >
                  ⚠ Hardware H.264 not detected. Video will export using a fallback codec,
                  which may result in lower quality on social platforms. For maximum quality,
                  use a supported browser.
                </div>
              ) : null}
              <button className="postnow-btn-v4" onClick={exportOrPostReel} disabled={recording || posting}>
                {recording ? `🎬 RENDERING… ${recordPct}%` : platformTarget() ? `🚀 EXPORT & POST → ${platformLabel()}` : '⬇ EXPORT VIDEO'}
              </button>
              <div className="hint-v4">
                Toggles OFF → records &amp; downloads the reel. Toggles ON → records &amp; posts it. Needs uploaded footage (else exports the cover frame).
              </div>
              {postNote && (
                <div className="hint-v4" style={{ color: postNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>{postNote.text}</div>
              )}
              {vaultNoteLine}
              {saveToPhoneBtn}
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

        {mode === 'spot' && spotData.format === 'video' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1920}>
              <SpotlightVideoStage spotData={spotData} stageRef={stageRef} />
            </StageScaler>
          </div>
        )}

        {mode === 'spot' && spotData.format !== 'video' && (
          <div className="stage-host-v4 active">
            <StageScaler designWidth={1080} designHeight={1350}>
              <div className="stage-spot-v4" ref={stageRef}>
                <div className="spot-strip-v4" />
                <div className="spot-hdr-v4">
                  {spotData.spotLogo?.url && (
                    <div className="spot-hdr-logo-v4"><img src={spotData.spotLogo.url} alt="" crossOrigin="anonymous" /></div>
                  )}
                  <div className="spot-htext-v4">
                    <div className="spot-eye-v4">CLIENT SPOTLIGHT</div>
                    <div className="spot-name-v4">{spotData.clientName}</div>
                    <div className="spot-sub-v4">{spotData.subLine}</div>
                  </div>
                </div>
                <div className="spot-photos-v4">
                  <div className="spot-ph-v4">
                    {spotData.beforeImage?.url
                      ? <img src={spotData.beforeImage.url} alt="Before" className="spot-photo-img-v4" crossOrigin="anonymous" />
                      : <div className="spot-ph-placeholder-v4">UPLOAD<br />BEFORE 📷</div>}
                    <div className="spot-badge-v4 before">BEFORE</div>
                  </div>
                  <div className="spot-ph-v4">
                    {spotData.afterImage?.url
                      ? <img src={spotData.afterImage.url} alt="After" className="spot-photo-img-v4" crossOrigin="anonymous" />
                      : <div className="spot-ph-placeholder-v4">UPLOAD<br />AFTER 📷</div>}
                    <div className="spot-badge-v4 after">AFTER</div>
                  </div>
                </div>
                <div className="spot-ftr-v4">
                  <div className="spot-shout-v4">{spotData.shoutout}</div>
                  {spotData.quote1 && <div className="spot-q-v4">{spotData.quote1}</div>}
                  {spotData.quote2 && <div className="spot-q-v4 two">{spotData.quote2}</div>}
                  <div className="spot-cta-v4">{spotData.cta}</div>
                  <div className="spot-brand-v4">BUILD<span>BELIEVE</span>FIT</div>
                </div>
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
            <CompilerQueue />
          </div>
        )}
      </div>

      {/* Hard UI lock + progress overlay while the SovereignFoundry encodes. */}
      {recording && (
        <div className="rec-lock-v4" role="alertdialog" aria-busy="true" aria-label="Rendering reel">
          <div className="rec-lock-card">
            <div className="rec-spinner" />
            <div className="rec-title">RENDERING REEL</div>
            <div className="rec-sub">Encoding frames + mixing audio — please keep this tab open.</div>
            <div className="rec-bar"><div className="rec-bar-fill" style={{ width: `${recordPct}%` }} /></div>
            <div className="rec-pct">{recordPct}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
