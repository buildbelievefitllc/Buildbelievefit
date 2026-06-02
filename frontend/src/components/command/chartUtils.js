// src/components/command/chartUtils.js
// ─────────────────────────────────────────────────────────────────────────────
// Non-component helpers + brand chart colors shared by the SVG charts (charts.jsx)
// and their consumers (ClientAnalytics, ClientDossier). Kept in a plain .js module
// so charts.jsx exports only components (satisfies react-refresh/only-export).

export const GOLD = 'var(--yel)';
export const GOLD_SOFT = 'var(--gold-soft)';
export const PURL = 'var(--purl)';
export const GRN = 'var(--grn)';

export function numOrNull(v) {
  return v === null || v === undefined || v === '' ? null : Number(v);
}

export function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}
