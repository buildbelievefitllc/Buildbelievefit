// src/components/command/EvidenceFeed.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Research Vault — THE VERIFIED EVIDENCE FEED.
//
// 100 exercise-science briefs across four subject lines (Biomechanics ·
// Bioenergetics · Nutrition · Pediatric Athletics), each cross-checked against a
// real PubMed record: a live DOI / PubMed citation is stamped on every card, and
// a confidence badge (strong · partial · unverified) flags how well the real
// literature backs the claim. Fully static — the payload ships in the bundle
// (newsletterResearchVault.json), so browsing costs zero API calls.
//
// AUDIO: each brief carries a spoken-register `audio_script`; the ▶ Play button
// narrates it through speech.js narrate() — the free server-side Google TTS proxy
// (natural voice, no key, no cost) with an automatic on-device Web Speech
// fallback, so narration can never fully break. One track plays at a time.
//
// Reuses the Laboratory-Gold rl-/nf- styling in coachLab.css. Client-side only.

import { useMemo, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { narrate, stopSpeaking, narrationSupported } from '../../lib/speech.js';
import feedData from '../../data/newsletterResearchVault.json';

const PAGE = 9; // briefs revealed per "load more" step

const SUBJECTS = ['Biomechanics', 'Bioenergetics', 'Nutrition', 'Pediatric Athletics', 'Sports Psychology & Neuromuscular Control'];

// Short display labels — the full subject string is the data key + filter value,
// but the chip/tab shows the compact form so the long 5th subject doesn't blow
// out the filter bar.
const SUBJECT_LABELS = { 'Sports Psychology & Neuromuscular Control': 'Sports Psychology' };
const subjectLabel = (s) => SUBJECT_LABELS[s] || s;

// Static payload — imported once, never mutated, so it lives at module scope
// (a stable reference the memo hooks below can depend on without re-computing).
const FEED = feedData.newsletter_feed || [];

const EF_STR = {
  en: {
    kicker: 'Verified Evidence Feed',
    sub: (n) => `${n} PubMed-checked briefs — real citations, coaching directives, and natural-voice narration.`,
    all: 'All',
    breakdown: 'Research Breakdown',
    directive: 'Coaching Directive',
    play: '▶ Play Audio', stop: '■ Stop', playing: 'Playing…',
    source: 'Source', viewSource: 'View on PubMed',
    conf: { strong: 'Strong match', partial: 'Partial match', none: 'Unverified' },
    unverified: 'No direct PubMed backing found — coach with discretion.',
    more: (n) => `Load ${n} more`,
    noneShown: 'No briefs in this subject.',
  },
  es: {
    kicker: 'Feed de Evidencia Verificada',
    sub: (n) => `${n} resúmenes verificados en PubMed — citas reales, directivas de coaching y narración con voz natural.`,
    all: 'Todos',
    breakdown: 'Desglose de la Investigación',
    directive: 'Directiva de Coaching',
    play: '▶ Reproducir', stop: '■ Detener', playing: 'Reproduciendo…',
    source: 'Fuente', viewSource: 'Ver en PubMed',
    conf: { strong: 'Coincidencia fuerte', partial: 'Coincidencia parcial', none: 'Sin verificar' },
    unverified: 'Sin respaldo directo en PubMed — aplica con criterio.',
    more: (n) => `Cargar ${n} más`,
    noneShown: 'No hay resúmenes en esta materia.',
  },
  pt: {
    kicker: 'Feed de Evidência Verificada',
    sub: (n) => `${n} resumos verificados no PubMed — citações reais, diretrizes de coaching e narração com voz natural.`,
    all: 'Todos',
    breakdown: 'Análise da Pesquisa',
    directive: 'Diretriz de Coaching',
    play: '▶ Reproduzir', stop: '■ Parar', playing: 'Reproduzindo…',
    source: 'Fonte', viewSource: 'Ver no PubMed',
    conf: { strong: 'Correspondência forte', partial: 'Correspondência parcial', none: 'Não verificado' },
    unverified: 'Sem respaldo direto no PubMed — aplique com critério.',
    more: (n) => `Carregar mais ${n}`,
    noneShown: 'Nenhum resumo nesta matéria.',
  },
};

// Build the citation label + external link for a brief. Prefers a DOI (resolves
// anywhere); falls back to the PubMed record when the paper predates DOIs.
function sourceLink(study) {
  const c = study.real_citation || {};
  const bits = [c.authors, c.journal, c.year].filter(Boolean).join(' · ');
  const label = bits || c.title || null;
  let href = null;
  if (study.real_doi) href = `https://doi.org/${study.real_doi}`;
  else if (study.real_pmid) href = `https://pubmed.ncbi.nlm.nih.gov/${study.real_pmid}/`;
  return { label, href };
}

export default function EvidenceFeed() {
  const { lang } = useLang();
  const tr = EF_STR[lang] || EF_STR.en;
  const audioOk = narrationSupported();

  const feed = FEED;
  const [subject, setSubject] = useState('all');
  const [visible, setVisible] = useState(PAGE);
  const [playingId, setPlayingId] = useState(null);

  const counts = useMemo(() => {
    const m = { all: FEED.length };
    for (const s of SUBJECTS) m[s] = FEED.filter((x) => x.subject === s).length;
    return m;
  }, []);

  const filtered = useMemo(
    () => (subject === 'all' ? FEED : FEED.filter((x) => x.subject === subject)),
    [subject],
  );

  const pickSubject = (s) => { stopSpeaking(); setPlayingId(null); setSubject(s); setVisible(PAGE); };

  const playStudy = (study) => {
    if (playingId === study.id) { stopSpeaking(); setPlayingId(null); return; }
    narrate(study.audio_script, {
      lang: 'en',
      onEnd: () => setPlayingId((cur) => (cur === study.id ? null : cur)),
    });
    setPlayingId(study.id);
  };

  const shown = filtered.slice(0, visible);

  return (
    <section className="nf" aria-label={tr.kicker} data-testid="evidence-feed">
      <div className="nf-head">
        <span className="rl-kicker">{tr.kicker}</span>
        <p className="rl-lib-sub">{tr.sub(feed.length)}</p>
      </div>

      {/* Subject filter bar */}
      <div className="nf-filters" role="tablist" aria-label={tr.kicker}>
        <button
          type="button"
          role="tab"
          aria-selected={subject === 'all'}
          className={`nf-filter${subject === 'all' ? ' is-active' : ''}`}
          onClick={() => pickSubject('all')}
          data-testid="nf-filter-all"
        >
          {tr.all} <span className="nf-filter-ct">{counts.all}</span>
        </button>
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={subject === s}
            className={`nf-filter${subject === s ? ' is-active' : ''}`}
            onClick={() => pickSubject(s)}
            data-testid={`nf-filter-${s}`}
          >
            {subjectLabel(s)} <span className="nf-filter-ct">{counts[s]}</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="cl-muted" role="status">{tr.noneShown}</p>
      ) : (
        <div className="rl-grid" data-testid="nf-grid">
          {shown.map((s) => {
            const isPlaying = playingId === s.id;
            const src = sourceLink(s);
            const conf = s.match_confidence || 'none';
            return (
              <article key={s.id} className={`rl-card nf-card${isPlaying ? ' is-playing' : ''}`} data-testid={`nf-card-${s.id}`}>
                <div className="rl-card-top">
                  <span className="nf-subject">{subjectLabel(s.subject)}</span>
                  <span className={`nf-badge nf-badge--${conf}`} title={tr.conf[conf]}>{tr.conf[conf]}</span>
                </div>
                <h4 className="rl-card-title">{s.title}</h4>
                {s.headline ? <p className="nf-headline">{s.headline}</p> : null}

                <div className="rl-sec">
                  <span className="rl-sec-lbl">{tr.breakdown}</span>
                  <p className="rl-sec-body">{s.key_findings}</p>
                </div>
                <div className="rl-sec rl-sec--app">
                  <span className="rl-sec-lbl rl-sec-lbl--gold">{tr.directive}</span>
                  <p className="rl-sec-body">{s.practical_takeaway}</p>
                </div>

                <div className="nf-foot">
                  {src.href ? (
                    <a className="nf-cite" href={src.href} target="_blank" rel="noopener noreferrer" title={tr.viewSource}>
                      <span className="nf-cite-lbl">{tr.source}</span>
                      <span className="nf-cite-body">{src.label} ↗</span>
                    </a>
                  ) : (
                    <span className="nf-cite nf-cite--none">{tr.unverified}</span>
                  )}
                  {audioOk ? (
                    <button
                      type="button"
                      className={`rl-play nf-play${isPlaying ? ' is-live' : ''}`}
                      onClick={() => playStudy(s)}
                      data-testid={`nf-play-${s.id}`}
                    >
                      {isPlaying ? tr.stop : tr.play}
                    </button>
                  ) : null}
                </div>
                {isPlaying ? <span className="rl-playing nf-playing" data-testid="nf-playing">◉ {tr.playing}</span> : null}
              </article>
            );
          })}
        </div>
      )}

      {visible < filtered.length ? (
        <button type="button" className="rl-more" onClick={() => setVisible((v) => v + PAGE)} data-testid="nf-more">
          {tr.more(Math.min(PAGE, filtered.length - visible))}
        </button>
      ) : null}
    </section>
  );
}
