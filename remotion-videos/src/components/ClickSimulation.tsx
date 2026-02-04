import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig, Easing } from 'remotion';

interface ClickSimulationProps {
  startFrame: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  moveDuration?: number;
  showRipple?: boolean;
}

export const ClickSimulation: React.FC<ClickSimulationProps> = ({
  startFrame,
  fromX,
  fromY,
  toX,
  toY,
  moveDuration = 25,
  showRipple = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const totalDuration = moveDuration + 30;
  if (frame < startFrame || frame > startFrame + totalDuration) {
    return null;
  }

  const localFrame = frame - startFrame;

  // Cursor movement
  const moveProgress = interpolate(
    localFrame,
    [0, moveDuration],
    [0, 1],
    {
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  const x = fromX + (toX - fromX) * moveProgress;
  const y = fromY + (toY - fromY) * moveProgress;

  // Click animation (after movement)
  const clickFrame = localFrame - moveDuration;
  const isClicking = clickFrame >= 0;

  const clickScale = isClicking
    ? interpolate(clickFrame, [0, 4, 10], [1, 0.85, 1], {
        extrapolateRight: 'clamp',
      })
    : 1;

  // Ripple effect
  const rippleOpacity = isClicking && showRipple
    ? interpolate(clickFrame, [0, 20], [0.6, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  const rippleScale = isClicking
    ? interpolate(clickFrame, [0, 20], [0, 2.5], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      })
    : 0;

  return (
    <>
      {/* Ripple effect at click target */}
      {showRipple && rippleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            left: toX - 15,
            top: toY - 15,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '2px solid #1D4ED8',
            opacity: rippleOpacity,
            transform: `scale(${rippleScale})`,
            pointerEvents: 'none',
            zIndex: 9998,
          }}
        />
      )}

      {/* Cursor */}
      <div
        style={{
          position: 'absolute',
          left: x,
          top: y,
          width: 24,
          height: 24,
          pointerEvents: 'none',
          zIndex: 9999,
          transform: `scale(${clickScale})`,
          transformOrigin: 'top left',
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3L3 21L9.5 14.5L15.5 21L18 18.5L12 12.5L19 5.5L3 3Z"
            fill="#020412"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </>
  );
};
