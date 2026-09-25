import React from 'react';
import { BEATS } from '../story';
import { seg } from '../lib/anim';
import { Theatre } from './Theatre';
import { Curtain } from './Curtain';
import { EndTag, TitleBanner } from './Banner';
import { Sky } from './Sky';
import { Skyline } from './Skyline';
import { MidLayer } from './MidLayer';
import { Street } from './Street';
import { Building } from './Building';
import { Props } from './Props';
import { Builder } from './Builder';
import { Birds } from './Birds';
import { Rain } from './Rain';
import { Table } from './Table';
import { lightingAt } from './lighting';

export const World: React.FC<{ frame: number }> = ({ frame }) => {
  const L = lightingAt(frame);
  const off = seg(frame, BEATS.windowsDark[0], BEATS.windowsDark[1]);
  const lampLevel = L.lamp / 26;
  return (
    <group>
      <Table daylight={seg(frame, BEATS.skySwap[0], 1700)} />
      <Theatre />
      <Curtain frame={frame} />
      <TitleBanner frame={frame} />
      <EndTag frame={frame} />
      <Sky frame={frame} stars={L.stars} flash={L.skyFlash} />
      <Skyline frame={frame} windowsLit={L.windowsLit + (1 - L.windowsLit) * 0} offProgress={off} />
      <MidLayer frame={frame} windowsLit={L.windowsLit} offProgress={off} />
      <Street frame={frame} lampOn={L.street / 55} />
      <Building frame={frame} upperLit={L.windowsLit * 0.6} />
      <Props frame={frame} lampLevel={lampLevel} screenGlow={L.laptop / 5.5} />
      <Builder frame={frame} />
      <Birds frame={frame} />
      <Rain frame={frame} />
    </group>
  );
};
