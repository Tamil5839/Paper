import React, { useMemo } from 'react';
import { rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper } from '../paper/materials';
import { circleD, polyD, Pt, rectD } from '../paper/path';
import { blob } from '../paper/shapes';
import { LitPanes, Pane } from './lit';
import { Wire } from './Stick';

// Middle distance: flat rooftops with parapets and water tanks, a clothesline,
// coconut palms and a gulmohar tree with muted blossom.

export const ROOFS_Z = -21.8;
export const TREES_Z = -19.6;

/** Coconut palm: curved tapering trunk, drooping serrated fronds, a few nuts. */
export const palmShapes = (x: number, h: number, lean: number, seed: string) => {
  const r = rng(seed);
  const trunkL: Pt[] = [];
  const trunkR: Pt[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const cx = x + lean * t * t;
    const cy = -1 + (h + 1) * t;
    const w = 0.42 + (1 - t) * 0.36;
    const dx = 2 * lean * t;
    const len = Math.hypot(dx, h + 1);
    const nx = (h + 1) / len;
    const ny = -dx / len;
    trunkL.push([cx - nx * w * 0.5, cy - ny * w * 0.5]);
    trunkR.push([cx + nx * w * 0.5, cy + ny * w * 0.5]);
  }
  const trunk = polyD([...trunkR, ...trunkL.reverse()]);
  const crown: Pt = [x + lean, h];
  const fronds: string[] = [];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const a0 = (-0.22 + (i / (count - 1)) * 1.44) * Math.PI + r.range(-0.07, 0.07);
    const L = r.range(5.4, 7.6);
    const right = Math.cos(a0) >= 0 ? 1 : -1;
    const droop = r.range(0.9, 1.4);
    const N = 36;
    const spine: Pt[] = [crown];
    for (let k = 1; k <= N; k++) {
      const t = k / N;
      const ang = a0 - right * droop * t * t;
      const prev = spine[k - 1];
      spine.push([prev[0] + Math.cos(ang) * (L / N), prev[1] + Math.sin(ang) * (L / N)]);
    }
    // leaflets: long thin teeth angled toward the tip and hanging down
    const upper: Pt[] = [];
    const lower: Pt[] = [];
    for (let k = 0; k <= N; k++) {
      const t = k / N;
      const p = spine[k];
      const q = spine[Math.min(N, k + 1)];
      const o = spine[Math.max(0, k - 1)];
      let tx = q[0] - o[0];
      let ty = q[1] - o[1];
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const len = 1.35 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.08 + t * 0.95)), 0.55) * (1 - t * 0.25);
      const base = 0.05;
      if (k % 2 === 0 && k > 0 && k < N) {
        // tips: along the normal, swept toward the frond tip, pulled down by gravity
        const ux = -ty * 0.72 + tx * 0.62;
        const uy = tx * 0.72 + ty * 0.62 - 0.35;
        const dx = ty * 0.72 + tx * 0.62;
        const dy = -tx * 0.72 + ty * 0.62 - 0.35;
        upper.push([p[0] + ux * len, p[1] + uy * len]);
        lower.push([p[0] + dx * len * 0.95, p[1] + dy * len * 0.95]);
      } else {
        upper.push([p[0] - ty * base, p[1] + tx * base]);
        lower.push([p[0] + ty * base, p[1] - tx * base]);
      }
    }
    fronds.push(polyD([...upper, ...lower.reverse()]));
  }
  const nuts = [circleD(crown[0] - 0.35, crown[1] - 0.45, 0.36), circleD(crown[0] + 0.3, crown[1] - 0.55, 0.34), circleD(crown[0] - 0.02, crown[1] - 0.85, 0.32)];
  return { trunk, fronds, nuts };
};

