import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Soundtrack } from './Soundtrack';

/** The film's complete sound mix on its own (for fast audio renders / muxing). */
export const SoundtrackOnly: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: '#000' }}>
    <Soundtrack />
  </AbsoluteFill>
);
