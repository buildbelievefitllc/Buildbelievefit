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
import { scienceHubVoiceUrl } from '../lib/scienceHubVoice.js';
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
          <ListenButton key={`${study.id}-${tab}`} studyId={study.id} tabId={activeTab.id} text={toSpeak} />
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

// Read the active tab's content aloud in Coach Akeem's REAL voice. PRIMARY path:
// the pre-rendered ElevenLabs clip for this (studyId, tabId) — a permanent public
// MP3 baked ONCE into the coach-static bucket (scienceHubVoiceManifest.json),
// zero cost per listen. FAILURE-ONLY fallback: if the manifest has no clip for
// this tab, or the <audio> element fails to load/play, it degrades to the
// device's built-in stock voice (window.speechSynthesis) reading the same script
// — mirroring vault/CoachAudioButton.jsx's premium-primary / stock-voice pattern.
function ListenButton({ studyId, tabId, text }) {
  const url = scienceHubVoiceUrl(studyId, tabId);
  const [state, setState] = useState('idle'); // idle | loading | playing
  const [stock, setStock] = useState(false);   // true while the stock fallback speaks
  const [err, setErr] = useState(false);
  const audioRef = useRef(null);
  const controllerRef = useRef(null);          // active stock-voice controller (fallback)
  const fallingBackRef = useRef(false);        // guards against a double fallback (play() catch + audio onError)
  const mountedRef = useRef(true);

  // Stop any playback in flight when the tab/study changes (remounts via `key`)
  // or the component unmounts — never let two reads overlap, and never touch
  // state after the async speakWithBrowser() resolves post-unmount.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (controllerRef.current) { try { controllerRef.current.stop(); } catch { /* noop */ } }
    };
  }, []);

  // Nothing to offer if there's no premium clip AND no stock engine on the device.
  if (!url && !browserSpeechSupported()) return null;

  // FAILURE-ONLY: device stock voice reading the same baked script. Never primary.
  async function fallbackToStock() {
    if (controllerRef.current || fallingBackRef.current) return; // already falling back
    fallingBackRef.current = true;
    if (!browserSpeechSupported()) { fallingBackRef.current = false; if (mountedRef.current) { setState('idle'); setErr(true); } return; }
    try {
      const controller = await speakWithBrowser({
        text,
        lang: 'en',
        onEnd: () => { controllerRef.current = null; if (mountedRef.current) { setState('idle'); setStock(false); } },
        onError: () => { controllerRef.current = null; if (mountedRef.current) { setState('idle'); setStock(false); setErr(true); } },
      });
      fallingBackRef.current = false;
      if (!mountedRef.current) { controller.stop(); return; }
      controllerRef.current = controller;
      setStock(true);
      setState('playing');
    } catch {
      fallingBackRef.current = false;
      controllerRef.current = null;
      if (mountedRef.current) { setState('idle'); setStock(false); setErr(true); }
    }
  }

  async function onClick() {
    // Toggle an active stock-voice fallback.
    if (controllerRef.current) {
      try { controllerRef.current.stop(); } catch { /* noop */ }
      controllerRef.current = null;
      setState('idle'); setStock(false);
      return;
    }
    // Toggle the premium clip mid-play.
    const el = audioRef.current;
    if (url && el && state === 'playing') { el.pause(); return; }

    // Unlock speechSynthesis inside this click gesture (iOS/Safari) before any
    // async hop — cheap no-op when the premium path succeeds.
    warmUpSpeech();
    setErr(false);

    // PRIMARY: the pre-rendered Akeem clip via the <audio> element.
    if (url && el) {
      setState('loading');
      try { await el.play(); }        // onPlay → state:playing; onError → fallback
      catch { await fallbackToStock(); }
      return;
    }

    // No clip for this tab → straight to the stock-voice fallback.
    setState('loading');
    await fallbackToStock();
  }

  const label = state === 'loading' ? 'Loading voice…'
    : state === 'playing' ? (stock ? 'Stop · stock voice' : 'Pause')
    : 'Listen';

  return (
    <div className="shub-listen-wrap">
      <button
        type="button"
        className={`shub-listen${state === 'playing' ? ' is-playing' : ''}`}
        onClick={onClick}
        disabled={state === 'loading'}
        aria-label={`${label} to Coach Akeem read this section`}
      >
        <span className="shub-listen-ic" aria-hidden="true">{state === 'playing' ? '◼' : '🔊'}</span>
        {label}
      </button>
      {err ? <span className="shub-listen-err" role="status">Voice unavailable on this device.</span> : null}
      {url ? (
        <audio
          ref={audioRef}
          src={url}
          onPlay={() => { if (mountedRef.current) { setState('playing'); setStock(false); } }}
          onPause={() => { if (mountedRef.current && !stock) setState('idle'); }}
          onEnded={() => { if (mountedRef.current) setState('idle'); }}
          onError={() => { if (!controllerRef.current) fallbackToStock(); }}
          preload="none"
        />
      ) : null}
    </div>
  );
}
