// src/components/command/BroadcastHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 4 — The Broadcast Hub (newsletter builder).
//
// Select 2-5 Research Vault entries → Claude (bbf-coach-vault · broadcast action)
// synthesizes them into a client-ready newsletter you can copy-paste. Founder-only.

import { useEffect, useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { listResearch, broadcastResearch } from '../../lib/coachLabApi.js';

const BC_L10N = {
  en: {
    intro: 'Teaching others keeps you sharp. Pick a few vault entries and Claude turns them into a client-ready newsletter.',
    loading: 'Loading your vault…',
    emptyTitle: 'Nothing to broadcast yet',
    emptySub: 'Add a few studies in the Research Vault first — then synthesize them here.',
    selectHint: 'Select 1–5 entries', selected: 'selected',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Synthesize newsletter', synthesizing: 'Writing your newsletter…',
    resultLabel: 'Client Newsletter', copy: 'Copy', copied: 'Copied ✓', errorPrefix: 'Error',
  },
  es: {
    intro: 'Enseñar te mantiene afilado. Elige algunas entradas y Claude las convierte en un boletín listo para el cliente.',
    loading: 'Cargando tu bóveda…',
    emptyTitle: 'Nada que difundir aún',
    emptySub: 'Agrega algunos estudios en la Bóveda de Investigación — luego sintetízalos aquí.',
    selectHint: 'Selecciona 1–5 entradas', selected: 'seleccionadas',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Sintetizar boletín', synthesizing: 'Escribiendo tu boletín…',
    resultLabel: 'Boletín para Cliente', copy: 'Copiar', copied: 'Copiado ✓', errorPrefix: 'Error',
  },
  pt: {
    intro: 'Ensinar mantém você afiado. Escolha algumas entradas e Claude as transforma num boletim pronto para o cliente.',
    loading: 'Carregando seu cofre…',
    emptyTitle: 'Nada para transmitir ainda',
    emptySub: 'Adicione alguns estudos no Cofre de Pesquisa — depois sintetize-os aqui.',
    selectHint: 'Selecione 1–5 entradas', selected: 'selecionadas',
    formatEmail: 'Email', formatMarkdown: 'Markdown',
    synthesize: 'Sintetizar boletim', synthesizing: 'Escrevendo seu boletim…',
    resultLabel: 'Boletim para Cliente', copy: 'Copiar', copied: 'Copiado ✓', errorPrefix: 'Erro',
  },
};

export default function BroadcastHub() {
  const { lang } = useLang();
  const L = BC_L10N[lang] || BC_L10N.en;

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
      <div className="cl-empty" data-testid="broadcast-hub">
        <div className="cl-empty-orb" aria-hidden="true">✉</div>
        <h4 className="cl-empty-title">{L.emptyTitle}</h4>
        <p className="cl-empty-sub">{L.emptySub}</p>
      </div>
    );
  }

  return (
    <div className="bc" data-testid="broadcast-hub">
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
            <button
              key={c.id}
              type="button"
              className={`bc-item${on ? ' is-on' : ''}`}
              onClick={() => toggle(c.id)}
              aria-pressed={on}
              data-testid={`bc-pick-${c.id}`}
            >
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
