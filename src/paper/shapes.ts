import { rng } from '../lib/random';
import { polyD, Pt, Ring } from './path';

// Generators for recurring cut-paper motifs. They all return point rings or
// SVG path data so pieces stay "authored as paths".

const TAU = Math.PI * 2;

/** Cusped (multifoil) arch: points from the right springing point over the top to the left one. */
export const multifoilArch = (halfW: number, ySpring: number, yTop: number, lobes: number, cusp: number, per = 12): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < lobes; i++) {
    for (let k = 0; k <= per; k++) {
      if (i > 0 && k === 0) continue;
      const u = k / per;
      const t = ((i + u) / lobes) * Math.PI;
      const bx = halfW * Math.cos(t);
      const by = ySpring + (yTop - ySpring) * Math.sin(t);
      const bulge = Math.sin(u * Math.PI) * cusp;
      pts.push([bx + Math.cos(t) * bulge, by + Math.sin(t) * bulge * 1.1]);
    }
  }
  return pts;
};

/** Upper half-ellipse with outward scallops, from (cx+rx, yb) to (cx-rx, yb). */
export const scallopedDome = (cx: number, yb: number, rx: number, ry: number, n: number, depth: number, per = 10): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    for (let k = 0; k <= per; k++) {
      if (i > 0 && k === 0) continue;
      const u = k / per;
      const t = ((i + u) / n) * Math.PI;
      const bump = Math.sin(u * Math.PI) * depth;
      const x = cx + (rx + bump) * Math.cos(t);
      const y = yb + (ry + bump) * Math.sin(t);
      pts.push([x, y]);
    }
  }
  return pts;
};

/** A bumpy blob (bush / cloud): bumps along the top, flat-ish bottom. */
export const blob = (cx: number, yb: number, w: number, h: number, bumps: number, seed: string, flatBottom = true): Pt[] => {
  const r = rng(seed);
  const pts: Pt[] = [];
  const n = bumps * 10;
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI; // right -> over top -> left
    const bi = Math.floor((i / n) * bumps);
    const u = ((i / n) * bumps) % 1;
    const amp = 0.08 + 0.1 * ((bi * 0.618) % 1);
    const bump = Math.sin(u * Math.PI) * amp;
    const jitter = (r.next() - 0.5) * 0.01;
    const rx = (w / 2) * (1 + bump + jitter);
    const ry = h * (1 + bump * 1.4 + jitter);
    pts.push([cx + Math.cos(t) * rx, yb + Math.sin(t) * ry]);
  }
  if (!flatBottom) {
    for (let i = 1; i < 12; i++) {
      const t = Math.PI + (i / 12) * Math.PI;
      pts.push([cx + Math.cos(t) * (w / 2), yb + Math.sin(t) * h * 0.18]);
    }
  }
  return pts;
};

/** Circle ring (for holes / discs) */
export const circlePts = (cx: number, cy: number, r: number, n = 24): Pt[] =>
  Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r] as Pt);

export const ellipsePts = (cx: number, cy: number, rx: number, ry: number, n = 32, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    const x = Math.cos(t) * rx;
    const y = Math.sin(t) * ry;
    return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as Pt;
  });

/** Evenly spaced points along a closed ring (by arc length). */
export const pointsAlong = (ring: Ring, spacing: number, closed = true): Pt[] => {
  const out: Pt[] = [];
  let carry = 0;
  const n = closed ? ring.length : ring.length - 1;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = carry;
    while (d < L) {
      const t = d / L;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += spacing;
    }
    carry = d - L;
  }
  return out;
};

export const diamondD = (cx: number, cy: number, w: number, h: number) =>
  polyD([
    [cx, cy - h / 2],
    [cx + w / 2, cy],
    [cx, cy + h / 2],
    [cx - w / 2, cy],
  ]);

export const mirrorX = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [-x, y] as Pt).reverse();

/** Rounded-top panel (like a pilaster niche) */
export const archedPanel = (x0: number, x1: number, y0: number, y1: number, per = 16): Pt[] => {
  const r = (x1 - x0) / 2;
  const cx = (x0 + x1) / 2;
  const pts: Pt[] = [
    [x0, y0],
    [x1, y0],
    [x1, y1 - r],
  ];
  for (let i = 1; i < per; i++) {
    const t = (i / per) * Math.PI;
    pts.push([cx + Math.cos(t) * r, y1 - r + Math.sin(t) * r]);
  }
  pts.push([x0, y1 - r]);
  return pts;
};

/** Origami-bird silhouette (for the crest emblem): body, raised wing, neck and tail. */
export const birdEmblem = (cx: number, cy: number, s: number): string[] => {
  const P = (pts: Pt[]) => polyD(pts.map(([x, y]) => [cx + x * s, cy + y * s] as Pt));
  return [
    P([[-1.0, 0.05], [0.9, 0.0], [0.15, -0.42]]), // body
    P([[-0.25, 0.08], [0.35, 0.02], [-0.15, 1.1]]), // wing up
    P([[0.55, 0.02], [0.95, 0.1], [1.25, 0.72], [1.45, 0.6], [1.2, 0.55]]), // neck + head
    P([[-0.6, 0.03], [-1.35, 0.62], [-0.95, 0.02]]), // tail
  ];
};
