// src/components/command/charts.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Shared hand-rolled SVG charts for the Command Center (no chart lib — BBF
// purple/gold brutalist system). Extracted from ClientAnalytics so the standalone
// Coach Portal AND the Founder Five dossier render IDENTICAL charts. Styling lives
// in analytics.css (.bbf-an__*) — import it alongside these.
//
// Contract notes preserved from the original:
//   • readiness avg_score may be null on no-reading days → the line SEGMENTS
//     across nulls (skips, never zero-fills or breaks).
//
// Brand colors + numeric helpers live in chartUtils.js (so this file exports only
// components — fast-refresh clean). Re-import here for internal use.

import { GOLD, numOrNull, fmtNum } from './chartUtils.js';

// ── Bar chart (volume) — pure SVG ──
export function BarChart({ points, color = GOLD, unit }) {
  if (!points.length) return <div className="bbf-an__empty">No data in this window.</div>;
  const W = 640, H = 180, PAD = 24;
  const max = Math.max(...points.map((p) => p.value), 1);
  const bw = (W - PAD * 2) / points.length;
  return (
    <>
      <svg className="bbf-an__svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Volume, max ${max} ${unit || ''}`}>
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth="1" />
        {points.map((p, i) => {
          const h = ((p.value / max) * (H - PAD * 2));
          return (
            <rect key={i} x={PAD + i * bw + bw * 0.15} y={H - PAD - h}
              width={bw * 0.7} height={Math.max(h, 0)} rx="2" fill={color} opacity={p.value ? 0.9 : 0.15} />
          );
        })}
        <text className="bbf-an__axis" x={PAD} y={14}>{max.toLocaleString()} {unit || ''}</text>
      </svg>
      <AxisDates points={points} />
    </>
  );
}

// ── Multi-series line (readiness) — segments across null gaps ──
export function LineChart({ series }) {
  const len = series[0]?.points.length || 0;
  if (!len) return <div className="bbf-an__empty">No data in this window.</div>;
  const W = 640, H = 180, PAD = 24;
  // Shared scale across the visible series (scores/sleep/soreness all ~0–10/0–100).
  const allVals = series.flatMap((s) => s.points.map((p) => p.value).filter((v) => v != null));
  const max = Math.max(...allVals, 1);
  const x = (i) => PAD + (i / Math.max(len - 1, 1)) * (W - PAD * 2);
  const y = (v) => H - PAD - (v / max) * (H - PAD * 2);

  // Build SVG path that BREAKS on null (segment, never zero-fill) — the contract note.
  const pathFor = (pts) => {
    let d = '';
    let pen = false;
    pts.forEach((p, i) => {
      if (p.value == null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.value).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  return (
    <>
      <svg className="bbf-an__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Trend">
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" strokeWidth="1" />
        {series.map((s) => (
          <g key={s.key}>
            <path d={pathFor(s.points)} fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {s.points.map((p, i) => p.value != null
              ? <circle key={i} cx={x(i)} cy={y(p.value)} r="2.5" fill={s.color} /> : null)}
          </g>
        ))}
        <text className="bbf-an__axis" x={PAD} y={14}>peak {max}</text>
      </svg>
      <AxisDates points={series[0].points} />
      <div className="bbf-an__legend">
        {series.map((s) => (
          <span key={s.key}><i className="bbf-an__swatch" style={{ background: s.color }} /> {s.label}</span>
        ))}
      </div>
    </>
  );
}

// ── Body composition: progression headline + body-fat % line ──
export function BodyComp({ data }) {
  const series = (data?.series || []).map((d) => ({ date: d.date, value: numOrNull(d.body_fat_pct) }));
  const prog = data?.progression || {};
  const hasData = series.some((p) => p.value != null);

  if (!hasData) return <div className="bbf-an__empty">No body-composition readings logged yet.</div>;

  const delta = numOrNull(prog.delta_pct);
  const dir = delta == null ? '' : delta < 0 ? 'is-down' : delta > 0 ? 'is-up' : '';
  return (
    <>
      <div className="bbf-an__prog">
        {delta != null ? (
          <span className={`bbf-an__prog-delta ${dir}`}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span>
        ) : null}
        <span className="bbf-an__prog-sub">
          {fmtNum(prog.first_pct)}% → {fmtNum(prog.last_pct)}% body fat
          {prog.readings ? ` · ${prog.readings} reading${prog.readings === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      <LineChart series={[{ key: 'bf', label: 'Body Fat %', color: GOLD, points: series }]} />
    </>
  );
}

// ── Shared sparse date axis (first / mid / last) ──
export function AxisDates({ points }) {
  if (!points.length) return null;
  const pick = [0, Math.floor(points.length / 2), points.length - 1];
  const seen = new Set();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.3rem' }}>
      {pick.map((i) => {
        if (seen.has(i)) return null;
        seen.add(i);
        const d = points[i]?.date;
        return <span key={i} className="bbf-an__chart-meta">{d ? d.slice(5) : ''}</span>;
      })}
    </div>
  );
}
