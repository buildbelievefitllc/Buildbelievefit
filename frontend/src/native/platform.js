// src/native/platform.js
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for "are we inside the Capacitor native shell" (iOS /
// Android app), as opposed to the plain browser/PWA. Deliberately has NO static
// `@capacitor/core` import — the web bundle ships Capacitor-free; this reads the
// runtime global the native shell injects (`window.Capacitor`) and degrades to a
// no-op `false` in a plain browser. Mirrors the convention already established in
// healthConnectBridge.js (which now re-exports this instead of duplicating it).
//
// Used to sever the native app from the public marketing site / Stripe checkout
// surfaces (Apple In-App Purchase guideline 3.1.1 + anti-steering rule 3.1.3) —
// see App.jsx's RootRoute, Login.jsx's native-only auth UI, and UpgradeOverlay.jsx.

function capacitor() {
  return (typeof window !== 'undefined' && window.Capacitor) || null;
}

// True only inside the native iOS/Android (Capacitor) shell — never in the
// browser/PWA, even when installed to the home screen.
export function isNativePlatform() {
  const c = capacitor();
  return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
}
