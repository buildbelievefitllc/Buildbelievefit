// src/components/command/BroadcastHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 4 — The Broadcast Hub. Two ways to turn the vault into
// client value:
//
//   NEWSLETTER  (original): pick 1-5 live Research Vault cards → Claude
//     (bbf-coach-vault · broadcast) synthesizes a client-ready newsletter you
//     copy-paste. Sourced from the DB vault (coach_knowledge_base).
//
//   VIDEO  (new): pick one study from the curated 100-study evidence grid →
//     Coach Akeem narrates its script (bbf-studio-voiceover, provided_script)
//     → a branded 9:16 reel with karaoke captions renders in the browser
//     (researchReel.js) → preview + download. Sourced from the bundled
//     exerciseScienceResearchVault.json (each study ships an audio_script), so
//     this needs no DB round-trip and no new edge function.
//
// Founder-only (the /command AdminGuard gates the whole Coach Lab).

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { listResearch, broadcastResearch } from '../../lib/coachLabApi.js';
import { generateStudioVoiceover } from '../../lib/studioApi.js';
import { renderResearchReel, reelRenderSupported, reelFileName, classifyStudy } from '../../lib/researchReel.js';
import researchVaultData from '../../data/exerciseScienceResearchVault.json';
import CoachVideoLibrary from './CoachVideoLibrary.jsx';

const STUDIES = researchVaultData.research_studies || [];

// Narration voice characters — ids MUST match bbf-studio-voiceover's VIBES map.
const REEL_VIBES = [
  ['the_architect', 'The Architect'],
  ['the_mechanic', 'The Mechanic'],
  ['real_talk', 'Real Talk'],
  ['the_sanctuary', 'The Sanctuary'],
  ['the_reframe', 'The Reframe'],
];

