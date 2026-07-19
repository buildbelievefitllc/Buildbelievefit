// e2e/studio-codec-guard.spec.js — the VP9-fallback pre-export guardrail.
// Locks: before a render, the Studio warns (non-blocking) when the browser has no
// H.264 encoder and the reel would export via the VP9/AV1 fallback — and stays
// silent when H.264 IS available. The probe reuses the encoder's own codec list, so
// the banner can never disagree with what SovereignFoundry actually picks.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

// Force a specific WebCodecs support profile BEFORE the app loads, then open the reel
// (Video Engine) sidebar where the guardrail + export button live.
async function openReelWithCodec(page, { avcSupported }) {
  await page.addInitScript((avc) => {
    // Keep VideoEncoder/VideoFrame present (isSupported() stays true); only steer
    // which codecs report as configurable.
    if (window.VideoEncoder && window.VideoEncoder.isConfigSupported) {
      window.VideoEncoder.isConfigSupported = async (cfg) => {
        const codec = String(cfg?.codec || '');
        const isAvc = codec.startsWith('avc1');
        return { supported: isAvc ? avc : /^vp09|^av01/.test(codec), config: cfg };
      };
    }
  }, avcSupported);
  await page.goto(`${HARNESS}?c=studio-v4`);
  await expect(page.getByTestId('harness-root')).toBeVisible();
  await page.getByRole('tab', { name: /VIDEO ENGINE/i }).click();
}

test('warns before export when the browser has NO H.264 encoder (VP9 fallback)', async ({ page }) => {
  await openReelWithCodec(page, { avcSupported: false });
  const warn = page.getByTestId('codec-fallback-warning');
  await expect(warn).toBeVisible();
  await expect(warn).toContainText('Hardware H.264 not detected');
  await expect(warn).toContainText('lower quality on social platforms');
  // Non-blocking: the export button is still enabled (degraded export > hard crash).
  // Target the TikTok export by test-id — the reel now has two EXPORT buttons
  // (TikTok + Instagram/Facebook), so a /EXPORT/i role selector is ambiguous.
  await expect(page.getByTestId('tiktok-bridge-btn')).toBeEnabled();
});

test('stays silent when H.264 IS available (max-quality path)', async ({ page }) => {
  await openReelWithCodec(page, { avcSupported: true });
  // The reel section is mounted (probe has had its chance to resolve)…
  await expect(page.getByTestId('reel-text-layout')).toBeVisible();
  // …and no fallback warning is shown.
  await expect(page.getByTestId('codec-fallback-warning')).toHaveCount(0);
});
