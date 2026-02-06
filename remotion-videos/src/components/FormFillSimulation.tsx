import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';
import { getCoordinates } from '../utils/manifest-loader';

interface FormFillSimulationProps {
  // Semantic name support (NEW)
  elementName?: string;
  screenshotName?: string;

  // Legacy explicit coordinates (backward compatible)
  x?: number;
  y?: number;
  width?: number;
  height?: number;

  // Animation and content props
  text: string;
  startFrame: number;
  fontSize?: number;
  charRate?: number;
  masked?: boolean;
  label?: string;
}

export const FormFillSimulation: React.FC<FormFillSimulationProps> = ({
  elementName,
  screenshotName,
  x: explicitX,
  y: explicitY,
  width: explicitWidth,
  height: explicitHeight,
  text,
  startFrame,
  fontSize = 15,
  charRate = 2,
  masked = false,
  label,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Load coordinates from manifest if semantic name provided
  let x = explicitX;
  let y = explicitY;
  let width = explicitWidth;
  let height = explicitHeight ?? 40;

  if (elementName && screenshotName) {
    const coords = getCoordinates(screenshotName, elementName);
    if (coords) {
      x = coords.x;
      y = coords.y;
      width = coords.width;
      height = coords.height;
    } else {
      console.warn(`⚠️ FormFillSimulation: Element "${elementName}" not found in manifest "${screenshotName}"`);
    }
  }

  // Validate coordinates are available
  if (x === undefined || y === undefined || width === undefined) {
    console.error('FormFillSimulation: Missing coordinates. Provide either (elementName + screenshotName) OR (x, y, width)');
    return null;
  }

  const typingDuration = text.length * charRate + 10;
  if (frame < startFrame - 5 || frame > startFrame + typingDuration + 20) {
    return null;
  }

  const localFrame = frame - startFrame;

  // Focus state (field highlights when typing starts)
  const isFocused = localFrame >= 0;
  const focusOpacity = spring({
    frame: Math.max(0, localFrame),
    fps,
    config: { damping: 30, stiffness: 200 },
  });

  // Characters typed
  const charsToShow = Math.max(0, Math.floor(localFrame / charRate));
  const displayText = masked
    ? '\u2022'.repeat(Math.min(charsToShow, text.length))
    : text.slice(0, charsToShow);

  // Blinking cursor
  const cursorVisible = charsToShow < text.length
    ? Math.sin(frame * 0.3) > 0
    : false;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        zIndex: 200,
      }}
    >
      {/* Label above field */}
      {label && localFrame >= -5 && (
        <div
          style={{
            position: 'absolute',
            top: -22,
            left: 0,
            color: '#020412',
            fontSize: '13px',
            fontWeight: 600,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            opacity: focusOpacity * 0.7,
          }}
        >
          {label}
        </div>
      )}

      {/* Input field overlay */}
      <div
        style={{
          width,
          height,
          backgroundColor: '#ffffff',
          border: isFocused
            ? `2px solid rgba(29, 78, 216, ${focusOpacity})`
            : '1px solid #d1d5db',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '10px',
          paddingRight: '10px',
          boxShadow: isFocused
            ? `0 0 0 3px rgba(29, 78, 216, ${focusOpacity * 0.15})`
            : 'none',
        }}
      >
        <span
          style={{
            color: '#020412',
            fontSize: `${fontSize}px`,
            fontFamily: 'system-ui, -apple-system, Inter, monospace',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {displayText}
        </span>
        {cursorVisible && (
          <span
            style={{
              display: 'inline-block',
              width: '2px',
              height: `${fontSize + 4}px`,
              backgroundColor: '#1D4ED8',
              marginLeft: '1px',
            }}
          />
        )}
      </div>
    </div>
  );
};
