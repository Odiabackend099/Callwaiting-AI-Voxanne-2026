import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const Scene4_Result: React.FC = () => {
  const frame = useCurrentFrame();

  // Notification slides in from top
  const notificationY = interpolate(frame, [0, 30], [-200, 80], {
    easing: Easing.out(Easing.back(1.5)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const notificationOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Main text fade in
  const textOpacity = interpolate(frame, [40, 60], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const textY = interpolate(frame, [40, 60], [30, 0], {
    easing: Easing.out(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // CTA fade in
  const ctaOpacity = interpolate(frame, [80, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const ctaScale = interpolate(frame, [80, 110], [0.9, 1], {
    easing: Easing.out(Easing.back(1.2)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Pulse animation on CTA button
  const pulseScale =
    frame > 120 ? 1 + Math.sin((frame - 120) * 0.1) * 0.03 : 1;

  // Stats counter animation
  const revenue = Math.floor(
    interpolate(frame, [60, 120], [0, 35600], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  const appointments = Math.floor(
    interpolate(frame, [60, 120], [0, 89], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    })
  );

  return (
    <div className="w-full h-full bg-sterile-white flex flex-col items-center justify-center relative px-16">
      {/* Success Notification (Patient Booked) */}
      <div
        style={{
          transform: `translateY(${notificationY}px)`,
          opacity: notificationOpacity,
        }}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl"
      >
        <div className="bg-white border-2 border-green-500 rounded-2xl shadow-2xl p-6">
          <div className="flex items-start gap-4">
            {/* Success Icon */}
            <div className="w-14 h-14 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Notification Content */}
            <div className="flex-1">
              <div className="text-xl font-bold text-green-800 mb-2">
                New Patient Booked!
              </div>
              <div className="space-y-1 text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Patient:</span>
                  <span>Sarah Johnson</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Service:</span>
                  <span>Botox Treatment</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Time:</span>
                  <span>Tomorrow, 2:00 PM</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Value:</span>
                  <span className="text-surgical-blue font-bold">$400</span>
                </div>
              </div>
            </div>

            {/* Calendar Icon */}
            <div className="text-surgical-blue">
              <svg
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main Message */}
      <div
        style={{
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
        }}
        className="text-center mb-12"
      >
        <h2 className="text-6xl font-bold text-deep-obsidian mb-6">
          Never miss a patient again.
        </h2>
        <p className="text-3xl text-gray-700 max-w-3xl mx-auto">
          Voxanne AI handles calls 24/7, answers questions, and books appointments
          automatically.
        </p>
      </div>

      {/* Stats Display */}
      <div
        style={{ opacity: textOpacity }}
        className="grid grid-cols-2 gap-8 mb-12"
      >
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl font-bold text-surgical-blue mb-2">
            ${revenue.toLocaleString()}
          </div>
          <div className="text-xl text-gray-600">Revenue This Month</div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="text-5xl font-bold text-surgical-blue mb-2">
            {appointments}
          </div>
          <div className="text-xl text-gray-600">Appointments Booked</div>
        </div>
      </div>

      {/* Call-to-Action */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `scale(${ctaScale * pulseScale})`,
        }}
        className="text-center"
      >
        <button className="bg-surgical-blue text-white px-12 py-6 rounded-2xl text-3xl font-bold shadow-2xl hover:bg-blue-700 transition-all mb-4">
          Get Started Today
        </button>
        <div className="text-2xl text-gray-600 font-semibold">
          voxanne.ai
        </div>
      </div>

      {/* Subtle Bottom Text */}
      <div
        style={{ opacity: ctaOpacity }}
        className="absolute bottom-8 text-sm text-gray-500"
      >
        Trusted by medical practices nationwide
      </div>
    </div>
  );
};
