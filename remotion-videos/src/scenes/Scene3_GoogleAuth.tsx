import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';

export const Scene3_GoogleAuth: React.FC = () => {
  const frame = useCurrentFrame();

  // Dashboard background
  const dashboardOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor movement to "Connect Calendar" button
  const cursorX = interpolate(frame, [30, 60], [100, 960], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const cursorY = interpolate(frame, [30, 60], [100, 600], {
    easing: Easing.inOut(Easing.ease),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Button click animation
  const buttonClicked = frame >= 70;
  const buttonScale = buttonClicked
    ? interpolate(frame, [70, 75], [1, 0.95], { extrapolateRight: 'clamp' })
    : 1;

  // Google OAuth popup appears
  const popupVisible = frame >= 80;
  const popupOpacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const popupScale = interpolate(frame, [80, 100], [0.8, 1], {
    easing: Easing.out(Easing.back(1.5)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cursor moves to "Allow" button
  const cursorToAllow = frame >= 110;
  const allowCursorX = cursorToAllow
    ? interpolate(frame, [110, 140], [960, 960], { extrapolateRight: 'clamp' })
    : cursorX;

  const allowCursorY = cursorToAllow
    ? interpolate(frame, [110, 140], [600, 720], {
        easing: Easing.inOut(Easing.ease),
        extrapolateRight: 'clamp',
      })
    : cursorY;

  // "Allow" button clicked
  const allowClicked = frame >= 150;
  const allowButtonScale = allowClicked
    ? interpolate(frame, [150, 155], [1, 0.95], { extrapolateRight: 'clamp' })
    : 1;

  // Popup fades out
  const popupFadeOut = frame >= 160;
  const popupExitOpacity = popupFadeOut
    ? interpolate(frame, [160, 180], [1, 0], { extrapolateRight: 'clamp' })
    : popupOpacity;

  // Success checkmark appears
  const successVisible = frame >= 190;
  const successOpacity = interpolate(frame, [190, 210], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const successScale = interpolate(frame, [190, 210], [0.5, 1], {
    easing: Easing.out(Easing.back(1.8)),
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div className="w-full h-full bg-sterile-white relative">
      {/* Dashboard Background */}
      <div
        style={{ opacity: dashboardOpacity }}
        className="absolute inset-0 flex items-center justify-center p-16"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-4xl">
          <h2 className="text-3xl font-bold text-deep-obsidian mb-8">
            Calendar Integration
          </h2>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <p className="text-gray-600 mb-4">
              Connect your Google Calendar to enable automatic appointment booking.
            </p>

            {/* Connect Calendar Button */}
            <button
              style={{ transform: `scale(${buttonScale})` }}
              className="bg-surgical-blue text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all shadow-lg"
            >
              🗓️ Connect Calendar
            </button>
          </div>

          {/* Success State */}
          {successVisible && (
            <div
              style={{
                opacity: successOpacity,
                transform: `scale(${successScale})`,
              }}
              className="bg-green-50 border-2 border-green-500 rounded-xl p-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <div className="text-green-800 font-semibold text-xl">
                  Calendar Connected!
                </div>
                <div className="text-green-600 text-sm">
                  Real-time sync active
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Google OAuth Popup */}
      {popupVisible && (
        <div
          style={{
            opacity: popupExitOpacity,
          }}
          className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center"
        >
          <div
            style={{
              transform: `scale(${popupScale})`,
              opacity: popupExitOpacity,
            }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
          >
            {/* Google Logo */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-gray-200">
                <svg width="24" height="24" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              </div>
              <h3 className="text-2xl font-semibold text-deep-obsidian">
                Sign in with Google
              </h3>
            </div>

            {/* Permission Request */}
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <p className="text-sm text-gray-700 mb-4">
                <strong>Voxanne AI</strong> wants to access your Google Calendar
              </p>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-surgical-blue mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      View and manage your calendar
                    </div>
                    <div className="text-xs text-gray-500">
                      Required to check availability and book appointments
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-surgical-blue mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      Create and edit events
                    </div>
                    <div className="text-xs text-gray-500">
                      Automatically book patient appointments
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all">
                Cancel
              </button>
              <button
                style={{ transform: `scale(${allowButtonScale})` }}
                className="flex-1 px-6 py-3 bg-surgical-blue text-white rounded-lg font-semibold hover:bg-blue-700 transition-all shadow-lg"
              >
                Allow
              </button>
            </div>

            {/* Privacy Notice */}
            <p className="text-xs text-gray-500 mt-4 text-center">
              By clicking "Allow", you allow this app to use your information in
              accordance with their terms of service and privacy policy.
            </p>
          </div>
        </div>
      )}

      {/* Animated Cursor */}
      <div
        style={{
          position: 'absolute',
          left: `${allowCursorX}px`,
          top: `${allowCursorY}px`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
        className="w-8 h-8"
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          className="drop-shadow-lg"
        >
          <path
            d="M8 4L24 16L14 18L10 28L8 4Z"
            fill="white"
            stroke="black"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Explanation Text (bottom) */}
      <div
        style={{ opacity: successOpacity }}
        className="absolute bottom-16 left-0 right-0 text-center"
      >
        <p className="text-2xl text-gray-700">
          ✅ <strong>Why we need Calendar access:</strong> To automatically check
          availability and book patient appointments in real-time during calls.
        </p>
      </div>
    </div>
  );
};
