// e2e/studio-foundry-failfast.spec.js — the "stuck at 0%" regression lock.
// A reel export whose footage cannot load/decode (revoked blob URL after a tab
// reclaim, bad pasted URL, unsupported codec) must FAIL FAST with a clear slug —
// not slide past the readiness wait into the seek loop and grind black frames
// for hours while the progress overlay reads 0% (the field failure this locks).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test('render() rejects footage_load_failed quickly on a dead footage URL', async ({ page }) => {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();

  const verdict = await page.evaluate(async () => {
    const { SovereignFoundry } = await import('/src/lib/SovereignFoundry.js');
    if (!SovereignFoundry.isSupported()) return { skipped: true };
    const foundry = new SovereignFoundry(document.body);
    const t0 = performance.now();
    try {
      // A blob URL that was never minted — the exact shape a revoked upload leaves behind.
      await foundry.render({ videoUrl: 'blob:http://localhost/dead-dead-dead', durationCap: 90 });
      return { threw: false };
    } catch (e) {
      return { threw: true, slug: e && e.message, ms: Math.round(performance.now() - t0) };
    }
  });

  test.skip(verdict.skipped === true, 'WebCodecs unavailable in this browser build');
  expect(verdict.threw).toBe(true);
  expect(verdict.slug).toBe('footage_load_failed');
  // The point of the fix: seconds, not the old multi-hour silent seek grind.
  expect(verdict.ms).toBeLessThan(12_000);
});

test('the studio surfaces footage_load_failed as an actionable message', async ({ page }) => {
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
  await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();
  // The humanizer lives in StudioLayout — assert the mapping exists by checking the
  // module ships the copy (cheap source-of-truth probe, no full export needed).
  const hasMapping = await page.evaluate(async () => {
    const res = await fetch('/src/components/SovereignStudioV4/StudioLayout.jsx');
    const src = await res.text();
    return src.includes('footage_load_failed') && src.includes('seek_stalled');
  });
  expect(hasMapping).toBe(true);
});
