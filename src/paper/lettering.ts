import ClipperLib from 'clipper-lib';
import { rng } from '../lib/random';
import { Pt, Ring } from './path';

// An original hand-drawn stroke alphabet (only the glyphs the film needs).
// Units: em. Baseline y = 0, x-height 0.5, cap height 0.72, descender -0.22.
// Used two ways: offset + unioned into cut-paper letter outlines (title banner),
// or stroked with ink onto a printed texture (the end tag, calendar pages).

type Glyph = { adv: number; strokes: Pt[][] };

const DOT = (x: number, y: number): Pt[] => [
  [x - 0.012, y - 0.01],
  [x + 0.012, y + 0.01],
];

export const GLYPHS: Record<string, Glyph> = {
  a: { adv: 0.55, strokes: [[[0.42, 0.36], [0.3, 0.48], [0.13, 0.45], [0.04, 0.27], [0.08, 0.07], [0.22, 0.0], [0.36, 0.07], [0.42, 0.2]], [[0.43, 0.49], [0.42, 0.18], [0.44, 0.03], [0.51, 0.0]]] },
  b: { adv: 0.53, strokes: [[[0.07, 0.75], [0.06, 0.0]], [[0.06, 0.27], [0.17, 0.45], [0.35, 0.47], [0.46, 0.29], [0.41, 0.07], [0.23, 0.0], [0.07, 0.05]]] },
  d: { adv: 0.55, strokes: [[[0.42, 0.3], [0.3, 0.47], [0.12, 0.45], [0.04, 0.25], [0.1, 0.05], [0.26, 0.0], [0.42, 0.1]], [[0.44, 0.75], [0.43, 0.06], [0.49, 0.0]]] },
  e: { adv: 0.5, strokes: [[[0.07, 0.25], [0.41, 0.27], [0.4, 0.42], [0.26, 0.5], [0.1, 0.44], [0.04, 0.24], [0.1, 0.06], [0.26, 0.0], [0.42, 0.08]]] },
  f: { adv: 0.36, strokes: [[[0.36, 0.7], [0.28, 0.75], [0.19, 0.7], [0.16, 0.52], [0.15, 0.0]], [[0.03, 0.46], [0.31, 0.47]]] },
  i: { adv: 0.24, strokes: [[[0.1, 0.49], [0.1, 0.02]], DOT(0.11, 0.66)] },
  l: { adv: 0.27, strokes: [[[0.1, 0.75], [0.09, 0.1], [0.15, 0.0], [0.22, 0.02]]] },
  m: { adv: 0.63, strokes: [[[0.05, 0.49], [0.05, 0.0]], [[0.05, 0.3], [0.12, 0.45], [0.22, 0.48], [0.28, 0.38], [0.29, 0.0]], [[0.29, 0.33], [0.36, 0.46], [0.46, 0.48], [0.52, 0.38], [0.53, 0.0]]] },
  n: { adv: 0.47, strokes: [[[0.05, 0.49], [0.05, 0.0]], [[0.05, 0.3], [0.14, 0.46], [0.28, 0.48], [0.36, 0.38], [0.37, 0.0]]] },
  o: { adv: 0.51, strokes: [[[0.26, 0.49], [0.1, 0.43], [0.03, 0.24], [0.1, 0.05], [0.25, 0.0], [0.4, 0.06], [0.46, 0.26], [0.38, 0.44], [0.24, 0.49], [0.18, 0.46]]] },
  p: { adv: 0.52, strokes: [[[0.06, 0.49], [0.06, -0.22]], [[0.06, 0.3], [0.18, 0.47], [0.36, 0.46], [0.45, 0.27], [0.38, 0.06], [0.2, 0.0], [0.06, 0.08]]] },
  r: { adv: 0.39, strokes: [[[0.06, 0.49], [0.06, 0.0]], [[0.06, 0.28], [0.14, 0.43], [0.26, 0.49], [0.36, 0.46]]] },
  s: { adv: 0.44, strokes: [[[0.37, 0.42], [0.26, 0.49], [0.12, 0.46], [0.07, 0.36], [0.14, 0.27], [0.3, 0.22], [0.38, 0.12], [0.32, 0.02], [0.16, 0.0], [0.05, 0.07]]] },
  t: { adv: 0.36, strokes: [[[0.16, 0.66], [0.16, 0.08], [0.22, 0.0], [0.32, 0.03]], [[0.04, 0.46], [0.32, 0.47]]] },
  u: { adv: 0.5, strokes: [[[0.05, 0.49], [0.05, 0.14], [0.12, 0.02], [0.24, 0.0], [0.36, 0.08], [0.4, 0.22]], [[0.4, 0.49], [0.41, 0.05], [0.46, 0.0]]] },
  w: { adv: 0.58, strokes: [[[0.03, 0.49], [0.14, 0.0], [0.28, 0.37], [0.42, 0.0], [0.54, 0.49]]] },
  y: { adv: 0.48, strokes: [[[0.04, 0.49], [0.1, 0.18], [0.22, 0.02], [0.34, 0.1], [0.4, 0.49]], [[0.4, 0.49], [0.38, 0.0], [0.32, -0.16], [0.2, -0.22], [0.08, -0.17]]] },
  P: { adv: 0.56, strokes: [[[0.08, 0.72], [0.08, 0.0]], [[0.08, 0.72], [0.34, 0.72], [0.48, 0.62], [0.48, 0.46], [0.36, 0.36], [0.08, 0.36]]] },
  B: { adv: 0.58, strokes: [[[0.08, 0.72], [0.08, 0.0]], [[0.08, 0.72], [0.32, 0.72], [0.44, 0.64], [0.44, 0.5], [0.32, 0.4], [0.1, 0.4]], [[0.22, 0.4], [0.38, 0.4], [0.5, 0.3], [0.5, 0.12], [0.38, 0.02], [0.08, 0.0]]] },
  '0': { adv: 0.5, strokes: [[[0.25, 0.7], [0.1, 0.6], [0.04, 0.35], [0.1, 0.08], [0.25, 0.0], [0.4, 0.08], [0.46, 0.35], [0.4, 0.6], [0.25, 0.7], [0.2, 0.68]]] },
  '1': { adv: 0.36, strokes: [[[0.06, 0.56], [0.2, 0.7], [0.2, 0.0]]] },
  '2': { adv: 0.5, strokes: [[[0.06, 0.56], [0.16, 0.68], [0.32, 0.7], [0.44, 0.6], [0.42, 0.44], [0.06, 0.0], [0.46, 0.0]]] },
  '3': { adv: 0.5, strokes: [[[0.06, 0.62], [0.2, 0.7], [0.38, 0.66], [0.42, 0.52], [0.3, 0.4], [0.2, 0.39]], [[0.3, 0.4], [0.44, 0.3], [0.44, 0.12], [0.3, 0.01], [0.14, 0.0], [0.04, 0.08]]] },
  '4': { adv: 0.52, strokes: [[[0.36, 0.0], [0.36, 0.7], [0.04, 0.2], [0.48, 0.2]]] },
  '5': { adv: 0.5, strokes: [[[0.42, 0.7], [0.12, 0.7], [0.08, 0.4], [0.26, 0.44], [0.42, 0.36], [0.46, 0.18], [0.36, 0.03], [0.2, 0.0], [0.05, 0.08]]] },
  '6': { adv: 0.5, strokes: [[[0.4, 0.66], [0.28, 0.7], [0.12, 0.62], [0.05, 0.36], [0.08, 0.1], [0.24, 0.0], [0.4, 0.06], [0.45, 0.22], [0.38, 0.38], [0.22, 0.42], [0.08, 0.32]]] },
  '7': { adv: 0.48, strokes: [[[0.04, 0.7], [0.46, 0.7], [0.2, 0.0]]] },
  '8': { adv: 0.5, strokes: [[[0.25, 0.4], [0.1, 0.5], [0.12, 0.66], [0.25, 0.7], [0.38, 0.66], [0.4, 0.5], [0.25, 0.4], [0.07, 0.28], [0.08, 0.07], [0.25, 0.0], [0.42, 0.07], [0.43, 0.28], [0.25, 0.4]]] },
  '9': { adv: 0.5, strokes: [[[0.42, 0.38], [0.28, 0.3], [0.12, 0.36], [0.06, 0.52], [0.14, 0.68], [0.3, 0.7], [0.42, 0.6], [0.44, 0.4], [0.4, 0.14], [0.28, 0.01], [0.12, 0.02]]] },
  '.': { adv: 0.2, strokes: [DOT(0.08, 0.03)] },
  ' ': { adv: 0.3, strokes: [] },
};

