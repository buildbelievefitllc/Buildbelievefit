// src/native/pedometerBridge.js
// ─────────────────────────────────────────────────────────────────────────────
// Web → native bridge for the live hardware pedometer plugin (PedometerBridge).
//
// Same convention as healthConnectBridge.js: NO static `@capacitor/core` import, so
// the web/PWA bundle ships Capacitor-free and `npm run build` stays dependency-free
// (CLAUDE.md §6). Reads the runtime global the native shell injects
// (`window.Capacitor`) and degrades to a graceful no-op in a plain browser, where the
// plugin is absent and there is no hardware step sensor.
//
// Native side (single compiled source of truth):
//   Android: frontend/android/.../twa/PedometerBridgePlugin.kt (TYPE_STEP_COUNTER)
//   iOS:     frontend/ios/App/App/PedometerBridgePlugin.swift  (CMPedometer)

import { isNativePlatform } from './platform.js';

function capacitor() {
  return (typeof window !== 'undefined' && window.Capacitor) || null;
}

function plugin() {
  const c = capacitor();
  return (c && c.Plugins && c.Plugins.PedometerBridge) || null;
}

// The native pedometer bridge is present and callable on this device.
export function hasPedometerBridge() {
  return isNativePlatform() && !!plugin();
}

// { available: boolean, hasPermission: boolean, status?: string }
export async function pedometerAvailable() {
  const p = plugin();
  if (!p) return { available: false, hasPermission: false, status: 'no_bridge' };
  try {
    return await p.isAvailable();
  } catch (e) {
    return { available: false, hasPermission: false, status: 'error', detail: String((e && e.message) || e) };
  }
}

// Requests ACTIVITY_RECOGNITION (Android) / Motion (iOS). Resolves { granted }.
export async function requestPedometerPermissions() {
  const p = plugin();
  if (!p) return { granted: false };
  try {
    return await p.requestPermissions();
  } catch (e) {
    return { granted: false, error: String((e && e.message) || e) };
  }
}

// Begin the live hardware step stream. Throws a clean error off-platform.
export async function startPedometer() {
  const p = plugin();
  if (!p) throw new Error('The step sensor is only available in the BBF Lab app.');
  return p.start();
}

// Stop the stream. No-op-safe everywhere.
export async function stopPedometer() {
  const p = plugin();
  if (!p) return { stopped: true };
  try {
    return await p.stop();
  } catch {
    return { stopped: true };
  }
}

// One-shot read of the current session delta. { sessionSteps, listening }.
export async function getPedometerSteps() {
  const p = plugin();
  if (!p) return { sessionSteps: 0, listening: false };
  try {
    return await p.getSteps();
  } catch {
    return { sessionSteps: 0, listening: false };
  }
}

// Subscribe to live 'stepUpdate' events. Resolves to an async-safe unsubscribe
// function. Off-platform (no bridge) it is a no-op returning a no-op remover.
export async function addStepListener(cb) {
  const p = plugin();
  if (!p || typeof p.addListener !== 'function') return () => {};
  const handle = await p.addListener('stepUpdate', cb);
  return () => {
    try {
      if (handle && typeof handle.remove === 'function') handle.remove();
    } catch {
      /* already torn down — non-fatal */
    }
  };
}
