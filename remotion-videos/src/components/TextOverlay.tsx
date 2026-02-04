import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

interface TextOverlayProps {
  text: string;
  startFrame: number;
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
  fontSize?: number;
  subtitle?: string;
  subtitleSize?: number;
  withBackground?: boolean;
  style?: React.CSSProperties;
}

export const TextOverlay: React.FC<TextOverlayProps> = ({
  text,
  startFrame,
  duration = 90,
  position = 'top',
  fontSize = 52,
  subtitle,
  subtitleSize = 28,
  withBackground = true,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame > startFrame + duration) {
    return null;
  }

  const localFrame = frame - startFrame;

  const fadeIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 30, stiffness: 120 },
  });

  const fadeOut = localFrame > duration - 15
    ? interpolate(localFrame, [duration - 15, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const translateY = interpolate(fadeIn, [0, 1], [30, 0]);
  const opacity = fadeIn * fadeOut;

  const positionStyles: React.CSSProperties = {
    top: position === 'top' ? '40px' : position === 'center' ? '50%' : 'auto',
    bottom: position === 'bottom' ? '100px' : 'auto',
    transform: position === 'center'
      ? `translate(-50%, calc(-50% + ${translateY}px))`
      : `translateY(${translateY}px)`,
    left: position === 'center' ? '50%' : '60px',
    right: position === 'center' ? 'auto' : '60px',
  };

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 100,
        opacity,
        ...positionStyles,
        ...style,
      }}
    >
      {withBackground && (
        <div
          style={{
            position: 'absolute',
            inset: '-16px -24px',
            backgroundColor: 'rgba(2, 4, 18, 0.85)',
            borderRadius: '12px',
            backdropFilter: 'blur(8px)',
          }}
        />
      )}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            color: '#ffffff',
            fontSize: `${fontSize}px`,
            fontWeight: 700,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {text}
        </div>
        {subtitle && (
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: `${subtitleSize}px`,
              fontWeight: 400,
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              marginTop: '8px',
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
};
