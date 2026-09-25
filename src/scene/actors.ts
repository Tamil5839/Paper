import { BEATS } from '../story';
import { clamp, ease, Key, lerp, onTwos, seg, track, track3, V3 } from '../lib/anim';
import { hash1, noise1 } from '../lib/random';
import { ROOM } from './room';

// ──────────────────────────────────────────────────────────────────────────────
// Choreography. Every actor's state is a pure function of the frame, evaluated
// on twos (stop-motion), so the camera and lights can also query where things
// are (e.g. to pull focus onto a falling bird).
// ──────────────────────────────────────────────────────────────────────────────

export type BirdState = {
  id: string;
  pos: V3;
  yaw: number; // heading about +y (0 = facing +x)
  pitch: number; // nose up (+) / down (-)
  roll: number; // bank / tumble
  flap: number; // -1 (down) .. 1 (up)
  fold: number; // outer wing fold 0..1
  droop: number; // wet sag 0..1
  scale: number;
  crumple: number; // 0 bird .. 1 ball
  squash: number; // impact squash 0..1
  lostWing: boolean;
  wet: number;
  red: boolean;
};

export type BallState = { id: string; pos: V3; rot: V3; scale: number; seed: number };

const LAPTOP_TOP: V3 = [ROOM.laptop.x, 9.05, -7.85];
const FLOOR_BALL_Y = ROOM.floorY + 0.52;

const k3 = (f: number, v: V3, e?: (t: number) => number): Key<V3> => [f, v, e];

/** flapping: on twos, phase advances in whole drawings */
const flapAt = (f2: number, period: number, amp = 1, phase = 0) => amp * Math.sin(((f2 + phase) / period) * Math.PI * 2);

const headingTo = (a: V3, b: V3) => Math.atan2(-(b[2] - a[2]), b[0] - a[0]);

// ------------------------------------------------------------------ failing birds
const bird1 = (f2: number): BirdState | null => {
  const B = BEATS.bird1;
  if (f2 < B.lift || f2 >= B.land + 6) return null;
  const pos = track3(f2, [
    k3(B.lift, LAPTOP_TOP),
    k3(B.lift + 8, [11.9, 10.4, -7.3], ease.outQuad),
    k3(486, [11.0, 12.4, -6.6]),
    k3(B.apex, [10.4, 13.5, -6.1], ease.outSine),
    k3(B.falter, [10.6, 13.35, -5.9]),
    k3(B.fall, [11.4, 12.3, -5.6], ease.inQuad),
    k3(526, [13.4, 7.6, -5.0], ease.inQuad),
    k3(B.land, [15.4, FLOOR_BALL_Y, -4.5], ease.inQuad),
  ]);
  const flying = f2 < B.falter;
  const stall = seg(f2, B.apex, B.fall);
  const falling = seg(f2, B.fall, B.land);
  return {
    id: 'bird1',
    pos,
    yaw: Math.PI + stall * 0.8 + falling * 2.5,
    pitch: flying ? 0.35 : lerp(0.5, -0.9, falling),
    roll: falling * 4.2 + (f2 >= B.falter && f2 < B.fall ? Math.sin(f2 * 0.9) * 0.4 : 0),
    flap: flying ? flapAt(f2, 8) : f2 < B.fall ? flapAt(f2, 12, 0.5) : Math.sin(f2 * 1.3) * 0.3,
    fold: falling * 0.5,
    droop: 0,
    scale: lerp(0.3, 1, seg(f2, B.lift, B.lift + 8)),
    crumple: seg(f2, B.land, B.land + 6),
    squash: 0,
    lostWing: false,
    wet: 0,
    red: false,
  };
};

