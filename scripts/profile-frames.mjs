// Render a short frame range in one tab and print per-stage GPU timings.
//   node scripts/profile-frames.mjs PaperBirds 600 603
// Frames land in out/profile/. Uses the `timing` input prop, which makes the
// post chain sync after each stage (slower, but measurable).
import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import { browserExecutable, chromiumOptions } from './lib.mjs';

const [comp = 'PaperBirds', from = '0', to = '3', outDir = 'out/profile'] = process.argv.slice(2);
const inputProps = { variant: comp === 'PaperBirdsFeed' ? 'feed' : 'wide', timing: true };
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const onBrowserLog = (l) => {
  if (l.text.startsWith('TIMING')) console.log(l.text);
  else if (l.type === 'error' && !/GroupMarkerNotSet|fallback to software/.test(l.text)) console.log('[browser]', l.text.slice(0, 800));
};
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, browserExecutable, onBrowserLog, inputProps });
const t0 = Date.now();
let last = t0;
await renderFrames({
  composition,
  serveUrl,
  outputDir: outDir,
  frameRange: [Number(from), Number(to)],
  imageFormat: 'jpeg',
  concurrency: 1,
  chromiumOptions,
  browserExecutable,
  onBrowserLog,
  inputProps,
  timeoutInMilliseconds: 300000,
  onStart: () => {},
  onFrameUpdate: (n, frame) => {
    const now = Date.now();
    console.log(`frame ${frame} done (+${now - last} ms)`);
    last = now;
  },
});
console.log(`total ${Date.now() - t0} ms`);
