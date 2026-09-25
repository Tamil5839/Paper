import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS } from '../story';
import { C } from '../palette';
import { clamp, handWobble, lerp, onTwos, seg } from '../lib/anim';
import { hash1, rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { inkStrokes, layoutText } from '../paper/lettering';
import { brassMaterial, paper, vellum } from '../paper/materials';
import { circleD, polyD, Pt, rectD, roundRectD } from '../paper/path';
import { printedPaper, printTexture } from '../paper/print';
import { getPaperTextures } from '../paper/textures';
import { CAL_DAYS, calendarPages, stackCount, TUMBLER_SPOTS, tumblerScales } from './actors';
import { ROOM } from './room';
import { Wire } from './Stick';

// The builder's things: desk and chair, a laptop whose screen is backlit vellum
// with cut-paper lines of "code", a desk lamp on split pins, filter coffee in a
// steel tumbler and dabara with a paper-curl of steam on a wire, a wicker
// wastebasket, a wall calendar and a stack of paper.

const R = ROOM;

let steelMat: THREE.MeshStandardMaterial | null = null;
const steel = () => {
  if (steelMat) return steelMat;
  const t = getPaperTextures();
  steelMat = new THREE.MeshStandardMaterial({ color: '#c6ccd1', metalness: 0.55, roughness: 0.34, map: t.map, normalMap: t.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) });
  return steelMat;
};

const Desk: React.FC = () => {
  const g = useMemo(() => {
    const front = cutout(
      polyD([[6.4, 6.6], [15.6, 6.6], [15.6, 6.15], [15.4, 6.15], [15.4, 1.2], [14.85, 1.2], [14.85, 6.15], [9.8, 6.15], [9.8, 3.6], [7.15, 3.6], [7.15, 1.2], [6.6, 1.2], [6.6, 6.15], [6.4, 6.15]]),
      { seed: 'desk-front', wobble: 0.02 },
    );
    const drawer = cutout(rectD(7.35, 3.85, 2.25, 2.1), { seed: 'drawer', wobble: 0.01 });
    const knob = cutout(circleD(8.47, 4.95, 0.17), { seed: 'knob' });
    const top = cutout(rectD(6.3, -R.desk.zFront - 0.05, 9.4, R.desk.zFront - R.desk.zBack + 0.1), { seed: 'desk-top', wobble: 0.02 });
    const back = cutout([rectD(6.6, 1.2, 0.55, 5.3), rectD(14.85, 1.2, 0.55, 5.3)], { seed: 'desk-back' });
    const chair = cutout(
      [
        polyD([[16.15, 4.72], [18.95, 4.72], [18.95, 5.05], [16.15, 5.05]]),
        polyD([[16.3, 1.2], [16.62, 1.2], [16.62, 4.75], [16.3, 4.75]]),
        polyD([[18.5, 1.2], [18.82, 1.2], [18.85, 4.75], [18.52, 4.75]]),
        polyD([[18.55, 5.0], [18.9, 5.0], [19.5, 10.3], [19.15, 10.3]]),
        polyD([[18.9, 7.6], [19.7, 7.5], [19.95, 9.9], [19.2, 10.0]]),
        rectD(16.5, 2.6, 2.2, 0.22),
      ],
      { seed: 'chair', wobble: 0.015 },
    );
    return { front, drawer, knob, top, back, chair };
  }, []);
  const wood = paper({ color: '#8a5d3b', edge: '#d9b58a' });
  return (
    <group>
      <mesh geometry={g.back} material={paper('#5e3f28')} position={[0, 0, R.desk.zBack + 0.1]} castShadow receiveShadow />
      <mesh geometry={g.top} material={wood} rotation={[-Math.PI / 2, 0, 0]} position={[0, R.deskTop - 0.03, 0]} castShadow receiveShadow />
      <mesh geometry={g.front} material={wood} position={[0, 0, R.desk.zFront]} castShadow receiveShadow />
      <mesh geometry={g.drawer} material={paper('#9a6c47')} position={[0, 0, R.desk.zFront + 0.08]} castShadow receiveShadow />
      <mesh geometry={g.knob} material={brassMaterial()} position={[0, 0, R.desk.zFront + 0.15]} castShadow />
      <mesh geometry={g.chair} material={paper({ color: '#5b3d2a', edge: '#caa47a' })} position={[0, 0, -7.95]} castShadow receiveShadow />
    </group>
  );
};

