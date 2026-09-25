import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { C } from '../palette';
import { clamp, ease, lerp, onTwos, seg, V3 } from '../lib/anim';
import { crumpledBall, birdParts } from '../paper/origami';
import { getPaperTextures } from '../paper/textures';
import { ballsAt, BirdState, birdsAt, HOLD_POINT, lostWingState, RED_REST, redSheet } from './actors';
import { Wire } from './Stick';

// Paper birds (origami, wings flap by folding along creases), their crumpled
// remains, a torn-off wing, and the coral sheet that becomes the bird that flies.

const matCache = new Map<string, THREE.MeshLambertMaterial>();
export const foldedPaper = (color: string, key = color) => {
  let m = matCache.get(key);
  if (!m) {
    const t = getPaperTextures();
    m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(color),
      map: t.map,
      normalMap: t.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
      side: THREE.DoubleSide,
      flatShading: true,
    });
    if (color === C.coral) {
      // the hero bird keeps a whisper of its own colour even in the dark
      m.emissive = new THREE.Color(C.coral);
      m.emissiveIntensity = 0.1;
    }
    matCache.set(key, m);
  }
  return m;
};

const CREAM = '#f3ead6';
const BALL_SEEDS: Record<string, number> = { bird1: 11, bird2: 22, bird3: 33, wet: 44 };

export type BirdExtra = { neck?: number; tail?: number; wings?: number; head?: number; body?: number };

export const Bird: React.FC<{ s: BirdState; extra?: BirdExtra; thread?: boolean }> = ({ s, extra, thread }) => {
  const parts = birdParts();
  const wetMat = useMemo(() => foldedPaper(CREAM, `wet-${s.id}`), [s.id]);
  let mat: THREE.Material;
  if (s.red) mat = foldedPaper(C.coral);
  else if (s.wet > 0) {
    (wetMat as THREE.MeshLambertMaterial).color.set(CREAM).lerp(new THREE.Color('#9d9c94'), s.wet * 0.7);
    mat = wetMat;
  } else mat = foldedPaper(CREAM);
  const flapBase = lerp(-0.55, 1.15, (s.flap + 1) / 2);
  const flap = lerp(flapBase, -0.8, s.droop);
  const fold = Math.max(s.fold, s.crumple);
  const outer = lerp(flap * 0.35 + fold * 2.3, -0.7, s.droop * 0.8);
  const sc = s.scale * (1 - s.crumple);
  const sqY = 1 - 0.38 * s.squash;
  const sqXZ = 1 + 0.22 * s.squash;
  const e = { neck: 1, tail: 1, wings: 1, head: 1, body: 1, ...extra };
  const wing = (side: 1 | -1) => {
    if (s.lostWing && side === 1) return null;
    return (
      <group key={side} position={[0, 0.05, 0]} rotation={[side * -flap, 0, 0]} scale={[e.wings, e.wings, side * e.wings]}>
        <mesh geometry={parts.wingInner} material={mat} castShadow />
        <group position={[0, 0, parts.crease]} rotation={[-outer, 0, 0]}>
          <mesh geometry={parts.wingOuter} material={mat} castShadow />
        </group>
      </group>
    );
  };
  const ballSeed = BALL_SEEDS[s.id] ?? 55;
  return (
    <group position={s.pos}>
      {thread ? <Wire at={[0, 0.25, 0]} length={45} radius={0.008} /> : null}
      <group rotation={[0, s.yaw, 0]}>
        <group rotation={new THREE.Euler(s.roll, 0, s.pitch, 'ZYX')}>
          {sc > 0.01 ? (
            <group scale={[sc * sqXZ, sc * sqY, sc * sqXZ]}>
              <mesh geometry={parts.body} material={mat} scale={[e.body, e.body, e.body]} castShadow />
              <group position={parts.neckRoot} rotation={[0, 0, -s.droop * 0.9]} scale={[e.neck, e.neck, 1]}>
                <mesh geometry={parts.neck} material={mat} castShadow />
                <group position={[0.56, 0.68, 0]} rotation={[0, 0, -s.droop * 0.6]} scale={[e.head, e.head, 1]}>
                  <mesh geometry={parts.head} material={mat} castShadow />
                </group>
              </group>
              <group position={parts.tailRoot} rotation={[0, 0, s.droop * 0.5]} scale={[e.tail, e.tail, 1]}>
                <mesh geometry={parts.tail} material={mat} castShadow />
              </group>
              {wing(1)}
              {wing(-1)}
            </group>
          ) : null}
          {s.crumple > 0 ? (
            <mesh geometry={crumpledBall(ballSeed)} material={foldedPaper(CREAM)} scale={lerp(0.35, 1, s.crumple)} castShadow receiveShadow />
          ) : null}
        </group>
      </group>
    </group>
  );
};

const LostWing: React.FC<{ frame: number }> = ({ frame }) => {
  const st = lostWingState(frame);
  if (!st) return null;
  const parts = birdParts();
  const mat = foldedPaper(CREAM);
  return (
    <group position={st.pos} rotation={st.rot}>
      <mesh geometry={parts.wingInner} material={mat} castShadow receiveShadow />
      <group position={[0, 0, parts.crease]} rotation={[-0.2, 0, 0]}>
        <mesh geometry={parts.wingOuter} material={mat} castShadow receiveShadow />
      </group>
    </group>
  );
};

