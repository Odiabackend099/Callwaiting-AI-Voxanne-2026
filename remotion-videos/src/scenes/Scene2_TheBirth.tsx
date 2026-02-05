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

/**
 * Scene2: The Birth - Creating the Agent
 *
 * A showcase of the platform's speed: displaying the agent configuration
 * modal with simple animations.
 *
 * Timeline:
 * - 0:00-0:01 (30 frames): Slide in from left, fade in
 * - 0:01-0:08 (210 frames): Display modal with pulsing button
 *
 * Total duration: 8 seconds (240 frames at 30fps)
 */
export const Scene2_TheBirth: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Overall opacity fade in
  const fadeInOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ opacity: fadeInOpacity }}>
      <ModalContent frame={frame} fps={fps} />
    </AbsoluteFill>
  );
};

/**
 * Modal content with animations
 */
const ModalContent: React.FC<{ frame: number; fps: number }> = ({ frame, fps }) => {
  // Slide in from left (0-30 frames)
  const slideX = interpolate(
    frame,
    [0, 30],
    [-100, 0],
    {
      easing: Easing.out(Easing.cubic),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const slideOpacity = interpolate(
    frame,
    [0, 30],
    [0.8, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Pulsing button effect (starts at frame 150)
  const buttonScale = interpolate(
    Math.sin((frame - 150) * (Math.PI / 30)),
    [-1, 1],
    [0.98, 1.02],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const buttonOpacity = frame > 150
    ? interpolate(
        Math.sin((frame - 150) * (Math.PI / 30)),
        [-1, 1],
        [0.7, 1],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        }
      )
    : 0.7;

  return (
    <AbsoluteFill style={{ backgroundColor: '#F0F9FF' }}>
      {/* Browser chrome container */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(calc(-50% + ${slideX}%), -50%)`,
          width: '85%',
          height: '85%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
          overflow: 'hidden',
          opacity: slideOpacity,
        }}
      >
        {/* Browser chrome bar */}
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
              fontSize: '13px',
              color: '#666666',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              fontWeight: 500,
            }}
          >
            Create Agent — Voxanne AI
          </div>
        </div>

        {/* Modal content area - simplified without screenshot dependency */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '40px',
            backgroundImage: 'linear-gradient(135deg, #f5f9ff 0%, #eef5ff 100%)',
          }}
        >
          {/* Title */}
          <h2
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: '#020412',
              marginBottom: '16px',
              textAlign: 'center',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            }}
          >
            Aura - Front Desk
          </h2>

          {/* Description */}
          <p
            style={{
              fontSize: '16px',
              color: '#666666',
              marginBottom: '32px',
              textAlign: 'center',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              maxWidth: '400px',
            }}
          >
            Your AI agent configured and ready to handle customer calls
          </p>

          {/* Pulsing Save button */}
          <button
            style={{
              padding: '12px 32px',
              backgroundColor: '#0066cc',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              transform: `scale(${buttonScale})`,
              opacity: buttonOpacity,
              transition: 'all 0.1s ease-out',
              boxShadow: '0 4px 12px rgba(0, 102, 204, 0.3)',
            }}
          >
            Deploy Agent
          </button>

          {/* Success indicator (fades in from frame 200) */}
          {frame > 200 && (
            <div
              style={{
                marginTop: '32px',
                padding: '12px 16px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #86efac',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#166534',
                fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
                opacity: interpolate(frame, [200, 220], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              ✓ Agent created successfully
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
