import React, { useMemo } from 'react';
import * as THREE from 'three';
import { C } from '../palette';
import { cutout, mergeCutouts, m4 } from '../paper/cutout';
import { offsetRings } from '../paper/lettering';
import { paper } from '../paper/materials';
import { circleD, polyD, Pt, rectD, Ring, scallopBandD } from '../paper/path';
import { printedPaper, printTexture } from '../paper/print';
import { archedPanel, birdEmblem, blob, diamondD, multifoilArch, pointsAlong, scallopedDome } from '../paper/shapes';
import { rng } from '../lib/random';

// The toy theatre itself: an ornate cream proscenium arch built from several
// layers of card spaced a few millimetres apart on paper tabs, a stage floor,
// masking wings, the cardboard box, and a row of paper bushes along the front.

export const ARCH_Z = 6; // front face of the proscenium
export const OPEN_HALF_W = 25;
export const OPEN_SPRING = 30.5;
export const OPEN_TOP = 36.5;
export const APRON_Z = 11;
export const BOX_HALF_W = 37;
export const BOX_BACK_Z = -36;
export const BOX_TOP = 50;
export const BASE_BOTTOM = -9.5;

const openingRing = (): Ring => [
  [-OPEN_HALF_W, 0],
  [OPEN_HALF_W, 0],
  ...multifoilArch(OPEN_HALF_W, OPEN_SPRING, OPEN_TOP, 7, 1.15),
];

const M = (mats: THREE.Material[], geo: THREE.BufferGeometry, p: [number, number, number] = [0, 0, 0], key?: string, rot?: [number, number, number]) => (
  <mesh key={key} geometry={geo} material={mats} position={p} rotation={rot} castShadow receiveShadow />
);

