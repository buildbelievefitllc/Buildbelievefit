import { test, expect, type Page } from '@playwright/test';
import { statSync } from 'node:fs';

/**
 * Sovereign Studio v3 — export pipeline (Terminal 4 E2E lane)
 * ==========================================================
 * Browser-drone coverage of the two upgrades in `bbf-sovereign-studio-v3.html`
 * (a standalone, self-contained content tool served from the repo root):
 *
 *   Upgrade 1 — PNG export: render from a clean, unscaled, full-size clone.
 *     `exportStage()` must call html2canvas with scale:2 + useCORS and an
 *     `onclone` that neutralizes the preview `.stage-scaler` transform and
 *     forces the cloned stage to its true 1080×… size.
 *
 *   Upgrade 2 — Reel video export: footage as a moving background with the
 *     branded overlay composited on a 1080×1920 canvas, recorded via
 *     captureStream → MediaRecorder, codec feature-detected (real WebM/MP4
 *     codecs preferred over the bare `video/mp4` string, which some Chromium
 *     builds report supported but then record as 0 bytes).
 *
 * HERMETIC: the real html2canvas (loaded from cdnjs) is STUBBED in-spec, so
 * the suite is deterministic and needs no network for the PNG assertions —
 * it validates OUR option-construction + onclone logic, not the third-party
 * rasterizer. The overlay/recorder checks use the browser's own Canvas2D +
 * MediaRecorder, so they exercise the real pipeline. Safe for CI.
 *
 * Selectors verified against bbf-sovereign-studio-v3.html: exportStage(),
 * drawReelOverlay()/drawVideoCover()/pickRecorderMime()/ensureReelFonts(),
 * #reel-export, #reel-export-vid, #reel-file-vid, #reel-vid, #reel-lbl-vid.
 */

const STUDIO = '/bbf-sovereign-studio-v3.html';

// Load the studio, switch to Reel mode, and return any uncaught page errors.
async function loadReel(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', (d) => d.dismiss().catch(() => {}));
  await page.goto(STUDIO, { waitUntil: 'load' });
  await page.locator('.mode-tab[data-m="reel"]').click();
  await expect(page.locator('#panel-reel')).toHaveClass(/active/);
  return errors;
}

