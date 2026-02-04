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

export const Scene4_UploadKnowledge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in screenshot from frames 0-15
  const screenshotOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Upload progress bar: fills from 0% to 100% between frames 55-100
  const uploadProgress = interpolate(frame, [55, 100], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Green checkmark badge spring animation (appears after frame 100)
  const checkmarkScale = spring({
    frame: Math.max(0, frame - 100),
    fps,
    config: { damping: 12, stiffness: 150 },
  });

  const checkmarkOpacity = frame >= 100 ? checkmarkScale : 0;

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
            Knowledge Base
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
            src={staticFile('screenshots/03_knowledge_base.png')}
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
        text="Train Your AI With Your Data"
        subtitle="Upload your services, pricing, and FAQs"
        startFrame={0}
        duration={60}
        fontSize={44}
      />

      {/* StepIndicator at bottom */}
      <StepIndicator
        currentStep={3}
        totalSteps={6}
        label="Knowledge Base"
      />

      {/* ClickSimulation: cursor moves to upload area */}
      <ClickSimulation
        startFrame={25}
        fromX={960}
        fromY={200}
        toX={700}
        toY={400}
      />

      {/* Upload progress overlay (appears after cursor click at frame 55+) */}
      {frame >= 55 && frame < 100 && (
        <div
          style={{
            position: 'absolute',
            left: 450,
            top: 350,
            width: '350px',
            height: '60px',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            boxShadow: '0 4px 20px rgba(2, 4, 18, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '10px 16px',
            zIndex: 300,
          }}
        >
          {/* Percentage text */}
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#020412',
              marginBottom: '6px',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            }}
          >
            Uploading... {Math.round(uploadProgress)}%
          </div>
          {/* Progress bar track */}
          <div
            style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            {/* Progress bar fill */}
            <div
              style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: '#1D4ED8',
                borderRadius: '4px',
              }}
            />
          </div>
        </div>
      )}

      {/* Green checkmark badge (appears after upload complete at frame 100+) */}
      {frame >= 100 && (
        <div
          style={{
            position: 'absolute',
            left: 500,
            top: 380,
            backgroundColor: '#22c55e',
            borderRadius: '10px',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)',
            zIndex: 300,
            transform: `scale(${checkmarkScale})`,
            opacity: checkmarkOpacity,
          }}
        >
          {/* White checkmark */}
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
          >
            <path
              d="M4 10L8.5 14.5L16 5.5"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            services-pricing.pdf uploaded
          </span>
        </div>
      )}
    </div>
  );
};
