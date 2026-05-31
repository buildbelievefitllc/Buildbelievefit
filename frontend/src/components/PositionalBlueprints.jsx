// src/components/PositionalBlueprints.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 17.8 — "Elite Position. Your Playbook." restored into React.
//
// Faithful rebuild of the legacy #playbooks section: a tabbed sport bar (5 sports)
// driving a grid of position cards (25 total). Each card shows the position
// abbreviation, its KPI trait chips, and the first Lab-Verified drill (name +
// focus, truncated to 80 chars) — exactly like the legacy pbRenderPositions().
//
// Data is VERBATIM from the legacy: drills from data/workoutCatalog.js (migrated
// from workout-data.js), sports + KPI traits from data/positionalBlueprints.js
// (from EXP_SPORTS + EXP_KPI). Drill name/focus are trilingual; the rest of the
// chrome resolves through t(). Brand: purple/gold (purple→gold accent bar, gold
// KPI chips, purple drill border) — matches the legacy dark aesthetic.

import { useState } from 'react';
import { useLang } from '../context/LangContext.jsx';
import { SPORTS, POSITION_KPIS } from '../data/positionalBlueprints.js';
import { WORKOUT_CATALOG } from '../data/workoutCatalog.js';

const GOLD = '#f5c800';
const PUR = '#6a0dad';
const PURL = '#8b1abf';
const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";

export default function PositionalBlueprints() {
  const { t, lang } = useLang();
  const [active, setActive] = useState(SPORTS[0].id);

  const sport = SPORTS.find((s) => s.id === active) || SPORTS[0];
  const catalog = WORKOUT_CATALOG[active] || {};
  // Render in the catalog's own position order (matches the legacy Object.keys).
  const positions = sport.positions.filter((p) => catalog[p]);

  return (
    <section id="playbooks" style={st.section}>
      <div style={st.glow} aria-hidden="true" />
      <div style={st.inner}>
        <header style={st.head}>
          <p style={st.kicker}>{t('pb-kicker')}</p>
          <h2 style={st.title}>{t('pb-title')}</h2>
          <p style={st.sub}>{t('pb-sub')}</p>
        </header>

        {/* Sport tab bar */}
        <div style={st.sportBar} role="tablist" aria-label="Sports">
          {SPORTS.map((s) => {
            const on = s.id === active;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActive(s.id)}
                style={{ ...st.sportBtn, ...(on ? st.sportBtnOn : null) }}
              >
                <span style={st.sportIcon}>{s.icon}</span>
                <span style={{ ...st.sportName, color: on ? GOLD : '#aaa' }}>{t(s.nameKey)}</span>
              </button>
            );
          })}
        </div>

        {/* Position card grid */}
        <div style={st.grid}>
          {positions.map((pos) => (
            <PositionCard key={pos} pos={pos} drills={catalog[pos]} lang={lang} t={t} />
          ))}
        </div>

        <div style={st.ctaWrap}>
          <a href="#pathfinder" style={st.cta}>{t('pb-cta')}</a>
        </div>
      </div>
    </section>
  );
}

function PositionCard({ pos, drills, lang, t }) {
  const kpis = (POSITION_KPIS[pos] || []).slice(0, 3);
  const first = Array.isArray(drills) && drills[0] ? drills[0] : null;
  const drillName = first ? (first.name[lang] || first.name.en) : '';
  const drillFocus = first ? (first.focus[lang] || first.focus.en) : '';

  return (
    <div style={st.card}>
      <div style={st.cardAccent} aria-hidden="true" />
      <div style={st.pos}>{pos}</div>
      <div style={st.chips}>
        {kpis.map((k) => <span key={k} style={st.chip}>{k}</span>)}
      </div>
      {first ? (
        <div style={st.drill}>
          <div style={st.drillLbl}>{t('pb-lab-verified')}</div>
          <div style={st.drillName}>{drillName}</div>
          <div style={st.drillFocus}>{drillFocus.length > 80 ? `${drillFocus.slice(0, 80)}…` : drillFocus}</div>
        </div>
      ) : null}
      <div style={st.founderNote}>{t('pb-founder-note')}</div>
    </div>
  );
}

