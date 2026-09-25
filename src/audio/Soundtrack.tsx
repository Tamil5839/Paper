import React from 'react';
import { Html5Audio, Sequence, staticFile } from 'remotion';
import { clamp } from '../lib/anim';
import { CUES, musicDb } from './cues';

// Your own score: drop it at public/music.mp3 (or public/music/music.mp3) and it
// replaces the generated music-box placeholder. The level automation below
// (quiet while ideas fail, swelling at dawn) applies to whatever track is used.
const MUSIC_CANDIDATES = ['music.mp3', 'music/music.mp3'];
const PLACEHOLDER = 'music/placeholder-musicbox.mp3';

const publicFiles = (): string[] => {
  if (typeof window === 'undefined') return [];
  const files = (window as unknown as { remotion_staticFiles?: { name: string }[] }).remotion_staticFiles;
  return files ? files.map((f) => f.name) : [];
};

export const musicFile = () => {
  const files = publicFiles();
  return MUSIC_CANDIDATES.find((m) => files.includes(m)) ?? PLACEHOLDER;
};

const FILE_FRAMES: Record<string, number> = {};

export const Soundtrack: React.FC = () => {
  const music = musicFile();
  return (
    <>
      <Html5Audio src={staticFile(music)} volume={(f) => Math.pow(10, musicDb(f) / 20)} />
      {CUES.map((cue, i) => {
        const fadeIn = cue.fadeIn ?? 0;
        const fadeOut = cue.fadeOut ?? 0;
        const dur = cue.dur ?? FILE_FRAMES[cue.src];
        return (
          <Sequence key={i} from={cue.at} durationInFrames={dur} name={cue.src.replace('sfx/', '')} layout="none">
            <Html5Audio
              src={staticFile(cue.src)}
              loop={cue.loop}
              volume={(f) => {
                let v = cue.vol;
                if (fadeIn > 0) v *= clamp(f / fadeIn);
                if (fadeOut > 0 && dur) v *= clamp((dur - f) / fadeOut);
                return v;
              }}
            />
          </Sequence>
        );
      })}
    </>
  );
};