const bird2 = (f2: number): BirdState | null => {
  const B = BEATS.bird2;
  if (f2 < B.lift || f2 >= B.fall + 10) return null;
  const pos = track3(f2, [
    k3(B.lift, LAPTOP_TOP),
    k3(B.lift + 6, [12.3, 10.4, -7.2], ease.outQuad),
    k3(584, [12.8, 13.2, -6.5]),
    k3(B.ceiling, [13.2, 15.2, -6.0], ease.inQuad),
    k3(B.fall + 4, [15.2, 13.9, -5.6], ease.outQuad),
    k3(B.fall + 10, [18.0, 10.4, -5.4]),
  ]);
  const up = f2 < B.ceiling;
  return {
    id: 'bird2',
    pos,
    yaw: Math.PI * 0.62,
    pitch: up ? 1.05 : -0.6,
    roll: up ? 0 : seg(f2, B.ceiling, B.fall + 10) * 3.5,
    flap: up ? flapAt(f2, 6, 1.1) : 0.2,
    fold: up ? 0 : 0.6,
    droop: 0,
    scale: lerp(0.3, 1, seg(f2, B.lift, B.lift + 6)),
    crumple: seg(f2, B.fall + 2, B.fall + 10),
    squash: f2 >= B.ceiling && f2 < B.ceiling + 4 ? 1 - (f2 - B.ceiling) / 4 : 0,
    lostWing: false,
    wet: 0,
    red: false,
  };
};

const bird3 = (f2: number): BirdState | null => {
  const B = BEATS.bird3;
  if (f2 < B.lift || f2 >= B.land + 6) return null;
  const pos = track3(f2, [
    k3(B.lift, LAPTOP_TOP),
    k3(B.lift + 6, [11.8, 10.4, -7.2], ease.outQuad),
    k3(648, [10.6, 12.0, -6.6]),
    k3(B.wingOff, [9.8, 12.8, -6.3], ease.outSine),
    k3(664, [9.4, 11.8, -5.8], ease.inQuad),
    k3(672, [8.9, 8.2, -5.2], ease.inQuad),
    k3(B.land, [8.4, FLOOR_BALL_Y, -4.4], ease.inQuad),
  ]);
  const broken = f2 >= B.wingOff;
  const t = seg(f2, B.wingOff, B.land);
  return {
    id: 'bird3',
    pos,
    yaw: broken ? Math.PI + t * 9 : Math.PI + 0.25,
    pitch: broken ? -0.7 * t : 0.3,
    roll: broken ? t * 2.2 : 0,
    flap: broken ? flapAt(f2, 4, 0.9) : flapAt(f2, 8),
    fold: 0,
    droop: 0,
    scale: lerp(0.3, 1, seg(f2, B.lift, B.lift + 6)),
    crumple: seg(f2, B.land, B.land + 6),
    squash: 0,
    lostWing: broken,
    wet: 0,
    red: false,
  };
};

/** the detached wing of bird 3, falling like a leaf */
export const lostWingState = (frame: number) => {
  const f2 = onTwos(frame);
  const B = BEATS.bird3;
  if (f2 < B.wingOff) return null;
  const t = f2 - B.wingOff;
  const landT = 46;
  const u = Math.min(t, landT);
  const y = lerp(12.8, ROOM.floorY + 0.05, clamp(u / landT) ** 1.1);
  const x = 9.8 + Math.sin(u * 0.28) * 1.1 + u * 0.03;
  const z = -6.3 + u * 0.05;
  const landed = t >= landT;
  return {
    pos: [x, y, z] as V3,
    rot: (landed ? [-Math.PI / 2, 0, 0.6] : [Math.sin(u * 0.28) * 0.9 - 0.4, u * 0.05, Math.cos(u * 0.28) * 0.7]) as V3,
  };
};

// ------------------------------------------------------------------ the wet bird
const wetBird = (f2: number): BirdState | null => {
  const B = BEATS.wetBird;
  if (f2 < B.lift || f2 >= B.fall + 16) return null;
  const pos = track3(f2, [
    k3(B.lift, LAPTOP_TOP),
    k3(B.lift + 6, [11.8, 10.3, -7.6], ease.outQuad),
    k3(1020, [12.6, 11.3, -9.2]),
    k3(B.out, [12.9, 11.3, -11.3]),
    k3(1040, [13.1, 11.7, -12.3], ease.outSine),
    k3(B.droop, [13.2, 11.1, -12.5]),
    k3(B.fall, [13.25, 9.7, -12.6], ease.inQuad),
    k3(B.fall + 16, [13.3, 1.0, -12.8], ease.inQuad),
  ]);
  const wet = seg(f2, B.wet - 4, B.droop);
  return {
    id: 'wet',
    pos,
    yaw: headingTo(LAPTOP_TOP, [13.1, 11.7, -12]) + (f2 > B.out ? Math.sin(f2 * 0.3) * 0.3 : 0),
    pitch: lerp(0.3, -1.0, seg(f2, B.droop, B.fall + 8)),
    roll: seg(f2, B.fall, B.fall + 16) * 1.2,
    flap: f2 < B.wet ? flapAt(f2, 8) : flapAt(f2, lerp(8, 18, wet), lerp(1, 0.2, wet)),
    fold: 0,
    droop: wet,
    scale: lerp(0.3, 1.2, seg(f2, B.lift, B.lift + 6)),
    crumple: 0,
    squash: 0,
    lostWing: false,
    wet,
    red: false,
  };
};
export const WET_SCALE = 1.2;