const gulmohar = (x: number, seed: string) => {
  const r = rng(seed);
  const trunk = polyD([[x - 0.7, -1], [x + 0.7, -1], [x + 0.5, 5], [x + 3.2, 8.6], [x + 2.8, 9.0], [x + 0.3, 6.4], [x + 0.15, 8.8], [x - 0.35, 8.8], [x - 0.45, 6.2], [x - 3.4, 8.4], [x - 3.7, 8.0], [x - 0.55, 5.0]]);
  const canopyPts = blob(x, 7.6, 16, 5.6, 7, seed + '-canopy', false);
  const canopy = polyD(canopyPts);
  const flowers: string[] = [];
  for (let i = 0; i < 34; i++) {
    const a = r.range(0.1, 0.9) * Math.PI;
    const rad = r.range(0.45, 0.97);
    const fx = x + Math.cos(a) * 7.8 * rad;
    const fy = 7.9 + Math.sin(a) * 5.3 * rad;
    flowers.push(polyD(blob(fx, fy - 0.15, r.range(0.5, 1.0), r.range(0.22, 0.4), 3, `${seed}-f${i}`, false)));
  }
  return { trunk, canopy, flowers };
};

type Roof = { x0: number; x1: number; h: number; tank?: number; stair?: boolean; parapet?: boolean; antenna?: number };
const ROOFS: Roof[] = [
  { x0: -39, x1: -32, h: 9.5, tank: 0.3, parapet: true },
  { x0: -32, x1: -26, h: 7.5, stair: true },
  { x0: -26, x1: -19, h: 10.8, parapet: true, antenna: 0.7 },
  { x0: -19, x1: -13, h: 8.2, tank: 0.6 },
  { x0: -13, x1: -6, h: 9.2, parapet: true, stair: true },
  { x0: -6, x1: 0, h: 7.2, tank: 0.4 },
  { x0: 0, x1: 5, h: 8.8, parapet: true },
  { x0: 5, x1: 10, h: 7.6, tank: 0.5 },
  { x0: 10, x1: 16, h: 9.0, parapet: true },
  { x0: 16, x1: 23, h: 10.5, tank: 0.35, antenna: 0.8 },
  { x0: 23, x1: 30, h: 8.4, parapet: true },
  { x0: 30, x1: 39, h: 9.8, tank: 0.6 },
];

const roofsOutline = () => {
  const pts: Pt[] = [[ROOFS[0].x0, -1]];
  const extra: string[] = [];
  for (const b of ROOFS) {
    const w = b.x1 - b.x0;
    pts.push([b.x0, b.h]);
    if (b.parapet) {
      for (let x = b.x0 + 0.5; x < b.x1 - 0.6; x += 1.1) pts.push([x, b.h], [x, b.h + 0.45], [x + 0.55, b.h + 0.45], [x + 0.55, b.h]);
    }
    if (b.stair) {
      const sx = b.x0 + w * 0.6;
      pts.push([sx, b.h], [sx, b.h + 2.2], [sx + 2.2, b.h + 2.2], [sx + 2.2, b.h]);
    }
    if (b.tank !== undefined) {
      const tx = b.x0 + w * b.tank;
      // stand legs + cylindrical tank with a lid
      extra.push(polyD([[tx - 0.9, b.h - 0.1], [tx - 0.75, b.h - 0.1], [tx - 0.75, b.h + 0.8], [tx + 0.75, b.h + 0.8], [tx + 0.75, b.h - 0.1], [tx + 0.9, b.h - 0.1], [tx + 0.9, b.h + 0.95], [tx + 0.95, b.h + 0.95], [tx + 0.95, b.h + 2.6], [tx + 0.5, b.h + 2.75], [tx + 0.35, b.h + 2.95], [tx - 0.35, b.h + 2.95], [tx - 0.5, b.h + 2.75], [tx - 0.95, b.h + 2.6], [tx - 0.95, b.h + 0.95], [tx - 0.9, b.h + 0.95]]));
    }
    if (b.antenna !== undefined) {
      const ax = b.x0 + w * b.antenna;
      extra.push(rectD(ax - 0.05, b.h - 0.2, 0.1, 3.4), rectD(ax - 0.8, b.h + 2.6, 1.6, 0.08), rectD(ax - 0.55, b.h + 2.1, 1.1, 0.08), rectD(ax - 0.35, b.h + 1.6, 0.7, 0.08));
    }
    pts.push([b.x1, b.h]);
  }
  pts.push([ROOFS[ROOFS.length - 1].x1, -1]);
  return { outline: polyD(pts), extra };
};

