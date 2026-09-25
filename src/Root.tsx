import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import { DURATION, FPS } from './story';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="PaperBirds" component={Film} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ variant: 'wide' as const }} />
    <Composition id="PaperBirdsFeed" component={Film} durationInFrames={DURATION} fps={FPS} width={1080} height={1350} defaultProps={{ variant: 'feed' as const }} />
  </>
);