const st = {
  section: { position: 'relative', background: '#0e0e0e', padding: 'clamp(48px,8vw,80px) clamp(16px,4vw,40px)', borderTop: `1px solid rgba(106,13,173,.3)`, borderBottom: `1px solid rgba(106,13,173,.3)`, overflow: 'hidden' },
  glow: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 400, background: `radial-gradient(ellipse, rgba(106,13,173,.18) 0%, transparent 70%)`, filter: 'blur(60px)', pointerEvents: 'none' },
  inner: { position: 'relative', zIndex: 2, maxWidth: 1100, margin: '0 auto' },
  head: { textAlign: 'center', marginBottom: '3rem' },
  kicker: { fontFamily: BODY, fontSize: '.75rem', fontWeight: 700, letterSpacing: '4px', textTransform: 'uppercase', color: GOLD, marginBottom: 12 },
  title: { fontFamily: HEAD, fontSize: 'clamp(2.5rem,5.5vw,4.5rem)', lineHeight: .92, letterSpacing: '2px', color: '#fff', marginBottom: 16, textTransform: 'uppercase' },
  sub: { fontFamily: BODY, fontSize: '1.05rem', color: 'rgba(232,232,232,.6)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto' },

  sportBar: { display: 'flex', justifyContent: 'center', gap: 10, marginBottom: '2rem', flexWrap: 'wrap' },
  sportBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem', padding: '1rem 1.5rem', background: 'rgba(20,20,20,.9)', border: '2px solid #2a2a2a', borderRadius: 14, cursor: 'pointer', transition: 'all .25s', minWidth: 90 },
  sportBtnOn: { background: 'rgba(106,13,173,.35)', border: `2px solid ${GOLD}` },
  sportIcon: { fontSize: '2.5rem', lineHeight: 1 },
  sportName: { fontFamily: HEAD, fontSize: '.85rem', letterSpacing: '2px' },

  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 12, marginBottom: '2rem' },
  card: { position: 'relative', background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, padding: '1.5rem', overflow: 'hidden' },
  cardAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${PUR}, ${GOLD})` },
  pos: { fontFamily: HEAD, fontSize: '1.6rem', letterSpacing: '2px', color: '#fff', marginBottom: '.5rem' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '.8rem' },
  chip: { fontFamily: BODY, fontSize: '.6rem', fontWeight: 700, letterSpacing: '1px', padding: '2px 6px', background: 'rgba(245,200,0,.08)', border: '1px solid rgba(245,200,0,.15)', borderRadius: 10, color: GOLD },
  drill: { background: '#0a0a0a', borderLeft: `3px solid ${PUR}`, borderRadius: '0 6px 6px 0', padding: '.6rem .8rem', marginBottom: '.8rem' },
  drillLbl: { fontFamily: BODY, fontSize: '.55rem', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', color: PURL, marginBottom: '.2rem' },
  drillName: { fontFamily: BODY, fontSize: '.85rem', fontWeight: 700, color: '#ddd' },
  drillFocus: { fontFamily: BODY, fontSize: '.7rem', color: '#888', marginTop: '.2rem', lineHeight: 1.4 },
  founderNote: { fontFamily: BODY, fontSize: '.58rem', color: '#555', fontStyle: 'italic', textAlign: 'center' },

  ctaWrap: { textAlign: 'center', marginTop: '1rem' },
  cta: { display: 'inline-block', background: GOLD, color: '#0e0e0e', fontFamily: HEAD, fontSize: '1.1rem', letterSpacing: '3px', padding: '16px 40px', borderRadius: 4, textDecoration: 'none', boxShadow: `0 8px 30px rgba(245,200,0,.2)` },
};
