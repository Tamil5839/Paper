// Shared helpers for the render scripts.
import fs from 'node:fs';
import path from 'node:path';

/** Chromium GL backend: 'angle' (GPU) by default; use PAPER_BIRDS_GL=swangle on machines without a GPU. */
export const gl = process.env.PAPER_BIRDS_GL ?? 'angle';

/** Optional explicit browser (e.g. a pre-installed headless shell). Otherwise Remotion manages its own. */
export const browserExecutable = (() => {
  if (process.env.PAPER_BIRDS_BROWSER) return process.env.PAPER_BIRDS_BROWSER;
  const pw = '/opt/pw-browsers';
  if (fs.existsSync(pw)) {
    const dir = fs.readdirSync(pw).find((d) => d.startsWith('chromium_headless_shell'));
    const exe = dir && path.join(pw, dir, 'chrome-linux', 'headless_shell');
    if (exe && fs.existsSync(exe)) return exe;
  }
  return null;
})();

export const chromiumOptions = { gl };
