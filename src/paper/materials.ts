import * as THREE from 'three';
import { getPaperTextures, getStickWoodTexture } from './textures';

// Paper is matte and rough. A cut edge shows the lighter core of the card, and
// the back of a flat is unpainted card. Materials are shared (cached) unless a
// piece needs to animate its own values.

export const PAPER_CORE = '#f2e9d8';
export const CARD_BACK = '#d8cdb9';

export type PaperSpec = {
  color: string;
  edge?: string;
  back?: string;
  roughness?: number;
  normalScale?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  vertexColors?: boolean;
  side?: THREE.Side;
  flatShading?: boolean;
  unique?: boolean;
};

const cache = new Map<string, THREE.Material[]>();

export const mixHex = (a: string, b: string, t: number) => {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), t);
  return `#${c.getHexString()}`;
};

const face = (spec: PaperSpec, color: string, isBack = false) => {
  const tex = getPaperTextures();
  const m = new THREE.MeshLambertMaterial({
    color: new THREE.Color(color),
    map: tex.map,
    normalMap: tex.normalMap,
    normalScale: new THREE.Vector2(spec.normalScale ?? 0.55, spec.normalScale ?? 0.55),
    vertexColors: !isBack && (spec.vertexColors ?? false),
    side: spec.side ?? THREE.FrontSide,
    flatShading: spec.flatShading ?? false,
  });
  if (spec.emissive && !isBack) {
    m.emissive = new THREE.Color(spec.emissive);
    m.emissiveMap = tex.map;
    m.emissiveIntensity = spec.emissiveIntensity ?? 1;
  }
  return m;
};

/** [front face, cut edge, back] materials for a cut-card piece. */
export const paper = (spec: PaperSpec | string): THREE.Material[] => {
  const s: PaperSpec = typeof spec === 'string' ? { color: spec } : spec;
  const key = JSON.stringify(s);
  if (!s.unique) {
    const hit = cache.get(key);
    if (hit) return hit;
  }
  const edgeColor = s.edge ?? mixHex(s.color, PAPER_CORE, 0.62);
  const backColor = s.back ?? mixHex(s.color, CARD_BACK, 0.8);
  const front = face(s, s.color);
  const edge = new THREE.MeshStandardMaterial({
    color: new THREE.Color(edgeColor),
    roughness: 0.96,
    map: getPaperTextures().map,
    vertexColors: false,
  });
  const back = s.vertexColors ? face({ ...s, vertexColors: false }, backColor, true) : face(s, backColor, true);
  const mats = [front, edge, back];
  if (!s.unique) cache.set(key, mats);
  return mats;
};

/** Vellum / tracing paper, lit from behind: a warm emissive glow that keeps the fibre texture. */
export const vellum = (color: string, glow: string, intensity = 1.6, unique = true): THREE.Material[] =>
  paper({ color, emissive: glow, emissiveIntensity: intensity, roughness: 0.8, normalScale: 0.25, unique });

let stickMat: THREE.MeshStandardMaterial | null = null;
export const stickMaterial = () => {
  if (stickMat) return stickMat;
  stickMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d9b88c'),
    map: getStickWoodTexture(),
    roughness: 0.72,
    metalness: 0,
  });
  return stickMat;
};

let threadMat: THREE.MeshStandardMaterial | null = null;
export const threadMaterial = () => {
  if (threadMat) return threadMat;
  threadMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#3b3a3f'), roughness: 0.8 });
  return threadMat;
};

let pinMat: THREE.MeshStandardMaterial | null = null;
/** Brass split-pin heads. */
export const brassMaterial = () => {
  if (pinMat) return pinMat;
  pinMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#c9a45a'), roughness: 0.35, metalness: 0.85 });
  return pinMat;
};