const BC_L10N = {
  en: {
    modeNewsletter: '✉ Newsletter', modeVideo: '🎬 Video Reel', modeLibrary: '🎓 Lecture Hall',
    intro: 'Teaching others keeps you sharp. Pick a few vault entries and Claude turns them into a client-ready newsletter.',
    videoIntro: 'Turn any study into a branded 9:16 reel — Coach Akeem narrates the script, captions sync to his voice. Preview, then download to post.',
    loading: 'Loading your vault…',
    emptyTitle: 'Nothing to broadcast yet',
    emptySub: 'Add a few studies in the Research Vault first — then synthesize them here.',
    selectHint: 'Select 1–5 entries', selected: 'selected',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Synthesize newsletter', synthesizing: 'Writing your newsletter…',
    resultLabel: 'Client Newsletter', copy: 'Copy', copied: 'Copied ✓', errorPrefix: 'Error',
    searchPlaceholder: 'Search the 100-study evidence grid…',
    pickStudy: 'Pick one study', styleLabel: 'Narration voice',
    generate: '🎬 Generate reel', genNarration: 'Writing narration…', genRender: 'Recording reel…',
    videoReady: 'Reel ready', download: '⬇ Download', regenerate: 'Make another',
    unsupported: 'Reel rendering needs Chrome (or another MediaRecorder browser). The narration audio still generated — use it in the Studio.',
    noPick: 'Select a study above to generate its reel.',
  },
  es: {
    modeNewsletter: '✉ Boletín', modeVideo: '🎬 Reel de Video', modeLibrary: '🎓 Sala de Estudio',
    intro: 'Enseñar te mantiene afilado. Elige algunas entradas y Claude las convierte en un boletín listo para el cliente.',
    videoIntro: 'Convierte cualquier estudio en un reel 9:16 de marca — Coach Akeem narra el guion y los subtítulos se sincronizan con su voz. Previsualiza y descarga para publicar.',
    loading: 'Cargando tu bóveda…',
    emptyTitle: 'Nada que difundir aún',
    emptySub: 'Agrega algunos estudios en la Bóveda de Investigación — luego sintetízalos aquí.',
    selectHint: 'Selecciona 1–5 entradas', selected: 'seleccionadas',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Sintetizar boletín', synthesizing: 'Escribiendo tu boletín…',
    resultLabel: 'Boletín para Cliente', copy: 'Copiar', copied: 'Copiado ✓', errorPrefix: 'Error',
    searchPlaceholder: 'Busca en la grilla de 100 estudios…',
    pickStudy: 'Elige un estudio', styleLabel: 'Voz de narración',
    generate: '🎬 Generar reel', genNarration: 'Escribiendo narración…', genRender: 'Grabando reel…',
    videoReady: 'Reel listo', download: '⬇ Descargar', regenerate: 'Hacer otro',
    unsupported: 'La generación del reel necesita Chrome (u otro navegador con MediaRecorder). El audio de narración sí se generó — úsalo en el Studio.',
    noPick: 'Selecciona un estudio arriba para generar su reel.',
  },
  pt: {
    modeNewsletter: '✉ Boletim', modeVideo: '🎬 Reel de Vídeo', modeLibrary: '🎓 Auditório',
    intro: 'Ensinar mantém você afiado. Escolha algumas entradas e Claude as transforma num boletim pronto para o cliente.',
    videoIntro: 'Transforme qualquer estudo num reel 9:16 de marca — Coach Akeem narra o roteiro e as legendas sincronizam com a voz dele. Pré-visualize e baixe para postar.',
    loading: 'Carregando seu cofre…',
    emptyTitle: 'Nada para transmitir ainda',
    emptySub: 'Adicione alguns estudos no Cofre de Pesquisa — depois sintetize-os aqui.',
    selectHint: 'Selecione 1–5 entradas', selected: 'selecionadas',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Sintetizar boletim', synthesizing: 'Escrevendo seu boletim…',
    resultLabel: 'Boletim para Cliente', copy: 'Copiar', copied: 'Copiado ✓', errorPrefix: 'Erro',
    searchPlaceholder: 'Busque na grade de 100 estudos…',
    pickStudy: 'Escolha um estudo', styleLabel: 'Voz da narração',
    generate: '🎬 Gerar reel', genNarration: 'Escrevendo narração…', genRender: 'Gravando reel…',
    videoReady: 'Reel pronto', download: '⬇ Baixar', regenerate: 'Fazer outro',
    unsupported: 'A geração do reel precisa do Chrome (ou outro navegador com MediaRecorder). O áudio da narração foi gerado — use-o no Studio.',
    noPick: 'Selecione um estudo acima para gerar seu reel.',
  },
};

export default function BroadcastHub() {
  const { lang } = useLang();
  const L = BC_L10N[lang] || BC_L10N.en;
  const [mode, setMode] = useState('newsletter');

  return (
    <div className="bc" data-testid="broadcast-hub">
      <div className="bc-modebar" role="tablist" aria-label="broadcast mode">
        <button type="button" role="tab" aria-selected={mode === 'newsletter'}
          className={`bc-mode${mode === 'newsletter' ? ' is-active' : ''}`}
          onClick={() => setMode('newsletter')} data-testid="bc-mode-newsletter">{L.modeNewsletter}</button>
        <button type="button" role="tab" aria-selected={mode === 'video'}
          className={`bc-mode${mode === 'video' ? ' is-active' : ''}`}
          onClick={() => setMode('video')} data-testid="bc-mode-video">{L.modeVideo}</button>
        <button type="button" role="tab" aria-selected={mode === 'library'}
          className={`bc-mode${mode === 'library' ? ' is-active' : ''}`}
          onClick={() => setMode('library')} data-testid="bc-mode-library">{L.modeLibrary}</button>
      </div>

      {mode === 'newsletter' ? <NewsletterMode L={L} />
        : mode === 'video' ? <VideoMode L={L} />
          : <CoachVideoLibrary />}
    </div>
  );
}

