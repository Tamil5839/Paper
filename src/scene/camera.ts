import { clamp, ease, lerp, seg, smoothstep, spline3, V3 } from '../lib/anim';
import { birdsAt, HOLD_POINT, redBirdPos, RED_REST } from './actors';

// Camera paths for every shot. Each shot is a run of keyframes interpolated
// with a Catmull-Rom spline (position and look-at target). The 4:5 feed cut
// reuses the same moves with a taller lens and, where needed, its own targets.

export type Variant = 'wide' | 'feed';

export type CamKey = {
  f: number;
  pos: V3;
  target: V3;
  fov: number; // vertical fov for 16:9
  coc?: number; // bokeh px at infinity
  tilt?: number; // tilt-shift strength
  focus?: V3; // point in sharp focus (default: target)
  feedTarget?: V3; // optional reframed target for 4:5
  feedPos?: V3;
  feedFov?: number;
};

export type CamState = {
  pos: V3;
  target: V3;
  fov: number;
  near: number;
  focusDist: number;
  coc: number;
  maxCoc: number;
  tilt: number;
  tiltCenter: number;
  tiltBand: number;
  roll: number;
};

/** A run of keys that is interpolated continuously; runs are separated by cuts. */
type Run = CamKey[];

export const RUNS: Run[] = [
  // 1-2 opening + city glide + arrival at the room (continuous)
  [
    { f: 0, pos: [0, 21, 168], target: [0, 20.5, 6], fov: 25, coc: 5, tilt: 22, feedPos: [0, 24, 150], feedTarget: [0, 24, 6] },
    { f: 100, pos: [0, 20.5, 150], target: [0, 20, 5], fov: 25, coc: 5, tilt: 22, feedPos: [0, 23, 134], feedTarget: [0, 22.5, 5] },
    { f: 192, pos: [0, 19, 96], target: [0, 17, -8], fov: 25, coc: 7, tilt: 18 },
    { f: 244, pos: [-5, 18.5, 24], target: [-8, 15.5, -27], fov: 27, coc: 10, tilt: 8 },
    { f: 292, pos: [-13, 15.5, 1], target: [-11, 12.5, -27], fov: 30, coc: 13, tilt: 3 },
    { f: 338, pos: [-9, 9.5, 6], target: [-9, 6.5, -15], fov: 30, coc: 15, tilt: 2 },
    { f: 384, pos: [1.5, 9, 13], target: [10, 8, -7], fov: 30, coc: 14, tilt: 2 },
    { f: 432, pos: [13.6, 9.6, 24], target: [13.2, 8.6, -7], fov: 30, coc: 14, tilt: 2 },
    { f: 600, pos: [13.2, 9.4, 19.5], target: [13.0, 9.2, -7], fov: 30, coc: 15, tilt: 2 },
    { f: 720, pos: [13.0, 9.3, 18], target: [13.0, 9.3, -7], fov: 30, coc: 15, tilt: 2 },
    { f: 790, pos: [8.5, 12.5, 33], target: [8.5, 12.2, -9], fov: 32, coc: 12, tilt: 4 },
    { f: 960, pos: [7.5, 13.2, 37], target: [8.2, 12.6, -9], fov: 32, coc: 12, tilt: 4 },
  ],
  // 5-8 rain, the turn, the flight, the reveal (continuous)
  [
    { f: 960, pos: [11.5, 10.8, 12], target: [11.8, 10.2, -10], fov: 28, coc: 16, tilt: 2 },
    { f: 1152, pos: [12.4, 10.2, 9.5], target: [13.0, 9.6, -8], fov: 28, coc: 17, tilt: 2 },
    { f: 1210, pos: [14.6, 9.4, 5.5], target: [14.6, 8.4, -6.4], fov: 26, coc: 22, tilt: 2 },
    { f: 1300, pos: [14.4, 9.0, 3.6], target: [14.3, 8.2, -6.3], fov: 26, coc: 24, tilt: 2 },
    { f: 1360, pos: [13.9, 9.5, 3.2], target: [13.4, 9.3, -6.3], fov: 27, coc: 22, tilt: 2 },
    { f: 1392, pos: [13.4, 10.2, 2.0], target: [12.8, 10.4, -8], fov: 28, coc: 20, tilt: 2 },
    { f: 1418, pos: [12.6, 10.6, -1.5], target: [11.6, 11.2, -12], fov: 32, coc: 16, tilt: 2 },
    { f: 1450, pos: [11.8, 11.2, -7.5], target: [10.6, 13.2, -16], fov: 34, coc: 16, tilt: 2 },
    { f: 1484, pos: [10.0, 14.6, -12.8], target: [7.6, 18.6, -19.2], fov: 36, coc: 15, tilt: 2 },
    { f: 1510, pos: [8.0, 18.0, -14.6], target: [5.0, 22.2, -22.4], fov: 38, coc: 14, tilt: 2 },
    { f: 1545, pos: [4.6, 21.0, -16.2], target: [2.3, 25.2, -25.3], fov: 40, coc: 14, tilt: 2 },
    { f: 1580, pos: [1.6, 21.4, -14.6], target: [0, 25.0, -30], fov: 40, coc: 14, tilt: 2 },
    { f: 1632, pos: [1.2, 21.8, -13.8], target: [0, 25.3, -30], fov: 40, coc: 13, tilt: 2 },
    { f: 1664, pos: [1, 28, 12], target: [0, 24, -20], fov: 30, coc: 10, tilt: 6 },
    { f: 1702, pos: [0, 40, 190], target: [0, 20, -4], fov: 24, coc: 6, tilt: 18, feedPos: [0, 38, 178], feedTarget: [0, 21, -4] },
    { f: 1734, pos: [0, 39, 192], target: [0, 20, -4], fov: 24, coc: 6, tilt: 18, feedPos: [0, 37, 176], feedTarget: [0, 21, -4] },
    { f: 1772, pos: [0, 26, 104], target: [0, 19.5, 4], fov: 24, coc: 6, tilt: 14, feedPos: [0, 23, 84], feedTarget: [0, 19, 4] },
    { f: 1800, pos: [0, 25.5, 98], target: [0, 19.5, 4], fov: 24, coc: 6, tilt: 14, feedPos: [0, 22.5, 78], feedTarget: [0, 19, 4] },
  ],
];