// ------------------------------------------------------------------ the red bird
export const RED_REST: V3 = [13.9, ROOM.deskTop + 0.62, -6.05];

export const redBirdPos = (f2: number): V3 => {
  const B = BEATS;
  const circleStart = B.circle[0];
  if (f2 < circleStart) {
    return track3(f2, [
      k3(B.birdMade, RED_REST),
      k3(B.lift, RED_REST),
      k3(B.lift + 12, [13.6, 8.3, -6.1], ease.outQuad),
      k3(B.steady, [13.3, 9.7, -6.3]),
      k3(1392, [13.1, 10.1, -6.6]),
      k3(1404, [12.4, 10.7, -8.3]),
      k3(B.outWindow, [11.3, 11.4, -11.2]),
      k3(1440, [10.6, 13.2, -14.0]),
      k3(1470, [8.6, 17.4, -18.0]),
      k3(1510, [5.0, 22.6, -22.4]),
      k3(circleStart, [1.6, 26.4, -26.0]),
    ]);
  }
  const a = ((f2 - circleStart) / 72) * Math.PI * 2;
  const enter = seg(f2, circleStart, circleStart + 16);
  // circle centre (0, 30, -27.4), radii 4.2 (x) and 1.7 (z); starts from the approach point
  const cx = Math.cos(a) * 4.2;
  const cz = Math.sin(a) * 1.7;
  return [lerp(1.6, cx, enter), lerp(26.4, 27.6 + Math.sin(a * 2) * 0.35, enter), lerp(-26.0, -27.4 + cz, enter)];
};

export const redBird = (frame: number): BirdState | null => {
  const f2 = onTwos(frame);
  const B = BEATS;
  if (f2 < B.birdMade) return null;
  const circleStart = B.circle[0];
  const pos = redBirdPos(f2);
  const resting = f2 < B.lift;
  const wob = f2 >= B.wobble[0] && f2 < B.lift ? Math.sin((f2 - B.wobble[0]) * 0.9) * 0.22 : 0;
  const unsteady = f2 >= B.lift && f2 < B.steady ? 1 - seg(f2, B.lift, B.steady) : 0;
  let yaw = Math.PI - 0.35;
  if (f2 >= 1372) yaw = headingTo(pos, redBirdPos(f2 + 4));
  return {
    id: 'red',
    pos: [pos[0], pos[1] + unsteady * Math.sin(f2 * 0.8) * 0.18, pos[2]],
    yaw,
    pitch: resting ? 0.08 : f2 >= 1418 && f2 < circleStart ? 0.45 : 0.12,
    roll: wob + unsteady * Math.sin(f2 * 0.6) * 0.25 + (f2 >= circleStart ? -0.45 * seg(f2, circleStart, circleStart + 16) : 0),
    flap: resting ? (f2 >= B.wobble[0] ? 0.15 + Math.sin(f2 * 1.1) * 0.12 : 0.35) : flapAt(f2, f2 > 1418 ? 8 : 6, 1),
    fold: resting ? 0.15 : 0,
    droop: 0,
    scale: 1,
    crumple: 0,
    squash: 0,
    lostWing: false,
    wet: 0,
    red: true,
  };
};

export const birdsAt = (frame: number): BirdState[] => {
  const f2 = onTwos(frame);
  return [bird1(f2), bird2(f2), bird3(f2), wetBird(f2), redBird(frame)].filter((b): b is BirdState => b !== null);
};

