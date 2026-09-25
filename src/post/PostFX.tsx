import { useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFx } from './fx';

// Post chain, driven only by uniforms (deterministic, no clocks):
//  1. scene      -> HDR target + depth
//  2. prep       -> FXAA + signed circle-of-confusion (px) from depth & tilt-shift band
//  3. half/tiles -> half-res colour+CoC, 16px tiles of max CoC (dilated)
//  4. bokeh      -> golden-angle scatter-as-gather at half res (Gustafsson), tile-limited
//  5. composite  -> full-res sharp / blurred blend
//  6. glow       -> bright pass + blur at quarter res (vellum light bleeding)
//  7. final      -> ACES tone map, indigo shadow lift, vignette, warm film grain

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const PREP_FRAG = /* glsl */ `
#include <packing>
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uTexel;
uniform float uNear;
uniform float uFar;
uniform float uFocus;
uniform float uCoc;
uniform float uMaxCoc;
uniform float uTilt;
uniform float uTiltCenter;
uniform float uTiltBand;
varying vec2 vUv;

float pLuma(vec3 c) { c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }

vec3 fxaa(vec2 uv) {
  vec3 rgbNW = texture2D(tColor, uv + vec2(-1.0, -1.0) * uTexel).rgb;
  vec3 rgbNE = texture2D(tColor, uv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture2D(tColor, uv + vec2(-1.0, 1.0) * uTexel).rgb;
  vec3 rgbSE = texture2D(tColor, uv + vec2(1.0, 1.0) * uTexel).rgb;
  vec3 rgbM = texture2D(tColor, uv).rgb;
  float lNW = pLuma(rgbNW);
  float lNE = pLuma(rgbNE);
  float lSW = pLuma(rgbSW);
  float lSE = pLuma(rgbSE);
  float lM = pLuma(rgbM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  if (lMax - lMin < max(0.02, lMax * 0.1)) return rgbM;
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
  float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 / 8.0), 1.0 / 128.0);
  float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcpDirMin, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 rgbA = 0.5 * (texture2D(tColor, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tColor, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tColor, uv - dir * 0.5).rgb + texture2D(tColor, uv + dir * 0.5).rgb);
  float lB = pLuma(rgbB);
  return (lB < lMin || lB > lMax) ? rgbA : rgbB;
}

void main() {
  float d = texture2D(tDepth, vUv).x;
  float z = -perspectiveDepthToViewZ(d, uNear, uFar);
  float c = uCoc * (z - uFocus) / max(z, 1e-3);
  float t = uTilt * max(0.0, abs(vUv.y - uTiltCenter) - uTiltBand);
  float s = z < uFocus ? -1.0 : 1.0;
  float coc = s * min(uMaxCoc, abs(c) + t);
  gl_FragColor = vec4(fxaa(vUv), coc);
}
`;

const HALF_FRAG = /* glsl */ `
uniform sampler2D tPrep;
uniform vec2 uTexel; // full-res texel
varying vec2 vUv;
void main() {
  vec4 a = texture2D(tPrep, vUv + uTexel * vec2(-0.5, -0.5));
  vec4 b = texture2D(tPrep, vUv + uTexel * vec2(0.5, -0.5));
  vec4 c = texture2D(tPrep, vUv + uTexel * vec2(-0.5, 0.5));
  vec4 d = texture2D(tPrep, vUv + uTexel * vec2(0.5, 0.5));
  vec3 rgb = (a.rgb + b.rgb + c.rgb + d.rgb) * 0.25;
  float cmin = min(min(a.a, b.a), min(c.a, d.a));
  float cavg = (a.a + b.a + c.a + d.a) * 0.25;
  gl_FragColor = vec4(rgb, cmin < -1.0 ? cmin : cavg);
}
`;

