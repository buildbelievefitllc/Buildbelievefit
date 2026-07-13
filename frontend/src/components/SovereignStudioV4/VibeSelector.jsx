// src/components/SovereignStudioV4/VibeSelector.jsx
// Reel inputs: hook spectrum + spin, footage/logo upload, overlay skin, series tag,
// and the FRONT 5 Sovereign Voiceover engine (lazy-cached bbf-studio-voiceover):
// pick a topic + voice character + target duration → Generate → the Edge Function
// returns a cached-or-fresh MP3 URL that loads into the ReelPreviewEngine.

import { useRef, useState, useEffect } from 'react';
import ExerciseCombobox from './ExerciseCombobox';
import { putAsset, getAsset, deleteAsset } from '../../lib/studioAssetStore.js';

// Stable IndexedDB slot for the single WIP uploaded voiceover (one editor draft →
// one voice upload), so it re-mints across reloads. Mirrors the single-slot model
// of the localStorage editor snapshot.
const VO_ASSET_KEY = 'reel-voiceover';
// Lean name→category map for the 125 cached vault exercises (extracted from the
// seed — NO script text, so the client bundle stays small). Drives the grouped
// topic picker. The actual zero-cost URL lookup lives in studioApi.js.
import audioVaultCategories from '../../data/audioVaultCategories.json';
// FRONT 6 — pre-rendered scenario audio vault ($0, zero-latency). Populated by
// scripts/compile-voice-vault.js; selecting an item loads its URL straight into
// the reel audio, bypassing the live generation edge function.
import sovereignVaultManifest from '../../data/sovereignVaultManifest.json';

// Group the pre-rendered vault by category for the dropdown's <optgroup>s.
const VAULT_BY_CATEGORY = sovereignVaultManifest.reduce((acc, item) => {
  (acc[item.category || 'General'] = acc[item.category || 'General'] || []).push(item);
  return acc;
}, {});

// Group the cached exercises by category for the topic picker. Friendly labels +
// a deliberate order; any unknown category falls in after, alphabetically.
const CATEGORY_LABELS = { Strength: 'Core Strength', Prehab: 'Prehab', Recovery: 'Recovery' };
const CATEGORY_ORDER = ['Strength', 'Prehab', 'Recovery'];
const EXERCISE_GROUPS = (() => {
  const byCat = {};
  for (const [name, cat] of Object.entries(audioVaultCategories)) (byCat[cat] = byCat[cat] || []).push(name);
  const cats = [...CATEGORY_ORDER.filter((c) => byCat[c]), ...Object.keys(byCat).filter((c) => !CATEGORY_ORDER.includes(c)).sort()];
  return cats.map((cat) => ({ label: (CATEGORY_LABELS[cat] || cat).toUpperCase(), items: byCat[cat] }));
})();
const CACHED_COUNT = Object.keys(audioVaultCategories).length;

// Voice characters (vibes) — drive the VO script tone + ElevenLabs physics. ids
// MUST match the Edge Function's VIBES map.
const VOICES = [
  ['the_architect', 'The Architect — resonant storytelling'],
  ['the_mechanic', 'The Mechanic — sharp, technical'],
  ['real_talk', 'Real Talk — conversational'],
  ['the_sanctuary', 'The Sanctuary — deep, slow'],
  ['the_reframe', 'The Reframe — perspective shift'],
];

// Target runtime → seconds. Script length is derived server-side (~2.5 words/sec).
const DURATIONS = [
  [15, '15s Hook'],
  [30, '30s Breakdown'],
  [60, '60s Masterclass'],
];

// Trilingual — the lang the Claude script + ElevenLabs voice are generated in.
const LANGS = [
  ['en', 'EN'],
  ['es', 'ES'],
  ['pt', 'PT'],
];