const CODE_LINES = (() => {
  const r = rng('code');
  return Array.from({ length: 64 }, () => ({ indent: Math.floor(r.next() * 4) * 0.22, len: r.range(0.35, 2.1), accent: r.next() < 0.25 }));
})();

const Laptop: React.FC<{ frame: number; glow: number }> = ({ frame, glow }) => {
  const g = useMemo(() => {
    const keysTex = printTexture('keys', 3.6, 2.4, 60, (ctx, w, h) => {
      ctx.fillStyle = '#4a4f5a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2c3039';
      const kw = w / 13;
      for (let row = 0; row < 5; row++) {
        for (let c = 0; c < 12; c++) {
          const x = kw * 0.55 + c * kw + (row % 2) * kw * 0.3;
          const y = h * 0.1 + row * (h * 0.11);
          ctx.fillRect(x, y, kw * 0.78, h * 0.085);
        }
      }
      ctx.fillStyle = '#3a3f49';
      ctx.fillRect(w * 0.33, h * 0.68, w * 0.34, h * 0.22);
    });
    const base = cutout(roundRectD(-1.8, -1.2, 3.6, 2.4, 0.15), { seed: 'laptop-base', thickness: 0.14, wobble: 0.01, uvFit: [-1.8, -1.2, 3.6, 2.4] });
    const baseMat = printedPaper('keys', keysTex, 3.6, 2.4, '#8b919b', '#4a4f58');
    const lid = cutout(roundRectD(-1.8, 0, 3.6, 2.5, 0.14), { seed: 'laptop-lid', thickness: 0.1, wobble: 0.01 });
    const screen = cutout(rectD(-1.55, 0.2, 3.1, 2.1), { seed: 'laptop-screen', wobble: 0.008 });
    const strip = cutout(rectD(0, -0.045, 1, 0.09), { seed: 'code-strip', wobble: 0 }, 'code-strip');
    return { base, baseMat, lid, screen, strip };
  }, []);
  const mats = useMemo(() => ({ screen: vellum('#e6eefc', '#cfe0ff', 1.4), code: paper('#34405e'), accent: paper('#5a7a8a') }), []);
  (mats.screen[0] as THREE.MeshLambertMaterial).emissiveIntensity = 1.5 * glow;
  const f = onTwos(frame);
  // code scrolls while the builder types: one new cut strip per few drawings
  const typedFrames = [
    [0, 470],
    [562, 574],
    [622, 638],
    [758, 806],
    [846, 880],
    [940, 998],
  ].reduce((acc, [a, b]) => acc + clamp(f - a, 0, b - a), 0);
  const lineCount = Math.floor(typedFrames / 7);
  const shown = 9;
  const first = Math.max(0, lineCount - shown);
  const lines = [];
  for (let i = first; i < lineCount; i++) {
    const L = CODE_LINES[i % CODE_LINES.length];
    const row = i - first;
    lines.push(
      <mesh key={i} geometry={g.strip} material={L.accent ? mats.accent : mats.code} position={[-1.35 + L.indent, 2.08 - row * 0.21, 0.1]} scale={[L.len, 1, 1]} />,
    );
  }
  return (
    <group position={[R.laptop.x, R.deskTop + 0.07, R.laptop.z]} rotation={[0, 0.42, 0]}>
      <mesh geometry={g.base} material={g.baseMat} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <group position={[0, 0.05, -1.15]} rotation={[-0.24, 0, 0]}>
        <mesh geometry={g.lid} material={paper({ color: '#3b4049', edge: '#9aa0aa' })} castShadow receiveShadow />
        <mesh geometry={g.screen} material={mats.screen} position={[0, 0, 0.06]} />
        {lines}
      </group>
    </group>
  );
};

