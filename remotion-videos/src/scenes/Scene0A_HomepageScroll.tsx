import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Img, staticFile, Easing, spring } from 'remotion';

export const Scene0A_HomepageScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic fade-in with slow zoom
  const fadeIn = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    config: { damping: 30, stiffness: 80 },
  });

  const initialZoom = interpolate(
    frame,
    [0, 60],
    [1.05, 1],
    {
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      extrapolateRight: 'clamp',
    }
  );

  // Parallax scroll simulation with depth
  // Phase 1: Show top (0-100) with slow Ken Burns zoom
  // Phase 2: Smooth scroll down (100-140) with parallax effect
  // Phase 3: Hold scrolled position (140-200) with subtle movement
  // Phase 4: Scroll back up (200-240) with reverse parallax
  // Phase 5: Hold top position (240-280) with cursor choreography

  // Screenshot vertical position with easing
  let scrollOffset = 0;
  let scrollScale = 1;

  if (frame < 100) {
    // Phase 1: Initial view with slow zoom in
    scrollOffset = 0;
    scrollScale = interpolate(
      frame,
      [0, 100],
      [1.02, 1],
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );
  } else if (frame >= 100 && frame < 140) {
    // Phase 2: Smooth scroll down with anticipation and follow-through
    scrollOffset = interpolate(
      frame,
      [100, 110, 140],
      [0, -50, -800], // Anticipation: small movement first, then full scroll
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );
    scrollScale = interpolate(
      frame,
      [100, 140],
      [1, 0.98],
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );
  } else if (frame >= 140 && frame < 200) {
    // Phase 3: Hold scrolled position with subtle breathing animation
    scrollOffset = -800 + Math.sin((frame - 140) * 0.05) * 5;
    scrollScale = 0.98;
  } else if (frame >= 200 && frame < 240) {
    // Phase 4: Scroll back up with smooth deceleration
    scrollOffset = interpolate(
      frame,
      [200, 230, 240],
      [-800, -50, 0], // Reverse with slow finish
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );
    scrollScale = interpolate(
      frame,
      [200, 240],
      [0.98, 1],
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );
  } else {
    // Phase 5: Top position for cursor interaction
    scrollOffset = 0;
    scrollScale = 1;
  }

  // Text overlays with cinematic timing
  const titleOpacity = interpolate(
    frame,
    [0, 30, 90, 110],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const titleY = interpolate(
    frame,
    [0, 30],
    [50, 0],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
  );

  const scrollTextOpacity = interpolate(
    frame,
    [120, 140, 190, 210],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const scrollTextY = interpolate(
    frame,
    [120, 140],
    [30, 0],
    { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
  );

  // Cursor animation with professional choreography
  const cursorVisible = frame >= 250;
  let cursorX = 1600;
  let cursorY = 300;
  let cursorScale = 1;
  let rippleOpacity = 0;
  let rippleScale = 0;

  if (cursorVisible) {
    const cursorFrame = frame - 250;

    // Smooth cursor movement with easing
    const progress = interpolate(
      cursorFrame,
      [0, 30],
      [0, 1],
      { easing: Easing.bezier(0.16, 1, 0.3, 1), extrapolateRight: 'clamp' }
    );

    cursorX = 1600 + (1760 - 1600) * progress;
    cursorY = 300 + (140 - 300) * progress;

    // Click animation at end
    if (cursorFrame >= 30 && cursorFrame < 40) {
      const clickProgress = (cursorFrame - 30) / 10;
      cursorScale = interpolate(clickProgress, [0, 0.5, 1], [1, 0.9, 1]);

      // Ripple effect
      rippleOpacity = interpolate(clickProgress, [0, 0.3, 1], [0, 0.6, 0]);
      rippleScale = interpolate(clickProgress, [0, 1], [0.5, 2.5]);
    }
  }

  // Button highlight glow on hover
  const buttonGlowOpacity = interpolate(
    frame,
    [270, 280],
    [0, 0.4],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0f1e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
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
            radial-gradient(circle at 50% 50%, rgba(29, 78, 216, 0.15) 0%, transparent 50%),
            linear-gradient(180deg, #0a0f1e 0%, #1e293b 100%)
          `,
          opacity: fadeIn,
        }}
      />

      {/* Text Overlay - Title */}
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
            inset: '-20px -30px',
            background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)',
            borderRadius: '16px',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          }}
        />
        <div style={{ position: 'relative' }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: '56px',
              fontWeight: 800,
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              textShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
              marginBottom: '12px',
            }}
          >
            Welcome to Voxanne AI
          </div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '28px',
              fontWeight: 500,
              lineHeight: 1.4,
              letterSpacing: '-0.01em',
            }}
          >
            Your 24/7 AI receptionist
          </div>
        </div>
      </div>

      {/* Browser chrome container with depth */}
      <div
        style={{
          position: 'relative',
          width: '88%',
          height: '88%',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: `
            0 20px 60px rgba(0, 0, 0, 0.4),
            0 8px 24px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.1)
          `,
          overflow: 'hidden',
          transform: `scale(${initialZoom})`,
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
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff6159 0%, #ff5147 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ffbd2e 0%, #ffab1e 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
            }}
          />
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #28cd41 0%, #24b83a 100%)',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
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
            voxanne.ai
          </div>
        </div>

        {/* Website content with parallax scroll effect */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 48px)',
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: '#F0F9FF',
          }}
        >
          {/* Composite view with transform for smooth scrolling */}
          <div
            style={{
              position: 'absolute',
              top: scrollOffset,
              left: 0,
              width: '100%',
              height: '200%',
              display: 'flex',
              flexDirection: 'column',
              transform: `scale(${scrollScale})`,
              transformOrigin: 'center top',
              transition: 'none', // No CSS transitions, Remotion controls all
            }}
          >
            {/* Top homepage screenshot */}
            <div
              style={{
                width: '100%',
                height: '50%',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Img
                src={staticFile('screenshots/00_homepage_top.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                }}
              />
              {/* Sign In button glow overlay */}
              {buttonGlowOpacity > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '92px',
                    right: '160px',
                    width: '100px',
                    height: '44px',
                    background: 'radial-gradient(circle, rgba(29, 78, 216, 0.4) 0%, transparent 70%)',
                    opacity: buttonGlowOpacity,
                    borderRadius: '8px',
                    filter: 'blur(8px)',
                  }}
                />
              )}
            </div>

            {/* Scrolled homepage screenshot */}
            <div
              style={{
                width: '100%',
                height: '50%',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <Img
                src={staticFile('screenshots/00_homepage_scrolled.png')}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                }}
              />
            </div>
          </div>

          {/* Scroll indicator gradient overlay */}
          {frame >= 100 && frame < 200 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '80px',
                background: 'linear-gradient(to top, rgba(240, 249, 255, 0.9) 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          )}
        </div>
      </div>

      {/* Scroll text overlay */}
      {scrollTextOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: '120px',
            left: '50%',
            transform: `translate(-50%, ${scrollTextY}px)`,
            zIndex: 100,
            opacity: scrollTextOpacity,
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '-16px -28px',
              background: 'linear-gradient(135deg, rgba(29, 78, 216, 0.95) 0%, rgba(59, 130, 246, 0.90) 100%)',
              borderRadius: '12px',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          />
          <div
            style={{
              position: 'relative',
              color: '#ffffff',
              fontSize: '32px',
              fontWeight: 700,
              textAlign: 'center',
              textShadow: '0 2px 12px rgba(0, 0, 0, 0.3)',
              whiteSpace: 'nowrap',
            }}
          >
            See what Voxanne can do for your business
          </div>
        </div>
      )}

      {/* Professional cursor with ripple effect */}
      {cursorVisible && (
        <>
          {/* Click ripple */}
          {rippleOpacity > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 1760 - 30,
                top: 140 - 30,
                width: 60,
                height: 60,
                borderRadius: '50%',
                border: '3px solid #1D4ED8',
                opacity: rippleOpacity,
                transform: `scale(${rippleScale})`,
                pointerEvents: 'none',
                zIndex: 9998,
                boxShadow: '0 0 20px rgba(29, 78, 216, 0.5)',
              }}
            />
          )}

          {/* Cursor */}
          <div
            style={{
              position: 'absolute',
              left: cursorX,
              top: cursorY,
              width: 32,
              height: 32,
              pointerEvents: 'none',
              zIndex: 9999,
              transform: `scale(${cursorScale})`,
              transformOrigin: 'top left',
              filter: 'drop-shadow(0 2px 6px rgba(0, 0, 0, 0.4))',
            }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path
                d="M4 4L4 28L12.67 18.67L20.67 28L24 24.67L16 16.67L25.33 7.33L4 4Z"
                fill="#020412"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </svg>
          </div>
        </>
      )}

      {/* Vignette overlay for cinematic effect */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.3) 100%)',
          pointerEvents: 'none',
          opacity: fadeIn * 0.6,
        }}
      />
    </div>
  );
};
