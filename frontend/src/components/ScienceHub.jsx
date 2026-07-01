// src/components/ScienceHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 26 — Science Hub. A high-authority public sales asset on the marketing
// landing page: a clinical-studies library that frames BBF's methodology as
// peer-reviewed science rather than fitness opinion. Faithful rebuild of the AI
// Studio prototype.
//
// Layout (BBF dark-mode brutalist — purple/gold, hairline borders, monospace
// clinical data points):
//   • Header     — META-ANALYSIS pill, SCIENCE HUB title + subtitle, and the
//                  CLINICAL STUDIES LIBRARY (gold) / LIVE AI SEARCH (outline) CTAs.
//   • Filter bar — FILTER STRATEGIC DEMOGRAPHICS + 5 category pills.
//   • Left rail  — SELECT STUDY SPECIMEN list (scrollable) + CLINICAL INTEGRITY
//                  LOCK footer.
//   • Right rail — the clinical deep-dive: journal/year/title/investigators and a
//                  nested tab bar (Abstract · Methodology · Findings · Akeem's
//                  Practical Application). The Akeem tab renders the monospace
//                  "Coach Akeem's Systemic Translation" sales block.
//
// Data is hardcoded reference (data/scienceHubData.js) so the layout can be
// verified before the live Supabase-backed corpus + AI search land.

import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, STUDIES, STUDY_TABS } from '../data/scienceHubData.js';
import { browserSpeechSupported, speakWithBrowser, warmUpSpeech } from '../lib/speechFallback.js';
import './scienceHub.css';

