import React, { useMemo } from 'react';
import { BEATS } from '../story';
import { C } from '../palette';
import { clamp, ease, lerp, onTwos, overshoot, seg } from '../lib/anim';
import { cutout } from '../paper/cutout';
import { paper } from '../paper/materials';
import { circleD, polyD, scallopBandD } from '../paper/path';

// The red paper curtain: two accordion-pleated panels of card strips hinged on
// their long edges. Opening = the pleats fold up tighter (like a paper fan)
// and gather into the wings; nothing about it behaves like cloth.

const N = 8;
const W = 3.45;
const H = 31;
const Z0 = 1.8;

const stripD = (dir: 1 | -1) => {
  // right panel strips span x ∈ [-W, 0]; left panel strips x ∈ [0, W]
  const a = dir > 0 ? -W : 0;
  const b = dir > 0 ? 0 : W;
  return `M ${a} 1.35 Q ${(a + b) / 2} -0.25 ${b} 1.35 L ${b} ${H} L ${a} ${H} Z`;
};
const trimD = (dir: 1 | -1) => {
  const a = dir > 0 ? -W : 0;
  const b = dir > 0 ? 0 : W;
  const m = (a + b) / 2;
  return `M ${a} 2.45 Q ${m} 0.95 ${b} 2.45 L ${b} 3.05 Q ${m} 1.55 ${a} 3.05 Z`;
};

/** 0 = closed, 1 = open (with a little paper bounce when it lands). */
export const curtainOpenAmount = (frame: number) => {
  const f = onTwos(frame);
  const [o0, o1] = BEATS.curtainOpen;
  const [c0, c1] = BEATS.curtainClose;
  if (f < c0) {
    const o = seg(f, o0, o1, ease.inOutCubic);
    return clamp(o + (f >= o1 ? -overshoot(f, o1, 0.08, 6, 5) : 0), 0, 1.06);
  }
  const c = seg(f, c0, c1, ease.inOutCubic);
  return clamp(1 - c + (f >= c1 ? overshoot(f, c1, 0.035, 6, 5) : 0), -0.02, 1);
};

const Panel: React.FC<{ dir: 1 | -1; open: number }> = ({ dir, open }) => {
  const strips = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => {
        const bulge = (i % 2 === 0 ? 1 : -1) * 0.1;
        const geo = cutout(stripD(dir), {
          seed: `curtain-${dir}-${i}`,
          wobble: 0.04,
          subdivide: 2,
          bend: (x) => {
            const u = (x + (dir > 0 ? W / 2 : -W / 2)) / (W / 2);
            return bulge * (1 - u * u);
          },
        });
        const trim = cutout(trimD(dir), { seed: `ctrim-${dir}-${i}`, wobble: 0.015 });
        return { geo, trim };
      }),
    [dir],
  );
  const theta = lerp(0.2, 1.4, clamp(open, 0, 1.05));
  const anchor = lerp(26.8, 28.4, clamp(open, 0, 1));
  const zBase = Z0 + (dir < 0 ? 0.16 : 0);
  let hx = dir * anchor;
  let hz = zBase;
  const mats = paper({ color: C.curtain, back: '#7d2724', normalScale: 0.6 });
  const trimMat = paper(C.ochre);
  return (
    <group>
      {strips.map((s, i) => {
        const sgn = i % 2 === 0 ? 1 : -1;
        const px = hx;
        const pz = hz;
        hx += -dir * W * Math.cos(theta);
        hz += sgn * W * Math.sin(theta);
        const rotY = dir > 0 ? sgn * theta : -sgn * theta;
        return (
          <group key={i} position={[px, 0.2, pz]} rotation={[0, rotY, 0]}>
            <mesh geometry={s.geo} material={mats} castShadow receiveShadow />
            <mesh geometry={s.trim} material={trimMat} position={[0, 0, 0.07]} castShadow />
          </group>
        );
      })}
    </group>
  );
};

const Valance: React.FC = () => {
  const g = useMemo(() => {
    const back = cutout(scallopBandD(-26.6, 26.6, 38.5, 31.6, 7, 1.5), { seed: 'val-back', wobble: 0.05 });
    const main = cutout(scallopBandD(-26.4, 26.4, 38.5, 33.3, 11, 1.1), { seed: 'val-main', wobble: 0.05 });
    const trim = cutout(scallopBandD(-26.2, 26.2, 34.3, 33.75, 11, 0.62), { seed: 'val-trim', wobble: 0.02 });
    const tassels: string[] = [];
    for (let i = 0; i <= 11; i++) {
      const x = -26.4 + (i * 52.8) / 11;
      if (Math.abs(x) > 26) continue;
      tassels.push(circleD(x, 32.9, 0.36));
      tassels.push(polyD([[x - 0.3, 32.7], [x + 0.3, 32.7], [x + 0.18, 31.3], [x - 0.18, 31.3]]));
    }
    const tas = cutout(tassels, { seed: 'tassels', wobble: 0.01 });
    return { back, main, trim, tas };
  }, []);
  return (
    <group>
      <mesh geometry={g.back} material={paper({ color: C.curtainDark, back: '#6a221f' })} position={[0, 0, 5.18]} castShadow receiveShadow />
      <mesh geometry={g.main} material={paper({ color: C.curtain, back: '#7d2724' })} position={[0, 0, 5.36]} castShadow receiveShadow />
      <mesh geometry={g.trim} material={paper(C.ochre)} position={[0, 0, 5.46]} castShadow receiveShadow />
      <mesh geometry={g.tas} material={paper(C.gold)} position={[0, 0, 5.52]} castShadow receiveShadow />
    </group>
  );
};

export const Curtain: React.FC<{ frame: number }> = ({ frame }) => {
  const open = curtainOpenAmount(frame);
  return (
    <group>
      <Valance />
      <Panel dir={1} open={open} />
      <Panel dir={-1} open={open} />
      {/* the curtain rail, just visible above the valance from high angles */}
      <mesh position={[0, 31.6, Z0 + 0.4]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 60, 7]} />
        <meshLambertMaterial color={'#6b4a2e'} />
      </mesh>
    </group>
  );
};

export const curtainIsOpen = (frame: number) => curtainOpenAmount(frame) > 0.9;