const Proscenium: React.FC = () => {
  const g = useMemo(() => {
    const open = openingRing();
    const outer =
      'M -36 0 L 36 0 L 36 41 L 37.6 41.4 L 37.6 44.6 L 36.4 45 L 36 47.2 C 26 47.6 16 48.6 9 50.6 L -9 50.6 C -16 48.6 -26 47.6 -36 47.2 L -36.4 45 L -37.6 44.6 L -37.6 41.4 L -36 41 Z';
    const base = cutout([outer, polyD(open)], { seed: 'arch-base', wobble: 0.05, bend: (x) => -0.00012 * x * x });

    // teal border band hugging the opening
    const inner = offsetRings([open], 0.28);
    const outerBand = offsetRings([open], 2.3);
    const bandRings = [...outerBand, ...inner].map((r) => polyD(r));
    const band = cutout(bandRings, { seed: 'arch-band', wobble: 0.04 });

    // ochre dots riding on the band + ochre pilaster frames + capitals
    const mid = offsetRings([open], 1.3)[0];
    const dotPts = pointsAlong(mid.filter((p) => p[1] > 0.8), 2.35, false).filter((p) => p[1] > 1.2);
    const dots = cutout(dotPts.map((p, i) => (i % 3 === 0 ? diamondD(p[0], p[1], 0.9, 0.9) : circleD(p[0], p[1], 0.3))), { seed: 'arch-dots', wobble: 0.01 });

    const pil: string[] = [];
    for (const s of [-1, 1]) {
      const x0 = s > 0 ? 27.3 : -34.7;
      const outerP = archedPanel(x0, x0 + 7.4, 2.2, 39.6);
      const innerP = archedPanel(x0 + 0.75, x0 + 7.4 - 0.75, 2.95, 38.85);
      pil.push(polyD(outerP), polyD(innerP));
    }
    const pilasterFrames = cutout(pil, { seed: 'pil-frames', wobble: 0.03 });

    const caps: string[] = [];
    for (const s of [-1, 1]) {
      const xa = s > 0 ? 26.3 : -37.9;
      caps.push(scallopBandD(xa, xa + 11.6, 45.4, 41.7, 6, 0.55));
    }
    caps.push(scallopBandD(-36.4, 36.4, 47.9, 46.4, 36, 0.28));
    const capitals = cutout(caps, { seed: 'caps', wobble: 0.03 });

    // indigo "printed" details: diamond chains in the pilasters, lines, stars on frieze
    const det: string[] = [];
    for (const s of [-1, 1]) {
      const cx = s * 31;
      for (let y = 6; y < 35; y += 3.3) det.push(diamondD(cx, y, 1.9, 2.7));
      det.push(rectD(cx - 3.1, 3.4, 0.18, 34.2), rectD(cx + 2.92, 3.4, 0.18, 34.2));
      det.push(circleD(cx, 36.4, 0.85));
    }
    for (let x = -34; x <= 34.1; x += 4.25) det.push(circleD(x, 43.9, 0.32));
    const details = cutout(det, { seed: 'arch-det', wobble: 0.015 });

    const cream: string[] = [];
    for (const s of [-1, 1]) {
      const cx = s * 31;
      for (let y = 6; y < 35; y += 3.3) cream.push(circleD(cx, y, 0.32));
    }
    const creamDots = cutout(cream, { seed: 'arch-cream', wobble: 0.01 });

    // crest: scalloped cartouche, sunburst, medallion and a folded-bird emblem
    const dome = scallopedDome(0, 48.6, 11.5, 9.8, 11, 0.8);
    const crest = cutout(polyD([...dome, [-11.5, 47.2], [11.5, 47.2]]), { seed: 'crest', wobble: 0.04 });
    const dome2 = scallopedDome(0, 48.9, 9.6, 8.0, 9, 0.55);
    const crestBand = cutout([polyD([...dome2, [-9.6, 48.1], [9.6, 48.1]]), polyD(scallopedDome(0, 49.2, 8.4, 6.9, 9, 0.3).concat([[-8.4, 48.9], [8.4, 48.9]] as Pt[]))], { seed: 'crest-band', wobble: 0.03 });
    const rays: string[] = [];
    for (let i = 0; i < 13; i++) {
      const a = (i / 12) * Math.PI;
      const r0 = 4.2;
      const r1 = 7.6 - (i % 2) * 1.1;
      const c = [0, 49.4];
      const w = 0.12;
      rays.push(
        polyD([
          [c[0] + Math.cos(a - w) * r0, c[1] + Math.sin(a - w) * r0],
          [c[0] + Math.cos(a) * r1, c[1] + Math.sin(a) * r1],
          [c[0] + Math.cos(a + w) * r0, c[1] + Math.sin(a + w) * r0],
        ]),
      );
    }
    const sun = cutout(rays, { seed: 'rays', wobble: 0.02 });
    const medRing = cutout(circleD(0, 52.2, 3.9), { seed: 'med-ring' });
    const medallion = cutout(circleD(0, 52.2, 3.3), { seed: 'medallion' });
    const emblem = cutout(birdEmblem(0.05, 51.7, 1.75), { seed: 'emblem', wobble: 0.015 });

    // tiny spacer tabs (folded card) between the base and the front layers
    const tabs: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const tabG = cutout(rectD(-0.35, -0.2, 0.7, 0.4), { seed: 'spacer', wobble: 0.01 });
    const r = rng('tabs');
    for (const p of [...pointsAlong(mid, 7.5, true)].filter((q) => q[1] > 1)) {
      tabs.push({ geo: tabG, matrix: m4(p[0] + (r.next() - 0.5), p[1], 0.2, 0, 1, 0, Math.PI / 2) });
    }
    const spacers = mergeCutouts(tabs);
    return { base, band, dots, pilasterFrames, capitals, details, creamDots, crest, crestBand, sun, medRing, medallion, emblem, spacers };
  }, []);

  return (
    <group position={[0, 0, ARCH_Z]}>
      {M(paper({ color: C.cream, normalScale: 0.6 }), g.base, [0, 0, 0])}
      {M(paper({ color: '#d8c7a4' }), g.spacers, [0, 0, 0])}
      {M(paper(C.tealMid), g.band, [0, 0, 0.36])}
      {M(paper(C.ochre), g.dots, [0, 0, 0.44])}
      {M(paper(C.ochre), g.pilasterFrames, [0, 0, 0.32])}
      {M(paper(C.ochre), g.capitals, [0, 0, 0.3])}
      {M(paper(C.indigo), g.details, [0, 0, 0.42])}
      {M(paper(C.cream), g.creamDots, [0, 0, 0.5])}
      {M(paper({ color: C.cream, normalScale: 0.6 }), g.crest, [0, 0, 0.12])}
      {M(paper(C.ochre), g.crestBand, [0, 0, 0.4])}
      {M(paper(C.gold), g.sun, [0, 0, 0.5])}
      {M(paper(C.cream), g.medRing, [0, 0, 0.62])}
      {M(paper(C.indigo), g.medallion, [0, 0, 0.72])}
      {M(paper(C.paperWhite), g.emblem, [0, 0, 0.84])}
    </group>
  );
};

