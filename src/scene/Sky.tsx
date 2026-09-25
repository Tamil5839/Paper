import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { ease, handWobble, lerp, onTwos, overshoot, seg, track, V3 } from '../lib/anim';
import { rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper, vellum } from '../paper/materials';
import { circleD, polyD, rectD, starD } from '../paper/path';
import { blob } from '../paper/shapes';
import { Stick } from './Stick';

// Back of the set: the night sky flat (stars are real pinholes with a light box
// behind), the dawn flat waiting in the flies, a vellum moon and a paper sun on
// sticks, and paper clouds.

export const SKY_Z = -32.5;
export const DAWN_Z = -31.8;
const X0 = -38;
const X1 = 38;
const Y0 = -2;
const Y1 = 50;

const lin = (hex: string) => new THREE.Color(hex);
const gradient = (stops: [number, string][]) => {
  const cols = stops.map(([y, h]) => [y, lin(h)] as const);
  return (_x: number, y: number): [number, number, number] => {
    let i = 0;
    while (i < cols.length - 2 && y > cols[i + 1][0]) i++;
    const [ya, ca] = cols[i];
    const [yb, cb] = cols[i + 1];
    const t = Math.min(1, Math.max(0, (y - ya) / (yb - ya)));
    const c = ca.clone().lerp(cb, t);
    return [c.r, c.g, c.b];
  };
};

export const moonPos = (frame: number): V3 => {
  const f = onTwos(frame);
  const [m0, m1] = BEATS.moonCross;
  const t = seg(f, m0, m1, ease.inOutSine);
  // travels right-to-left in an arc across the sky while time passes
  // rises over the left of the city, arcs across and sinks toward the rooftops
  const x = track(t, [[0, -17], [0.55, -11], [1, -7]]);
  const y = track(t, [[0, 30.5], [0.5, 27.5], [1, 20]]);
  const out = seg(f, BEATS.skySwap[0] - 30, BEATS.skySwap[0] + 20, ease.inCubic);
  return [x + handWobble(f, 'moon-x', 0.12, 0.4), y + handWobble(f, 'moon-y', 0.1, 0.4) + out * 62, -30.7];
};

export const sunY = (frame: number) => {
  const f = onTwos(frame);
  const [s0, s1] = BEATS.sunRise;
  return lerp(-9, 23.5, seg(f, s0, s1, ease.outCubic)) + handWobble(f, 'sun', 0.1, 0.5);
};

