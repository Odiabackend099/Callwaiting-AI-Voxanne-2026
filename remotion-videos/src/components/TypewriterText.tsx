import React from 'react';
import { useCurrentFrame, interpolate } from 'remotion';

interface TypewriterTextProps {
  text: string;
  startFrame: number;
  endFrame: number;
  style?: React.CSSProperties;
  className?: string;
  charDuration?: number;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  startFrame,
  endFrame,
  style,
  className,
  charDuration = 2,
}) => {
  const frame = useCurrentFrame();

  if (frame < startFrame || frame > endFrame) {
    return null;
  }

  const elapsedFrames = frame - startFrame;
  const charsToShow = Math.floor(elapsedFrames / charDuration);
  const displayedText = text.slice(0, charsToShow);

  return (
    <span style={style} className={className}>
      {displayedText}
      {charsToShow < text.length && (
        <span style={{ opacity: 0.5 }}>|</span>
      )}
    </span>
  );
};