/** The coral sheet: under the stack, pulled out, folded twice, then shaped into the bird. */
const RedSheet: React.FC<{ frame: number }> = ({ frame }) => {
  const geos = useMemo(() => {
    const h = 1.84; // half diagonal of a 2.6 cm square
    const tri = (a: V3, b: V3, c: V3) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute([a[0] * 0.3, a[1] * 0.3, b[0] * 0.3, b[1] * 0.3, c[0] * 0.3, c[1] * 0.3], 2));
      g.computeVertexNormals();
      return g;
    };
    return {
      tl: tri([-h, 0, 0], [0, 0, 0], [0, h, 0]),
      tr: tri([0, 0, 0], [h, 0, 0], [0, h, 0]),
      bl: tri([-h, 0, 0], [0, -h, 0], [0, 0, 0]),
      br: tri([0, -h, 0], [h, 0, 0], [0, 0, 0]),
    };
  }, []);
  const st = redSheet(frame);
  if (!st) return null;
  const mat = foldedPaper(C.coral);
  const f2 = onTwos(frame);
  const [f0, f1, f2d, f3, f4] = st.folds;
  void f0;
  if (f1 < 1 || f2d <= 0) {
    // lying under the stack as a square; lifted upright as a diamond; folded in half, then in half again
    return (
      <group position={st.pos} rotation={[(-Math.PI / 2) * st.flat, 0, 0]}>
        <group rotation={[0, 0, (Math.PI / 4 + 0.06) * st.flat]}>
          <mesh geometry={geos.br} material={mat} castShadow receiveShadow />
          <group rotation={[f0 * Math.PI * 0.97, 0, 0]}>
            <mesh geometry={geos.tr} material={mat} position={[0, 0, 0.004]} castShadow receiveShadow />
          </group>
          <group rotation={[0, -f1 * Math.PI * 0.96, 0]}>
            <mesh geometry={geos.bl} material={mat} position={[0, 0, 0.008]} castShadow receiveShadow />
            <group rotation={[f0 * Math.PI * 0.97, 0, 0]}>
              <mesh geometry={geos.tl} material={mat} position={[0, 0, 0.012]} castShadow receiveShadow />
            </group>
          </group>
        </group>
      </group>
    );
  }
  // shaping: neck and tail pulled out, wings opened, head reverse-folded
  const toDesk = seg(f2, BEATS.folds[4] - 6, BEATS.birdMade, ease.inOutSine);
  const pos: V3 = [lerp(HOLD_POINT[0], RED_REST[0], toDesk), lerp(HOLD_POINT[1], RED_REST[1], toDesk), lerp(HOLD_POINT[2], RED_REST[2], toDesk)];
  const s: BirdState = {
    id: 'forming',
    pos,
    yaw: lerp(Math.PI * 0.5, Math.PI - 0.35, clamp(f2d * 0.5 + toDesk * 0.5)),
    pitch: 0.1,
    roll: 0,
    flap: lerp(-1, 0.35, f3),
    fold: lerp(1, 0.15, f3),
    droop: 0,
    scale: lerp(0.6, 1, f2d),
    crumple: 0,
    squash: 0,
    lostWing: false,
    wet: 0,
    red: true,
  };
  return (
    <group>
      {f2d < 1 ? (
        <group position={pos} scale={1 - f2d} rotation={[0, 0, Math.PI / 4]}>
          <mesh geometry={geos.br} material={mat} castShadow />
        </group>
      ) : null}
      <Bird s={s} extra={{ neck: Math.max(0.05, f2d), tail: Math.max(0.05, f2d), wings: Math.max(0.05, f3), head: Math.max(0.05, f4), body: lerp(0.5, 1, f2d) }} />
    </group>
  );
};

export const Birds: React.FC<{ frame: number }> = ({ frame }) => {
  const birds = birdsAt(frame);
  const balls = ballsAt(frame);
  const f2 = onTwos(frame);
  const threaded = (b: BirdState) => {
    if (b.crumple > 0 || b.lostWing) return false;
    if (b.id === 'bird1') return f2 < BEATS.bird1.falter;
    if (b.id === 'bird2') return f2 < BEATS.bird2.ceiling;
    if (b.id === 'bird3') return true;
    if (b.id === 'wet') return f2 < BEATS.wetBird.droop;
    if (b.id === 'red') return f2 >= BEATS.lift;
    return false;
  };
  return (
    <group>
      {birds.map((b) => (
        <Bird key={b.id} s={b} thread={threaded(b)} />
      ))}
      {balls.map((b) => (
        <mesh key={b.id} geometry={crumpledBall(b.seed)} material={foldedPaper(CREAM)} position={b.pos} rotation={b.rot} scale={b.scale} castShadow receiveShadow />
      ))}
      <LostWing frame={frame} />
      <RedSheet frame={frame} />
    </group>
  );
};

