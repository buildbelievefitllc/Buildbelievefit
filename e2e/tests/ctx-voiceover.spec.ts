import { test, expect, type Page, type Route } from '@playwright/test';
import {
  CLIENT_SESSION,
  installSupabaseBaseline,
  isPreflight,
  seedClientSession,
  type SessionEnvelope,
} from './support/vault.js';

/**
 * BBF Vault — Contextual Voiceover Layer
 * ============================================================================
 * Browser-drone proof that Coach Akeem's "explain the WHY" clips are wired to
 * their three surfaces:
 *
 *   1. Client Hub Check-In  — a paused player (AUDIO_CTX_HUB_CHECKIN) sits at the
 *      TOP of the Check-In tab.
 *   2. Program / Enter the Floor — a paused player (AUDIO_CTX_PROGRAM_RPE) sits
 *      directly below the What-is-RPE accordion.
 *   3. Post-Workout Check-In modal — the player (AUDIO_CTX_POST_WORKOUT) AUTO-PLAYS
 *      strictly once on the modal's initial mount, and NEVER re-fires when a
 *      pain/RPE slider re-renders the sheet.
 *
 * Hermetic: every REST/auth call is intercepted; the sovereign audio bucket is
 * stubbed with an inert MP3 so playback resolves without touching prod, and the
 * real-project-host tripwire guarantees the run never hits the live backend.
 */

const SESSION: SessionEnvelope = { ...CLIENT_SESSION, vaultToken: 'e2e-vault-token' };

// Minimal valid MP3 frame header — enough for <audio> to resolve a source.
const TINY_MP3 = Buffer.from([0xff, 0xfb, 0x90, 0x00]);

/**
 * Serve any contextual-voiceover clip from the sovereign audio bucket
 * (studio-audio-vault) as an inert MP3. Registered AFTER installSupabaseBaseline so
 * it WINS over the real-host tripwire (Playwright matches routes in reverse order).
 */
async function stubContextualAudio(page: Page): Promise<void> {
  await page.route('**/storage/v1/object/public/studio-audio-vault/**', (route: Route) => {
    if (isPreflight(route)) return;
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'audio/mpeg', 'access-control-allow-origin': '*', 'accept-ranges': 'bytes' },
      body: TINY_MP3,
    });
  });
}

/**
 * Spy on every HTMLMediaElement.play() (keyed by src) BEFORE any app script runs,
 * so we can prove the modal auto-play fires exactly ONCE on mount. The push happens
 * before the real play() so it records the intent regardless of browser autoplay
 * policy (headless Chromium may reject an un-gestured play()).
 */
async function installPlaySpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as unknown as { __bbfPlays: string[] }).__bbfPlays = [];
    const orig = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play(this: HTMLMediaElement) {
      try { (window as unknown as { __bbfPlays: string[] }).__bbfPlays.push(this.currentSrc || this.src || ''); } catch { /* ignore */ }
      return orig.apply(this, [] as unknown as []);
    };
  });
}

const postWorkoutPlayCount = (page: Page) =>
  page.evaluate(() =>
    ((window as unknown as { __bbfPlays: string[] }).__bbfPlays || []).filter((s) => s.includes('post-workout')).length,
  );