/** Centripetal-ish Catmull-Rom through the stroke points. */
const smooth = (pts: Pt[], sub = 6): Pt[] => {
  if (pts.length < 3) return pts;
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
};

export type LaidOut = { strokes: Pt[][]; width: number };

/**
 * Lay text out in cm: baseline at y = 0, starting at x = 0. `jitter` (em) nudges
 * each point so no two letters are identical — hand lettering, not a font.
 */
export const layoutText = (text: string, size: number, seed: string, jitter = 0.012, tracking = 0.02, slant = 0.05): LaidOut => {
  const r = rng(seed);
  const strokes: Pt[][] = [];
  let x = 0;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    const baseShift = (r.next() - 0.5) * jitter * 1.5;
    const rot = (r.next() - 0.5) * 0.06;
    for (const s of g.strokes) {
      const pts: Pt[] = s.map(([gx, gy]) => {
        const jx = (r.next() - 0.5) * jitter;
        const jy = (r.next() - 0.5) * jitter;
        const cx = gx - g.adv / 2;
        const rx = cx * Math.cos(rot) - gy * Math.sin(rot) + g.adv / 2;
        const ry = cx * Math.sin(rot) + gy * Math.cos(rot);
        return [(x + rx + jx + ry * slant) * size, (ry + jy + baseShift) * size];
      });
      strokes.push(smooth(pts));
    }
    x += g.adv + tracking;
  }
  return { strokes, width: (x - tracking) * size };
};