test.describe('Sovereign Studio v3 — export pipeline', () => {
  test('loads clean with the reel video controls wired', async ({ page }) => {
    const errors = await loadReel(page);
    expect(errors, 'no uncaught JS exceptions on load').toEqual([]);
    await expect(page.locator('#reel-export-vid')).toHaveCount(1);
    await expect(page.locator('#reel-file-vid')).toHaveCount(1);
    await expect(page.locator('#reel-vid')).toHaveCount(1);

    const env = await page.evaluate(() => {
      const w = window as any;
      return {
        fns: typeof w.drawReelOverlay === 'function' && typeof w.drawVideoCover === 'function' && typeof w.ensureReelFonts === 'function',
        media: !!window.MediaRecorder,
        cap: !!HTMLCanvasElement.prototype.captureStream,
        mime: typeof w.pickRecorderMime === 'function' ? w.pickRecorderMime() : '',
      };
    });
    expect(env.fns, 'overlay/video/font helpers defined').toBeTruthy();
    expect(env.media && env.cap, 'MediaRecorder + captureStream available').toBeTruthy();
    // Must resolve a REAL codec — never the bare `video/mp4` that records 0 bytes.
    expect(env.mime, 'pickRecorderMime resolves a codec').not.toBe('');
    expect(env.mime, 'pickRecorderMime avoids the bare-mp4 0-byte trap').not.toBe('video/mp4');
    test.info().annotations.push({ type: 'codec', description: env.mime });
  });

  test('overlay renders on a real 1080×1920 canvas (strip + headline + watch pill)', async ({ page }) => {
    await loadReel(page);
    const r = await page.evaluate(async () => {
      const w = window as any;
      await w.ensureReelFonts();
      const fontsLoaded = (document as any).fonts.check("148px 'Bebas Neue'");
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      const cx = c.getContext('2d')!;
      cx.fillStyle = '#08060a'; cx.fillRect(0, 0, 1080, 1920);
      w.drawReelOverlay(cx, { W: 1080, H: 1920, reveal: 1, dark: 100, eyeColor: 'rgb(245,200,0)',
        eyeText: 'FORM FIX • EP. 1', hlText: 'STOP PRESSING\nSTRAIGHT UP',
        subText: 'The 2-inch fix your shoulders will thank you for.', watchText: '▶ WATCH THE FIX', logoImg: null });
      const d = cx.getImageData(0, 0, 1080, 1920).data;
      const i0 = (6 * 1080 + 1060) * 4;
      const strip = d[i0] > 180 && d[i0 + 1] > 120;            // gold/purple top strip
      let white = false, gold = false;
      for (let y = 1000; y < 1900 && !(white && gold); y += 3)
        for (let x = 70; x < 1010; x += 3) {
          const i = (y * 1080 + x) * 4;
          if (d[i] > 230 && d[i + 1] > 230 && d[i + 2] > 230) white = true;   // headline text
          if (d[i] > 225 && d[i + 1] > 175 && d[i + 2] < 70) gold = true;     // watch pill
        }
      return { fontsLoaded, strip, white, gold };
    });
    test.info().annotations.push({ type: 'fonts', description: r.fontsLoaded ? 'Bebas/Barlow loaded' : 'fallback (no network)' });
    expect(r.strip, 'gold top strip drawn').toBeTruthy();
    expect(r.white, 'white headline pixels drawn').toBeTruthy();
    expect(r.gold, 'gold watch pill drawn').toBeTruthy();
  });

  test('Upgrade 1: PNG export uses scale:2 + onclone that neutralizes the preview transform', async ({ page }) => {
    await loadReel(page);
    // Stub the (CDN) rasterizer to capture the options OUR code passes and to run
    // its onclone against a fake cloned doc — then assert the transform was reset.
    await page.evaluate(() => {
      (window as any).html2canvas = async (el: any, opts: any) => {
        const scaler = { style: { transform: 'scale(0.3)', width: '300px', height: '500px' } };
        const stage = { style: { width: '', height: '' } };
        const fakeDoc = {
          querySelectorAll: (s: string) => (s === '.stage-scaler' ? [scaler] : []),
          getElementById: (id: string) => (id === el.id ? stage : null),
        };
        if (opts.onclone) opts.onclone(fakeDoc);
        (window as any).__h2c = { scale: opts.scale, useCORS: opts.useCORS, w: opts.width, h: opts.height, onclone: typeof opts.onclone === 'function', reset: scaler.style.transform, forced: stage.style.width };
        const c = document.createElement('canvas'); c.width = opts.width; c.height = opts.height;
        const x = c.getContext('2d')!; x.fillStyle = '#08060a'; x.fillRect(0, 0, c.width, c.height);
        return c;
      };
    });
    const downloadP = page.waitForEvent('download', { timeout: 20_000 });
    await page.click('#reel-export');
    const download = await downloadP;
    expect(download.suggestedFilename()).toMatch(/\.png$/);

    const h = await page.evaluate(() => (window as any).__h2c);
    expect(h.scale, 'scale:2 for crisp output').toBe(2);
    expect(h.useCORS, 'useCORS:true').toBe(true);
    expect(h.w).toBe(1080);
    expect(h.h).toBe(1920);
    expect(h.onclone, 'onclone provided').toBeTruthy();
    expect(h.reset, 'onclone neutralizes the .stage-scaler transform').toBe('none');
    expect(h.forced, 'onclone forces the clone to full stage width').toBe('1080px');
  });

  test('Upgrade 2: captureStream → MediaRecorder yields a non-empty Blob', async ({ page }) => {
    await loadReel(page);
    const v = await page.evaluate(async () => {
      const w = window as any;
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
      const cx = c.getContext('2d')!;
      const mime: string = w.pickRecorderMime();
      const rec = mime ? new MediaRecorder(c.captureStream(30), { mimeType: mime }) : new MediaRecorder(c.captureStream(30));
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      let n = 0;
      return await new Promise<{ size: number; mime: string }>((res) => {
        rec.onstop = () => res({ size: new Blob(chunks).size, mime });
        rec.start();
        (function frame() {
          cx.fillStyle = '#08060a'; cx.fillRect(0, 0, 1080, 1920);
          w.drawReelOverlay(cx, { W: 1080, H: 1920, reveal: 1, dark: 100, eyeColor: 'rgb(245,200,0)', eyeText: 'E', hlText: 'A\nB', subText: 's', watchText: 'W', logoImg: null });
          if (++n >= 40) { rec.stop(); return; }
          requestAnimationFrame(frame);
        })();
      });
    });
    test.info().annotations.push({ type: 'codec', description: v.mime });
    expect(v.mime, 'records with a real codec, not the bare-mp4 trap').not.toBe('video/mp4');
    expect(v.size, 'recorder produced a non-empty Blob').toBeGreaterThan(0);
  });

  test('Upgrade 2 E2E: upload a clip → EXPORT VIDEO → a non-empty file downloads', async ({ page }) => {
    await loadReel(page);
    // Generate a short, self-made clip in-page (no fixture file needed), return base64.
    const b64 = await page.evaluate(async () => {
      const w = window as any;
      const c = document.createElement('canvas'); c.width = 320; c.height = 568;
      const cx = c.getContext('2d')!;
      const mime: string = w.pickRecorderMime();
      const rec = mime ? new MediaRecorder(c.captureStream(30), { mimeType: mime }) : new MediaRecorder(c.captureStream(30));
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      let n = 0;
      const blob = await new Promise<Blob>((res) => {
        rec.onstop = () => res(new Blob(chunks, { type: mime || 'video/webm' }));
        rec.start();
        (function frame() {
          cx.fillStyle = n % 2 ? '#222' : '#555'; cx.fillRect(0, 0, 320, 568);
          if (++n >= 36) { rec.stop(); return; }
          requestAnimationFrame(frame);
        })();
      });
      return await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result).split(',')[1]);
        fr.readAsDataURL(blob);
      });
    });

    const mime = await page.evaluate(() => (window as any).pickRecorderMime());
    const ext = mime.includes('mp4') ? 'mp4' : 'webm';
    await page.setInputFiles('#reel-file-vid', { name: `clip.${ext}`, mimeType: mime || 'video/webm', buffer: Buffer.from(b64, 'base64') });
    await page.waitForSelector('#reel-lbl-vid.done', { timeout: 12_000 });

    const downloadP = page.waitForEvent('download', { timeout: 45_000 });
    await page.click('#reel-export-vid');
    const download = await downloadP;
    expect(download.suggestedFilename()).toMatch(/\.(webm|mp4)$/);
    const fp = await download.path();
    const size = fp ? statSync(fp).size : 0;
    expect(size, 'exported video file is non-empty').toBeGreaterThan(0);
  });
});
