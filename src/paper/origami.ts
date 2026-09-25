import * as THREE from 'three';
import { noise3, rng } from '../lib/random';

// Low-poly folded paper: an origami flapping bird split into hinged panels
// (body keel, neck + reverse-folded head, tail, inner and outer wing panels),
// and procedurally crumpled paper balls. Faces are flat-shaded so every crease
// catches the light.

type Tri = [THREE.Vector3, THREE.Vector3, THREE.Vector3];
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const fromTris = (tris: Tri[], uvScale = 0.45): THREE.BufferGeometry => {
  const P: number[] = [];
  const UV: number[] = [];
  for (const t of tris) {
    for (const p of t) {
      P.push(p.x, p.y, p.z);
      UV.push(p.x * uvScale + 0.3, (p.y + p.z) * uvScale + 0.6);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
};

export type BirdParts = {
  body: THREE.BufferGeometry;
  neck: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  tail: THREE.BufferGeometry;
  wingInner: THREE.BufferGeometry;
  wingOuter: THREE.BufferGeometry;
  /** hinge positions */
  neckRoot: THREE.Vector3;
  headRoot: THREE.Vector3;
  tailRoot: THREE.Vector3;
  crease: number; // z of the wing crease
};

let parts: BirdParts | null = null;

/** Bird local frame: +x forward (beak), +y up, wings along ±z. Length ≈ 2.3 cm. */
export const birdParts = (): BirdParts => {
  if (parts) return parts;
  const body = fromTris([
    // keel: two faces meeting under the spine, plus a thin top ridge
    [v(-0.62, 0.06, 0), v(0.55, 0.02, 0), v(0.02, -0.42, 0.13)],
    [v(0.55, 0.02, 0), v(-0.62, 0.06, 0), v(0.02, -0.42, -0.13)],
    [v(-0.62, 0.06, 0), v(0.02, -0.42, 0.13), v(-0.3, -0.18, 0.04)],
    [v(0.02, -0.42, -0.13), v(-0.62, 0.06, 0), v(-0.3, -0.18, -0.04)],
  ]);
  // neck/head/tail are double layers of paper: two faces a hair apart
  const dbl = (pts: [number, number][], z = 0.018): Tri[] => {
    const out: Tri[] = [];
    for (let i = 1; i < pts.length - 1; i++) {
      out.push([v(pts[0][0], pts[0][1], z), v(pts[i][0], pts[i][1], z), v(pts[i + 1][0], pts[i + 1][1], z)]);
      out.push([v(pts[0][0], pts[0][1], -z), v(pts[i + 1][0], pts[i + 1][1], -z), v(pts[i][0], pts[i][1], -z)]);
    }
    return out;
  };
  // neck in its own frame: root at origin
  const neck = fromTris(dbl([[0, 0], [0.34, 0.0], [0.62, 0.66], [0.5, 0.7]]));
  const head = fromTris(dbl([[0, 0], [0.12, -0.12], [0.34, -0.2], [0.08, 0.06]], 0.024));
  const tail = fromTris(dbl([[0, 0], [-0.36, 0.0], [-0.72, 0.7], [-0.6, 0.74]]));
  // wings: inner panel spine -> crease, outer panel crease -> tip (in +z; mirror for -z)
  const crease = 0.78;
  const wingInner = fromTris([
    [v(0.3, 0, 0), v(-0.42, 0, 0), v(-0.36, 0, crease)],
    [v(0.3, 0, 0), v(-0.36, 0, crease), v(0.1, 0, crease)],
    // underside
    [v(-0.42, -0.004, 0), v(0.3, -0.004, 0), v(-0.36, -0.004, crease)],
    [v(-0.36, -0.004, crease), v(0.3, -0.004, 0), v(0.1, -0.004, crease)],
  ]);
  const wingOuter = fromTris([
    [v(0.1, 0, 0), v(-0.36, 0, 0), v(-0.28, 0, 0.78)],
    [v(-0.36, -0.004, 0), v(0.1, -0.004, 0), v(-0.28, -0.004, 0.78)],
  ]);
  parts = {
    body,
    neck,
    head,
    tail,
    wingInner,
    wingOuter,
    neckRoot: v(0.3, 0.02, 0),
    headRoot: v(0.56, 0.68, 0),
    tailRoot: v(-0.34, 0.05, 0),
    crease,
  };
  return parts;
};

const ballCache = new Map<number, THREE.BufferGeometry>();

/** A crumpled paper ball: icosphere pushed around by ridged noise and random crease planes. */
export const crumpledBall = (seed: number): THREE.BufferGeometry => {
  const key = seed % 5;
  const hit = ballCache.get(key);
  if (hit) return hit;
  const base = new THREE.IcosahedronGeometry(1, 3);
  const pos = base.getAttribute('position') as THREE.BufferAttribute;
  const r = rng(`ball-${key}`);
  const planes = Array.from({ length: 9 }, () => {
    const n = new THREE.Vector3(r.gauss(), r.gauss(), r.gauss()).normalize();
    return { n, d: r.range(-0.3, 0.45), k: r.range(0.08, 0.2) };
  });
  // merge duplicated vertices by position first so the ball stays watertight
  const map = new Map<string, THREE.Vector3>();
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const k = `${p.x.toFixed(4)},${p.y.toFixed(4)},${p.z.toFixed(4)}`;
    let q = map.get(k);
    if (!q) {
      const dir = p.clone().normalize();
      let rad = 1 + 0.22 * (Math.abs(noise3(dir.x * 1.8 + key, dir.y * 1.8, dir.z * 1.8, 7)) - 0.35);
      rad += 0.07 * noise3(dir.x * 5, dir.y * 5 + key, dir.z * 5, 9);
      for (const pl of planes) {
        const s = dir.dot(pl.n) - pl.d;
        if (s > 0) rad -= pl.k * Math.min(1, s * 3);
      }
      q = dir.multiplyScalar(Math.max(0.55, rad));
      map.set(k, q);
    }
    pos.setXYZ(i, q.x, q.y, q.z);
  }
  const g = base; // polyhedra are already non-indexed: one flat facet per triangle
  const P = g.getAttribute('position') as THREE.BufferAttribute;
  const uv: number[] = [];
  for (let i = 0; i < P.count; i++) {
    p.fromBufferAttribute(P, i);
    uv.push(Math.atan2(p.z, p.x) * 0.6 + 1, p.y * 0.6 + 1);
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  g.scale(0.52, 0.5, 0.52);
  g.computeBoundingSphere();
  ballCache.set(key, g);
  return g;
};
