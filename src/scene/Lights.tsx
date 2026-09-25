import { useThree } from '@react-three/fiber';
import React, { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { lightingAt } from './lighting';

// One fixed rig; every value is driven per frame from `lightingAt(frame)`.
// Two shadow casters with 4096 / 1024 maps + a stage spot; the rest are cheap
// practicals (laptop, room bounce, moon, street lamp).

export const Lights: React.FC<{ frame: number }> = ({ frame }) => {
  const { scene } = useThree();
  const rig = useMemo(() => {
    const hemi = new THREE.HemisphereLight('#8090c0', '#302838', 0.3);
    const key = new THREE.DirectionalLight('#c8d4ff', 1);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    key.shadow.radius = 9;
    const fill = new THREE.DirectionalLight('#ffd7a8', 0.2);
    const stage = new THREE.SpotLight('#ffcf94', 0, 0, 0.3, 0.7, 0);
    stage.castShadow = true;
    stage.shadow.mapSize.set(1536, 1536);
    stage.shadow.bias = -0.0003;
    stage.shadow.radius = 7;
    stage.shadow.camera.near = 20;
    stage.shadow.camera.far = 400;
    const lamp = new THREE.SpotLight('#ffb35c', 0, 0, 0.9, 0.75, 1.2);
    lamp.castShadow = true;
    lamp.shadow.mapSize.set(1024, 1024);
    lamp.shadow.bias = -0.0006;
    lamp.shadow.radius = 5;
    lamp.shadow.camera.near = 0.5;
    lamp.shadow.camera.far = 40;
    const laptop = new THREE.PointLight('#cfe0ff', 0, 9, 1.6);
    const bounce = new THREE.PointLight('#ffb870', 0, 26, 1.4);
    const moon = new THREE.PointLight('#d8e4ff', 0, 16, 1.5);
    const street = new THREE.PointLight('#ffb050', 0, 14, 1.6);
    const cyc = new THREE.PointLight('#ffc590', 0, 70, 1.15);
    cyc.position.set(0, 3, -29.9);
    const targets = [key, fill, stage, lamp].map((l) => {
      const t = new THREE.Object3D();
      (l as THREE.DirectionalLight).target = t;
      return t;
    });
    return { hemi, key, fill, stage, lamp, laptop, bounce, moon, street, cyc, targets };
  }, []);

  useLayoutEffect(() => {
    const all: THREE.Object3D[] = [rig.hemi, rig.key, rig.fill, rig.stage, rig.lamp, rig.laptop, rig.bounce, rig.moon, rig.street, rig.cyc, ...rig.targets];
    all.forEach((o) => scene.add(o));
    return () => {
      all.forEach((o) => scene.remove(o));
    };
  }, [rig, scene]);

  const L = lightingAt(frame);
  useLayoutEffect(() => {
    rig.hemi.color.set(L.hemiSky);
    rig.hemi.groundColor.set(L.hemiGround);
    rig.hemi.intensity = L.hemi;

    rig.key.color.set(L.keyColor);
    rig.key.intensity = L.key;
    rig.key.position.set(...L.keyPos);
    rig.targets[0].position.set(...L.keyTarget);
    const sc = rig.key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -L.keyShadowHalf[0];
    sc.right = L.keyShadowHalf[0];
    sc.bottom = -L.keyShadowHalf[1];
    sc.top = L.keyShadowHalf[1];
    sc.near = 1;
    sc.far = L.keyShadowFar;
    sc.updateProjectionMatrix();
    rig.key.shadow.radius = L.keyShadowRadius;

    rig.fill.color.set(L.fillColor);
    rig.fill.intensity = L.fill;
    rig.fill.position.set(...L.fillPos);
    rig.targets[1].position.set(0, 12, -10);

    rig.stage.castShadow = L.stageShadow;
    rig.lamp.castShadow = L.lampShadow;
    rig.stage.color.set(L.stageColor);
    rig.stage.intensity = L.stage;
    rig.stage.angle = L.stageAngle;
    rig.stage.position.set(...L.stagePos);
    rig.targets[2].position.set(...L.stageTarget);

    rig.lamp.intensity = L.lamp;
    rig.lamp.color.set(L.lampColor);
    rig.lamp.position.set(...L.lampPos);
    rig.targets[3].position.set(...L.lampTarget);

    rig.laptop.intensity = L.laptop;
    rig.laptop.position.set(...L.laptopPos);
    rig.bounce.intensity = L.bounce;
    rig.bounce.position.set(...L.bouncePos);
    rig.moon.intensity = L.moon;
    rig.moon.position.set(...L.moonPos);
    rig.street.intensity = L.street;
    rig.street.position.set(...L.streetPos);
    rig.cyc.intensity = L.cyc;
    rig.targets.forEach((t) => t.updateMatrixWorld());
  });
  return null;
};