test.describe('BBF Vault — contextual voiceover layer', () => {
  test('Hub + Program players render paused and wired to their static Akeem clips', async ({ page }) => {
    await seedClientSession(page, SESSION);
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubContextualAudio(page);

    await page.goto('/vault');
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');

    // ── 1 · Client Hub Check-In player — top of the Check-In tab, PAUSED default ──
    await page.getByTestId('vault-tab-checkin').click();
    const hub = page.getByTestId('ctx-vo-hub-checkin');
    await expect(hub).toBeVisible();
    await expect(hub).toHaveAttribute('data-audiokey', 'AUDIO_CTX_HUB_CHECKIN');
    await expect(hub).toHaveAttribute('data-playing', '0');       // paused on load
    await expect(hub).toHaveAttribute('data-autoplay', 'off');    // no auto-play here
    await expect(hub.getByTestId('ctx-vo-hub-checkin-audio')).toHaveAttribute(
      'src', /accountability-audio-ctx-hub-checkin\.mp3$/,
    );

    // ── 2 · Program / Enter the Floor player — below the What-is-RPE accordion ──
    await page.getByRole('tab', { name: 'Program' }).click();
    const prog = page.getByTestId('ctx-vo-program-rpe');
    await expect(prog).toBeVisible();
    await expect(prog).toHaveAttribute('data-audiokey', 'AUDIO_CTX_PROGRAM_RPE');
    await expect(prog).toHaveAttribute('data-playing', '0');
    await expect(prog.getByTestId('ctx-vo-program-rpe-audio')).toHaveAttribute(
      'src', /rpe-education-audio-ctx-program-rpe\.mp3$/,
    );
    // The What-is-RPE accordion still sits ABOVE the new player.
    await expect(page.locator('.rpe-card')).toBeVisible();

    // ── 3 · Nutrition player — top of the Nutrition tab, PAUSED default ──
    await page.getByRole('tab', { name: 'Nutrition' }).click();
    const nut = page.getByTestId('ctx-vo-nutrition');
    await expect(nut).toBeVisible();
    await expect(nut).toHaveAttribute('data-audiokey', 'AUDIO_CTX_NUTRITION');
    await expect(nut).toHaveAttribute('data-playing', '0');
    await expect(nut).toHaveAttribute('data-autoplay', 'off');
    await expect(nut.getByTestId('ctx-vo-nutrition-audio')).toHaveAttribute(
      'src', /nutrition-audio-ctx-nutrition\.mp3$/,
    );

    expect(realDbHits).toHaveLength(0);
  });

  test('Post-Workout modal auto-plays Coach Akeem once on mount — not on slider re-render', async ({ page }) => {
    await installPlaySpy(page);          // must wrap play() before the app loads
    await seedClientSession(page, SESSION);
    const { realDbHits } = await installSupabaseBaseline(page);
    await stubContextualAudio(page);

    await page.goto('/vault');
    await expect(page.locator('.cv-greet')).toContainText('@jacque_bbf');

    // Open the Post-Workout Check-In modal the way the loggers do — a session-complete event.
    await page.evaluate(() => window.dispatchEvent(new Event('bbf:session-complete')));

    const modal = page.getByTestId('post-workout-checkin');
    await expect(modal).toBeVisible();

    // The contextual player is present inside the sheet and AUTO-PLAYED on mount.
    const player = page.getByTestId('ctx-vo-post-workout');
    await expect(player).toBeVisible();
    await expect(player).toHaveAttribute('data-audiokey', 'AUDIO_CTX_POST_WORKOUT');
    await expect(player).toHaveAttribute('data-autoplay', 'fired'); // mount-only hook fired
    await expect(player.getByTestId('ctx-vo-post-workout-audio')).toHaveAttribute(
      'src', /accountability-audio-ctx-post-workout\.mp3$/,
    );

    // play() was invoked exactly once for the post-workout clip.
    await expect.poll(() => postWorkoutPlayCount(page)).toBe(1);

    // ── Prove the constraint: adjusting the sliders / pills MUST NOT re-fire play ──
    await modal.locator('input.pwc-range--pain').evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '8');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await modal.locator('input.pwc-range--rpe').evaluate((el: HTMLInputElement) => {
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      set.call(el, '9');
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await modal.getByRole('radio').nth(1).click(); // change target area → another re-render

    // Value re-rendered, but the auto-play hook did NOT re-fire.
    await expect(modal.locator('.pwc-value[data-tone="pain"]')).toContainText('8');
    await expect(player).toHaveAttribute('data-autoplay', 'fired');
    expect(await postWorkoutPlayCount(page)).toBe(1);

    expect(realDbHits).toHaveLength(0);
  });
});
