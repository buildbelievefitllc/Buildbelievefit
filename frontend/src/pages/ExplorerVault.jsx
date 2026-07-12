// src/pages/ExplorerVault.jsx
// ─────────────────────────────────────────────────────────────────────────────
// EXPLORER MODE — the read-only guest sandbox (conversion funnel upgrade).
//
// An anonymous visitor who submitted the TDEE / Daily Burn calculator holds a
// bbf.explorer.token.v1 guest envelope (lib/explorerSession.js) and lands here
// at /explore — a PARALLEL shell to the authenticated vault, never inside it
// (VaultRoute still gates /vault on a real user; a guest token unlocks zero
// server surface). The shell demonstrates value with the visitor's OWN numbers:
//
//   01 FUEL TARGETS   — a presentational clone of the premium Nutrition Locker
//                       (plan banner · conic macro wheel · target legend ·
//                       ratio bar · fasting pace + eating-window timeline),
//                       data-bound to the guest's OWN numbers via the SAME
//                       nutritionEngine math the paid vault runs
//                       (GuestFuelDashboard — zero Supabase).
//   02 DAY 1 PROGRAM  — a static Day-1 programming preview from the authorized
//                       catalog (programData.js), expandable per exercise.
//   03 BIOMETRIC SYNC — a read-only clone of the Client Hub Check-In
//                       (GuestCheckInPreview): manual tracking sliders + a
//                       fixed Sovereign Readiness 89 · Prime Execution dial.
//   04 COACH AUDIO    — the ACTUAL "Breaking the Loop" media container
//                       (CoachVoiceNote — a pure static <audio> transport, no
//                       API/entitlement surface) streaming the official
//                       EN/ES/PT masterclass voice-clone sessions.
//
// STREAMLINED DECK (v2): Live Coach Chat is retired from the guest nav — a
// 4-tab rail reads cleaner on mobile and every remaining tab is already an
// open preview (no locked panels left to render).
//
// THE CONVERSION PORTAL: every gated touchpoint — the header 'Break the Loop'
// button, the Sync/Audio upsell notes, the Check-In preview's Save CTA — opens
// the SAME gold portal modal. Its primary action now routes to /protocol-init
// ('Protocol Initialization'), which embeds the REAL Pathfinder intake
// (screening + liability shield, unchanged). Finishing that intake forwards
// the collected biometrics through router state and lands the visitor on
// /select-tier to pick a plan — screening-first, pricing-second.
//
// LOCKED §10 compliance: this is a numbered TAB DECK (one panel mounted at a
// time), never a vertical stack. Brand: BBF Purple #6a0dad structure, Victory
// Gold #f5c800 reserved for the conversion CTA.

import { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useLang } from '../context/LangContext.jsx';
import { readExplorerSession, clearExplorerSession } from '../lib/explorerSession.js';
import { calcTDEE, calcMacros } from '../components/vault/nutritionEngine.js';
import { getProgram, DEFAULT_PROGRAM_KEY } from '../components/vault/programData.js';
import GuestFuelDashboard from '../components/explorer/GuestFuelDashboard.jsx';
import GuestCheckInPreview from '../components/explorer/GuestCheckInPreview.jsx';
import CoachVoiceNote from '../components/vault/CoachVoiceNote.jsx';
import '../components/explorer/explorerPreviews.css';

const GOAL_ADJ = { cut: -500, maintain: 0, gain: 300 };

