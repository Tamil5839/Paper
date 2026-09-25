import React, { useMemo } from 'react';
import * as THREE from 'three';
import { BEATS, TEXT } from '../story';
import { C } from '../palette';
import { ease, handWobble, lerp, onTwos, overshoot, seg, track } from '../lib/anim';
import { cutout } from '../paper/cutout';
import { inkStrokes, layoutText, offsetRings, strokeRings } from '../paper/lettering';
import { paper } from '../paper/materials';
import { circleD, polyD, Pt, Ring } from '../paper/path';
import { printedPaper, printTexture } from '../paper/print';
import { Stick, Wire } from './Stick';

// Title banner (cut-paper letters on a swallowtail card, dropped in on two
// sticks) and the closing tag (handwritten ink on kraft, lowered on a string).

const bannerRing: Ring = [
  [-15, 0],
  [15, 0],
  [13.3, 4.2],
  [15, 8.4],
  [-15, 8.4],
  [-13.3, 4.2],
];

export const TitleBanner: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    const base = cutout(polyD(bannerRing), { seed: 'banner', wobble: 0.05, bend: (x) => -0.0009 * x * x, subdivide: 1 });
    const outer = offsetRings([bannerRing], -0.45);
    const inner = offsetRings([bannerRing], -0.72);
    const border = cutout([...outer, ...inner].map(polyD), { seed: 'banner-border', wobble: 0.02 });
    const lay = layoutText(TEXT.title, 4.7, 'title', 0.014, 0.035, 0.04);
    const shifted = lay.strokes.map((s) => s.map(([x, y]) => [x - lay.width / 2, y + 2.35] as Pt));
    const letters = cutout(strokeRings(shifted, 0.52).map(polyD), { seed: 'title-letters', wobble: 0.012, wavelength: 0.6 });
    const orn = cutout([circleD(-12.4, 4.2, 0.55), circleD(12.4, 4.2, 0.55), circleD(-11.2, 4.2, 0.22), circleD(11.2, 4.2, 0.22)], { seed: 'banner-orn' });
    return { base, border, letters, orn };
  }, []);
  const f = onTwos(frame);
  const [d0, d1] = BEATS.bannerDrop;
  const [u0, u1] = BEATS.bannerOut;
  const down = seg(f, d0, d1, ease.outCubic);
  const up = seg(f, u0, u1, ease.inCubic);
  let y = lerp(36, 16.2, down) - overshoot(f, d1, 0.9, 7, 4) + lerp(0, 22, up);
  y += handWobble(f, 'banner-y', 0.08, down > 0 && down < 1 ? 1 : 0.3);
  const rz = handWobble(f, 'banner-rz', 0.012, 0.6) + (f > d1 ? Math.sin((f - d1) * 0.45) * 0.02 * Math.exp(-(f - d1) * 0.05) : 0);
  if (f > u1 + 2 || f < d0 - 2) return null;
  return (
    <group position={[0, y, 4.75]} rotation={[0, 0, rz]}>
      <mesh geometry={g.base} material={paper({ color: C.paperWhite, normalScale: 0.6 })} castShadow receiveShadow />
      <mesh geometry={g.border} material={paper(C.ochre)} position={[0, 0, 0.09]} castShadow receiveShadow />
      <mesh geometry={g.letters} material={paper(C.indigo)} position={[0, 0, 0.13]} castShadow receiveShadow />
      <mesh geometry={g.orn} material={paper(C.tealMid)} position={[0, 0, 0.1]} castShadow receiveShadow />
      <Stick at={[-9.6, 7.6, -0.05]} from="top" length={40} seed="banner-stick-l" />
      <Stick at={[9.6, 7.6, -0.05]} from="top" length={40} seed="banner-stick-r" />
    </group>
  );
};

const TAG_W = 20;
const TAG_H = 9.6;
const tagRing: Ring = [
  [-TAG_W / 2, 0],
  [TAG_W / 2, 0],
  [TAG_W / 2, TAG_H - 2],
  [TAG_W / 2 - 2, TAG_H],
  [-TAG_W / 2 + 2, TAG_H],
  [-TAG_W / 2, TAG_H - 2],
];