/** Decorated front of the stage platform below the arch (the apron). */
const Apron: React.FC = () => {
  const g = useMemo(() => {
    const panel = cutout(rectD(-BOX_HALF_W, BASE_BOTTOM, BOX_HALF_W * 2, -BASE_BOTTOM), { seed: 'apron', wobble: 0.04 });
    const trim = cutout(scallopBandD(-BOX_HALF_W + 0.4, BOX_HALF_W - 0.4, -0.3, -1.6, 30, 0.5), { seed: 'apron-trim' });
    const orn: string[] = [];
    for (let x = -33; x <= 33.1; x += 5.5) {
      orn.push(diamondD(x, -5.2, 2.4, 2.4));
    }
    const ornaments = cutout(orn, { seed: 'apron-orn', wobble: 0.02 });
    const dots: string[] = [];
    for (let x = -33; x <= 33.1; x += 5.5) {
      dots.push(circleD(x, -5.2, 0.42));
      dots.push(circleD(x + 2.75, -5.2, 0.22));
    }
    const ornDots = cutout(dots, { seed: 'apron-dots', wobble: 0.01 });
    const lower = cutout(rectD(-BOX_HALF_W + 0.4, BASE_BOTTOM + 0.5, BOX_HALF_W * 2 - 0.8, 0.5), { seed: 'apron-line' });
    return { panel, trim, ornaments, ornDots, lower };
  }, []);
  return (
    <group position={[0, 0, APRON_Z]}>
      {M(paper(C.tealDark), g.panel)}
      {M(paper(C.ochre), g.trim, [0, 0, 0.25])}
      {M(paper(C.cream), g.ornaments, [0, 0, 0.22])}
      {M(paper(C.indigo), g.ornDots, [0, 0, 0.32])}
      {M(paper(C.ochre), g.lower, [0, 0, 0.2])}
    </group>
  );
};

