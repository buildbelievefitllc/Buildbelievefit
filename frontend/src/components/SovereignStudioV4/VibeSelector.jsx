// src/components/SovereignStudioV4/VibeSelector.jsx
// Reel inputs: hook spectrum + spin, footage/logo upload, overlay skin, series tag,
// and the FRONT 5 Sovereign Voiceover engine (lazy-cached bbf-studio-voiceover):
// pick a topic + voice character + target duration → Generate → the Edge Function
// returns a cached-or-fresh MP3 URL that loads into the ReelPreviewEngine.

import { useRef, useState } from 'react';
import ExerciseCombobox from './ExerciseCombobox';
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

// Vibe → native ElevenLabs baseline (0–100% UI scale). MUST mirror the Edge
// Function's VIBES map (stability + style per-vibe) and BASE_SETTINGS
// (similarity_boost 0.85, shared across all vibes today). Selecting a vibe snaps
// the Advanced Voice Tuning sliders to these; the user can then override any axis.
const VIBE_BASELINES = {
  the_mechanic:  { stability: 42, similarity: 85, style: 12 },
  real_talk:     { stability: 38, similarity: 85, style: 16 },
  the_sanctuary: { stability: 30, similarity: 85, style: 8 },
  the_reframe:   { stability: 35, similarity: 85, style: 28 },
  the_architect: { stability: 34, similarity: 85, style: 22 },
};
// resolveVibe() server-side defaults an unknown vibe to The Architect — mirror it.
const getVibeBaseline = (vibe) => VIBE_BASELINES[vibe] || VIBE_BASELINES.the_architect;
const vibeShortLabel = (vibe) => {
  const row = VOICES.find(([id]) => id === vibe);
  return row ? row[1].split('—')[0].trim() : 'preset';
};

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
const HOOK_FONTS = [
  ['bebas', 'BEBAS'],
  ['anton', 'ANTON'],
  ['barlow', 'CONDENSED'],
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
  const [hookBusy, setHookBusy] = useState(false);
  const [hookNote, setHookNote] = useState(null); // { ok: boolean, text: string }
  const [advOpen, setAdvOpen] = useState(false); // Advanced Voice Tuning panel

  // ── Advanced Voice Tuning: effective slider values + "modified" detection. Each
  // axis falls back to the current vibe's baseline until the user overrides it, so
  // an untouched panel exactly mirrors the preset (and sends NO overrides on
  // Generate → the Edge Function uses the vibe defaults + keeps the un-tuned cache).
  const vibeBase = getVibeBaseline(reelData.vibe);
  const voStability = reelData.voStability ?? vibeBase.stability;
  const voSimilarity = reelData.voSimilarity ?? vibeBase.similarity;
  const voStyle = reelData.voStyle ?? vibeBase.style;
  const voModified =
    voStability !== vibeBase.stability ||
    voSimilarity !== vibeBase.similarity ||
    voStyle !== vibeBase.style;

  // Selecting a Voice Character snaps all three sliders to that vibe's baseline,
  // wiping any prior manual override (spec: "automatically snap … to that vibe's
  // default baseline").
  const handleVibeChange = (e) => {
    const v = e.target.value;
    const b = getVibeBaseline(v);
    handleReelChange('vibe', v);
    handleReelChange('voStability', b.stability);
    handleReelChange('voSimilarity', b.similarity);
    handleReelChange('voStyle', b.style);
  };
  const resetVibeTuning = () => {
    const b = getVibeBaseline(reelData.vibe);
    handleReelChange('voStability', b.stability);
    handleReelChange('voSimilarity', b.similarity);
    handleReelChange('voStyle', b.style);
  };

  // Pull a random hook from the chosen spectrum, or across ALL spectrums when the
  // default "— all spectrums (shuffle) —" is selected (v3 parity — no dead button).
  const pullHook = (spectrum) => {
    const pool = spectrum && HOOKS[spectrum] ? HOOKS[spectrum] : Object.values(HOOKS).flat();
    if (!pool.length) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
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
    handleReelChange('voUrl', item.url);
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
        // Only forward overrides when the user has deviated from the preset — an
        // un-modified panel falls back to the vibe defaults server-side.
        ...(voModified
          ? { stability: voStability, similarityBoost: voSimilarity, style: voStyle }
          : {}),
      });
      handleReelChange('voUrl', r.url); // → ReelPreviewEngine <audio>
      const tuneNote = voModified ? ' (custom tuning applied)' : '';
      setVoNote({ ok: true, text: (r.cached ? 'Loaded from vault — cache hit, $0 spend.' : 'Generated & cached to the vault.') + tuneNote });
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
        <label className="ctl-label-v4">
          Voice Character
          {voModified && (
            <span className="vibe-mod-badge-v4" data-testid="reel-vibe-modified">MODIFIED PRESET</span>
          )}
        </label>
        <select
          value={reelData.vibe}
          onChange={handleVibeChange}
          className="select-v4"
        >
          {VOICES.map(([id, label]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </div>

      {/* ── ADVANCED VOICE TUNING — native ElevenLabs fine-tuning sliders. Snaps to
          the selected vibe's baseline; any manual slide overrides it (and flags the
          preset above as "Modified"). Mirrors the ElevenLabs dashboard's 3 axes. ── */}
      <div className="ctl-group-v4">
        <button
          type="button"
          className={`advtune-head-v4${advOpen ? ' is-open' : ''}`}
          aria-expanded={advOpen}
          onClick={() => setAdvOpen((v) => !v)}
          data-testid="reel-advtune-toggle"
        >
          <span className="advtune-ic-v4" aria-hidden="true">🎛</span>
          <span className="advtune-title-v4">Advanced Voice Tuning</span>
          {voModified && <span className="advtune-badge-v4">MODIFIED</span>}
          <span className="advtune-chev-v4" aria-hidden="true">{advOpen ? '▾' : '▸'}</span>
        </button>
        {advOpen && (
          <div className="advtune-body-v4" data-testid="reel-advtune-panel">
            <div className="hint-v4" style={{ marginTop: 2 }}>
              Native ElevenLabs physics. Picking a Voice Character snaps these to its baseline — slide any axis to override for this render.
            </div>

            <div className="advtune-slider-v4">
              <div className="advtune-slabel-v4">
                <span>Stability</span>
                <span className="advtune-val-v4">{voStability}%</span>
              </div>
              <input
                type="range"
                className="range-v4"
                min="0"
                max="100"
                step="1"
                value={voStability}
                onChange={(e) => handleReelChange('voStability', Number(e.target.value))}
                aria-label="Voice stability"
                data-testid="reel-vo-stability"
              />
              <div className="hint-v4">Vocal emotional variance &amp; natural pauses — lower is more expressive, higher is steadier.</div>
            </div>

            <div className="advtune-slider-v4">
              <div className="advtune-slabel-v4">
                <span>Clarity / Similarity Boost</span>
                <span className="advtune-val-v4">{voSimilarity}%</span>
              </div>
              <input
                type="range"
                className="range-v4"
                min="0"
                max="100"
                step="1"
                value={voSimilarity}
                onChange={(e) => handleReelChange('voSimilarity', Number(e.target.value))}
                aria-label="Clarity / similarity boost"
                data-testid="reel-vo-similarity"
              />
              <div className="hint-v4">How closely the engine matches the high-fidelity Akeem clone.</div>
            </div>

            <div className="advtune-slider-v4">
              <div className="advtune-slabel-v4">
                <span>Style Exaggeration</span>
                <span className="advtune-val-v4">{voStyle}%</span>
              </div>
              <input
                type="range"
                className="range-v4"
                min="0"
                max="100"
                step="1"
                value={voStyle}
                onChange={(e) => handleReelChange('voStyle', Number(e.target.value))}
                aria-label="Style exaggeration"
                data-testid="reel-vo-style"
              />
              <div className="hint-v4">Dramatic delivery scaling — higher pushes a more theatrical read.</div>
            </div>

            <button
              type="button"
              className="advtune-reset-v4"
              onClick={resetVibeTuning}
              disabled={!voModified}
              data-testid="reel-advtune-reset"
            >
              ↺ Reset to “{vibeShortLabel(reelData.vibe)}” baseline
            </button>
          </div>
        )}
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

      {/* ── Custom Music upload — drops your own track into the reel audio (baked into
          the exported MP4 via the same voUrl path the voiceover uses). ── */}
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎵 Custom Music / Audio (MP3 / WAV)</label>
        <label className="upload-btn-v4" htmlFor="reel-music-input">UPLOAD MUSIC</label>
        <input
          id="reel-music-input"
          type="file"
          accept="audio/*"
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
            setVoNote({ ok: true, text: `Loaded custom track “${file.name}” — balance it against the voice with the mix sliders.` });
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
        <div className="hint-v4">Your own backing track — plays under the voiceover; bakes into the export when no voiceover is set.</div>
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
