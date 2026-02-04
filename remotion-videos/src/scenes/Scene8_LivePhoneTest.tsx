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
import { ClickSimulation } from '../components/ClickSimulation';
import { FormFillSimulation } from '../components/FormFillSimulation';

interface TranscriptLineProps {
  text: string;
  appearFrame: number;
  index: number;
  frame: number;
  fps: number;
}

const TranscriptLine: React.FC<TranscriptLineProps> = ({
  text,
  appearFrame,
  index,
  frame,
  fps,
}) => {
  if (frame < appearFrame) {
    return null;
  }

  const localFrame = frame - appearFrame;

  const springVal = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 110 },
  });

  const opacity = springVal;
  const translateY = interpolate(springVal, [0, 1], [14, 0]);

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
        fontSize: '14px',
        lineHeight: 1.5,
        color: '#ffffff',
      }}
    >
      {text}
    </div>
  );
};

export const Scene8_LivePhoneTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in from frames 0-15
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Crossfade to active call screenshot at frames 100-120
  const screenshotTransition = interpolate(frame, [100, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Call timer: starts counting at frame 120, increments every 30 frames
  const timerSeconds =
    frame >= 120 ? Math.floor((frame - 120) / 30) : 0;
  const timerDisplay = `0:${timerSeconds.toString().padStart(2, '0')}`;

  // Call timer badge spring animation
  const timerSpring = spring({
    frame: Math.max(0, frame - 120),
    fps,
    config: { damping: 18, stiffness: 100 },
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
          boxShadow:
            '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
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
            Voxanne AI - Live Phone Test
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
          {/* Screenshot 1: call form (fades out with crossfade) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 1 - screenshotTransition,
            }}
          >
            <Img
              src={staticFile('screenshots/09_test_live_call_form.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Screenshot 2: active call (crossfades in at frames 100-120) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: screenshotTransition,
            }}
          >
            <Img
              src={staticFile('screenshots/10_test_live_call_active.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Call timer badge (top-right of screenshot area, appears after frame 120) */}
          {frame >= 120 && (
            <div
              style={{
                position: 'absolute',
                top: '16px',
                right: '20px',
                backgroundColor: 'rgba(2, 4, 18, 0.85)',
                borderRadius: '10px',
                padding: '8px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                zIndex: 250,
                opacity: timerSpring,
                transform: `scale(${interpolate(timerSpring, [0, 1], [0.8, 1])})`,
                backdropFilter: 'blur(6px)',
              }}
            >
              {/* Pulsing red dot */}
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  backgroundColor: '#ef4444',
                  boxShadow: '0 0 6px rgba(239, 68, 68, 0.6)',
                  opacity: interpolate(
                    Math.sin(frame * 0.15),
                    [-1, 1],
                    [0.5, 1]
                  ),
                }}
              />
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily:
                    'system-ui, -apple-system, Inter, sans-serif',
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '0.04em',
                }}
              >
                {timerDisplay}
              </div>
              <div
                style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '12px',
                  fontWeight: 500,
                  fontFamily:
                    'system-ui, -apple-system, Inter, sans-serif',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                Live
              </div>
            </div>
          )}

          {/* Transcript overlay (bottom of screenshot area, appears after frame 140) */}
          {frame >= 140 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'rgba(2, 4, 18, 0.82)',
                backdropFilter: 'blur(8px)',
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                zIndex: 250,
                padding: '4px 0',
              }}
            >
              {/* Transcript header */}
              <div
                style={{
                  padding: '6px 16px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'rgba(255, 255, 255, 0.5)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily:
                    'system-ui, -apple-system, Inter, sans-serif',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}
              >
                Live Transcript
              </div>

              <TranscriptLine
                text="Patient: Hi, I need to schedule a follow-up..."
                appearFrame={140}
                index={0}
                frame={frame}
                fps={fps}
              />
              <TranscriptLine
                text="AI: Of course! Let me check available times..."
                appearFrame={170}
                index={1}
                frame={frame}
                fps={fps}
              />
              <TranscriptLine
                text="AI: I've booked you for Wednesday at 3 PM."
                appearFrame={200}
                index={2}
                frame={frame}
                fps={fps}
              />
            </div>
          )}
        </div>
      </div>

      {/* Primary TextOverlay at top */}
      <TextOverlay
        text="Now test with a real phone call"
        startFrame={0}
        duration={60}
        fontSize={44}
        position="top"
      />

      {/* Phone number form fill */}
      <FormFillSimulation
        text="+1 (555) 867-5309"
        startFrame={20}
        x={500}
        y={400}
        width={350}
      />

      {/* Cursor moves to "Call Me" button and clicks */}
      <ClickSimulation
        startFrame={80}
        fromX={675}
        fromY={400}
        toX={660}
        toY={480}
      />

      {/* Final TextOverlay at bottom */}
      <TextOverlay
        text="AI handles the entire conversation"
        startFrame={210}
        duration={30}
        position="bottom"
        withBackground={true}
      />
    </div>
  );
};
