import { Config } from '@remotion/cli/config';
import fs from 'node:fs';
import path from 'node:path';

// Output for X/Twitter: H.264, yuv420p, CRF 16, 24 fps (set per composition).
Config.setEntryPoint('src/index.ts');
const audioOnly = /--codec[= ](wav|mp3|aac)\b/.test(process.argv.join(' '));
if (!audioOnly) {
  Config.setCodec('h264');
  Config.setCrf(16);
  Config.setPixelFormat('yuv420p');
  Config.setX264Preset('slow');
  Config.setVideoImageFormat('png'); // lossless intermediates keep the paper grain clean
}
Config.setAudioBitrate('192k');
Config.setDelayRenderTimeoutInMilliseconds(300000);

// One tab renders frames in order, which lets each on-twos frame pair share its
// shadow maps. Raise with PAPER_BIRDS_CONCURRENCY on a machine with a real GPU.
Config.setConcurrency(Number(process.env.PAPER_BIRDS_CONCURRENCY) || 1);

// WebGL backend: 'angle' uses the GPU. On machines without one, use
// PAPER_BIRDS_GL=swangle (SwiftShader software rendering; slow but identical).
Config.setChromiumOpenGlRenderer((process.env.PAPER_BIRDS_GL as 'angle' | 'swangle' | 'egl' | 'swiftshader' | 'vulkan' | undefined) ?? 'angle');

// Optional explicit browser; otherwise Remotion downloads/uses its own headless shell.
const pw = '/opt/pw-browsers';
const detected = (() => {
  if (!fs.existsSync(pw)) return null;
  const dir = fs.readdirSync(pw).find((d) => d.startsWith('chromium_headless_shell'));
  const exe = dir ? path.join(pw, dir, 'chrome-linux', 'headless_shell') : null;
  return exe && fs.existsSync(exe) ? exe : null;
})();
const browser = process.env.PAPER_BIRDS_BROWSER ?? detected;
if (browser) Config.setBrowserExecutable(browser);