export default function ScienceHub() {
  const [category, setCategory] = useState('GENERAL');
  // GENERAL is the "show everything" lens; any other pill filters by demographic.
  const studies = useMemo(
    () => (category === 'GENERAL' ? STUDIES : STUDIES.filter((s) => s.category === category)),
    [category],
  );

  const [activeId, setActiveId] = useState('interference-effect');
  const [tab, setTab] = useState('abstract');

  // Keep the selection valid as the filter narrows; never leave the panel blank.
  const active = studies.find((s) => s.id === activeId) || studies[0] || null;

  const pickCategory = (c) => {
    setCategory(c);
    const next = c === 'GENERAL' ? STUDIES : STUDIES.filter((s) => s.category === c);
    if (!next.some((s) => s.id === activeId) && next[0]) setActiveId(next[0].id);
  };

  const pickStudy = (id) => { setActiveId(id); setTab('abstract'); };

  return (
    <section id="science" className="shub">
      <div className="shub-card">
        {/* ── Header ── */}
        <header className="shub-head">
          <div className="shub-head-l">
            <span className="shub-pill">🎓 BBF META-ANALYSIS PEER REVIEW</span>
            <h2 className="shub-title">
              <span className="shub-title-mark" aria-hidden="true">📖</span> SCIENCE HUB
            </h2>
            <p className="shub-sub">
              Read off real, clinical peer-reviewed sports science publications, or leverage
              Google Search grounding models to search live databases.
            </p>
          </div>
          <div className="shub-actions">
            <button type="button" className="shub-btn shub-btn-gold">📑 Clinical Studies Library</button>
            <button type="button" className="shub-btn shub-btn-ghost">🔍 Live AI Search</button>
          </div>
        </header>

        {/* ── Strategic-demographics filter ── */}
        <div className="shub-filterbar">
          <span className="shub-filter-label">Filter Strategic Archives</span>
          <div className="shub-pills" role="tablist" aria-label="Strategic demographics">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`shub-cat${category === c ? ' is-active' : ''}`}
                onClick={() => pickCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* ── Body: study list + clinical deep-dive ── */}
        <div className="shub-body">
          <aside className="shub-rail">
            <div className="shub-rail-head">Select Study Specimen ({studies.length})</div>
            <ul className="shub-list">
              {studies.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`shub-study${active && s.id === active.id ? ' is-active' : ''}`}
                    onClick={() => pickStudy(s.id)}
                    aria-current={active && s.id === active.id}
                  >
                    <span className="shub-study-icon" aria-hidden="true">{s.icon}</span>
                    <span className="shub-study-main">
                      <span className="shub-study-title">{s.title}</span>
                      <span className="shub-study-tag">
                        <span className="shub-study-clock" aria-hidden="true">◷</span>
                        {s.journal.toUpperCase()} ({s.year})
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!studies.length ? <li className="shub-empty">No specimens in this archive yet.</li> : null}
            </ul>

            <div className="shub-lock">
              <div className="shub-lock-head">🔒 Clinical Integrity Lock</div>
              <p className="shub-lock-body">
                BBF rejects fitness speculation. Every exercise, rest sequence, and molecular lipid
                designated to active clients is grounded strictly in clinical trials and in vivo
                muscle biopsies.
              </p>
            </div>
          </aside>

          <div className="shub-detail">
            {active ? <StudyDetail study={active} tab={tab} onTab={setTab} /> : (
              <div className="shub-detail-empty">Select a study specimen to load the clinical analysis.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function StudyDetail({ study, tab, onTab }) {
  const activeTab = STUDY_TABS.find((t) => t.id === tab) || STUDY_TABS[0];
  const isAkeem = activeTab.id === 'akeem';
  const toSpeak = isAkeem
    ? `${activeTab.heading}. ${study.akeem} ${study.protocol}`
    : `${activeTab.heading}. ${study[activeTab.key]}`;

  return (
    <article className="shub-study-view">
      <div className="shub-view-top">
        <span className="shub-view-journal">{study.journal.toUpperCase()}</span>
        <span className="shub-view-year">{study.year}</span>
      </div>
      <h3 className="shub-view-title">{study.title}</h3>
      <div className="shub-view-invest">
        <span className="shub-view-invest-k">Investigators:</span> {study.investigators}
      </div>

      <nav className="shub-tabs" role="tablist" aria-label="Clinical analysis sections">
        {STUDY_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={t.id === tab}
            className={`shub-tab${t.id === tab ? ' is-active' : ''}`}
            onClick={() => onTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={`shub-panel${isAkeem ? ' is-akeem' : ''}`}>
        <div className="shub-panel-head">
          <div className="shub-panel-heading">{activeTab.heading}</div>
          <ListenButton key={`${study.id}-${tab}`} text={toSpeak} />
        </div>
        {isAkeem ? (
          <>
            <p className="shub-akeem-quote">&ldquo;{study.akeem}&rdquo;</p>
            <div className="shub-protocol">{study.protocol}</div>
          </>
        ) : (
          <p className="shub-panel-body">{study[activeTab.key]}</p>
        )}
      </div>
    </article>
  );
}

// Read the active tab's content aloud with the device's built-in stock voice
// (window.speechSynthesis) — zero API key, zero cost, so it's always on. Not a
// fallback here (unlike CoachAudioButton's ElevenLabs failure path): for a
// public marketing asset with no auth/billing context, the free voice IS the
// voice layer.
function ListenButton({ text }) {
  const [state, setState] = useState('idle'); // idle | loading | playing
  const [err, setErr] = useState(false);
  const controllerRef = useRef(null);
  const mountedRef = useRef(true);

  // Stop any speech in flight when the tab/study changes (remounts via `key`)
  // or the component unmounts — never let two reads overlap, and never touch
  // state after the async speakWithBrowser() resolves post-unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (controllerRef.current) { try { controllerRef.current.stop(); } catch { /* noop */ } }
    };
  }, []);

  if (!browserSpeechSupported()) return null;

  async function onClick() {
    if (controllerRef.current) {
      controllerRef.current.stop();
      controllerRef.current = null;
      setState('idle');
      return;
    }
    warmUpSpeech(); // unlock speechSynthesis inside this click gesture (iOS/Safari)
    setState('loading');
    setErr(false);
    try {
      const controller = await speakWithBrowser({
        text,
        lang: 'en',
        onEnd: () => { controllerRef.current = null; if (mountedRef.current) setState('idle'); },
        onError: () => { controllerRef.current = null; if (mountedRef.current) { setState('idle'); setErr(true); } },
      });
      if (!mountedRef.current) { controller.stop(); return; }
      controllerRef.current = controller;
      setState('playing');
    } catch {
      controllerRef.current = null;
      if (mountedRef.current) { setState('idle'); setErr(true); }
    }
  }

  const label = state === 'loading' ? 'Loading voice…' : state === 'playing' ? 'Stop' : 'Listen';

  return (
    <div className="shub-listen-wrap">
      <button
        type="button"
        className={`shub-listen${state === 'playing' ? ' is-playing' : ''}`}
        onClick={onClick}
        disabled={state === 'loading'}
        aria-label={`${label} to this section`}
      >
        <span className="shub-listen-ic" aria-hidden="true">{state === 'playing' ? '◼' : '🔊'}</span>
        {label}
      </button>
      {err ? <span className="shub-listen-err" role="status">Voice unavailable on this device.</span> : null}
    </div>
  );
}
