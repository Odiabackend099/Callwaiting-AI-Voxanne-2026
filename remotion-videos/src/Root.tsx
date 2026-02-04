import React from 'react';
import { Composition } from 'remotion';
import { VoxanneDemo } from './VoxanneDemo';
import './styles.css';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="VoxanneDemo"
        component={VoxanneDemo}
        durationInFrames={2700} // 90 seconds at 30fps
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