// ------------------------------------------------------------------ paper balls
const BASKET = ROOM.basket;
const BIN_SLOTS: V3[] = [
  [BASKET[0] - 0.55, 2.0, BASKET[2] - 0.2],
  [BASKET[0] + 0.5, 2.1, BASKET[2] + 0.1],
  [BASKET[0] - 0.1, 2.5, BASKET[2] - 0.35],
  [BASKET[0] + 0.3, 3.1, BASKET[2] + 0.15],
  [BASKET[0] - 0.6, 3.3, BASKET[2] + 0.05],
  [BASKET[0] + 0.05, 3.8, BASKET[2] - 0.1],
  [BASKET[0] - 0.35, 4.5, BASKET[2] + 0.1],
  [BASKET[0] + 0.55, 4.45, BASKET[2] - 0.05],
  [BASKET[0] + 0.1, 5.15, BASKET[2]],
];
const FLOOR_SPOTS: V3[] = [
  [19.3, FLOOR_BALL_Y, -3.9],
  [23.0, FLOOR_BALL_Y, -4.3],
  [20.7, FLOOR_BALL_Y, -3.3],
  [18.4, FLOOR_BALL_Y, -4.9],
];

const tossArc = (f2: number, t0: number, dur: number, from: V3, to: V3, h = 3): V3 => {
  const t = clamp((f2 - t0) / dur);
  return [lerp(from[0], to[0], t), lerp(from[1], to[1], t) + Math.sin(t * Math.PI) * h, lerp(from[2], to[2], t)];
};

export const TOSSES = [752, 778, 806, 832, 860, 886, 912, 934, 946];

export const ballsAt = (frame: number): BallState[] => {
  const f2 = onTwos(frame);
  const out: BallState[] = [];
  const B1 = BEATS.bird1;
  if (f2 >= B1.land + 6) {
    let p: V3;
    if (f2 < B1.roll) p = [15.4, FLOOR_BALL_Y, -4.5];
    else if (f2 < 560) p = track3(f2, [k3(B1.roll, [15.4, FLOOR_BALL_Y, -4.5]), k3(560, [20.0, FLOOR_BALL_Y, -4.9], ease.outQuad)]);
    else p = tossArc(f2, 560, B1.bin - 560, [20.0, FLOOR_BALL_Y, -4.9], BIN_SLOTS[0], 2.6);
    const rolled = f2 < 560 ? (p[0] - 15.4) / 0.52 : (20 - 15.4) / 0.52 + (f2 - 560) * 0.4;
    out.push({ id: 'b1', pos: p, rot: [0, 0, -rolled], scale: 1, seed: 11 });
  }
  const B2 = BEATS.bird2;
  if (f2 >= B2.fall + 10) {
    const p = f2 < B2.bin ? track3(f2, [k3(B2.fall + 10, [18.0, 10.4, -5.4]), k3(612, [20.4, 6.6, -5.3], ease.inQuad), k3(B2.bin, BIN_SLOTS[1], ease.inQuad)]) : BIN_SLOTS[1];
    out.push({ id: 'b2', pos: p, rot: [f2 * 0.2, f2 * 0.3, 0], scale: 0.95, seed: 22 });
  }
  const B3 = BEATS.bird3;
  if (f2 >= B3.land + 6) out.push({ id: 'b3', pos: [8.4, FLOOR_BALL_Y, -4.4], rot: [0.4, 1.2, 0.3], scale: 1.02, seed: 33 });
  // time passing: the builder keeps crumpling and tossing
  const hand: V3 = [16.2, 8.6, -6.4];
  TOSSES.forEach((t0, i) => {
    if (f2 < t0) return;
    const slot = i < 7 ? BIN_SLOTS[i + 2] : FLOOR_SPOTS[i - 7];
    const dest = slot;
    const miss = i === 4 || i >= 7;
    const target = miss ? FLOOR_SPOTS[(i + 1) % FLOOR_SPOTS.length] : dest;
    const p = f2 < t0 + 8 ? tossArc(f2, t0, 8, hand, target, 2.4) : target;
    out.push({ id: `t${i}`, pos: p, rot: [i * 0.7, i * 1.3 + (f2 - t0) * 0.1, i * 0.4], scale: 0.85 + hash1(i, 5) * 0.25, seed: 100 + i });
  });
  return out;
};

