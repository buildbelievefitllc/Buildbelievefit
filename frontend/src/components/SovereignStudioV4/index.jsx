// src/components/SovereignStudioV4/index.jsx
// Master container for Sovereign Studio V4 — fresh native React rebuild
// Uses v3 strictly as a visual & functional reference, not code translation

import { useState, useEffect, useRef } from 'react';
import StudioLayout from './StudioLayout';
import './sovereignStudioV4.css';

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
  const [ctaData, setCtaData] = useState({
    lane: 'all',
    format: 'feed',
    eyebrow: 'BUILD BELIEVE FIT • THE WHY',
    headline: 'STOP WAITING\nFOR A SIGN.\n*THIS IS IT.*',
    body: 'No pressure. No judgment. Just a conversation.\n**DM me "PATHFINDER" and let\'s talk.**',
    buttonText: 'DM PATHFINDER',
    primaryColor: '#f5c800',
    secondaryColor: '#6a0dad',
  });

  const [phoneData, setPhoneData] = useState({
    layout: 'single',
    frame: 'sleek',
    eyebrow: 'NUTRITION  •  ADAPTIVE FASTING',
    headline: 'FUEL ON\nYOUR CLOCK',
    benefit: 'Six fasting protocols, a live eating window, and your macros tracked in real time.',
    backgroundImage: null,   // front-phone screenshot (single / dual / trio)
    backgroundImage2: null,  // 2nd-phone screenshot (dual back phone / trio left phone)
    backgroundImage3: null,  // 3rd-phone screenshot (trio right phone)
  });

  const [reelData, setReelData] = useState({
    spectrum: '',
    hook: '',
    hookSub: '',
    overlayStyle: 'scrim',
    series: '',
    backgroundColor: '#08060a',
    logoImage: null,
    videoFile: null,
    musicFile: null,        // custom music upload → the dedicated MUSIC track element
    textLayout: 'bottom',   // overlay text placement toggle (bottom | center | top)
    hookFont: 'bebas',      // hook headline typeface (bebas | anton | barlow)
    hookFontSize: 138,      // hook headline size in px, 1080-design space (matches the old fixed CSS default)
    logoScale: 1,           // asset size handle — scales the corner logo badge
    musicVolume: 80,        // music-track mix (0–100%) → ReelPreviewEngine music element
    voiceVolume: 100,       // voice-track mix (0–100%) → ReelPreviewEngine voiceover element
    // FRONT 5 · Sovereign Voiceover (lazy-cached bbf-studio-voiceover)
    voTopic: '',            // Exercise / topic that keys the cache
    vibe: 'the_architect',  // voice character → script tone + ElevenLabs physics
    targetDuration: 30,     // seconds: 15 Hook / 30 Breakdown / 60 Masterclass
    lang: 'en',             // payload lang (en/es/pt) — defaults EN
    voUrl: null,            // returned Supabase Storage public URL → ReelPreviewEngine
  });

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
    };
  }, [reelData.videoFile?.url, reelData.logoImage?.url, reelData.musicFile?.url, phoneData.backgroundImage?.url, phoneData.backgroundImage2?.url, phoneData.backgroundImage3?.url]);
  useEffect(() => () => {
    const { video, logo, phone, phone2, phone3, music } = blobUrlsRef.current;
    if (video) URL.revokeObjectURL(video);
    if (logo) URL.revokeObjectURL(logo);
    if (phone) URL.revokeObjectURL(phone);
    if (phone2) URL.revokeObjectURL(phone2);
    if (phone3) URL.revokeObjectURL(phone3);
    if (music) URL.revokeObjectURL(music);
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

  const spinCard = () => {
    // Honor the selected lane; "all" (or an empty lane) shuffles the whole catalog.
    const selected = ctaData.lane;
    const pool = selected && selected !== 'all' && CATALOG[selected]
      ? CATALOG[selected]
      : Object.values(CATALOG).flat();
    if (!pool.length) return;
    const [eyebrow, headline, body, buttonText] = pool[Math.floor(Math.random() * pool.length)];
    // One atomic update — replaces all four fields together (no reliance on
    // functional-updater accumulation across separate calls).
    setCtaData(prev => ({ ...prev, eyebrow, headline, body, buttonText }));
  };

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
            ['reel', '🎬 VIDEO ENGINE'],
            ['queue', '📡 QUEUE'],
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

      <StudioLayout
        mode={mode}
        ctaData={ctaData}
        handleCtaChange={handleCtaChange}
        spinCard={spinCard}
        phoneData={phoneData}
        handlePhoneChange={handlePhoneChange}
        reelData={reelData}
        handleReelChange={handleReelChange}
      />
    </div>
  );
}
