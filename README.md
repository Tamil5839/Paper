# Paper Birds

A 75-second short film, generated entirely in code, in the style of a handmade
paper toy theatre: a layered cut-paper diorama of Bangalore at night, puppets on
visible wooden sticks, a red paper curtain and a cream proscenium arch, filmed as
if by a macro lens.

An indie builder works late in a small room. Their ideas are folded paper birds
that lift off the laptop and fall, again and again, until one, folded slowly by
hand from a coral sheet, finally flies out of the window into the dawn.

* **Stack:** Remotion 4 + `@remotion/three` + three.js (React Three Fiber). Every
  frame is a pure function of `useCurrentFrame()`; all randomness comes from seeded
  PRNGs, so each render is identical.
* **Compositions:** `PaperBirds` (1920×1080) and `PaperBirdsFeed` (1080×1350, 4:5,
  with its own camera framing), 24 fps, 1800 frames.
* **Output:** H.264, yuv420p, CRF 16, AAC audio (for X/Twitter).
* **No assets:** textures, geometry, lettering, sound effects and the placeholder
  score are all generated in code. Every design is original; nothing reproduces
  an existing brand, logo or product.

## Quick start

```bash
npm install
npm run studio        # interactive preview (Remotion Studio)
npm run stills        # quality-checklist stills -> out/stills/
npm run render        # 16:9  -> out/paper-birds-16x9.mp4
npm run render:feed   # 4:5   -> out/paper-birds-4x5.mp4
npm run audio         # regenerate public/sfx/*.wav and the placeholder score
```

### Rendering on a machine without a GPU

The film uses WebGL. With a GPU, Remotion's default `angle` backend is fast. On a
server or container without one, use SwiftShader software rendering:

```bash
PAPER_BIRDS_GL=swangle npm run render
```

The output is the same; it just takes longer (about 3–4 s per frame on 4 CPU cores,
so a full cut takes roughly 1.5–2 h). Other environment variables:

| variable | effect |
| --- | --- |
| `PAPER_BIRDS_GL` | Chromium GL backend: `angle` (default), `swangle`, `egl`, `vulkan` |
| `PAPER_BIRDS_BROWSER` | path to a Chrome/Chromium headless shell to use instead of Remotion's own |
| `PAPER_BIRDS_CONCURRENCY` | render tabs (default 1; see *Performance* below) |

`npm run stills` renders the checklist frames 150, 350, 600, 850, 1050, 1300, 1500
and 1750 for both compositions. Pick your own with
`FRAMES=90,400 COMPS=PaperBirds npm run stills`.

If you render the picture with `--muted` (or change only the sound), put the
soundtrack on afterwards without re-rendering the picture:

```bash
node scripts/mux-audio.mjs out/video-16x9.mp4 out/paper-birds-16x9.mp4
```

## Story beats

All timing lives in [`src/story.ts`](src/story.ts). Change a number there and every
puppet, light, camera move and sound cue keyed to that beat follows.

| shot | frames | seconds | what happens |
| --- | --- | --- | --- |
| Opening | 0–192 | 0–8 | Darkness; a warm spot comes up on the closed curtain; the *Paper Birds* banner drops in on two sticks; the curtain opens on the night city; slow push through the arch |
| The city | 192–432 | 8–18 | The camera glides through the layers with parallax; the metro strip slides across; an auto-rickshaw passes on its stick; clouds drift on sticks; arrival at the lit room |
| First ideas | 432–720 | 18–30 | The builder types; a bird lifts off the laptop, stalls, falls, crumples and rolls into the wastebasket; one hits the ceiling; one loses a wing; the builder slumps |
| Time passing | 720–960 | 30–40 | The moon crosses on its stick; coffee tumblers multiply; calendar pages flip away; the wastebasket overflows |
| Rain | 960–1152 | 40–48 | Paper raindrops on threads; a bird flies out, gets wet, droops and falls; the lamp flickers; lightning, then thunder |
| The turn | 1152–1392 | 48–58 | Close-up: the builder pulls a coral sheet from under the stack and folds it; pause; the bird wobbles, lifts, steadies |
| Flight | 1392–1632 | 58–68 | The red bird flies out of the window and the camera follows it up over the rooftops and palms; the rain rig is hauled away; the dawn backcloth is lowered; a paper sun rises; windows go dark; the bird circles above the city |
| Reveal | 1632–1800 | 68–75 | Pull back to the whole theatre on a wooden table in a room; the curtain closes; a handwritten tag drops in on a string; hold |

