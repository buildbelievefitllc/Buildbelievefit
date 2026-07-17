// e2e/coach-broadcast-video.spec.js — Coach Lab · Broadcast Hub video-reel mode.
// Locks the contract that matters and is deterministic across headless envs:
//   1. The mode toggle exposes a Video mode sourced from the bundled 100-study
//      grid — visible even when the DB vault is empty (no listResearch dep).
//   2. Picking a study + Generate calls bbf-studio-voiceover with the study's
//      OWN audio_script as provided_script (Coach Akeem voices it verbatim).
//   3. The flow reaches a terminal state (preview OR a graceful error) — it
//      never hangs busy, regardless of whether the headless browser can encode.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };

// A tiny real, decodable silent WAV as a data URL — the "narration clip" the
// stubbed voiceover returns, so the renderer's <audio> genuinely loads.
function silentWavDataUrl(ms = 250) {
  const rate = 8000;
  const n = Math.floor((rate * ms) / 1000);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  return `data:audio/wav;base64,${buf.toString('base64')}`;
}

// RES-001 — the exact bundled study we drive.
const DUP_TITLE = 'Daily Undulating Periodization (DUP) for Strength and Hypertrophy';
const DUP_SCRIPT = 'Stuck in a training rut? Try Daily Undulating Periodization. By changing your reps and weights every workout, rather than every month, you keep your nervous system guessing, spark fresh muscle growth, and smash through strength plateaus.';

async function mount(page) {
  await page.addInitScript(() => {
    localStorage.setItem('bbf.session.v1', JSON.stringify({ vaultToken: 'test-vault-token' }));
  });
  // Newsletter mode fires listResearch on first mount — return an empty vault so
  // the video mode has to stand entirely on its own (bundled) source.
  await page.route('**/bbf-coach-vault', (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ ok: true, cards: [] }) }));
  await page.goto(`${HARNESS}?c=broadcast-hub`);
  await expect(page.getByTestId('broadcast-hub')).toBeVisible();
}

test('video mode voices the study\'s own audio_script and reaches a terminal state', async ({ page }) => {
  await mount(page);

  let voReq = null;
  await page.route('**/bbf-studio-voiceover', async (route) => {
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers: CORS }); return; }
    try { voReq = route.request().postDataJSON(); } catch { voReq = {}; }
    await route.fulfill({
      status: 200, headers: { ...CORS, 'content-type': 'application/json' },
      body: JSON.stringify({ ok: true, cached: false, url: silentWavDataUrl(250), vibe: 'the_architect', duration: 30, words: [{ text: 'Stuck', start: 0, end: 0.12 }, { text: 'in', start: 0.12, end: 0.2 }] }),
    });
  });

  // Switch to video mode — the bundled grid must render with no DB vault.
  await page.getByTestId('bc-mode-video').click();
  await expect(page.getByTestId('bc-video')).toBeVisible();

  // Filter to RES-001 and pick it.
  await page.getByTestId('bc-video-search').fill('Daily Undulating Periodization');
  const item = page.getByTestId('bc-study-RES-001');
  await expect(item).toContainText(DUP_TITLE);
  await item.click();
  await expect(item).toHaveAttribute('aria-pressed', 'true');

  // Generate → the voiceover call must carry the study's EXACT script.
  await page.getByTestId('bc-generate-video').click();
  await expect.poll(() => voReq && voReq.provided_script).toBe(DUP_SCRIPT);
  expect(voReq.topic).toBe(DUP_TITLE);

  // The flow must resolve to a terminal state — a preview OR a graceful error —
  // never an infinite busy spinner (render support varies by headless build).
  await expect(page.getByTestId('bc-reel-out').or(page.getByTestId('bc-video-error'))).toBeVisible({ timeout: 20000 });
});

test('video mode is reachable and lists bundled studies with no DB vault', async ({ page }) => {
  await mount(page);
  // Default mode is the newsletter; with an empty vault it shows the empty state.
  await expect(page.getByTestId('bc-newsletter-empty')).toBeVisible();

  await page.getByTestId('bc-mode-video').click();
  await expect(page.getByTestId('bc-video')).toBeVisible();
  // The bundled grid is present regardless of the DB.
  await page.getByTestId('bc-video-search').fill('Cluster Sets');
  await expect(page.getByTestId('bc-video').getByRole('button', { name: /Cluster Sets/i }).first()).toBeVisible();
});
