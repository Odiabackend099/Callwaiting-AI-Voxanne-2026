import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Img,
  staticFile,
  AbsoluteFill,
  Easing,
} from 'remotion';
import { ClickSimulation } from '../components/ClickSimulation';

/**
 * Scene1: Zero to Hero Flow
 *
 * A cinematic transition from Homepage to Dashboard with cursor interaction.
 *
 * Part A (00:00 - 00:04): Homepage with Ken Burns zoom
 * Part B (00:04 - 00:10): Dashboard with cursor animation
 *
 * Total duration: 10 seconds (300 frames at 30fps)
 */
export const Scene1_ZeroToHero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overall opacity fade in for smooth start
  const fadeInOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: fadeInOpacity }}>
      {/* Part A: Homepage with Ken Burns zoom (0-120 frames / 0-4 seconds) */}
      {frame < 120 && (
        <HomepagePart frame={frame} />
      )}

      {/* Part B: Dashboard with cursor animation (120-300 frames / 4-10 seconds) */}
      {frame >= 120 && (
        <DashboardPart frame={frame - 120} />
      )}
    </AbsoluteFill>
  );
};

/**
 * Part A: Homepage with cinematic Ken Burns zoom
 * Duration: 4 seconds (120 frames)
 *
 * Visual: Slow zoom into hero section (1.0 → 1.05 scale)
 * Creates cinematic "pulling in" effect
 */
const HomepagePart: React.FC<{ frame: number }> = ({ frame }) => {
  // Ken Burns effect: slow zoom from 1.0 to 1.05
  const kenBurnsScale = interpolate(
    frame,
    [0, 120],
    [1.0, 1.05],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Slight vertical pan upward
  const panY = interpolate(
    frame,
    [0, 120],
    [0, -30],
    {
      easing: Easing.inOut(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#F0F9FF' }}>
      {/* Browser chrome container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
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
          {/* Title */}
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
            voxanne.ai
          </div>
        </div>

        {/* Screenshot content with Ken Burns effect */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile('screenshots/01_homepage.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${kenBurnsScale}) translateY(${panY}px)`,
              transformOrigin: 'center top',
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Part B: Dashboard with slide transition and cursor animation
 * Duration: 6 seconds (180 frames)
 *
 * Timeline:
 * - 0-30 frames: Slide in from right
 * - 30-180 frames: Cursor animates to button + click
 */
const DashboardPart: React.FC<{ frame: number }> = ({ frame }) => {
  // Slide in from right (first 30 frames)
  const slideX = interpolate(
    frame,
    [0, 30],
    [100, 0],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Fade in during slide transition
  const slideOpacity = interpolate(
    frame,
    [0, 30],
    [0.8, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  return (
    <AbsoluteFill style={{ backgroundColor: '#F0F9FF' }}>
      {/* Browser chrome container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${slideX}%), -50%)`,
          width: '90%',
          height: '90%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
          overflow: 'hidden',
          opacity: slideOpacity,
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
          {/* Title */}
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
            Dashboard — Voxanne AI
          </div>
        </div>

        {/* Screenshot content area */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile('screenshots/02_dashboard.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Cursor animation: moves from center to "Create Assistant" button */}
          {/* Uses manifest coordinates for precise positioning */}
          <ClickSimulation
            screenshotName="02_dashboard.png"
            fromX={960}  // Screen center X (1920 / 2)
            fromY={540}  // Screen center Y (1080 / 2)
            toElementName="create-assistant-btn"  // Loads coordinates from 02_dashboard.json manifest
            startFrame={30}  // Start after slide transition
            moveDuration={60}  // 2 seconds (60 frames at 30fps)
            showRipple={true}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