const TILE_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform vec2 uHalfTexel;
varying vec2 vUv;
void main() {
  // tile = 8x8 half-res texels
  float m = 0.0;
  vec2 base = vUv - uHalfTexel * 3.5;
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < 8; x++) {
      m = max(m, abs(texture2D(tHalf, base + uHalfTexel * vec2(float(x), float(y))).a));
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}
`;

const DILATE_FRAG = /* glsl */ `
uniform sampler2D tTile;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  float m = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      m = max(m, texture2D(tTile, vUv + uTexel * vec2(float(x), float(y))).r);
    }
  }
  gl_FragColor = vec4(m, 0.0, 0.0, 1.0);
}
`;

const BOKEH_FRAG = /* glsl */ `
uniform sampler2D tHalf;
uniform sampler2D tTile;
uniform vec2 uHalfTexel;
uniform float uMaxCoc; // full-res px
varying vec2 vUv;
const float GOLDEN_ANGLE = 2.39996323;
const float RAD_SCALE = 0.75;
void main() {
  vec4 c0 = texture2D(tHalf, vUv);
  float cz = c0.a;
  float cs = abs(cz) * 0.5;
  float tileMax = texture2D(tTile, vUv).r * 0.5;
  float limit = min(uMaxCoc * 0.5, max(cs, tileMax) + 0.75);
  vec3 col = c0.rgb;
  float tot = 1.0;
  float radius = RAD_SCALE;
  float ang = 0.0;
  float spread = cs;
  for (int i = 0; i < 128; i++) {
    if (radius >= limit) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * uHalfTexel * radius;
    vec4 s = texture2D(tHalf, tc);
    float ss = abs(s.a) * 0.5;
    if (s.a > cz) ss = min(ss, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, s.rgb, m);
    tot += 1.0;
    spread = max(spread, ss * m);
    radius += RAD_SCALE / radius;
    ang += GOLDEN_ANGLE;
  }
  gl_FragColor = vec4(col / tot, spread * 2.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tPrep;
uniform sampler2D tBokeh;
varying vec2 vUv;
void main() {
  vec4 sharp = texture2D(tPrep, vUv);
  vec4 blur = texture2D(tBokeh, vUv);
  float amt = max(abs(sharp.a), blur.a);
  float t = smoothstep(0.6, 2.2, amt);
  gl_FragColor = vec4(mix(sharp.rgb, blur.rgb, t), 1.0);
}
`;

const BRIGHT_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uTexel;
varying vec2 vUv;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(1.0, -1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(-1.0, 1.0)).rgb;
  c += texture2D(tColor, vUv + uTexel * vec2(1.0, 1.0)).rgb;
  c *= 0.25;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(0.5, 1.5, l);
  gl_FragColor = vec4(c * k, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform vec2 uDir;
varying vec2 vUv;
void main() {
  vec3 c = texture2D(tColor, vUv).rgb * 0.1964825501511404;
  c += texture2D(tColor, vUv + uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture2D(tColor, vUv - uDir * 1.411764705882353).rgb * 0.2969069646728344;
  c += texture2D(tColor, vUv + uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture2D(tColor, vUv - uDir * 3.2941176470588234).rgb * 0.09447039785044732;
  c += texture2D(tColor, vUv + uDir * 5.176470588235294).rgb * 0.010381362401148057;
  c += texture2D(tColor, vUv - uDir * 5.176470588235294).rgb * 0.010381362401148057;
  gl_FragColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tGlow;
uniform vec2 uRes;
uniform float uExposure;
uniform float uGlow;
uniform float uGrain;
uniform float uVignette;
uniform float uLift;
uniform float uFrame;
uniform float uFade;
varying vec2 vUv;

vec3 pbRrtOdtFit(vec3 v) {
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return a / b;
}
vec3 pbAces(vec3 color) {
  const mat3 pbIn = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
  const mat3 pbOut = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
  color = pbIn * color;
  color = pbRrtOdtFit(color);
  color = pbOut * color;
  return clamp(color, 0.0, 1.0);
}
vec3 pbToSRGB(vec3 c) {
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
float pbHash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float pbGrain(vec2 px, float seed) {
  vec2 o = vec2(mod(seed * 37.0, 997.0), mod(seed * 91.0, 983.0));
  float a = pbHash(px + o);
  float b = pbHash(floor(px * 0.5) + o * 1.7);
  return (a * 0.6 + b * 0.4) - 0.5;
}
void main() {
  vec3 c = texture2D(tColor, vUv).rgb;
  c += texture2D(tGlow, vUv).rgb * uGlow;
  c *= uExposure;
  c += uLift * vec3(0.55, 0.6, 1.0);
  c = pbAces(c * 1.35);
  c = pbToSRGB(c);
  vec2 q = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  float vig = smoothstep(1.05, 0.25, length(q) * 1.08);
  c *= mix(1.0 - uVignette, 1.0, vig);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float g = pbGrain(gl_FragCoord.xy, uFrame);
  float amt = uGrain * (0.55 + 1.8 * l * (1.0 - l));
  c += g * amt * vec3(1.0, 0.94, 0.84);
  c *= uFade;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const makePass = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms, depthTest: false, depthWrite: false, toneMapped: false });

const rt = (w: number, h: number, opts: THREE.RenderTargetOptions = {}) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    ...opts,
  });

export const PostFX: React.FC = () => {
  const { gl, scene, camera, size } = useThree();
  const fx = useFx();

  const res = useMemo(() => {
    const pr = gl.getPixelRatio();
    const w = Math.round(size.width * pr);
    const h = Math.round(size.height * pr);
    const hw = Math.ceil(w / 2);
    const hh = Math.ceil(h / 2);
    const tw = Math.ceil(w / 16);
    const th = Math.ceil(h / 16);
    const gw = Math.max(1, Math.round(w / 4));
    const gh = Math.max(1, Math.round(h / 4));
    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedIntType;
    const sceneRT = rt(w, h, { depthBuffer: true, depthTexture });
    const prepRT = rt(w, h);
    const halfRT = rt(hw, hh);
    const tileRT = rt(tw, th, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const tileDilRT = rt(tw, th, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const bokehRT = rt(hw, hh);
    const dofRT = rt(w, h);
    const glowA = rt(gw, gh);
    const glowB = rt(gw, gh);
    const v2 = (x: number, y: number) => ({ value: new THREE.Vector2(x, y) });
    const prep = makePass(PREP_FRAG, {
      tColor: { value: sceneRT.texture },
      tDepth: { value: depthTexture },
      uTexel: v2(1 / w, 1 / h),
      uNear: { value: 0.5 },
      uFar: { value: 2000 },
      uFocus: { value: 60 },
      uCoc: { value: 10 },
      uMaxCoc: { value: 20 },
      uTilt: { value: 0 },
      uTiltCenter: { value: 0.5 },
      uTiltBand: { value: 0.2 },
    });
    const half = makePass(HALF_FRAG, { tPrep: { value: prepRT.texture }, uTexel: v2(1 / w, 1 / h) });
    const tile = makePass(TILE_FRAG, { tHalf: { value: halfRT.texture }, uHalfTexel: v2(1 / hw, 1 / hh) });
    const dilate = makePass(DILATE_FRAG, { tTile: { value: tileRT.texture }, uTexel: v2(1 / tw, 1 / th) });
    const bokeh = makePass(BOKEH_FRAG, {
      tHalf: { value: halfRT.texture },
      tTile: { value: tileDilRT.texture },
      uHalfTexel: v2(1 / hw, 1 / hh),
      uMaxCoc: { value: 20 },
    });
    const composite = makePass(COMPOSITE_FRAG, { tPrep: { value: prepRT.texture }, tBokeh: { value: bokehRT.texture } });
    const bright = makePass(BRIGHT_FRAG, { tColor: { value: dofRT.texture }, uTexel: v2(1 / w, 1 / h) });
    const blur = makePass(BLUR_FRAG, { tColor: { value: glowA.texture }, uDir: v2(1 / gw, 0) });
    const final = makePass(FINAL_FRAG, {
      tColor: { value: dofRT.texture },
      tGlow: { value: glowA.texture },
      uRes: v2(w, h),
      uExposure: { value: 1 },
      uGlow: { value: 0.5 },
      uGrain: { value: 0.04 },
      uVignette: { value: 0.3 },
      uLift: { value: 0.01 },
      uFrame: { value: 0 },
      uFade: { value: 1 },
    });
    const quadScene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), prep);
    quad.frustumCulled = false;
    quadScene.add(quad);
    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const targets = [sceneRT, prepRT, halfRT, tileRT, tileDilRT, bokehRT, dofRT, glowA, glowB];
    const passes = [prep, half, tile, dilate, bokeh, composite, bright, blur, final];
    return { lastShadowKey: '', w, h, gw, gh, sceneRT, prepRT, halfRT, tileRT, tileDilRT, bokehRT, dofRT, glowA, glowB, prep, half, tile, dilate, bokeh, composite, bright, blur, final, quadScene, quad, quadCam, targets, passes };
  }, [gl, size.width, size.height]);

  useEffect(() => {
    // Draw opaque paper front-to-back (three sorts by material first by default):
    // the diorama is many stacked layers, so early depth rejection saves most shading.
    gl.setOpaqueSort((a: { z: number; id: number }, b: { z: number; id: number }) => (a.z !== b.z ? a.z - b.z : a.id - b.id));
  }, [gl]);

  useEffect(
    () => () => {
      res.targets.forEach((t) => t.dispose());
      res.passes.forEach((p) => p.dispose());
    },
    [res],
  );

  useFrame(() => {
    const timing = (window as unknown as { PB_TIMING?: boolean }).PB_TIMING === true;
    const ctx = gl.getContext();
    const T: [string, number][] = [];
    const px = new Uint8Array(4);
    const mark = (name: string) => {
      if (!timing) return;
      gl.setRenderTarget(null);
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, px);
      T.push([name, performance.now()]);
    };
    mark('start');
    const cam = camera as THREE.PerspectiveCamera;
    const scale = Math.min(res.w, res.h) / 1080;
    const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      res.quad.material = mat;
      gl.setRenderTarget(target);
      gl.render(res.quadScene, res.quadCam);
    };
    // Everything that casts a shadow moves on twos, so both frames of a pair share
    // identical shadow maps: re-render them only when the drawing changes.
    const reuse = fx.shadowKey !== '' && fx.shadowKey === res.lastShadowKey;
    gl.shadowMap.autoUpdate = !reuse;
    gl.shadowMap.needsUpdate = !reuse;
    gl.setRenderTarget(res.sceneRT);
    gl.clear();
    gl.render(scene, cam);
    res.lastShadowKey = fx.shadowKey;
    mark('scene');

    const u = res.prep.uniforms;
    u.uNear.value = cam.near;
    u.uFar.value = cam.far;
    u.uFocus.value = fx.focusDist;
    u.uCoc.value = fx.coc * scale;
    u.uMaxCoc.value = Math.max(1.5, fx.maxCoc * scale);
    u.uTilt.value = fx.tilt * scale;
    u.uTiltCenter.value = fx.tiltCenter;
    u.uTiltBand.value = fx.tiltBand;
    pass(res.prep, res.prepRT);
    pass(res.half, res.halfRT);
    pass(res.tile, res.tileRT);
    pass(res.dilate, res.tileDilRT);
    res.bokeh.uniforms.uMaxCoc.value = Math.max(1.5, fx.maxCoc * scale);
    pass(res.bokeh, res.bokehRT);
    pass(res.composite, res.dofRT);
    mark('dof');

    pass(res.bright, res.glowA);
    for (let i = 0; i < 2; i++) {
      const k = 1 + i * 1.5;
      res.blur.uniforms.tColor.value = res.glowA.texture;
      res.blur.uniforms.uDir.value.set(k / res.gw, 0);
      pass(res.blur, res.glowB);
      res.blur.uniforms.tColor.value = res.glowB.texture;
      res.blur.uniforms.uDir.value.set(0, k / res.gh);
      pass(res.blur, res.glowA);
    }
    mark('glow');

    const f = res.final.uniforms;
    f.uExposure.value = fx.exposure;
    f.uGlow.value = fx.glow;
    f.uGrain.value = fx.grain;
    f.uVignette.value = fx.vignette;
    f.uLift.value = fx.lift;
    f.uFrame.value = fx.frame;
    f.uFade.value = fx.fade;
    pass(res.final, null);
    mark('final');
    if (timing) console.error('TIMING ' + T.slice(1).map((t, i) => `${t[0]}=${Math.round(t[1] - T[i][1])}`).join(' '));
  }, 1);

  return null;
};
