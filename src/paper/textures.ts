import * as THREE from 'three';
import { fbm2, hash2, mulberry32, noise2 } from '../lib/random';

// Procedural paper: every texture is generated in code from a fixed seed, so the
// film needs no image assets and renders identically every time.

const wrap = (v: number, n: number) => ((v % n) + n) % n;

type Field = { size: number; data: Float32Array };

/** Tileable low-frequency fbm field sampled bilinearly from a small periodic lattice. */
const periodicFbm = (size: number, cells: number, seed: number, octaves: number): Field => {
  const data = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * cells;
      const v = (y / size) * cells;
      data[y * size + x] = fbm2(u, v, seed, octaves, cells);
    }
  }
  return { size, data };
};

const sampleField = (f: Field, u: number, v: number) => {
  // u, v in texels of the target; bilinear with wrap
  const x = u - 0.5;
  const y = v - 0.5;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const s = f.size;
  const a = f.data[wrap(y0, s) * s + wrap(x0, s)];
  const b = f.data[wrap(y0, s) * s + wrap(x0 + 1, s)];
  const c = f.data[wrap(y0 + 1, s) * s + wrap(x0, s)];
  const d = f.data[wrap(y0 + 1, s) * s + wrap(x0 + 1, s)];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
};

/** Splats short curved fibres into a height field (wrapping, so the tile stays seamless). */
const addFibres = (h: Float32Array, size: number, count: number, seed: number, strength: number, lenMin: number, lenMax: number) => {
  const r = mulberry32(seed);
  for (let i = 0; i < count; i++) {
    let x = r() * size;
    let y = r() * size;
    let ang = r() * Math.PI * 2;
    const len = lenMin + (lenMax - lenMin) * r() * r();
    const curl = (r() - 0.5) * 0.12;
    const amp = (r() < 0.55 ? 1 : -1) * strength * (0.4 + 0.6 * r());
    const width = 0.55 + r() * 0.9;
    const steps = Math.ceil(len / 0.7);
    for (let s = 0; s < steps; s++) {
      ang += curl + (r() - 0.5) * 0.08;
      x += Math.cos(ang) * 0.7;
      y += Math.sin(ang) * 0.7;
      const taper = Math.sin((s / steps) * Math.PI);
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          const dx = cx + ox + 0.5 - x;
          const dy = cy + oy + 0.5 - y;
          const w = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / (width + 0.35));
          if (w <= 0) continue;
          const idx = wrap(cy + oy, size) * size + wrap(cx + ox, size);
          h[idx] += amp * w * taper;
        }
      }
    }
  }
};

export type PaperTextures = {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
};

let cachedPaper: PaperTextures | null = null;

export const PAPER_TEX_SIZE = 1024;

export const getPaperTextures = (): PaperTextures => {
  if (cachedPaper) return cachedPaper;
  const size = PAPER_TEX_SIZE;
  const n = size * size;
  const h = new Float32Array(n);
  const low = periodicFbm(128, 6, 11, 4); // cloudy formation of the sheet
  const mid = periodicFbm(256, 24, 23, 3); // fine tooth
  const tint = periodicFbm(64, 3, 37, 2); // tiny colour drift
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const lo = sampleField(low, (x / size) * 128, (y / size) * 128);
      const mi = sampleField(mid, (x / size) * 256, (y / size) * 256);
      // per-texel grain
      const g = hash2(x, y, 5) - 0.5;
      h[i] = lo * 0.55 + mi * 0.3 + g * 0.12;
    }
  }
  addFibres(h, size, 5200, 101, 0.16, 6, 46); // visible fibres
  addFibres(h, size, 14000, 202, 0.07, 3, 14); // fine felt

  const albedo = new Uint8Array(n * 4);
  const rough = new Uint8Array(n * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = h[i];
      const t = sampleField(tint, (x / size) * 64, (y / size) * 64);
      const lum = 0.925 + 0.07 * Math.tanh(v * 1.6);
      albedo[i * 4 + 0] = Math.round(255 * Math.min(1, lum * (1 + t * 0.018)));
      albedo[i * 4 + 1] = Math.round(255 * Math.min(1, lum * (1 + t * 0.004)));
      albedo[i * 4 + 2] = Math.round(255 * Math.min(1, lum * (1 - t * 0.02)));
      albedo[i * 4 + 3] = 255;
      const r = 0.86 + 0.1 * Math.tanh(-v * 1.2);
      rough[i * 4 + 0] = rough[i * 4 + 1] = rough[i * 4 + 2] = Math.round(255 * r);
      rough[i * 4 + 3] = 255;
    }
  }
  const normal = new Uint8Array(n * 4);
  const strength = 2.2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const l = h[y * size + wrap(x - 1, size)];
      const r = h[y * size + wrap(x + 1, size)];
      const u = h[wrap(y - 1, size) * size + x];
      const d = h[wrap(y + 1, size) * size + x];
      let nx = (l - r) * strength;
      let ny = (u - d) * strength;
      let nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx /= len;
      ny /= len;
      nz /= len;
      normal[i * 4 + 0] = Math.round((nx * 0.5 + 0.5) * 255);
      normal[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normal[i * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normal[i * 4 + 3] = 255;
    }
  }
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  cachedPaper = { map: mk(albedo, true), normalMap: mk(normal, false), roughnessMap: mk(rough, false) };
  return cachedPaper;
};

