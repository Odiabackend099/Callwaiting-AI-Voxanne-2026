import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile, Easing } from 'remotion';

export const Scene0B_SignIn: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic fade-in from previous scene
  const sceneOpacity = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 30, stiffness: 80 },
  });

  // Browser container entrance with slide + scale
  const browserY = interpolate(
    frame,
    [0, 40],
    [30, 0],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
  );

  const browserScale = interpolate(
    frame,
    [0, 40],
    [0.95, 1],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
  );

  // Title text animation
  const titleOpacity = interpolate(
    frame,
    [0, 30, 70, 90],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const titleY = interpolate(
    frame,
    [0, 30],
    [40, 0],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
  );

  // Email field animation (frames 40-100)
  const emailFieldVisible = frame >= 40 && frame <= 100;
  const emailTypingProgress = interpolate(
    frame,
    [40, 90],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const emailText = 'voxanne@demo.com';
  const emailCharsToShow = Math.floor(emailTypingProgress * emailText.length);
  const displayEmail = emailText.slice(0, emailCharsToShow);

  // Email field focus glow
  const emailFocusOpacity = interpolate(
    frame,
    [40, 50],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Cursor blinking in email field
  const emailCursorVisible = emailFieldVisible && emailCharsToShow < emailText.length && Math.sin(frame * 0.5) > 0;

  // Transition from email to password field
  const showPasswordTransition = frame >= 100 && frame < 120;

  // Password field animation (frames 120-180)
  const passwordFieldVisible = frame >= 120 && frame <= 200;
  const passwordTypingProgress = interpolate(
    frame,
    [120, 170],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const passwordText = 'demo123';
  const passwordCharsToShow = Math.floor(passwordTypingProgress * passwordText.length);
  const displayPassword = '•'.repeat(passwordCharsToShow); // Masked password

  // Password field focus glow
  const passwordFocusOpacity = interpolate(
    frame,
    [120, 130],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Cursor blinking in password field
  const passwordCursorVisible = passwordFieldVisible && passwordCharsToShow < passwordText.length && Math.sin(frame * 0.5) > 0;

  // Sign In button animation (frames 180-220)
  const buttonClickProgress = interpolate(
    frame,
    [180, 200, 220],
    [0, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const buttonScale = interpolate(
    buttonClickProgress,
    [0, 0.5, 1],
    [1, 0.95, 1]
  );

  const buttonGlowOpacity = interpolate(
    frame,
    [180, 190],
    [0, 0.6],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Loading spinner animation (frames 220-260)
  const loadingVisible = frame >= 220 && frame < 260;
  const loadingOpacity = interpolate(
    frame,
    [220, 235],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const spinnerRotation = frame >= 220 && frame < 260 ? (frame - 220) * 15 : 0;

  // Transition to dashboard (frames 260-295)
  const signInPageOpacity = interpolate(
    frame,
    [260, 280],
    [1, 0],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const dashboardOpacity = interpolate(
    frame,
    [260, 280],
    [0, 1],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const dashboardScale = interpolate(
    frame,
    [260, 280],
    [1.05, 1],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Success message (frames 280-300)
  const successOpacity = interpolate(
    frame,
    [280, 295],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const successScale = spring({
    frame: Math.max(0, frame - 280),
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 15, stiffness: 150 },
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0f1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: sceneOpacity,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Animated gradient background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(circle at 30% 30%, rgba(29, 78, 216, 0.12) 0%, transparent 50%),
            radial-gradient(circle at 70% 70%, rgba(59, 130, 246, 0.08) 0%, transparent 50%),
            linear-gradient(180deg, #0a0f1e 0%, #1e293b 100%)
          `,
        }}
      />

      {/* Title Text Overlay */}
      {titleOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            left: '80px',
            zIndex: 100,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-18px -28px',
              background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.22) 0%, rgba(59, 130, 246, 0.12) 100%)',
              borderRadius: '14px',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
            }}
          />
          <div style={{ position: 'relative' }}>
            <div
              style={{
                color: '#ffffff',
                fontSize: '48px',
                fontWeight: 800,
                lineHeight: 1.2,
                letterSpacing: '-0.03em',
                textShadow: '0 3px 14px rgba(0, 0, 0, 0.5)',
                marginBottom: '8px',
              }}
            >
              Sign in to your dashboard
            </div>
            <div
              style={{
                color: 'rgba(255, 255, 255, 0.75)',
                fontSize: '22px',
                fontWeight: 500,
                lineHeight: 1.4,
                letterSpacing: '-0.01em',
              }}
            >
              Demo credentials: voxanne@demo.com
            </div>
          </div>
        </div>
      )}

      {/* Browser chrome container */}
      <div
        style={{
          position: 'relative',
          width: '88%',
          height: '88%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: `
            0 24px 68px rgba(0, 0, 0, 0.42),
            0 10px 28px rgba(0, 0, 0, 0.32),
            0 0 0 1px rgba(255, 255, 255, 0.08)
          `,
          overflow: 'hidden',
          transform: `translateY(${browserY}px) scale(${browserScale})`,
        }}
      >
        {/* macOS-style browser chrome bar */}
        <div
          style={{
            height: '48px',
            background: 'linear-gradient(180deg, #f8f9fa 0%, #f1f3f4 100%)',
            borderBottom: '1px solid #e0e3e7',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '20px',
            gap: '10px',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6159 0%, #ff5147 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.16)',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffbd2e 0%, #ffab1e 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.16)',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #28cd41 0%, #24b83a 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.16)',
            }}
          />
          <div
            style={{
              marginLeft: 16,
              fontSize: 14,
              color: '#5f6368',
              fontFamily: 'system-ui, sans-serif',
              fontWeight: 500,
            }}
          >
            voxanne.ai/login
          </div>
        </div>

        {/* Sign in page screenshot (fades out) */}
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            width: '100%',
            height: 'calc(100% - 48px)',
            opacity: signInPageOpacity,
            overflow: 'hidden',
          }}
        >
          <Img
            src={staticFile('screenshots/00_signin_page.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        </div>

        {/* Dashboard screenshot (fades in) */}
        <div
          style={{
            position: 'absolute',
            top: '48px',
            left: 0,
            width: '100%',
            height: 'calc(100% - 48px)',
            opacity: dashboardOpacity,
            overflow: 'hidden',
            transform: `scale(${dashboardScale})`,
            transformOrigin: 'center center',
          }}
        >
          <Img
            src={staticFile('screenshots/00_dashboard_after_login.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center top',
            }}
          />
        </div>

        {/* Email field overlay with cinematic glow */}
        {emailFieldVisible && (
          <>
            {/* Focus glow ring */}
            <div
              style={{
                position: 'absolute',
                left: 326,
                top: 322,
                width: 420,
                height: 60,
                borderRadius: '10px',
                background: `radial-gradient(circle at center, rgba(29, 78, 216, ${emailFocusOpacity * 0.15}) 0%, transparent 70%)`,
                filter: 'blur(12px)',
                zIndex: 199,
              }}
            />

            {/* Field background */}
            <div
              style={{
                position: 'absolute',
                left: 336,
                top: 332,
                width: 400,
                height: 40,
                backgroundColor: '#ffffff',
                border: `2px solid rgba(29, 78, 216, ${emailFocusOpacity})`,
                borderRadius: '8px',
                boxShadow: `0 0 0 4px rgba(29, 78, 216, ${emailFocusOpacity * 0.12})`,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '14px',
                paddingRight: '14px',
              }}
            >
              {/* Typed text */}
              <span
                style={{
                  color: '#020412',
                  fontSize: '16px',
                  fontFamily: 'system-ui, -apple-system, Inter, monospace',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}
              >
                {displayEmail}
              </span>

              {/* Blinking cursor */}
              {emailCursorVisible && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '20px',
                    backgroundColor: '#1D4ED8',
                    marginLeft: '2px',
                  }}
                />
              )}
            </div>

            {/* Field label */}
            <div
              style={{
                position: 'absolute',
                left: 336,
                top: 310,
                color: '#020412',
                fontSize: '13px',
                fontWeight: 600,
                opacity: emailFocusOpacity * 0.8,
                zIndex: 200,
              }}
            >
              Email address
            </div>
          </>
        )}

        {/* Password field overlay with cinematic glow */}
        {passwordFieldVisible && (
          <>
            {/* Focus glow ring */}
            <div
              style={{
                position: 'absolute',
                left: 326,
                top: 371,
                width: 420,
                height: 60,
                borderRadius: '10px',
                background: `radial-gradient(circle at center, rgba(29, 78, 216, ${passwordFocusOpacity * 0.15}) 0%, transparent 70%)`,
                filter: 'blur(12px)',
                zIndex: 199,
              }}
            />

            {/* Field background */}
            <div
              style={{
                position: 'absolute',
                left: 336,
                top: 381,
                width: 400,
                height: 40,
                backgroundColor: '#ffffff',
                border: `2px solid rgba(29, 78, 216, ${passwordFocusOpacity})`,
                borderRadius: '8px',
                boxShadow: `0 0 0 4px rgba(29, 78, 216, ${passwordFocusOpacity * 0.12})`,
                zIndex: 200,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '14px',
                paddingRight: '14px',
              }}
            >
              {/* Masked password dots */}
              <span
                style={{
                  color: '#020412',
                  fontSize: '18px',
                  fontFamily: 'system-ui, -apple-system, Inter, monospace',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  letterSpacing: '4px',
                }}
              >
                {displayPassword}
              </span>

              {/* Blinking cursor */}
              {passwordCursorVisible && (
                <span
                  style={{
                    display: 'inline-block',
                    width: '2px',
                    height: '20px',
                    backgroundColor: '#1D4ED8',
                    marginLeft: '6px',
                  }}
                />
              )}
            </div>

            {/* Field label */}
            <div
              style={{
                position: 'absolute',
                left: 336,
                top: 359,
                color: '#020412',
                fontSize: '13px',
                fontWeight: 600,
                opacity: passwordFocusOpacity * 0.8,
                zIndex: 200,
              }}
            >
              Password
            </div>
          </>
        )}

        {/* Sign In button click effect */}
        {buttonClickProgress > 0 && (
          <>
            {/* Button glow */}
            <div
              style={{
                position: 'absolute',
                left: 316,
                top: 408,
                width: 440,
                height: 80,
                borderRadius: '12px',
                background: `radial-gradient(circle at center, rgba(29, 78, 216, ${buttonGlowOpacity}) 0%, transparent 70%)`,
                filter: 'blur(16px)',
                zIndex: 199,
              }}
            />

            {/* Button highlight overlay */}
            <div
              style={{
                position: 'absolute',
                left: 336,
                top: 428,
                width: 400,
                height: 40,
                backgroundColor: 'rgba(29, 78, 216, 0.12)',
                border: '2px solid rgba(29, 78, 216, 0.6)',
                borderRadius: '8px',
                boxShadow: `0 0 0 3px rgba(29, 78, 216, ${buttonGlowOpacity * 0.3})`,
                zIndex: 200,
                transform: `scale(${buttonScale})`,
                transformOrigin: 'center',
              }}
            />
          </>
        )}

        {/* Loading spinner overlay */}
        {loadingVisible && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: loadingOpacity,
              zIndex: 300,
            }}
          >
            {/* Spinner background */}
            <div
              style={{
                position: 'absolute',
                inset: '-30px',
                background: 'radial-gradient(circle, rgba(240, 249, 255, 0.95) 0%, rgba(240, 249, 255, 0.7) 100%)',
                borderRadius: '50%',
                filter: 'blur(20px)',
              }}
            />

            {/* Spinner */}
            <div
              style={{
                position: 'relative',
                width: '70px',
                height: '70px',
                border: '5px solid #e0e7ff',
                borderTop: '5px solid #1D4ED8',
                borderRadius: '50%',
                transform: `rotate(${spinnerRotation}deg)`,
                boxShadow: '0 4px 20px rgba(29, 78, 216, 0.3)',
              }}
            />

            {/* Loading text */}
            <div
              style={{
                position: 'absolute',
                top: '90px',
                left: '50%',
                transform: 'translateX(-50%)',
                color: '#020412',
                fontSize: '18px',
                fontWeight: 700,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
              }}
            >
              Signing in...
            </div>
          </div>
        )}
      </div>

      {/* Success message after login */}
      {successOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${successScale})`,
            opacity: successOpacity,
            zIndex: 400,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-24px -40px',
              background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.98) 0%, rgba(59, 130, 246, 0.95) 100%)',
              borderRadius: '18px',
              backdropFilter: 'blur(16px)',
              border: '2px solid rgba(255, 255, 255, 0.25)',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.4)',
            }}
          />
          <div
            style={{
              position: 'relative',
              color: '#ffffff',
              fontSize: '42px',
              fontWeight: 800,
              textAlign: 'center',
              textShadow: '0 3px 16px rgba(0, 0, 0, 0.35)',
              letterSpacing: '-0.02em',
            }}
          >
            Welcome to Voxanne AI Dashboard
          </div>
        </div>
      )}

      {/* Cinematic vignette */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 35%, rgba(0, 0, 0, 0.35) 100%)',
          pointerEvents: 'none',
          opacity: sceneOpacity * 0.65,
        }}
      />
    </div>
  );
};
