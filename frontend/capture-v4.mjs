#!/usr/bin/env node
// Drives the isolated Studio V4 harness and captures real screenshots of every
// mode + key interactions. Fails loudly if the component throws or renders empty.
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || '/tmp/claude-0/-home-user-Buildbelievefit/463f2a18-a6e2-59e2-83ef-40f9d6039c8e/scratchpad/v4';
const BASE = 'http://localhost:5173/studio-v4-preview.html';
fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`  📸 ${name}.png`);
};

// Read width/height straight from the PNG IHDR header (bytes 16-23).
const pngDims = (path) => {
  const b = fs.readFileSync(path);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/opt/pw-browsers/chromium' });
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1024 } });
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(`PAGEERROR: ${e.message}`));

    console.log('Loading harness:', BASE);
    // domcontentloaded (not networkidle): the Google Fonts request can hang behind
    // the agent proxy and never let the network go idle. We wait on the component
    // mounting instead — that's the real signal we care about.
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('.mode-tab-v4', { timeout: 15000 });
    await page.waitForTimeout(600);

    // Sanity: did the component actually mount visible content?
    const rootText = (await page.locator('#harness-root').innerText().catch(() => '')).trim();
    const tabCount = await page.locator('.mode-tab-v4').count();
    console.log(`  Mounted tabs: ${tabCount}; root text length: ${rootText.length}`);
    if (tabCount === 0) throw new Error('Component did not mount — no .mode-tab-v4 found (blank render).');

    // ---- CTA mode (default) ----
    console.log('CTA mode:');
    await shot(page, '01-cta-default');
    // Spin a card (state change)
    await page.locator('.spin-btn-v4').first().click();
    await page.waitForTimeout(300);
    await shot(page, '02-cta-after-spin');
    // Story format toggle
    await page.getByRole('button', { name: /STORY/ }).click();
    await page.waitForTimeout(300);
    await shot(page, '03-cta-story-format');

    // ---- Phone mode ----
    console.log('PHONE mode:');
    await page.getByRole('tab', { name: /PHONE/ }).click();
    await page.waitForTimeout(300);
    await shot(page, '04-phone-sleek');
    // Frame style → gold
    await page.locator('select').first().selectOption('gold').catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, '05-phone-gold-frame');

    // ---- Video Engine / Reel mode ----
    console.log('REEL mode:');
    await page.getByRole('tab', { name: /VIDEO ENGINE/ }).click();
    await page.waitForTimeout(300);
    await shot(page, '06-reel-default');
    // Pick a hook spectrum to populate the overlay text
    await page.locator('select').first().selectOption('bioenergetics').catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, '07-reel-with-hook');

    // ---- PNG EXPORT (real download) ----
    console.log('PNG export (CTA):');
    await page.getByRole('tab', { name: /CTA CARDS/ }).click();
    await page.waitForTimeout(300);
    // Reset to FEED 4:5 so the export size is deterministic (story persists in state).
    await page.getByRole('button', { name: /FEED/ }).click();
    await page.waitForTimeout(300);
    const dl = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /EXPORT PNG/ }).click(),
    ]).then(([d]) => d).catch(() => null);
    if (dl) {
      const fname = dl.suggestedFilename();
      const savePath = `${OUT}/export-${fname}`;
      await dl.saveAs(savePath);
      const dims = pngDims(savePath);
      console.log(`  ⬇ downloaded ${fname} → ${dims.w}×${dims.h}px`);
      if (dims.w !== 1080 || dims.h !== 1350) throw new Error(`Export PNG wrong size: ${dims.w}×${dims.h} (expected 1080×1350)`);
      console.log('  ✅ export is full 1080×1350 resolution');
    } else {
      throw new Error('EXPORT PNG produced no download');
    }

    // ---- Mobile viewport ----
    console.log('MOBILE viewport (390px):');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('tab', { name: /CTA/ }).click();
    await page.waitForTimeout(400);
    await shot(page, '08-mobile-cta');

    // Filter out the two known sandbox-environment errors (the agent proxy blocks
    // Google Fonts → ERR_CONNECTION_CLOSED, and there's no favicon at this harness
    // path → 404). Neither is a component defect; in production both resolve.
    const real = errors.filter(e =>
      !/ERR_CONNECTION_CLOSED/.test(e) && !/status of 404/.test(e));
    console.log(`\nConsole errors: ${errors.length} total, ${real.length} app-level (env font/favicon filtered)`);
    real.slice(0, 10).forEach(e => console.log('  ✗', e.slice(0, 160)));
    if (real.length) { console.log('\nRESULT: FAIL (app console errors present)'); process.exit(2); }
    console.log('\nRESULT: PASS (rendered, export verified, no app errors)');
  } catch (e) {
    console.error('RESULT: FAIL —', e.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
