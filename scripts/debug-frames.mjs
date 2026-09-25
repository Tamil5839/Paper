import { bundle } from '@remotion/bundler';
import { renderFrames, selectComposition } from '@remotion/renderer';
import path from 'node:path';

const [comp = 'Test', from = '0', to = '5', outDir = 'out/debug-frames'] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const chromiumOptions = { gl: process.env.PAPER_BIRDS_GL ?? 'swangle' };
const browserExecutable = process.env.PAPER_BIRDS_BROWSER ?? null;
const onBrowserLog = (l) => {
  if (l.type === 'error' || l.type === 'warning') console.log(`[browser ${l.type}]`, l.text.slice(0, 1500));
};
const inputProps = process.env.PROPS ? JSON.parse(process.env.PROPS) : {};
const composition = await selectComposition({ serveUrl, id: comp, chromiumOptions, browserExecutable, onBrowserLog, inputProps });
const t0 = Date.now();
let last = t0;
await renderFrames({
  composition,
  serveUrl,
  outputDir: outDir,
  frameRange: [Number(from), Number(to)],
  imageFormat: 'jpeg',
  concurrency: Number(process.env.CONC ?? 1),
  chromiumOptions,
  browserExecutable,
  onBrowserLog,
  timeoutInMilliseconds: 240000,
  inputProps,
  onStart: () => {},
  onFrameUpdate: (n, frame) => {
    const now = Date.now();
    console.log(`frame ${frame} done (${n}) +${now - last}ms`);
    last = now;
  },
});
console.log('total', Date.now() - t0, 'ms');
