// src/components/SovereignStudioV4/VibeSelector.jsx
// Reel inputs: hook spectrum + spin, footage/logo upload, overlay skin, series tag.
// (The v3 ElevenLabs voiceover subsystem — script box, vibe→TTS, music bed — is
// out of scope for this UI rebuild, so the orphaned "Vibe Character" control was
// removed rather than left as a dead input.)

import { useRef } from 'react';

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