export const Sky: React.FC<{ frame: number; stars: number; flash: number }> = ({ frame, stars, flash }) => {
  const g = useMemo(() => {
    const r = rng('stars');
    const holes: string[] = [];
    for (let i = 0; i < 190; i++) {
      const x = r.range(X0 + 1, X1 - 1);
      const y = r.range(10, Y1 - 2);
      const k = r.next();
      if (k < 0.05) holes.push(starD(x, y, r.range(0.3, 0.42), r.range(0.1, 0.14), 4, r.range(0, 1)));
      else if (k < 0.3) holes.push(circleD(x, y, r.range(0.1, 0.15)));
      else holes.push(circleD(x, y, r.range(0.05, 0.085)));
    }
    const night = cutout([rectD(X0, Y0, X1 - X0, Y1 - Y0), ...holes], {
      seed: 'night-sky',
      wobble: 0.08,
      step: 0.6,
      subdivide: 2,
      bend: (x) => -0.0007 * x * x,
      color: gradient([
        [0, '#2c4478'],
        [14, '#243468'],
        [30, '#1b2156'],
        [50, '#12143c'],
      ]),
    });
    const dawn = cutout(rectD(X0, Y0, X1 - X0, Y1 - Y0), {
      seed: 'dawn-sky',
      wobble: 0.08,
      step: 0.6,
      subdivide: 2,
      bend: (x) => -0.0006 * x * x,
      color: gradient([
        [2, '#f9e0a2'],
        [11, '#f8c89e'],
        [21, '#f4b4b2'],
        [33, '#e2b0c4'],
        [50, '#c0a6cc'],
      ]),
    });
    const moon = cutout(circleD(0, 0, 3.0), { seed: 'moon', wobble: 0.04 });
    const craters = cutout([circleD(-0.95, 0.7, 0.62), circleD(1.05, -0.55, 0.4), circleD(0.25, -1.4, 0.3), circleD(0.8, 1.3, 0.25)], { seed: 'craters', wobble: 0.02 });
    const halo = cutout([circleD(0, 0, 4.0), circleD(0, 0, 3.12)], { seed: 'moon-halo', wobble: 0.05 });
    const sun = cutout(circleD(0, 0, 3.7), { seed: 'sun', wobble: 0.04 });
    const rays: string[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const w = 0.16;
      const r1 = i % 2 ? 5.4 : 6.4;
      rays.push(polyD([[Math.cos(a - w) * 3.2, Math.sin(a - w) * 3.2], [Math.cos(a) * r1, Math.sin(a) * r1], [Math.cos(a + w) * 3.2, Math.sin(a + w) * 3.2]]));
    }
    const sunRays = cutout(rays, { seed: 'sun-rays', wobble: 0.02 });
    const clouds = [
      { x: -21, y: 34, w: 10, h: 2.8, seed: 'cloud-a', speed: 0.011 },
      { x: 5, y: 40, w: 8, h: 2.4, seed: 'cloud-b', speed: -0.008 },
      { x: 23, y: 31.5, w: 11.5, h: 3.2, seed: 'cloud-c', speed: 0.009 },
    ].map((c) => ({
      ...c,
      body: cutout(polyD(blob(0, 0, c.w, c.h, 5, c.seed, false)), { seed: c.seed, wobble: 0.05 }),
      rim: cutout(polyD(blob(-0.25, 0.22, c.w * 0.92, c.h * 0.9, 5, c.seed + 'r', false)), { seed: c.seed + 'rim', wobble: 0.05 }),
    }));
    return { night, dawn, moon, craters, halo, sun, sunRays, clouds };
  }, []);

  const mats = useMemo(
    () => ({
      box: new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.4, 4.2) }),
      moon: vellum('#f1ead6', '#fff0cf', 1.6),
      crater: vellum('#ddd3bc', '#e8dcc0', 0.9),
      halo: vellum('#cfd5e6', '#c8d4f0', 0.35),
      sun: vellum('#f6d27f', '#ffcf6e', 1.9),
      dawn: (() => {
        // a translucent sunrise backcloth: glows with its own printed gradient (lit from behind)
        const m = paper({ color: '#ffffff', vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.55, back: '#a08a78', unique: true });
        const front = m[0] as THREE.MeshLambertMaterial;
        front.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance *= vColor.rgb;');
        };
        front.customProgramCacheKey = () => 'dawn-backcloth';
        return m;
      })(),
      rays: vellum('#f2cf86', '#f3b85c', 0.7),
    }),
    [],
  );
  mats.box.color.setRGB(3.2 * stars + flash * 5, 3.4 * stars + flash * 5, 4.2 * stars + flash * 6);

  const f = onTwos(frame);
  const [sw0, sw1] = BEATS.skySwap;
  const dawnDrop = seg(f, sw0, sw1, ease.inOutCubic);
  const dawnY = lerp(56, 0, dawnDrop) + overshoot(f, sw1, 0.5, 7, 4);
  const mp = moonPos(frame);
  const sy = sunY(frame);
  return (
    <group>
      <mesh position={[0, (Y0 + Y1) / 2, SKY_Z - 2.4]} material={mats.box}>
        <planeGeometry args={[X1 - X0 - 3, Y1 - Y0 - 2]} />
      </mesh>
      <mesh geometry={g.night} material={paper({ color: '#ffffff', vertexColors: true, back: '#1a1a2a' })} position={[0, 0, SKY_Z]} castShadow receiveShadow />
      {dawnDrop > 0 ? (
        <group position={[0, dawnY, DAWN_Z]}>
          <mesh geometry={g.dawn} material={mats.dawn} castShadow receiveShadow />
          <Stick at={[-22, Y1 - 1, 0]} from="top" length={70} seed="dawn-l" />
          <Stick at={[22, Y1 - 1, 0]} from="top" length={70} seed="dawn-r" />
        </group>
      ) : null}
      <group position={[0, sy, -31.15]}>
        <mesh geometry={g.sunRays} material={mats.rays} position={[0, 0, -0.12]} rotation={[0, 0, f * 0.002]} castShadow receiveShadow />
        <mesh geometry={g.sun} material={mats.sun} castShadow receiveShadow />
        <Stick at={[0, -2.8, -0.2]} from="bottom" length={40} seed="sun-stick" />
      </group>
      <group position={mp}>
        <mesh geometry={g.halo} material={mats.halo} position={[0, 0, -0.18]} />
        <mesh geometry={g.moon} material={mats.moon} castShadow receiveShadow />
        <mesh geometry={g.craters} material={mats.crater} position={[0, 0, 0.06]} />
        <Stick at={[0, 2.6, -0.1]} from="top" length={45} seed="moon-stick" />
      </group>
      {g.clouds.map((c, i) => {
        // at dawn the clouds are hauled up into the flies on their sticks (never out of the box)
        const away = seg(f, BEATS.skySwap[0] - 16 + i * 6, BEATS.skySwap[1] + i * 6, ease.inCubic);
        const x = c.x + c.speed * f + away * (c.x < 0 ? -4 : 4) + handWobble(f, c.seed, 0.15, 0.4);
        return (
          <group key={i} position={[x, c.y + away * 34 + handWobble(f, c.seed + 'y', 0.08, 0.3), -29.6 + i * 0.35]}>
            <mesh geometry={c.rim} material={paper('#8c92ba')} position={[0, 0, -0.08]} castShadow receiveShadow />
            <mesh geometry={c.body} material={paper('#5d6590')} castShadow receiveShadow />
            <Stick at={[c.w * 0.18, c.h * 0.6, -0.05]} from="top" length={40} seed={c.seed + 'stick'} />
          </group>
        );
      })}
    </group>
  );
};
