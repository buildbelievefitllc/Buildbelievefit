// src/components/vault/VaultHub.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 18 → 25 → Material Upgrade — Client Vault · Hub tab body.
//
// SOVEREIGN DOSSIER REBUILD (CEO order): the generic 6-box stat grid is GONE.
// The Performance Index now reads as an asymmetric intelligence brief —
//   • LEAD PANEL: the hero figure (total sessions) under a mode-tinted ambient
//     halo, with the live streak flag beside it.
//   • INTEL RAIL: the remaining indices as editorial line items on hairline
//     rules (no boxes) — best streak, this week, this month, weekly average.
//   • CONSISTENCY STRIP: the 30-day heatmap, retitled and restyled.
// Null-integrity: every figure renders '—' when absent; the layout never
// collapses. No invented data — every value is the fetched profile metric.
//
// I18N: all chrome resolves through the dictionary (vh-* keys, EN/ES/PT).
// Data contract { isLoading, error, profile } is owned by the Vault shell —
// this component only paints it.

import { useState } from 'react';
import { useLang } from '../../context/LangContext.jsx';
import { Loading, Empty } from '../command/primitives.jsx';
import { BoltIcon } from './icons.jsx';
import BiokineticForecast from './BiokineticForecast.jsx';
import './vault.css';

// Intel-rail indices (labels + units resolve through the dictionary in render).
const RAIL = [
  { key: 'bestStreak', labelKey: 'vh-stat-best', unitKey: 'vh-u-days' },
  { key: 'thisWeek', labelKey: 'vh-stat-week', unitKey: 'vh-u-sessions' },
  { key: 'thisMonth', labelKey: 'vh-stat-month', unitKey: 'vh-u-sessions' },
  { key: 'avgPerWeek', labelKey: 'vh-stat-avg', unitKey: 'vh-u-sessions' },
];

function fmtStat(v) {
  return v !== null && v !== undefined && v !== '' ? Number(v).toLocaleString() : '—';
}

export default function VaultHub({ profile, isLoading, error }) {
  const { t } = useLang();
  // Biokinetic Forecast — collapsible drawer on the LANDING Client Hub (the tab the
  // athlete sees on login). Default COLLAPSED so the Hub stays clean until opened.
  const [fcOpen, setFcOpen] = useState(false);
  return (
    <div className="pg">
      <div className={`vh-fc${fcOpen ? ' is-open' : ''}`}>
        <button
          type="button"
          className="vh-fc-toggle"
          aria-expanded={fcOpen}
          onClick={() => setFcOpen((o) => !o)}
          data-testid="hub-forecast-toggle"
        >
          <span className="vh-fc-ic" aria-hidden="true">📈</span>
          <span className="vh-fc-label">{fcOpen ? t('sch-fc-collapse') : t('sch-fc-expand')}</span>
          <span className="vh-fc-chev" aria-hidden="true">{fcOpen ? '▴' : '▾'}</span>
        </button>
        {fcOpen ? <div className="vh-fc-body"><BiokineticForecast /></div> : null}
      </div>

      {isLoading ? <Loading label={t('vh-loading')} /> : null}
      {!isLoading && error ? <div className="pg-hub-error">{error}</div> : null}
      {!isLoading && !error && !profile ? <Empty>{t('vh-noprofile')}</Empty> : null}
      {!isLoading && !error && profile ? <HubDossier profile={profile} t={t} /> : null}
    </div>
  );
}

function HubDossier({ profile, t }) {
  const fresh = profile.found && profile.totalSessions > 0;
  const streak = fmtStat(profile.currentStreak);

  return (
    <>
      {/* ── Performance Index — asymmetric dossier ── */}
      <div className="vh-dossier">
        <div className="vh-lead">
          <span className="vh-kicker">{t('vh-perf-index')}</span>
          <div className="vh-hero">
            <span className="vh-hero-v">{fmtStat(profile.totalSessions)}</span>
            <span className="vh-hero-k">{t('vh-stat-total')} · {t('vh-u-logged')}</span>
          </div>
          <div className="vh-streak">
            <BoltIcon className="vh-streak-flag" size={15} />
            <span className="vh-streak-v">{streak}</span>
            <span className="vh-streak-k">{t('vh-stat-streak')} · {t('vh-u-days')}</span>
          </div>
        </div>

        <div className="vh-rail" role="list">
          {RAIL.map((s) => (
            <div key={s.key} className="vh-line" role="listitem">
              <span className="vh-line-k">{t(s.labelKey)}</span>
              <span className="vh-line-rule" aria-hidden="true" />
              <span className="vh-line-v">{fmtStat(profile[s.key])}</span>
              <span className="vh-line-u">{t(s.unitKey)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 30-day consistency strip ── */}
      <h2 className="vh-subhead">{t('vh-last30')}</h2>
      {profile.heatmap.length ? (
        <div className="pg-heatmap" aria-label={t('vh-heat-aria')}>
          {profile.heatmap.map((d) => (
            <span
              key={d.date}
              title={`${d.date}${d.logged ? ` — ${t('vh-heat-trained')}` : ''}`}
              className={`pg-heat-cell${d.logged ? ' is-on' : ''}`}
            />
          ))}
        </div>
      ) : (
        <Empty>{fresh ? t('vh-heat-fresh') : t('vh-heat-first')}</Empty>
      )}
    </>
  );
}
