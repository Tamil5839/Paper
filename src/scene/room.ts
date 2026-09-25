// Shared coordinates of the builder's building and room (cm, world space).
export const ROOM = {
  x0: 5.2,
  x1: 23.6,
  floorY: 1.2,
  ceilY: 16.0,
  frontZ: -2.4,
  backZ: -11,
  win: { x0: 8.0, x1: 14.5, y0: 7.8, y1: 14.6 },
  deskTop: 6.6,
  desk: { x0: 6.4, x1: 15.6, zFront: -5.6, zBack: -9.4 },
  hip: [17.15, 5.25, -7.15] as [number, number, number],
  laptop: { x: 12.0, z: -7.5 },
  lampBase: [7.7, 6.6, -8.3] as [number, number, number],
  basket: [21.3, 1.2, -5.3] as [number, number, number],
  calendar: [21.85, 12.2, -10.9] as [number, number, number],
  stack: [14.9, 6.6, -8.2] as [number, number, number],
};
export const BUILDING = { x0: 3, x1: 25.8, top: 27.5 };
