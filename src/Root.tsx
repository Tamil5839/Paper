import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { SoundtrackOnly } from './audio/SoundtrackOnly';
import { DURATION, FPS } from './story';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaperBirds" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ variant: 'wide' as const }} />
    <Composition id="PaperBirdsFeed" component={Film} durationInFrames={DURATION} fps={FPS} width={1080} height={1350} defaultProps={{ variant: 'feed' as const }} />
    {/* audio-only helper: renders the soundtrack mix without the (slow) 3D picture */}
    <Composition id="PaperBirdsSoundtrack" component={SoundtrackOnly} durationInFrames={DURATION} fps={FPS} width={320} height={180} />
  </>
);
