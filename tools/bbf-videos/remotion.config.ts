// Remotion render/preview config for the BBF video project.
import { existsSync, readdirSync } from 'node:fs';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setOverwriteOutput(true);
// Single-tab rendering keeps headless Chrome stable in constrained sandbox
// containers (SVG-filter grain + blur make frames heavier, but it stays fast).
Config.setConcurrency(1);
// Generous headroom for delayRender (font loading) under heavy software paint.
Config.setDelayRenderTimeoutInMilliseconds(120000);

// This sandbox blocks Remotion's Chrome CDN. When a Playwright
// chrome-headless-shell is present on the box, use it automatically. No-op
// elsewhere — Remotion falls back to its own downloaded Headless Shell.
function findHeadlessShell(): string | null {
  const base = '/opt/pw-browsers';
  try {
    if (!existsSync(base)) return null;
    for (const dir of readdirSync(base)) {
      if (dir.includes('headless_shell')) {
        const p = `${base}/${dir}/chrome-linux/headless_shell`;
        if (existsSync(p)) return p;
      }
    }
  } catch {
    /* ignore — fall back to Remotion's default */
  }
  return null;
}

const shell = findHeadlessShell();
if (shell) {
  Config.setBrowserExecutable(shell);
}
