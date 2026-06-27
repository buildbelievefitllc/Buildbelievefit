// src/components/vault/SovereignSequence.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE SOVEREIGN SEQUENCE — a guided, button-driven hand-off across the ADULT
// Client Hub tabs: Hub → Check-In → Prep (Prehab) → Program → Cardio.
//
// Scope guard: every piece renders ONLY when a host passes the `onStep(tabId)`
// callback. ClientVault is the sole caller, so the sequence appears exclusively on
// the adult Vault — the Youth Sports Hub and the admin Command Center never pass
// it, so nothing leaks there (CEO constraint: adult-only). Brand-locked (§2).
//
// Audio: the CEO's exact anthem, spoken VERBATIM by Coach Akeem via the
// bbf-biokinetic-briefing `sequence` context (cached by cueRef). The clinical text
// card below is the API SHIELD — it lets the athlete re-read the protocol without
// re-triggering a synth.

import { useLang } from '../../context/LangContext.jsx';
import CoachAudioButton from './CoachAudioButton.jsx';
import { fetchCachedSectionCoachAudio } from '../../lib/forecastApi.js';
import './sovereignSequence.css';

// The CEO's anthem — spoken full-length and VERBATIM by the `sequence` voice
// context (Coach Akeem · floor-coach delivery, eleven_multilingual_v2). One voice,
// three languages: the chosen locale's script is what Akeem actually speaks, so the
// audio matches the UI language end-to-end. EN is the CEO's exact wording; ES/PT are
// rendered in the natural, colloquial coaching pocket (not literal translations).
const SEQUENCE_SCRIPT = {
  en: `Transformation isn't an accident. It is an engineered outcome. You are here to break the loop of whatever has been holding you back, and this sequence is the process of beginning that change. Think of this as the daily homework you do for yourself. We never touch the iron until we know exactly where your nervous system stands today. Whether your watch automatically synced or you manually log your sleep, the data drives the engine. It starts right here: We scan the baseline, we prime the tissues, we execute the load, and we flush the system with cardio. This isn't just about today's workout. It's about breaking your old patterns and building an unbreakable machine for the next decade. Hit the Check-In button below, and let's get to work.`,
  es: `La transformación no es un accidente. Es un resultado diseñado. Estás aquí para romper el ciclo de lo que sea que te ha estado frenando, y esta secuencia es el proceso para empezar ese cambio. Piensa en esto como la tarea diaria que haces para ti mismo. Nunca tocamos el hierro hasta saber exactamente cómo está tu sistema nervioso hoy. Ya sea que tu reloj se haya sincronizado solo o que registres tu sueño a mano, los datos mueven el motor. Empieza justo aquí: escaneamos la base, preparamos los tejidos, ejecutamos la carga y drenamos el sistema con cardio. Esto no se trata solo del entrenamiento de hoy. Se trata de romper tus viejos patrones y construir una máquina indestructible para la próxima década. Pulsa el botón de Check-In abajo, y manos a la obra.`,
  pt: `Transformação não é acidente. É um resultado projetado. Você está aqui para quebrar o ciclo de tudo o que vem te segurando, e essa sequência é o processo de começar essa mudança. Pensa nisso como a tarefa diária que você faz por você mesmo. A gente nunca toca no ferro antes de saber exatamente como o seu sistema nervoso está hoje. Seja com o relógio sincronizando sozinho ou você registrando o seu sono na mão, os dados movem o motor. Começa bem aqui: a gente escaneia a base, prepara os tecidos, executa a carga e drena o sistema com o cardio. Isso não é só sobre o treino de hoje. É sobre quebrar seus padrões antigos e construir uma máquina inquebrável para a próxima década. Aperta o botão de Check-In aí embaixo, e bora trabalhar.`,
};

// The API-shield card — four-step homework, localized via the svs-* DICT keys.
const STEP_KEYS = [
  ['1', 'svs-s1-h', 'svs-s1-d'],
  ['2', 'svs-s2-h', 'svs-s2-d'],
  ['3', 'svs-s3-h', 'svs-s3-d'],
  ['4', 'svs-s4-h', 'svs-s4-d'],
];

// Reusable large step CTA (Phases 1–4) — the locked gold transport with an arrow.
export function SequenceCTA({ label, onClick, testid, variant = 'primary' }) {
  return (
    <button type="button" className={`svs-cta${variant === 'secondary' ? ' svs-cta--secondary' : ''}`} onClick={onClick} data-testid={testid}>
      <span className="svs-cta-label">{label}</span>
    </button>
  );
}

// Bottom-of-tab next step (Phases 2–4) — a divider + the CTA so it reads as a
// deliberate hand-off at the foot of the surface.
export function SequenceNext({ label, onClick, testid }) {
  return (
    <div className="svs-next">
      <SequenceCTA label={label} onClick={onClick} testid={testid} />
    </div>
  );
}

// Phase 1 — the Hub anchor: anthem audio + clinical text shield + Step 1 CTA.
export function SovereignSequenceAnchor({ onStep }) {
  const { t, lang } = useLang();
  // ONE voice, three languages: speak the chosen locale's anthem so the audio
  // matches the on-screen language. cueRef stays constant — the server cache key
  // already folds in the locale, so EN/ES/PT each cache under their own entry.
  const script = SEQUENCE_SCRIPT[lang] || SEQUENCE_SCRIPT.en;
  return (
    <section className="svs" aria-label={t('svs-kicker')} data-testid="sovereign-sequence">
      <div className="svs-kicker">{t('svs-kicker')}</div>
      <h2 className="svs-head">{t('svs-head')}</h2>

      <CoachAudioButton
        idleLabel={t('svs-listen')}
        audioRequest={() => fetchCachedSectionCoachAudio({ context: 'sequence', cueRef: 'sovereign-sequence-intro', cueText: script, locale: lang })}
        fallbackText={script}
      />

      {/* API shield — read the protocol without re-triggering the audio synth. */}
      <div className="svs-card" data-testid="sovereign-sequence-shield">
        <div className="svs-card-title">{t('svs-card-title')}</div>
        <ol className="svs-steps">
          {STEP_KEYS.map(([n, hKey, dKey]) => (
            <li key={n} className="svs-step">
              <span className="svs-step-n" aria-hidden="true">{n}</span>
              <span className="svs-step-body">
                <span className="svs-step-h">{t(hKey)}:</span> <span className="svs-step-d">{t(dKey)}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <SequenceCTA label={t('svs-cta-1')} onClick={() => onStep('checkin')} testid="sovereign-step-1" />
    </section>
  );
}
