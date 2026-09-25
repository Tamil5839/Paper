import * as THREE from 'three';
import { getPaperTextures, PAPER_TEX_SIZE } from './textures';

// "Printed" paper: a pattern drawn on a 2D canvas (in code), multiplied with the
// procedural fibre texture so the ink sits in the paper rather than on top of it.

const cache = new Map<string, THREE.DataTexture>();

export type PrintDraw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * @param widthCm/heightCm physical size of the printed area, used to scale fibres
 * @param pxPerCm resolution of the print
 */
export const printTexture = (key: string, widthCm: number, heightCm: number, pxPerCm: number, draw: PrintDraw): THREE.DataTexture => {
  const hit = cache.get(key);
  if (hit) return hit;
  const w = Math.max(4, Math.round(widthCm * pxPerCm));
  const h = Math.max(4, Math.round(heightCm * pxPerCm));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  draw(ctx, w, h);
  const img = ctx.getImageData(0, 0, w, h).data;
  const fib = getPaperTextures().map.image.data as Uint8Array;
  const S = PAPER_TEX_SIZE;
  const fibPerPx = (S / 7) / pxPerCm; // paper tile = 7 cm
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const fy = Math.floor((h - 1 - y) * fibPerPx) % S;
    for (let x = 0; x < w; x++) {
      const fx = Math.floor(x * fibPerPx) % S;
      const fi = (fy * S + fx) * 4;
      const si = (y * w + x) * 4;
      const di = ((h - 1 - y) * w + x) * 4; // flip so v=0 is the bottom edge
      out[di] = (img[si] * fib[fi]) / 255;
      out[di + 1] = (img[si + 1] * fib[fi + 1]) / 255;
      out[di + 2] = (img[si + 2] * fib[fi + 2]) / 255;
      out[di + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  cache.set(key, t);
  return t;
};

const matCache = new Map<string, THREE.Material[]>();

/**
 * Materials for a printed cut-out whose UVs were built with `uvFit` (0..1 over its box).
 * The fibre normal map is re-tiled so it matches the physical size of the piece.
 */
export const printedPaper = (key: string, tex: THREE.Texture, widthCm: number, heightCm: number, edge = '#efe6d2', back = '#d8cdb9', emissive?: { color: string; intensity: number }): THREE.Material[] => {
  const hit = matCache.get(key);
  if (hit) return hit;
  const paper = getPaperTextures();
  const nrm = paper.normalMap.clone();
  nrm.repeat.set(widthCm / 7, heightCm / 7);
  nrm.needsUpdate = true;
  const front = new THREE.MeshLambertMaterial({ color: '#ffffff', map: tex, normalMap: nrm, normalScale: new THREE.Vector2(0.5, 0.5) });
  if (emissive) {
    front.emissive = new THREE.Color(emissive.color);
    front.emissiveMap = tex;
    front.emissiveIntensity = emissive.intensity;
  }
  const edgeM = new THREE.MeshLambertMaterial({ color: edge, map: paper.map });
  const backM = new THREE.MeshLambertMaterial({ color: back, map: paper.map, normalMap: paper.normalMap, normalScale: new THREE.Vector2(0.5, 0.5) });
  const mats = [front, edgeM, backM];
  matCache.set(key, mats);
  return mats;
};
