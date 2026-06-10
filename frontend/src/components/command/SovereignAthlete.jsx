// src/components/command/SovereignAthlete.jsx
// ─────────────────────────────────────────────────────────────────────────────
// SOVEREIGN TIER athlete dossier — the premium ClientDossier layout for athletes
// (a populated sports_protocol), built to the Mastermind's prototype. These are UI
// SHELLS: the telemetry below (HRV, CNS drift, somatic/movement readiness, recruiting
// highlights, approved foods, supp exclusions) is MOCK data for LAYOUT review only.
// DB hooks get wired later — every mock value is grouped in MOCK / derived from the
// real client row where a column already exists (name, sport, age, macros, phase).
//
// The live, operational controls (Manual Override / Referee, 7-day plans, analytics)
// remain in ClientDossier's DossierBody beneath this — these sections are the
// read/architecture surface, not a replacement for the working decks.

import { useEffect, useRef, useState } from 'react';
import { HRV_BREACH_MS, SLEEP_BREACH_MIN } from '../../lib/wearableApi.js';

// ── MOCK telemetry — LAYOUT ONLY. Replace each with a real column when wired. ─────
const MOCK = {
  focusDirective: 'Increase Acceleration & Route Break Fluidity',
  // HRV / Central Fatigue Drift / Injury Risk are NO LONGER mocked — they come live
  // from bbf_wearable_readings via useAthleteWearable (see BiometricDossier).
  hydration: '4.6 Liters/Day',
  macroStrategy: 'CNS-Restorative Power Loading',
  ratios: { c: 45, p: 32, f: 23 },
  approvedFoods: ['Lean bison flank steak', 'Jasmine rice', 'Avocado slices', 'Wilted spinach broth'],
  suppExclusions: [
    { name: 'Synthetic Stimulants (DMAA / DMHA)', reason: 'Banned — cardiac & CNS risk in minors' },
    { name: 'High-Dose Caffeine (>200mg)', reason: 'Capped — masks central fatigue signal' },
    { name: 'Creatine Loading Protocols', reason: 'Deferred until skeletal maturity (post-PHV)' },
    { name: 'Hormonal / Pro-Hormone Agents', reason: 'Hard-blocked — endocrine protection' },
  ],
  somatic: 100, somaticLimit: 70,
  movement: 92, movementLimit: 75,
  assessmentVelocity: 88,
  formStability: 89,
  recruiting: {
    visibility: 'Public Portfolio Active',
    highlights: [
      { label: 'Exit-Force Vel', value: '1.52 rad/s' },
      { label: 'Spinal Deviation', value: '4.8° Stable' },
    ],
    scoutNote: 'Displays elite acceleration vectors. Dynamic deceleration angles sit in the 90th percentile of high-school defensive secondary lines.',
  },
};

// Sport → a representative position label (mock; real position column wired later).
const SPORT_POS = { Basketball: 'Combo Guard', Football: 'Cornerback', Soccer: 'Central Midfield', 'Track & Field': 'Sprint / 100m', 'Baseball / Softball': 'Two-Way' };

const LIFELINE = [
  { tier: 'Youth Era', ages: 'Ages 6–12', lo: 6, hi: 12, note: 'Gamified coordination, dynamic spatial feedback, skeletal safety boundaries.' },
  { tier: 'Scholastic', ages: 'Ages 13–15', lo: 13, hi: 15, note: 'Introduction to periodization loading. PHV (Peak Height Velocity) tracking to offset growth micro-tears.' },
  { tier: 'High School & Club', ages: 'Ages 16–18', lo: 16, hi: 18, note: 'VBT velocity profiles, elite power optimization, and an active public recruiting dashboard.', chips: ['VBT Profiling', 'Recruiting Live Portfolio', 'Rate-of-Force Vectors'] },
  { tier: 'Collegiate & Pro', ages: 'Ages 18+', lo: 18, hi: 99, note: 'Medical-grade ANS diagnostics, central fatigue metrics, predictive musculoskeletal decay models.' },
];

// Injury Risk Index tiers (derived from live wearable readiness).
const RISK = {
  critical: { label: 'Critical', bg: '#ef4444', fg: '#fff' },
  elevated: { label: 'Elevated', bg: 'var(--orn)', fg: '#090909' },
  low: { label: 'Low', bg: 'var(--grn)', fg: '#04130a' },
  unknown: { label: 'No Sync', bg: 'var(--mut)', fg: '#090909' },
};
const fmtInt = (v) => (v == null ? '—' : String(v));