let cachedStickWood: THREE.DataTexture | null = null;

/** Birch dowel: pale wood with long streaky grain along +v. */
export const getStickWoodTexture = () => {
  if (cachedStickWood) return cachedStickWood;
  const w = 64;
  const hgt = 512;
  const data = new Uint8Array(w * hgt * 4);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const streak = noise2(x * 0.35, y * 0.012, 3, 0) * 0.5 + noise2(x * 1.3, y * 0.05, 4, 0) * 0.25;
      const fleck = hash2(x, Math.floor(y / 6), 9) > 0.985 ? -0.12 : 0;
      const v = 0.86 + streak * 0.14 + fleck;
      data[i] = Math.round(255 * Math.min(1, v * 1.0));
      data[i + 1] = Math.round(255 * Math.min(1, v * 0.93));
      data[i + 2] = Math.round(255 * Math.min(1, v * 0.82));
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, hgt, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  cachedStickWood = t;
  return t;
};

let cachedTable: { map: THREE.DataTexture; normalMap: THREE.DataTexture } | null = null;

/** Oiled oak table top: planks along x, with growth rings, pores and a soft sheen map. */
export const getTableWoodTexture = () => {
  if (cachedTable) return cachedTable;
  const w = 1024;
  const hgt = 1024;
  const planks = 5;
  const col = new Uint8Array(w * hgt * 4);
  const hf = new Float32Array(w * hgt);
  const r = mulberry32(77);
  const plankSeeds = Array.from({ length: planks }, () => ({ off: r() * 50, tone: 0.9 + r() * 0.2, ring: 5 + r() * 5, shift: r() * 1000 }));
  for (let y = 0; y < hgt; y++) {
    const p = Math.min(planks - 1, Math.floor((y / hgt) * planks));
    const ps = plankSeeds[p];
    const py = (y / hgt) * planks - p; // 0..1 within plank
    for (let x = 0; x < w; x++) {
      const u = x / w;
      const warp = fbm2(u * 3 + ps.shift, py * 2, 13 + p, 3, 0) * 1.4;
      const rings = Math.sin((py * ps.ring + warp + ps.off) * Math.PI * 2);
      const ringMask = Math.pow(Math.abs(rings), 3.5);
      const fibre = noise2(u * 180 + ps.shift, py * 9, 31 + p, 0) * 0.5 + noise2(u * 600, py * 30, 41, 0) * 0.25;
      const pores = hash2(x, y, 51 + p) > 0.992 ? 1 : 0;
      const gap = py < 0.006 || py > 0.994 ? 1 : 0;
      let v = (0.62 + 0.18 * ringMask + 0.07 * fibre - 0.12 * pores) * ps.tone;
      if (gap) v *= 0.35;
      const i = y * w + x;
      hf[i] = ringMask * 0.3 + fibre * 0.3 - pores * 0.6 - gap * 2.5;
      col[i * 4] = Math.round(255 * Math.min(1, v * 0.78));
      col[i * 4 + 1] = Math.round(255 * Math.min(1, v * 0.52));
      col[i * 4 + 2] = Math.round(255 * Math.min(1, v * 0.31));
      col[i * 4 + 3] = 255;
    }
  }
  const nm = new Uint8Array(w * hgt * 4);
  for (let y = 0; y < hgt; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = hf[y * w + wrap(x - 1, w)];
      const rr = hf[y * w + wrap(x + 1, w)];
      const u = hf[wrap(y - 1, hgt) * w + x];
      const d = hf[wrap(y + 1, hgt) * w + x];
      let nx = (l - rr) * 1.2;
      let ny = (u - d) * 1.2;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      nx /= len;
      ny /= len;
      nm[i * 4] = Math.round((nx * 0.5 + 0.5) * 255);
      nm[i * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      nm[i * 4 + 2] = Math.round((1 / len) * 0.5 * 255 + 127.5);
      nm[i * 4 + 3] = 255;
    }
  }
  const mk = (data: Uint8Array, srgb: boolean) => {
    const t = new THREE.DataTexture(data, w, hgt, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 8;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.needsUpdate = true;
    return t;
  };
  cachedTable = { map: mk(col, true), normalMap: mk(nm, false) };
  return cachedTable;
};
