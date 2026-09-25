import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { ease, lerp, onTwos, overshoot, seg } from '../lib/anim';
import { rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper, stickMaterial, vellum } from '../paper/materials';
import { Stick } from './Stick';

// Paper raindrops on threads, hung from a wooden rod that is lowered from the
// flies. The drops slide down their threads (on twos); when the storm ends the
// whole rig is hauled back up.

type RigDef = { z: number; x0: number; x1: number; spacing: number; seed: string };
const RIGS: RigDef[] = [
  { z: -12.4, x0: -3, x1: 27, spacing: 1.25, seed: 'rain-a' },
  { z: -17.3, x0: -36, x1: 27, spacing: 1.6, seed: 'rain-b' },
];
const TOP = 36;
const LEN = 38;

const Rig: React.FC<{ def: RigDef; frame: number; drop: THREE.BufferGeometry; mats: THREE.Material[]; lift: number }> = ({ def, frame, drop, mats, lift }) => {
  const layout = useMemo(() => {
    const r = rng(def.seed);
    const threads: { x: number; phase: number; speed: number; z: number }[] = [];
    for (let x = def.x0; x <= def.x1; x += def.spacing) threads.push({ x: x + r.range(-0.3, 0.3), phase: r.range(0, 2.2), speed: r.range(0.85, 1.15), z: r.range(-0.25, 0.25) });
    const perThread = Math.ceil(LEN / 2.2);
    const threadGeo = new THREE.CylinderGeometry(0.01, 0.01, LEN, 3, 1, true);
    const merged = new THREE.BufferGeometry();
    const P: number[] = [];
    const src = threadGeo.toNonIndexed().getAttribute('position');
    for (const t of threads) for (let i = 0; i < src.count; i++) P.push(src.getX(i) + t.x, src.getY(i) + TOP - LEN / 2, src.getZ(i) + t.z);
    merged.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    merged.computeVertexNormals();
    return { threads, perThread, merged };
  }, [def]);
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = layout.threads.length * layout.perThread;
  const f = onTwos(frame);
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    let k = 0;
    layout.threads.forEach((t, ti) => {
      for (let i = 0; i < layout.perThread; i++) {
        const y = TOP - ((((i * 2.2 + t.phase + f * 0.85 * t.speed) % LEN) + LEN) % LEN);
        o.position.set(t.x, y, t.z);
        o.rotation.set(0, 0, ((ti * 7 + i * 3) % 5) * 0.03 - 0.06);
        const s = 0.9 + ((ti * 13 + i * 7) % 5) * 0.05;
        o.scale.set(s, s, 1);
        o.updateMatrix();
        m.setMatrixAt(k++, o.matrix);
      }
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <group position={[0, lift, def.z]}>
      <mesh geometry={layout.merged} material={paper('#9aa7b5')[0]} />
      <instancedMesh ref={ref} args={[drop, mats, count]} castShadow frustumCulled={false} />
      <mesh position={[(def.x0 + def.x1) / 2, TOP + 0.2, 0]} rotation={[0, 0, Math.PI / 2]} material={stickMaterial()} castShadow>
        <cylinderGeometry args={[0.14, 0.14, def.x1 - def.x0 + 6, 7]} />
      </mesh>
      <Stick at={[(def.x0 + def.x1) / 2, TOP + 0.4, 0.1]} from="top" length={30} seed={`${def.seed}-stick`} tab={false} />
    </group>
  );
};

export const Rain: React.FC<{ frame: number }> = ({ frame }) => {
  const drop = useMemo(
    () => cutout('M 0 0.32 C 0.12 0.1 0.17 -0.05 0.17 -0.13 C 0.17 -0.26 0.08 -0.33 0 -0.33 C -0.08 -0.33 -0.17 -0.26 -0.17 -0.13 C -0.17 -0.05 -0.12 0.1 0 0.32 Z', { seed: 'raindrop', wobble: 0.004, step: 0.05 }),
    [],
  );
  const mats = useMemo(() => vellum('#c9dae6', '#a9c4dc', 0.35, false), []);
  const f = onTwos(frame);
  const [i0, i1] = BEATS.rainIn;
  const [o0, o1] = BEATS.rainStop;
  if (f < i0 - 2 || f > o1 + 2) return null;
  const down = seg(f, i0, i1, ease.outCubic);
  const up = seg(f, o0, o1, ease.inCubic);
  const lift = lerp(46, 0, down) - overshoot(f, i1, 0.6, 7, 4) + up * 48;
  return (
    <group>
      {RIGS.map((d, i) => (
        <Rig key={i} def={d} frame={frame} drop={drop} mats={mats} lift={lift + i * 0.3} />
      ))}
    </group>
  );
};
