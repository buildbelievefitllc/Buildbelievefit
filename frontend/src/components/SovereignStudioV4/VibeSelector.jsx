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

  // FRONT 5 — generate (or cache-hit) the voiceover, then hand the URL to the
  // ReelPreviewEngine. studioApi is imported DYNAMICALLY so this component still
  // mounts in the supabase-less verification harness (the import only evaluates
  // supabaseClient on click, never at mount).
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
      handleReelChange('voUrl', r.url); // → ReelPreviewEngine <audio>
      setVoNote({ ok: true, text: r.cached ? 'Loaded from vault — cache hit, $0 spend.' : 'Generated & cached to the vault.' });
    } catch (e) {
      setVoNote({ ok: false, text: humanizeVoErr(e?.message) });
    } finally {
      setVoBusy(false);
    }
  }

  return (
    <>
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

      <div className="ctl-group-v4">
        <button className="spin-btn-v4" onClick={() => pullHook(reelData.spectrum)}>
          🎰 SPIN A HOOK
        </button>
      </div>

      <div className="divider-v4"></div>

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
        <label className="ctl-label-v4">Hook Sub-line</label>
        <textarea
          value={reelData.hookSub}
          onChange={(e) => handleReelChange('hookSub', e.target.value)}
          className="textarea-v4"
          placeholder="The supporting beat"
        />
      </div>

      <div className="divider-v4"></div>

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

      <div className="divider-v4"></div>

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

      <div className="ctl-group-v4">
        <button className="export-btn-v4" disabled title="Video render (MediaRecorder) ships in V4.1">
          🎬 EXPORT VIDEO · SOON
        </button>
        <div className="hint-v4">Cover composition is live above. Baked video export (footage + overlay) lands in V4.1.</div>
      </div>
    </>
  );
}