/** Stage floor (printed boards), the platform box, the cardboard theatre box and masking wings. */
const StageAndBox: React.FC = () => {
  const g = useMemo(() => {
    const depth = APRON_Z - BOX_BACK_Z;
    const tex = printTexture('stage-boards', BOX_HALF_W * 2, depth, 14, (ctx, w, h) => {
      ctx.fillStyle = '#3d3044';
      ctx.fillRect(0, 0, w, h);
      const r = rng('boards');
      const boardW = 3.2 * 14;
      for (let x = 0; x < w; x += boardW) {
        const tone = 44 + r.next() * 14;
        ctx.fillStyle = `rgb(${tone + 12}, ${tone - 2}, ${tone + 10})`;
        ctx.fillRect(x + 1, 0, boardW - 2, h);
        ctx.fillStyle = 'rgba(20,14,26,0.8)';
        ctx.fillRect(x, 0, 1.6, h);
        let y = r.next() * h;
        while (y < h) {
          ctx.fillRect(x, y, boardW, 1.4);
          y += (30 + r.next() * 30) * 14 * 0.25;
        }
      }
    });
    // drawn in XY with y = -z, then laid flat (rotation.x = -90°)
    const floorGeo = cutout(rectD(-BOX_HALF_W, -APRON_Z, BOX_HALF_W * 2, depth), {
      seed: 'floor',
      wobble: 0.03,
      uvFit: [-BOX_HALF_W, -APRON_Z, BOX_HALF_W * 2, depth],
    });
    const floorMat = printedPaper('stage-boards', tex, BOX_HALF_W * 2, depth);

    // wings (legs): tall dark flats with a foliage edge on the stage side
    const legs: { geo: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
    const legZ = [3.2, -8.6, -21.5];
    legZ.forEach((z, li) => {
      for (const s of [-1, 1]) {
        const r = rng(`leg${li}${s}`);
        const pts: Pt[] = [[36.5, 0]];
        const x0 = 25.6 + li * 0.6;
        pts.push([x0 + r.next() * 0.6, 0]);
        for (let y = 2; y < 48; y += 2.2) pts.push([x0 + (Math.sin(y * 0.9 + li) * 0.5 + r.next() * 0.7) - (y > 40 ? (y - 40) * 0.3 : 0), y]);
        pts.push([36.5, 48]);
        const geo = cutout(polyD(pts), { seed: `leg-${li}-${s}`, wobble: 0.06 });
        legs.push({ geo, matrix: new THREE.Matrix4().makeScale(s, 1, 1).premultiply(new THREE.Matrix4().makeTranslation(0, 0, z)) });
      }
    });
    const legsGeo = mergeCutouts(legs);

    // side walls: right wall uses rotation +90° (local x = -z), left wall -90° (local x = z)
    const sideR = cutout(rectD(-ARCH_Z, 0, ARCH_Z - BOX_BACK_Z, BOX_TOP), { seed: 'box-side-r', wobble: 0.05, thickness: 0.3 });
    const sideL = cutout(rectD(BOX_BACK_Z, 0, ARCH_Z - BOX_BACK_Z, BOX_TOP), { seed: 'box-side-l', wobble: 0.05, thickness: 0.3 });
    const platR = cutout(rectD(-APRON_Z, BASE_BOTTOM, APRON_Z - BOX_BACK_Z, -BASE_BOTTOM), { seed: 'plat-r', thickness: 0.3 });
    const platL = cutout(rectD(BOX_BACK_Z, BASE_BOTTOM, APRON_Z - BOX_BACK_Z, -BASE_BOTTOM), { seed: 'plat-l', thickness: 0.3 });
    const back = cutout(rectD(-BOX_HALF_W, BASE_BOTTOM, BOX_HALF_W * 2, BOX_TOP - BASE_BOTTOM), { seed: 'box-back', thickness: 0.3 });
    const topBar = new THREE.BoxGeometry(BOX_HALF_W * 2 + 0.6, 0.8, 1.2);
    return { floorGeo, floorMat, legsGeo, sideR, sideL, platR, platL, back, topBar };
  }, []);
  const kraft = paper({ color: C.kraft, back: '#8d6f4c' });
  return (
    <group>
      <mesh geometry={g.floorGeo} material={g.floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow castShadow />
      {M(paper({ color: '#141a30', normalScale: 0.4 }), g.legsGeo)}
      {/* cardboard box sides, platform sides and back */}
      <mesh geometry={g.sideR} material={kraft} position={[BOX_HALF_W + 0.2, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.sideL} material={kraft} position={[-BOX_HALF_W - 0.2, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.platR} material={kraft} position={[BOX_HALF_W + 0.25, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.platL} material={kraft} position={[-BOX_HALF_W - 0.25, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.back} material={kraft} position={[0, 0, BOX_BACK_Z - 0.2]} castShadow receiveShadow />
      <mesh geometry={g.topBar} material={kraft[0]} position={[0, BOX_TOP, -8]} castShadow />
      <mesh geometry={g.topBar} material={kraft[0]} position={[0, BOX_TOP, -24]} castShadow />
    </group>
  );
};

/** Paper bushes along the front edge of the stage, where footlights would be. */
const Bushes: React.FC = () => {
  const rows = useMemo(() => {
    const defs = [
      { z: 8.2, h: [3.2, 4.6], w: [4.5, 7], color: C.greenDark, seed: 'bush-a' },
      { z: 9.2, h: [2.4, 3.6], w: [4, 6.5], color: C.green, seed: 'bush-b' },
      { z: 10.2, h: [1.6, 2.6], w: [3.5, 5.5], color: '#2e5a4b', seed: 'bush-c' },
    ];
    return defs.map((d) => {
      const r = rng(d.seed);
      const shapes: string[] = [];
      let x = -BOX_HALF_W + 0.5 + r.next() * 2;
      let i = 0;
      while (x < BOX_HALF_W - 1) {
        const w = d.w[0] + r.next() * (d.w[1] - d.w[0]);
        const h = d.h[0] + r.next() * (d.h[1] - d.h[0]);
        const pts = blob(x + w / 2, 0, w, h, 3 + Math.floor(r.next() * 3), `${d.seed}-${i}`);
        shapes.push(polyD([...pts, [x + w * 0.05, -0.3], [x + w * 0.95, -0.3]]));
        x += w * (0.55 + r.next() * 0.25);
        i++;
      }
      return { geo: cutout(shapes, { seed: d.seed, wobble: 0.05 }), color: d.color, z: d.z };
    });
  }, []);
  return (
    <group>
      {rows.map((row, i) => (
        <mesh key={i} geometry={row.geo} material={paper({ color: row.color, normalScale: 0.7 })} position={[0, 0, row.z]} castShadow receiveShadow />
      ))}
    </group>
  );
};

export const Theatre: React.FC = () => (
  <group>
    <Proscenium />
    <Apron />
    <StageAndBox />
    <Bushes />
  </group>
);
