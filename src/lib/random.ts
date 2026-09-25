// Deterministic randomness. Nothing in the film may call Math.random():
// every "random" choice is derived from a string/number seed so that each
// render of every frame is bit-for-bit repeatable.

export const hashString = (s: string): number => {
  // FNV-1a 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

export const toSeed = (seed: string | number): number =>
  typeof seed === 'number' ? seed >>> 0 : hashString(seed);

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type Rng = {
  next: () => number;
  range: (a: number, b: number) => number;
  int: (a: number, b: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  sign: () => number;
  gauss: () => number;
  chance: (p: number) => boolean;
};

export const rng = (seed: string | number): Rng => {
  const next = mulberry32(toSeed(seed));
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => Math.floor(a + (b - a + 1) * next()),
    pick: (arr) => arr[Math.floor(next() * arr.length) % arr.length],
    sign: () => (next() < 0.5 ? -1 : 1),
    gauss: () => {
      const u = Math.max(1e-9, next());
      const v = next();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    chance: (p) => next() < p,
  };
};

// Integer hash -> [0, 1)
export const hash1 = (n: number, seed = 0): number => {
  let h = (Math.imul(n | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

export const hash2 = (x: number, y: number, seed = 0): number =>
  hash1((x | 0) + Math.imul(y | 0, 0x3c6ef372), seed);

export const hash3 = (x: number, y: number, z: number, seed = 0): number =>
  hash1((x | 0) + Math.imul(y | 0, 0x3c6ef372) + Math.imul(z | 0, 0x1b873593), seed);

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

// Smooth 1D value noise in [-1, 1]
export const noise1 = (x: number, seed = 0): number => {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1(i, seed) * 2 - 1;
  const b = hash1(i + 1, seed) * 2 - 1;
  return a + (b - a) * fade(f);
};

export const fbm1 = (x: number, seed = 0, octaves = 3): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise1(x * freq, seed + o * 101);
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
};

// Smooth 2D value noise in [-1, 1]; optional period for tiling
export const noise2 = (x: number, y: number, seed = 0, period = 0): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const w = (v: number) => (period > 0 ? ((v % period) + period) % period : v);
  const h = (a: number, b: number) => hash2(w(a), w(b), seed) * 2 - 1;
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export const fbm2 = (x: number, y: number, seed = 0, octaves = 4, period = 0): number => {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise2(x * freq, y * freq, seed + o * 57, period > 0 ? period * freq : 0);
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
};

// Smooth 3D value noise in [-1, 1]
export const noise3 = (x: number, y: number, z: number, seed = 0): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = fade(x - xi);
  const fy = fade(y - yi);
  const fz = fade(z - zi);
  const h = (a: number, b: number, c: number) => hash3(a, b, c, seed) * 2 - 1;
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const x00 = l(h(xi, yi, zi), h(xi + 1, yi, zi), fx);
  const x10 = l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx);
  const x01 = l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx);
  const x11 = l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx);
  return l(l(x00, x10, fy), l(x01, x11, fy), fz);
};
