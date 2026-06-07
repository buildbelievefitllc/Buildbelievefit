// src/components/TierGate.jsx
// ─────────────────────────────────────────────────────────────────────────────
// <TierGate feature="smart_cardio"> …tool… </TierGate>
//
// The declarative, feature-grained gate for the React engine. Reads the athlete's
// live entitlement (useEntitlement → entitlements.js FEATURE_ACCESS) and renders
// the children only when their tier unlocks `feature`.
//
// FAIL-OPEN UX (CEO priority): while the tier is still resolving (RPC in-flight /
// not-deployed / network blip) the children render — useEntitlement reports a soft
// God-Mode state, so a PAYING athlete is NEVER padlocked on a blip. Only a
// DEFINITIVE "this tier does not unlock the feature" shows the fallback.
//
// Fallback handling:
//   • render="overlay" (default) → the UpgradeOverlay padlock (visibility-as-sales).
//   • render="hide"              → render nothing (for buttons / FABs that vanish).
//   • fallback={<custom/>}       → render a caller-supplied node.

import { useEntitlement } from '../lib/useEntitlement.js';
import UpgradeOverlay from './vault/UpgradeOverlay.jsx';

export default function TierGate({
  feature,
  children,
  fallback,
  render = 'overlay',
  featureLabelKey,
  featureLabel,
  testId,
}) {
  const ent = useEntitlement();

  // Fail-open: still resolving OR entitled → show the real tool.
  if (ent.isResolving || ent.canAccessFeature(feature)) {
    return <>{children}</>;
  }

  // Definitively locked for this tier.
  if (fallback !== undefined) return <>{fallback}</>;
  if (render === 'hide') return null;
  return (
    <UpgradeOverlay
      featureLabelKey={featureLabelKey}
      featureLabel={featureLabel}
      target={ent.upgradeTargetForFeature(feature)}
      testId={testId}
    />
  );
}
