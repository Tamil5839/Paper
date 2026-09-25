import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { C } from '../palette';
import { ease, handWobble, lerp, onTwos, seg } from '../lib/anim';
import { hash1 } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper, vellum } from '../paper/materials';
import { circleD, rectD, roundRectD } from '../paper/path';
import { Stick } from './Stick';

// The street: a compound wall with a gate, a small shop with a glowing sign,
// a sodium street lamp, an electric pole with sagging wires, a road printed on
// the stage floor, and an auto-rickshaw puppet that crosses once on its stick.

export const STREET_Z = -15.2;
export const AUTO_Z = -13.3;

const Auto: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    // side view, facing +x, origin at the ground under the rear wheel, ~8.6 cm long
    const body = cutout(
      'M -0.6 0.9 L 6.2 0.9 C 7.2 0.9 7.9 1.3 8.1 2.2 L 8.2 3.3 C 8.2 3.8 7.8 4.0 7.3 4.0 L 6.6 4.0 L 6.2 2.6 L 0.6 2.6 L 0.2 3.2 L -0.6 3.2 Z',
      { seed: 'auto-body', wobble: 0.02 },
    );
    const canopy = cutout(
      'M -0.9 3.0 L -0.7 5.9 C -0.6 6.3 -0.3 6.5 0.2 6.5 L 5.9 6.5 C 6.5 6.5 6.9 6.2 7.1 5.6 L 7.4 4.0 L 6.6 4.0 L 6.2 5.6 L 0.3 5.6 L 0.1 3.0 Z',
      { seed: 'auto-canopy', wobble: 0.02 },
    );
    const glass = cutout('M 6.25 4.1 L 7.25 4.1 L 7.05 5.5 L 6.35 5.5 Z', { seed: 'auto-glass' });
    const trim = cutout(rectD(-0.5, 2.0, 6.6, 0.22), { seed: 'auto-trim' });
    const wheel = cutout([circleD(0, 0, 0.95), circleD(0, 0, 0.2)], { seed: 'wheel', wobble: 0.015 });
    const hub = cutout([circleD(0, 0, 0.5), circleD(0, 0, 0.2)], { seed: 'hub' });
    const spoke = cutout(rectD(-0.45, -0.07, 0.9, 0.14), { seed: 'spoke' });
    const lamp = cutout(circleD(0, 0, 0.32), { seed: 'auto-lamp' });
    const driver = cutout('M 4.3 2.6 L 5.6 2.6 L 5.7 4.3 C 5.9 4.4 6.0 4.8 5.8 5.1 C 5.5 5.5 4.9 5.4 4.8 5.0 C 4.7 4.7 4.9 4.4 5.0 4.3 L 4.4 4.2 Z', { seed: 'driver' });
    return { body, canopy, glass, trim, wheel, hub, spoke, lamp, driver };
  }, []);
  const lampMat = useMemo(() => vellum('#fff2cf', '#ffe3a0', 2.2), []);
  const f = onTwos(frame);
  const [a0, a1] = BEATS.auto;
  if (f < a0 - 2 || f > a1 + 2) return null;
  const t = seg(f, a0, a1, ease.inOutSine);
  const x = lerp(-62, 30, t);
  const bump = (hash1(f >> 1, 33) - 0.5) * 0.12 + Math.abs(Math.sin(f * 0.9)) * 0.06;
  const rot = x / 0.95;
  const W = (p: [number, number]) => (
    <group position={[p[0], p[1], 0.1]} rotation={[0, 0, -rot]}>
      <mesh geometry={g.wheel} material={paper('#15161c')} castShadow />
      <mesh geometry={g.hub} material={paper(C.cream)} position={[0, 0, 0.07]} />
      <mesh geometry={g.spoke} material={paper('#15161c')} position={[0, 0, 0.12]} />
    </group>
  );
  return (
    <group position={[x, 0.95 + bump, AUTO_Z]} rotation={[0, 0, handWobble(f, 'auto-rz', 0.012, 1)]}>
      <mesh geometry={g.driver} material={paper('#1c1a26')} position={[0, 0, -0.1]} castShadow />
      <mesh geometry={g.body} material={paper('#2e6a58')} castShadow receiveShadow />
      <mesh geometry={g.trim} material={paper(C.cream)} position={[0, 0, 0.07]} castShadow />
      <mesh geometry={g.canopy} material={paper('#c9a347')} position={[0, 0, 0.05]} castShadow receiveShadow />
      <mesh geometry={g.glass} material={paper('#8fa8b4')} position={[0, 0, -0.05]} />
      <mesh geometry={g.lamp} material={lampMat} position={[7.9, 3.0, 0.1]} />
      {W([0.6, 0.0])}
      {W([6.7, 0.0])}
      <Stick at={[-0.4, 1.8, -0.02]} from="left" length={70} seed="auto-stick" />
    </group>
  );
};

