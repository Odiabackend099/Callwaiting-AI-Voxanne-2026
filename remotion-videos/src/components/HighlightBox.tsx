import React from 'react';
import { useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';

interface HighlightBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  startFrame: number;
  duration?: number;
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'right' | 'left';
  color?: string;
}

export const HighlightBox: React.FC<HighlightBoxProps> = ({
  x,
  y,
  width,
  height,
  startFrame,
  duration = 90,
  label,
  labelPosition = 'top',
  color = '#1D4ED8',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (frame < startFrame || frame > startFrame + duration) {
    return null;
  }

  const localFrame = frame - startFrame;

  const scaleIn = spring({
    frame: localFrame,
    fps,
    config: { damping: 20, stiffness: 150 },
  });

  const fadeOut = localFrame > duration - 15
    ? interpolate(localFrame, [duration - 15, duration], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 1;

  const opacity = scaleIn * fadeOut;

  const pulse = 1 + Math.sin(localFrame * 0.15) * 0.02;

  const labelStyles: React.CSSProperties = {
    position: 'absolute',
    ...(labelPosition === 'top' && { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: '6px' }),
    ...(labelPosition === 'bottom' && { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: '6px' }),
    ...(labelPosition === 'right' && { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: '8px' }),
    ...(labelPosition === 'left' && { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: '8px' }),
  };

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: `3px solid ${color}`,
        borderRadius: '8px',
        opacity,
        transform: `scale(${pulse})`,
        zIndex: 120,
        pointerEvents: 'none',
        boxShadow: `0 0 12px ${color}40, inset 0 0 8px ${color}10`,
      }}
    >
      {label && (
        <div style={labelStyles}>
          <div
            style={{
              backgroundColor: color,
              color: '#ffffff',
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}
          >
            {label}
          </div>
        </div>
      )}
    </div>
  );
};
