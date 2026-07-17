// src/components/SovereignStudioV4/index.jsx
// Master container for Sovereign Studio V4 — fresh native React rebuild
// Uses v3 strictly as a visual & functional reference, not code translation

import { useState, useEffect, useRef } from 'react';
import StudioLayout from './StudioLayout';
import StudioCompilerPanel from './StudioCompilerPanel';
import DraftHistoryPanel from './DraftHistoryPanel';
import { SPOT_DEFAULTS } from './spotlightData';
import './sovereignStudioV4.css';

// ── WORK-IN-PROGRESS PERSISTENCE ─────────────────────────────────────────────
// Every typed field (headlines, hooks, colors, voice/config picks) is mirrored
// to localStorage (debounced) so a reload, a PWA tab reclaimed by Android, or a
// crash never wipes the session's copywriting back to defaults. Blob-backed
// uploads (footage / logo / screenshots / music) CANNOT survive a reload —
// their object URLs die with the JS session — so they are excluded from the
// snapshot and simply start empty again after a reload.
const EDITOR_STATE_KEY = 'bbf-studio-v4-editor-v1';
const NONPERSISTED_KEYS = new Set([
  'backgroundImage', 'backgroundImage2', 'backgroundImage3', // phone screenshots
  'logoImage', 'videoFile', 'musicFile',                      // reel uploads
  'beforeImage', 'afterImage', 'spotLogo', 'spotVideo',       // spotlight uploads
]);

// Hydrate one state slice: defaults overlaid with the saved snapshot, but only
// for keys the defaults define (schema drift → stale keys drop silently) and
// never for blob-backed keys. Reads localStorage per call so a remount always
// picks up the LATEST save, not a stale module-load snapshot.
function hydrateSlice(slice, defaults) {
  try {
    const raw = localStorage.getItem(EDITOR_STATE_KEY);
    const saved = raw ? JSON.parse(raw)?.[slice] : null;
    if (!saved || typeof saved !== 'object') return defaults;
    const out = { ...defaults };
    for (const k of Object.keys(defaults)) {
      if (NONPERSISTED_KEYS.has(k)) continue;
      if (k in saved && saved[k] !== undefined && saved[k] !== null) out[k] = saved[k];
    }
    return out;
  } catch {
    return defaults; // corrupt/absent storage — start clean, never crash the studio
  }
}

// Card catalog — copy ported verbatim from the v3 reference banks (each entry is
// [eyebrow, headline, body, buttonText]; *single* = accent highlight, **double**
// = bold white). Lanes mirror the v3 lane dropdown.
const CATALOG = {
  fence: [
    ['BBF • FOR THE HESITANT', 'STOP WAITING\nFOR A SIGN.\n*THIS IS IT.*', 'No pressure. No judgment. Just a conversation.\n**DM "PATHFINDER" and let\'s talk.**', 'DM PATHFINDER'],
    ['BBF • FOR THE HESITANT', 'THE PERFECT\nMONDAY ISN\'T\n*COMING.*', 'There is no perfect week to begin. There never was.\n**The best day is the one you stop waiting on.**', 'STOP WAITING'],
    ['BBF • FOR THE HESITANT', 'FEAR IS LOUD.\nREGRET IS\n*LOUDER.*', 'The discomfort of starting fades in a week.\n**The weight of never starting doesn\'t.**', 'CHOOSE'],
    ['BBF • FOR THE HESITANT', 'THE HARDEST REP\nIS THE DECISION\nTO *BEGIN.*', 'After that first yes, everything gets easier.\n**Take the rep.**', 'TAKE THE REP'],
  ],
  identity: [
    ['BBF • IDENTITY', 'BECOME THE\nPERSON WHO\n*TRAINS.*', 'You\'re not chasing a look.\n**You\'re building an identity.**', 'BECOME IT'],
    ['BBF • IDENTITY', 'EVERY SESSION IS\nA VOTE FOR WHO\nYOU\'RE\n*BECOMING.*', 'Cast enough votes in one direction\n**and the identity becomes undeniable.**', 'CAST ONE'],
    ['BBF • LEGACY', 'YOUR KIDS INHERIT\nYOUR *HABITS.*\nNOT YOUR WORDS.', 'They become what they watch you do.\n**Break the loop and you free a generation.**', 'REWRITE IT'],
  ],
  parent: [
    ['BBF • WORKING PARENT', 'THE KIDS DON\'T\nNEED PERFECT.\nTHEY NEED\n*PRESENT.*', 'Energy is presence. Training builds energy.\n**Train for them too.**', 'BE PRESENT'],
    ['BBF • WORKING PARENT', 'SELF-CARE ISN\'T\nSELFISH. IT\'S\n*STAFFING.*', 'You\'re the whole infrastructure of that household.\n**Maintain the infrastructure.**', 'MAINTAIN IT'],
  ],
  responder: [
    ['BBF • FIRST RESPONDER', 'YOU ANSWER\nEVERY CALL BUT\nYOUR *OWN.*', 'The body that saves others needs saving too.\n**Respond to yourself.**', 'RESPOND'],
    ['BBF • FIRST RESPONDER', '12-HOUR SHIFTS.\n35-MINUTE\n*SESSIONS.*', 'The protocol fits between the chaos.\n**No excuses left.**', 'RUN IT'],
  ],
  vision: [
    ['BBF • VISION', 'SEE IT BEFORE\nYOU *LIFT* IT.', 'Every PR happens twice — first in the mind.\n**Rehearse the win.**', 'VISUALIZE'],
  ],
  comeback: [
    ['BBF • COMEBACK', 'YOUR LAST ATTEMPT\nWAS THE DRESS\nREHEARSAL. THIS\nONE\'S THE\n*SHOW.*', 'Everything you learned goes forward.\n**Take the stage.**', 'TAKE THE STAGE'],
    ['BBF • COMEBACK', 'YOU ARE NOT\nTOO FAR GONE.\nONE DECISION\n*AWAY.*', 'Wherever you\'re starting from is exactly the right place.\n**Make the decision.**', 'DECIDE'],
  ],
};

