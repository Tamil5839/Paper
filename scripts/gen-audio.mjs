// Paper Birds — deterministic sound generator.
//   npm run audio   ->  public/sfx/*.wav  and  public/music/placeholder-musicbox.mp3
// Every sound is synthesised from a fixed seed, so re-running produces identical
// files. Drop your own track at public/music.mp3 and the film uses it instead of
// the placeholder (see src/audio/Soundtrack.tsx).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SFX_DIR = path.join(ROOT, 'public', 'sfx');
const MUSIC_DIR = path.join(ROOT, 'public', 'music');
fs.mkdirSync(SFX_DIR, { recursive: true });
fs.mkdirSync(MUSIC_DIR, { recursive: true });

// ───────────────────────────────── primitives
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const buf = (sec) => new Float32Array(Math.max(1, Math.round(sec * SR)));
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

class Biquad {
  constructor(type, f, q = 0.707, gainDb = 0) {
    this.type = type;
    this.q = q;
    this.g = gainDb;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f);
  }
  set(f) {
    const w = (TAU * clamp(f, 10, SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const alpha = Math.sin(w) / (2 * this.q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === 'lp') [b0, b1, b2, a0, a1, a2] = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2, 1 + alpha, -2 * cw, 1 - alpha];
    else if (this.type === 'hp') [b0, b1, b2, a0, a1, a2] = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2, 1 + alpha, -2 * cw, 1 - alpha];
    else if (this.type === 'bp') [b0, b1, b2, a0, a1, a2] = [alpha, 0, -alpha, 1 + alpha, -2 * cw, 1 - alpha];
    else {
      const A = Math.pow(10, this.g / 40);
      [b0, b1, b2, a0, a1, a2] = [1 + alpha * A, -2 * cw, 1 - alpha * A, 1 + alpha / A, -2 * cw, 1 - alpha / A];
    }
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = a1 / a0;
    this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}
const filter = (a, type, f, q, g) => {
  const b = new Biquad(type, typeof f === 'function' ? f(0) : f, q, g);
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    if (typeof f === 'function' && i % 32 === 0) b.set(f(i / SR));
    out[i] = b.p(a[i]);
  }
  return out;
};
const noise = (len, r) => {
  const a = new Float32Array(len);
  for (let i = 0; i < len; i++) a[i] = r() * 2 - 1;
  return a;
};
const mixInto = (dst, src, at = 0, gain = 1) => {
  const o = Math.round(at * SR);
  for (let i = 0; i < src.length; i++) if (o + i >= 0 && o + i < dst.length) dst[o + i] += src[i] * gain;
  return dst;
};
const env = (a, fn) => {
  for (let i = 0; i < a.length; i++) a[i] *= fn(i / SR, a.length / SR);
  return a;
};
const adr = (att, rel) => (t, d) => Math.min(1, t / Math.max(1e-4, att)) * Math.min(1, (d - t) / Math.max(1e-4, rel));
const normalize = (a, peakDb = -3) => {
  let m = 0;
  for (const v of a) m = Math.max(m, Math.abs(v));
  const g = m > 0 ? Math.pow(10, peakDb / 20) / m : 1;
  for (let i = 0; i < a.length; i++) a[i] *= g;
  return a;
};
/** a short burst of filtered noise: the atom of every paper sound */
const crackle = (r, durMs, fLo = 1500, fHi = 7000) => {
  const n = Math.max(8, Math.round((durMs / 1000) * SR));
  const a = noise(n, r);
  const f = fLo + (fHi - fLo) * r();
  const out = filter(a, 'bp', f, 1.2 + r() * 2);
  return env(out, (t, d) => Math.exp(-t / (d * 0.35)) * Math.min(1, t * SR / 6));
};
const sineDecay = (f, dur, tau, amp = 1, f2) => {
  const a = buf(dur);
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const ff = f2 ? f + (f2 - f) * (1 - Math.exp(-t / (tau * 0.6))) : f;
    ph += (TAU * ff) / SR;
    a[i] = Math.sin(ph) * amp * Math.exp(-t / tau) * Math.min(1, t * 2000);
  }
  return a;
};