export const Street: React.FC<{ frame: number; lampOn: number }> = ({ frame, lampOn }) => {
  const g = useMemo(() => {
    const wall: string[] = [];
    // compound wall with pillars and a gate gap
    wall.push('M -39 -1 L -39 4.6 L -28.8 4.6 L -28.8 -1 Z');
    wall.push('M -23.2 -1 L -23.2 4.6 L 3 4.6 L 3 -1 Z');
    for (let x = -38; x <= 2; x += 5.2) wall.push(rectD(x - 0.45, -1, 0.9, 5.4), rectD(x - 0.6, 5.3, 1.2, 0.35));
    const wallGeo = cutout(wall, { seed: 'street-wall', wobble: 0.04 });
    // gate: frame with bars cut out
    const gate: string[] = [rectD(-28.9, 0, 5.8, 4.4)];
    for (let i = 0; i < 9; i++) gate.push(rectD(-28.4 + i * 0.58, 0.5, 0.36, 3.4));
    const gateGeo = cutout(gate, { seed: 'gate', wobble: 0.01 });
    // shop: box with shutter (printed ribs) and a sign
    const shop = cutout('M -12.5 -1 L -12.5 7.2 L -3.6 7.2 L -3.6 -1 Z', { seed: 'shop', wobble: 0.03 });
    const ribs: string[] = [];
    for (let y = 0.4; y < 4.9; y += 0.42) ribs.push(rectD(-11.6, y, 7.2, 0.16));
    const shutter = cutout([rectD(-11.8, 0, 7.6, 5.2)], { seed: 'shutter', wobble: 0.02 });
    const ribGeo = cutout(ribs, { seed: 'ribs', wobble: 0.005 });
    const sign = cutout(roundRectD(-11.9, 5.5, 7.8, 1.45, 0.3), { seed: 'sign', wobble: 0.02 });
    const signMarks = cutout([rectD(-10.9, 5.95, 1.4, 0.5), rectD(-9.1, 5.95, 2.6, 0.5), circleD(-5.6, 6.2, 0.3), rectD(-6.1, 5.95, 0.1, 0.5)], { seed: 'sign-marks' });
    // street lamp: pole, arm, head
    const lamp = cutout('M -15.0 -1 L -14.55 -1 L -14.6 10.4 C -14.6 11.4 -14.1 11.9 -13.1 11.9 L -12.2 11.9 L -12.2 12.25 L -13.1 12.25 C -14.4 12.25 -15.0 11.6 -15.0 10.4 Z', { seed: 'streetlamp', wobble: 0.01 });
    const lampHead = cutout('M -13.2 11.7 L -11.2 11.7 L -11.6 12.5 L -12.8 12.5 Z', { seed: 'lamp-head', wobble: 0.01 });
    const lampGlass = cutout('M -13.0 11.35 L -11.4 11.35 L -11.3 11.72 L -13.1 11.72 Z', { seed: 'lamp-glass' });
    // electric pole with a crossarm
    const pole = cutout([rectD(-34.6, -1, 0.55, 14.8), rectD(-36.2, 12.4, 3.8, 0.35), rectD(-36, 12.75, 0.22, 0.45), rectD(-34.5, 12.75, 0.22, 0.45), rectD(-32.9, 12.75, 0.22, 0.45)], { seed: 'pole', wobble: 0.01 });
    // road printed on the floor (x in XY is x, y in XY becomes -z)
    const road = cutout([rectD(-38, 9.7, 41.5, 5.2)], { seed: 'road', wobble: 0.04 });
    const dashes: string[] = [];
    for (let x = -37; x < 3; x += 3) dashes.push(rectD(x, 12.15, 1.4, 0.22));
    const dashGeo = cutout(dashes, { seed: 'dashes', wobble: 0.01 });
    const kerb = cutout(rectD(-38.5, 14.4, 42, 0.8), { seed: 'kerb', wobble: 0.02 });
    // wires: three sagging threads from the pole toward the building
    const wires = [0, 1, 2].map((i) => {
      const a = new THREE.Vector3(-36 + i * 1.5, 13.1, 0);
      const b = new THREE.Vector3(3 + i * 0.3, 12.2 - i * 0.4, 0);
      const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -2.2 - i * 0.2, 0));
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      return new THREE.TubeGeometry(curve, 40, 0.018, 3, false);
    });
    return { wallGeo, gateGeo, shop, shutter, ribGeo, sign, signMarks, lamp, lampHead, lampGlass, pole, road, dashGeo, kerb, wires };
  }, []);
  const mats = useMemo(() => ({ sign: vellum('#e9d7ad', '#ffc56e', 1.4), lampGlass: vellum('#fff0c8', '#ffb347', 3.2) }), []);
  (mats.sign[0] as THREE.MeshLambertMaterial).emissiveIntensity = 0.75 * lampOn;
  (mats.lampGlass[0] as THREE.MeshLambertMaterial).emissiveIntensity = 3.2 * lampOn;
  return (
    <group>
      <group position={[0, 0, STREET_Z]}>
        <mesh geometry={g.wallGeo} material={paper('#3a4670')} castShadow receiveShadow />
        <mesh geometry={g.gateGeo} material={paper('#1e2233')} position={[0, 0, 0.12]} castShadow receiveShadow />
        <mesh geometry={g.shop} material={paper('#44527a')} position={[0, 0, -0.35]} castShadow receiveShadow />
        <mesh geometry={g.shutter} material={paper('#6b7488')} position={[0, 0, 0.05]} castShadow receiveShadow />
        <mesh geometry={g.ribGeo} material={paper('#4d5568')} position={[0, 0, 0.1]} />
        <mesh geometry={g.sign} material={mats.sign} position={[0, 0, 0.1]} castShadow />
        <mesh geometry={g.signMarks} material={paper('#3a3040')} position={[0, 0, 0.16]} />
        <mesh geometry={g.lamp} material={paper('#24283a')} position={[0, 0, 0.4]} castShadow receiveShadow />
        <mesh geometry={g.lampHead} material={paper('#24283a')} position={[0, 0, 0.44]} castShadow />
        <mesh geometry={g.lampGlass} material={mats.lampGlass} position={[0, 0, 0.42]} />
        <mesh geometry={g.pole} material={paper('#262a38')} position={[0, 0, 0.6]} castShadow receiveShadow />
        {g.wires.map((w, i) => (
          <mesh key={i} geometry={w} position={[0, 0, 0.7 + i * 0.05]} castShadow>
            <meshLambertMaterial color="#20222c" />
          </mesh>
        ))}
      </group>
      {/* road on the stage floor */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <mesh geometry={g.road} material={paper('#2a2c3c')} receiveShadow />
        <mesh geometry={g.kerb} material={paper('#4a4f63')} position={[0, 0, 0.04]} receiveShadow />
        <mesh geometry={g.dashGeo} material={paper('#c8bd9e')} position={[0, 0, 0.05]} receiveShadow />
      </group>
      <Auto frame={frame} />
    </group>
  );
};
