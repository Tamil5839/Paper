// A small SVG path-data parser. Every cut-out in the film is authored as an SVG
// `d` string (or generated as one) and flattened here into closed rings.
// Coordinates are centimetres at miniature scale, y pointing UP.

export type Pt = [number, number];
export type Ring = Pt[];

const TOKEN = /[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

const cubicPts = (p0: Pt, p1: Pt, p2: Pt, p3: Pt, step: number): Pt[] => {
  const len = dist(p0, p1) + dist(p1, p2) + dist(p2, p3);
  const n = Math.max(3, Math.min(96, Math.ceil(len / step)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
};

const quadPts = (p0: Pt, p1: Pt, p2: Pt, step: number): Pt[] => {
  const len = dist(p0, p1) + dist(p1, p2);
  const n = Math.max(3, Math.min(96, Math.ceil(len / step)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
};

// SVG arc (endpoint parameterisation) flattened to points
const arcPts = (p0: Pt, rx: number, ry: number, phiDeg: number, large: number, sweep: number, p1: Pt, step: number): Pt[] => {
  if (rx === 0 || ry === 0) return [p1];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2;
  const cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= Math.PI * 2;
  if (sweep && dt < 0) dt += Math.PI * 2;
  const n = Math.max(4, Math.min(128, Math.ceil((Math.abs(dt) * Math.max(rx, ry)) / step)));
  const out: Pt[] = [];
  for (let i = 1; i <= n; i++) {
    const t = t1 + (dt * i) / n;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    out.push([cos * x - sin * y + cx, sin * x + cos * y + cy]);
  }
  return out;
};

/** Parse SVG path data into closed rings (one per subpath). */
export const parsePath = (d: string, step = 0.25): Ring[] => {
  const toks = d.match(TOKEN) ?? [];
  const rings: Ring[] = [];
  let cur: Ring = [];
  let i = 0;
  let cmd = '';
  let pos: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastCtrl: Pt | null = null;
  let lastCmd = '';
  const num = () => parseFloat(toks[i++]);
  const isCmd = (t: string | undefined) => t !== undefined && /[A-Za-z]/.test(t);
  const flush = () => {
    if (cur.length > 2) {
      const a = cur[0];
      const b = cur[cur.length - 1];
      if (Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6) cur.pop();
      rings.push(cur);
    }
    cur = [];
  };
  while (i < toks.length) {
    if (isCmd(toks[i])) cmd = toks[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? pos[0] : 0;
    const oy = rel ? pos[1] : 0;
    switch (C) {
      case 'M': {
        flush();
        pos = [ox + num(), oy + num()];
        start = pos;
        cur.push(pos);
        cmd = rel ? 'l' : 'L';
        lastCtrl = null;
        break;
      }
      case 'L': {
        pos = [ox + num(), oy + num()];
        cur.push(pos);
        lastCtrl = null;
        break;
      }
      case 'H': {
        pos = [(rel ? pos[0] : 0) + num(), pos[1]];
        cur.push(pos);
        lastCtrl = null;
        break;
      }
      case 'V': {
        pos = [pos[0], (rel ? pos[1] : 0) + num()];
        cur.push(pos);
        lastCtrl = null;
        break;
      }
      case 'C': {
        const p1: Pt = [ox + num(), oy + num()];
        const p2: Pt = [ox + num(), oy + num()];
        const p3: Pt = [ox + num(), oy + num()];
        cur.push(...cubicPts(pos, p1, p2, p3, step));
        lastCtrl = p2;
        pos = p3;
        break;
      }
      case 'S': {
        const p1: Pt = lastCtrl && /[CS]/i.test(lastCmd) ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
        const p2: Pt = [ox + num(), oy + num()];
        const p3: Pt = [ox + num(), oy + num()];
        cur.push(...cubicPts(pos, p1, p2, p3, step));
        lastCtrl = p2;
        pos = p3;
        break;
      }
      case 'Q': {
        const p1: Pt = [ox + num(), oy + num()];
        const p2: Pt = [ox + num(), oy + num()];
        cur.push(...quadPts(pos, p1, p2, step));
        lastCtrl = p1;
        pos = p2;
        break;
      }
      case 'T': {
        const p1: Pt = lastCtrl && /[QT]/i.test(lastCmd) ? [2 * pos[0] - lastCtrl[0], 2 * pos[1] - lastCtrl[1]] : pos;
        const p2: Pt = [ox + num(), oy + num()];
        cur.push(...quadPts(pos, p1, p2, step));
        lastCtrl = p1;
        pos = p2;
        break;
      }
      case 'A': {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num();
        const sweep = num();
        const p1: Pt = [ox + num(), oy + num()];
        cur.push(...arcPts(pos, rx, ry, rot, large, sweep, p1, step));
        pos = p1;
        lastCtrl = null;
        break;
      }
      case 'Z': {
        pos = start;
        flush();
        lastCtrl = null;
        break;
      }
      default:
        i++;
    }
    lastCmd = C;
  }
  flush();
  return rings;
};

export const ringArea = (r: Ring) => {
  let a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return a / 2;
};

export const pointInRing = (p: Pt, r: Ring) => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const xi = r[i][0];
    const yi = r[i][1];
    const xj = r[j][0];
    const yj = r[j][1];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export type ShapeRings = { outer: Ring; holes: Ring[] };

/** Group rings into outer shapes with holes (even-odd nesting). */
export const nestRings = (rings: Ring[]): ShapeRings[] => {
  const items = rings
    .filter((r) => r.length >= 3)
    .map((r) => ({ r, area: Math.abs(ringArea(r)), parent: -1, depth: 0 }))
    .sort((a, b) => b.area - a.area);
  for (let i = 0; i < items.length; i++) {
    const probe = items[i].r[0];
    // smallest bigger ring containing this one
    for (let j = i - 1; j >= 0; j--) {
      if (pointInRing(probe, items[j].r)) {
        items[i].parent = j;
        items[i].depth = items[j].depth + 1;
        break;
      }
    }
  }
  const shapes: ShapeRings[] = [];
  const index = new Map<number, ShapeRings>();
  items.forEach((it, i) => {
    if (it.depth % 2 === 0) {
      const s = { outer: it.r, holes: [] as Ring[] };
      shapes.push(s);
      index.set(i, s);
    }
  });
  items.forEach((it) => {
    if (it.depth % 2 === 1) index.get(it.parent)?.holes.push(it.r);
  });
  return shapes;
};

// ---------- tiny helpers that emit path data (so generated shapes stay "authored as SVG paths") ----------

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export const polyD = (pts: Pt[]) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')} Z`;

export const rectD = (x: number, y: number, w: number, h: number) => polyD([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);

export const circleD = (cx: number, cy: number, r: number) =>
  `M${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 1 ${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 1 ${f(cx + r)} ${f(cy)} Z`;

export const ellipseD = (cx: number, cy: number, rx: number, ry: number) =>
  `M${f(cx + rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)} A${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)} Z`;

/** Rounded rectangle */
export const roundRectD = (x: number, y: number, w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M${f(x + r)} ${f(y)} H${f(x + w - r)} Q${f(x + w)} ${f(y)} ${f(x + w)} ${f(y + r)} V${f(y + h - r)} Q${f(x + w)} ${f(y + h)} ${f(x + w - r)} ${f(y + h)} H${f(x + r)} Q${f(x)} ${f(y + h)} ${f(x)} ${f(y + h - r)} V${f(y + r)} Q${f(x)} ${f(y)} ${f(x + r)} ${f(y)} Z`;
};

/** n-pointed star */
export const starD = (cx: number, cy: number, r1: number, r2: number, n: number, rot = 0) => {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i * Math.PI) / n + Math.PI / 2;
    const r = i % 2 === 0 ? r1 : r2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return polyD(pts);
};

/** A row of scallops (semi-circular bumps) along the bottom of a band, as a closed shape. */
export const scallopBandD = (x0: number, x1: number, yTop: number, yBase: number, count: number, depth: number, pointsDown = true) => {
  const w = (x1 - x0) / count;
  let d = `M${f(x0)} ${f(yTop)} L${f(x1)} ${f(yTop)} L${f(x1)} ${f(yBase)}`;
  for (let i = count - 1; i >= 0; i--) {
    const xa = x0 + (i + 1) * w;
    const xb = x0 + i * w;
    const cy = pointsDown ? yBase - depth * 1.33 : yBase + depth * 1.33;
    d += ` C${f(xa)} ${f(cy)} ${f(xb)} ${f(cy)} ${f(xb)} ${f(yBase)}`;
  }
  return `${d} Z`;
};
