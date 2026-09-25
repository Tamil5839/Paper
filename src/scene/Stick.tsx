import React, { useMemo } from 'react';
import * as THREE from 'three';
import { rng } from '../lib/random';
import { CARD, cutout } from '../paper/cutout';
import { paper, stickMaterial, threadMaterial } from '../paper/materials';
import { rectD } from '../paper/path';

// Wooden sticks (and wires/threads) that puppets and moving flats hang from.
// They are drawn in the puppet's own space, so any hand wobble applied to the
// puppet moves the stick too — you can see the puppeteer's hand in the motion.

type Dir = 'top' | 'bottom' | 'left' | 'right';

const cylCache = new Map<string, THREE.CylinderGeometry>();
const cyl = (r: number, len: number, seg = 7) => {
  const k = `${r}|${len}|${seg}`;
  let g = cylCache.get(k);
  if (!g) {
    g = new THREE.CylinderGeometry(r, r, len, seg, 1, false);
    cylCache.set(k, g);
  }
  return g;
};

const tabGeo = () => cutout(rectD(-0.45, -0.7, 0.9, 1.4), { seed: 'stick-tab', wobble: 0.02 }, 'stick-tab');
const tabMat = () => paper({ color: '#d8c9a8' });

export const Stick: React.FC<{
  at: [number, number, number];
  from: Dir;
  length?: number;
  radius?: number;
  seed?: string;
  tab?: boolean;
  lean?: number;
}> = ({ at, from, length = 60, radius = 0.12, seed = 'stick', tab = true, lean = 1 }) => {
  const r = useMemo(() => rng(seed), [seed]);
  const tilt = useMemo(() => (r.next() - 0.5) * 0.05 * lean, [r, lean]);
  const rotZ = from === 'left' || from === 'right' ? Math.PI / 2 : 0;
  const sign = from === 'top' || from === 'right' ? 1 : -1;
  const along = from === 'top' || from === 'bottom' ? 'y' : 'x';
  const off: [number, number, number] = along === 'y' ? [0, (sign * length) / 2, 0] : [(sign * length) / 2, 0, 0];
  return (
    <group position={[at[0], at[1], at[2] - radius - CARD]} rotation={[along === 'x' ? tilt * 0.5 : 0, 0, tilt]}>
      <mesh geometry={cyl(radius, length)} material={stickMaterial()} position={off} rotation={[0, 0, rotZ]} castShadow receiveShadow />
      {tab ? <mesh geometry={tabGeo()} material={tabMat()} position={[0, 0, radius * 0.4]} rotation={[0, 0, along === 'x' ? Math.PI / 2 : 0]} castShadow receiveShadow /> : null}
    </group>
  );
};

/** A thin wire or thread hanging straight up from `at`. */
export const Wire: React.FC<{ at: [number, number, number]; length?: number; radius?: number; color?: 'wire' | 'thread' }> = ({ at, length = 60, radius = 0.018 }) => (
  <mesh geometry={cyl(radius, length, 4)} material={threadMaterial()} position={[at[0], at[1] + length / 2, at[2]]} castShadow />
);
