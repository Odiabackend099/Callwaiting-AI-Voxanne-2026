import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { StepIndicator } from '../components/StepIndicator';
import { HighlightBox } from '../components/HighlightBox';

export const Scene2_DashboardOverview: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overall fade-in from frames 0-15
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns effect: scale 1.0 -> 1.08, translateY 0 -> -15px over 180 frames
  const kenBurnsScale = interpolate(frame, [0, 180], [1.0, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const kenBurnsTranslateY = interpolate(frame, [0, 180], [0, -15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F9FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Browser chrome container */}
      <div
        style={{
          position: 'relative',
          width: '90%',
          height: '90%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
          overflow: 'hidden',
        }}
      >
        {/* macOS-style browser chrome bar */}
        <div
          style={{
            height: '40px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '16px',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Red dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ff5f56',
            }}
          />
          {/* Yellow dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ffbd2e',
            }}
          />
          {/* Green dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#27c93f',
            }}
          />
          {/* Title text */}
          <div
            style={{
              marginLeft: '12px',
              fontSize: '13px',
              color: '#666666',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            Voxanne Dashboard
          </div>
        </div>

        {/* Screenshot content area with Ken Burns effect */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile('screenshots/01_dashboard_home.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${kenBurnsScale}) translateY(${kenBurnsTranslateY}px)`,
              transformOrigin: 'center top',
            }}
          />
        </div>
      </div>

      {/* Text overlay at top */}
      <TextOverlay
        text="Meet Your AI Command Center"
        startFrame={0}
        duration={160}
        fontSize={48}
        position="top"
      />

      {/* Highlight box: Hot Leads */}
      <HighlightBox
        x={100}
        y={200}
        width={350}
        height={180}
        startFrame={60}
        label="Hot Leads"
      />

      {/* Highlight box: Recent Calls */}
      <HighlightBox
        x={500}
        y={200}
        width={350}
        height={180}
        startFrame={90}
        label="Recent Calls"
      />

      {/* Step indicator at bottom */}
      <StepIndicator
        currentStep={1}
        totalSteps={6}
        label="Dashboard Overview"
      />
    </div>
  );
};
