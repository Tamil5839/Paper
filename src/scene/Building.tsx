import React, { useMemo } from 'react';
import * as THREE from 'three';
import { C } from '../palette';
import { onTwos } from '../lib/anim';
import { rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { offsetRings } from '../paper/lettering';
import { paper, vellum } from '../paper/materials';
import { circleD, polyD, Pt, rectD, Ring } from '../paper/path';
import { printedPaper, printTexture } from '../paper/print';
import { BUILDING, ROOM } from './room';

// The builder's building: a pastel facade with the ground-floor room cut away
// (so we look straight in), upper windows with sunshades, a roof tank; inside,
// a tiled floor, plaster walls with a window onto the city, a ceiling fan, a
// shelf of books and a few sticky notes.

const R = ROOM;

export const Building: React.FC<{ frame: number; upperLit: number }> = ({ frame, upperLit }) => {
  const g = useMemo(() => {
    const open: Ring = [
      [R.x0, R.floorY],
      [R.x1, R.floorY],
      [R.x1, R.ceilY],
      [R.x0, R.ceilY],
    ];
    const upperWins: Ring[] = [
      [[7.2, 18.6], [11.6, 18.6], [11.6, 23.0], [7.2, 23.0]],
      [[16.0, 18.6], [20.4, 18.6], [20.4, 23.0], [16.0, 23.0]],
    ];
    const facadeOutline: Pt[] = [[BUILDING.x0, 0], [BUILDING.x1, 0], [BUILDING.x1, BUILDING.top]];
    for (let x = BUILDING.x1 - 0.6; x > BUILDING.x0 + 0.5; x -= 1.3) facadeOutline.push([x, BUILDING.top], [x, BUILDING.top + 0.55], [x - 0.65, BUILDING.top + 0.55], [x - 0.65, BUILDING.top]);
    facadeOutline.push([BUILDING.x0, BUILDING.top]);
    const facade = cutout([polyD(facadeOutline), polyD(open), ...upperWins.map(polyD)], { seed: 'facade', wobble: 0.04 });
    // cream trims: a frame around the cutaway, window surrounds, a cornice band
    const trimRings = [...offsetRings([open], 0.55), ...offsetRings([open], 0.05)];
    const winTrims = upperWins.flatMap((w) => [...offsetRings([w], 0.45), ...offsetRings([w], 0.02)]);
    const trims = cutout([...trimRings, ...winTrims].map(polyD).concat([rectD(BUILDING.x0, 16.9, BUILDING.x1 - BUILDING.x0, 0.45), rectD(BUILDING.x0, BUILDING.top - 0.7, BUILDING.x1 - BUILDING.x0, 0.35)]), { seed: 'facade-trim', wobble: 0.02 });
    // upper windows: glass panes (vellum) with a mullion and grille
    const grille: string[] = [];
    for (const w of upperWins) {
      const [a, , c] = w;
      grille.push(rectD((a[0] + c[0]) / 2 - 0.1, a[1], 0.2, c[1] - a[1]));
      for (let y = a[1] + 0.9; y < c[1]; y += 0.9) grille.push(rectD(a[0], y, c[0] - a[0], 0.08));
    }
    const grilleGeo = cutout(grille, { seed: 'grille', wobble: 0.005 });
    const panes = cutout(upperWins.map(polyD), { seed: 'upper-panes', wobble: 0 });
    // chajja: sunshade slab over each upper window (horizontal card sticking out)
    const chajja = cutout(rectD(0, 0, 5.8, 1.5), { seed: 'chajja', wobble: 0.02 });
    // roof: stair room + water tank (behind the parapet)
    const roofBits = cutout(['M 5 27 L 9.5 27 L 9.5 30.6 L 5 30.6 Z', 'M 18.6 27 L 18.8 28.6 L 18.9 28.6 L 18.9 31.2 L 19.6 31.6 L 21.8 31.6 L 22.5 31.2 L 22.5 28.6 L 22.6 28.6 L 22.8 27 Z'], { seed: 'roof-bits', wobble: 0.03 });

    // --- room shell ---
    const W = R.x1 - R.x0;
    const D = R.frontZ - R.backZ;
    const tiles = printTexture('floor-tiles', W, D, 24, (ctx, w, h) => {
      const s = 1.55 * 24;
      for (let y = 0; y < h; y += s) {
        for (let x = 0; x < w; x += s) {
          const odd = (Math.round(x / s) + Math.round(y / s)) % 2;
          ctx.fillStyle = odd ? '#d8c29a' : '#9c7b58';
          ctx.fillRect(x, y, s, s);
          ctx.fillStyle = odd ? 'rgba(160,120,80,0.35)' : 'rgba(230,205,160,0.35)';
          ctx.beginPath();
          ctx.arc(x + s / 2, y + s / 2, s * 0.22, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = 'rgba(60,40,30,0.45)';
      ctx.lineWidth = 1.2;
      for (let x = 0; x < w; x += s) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += s) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    });
    // floor drawn in XY with y = -z (then laid flat)
    const floor = cutout(rectD(R.x0, -R.frontZ, W, D), { seed: 'room-floor', wobble: 0.02, uvFit: [R.x0, -R.frontZ, W, D] });
    const floorMat = printedPaper('floor-tiles', tiles, W, D);

    const wallH = R.ceilY - R.floorY;
    const wallTex = printTexture('back-wall', W, wallH, 20, (ctx, w, h) => {
      ctx.fillStyle = '#e4cfa6';
      ctx.fillRect(0, 0, w, h);
      // tiny printed stencil motif, typical of old Bangalore homes
      const r = rng('wall-motif');
      ctx.fillStyle = 'rgba(170,120,70,0.18)';
      for (let y = 20; y < h - 70; y += 34) {
        for (let x = 12 + ((y / 34) % 2) * 17; x < w; x += 34) {
          ctx.beginPath();
          ctx.arc(x, y, 3.2 + r.next(), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // dado band
      ctx.fillStyle = '#7f8b68';
      ctx.fillRect(0, h - 3.2 * 20, w, 3.2 * 20);
      ctx.fillStyle = '#5f6b4c';
      ctx.fillRect(0, h - 3.3 * 20, w, 0.18 * 20);
    });
    const winRing: Ring = [[R.win.x0, R.win.y0], [R.win.x1, R.win.y0], [R.win.x1, R.win.y1], [R.win.x0, R.win.y1]];
    const backWall = cutout([rectD(R.x0, R.floorY, W, wallH), polyD(winRing)], { seed: 'back-wall', wobble: 0.02, uvFit: [R.x0, R.floorY, W, wallH] });
    const backMat = printedPaper('back-wall', wallTex, W, wallH, '#efe2c8', '#cdbd9f');
    // window frame + mullions + sill
    const frameRings = [...offsetRings([winRing], 0.55), ...offsetRings([winRing], 0.02)];
    const mid = (R.win.x0 + R.win.x1) / 2;
    const frame = cutout(
      frameRings.map(polyD).concat([rectD(mid - 0.14, R.win.y0, 0.28, R.win.y1 - R.win.y0), rectD(R.win.x0, 11.3, R.win.x1 - R.win.x0, 0.24)]),
      { seed: 'win-frame', wobble: 0.01 },
    );
    const sill = cutout(rectD(0, -0.9, R.win.x1 - R.win.x0 + 1.6, 0.9), { seed: 'sill' });
    // side walls (perpendicular) and ceiling
    // left wall: rotation +90° about y (local x = -z, faces +x); right wall: -90° (local x = z, faces -x)
    const sideL = cutout(rectD(-R.frontZ, R.floorY, D, wallH), { seed: 'side-l', wobble: 0.02 });
    const sideR = cutout(rectD(R.backZ, R.floorY, D, wallH), { seed: 'side-r', wobble: 0.02 });
    const ceiling = cutout(rectD(R.x0, R.backZ, W, D), { seed: 'ceiling', wobble: 0.02 });
    // shelf with books, sticky notes
    const shelf = cutout(rectD(5.4, 13.6, 3.6, 0.25), { seed: 'shelf' });
    const r = rng('books');
    const books: { d: string; color: string }[] = [];
    let bx = 5.6;
    const bookCols = ['#7a4f3a', '#3f5f6a', '#a8874f', '#5b4a6b', '#6d7b58', '#8c6b45'];
    while (bx < 8.6) {
      const w = r.range(0.28, 0.5);
      const h = r.range(1.1, 1.7);
      const lean = bx > 8.0 ? -0.25 : 0;
      books.push({ d: polyD([[bx, 13.85], [bx + w, 13.85], [bx + w + lean, 13.85 + h], [bx + lean, 13.85 + h]]), color: r.pick(bookCols) });
      bx += w + 0.04;
    }
    const bookGeos = books.map((b, i) => ({ geo: cutout(b.d, { seed: `book-${i}`, wobble: 0.01 }), color: b.color }));
    const notes = [
      { x: 15.6, y: 12.6, c: '#e8d38a', rz: 0.08 },
      { x: 16.9, y: 13.3, c: '#9fc0b5', rz: -0.06 },
      { x: 16.2, y: 11.2, c: '#e3b9a4', rz: 0.12 },
    ].map((n, i) => ({ ...n, geo: cutout(rectD(-0.55, -0.55, 1.1, 1.1), { seed: `note-${i}`, wobble: 0.02, bend: (x, y) => 0.05 * Math.max(0, -y) ** 2 }) }));
    // ceiling fan (three blades on a hub, hanging on a rod)
    const blades: string[] = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const P = (u: number, v: number): Pt => [u * c - v * s, u * s + v * c];
      blades.push(polyD([P(0.3, -0.25), P(3.6, -0.45), P(3.8, 0), P(3.6, 0.45), P(0.3, 0.25)]));
    }
    const fanBlades = cutout(blades, { seed: 'fan', wobble: 0.01 });
    const fanHub = cutout(circleD(0, 0, 0.55), { seed: 'fan-hub' });
    return { facade, trims, grilleGeo, panes, chajja, roofBits, floor, floorMat, backWall, backMat, frame, sill, sideL, sideR, ceiling, shelf, bookGeos, notes, fanBlades, fanHub, upperWins };
  }, []);

  const paneMats = useMemo(() => vellum('#e7d8b8', '#ffc978', 0.6), []);
  (paneMats[0] as THREE.MeshLambertMaterial).emissiveIntensity = 0.9 * upperLit;
  const f = onTwos(frame);
  const facadeMat = paper({ color: '#5f8580', normalScale: 0.6 });
  const plaster = paper({ color: '#e1cda6' });
  return (
    <group>
      {/* facade */}
      <mesh geometry={g.facade} material={facadeMat} position={[0, 0, R.frontZ]} castShadow receiveShadow />
      <mesh geometry={g.trims} material={paper(C.cream)} position={[0, 0, R.frontZ + 0.1]} castShadow receiveShadow />
      <mesh geometry={g.panes} material={paneMats} position={[0, 0, R.frontZ - 0.3]} />
      <mesh geometry={g.grilleGeo} material={paper('#2c3140')} position={[0, 0, R.frontZ - 0.12]} castShadow />
      {[7.2 - 0.7, 16.0 - 0.7].map((x, i) => (
        <mesh key={i} geometry={g.chajja} material={paper('#7a9a93')} position={[x, 23.45, R.frontZ]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow />
      ))}
      <mesh geometry={g.roofBits} material={paper('#3c5553')} position={[0, 0, R.frontZ - 3.5]} castShadow receiveShadow />
      {/* room shell */}
      <mesh geometry={g.floor} material={g.floorMat} rotation={[-Math.PI / 2, 0, 0]} position={[0, R.floorY, 0]} receiveShadow castShadow />
      <mesh geometry={g.backWall} material={g.backMat} position={[0, 0, R.backZ]} castShadow receiveShadow />
      <mesh geometry={g.frame} material={paper('#3f5c58')} position={[0, 0, R.backZ + 0.12]} castShadow receiveShadow />
      <mesh geometry={g.sill} material={paper('#d9c7a2')} position={[R.win.x0 - 0.8, R.win.y0 - 0.02, R.backZ]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={g.sideL} material={plaster} position={[R.x0, 0, 0]} rotation={[0, Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.sideR} material={plaster} position={[R.x1, 0, 0]} rotation={[0, -Math.PI / 2, 0]} castShadow receiveShadow />
      <mesh geometry={g.ceiling} material={paper('#d6c19c')} position={[0, R.ceilY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow />
      <mesh geometry={g.shelf} material={paper('#7a5236')} position={[0, 0, R.backZ + 0.5]} castShadow receiveShadow />
      {g.bookGeos.map((b, i) => (
        <mesh key={i} geometry={b.geo} material={paper(b.color)} position={[0, 0, R.backZ + 0.35 + (i % 2) * 0.05]} castShadow receiveShadow />
      ))}
      {g.notes.map((n, i) => (
        <mesh key={i} geometry={n.geo} material={paper(n.c)} position={[n.x, n.y, R.backZ + 0.1]} rotation={[0, 0, n.rz]} castShadow receiveShadow />
      ))}
      {/* ceiling fan, turning slowly on twos */}
      <group position={[19.2, R.ceilY - 1.6, -6.4]}>
        <mesh position={[0, 0.8, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.08, 1.6, 6]} />
          <meshLambertMaterial color="#4a4640" />
        </mesh>
        <group rotation={[Math.PI / 2, 0, f * 0.035]}>
          <mesh geometry={g.fanBlades} material={paper('#8a7a64')} castShadow receiveShadow />
          <mesh geometry={g.fanHub} material={paper('#5a5248')} position={[0, 0, 0.1]} castShadow />
        </group>
      </group>
    </group>
  );
};
