// ─────────────────────────────────────────────────────────────────────────────
//  PAPER BIRDS — story sheet. Every beat, cue and line of text lives here.
//  Frames are at 24 fps. Change a number here and every puppet, light, camera
//  move and sound cue keyed to it follows.
// ─────────────────────────────────────────────────────────────────────────────

export const FPS = 24;
export const DURATION = 1800; // 75 s

export const TEXT = {
  title: 'Paper Birds',
  tagLine1: 'most ideas fall.',
  tagLine2: 'build anyway.',
};

/** The eight shots of the film. */
export const SHOTS = {
  opening: [0, 192], // curtain, title banner, curtain opens, push in
  city: [192, 432], // glide through the layers to the lit window
  firstIdeas: [432, 720], // three birds fail
  timePassing: [720, 960], // moon, tumblers, calendar, wastebasket
  rain: [960, 1152], // rain, a wet bird, lamp flicker, thunder
  turn: [1152, 1392], // folding the red bird
  flight: [1392, 1632], // out the window, up through the layers, dawn
  reveal: [1632, 1800], // pull back to the table, curtain, tag
} as const;

export const BEATS = {
  // opening
  lightUp: [14, 64],
  bannerDrop: [52, 76],
  bannerOut: [128, 146],
  curtainOpen: [140, 188],
  cityLightsOn: [150, 196],
  // city
  metro: [214, 352],
  auto: [292, 392],
  // first ideas
  typing: [432, 468],
  bird1: { lift: 462, apex: 500, falter: 508, fall: 516, land: 536, crumple: 538, roll: 544, bin: 568 },
  bird2: { lift: 566, ceiling: 594, fall: 596, land: 614, crumple: 616, bin: 634 },
  bird3: { lift: 630, wingOff: 658, land: 684, crumple: 686 },
  slump: [690, 716],
  // time passing
  moonCross: [724, 952],
  tumblers: [744, 792, 846, 902, 940],
  calendarFlips: [760, 800, 838, 876, 914],
  binFill: [736, 948],
  // rain
  rainIn: [962, 992],
  wetBird: { lift: 1000, out: 1030, wet: 1044, droop: 1060, fall: 1072 },
  lightning: 1086,
  thunder: 1100,
  flicker: [1066, 1130],
  // the turn
  pickSheet: 1168,
  folds: [1186, 1214, 1242, 1270, 1296],
  birdMade: 1302,
  pause: [1302, 1326],
  wobble: [1326, 1344],
  lift: 1344,
  steady: 1372,
  // flight
  outWindow: 1418,
  rainStop: [1400, 1450],
  skySwap: [1452, 1516],
  sunRise: [1470, 1610],
  windowsDark: [1490, 1590],
  circle: [1560, 1680],
  // reveal
  curtainClose: [1700, 1740],
  tagDrop: [1738, 1762],
  end: 1800,
} as const;
