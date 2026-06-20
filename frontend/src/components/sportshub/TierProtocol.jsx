// src/components/sportshub/TierProtocol.jsx
// ─────────────────────────────────────────────────────────────────────────────
// TIER PROTOCOL — the Youth Sports Hub's dynamic, tier-filtered drill deck.
//
// Replaces the static protocol list with a live cut of the proprietary internal
// catalog (data/workoutCatalog.js — NOT scraped or rewritten). It reads the
// athlete's current_tier (AthleteProfileContext) and sport/position, grades each
// catalog drill by load, and shows only what's appropriate for the active tier:
//   • youth / middle_school → sport-wide FOUNDATIONAL athletic drills (bodyweight,
//     agility, light implements) — general development, safe loading.
//   • high_school / collegiate → POSITION-specific drills, up to elite %-based work.
//
// The prescribed sets are scaled live by the Readiness Engine's volMultiplier
// (ReadinessContext) — a low-CNS morning trims the day's volume across every card.
// Thumbnails resolve through the shared VideoSlot (verified clip or a clean
// caption-only slot). Dark-mode premium register (matches the adult Vault cards).

import { useMemo } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { useReadiness } from '../../context/ReadinessContext.jsx';
import { useAthleteProfile } from '../../context/AthleteProfileContext.jsx';
import { WORKOUT_CATALOG, getPortalSport, getPositions } from '../sports/sportsData.js';
import { resolveAthleticVideo } from './sportsVideos.js';
import { pickLang } from '../../lib/pickLang.js';
import VideoSlot from '../common/VideoSlot.jsx';
import './tierProtocol.css';

const TIER_ORDER = ['youth', 'middle_school', 'high_school', 'collegiate'];
const TIER_RANK = { youth: 1, middle_school: 2, high_school: 3, collegiate: 4 };
const TIER_META = {
  youth: { accent: '#6dd13f', en: 'Youth', es: 'Juvenil', pt: 'Juvenil' },
  middle_school: { accent: '#a7e635', en: 'Middle School', es: 'Secundaria', pt: 'Fundamental' },
  high_school: { accent: '#f5c800', en: 'High School', es: 'Preparatoria', pt: 'Ensino Médio' },
  collegiate: { accent: '#ff7a3c', en: 'Collegiate', es: 'Universitario', pt: 'Universitário' },
};
const VOL_BAND = { full: '#c9ff7a', reduced: '#ffd24d', recovery: '#ff5d5d' };

// ── Drill grading (no difficulty flag exists in the catalog → derive from load) ──
// Maps equipment + set notation to a development rank, aligned with the youth
// safety doctrine: no maximal axial loading for the young, full %-based work later.
function drillRank(d) {
  const eq = String(d.equipment || '').toLowerCase();
  const sets = String(d.sets || '').toLowerCase();
  const nm = String(d.name?.en || '').toLowerCase();
  const pctMatch = /@\s*(\d+)\s*%/.exec(sets);
  const pct = pctMatch ? Number(pctMatch[1]) : 0;
  if (pct >= 85 || /from blocks|depth jump|power clean|snatch/.test(nm)) return 4;          // collegiate / elite
  if (/barbell|trap bar|sled|blocks/.test(eq) || pct > 0
    || /\bclean\b|deadlift|squat|incline .*press|bench press/.test(nm)) return 3;            // high school — full loading
  if (/\bdb\b|\bkb\b|dumbbell|kettlebell|med ball|medicine|box|plate|cable/.test(eq)) return 2; // middle school — light implements
  return 1;                                                                                   // youth — bodyweight / agility
}

// Scale the leading SET count by the CNS volume multiplier (no-op at 1.0). Reps /
// load / tempo are preserved — we trim sets, the cleanest volume lever. Non "Nx…"
// notations (e.g. "Protocol") pass through untouched.
function scaleSets(sets, vol) {
  const s = String(sets || '').trim();
  if (vol == null || Number(vol) === 1) return s;
  const m = /^(\d+)\s*x\s*(.+)$/i.exec(s);
  if (!m) return s;
  const n = Math.max(1, Math.round(Number(m[1]) * Number(vol)));
  return `${n}x${m[2]}`;
}

// The athlete's position legacy code(s) — primary + any merged partners (e.g. the
// youth "Lineman" group spans OL + DL in the catalog).
function positionCodesFor(sportId, posCode) {
  const groups = getPositions(sportId) || [];
  const g = groups.find((x) => x.legacy === posCode);
  if (g) return [g.legacy, ...(g.also || [])].filter(Boolean);
  return posCode ? [posCode] : [];
}

// Build the tier-appropriate drill set for (sport, position, tier).
function buildDrills(sportLegacy, positionCodes, tier) {
  const catalog = WORKOUT_CATALOG[sportLegacy] || null;
  if (!catalog) return [];
  const cap = TIER_RANK[tier] || 4;
  // Foundational tiers develop the general athlete (sport-wide); senior tiers
  // specialize to the athlete's position.
  let codes = cap <= 2 ? Object.keys(catalog) : positionCodes.filter((c) => catalog[c]);
  if (!codes.length) codes = Object.keys(catalog);

  const seen = new Set();
  const out = [];
  codes.forEach((code) => {
    (catalog[code] || []).forEach((d) => {
      const rank = drillRank(d);
      if (rank > cap) return;
      const key = d.name?.en || JSON.stringify(d.name);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ ...d, position: code, rank });
    });
  });
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