// ------------------------------------------------------------------ tumblers & calendar
export const TUMBLER_SPOTS: V3[] = [
  [9.45, ROOM.deskTop, -6.0],
  [15.05, ROOM.deskTop, -8.9],
  [6.75, ROOM.deskTop, -6.1],
  [13.7, ROOM.deskTop, -9.15],
  [7.2, ROOM.deskTop, -9.1],
  [20.1, ROOM.floorY, -4.2],
];

export const tumblerScales = (frame: number) => {
  const f2 = onTwos(frame);
  return TUMBLER_SPOTS.map((_, i) => {
    if (i === 0) return 1;
    const t0 = BEATS.tumblers[i - 1];
    if (f2 < t0) return 0;
    const t = f2 - t0;
    return t >= 6 ? 1 : [0.35, 0.8, 1.14, 1.0][Math.min(3, Math.floor(t / 2))];
  });
};

export const CAL_DAYS = [12, 13, 14, 15, 16, 17];

/** for each calendar page: 'on' | flip angle | gone */
export const calendarPages = (frame: number) => {
  const f2 = onTwos(frame);
  return CAL_DAYS.map((_, i) => {
    if (i === CAL_DAYS.length - 1) return { flip: 0, drop: 0, gone: false };
    const t0 = BEATS.calendarFlips[i];
    const flip = seg(f2, t0, t0 + 8, ease.inOutSine);
    const drop = seg(f2, t0 + 8, t0 + 24, ease.inQuad);
    return { flip, drop, gone: f2 >= t0 + 24 };
  });
};

// ------------------------------------------------------------------ the builder
export type Pose = { lean: number; head: number; nearU: number; nearF: number; farU: number; farF: number; hipDx: number };

const P = {
  type: { lean: 0.16, head: 0.2, nearU: 0.93, nearF: 0.8, farU: 0.98, farF: 0.75, hipDx: 0 },
  watch: { lean: 0.02, head: -0.42, nearU: 0.62, nearF: 0.9, farU: 0.66, farF: 0.85, hipDx: 0 },
  hope: { lean: -0.02, head: -0.3, nearU: 0.55, nearF: 1.9, farU: 0.5, farF: 1.7, hipDx: 0 },
  sad: { lean: 0.3, head: 0.5, nearU: 1.05, nearF: 0.55, farU: 1.0, farF: 0.6, hipDx: 0 },
  slump: { lean: 0.52, head: 0.42, nearU: 1.62, nearF: 0.45, farU: 1.55, farF: 0.5, hipDx: -0.15 },
  hands: { lean: 0.42, head: 0.3, nearU: 0.6, nearF: 2.35, farU: 0.62, farF: 2.3, hipDx: -0.1 },
  back: { lean: -0.2, head: -0.55, nearU: 0.1, nearF: 0.12, farU: 0.12, farF: 0.14, hipDx: 0.15 },
  sip: { lean: 0.05, head: -0.12, nearU: 0.5, nearF: 2.5, farU: 0.7, farF: 0.8, hipDx: 0 },
  toss: { lean: 0.1, head: -0.3, nearU: 2.3, nearF: 0.3, farU: 0.6, farF: 0.8, hipDx: 0 },
  reach: { lean: 0.26, head: 0.3, nearU: 1.1, nearF: 0.55, farU: 0.8, farF: 0.9, hipDx: 0 },
  hold: { lean: 0.14, head: 0.36, nearU: 0.55, nearF: 1.95, farU: 0.6, farF: 1.85, hipDx: 0 },
  set: { lean: 0.2, head: 0.42, nearU: 1.0, nearF: 1.2, farU: 0.9, farF: 1.1, hipDx: 0 },
};
type PoseName = keyof typeof P;

