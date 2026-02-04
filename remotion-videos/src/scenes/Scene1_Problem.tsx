import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const Scene1_Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Line 1: "Your clinic missed 47 calls last week." (frames 0-60)
  const line1Opacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line1Y = interpolate(frame, [5, 20], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Counter: 0 -> 47 (frames 10-50)
  const counterRaw = spring({
    frame: Math.max(0, frame - 10),
    fps,
    from: 0,
    to: 47,
    config: { damping: 50, stiffness: 80 },
  });
  const counterValue = Math.floor(counterRaw);

  // Line 2: "That's $18,800 in lost revenue." (frames 50-90)
  const line2Opacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line2Y = interpolate(frame, [50, 65], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Revenue counter: $0 -> $18,800 (frames 55-90)
  const revenueRaw = spring({
    frame: Math.max(0, frame - 55),
    fps,
    from: 0,
    to: 18800,
    config: { damping: 50, stiffness: 60 },
  });
  const revenueValue = Math.floor(revenueRaw);

  // Line 3: "What if AI answered every single one?" (frames 110-180)
  const line3Opacity = interpolate(frame, [110, 130], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line3Y = interpolate(frame, [110, 130], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const line3Scale = spring({
    frame: Math.max(0, frame - 110),
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 20, stiffness: 100 },
  });

  // Subtle phone ring animation
  const ringPulse = frame < 50 ? Math.sin(frame * 0.5) * 0.3 + 0.7 : 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#020412',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {/* Phone icon ring effect */}
      {frame < 60 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -120%)',
            opacity: ringPulse,
          }}
        >
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
            <line x1="1" y1="1" x2="23" y2="23" stroke="#ef4444" strokeWidth="2" />
          </svg>
        </div>
      )}

      {/* Line 1: Missed calls */}
      <div
        style={{
          opacity: line1Opacity,
          transform: `translateY(${line1Y}px)`,
          textAlign: 'center',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            color: '#ffffff',
            fontSize: '44px',
            fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            letterSpacing: '-0.02em',
          }}
        >
          Your clinic missed{' '}
          <span style={{ color: '#ef4444', fontWeight: 800, fontSize: '56px' }}>
            {counterValue}
          </span>{' '}
          calls last week.
        </div>
      </div>

      {/* Line 2: Revenue loss */}
      <div
        style={{
          opacity: line2Opacity,
          transform: `translateY(${line2Y}px)`,
          textAlign: 'center',
          marginBottom: '48px',
        }}
      >
        <div
          style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '36px',
            fontWeight: 400,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
          }}
        >
          That&apos;s{' '}
          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '48px' }}>
            ${revenueValue.toLocaleString()}
          </span>{' '}
          in lost revenue.
        </div>
      </div>

      {/* Line 3: The hook */}
      <div
        style={{
          opacity: line3Opacity,
          transform: `translateY(${line3Y}px) scale(${line3Scale})`,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            color: '#1D4ED8',
            fontSize: '52px',
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            letterSpacing: '-0.02em',
          }}
        >
          What if AI answered every single one?
        </div>
      </div>

      {/* Voxanne badge */}
      {frame > 140 && (
        <div
          style={{
            position: 'absolute',
            bottom: '50px',
            opacity: interpolate(frame, [140, 160], [0, 0.6], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
          }}
        >
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.4)',
              fontSize: '18px',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            Introducing Voxanne AI
          </div>
        </div>
      )}
    </div>
  );
};
