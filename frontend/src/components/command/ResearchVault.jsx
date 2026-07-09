// src/components/command/ResearchVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Coach Lab · Pillar 1 — The Research Vault.
//
// TWO layers, top to bottom:
//   1. THE CURATED ACADEMIC LIBRARY (ResearchLibrary) — the static exercise-
//      science payload: the academic-criteria progression checklist + the
//      100-study evidence grid with Web Speech audio narration. Client-side.
//   2. THE LIVE INGEST FLOW — paste a PubMed abstract / lecture / textbook
//      passage → the bbf-coach-vault edge function asks Claude (via the model
//      router) for a structured coaching summary → saved to coach_knowledge_base
//      and rendered as a glassmorphism flip "Research Card" (Coaching Application
//      front · Physiology Takeaways + Scientific Pitfalls back).
// Founder-only (the /command route gates it).

import { useEffect, useState } from 'react';
import { listResearch, ingestResearch, deleteResearch, RESEARCH_CATEGORIES } from '../../lib/coachLabApi.js';
import ResearchLibrary from './ResearchLibrary.jsx';
import { CloseIcon } from '../vault/icons.jsx';

export default function ResearchVault({ L }) {
  const V = L.vault;
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [ingestError, setIngestError] = useState(null);

  const [flipped, setFlipped] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    listResearch()
      .then((rows) => { if (alive) { setCards(rows); setLoading(false); } })
      .catch((e) => { if (alive) { setLoadError(e.message || 'load_failed'); setLoading(false); } });
    return () => { alive = false; };
  }, []);

  const submit = async () => {
    const raw = text.trim();
    if (raw.length < 40 || busy) return;
    setBusy(true);
    setIngestError(null);
    try {
      const card = await ingestResearch(raw, category);
      setCards((prev) => [card, ...prev]);
      setText('');
      setCategory('');
    } catch (e) {
      setIngestError(e.message || 'summarize_failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    const prev = cards;
    setCards((c) => c.filter((x) => x.id !== id)); // optimistic
    try { await deleteResearch(id); }
    catch { setCards(prev); } // rollback on failure
  };

  const toggleFlip = (id) => setFlipped((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const canSubmit = text.trim().length >= 40 && !busy;

  return (
    <div className="cl-vault" data-testid="research-vault">
      {/* Curated academic library — criteria checklist + narrated study grid */}
      <ResearchLibrary />

      {/* Ingestion composer */}
      <div className="cl-composer">
        <label className="cl-composer-lbl" htmlFor="cl-ingest">{V.composerLabel}</label>
        <textarea
          id="cl-ingest"
          className="cl-composer-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={V.placeholder}
          rows={5}
          data-testid="rv-input"
        />
        <div className="cl-composer-row">
          <select
            className="cl-select"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label={V.categoryLabel}
            data-testid="rv-category"
          >
            <option value="">{V.categoryAuto}</option>
            {RESEARCH_CATEGORIES.map((c) => (
              <option key={c} value={c}>{V.categoryLabels[c] || c}</option>
            ))}
          </select>
          <button
            type="button"
            className="cl-summarize"
            onClick={submit}
            disabled={!canSubmit}
            data-testid="rv-summarize"
          >
            {busy ? V.summarizing : V.summarizeBtn}
          </button>
        </div>
        {ingestError ? (
          <p className="cl-err" role="alert" data-testid="rv-error">{V.errorPrefix}: {ingestError}</p>
        ) : null}
        <p className="cl-composer-note">{V.composerNote}</p>
      </div>

      {/* Saved research cards */}
      {loading ? (
        <p className="cl-muted" role="status">{V.loading}</p>
      ) : loadError ? (
        <p className="cl-err" role="alert">{V.errorPrefix}: {loadError}</p>
      ) : cards.length === 0 ? (
        <div className="cl-empty">
          <div className="cl-empty-orb" aria-hidden="true">⌕</div>
          <h4 className="cl-empty-title">{V.emptyTitle}</h4>
          <p className="cl-empty-sub">{V.emptySub}</p>
        </div>
      ) : (
        <div className="cl-cardgrid" data-testid="rv-grid">
          {cards.map((c) => (
            <ResearchCard
              key={c.id}
              card={c}
              V={V}
              flipped={flipped.has(c.id)}
              onFlip={() => toggleFlip(c.id)}
              onDelete={() => remove(c.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ResearchCard({ card, V, flipped, onFlip, onDelete }) {
  const s = card.claude_summary || {};
  const takeaways = Array.isArray(s.physiology_takeaways) ? s.physiology_takeaways : [];
  const catLabel = V.categoryLabels[card.category] || card.category;
  return (
    <div className={`cl-flip${flipped ? ' is-flipped' : ''}`} data-testid={`rv-card-${card.id}`}>
      <div className="cl-flip-inner">
        {/* Front — coaching application */}
        <button type="button" className="cl-face cl-face-front" onClick={onFlip} aria-label={V.flipHint}>
          <span className="cl-cat">{catLabel}</span>
          <h4 className="cl-card-title">{card.title}</h4>
          {card.source_citation ? <p className="cl-cite">{card.source_citation}</p> : null}
          <div className="cl-app">
            <span className="cl-app-lbl">{V.applicationLabel}</span>
            <p className="cl-app-body">{s.coaching_application || '—'}</p>
          </div>
          <span className="cl-flip-hint">{V.flipHint} ↻</span>
        </button>

        {/* Back — physiology + pitfalls */}
        <button type="button" className="cl-face cl-face-back" onClick={onFlip} aria-label={V.flipHint}>
          <span className="cl-cat">{catLabel}</span>
          <div className="cl-back-sec">
            <span className="cl-back-lbl">{V.takeawaysLabel}</span>
            <ul className="cl-takeaways">
              {takeaways.length ? takeaways.map((t, i) => (
                <li key={i}><span className="cl-take-arrow" aria-hidden="true">›</span>{t}</li>
              )) : <li className="cl-muted">—</li>}
            </ul>
          </div>
          <div className="cl-back-sec">
            <span className="cl-back-lbl cl-back-lbl--warn">{V.pitfallsLabel}</span>
            <p className="cl-pitfalls">{s.scientific_pitfalls || '—'}</p>
          </div>
          <span className="cl-flip-hint">↺ {V.flipBack}</span>
        </button>
      </div>

      <button
        type="button"
        className="cl-card-del"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={V.deleteLabel}
        title={V.deleteLabel}
        data-testid={`rv-del-${card.id}`}
      >
        <CloseIcon size={13} />
      </button>
    </div>
  );
}
