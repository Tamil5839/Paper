import React, { useMemo } from 'react';
import * as THREE from 'three';
import { C } from '../palette';
import { rng } from '../lib/random';
import { cutout } from '../paper/cutout';
import { paper, stickMaterial } from '../paper/materials';
import { polyD, Pt } from '../paper/path';
import { getTableWoodTexture } from '../paper/textures';
import { BASE_BOTTOM } from './Theatre';

// The real world the theatre sits in: an oiled wooden table in a room lit by a
// window, with the tools that made the theatre lying around it.

const TABLE_Y = BASE_BOTTOM - 0.02;

export const Table: React.FC<{ daylight: number }> = ({ daylight }) => {
  const g = useMemo(() => {
    const wood = getTableWoodTexture();
    const map = wood.map.clone();
    map.repeat.set(4.5, 3.2);
    map.needsUpdate = true;
    const nrm = wood.normalMap.clone();
    nrm.repeat.set(4.5, 3.2);
    nrm.needsUpdate = true;
    const top = new THREE.MeshStandardMaterial({ map, normalMap: nrm, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.52, metalness: 0, color: '#d8c0a8' });
    const edgeMap = wood.map.clone();
    edgeMap.repeat.set(4.5, 0.08);
    edgeMap.needsUpdate = true;
    const edge = new THREE.MeshStandardMaterial({ map: edgeMap, roughness: 0.6, color: '#b89a80' });
    const wall = new THREE.MeshLambertMaterial({ color: '#e7d8c0' });
    const skirting = new THREE.MeshLambertMaterial({ color: '#8b7560' });
    const frame = new THREE.MeshLambertMaterial({ color: '#5a4636' });
    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.35, 2.0) });
    // paper offcuts lying around
    const r = rng('offcuts');
    const scraps = [C.indigo, C.ochre, C.tealMid, C.cream, C.slate, C.cream, C.kraft].map((color, i) => {
      const pts: Pt[] = [];
      const n = 4 + Math.floor(r.next() * 3);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + r.range(-0.3, 0.3);
        const rad = r.range(1.2, 3.4);
        pts.push([Math.cos(a) * rad * 1.4, Math.sin(a) * rad]);
      }
      const angle = r.range(0, Math.PI * 2);
      const side = i % 2 === 0 ? -1 : 1;
      return {
        geo: cutout(polyD(pts), { seed: `scrap-${i}`, wobble: 0.08 }),
        color,
        pos: [side * r.range(42, 70), TABLE_Y + 0.05 + i * 0.012, r.range(-5, 36)] as [number, number, number],
        rot: angle,
      };
    });
    return { top, edge, wall, skirting, frame, glass, scraps };
  }, []);
  g.glass.color.setRGB(0.03 + 2.6 * daylight, 0.04 + 2.3 * daylight, 0.1 + 1.9 * daylight);
  return (
    <group>
      {/* table top and front edge */}
      <mesh material={g.top} rotation={[-Math.PI / 2, 0, 0]} position={[0, TABLE_Y, 10]} receiveShadow>
        <planeGeometry args={[300, 220]} />
      </mesh>
      <mesh material={g.edge} position={[0, TABLE_Y - 2.2, 120]} receiveShadow>
        <planeGeometry args={[300, 4.4]} />
      </mesh>
      {/* the room: back wall with skirting, a framed print and a bright window */}
      <mesh material={g.wall} position={[0, 60, -160]} receiveShadow>
        <planeGeometry args={[700, 300]} />
      </mesh>
      <mesh material={g.skirting} position={[0, -86, -159]}>
        <planeGeometry args={[700, 12]} />
      </mesh>
      <group position={[-150, 55, -158]}>
        <mesh material={g.frame}>
          <planeGeometry args={[72, 92]} />
        </mesh>
        <mesh material={g.glass} position={[0, 0, 0.5]}>
          <planeGeometry args={[64, 84]} />
        </mesh>
        <mesh material={g.frame} position={[0, 0, 1]}>
          <planeGeometry args={[3, 84]} />
        </mesh>
        <mesh material={g.frame} position={[0, 0, 1]}>
          <planeGeometry args={[64, 3]} />
        </mesh>
      </group>
      <group position={[130, 70, -158]}>
        <mesh material={g.frame}>
          <planeGeometry args={[46, 34]} />
        </mesh>
        <mesh position={[0, 0, 0.5]}>
          <planeGeometry args={[40, 28]} />
          <meshLambertMaterial color="#9fb3b0" />
        </mesh>
      </group>
      {/* tools: pencil, spare sticks, paper offcuts, glue pot */}
      <group position={[-58, TABLE_Y + 0.45, 30]} rotation={[0, 0.5, Math.PI / 2]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.45, 0.45, 17, 6]} />
          <meshLambertMaterial color="#d4a73c" />
        </mesh>
        <mesh position={[0, 9.1, 0]} castShadow>
          <coneGeometry args={[0.45, 1.3, 6]} />
          <meshLambertMaterial color="#e6c89a" />
        </mesh>
        <mesh position={[0, 9.75, 0]} castShadow>
          <coneGeometry args={[0.13, 0.3, 6]} />
          <meshLambertMaterial color="#303038" />
        </mesh>
      </group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} material={stickMaterial()} position={[54 + i * 1.1, TABLE_Y + 0.14, 22 + i * 2.5]} rotation={[0, -0.3 + i * 0.12, Math.PI / 2]} castShadow receiveShadow>
          <cylinderGeometry args={[0.13, 0.13, 36, 7]} />
        </mesh>
      ))}
      {g.scraps.map((s, i) => (
        <mesh key={i} geometry={s.geo} material={paper(s.color)} position={s.pos} rotation={[-Math.PI / 2, 0, s.rot]} castShadow receiveShadow />
      ))}
      <group position={[-50, TABLE_Y, -8]}>
        <mesh position={[0, 2.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.6, 2.8, 4.4, 20]} />
          <meshStandardMaterial color="#efe9df" roughness={0.35} />
        </mesh>
        <mesh position={[0, 4.8, 0]} castShadow>
          <cylinderGeometry args={[1.6, 2.2, 0.9, 20]} />
          <meshLambertMaterial color={C.tealMid} />
        </mesh>
      </group>
    </group>
  );
};
