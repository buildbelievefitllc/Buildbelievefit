// src/components/vault/GeneratorVoiceBox.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Akeem voice orientation box for the Vault Roster Engine.
//
// Three context-aware scripts — one fires based on who's looking and what
// state their token is in:
//
//   unlimited  → admin / CEO authoring mode, no limit mentioned
//   available  → standard client, monthly token still available: full
//                orientation + what the 8 params are + access confirmed +
//                limit stated + WHY the limit exists (program consistency)
//   spent      → standard client, token already used this month: reinforce
//                the commitment message, route them to their saved program
//
// Delivery: browser-native TTS via speechFallback.js. Zero API cost, no MP3
// pre-bake required. Same fallback mechanism the rest of the platform uses
// when ElevenLabs clips aren't baked yet. Trilingual (EN / ES / PT).
// Visual shell re-uses the locked .cvn class system (coachVoiceNote.css).

import { useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { speakWithBrowser, warmUpSpeech, browserSpeechSupported } from '../../lib/speechFallback.js';

// Three scripts × three languages. Plain prose — the browser TTS reads them
// as-is. Kept here (not in a shared file) because this copy is specific to
// this surface and is not reused anywhere.
const SCRIPTS = {
  en: {
    unlimited: {
      title: 'Vault Roster Engine — Authoring Mode',
      topic: 'Unlimited access · Signature chamber splits · Roster push',
      text: "Vault Roster Engine — authoring mode. You have unlimited access. Design blueprints, activate any of the three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — reshuffle at will, and push blueprints directly to your athlete roster from the Deployment Bay below.",
    },
    available: {
      title: 'Welcome to the Vault Roster Engine',
      topic: '8-parameter design · 3 signature splits · 1 blueprint this month',
      text: "Welcome to the Vault Roster Engine — your personal program design studio. You have full access. Here you dial in your training with eight precision parameters: training priority, athletic gender focus, experience level, equipment availability, weekly frequency, workout pace, splits architecture, and intensifier technique. Or activate one of my three Signature Chamber Splits — Arnold Era Classic, FST-7 Fascia Expand, or Elite NASM Clinical — loaded directly from my golden-era protocols. You get one blueprint per month. That limit is intentional. A program works when you work it. Your job is to execute what you generate, not keep redesigning. Build it, commit to it, dominate it. See you next month with a new base to build from.",
    },
    spent: {
      title: "Blueprint Generated — Now Execute It",
      topic: "Your program is live · Consistency is the protocol",
      text: "You've generated your blueprint for this month — now execute it. The one-blueprint-per-month discipline is not a restriction, it's the protocol. Programs produce results through consistent repetition, not constant redesign. Your program is live in your Program tab. Go run it. Come back next month with a new base to build from.",
    },
  },
  es: {
    unlimited: {
      title: 'Motor de Roster — Modo de Autoría',
      topic: 'Acceso ilimitado · Splits de cámara insignia · Envío al roster',
      text: "Motor de Roster del Cofre — modo de autoría. Tienes acceso ilimitado. Diseña planes, activa cualquiera de los tres Splits de Cámara Insignia — Arnold Era Classic, FST-7 Fascia Expand o Elite NASM Clinical — rebaraja a voluntad y envía los planes directamente al roster de tus atletas desde la Bahía de Despliegue.",
    },
    available: {
      title: 'Bienvenido al Motor de Roster del Cofre',
      topic: 'Diseño de 8 parámetros · 3 splits insignia · 1 plan este mes',
      text: "Bienvenido al Motor de Roster del Cofre — tu estudio personal de diseño de programas. Tienes acceso completo. Aquí ajustas tu entrenamiento con ocho parámetros de precisión: prioridad de entrenamiento, enfoque de género atlético, nivel de experiencia, disponibilidad de equipo, frecuencia semanal, ritmo de entrenamiento, arquitectura de splits y técnica intensificadora. O activa uno de mis tres Splits de Cámara Insignia — cargados directamente desde mis protocolos de la era dorada. Tienes un plan por mes. Ese límite es intencional. Un programa funciona cuando tú lo ejecutas. Tu trabajo es hacer lo que generas, no seguir rediseñando. Constrúyelo, comprométete con él, domínalo. Nos vemos el próximo mes con una nueva base.",
    },
    spent: {
      title: 'Plan Generado — Ahora Ejecútalo',
      topic: 'Tu programa está activo · La consistencia es el protocolo',
      text: "Has generado tu plan este mes — ahora ejecútalo. La disciplina de un plan por mes no es una restricción, es el protocolo. Los programas producen resultados a través de la repetición constante, no del rediseño continuo. Tu programa está activo en tu pestaña de Programa. Ve a ejecutarlo. Vuelve el próximo mes con una nueva base.",
    },
  },
  pt: {
    unlimited: {
      title: 'Motor de Roster — Modo de Autoria',
      topic: 'Acesso ilimitado · Splits de câmara assinatura · Envio ao roster',
      text: "Motor de Roster do Cofre — modo de autoria. Você tem acesso ilimitado. Crie planos, ative qualquer um dos três Splits de Câmara Assinatura — Arnold Era Classic, FST-7 Fascia Expand ou Elite NASM Clinical — reembaralhe à vontade e envie planos diretamente ao roster dos seus atletas pela Baía de Implantação.",
    },
    available: {
      title: 'Bem-vindo ao Motor de Roster do Cofre',
      topic: 'Design de 8 parâmetros · 3 splits assinatura · 1 plano este mês',
      text: "Bem-vindo ao Motor de Roster do Cofre — seu estúdio pessoal de design de programas. Você tem acesso completo. Aqui você ajusta seu treino com oito parâmetros de precisão: prioridade de treino, foco de gênero atlético, nível de experiência, disponibilidade de equipamento, frequência semanal, ritmo de treino, arquitetura de splits e técnica intensificadora. Ou ative um dos meus três Splits de Câmara Assinatura — carregados diretamente dos meus protocolos da era de ouro. Você tem um plano por mês. Esse limite é intencional. Um programa funciona quando você o executa. Seu trabalho é executar o que você gera, não ficar redesenhando. Construa, comprometa-se, domine. Nos vemos no próximo mês com uma nova base.",
    },
    spent: {
      title: 'Plano Gerado — Agora Execute',
      topic: 'Seu programa está ativo · Consistência é o protocolo',
      text: "Você gerou seu plano este mês — agora execute. A disciplina de um plano por mês não é uma restrição, é o protocolo. Programas produzem resultados através de repetição consistente, não de redesenho constante. Seu programa está ativo na aba Programa. Vá executá-lo. Volte no próximo mês com uma nova base.",
    },
  },
};

const CHROME = {
  en: { eyebrow: "Coach Akeem · Vault Briefing", listen: 'Listen', playing: 'Now Playing', replay: 'Replay', noSupport: 'Audio not supported on this browser.' },
  es: { eyebrow: 'Coach Akeem · Briefing del Cofre', listen: 'Escuchar', playing: 'Reproduciendo', replay: 'Repetir', noSupport: 'Audio no disponible en este navegador.' },
  pt: { eyebrow: 'Coach Akeem · Briefing do Cofre', listen: 'Ouvir', playing: 'Tocando agora', replay: 'Repetir', noSupport: 'Áudio não disponível neste navegador.' },
};

export default function GeneratorVoiceBox({ isUnlimited, tokenSpent }) {
  const { lang } = useLang();
  const tr = CHROME[lang] || CHROME.en;
  const scripts = SCRIPTS[lang] || SCRIPTS.en;

  const scriptKey = isUnlimited ? 'unlimited' : tokenSpent ? 'spent' : 'available';
  const script = scripts[scriptKey];

  const controllerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  if (!browserSpeechSupported()) return null;

  async function toggle() {
    if (playing) {
      controllerRef.current?.stop();
      setPlaying(false);
      return;
    }
    warmUpSpeech();
    try {
      const ctrl = await speakWithBrowser({
        text: script.text,
        lang,
        voiceGender: 'male',
        rate: 0.95,
        onEnd: () => { setPlaying(false); setHasPlayed(true); },
        onError: () => { setPlaying(false); },
      });
      controllerRef.current = ctrl;
      setPlaying(true);
      setHasPlayed(true);
    } catch (e) {
      if (e?.code === 'no_speech_synthesis') setUnsupported(true);
      setPlaying(false);
    }
  }

  if (unsupported) return null;

  const label = playing ? tr.playing : hasPlayed ? tr.replay : tr.listen;

  return (
    <div
      className={`cvn cvn--gate gen-voice-box${playing ? '' : ''}`}
      data-playing={playing ? '1' : '0'}
      data-script={scriptKey}
    >
      <button
        type="button"
        className="cvn-btn"
        onClick={toggle}
        aria-label={`${script.title} — ${label}`}
      >
        <span className="cvn-ic" aria-hidden="true">{playing ? '❚❚' : '▶'}</span>
      </button>

      <div className="cvn-body">
        <div className="cvn-eyebrow">
          <span className="cvn-mic" aria-hidden="true">🎙</span>{tr.eyebrow}
        </div>
        <div className="cvn-title">{script.title}</div>
        <div className="cvn-topic">{script.topic}</div>
      </div>

      <span className={`cvn-eq${playing ? ' is-live' : ''}`} aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={i} className="cvn-bar" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </span>
    </div>
  );
}
