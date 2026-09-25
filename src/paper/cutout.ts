import * as THREE from 'three';
import { fbm2, hash1, toSeed } from '../lib/random';
import { nestRings, parsePath, Pt, Ring, ShapeRings } from './path';

// SVG path -> hand-cut ring (seeded wobble) -> ExtrudeGeometry (thin card, no bevel)
// -> optional gentle bend. Output groups: 0 = printed face, 1 = cut edge, 2 = card back.

/** Thickness of card at miniature scale: 0.6 mm, with 1 unit = 1 cm. */
export const CARD = 0.06;

export type CutoutOpts = {
  seed?: string | number;
  thickness?: number;
  /** amplitude of the hand-cut edge wander, cm */
  wobble?: number;
  /** typical wavelength of the wander, cm */
  wavelength?: number;
  /** resampling spacing along edges, cm */
  step?: number;
  /** bezier flattening step, cm */
  curveStep?: number;
  /** z displacement of the card as a function of (x, y) — a gentle bend */
  bend?: (x: number, y: number) => number;
  /** midpoint-subdivision passes for the faces (needed for smooth bends) */
  subdivide?: number;
  /** per-vertex colour (linear RGB) — used for printed gradients */
  color?: (x: number, y: number) => [number, number, number];
  /** texture tiles per cm */
  uvScale?: number;
  /** map the face UVs 0..1 over this box [x, y, w, h] (for printed pieces) */
  uvFit?: [number, number, number, number];
};

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1]);

export const wobbleRing = (ring: Ring, amp: number, wavelength: number, step: number, seed: number): Ring => {
  const pts: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const L = dist(a, b);
    const n = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < n; k++) pts.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  const s: number[] = [];
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    s.push(per);
    per += dist(pts[i], pts[(i + 1) % pts.length]);
  }
  const effAmp = Math.min(amp, per * 0.012);
  if (effAmp <= 1e-5 || pts.length < 3) return pts;
  // noise sampled around a circle so the seam of the ring is continuous
  const R = per / (2 * Math.PI * Math.max(0.05, wavelength));
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    let tx = next[0] - prev[0];
    let ty = next[1] - prev[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl;
    const th = (s[i] / per) * Math.PI * 2;
    const w = fbm2(Math.cos(th) * R + 17.3, Math.sin(th) * R - 5.1, seed, 3);
    const jitter = hash1(i, seed) - 0.5;
    const off = effAmp * (w * 1.6 + jitter * 0.35);
    out.push([p[0] + ty * off, p[1] - tx * off]);
  }
  return out;
};

type Tri2 = number[]; // flat [x0,y0,x1,y1,x2,y2]

/** Conforming midpoint subdivision of a 2D triangle soup. */
const subdivide2 = (tris: Tri2[], passes: number): Tri2[] => {
  let cur = tris;
  for (let p = 0; p < passes; p++) {
    const next: Tri2[] = [];
    for (const t of cur) {
      const [ax, ay, bx, by, cx, cy] = t;
      const abx = (ax + bx) / 2;
      const aby = (ay + by) / 2;
      const bcx = (bx + cx) / 2;
      const bcy = (by + cy) / 2;
      const cax = (cx + ax) / 2;
      const cay = (cy + ay) / 2;
      next.push([ax, ay, abx, aby, cax, cay], [abx, aby, bx, by, bcx, bcy], [cax, cay, bcx, bcy, cx, cy], [abx, aby, bcx, bcy, cax, cay]);
    }
    cur = next;
  }
  return cur;
};

export type CutoutSource = string | string[] | Ring[];

const toRings = (src: CutoutSource, curveStep: number): Ring[] => {
  if (typeof src === 'string') return parsePath(src, curveStep);
  if (src.length === 0) return [];
  if (typeof src[0] === 'string') return (src as string[]).flatMap((d) => parsePath(d, curveStep));
  return src as Ring[];
};

const geoCache = new Map<string, THREE.BufferGeometry>();