// pose timeline: [frame, pose, transition length]
const TIMELINE: [number, PoseName][] = [
  [0, 'type'],
  [462, 'type'],
  [470, 'watch'],
  [512, 'watch'],
  [524, 'sad'],
  [556, 'sad'],
  [562, 'type'],
  [574, 'watch'],
  [596, 'watch'],
  [604, 'sad'],
  [622, 'type'],
  [638, 'hope'],
  [656, 'hope'],
  [666, 'sad'],
  [690, 'sad'],
  [712, 'slump'],
  [748, 'slump'],
  [758, 'type'],
  [796, 'type'],
  [806, 'hands'],
  [836, 'hands'],
  [846, 'type'],
  [872, 'type'],
  [880, 'back'],
  [906, 'back'],
  [914, 'sip'],
  [932, 'sip'],
  [940, 'type'],
  [990, 'type'],
  [998, 'toss'],
  [1006, 'watch'],
  [1044, 'watch'],
  [1066, 'sad'],
  [1100, 'hands'],
  [1150, 'hands'],
  [1160, 'set'],
  [1168, 'reach'],
  [1180, 'hold'],
  [1296, 'hold'],
  [1304, 'set'],
  [1326, 'set'],
  [1336, 'watch'],
  [1380, 'hope'],
  [1440, 'watch'],
  [1800, 'watch'],
];

export const builderPose = (frame: number): Pose => {
  const f2 = onTwos(frame);
  let i = 0;
  while (i < TIMELINE.length - 1 && f2 >= TIMELINE[i + 1][0]) i++;
  const [fa, pa] = TIMELINE[i];
  const [fb, pb] = TIMELINE[Math.min(TIMELINE.length - 1, i + 1)];
  // hold the pose, then move to the next in the last 8 frames before it
  const moveLen = Math.min(8, fb - fa);
  const t = fb === fa ? 0 : ease.inOutSine(clamp((f2 - (fb - moveLen)) / moveLen));
  const A = P[pa];
  const Bp = P[pb];
  const pose: Pose = {
    lean: lerp(A.lean, Bp.lean, t),
    head: lerp(A.head, Bp.head, t),
    nearU: lerp(A.nearU, Bp.nearU, t),
    nearF: lerp(A.nearF, Bp.nearF, t),
    farU: lerp(A.farU, Bp.farU, t),
    farF: lerp(A.farF, Bp.farF, t),
    hipDx: lerp(A.hipDx, Bp.hipDx, t),
  };
  // typing: hands bob alternately on twos
  const typing = pa === 'type' && pb === 'type';
  if (typing) {
    const d = (f2 >> 1) % 2 === 0 ? 1 : -1;
    const jitter = hash1(f2, 17) * 0.06;
    pose.nearF += d * (0.07 + jitter);
    pose.farF -= d * (0.07 + jitter);
    pose.head += noise1(f2 * 0.05, 3) * 0.03;
  }
  // folding: small busy hand movements
  if (f2 >= BEATS.folds[0] - 6 && f2 < BEATS.birdMade) {
    const d = (f2 >> 1) % 3;
    pose.nearF += [0.08, -0.04, 0.02][d];
    pose.farF += [-0.05, 0.06, 0][d];
    pose.head += Math.sin(f2 * 0.2) * 0.03;
  }
  // breathing: tiny lean oscillation, always alive
  pose.lean += Math.sin(f2 * 0.11) * 0.012;
  return pose;
};

/** where the builder's hands are, for the folding sheet (world space) */
export const HOLD_POINT: V3 = [14.3, 7.95, -6.3];

/** red sheet: lies at the bottom of the paper stack, then is pulled out and folded */
export const redSheet = (frame: number) => {
  const f2 = onTwos(frame);
  const B = BEATS;
  if (f2 >= B.birdMade) return null;
  const pulled = seg(f2, B.pickSheet, B.pickSheet + 12, ease.inOutSine);
  const stack = ROOM.stack;
  const pos: V3 = [lerp(stack[0], HOLD_POINT[0], pulled), lerp(stack[1] + 0.02, HOLD_POINT[1], pulled), lerp(stack[2], HOLD_POINT[2], pulled)];
  const flat = 1 - pulled;
  const folds = B.folds.map((t0) => seg(f2, t0, t0 + 12, ease.inOutSine));
  return { pos, flat, folds };
};

export const stackCount = (frame: number) => {
  const f2 = onTwos(frame);
  // cream sheets used up by the failing birds (one per idea)
  const uses = [BEATS.bird1.lift, BEATS.bird2.lift, BEATS.bird3.lift, 760, 830, 900, BEATS.wetBird.lift];
  return Math.max(0, 7 - uses.filter((u) => f2 >= u).length);
};

export const _t = track;
