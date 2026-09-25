import { ThreeCanvas } from '@remotion/three';
import React, { useMemo } from 'react';
import * as THREE from 'three';
import { AbsoluteFill, getInputProps, useCurrentFrame, useVideoConfig } from 'remotion';
import { onTwos } from './lib/anim';
import { defaultFx, FxContext } from './post/fx';
import { PostFX } from './post/PostFX';
import { patchSoftShadows } from './post/shadowPatch';
import { CameraRig } from './scene/CameraRig';
import { Variant } from './scene/camera';
import { lightingAt } from './scene/lighting';
import { Lights } from './scene/Lights';
import { World } from './scene/World';
import { Soundtrack } from './audio/Soundtrack';

patchSoftShadows();
if (typeof window !== 'undefined' && (getInputProps() as { timing?: boolean }).timing) {
  (window as unknown as { PB_TIMING: boolean }).PB_TIMING = true;
}

export type FilmProps = { variant: Variant };

export const Film: React.FC<FilmProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fx = useMemo(() => defaultFx(), []);
  const L = lightingAt(frame);
  fx.exposure = L.exposure;
  fx.fade = L.fade;
  fx.shadowKey = `${onTwos(frame)}|${L.stageShadow ? 1 : 0}${L.lampShadow ? 1 : 0}`;
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        shadows="percentage"
        camera={{ fov: 25, near: 0.5, far: 4000, position: [0, 20, 160] }}
        onCreated={({ gl }) => {
          gl.shadowMap.type = THREE.PCFShadowMap;
          gl.setClearColor('#050509', 1);
        }}
      >
        <FxContext.Provider value={fx}>
          <CameraRig frame={frame} variant={variant} />
          <Lights frame={frame} />
          <World frame={frame} />
          <PostFX />
        </FxContext.Provider>
      </ThreeCanvas>
      <Soundtrack />
    </AbsoluteFill>
  );
};