/** Build a hand-cut card piece from SVG path data. */
export const cutout = (src: CutoutSource, opts: CutoutOpts = {}, cacheKey?: string): THREE.BufferGeometry => {
  if (cacheKey) {
    const hit = geoCache.get(cacheKey);
    if (hit) return hit;
  }
  const seed = toSeed(opts.seed ?? (typeof src === 'string' ? src : 'cutout'));
  const t = opts.thickness ?? CARD;
  const amp = opts.wobble ?? 0.035;
  const wl = opts.wavelength ?? 1.2;
  const step = opts.step ?? 0.3;
  const uvScale = opts.uvScale ?? 1 / 7;
  const rings = toRings(src, opts.curveStep ?? 0.2);
  const shapes: ShapeRings[] = nestRings(rings);
  const threeShapes = shapes.map((s, si) => {
    const outer = wobbleRing(s.outer, amp, wl, step, seed + si * 131);
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p[0], p[1])));
    s.holes.forEach((h, hi) => {
      const hole = wobbleRing(h, amp * 0.8, wl * 0.7, step * 0.8, seed + si * 131 + (hi + 1) * 977);
      shape.holes.push(new THREE.Path(hole.map((p) => new THREE.Vector2(p[0], p[1]))));
    });
    return shape;
  });
  const ex = new THREE.ExtrudeGeometry(threeShapes, { depth: t, bevelEnabled: false, steps: 1, curveSegments: 1 });
  const pos = ex.getAttribute('position') as THREE.BufferAttribute;
  const front: Tri2[] = [];
  const back: Tri2[] = [];
  const side: number[] = []; // xyz triples
  for (const g of ex.groups) {
    for (let v = g.start; v < g.start + g.count; v += 3) {
      if (g.materialIndex === 0) {
        const z = pos.getZ(v);
        const tri = [pos.getX(v), pos.getY(v), pos.getX(v + 1), pos.getY(v + 1), pos.getX(v + 2), pos.getY(v + 2)];
        if (z > t * 0.5) front.push(tri);
        else back.push(tri);
      } else {
        for (let k = 0; k < 3; k++) side.push(pos.getX(v + k), pos.getY(v + k), pos.getZ(v + k) - t / 2);
      }
    }
  }
  ex.dispose();
  const passes = opts.subdivide ?? 0;
  const fr = passes > 0 ? subdivide2(front, passes) : front;
  const bk = passes > 0 ? subdivide2(back, passes) : back;

  const bend = opts.bend;
  const colorFn = opts.color;
  const fit = opts.uvFit;
  const offU = hash1(seed, 3) * 7;
  const offV = hash1(seed, 4) * 7;
  const P: number[] = [];
  const N: number[] = [];
  const UV: number[] = [];
  const COL: number[] = [];
  const eps = 0.05;
  const grad = (x: number, y: number): [number, number] =>
    bend ? [(bend(x + eps, y) - bend(x - eps, y)) / (2 * eps), (bend(x, y + eps) - bend(x, y - eps)) / (2 * eps)] : [0, 0];

  const pushCap = (tris: Tri2[], zSign: number) => {
    for (const tri of tris) {
      const order = zSign > 0 ? [0, 1, 2] : [0, 1, 2];
      for (const k of order) {
        const x = tri[k * 2];
        const y = tri[k * 2 + 1];
        const dz = bend ? bend(x, y) : 0;
        P.push(x, y, (zSign * t) / 2 + dz);
        const [gx, gy] = grad(x, y);
        const l = Math.hypot(gx, gy, 1);
        N.push((-gx / l) * zSign, (-gy / l) * zSign, (1 / l) * zSign);
        if (fit) UV.push((x - fit[0]) / fit[2], (y - fit[1]) / fit[3]);
        else UV.push(x * uvScale + offU, y * uvScale + offV);
        if (colorFn) COL.push(...colorFn(x, y));
      }
    }
  };
  pushCap(fr, 1);
  const frontCount = fr.length * 3;
  // side walls with flat normals
  const sideStart = P.length / 3;
  for (let v = 0; v < side.length; v += 9) {
    const a = new THREE.Vector3(side[v], side[v + 1], side[v + 2]);
    const b = new THREE.Vector3(side[v + 3], side[v + 4], side[v + 5]);
    const c = new THREE.Vector3(side[v + 6], side[v + 7], side[v + 8]);
    const verts = [a, b, c];
    if (bend) for (const p of verts) p.z += bend(p.x, p.y);
    const nrm = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)).normalize();
    for (const p of verts) {
      P.push(p.x, p.y, p.z);
      N.push(nrm.x, nrm.y, nrm.z);
      UV.push((p.x + p.y) * uvScale * 2 + offU, p.z * uvScale * 2 + offV);
      if (colorFn) COL.push(...colorFn(p.x, p.y));
    }
  }
  const sideCount = P.length / 3 - sideStart;
  pushCap(bk, -1);
  const backCount = bk.length * 3;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  if (colorFn) geo.setAttribute('color', new THREE.Float32BufferAttribute(COL, 3));
  geo.addGroup(0, frontCount, 0);
  geo.addGroup(frontCount, sideCount, 1);
  geo.addGroup(frontCount + sideCount, backCount, 2);
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  if (cacheKey) geoCache.set(cacheKey, geo);
  return geo;
};

/** Concatenate cut-out geometries, keeping the 3 material groups. Optional per-input matrices. */
export const mergeCutouts = (items: { geo: THREE.BufferGeometry; matrix?: THREE.Matrix4 }[]): THREE.BufferGeometry => {
  const hasColor = items.every((i) => i.geo.getAttribute('color'));
  const buckets: { P: number[]; N: number[]; UV: number[]; C: number[] }[] = [0, 1, 2].map(() => ({ P: [], N: [], UV: [], C: [] }));
  const v = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  for (const { geo, matrix } of items) {
    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const uv = geo.getAttribute('uv');
    const col = geo.getAttribute('color');
    if (matrix) nm.getNormalMatrix(matrix);
    const flip = matrix ? matrix.determinant() < 0 : false;
    for (const g of geo.groups) {
      const b = buckets[g.materialIndex ?? 0];
      for (let j = g.start; j < g.start + g.count; j++) {
        // mirrored copies keep counter-clockwise front faces
        const k = (j - g.start) % 3;
        const i = flip && k > 0 ? j + (k === 1 ? 1 : -1) : j;
        v.fromBufferAttribute(pos, i);
        if (matrix) v.applyMatrix4(matrix);
        b.P.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i);
        if (matrix) v.applyMatrix3(nm).normalize();
        b.N.push(v.x, v.y, v.z);
        b.UV.push(uv.getX(i), uv.getY(i));
        if (hasColor && col) b.C.push(col.getX(i), col.getY(i), col.getZ(i));
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  const P = buckets.flatMap((b) => b.P);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buckets.flatMap((b) => b.N), 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buckets.flatMap((b) => b.UV), 2));
  if (hasColor) geo.setAttribute('color', new THREE.Float32BufferAttribute(buckets.flatMap((b) => b.C), 3));
  let start = 0;
  buckets.forEach((b, i) => {
    const count = b.P.length / 3;
    geo.addGroup(start, count, i);
    start += count;
  });
  geo.computeBoundingSphere();
  geo.computeBoundingBox();
  return geo;
};

/** Matrix helper: translate / rotate(z) / scale in the flat's plane. */
export const m4 = (x = 0, y = 0, z = 0, rotZ = 0, s = 1, rotY = 0, rotX = 0) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')),
    new THREE.Vector3(s, s, s),
  );
