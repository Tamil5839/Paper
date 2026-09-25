import React, { useMemo } from 'react';
import * as THREE from 'three';
import { hash1, toSeed } from '../lib/random';
import { cutout, mergeCutouts, m4 } from '../paper/cutout';
import { vellum } from '../paper/materials';
import { rectD } from '../paper/path';

// Backlit window panes: small vellum quads placed just behind pinhole windows,
// split into groups so a city can switch its lights off one cluster at a time.

export type Pane = { x: number; y: number; w: number; h: number };

export const LitPanes: React.FC<{
  panes: Pane[];
  z: number;
  seed: string;
  groups?: number;
  color?: string;
  glow?: string;
  intensity: number;
  /** 0..1: fraction of groups already switched off */
  offProgress?: number;
}> = ({ panes, z, seed, groups = 5, color = '#f3dfb5', glow = '#ffc877', intensity, offProgress = 0 }) => {
  const built = useMemo(() => {
    const s = toSeed(seed);
    const buckets: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[][] = Array.from({ length: groups }, () => []);
    const unit = cutout(rectD(-0.5, -0.5, 1, 1), { seed: 'pane', wobble: 0 }, 'pane-unit');
    panes.forEach((p, i) => {
      const g = Math.floor(hash1(i, s) * groups);
      const m = new THREE.Matrix4().makeScale(p.w + 0.25, p.h + 0.25, 1).premultiply(m4(p.x + p.w / 2, p.y + p.h / 2, 0));
      buckets[g].push({ geo: unit, matrix: m });
    });
    return buckets.map((b, gi) => ({
      geo: b.length ? mergeCutouts(b) : null,
      mats: vellum(color, glow, 1, true),
      order: hash1(gi, s + 1),
    }));
  }, [panes, seed, groups, color, glow]);
  return (
    <group position={[0, 0, z]}>
      {built.map((b, i) => {
        if (!b.geo) return null;
        const on = offProgress <= b.order ? 1 : 0;
        (b.mats[0] as THREE.MeshLambertMaterial).emissiveIntensity = intensity * on;
        return <mesh key={i} geometry={b.geo} material={b.mats} />;
      })}
    </group>
  );
};