const STR = {
  en: {
    mode: 'Explorer Mode', sub: 'Your numbers, live inside the platform. Read-only sandbox — full sovereign execution unlocks after Protocol Initialization.',
    break: 'Break the Loop', exit: 'Exit',
    tabs: { fuel: 'Fuel Targets', day1: 'Day 1 Program', sync: 'Biometric Sync', audio: 'Coach Audio' },
    goal: { cut: 'Cut', maintain: 'Maintain', gain: 'Build' },
    fuelKicker: 'Your Daily Fuel Contract', target: 'Target', maintenance: 'Maintenance',
    day1Kicker: 'Day 1 · What Training Actually Looks Like', restNote: 'Programmed recovery — growth happens here.',
    sets: 'sets', reps: 'reps',
    lockedSync: 'Wearable + Health Connect biometric syncing drives the adaptive engine — members only.',
    lockedAudio: 'Custom Akeem-narrated session audio is generated per athlete — members only.',
    unlock: 'Unlock Full Protocol',
    audioKicker: 'Coach Audio · Breaking the Loop',
    audioIntro: 'Three masterclass sessions in Coach Akeem’s own cloned voice — the exact audio engine that narrates every stage of the member protocol. Streams in your language.',
    modalKicker: 'Surface Layer Complete', modalTitle: 'Unlock Full Protocol',
    modalBody: 'The wheel you just spun is the demo. Full sovereign execution — macros, programming, and recovery engineered to YOUR biometrics every single day — starts with a 60-second Protocol Initialization.',
    modalCta: 'Begin Protocol Initialization', modalClose: 'Keep exploring',
  },
  es: {
    mode: 'Modo Explorador', sub: 'Tus números, vivos dentro de la plataforma. Sandbox de solo lectura — la ejecución soberana completa se desbloquea tras la Inicialización de Protocolo.',
    break: 'Rompe el Ciclo', exit: 'Salir',
    tabs: { fuel: 'Metas de Combustible', day1: 'Programa Día 1', sync: 'Sincronización Biométrica', audio: 'Audio del Coach' },
    goal: { cut: 'Definir', maintain: 'Mantener', gain: 'Construir' },
    fuelKicker: 'Tu Contrato Diario de Combustible', target: 'Objetivo', maintenance: 'Mantenimiento',
    day1Kicker: 'Día 1 · Cómo se ve el entrenamiento real', restNote: 'Recuperación programada — aquí ocurre el crecimiento.',
    sets: 'series', reps: 'reps',
    lockedSync: 'La sincronización biométrica de wearables impulsa el motor adaptativo — solo miembros.',
    lockedAudio: 'El audio de sesión narrado por Akeem se genera por atleta — solo miembros.',
    unlock: 'Desbloquear Protocolo Completo',
    audioKicker: 'Audio del Coach · Rompiendo el Ciclo',
    audioIntro: 'Tres sesiones magistrales con la voz clonada del Coach Akeem — el mismo motor de audio que narra cada etapa del protocolo de miembros. Se reproduce en tu idioma.',
    modalKicker: 'Capa de Superficie Completa', modalTitle: 'Desbloquea el Protocolo Completo',
    modalBody: 'La rueda que giraste es la demo. La ejecución soberana completa — macros, programación y recuperación diseñados para TUS biométricos cada día — comienza con una Inicialización de Protocolo de 60 segundos.',
    modalCta: 'Iniciar Protocolo', modalClose: 'Seguir explorando',
  },
  pt: {
    mode: 'Modo Explorador', sub: 'Seus números, vivos dentro da plataforma. Sandbox somente leitura — a execução soberana completa desbloqueia após a Inicialização de Protocolo.',
    break: 'Quebre o Ciclo', exit: 'Sair',
    tabs: { fuel: 'Metas de Combustível', day1: 'Programa Dia 1', sync: 'Sincronização Biométrica', audio: 'Áudio do Coach' },
    goal: { cut: 'Definir', maintain: 'Manter', gain: 'Construir' },
    fuelKicker: 'Seu Contrato Diário de Combustível', target: 'Meta', maintenance: 'Manutenção',
    day1Kicker: 'Dia 1 · Como é o treino de verdade', restNote: 'Recuperação programada — o crescimento acontece aqui.',
    sets: 'séries', reps: 'reps',
    lockedSync: 'A sincronização biométrica de wearables move o motor adaptativo — somente membros.',
    lockedAudio: 'O áudio de sessão narrado pelo Akeem é gerado por atleta — somente membros.',
    unlock: 'Desbloquear Protocolo Completo',
    audioKicker: 'Áudio do Coach · Quebrando o Ciclo',
    audioIntro: 'Três sessões magistrais com a voz clonada do Coach Akeem — o mesmo motor de áudio que narra cada etapa do protocolo de membros. Toca no seu idioma.',
    modalKicker: 'Camada de Superfície Completa', modalTitle: 'Desbloqueie o Protocolo Completo',
    modalBody: 'A roda que você girou é a demo. A execução soberana completa — macros, programação e recuperação projetados para SEUS biométricos todos os dias — começa com uma Inicialização de Protocolo de 60 segundos.',
    modalCta: 'Iniciar Protocolo', modalClose: 'Continuar explorando',
  },
};

