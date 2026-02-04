import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  label: string;
  startFrame?: number;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  currentStep,
  totalSteps,
  label,
  startFrame = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const localFrame = Math.max(0, frame - startFrame);

  const fadeIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 30, stiffness: 100 },
  });

  const progress = currentStep / totalSteps;

  const barWidth = interpolate(fadeIn, [0, 1], [0, progress * 100]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '30px',
        left: '60px',
        right: '60px',
        zIndex: 150,
        opacity: fadeIn,
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(2, 4, 18, 0.8)',
          borderRadius: '12px',
          padding: '12px 20px',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div
          style={{
            color: '#1D4ED8',
            fontSize: '16px',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          Step {currentStep} of {totalSteps}
        </div>
        <div
          style={{
            flex: 1,
            height: '6px',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${barWidth}%`,
              height: '100%',
              backgroundColor: '#1D4ED8',
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '15px',
            fontWeight: 500,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
};