// ───────────────────────────────── WAV / MP3 output
const writeWav = (file, channels) => {
  const nCh = channels.length;
  const len = channels[0].length;
  const data = Buffer.alloc(len * nCh * 2);
  for (let i = 0; i < len; i++) for (let c = 0; c < nCh; c++) data.writeInt16LE(Math.round(clamp(channels[c][i], -1, 1) * 32767), (i * nCh + c) * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(nCh, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * nCh * 2, 28);
  h.writeUInt16LE(nCh * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
};
const sfx = (name, a, peakDb = -3) => {
  writeWav(path.join(SFX_DIR, `${name}.wav`), [normalize(a, peakDb)]);
  console.log(`sfx/${name}.wav  ${(a.length / SR).toFixed(2)}s`);
};

// ───────────────────────────────── paper foley
const rustle = (seed, dur, bright = 1) => {
  const r = rng(seed);
  const n = buf(dur).length;
  const bumps = Array.from({ length: Math.ceil(dur * 7) }, () => ({ t: r() * dur, w: 0.05 + r() * 0.12, a: 0.3 + r() * 0.7 }));
  const am = (t) => bumps.reduce((s, b) => s + b.a * Math.exp(-(((t - b.t) / b.w) ** 2)), 0.25);
  let a = filter(noise(n, r), 'bp', (t) => 2600 * bright + 900 * Math.sin(t * 5.1 + seed), 0.7);
  a = filter(a, 'hp', 700);
  env(a, (t, d) => am(t) * adr(0.06, 0.2)(t, d));
  const cr = Math.round(dur * 70 * bright);
  for (let i = 0; i < cr; i++) {
    const t = r() * dur;
    mixInto(a, crackle(r, 1 + r() * 3), t, (0.25 + r()) * am(t) * 0.9);
  }
  return a;
};
const slide = (seed, dur) => {
  const r = rng(seed);
  const n = buf(dur).length;
  let a = filter(noise(n, r), 'bp', (t) => 1400 + 1500 * Math.sin((t / dur) * Math.PI), 0.9);
  a = filter(a, 'hp', 400);
  env(a, (t, d) => adr(0.35, 0.6)(t, d) * (0.75 + 0.25 * Math.sin(t * 31 + r())));
  for (let i = 0; i < dur * 45; i++) mixInto(a, crackle(r, 1 + r() * 4, 1200, 5000), r() * dur, 0.35 * (0.3 + r()));
  return a;
};
const stickTap = (seed) => {
  const r = rng(seed);
  const a = buf(0.25);
  mixInto(a, sineDecay(820 + r() * 60, 0.25, 0.04, 0.9));
  mixInto(a, sineDecay(2310, 0.2, 0.015, 0.4));
  mixInto(a, sineDecay(3900, 0.1, 0.008, 0.2));
  mixInto(a, crackle(r, 3, 2500, 6000), 0, 0.8);
  return a;
};
const flutter = (seed, dur, rate = 10) => {
  const r = rng(seed);
  const a = buf(dur);
  let t = 0.02;
  let k = 0;
  while (t < dur - 0.05) {
    const burst = filter(noise(Math.round(0.034 * SR), r), 'bp', 1500 + r() * 900, 1.1);
    env(burst, (x, d) => Math.min(1, x / 0.004) * Math.exp(-x / (d * 0.4)));
    mixInto(a, burst, t, (k % 2 === 0 ? 1 : 0.55) * (0.8 + r() * 0.4));
    t += 1 / (rate * (0.9 + r() * 0.2));
    k++;
  }
  mixInto(a, env(filter(noise(a.length, r), 'bp', 900, 0.6), adr(0.1, 0.3)), 0, 0.12);
  return env(a, adr(0.03, 0.25));
};
const crumple = (seed, dur = 0.7) => {
  const r = rng(seed);
  const a = buf(dur);
  for (let i = 0; i < 320; i++) {
    const t = Math.pow(r(), 1.8) * dur * 0.9;
    const amp = Math.pow(r(), 2.5) * (1 - t / dur);
    mixInto(a, crackle(r, 0.6 + r() * 4, 1500, 9000), t, amp * 1.4);
  }
  const body = env(filter(noise(a.length, r), 'lp', 450), (t) => Math.exp(-t / 0.12));
  return mixInto(a, body, 0, 0.35);
};
const binBump = (seed) => {
  const r = rng(seed);
  const a = buf(0.45);
  mixInto(a, sineDecay(150, 0.45, 0.07, 1, 62));
  mixInto(a, env(filter(noise(a.length, r), 'lp', 300), (t) => Math.exp(-t / 0.05)), 0, 0.4);
  for (let i = 0; i < 16; i++) mixInto(a, crackle(r, 2 + r() * 3, 1800, 3500), 0.01 + r() * 0.16, 0.25 * r());
  return a;
};
const paperTap = (seed) => {
  const r = rng(seed);
  const a = buf(0.3);
  mixInto(a, sineDecay(540, 0.3, 0.025, 0.8));
  mixInto(a, sineDecay(1150, 0.2, 0.012, 0.35));
  mixInto(a, crackle(r, 3, 2000, 5000), 0, 0.7);
  for (let i = 0; i < 12; i++) mixInto(a, crackle(r, 1 + r() * 2), 0.01 + r() * 0.12, 0.25 * r());
  return a;
};
const roll = (seed, dur = 1.1) => {
  const r = rng(seed);
  const a = env(filter(noise(buf(dur).length, r), 'lp', 320), (t, d) => adr(0.1, 0.35)(t, d) * (0.6 + 0.4 * Math.sin(t * TAU * 5.5)));
  for (let i = 0; i < dur * 80; i++) {
    const t = r() * dur;
    mixInto(a, crackle(r, 1 + r() * 2, 900, 4000), t, 0.45 * (0.6 + 0.4 * Math.sin(t * TAU * 5.5)) * adr(0.1, 0.35)(t, dur));
  }
  return a;
};
const tear = (seed, dur = 0.45) => {
  const r = rng(seed);
  let a = filter(noise(buf(dur).length, r), 'bp', (t) => 900 + 4200 * (t / dur), 1.4);
  env(a, (t, d) => adr(0.02, 0.08)(t, d) * (0.7 + 0.3 * r()));
  for (let i = 0; i < dur * 900; i++) mixInto(a, crackle(r, 0.5 + r(), 2500, 9000), r() * dur * 0.95, 0.5 * r());
  return a;
};
const typing = (seed, dur = 3) => {
  const r = rng(seed);
  const a = buf(dur);
  let t = 0.05;
  let k = 0;
  while (t < dur - 0.1) {
    const space = k % 9 === 8;
    const click = filter(noise(Math.round(0.004 * SR), r), 'bp', 2800 + r() * 1400, 2.5);
    mixInto(a, click, t, 0.7 * (0.6 + r() * 0.5));
    mixInto(a, sineDecay(space ? 150 : 210 + r() * 40, 0.08, space ? 0.035 : 0.022, space ? 0.55 : 0.35), t);
    mixInto(a, filter(noise(Math.round(0.003 * SR), r), 'bp', 3500, 2), t + 0.055 + r() * 0.02, 0.25);
    t += space ? 0.2 + r() * 0.1 : 0.07 + r() * 0.1;
    if (r() < 0.06) t += 0.25 + r() * 0.3;
    k++;
  }
  return a;
};
const metro = (seed, dur = 5.6) => {
  const r = rng(seed);
  const a = env(filter(filter(noise(buf(dur).length, r), 'lp', 230), 'lp', 400), (t, d) => Math.sin((Math.PI * t) / d) ** 1.5);
  for (let t = 0.4; t < dur - 0.4; t += 0.55) {
    const lvl = Math.sin((Math.PI * t) / dur) ** 2;
    mixInto(a, sineDecay(85, 0.12, 0.03, 0.5), t, lvl);
    mixInto(a, sineDecay(80, 0.12, 0.03, 0.4), t + 0.12, lvl);
  }
  let ph = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (TAU * (420 + 6 * Math.sin(t * 5))) / SR;
    a[i] += Math.sin(ph) * 0.025 * Math.sin((Math.PI * t) / dur) ** 2;
  }
  return filter(a, 'lp', 1100);
};
const autoRickshaw = (seed, dur = 4) => {
  const r = rng(seed);
  const a = buf(dur);
  const pass = 2.0;
  let t = 0.02;
  while (t < dur - 0.05) {
    const doppler = t < pass ? 1.06 : 0.92;
    const dist = 0.25 + Math.abs(t - pass) * 0.9;
    const lvl = 1 / (dist * dist + 0.3);
    const pop = sineDecay(118 * doppler, 0.05, 0.012, 1);
    for (let i = 0; i < pop.length; i++) pop[i] = Math.tanh(pop[i] * 3);
    mixInto(a, pop, t, lvl);
    mixInto(a, filter(noise(Math.round(0.02 * SR), r), 'bp', 650 * doppler, 1.5), t, lvl * 0.35);
    t += 1 / ((26 + 3 * Math.sin(t * 2.3)) * doppler);
  }
  const rattle = env(filter(noise(a.length, r), 'bp', 2100, 2), (x) => {
    const dist = 0.25 + Math.abs(x - pass) * 0.9;
    return (0.12 / (dist * dist + 0.3)) * (0.5 + 0.5 * Math.sin(x * TAU * 26));
  });
  mixInto(a, rattle);
  return env(a, adr(0.3, 0.6));
};
const rainLoop = (seed, dur = 8) => {
  const r = rng(seed);
  const a = buf(dur);
  const ticks = Math.round(dur * 380);
  for (let i = 0; i < ticks; i++) {
    const t = r() * dur;
    const amp = Math.exp(Math.log(0.05) + r() * Math.log(20)) * 0.3;
    mixInto(a, crackle(r, 0.6 + r() * 1.5, 1200, 6500), t, amp);
  }
  for (let i = 0; i < dur * 6; i++) mixInto(a, sineDecay(2200 + r() * 1400, 0.06, 0.012, 0.25), r() * dur);
  const bed = filter(filter(noise(a.length, r), 'lp', 1700), 'hp', 180);
  env(bed, (t) => 0.8 + 0.2 * Math.sin(t * 1.7));
  mixInto(a, bed, 0, 0.35);
  // make it loop seamlessly: crossfade the tail into the head
  const xf = Math.round(0.5 * SR);
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    a[i] = a[i] * w + a[a.length - xf + i] * (1 - w);
  }
  return a.slice(0, a.length - xf);
};
const thunder = (seed, dur = 6) => {
  const r = rng(seed);
  const a = buf(dur);
  mixInto(a, env(filter(noise(Math.round(0.25 * SR), r), 'lp', 1800), (t) => Math.exp(-t / 0.05)), 0.05, 0.25);
  const swells = [0.25, 0.8, 1.5, 2.3, 3.1].map((t) => ({ t: t + r() * 0.15, a: 0.5 + r() * 0.5, w: 0.25 + r() * 0.35 }));
  const rumble = filter(filter(noise(a.length, r), 'lp', 110), 'lp', 160);
  env(rumble, (t) => swells.reduce((s, sw) => s + sw.a * Math.exp(-(((t - sw.t) / sw.w) ** 2)), 0) * Math.exp(-t / 2.2));
  mixInto(a, rumble, 0, 2.2);
  mixInto(a, sineDecay(48, dur, 1.1, 0.3));
  return env(a, adr(0.01, 1.2));
};
const lampFlicker = (seed, dur = 0.32) => {
  const r = rng(seed);
  const a = buf(dur);
  const gates = Array.from({ length: 6 }, () => ({ t: r() * dur * 0.8, w: 0.01 + r() * 0.03 }));
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    const on = gates.some((g) => t > g.t && t < g.t + g.w) ? 1 : 0;
    let s = 0;
    for (let h = 1; h <= 6; h++) s += Math.sin(TAU * 100 * h * t) / h;
    a[i] = s * 0.25 * on;
  }
  for (const g of gates) mixInto(a, crackle(r, 1.5, 3000, 8000), g.t, 0.6);
  return filter(a, 'hp', 60);
};
const fold = (seed) => {
  const r = rng(seed);
  const a = buf(0.6);
  const s = env(filter(noise(Math.round(0.36 * SR), r), 'bp', (t) => 1200 + 3000 * (t / 0.36), 1.0), adr(0.08, 0.05));
  mixInto(a, s, 0, 0.55);
  for (let i = 0; i < 26; i++) mixInto(a, crackle(r, 0.6 + r() * 1.5, 3000, 9000), 0.36 + r() * 0.03, 0.6 * r());
  mixInto(a, filter(noise(Math.round(0.004 * SR), r), 'hp', 2500), 0.385, 0.9);
  return a;
};
const tink = (seed) => {
  const r = rng(seed);
  const a = buf(1.0);
  const f0 = 1180 + r() * 80;
  [[1, 1, 0.5], [2.32, 0.5, 0.25], [4.25, 0.3, 0.12], [6.63, 0.15, 0.06]].forEach(([m, amp, tau]) => mixInto(a, sineDecay(f0 * m, 1.0, tau, amp)));
  mixInto(a, sineDecay(180, 0.1, 0.03, 0.4));
  mixInto(a, crackle(r, 2, 3000, 7000), 0, 0.5);
  return a;
};
const pageFlip = (seed) => {
  const r = rng(seed);
  const a = env(filter(noise(buf(0.5).length, r), 'bp', 2500, 0.8), (t) => Math.exp(-(((t - 0.13) / 0.07) ** 2)));
  mixInto(a, env(filter(noise(Math.round(0.05 * SR), r), 'lp', 260), (t) => Math.exp(-t / 0.015)), 0.2, 1.2);
  for (let i = 0; i < 18; i++) mixInto(a, crackle(r, 1 + r() * 2), 0.05 + r() * 0.2, 0.3 * r());
  return a;
};
const swish = (seed, dur = 0.5) => {
  const r = rng(seed);
  return env(filter(noise(buf(dur).length, r), 'bp', (t) => 600 + 2000 * Math.sin((Math.PI * t) / dur), 1.1), (t, d) => Math.sin((Math.PI * t) / d) ** 2);
};
const lightClick = (seed) => {
  const r = rng(seed);
  const a = buf(0.2);
  mixInto(a, filter(noise(Math.round(0.003 * SR), r), 'bp', 1600, 2), 0, 1);
  mixInto(a, filter(noise(Math.round(0.003 * SR), r), 'bp', 2400, 2), 0.009, 0.7);
  mixInto(a, sineDecay(160, 0.1, 0.02, 0.5), 0.005);
  return a;
};
const crickets = (seed, dur = 10) => {
  const r = rng(seed);
  const a = buf(dur);
  for (const voice of [{ f: 4550, gap: 0.85 }, { f: 4210, gap: 1.2 }, { f: 4880, gap: 1.6 }]) {
    let t = r() * voice.gap;
    while (t < dur - 0.3) {
      const pulses = 3 + Math.floor(r() * 2);
      for (let p = 0; p < pulses; p++) {
        const n = Math.round(0.014 * SR);
        const s = new Float32Array(n);
        for (let i = 0; i < n; i++) s[i] = Math.sin((TAU * voice.f * i) / SR) * Math.sin((Math.PI * i) / n);
        mixInto(a, s, t + p * 0.033, 0.2 * (0.7 + r() * 0.3));
      }
      t += voice.gap * (0.8 + r() * 0.4);
    }
  }
  const traffic = filter(filter(noise(a.length, r), 'lp', 140), 'lp', 200);
  mixInto(a, env(traffic, (t) => 0.7 + 0.3 * Math.sin(t * 0.7)), 0, 0.6);
  const xf = Math.round(0.4 * SR);
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    a[i] = a[i] * w + a[a.length - xf + i] * (1 - w);
  }
  return a.slice(0, a.length - xf);
};
const morningBirds = (seed, dur = 7) => {
  const r = rng(seed);
  const a = buf(dur);
  let t = 0.2;
  while (t < dur - 0.6) {
    const notes = 2 + Math.floor(r() * 4);
    const base = 2900 + r() * 1500;
    for (let k = 0; k < notes; k++) {
      const len = 0.06 + r() * 0.08;
      const n = Math.round(len * SR);
      const s = new Float32Array(n);
      let ph = 0;
      const f0 = base * (1 + (r() - 0.5) * 0.25);
      const f1 = f0 * (1.15 + r() * 0.3);
      for (let i = 0; i < n; i++) {
        const u = i / n;
        ph += (TAU * (f0 + (f1 - f0) * u + 120 * Math.sin(u * 40))) / SR;
        s[i] = Math.sin(ph) * Math.sin(Math.PI * u) ** 2;
      }
      mixInto(a, s, t + k * (len + 0.03), 0.3 * (0.6 + r() * 0.4));
    }
    t += 0.7 + r() * 1.2;
  }
  return filter(a, 'hp', 1200);
};
const roomTone = (seed, dur = 8) => {
  const r = rng(seed);
  const a = filter(filter(noise(buf(dur).length, r), 'lp', 380), 'lp', 520);
  const xf = Math.round(0.4 * SR);
  for (let i = 0; i < xf; i++) {
    const w = i / xf;
    a[i] = a[i] * w + a[a.length - xf + i] * (1 - w);
  }
  return a.slice(0, a.length - xf);
};

