// ═══════════════════════════════════════════════════════════════
// supabase/functions/_shared/intel-core.ts
// Sovereign Clinical Intelligence — Deno-flavored audit kernel.
//
// PORT NOTICE: this is the Deno-compatible mirror of the audit math
// that lives in /bbf-intelligence-engine.js (browser UMD). Both
// files MUST stay in lockstep — same constants, same formulas. A
// build pipeline that compiles one source to two targets is a
// future ticket; until then, any change to one lands in both with
// the same sign-off.
//
// The CEO's directive said "do not duplicate the logic if it can
// be avoided" — the unavoidable duplication is the language/runtime
// boundary (browser script-tag vs Deno ES module). The code shape
// here is identical to the engine.
//
// Mirrors:  bbf-intelligence-engine.js v Phase 4 (Dynamic Load Auditor)
// Used by:  supabase/functions/bbf-sentinel/index.ts
// ═══════════════════════════════════════════════════════════════

export const ACUTE_WINDOW_DAYS   = 7;
export const CHRONIC_WINDOW_DAYS = 28;
export const ACWR_THRESHOLD      = 1.5;
export const ATP_PC_MIN_REST_SEC = 180;
export const ATP_PC_BOUT_TYPE    = "High-Intensity ATP-PC";
// Panopticon classifier thresholds (shared with the browser portal)
export const YELLOW_LOWER = 1.30;
export const YELLOW_UPPER = 1.50;

export interface Bout {
  type: string;
  start: string | number;        // ISO string or epoch ms
  durationSec: number;
  label?: string;
}

export interface Alert {
  severity: "high" | "medium";
  rule: string;
  reason: string;
  source: string;
}

export interface ACWRReport {
  acuteLoad: number;
  chronicLoad: number;
  ratio: number | null;
  threshold: number;
  fatigueState: boolean;
  alert: Alert | null;
  daysCovered: number;
  insufficient: boolean;
}

export interface MicroRecoveryReport {
  violations: Array<{
    fromBout: Bout;
    toBout: Bout;
    restSec: number;
    threshold: number;
    atIso: string | number;
  }>;
  totalAtpPcBouts: number;
  pairsChecked: number;
  threshold: number;
}

export interface LoadAuditReport {
  acwr: ACWRReport;
  microRecovery: MicroRecoveryReport;
  alerts: Alert[];
  summary: { fatigueState: boolean; violationCount: number; anyAlerts: boolean };
}

export type RiskStatus = "red" | "yellow" | "green" | "dormant";

// ─── ACWR ─────────────────────────────────────────────────────
export function calculateACWR(
  dailyLoads: number[],
  opts: { acuteWindow?: number; chronicWindow?: number; threshold?: number } = {}
): ACWRReport {
  const acuteWindow   = opts.acuteWindow   ?? ACUTE_WINDOW_DAYS;
  const chronicWindow = opts.chronicWindow ?? CHRONIC_WINDOW_DAYS;
  const threshold     = (typeof opts.threshold === "number") ? opts.threshold : ACWR_THRESHOLD;

  if (!Array.isArray(dailyLoads) || dailyLoads.length === 0) {
    return { acuteLoad: 0, chronicLoad: 0, ratio: null, threshold,
             fatigueState: false, alert: null, daysCovered: 0, insufficient: true };
  }

  const n = dailyLoads.length;
  const insufficient = n < chronicWindow;
  const chronicDays  = Math.min(n, chronicWindow);
  const acuteDays    = Math.min(n, acuteWindow);

  let acuteLoad = 0;
  for (let i = n - acuteDays; i < n; i++) acuteLoad += (+dailyLoads[i] || 0);

  let chronicTotal = 0;
  for (let j = n - chronicDays; j < n; j++) chronicTotal += (+dailyLoads[j] || 0);
  // 4-week average weekly load (Gabbett): total ÷ (window/7)
  const chronicLoad = chronicTotal / (chronicWindow / 7);

  const ratio = (chronicLoad > 0) ? (acuteLoad / chronicLoad) : null;
  const fatigueState = (ratio !== null) && (ratio > threshold);

  let alert: Alert | null = null;
  if (fatigueState && ratio !== null) {
    alert = {
      severity: "high",
      rule:     "Mandatory Volume Reduction",
      reason:   `ACWR ${ratio.toFixed(2)} exceeds the ${threshold} elevated-injury-risk threshold`,
      source:   "Block 4 Autoregulation Guardrail",
    };
  }

  return {
    acuteLoad:    Math.round(acuteLoad),
    chronicLoad:  Math.round(chronicLoad),
    ratio:        ratio === null ? null : +ratio.toFixed(3),
    threshold,
    fatigueState,
    alert,
    daysCovered:  n,
    insufficient,
  };
}

