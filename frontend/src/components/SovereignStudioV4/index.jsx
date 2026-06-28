// src/components/SovereignStudioV4/index.jsx
// Master container for Sovereign Studio V4 — fresh native React rebuild
// Uses v3 strictly as a visual & functional reference, not code translation

import { useState } from 'react';
import StudioLayout from './StudioLayout';
import './sovereignStudioV4.css';

const CATALOG = {
  capable: [
    ['BBF • CAPABLE', 'YOU\'RE MORE\nDIFFICULT TO\nSCALE THAN\n*ANY WEIGHT.*', 'Your ceiling is the only limit you\'ve hit.\n**Push it.**', 'PUSH IT'],
    ['BBF • CAPABLE', 'STRONG PEOPLE\nDON\'T HAVE THE\nDESIRE TO QUIT.\nTHEY HAVE THE\n*CHOICE.*', 'And they choose again.\n**Make the choice.**', 'CHOOSE AGAIN'],
  ],
  fence: [
    ['BBF • FENCE', 'FEAR IS JUST\n*DATA*\nWAITING FOR\nCOUNTER-DATA.', 'The only way off the fence is through.\n**Move through it.**', 'MOVE THROUGH'],
  ],
  comeback: [
    ['BBF • COMEBACK', 'YOUR LAST ATTEMPT\nWAS THE DRESS\nREHEARSAL. THIS\nONE\'S THE\n*SHOW.*', 'Everything you learned goes forward.\n**Take the stage.**', 'TAKE THE STAGE'],
  ],
};

export default function SovereignStudioV4() {
  const [mode, setMode] = useState('cta');
  const [ctaData, setCtaData] = useState({
    lane: 'all',
    format: 'feed',
    palette: 'default',
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
    backgroundImage: null,
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
  });

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
    const lanes = Object.keys(CATALOG);
    const randomLane = lanes[Math.floor(Math.random() * lanes.length)];
    const cards = CATALOG[randomLane];
    const randomCard = cards[Math.floor(Math.random() * cards.length)];
    const [eyebrow, headline, body, buttonText] = randomCard;

    handleCtaChange('eyebrow', eyebrow);
    handleCtaChange('headline', headline);
    handleCtaChange('body', body);
    handleCtaChange('buttonText', buttonText);
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
        <div className="mode-tabs-v4">
          <button
            className={`mode-tab-v4 ${mode === 'cta' ? 'active' : ''}`}
            onClick={() => handleModeChange('cta')}
          >
            🃏 CTA CARDS
          </button>
          <button
            className={`mode-tab-v4 ${mode === 'phone' ? 'active' : ''}`}
            onClick={() => handleModeChange('phone')}
          >
            📱 PHONE
          </button>
          <button
            className={`mode-tab-v4 ${mode === 'reel' ? 'active' : ''}`}
            onClick={() => handleModeChange('reel')}
          >
            🎬 VIDEO ENGINE
          </button>
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
