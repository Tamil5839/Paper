import { useThree } from '@react-three/fiber';
import React, { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { clamp, lerp, spline3, V3 } from '../lib/anim';
import { FxState, useFx } from '../post/fx';
import { cameraAt, Variant } from './camera';

// Moves the camera smoothly on every frame (24 fps; only puppets step on twos)
// and hands the lens settings to the post chain.

export const CameraRig: React.FC<{ frame: number; variant: Variant }> = ({ frame, variant }) => {
  const { camera } = useThree();
  const fx = useFx();
  const s = cameraAt(frame, variant);
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.position.set(...s.pos);
    cam.fov = s.fov;
    cam.near = s.near;
    cam.far = 4000;
    cam.up.set(0, 1, 0);
    cam.lookAt(new THREE.Vector3(...s.target));
    if (s.roll) cam.rotateZ(s.roll);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const out: FxState = fx;
    out.focusDist = s.focusDist;
    out.coc = s.coc;
    out.maxCoc = s.maxCoc;
    out.tilt = s.tilt;
    out.tiltCenter = s.tiltCenter;
    out.tiltBand = s.tiltBand;
    out.frame = frame;
  });
  return null;
};

export const _keep = { clamp, lerp, spline3 } as unknown as V3;
