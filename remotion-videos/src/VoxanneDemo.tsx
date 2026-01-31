import React from 'react';
import { Series } from 'remotion';
import { Scene1_Problem } from './scenes/Scene1_Problem';
import { Scene2_Solution } from './scenes/Scene2_Solution';
import { Scene3_GoogleAuth } from './scenes/Scene3_GoogleAuth';
import { Scene4_Result } from './scenes/Scene4_Result';

export const VoxanneDemo: React.FC = () => {
  return (
    <div className="bg-sterile-white w-full h-full">
      <Series>
        {/* Scene 1: The Problem (0-5s = 150 frames at 30fps) */}
        <Series.Sequence durationInFrames={150}>
          <Scene1_Problem />
        </Series.Sequence>

        {/* Scene 2: The Solution (5-12s = 210 frames at 30fps) */}
        <Series.Sequence durationInFrames={210}>
          <Scene2_Solution />
        </Series.Sequence>

        {/* Scene 3: Google Calendar Integration (12-22s = 300 frames at 30fps) */}
        <Series.Sequence durationInFrames={300}>
          <Scene3_GoogleAuth />
        </Series.Sequence>

        {/* Scene 4: The Result (22-30s = 240 frames at 30fps) */}
        <Series.Sequence durationInFrames={240}>
          <Scene4_Result />
        </Series.Sequence>
      </Series>
    </div>
  );
};