const SCALE = 1000;

/** Stroke outlines → unioned polygons (outer rings and holes), in cm. */
export const strokeRings = (strokes: Pt[][], weight: number): Ring[] => {
  const co = new ClipperLib.ClipperOffset(2, 0.25 * SCALE * 0.01);
  for (const s of strokes) {
    const path = s.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
    co.AddPath(path, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etOpenRound);
  }
  const solution: { X: number; Y: number }[][] = [];
  co.Execute(solution, (weight / 2) * SCALE);
  return solution.map((p) => p.map((q) => [q.X / SCALE, q.Y / SCALE] as Pt));
};

/** Offset closed rings (positive = grow). Used for borders around openings. */
export const offsetRings = (rings: Ring[], delta: number): Ring[] => {
  const co = new ClipperLib.ClipperOffset(2, 0.02 * SCALE);
  for (const r of rings) {
    co.AddPath(
      r.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) })),
      ClipperLib.JoinType.jtRound,
      ClipperLib.EndType.etClosedPolygon,
    );
  }
  const solution: { X: number; Y: number }[][] = [];
  co.Execute(solution, delta * SCALE);
  return solution.map((p) => p.map((q) => [q.X / SCALE, q.Y / SCALE] as Pt));
};

/** Draw laid-out strokes with an ink pen on a 2D canvas (px = cm * scale, y flipped). */
export const inkStrokes = (
  ctx: CanvasRenderingContext2D,
  strokes: Pt[][],
  ox: number,
  oy: number,
  pxPerCm: number,
  widthCm: number,
  color: string,
  seed: string,
) => {
  const r = rng(seed);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    // vary pressure along the stroke by drawing it in short overlapping pieces
    for (let i = 0; i < s.length - 1; i++) {
      const t = i / Math.max(1, s.length - 2);
      const pressure = 0.75 + 0.35 * Math.sin(t * Math.PI) + (r.next() - 0.5) * 0.08;
      ctx.lineWidth = Math.max(0.6, widthCm * pxPerCm * pressure);
      ctx.beginPath();
      ctx.moveTo(ox + s[i][0] * pxPerCm, oy - s[i][1] * pxPerCm);
      ctx.lineTo(ox + s[i + 1][0] * pxPerCm, oy - s[i + 1][1] * pxPerCm);
      ctx.stroke();
    }
  }
};