export default function SovereignAthlete({ c, proto, onQuickAction, wearable }) {
  const sport = proto?.sport || 'Athlete';
  const age = Number(c?.age) || Number(proto?.source_age) || 17;
  const phase = parseInt(proto?.phase_number, 10) || 1;

  return (
    <div style={s.wrap}>
      <BiometricDossier c={c} sport={sport} age={age} phase={phase} onQuickAction={onQuickAction} wearable={wearable} />
      <SovereignRoadmap c={c} />
      <AntiLockoutNode />
      <LifelineRoadmap age={age} />
      <RecruitingPortfolio c={c} />
    </div>
  );
}

// ── 1 · Active Biometric Dossier ─────────────────────────────────────────────────
function BiometricDossier({ c, sport, age, phase, onQuickAction, wearable }) {
  const name = c?.name || c?.uid || 'Unnamed Athlete';
  const pos = c?.position || SPORT_POS[sport] || 'Athlete';
  const chips = [`Age ${age}`, `POS · ${pos}`, 'Highschool Bracket', `Era Phase ${phase}`];

  // LIVE wearable readiness (bbf_wearable_readings) — no mock. null while loading.
  const w = wearable || null;
  const breach = !!w?.breach;
  const risk = RISK[w?.risk] || RISK.unknown;
  const hrvBad = w?.hrv != null && w.hrv < HRV_BREACH_MS;
  const sleepBad = w?.sleep != null && w.sleep < SLEEP_BREACH_MIN;
  const RED = '#ef4444';

  return (
    <section style={{ ...s.card, ...s.dossier, ...(breach ? s.dossierBreach : null) }}>
      <div style={s.dossierTop}>
        <span style={s.avatar}>{initials(name)}</span>
        <div style={s.idCol}>
          <span style={s.sportBadge}>{sport}</span>
          <div style={s.kicker}>Active Biometric Dossier</div>
          <div style={s.name}>{name}</div>
          <div style={s.chipRow}>
            {chips.map((ch) => <span key={ch} style={s.chip}>{ch}</span>)}
          </div>
          <div style={s.directive}><span style={s.directiveLabel}>Focus Directive:</span> <em>{MOCK.focusDirective}</em></div>
        </div>
        <div style={s.bioStats}>
          <BioStat label="Avg HRV Recovery" value={fmtInt(w?.hrv)} unit="ms" tone={hrvBad ? RED : 'var(--wht)'} />
          <BioStat label="Sleep" value={fmtInt(w?.sleep)} unit="min" tone={sleepBad ? RED : 'var(--wht)'} />
          <BioStat label="Central Fatigue Drift" value={w?.cnsDrift != null ? `${w.cnsDrift}%` : '—'} unit="CNS" tone={w?.cnsDrift != null && w.cnsDrift >= 50 ? RED : 'var(--gold-soft)'} />
          <BioStat label="Injury Risk Index" value={risk.label} pill pillBg={risk.bg} pillFg={risk.fg} />
        </div>
        <HeaderActions onAction={onQuickAction} />
      </div>

      {breach ? (
        <div style={s.breachBanner} role="alert">
          ⚠ CNS Breach Detected — HRV <b>{w.hrv}ms</b> (&lt;{HRV_BREACH_MS}) · Sleep <b>{w.sleep}m</b> (&lt;{SLEEP_BREACH_MIN}) · Recovery <b>{w.recovery}</b> · Strain <b>{w.strain}</b>
        </div>
      ) : w && !w.hasData ? (
        <div style={s.noSync}>◌ No wearable sync on file — telemetry populates on the next Health Connect sync.</div>
      ) : null}
    </section>
  );
}

// ── Header quick-actions — secondary, immediate path into the operational decks.
//    Ids match ClientDossier's DECKS; Manual Override leads (the headline control).
const QUICK_ACTIONS = [
  ['override', '⚡ Manual Override', true],
  ['workouts', '🏋 7-Day Workouts'],
  ['nutrition', '🍽 7-Day Nutrition'],
  ['analytics', '📊 Analytics'],
  ['feed', '💬 Athlete Feed Chat'],
  ['target', '⬆ Update Target'],
];

