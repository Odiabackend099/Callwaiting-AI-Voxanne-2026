import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

interface CursorProps {
  startFrame: number;
  endFrame: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  visible?: boolean;
}

export const Cursor: React.FC<CursorProps> = ({
  startFrame,
  endFrame,
  fromX,
  fromY,
  toX,
  toY,
  visible = true,
}) => {
  const frame = useCurrentFrame();

  if (!visible || frame < startFrame || frame > endFrame) {
    return null;
  }

  const progress = interpolate(
    frame,
    [startFrame, endFrame],
    [0, 1],
    {
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const x = fromX + (toX - fromX) * progress;
  const y = fromY + (toY - fromY) * progress;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        width: '20px',
        height: '20px',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      {/* Cursor arrow SVG */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 2L2 18L10 12L18 20L20 18L12 10L18 2L2 2Z"
          fill="#020412"
          stroke="#F0F9FF"
          strokeWidth="0.5"
        />
      </svg>
    </div>
  );
};