### Changing the words

`TEXT` in [`src/story.ts`](src/story.ts) holds the banner title and the two tag
lines. They are written with the film's own hand-drawn stroke alphabet
([`src/paper/lettering.ts`](src/paper/lettering.ts)), which only contains the
glyphs the film uses: `P B a b d e f i l m n o p r s t u w y . 0-9` and space. To
use another letter, add its strokes to `GLYPHS` (units are em: baseline 0,
x-height 0.5).

### Changing story beats

* **Timing:** `SHOTS` and `BEATS` in [`src/story.ts`](src/story.ts).
* **Choreography:** bird flight paths, the builder's poses, the paper balls,
  tumblers, calendar pages and the folding sheet are pure functions of the frame in
  [`src/scene/actors.ts`](src/scene/actors.ts). The builder's pose timeline is
  `TIMELINE` (frame → named pose).
* **Camera:** keyframed runs in [`src/scene/camera.ts`](src/scene/camera.ts) (a new run
  is a cut). Each key sets position, look-at target, lens (`fov`), bokeh (`coc`) and
  tilt-shift (`tilt`). The optional `feedPos` / `feedTarget` / `feedFov` fields reframe
  the 4:5 cut. Focus follows the story subject (`subjectAt`), and the flight shot
  trails the red bird along its own path (`FOLLOW`).
* **Lighting:** cues in [`src/scene/lighting.ts`](src/scene/lighting.ts) (night key,
  stage spot, desk lamp flicker, lightning, dawn, window light at the reveal).
* **Sound:** the cue sheet in [`src/audio/cues.ts`](src/audio/cues.ts) is keyed to the
  same beats.

## How the paper look is made

* **Cut card:** every piece is authored as SVG path data in code
  ([`src/paper/path.ts`](src/paper/path.ts), [`src/paper/shapes.ts`](src/paper/shapes.ts)),
  resampled and given a seeded hand-cut wobble, then extruded with `ExtrudeGeometry`
  into 0.6 mm card (1 unit = 1 cm) with no bevel
  ([`src/paper/cutout.ts`](src/paper/cutout.ts)). Faces use the printed paper, cut edges
  the lighter paper core, and backs plain card. Large flats (sky, curtain pleats,
  arch, banner) are subdivided and gently bent.
