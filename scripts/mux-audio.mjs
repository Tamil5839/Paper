// Render the soundtrack on its own (fast: no 3D) and put it onto an already
// rendered, muted video. Handy when the picture was rendered with --muted, or
// after changing only the music / sound cues.
//   node scripts/mux-audio.mjs out/video-16x9.mp4 out/paper-birds-16x9.mp4
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { browserExecutable, chromiumOptions } from './lib.mjs';

const [video, out] = process.argv.slice(2);
if (!video || !out) {
  console.error('usage: node scripts/mux-audio.mjs <muted-video.mp4> <output.mp4>');
  process.exit(1);
}
const wav = path.resolve('out/soundtrack.wav');
fs.mkdirSync(path.dirname(wav), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });
const composition = await selectComposition({ serveUrl, id: 'PaperBirdsSoundtrack', browserExecutable, chromiumOptions });
await renderMedia({ composition, serveUrl, codec: 'wav', outputLocation: wav, browserExecutable, chromiumOptions, concurrency: 2 });
console.log('soundtrack ->', path.relative(process.cwd(), wav));
const r = spawnSync('npx', ['remotion', 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', wav, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('muxed ->', out);