export default function SovereignStudioV4() {
  const [mode, setMode] = useState('cta');
  const [ctaData, setCtaData] = useState(() => hydrateSlice('cta', {
    lane: 'all',
    format: 'feed',
    eyebrow: 'BUILD BELIEVE FIT • THE WHY',
    headline: 'STOP WAITING\nFOR A SIGN.\n*THIS IS IT.*',
    body: 'No pressure. No judgment. Just a conversation.\n**DM me "PATHFINDER" and let\'s talk.**',
    buttonText: 'DM PATHFINDER',
    primaryColor: '#f5c800',
    secondaryColor: '#6a0dad',
  }));

  const [phoneData, setPhoneData] = useState(() => hydrateSlice('phone', {
    layout: 'single',
    frame: 'sleek',
    eyebrow: 'NUTRITION  •  ADAPTIVE FASTING',
    headline: 'FUEL ON\nYOUR CLOCK',
    benefit: 'Six fasting protocols, a live eating window, and your macros tracked in real time.',
    backgroundImage: null,   // front-phone screenshot (single / dual / trio)
    backgroundImage2: null,  // 2nd-phone screenshot (dual back phone / trio left phone)
    backgroundImage3: null,  // 3rd-phone screenshot (trio right phone)
  }));

  const [reelData, setReelData] = useState(() => hydrateSlice('reel', {
    spectrum: '',
    hook: '',
    hookSub: '',
    watchText: 'WATCH',     // editable label for the ▶ WATCH chip
    overlayStyle: 'scrim',
    series: '',
    backgroundColor: '#08060a',
    logoImage: null,
    videoFile: null,
    musicFile: null,        // custom music upload → the dedicated MUSIC track element
    textLayout: 'bottom',   // overlay text placement toggle (bottom | center | top)
    hookFont: 'bebas',      // hook headline typeface (bebas | anton | barlow)
    hookFontSize: 138,      // hook headline size in px, 1080-design space (matches the old fixed CSS default)
    caption_animation_style: 'static', // kinetic text motion (static | word-pop | shoot-in | fade-glide) — executes live in the preview
    phoneBackdrop: false,   // show the footage playing INSIDE a phone-frame-v4 mockup instead of full-bleed
    phoneFrame: 'sleek',    // phone-backdrop frame skin (sleek | gold | carbon) — same options as the Phone section
    logoScale: 1,           // asset size handle — scales the corner logo badge
    musicVolume: 80,        // music-track mix (0–100%) → ReelPreviewEngine music element
    voiceVolume: 100,       // voice-track mix (0–100%) → ReelPreviewEngine voiceover element
    footageVolume: 100,     // clip-audio mix (0–100%) → the uploaded footage's OWN baked-in sound (prebaked music), bound to the preview <video> and mixed as a ducked channel in the export

    // FRONT 5 · Sovereign Voiceover (lazy-cached bbf-studio-voiceover)
    voTopic: '',            // Exercise / topic that keys the cache
    vibe: 'the_architect',  // voice character → script tone + ElevenLabs physics
    targetDuration: 30,     // seconds: 15 Hook / 30 Breakdown / 60 Masterclass
    lang: 'en',             // payload lang (en/es/pt) — defaults EN
    voUrl: null,            // voice channel: generated/vault Supabase URL, or a re-minted blob for an uploaded voiceover → ReelPreviewEngine
    voUploadName: null,     // filename when voUrl is a USER UPLOAD (persisted marker → rehydrate the blob from IndexedDB on reload); null for generated/vault voice
    captions: null,         // { words: [{ text, start, end }] } transcript of the voice track (ElevenLabs Scribe) → karaoke captions; cleared whenever the voice changes
    captionsEnabled: false, // render the karaoke captions overlay in the preview (and, later, the export)
    captionPos: 62,         // caption vertical position as a % of reel height (20 = high, 90 = low); adjustable so it clears the subject/action

    // CAPTION STYLE STUDIO — the karaoke look, no longer baked-in (defaults
    // reproduce the historical style exactly; preview CSS vars = foundry canvas).
    capFont: 'barlow',      // caption typeface (barlow | bebas | anton) — same trio as the hook
    capSize: 58,            // caption size in px, 1080-design space (old fixed value)
    capChunk: 4,            // words per phrase (2–6) — shorter chunks read punchier
    capColor: '#ffffff',    // caption text fill
    capHighlight: '#f5c800',// active-word box (BBF Gold default — LOCKED brand accent)

    // VOICE IDENTITY — '' = Coach Akeem (the CEO-pinned signature clone);
    // any other value is an ElevenLabs voice_id from the account roster.
    voiceId: '',
    hookColor: '',          // hook headline color override ('' = stylesheet white)
  }));

  // 🏆 CLIENT SPOTLIGHT — restored from the legacy studio, now a first-class V4 mode.
  // Blob-backed photo/video uploads (beforeImage / afterImage / spotLogo) can't
  // survive a reload (their object URLs die with the session), so they're excluded
  // from the snapshot; the copy fields persist like every other card.
  const [spotData, setSpotData] = useState(() => hydrateSlice('spot', SPOT_DEFAULTS));

  // Debounced localStorage mirror of the three editor slices (blob fields
  // stripped). 400ms coalesces per-keystroke updates into one write.
  const persistTimerRef = useRef(null);
  useEffect(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        // Drop the blob-object keys, AND null out any blob: URL string (e.g. an
        // uploaded voiceover's voUrl) — an object URL is dead on the next reload, so
        // persisting it would restore a broken reference. The uploaded bytes are
        // re-hydrated from IndexedDB instead (studioAssetStore), keyed off the
        // sibling *UploadName marker that DOES persist here.
        const strip = (o) => Object.fromEntries(
          Object.entries(o)
            .filter(([k]) => !NONPERSISTED_KEYS.has(k))
            .map(([k, v]) => [k, (typeof v === 'string' && v.startsWith('blob:')) ? null : v]),
        );
        localStorage.setItem(EDITOR_STATE_KEY, JSON.stringify({
          cta: strip(ctaData), phone: strip(phoneData), reel: strip(reelData), spot: strip(spotData),
        }));
      } catch { /* private mode / storage full — persistence is best-effort */ }
    }, 400);
    return () => { if (persistTimerRef.current) clearTimeout(persistTimerRef.current); };
  }, [ctaData, phoneData, reelData, spotData]);

  // Keep a live ref to the reel blob URLs so the unmount cleanup revokes whatever
  // is current. Synced in an effect (never during render) per the hooks rules.
  const blobUrlsRef = useRef({ video: null, logo: null, phone: null, phone2: null, phone3: null });
  useEffect(() => {
    blobUrlsRef.current = {
      video: reelData.videoFile?.url || null,
      logo: reelData.logoImage?.url || null,
      phone: phoneData.backgroundImage?.url || null,
      phone2: phoneData.backgroundImage2?.url || null,
      phone3: phoneData.backgroundImage3?.url || null,
      music: reelData.musicFile?.url || null,
      spotBefore: spotData.beforeImage?.url || null,
      spotAfter: spotData.afterImage?.url || null,
      spotLogo: spotData.spotLogo?.url || null,
      spotVideo: spotData.spotVideo?.url || null,
    };
  }, [reelData.videoFile?.url, reelData.logoImage?.url, reelData.musicFile?.url, phoneData.backgroundImage?.url, phoneData.backgroundImage2?.url, phoneData.backgroundImage3?.url, spotData.beforeImage?.url, spotData.afterImage?.url, spotData.spotLogo?.url, spotData.spotVideo?.url]);
  useEffect(() => () => {
    const { video, logo, phone, phone2, phone3, music, spotBefore, spotAfter, spotLogo, spotVideo } = blobUrlsRef.current;
    if (video) URL.revokeObjectURL(video);
    if (logo) URL.revokeObjectURL(logo);
    if (phone) URL.revokeObjectURL(phone);
    if (phone2) URL.revokeObjectURL(phone2);
    if (phone3) URL.revokeObjectURL(phone3);
    if (music) URL.revokeObjectURL(music);
    if (spotBefore) URL.revokeObjectURL(spotBefore);
    if (spotAfter) URL.revokeObjectURL(spotAfter);
    if (spotLogo) URL.revokeObjectURL(spotLogo);
    if (spotVideo) URL.revokeObjectURL(spotVideo);
  }, []);

  const handleModeChange = (newMode) => {
    setMode(newMode);
  };

  const handleCtaChange = (key, value) => {
    setCtaData(prev => ({ ...prev, [key]: value }));
  };

  const handlePhoneChange = (key, value) => {
    setPhoneData(prev => ({ ...prev, [key]: value }));
  };

  const handleReelChange = (key, value) => {
    setReelData(prev => ({ ...prev, [key]: value }));
  };

  const handleSpotChange = (key, value) => {
    setSpotData(prev => ({ ...prev, [key]: value }));
  };

  // SPIN overwrites four hand-editable fields at once — keep a one-step undo
  // snapshot so a spin over hand-tuned copy is never destructive.
  const [spinUndo, setSpinUndo] = useState(null); // { eyebrow, headline, body, buttonText } | null
  const spinCard = () => {
    // Honor the selected lane; "all" (or an empty lane) shuffles the whole catalog.
    const selected = ctaData.lane;
    const pool = selected && selected !== 'all' && CATALOG[selected]
      ? CATALOG[selected]
      : Object.values(CATALOG).flat();
    if (!pool.length) return;
    const [eyebrow, headline, body, buttonText] = pool[Math.floor(Math.random() * pool.length)];
    setSpinUndo({
      eyebrow: ctaData.eyebrow, headline: ctaData.headline,
      body: ctaData.body, buttonText: ctaData.buttonText,
    });
    // One atomic update — replaces all four fields together (no reliance on
    // functional-updater accumulation across separate calls).
    setCtaData(prev => ({ ...prev, eyebrow, headline, body, buttonText }));
  };
  const undoSpin = spinUndo ? () => {
    setCtaData(prev => ({ ...prev, ...spinUndo }));
    setSpinUndo(null);
  } : null;

  return (
    <div className="sovereign-studio-v4">
      <div className="topbar-v4">
        <div className="tb-head-v4">
          <div>
            <div className="tb-brand-v4">Build<span>Believe</span>Fit</div>
            <div className="tb-sub-v4">Sovereign Studio V4 · All-In-One Content Machine</div>
          </div>
          <div className="tb-exit-v4">
            <a className="exit-btn-v4" href="/command" title="Back to Command Center">⌂ Command Center</a>
          </div>
        </div>
        <div className="mode-tabs-v4" role="tablist" aria-label="Studio surfaces">
          {[
            ['cta', '🃏 CTA CARDS'],
            ['phone', '📱 PHONE'],
            ['spot', '🏆 SPOTLIGHT'],
            ['reel', '🎬 VIDEO ENGINE'],
            ['compiler', '⚙ AD COMPILER'],
            ['queue', '📡 QUEUE'],
            ['history', '🗂 HISTORY'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={`mode-tab-v4 ${mode === id ? 'active' : ''}`}
              onClick={() => handleModeChange(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'compiler' ? (
        // Standalone URL-driven pipeline — no ctaData/phoneData/reelData editor
        // state to thread through; it's self-contained like QueueMonitor.
        <div className="sc-shell"><StudioCompilerPanel /></div>
      ) : mode === 'history' ? (
        // Vault Export History — self-contained reader over bbf-studio-drafts;
        // no editor state to thread through (same shape as the compiler panel).
        <div className="dhist-shell-v4"><DraftHistoryPanel /></div>
      ) : (
        <StudioLayout
          mode={mode}
          ctaData={ctaData}
          handleCtaChange={handleCtaChange}
          spinCard={spinCard}
          undoSpin={undoSpin}
          phoneData={phoneData}
          handlePhoneChange={handlePhoneChange}
          reelData={reelData}
          handleReelChange={handleReelChange}
          spotData={spotData}
          handleSpotChange={handleSpotChange}
        />
      )}
    </div>
  );
}