const L10N = {
  en: {
    kicker: 'Progression Engine · Tier-Filtered',
    titleA: 'Tier', titleB: 'Protocol',
    sub: 'Your live drill prescription — pulled from the BBF catalog and filtered to your progression tier. Sets scale with your morning CNS scan.',
    tierK: 'Active Tier', sets: 'Sets', was: 'was', scaled: 'scaled',
    volNote: (p, b) => `CNS Volume ${p}% · ${b} — set counts trimmed for today`,
    empty: 'No catalog drills mapped for this sport yet — your daily protocol below builds the athletic base.',
    bands: { full: 'Full Volume', reduced: 'Reduced Volume', recovery: 'Prehab / Recovery' },
  },
  es: {
    kicker: 'Motor de Progresión · Filtrado por Nivel',
    titleA: 'Protocolo', titleB: 'por Nivel',
    sub: 'Tu prescripción de ejercicios en vivo — del catálogo BBF y filtrada a tu nivel de progresión. Las series se ajustan con tu escaneo matutino del SNC.',
    tierK: 'Nivel Activo', sets: 'Series', was: 'antes', scaled: 'ajustado',
    volNote: (p, b) => `Volumen SNC ${p}% · ${b} — series reducidas para hoy`,
    empty: 'Aún no hay ejercicios del catálogo para este deporte — tu protocolo diario construye la base atlética.',
    bands: { full: 'Volumen Completo', reduced: 'Volumen Reducido', recovery: 'Prehab / Recuperación' },
  },
  pt: {
    kicker: 'Motor de Progressão · Filtrado por Nível',
    titleA: 'Protocolo', titleB: 'por Nível',
    sub: 'Sua prescrição de exercícios ao vivo — do catálogo BBF e filtrada ao seu nível de progressão. As séries se ajustam ao seu escaneamento matinal do SNC.',
    tierK: 'Nível Ativo', sets: 'Séries', was: 'antes', scaled: 'ajustado',
    volNote: (p, b) => `Volume SNC ${p}% · ${b} — séries reduzidas para hoje`,
    empty: 'Ainda não há exercícios do catálogo para este esporte — seu protocolo diário constrói a base atlética.',
    bands: { full: 'Volume Total', reduced: 'Volume Reduzido', recovery: 'Prehab / Recuperação' },
  },
};

export default function TierProtocol({ sportId, position }) {
  const { lang } = useLang();
  const L = L10N[lang] || L10N.en;
  const { currentTier } = useAthleteProfile();
  const tier = TIER_RANK[currentTier] ? currentTier : 'high_school';
  const tierMeta = TIER_META[tier];
  const { volMultiplier, hasCheckedIn, band } = useReadiness();

  const sportLegacy = getPortalSport(sportId)?.legacy || null;
  const positionCodes = useMemo(() => positionCodesFor(sportId, position), [sportId, position]);
  const drills = useMemo(
    () => buildDrills(sportLegacy, positionCodes, tier),
    [sportLegacy, positionCodes, tier],
  );

  const scaling = hasCheckedIn && volMultiplier !== 1;

  return (
    <section className="tp" data-testid="tier-protocol">
      <div className="tp-inner">
        <div className="tp-head">
          <div className="tp-head-l">
            <div className="tp-kicker"><span aria-hidden="true">⚙</span> {L.kicker}</div>
            <h2 className="tp-title">{L.titleA} <span>{L.titleB}</span></h2>
            <p className="tp-sub">{L.sub}</p>
          </div>
          <div className="tp-tierchip" style={{ '--tier': tierMeta.accent }}>
            <span className="tp-tierchip-k">{L.tierK}</span>
            <span className="tp-tierchip-v" data-testid="tp-active-tier">{tierMeta[lang] || tierMeta.en}</span>
          </div>
        </div>

        {scaling ? (
          <div className="tp-vol" data-testid="tp-vol-banner" style={{ '--vol': VOL_BAND[band] || VOL_BAND.reduced }}>
            <span aria-hidden="true">⚡</span>
            {L.volNote(Math.round(volMultiplier * 100), L.bands[band] || L.bands.reduced)}
          </div>
        ) : null}

        {drills.length === 0 ? (
          <div className="tp-empty" data-testid="tp-empty">{L.empty}</div>
        ) : (
          <div className="tp-grid">
            {drills.map((d, i) => {
              const name = pickLang(d.name, lang);
              const focus = pickLang(d.focus, lang);
              const drillTier = TIER_ORDER[d.rank - 1] || 'high_school';
              const dm = TIER_META[drillTier];
              const scaledSets = scaleSets(d.sets, volMultiplier);
              const isScaled = scaling && scaledSets !== String(d.sets || '').trim();
              return (
                <article className="tp-card" data-testid="tp-card" key={`${d.position}-${d.name?.en || i}`}>
                  <div className="tp-card-thumb">
                    <div className="tp-card-badges">
                      <span className="tp-badge tp-badge-tier" style={{ '--tier': dm.accent }}>{dm[lang] || dm.en}</span>
                      {d.kpi ? <span className="tp-badge tp-badge-kpi">{d.kpi}</span> : null}
                    </div>
                    <VideoSlot videoId={resolveAthleticVideo(d.name?.en || name)} title={d.name} caption={d.kpi} />
                  </div>
                  <div className="tp-card-body">
                    <h3 className="tp-card-name">{name}</h3>
                    <div className="tp-prescribe">
                      <span className="tp-sets-flag" hidden={!isScaled}>{L.scaled}</span>
                      <span className={`tp-sets${isScaled ? ' is-scaled' : ''}`}>{scaledSets}</span>
                      {isScaled ? <span className="tp-sets-was">{L.was} {d.sets}</span> : null}
                    </div>
                    {focus ? <p className="tp-focus">{focus}</p> : null}
                    <div className="tp-card-foot">
                      {d.equipment ? <span className="tp-equip">{d.equipment}</span> : <span />}
                      <span className="tp-pos">{d.position}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
