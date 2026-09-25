import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { ease, handWobble, lerp, onTwos, seg } from '../lib/anim';
import { hash1, rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper, vellum } from '../paper/materials';
import { polyD, Pt, rectD } from '../paper/path';
import { LitPanes, Pane } from './lit';
import { Stick } from './Stick';

// Distant Bangalore: apartment towers with pinhole windows, a temple gopuram,
// a hazier far row, and the metro line on pillars with a paper-strip train.

export const SKYLINE_Z = -27;
export const FAR_Z = -29;
export const METRO_Z = -24.3;

type Bldg = { x0: number; x1: number; h: number; top?: 'flat' | 'step' | 'tank' | 'mast' | 'crown'; windows?: boolean };

const NEAR: Bldg[] = [
  { x0: -39, x1: -31, h: 17, top: 'tank', windows: true },
  { x0: -31, x1: -27.5, h: 11 },
  { x0: -27.5, x1: -22, h: 21, top: 'step', windows: true },
  { x0: -22, x1: -18.5, h: 12.5 },
  { x0: -18.5, x1: -8.6, h: 4.5 },
  { x0: -8.6, x1: -5, h: 12 },
  { x0: -5, x1: 1, h: 19, top: 'mast', windows: true },
  { x0: 1, x1: 5, h: 14 },
  { x0: 5, x1: 8.5, h: 12.2, windows: true },
  { x0: 8.5, x1: 11.5, h: 10.4 },
  { x0: 11.5, x1: 15, h: 12.8, windows: true },
  { x0: 15, x1: 21, h: 20, top: 'step', windows: true },
  { x0: 21, x1: 26, h: 13 },
  { x0: 26, x1: 32, h: 18, top: 'tank', windows: true },
  { x0: 32, x1: 39, h: 12.5, windows: true },
];

const outlineFor = (bs: Bldg[], extra: Pt[][] = []): Pt[] => {
  const pts: Pt[] = [[bs[0].x0, -1]];
  for (const b of bs) {
    pts.push([b.x0, b.h]);
    const w = b.x1 - b.x0;
    if (b.top === 'step') {
      pts.push([b.x0 + w * 0.2, b.h], [b.x0 + w * 0.2, b.h + 1.6], [b.x1 - w * 0.25, b.h + 1.6], [b.x1 - w * 0.25, b.h]);
    } else if (b.top === 'tank') {
      pts.push([b.x0 + w * 0.3, b.h], [b.x0 + w * 0.3, b.h + 0.9], [b.x0 + w * 0.32, b.h + 0.9], [b.x0 + w * 0.32, b.h + 2.2], [b.x0 + w * 0.58, b.h + 2.4], [b.x0 + w * 0.6, b.h + 0.9], [b.x0 + w * 0.62, b.h + 0.9], [b.x0 + w * 0.62, b.h]);
    } else if (b.top === 'mast') {
      const c = (b.x0 + b.x1) / 2;
      pts.push([c - 0.9, b.h], [c - 0.9, b.h + 1.2], [c - 0.12, b.h + 1.2], [c - 0.08, b.h + 5.5], [c + 0.08, b.h + 5.5], [c + 0.12, b.h + 1.2], [c + 0.9, b.h + 1.2], [c + 0.9, b.h]);
    } else if (b.top === 'crown') {
      pts.push([b.x0 + 0.5, b.h], [b.x0 + 0.5, b.h + 1], [b.x0 + 1.4, b.h + 1], [b.x0 + 1.4, b.h + 2.1], [b.x1 - 1.4, b.h + 2.1], [b.x1 - 1.4, b.h + 1], [b.x1 - 0.5, b.h + 1], [b.x1 - 0.5, b.h]);
    }
    pts.push([b.x1, b.h]);
  }
  pts.push([bs[bs.length - 1].x1, -1]);
  void extra;
  return pts;
};

