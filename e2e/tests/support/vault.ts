// e2e/tests/support/vault.ts
// Shared helpers for the React Sovereign Vault E2E specs (Terminal 4 lane).
// Imported by the vault specs; never matched as a test itself (each config's
// testMatch lists the spec files explicitly).
import type { Page, Route } from '@playwright/test';

/**
 * The persisted PIN-RPC session envelope (AuthContext `bbf.session.v1`). Typed
 * loosely where the real payload varies — `programKey`/`type` are null for a youth
 * athlete or a brand-new client — so any spec can seed a custom session (not just
 * one structurally identical to the jacque_bbf default).
 */
export type SessionEnvelope = {
  uid: string;
  user: {
    id: string;
    username: string;
    role: string;
    type: string | null;
    programKey: string | null;
  };
  plans: unknown;
  authenticatedAt: number;
};

/** A valid non-admin client session (PIN-RPC auth, persisted to localStorage). */
export const CLIENT_SESSION: SessionEnvelope = {
  uid: 'jacque_bbf',
  user: {
    id: 'jacque_bbf',
    username: 'jacque_bbf',
    role: 'client',
    type: null,
    programKey: 'jacque_plan',
  },
  plans: null,
  authenticatedAt: Date.now(),
};

export const REAL_PROJECT_HOST = 'ihclbceghxpuawymlvgi.supabase.co';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

export function json(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Short-circuit CORS preflights (defensive — same-origin under the default config). */
export function isPreflight(route: Route): boolean {
  if (route.request().method() === 'OPTIONS') {
    route.fulfill({ status: 204, headers: cors });
    return true;
  }
  return false;
}

/** Seed an authenticated client session before any app script runs. */
export async function seedClientSession(page: Page, session: SessionEnvelope = CLIENT_SESSION): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(s));
    localStorage.removeItem('bbf.vault.weights.v1');
  }, session);
}

/**
 * Baseline Supabase neutralizer so the Vault shell renders with no real network:
 * a catch-all for REST/auth, benign profile + last-weights envelopes, and a
 * tripwire that records + aborts any call to the real project host. Returns
 * `realDbHits` so specs can assert nothing touched production.
 *
 * Register module-specific RPC mocks AFTER calling this — Playwright matches
 * routes in reverse registration order, so the later (specific) handler wins.
 */
export async function installSupabaseBaseline(page: Page): Promise<{ realDbHits: string[] }> {
  const realDbHits: string[] = [];

  await page.route('**/rest/v1/**', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, []);
  });
  await page.route('**/auth/v1/**', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, {});
  });
  await page.route('**/rest/v1/rpc/bbf_get_profile_metrics', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, {
      ok: true, total_sessions: 4, current_streak: 2, best_streak: 6,
      this_week: 2, this_month: 9, avg_per_week: 2.3, heatmap: [],
    });
  });
  await page.route('**/rest/v1/rpc/bbf_get_last_weights', (route) => {
    if (isPreflight(route)) return;
    return json(route, 200, { ok: true, day_idx: 0, weights: {} });
  });
  await page.route(`**${REAL_PROJECT_HOST}/**`, (route) => {
    realDbHits.push(route.request().url());
    return route.abort();
  });

  return { realDbHits };
}
