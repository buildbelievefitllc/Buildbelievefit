// src/components/hub/CalibratingChip.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Phase 3.1 — the "Calibrating…" chip (Onboarding blueprint §3.3).
//
// The ONE visual tell that separates a degraded card from a healthy one. A card
// falling back to Layer-2 config defaults wears this chip; everything else about
// it is identical to the live state (the "No Empty Dashboards" promise — a
// degraded account is visually indistinguishable except for this chip).
//
// Brand-locked: BBF Purple→Gold gradient border, Bebas label, a soft pulse so it
// reads as "working, not broken". Fully localized — the word never hardcodes
// English; it resolves through HUB_STR by the athlete's preferred_locale.
//
// @param {{ label?: string }} props  optional override; defaults to the localized "Calibrating…"

import { useHubStr } from './hubStrings.js';
import './hub.css';

export default function CalibratingChip({ label }) {
  const { hs } = useHubStr();
  const text = label || hs.calibrating;
  return (
    <span className="hub-cal-chip" role="status" aria-label={hs.calibratingAria} title={hs.calibratingAria}>
      <span className="hub-cal-dot" aria-hidden="true" />
      <span className="hub-cal-label">{text}</span>
    </span>
  );
}
