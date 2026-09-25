import { BEATS } from '../story';
import { track } from '../lib/anim';
import { hash1 } from '../lib/random';
import { TOSSES } from '../scene/actors';

// ─────────────────────────────────────────────────────────────────────────────
//  Cue sheet. Frames are the story beats from src/story.ts, so moving a beat
//  moves its sound. `vol` is linear gain; foley is close and detailed, like a
//  microphone inside the miniature; ambience beds loop quietly underneath.
// ─────────────────────────────────────────────────────────────────────────────

export type Cue = {
  at: number;
  src: string; // file in public/
  vol: number;
  dur?: number; // frames to play (default: whole file)
  loop?: boolean;
  fadeIn?: number; // frames
  fadeOut?: number; // frames
};

/** overall foley level (the cue volumes below are relative to it) */
export const FOLEY_GAIN = 1.6;

const b = BEATS;
const c = (at: number, name: string, vol: number, extra: Partial<Cue> = {}): Cue => ({ at, src: `sfx/${name}.wav`, vol: vol * FOLEY_GAIN, ...extra });

// the lamp flickers where the lighting cue dims it (same hash as src/scene/lighting.ts)
const flickerCues: Cue[] = [];
{
  let wasDim = false;
  for (let f = b.flicker[0]; f <= b.flicker[1]; f += 2) {
    const dim = hash1(f >> 1, 91) < 0.4;
    if (dim && !wasDim) flickerCues.push(c(f, 'lamp-flicker', 0.35 + hash1(f, 3) * 0.2));
    wasDim = dim;
  }
}

export const CUES: Cue[] = [
  // 1 opening: a light comes up, the banner, the curtain
  c(b.lightUp[0], 'light-click', 0.45),
  c(b.bannerDrop[0], 'rustle-1', 0.5),
  c(b.bannerDrop[1], 'stick-tap', 0.6),
  c(b.bannerOut[0], 'rustle-3', 0.45),
  c(b.curtainOpen[0], 'slide', 0.62),
  // night ambience: crickets and a far city under the whole night
  c(b.curtainOpen[0] + 20, 'crickets-loop', 0.22, { dur: b.skySwap[0] - b.curtainOpen[0], loop: true, fadeIn: 40, fadeOut: 50 }),
  // 2 the city: clouds slide, the metro, the auto-rickshaw
  c(206, 'rustle-2', 0.18),
  c(b.metro[0] + 4, 'metro', 0.42),
  c(b.auto[0], 'auto', 0.55),
  c(300, 'rustle-3', 0.16),
  // 3 first ideas
  c(b.typing[0], 'typing', 0.5, { dur: 38 }),
  c(b.bird1.lift, 'flutter', 0.5),
  c(b.bird1.lift + 26, 'flutter', 0.38),
  c(b.bird1.falter, 'swish', 0.3),
  c(b.bird1.land, 'crumple', 0.65),
  c(b.bird1.roll, 'roll', 0.45),
  c(b.bird1.bin - 2, 'bin-bump', 0.62),
  c(562, 'typing', 0.38, { dur: 14 }),
  c(b.bird2.lift, 'flutter', 0.55),
  c(b.bird2.ceiling, 'paper-tap', 0.8),
  c(b.bird2.fall + 2, 'crumple-small', 0.55),
  c(b.bird2.bin - 2, 'bin-bump', 0.62),
  c(622, 'typing', 0.38, { dur: 14 }),
  c(b.bird3.lift, 'flutter', 0.5),
  c(b.bird3.wingOff, 'tear', 0.75),
  c(b.bird3.wingOff + 2, 'flutter-slow', 0.3),
  c(b.bird3.land, 'crumple-small', 0.5),
  c(b.slump[0] + 18, 'rustle-3', 0.3),
  // 4 time passing: the moon slides, tumblers, calendar pages, paper everywhere
  c(b.moonCross[0], 'slide-long', 0.22),
  ...b.tumblers.map((f) => c(f, 'tink', 0.42)),
  ...b.calendarFlips.map((f) => c(f, 'page-flip', 0.55)),
  ...TOSSES.flatMap((f, i) => [c(f - 6, 'crumple-small', 0.3), c(f + 8, i >= 7 || i === 4 ? 'paper-tap' : 'bin-bump', i >= 7 || i === 4 ? 0.28 : 0.45)]),
  c(758, 'typing', 0.32, { dur: 40 }),
  c(846, 'typing', 0.28, { dur: 30 }),
  c(940, 'typing', 0.3, { dur: 50 }),
  // 5 rain: the rain rig drops, a bird tries, the lamp flickers, thunder
  c(b.rainIn[0], 'rustle-2', 0.4),
  c(b.rainIn[0] + 6, 'rain-loop', 0.5, { dur: b.rainStop[1] - b.rainIn[0] - 6, loop: true, fadeIn: 30, fadeOut: 40 }),
  c(b.wetBird.lift - 2, 'swish', 0.35),
  c(b.wetBird.lift, 'flutter', 0.5),
  c(b.wetBird.out, 'flutter', 0.32),
  c(b.wetBird.droop, 'flutter-slow', 0.22),
  c(b.wetBird.fall, 'swish', 0.22),
  ...flickerCues,
  c(b.thunder, 'thunder', 0.5),
  // 6 the turn: a coral sheet, five folds, a pause, a wobble, a lift
  c(b.pickSheet, 'rustle-3', 0.45),
  ...b.folds.map((f) => c(f, 'fold', 0.62)),
  c(b.birdMade, 'paper-tap', 0.3),
  c(b.wobble[0], 'rustle-3', 0.18),
  c(b.lift, 'flutter', 0.52),
  c(b.lift + 26, 'flutter', 0.5),
  // 7 flight: out the window, the rain rig hauled away, dawn swapped in, birds wake
  ...[1392, 1418, 1444, 1470, 1500, 1530, 1562, 1596].map((f, i) => c(f, 'flutter', 0.5 - i * 0.03)),
  c(b.rainStop[0], 'rustle-2', 0.38),
  c(b.skySwap[0], 'slide-long', 0.45),
  c(b.sunRise[0] + 10, 'rustle-1', 0.28),
  c(1496, 'morning-birds', 0.32),
  c(1640, 'room-tone-loop', 0.28, { dur: 160, loop: true, fadeIn: 40, fadeOut: 20 }),
  // 8 reveal: the curtain closes, the tag comes down on its string
  c(b.curtainClose[0], 'slide', 0.55),
  c(b.tagDrop[0], 'rustle-1', 0.38),
  c(b.tagDrop[1], 'stick-tap', 0.3),
];

/** Music level in dB: -18 dB bed, quieter while ideas fail, swelling on the flight and dawn. */
export const musicDb = (frame: number) =>
  track(frame, [
    [0, -21],
    [150, -18],
    [432, -18],
    [470, -24],
    [1152, -24],
    [1300, -21],
    [1392, -18],
    [1560, -13],
    [1650, -13],
    [1740, -15],
    [1780, -16],
    [1800, -40],
  ]);
