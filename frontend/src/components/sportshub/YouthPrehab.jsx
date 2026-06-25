// src/components/sportshub/YouthPrehab.jsx
// ─────────────────────────────────────────────────────────────────────────────
// THE YOUTH PREHAB TAB — strictly PRESCRIPTION-ONLY (CEO "Netflix rule"). This tab
// NEVER renders a browsable library or category picker. It reads the friction zone
// the athlete logged in the Post-Game Check and serves a hard-capped, highly
// targeted routine (MAX 3 movements) for that zone — nothing else. No friction
// logged ⇒ a clean "you're cleared" state, never a catalog. (Full-library access is
// a future paywalled tier; right now they only see what they're prescribed.)
//
// Gate-free by design: the server prehab engine (bbf-agentic-prehab) is tier-gated
// above the youth band, so this prescription is resolved CLIENT-SIDE from the
// curated youthPrehabRx map — instant, entitlement-free, no spinner for a kid. Each
// movement carries a trilingual demo from the shared recovery video catalog.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { recoveryVideosFor } from '../../data/recoveryVideos.js';
import { thumbURL } from '../vault/exerciseVideos.js';
import { PlayIcon } from '../vault/icons.jsx';
import { YOUTH_PREHAB_RX, ZONE_LABEL } from './youthPrehabRx.js';
import './youthSequence.css';

function ytEmbedAutoplay(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`;
}

const STR = {
  en: {
    kicker: 'Targeted Fix',
    titleA: 'Your ', titleB: ' Fix',
    sub: (n) => `${n} targeted moves for your sore zone. Knock these out and protect your armor.`,
    emptyH: 'You’re cleared',
    emptyP: 'Nothing flagged in your last Post-Game Check. If a joint gets sore, log it after training and your targeted fix shows up right here — just for that zone.',
    watch: 'Play demo',
  },
  es: {
    kicker: 'Rutina Específica',
    titleA: 'Tu rutina para ', titleB: '',
    sub: (n) => `${n} ejercicios específicos para tu zona adolorida. Hazlos y protege tu armadura.`,
    emptyH: 'Estás libre',
    emptyP: 'Nada marcado en tu último Chequeo Post-Juego. Si una articulación se pone adolorida, regístrala después de entrenar y tu rutina específica aparece aquí — solo para esa zona.',
    watch: 'Ver demo',
  },
  pt: {
    kicker: 'Rotina Específica',
    titleA: 'Sua rotina para ', titleB: '',
    sub: (n) => `${n} exercícios específicos para sua zona dolorida. Faça e proteja sua armadura.`,
    emptyH: 'Você está liberado',
    emptyP: 'Nada marcado na sua última Checagem Pós-Jogo. Se uma articulação ficar dolorida, registre depois do treino e sua rotina específica aparece aqui — só para aquela zona.',
    watch: 'Ver demo',
  },
};

function PrehabVideo({ id, lang, label }) {
  const [playing, setPlaying] = useState(false);
  const vids = recoveryVideosFor(id, lang);
  if (!vids.length) return null;
  const v = vids[0];
  if (playing) {
    return (
      <div className="ypx-video is-playing">
        <iframe
          key={v.id}
          className="ypx-video-frame"
          src={ytEmbedAutoplay(v.id)}
          title={v.t || label}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button type="button" className="ypx-video bbf-video-cover" onClick={() => setPlaying(true)} aria-label={label} data-testid="youth-prehab-watch">
      <img className="ypx-video-thumb" src={thumbURL(v.id)} alt="" loading="lazy" referrerPolicy="no-referrer" />
      <span className="bbf-video-overlay" aria-hidden="true">
        <span className="bbf-video-play"><PlayIcon size={24} /></span>
      </span>
    </button>
  );
}

// `friction` is the lifted Post-Game result: { area, pain } | null. We render a
// prescription ONLY for a zone we actually carry a routine for; everything else
// (null / 'full_body' / unknown) is the clean cleared state — never a library.
export default function YouthPrehab({ friction = null }) {
  const { lang } = useLang();
  const s = STR[lang] || STR.en;

  const area = friction?.area;
  const routine = (area && YOUTH_PREHAB_RX[area]) || null;

  if (!routine) {
    return (
      <div className="ypx" data-testid="youth-prehab">
        <div className="ypx-empty" data-testid="youth-prehab-empty">
          <div className="ypx-empty-ic" aria-hidden="true">🛡️</div>
          <h2 className="ypx-empty-h">{s.emptyH}</h2>
          <p className="ypx-empty-p">{s.emptyP}</p>
        </div>
      </div>
    );
  }

  const zone = (ZONE_LABEL[area] && (ZONE_LABEL[area][lang] || ZONE_LABEL[area].en)) || '';
  // Hard cap — the prescription is authored at 3, but never let anything past 3.
  const moves = routine.slice(0, 3);

  return (
    <div className="ypx" data-testid="youth-prehab">
      <header className="ypx-head">
        <div className="ypx-kicker">{s.kicker}</div>
        <h2 className="ypx-title">{s.titleA}<b>{zone}</b>{s.titleB}</h2>
        <p className="ypx-sub">{s.sub(moves.length)}</p>
      </header>

      <ol className="ypx-list">
        {moves.map((m, i) => (
          <li key={m.id} className="ypx-card" data-testid="youth-prehab-move">
            <div className="ypx-card-body">
              <div className="ypx-card-top">
                <span className="ypx-idx" aria-hidden="true">{i + 1}</span>
                <span className="ypx-name">{m.name}</span>
                <span className="ypx-dose">{m.dose[lang] || m.dose.en}</span>
              </div>
              <p className="ypx-why">{m.why[lang] || m.why.en}</p>
            </div>
            <PrehabVideo id={m.id} lang={lang} label={`${m.name} — ${s.watch}`} />
          </li>
        ))}
      </ol>
    </div>
  );
}