const Lamp: React.FC<{ level: number }> = ({ level }) => {
  const g = useMemo(() => {
    const base = cutout('M 6.5 6.6 L 8.9 6.6 C 8.9 7.1 8.3 7.35 7.7 7.35 C 7.1 7.35 6.5 7.1 6.5 6.6 Z', { seed: 'lamp-base', wobble: 0.015 });
    const arm = (a: Pt, b: Pt, w: number) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const l = Math.hypot(dx, dy);
      const nx = (-dy / l) * (w / 2);
      const ny = (dx / l) * (w / 2);
      return polyD([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    };
    const lower = cutout(arm([7.7, 7.1], [8.35, 10.65], 0.3), { seed: 'lamp-lower', wobble: 0.01 });
    const upper = cutout(arm([8.35, 10.65], [9.45, 11.75], 0.26), { seed: 'lamp-upper', wobble: 0.01 });
    const shade = cutout('M -0.42 0.25 L 0.42 0.25 C 0.6 0.2 0.7 -0.2 0.85 -0.6 L 1.25 -1.55 L -1.25 -1.55 L -0.85 -0.6 C -0.7 -0.2 -0.6 0.2 -0.42 0.25 Z', { seed: 'lamp-shade', wobble: 0.015 });
    const bulb = cutout('M -1.1 -1.5 L 1.1 -1.5 L 0.8 -1.2 L -0.8 -1.2 Z', { seed: 'lamp-bulb' });
    const pin = cutout(circleD(0, 0, 0.13), { seed: 'pin' }, 'split-pin');
    return { base, lower, upper, shade, bulb, pin };
  }, []);
  const bulbMat = useMemo(() => vellum('#fff1cf', '#ffc36a', 3), []);
  (bulbMat[0] as THREE.MeshLambertMaterial).emissiveIntensity = 3.4 * level;
  const z = R.lampBase[2];
  const lampCol = paper({ color: '#2f5b58', edge: '#a8c4bd' });
  return (
    <group>
      <mesh geometry={g.base} material={lampCol} position={[0, 0, z]} castShadow receiveShadow />
      <mesh geometry={g.lower} material={lampCol} position={[0, 0, z - 0.08]} castShadow receiveShadow />
      <mesh geometry={g.upper} material={lampCol} position={[0, 0, z + 0.08]} castShadow receiveShadow />
      <group position={[9.45, 11.75, z + 0.16]} rotation={[0, 0, 0.5]}>
        <mesh geometry={g.bulb} material={bulbMat} position={[0, 0, -0.04]} />
        <mesh geometry={g.shade} material={lampCol} castShadow receiveShadow />
      </group>
      {[[7.7, 7.1], [8.35, 10.65], [9.45, 11.75]].map((p, i) => (
        <mesh key={i} geometry={g.pin} material={brassMaterial()} position={[p[0], p[1], z + 0.28]} />
      ))}
    </group>
  );
};

const Coffee: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    const tumbler = cutout('M -0.42 0 L 0.42 0 L 0.5 1.55 L 0.57 1.62 L 0.57 1.74 L -0.57 1.74 L -0.57 1.62 L -0.5 1.55 Z', { seed: 'tumbler', thickness: 0.1, wobble: 0.01 });
    const dabara = cutout('M -0.55 0 L 0.55 0 C 0.9 0.05 1.05 0.35 1.08 0.72 L 1.13 0.79 L -1.13 0.79 L -1.08 0.72 C -1.05 0.35 -0.9 0.05 -0.55 0 Z', { seed: 'dabara', thickness: 0.1, wobble: 0.01 });
    const shine = cutout([rectD(-0.3, 0.25, 0.1, 1.2), rectD(0.12, 0.3, 0.05, 1.1)], { seed: 'shine', wobble: 0.005 });
    const dShine = cutout(rectD(-0.8, 0.45, 1.5, 0.07), { seed: 'dshine' });
    const pts: Pt[] = [];
    const pts2: Pt[] = [];
    for (let i = 0; i <= 24; i++) {
      const y = (i / 24) * 1.7;
      const x = Math.sin(y * 3.4) * 0.28 * (0.5 + y * 0.4);
      const w = 0.11 * (1 - y / 2.2);
      pts.push([x - w, y]);
      pts2.push([x + w, y]);
    }
    const curl = cutout(polyD([...pts, ...pts2.reverse()]), { seed: 'steam', wobble: 0.01 });
    return { tumbler, dabara, shine, dShine, curl };
  }, []);
  const scales = tumblerScales(frame);
  const f = onTwos(frame);
  const shineMat = paper({ color: '#f4f6f7' });
  return (
    <group>
      {TUMBLER_SPOTS.map((p, i) => {
        const s = scales[i];
        if (s <= 0) return null;
        const appeared = i === 0 ? -200 : BEATS.tumblers[i - 1];
        const steaming = f - appeared < 150 && f < BEATS.skySwap[0];
        const bob = (f % 24) / 24;
        return (
          <group key={i} position={p} scale={[s, s, s]} rotation={[0, (hash1(i, 3) - 0.5) * 0.3, 0]}>
            <mesh geometry={g.dabara} material={steel()} castShadow receiveShadow />
            <mesh geometry={g.dShine} material={shineMat} position={[0, 0, 0.07]} />
            <group position={[0, 0.34, -0.12]}>
              <mesh geometry={g.tumbler} material={steel()} castShadow receiveShadow />
              <mesh geometry={g.shine} material={shineMat} position={[0, 0, 0.07]} />
            </group>
            {steaming ? (
              <group position={[0.05, 2.2 + bob * 0.35, -0.12]} rotation={[0, f * 0.12 + i, handWobble(f, `steam${i}`, 0.08, 1)]}>
                <mesh geometry={g.curl} material={paper({ color: '#f3efe6', normalScale: 0.3 })} castShadow />
                <Wire at={[0, -0.6, 0]} length={3.2} radius={0.012} />
              </group>
            ) : null}
          </group>
        );
      })}
    </group>
  );
};

