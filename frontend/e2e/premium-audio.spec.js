// e2e/premium-audio.spec.js — Premium Audio Monetization (blueprint c509f26).
// Locks the two premium client surfaces through the REAL production components:
//
//   1. PremiumSessionPlayer + premiumSessionAudio engine — generate → play the
//      manifest, then a sustained out-of-band heart-rate feed arms the LOCAL
//      inflection governor and splices the pre-baked cue at a seam (no network).
//   2. LiveCheckinCoach — the connect → transcript → commitment → end state
//      machine over the scripted session fake (the convaiSession hooks contract).

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

test.describe('Product 1 — Biometric Narration engine', () => {
  test('generate → play → HR crossing splices an inflection cue at a seam', async ({ page }) => {
    await page.goto(`${HARNESS}?c=premium-session`);

    // No wearable chip until the manifest arms the layer — the harness passes an
    // hrSource, so after generation the chip reports the armed state.
    const player = page.getByTestId('premium-session-player');
    await expect(player).toBeVisible();

    await page.getByTestId('premium-generate').click();
    await expect(page.getByTestId('premium-play')).toBeVisible();
    await expect(page.getByTestId('premium-hr-chip')).toHaveText(/armed/i);

    await page.getByTestId('premium-play').click();
    await expect(page.getByTestId('premium-pause')).toBeVisible();

    // The intro slot fires from the virtual timeline.
    await expect(page.getByTestId('premium-active-slot')).toHaveText(/W0_INTRO|B1_S1_CALL/);

    // Sustained HIGH heart rate (above the 150 ceiling) past the hysteresis
    // window arms INF_HR_HIGH; the engine splices it at the next free seam —
    // entirely locally, zero network.
    await page.evaluate(async () => {
      for (let i = 0; i < 12; i += 1) {
        window.__pushHr?.(178);
        await new Promise((r) => setTimeout(r, 90));
      }
    });
    await expect(page.getByTestId('premium-inflection')).toHaveAttribute('data-inflection', 'INF_HR_HIGH', { timeout: 8000 });

    // End cleanly — the player returns to the ready state.
    await page.getByTestId('premium-stop').click();
    await expect(page.getByTestId('premium-play')).toBeVisible();
  });
});

test.describe('Product 2 — Live Mindset check-in loop', () => {
  test('connect → agent turn + user transcript → commitment logged → end', async ({ page }) => {
    await page.goto(`${HARNESS}?c=live-checkin`);

    await page.getByTestId('live-start').click();

    // Live status chip renders once the scripted session connects.
    await expect(page.getByTestId('live-status')).toBeVisible();
    await expect(page.getByTestId('live-end')).toBeVisible();

    // Both sides of the conversation land in the transcript.
    await expect(page.getByTestId('live-transcript')).toContainText("where's your head at today");
    await expect(page.getByTestId('live-transcript')).toContainText('Three fasted walks');

    // The agent's log_commitment tool call surfaces in the commitments box.
    await expect(page.getByTestId('live-commitments')).toContainText('Three fasted walks');

    // Ending the session returns the card to a restartable state.
    await page.getByTestId('live-end').click();
    await expect(page.getByTestId('live-start')).toBeVisible();
  });

  test('nutrition_audit mode renders its own framing', async ({ page }) => {
    await page.addInitScript((p) => { window.__HARNESS_PROPS__ = p; }, { mode: 'nutrition_audit' });
    await page.goto(`${HARNESS}?c=live-checkin`);
    await expect(page.getByTestId('live-checkin-coach')).toHaveAttribute('data-mode', 'nutrition_audit');
    await expect(page.getByTestId('live-checkin-coach')).toContainText(/Nutrition Audit/i);
  });
});