// Every remaining tab is an open PREVIEW panel — read-only visual clones or
// static media, zero server surface, nothing left to hard-lock — so the deck
// is just the ordered tab ids (the numbered index is derived from position).
const DECK = ['fuel', 'day1', 'sync', 'audio'];

// ── Day-1 preview — static authorized catalog, expandable rows, zero writes ──
function Day1Preview({ tr }) {
  const [open, setOpen] = useState(0);
  const day1 = useMemo(() => {
    const plan = getProgram(DEFAULT_PROGRAM_KEY);
    return plan.find((d) => !d.isRest && Array.isArray(d.exercises) && d.exercises.length) || plan[0];
  }, []);
  if (!day1) return null;
  return (
    <div data-testid="explorer-day1">
      <div style={s.panelKicker}>{tr.day1Kicker}</div>
      <div style={s.dayHead}>
        <span style={s.dayName}>{day1.day}</span>
        <span style={s.dayFocus}>{day1.focus}</span>
      </div>
      {day1.isRest ? <p style={s.body}>{tr.restNote}</p> : (
        <ul style={s.exList}>
          {day1.exercises.map((ex, i) => (
            <li key={ex.name} style={s.exItem}>
              <button
                type="button"
                style={s.exRow}
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? -1 : i)}
                data-testid={`explorer-ex-${i}`}
              >
                <span style={s.exName}>{ex.name}</span>
                <span style={s.exDose}>{ex.sets} {tr.sets} · {ex.reps} {tr.reps}</span>
                <span style={s.exChev}>{open === i ? '▴' : '▾'}</span>
              </button>
              {open === i ? (
                <div style={s.exDetail}>
                  <span style={s.exEquip}>{ex.equipment}</span>
                  {ex.notes ? <p style={s.exNotes}>{ex.notes}</p> : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── The gold-accented conversion portal (UpgradeOverlay visual language) ─────
// Single primary action: every gated touchpoint funnels here, and the CTA
// routes to /protocol-init (the Pathfinder intake, reframed as the guest's
// entry ritual) — screening first, pricing second. Router state carries the
// biometrics forward so the intake never re-asks what /burn already captured.
function BreakTheLoopModal({ tr, prefill, onClose }) {
  const navigate = useNavigate();
  return (
    <div style={s.modalScrim} role="dialog" aria-modal="true" aria-label={tr.modalTitle} data-testid="break-the-loop-modal">
      <div style={s.modalCard}>
        <span style={s.modalLock} aria-hidden="true">🔒</span>
        <div style={s.modalKicker}>{tr.modalKicker}</div>
        <h2 style={s.modalTitle}>{tr.modalTitle}</h2>
        <p style={s.modalBody}>{tr.modalBody}</p>
        <button
          type="button"
          style={s.modalCta}
          data-testid="break-the-loop-cta"
          onClick={() => navigate('/protocol-init', { state: { prefill } })}
        >
          {tr.modalCta} →
        </button>
        <button type="button" style={s.modalClose} onClick={onClose} data-testid="break-the-loop-close">
          {tr.modalClose}
        </button>
      </div>
    </div>
  );
}

export default function ExplorerVault() {
  const { lang } = useLang();
  const tr = STR[lang] || STR.en;
  const session = useMemo(() => readExplorerSession(), []);
  const [tab, setTab] = useState('fuel');
  const [modalOpen, setModalOpen] = useState(false);
  const [goal, setGoal] = useState(session?.targets?.goal || 'maintain');
  const navigate = useNavigate();

  const { profile = {}, targets = {} } = session || {};

  // Interactive re-targeting: with full biometrics the SAME vault math recomputes
  // live; with a burn-only envelope the stored maintenance number scales by goal.
  // Plain derivation (no memo) — it must run unconditionally above the guest
  // gate so the hook order never branches, and the math is trivially cheap.
  const computed = (() => {
    const adj = GOAL_ADJ[goal] ?? 0;
    const { age, sex, weight_lbs, height_ft, height_in, activity_factor } = profile;
    if (age && weight_lbs && height_ft != null) {
      const base = calcTDEE(age, sex || 'male', weight_lbs, height_ft, height_in || 0, activity_factor || 1.375);
      const target = base + adj;
      return { base, target, ...calcMacros(target, weight_lbs, adj) };
    }
    const base = Number(targets.tdee_maintenance) || Number(targets.tdee_target) || 2000;
    const target = base + adj;
    const wt = Number(profile.weight_lbs) || 170;
    return { base, target, ...calcMacros(target, wt, adj) };
  })();

  // No guest envelope → back to the calculator entry (the token mints there).
  if (!session) return <Navigate to="/burn" replace />;

  const prefill = {
    age: profile.age != null ? String(profile.age) : '',
    sex: profile.sex || 'male',
    weight: profile.weight_lbs != null ? String(profile.weight_lbs) : '',
    heightFt: profile.height_ft != null ? String(profile.height_ft) : '',
    heightIn: profile.height_in != null ? String(profile.height_in) : '',
  };

  return (
    <div style={s.shell} data-bbf-mode="explorer" data-testid="explorer-vault">
      <header style={s.head}>
        <div>
          <span style={s.modeChip} data-testid="explorer-mode-chip">◇ {tr.mode}</span>
          <p style={s.sub}>{tr.sub}</p>
        </div>
        <div style={s.headActions}>
          <button type="button" style={s.breakBtn} onClick={() => setModalOpen(true)} data-testid="explorer-break-open">
            ⚡ {tr.break}
          </button>
          <button
            type="button"
            style={s.exitBtn}
            onClick={() => { clearExplorerSession(); navigate('/', { replace: true }); }}
          >
            {tr.exit}
          </button>
        </div>
      </header>

      {/* LOCKED §10 — numbered tab deck, one mounted panel, no vertical stack.
          4 ultra-clean tabs (Live Coach Chat retired) — reads cleaner on mobile. */}
      <div style={s.tabbar} role="tablist" aria-label={tr.mode}>
        {DECK.map((id, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            style={{ ...s.tab, ...(tab === id ? s.tabActive : null) }}
            onClick={() => setTab(id)}
            data-testid={`explorer-tab-${id}`}
          >
            <span style={{ ...s.tabIdx, ...(tab === id ? s.tabIdxActive : null) }}>{String(i + 1).padStart(2, '0')}</span>
            <span style={s.tabLabel}>{tr.tabs[id]}</span>
          </button>
        ))}
      </div>

      <main style={s.panel}>
        {tab === 'fuel' ? (
          <div data-testid="explorer-fuel">
            <div style={s.panelKicker}>{tr.fuelKicker}</div>
            <div style={s.goalRow} role="tablist" aria-label="Goal">
              {Object.keys(GOAL_ADJ).map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  aria-selected={goal === g}
                  style={{ ...s.goalChip, ...(goal === g ? s.goalChipOn : null) }}
                  onClick={() => setGoal(g)}
                  data-testid={`explorer-goal-${g}`}
                >
                  {tr.goal[g]}
                </button>
              ))}
            </div>
            <GuestFuelDashboard
              base={computed.base}
              target={computed.target}
              p={computed.p}
              c={computed.c}
              f={computed.f}
            />
          </div>
        ) : null}

        {tab === 'day1' ? <Day1Preview tr={tr} /> : null}

        {/* 04 · Biometric Sync — read-only Client Hub Check-In clone. The Save
            CTA and the upsell note both route into the conversion portal. */}
        {tab === 'sync' ? (
          <div>
            <GuestCheckInPreview onUnlock={() => setModalOpen(true)} />
            <div className="xp-upsell-note">
              <p>{tr.lockedSync}</p>
              <button type="button" onClick={() => setModalOpen(true)} data-testid="explorer-sync-upsell">
                {tr.unlock} →
              </button>
            </div>
          </div>
        ) : null}

        {/* 05 · Coach Audio — the ACTUAL "Breaking the Loop" media container
            (CoachVoiceNote: pure static <audio>, no API/entitlement surface)
            streaming the official EN/ES/PT masterclass voice-clone sessions.
            The players localize with the app language automatically. */}
        {tab === 'audio' ? (
          <div data-testid="explorer-audio">
            <div style={s.panelKicker}>{tr.audioKicker}</div>
            <p style={s.body}>{tr.audioIntro}</p>
            <div className="xp-audio-list">
              <CoachVoiceNote module="primer" />
              <CoachVoiceNote module="fuel" />
              <CoachVoiceNote module="flush" />
            </div>
            <div className="xp-upsell-note">
              <p>{tr.lockedAudio}</p>
              <button type="button" onClick={() => setModalOpen(true)} data-testid="explorer-audio-upsell">
                {tr.unlock} →
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {modalOpen ? <BreakTheLoopModal tr={tr} prefill={prefill} onClose={() => setModalOpen(false)} /> : null}
    </div>
  );
}

const HEAD = "'Bebas Neue',sans-serif";
const BODY = "'Barlow Condensed',sans-serif";
const PUR = '#6a0dad';
const GOLD = '#f5c800';

const s = {
  shell: { minHeight: '100vh', background: '#090909', color: '#f9f5ff', padding: '1.2rem clamp(1rem, 4vw, 2.4rem) 3rem' },
  head: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.1rem' },
  modeChip: {
    display: 'inline-block', fontFamily: HEAD, fontSize: '1.05rem', letterSpacing: '3px', textTransform: 'uppercase',
    color: '#fff', background: `linear-gradient(135deg, ${PUR}, #8b2fd6)`, borderRadius: 999, padding: '.35rem 1rem',
  },
  sub: { fontFamily: BODY, fontSize: '.95rem', color: 'rgba(249,245,255,.65)', margin: '.5rem 0 0', maxWidth: 520 },
  headActions: { display: 'flex', gap: '.6rem', alignItems: 'center' },
  breakBtn: {
    fontFamily: HEAD, fontSize: '1rem', letterSpacing: '2px', textTransform: 'uppercase', color: '#1B1106',
    background: `linear-gradient(180deg, ${GOLD}, #d4af37)`, border: 'none', borderRadius: 10,
    padding: '.6rem 1.2rem', cursor: 'pointer', boxShadow: '0 10px 30px rgba(245,200,0,.28)',
  },
  exitBtn: {
    fontFamily: BODY, fontSize: '.8rem', letterSpacing: '1px', textTransform: 'uppercase',
    background: 'transparent', color: 'rgba(249,245,255,.55)', border: '1px solid rgba(249,245,255,.2)',
    borderRadius: 10, padding: '.6rem .9rem', cursor: 'pointer',
  },
  tabbar: { display: 'flex', gap: '.4rem', flexWrap: 'wrap', borderBottom: `1px solid rgba(106,13,173,.4)`, paddingBottom: '.6rem', marginBottom: '1.1rem' },
  tab: {
    display: 'flex', alignItems: 'center', gap: '.45rem', background: 'rgba(255,255,255,.03)',
    border: '1px solid rgba(249,245,255,.12)', borderRadius: 10, padding: '.5rem .8rem', cursor: 'pointer',
  },
  tabActive: { background: 'rgba(106,13,173,.28)', border: `1px solid ${PUR}` },
  tabIdx: { fontFamily: HEAD, fontSize: '.8rem', color: 'rgba(249,245,255,.4)', letterSpacing: '1px' },
  tabIdxActive: { color: GOLD },
  tabLabel: { fontFamily: HEAD, fontSize: '.92rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#f9f5ff' },
  panel: { maxWidth: 820 },
  panelKicker: { fontFamily: HEAD, fontSize: '.85rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: GOLD, marginBottom: '.8rem' },
  body: { fontFamily: BODY, fontSize: '.95rem', color: 'rgba(249,245,255,.7)', lineHeight: 1.5 },
  goalRow: { display: 'flex', gap: '.45rem', marginBottom: '1rem' },
  goalChip: {
    fontFamily: BODY, fontSize: '.85rem', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase',
    background: 'transparent', color: 'rgba(249,245,255,.6)', border: '1px solid rgba(249,245,255,.2)',
    borderRadius: 999, padding: '.35rem .9rem', cursor: 'pointer',
  },
  goalChipOn: { color: '#fff', border: `1px solid ${PUR}`, background: 'rgba(106,13,173,.35)' },
  dayHead: { display: 'flex', alignItems: 'baseline', gap: '.8rem', marginBottom: '.8rem' },
  dayName: { fontFamily: HEAD, fontSize: '1.5rem', letterSpacing: '1px', color: '#fff' },
  dayFocus: { fontFamily: BODY, fontSize: '.9rem', color: GOLD, letterSpacing: '1px', textTransform: 'uppercase' },
  exList: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.45rem' },
  exItem: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(249,245,255,.1)', borderRadius: 10 },
  exRow: { display: 'flex', alignItems: 'center', gap: '.7rem', width: '100%', background: 'transparent', border: 'none', padding: '.7rem .9rem', cursor: 'pointer', textAlign: 'left' },
  exName: { fontFamily: HEAD, fontSize: '1rem', letterSpacing: '1px', color: '#f9f5ff', flex: 1 },
  exDose: { fontFamily: BODY, fontSize: '.82rem', color: GOLD, whiteSpace: 'nowrap' },
  exChev: { color: 'rgba(249,245,255,.45)' },
  exDetail: { padding: '0 .9rem .8rem' },
  exEquip: { fontFamily: BODY, fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'rgba(249,245,255,.5)' },
  exNotes: { fontFamily: BODY, fontSize: '.9rem', color: 'rgba(249,245,255,.75)', lineHeight: 1.5, margin: '.35rem 0 0' },
  modalScrim: {
    position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center',
    background: 'radial-gradient(ellipse at center, rgba(106,13,173,.22), rgba(9,9,9,.94) 70%)', padding: '1rem',
  },
  modalCard: {
    width: 'min(440px, 100%)', background: 'linear-gradient(180deg, #160a26, #0a0710)',
    border: '1px solid rgba(106,13,173,.45)', borderTop: `3px solid ${PUR}`, borderRadius: 16,
    boxShadow: '0 30px 80px rgba(0,0,0,.6)', padding: '1.8rem 1.6rem',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '.7rem',
  },
  modalLock: { fontSize: '2rem', filter: 'drop-shadow(0 0 14px rgba(245,200,0,.35))' },
  modalKicker: { fontFamily: HEAD, fontSize: '.8rem', letterSpacing: '.32em', textTransform: 'uppercase', color: GOLD },
  modalTitle: { fontFamily: HEAD, fontSize: '2.1rem', letterSpacing: '1px', textTransform: 'uppercase', color: '#fff', margin: 0, lineHeight: 1 },
  modalBody: { fontFamily: BODY, fontSize: '.98rem', color: 'rgba(249,245,255,.78)', lineHeight: 1.55, margin: 0 },
  modalCta: {
    width: '100%', fontFamily: HEAD, fontSize: '1.1rem', letterSpacing: '2px', textTransform: 'uppercase',
    color: '#1B1106', background: GOLD, border: 'none', borderRadius: 10, padding: '.75rem 1rem',
    cursor: 'pointer', boxShadow: '0 10px 30px rgba(245,200,0,.28)', marginTop: '.4rem',
  },
  modalClose: {
    background: 'transparent', border: 'none', color: 'rgba(249,245,255,.4)', fontFamily: BODY,
    fontSize: '.8rem', letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', marginTop: '.2rem',
  },
};
