import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';

export const Scene1_Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phone shake animation
  const shake = interpolate(
    frame % 20,
    [0, 5, 10, 15, 20],
    [0, -10, 10, -10, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }
  );

  // Counter animation from 12 to 20
  const counterValue = Math.floor(
    spring({
      frame,
      fps,
      from: 12,
      to: 20,
      config: {
        damping: 100,
        stiffness: 200,
      },
    })
  );

  // Text fade in
  const textOpacity = interpolate(frame, [20, 40], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className="w-full h-full bg-sterile-white flex flex-col items-center justify-center">
      {/* Phone Icon (CSS-based) */}
      <div
        style={{
          transform: `rotate(${shake}deg)`,
        }}
        className="mb-12"
      >
        <div className="w-32 h-52 bg-deep-obsidian rounded-3xl relative border-4 border-deep-obsidian">
          {/* Screen */}
          <div className="absolute top-4 left-3 right-3 bottom-4 bg-white rounded-2xl flex items-center justify-center">
            {/* Missed call icon */}
            <div className="text-red-600">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                <line x1="23" y1="1" x2="1" y2="23" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Missed Calls Counter */}
      <div className="text-center mb-8">
        <div className="text-6xl font-bold text-deep-obsidian mb-2">
          {counterValue}
        </div>
        <div className="text-2xl text-gray-600">
          Missed Calls Today
        </div>
      </div>

      {/* Problem Statement */}
      <div
        style={{ opacity: textOpacity }}
        className="text-4xl font-semibold text-deep-obsidian text-center max-w-2xl"
      >
        Your clinic is missing revenue.
      </div>
    </div>
  );
};