const Wastebasket: React.FC = () => {
  const g = useMemo(() => {
    const tex = printTexture('wicker', 3.3, 3.4, 40, (ctx, w, h) => {
      ctx.fillStyle = '#b8925c';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(96,64,32,0.55)';
      ctx.lineWidth = 2.2;
      for (let x = -h; x < w + h; x += 9) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + h, h);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x + h, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(80,52,28,0.5)';
      ctx.fillRect(0, 0, w, 7);
      ctx.fillRect(0, h - 5, w, 5);
    });
    const shape = polyD([[-1.2, 0], [1.2, 0], [1.62, 3.4], [-1.62, 3.4]]);
    const front = cutout(shape, { seed: 'basket-front', wobble: 0.02, uvFit: [-1.65, 0, 3.3, 3.4] });
    const back = cutout(shape, { seed: 'basket-back', wobble: 0.02 });
    const rim = cutout(roundRectD(-1.78, 3.3, 3.56, 0.32, 0.12), { seed: 'basket-rim', wobble: 0.01 });
    return { front, back, rim, mat: printedPaper('wicker', tex, 3.3, 3.4, '#e3c89a', '#8d6a40') };
  }, []);
  const [x, y, z] = R.basket;
  return (
    <group position={[x, y, z]}>
      <mesh geometry={g.back} material={paper('#6e5031')} position={[0, 0, -0.75]} castShadow receiveShadow />
      <mesh geometry={g.front} material={g.mat} position={[0, 0, 0.75]} castShadow receiveShadow />
      <mesh geometry={g.rim} material={paper('#c9a46a')} position={[0, 0, 0.82]} castShadow receiveShadow />
    </group>
  );
};

