import { test, expect, type Page } from '@playwright/test';

/**
 * BBF Champion Mindset — Layout & Visual Regression Test
 * =========================================================
 * Verifies that:
 * 1. The Champions Mindset section renders without content cutoff
 * 2. The Sport Psychology Lab section is properly positioned
 * 3. All flex layout constraints are correctly applied
 *
 * Tests the fixes for:
 * - .cm container sizing and overflow handling
 * - .cm-hero flex-shrink constraint
 * - .spsy (Sport Psychology Deck) positioning context
 */

const SESSION = {
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

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
};

function json(route, status, body) {
  return route.fulfill({
    status,
    headers: { ...cors, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function isPreflight(route): boolean {
  if (route.request().method() === 'OPTIONS') {
    route.fulfill({ status: 204, headers: cors });
    return true;
  }
  return false;
}

async function seedAuth(page: Page): Promise<void> {
  await page.addInitScript((session) => {
    localStorage.setItem('bbf.session.v1', JSON.stringify(session));
  }, SESSION);
}

test.describe('Champion Mindset — Layout & Positioning', () => {
  test('hero section displays without cutoff', async ({ page }) => {
    await seedAuth(page);

    await page.route('**/rest/v1/**', (route) => {
      if (isPreflight(route)) return;
      const url = route.request().url();
      if (url.includes('bbf_get_profile_metrics')) {
        return json(route, 200, {
          data: {
            uid: 'jacque_bbf',
            found: true,
            totalSessions: 24,
            currentStreak: 8,
            bestStreak: 12,
            thisWeek: 3,
            thisMonth: 10,
            avgPerWeek: 2,
          },
        });
      }
      return json(route, 200, []);
    });

    await page.goto('/vault');
    await page.waitForSelector('[data-testid="vault-tab-mindset"]', { timeout: 10000 });
    await page.click('[data-testid="vault-tab-mindset"]');
    await page.waitForSelector('[data-testid="champion-mindset-module"]', { timeout: 5000 });

    // Verify hero section is visible and properly sized
    const heroSection = await page.locator('.cm-hero').first();
    const heroBounds = await heroSection.boundingBox();

    expect(heroBounds).toBeTruthy();
    expect(heroBounds.y).toBeGreaterThanOrEqual(0);
    expect(heroBounds.height).toBeGreaterThan(80);

    // Verify title is fully visible
    const titleElement = await page.locator('.cm-title').first();
    const titleBounds = await titleElement.boundingBox();
    expect(titleBounds).toBeTruthy();
    expect(titleBounds.y).toBeGreaterThanOrEqual(0);

    // Verify pill badge is visible at the top
    const pillElement = await page.locator('.cm-pill').first();
    const pillBounds = await pillElement.boundingBox();
    expect(pillBounds).toBeTruthy();
    expect(pillBounds.y).toBeGreaterThanOrEqual(heroBounds.y);
  });

  test('sport psychology deck renders with correct positioning', async ({ page }) => {
    await seedAuth(page);

    await page.route('**/rest/v1/**', (route) => {
      if (isPreflight(route)) return;
      const url = route.request().url();
      if (url.includes('bbf_get_profile_metrics')) {
        return json(route, 200, {
          data: {
            uid: 'jacque_bbf',
            found: true,
            totalSessions: 24,
            currentStreak: 8,
            bestStreak: 12,
            thisWeek: 3,
            thisMonth: 10,
            avgPerWeek: 2,
          },
        });
      }
      return json(route, 200, []);
    });

    await page.goto('/vault');
    await page.click('[data-testid="vault-tab-mindset"]');
    await page.waitForSelector('[data-testid="champion-mindset-module"]', { timeout: 5000 });

    // Scroll to the psychology deck
    await page.evaluate(() => {
      const el = document.querySelector('.spsy');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

    // Verify the psychology deck (Sport Psychology Lab) is visible
    const psychologyDeck = await page.locator('.spsy').first();
    const psychBounds = await psychologyDeck.boundingBox();

    expect(psychBounds).toBeTruthy();
    expect(psychBounds.height).toBeGreaterThan(100);

    // Verify the deck's header is visible
    const deckHeader = await page.locator('.spsy-title').first();
    const headerBounds = await deckHeader.boundingBox();
    expect(headerBounds).toBeTruthy();
    expect(headerBounds.y).toBeGreaterThanOrEqual(0);
  });

  test('champion mindset renders correctly on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await seedAuth(page);

    await page.route('**/rest/v1/**', (route) => {
      if (isPreflight(route)) return;
      const url = route.request().url();
      if (url.includes('bbf_get_profile_metrics')) {
        return json(route, 200, {
          data: {
            uid: 'jacque_bbf',
            found: true,
            totalSessions: 24,
            currentStreak: 8,
            bestStreak: 12,
            thisWeek: 3,
            thisMonth: 10,
            avgPerWeek: 2,
          },
        });
      }
      return json(route, 200, []);
    });

    await page.goto('/vault');
    await page.click('[data-testid="vault-tab-mindset"]');
    await page.waitForSelector('[data-testid="champion-mindset-module"]', { timeout: 5000 });

    // Verify main container has correct layout properties
    const cmContainer = await page.locator('.cm').first();
    const cmStyle = await cmContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        flexDirection: computed.flexDirection,
        overflow: computed.overflow,
        width: computed.width,
        margin: computed.margin,
      };
    });

    expect(cmStyle.display).toBe('flex');
    expect(cmStyle.flexDirection).toBe('column');
    expect(cmStyle.overflow).toBe('visible');

    // Verify hero section doesn't shrink
    const heroStyle = await page.locator('.cm-hero').first().evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        flexShrink: computed.flexShrink,
      };
    });

    expect(heroStyle.flexShrink).toBe('0');
  });
});