/** A stepped temple tower (gopuram): plinth, seven receding tiers with deep cornices, a barrel-vault crown with finials. */
const gopuramD = (cx: number, base: number): string[] => {
  const right: Pt[] = [];
  let y = base;
  right.push([cx + 4.7, y - 1], [cx + 4.7, y + 3.6], [cx + 5.1, y + 3.8], [cx + 5.1, y + 4.15], [cx + 4.2, y + 4.2]);
  y += 4.2;
  const tiers = 7;
  for (let t = 0; t < tiers; t++) {
    const hw = 4.0 - (t * (4.0 - 1.7)) / (tiers - 1);
    // wall of the tier, then a projecting cornice ledge
    right.push([cx + hw, y], [cx + hw - 0.05, y + 1.45], [cx + hw + 0.5, y + 1.6], [cx + hw + 0.5, y + 1.85], [cx + hw - 0.3, y + 1.95]);
    y += 1.95;
  }
  const vw = 2.1;
  right.push([cx + vw, y], [cx + vw, y + 0.35]);
  const arc: Pt[] = [];
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    arc.push([cx + Math.cos(a) * vw, y + 0.35 + Math.sin(a) * 1.25]);
  }
  const left = right.map(([x, yy]) => [2 * cx - x, yy] as Pt).reverse();
  const shapes = [polyD([...right, ...arc, ...left])];
  const topY = y + 0.35;
  for (const dx of [-1.4, -0.7, 0, 0.7, 1.4]) {
    const fy = topY + Math.sqrt(Math.max(0, 1 - (dx / vw) ** 2)) * 1.25 - 0.12;
    const h = dx === 0 ? 1.3 : 0.95;
    shapes.push(polyD([[cx + dx - 0.07, fy], [cx + dx + 0.07, fy], [cx + dx + 0.06, fy + h * 0.35], [cx + dx + 0.24, fy + h * 0.55], [cx + dx + 0.07, fy + h * 0.78], [cx + dx, fy + h], [cx + dx - 0.07, fy + h * 0.78], [cx + dx - 0.24, fy + h * 0.55], [cx + dx - 0.06, fy + h * 0.35]]));
  }
  return shapes;
};

const windowsFor = (bs: Bldg[], seed: string, density: number, ww = 0.34, wh = 0.46): Pane[] => {
  const r = rng(seed);
  const panes: Pane[] = [];
  for (const b of bs) {
    if (!b.windows) continue;
    const cols = Math.floor((b.x1 - b.x0 - 1.2) / 1.05);
    const rows = Math.floor((b.h - 2) / 1.25);
    const x0 = b.x0 + (b.x1 - b.x0 - cols * 1.05) / 2 + 0.35;
    for (let c = 0; c < cols; c++) {
      for (let rr = 0; rr < rows; rr++) {
        if (r.next() > density) continue;
        panes.push({ x: x0 + c * 1.05, y: 1.4 + rr * 1.25, w: ww, h: wh });
      }
    }
  }
  return panes;
};

const FAR: Bldg[] = [
  { x0: -39, x1: -34, h: 13, windows: true },
  { x0: -34, x1: -29, h: 16, top: 'step', windows: true },
  { x0: -29, x1: -24, h: 12 },
  { x0: -24, x1: -18, h: 18, top: 'mast', windows: true },
  { x0: -18, x1: -9, h: 10 },
  { x0: -9, x1: -3, h: 15, windows: true },
  { x0: -3, x1: 3, h: 21, top: 'crown', windows: true },
  { x0: 3, x1: 9, h: 11.2 },
  { x0: 9, x1: 16, h: 12.4, windows: true },
  { x0: 16, x1: 23, h: 22, top: 'step', windows: true },
  { x0: 23, x1: 30, h: 14, windows: true },
  { x0: 30, x1: 39, h: 17, top: 'mast', windows: true },
];

