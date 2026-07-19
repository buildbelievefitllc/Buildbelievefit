// e2e/anatomy-viewer.spec.js — 3D Anatomy Engine · viewport + interaction smoke.
//
// Regression net for the refinements made to the Biomechanics Viewer:
//   • the WebGL viewport mounts and paints a <canvas> (software-GL in CI);
//   • OrbitControls survives a trackpad/mouse drag without throwing;
//   • the collapsible side rails slide off-screen and back via the edge tabs;
//   • selecting a joint mounts the edge-docked detail card, clear of centre.
//
// Mount strategy mirrors biomechanics-viewer.spec.js: the harness mounts the exact
// <BiomechanicsViewer> that the Coach Lab "Biomechanics" tab renders
// (CoachLab.jsx → active.key === 'biomechanics'), minus the admin-gated /command
// routing. That keeps the suite deterministic and GPU-tolerant.
//
// On WebGL raycasting: a 2.6 cm joint bead has no stable screen position under a
// headless, auto-framing (drei <Bounds>) + auto-rotating camera, so pixel-clicking
// it is inherently non-deterministic. We therefore drive the *identical*
// selection → detail-card code path through the app (av-inject-prehab, the same
// state update a bead click triggers) for the hard assertions, and fire a real
// canvas click purely as a no-throw smoke over the raycast pipeline.

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HARNESS = '/e2e/harness/index.html';
const GLB_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '../public/anatomy/model.glb');
const GLB_BYTES = readFileSync(GLB_PATH); // read once; served back as a controlled 200

// Fulfil the anatomy mesh from disk so the "asset load" is an explicit, offline
// success rather than a flaky server round-trip. (Draco sidecars under /draco/
// pass through untouched — a real mesh must still decode via the local decoder.)
// Returns a tracker whose `served` flag flips the moment the viewport requests
// the mesh — a more reliable signal than a `response` event, which fulfilled
// routes don't dependably emit.
async function mockGlb(page) {
  const tracker = { served: false };
  await page.route('**/anatomy/model.glb', async (route) => {
    tracker.served = true;
    await route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB_BYTES });
  });
  return tracker;
}

async function mountViewer(page) {
  const glb = await mockGlb(page);
  await page.goto(`${HARNESS}?c=biomechanics-viewer`);
  await expect(page.getByTestId('biomechanics-viewer')).toBeVisible();
  return glb;
}

const canvasOf = (page) => page.locator('.av-root canvas').first();

test('viewport mounts and paints a WebGL <canvas> on a successful GLB load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));

  const glb = await mountViewer(page);

  // The canvas only exists if the WebGL context initialised (else CanvasBoundary
  // swaps in the fallback) — so its visibility IS the "viewport is live" signal.
  await expect(canvasOf(page)).toBeVisible({ timeout: 15_000 });

  // The viewport requested our mocked mesh (served 200) and nothing threw uncaught.
  await expect.poll(() => glb.served, { timeout: 15_000 }).toBe(true);
  expect(errors, `uncaught page errors:\n${errors.join('\n')}`).toEqual([]);
});

test('canvas accepts a trackpad/mouse drag without throwing (OrbitControls)', async ({ page }) => {
  await mountViewer(page);
  const canvas = canvasOf(page);
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  const box = await canvas.boundingBox();

  // Only count throws DURING the drag — isolate the interaction from any
  // mount-time WebGL noise.
  const dragErrors = [];
  page.on('pageerror', (e) => dragErrors.push(e.message));

  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 140, cy + 50, { steps: 15 }); // orbit sweep
  await page.mouse.move(cx + 60, cy - 30, { steps: 10 });
  await page.mouse.up();

  expect(dragErrors, `drag threw:\n${dragErrors.join('\n')}`).toEqual([]);
  await expect(canvas).toBeVisible(); // controls didn't tear the viewport down
});

test('edge tabs collapse and restore both side rails', async ({ page }) => {
  await mountViewer(page);
  const left = page.locator('.av-left');
  const right = page.locator('.av-right');

  await expect(left).not.toHaveClass(/is-collapsed/);
  await expect(right).not.toHaveClass(/is-collapsed/);
  const leftX0 = (await left.boundingBox()).x;
  const rightX0 = (await right.boundingBox()).x;

  // Collapse LEFT → class flips and the rail slides off its left edge (x drops).
  await page.getByTestId('av-rail-toggle-left').click();
  await expect(left).toHaveClass(/is-collapsed/);
  await expect.poll(async () => (await left.boundingBox())?.x ?? -1e4).toBeLessThan(leftX0);

  // Collapse RIGHT → slides off the right edge (x grows).
  await page.getByTestId('av-rail-toggle-right').click();
  await expect(right).toHaveClass(/is-collapsed/);
  await expect.poll(async () => (await right.boundingBox())?.x ?? 1e5).toBeGreaterThan(rightX0);

  // Restore both.
  await page.getByTestId('av-rail-toggle-left').click();
  await page.getByTestId('av-rail-toggle-right').click();
  await expect(left).not.toHaveClass(/is-collapsed/);
  await expect(right).not.toHaveClass(/is-collapsed/);
  await expect.poll(async () => (await left.boundingBox())?.x ?? -1e4).toBeCloseTo(leftX0, 0);
});

test('selecting a joint mounts the edge-docked detail card, clear of viewport centre', async ({ page }) => {
  await mountViewer(page);
  const canvas = canvasOf(page);
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Empty invitation state before any selection.
  await expect(page.getByTestId('av-detail-empty')).toBeVisible();

  // Real canvas click — smoke over the R3F raycast pipeline (no-throw only; the
  // bead's screen position isn't deterministic headless, see file header).
  const raycastErrors = [];
  page.on('pageerror', (e) => raycastErrors.push(e.message));
  const cbox = await canvas.boundingBox();
  await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
  expect(raycastErrors, `raycast click threw:\n${raycastErrors.join('\n')}`).toEqual([]);

  // Deterministic joint selection (same state update a bead click performs):
  // score 8 → hip focus. The detail card must mount with the targeted data.
  await page.getByTestId('av-inject-prehab').click();
  await expect(page.getByTestId('av-detail-content')).toBeVisible();
  await expect(page.getByTestId('av-detail-title')).toContainText('Hip');

  // Edge-docked & not covering centre: the right rail sits entirely in the right
  // half of the stage and hugs the right edge.
  const root = await page.locator('.av-root').boundingBox();
  const rail = await page.locator('.av-right').boundingBox();
  const centreX = root.x + root.width / 2;
  expect(rail.x).toBeGreaterThan(centreX);                         // starts right of centre
  expect(root.x + root.width - (rail.x + rail.width)).toBeLessThan(40); // hugs the right edge
});

test('the "Jump to Region" directory focuses each region\'s primary joint', async ({ page }) => {
  await mountViewer(page);
  const jump = page.getByTestId('av-jump-region');
  await expect(jump).toBeVisible();

  // Each region activates its primary joint → the detail card shows that joint's
  // data. Deterministic (no WebGL raycast) — the camera focus is imperative Bounds
  // and asserted separately by the no-throw drag/canvas specs.
  await jump.selectOption('pelvic');
  await expect(page.getByTestId('av-detail-title')).toContainText('Hip');

  await jump.selectOption('lower');
  await expect(page.getByTestId('av-detail-title')).toContainText('Knee');

  await jump.selectOption('axial');
  await expect(page.getByTestId('av-detail-title')).toContainText('Lumbar');

  // Clearing the selection returns the directory to its neutral prompt.
  await jump.selectOption('');
  await expect(jump).toHaveValue('');
});
