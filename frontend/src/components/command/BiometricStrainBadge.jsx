// src/components/command/BiometricStrainBadge.jsx
// ─────────────────────────────────────────────────────────────────────────────
// "Biometric Strain" — the roster status chip driven by the athlete's SUBJECTIVE
// (Foster sRPE) ACWR from the in-house bbf_compute_acwr engine. Hover / tap opens
// a glassmorphism tooltip with the exact acute vs chronic workload and the sRPE
// ratio next to the mechanical (tonnage) ratio — the dual-engine read.
//
// Honest-by-default: an athlete with no logged sRPE sessions (ratio 0 / no data)
// renders NOTHING, so the Founder Five never show a false "under-trained" flag.
//
// Bands (per spec, with a caution filler for the 1.3–1.5 gap so no ratio is left
// unlabeled):
//   ≥ 1.5           → HIGH RISK    (pulsing neon red)
//   1.3 ≤ r < 1.5   → ELEVATED     (caution amber)
//   0.8 ≤ r ≤ 1.3   → SWEET SPOT   (gold-bordered green)
//   < 0.8           → UNDER-TRAINED (muted grey/yellow)

import { useId, useState } from 'react';
import './BiometricStrainBadge.css';

function classify(ratio) {
  if (ratio >= 1.5) return { tone: 'high', icon: '⚠️', label: 'HIGH RISK' };
  if (ratio >= 1.3) return { tone: 'elevated', icon: '◔', label: 'ELEVATED' };
  if (ratio >= 0.8) return { tone: 'sweet', icon: '✓', label: 'SWEET SPOT' };
  return { tone: 'under', icon: '↓', label: 'UNDER-TRAINED' };
}

export default function BiometricStrainBadge({ data }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();

  const subj = data?.subjective || null;
  const ratio = subj ? Number(subj.ratio) : 0;
  const acuteN = subj ? Number(subj.acute) : 0;
  const chronicN = subj ? Number(subj.chronic) : 0;

  // No real signal → render nothing (never a fabricated flag).
  if (!subj || !(ratio > 0) || (!(acuteN > 0) && !(chronicN > 0))) return null;

  const band = classify(ratio);
  const r = ratio.toFixed(2);
  const acute = acuteN.toFixed(0);
  const chronic = chronicN.toFixed(0);
  const tonnage = data?.tonnage != null ? Number(data.tonnage).toFixed(2) : '—';

  const toggle = (e) => { e.stopPropagation(); setOpen((v) => !v); };

  return (
    <span
      className="bsb-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span
        className={`bsb-chip bsb-chip--${band.tone}`}
        role="button"
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        aria-label={`Biometric strain ${band.label} — sRPE ACWR ${r}`}
        data-testid="biometric-strain-badge"
        data-band={band.tone}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(e); } }}
      >
        {band.tone === 'high' ? <span className="bsb-pulse" aria-hidden="true" /> : null}
        <span className="bsb-ic" aria-hidden="true">{band.icon}</span>
        {band.label}: {r}
      </span>

      {open ? (
        <span className="bsb-tip" id={tipId} role="tooltip">
          <span className="bsb-tip-h">Biometric Strain · sRPE</span>
          <span className="bsb-tip-row"><em>Acute Workload</em><b>{acute}</b></span>
          <span className="bsb-tip-row"><em>Chronic Workload</em><b>{chronic}</b></span>
          <span className="bsb-tip-div" aria-hidden="true" />
          <span className="bsb-tip-row"><em>Perceived sRPE Fatigue</em><b>{r}</b></span>
          <span className="bsb-tip-row"><em>vs. Mechanical Load</em><b>{tonnage}</b></span>
        </span>
      ) : null}
    </span>
  );
}