function humanizeVoErr(slug) {
  const map = {
    not_admin: 'Admin session required — sign in to the Command Center.',
    missing_topic: 'Enter an exercise / topic first.',
    missing_duration: 'Pick a target duration.',
    tts_unconfigured: 'Voice engine not configured (ElevenLabs key missing).',
    llm_unconfigured: 'Script engine not configured (Anthropic key missing).',
    script_failed: 'The script engine failed — try again.',
    tts_failed: 'ElevenLabs could not synthesize this take — try again.',
    vault_write_failed: 'Audio generated but could not be cached — try again.',
    voiceover_no_url: 'The engine returned no audio URL — try again.',
  };
  return map[slug] || 'Voiceover generation failed — try again.';
}

// Hook banks ported from the v3 HOOK_SPECTRUMS reference (headline + sub-line).
const HOOKS = {
  bioenergetics: [
    { hook: 'BIOENERGETICS\nRULE YOUR CLOCK', sub: 'Not motivation. Mitochondrial capacity.' },
    { hook: 'SLEEP ISN\'T\nLOST TIME', sub: 'It\'s when the adaptations happen.' },
    { hook: 'YOU DON\'T BURN\nFAT IN THE GYM', sub: 'You burn it in the 16 hours after.' },
  ],
  solis: [
    { hook: 'THE SUN IS\nYOUR COACH', sub: 'Align with it. Everything changes.' },
    { hook: 'DARKNESS ISN\'T\nPUNISHMENT', sub: 'It\'s the recovery window.' },
    { hook: 'YOUR MOOD IS A\nMETABOLIC STATE', sub: 'Train the chemistry, not the feeling.' },
  ],
  prehab: [
    { hook: 'PAIN IS DATA,\nNOT DAMAGE', sub: 'Move smarter, not less.' },
    { hook: 'PREVENTION\nCOMPOUNDS', sub: 'One prehab session pays off for years.' },
    { hook: 'MOBILITY IS\nA SAVINGS ACCOUNT', sub: 'Deposit daily. Withdraw at 60.' },
  ],
  shift: [
    { hook: '12-HOUR SHIFTS\nBREAK BODIES', sub: 'The protocol rebuilds them between calls.' },
    { hook: 'SLEEP\'S A MESS.\nTRAIN ANYWAY', sub: 'Readiness-aware programming meets you where the shift left you.' },
    { hook: 'ADRENALINE ISN\'T\nA FITNESS PLAN', sub: 'The job spikes you. Training stabilizes you.' },
  ],
};

// Kinetic text animation styles — caption_animation_style values. 'static' is the
// no-motion default; the other three map to keyframes in sovereignStudioV4.css
// (§Kinetic Text) that the ReelPreviewEngine executes live on the hook overlay.
const CAPTION_ANIMATIONS = [
  ['static', 'STATIC'],
  ['word-pop', 'WORD POP'],
  ['shoot-in', 'SHOOT-IN'],
  ['fade-glide', 'FADE-GLIDE'],
];

