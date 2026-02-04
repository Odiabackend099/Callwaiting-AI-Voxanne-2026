import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { StepIndicator } from '../components/StepIndicator';
import { ClickSimulation } from '../components/ClickSimulation';

export const Scene6_AIForwarding: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Slide transition: first screenshot slides left, second slides in from right
  const slideProgress = interpolate(frame, [80, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slide1X = interpolate(slideProgress, [0, 1], [0, -100]);
  const slide1Opacity = interpolate(slideProgress, [0, 0.5], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const slide2X = interpolate(slideProgress, [0, 1], [100, 0]);
  const slide2Opacity = interpolate(slideProgress, [0.3, 0.8], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Code pulse effect after transition
  const codePulse = frame > 140 ? 1 + Math.sin((frame - 140) * 0.12) * 0.03 : 1;
  const codeGlow = frame > 140 ? Math.sin((frame - 140) * 0.1) * 0.4 + 0.6 : 0;

  // Forwarding code text
  const codeOpacity = interpolate(frame, [140, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const codeScale = spring({
    frame: Math.max(0, frame - 140),
    fps,
    from: 0.9,
    to: 1,
    config: { damping: 15, stiffness: 100 },
  });

  const dialTextOpacity = interpolate(frame, [180, 200], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const browserChrome = (title: string) => (
    <div style={{
      height: '40px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0',
      display: 'flex', alignItems: 'center', paddingLeft: '16px', gap: '8px',
    }}>
      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
      <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
      <div style={{ marginLeft: 12, fontSize: 12, color: '#666', fontFamily: 'system-ui, sans-serif' }}>{title}</div>
    </div>
  );

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: '#F0F9FF',
      position: 'relative', overflow: 'hidden', opacity: fadeIn,
    }}>
      <TextOverlay text="Activate Call Forwarding" subtitle="One code forwards all calls to your AI" startFrame={0} duration={75} fontSize={44} />

      {/* Screenshot Container */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', width: '90%', height: '82%', marginTop: '20px',
      }}>
        {/* Screenshot 1: Wizard Step 1 */}
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#ffffff', borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.1)', overflow: 'hidden',
          transform: `translateX(${slide1X}%)`, opacity: slide1Opacity,
        }}>
          {browserChrome('AI Forwarding Setup')}
          <div style={{ width: '100%', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            <Img src={staticFile('screenshots/05_ai_forwarding_wizard_step1.png')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        </div>

        {/* Screenshot 2: Code Display */}
        <div style={{
          position: 'absolute', inset: 0, backgroundColor: '#ffffff', borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.1)', overflow: 'hidden',
          transform: `translateX(${slide2X}%)`, opacity: slide2Opacity,
        }}>
          {browserChrome('Forwarding Code')}
          <div style={{ width: '100%', height: 'calc(100% - 40px)', overflow: 'hidden', position: 'relative' }}>
            <Img src={staticFile('screenshots/06_ai_forwarding_code_display.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${codePulse})` }} />
          </div>
        </div>
      </div>

      {/* Click cursor */}
      {frame < 85 && (
        <ClickSimulation startFrame={35} fromX={960} fromY={400} toX={750} toY={520} moveDuration={20} />
      )}

      {/* Forwarding Code Overlay */}
      {frame >= 140 && (
        <div style={{
          position: 'absolute', bottom: '140px', left: '50%',
          transform: `translateX(-50%) scale(${codeScale})`, opacity: codeOpacity, zIndex: 200,
        }}>
          <div style={{
            backgroundColor: 'rgba(2, 4, 18, 0.9)', borderRadius: '16px', padding: '20px 40px',
            backdropFilter: 'blur(8px)',
            boxShadow: `0 0 ${30 * codeGlow}px rgba(29, 78, 216, ${codeGlow * 0.3})`,
            textAlign: 'center',
          }}>
            <div style={{
              color: '#1D4ED8', fontSize: '42px', fontWeight: 800,
              fontFamily: 'monospace', letterSpacing: '0.05em',
            }}>
              *72 +1 (555) 234-5678
            </div>
          </div>
        </div>
      )}

      {/* Dial instruction */}
      {frame >= 180 && (
        <div style={{
          position: 'absolute', bottom: '100px', left: '50%',
          transform: 'translateX(-50%)', opacity: dialTextOpacity, zIndex: 200,
        }}>
          <div style={{
            color: '#020412', fontSize: '22px', fontWeight: 500,
            fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
            backgroundColor: 'rgba(240, 249, 255, 0.9)', padding: '8px 20px', borderRadius: '8px',
          }}>
            Dial this code from your office phone. That's it.
          </div>
        </div>
      )}

      <StepIndicator currentStep={5} totalSteps={6} label="AI Forwarding" />
    </div>
  );
};
