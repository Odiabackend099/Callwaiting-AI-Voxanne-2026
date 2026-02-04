import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { StepIndicator } from '../components/StepIndicator';
import { ClickSimulation } from '../components/ClickSimulation';
import { FormFillSimulation } from '../components/FormFillSimulation';

export const Scene5_ConnectTelephony: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in screenshot from frames 0-15
  const screenshotOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Green "Connected!" badge spring animation (appears after frame 185)
  const connectedScale = spring({
    frame: Math.max(0, frame - 185),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const connectedOpacity = frame >= 185 ? connectedScale : 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F9FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Screenshot in browser chrome frame */}
      <div
        style={{
          width: '90%',
          height: '90%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.1)',
          overflow: 'hidden',
          opacity: screenshotOpacity,
          position: 'relative',
        }}
      >
        {/* macOS browser chrome header */}
        <div
          style={{
            height: '40px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '16px',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ff5f56',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ffbd2e',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#27c93f',
            }}
          />
          <div
            style={{
              marginLeft: '12px',
              fontSize: '12px',
              color: '#666666',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            }}
          >
            Telephony Setup
          </div>
        </div>

        {/* Screenshot image */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile('screenshots/04_telephony_credentials.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </div>

      {/* TextOverlay at top */}
      <TextOverlay
        text="Connect Your Phone Number"
        subtitle="Enter your Twilio credentials to link your business number"
        startFrame={0}
        duration={60}
        fontSize={44}
      />

      {/* StepIndicator at bottom */}
      <StepIndicator
        currentStep={4}
        totalSteps={6}
        label="Phone Setup"
      />

      {/* Sequential FormFillSimulations */}

      {/* 1. Account SID */}
      <FormFillSimulation
        text="AC7f8e2d1a9b3c..."
        startFrame={30}
        x={460}
        y={340}
        width={400}
        label="Account SID"
      />

      {/* 2. Auth Token (masked) */}
      <FormFillSimulation
        text="sk_live_x9y8z7..."
        startFrame={75}
        x={460}
        y={410}
        width={400}
        masked={true}
        label="Auth Token"
      />

      {/* 3. Phone Number */}
      <FormFillSimulation
        text="+1 (555) 234-5678"
        startFrame={120}
        x={460}
        y={480}
        width={400}
        label="Phone Number"
      />

      {/* ClickSimulation: cursor moves to Save button after form fill */}
      <ClickSimulation
        startFrame={160}
        fromX={660}
        fromY={480}
        toX={660}
        toY={550}
      />

      {/* Green "Connected!" badge (appears after click at frame 185+) */}
      {frame >= 185 && (
        <div
          style={{
            position: 'absolute',
            left: 580,
            top: 540,
            backgroundColor: '#22c55e',
            borderRadius: '10px',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)',
            zIndex: 300,
            transform: `scale(${connectedScale})`,
            opacity: connectedOpacity,
          }}
        >
          {/* White checkmark */}
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
          >
            <path
              d="M3 9L7.5 13.5L15 4.5"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            Connected!
          </span>
        </div>
      )}
    </div>
  );
};