export const EndTag: React.FC<{ frame: number }> = ({ frame }) => {
  const g = useMemo(() => {
    const px = 52;
    const tex = printTexture('end-tag', TAG_W, TAG_H, px, (ctx, w, h) => {
      ctx.fillStyle = '#c9a270';
      ctx.fillRect(0, 0, w, h);
      // a faint printed border line, like a shop tag
      ctx.strokeStyle = 'rgba(120,84,48,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(0.55 * px, 0.55 * px, w - 1.1 * px, h - 1.1 * px);
      const ink = '#1d1f3f';
      const l1 = layoutText(TEXT.tagLine1, 2.25, 'tag-1', 0.02, 0.03, 0.08);
      const l2 = layoutText(TEXT.tagLine2, 2.25, 'tag-2', 0.02, 0.03, 0.08);
      const toPx = (xcm: number) => (xcm + TAG_W / 2) * px;
      inkStrokes(ctx, l1.strokes, toPx(-l1.width / 2 - 0.6), (TAG_H - 5.5) * px, px, 0.2, ink, 'ink-1');
      inkStrokes(ctx, l2.strokes, toPx(-l2.width / 2 + 0.2), (TAG_H - 2.3) * px, px, 0.2, ink, 'ink-2');
      // a tiny inked paper-bird doodle after the last word
      const bx = toPx(l2.width / 2 + 2.3);
      const by = (TAG_H - 2.7) * px;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(0.75, 0.75);
      ctx.translate(-bx, -by);
      ctx.lineWidth = 0.14 * px;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      ctx.moveTo(bx - 0.9 * px, by);
      ctx.lineTo(bx + 0.8 * px, by + 0.05 * px);
      ctx.lineTo(bx + 1.3 * px, by - 0.6 * px);
      ctx.moveTo(bx - 0.2 * px, by);
      ctx.lineTo(bx - 0.05 * px, by - 1.0 * px);
      ctx.lineTo(bx + 0.45 * px, by + 0.02 * px);
      ctx.moveTo(bx - 0.9 * px, by);
      ctx.lineTo(bx - 1.3 * px, by - 0.55 * px);
      ctx.stroke();
      ctx.restore();
    });
    const geo = cutout([polyD(tagRing), circleD(0, TAG_H - 1.25, 0.42)], { seed: 'tag', wobble: 0.04, uvFit: [-TAG_W / 2, 0, TAG_W, TAG_H] });
    const mat = printedPaper('end-tag', tex, TAG_W, TAG_H, '#e6d2b0', '#b89468');
    const ring = cutout([circleD(0, TAG_H - 1.25, 0.85), circleD(0, TAG_H - 1.25, 0.42)], { seed: 'tag-ring', wobble: 0.01 });
    return { geo, mat, ring };
  }, []);
  const f = onTwos(frame);
  const [t0, t1] = BEATS.tagDrop;
  if (f < t0 - 2) return null;
  const d = seg(f, t0, t1, ease.outCubic);
  const y = lerp(44, 13.2, d) - overshoot(f, t1, 0.7, 8, 3.5);
  const swing = f > t1 ? Math.sin((f - t1) * 0.32) * 0.035 * Math.exp(-(f - t1) * 0.045) : track(f, [[t0, 0.05], [t1, -0.02]]);
  return (
    <group position={[0, y + TAG_H - 1.25, 5.02]} rotation={[0, 0, swing]}>
      <group position={[0, -(TAG_H - 1.25), 0]}>
        <mesh geometry={g.geo} material={g.mat} castShadow receiveShadow />
        <mesh geometry={g.ring} material={paper(C.paperWhite)} position={[0, 0, 0.07]} castShadow />
      </group>
      <Wire at={[0, 0, 0.03]} length={40} radius={0.03} />
    </group>
  );
};

export const _t = THREE;
