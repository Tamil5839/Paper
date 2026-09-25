import React, { useMemo } from 'react';
import { C } from '../palette';
import { handWobble, onTwos } from '../lib/anim';
import { cutout } from '../paper/cutout';
import { brassMaterial, paper } from '../paper/materials';
import { circleD } from '../paper/path';
import { builderPose } from './actors';
import { ROOM } from './room';
import { Stick } from './Stick';

// The builder: a jointed paper puppet seated side-on, facing left. Head, arms
// and forearms turn on brass split pins; the face is just two dot eyes, so all
// the acting is in head tilt and posture.

const HOODIE = '#2f5f67';
const HOODIE_DARK = '#244a51';
const PANTS = '#2a2c4c';

export const Builder: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    const o = (d: string, seed: string) => cutout(d, { seed, wobble: 0.012, wavelength: 0.5, step: 0.12 });
    return {
      torso: o('M 1.0 -0.35 L -1.25 -0.35 C -1.45 0.4 -1.32 1.6 -1.05 2.6 C -0.9 3.2 -0.6 3.55 -0.15 3.62 L 0.35 3.6 C 0.8 3.5 1.05 3.1 1.1 2.4 C 1.18 1.5 1.2 0.4 1.0 -0.35 Z', 'b-torso'),
      hood: o('M -0.2 3.35 C 0.5 3.15 1.28 3.35 1.38 4.1 C 1.44 4.62 1.02 4.9 0.56 4.74 C 0.42 4.22 0.2 3.9 -0.2 3.8 Z', 'b-hood'),
      pocket: o('M -1.3 0.15 L 0.2 0.15 L 0.32 1.3 L -1.12 1.3 C -1.24 0.9 -1.3 0.5 -1.3 0.15 Z', 'b-pocket'),
      strings: o('M -0.52 3.45 L -0.45 3.45 L -0.58 2.45 L -0.65 2.45 Z M -0.3 3.45 L -0.23 3.45 L -0.33 2.5 L -0.4 2.5 Z', 'b-strings'),
      neck: o('M -0.4 -0.2 L 0.12 -0.2 L 0.14 0.45 L -0.38 0.45 Z', 'b-neck'),
      head: o('M -0.35 0.05 C 0.28 0.05 0.75 0.55 0.74 1.25 C 0.73 2.0 0.25 2.45 -0.36 2.45 C -0.98 2.45 -1.42 1.95 -1.43 1.3 L -1.58 0.98 L -1.4 0.9 C -1.3 0.4 -0.9 0.05 -0.35 0.05 Z', 'b-head'),
      hair: o('M -1.34 1.55 C -1.38 2.22 -0.92 2.62 -0.3 2.64 C 0.36 2.64 0.86 2.26 0.82 1.4 C 0.8 1.0 0.72 0.7 0.52 0.52 L 0.36 0.9 C 0.3 1.32 0.06 1.62 -0.34 1.72 C -0.56 1.8 -0.76 1.62 -0.9 1.82 C -1.05 1.72 -1.18 1.66 -1.34 1.55 Z', 'b-hair'),
      ear: o('M 0.24 0.96 C 0.5 0.96 0.56 1.44 0.24 1.46 C 0.1 1.4 0.1 1.02 0.24 0.96 Z', 'b-ear'),
      eyes: cutout([circleD(-1.1, 1.3, 0.085), circleD(-0.6, 1.32, 0.105)], { seed: 'b-eyes', wobble: 0.004 }),
      blush: cutout(circleD(-0.82, 0.92, 0.17), { seed: 'b-blush', wobble: 0.01 }),
      upper: o('M -0.36 0.25 C -0.36 0.47 0.36 0.47 0.36 0.25 L 0.34 -1.9 C 0.34 -2.12 -0.34 -2.12 -0.34 -1.9 Z', 'b-upper'),
      fore: o('M -0.31 0.15 L 0.31 0.15 L 0.29 -1.52 L -0.29 -1.52 Z', 'b-fore'),
      cuff: o('M -0.3 -1.34 L 0.3 -1.34 L 0.29 -1.56 L -0.29 -1.56 Z', 'b-cuff'),
      hand: o('M -0.25 -1.48 C -0.3 -1.92 -0.2 -2.2 0.0 -2.22 C 0.22 -2.2 0.3 -1.9 0.25 -1.48 Z', 'b-hand'),
      thigh: o('M 0.5 -0.46 L -2.6 -0.52 C -2.96 -0.46 -3.0 0.3 -2.64 0.36 L 0.4 0.42 Z', 'b-thigh'),
      shin: o('M -3.1 0.12 L -2.4 0.12 L -2.52 -3.5 L -3.04 -3.5 Z', 'b-shin'),
      shoe: o('M -3.2 -3.46 L -2.45 -3.46 C -2.38 -3.8 -2.5 -3.96 -2.72 -3.96 L -3.76 -3.96 C -3.98 -3.96 -4.02 -3.6 -3.6 -3.52 Z', 'b-shoe'),
      sole: o('M -3.8 -3.98 L -2.62 -3.98 L -2.64 -3.84 L -3.9 -3.84 Z', 'b-sole'),
      pin: cutout(circleD(0, 0, 0.1), { seed: 'b-pin' }),
    };
  }, []);
  const pose = builderPose(frame);
  const f = onTwos(frame);
  const [hx, hy, hz] = ROOM.hip;
  // the puppeteer's hand is never perfectly still
  const wx = handWobble(f, 'builder-x', 0.03, 0.4);
  const wy = handWobble(f, 'builder-y', 0.025, 0.4);
  const skin = paper(C.skin);
  const hoodie = paper({ color: HOODIE, edge: '#9fc1c4' });
  const sleeve = paper({ color: '#3b737c', edge: '#a9cdd0' });
  const hoodieFar = paper({ color: HOODIE_DARK, edge: '#7fa0a3' });
  const arm = (u: number, fo: number, far = false) => (
    <group position={[-0.25, 3.15, far ? -0.16 : 0.2]} rotation={[0, 0, -u]}>
      <mesh geometry={g.upper} material={far ? hoodieFar : sleeve} castShadow receiveShadow />
      <group position={[0, -1.9, 0.05]} rotation={[0, 0, -fo]}>
        <mesh geometry={g.fore} material={far ? hoodieFar : sleeve} castShadow receiveShadow />
        <mesh geometry={g.cuff} material={paper(far ? '#1f3f45' : '#27505a')} position={[0, 0, 0.03]} castShadow />
        <mesh geometry={g.hand} material={far ? paper('#8f5c3e') : skin} position={[0, 0, -0.02]} castShadow receiveShadow />
        {!far ? <mesh geometry={g.pin} material={brassMaterial()} position={[0, 0, 0.1]} /> : null}
      </group>
      {!far ? <mesh geometry={g.pin} material={brassMaterial()} position={[0, 0, 0.08]} /> : null}
    </group>
  );
  return (
    <group position={[hx + pose.hipDx + wx, hy + wy, hz]}>
      {/* far leg (behind) */}
      <group position={[0.25, 0, -0.26]}>
        <mesh geometry={g.thigh} material={paper('#23253f')} castShadow receiveShadow />
        <mesh geometry={g.shin} material={paper('#23253f')} castShadow receiveShadow />
        <mesh geometry={g.shoe} material={paper('#d3c9b5')} castShadow receiveShadow />
      </group>
      <group rotation={[0, 0, pose.lean]}>
        {arm(pose.farU, pose.farF, true)}
        <mesh geometry={g.hood} material={hoodieFar} position={[0, 0, -0.06]} castShadow receiveShadow />
        <mesh geometry={g.torso} material={hoodie} castShadow receiveShadow />
        <mesh geometry={g.pocket} material={paper(HOODIE_DARK)} position={[0, 0, 0.05]} castShadow />
        <mesh geometry={g.strings} material={paper(C.cream)} position={[0, 0, 0.07]} />
        <group position={[-0.2, 3.62, 0.03]} rotation={[0, 0, pose.head]}>
          <mesh geometry={g.neck} material={skin} position={[0, 0, -0.06]} castShadow />
          <mesh geometry={g.head} material={skin} castShadow receiveShadow />
          <mesh geometry={g.hair} material={paper(C.hair)} position={[0, 0, 0.05]} castShadow receiveShadow />
          <mesh geometry={g.ear} material={paper('#955f40')} position={[0, 0, 0.08]} castShadow />
          <mesh geometry={g.blush} material={paper('#b67c68')} position={[0, 0, 0.06]} />
          <mesh geometry={g.eyes} material={paper(C.hair)} position={[0, 0, 0.08]} />
          <mesh geometry={g.pin} material={brassMaterial()} position={[0.02, 0.1, 0.1]} />
        </group>
        {arm(pose.nearU, pose.nearF)}
      </group>
      <Stick at={[0.95, 0.9, -0.12]} from="right" length={34} seed="builder-stick" />
      {/* near leg (in front) */}
      <group position={[0, 0, 0.22]}>
        <mesh geometry={g.thigh} material={paper(PANTS)} castShadow receiveShadow />
        <mesh geometry={g.shin} material={paper(PANTS)} castShadow receiveShadow />
        <mesh geometry={g.shoe} material={paper('#efe6d2')} castShadow receiveShadow />
        <mesh geometry={g.sole} material={paper('#9a8c78')} position={[0, 0, 0.04]} />
      </group>
    </group>
  );
};
