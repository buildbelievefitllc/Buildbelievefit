// src/components/sportshub/YouthGameplan.jsx
// ─────────────────────────────────────────────────────────────────────────────
// PHASE 1 · THE GAMEPLAN ANCHOR — the youth Sports Hub's guided-sequence opener,
// rendered at the TOP of the Check-In tab (the first thing the athlete sees, before
// they log their sleep). The youth twin of the adult SovereignSequenceAnchor.
//
// Audio: Coach Akeem's EXACT youth pep-talk, spoken VERBATIM via the shared
// bbf-biokinetic-briefing `sequence` context (floor-coach delivery, cached by
// cueRef). The 'mindset' feature behind that context includes the YOUTH band, so a
// youth athlete is entitled. The script is one fixed English VO (locale 'en'); the
// trilingual TEXT SHIELD below carries the EN/ES/PT read-along (CLAUDE.md §1).

import { useLang } from '../../context/LangContext.jsx';
import CoachAudioButton from '../vault/CoachAudioButton.jsx';
import { fetchCachedSectionCoachAudio } from '../../lib/forecastApi.js';
import './youthSequence.css';

// Coach Akeem's EXACT words (CEO-authored) — do not paraphrase. Spoken full-length
// and verbatim by the `sequence` voice context.
export const YOUTH_GAMEPLAN_SCRIPT = `Listen up. If you want to play at the next level, you gotta treat your body like a pro. We don't just jump on the court and go. We prep the engine first. If your watch synced, you're good. If not, log your sleep. Then we wake up the joints, hit the drills, and cool down. This is how you protect your armor, stay off the bench, and stay in the game. Hit Check-In and let's go.`;

// Trilingual UI chrome + the API text shield (the 4-step daily gameplan).
const STR = {
  en: {
    kicker: 'The Gameplan',
    head: ['Treat your body like a ', 'pro'],
    listen: 'Listen: The Gameplan',
    shieldTitle: 'Your Daily Gameplan',
    steps: [
      ['Fuel Check (Check-In)', 'Log your sleep and mood to set today’s limits.'],
      ['Armor Prep (Recovery)', 'Wake up your joints so you don’t get injured.'],
      ['The Work (Drills)', 'Today’s training.'],
      ['Post-Game (Cool Down)', 'Flush the system and report any pain.'],
    ],
  },
  es: {
    kicker: 'El Plan de Juego',
    head: ['Trata tu cuerpo como un ', 'pro'],
    listen: 'Escucha: El Plan de Juego',
    shieldTitle: 'Tu Plan de Juego de Hoy',
    steps: [
      ['Chequeo de Combustible (Check-In)', 'Registra tu sueño y ánimo para fijar tus límites de hoy.'],
      ['Preparar la Armadura (Recuperación)', 'Despierta tus articulaciones para no lesionarte.'],
      ['El Trabajo (Práctica)', 'El entrenamiento de hoy.'],
      ['Post-Juego (Enfriamiento)', 'Limpia el sistema y reporta cualquier dolor.'],
    ],
  },
  pt: {
    kicker: 'O Plano de Jogo',
    head: ['Trate seu corpo como um ', 'pro'],
    listen: 'Ouça: O Plano de Jogo',
    shieldTitle: 'Seu Plano de Jogo de Hoje',
    steps: [
      ['Checagem de Combustível (Check-In)', 'Registre seu sono e humor para definir seus limites de hoje.'],
      ['Preparar a Armadura (Recuperação)', 'Acorde suas articulações pra não se machucar.'],
      ['O Trabalho (Treino)', 'O treino de hoje.'],
      ['Pós-Jogo (Desaquecimento)', 'Limpe o sistema e relate qualquer dor.'],
    ],
  },
};

export default function YouthGameplan() {
  const { lang } = useLang();
  const s = STR[lang] || STR.en;

  return (
    <section className="yg" aria-label={s.shieldTitle} data-testid="youth-gameplan">
      <div className="yg-kicker">{s.kicker}</div>
      <h2 className="yg-head">{s.head[0]}<b>{s.head[1]}</b>.</h2>

      <CoachAudioButton
        idleLabel={s.listen}
        audioRequest={() => fetchCachedSectionCoachAudio({ context: 'sequence', cueRef: 'youth-gameplan-intro', cueText: YOUTH_GAMEPLAN_SCRIPT, locale: 'en' })}
        fallbackText={YOUTH_GAMEPLAN_SCRIPT}
      />

      {/* API text shield — read the gameplan without re-triggering the synth. */}
      <div className="yg-shield" data-testid="youth-gameplan-shield">
        <div className="yg-shield-title">{s.shieldTitle}</div>
        <ol className="yg-steps">
          {s.steps.map(([h, d], i) => (
            <li key={h} className="yg-step">
              <span className="yg-step-n" aria-hidden="true">{i + 1}</span>
              <span className="yg-step-tx"><span className="yg-step-h">{h}:</span> {d}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