// ───────────────────────────────── render the foley set
sfx('rustle-1', rustle(11, 0.9));
sfx('rustle-2', rustle(12, 1.2, 0.9));
sfx('rustle-3', rustle(13, 0.6, 1.2));
sfx('slide', slide(21, 2.0));
sfx('slide-long', slide(22, 3.0));
sfx('stick-tap', stickTap(31));
sfx('flutter', flutter(41, 1.3, 10));
sfx('flutter-slow', flutter(42, 1.6, 6.5));
sfx('crumple', crumple(51, 0.7));
sfx('crumple-small', crumple(52, 0.45));
sfx('bin-bump', binBump(61));
sfx('paper-tap', paperTap(71));
sfx('roll', roll(81));
sfx('tear', tear(91));
sfx('typing', typing(101, 3.0));
sfx('metro', metro(111), -6);
sfx('auto', autoRickshaw(121));
sfx('rain-loop', rainLoop(131, 8.5));
sfx('thunder', thunder(141), -2);
sfx('lamp-flicker', lampFlicker(151));
sfx('fold', fold(161));
sfx('tink', tink(171));
sfx('page-flip', pageFlip(181));
sfx('swish', swish(191));
sfx('light-click', lightClick(201));
sfx('crickets-loop', crickets(211, 10.4), -8);
sfx('morning-birds', morningBirds(221), -6);
sfx('room-tone-loop', roomTone(231, 8.4), -10);

