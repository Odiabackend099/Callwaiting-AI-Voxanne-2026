import React from 'react';
import { useCurrentFrame, spring, useVideoConfig, interpolate } from 'remotion';
import { getCoordinates } from '../utils/manifest-loader';

interface HighlightBoxProps {
  // Semantic name support (NEW)
  elementName?: string;
  screenshotName?: string;

  // Legacy explicit coordinates (backward compatible)
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  // Animation props
  startFrame: number;
  duration?: number;
  label?: string;
  labelPosition?: 'top' | 'bottom' | 'right' | 'left';
  color?: string;
}

export const HighlightBox: React.FC<HighlightBoxProps> = ({
  elementName,
  screenshotName,
  x: explicitX,
  y: explicitY,
  width: explicitWidth,
  height: explicitHeight,
  startFrame,
  duration = 90,
  label,
  labelPosition = 'top',
  color = '#1D4ED8',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load coordinates from manifest if semantic name provided
  let x = explicitX;
  let y = explicitY;
  let width = explicitWidth;
  let height = explicitHeight;

  if (elementName && screenshotName) {
    const coords = getCoordinates(screenshotName, elementName);
    if (coords) {
      x = coords.x;
      y = coords.y;
      width = coords.width;
      height = coords.height;
    } else {
      console.warn(`⚠️ HighlightBox: Element "${elementName}" not found in manifest "${screenshotName}"`);
    }
  }

  // Validate coordinates are available
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    console.error('HighlightBox: Missing coordinates. Provide either (elementName + screenshotName) OR (x, y, width, height)');
    return null;
  }

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