const Calendar: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    const pages = CAL_DAYS.map((day, i) => {
      const tex = printTexture(`cal-${day}`, 3.2, 3.75, 44, (ctx, w, h) => {
        ctx.fillStyle = '#f3ecdc';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#5a7e7a';
        ctx.fillRect(0, 0, w, h * 0.14);
        // big day number in the film's hand
        const lay = layoutText(String(day), 1.75, `day-${day}`, 0.012, 0.05, 0);
        inkStrokes(ctx, lay.strokes, (3.2 / 2 - lay.width / 2) * 44, 2.35 * 44, 44, 0.24, i === 5 ? '#23244a' : '#2e3048', `ink-${day}`);
        // week grid
        ctx.fillStyle = 'rgba(60,60,80,0.45)';
        for (let r = 0; r < 3; r++) for (let c = 0; c < 7; c++) ctx.fillRect(0.25 * 44 + c * 0.4 * 44, 2.75 * 44 + r * 0.28 * 44, 0.16 * 44, 0.12 * 44);
      });
      const geo = cutout(rectD(-1.6, -3.75, 3.2, 3.75), { seed: `cal-page-${i}`, wobble: 0.015, uvFit: [-1.6, -3.75, 3.2, 3.75] });
      return { geo, mat: printedPaper(`cal-${day}`, tex, 3.2, 3.75) };
    });
    const header = cutout(roundRectD(-1.75, -0.1, 3.5, 0.85, 0.12), { seed: 'cal-header', wobble: 0.01 });
    const nail = cutout(circleD(0, 0, 0.12), { seed: 'nail' });
    return { pages, header, nail };
  }, []);
  const state = calendarPages(frame);
  const [x, y, z] = R.calendar;
  return (
    <group position={[x, y, z]}>
      <mesh geometry={g.nail} material={brassMaterial()} position={[0, 2.4, 0.02]} />
      <mesh position={[-0.55, 1.6, 0.01]} rotation={[0, 0, -0.62]}>
        <cylinderGeometry args={[0.012, 0.012, 1.95, 3]} />
        <meshLambertMaterial color="#4a4038" />
      </mesh>
      <mesh position={[0.55, 1.6, 0.01]} rotation={[0, 0, 0.62]}>
        <cylinderGeometry args={[0.012, 0.012, 1.95, 3]} />
        <meshLambertMaterial color="#4a4038" />
      </mesh>
      <mesh geometry={g.header} material={paper('#3f5d59')} position={[0, 0.25, 0.03]} castShadow receiveShadow />
      {g.pages.map((p, i) => {
        const s = state[i];
        if (s.gone) return null;
        const zOff = 0.05 + (g.pages.length - i) * 0.012;
        const dropY = -s.drop * 12;
        const dropX = s.drop * 1.6;
        return (
          <group key={i} position={[dropX, 0.3 + dropY, zOff + s.drop * 2.2]} rotation={[-s.flip * Math.PI * 0.86 + s.drop * 1.2, s.drop * 0.8, s.drop * 0.9]}>
            <mesh geometry={p.geo} material={p.mat} castShadow receiveShadow />
          </group>
        );
      })}
    </group>
  );
};

const PaperStack: React.FC<{ frame: number }> = ({ frame }) => {
  const geo = useMemo(() => cutout(rectD(-1.3, -1.3, 2.6, 2.6), { seed: 'sheet', wobble: 0.02 }, 'sheet'), []);
  const n = stackCount(frame);
  const [x, y, z] = R.stack;
  return (
    <group position={[x, y, z]}>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} geometry={geo} material={paper(C.paperWhite)} position={[(hash1(i, 8) - 0.5) * 0.2, 0.09 + i * 0.07, (hash1(i, 9) - 0.5) * 0.2]} rotation={[-Math.PI / 2, 0, (hash1(i, 7) - 0.5) * 0.25]} castShadow receiveShadow />
      ))}
    </group>
  );
};

export const Props: React.FC<{ frame: number; lampLevel: number; screenGlow: number }> = ({ frame, lampLevel, screenGlow }) => (
  <group>
    <Desk />
    <Laptop frame={frame} glow={screenGlow} />
    <Lamp level={lampLevel} />
    <Coffee frame={frame} />
    <Wastebasket />
    <Calendar frame={frame} />
    <PaperStack frame={frame} />
  </group>
);

export const _u = { lerp, seg };
