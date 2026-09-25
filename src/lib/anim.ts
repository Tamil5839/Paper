import { fbm1, noise1, toSeed } from './random';

export const FPS = 24;

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
export const remap = (v: number, a: number, b: number, c: number, d: number) =>
  lerp(c, d, invLerp(a, b, v));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = invLerp(a, b, v);
  return t * t * (3 - 2 * t);
};

export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inOutQuint: (t: number) => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
};
export type Ease = (t: number) => number;

/** 0..1 progress of `frame` through [start, end], eased. */
export const seg = (frame: number, start: number, end: number, e: Ease = ease.linear) =>
  e(clamp((frame - start) / Math.max(1e-6, end - start)));

/** Stop-motion cadence: puppets and paper hold each drawing for two frames. */
export const onTwos = (frame: number) => Math.floor(frame / 2) * 2;

export type Key<T> = [frame: number, value: T, ease?: Ease];

/** Piecewise keyframe interpolation for numbers. The ease of a key applies to the segment arriving at it. */
export const track = (frame: number, keys: Key<number>[]): number => {
  if (frame <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    if (frame <= f1) {
      const [f0, v0] = keys[i - 1];
      const t = (e ?? ease.inOutSine)(clamp((frame - f0) / Math.max(1e-6, f1 - f0)));
      return lerp(v0, v1, t);
    }
  }
  return keys[keys.length - 1][1];
};

export type V3 = [number, number, number];

export const track3 = (frame: number, keys: Key<V3>[]): V3 => {
  if (frame <= keys[0][0]) return [...keys[0][1]] as V3;
  for (let i = 1; i < keys.length; i++) {
    const [f1, v1, e] = keys[i];
    if (frame <= f1) {
      const [f0, v0] = keys[i - 1];
      const t = (e ?? ease.inOutSine)(clamp((frame - f0) / Math.max(1e-6, f1 - f0)));
      return [lerp(v0[0], v1[0], t), lerp(v0[1], v1[1], t), lerp(v0[2], v1[2], t)];
    }
  }
  return [...keys[keys.length - 1][1]] as V3;
};

/**
 * Damped overshoot after a move lands at frame `end`.
 * Returns an offset in units of the move distance (≈ +amp at first, decaying).
 */
export const overshoot = (frame: number, end: number, amp = 0.06, period = 7, decay = 5) => {
  if (frame < end) return 0;
  const t = (frame - end) / period;
  return amp * Math.sin(t * Math.PI * 2 * 0.5 + Math.PI / 2) * Math.exp(-t * decay * 0.35) * (t < 4 ? 1 : 0);
};

/**
 * Hand-held stick imperfection: slow drift + small tremor, strongest while the
 * puppeteer is moving (activity 0..1) but never fully zero.
 */
export const handWobble = (frame: number, seed: string | number, amp = 1, activity = 0.3) => {
  const s = toSeed(seed) % 10000;
  const drift = fbm1(frame * 0.021 + s * 0.13, s, 2);
  const tremor = noise1(frame * 0.19 + s * 0.71, s + 7);
  return amp * (drift * (0.35 + 0.65 * activity) + tremor * 0.25 * activity);
};

/** Catmull-Rom interpolation through V3 control points with non-uniform frame knots. */
export const spline3 = (frame: number, keys: { f: number; v: V3 }[]): V3 => {
  const n = keys.length;
  if (frame <= keys[0].f) return [...keys[0].v] as V3;
  if (frame >= keys[n - 1].f) return [...keys[n - 1].v] as V3;
  let i = 0;
  while (i < n - 2 && frame > keys[i + 1].f) i++;
  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(n - 1, i + 2)];
  const t = (frame - k1.f) / (k2.f - k1.f);
  const out: V3 = [0, 0, 0];
  const dt1 = k2.f - k1.f;
  for (let c = 0; c < 3; c++) {
    // tangents scaled for non-uniform spacing (Hermite form)
    const m1 = k1 === k0 ? 0 : ((k2.v[c] - k0.v[c]) / (k2.f - k0.f)) * dt1;
    const m2 = k3 === k2 ? 0 : ((k3.v[c] - k1.v[c]) / (k3.f - k1.f)) * dt1;
    const t2 = t * t;
    const t3 = t2 * t;
    out[c] =
      (2 * t3 - 3 * t2 + 1) * k1.v[c] +
      (t3 - 2 * t2 + t) * m1 +
      (-2 * t3 + 3 * t2) * k2.v[c] +
      (t3 - t2) * m2;
  }
  return out;
};
