// src/lib/coachingVelocity.js
// ─────────────────────────────────────────────────────────────────────────────
// COACHING VELOCITY INDEX — the intuition engine for the roster view. A pure,
// client-side ranking utility (NO React, NO network) that runs over the loaded
// roster + telemetry-radar arrays and answers ONE question per athlete:
// "how urgently does this client need coach outreach RIGHT NOW?"
//
// Weighted composite (0–100, higher = healthier momentum):
//   · LOGGING CONSISTENCY (weight .40) — the 48-hour activity window read from
//     the telemetry sparkline (7 daily tonnage points, index 6 = today) plus
//     the week's completed/assigned workout ratio.
//   · ADHERENCE (weight .40) — the baseline matrix adherence_score with the
//     radar status flag as a hard modifier (red caps the axis, green floors it).
//   · COMMUNICATION INTERVAL (weight .20) — days since last touch. Uses
//     lastMessageAt when a thread timestamp is supplied; otherwise the roster
//     row's updated_at is the documented last-touch proxy.
//
// A row with NO telemetry (fresh forge / radar not yet loaded) is CALIBRATING —
// a neutral band that never false-flags a new athlete as critical (mirrors the
// STATUS_META 'insufficient' doctrine in ClientHub).
//
// Bands: critical (<35) · watch (<60) · steady (<80) · locked_in (≥80).
// rankRoster() floats CRITICAL rows to the absolute top regardless of the
// active sort — the outreach alert surface.

const W_ACTIVITY = 0.4;
const W_ADHERENCE = 0.4;
const W_COMMS = 0.2;

export const VELOCITY_BANDS = {
  critical: { label: 'Outreach Now', tone: 'critical' },
  watch: { label: 'Losing Steam', tone: 'watch' },
  steady: { label: 'On Pace', tone: 'steady' },
  locked_in: { label: 'Locked In', tone: 'locked' },
  calibrating: { label: 'Calibrating', tone: 'calibrating' },
};

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── Axis 1 · logging consistency (the 48h window) ───────────────────────────
function activityAxis(tel) {
  const spark = Array.isArray(tel?.sparkline) ? tel.sparkline.map(Number) : [];
  const today = spark.length ? spark[spark.length - 1] : 0;
  const yesterday = spark.length > 1 ? spark[spark.length - 2] : 0;
  const active48h = today > 0 || yesterday > 0;
  const activeDays7 = spark.filter((v) => Number.isFinite(v) && v > 0).length;

  const assigned = num(tel?.workout_assigned) ?? 0;
  const completed = num(tel?.workout_completed) ?? 0;
  const completionRatio = assigned > 0 ? clamp01(completed / assigned) : null;

  // 48h window is the dominant term (0.6): silence for two days is the single
  // strongest churn tell. Week texture (0.4) grades the streak quality.
  const windowScore = active48h ? 1 : 0;
  const weekScore = completionRatio != null
    ? completionRatio
    : clamp01(activeDays7 / 4); // 4+ active days/week ≈ full marks
  return { score: windowScore * 0.6 + weekScore * 0.4, active48h, activeDays7 };
}

// ── Axis 2 · baseline matrix adherence ───────────────────────────────────────
function adherenceAxis(tel) {
  const raw = num(tel?.adherence_score);
  let score = raw != null ? clamp01(raw / 100) : 0.5;
  // Radar status is a hard flag modifier — a red row can never grade above
  // 0.35 on this axis, a green never below 0.6.
  if (tel?.status === 'red') score = Math.min(score, 0.35);
  if (tel?.status === 'green') score = Math.max(score, 0.6);
  return { score, adherencePct: raw, flag: tel?.status ?? null };
}

// ── Axis 3 · communication interval ─────────────────────────────────────────
function commsAxis(lastTouchIso, nowMs) {
  const t = Date.parse(lastTouchIso || '');
  if (!Number.isFinite(t)) return { score: 0.5, daysSinceTouch: null }; // unknown = neutral
  const days = Math.max(0, (nowMs - t) / 86400000);
  // Full marks inside 3 days, linear decay to zero at 14 days dark.
  const score = days <= 3 ? 1 : clamp01(1 - (days - 3) / 11);
  return { score, daysSinceTouch: Math.floor(days) };
}

export function velocityBand(score) {
  if (score == null) return 'calibrating';
  if (score < 35) return 'critical';
  if (score < 60) return 'watch';
  if (score < 80) return 'steady';
  return 'locked_in';
}

// Compute one athlete's Coaching Velocity. `row` is the merged roster row
// (updated_at rides here); `tel` the telemetry-radar row (may be null);
// `opts.lastMessageAt` an optional thread timestamp that outranks updated_at.
export function computeVelocity(row, tel, opts = {}) {
  const nowMs = opts.now ?? Date.now();

  // No radar data at all → calibrating, never a false critical.
  if (!tel || tel.status === 'insufficient') {
    return { score: null, band: 'calibrating', signals: { active48h: null, adherencePct: null, daysSinceTouch: null, flag: tel?.status ?? null } };
  }

  const act = activityAxis(tel);
  const adh = adherenceAxis(tel);
  const com = commsAxis(opts.lastMessageAt || row?.updated_at, nowMs);

  const score = Math.round((act.score * W_ACTIVITY + adh.score * W_ADHERENCE + com.score * W_COMMS) * 100);
  return {
    score,
    band: velocityBand(score),
    signals: {
      active48h: act.active48h,
      activeDays7: act.activeDays7,
      adherencePct: adh.adherencePct,
      flag: adh.flag,
      daysSinceTouch: com.daysSinceTouch,
    },
  };
}

// Build the { rowKey → velocity } map for a whole roster in one pass.
export function velocityMap(rows, telemetryByKey, rowKeyFn, opts = {}) {
  const out = {};
  for (const row of rows || []) {
    const rk = rowKeyFn(row);
    out[rk] = computeVelocity(row, telemetryByKey?.[rk] ?? null, opts);
  }
  return out;
}

// CRITICAL-FIRST partition: stable-floats every critical-band row to the
// absolute top of an already-sorted list (the active sort order is preserved
// inside each partition). This is the automatic outreach-alert surface — a
// coach opening the roster sees who is bleeding out before anything else.
export function floatCriticalFirst(rows, velByKey, rowKeyFn) {
  const critical = [];
  const rest = [];
  for (const row of rows || []) {
    (velByKey?.[rowKeyFn(row)]?.band === 'critical' ? critical : rest).push(row);
  }
  return critical.length ? [...critical, ...rest] : rows;
}