// ───────────────────────────────── placeholder score: music box + soft piano
// A little D-major "paper bird" theme, sparse where the birds fall, swelling on
// the red bird's flight and resolving as the curtain closes. Times in seconds.
const NOTE = (n) => {
  const m = n.match(/^([A-G])(#|b)?(\d)$/);
  const idx = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 440 * Math.pow(2, (idx + (Number(m[3]) + 1) * 12 - 69) / 12);
};
const box = []; // [time, note, velocity]
const piano = []; // [time, note, velocity]
const seq = (arr, t0, dt, notes, vel = 0.7) => notes.forEach((n, i) => n && arr.push([t0 + i * dt, n, vel]));

// 1 opening (0-8): theme on the music box as the light comes up, a lift as the curtain opens
seq(box, 2.0, 0.62, ['D5', 'F#5', 'A5', 'F#5', 'E5', 'D5'], 0.55);
seq(box, 5.95, 0.18, ['D5', 'F#5', 'A5', 'D6'], 0.5);
// 2 the city (8-18)
seq(box, 8.2, 0.55, ['A5', 'B5', 'A5', 'F#5', 'E5', 'F#5', 'D5', null, 'B4', 'D5', 'F#5', 'E5', 'D5', 'A4', null, null, 'D5'], 0.5);
[['D3', 8.0], ['B2', 10.4], ['G2', 12.8], ['A2', 15.2]].forEach(([n, t]) => piano.push([t, n, 0.45]));
[['A3', 8.0], ['F#3', 10.4], ['D3', 12.8], ['E3', 15.2]].forEach(([n, t]) => piano.push([t + 0.3, n, 0.3]));
// 3 first ideas (18-30): hope rises, falls
seq(box, 19.25, 0.15, ['A5', 'B5', 'D6'], 0.45);
seq(box, 21.15, 0.2, ['C#6', 'B5'], 0.35);
seq(box, 21.5, 0.2, ['A5', 'F#5', 'D5', 'B4'], 0.4);
piano.push([22.4, 'B2', 0.35]);
seq(box, 23.6, 0.12, ['D5', 'F#5', 'A5', 'D6'], 0.45);
box.push([24.75, 'G#6', 0.35]);
piano.push([26.4, 'F#2', 0.3]);
seq(box, 26.25, 0.16, ['A4', 'D5', 'F#5'], 0.4);
seq(box, 27.45, 0.22, ['E5', 'D#5', 'D5'], 0.35);
[['B2', 0.4], ['D3', 0.3], ['F#3', 0.28]].forEach(([n, v]) => piano.push([28.8, n, v]));
// 4 time passing (30-40): a clock of two notes, the theme in B minor, slow
for (let t = 30.2; t < 39.8; t += 0.5) box.push([t, Math.round((t - 30.2) / 0.5) % 2 ? 'E5' : 'A5', 0.22]);
seq(box, 31.0, 2.0, ['B5', 'D6', 'C#6', 'A5', 'F#5'], 0.35);
[['B2', 30.0], ['G2', 34.0], ['F#2', 38.0]].forEach(([n, t]) => piano.push([t, n, 0.35]));
// 5 rain (40-48): sparse, low
[['B3', 40.2], ['F#3', 42.4], ['D3', 44.6], ['B2', 46.4]].forEach(([n, t]) => piano.push([t, n, 0.35]));
box.push([43.0, 'F#6', 0.25]);
// 6 the turn (48-58): one note per fold, silence, a trill, the lift
seq(box, 0, 1, []);
[[49.42, 'D5'], [50.58, 'E5'], [51.75, 'F#5'], [52.92, 'A5'], [54.0, 'B5'], [54.3, 'D6']].forEach(([t, n]) => box.push([t, n, 0.5]));
seq(box, 55.3, 0.12, ['E6', 'D6', 'E6', 'D6', 'E6', 'D6'], 0.3);
seq(box, 56.0, 0.12, ['D5', 'F#5', 'A5', 'D6', 'F#6'], 0.55);
piano.push([56.0, 'D3', 0.45]);
[['D3', 0.4], ['A3', 0.3], ['F#4', 0.28]].forEach(([n, v]) => piano.push([57.2, n, v]));
// 7 flight & dawn (58-68): the whole theme, arpeggios, bass, swelling
seq(box, 58.0, 0.45, ['D5', 'F#5', 'A5', 'B5', 'A5', 'F#5', 'E5', 'D5', 'B4', 'D5', 'F#5', 'A5', 'D6', 'B5', 'A5', 'F#5', 'A5', 'D6', 'E6', 'F#6', 'E6', 'D6'], 0.62);
const chords = [
  [58.0, ['D3', 'A3', 'F#4', 'A3']],
  [60.5, ['G2', 'D3', 'B3', 'D3']],
  [63.0, ['A2', 'E3', 'C#4', 'E3']],
  [65.5, ['D3', 'A3', 'F#4', 'A3']],
];
chords.forEach(([t0, ns], ci) => {
  for (let k = 0; k < 11; k++) piano.push([t0 + k * 0.225, ns[k % 4], 0.22 + ci * 0.06 + (k === 0 ? 0.15 : 0)]);
  piano.push([t0, ns[0].replace(/\d/, (d) => String(Number(d) - 1)), 0.45 + ci * 0.05]);
});
seq(box, 63.4, 0.9, ['A6', 'F#6', 'D6', 'E6'], 0.35);
// 8 reveal (68-75): last phrase, a D major chord as the curtain closes, a high D for the tag
seq(box, 68.5, 0.6, ['A5', 'F#5', 'E5'], 0.5);
box.push([70.5, 'D5', 0.55]);
[['D3', 0.5], ['F#3', 0.36], ['A3', 0.34], ['D4', 0.32]].forEach(([n, v], i) => piano.push([71.5 + i * 0.04, n, v]));
box.push([72.9, 'D6', 0.5]);
box.push([73.2, 'A5', 0.3]);

const DUR = 75;
const L = buf(DUR);
const R = buf(DUR);
const addVoice = (t0, f, vel, pan, voice) => {
  const len = voice === 'box' ? 2.6 : 4.2;
  const n = Math.round(len * SR);
  const o = Math.round(t0 * SR);
  const r = rng(Math.round(f * 100 + t0 * 7));
  const det = 1 + (r() - 0.5) * 0.002;
  for (let i = 0; i < n && o + i < L.length; i++) {
    const t = i / SR;
    let s;
    if (voice === 'box') {
      // music-box tine: fundamental with long ring, clamped-beam overtones that die fast
      s = Math.sin(TAU * f * det * t) * Math.exp(-t / 1.1) + 0.28 * Math.sin(TAU * f * 6.27 * t) * Math.exp(-t / 0.12) + 0.08 * Math.sin(TAU * f * 17.55 * t) * Math.exp(-t / 0.03);
      s *= Math.min(1, t * 800);
    } else {
      // soft felt piano
      const tau = 2.4 * Math.pow(220 / f, 0.35);
      s = (Math.sin(TAU * f * t) + 0.45 * Math.sin(TAU * 2.003 * f * t) * Math.exp(-t / (tau * 0.5)) + 0.18 * Math.sin(TAU * 3.01 * f * t) * Math.exp(-t / (tau * 0.3))) * Math.exp(-t / tau);
      s *= Math.min(1, t * 120);
    }
    const g = vel * s;
    L[o + i] += g * (1 - pan) * 0.9;
    R[o + i] += g * (1 + pan) * 0.9;
  }
};
box.forEach(([t, n, v]) => addVoice(t, NOTE(n), v * 0.55, 0.25, 'box'));
piano.forEach(([t, n, v]) => addVoice(t, NOTE(n), v * 0.8, -0.2, 'piano'));
// a simple stereo reverb (Schroeder): four damped combs + two allpasses per side
const reverb = (x, seedOffset) => {
  const combs = [1557, 1617, 1491, 1422].map((d) => d + seedOffset);
  const out = new Float32Array(x.length);
  for (const d of combs) {
    const line = new Float32Array(d);
    let idx = 0;
    let lp = 0;
    for (let i = 0; i < x.length; i++) {
      const y = line[idx];
      lp = y * 0.6 + lp * 0.4;
      line[idx] = x[i] + lp * 0.8;
      out[i] += y * 0.25;
      idx = (idx + 1) % d;
    }
  }
  for (const d of [225 + seedOffset, 556 + seedOffset]) {
    const line = new Float32Array(d);
    let idx = 0;
    for (let i = 0; i < out.length; i++) {
      const b = line[idx];
      const y = -out[i] + b;
      line[idx] = out[i] + b * 0.5;
      out[i] = y;
      idx = (idx + 1) % d;
    }
  }
  return out;
};
const wetL = reverb(L, 0);
const wetR = reverb(R, 23);
for (let i = 0; i < L.length; i++) {
  L[i] = L[i] * 0.8 + wetL[i] * 0.32;
  R[i] = R[i] * 0.8 + wetR[i] * 0.32;
}
// fade the last second so the score resolves with the picture
for (let i = 0; i < L.length; i++) {
  const t = i / SR;
  const f = t > DUR - 1.2 ? (DUR - t) / 1.2 : 1;
  L[i] *= f;
  R[i] *= f;
}
// master it like a normal release (about -19 dB RMS, -1 dB peak) so that the
// film's -18 dB music gain treats the placeholder the same as your own track
const master = (x, drive) => Math.tanh(x * drive) / Math.tanh(drive);
let peak = 0;
for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
for (let i = 0; i < L.length; i++) {
  L[i] = master(L[i] / peak, 2.2);
  R[i] = master(R[i] / peak, 2.2);
}
let peak2 = 0;
for (let i = 0; i < L.length; i++) peak2 = Math.max(peak2, Math.abs(L[i]), Math.abs(R[i]));
const g = Math.pow(10, -1 / 20) / peak2;
for (let i = 0; i < L.length; i++) {
  L[i] *= g;
  R[i] *= g;
}
const wav = path.join(MUSIC_DIR, 'placeholder-musicbox.wav');
writeWav(wav, [L, R]);

// encode the placeholder to MP3 with the ffmpeg that ships with Remotion
const mp3 = path.join(MUSIC_DIR, 'placeholder-musicbox.mp3');
const res = spawnSync('npx', ['remotion', 'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '192k', mp3], { cwd: ROOT, stdio: 'inherit' });
if (res.status === 0) {
  fs.unlinkSync(wav);
  console.log('music/placeholder-musicbox.mp3');
} else {
  console.log('ffmpeg not available; kept music/placeholder-musicbox.wav');
}