export const MidLayer: React.FC<{ frame: number; windowsLit: number; offProgress: number }> = ({ frame, windowsLit, offProgress }) => {
  const g = useMemo(() => {
    const r = rng('roof-win');
    const panes: Pane[] = [];
    for (const b of ROOFS) {
      for (let x = b.x0 + 0.8; x < b.x1 - 1; x += 1.7) {
        for (let y = 1.6; y < b.h - 1.5; y += 2.4) if (r.next() < 0.28) panes.push({ x, y, w: 0.7, h: 0.9 });
      }
    }
    const { outline, extra } = roofsOutline();
    const roofs = cutout([outline, ...panes.map((p) => rectD(p.x, p.y, p.w, p.h))], { seed: 'roofs', wobble: 0.04 });
    const tanks = cutout(extra, { seed: 'tanks', wobble: 0.02 });
    const palms = [palmShapes(-31, 20.5, 1.6, 'palm-a'), palmShapes(-3.5, 17.5, -1.2, 'palm-b'), palmShapes(17.2, 21.5, 1.0, 'palm-c'), palmShapes(29, 16.5, -1.8, 'palm-d')];
    const trunks = cutout(palms.map((p) => p.trunk), { seed: 'trunks', wobble: 0.02 });
    const frondsA = cutout(palms.flatMap((p) => p.fronds.filter((_, i) => i % 2 === 0)), { seed: 'fronds-a', wobble: 0.02 });
    const frondsB = cutout(palms.flatMap((p) => p.fronds.filter((_, i) => i % 2 === 1)), { seed: 'fronds-b', wobble: 0.02 });
    const nuts = cutout(palms.flatMap((p) => p.nuts), { seed: 'nuts', wobble: 0.01 });
    const gm = gulmohar(-17.5, 'gulmohar');
    const gTrunk = cutout(gm.trunk, { seed: 'gm-trunk', wobble: 0.03 });
    const gCanopy = cutout(gm.canopy, { seed: 'gm-canopy', wobble: 0.05 });
    const gFlowers = cutout(gm.flowers, { seed: 'gm-flowers', wobble: 0.02 });
    // a rooftop clothesline
    const clothes = cutout([rectD(-27.4, 9.6, 1.1, 1.4), rectD(-25.9, 9.9, 0.9, 1.1), rectD(-24.6, 9.4, 1.3, 1.6)], { seed: 'clothes', wobble: 0.03 });
    return { roofs, tanks, panes, trunks, frondsA, frondsB, nuts, gTrunk, gCanopy, gFlowers, clothes };
  }, []);
  void frame;
  return (
    <group>
      <group position={[0, 0, ROOFS_Z]}>
        <mesh geometry={g.roofs} material={paper('#29435f')} castShadow receiveShadow />
        <mesh geometry={g.tanks} material={paper('#1d2839')} position={[0, 0, 0.12]} castShadow receiveShadow />
        <mesh geometry={g.clothes} material={paper('#6a6f86')} position={[0, 0, 0.3]} castShadow receiveShadow />
        <mesh position={[-25.3, 11.05, 0.3]} rotation={[0, 0, Math.PI / 2 + 0.03]} castShadow>
          <cylinderGeometry args={[0.015, 0.015, 5.2, 4]} />
          <meshLambertMaterial color="#2b2d3a" />
        </mesh>
      </group>
      <LitPanes panes={g.panes} z={ROOFS_Z - 0.35} seed="roofs" intensity={1.25 * windowsLit} offProgress={offProgress} glow="#ffbe6a" />
      <group position={[0, 0, TREES_Z]}>
        <mesh geometry={g.trunks} material={paper('#3d4a4a')} castShadow receiveShadow />
        <mesh geometry={g.frondsB} material={paper('#22524a')} position={[0, 0, -0.18]} castShadow receiveShadow />
        <mesh geometry={g.frondsA} material={paper('#2f6a5c')} position={[0, 0, 0.1]} castShadow receiveShadow />
        <mesh geometry={g.nuts} material={paper('#3b3a2c')} position={[0, 0, 0.2]} castShadow />
      </group>
      <group position={[0, 0, TREES_Z + 0.9]}>
        <mesh geometry={g.gTrunk} material={paper('#383a40')} castShadow receiveShadow />
        <mesh geometry={g.gCanopy} material={paper('#244c43')} position={[0, 0, 0.15]} castShadow receiveShadow />
        <mesh geometry={g.gFlowers} material={paper('#5d4b50')} position={[0, 0, 0.32]} castShadow receiveShadow />
      </group>
    </group>
  );
};

export const _w = Wire;