export const Skyline: React.FC<{ frame: number; windowsLit: number; offProgress: number }> = ({ frame, windowsLit, offProgress }) => {
  const g = useMemo(() => {
    const nearPanes = windowsFor(NEAR, 'near-win', 0.42);
    const nearHoles = nearPanes.map((p) => rectD(p.x, p.y, p.w, p.h));
    const near = cutout([polyD(outlineFor(NEAR)), ...nearHoles], { seed: 'skyline-near', wobble: 0.04, bend: (x) => -0.0008 * x * x });
    const gopNiches: Pane[] = [{ x: -14.15, y: 0.2, w: 1.1, h: 2.5 }];
    for (let t = 0; t < 7; t++) gopNiches.push({ x: -13.85, y: 4.6 + t * 1.95, w: 0.5, h: 0.75 });
    const gop = cutout([...gopuramD(-13.6, 0), ...gopNiches.map((p) => rectD(p.x, p.y, p.w, p.h))], { seed: 'gopuram', wobble: 0.03 });
    const gopDetail = cutout(
      Array.from({ length: 7 }, (_, t) => {
        const hw = 4.0 - (t * (4.0 - 1.7)) / 6;
        return rectD(-13.6 - hw - 0.4, 4.2 + t * 1.95 + 1.62, 2 * hw + 0.8, 0.12);
      }),
      { seed: 'gop-lines', wobble: 0.01 },
    );
    const farPanes = windowsFor(FAR, 'far-win', 0.25, 0.26, 0.34);
    const far = cutout([polyD(outlineFor(FAR)), ...farPanes.map((p) => rectD(p.x, p.y, p.w, p.h))], { seed: 'skyline-far', wobble: 0.04 });

    // metro: pillars with T caps, a deck with a parapet
    const deck: string[] = [rectD(-41, 12.2, 82, 1.25), rectD(-41, 13.45, 82, 0.5)];
    for (let x = -35; x <= 36; x += 11) {
      deck.push(polyD([[x - 0.65, -1], [x + 0.65, -1], [x + 0.65, 10.9], [x + 1.6, 11.6], [x + 1.6, 12.3], [x - 1.6, 12.3], [x - 1.6, 11.6], [x - 0.65, 10.9]]));
    }
    const viaduct = cutout(deck, { seed: 'viaduct', wobble: 0.03 });
    // the train: three coaches on one paper strip, windows cut through
    const coach: string[] = [];
    const winPanes: Pane[] = [];
    const L = 13.2;
    for (let c = 0; c < 3; c++) {
      const x0 = -19.8 + c * (L + 0.3);
      const nose = c === 0;
      coach.push(
        nose
          ? polyD([[x0 + 1.4, 0], [x0 + L, 0], [x0 + L, 2.3], [x0 + 1.9, 2.3], [x0 + 0.5, 1.6], [x0, 0.6]])
          : rectD(x0, 0, L, 2.3),
      );
      for (let w = 0; w < 7; w++) {
        const wx = x0 + 1.6 + w * 1.62 + (nose ? 0.4 : 0);
        if (wx + 0.9 > x0 + L - 0.4) continue;
        winPanes.push({ x: wx, y: 1.0, w: 0.95, h: 0.75 });
        coach.push(rectD(wx, 1.0, 0.95, 0.75));
      }
    }
    const train = cutout(coach, { seed: 'train', wobble: 0.02 });
    const stripe = cutout(rectD(-19.8, 0.55, 3 * L + 0.6, 0.28), { seed: 'train-stripe', wobble: 0.01 });
    return { near, gop, gopNiches, gopDetail, far, nearPanes, farPanes, viaduct, train, stripe, winPanes };
  }, []);

  const f = onTwos(frame);
  const [m0, m1] = BEATS.metro;
  const mt = seg(f, m0, m1, ease.inOutSine);
  const trainX = lerp(78, -66, mt) + handWobble(f, 'train', 0.1, 0.8);
  const trainY = 13.15 + (hash1(f >> 1, 7) - 0.5) * 0.05;
  const trainMats = useMemo(() => vellum('#fbe7c0', '#ffe2a8', 1.3), []);
  (trainMats[0] as THREE.MeshLambertMaterial).emissiveIntensity = 1.6 * windowsLit;
  return (
    <group>
      <group position={[0, 0, FAR_Z]}>
        <mesh geometry={g.far} material={paper('#3a4d80')} castShadow receiveShadow />
      </group>
      <LitPanes panes={g.farPanes} z={FAR_Z - 0.4} seed="far" intensity={0.9 * windowsLit} offProgress={offProgress} />
      <group position={[0, 0, SKYLINE_Z]}>
        <mesh geometry={g.near} material={paper('#2c3c6a')} castShadow receiveShadow />
        <mesh geometry={g.gop} material={paper('#5b5068')} position={[0, 0, 0.3]} castShadow receiveShadow />
        <mesh geometry={g.gopDetail} material={paper('#a08a62')} position={[0, 0, 0.38]} castShadow />
      </group>
      <LitPanes panes={g.nearPanes} z={SKYLINE_Z - 0.4} seed="near" intensity={1.5 * windowsLit} offProgress={offProgress} />
      <LitPanes panes={g.gopNiches} z={SKYLINE_Z + 0.2} seed="gop" groups={1} intensity={0.8 * windowsLit} glow="#ffb35e" />
      <mesh geometry={g.viaduct} material={paper('#4d5d84')} position={[0, 0, METRO_Z]} castShadow receiveShadow />
      {f >= m0 - 2 && f <= m1 + 2 ? (
      <group position={[trainX, trainY, METRO_Z - 0.55]}>
        <mesh geometry={g.train} material={paper('#7c95a0')} castShadow receiveShadow />
        <mesh geometry={g.stripe} material={paper('#3d5263')} position={[0, 0, 0.07]} castShadow />
        <mesh position={[0.3, 1.38, -0.3]} material={trainMats[0]}>
          <planeGeometry args={[40, 1.0]} />
        </mesh>
        <Stick at={[20.5, 1.2, 0]} from="right" length={70} seed="train-stick" />
      </group>
      ) : null}
    </group>
  );
};