// ── NEWSLETTER (original behaviour, unchanged aside from extraction) ──────────
function NewsletterMode({ L }) {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState(() => new Set());
  const [format, setFormat] = useState('email');
  const [busy, setBusy] = useState(false);
  const [newsletter, setNewsletter] = useState('');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    listResearch()
      .then((rows) => { if (alive) { setCards(rows); setLoading(false); } })
      .catch((e) => { if (alive) { setError(e.message); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else if (n.size < 5) n.add(id);
    return n;
  });

  const synthesize = async () => {
    if (picked.size < 1 || busy) return;
    setBusy(true); setError(null); setNewsletter(''); setCopied(false);
    try { const r = await broadcastResearch([...picked], format); setNewsletter(r.newsletter); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(newsletter); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* clipboard blocked — user can select manually */ }
  };

  if (loading) return <p className="cl-muted" role="status">{L.loading}</p>;
  if (!cards.length) {
    return (
      <div className="cl-empty" data-testid="bc-newsletter-empty">
        <div className="cl-empty-orb" aria-hidden="true">✉</div>
        <h4 className="cl-empty-title">{L.emptyTitle}</h4>
        <p className="cl-empty-sub">{L.emptySub}</p>
      </div>
    );
  }

  return (
    <div data-testid="bc-newsletter">
      <p className="cl-intro">{L.intro}</p>
      <div className="bc-toolbar">
        <span className="bc-hint">{L.selectHint} · <strong>{picked.size}</strong> {L.selected}</span>
        <div className="bc-format" role="group" aria-label="format">
          <button type="button" className={`bc-fmt${format === 'email' ? ' is-active' : ''}`} onClick={() => setFormat('email')}>{L.formatEmail}</button>
          <button type="button" className={`bc-fmt${format === 'markdown' ? ' is-active' : ''}`} onClick={() => setFormat('markdown')}>{L.formatMarkdown}</button>
        </div>
      </div>

      <div className="bc-list">
        {cards.map((c) => {
          const on = picked.has(c.id);
          return (
            <button key={c.id} type="button" className={`bc-item${on ? ' is-on' : ''}`} onClick={() => toggle(c.id)} aria-pressed={on} data-testid={`bc-pick-${c.id}`}>
              <span className="bc-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="bc-item-text">
                <span className="bc-item-title">{c.title}</span>
                <span className="bc-item-cat">{c.category}</span>
              </span>
            </button>
          );
        })}
      </div>

      <button type="button" className="cl-summarize" onClick={synthesize} disabled={picked.size < 1 || busy} data-testid="bc-synthesize">
        {busy ? L.synthesizing : `✉ ${L.synthesize}`}
      </button>
      {error ? <p className="cl-err" role="alert">{L.errorPrefix}: {error}</p> : null}

      {newsletter ? (
        <div className="bc-result" data-testid="bc-result">
          <div className="bc-result-head">
            <span className="bc-result-lbl">{L.resultLabel}</span>
            <button type="button" className="kl-btn" onClick={copy} data-testid="bc-copy">{copied ? L.copied : L.copy}</button>
          </div>
          <textarea className="bc-output" readOnly value={newsletter} rows={16} />
        </div>
      ) : null}
    </div>
  );
}

// ── VIDEO REEL (new) ─────────────────────────────────────────────────────────
function VideoMode({ L }) {
  const [query, setQuery] = useState('');
  const [pickedId, setPickedId] = useState(null);
  const [vibe, setVibe] = useState('the_architect');
  const [phase, setPhase] = useState('idle');   // idle | narration | render | ready
  const [pct, setPct] = useState(0);
  const [error, setError] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [fileName, setFileName] = useState('bbf-reel.mp4');
  const blobUrlRef = useRef(null);

  // Revoke the previous object URL when a new one replaces it / on unmount.
  useEffect(() => () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q ? STUDIES.filter((s) => s.title.toLowerCase().includes(q)) : STUDIES;
    return base.slice(0, 60);
  }, [query]);

  const picked = useMemo(() => STUDIES.find((s) => s.id === pickedId) || null, [pickedId]);
  const busy = phase === 'narration' || phase === 'render';

  const generate = async () => {
    if (!picked || busy) return;
    setError(null);
    setPct(0);
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setVideoUrl(null);

    // 1 · Coach Akeem narrates the study's own audio_script (voiced verbatim).
    setPhase('narration');
    let voice;
    try {
      voice = await generateStudioVoiceover({
        topic: picked.title,
        targetDuration: 30,
        vibe,
        lang: 'en',                         // the curated scripts are English
        providedScript: picked.audio_script,
      });
    } catch (e) {
      setPhase('idle');
      setError(e?.message || 'narration_failed');
      return;
    }
    if (!voice?.url) { setPhase('idle'); setError('narration_no_audio'); return; }

    // 2 · Render the branded reel in the browser (graceful if unsupported).
    if (!reelRenderSupported()) { setPhase('idle'); setError('unsupported'); return; }
    setPhase('render');
    try {
      const { blob, mime } = await renderResearchReel({
        title: picked.title,
        takeaway: picked.gym_application,
        category: classifyStudy(picked.title),
        audioUrl: voice.url,
        words: Array.isArray(voice.words) ? voice.words : [],
        onProgress: (p) => setPct(Math.round(p * 100)),
      });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setVideoUrl(url);
      setFileName(reelFileName(picked.title, mime.includes('mp4') ? 'mp4' : 'webm'));
      setPhase('ready');
    } catch (e) {
      setPhase('idle');
      setError(e?.message === 'unsupported_browser' ? 'unsupported' : (e?.message || 'render_failed'));
    }
  };

  return (
    <div data-testid="bc-video">
      <p className="cl-intro">{L.videoIntro}</p>

      <input
        className="bc-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={L.searchPlaceholder}
        aria-label={L.searchPlaceholder}
        data-testid="bc-video-search"
      />

      <span className="bc-hint">{L.pickStudy}</span>
      <div className="bc-list bc-list--video">
        {results.map((s) => {
          const on = s.id === pickedId;
          return (
            <button key={s.id} type="button" className={`bc-item${on ? ' is-on' : ''}`} onClick={() => setPickedId(s.id)} aria-pressed={on} data-testid={`bc-study-${s.id}`}>
              <span className="bc-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="bc-item-text">
                <span className="bc-item-title">{s.title}</span>
                <span className="bc-item-cat">{classifyStudy(s.title).replace(/-/g, ' ')}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="bc-video-controls">
        <label className="bc-vstyle">
          <span className="bc-vstyle-lbl">{L.styleLabel}</span>
          <select className="cl-select" value={vibe} onChange={(e) => setVibe(e.target.value)} data-testid="bc-video-vibe" disabled={busy}>
            {REEL_VIBES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <button type="button" className="cl-summarize" onClick={generate} disabled={!picked || busy} data-testid="bc-generate-video">
          {phase === 'narration' ? L.genNarration : phase === 'render' ? `${L.genRender} ${pct}%` : L.generate}
        </button>
      </div>
      {!picked ? <p className="cl-composer-note">{L.noPick}</p> : null}

      {error ? (
        <p className="cl-err" role="alert" data-testid="bc-video-error">
          {L.errorPrefix}: {error === 'unsupported' ? L.unsupported : error}
        </p>
      ) : null}

      {videoUrl ? (
        <div className="bc-reel-out" data-testid="bc-reel-out">
          <div className="bc-result-head">
            <span className="bc-result-lbl">{L.videoReady}</span>
            <div className="bc-reel-actions">
              <a className="kl-btn" href={videoUrl} download={fileName} data-testid="bc-reel-download">{L.download}</a>
              <button type="button" className="kl-btn" onClick={generate} data-testid="bc-reel-again">{L.regenerate}</button>
            </div>
          </div>
          <video className="bc-reel-video" src={videoUrl} controls playsInline data-testid="bc-reel-video" />
        </div>
      ) : null}
    </div>
  );
}
