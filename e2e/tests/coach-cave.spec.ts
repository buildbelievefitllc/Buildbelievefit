import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * The Coach's Cave — admin-only sport-psychology film library (Command Center).
 * ===========================================================================
 * Verifies:
 *   1. An ADMIN session renders the Cave at /command/coach-cave: hero, the 3
 *      knowledge decks, a 10-film grid, the count line, and the inline player.
 *   2. Decks switch; a film cover expands into a YouTube embed and collapses.
 *   3. The EN·ES·PT switch swaps the roster to native-language films (trilingual).
 *   4. A NON-admin (client) session is denied — the Cave never renders.
 * Also captures full-page screenshots for a visual sign-off.
 */

const SHOTS =
  '/tmp/claude-0/-home-user-Buildbelievefit/253052c0-de49-5ca2-9900-c5dac2020053/scratchpad/shots';

const ADMIN_SESSION = {
  uid: 'akeem',
  vaultToken: 'e2e-admin',
  user: { id: 'akeem', username: 'akeem', role: 'admin', type: null, programKey: null },
  plans: null,
  authenticatedAt: Date.now(),
};

const CLIENT_SESSION = {
  uid: 'jacque_bbf',
  vaultToken: 'e2e-client',
  user: { id: 'jacque_bbf', username: 'jacque_bbf', role: 'client', type: null, programKey: 'jacque_plan' },
  plans: null,
  authenticatedAt: Date.now(),
};

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

// A clean purple→black gradient stands in for every YouTube thumbnail so the
// covers read as intentional (the real i.ytimg.com is blocked by egress policy).
const COVER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0" stop-color="#1c1233"/><stop offset="1" stop-color="#070608"/>' +
  '</linearGradient></defs><rect width="320" height="180" fill="url(#g)"/></svg>';

async function seed(page: Page, session: unknown): Promise<void> {
  await page.addInitScript((s) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(s));
  }, session);
}

async function neutralizeNetwork(page: Page): Promise<void> {
  const ok = (route: Route, body: unknown) =>
    route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });

  await page.route('**/rest/v1/**', (route) => {
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    return ok(route, []);
  });
  await page.route('**/auth/v1/**', (route) => ok(route, {}));
  await page.route('**/rest/v1/rpc/**', (route) => ok(route, { ok: true }));
  // Cosmetic stand-ins so screenshots are clean and nothing reaches the network.
  await page.route('**/i.ytimg.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: COVER_SVG }));
  await page.route('**/www.youtube.com/embed/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body style="margin:0;background:#0b0b0b"></body></html>' }));
}

test.describe('Coach’s Cave — admin film library', () => {
  test('renders, decks switch, player opens, trilingual swap', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await seed(page, ADMIN_SESSION);
    await neutralizeNetwork(page);

    await page.goto('/command/coach-cave');

    // 1 · Module + hero render.
    const mod = page.locator('[data-testid="coach-cave-module"]');
    await expect(mod).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.cc-title')).toBeVisible();
    await expect(page.locator('.cc-lockchip')).toBeVisible();

    // 3 knowledge decks, default = self-determination, grid of 10 films.
    await expect(page.locator('.cc-tab')).toHaveCount(3);
    await expect(page.locator('[data-testid="cc-deck-self-determination"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cc-grid .cc-card')).toHaveCount(10);
    await expect(page.locator('.cc-count')).toContainText('10');

    await page.screenshot({ path: `${SHOTS}/01-cave-hero-en.png`, fullPage: true });

    // 2 · Open the first film → inline YouTube embed; then collapse.
    const firstTitleEN = (await page.locator('.cc-meta-title').first().innerText()).trim();
    await page.locator('.cc-cover-btn').first().click();
    const iframe = page.locator('.cc-player-iframe').first();
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', /youtube\.com\/embed\//);
    await page.screenshot({ path: `${SHOTS}/02-cave-player-open.png`, fullPage: true });
    await page.locator('.cc-card-close').first().click();
    await expect(page.locator('.cc-player-iframe')).toHaveCount(0);

    // Deck switch → 02 Mind-Muscle & Flow (still 10 films, panel remounts).
    await page.locator('[data-testid="cc-deck-mind-muscle-flow"]').click();
    await expect(page.locator('[data-testid="cc-deck-mind-muscle-flow"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.cc-grid .cc-card')).toHaveCount(10);

    // Filter narrows the active deck (a selective channel query — "flow" matches
    // all 10 in THIS deck, which is itself correct, so use a unique one).
    await page.locator('[data-testid="cc-search"]').fill('big think');
    await expect(page.locator('.cc-grid .cc-card').first()).toBeVisible();
    const filtered = await page.locator('.cc-grid .cc-card').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(10);
    await page.locator('[data-testid="cc-search"]').fill('');

    // 3 · Trilingual swap: back to deck 01, flip to ES, roster changes.
    await page.locator('[data-testid="cc-deck-self-determination"]').click();
    const firstBeforeES = (await page.locator('.cc-meta-title').first().innerText()).trim();
    expect(firstBeforeES).toBe(firstTitleEN); // back on deck 01 in EN
    await page.locator('[data-testid="cc-lang-es"]').click();
    await expect(page.locator('[data-testid="cc-lang-es"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.cc-grid .cc-card')).toHaveCount(10);
    const firstAfterES = (await page.locator('.cc-meta-title').first().innerText()).trim();
    expect(firstAfterES).not.toBe(firstTitleEN); // roster genuinely swapped languages
    await page.screenshot({ path: `${SHOTS}/03-cave-deck-es.png`, fullPage: true });

    // Mobile sanity shot.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-testid="cc-lang-en"]').click();
    await expect(page.locator('[data-testid="coach-cave-module"]')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/04-cave-mobile.png`, fullPage: true });
  });

  test('non-admin client is denied — the Cave never renders', async ({ page }) => {
    await seed(page, CLIENT_SESSION);
    await neutralizeNetwork(page);

    await page.goto('/command/coach-cave');

    // AdminGuard shows the denial screen instead of the shell + Cave.
    await expect(page.getByText('Command Center Locked')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-testid="coach-cave-module"]')).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/05-cave-denied-client.png`, fullPage: true });
  });
});
