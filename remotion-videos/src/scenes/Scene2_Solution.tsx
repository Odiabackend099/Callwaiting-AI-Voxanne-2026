import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const Scene2_Solution: React.FC = () => {
  const frame = useCurrentFrame();

  // Dashboard slide in from bottom
  const dashboardY = interpolate(frame, [0, 30], [100, 0], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Dashboard opacity
  const dashboardOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Waveform animation (AI voice visual)
  const waveformActive = frame > 40;
  const bars = Array.from({ length: 20 }, (_, i) => {
    const barHeight = waveformActive
      ? Math.abs(Math.sin((frame - 40 + i * 3) * 0.15)) * 60 + 20
      : 20;
    return barHeight;
  });

  // Text fade in
  const textOpacity = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className="w-full h-full bg-sterile-white flex flex-col items-center justify-center px-16">
      {/* Dashboard Mockup */}
      <div
        style={{
          transform: `translateY(${dashboardY}px)`,
          opacity: dashboardOpacity,
        }}
        className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-4xl mb-12"
      >
        {/* Dashboard Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-surgical-blue rounded-full flex items-center justify-center">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-deep-obsidian">Voxanne AI</h1>
          </div>
          <div className="px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
            ● Active
          </div>
        </div>

        {/* Waveform Visualization */}
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="text-sm text-gray-600 mb-3">AI Voice Activity</div>
          <div className="flex items-end justify-center gap-1 h-24">
            {bars.map((height, index) => (
              <div
                key={index}
                style={{
                  height: `${height}px`,
                  transition: 'height 0.1s ease',
                }}
                className="w-2 bg-surgical-blue rounded-full"
              />
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-surgical-blue">147</div>
            <div className="text-sm text-gray-600">Calls Handled</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-surgical-blue">89</div>
            <div className="text-sm text-gray-600">Appointments</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-2xl font-bold text-surgical-blue">24/7</div>
            <div className="text-sm text-gray-600">Availability</div>
          </div>
        </div>
      </div>

      {/* Solution Text */}
      <div
        style={{ opacity: textOpacity }}
        className="text-center"
      >
        <h2 className="text-5xl font-bold text-deep-obsidian mb-4">
          Meet Voxanne.
        </h2>
        <p className="text-3xl text-gray-700">
          Your 24/7 AI Receptionist
        </p>
      </div>
    </div>
  );
};
