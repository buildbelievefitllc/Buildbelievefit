// Loads the LOCKED BBF brand fonts (OFL) bundled in public/fonts and blocks the
// render until they are ready, so headless Chrome never rasterizes a fallback.
import { staticFile, delayRender, continueRender } from 'remotion';

export const FONT_DISPLAY = 'Bebas Neue'; // headers (CLAUDE.md §2)
export const FONT_BODY = 'Barlow Condensed'; // body

let started = false;

export function ensureFonts(): void {
  // Browser-only; guard for any non-DOM evaluation context.
  if (started || typeof document === 'undefined') return;
  started = true;

  const handle = delayRender('Loading BBF brand fonts', {
    timeoutInMilliseconds: 120000,
  });
  let cleared = false;
  const clear = () => {
    if (!cleared) {
      cleared = true;
      continueRender(handle);
    }
  };

  const css = `
    @font-face { font-family: 'Bebas Neue'; font-weight: 400; font-display: block;
      src: url('${staticFile('fonts/BebasNeue-Regular.ttf')}') format('truetype'); }
    @font-face { font-family: 'Barlow Condensed'; font-weight: 500; font-display: block;
      src: url('${staticFile('fonts/BarlowCondensed-Medium.ttf')}') format('truetype'); }
    @font-face { font-family: 'Barlow Condensed'; font-weight: 600; font-display: block;
      src: url('${staticFile('fonts/BarlowCondensed-SemiBold.ttf')}') format('truetype'); }
    @font-face { font-family: 'Barlow Condensed'; font-weight: 700; font-display: block;
      src: url('${staticFile('fonts/BarlowCondensed-Bold.ttf')}') format('truetype'); }
  `;
  const style = document.createElement('style');
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  Promise.all([
    document.fonts.load("400 100px 'Bebas Neue'"),
    document.fonts.load("500 100px 'Barlow Condensed'"),
    document.fonts.load("600 100px 'Barlow Condensed'"),
    document.fonts.load("700 100px 'Barlow Condensed'"),
  ])
    .then(() => document.fonts.ready)
    .then(clear)
    .catch(clear);

  // Safety net: never block the render if a font load stalls under heavy load.
  setTimeout(clear, 15000);
}