// ── Blanket Facelift: collapsible semantic section (category accordion). All
// sections default OPEN — the categorized structure + on-demand collapse is the
// bloat cure, and every control stays reachable (e2e selectors + CEO muscle
// memory unbroken). Header = emoji + label + chevron; body = the untouched
// control groups. ──
function CtlSection({ icon, label, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`ctl-section-v4${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="ctl-section-head-v4"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ctl-section-ic-v4" aria-hidden="true">{icon}</span>
        <span className="ctl-section-label-v4">{label}</span>
        <span className="ctl-section-chev-v4" aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open ? <div className="ctl-section-body-v4">{children}</div> : null}
    </section>
  );
}

// Hook headline typeface choices — mirrors ReelPreviewEngine's HOOK_FONT_STACK ids.
// Labels match StudioCompilerPanel's picker — same ids, same names everywhere.
const HOOK_FONTS = [
  ['bebas', 'BEBAS'],
  ['anton', 'ANTON'],
  ['barlow', 'BARLOW'],
];

const SERIES = [
  ['', '— series database —'],
  ['form-fix', 'FORM FIX'],
  ['recovery-protocol', 'RECOVERY PROTOCOL'],
  ['mindset', 'MINDSET PROTOCOL'],
  ['metabolic', 'METABOLIC WINDOW'],
  ['12hour', '12-HOUR SURVIVAL'],
  ['sovereign', 'SOVEREIGN SUNDAY'],
  ['fuel', 'FUEL FILES'],
  ['lab', 'THE LAB'],
  ['rising-athlete', 'RISING ATHLETE'],
  ['prehab-minute', 'PREHAB MINUTE'],
  ['35-min', '35-MIN PROTOCOL'],
];

export default function VibeSelector({ reelData, handleReelChange }) {
  const videoInputRef = useRef(null);
  const logoInputRef = useRef(null);
  const [voBusy, setVoBusy] = useState(false);
  const [voNote, setVoNote] = useState(null); // { ok: boolean, text: string }
  // Uploaded-voiceover lifecycle: voBlobRef holds the object URL we minted for a
  // user-uploaded voice file (so it can be revoked before it's replaced). The
  // "is this voice a user upload?" marker lives in reelData.voUploadName so it
  // PERSISTS with the editor snapshot and drives both the remove chip and the
  // reload rehydration below.
  const voBlobRef = useRef(null);
  const voUploadName = reelData.voUploadName || null;

  // The single writer for the voice channel (voUrl). Revokes any prior blob WE own
  // before swapping in the next source, so repeated uploads — or switching to
  // Generate / the Vault after an upload — never leak the previous object URL.
  // `owned` marks a blob we minted (an upload); remote generate/vault URLs are not
  // ours to revoke. `persistBytes:false` skips the IndexedDB write on a rehydrate
  // (the bytes are already stored). Switching AWAY from an upload (uploadName null)
  // drops the stored bytes so a stale voiceover can't rehydrate later. Every voUrl
  // write funnels through here.
  const applyVoiceUrl = (url, { owned = false, uploadName = null } = {}) => {
    if (voBlobRef.current && voBlobRef.current !== url) URL.revokeObjectURL(voBlobRef.current);
    voBlobRef.current = owned ? url : null;
    handleReelChange('voUploadName', uploadName);
    handleReelChange('voUrl', url);
    if (!uploadName) { deleteAsset(VO_ASSET_KEY).catch(() => {}); }
  };

  // Reload rehydration (runs once): a prior session uploaded a voiceover — its
  // marker persisted in reelData.voUploadName, but the blob: URL died with that
  // session (and the snapshot nulled it). Re-mint a fresh object URL from the bytes
  // stashed in IndexedDB so the upload survives the reload / reclaimed PWA tab.
  const rehydratedRef = useRef(false);
  useEffect(() => {
    if (rehydratedRef.current) return undefined;
    rehydratedRef.current = true;
    if (!reelData.voUploadName || reelData.voUrl) return undefined; // nothing uploaded, or a live voice already present
    let cancelled = false;
    getAsset(VO_ASSET_KEY).then((rec) => {
      if (cancelled || !rec?.blob) return;
      const url = URL.createObjectURL(rec.blob);
      applyVoiceUrl(url, { owned: true, uploadName: rec.name || reelData.voUploadName });
    }).catch(() => {});
    return () => { cancelled = true; };
    // Mount-once: the ref guard makes any re-run a no-op, so stable-deps churn is moot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [hookBusy, setHookBusy] = useState(false);
  const [hookNote, setHookNote] = useState(null); // { ok: boolean, text: string }
  // One-step undo for the two hook overwriters (SPIN + AUTO) — hand-tuned copy
  // must never be destroyed by a stray tap.
  const [hookUndo, setHookUndo] = useState(null); // { hook, hookSub } | null
  const snapshotHook = () => setHookUndo({ hook: reelData.hook, hookSub: reelData.hookSub });
  const undoHook = () => {
    if (!hookUndo) return;
    handleReelChange('hook', hookUndo.hook);
    handleReelChange('hookSub', hookUndo.hookSub);
    setHookUndo(null);
    setHookNote({ ok: true, text: 'Restored your previous hook.' });
  };

  // Pull a random hook from the chosen spectrum, or across ALL spectrums when the
  // default "— all spectrums (shuffle) —" is selected (v3 parity — no dead button).
  const pullHook = (spectrum) => {
    const pool = spectrum && HOOKS[spectrum] ? HOOKS[spectrum] : Object.values(HOOKS).flat();
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    snapshotHook();
    handleReelChange('hook', pick.hook);
    handleReelChange('hookSub', pick.sub);
  };

  const handleSpectrumChange = (e) => {
    const spectrum = e.target.value;
    handleReelChange('spectrum', spectrum);
    if (spectrum) pullHook(spectrum);
  };

  // FRONT 5 — Auto-Generate the hook + sub-line via Claude Haiku, seeded by the
  // exercise selected in the zero-latency dropdown (reelData.voTopic).
  async function handleAutoHook() {
    if (hookBusy) return;
    const topic = (reelData.voTopic || '').trim();
    if (!topic) { setHookNote({ ok: false, text: 'Pick an exercise in the Voiceover panel below first — it seeds the hook.' }); return; }
    setHookBusy(true);
    setHookNote(null);
    try {
      const { generateHook } = await import('../../lib/studioApi.js');
      const r = await generateHook({ topic, spectrum: reelData.spectrum, lang: reelData.lang || 'en' });
      snapshotHook();
      handleReelChange('hook', r.hook);
      if (r.sub) handleReelChange('hookSub', r.sub);
      setHookNote({ ok: true, text: `Hook auto-filled via Haiku for “${topic}”.` });
    } catch (e) {
      setHookNote({ ok: false, text: e?.message === 'no_admin_session' ? 'Sign in to the Command Center first.' : 'Hook auto-gen failed — try again.' });
    } finally {
      setHookBusy(false);
    }
  }

  // FRONT 5 — generate (or cache-hit) the voiceover, then hand the URL to the
  // ReelPreviewEngine. studioApi is imported DYNAMICALLY so this component still
  // mounts in the supabase-less verification harness (the import only evaluates
  // supabaseClient on click, never at mount).
  // FRONT 6 — select a pre-rendered vault scenario → load its URL straight into the
  // reel audio (bypass the live generation edge function entirely; $0, instant).
  function handleVaultSelect(e) {
    const id = e.target.value;
    if (!id) return;
    const item = sovereignVaultManifest.find((x) => x.id === id);
    if (!item) return;
    applyVoiceUrl(item.url);
    handleReelChange('voTopic', item.subjectLine);
    setVoNote({ ok: true, text: `Loaded pre-rendered “${item.subjectLine}” from the vault — $0, zero-latency.` });
  }

  async function handleGenerateVoiceover() {
    const topic = (reelData.voTopic || '').trim();
    if (voBusy) return;
    if (!topic) { setVoNote({ ok: false, text: humanizeVoErr('missing_topic') }); return; }
    setVoBusy(true);
    setVoNote(null);
    try {
      const { generateStudioVoiceover } = await import('../../lib/studioApi.js');
      const r = await generateStudioVoiceover({
        topic,
        targetDuration: reelData.targetDuration,
        series: reelData.series,
        vibe: reelData.vibe,
        lang: reelData.lang || 'en',
      });
      applyVoiceUrl(r.url); // → ReelPreviewEngine <audio>
      setVoNote({ ok: true, text: r.cached ? 'Loaded from vault — cache hit, $0 spend.' : 'Generated & cached to the vault.' });
    } catch (e) {
      setVoNote({ ok: false, text: humanizeVoErr(e?.message) });
    } finally {
      setVoBusy(false);
    }
  }

  return (
    <>
      {/* ── BLANKET FACELIFT: the single-column panel is now four collapsible
          semantic sections. Every control survives verbatim — regrouped, never
          removed. All sections default open (collapse on demand). ── */}
      <CtlSection icon="📂" label="MEDIA & OVERLAYS">
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎬 Reel Footage (MP4 / MOV)</label>
        <label className="upload-btn-v4" htmlFor="reel-video-input">UPLOAD VIDEO</label>
        <input
          id="reel-video-input"
          type="file"
          accept="video/*"
          ref={videoInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              // Revoke the previous blob URL before minting a new one — otherwise
              // each re-upload leaks the old object URL (house pattern, §SovereignStudio).
              if (reelData.videoFile?.url) URL.revokeObjectURL(reelData.videoFile.url);
              const url = URL.createObjectURL(file);
              handleReelChange('videoFile', { file, url });
            }
          }}
          style={{ display: 'none' }}
        />
        <div className="hint-v4">Loads moving footage behind the overlay. Video wins over image when both are set.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">📱 Phone Backdrop</label>
        <div className="seg-v4" data-testid="reel-phone-backdrop">
          <button type="button" className={!reelData.phoneBackdrop ? 'active' : ''} onClick={() => handleReelChange('phoneBackdrop', false)}>OFF</button>
          <button type="button" className={reelData.phoneBackdrop ? 'active' : ''} onClick={() => handleReelChange('phoneBackdrop', true)}>ON</button>
        </div>
        <div className="hint-v4">Plays the footage INSIDE a phone mock-up instead of full-bleed — same frame as the Phone tab, so you can show a live demo of the app on screen.</div>
        {reelData.phoneBackdrop && (
          <select
            value={reelData.phoneFrame || 'sleek'}
            onChange={(e) => handleReelChange('phoneFrame', e.target.value)}
            className="select-v4"
            data-testid="reel-phone-frame"
          >
            <option value="sleek">Sleek Modern</option>
            <option value="gold">Sovereign Gold</option>
            <option value="carbon">Matte Black Carbon</option>
          </select>
        )}
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Logo (optional corner badge)</label>
        <label className="upload-btn-v4" htmlFor="reel-logo-input">UPLOAD LOGO</label>
        <input
          id="reel-logo-input"
          type="file"
          accept="image/*"
          ref={logoInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (reelData.logoImage?.url) URL.revokeObjectURL(reelData.logoImage.url);
              const url = URL.createObjectURL(file);
              handleReelChange('logoImage', { file, url });
            }
          }}
          style={{ display: 'none' }}
        />
      </div>

      {/* ── Asset size handle — scales the corner logo badge live in the preview ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🔧 Logo Size — {Math.round((reelData.logoScale ?? 1) * 100)}%</label>
        <input
          type="range"
          className="range-v4"
          min="0.5"
          max="2"
          step="0.05"
          value={reelData.logoScale ?? 1}
          onChange={(e) => handleReelChange('logoScale', Number(e.target.value))}
          aria-label="Logo size"
          data-testid="reel-logo-size"
        />
        <div className="hint-v4">Scales the corner logo badge on the reel canvas (50%–200%).</div>
      </div>
      </CtlSection>

      <CtlSection icon="✍️" label="HOOK & TEXT ENGINE">
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">⚡ Hook Spectrum (themed)</label>
        <select value={reelData.spectrum} onChange={handleSpectrumChange} className="select-v4">
          <option value="">— all spectrums (shuffle) —</option>
          <option value="bioenergetics">Bioenergetics &amp; Fasting</option>
          <option value="solis">Solis-Transit Psychology</option>
          <option value="prehab">Biomechanical Pre-hab</option>
          <option value="shift">12-Hour Shift Adherence</option>
        </select>
        <div className="hint-v4"><b>SPIN A HOOK</b> pulls a headline + sub-line from this spectrum (or shuffles all).</div>
      </div>

      <div className="ctl-group-v4 hook-actions-v4">
        <button className="spin-btn-v4" onClick={() => pullHook(reelData.spectrum)}>
          🎰 SPIN A HOOK
        </button>
        <button className="haiku-btn-v4" onClick={handleAutoHook} disabled={hookBusy} title="Auto-write the hook + sub-line from the selected exercise via Claude Haiku">
          {hookBusy ? '…' : '✨ AUTO (HAIKU)'}
        </button>
      </div>
      {hookUndo && (
        <button type="button" className="ph-clear-v4" onClick={undoHook} data-testid="undo-hook">
          ↩ Undo — restore previous hook
        </button>
      )}
      {hookNote && (
        <div className="hint-v4" style={{ color: hookNote.ok ? 'var(--green, #4ade80)' : '#fb923c', marginTop: -8 }}>{hookNote.text}</div>
      )}

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Hook Headline</label>
        <textarea
          value={reelData.hook}
          onChange={(e) => handleReelChange('hook', e.target.value)}
          className="textarea-v4"
          placeholder="The hook that drives the reel"
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Hook Font</label>
        <div className="seg-v4" data-testid="reel-hook-font">
          {HOOK_FONTS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={(reelData.hookFont || 'bebas') === id ? 'active' : ''}
              onClick={() => handleReelChange('hookFont', id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🔧 Hook Size — {reelData.hookFontSize ?? 138}px</label>
        <input
          type="range"
          className="range-v4"
          min="50"
          max="180"
          step="2"
          value={reelData.hookFontSize ?? 138}
          onChange={(e) => handleReelChange('hookFontSize', Number(e.target.value))}
          aria-label="Hook headline size"
          data-testid="reel-hook-size"
        />
        <div className="hint-v4">Shrink it for a longer, more descriptive hook; go bigger for a punchy one-liner.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Hook Sub-line</label>
        <textarea
          value={reelData.hookSub}
          onChange={(e) => handleReelChange('hookSub', e.target.value)}
          className="textarea-v4"
          placeholder="The supporting beat"
        />
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Watch Button Text</label>
        <input
          type="text"
          value={reelData.watchText ?? 'WATCH'}
          onChange={(e) => handleReelChange('watchText', e.target.value)}
          className="input-v4"
          placeholder="WATCH"
          data-testid="reel-watch-text"
        />
        <div className="hint-v4">The ▶ chip label under the hook — only shows once a hook is set.</div>
      </div>

      {/* ── Overlay text layout toggle — where the hook block sits on the canvas ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Overlay Text Layout</label>
        <div className="seg-v4" data-testid="reel-text-layout">
          {[['bottom', 'BOTTOM'], ['center', 'CENTER'], ['top', 'TOP']].map(([val, label]) => (
            <button
              key={val}
              type="button"
              className={(reelData.textLayout || 'bottom') === val ? 'active' : ''}
              onClick={() => handleReelChange('textLayout', val)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hint-v4">Anchors the hook + sub-line block on the reel canvas.</div>
      </div>

      {/* ── Kinetic Text Animation — caption_animation_style. Executes live in the
          #video-preview stage (keyframes: sovereignStudioV4.css §Kinetic Text). ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">✨ Caption Animation</label>
        <div className="seg-v4" data-testid="reel-caption-animation">
          {CAPTION_ANIMATIONS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={(reelData.caption_animation_style || 'static') === id ? 'active' : ''}
              onClick={() => handleReelChange('caption_animation_style', id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hint-v4">Kinetic motion for the hook overlay — Word-by-Word Pop, Impact Shoot-In, or Fade-Glide. Replays live in the preview on every change.</div>
      </div>
      </CtlSection>

      <CtlSection icon="🔊" label="AUDIO MIX CONSOLE">
      {/* ── FRONT 5 · SOVEREIGN VOICEOVER (lazy-cached) ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎙 Sovereign Voiceover — Akeem clone</label>
        <ExerciseCombobox
          value={reelData.voTopic}
          onChange={(v) => handleReelChange('voTopic', v)}
          groups={EXERCISE_GROUPS}
          placeholder="Select an exercise from the vault, or type a new one…"
        />
        <div className="hint-v4">
          <b>{CACHED_COUNT}</b> exercises pre-cached across {EXERCISE_GROUPS.length} categories (zero-cost instant load). Pick one, or type a new topic to generate &amp; cache it.
        </div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🌐 Language</label>
        <div className="seg-v4">
          {LANGS.map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={reelData.lang === code ? 'active' : ''}
              onClick={() => handleReelChange('lang', code)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="hint-v4">Drives which language the Claude script + ElevenLabs voice are generated in (sports video library).</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Voice Character</label>
        <select
          value={reelData.vibe}
          onChange={(e) => handleReelChange('vibe', e.target.value)}
          className="select-v4"
        >
          {VOICES.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Target Duration</label>
        <select
          value={reelData.targetDuration}
          onChange={(e) => handleReelChange('targetDuration', Number(e.target.value))}
          className="select-v4"
        >
          {DURATIONS.map(([secs, label]) => (
            <option key={secs} value={secs}>{label}</option>
          ))}
        </select>
        <div className="hint-v4">Script length is derived server-side at ~2.5 words/sec.</div>
      </div>

      <div className="ctl-group-v4">
        <button className="export-btn-v4" onClick={handleGenerateVoiceover} disabled={voBusy}>
          {voBusy ? '… GENERATING' : '🎙 GENERATE VOICEOVER'}
        </button>
        {voNote && (
          <div className="hint-v4" style={{ color: voNote.ok ? 'var(--green, #4ade80)' : '#fb923c' }}>
            {voNote.text}
          </div>
        )}
      </div>

      {sovereignVaultManifest.length > 0 && (
        <div className="ctl-group-v4">
          <label className="ctl-label-v4">📼 Pre-Rendered Vault ($0 · instant)</label>
          <select className="select-v4" defaultValue="" onChange={handleVaultSelect} data-testid="reel-vault-select">
            <option value="">— pick a pre-rendered scenario —</option>
            {Object.entries(VAULT_BY_CATEGORY).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>
                {items.map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.subjectLine}{it.scenario ? ` — ${it.scenario}` : ''}{it.duration ? ` (${it.duration})` : ''}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="hint-v4">Loads a pre-rendered MP3 straight into the reel audio — no generation, no spend.</div>
        </div>
      )}

      {/* ── Upload Voiceover — bring your OWN voice track onto the voice channel
          (voUrl), the same channel Generate and the Vault feed. For when the AI
          clone reads a line awkwardly: render it in ElevenLabs or the Sovereign
          Studio, download the MP3, and drop it here. It drives the reel length and
          ducks the music + clip under it, and bakes into the exported MP4 via the
          SAME voUrl → _decodeVo path the generated voice uses. ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">⬆ Upload Voiceover (MP3 / WAV / M4A)</label>
        <label className="upload-btn-v4" htmlFor="reel-vo-upload-input">UPLOAD VOICEOVER</label>
        <input
          id="reel-vo-upload-input"
          type="file"
          accept="audio/*"
          data-testid="reel-vo-upload-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            // Stash the bytes in IndexedDB (durable across reloads) BEFORE minting the
            // session blob URL — best-effort: if the store is unavailable the upload
            // still works for this session, it just won't survive a reload.
            putAsset(VO_ASSET_KEY, file, { name: file.name }).catch(() => {});
            const url = URL.createObjectURL(file);
            applyVoiceUrl(url, { owned: true, uploadName: file.name });
            setVoNote({ ok: true, text: `Loaded your voiceover “${file.name}” — it rides the voice channel; balance it with the Voice Volume slider. Saved for this device — it survives a reload.` });
            e.target.value = ''; // let the same file be re-selected after a remove
          }}
          style={{ display: 'none' }}
        />
        {voUploadName && (
          <button
            type="button"
            className="ph-clear-v4"
            data-testid="reel-vo-upload-clear"
            onClick={() => applyVoiceUrl(null, { owned: false, uploadName: null })}
          >
            ✕ Remove “{voUploadName}”
          </button>
        )}
        <div className="hint-v4">Bring your own voice — an ElevenLabs export, a Sovereign Studio render, any MP3/WAV. Takes the voice channel (drives the reel length, ducks the music &amp; clip under it) and bakes into the export. Replaces a generated / vault voiceover.</div>
      </div>

      {/* ── Custom Music upload — drops your own track into the reel audio (baked into
          the exported MP4 via the same voUrl path the voiceover uses). Accepts VIDEO
          files too: on mobile that opens the SAME gallery picker as the footage
          upload, and we ride the clip's soundtrack — the preview <audio> element
          plays a video container's audio track, and the export's _decodeVo
          (decodeAudioData) demuxes audio out of any container. ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎵 Custom Music / Audio (MP3 / WAV / video sound)</label>
        <label className="upload-btn-v4" htmlFor="reel-music-input">UPLOAD MUSIC</label>
        <input
          id="reel-music-input"
          type="file"
          accept="audio/*,video/*"
          data-testid="reel-music-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (reelData.musicFile?.url) URL.revokeObjectURL(reelData.musicFile.url);
            const url = URL.createObjectURL(file);
            // Dedicated MUSIC track — no longer clobbers the voiceover (voUrl), so the
            // AI voice and the backing track are independent channels with their own
            // volume sliders below.
            handleReelChange('musicFile', { file, url });
            const isVideo = String(file.type || '').startsWith('video');
            setVoNote({
              ok: true,
              text: isVideo
                ? `Pulled the soundtrack from “${file.name}” — the video's own audio now rides the music channel.`
                : `Loaded custom track “${file.name}” — balance it against the voice with the mix sliders.`,
            });
          }}
          style={{ display: 'none' }}
        />
        {reelData.musicFile?.url && (
          <button
            type="button"
            className="ph-clear-v4"
            onClick={() => {
              if (reelData.musicFile?.url) URL.revokeObjectURL(reelData.musicFile.url);
              handleReelChange('musicFile', null);
            }}
          >
            ✕ Remove custom track
          </button>
        )}
        <div className="hint-v4">Your own backing track — an audio file, or pick a VIDEO (same gallery as the footage upload) and its sound becomes the music. Plays under the voiceover; bakes into the export when no voiceover is set.</div>
      </div>

      {/* ── Audio Mix — TWO independent channels (0–100% each), bound live to the reel
          preview's dedicated audio elements so the AI voice and the backing track
          balance exactly. ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎚 Music Volume — {reelData.musicVolume ?? 80}%</label>
        <input
          type="range"
          className="range-v4"
          min="0"
          max="100"
          step="1"
          value={reelData.musicVolume ?? 80}
          onChange={(e) => handleReelChange('musicVolume', Number(e.target.value))}
          aria-label="Music volume"
          data-testid="reel-music-volume"
        />
        <div className="hint-v4">The backing-track channel — 0% mutes it, 100% is full volume.</div>
      </div>

      {/* Clip Volume — the uploaded footage's OWN baked-in sound (e.g. music
          already inside the video). A dedicated channel so a too-loud prebaked
          track can be pulled down under the voiceover — or pushed up to feature
          it — without re-editing the source clip. Ducks under the voice like the
          music channel; 0% mutes the clip's audio in both preview and export. */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎬 Clip Volume — {reelData.footageVolume ?? 100}%</label>
        <input
          type="range"
          className="range-v4"
          min="0"
          max="100"
          step="1"
          value={reelData.footageVolume ?? 100}
          onChange={(e) => handleReelChange('footageVolume', Number(e.target.value))}
          aria-label="Clip volume"
          data-testid="reel-footage-volume"
        />
        <div className="hint-v4">The uploaded video's own sound (music/audio baked into the clip). Turn it down so it sits under the voiceover, or up to feature it — 0% mutes it.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎙 Voice Volume — {reelData.voiceVolume ?? 100}%</label>
        <input
          type="range"
          className="range-v4"
          min="0"
          max="100"
          step="1"
          value={reelData.voiceVolume ?? 100}
          onChange={(e) => handleReelChange('voiceVolume', Number(e.target.value))}
          aria-label="Voice volume"
          data-testid="reel-voice-volume"
        />
        <div className="hint-v4">The voiceover channel — balance the AI voice against the music so neither overpowers.</div>
      </div>
      </CtlSection>

      <CtlSection icon="🎨" label="CANVAS & REEL STYLING">
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎨 Overlay Style</label>
        <select
          value={reelData.overlayStyle}
          onChange={(e) => handleReelChange('overlayStyle', e.target.value)}
          className="select-v4"
        >
          <option value="scrim">Classic Scrim (default)</option>
          <option value="cinematic">Cinematic Bars</option>
          <option value="minimal">Minimal</option>
          <option value="lowerthird">Lower-Third Card</option>
          <option value="frame">Gold Frame</option>
        </select>
        <div className="hint-v4">Branded text/overlay skin — applies live to the cover preview.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Series Tag</label>
        <select
          value={reelData.series}
          onChange={(e) => handleReelChange('series', e.target.value)}
          className="select-v4"
        >
          {SERIES.map(([value, label]) => (
            <option key={value || 'none'} value={value}>{label}</option>
          ))}
        </select>
      </div>
      </CtlSection>
    </>
  );
}
