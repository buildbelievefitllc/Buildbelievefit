// e2e/biomechanics-viewer.spec.js — Anatomy Arena · 3D Biomechanical Viewer HUD.
// The WebGL viewport is lazy/code-split and behind an error boundary; these specs
// lock the NATIVE-React interface that must work regardless of GPU:
//   1. The HUD renders (system overlays, CNS panel, detail empty state, the LOCKED
//      OT scope disclaimer, console tonal volume).
//   2. The CNS Autoregulator math + copy: 8→1.0x/100%, 6→0.8x/80%, 3→0.5x/50%.
//   3. System-overlay toggles flip state.
//   4. Trilingual: switching language relocalizes the CNS state.
//   5. Inject Readiness Prehab selects the right joint → localized detail card;
//      Reset clears it.

import { test, expect } from '@playwright/test';

const HARNESS = '/e2e/harness/index.html';

async function mount(page) {
  await page.goto(`${HARNESS}?c=biomechanics-viewer`);
  await expect(page.getByTestId('biomechanics-viewer')).toBeVisible();
}

test('HUD renders the panels, empty detail state, and the locked scope disclaimer', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('av-toggle-skeletal')).toBeVisible();
  await expect(page.getByTestId('av-toggle-muscular')).toBeVisible();
  await expect(page.getByTestId('av-toggle-neurological')).toBeVisible();
  await expect(page.getByTestId('av-detail-empty')).toBeVisible();
  await expect(page.getByTestId('av-scope')).toContainText('Do not diagnose injuries');
});

test('CNS autoregulator maps readiness → volume across the ecosystem', async ({ page }) => {
  await mount(page);
  // default score 8 → optimum
  await expect(page.getByTestId('av-cns-multiplier')).toHaveText('1x');
  await expect(page.getByTestId('av-cns-state')).toHaveText('Sovereign Optimum');
  await expect(page.getByTestId('av-tonal-vol')).toHaveText('100%');

  await page.getByTestId('av-cns-score').fill('6');            // moderate
  await expect(page.getByTestId('av-cns-multiplier')).toHaveText('0.8x');
  await expect(page.getByTestId('av-cns-state')).toHaveText('CNS Volume Alert');
  await expect(page.getByTestId('av-tonal-vol')).toHaveText('80%');

  await page.getByTestId('av-cns-score').fill('3');            // redline
  await expect(page.getByTestId('av-cns-multiplier')).toHaveText('0.5x');
  await expect(page.getByTestId('av-tonal-vol')).toHaveText('50%');
});

test('system-overlay toggle flips visibility state', async ({ page }) => {
  await mount(page);
  const skeletal = page.getByTestId('av-toggle-skeletal');
  await expect(skeletal).toHaveAttribute('aria-pressed', 'true');
  await skeletal.click();
  await expect(skeletal).toHaveAttribute('aria-pressed', 'false');
});

test('language switch relocalizes the CNS state (EN → ES)', async ({ page }) => {
  await mount(page);
  await expect(page.getByTestId('av-cns-state')).toHaveText('Sovereign Optimum');
  await page.getByTestId('av-lang-es').click();
  await expect(page.getByTestId('av-cns-state')).toHaveText('Soberano Óptimo');
});

test('Inject Readiness Prehab selects the right joint, Reset clears it', async ({ page }) => {
  await mount(page);
  // default score 8 → hip focus
  await page.getByTestId('av-inject-prehab').click();
  await expect(page.getByTestId('av-detail-content')).toBeVisible();
  await expect(page.getByTestId('av-detail-title')).toContainText('Hip');

  await page.getByTestId('av-reset').click();
  await expect(page.getByTestId('av-detail-empty')).toBeVisible();

  // low readiness → lumbar shield
  await page.getByTestId('av-cns-score').fill('3');
  await page.getByTestId('av-inject-prehab').click();
  await expect(page.getByTestId('av-detail-title')).toContainText('Lumbar');
});
