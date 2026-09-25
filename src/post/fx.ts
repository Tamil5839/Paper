import { createContext, useContext } from 'react';

// Per-frame lens / grade settings written by the camera rig and read by PostFX.
export type FxState = {
  focusDist: number; // cm from camera to the plane of sharp focus
  coc: number; // blur (px @1080p) of something at infinity — the "aperture"
  maxCoc: number; // px clamp
  tilt: number; // extra tilt-shift blur (px per unit of screen height outside the band)
  tiltCenter: number; // 0..1 screen y of the sharp band (0 = bottom)
  tiltBand: number; // half height of the sharp band
  exposure: number;
  grain: number;
  vignette: number;
  glow: number;
  lift: number; // shadow lift toward indigo
  frame: number;
  fade: number; // 0 = black, 1 = picture
  shadowKey: string; // identical for frames whose shadow casters are identical (on twos)
};

export const defaultFx = (): FxState => ({
  focusDist: 60,
  coc: 14,
  maxCoc: 22,
  tilt: 18,
  tiltCenter: 0.5,
  tiltBand: 0.18,
  exposure: 1,
  grain: 0.045,
  vignette: 0.32,
  glow: 0.55,
  lift: 0.012,
  frame: 0,
  fade: 1,
  shadowKey: '',
});

export const FxContext = createContext<FxState>(defaultFx());
export const useFx = () => useContext(FxContext);
