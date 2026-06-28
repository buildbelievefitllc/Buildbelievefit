// src/components/SovereignStudioV4/VibeSelector.jsx
// Reel controls: hook spectrum, series, vibes, colors

import { useState, useRef } from 'react';

const HOOKS = {
  bioenergetics: [
    { hook: 'BIOENERGETICS RULE YOUR CLOCK', sub: 'Not motivation. Mitochondrial capacity.' },
    { hook: 'SLEEP ISN\'T LOST TIME', sub: 'It\'s when the adaptations happen.' },
  ],
  solis: [
    { hook: 'THE SUN IS YOUR COACH', sub: 'Align with it. Everything changes.' },
    { hook: 'DARKNESS ISN\'T PUNISHMENT', sub: 'It\'s the recovery window.' },
  ],
  prehab: [
    { hook: 'PAIN IS INFORMATION, NOT DAMAGE', sub: 'Move smarter, not less.' },
    { hook: 'PREVENTION COMPOUNDS', sub: 'One prehab session compounds for years.' },
  ],
};

const VIBES = [
  { id: 'the_architect', label: 'The Architect', desc: 'Resonant storytelling' },
  { id: 'the_mechanic', label: 'The Mechanic', desc: 'Sharp, technical' },
  { id: 'real_talk', label: 'Real Talk', desc: 'Conversational' },
  { id: 'the_sanctuary', label: 'The Sanctuary', desc: 'Deep, slow' },
  { id: 'the_reframe', label: 'The Reframe', desc: 'Perspective shift' },
];

export default function VibeSelector({ reelData, handleReelChange }) {
  const [selectedVibe, setSelectedVibe] = useState('the_architect');
  const videoInputRef = useRef(null);
  const logoInputRef = useRef(null);

  const handleSpectrumChange = (e) => {
    const spectrum = e.target.value;
    handleReelChange('spectrum', spectrum);

    if (spectrum && HOOKS[spectrum]) {
      const randomHook = HOOKS[spectrum][Math.floor(Math.random() * HOOKS[spectrum].length)];
      handleReelChange('hook', randomHook.hook);
      handleReelChange('hookSub', randomHook.sub);
    }
  };

  const spinHook = () => {
    if (reelData.spectrum && HOOKS[reelData.spectrum]) {
      const randomHook = HOOKS[reelData.spectrum][Math.floor(Math.random() * HOOKS[reelData.spectrum].length)];
      handleReelChange('hook', randomHook.hook);
      handleReelChange('hookSub', randomHook.sub);
    }
  };

  return (
    <>
      <div className="ctl-group-v4">
        <label className="ctl-label-v4">⚡ Hook Spectrum (themed)</label>
        <select
          value={reelData.spectrum}
          onChange={handleSpectrumChange}
          className="select-v4"
        >
          <option value="">— all spectrums (shuffle) —</option>
          <option value="bioenergetics">Bioenergetics & Fasting</option>
          <option value="solis">Solis-Transit Psychology</option>
          <option value="prehab">Biomechanical Pre-hab</option>
        </select>
        <div className="hint-v4"><b>SPIN A HOOK</b> pulls a headline + sub-line from this spectrum.</div>
      </div>

      <div className="ctl-group-v4">
        <button className="spin-btn-v4" onClick={spinHook}>
          🎰 SPIN A HOOK
        </button>
      </div>

      <div className="divider-v4"></div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">🎙 Vibe Character</label>
        <select
          value={selectedVibe}
          onChange={(e) => setSelectedVibe(e.target.value)}
          className="select-v4"
        >
          {VIBES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label} — {v.desc}
            </option>
          ))}
        </select>
      </div>

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
        <label className="upload-btn-v4" htmlFor="reel-video-input">
          UPLOAD VIDEO
        </label>
        <input
          id="reel-video-input"
          type="file"
          accept="video/*"
          ref={videoInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
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
        <label className="upload-btn-v4" htmlFor="reel-logo-input">
          UPLOAD LOGO
        </label>
        <input
          id="reel-logo-input"
          type="file"
          accept="image/*"
          ref={logoInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
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
        <div className="hint-v4">Branded text/overlay skin — applies to the cover and exported video.</div>
      </div>

      <div className="ctl-group-v4">
        <label className="ctl-label-v4">Series Tag</label>
        <select
          value={reelData.series}
          onChange={(e) => handleReelChange('series', e.target.value)}
          className="select-v4"
        >
          <option value="">— series database —</option>
          <option value="form-fix">FORM FIX</option>
          <option value="mindset">MINDSET PROTOCOL</option>
          <option value="metabolic">METABOLIC WINDOW</option>
          <option value="12hour">12-HOUR SURVIVAL</option>
          <option value="sovereign">SOVEREIGN SUNDAY</option>
          <option value="fuel">FUEL FILES</option>
          <option value="lab">THE LAB</option>
        </select>
      </div>

      <div className="ctl-group-v4">
        <button className="export-btn-v4">🎬 EXPORT VIDEO</button>
      </div>
    </>
  );
}
