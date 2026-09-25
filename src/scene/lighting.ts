import { BEATS } from '../story';
import { clamp, lerp, onTwos, seg, track, V3 } from '../lib/anim';
import { hash1 } from '../lib/random';

// Lighting cues, keyed to the story beats. All values are pure functions of the
// frame. Practical lights (lamp flicker, lightning) change on twos like the puppets.

export type Lighting = {
  hemi: number;
  hemiSky: string;
  hemiGround: string;
  key: number;
  keyColor: string;
  keyPos: V3;
  keyTarget: V3;
  keyShadowHalf: [number, number];
  keyShadowFar: number;
  keyShadowRadius: number;
  fill: number;
  fillColor: string;
  fillPos: V3;
  stage: number;
  stageColor: string;
  stageAngle: number;
  stagePos: V3;
  stageTarget: V3;
  lamp: number;
  lampColor: string;
  lampPos: V3;
  lampTarget: V3;
  laptop: number;
  laptopPos: V3;
  bounce: number;
  bouncePos: V3;
  moon: number;
  moonPos: V3;
  street: number;
  streetPos: V3;
  cyc: number;
  stageShadow: boolean;
  lampShadow: boolean;
  // emissive levels for vellum pieces (0..1+)
  windowsLit: number;
  stars: number;
  skyFlash: number;
  exposure: number;
  fade: number;
};

const mixHex = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = clamp(t);
  const c = (s: number) => Math.round(lerp((pa >> s) & 255, (pb >> s) & 255, k));
  return `#${[16, 8, 0].map((s) => c(s).toString(16).padStart(2, '0')).join('')}`;
};

export const lightingAt = (frame: number): Lighting => {
  const f = frame;
  const f2 = onTwos(frame);
  const [lu0, lu1] = BEATS.lightUp;
  const [co0, co1] = BEATS.cityLightsOn;
  const dawn = seg(f, BEATS.skySwap[0] - 10, BEATS.sunRise[1] - 30);
  const table = seg(f, 1636, 1720);
  // anything that changes the shadow maps steps on twos, like the puppets
  const dawn2 = seg(f2, BEATS.skySwap[0] - 10, BEATS.sunRise[1] - 30);
  const table2 = seg(f2, 1636, 1720);
  const night = seg(f, co0, co1);

  // desk lamp flicker during the storm (on twos, hashed so it feels electrical)
  let flick = 1;
  if (f2 >= BEATS.flicker[0] && f2 <= BEATS.flicker[1]) {
    const h = hash1(f2 >> 1, 91);
    flick = h < 0.22 ? 0.08 : h < 0.4 ? 0.55 : 1;
  }
  const lightning = f2 >= BEATS.lightning && f2 < BEATS.lightning + 6 ? (f2 < BEATS.lightning + 2 ? 1 : f2 < BEATS.lightning + 4 ? 0.25 : 0.7) : 0;

  const lampOn = 1 - seg(f, BEATS.skySwap[0], BEATS.skySwap[1]) * 0.85;
  const moonK = night * (1 - dawn);
  const keyColor = dawn > 0 ? mixHex('#a9bbff', '#ffc9a0', dawn) : '#a9bbff';
  const key = lerp(0, 2.3, night) * (1 - table * 0.2) + dawn * 0.9 + lightning * 4;
  const keyPosNight: V3 = [-60, 110, 120];
  const keyPosDawn: V3 = [-80, 75, 140];
  const keyPosTable: V3 = [-260, 230, 200];
  const kp0 = [0, 1, 2].map((i) => lerp(keyPosNight[i], keyPosDawn[i], dawn2)) as V3;
  const keyPos = [0, 1, 2].map((i) => lerp(kp0[i], keyPosTable[i], table2)) as V3;

  return {
    hemi: lerp(0.04, 0.55, night) + dawn * 0.5 + table * 0.55,
    hemiSky: table > 0 ? mixHex('#7d86b8', '#ffe2c0', table) : mixHex('#7d86b8', '#ffd8c0', dawn),
    hemiGround: mixHex('#2a2238', '#6a4a36', Math.max(dawn * 0.6, table)),
    key: key + table * 1.6,
    keyColor: table > 0 ? mixHex(keyColor, '#ffe0b8', table) : keyColor,
    keyPos,
    keyTarget: [0, 12, -10],
    keyShadowHalf: [lerp(46, 150, table2), lerp(40, 110, table2)],
    keyShadowFar: lerp(360, 900, table2),
    keyShadowRadius: lerp(9, 5, table2),
    fill: 0.28 + table * 0.2,
    fillColor: '#ffcf9c',
    fillPos: [30, 18, 120],
    stage: track(f, [
      [lu0, 0],
      [lu1, 6.5],
      [co0, 6.5],
      [co1, 1.4],
      [1600, 1.4],
      [1700, 3.2],
    ]),
    stageColor: '#ffc88a',
    stageAngle: lerp(0.28, 0.36, table),
    stagePos: [0, 60, 110],
    stageTarget: [0, 17, 3],
    lamp: 26 * flick * lampOn,
    lampColor: '#ffae55',
    lampPos: [8.6, 11.3, -7.9],
    lampTarget: [11.8, 6.4, -6.8],
    laptop: 5.5 * (0.6 + 0.4 * lampOn),
    laptopPos: [12.2, 9.5, -5.2],
    bounce: 7 * flick * lampOn + 1.2,
    bouncePos: [14, 11, -3.5],
    moon: 60 * moonK,
    moonPos: [-14, 28, -27],
    street: 55 * night * (1 - dawn),
    streetPos: [-14.5, 10.5, -13.5],
    // groundrow light hidden behind the skyline: washes the dawn backcloth with warm light
    cyc: 95 * dawn,
    // spot-light shadows only where they read on screen (saves a lot of software-GL time)
    stageShadow: f < 204 || f >= 1636,
    lampShadow: f >= 372 && f < 1470,
    windowsLit: night * (1 - seg(f, BEATS.windowsDark[0], BEATS.windowsDark[1])),
    stars: night * (1 - dawn),
    skyFlash: lightning,
    exposure: 1,
    fade: clamp(f / 12),
  };
};
