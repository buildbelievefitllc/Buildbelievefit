// src/lib/intelCore.js
// ─────────────────────────────────────────────────────────────────────────────
// Sovereign Clinical Intelligence — audit kernel (React port).
//
// ⚠️ VERBATIM PORT of supabase/functions/_shared/intel-core.ts (which itself
// mirrors /bbf-intelligence-engine.js, the browser engine the monolith ships as
// BBF_INTEL). Same constants, same formulas — this is safety-critical injury-risk
// math, so it is copied exactly (TS types stripped), NOT paraphrased. Any change
// here must land in all three in lockstep, with the same sign-off.
//
// Used by: src/lib/telemetryApi.js (the Panopticon's per-athlete classification).

export const ACUTE_WINDOW_DAYS = 7;
export const CHRONIC_WINDOW_DAYS = 28;
export const ACWR_THRESHOLD = 1.5;
export const ATP_PC_MIN_REST_SEC = 180;
export const ATP_PC_BOUT_TYPE = 'High-Intensity ATP-PC';
// Panopticon classifier thresholds (shared with the browser portal)
export const YELLOW_LOWER = 1.30;
export const YELLOW_UPPER = 1.50;

// ─── ACWR (acute:chronic workload ratio) ──────────────────────────────────────
export function calculateACWR(dailyLoads, opts = {}) {
  const acuteWindow = opts.acuteWindow ?? ACUTE_WINDOW_DAYS;
  const chronicWindow = opts.chronicWindow ?? CHRONIC_WINDOW_DAYS;
  const threshold = (typeof opts.threshold === 'number') ? opts.threshold : ACWR_THRESHOLD;

  if (!Array.isArray(dailyLoads) || dailyLoads.length === 0) {
    return {
      acuteLoad: 0, chronicLoad: 0, ratio: null, threshold,
      fatigueState: false, alert: null, daysCovered: 0, insufficient: true,
    };
  }

  const n = dailyLoads.length;
  const insufficient = n < chronicWindow;
  const chronicDays = Math.min(n, chronicWindow);
  const acuteDays = Math.min(n, acuteWindow);

  let acuteLoad = 0;
  for (let i = n - acuteDays; i < n; i++) acuteLoad += (+dailyLoads[i] || 0);

  let chronicTotal = 0;
  for (let j = n - chronicDays; j < n; j++) chronicTotal += (+dailyLoads[j] || 0);
  // 4-week average weekly load (Gabbett): total ÷ (window/7)
  const chronicLoad = chronicTotal / (chronicWindow / 7);

  const ratio = (chronicLoad > 0) ? (acuteLoad / chronicLoad) : null;
  const fatigueState = (ratio !== null) && (ratio > threshold);

  let alert = null;
  if (fatigueState && ratio !== null) {
    alert = {
      severity: 'high',
      rule: 'Mandatory Volume Reduction',
      reason: `ACWR ${ratio.toFixed(2)} exceeds the ${threshold} elevated-injury-risk threshold`,
      source: 'Block 4 Autoregulation Guardrail',
    };
  }

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    ratio: ratio === null ? null : +ratio.toFixed(3),
    threshold,
    fatigueState,
    alert,
    daysCovered: n,
    insufficient,
  };
}

// ─── Micro-Recovery audit (3-min ATP-PC rest rule) ────────────────────────────
export function auditMicroRecovery(bouts, opts = {}) {
  const minRest = opts.minRestSec ?? ATP_PC_MIN_REST_SEC;
  const atpType = opts.atpPcType ?? ATP_PC_BOUT_TYPE;

  if (!Array.isArray(bouts) || bouts.length < 2) {
    return { violations: [], totalAtpPcBouts: bouts ? bouts.length : 0, pairsChecked: 0, threshold: minRest };
  }

  const tsMs = (b) => {
    if (typeof b.start === 'number') return b.start;
    const t = Date.parse(b.start);
    return isNaN(t) ? null : t;
  };

  const atp = bouts.filter((b) => b && b.type === atpType);
  const violations = [];
  let pairsChecked = 0;

  for (let i = 1; i < atp.length; i++) {
    const prev = atp[i - 1];
    const curr = atp[i];
    const prevStart = tsMs(prev);
    const currStart = tsMs(curr);
    if (prevStart === null || currStart === null) continue;
    const prevEnd = prevStart + ((+prev.durationSec || 0) * 1000);
    const restSec = (currStart - prevEnd) / 1000;
    pairsChecked++;
    if (restSec < minRest) {
      violations.push({
        fromBout: prev,
        toBout: curr,
        restSec: Math.round(restSec),
        threshold: minRest,
        atIso: curr.start,
      });
    }
  }
  return { violations, totalAtpPcBouts: atp.length, pairsChecked, threshold: minRest };
}

// ─── Combined audit wrapper ────────────────────────────────────────────────────
export function runLoadAudit(input) {
  const acwr = calculateACWR(input.dailyLoads || [], input.acwrOpts);
  const micro = auditMicroRecovery(input.bouts || [], input.microOpts);
  const alerts = [];
  if (acwr.alert) alerts.push(acwr.alert);
  if (micro.violations.length > 0) {
    alerts.push({
      severity: 'medium',
      rule: 'Micro-Recovery Protocol Violation',
      reason: `${micro.violations.length} of ${micro.pairsChecked} ATP-PC bout pair${micro.pairsChecked === 1 ? '' : 's'} fell below the ${micro.threshold / 60}-minute rest minimum`,
      source: 'Block 4 Micro-Recovery Guardrail',
    });
  }
  return {
    acwr,
    microRecovery: micro,
    alerts,
    summary: {
      fatigueState: acwr.fatigueState,
      violationCount: micro.violations.length,
      anyAlerts: alerts.length > 0,
    },
  };
}

// ─── Risk classification (matches the monolith's panopticonPortal._classifyRisk) ─
export function classifyRisk(report, totalLoad) {
  if (!totalLoad || totalLoad === 0) return 'dormant';
  if (!report) return 'dormant';
  const fatigue = !!(report.summary && report.summary.fatigueState);
  const violations = !!(report.microRecovery && report.microRecovery.violations.length > 0);
  if (fatigue || violations) return 'red';
  const ratio = report.acwr.ratio;
  if (ratio !== null && ratio >= YELLOW_LOWER && ratio < YELLOW_UPPER) return 'yellow';
  return 'green';
}