function HeaderActions({ onAction }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Close on outside click / Escape — listeners only while open. setState fires in
  // the subscription callbacks, never the effect body (repo lint rule).
  useEffect(() => {
    if (!open) return undefined;
    function onDocDown(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(id) {
    setOpen(false);
    onAction?.(id);
  }

  return (
    <div ref={boxRef} style={s.actionsWrap}>
      <button
        type="button"
        style={s.actionsBtn}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Athlete quick actions"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open ? (
        <div role="menu" aria-label="Athlete quick actions" style={s.menu}>
          <span style={s.menuHead}>Quick Actions</span>
          {QUICK_ACTIONS.map(([id, label, hot]) => (
            <button
              key={id}
              type="button"
              role="menuitem"
              style={{ ...s.menuItem, ...(hot ? s.menuItemHot : null) }}
              onClick={() => pick(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function BioStat({ label, value, unit, tone, pill, pillBg, pillFg }) {
  return (
    <div style={s.bioStat}>
      <span style={s.bioLabel}>{label}</span>
      {pill
        ? <span style={{ ...s.riskPill, background: pillBg || 'var(--grn)', color: pillFg || '#04130a' }}>{value}</span>
        : <span style={{ ...s.bioVal, color: tone }}>{value}{unit ? <small style={s.bioUnit}> {unit}</small> : null}</span>}
    </div>
  );
}

// ── 2 · Sovereign Development Roadmap (tabbed) ────────────────────────────────────
const ROADMAP_TABS = [['nutrition', 'Nutrition Plan'], ['agecomp', 'Age Comp'], ['exclusions', 'Exclusions']];

function SovereignRoadmap({ c }) {
  const [tab, setTab] = useState('nutrition');
  return (
    <section style={s.card}>
      <div style={s.sectHead}>
        <div>
          <div style={s.kicker}>Athlete Milestone & Bio-Planning</div>
          <h3 style={s.title}>Sovereign Development Roadmap</h3>
        </div>
        <div style={s.pillTabs} role="tablist" aria-label="Development roadmap">
          {ROADMAP_TABS.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id}
              onClick={() => setTab(id)} style={{ ...s.pillTab, ...(tab === id ? s.pillTabOn : null) }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'nutrition' && <NutritionPlanPanel c={c} />}
      {tab === 'agecomp' && <AgeCompPanel />}
      {tab === 'exclusions' && <ExclusionsPanel />}
    </section>
  );
}

function NutritionPlanPanel({ c }) {
  const r = deriveRatios(c) || MOCK.ratios;
  return (
    <>
      <div style={s.stratRow}>
        <div>
          <div style={s.subKicker}>Active Phase Nutrition Macro-Strategy</div>
          <div style={s.strat}>{MOCK.macroStrategy}</div>
        </div>
        <div style={s.hydration}>
          <span style={s.subKicker}>Pre-Hydration Thresholds</span>
          <span style={s.hydrationVal}>{MOCK.hydration}</span>
        </div>
      </div>

      <div style={s.panel}>
        <div style={s.subKicker}>Macronutrient Target Ratios</div>
        <div style={s.ratioLine}>{r.c}% Carbs · {r.p}% Protein · {r.f}% Fats</div>
        <div style={s.macroBar}>
          <span style={{ ...s.macroSeg, flex: r.c, background: 'var(--gold-soft)' }} />
          <span style={{ ...s.macroSeg, flex: r.p, background: 'var(--grn)' }} />
          <span style={{ ...s.macroSeg, flex: r.f, background: 'var(--purl)' }} />
        </div>
        <div style={s.macroLabels}><span>Carbs</span><span>Protein</span><span>Fats</span></div>
      </div>

      <div style={s.panel}>
        <div style={s.subKicker}>Approved Bio-Energetic Foods & Collagen Loading</div>
        <div style={s.foodChips}>
          {MOCK.approvedFoods.map((f) => <span key={f} style={s.foodChip}>🍽 {f}</span>)}
        </div>
      </div>
    </>
  );
}

function AgeCompPanel() {
  // MOCK age-tier percentile comparison (layout shell).
  const rows = [
    ['Relative Strength', 78], ['Sprint / Acceleration', 91], ['Power Output (CMJ)', 84], ['Mobility & Tendon Health', 88],
  ];
  return (
    <div style={s.panel}>
      <div style={s.subKicker}>Percentile vs Age-Tier Cohort (Ages 16–18)</div>
      {rows.map(([label, pct]) => (
        <div key={label} style={s.compRow}>
          <span style={s.compLabel}>{label}</span>
          <div style={s.compTrack}><span style={{ ...s.compFill, width: `${pct}%` }} /></div>
          <span style={s.compPct}>{pct}%</span>
        </div>
      ))}
      <p style={s.muteNote}>Mock cohort percentiles — wires to the combine/VBT telemetry layer.</p>
    </div>
  );
}

function ExclusionsPanel() {
  return (
    <div style={s.panel}>
      <div style={s.subKicker}>Supplement & Compound Exclusions (Minor-Safe Protocol)</div>
      <div style={s.exclList}>
        {MOCK.suppExclusions.map((x) => (
          <div key={x.name} style={s.exclRow}>
            <span style={s.exclMark} aria-hidden="true">⊘</span>
            <div>
              <div style={s.exclName}>{x.name}</div>
              <div style={s.exclReason}>{x.reason}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 3 · Anti-Lockout Tier Assessment Node (interactive simulator) ─────────────────
function AntiLockoutNode() {
  const [somatic, setSomatic] = useState(MOCK.somatic);
  const [movement, setMovement] = useState(MOCK.movement);
  const approved = somatic >= MOCK.somaticLimit && movement >= MOCK.movementLimit;

  return (
    <section style={s.card}>
      <div style={s.sectHead}>
        <div>
          <div style={s.kicker}>The Autonomous Gatekeeper</div>
          <h3 style={s.title}>Anti-Lockout Tier Assessment Node</h3>
        </div>
        <span style={{ ...s.verdictPill, ...(approved ? s.verdictOk : s.verdictLock) }}>
          ⚡ {approved ? 'Autonomic Overload Approved' : 'Conditional Redirection'}
        </span>
      </div>

      <div style={s.panel}>
        <div style={s.simHead}>
          <span style={s.subKicker}>Biotechnical Factor Stressor Simulator</span>
          <span style={s.simHint}>Slide a value below its limit to test conditional redirection.</span>
        </div>
        <div style={s.simGrid}>
          <Slider label="Somatic Readiness Target" value={somatic} limit={MOCK.somaticLimit} onChange={setSomatic}
            note="Corresponds to sleep index, muscle recovery, and vagal tone levels." />
          <Slider label="Movement Quality" value={movement} limit={MOCK.movementLimit} onChange={setMovement}
            note="Calculated from balance tracking, decelerative forces, tendon thickness." />
        </div>
      </div>

      <div style={{ ...s.verdictBox, ...(approved ? s.verdictBoxOk : s.verdictBoxLock) }}>
        <div style={s.verdictTop}>
          <span style={{ ...s.verdictIcon, ...(approved ? s.verdictIconOk : s.verdictIconLock) }} aria-hidden="true">{approved ? '✓' : '⚠'}</span>
          <div>
            <div style={s.verdictTitle}>{approved ? 'All Somatic & Balance Conditions Sparing Limit' : 'Phase Advance Withheld — Telemetry Below Limit'}</div>
            <p style={s.verdictText}>
              {approved
                ? 'Somatic parameters are excellent. Form stability is verified. The kinetic telemetry profile suggests high central nervous system capacitance levels. Athlete is permitted to advance phases.'
                : 'One or more readiness factors fell below the gatekeeper limit. The Autonomous Referee redirects the athlete to a deload/recovery track instead of advancing the phase.'}
            </p>
          </div>
        </div>
        <div style={s.proofRow}>
          <Proof label="Continuous Assessment Velocity" value={`${MOCK.assessmentVelocity}%`} tag="Excellent Momentum" ok />
          <Proof label="Form Stability Proof" value={`${MOCK.formStability}%`} tag="Requires >80%" ok={MOCK.formStability > 80} />
        </div>
      </div>
    </section>
  );
}

function Slider({ label, value, limit, onChange, note }) {
  const ok = value >= limit;
  return (
    <div style={s.sliderCell}>
      <div style={s.sliderHead}>
        <span style={s.sliderLabel}>{label}</span>
        <span style={{ ...s.sliderVal, color: ok ? 'var(--gold-soft)' : 'var(--orn)' }}>{value}% <small style={s.sliderLimit}>(Limit: {limit}%)</small></span>
      </div>
      <input type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label} — ${value}%`} style={{ ...s.range, accentColor: ok ? 'var(--yel)' : 'var(--orn)' }} />
      <span style={s.sliderNote}>{note}</span>
    </div>
  );
}

function Proof({ label, value, tag, ok }) {
  return (
    <div style={s.proof}>
      <span style={s.subKicker}>{label}</span>
      <span style={s.proofVal}>{value} <small style={{ ...s.proofTag, color: ok ? 'var(--grn)' : 'var(--orn)' }}>{tag}</small></span>
    </div>
  );
}

// ── 4 · Lifeline Phase Roadmap ────────────────────────────────────────────────────
function LifelineRoadmap({ age }) {
  return (
    <section style={s.card}>
      <div style={s.sectHead}>
        <div>
          <div style={s.kicker}>📈 Lifelong Development</div>
          <h3 style={s.title}>Lifeline Phase Roadmap</h3>
        </div>
        <span style={s.horizon}>18-Yr Horizon</span>
      </div>
      <p style={s.muteNote}>Adapts telemetry indicators based on the athlete’s age tier.</p>
      <div style={s.lifeline}>
        {LIFELINE.map((t) => {
          const active = age >= t.lo && age <= t.hi;
          return (
            <div key={t.tier} style={{ ...s.lifeRow, ...(active ? s.lifeRowOn : null) }}>
              <div style={s.lifeTop}>
                <span style={s.lifeTier}>{t.tier} <span style={s.lifeAges}>({t.ages})</span></span>
                {active ? <span style={s.activePill}>Active Target</span> : null}
              </div>
              <div style={s.lifeNote}>{t.note}</div>
              {active && t.chips ? (
                <div style={s.lifeChips}>{t.chips.map((ch) => <span key={ch} style={s.lifeChip}>⚡ {ch}</span>)}</div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── 5 · Recruiting Portfolio (Live Bio) ───────────────────────────────────────────
function RecruitingPortfolio({ c }) {
  const [copied, setCopied] = useState(false);
  const url = `https://buildbelievefit.fitness/scout/${c?.uid || 'athlete'}`;
  function copy() {
    try { navigator.clipboard?.writeText(url); } catch { /* clipboard unavailable */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <section style={s.card}>
      <div style={s.sectHead}>
        <div>
          <div style={s.kicker}>🏆 Scouting</div>
          <h3 style={s.title}>Recruiting Portfolio <small style={s.titleSub}>(Live Bio)</small></h3>
        </div>
        <span style={s.aiPill}>AI-Verified</span>
      </div>

      <div style={s.recVisRow}>
        <span style={s.recVisLabel}>Recruiting Visibility</span>
        <span style={s.recVisOn}>{MOCK.recruiting.visibility}</span>
      </div>

      <div style={s.panel}>
        <div style={s.subKicker}>Verified Performance Highlights</div>
        <div style={s.recGrid}>
          {MOCK.recruiting.highlights.map((h) => (
            <div key={h.label} style={s.recCell}>
              <span style={s.recCellLabel}>{h.label}</span>
              <span style={s.recCellVal}>{h.value}</span>
            </div>
          ))}
        </div>
        <p style={s.scoutNote}><em>“{MOCK.recruiting.scoutNote}”</em> — BBF AI Scout Draft Report</p>
      </div>

      <button type="button" style={s.scoutBtn} onClick={copy}>
        👁 {copied ? 'Scout Access URL Copied' : 'Copy Scout Access URL'}
      </button>
    </section>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────────
function initials(name) {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '—';
}
function deriveRatios(c) {
  const p = Number(c?.macro_p) || 0, cc = Number(c?.macro_c) || 0, f = Number(c?.macro_f) || 0;
  const kp = p * 4, kc = cc * 4, kf = f * 9, tot = kp + kc + kf;
  if (tot <= 0) return null;
  return { c: Math.round((kc / tot) * 100), p: Math.round((kp / tot) * 100), f: Math.round((kf / tot) * 100) };
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '1.6rem' },
  card: {
    background: 'rgba(106,13,173,.10)', border: '1px solid rgba(245,200,0,.22)',
    borderRadius: 16, padding: '1.2rem 1.3rem',
  },
  sectHead: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' },
  kicker: { fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '.25rem' },
  subKicker: { display: 'block', fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: '.45rem' },
  title: { fontFamily: 'var(--display)', fontSize: '1.45rem', letterSpacing: '1px', color: 'var(--wht)', margin: 0, lineHeight: 1.05 },
  titleSub: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 700, color: 'var(--mut)', letterSpacing: 0, textTransform: 'none' },

  // Biometric dossier
  dossier: { background: 'rgba(106,13,173,.16)', borderColor: 'rgba(245,200,0,.4)' },
  dossierBreach: { borderColor: '#ef4444', background: 'rgba(239,68,68,.12)', boxShadow: '0 0 0 1px rgba(239,68,68,.55), 0 0 30px -6px rgba(239,68,68,.5)' },
  breachBanner: { marginTop: '.9rem', fontFamily: 'var(--bd)', fontSize: '.86rem', fontWeight: 700, color: '#fff', background: 'rgba(239,68,68,.92)', border: '1px solid #ef4444', borderRadius: 10, padding: '.6rem .85rem', letterSpacing: '.2px', lineHeight: 1.5 },
  noSync: { marginTop: '.9rem', fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--mut)', border: '1px solid var(--line)', borderRadius: 10, padding: '.55rem .8rem' },
  dossierTop: { display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  avatar: {
    width: 64, height: 64, flexShrink: 0, borderRadius: 14, border: '2px solid var(--gold-soft)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050505',
    fontFamily: 'var(--hb)', fontSize: '1.3rem', letterSpacing: '1px', color: 'var(--wht)',
  },
  idCol: { display: 'flex', flexDirection: 'column', gap: '.3rem', minWidth: 0, flex: 1 },
  sportBadge: { alignSelf: 'flex-start', fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#090909', background: 'var(--yel)', borderRadius: 6, padding: '.16rem .5rem' },
  name: { fontFamily: 'var(--display)', fontSize: '1.9rem', letterSpacing: '1px', color: 'var(--wht)', lineHeight: 1.02 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.15rem' },
  chip: { fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold-soft)', border: '1px solid rgba(245,200,0,.35)', borderRadius: 6, padding: '.18rem .5rem' },
  directive: { fontFamily: 'var(--bd)', fontSize: '.88rem', fontWeight: 600, color: 'var(--wht)', marginTop: '.35rem' },
  directiveLabel: { color: 'var(--mut)', fontWeight: 700 },
  bioStats: { display: 'flex', flexDirection: 'column', gap: '.6rem', minWidth: 140 },
  bioStat: { display: 'flex', flexDirection: 'column', gap: '.1rem' },
  bioLabel: { fontFamily: 'var(--hb)', fontSize: '.55rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  bioVal: { fontFamily: 'var(--display)', fontSize: '1.35rem', lineHeight: 1, color: 'var(--wht)' },
  bioUnit: { fontFamily: 'var(--bd)', fontSize: '.7rem', fontWeight: 700, color: 'var(--mut)' },
  riskPill: { alignSelf: 'flex-start', fontFamily: 'var(--hb)', fontSize: '.7rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#04130a', background: 'var(--grn)', borderRadius: 6, padding: '.15rem .55rem' },

  // Header quick-actions dropdown
  actionsWrap: { position: 'relative', alignSelf: 'flex-start', flexShrink: 0 },
  actionsBtn: {
    width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 9, border: '1px solid rgba(245,200,0,.45)', background: 'rgba(0,0,0,.35)',
    color: 'var(--gold-soft)', fontSize: '1.15rem', lineHeight: 1, cursor: 'pointer',
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 40, minWidth: 230,
    display: 'flex', flexDirection: 'column', gap: '.25rem', background: '#0d0716',
    border: '1px solid rgba(245,200,0,.4)', borderRadius: 12, padding: '.45rem',
    boxShadow: '0 14px 40px rgba(0,0,0,.55)',
  },
  menuHead: { fontFamily: 'var(--hb)', fontSize: '.56rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-deep)', padding: '.25rem .5rem .35rem' },
  menuItem: {
    display: 'flex', alignItems: 'center', gap: '.5rem', width: '100%', textAlign: 'left',
    fontFamily: 'var(--hb)', fontSize: '.72rem', letterSpacing: '1.5px', textTransform: 'uppercase',
    color: 'var(--gold-soft)', background: 'rgba(106,13,173,.18)', border: '1px solid var(--line)',
    borderRadius: 8, padding: '.5rem .6rem', cursor: 'pointer',
  },
  menuItemHot: { color: '#090909', background: 'var(--yel)', borderColor: 'var(--yel)' },

  // Pill tabs
  pillTabs: { display: 'flex', gap: '.35rem', flexWrap: 'wrap' },
  pillTab: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)', background: 'rgba(0,0,0,.3)', border: '1px solid var(--line)', borderRadius: 999, padding: '.4rem .8rem', cursor: 'pointer' },
  pillTabOn: { color: '#090909', background: 'var(--yel)', borderColor: 'var(--yel)' },

  // Nutrition
  stratRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' },
  strat: { fontFamily: 'var(--display)', fontSize: '1.35rem', letterSpacing: '.5px', color: 'var(--wht)', lineHeight: 1.05 },
  hydration: { textAlign: 'right', border: '1px solid var(--line)', borderRadius: 10, padding: '.5rem .7rem', background: 'rgba(0,0,0,.25)' },
  hydrationVal: { fontFamily: 'var(--display)', fontSize: '1.15rem', color: 'var(--gold-soft)' },
  panel: { border: '1px solid var(--line)', borderRadius: 12, padding: '.9rem 1rem', background: 'rgba(0,0,0,.22)', marginTop: '.8rem' },
  ratioLine: { fontFamily: 'var(--bd)', fontSize: '1rem', fontWeight: 700, color: 'var(--wht)', marginBottom: '.55rem' },
  macroBar: { display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', gap: 2, background: '#050505' },
  macroSeg: { display: 'block', height: '100%' },
  macroLabels: { display: 'flex', justifyContent: 'space-between', marginTop: '.35rem', fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  foodChips: { display: 'flex', flexWrap: 'wrap', gap: '.45rem' },
  foodChip: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 700, color: 'var(--wht)', background: 'rgba(106,13,173,.25)', border: '1px solid var(--purl)', borderRadius: 8, padding: '.3rem .6rem' },

  // Age comp
  compRow: { display: 'flex', alignItems: 'center', gap: '.7rem', marginTop: '.55rem' },
  compLabel: { flex: '0 0 42%', fontFamily: 'var(--bd)', fontSize: '.85rem', fontWeight: 700, color: 'var(--wht)' },
  compTrack: { flex: 1, height: 8, borderRadius: 999, background: '#050505', overflow: 'hidden' },
  compFill: { display: 'block', height: '100%', background: 'linear-gradient(90deg, var(--purl), var(--gold-soft))' },
  compPct: { flex: '0 0 auto', fontFamily: 'var(--hb)', fontSize: '.78rem', color: 'var(--gold-soft)' },
  muteNote: { fontFamily: 'var(--bd)', fontSize: '.8rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--mut)', margin: '.4rem 0 0' },

  // Exclusions
  exclList: { display: 'flex', flexDirection: 'column', gap: '.55rem' },
  exclRow: { display: 'flex', gap: '.6rem', alignItems: 'flex-start' },
  exclMark: { flexShrink: 0, color: 'var(--red)', fontSize: '1.1rem', lineHeight: 1.2 },
  exclName: { fontFamily: 'var(--bd)', fontSize: '.92rem', fontWeight: 700, color: 'var(--wht)' },
  exclReason: { fontFamily: 'var(--bd)', fontSize: '.78rem', fontWeight: 600, color: 'var(--mut)' },

  // Anti-Lockout
  verdictPill: { fontFamily: 'var(--hb)', fontSize: '.64rem', letterSpacing: '1.5px', textTransform: 'uppercase', borderRadius: 999, padding: '.35rem .7rem', whiteSpace: 'nowrap' },
  verdictOk: { color: '#04130a', background: 'var(--yel)' },
  verdictLock: { color: '#090909', background: 'var(--orn)' },
  simHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '.8rem', flexWrap: 'wrap', marginBottom: '.7rem' },
  simHint: { fontFamily: 'var(--bd)', fontSize: '.76rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--mut)' },
  simGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.1rem' },
  sliderCell: { display: 'flex', flexDirection: 'column', gap: '.3rem' },
  sliderHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '.5rem' },
  sliderLabel: { fontFamily: 'var(--bd)', fontSize: '.86rem', fontWeight: 700, color: 'var(--wht)' },
  sliderVal: { fontFamily: 'var(--display)', fontSize: '1.05rem' },
  sliderLimit: { fontFamily: 'var(--bd)', fontSize: '.7rem', fontWeight: 700, color: 'var(--mut)' },
  range: { width: '100%' },
  sliderNote: { fontFamily: 'var(--bd)', fontSize: '.72rem', fontWeight: 600, color: 'var(--mut)' },

  verdictBox: { marginTop: '.9rem', border: '1px solid', borderRadius: 12, padding: '1rem 1.1rem' },
  verdictBoxOk: { borderColor: 'rgba(34,197,94,.45)', background: 'rgba(34,197,94,.08)' },
  verdictBoxLock: { borderColor: 'rgba(245,158,11,.45)', background: 'rgba(245,158,11,.08)' },
  verdictTop: { display: 'flex', gap: '.7rem', alignItems: 'flex-start' },
  verdictIcon: { flexShrink: 0, width: 30, height: 30, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' },
  verdictIconOk: { color: '#04130a', background: 'var(--grn)' },
  verdictIconLock: { color: '#090909', background: 'var(--orn)' },
  verdictTitle: { fontFamily: 'var(--hb)', fontSize: '.92rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--wht)' },
  verdictText: { fontFamily: 'var(--bd)', fontSize: '.84rem', fontWeight: 600, lineHeight: 1.45, color: 'var(--mut)', margin: '.3rem 0 0' },
  proofRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '.7rem', marginTop: '.9rem' },
  proof: { border: '1px solid var(--line)', borderRadius: 10, padding: '.55rem .75rem', background: 'rgba(0,0,0,.25)' },
  proofVal: { fontFamily: 'var(--display)', fontSize: '1.5rem', color: 'var(--wht)' },
  proofTag: { fontFamily: 'var(--bd)', fontSize: '.7rem', fontWeight: 700 },

  // Lifeline
  horizon: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)' },
  lifeline: { display: 'flex', flexDirection: 'column', gap: '.6rem', marginTop: '.6rem' },
  lifeRow: { border: '1px solid var(--line)', borderRadius: 12, padding: '.8rem 1rem', background: 'rgba(0,0,0,.22)' },
  lifeRowOn: { borderColor: 'rgba(245,200,0,.5)', background: 'rgba(106,13,173,.2)' },
  lifeTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem' },
  lifeTier: { fontFamily: 'var(--bd)', fontSize: '.98rem', fontWeight: 700, color: 'var(--wht)' },
  lifeAges: { color: 'var(--mut)', fontWeight: 600 },
  activePill: { fontFamily: 'var(--hb)', fontSize: '.58rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: '#090909', background: 'var(--gold-soft)', borderRadius: 6, padding: '.16rem .5rem' },
  lifeNote: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, color: 'var(--mut)', marginTop: '.3rem', lineHeight: 1.4 },
  lifeChips: { display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.55rem' },
  lifeChip: { fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--gold-soft)', border: '1px solid rgba(245,200,0,.35)', borderRadius: 999, padding: '.2rem .55rem' },

  // Recruiting
  aiPill: { fontFamily: 'var(--hb)', fontSize: '.6rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--grn)', border: '1px solid var(--grn)', borderRadius: 6, padding: '.18rem .5rem' },
  recVisRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '.4rem' },
  recVisLabel: { fontFamily: 'var(--bd)', fontSize: '.9rem', fontWeight: 700, color: 'var(--wht)' },
  recVisOn: { fontFamily: 'var(--hb)', fontSize: '.66rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--gold-soft)' },
  recGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.7rem' },
  recCell: { border: '1px solid var(--line)', borderRadius: 10, padding: '.6rem .8rem', background: 'rgba(0,0,0,.25)', textAlign: 'center' },
  recCellLabel: { display: 'block', fontFamily: 'var(--hb)', fontSize: '.56rem', letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--mut)', marginBottom: '.2rem' },
  recCellVal: { fontFamily: 'var(--display)', fontSize: '1.5rem', color: 'var(--gold-soft)' },
  scoutNote: { fontFamily: 'var(--bd)', fontSize: '.82rem', fontWeight: 600, fontStyle: 'italic', color: 'var(--mut)', lineHeight: 1.5, margin: '.8rem 0 0' },
  scoutBtn: { width: '100%', marginTop: '.9rem', fontFamily: 'var(--hb)', fontSize: '.78rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--gold-soft)', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(245,200,0,.4)', borderRadius: 10, padding: '.7rem', cursor: 'pointer' },
};
