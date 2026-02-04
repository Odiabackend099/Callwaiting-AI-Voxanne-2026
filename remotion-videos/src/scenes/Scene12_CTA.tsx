import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const Scene12_CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === SECTION 1: Before/After Comparison (frames 0-120) ===
  const beforeAfterOpacity = interpolate(frame, [5, 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const beforeSlide = spring({
    frame: Math.max(0, frame - 5),
    fps,
    config: { damping: 25, stiffness: 100 },
  });
  const afterSlide = spring({
    frame: Math.max(0, frame - 20),
    fps,
    config: { damping: 25, stiffness: 100 },
  });

  // Before metrics animate
  const missedCalls = Math.floor(spring({
    frame: Math.max(0, frame - 15),
    fps, from: 0, to: 47,
    config: { damping: 50, stiffness: 60 },
  }));

  // After metrics animate
  const aiHandled = Math.floor(spring({
    frame: Math.max(0, frame - 35),
    fps, from: 0, to: 93,
    config: { damping: 50, stiffness: 60 },
  }));
  const revenue = Math.floor(spring({
    frame: Math.max(0, frame - 45),
    fps, from: 0, to: 18800,
    config: { damping: 50, stiffness: 60 },
  }));

  // === SECTION 2: Key Metrics (frames 120-240) ===
  const metricsShow = frame >= 120;
  const metric1 = spring({ frame: Math.max(0, frame - 130), fps, config: { damping: 20 } });
  const metric2 = spring({ frame: Math.max(0, frame - 150), fps, config: { damping: 20 } });
  const metric3 = spring({ frame: Math.max(0, frame - 170), fps, config: { damping: 20 } });

  // === SECTION 3: Waveform Placeholder (frames 240-360) ===
  const waveformOpacity = interpolate(frame, [240, 260], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // === SECTION 4: Logo + CTA (frames 360-480) ===
  const logoScale = spring({
    frame: Math.max(0, frame - 360),
    fps, from: 0.5, to: 1,
    config: { damping: 15, stiffness: 80 },
  });
  const logoOpacity = interpolate(frame, [360, 380], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [400, 420], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });
  const ctaGlow = Math.sin(frame * 0.08) * 0.3 + 0.7;

  const sectionFade = (start: number, end: number) => {
    if (frame < start) return 0;
    if (frame > end) return interpolate(frame, [end, end + 20], [1, 0], {
      extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
    });
    return 1;
  };

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: '#020412',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', position: 'relative',
    }}>
      {/* === SECTION 1: Before / After === */}
      {frame < 140 && (
        <div style={{
          display: 'flex', gap: '60px', alignItems: 'flex-start',
          opacity: beforeAfterOpacity * sectionFade(0, 120),
        }}>
          {/* Before */}
          <div style={{
            opacity: beforeSlide, transform: `translateX(${(1 - beforeSlide) * -60}px)`,
            textAlign: 'center', width: '380px',
          }}>
            <div style={{ color: '#ef4444', fontSize: '20px', fontWeight: 700, marginBottom: '20px',
              fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              Before Voxanne
            </div>
            <div style={{ color: '#ffffff', fontSize: '72px', fontWeight: 800,
              fontFamily: 'system-ui, sans-serif' }}>
              {missedCalls}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px',
              fontFamily: 'system-ui, sans-serif' }}>
              missed calls per week
            </div>
            <div style={{ marginTop: '16px', color: 'rgba(255,255,255,0.3)', fontSize: '16px',
              fontFamily: 'system-ui, sans-serif' }}>
              Manual scheduling &bull; No follow-ups
            </div>
          </div>

          {/* Divider */}
          <div style={{
            width: '2px', height: '200px', backgroundColor: 'rgba(255,255,255,0.15)',
            marginTop: '20px',
          }} />

          {/* After */}
          <div style={{
            opacity: afterSlide, transform: `translateX(${(1 - afterSlide) * 60}px)`,
            textAlign: 'center', width: '380px',
          }}>
            <div style={{ color: '#22c55e', fontSize: '20px', fontWeight: 700, marginBottom: '20px',
              fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
              After Voxanne
            </div>
            <div style={{ color: '#ffffff', fontSize: '72px', fontWeight: 800,
              fontFamily: 'system-ui, sans-serif' }}>
              {aiHandled}%
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px',
              fontFamily: 'system-ui, sans-serif' }}>
              calls handled by AI
            </div>
            <div style={{ marginTop: '16px', color: '#22c55e', fontSize: '22px', fontWeight: 600,
              fontFamily: 'system-ui, sans-serif' }}>
              +${revenue.toLocaleString()} recovered
            </div>
          </div>
        </div>
      )}

      {/* === SECTION 2: Key Metrics === */}
      {metricsShow && frame < 260 && (
        <div style={{
          display: 'flex', gap: '80px', opacity: sectionFade(120, 240),
        }}>
          {[
            { value: '24/7', label: 'Availability', o: metric1 },
            { value: '0.3s', label: 'Response Time', o: metric2 },
            { value: '10 min', label: 'Setup Time', o: metric3 },
          ].map((m, i) => (
            <div key={i} style={{
              textAlign: 'center', opacity: m.o,
              transform: `translateY(${(1 - m.o) * 30}px)`,
            }}>
              <div style={{ color: '#1D4ED8', fontSize: '56px', fontWeight: 800,
                fontFamily: 'system-ui, sans-serif' }}>
                {m.value}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '20px', marginTop: '8px',
                fontFamily: 'system-ui, sans-serif' }}>
                {m.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* === SECTION 3: Audio Placeholder with Waveform === */}
      {frame >= 240 && frame < 380 && (
        <div style={{
          textAlign: 'center', opacity: waveformOpacity * sectionFade(240, 360),
        }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '18px', marginBottom: '24px',
            fontFamily: 'system-ui, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Hear a real patient call
          </div>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: 40 }).map((_, i) => {
              const barHeight = 20 + Math.sin((frame - 240) * 0.12 + i * 0.5) * 25;
              return (
                <div key={i} style={{
                  width: '6px', height: `${barHeight}px`, backgroundColor: '#1D4ED8',
                  borderRadius: '3px', opacity: 0.6 + Math.sin(i * 0.3) * 0.4,
                }} />
              );
            })}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '16px',
            fontFamily: 'system-ui, sans-serif' }}>
            [Add your real phone call recording here]
          </div>
        </div>
      )}

      {/* === SECTION 4: Logo + CTA === */}
      {frame >= 360 && (
        <div style={{ textAlign: 'center' }}>
          {/* Logo / Brand */}
          <div style={{
            opacity: logoOpacity, transform: `scale(${logoScale})`,
            marginBottom: '24px',
          }}>
            <div style={{ color: '#ffffff', fontSize: '64px', fontWeight: 800,
              fontFamily: 'system-ui, sans-serif', letterSpacing: '-0.03em' }}>
              Voxanne
              <span style={{ color: '#1D4ED8' }}> AI</span>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '24px', marginTop: '8px',
              fontFamily: 'system-ui, sans-serif' }}>
              Never Miss a Patient Again
            </div>
          </div>

          {/* CTA Button */}
          <div style={{
            opacity: ctaOpacity, marginTop: '32px',
          }}>
            <div style={{
              display: 'inline-block', padding: '18px 48px',
              backgroundColor: '#1D4ED8', borderRadius: '12px',
              boxShadow: `0 0 ${30 * ctaGlow}px rgba(29, 78, 216, ${ctaGlow * 0.5})`,
            }}>
              <div style={{ color: '#ffffff', fontSize: '28px', fontWeight: 700,
                fontFamily: 'system-ui, sans-serif' }}>
                Start Your Free Trial
              </div>
            </div>
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '20px', marginTop: '16px',
              fontFamily: 'system-ui, sans-serif' }}>
              voxanne.ai &bull; Setup in 10 minutes &bull; No coding required
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
