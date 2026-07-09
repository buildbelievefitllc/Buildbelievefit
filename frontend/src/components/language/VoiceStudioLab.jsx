// src/components/language/VoiceStudioLab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// COACH AKEEM'S VOICE STUDIO & AUDIO LAB — the legacy language module, fused
// whole into the unified Language Lab (structural merge · value preservation).
//
// NON-DESTRUCTIVE BY DESIGN: this wrapper mounts the COMPLETE AdminLanguageRoadmap
// — the Pimsleur Audio Lab, Voice Studio (on-device speech evaluator), the Vocab
// Gym soundboard games (Speed Matrix · Flip Drill · Listening Lab · Match Madness
// · Sentence Builder), every 🔊 SpeakBtn wired to Coach Akeem's pre-baked
// ElevenLabs voice clips (speakBaked → languageSoundboardVoice), the coaching
// scripts, Rio Ready survival kit, God-Mode drills, intentions, and the 90-day
// roadmap — with ZERO code, asset, or configuration removed from the legacy
// component. The Language Lab is now the sole navigation portal; the standalone
// /command/language tab is hidden (house declutter pattern — the component and
// every audio asset stay fully intact, restorable by uncommenting its nav entry).

import AdminLanguageRoadmap from '../command/AdminLanguageRoadmap.jsx';
import './language.css';

export default function VoiceStudioLab() {
  return (
    <section className="vs-shell" data-testid="voice-studio-lab">
      <span className="lm-kicker">Audio Lab Fusion · Legacy Systems Preserved</span>
      <h3 className="lm-title">Coach Akeem&rsquo;s Voice Studio &amp; Audio Lab</h3>
      <p className="vs-sub">
        The complete legacy protocol — Pimsleur Audio Lab, Voice Studio, the Vocab Gym
        soundboards, and every Coach-Akeem-voiced 🔊 clip — housed under the unified hub.
      </p>
      <AdminLanguageRoadmap />
    </section>
  );
}