const lerp3 = (a: V3, b: V3, t: number): V3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const dist = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** The flight: the camera trails the red bird along its own path (smooth, 24 fps). */
const FOLLOW: [number, number] = [1414, 1468];
const followBlend = (f: number) => smoothstep(FOLLOW[0] - 16, FOLLOW[0] + 10, f) * (1 - smoothstep(FOLLOW[1] - 6, FOLLOW[1] + 16, f));

/** What the lens should be focused on (story subject), or null for the look-at target. */
export const subjectAt = (frame: number): V3 | null => {
  if (frame >= 440 && frame < 1150) {
    const b = birdsAt(frame).find((x) => x.id !== 'red');
    if (b && b.crumple < 1) return b.pos;
    return null;
  }
  if (frame >= 1160 && frame < 1302) return HOLD_POINT;
  if (frame >= 1302 && frame < 1392) return RED_REST;
  if (frame >= 1392 && frame < 1640) return redBirdPos(frame);
  return null;
};

export const cameraAt = (frame: number, variant: Variant, focusOverride: (f: number) => V3 | null = subjectAt): CamState => {
  let run = RUNS[0];
  for (const r of RUNS) if (frame >= r[0].f) run = r;
  const pick = (k: CamKey, which: 'pos' | 'target'): V3 =>
    variant === 'feed' ? (which === 'pos' ? k.feedPos ?? k.pos : k.feedTarget ?? k.target) : k[which];
  let pos = spline3(frame, run.map((k) => ({ f: k.f, v: pick(k, 'pos') })));
  let target = spline3(frame, run.map((k) => ({ f: k.f, v: pick(k, 'target') })));
  const fw = followBlend(frame);
  if (fw > 0) {
    const lagPt = redBirdPos(frame - 30);
    const ahead = redBirdPos(frame + 3);
    const fp: V3 = [lagPt[0] + 0.5, lagPt[1] - 1.0, lagPt[2] + 2.6];
    const ft: V3 = [ahead[0], ahead[1] + 0.3, ahead[2]];
    pos = lerp3(pos, fp, fw);
    target = lerp3(target, ft, fw);
  }
  const focusPt = spline3(frame, run.map((k) => ({ f: k.f, v: k.focus ?? pick(k, 'target') })));
  let i = 0;
  while (i < run.length - 2 && frame > run[i + 1].f) i++;
  const a = run[i];
  const b = run[Math.min(run.length - 1, i + 1)];
  const t = b === a ? 0 : ease.inOutSine(clamp((frame - a.f) / (b.f - a.f)));
  let fov = lerp(a.fov, b.fov, t);
  if (variant === 'feed') {
    const fa = a.feedFov ?? feedFov(a.fov);
    const fb = b.feedFov ?? feedFov(b.fov);
    fov = lerp(fa, fb, t);
  }
  const coc = lerp(a.coc ?? 12, b.coc ?? 12, t);
  const tilt = lerp(a.tilt ?? 0, b.tilt ?? 0, t);
  const fp = focusOverride?.(frame) ?? focusPt;
  // focus distance measured along the view axis (what the depth buffer sees)
  const dir = [target[0] - pos[0], target[1] - pos[1], target[2] - pos[2]] as V3;
  const dl = Math.hypot(...dir) || 1;
  const along = ((fp[0] - pos[0]) * dir[0] + (fp[1] - pos[1]) * dir[1] + (fp[2] - pos[2]) * dir[2]) / dl;
  return {
    pos,
    target,
    fov,
    near: clamp(dist(pos, target) * 0.01, 0.2, 4),
    focusDist: Math.max(1, along),
    coc,
    maxCoc: Math.max(4, coc * 1.6),
    tilt,
    tiltCenter: 0.5,
    tiltBand: 0.2,
    roll: 0,
  };
};

/** Keep ~78% of the 16:9 width in the 4:5 frame: a taller vertical fov. */
export const feedFov = (fov: number) => {
  const t = Math.tan(((fov / 2) * Math.PI) / 180) * 1.733;
  return (Math.atan(t) * 2 * 180) / Math.PI;
};

export const _u = { seg, lerp3 };