// ─── Micro-Recovery audit (3-min ATP-PC rule) ────────────────
export function auditMicroRecovery(
  bouts: Bout[],
  opts: { minRestSec?: number; atpPcType?: string } = {}
): MicroRecoveryReport {
  const minRest = opts.minRestSec ?? ATP_PC_MIN_REST_SEC;
  const atpType = opts.atpPcType  ?? ATP_PC_BOUT_TYPE;

  if (!Array.isArray(bouts) || bouts.length < 2) {
    return { violations: [], totalAtpPcBouts: bouts ? bouts.length : 0, pairsChecked: 0, threshold: minRest };
  }

  const tsMs = (b: Bout): number | null => {
    if (typeof b.start === "number") return b.start;
    const t = Date.parse(b.start);
    return isNaN(t) ? null : t;
  };

  const atp = bouts.filter((b) => b && b.type === atpType);
  const violations: MicroRecoveryReport["violations"] = [];
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
        fromBout:  prev,
        toBout:    curr,
        restSec:   Math.round(restSec),
        threshold: minRest,
        atIso:     curr.start,
      });
    }
  }
  return { violations, totalAtpPcBouts: atp.length, pairsChecked, threshold: minRest };
}

// ─── Combined audit wrapper ─────────────────────────────────
export function runLoadAudit(input: { dailyLoads?: number[]; bouts?: Bout[]; acwrOpts?: any; microOpts?: any }): LoadAuditReport {
  const acwr  = calculateACWR(input.dailyLoads || [], input.acwrOpts);
  const micro = auditMicroRecovery(input.bouts || [], input.microOpts);
  const alerts: Alert[] = [];
  if (acwr.alert) alerts.push(acwr.alert);
  if (micro.violations.length > 0) {
    alerts.push({
      severity: "medium",
      rule:     "Micro-Recovery Protocol Violation",
      reason:   `${micro.violations.length} of ${micro.pairsChecked} ATP-PC bout pair${micro.pairsChecked === 1 ? "" : "s"} fell below the ${micro.threshold / 60}-minute rest minimum`,
      source:   "Block 4 Micro-Recovery Guardrail",
    });
  }
  return {
    acwr,
    microRecovery: micro,
    alerts,
    summary: {
      fatigueState:   acwr.fatigueState,
      violationCount: micro.violations.length,
      anyAlerts:      alerts.length > 0,
    },
  };
}

// ─── Risk classification (matches panopticonPortal's _classifyRisk) ───
export function classifyRisk(report: LoadAuditReport | null, totalLoad: number): RiskStatus {
  if (!totalLoad || totalLoad === 0) return "dormant";
  if (!report) return "dormant";
  const fatigue = !!(report.summary && report.summary.fatigueState);
  const violations = !!(report.microRecovery && report.microRecovery.violations.length > 0);
  if (fatigue || violations) return "red";
  const ratio = report.acwr.ratio;
  if (ratio !== null && ratio >= YELLOW_LOWER && ratio < YELLOW_UPPER) return "yellow";
  return "green";
}