* **Paper:** a tileable fibre texture, normal map and roughness map are generated at
  start-up ([`src/paper/textures.ts`](src/paper/textures.ts)): fbm formation, thousands
  of splatted fibres, tiny colour drift. "Printed" pieces (floor tiles, stage boards,
  wall, calendar pages, keyboard, the tag's handwriting) are drawn on a canvas and
  multiplied into the fibres ([`src/paper/print.ts`](src/paper/print.ts)).
* **Layers and shadows:** flats stand 1–3 cm apart and every one casts onto the ones
  behind. The key light has a 4096 shadow map; since three r186 dropped
  `PCFSoftShadowMap`, [`src/post/shadowPatch.ts`](src/post/shadowPatch.ts) replaces its
  5-tap PCF with an adaptive soft PCF (a 5-tap probe, then a 16-tap Vogel disk inside
  penumbrae) so each layer gets a smooth shadow halo. A few pieces sit on visible
  folded paper tabs (the arch ornaments, the sticks).
* **Vellum:** windows, the laptop screen, the moon, the sun, lamp and street lights
  are emissive tracing paper that keeps the fibre texture, with a glow pass so their
  light bleeds into the paper around them. The sunrise backcloth is a translucent
  drop lit from behind.
* **Origami and crumples:** the birds are low-poly folded geometry with hinged inner
  and outer wing panels, so they flap by folding; paper balls are icospheres pushed
  in by noise and random crease planes ([`src/paper/origami.ts`](src/paper/origami.ts)).
* **Lens:** [`src/post/PostFX.tsx`](src/post/PostFX.tsx) runs FXAA, a half-resolution
  golden-angle bokeh depth of field with tile-max CoC and a tilt-shift band, soft
  glow, ACES tone mapping with an indigo shadow lift, a slight vignette and warm film
  grain.
* **Cadence:** puppets and paper animate on twos (12 fps drawings via `onTwos`), and
  wooden sticks carry a seeded hand wobble and a small overshoot; the camera moves
  smoothly at 24 fps.

## Scene structure

```
src/
  story.ts              beats, shots and on-screen text (start here)
  palette.ts            the paper stock
  Film.tsx              one composition: ThreeCanvas + camera + lights + world + post + sound
  Root.tsx              PaperBirds (16:9), PaperBirdsFeed (4:5), PaperBirdsSoundtrack (audio only)
  lib/                  seeded PRNG + noise, easing / keyframes / on-twos / hand wobble
  paper/                SVG paths, cut-out geometry, textures, materials, lettering, origami, prints
  post/                 post chain (DOF, glow, grain, vignette) and the soft-shadow patch
  scene/
    World.tsx           assembles everything below
    Theatre.tsx         proscenium arch, crest, apron, stage floor, wings, box, bushes
    Curtain.tsx         accordion-pleated paper curtain and scalloped valance
    Banner.tsx          title banner on sticks, end tag on a string
    Sky.tsx             night flat with pinhole stars + light box, dawn flat, moon, sun, clouds
    Skyline.tsx         towers with pinhole windows, gopuram, metro viaduct and train
    MidLayer.tsx        rooftops and water tanks, coconut palms, gulmohar
    Street.tsx          compound wall, shop, street lamp, wires, road, auto-rickshaw
    Building.tsx        the builder's building and the cutaway room
    Props.tsx           desk, chair, laptop, desk lamp, filter coffee, wastebasket, calendar
    Builder.tsx         the split-pin puppet
    Birds.tsx           origami birds, crumpled balls, the torn wing, the folding coral sheet
    Rain.tsx            raindrops on threads
    Table.tsx           the wooden table and room for the reveal
    Stick.tsx           wooden sticks, glue tabs, wires
    actors.ts           choreography (pure functions of the frame)
    camera.ts           camera paths and lens
    lighting.ts         lighting cues
  audio/                cue sheet, soundtrack component
scripts/
  stills.mjs            checklist stills
  gen-audio.mjs         deterministic foley + placeholder music box score
  mux-audio.mjs         render the soundtrack alone and mux it onto a video
  profile-frames.mjs    per-stage GPU timings for a frame range
public/
  sfx/                  generated foley (WAV)
  music/                generated placeholder score (MP3)
```

## Sound

* **Foley** ([`scripts/gen-audio.mjs`](scripts/gen-audio.mjs)) is synthesised from
  filtered noise, crackle grains and resonators: paper rustles and slides, wing
  flutters, crumples, the bump in the wastebasket, a wooden stick tap, a ball rolling
  on tiles, a tearing wing, typing, a far metro, an auto-rickshaw's two-stroke engine
  passing, rain on paper, gentle thunder, the lamp's flicker, folds and creases, a
  steel tumbler set down, calendar page flips, crickets, morning birds and room tone.
* **Music:** put your track at `public/music.mp3` (or `public/music/music.mp3`) and
  the film uses it. Until then it plays a generated music-box and soft-piano
  placeholder (`public/music/placeholder-musicbox.mp3`) written to the story.
* **Mix:** the music bed sits at −18 dB, drops to −24 dB while the ideas fail, swells
  to −13 dB on the flight and dawn, and resolves as the curtain closes
  (`musicDb` in [`src/audio/cues.ts`](src/audio/cues.ts)). Foley is close and detailed,
  like a microphone inside the miniature; `FOLEY_GAIN` sets its overall level.

## Performance

Rendering in software GL is dominated by shadow sampling, so a few things keep it
tractable without changing the look: opaque paper draws front to back (early depth
rejection across the stacked layers), the soft PCF only takes all its taps inside
penumbrae, spot-light shadows are on only in the shots where they read, and because
everything that casts a shadow moves on twos, the second frame of each pair reuses
the first frame's shadow maps. That last trick needs frames rendered in order in one
tab, which is why concurrency defaults to 1. On a GPU, raise
`PAPER_BIRDS_CONCURRENCY` freely.
