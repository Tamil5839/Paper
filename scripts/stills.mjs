// Render the quality-checklist stills for both compositions:
//   npm run stills                      -> frames 150 350 600 850 1050 1300 1500 1750
//   FRAMES=90,400 COMPS=PaperBirds npm run stills
import { bundle } from '@remotion/bundler';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import fs from 'node:fs';
import path from 'node:path';
import { browserExecutable, chromiumOptions } from './lib.mjs';

const frames = (process.env.FRAMES ?? '150,350,600,850,1050,1300,1500,1750').split(',').map(Number);
const comps = (process.env.COMPS ?? 'PaperBirds,PaperBirdsFeed').split(',');
const outDir = path.resolve(process.env.OUT ?? 'out/stills');
fs.mkdirSync(outDir, { recursive: true });

const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const browser = await openBrowser('chrome', { browserExecutable, chromiumOptions });
const onBrowserLog = (l) => {
  if (l.type === 'error' && !/GroupMarkerNotSet|fallback to software/.test(l.text)) console.log('[browser]', l.text.slice(0, 600));
};
for (const id of comps) {
  const composition = await selectComposition({ serveUrl, id, puppeteerInstance: browser, chromiumOptions, onBrowserLog });
  for (const frame of frames) {
    const output = path.join(outDir, `${id}-${String(frame).padStart(4, '0')}.png`);
    const t0 = Date.now();
    await renderStill({ composition, serveUrl, output, frame, puppeteerInstance: browser, chromiumOptions, onBrowserLog, timeoutInMilliseconds: 300000 });
    console.log(`${id} frame ${frame} -> ${path.relative(process.cwd(), output)} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  }
}
await browser.close({ silent: true });
