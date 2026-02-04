import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';

export const Scene10_HotLeads: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns
  const scale = interpolate(frame, [0, 180], [1, 1.08], { extrapolateRight: 'clamp' });

  // Staggered lead cards sliding in from right
  const cardEase = (t: number) => 1 - Math.pow(1 - t, 3);

  const card1X = interpolate(frame, [25, 55], [300, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: cardEase,
  });
  const card1Opacity = interpolate(frame, [25, 40], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const card2X = interpolate(frame, [40, 70], [300, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: cardEase,
  });
  const card2Opacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const card3X = interpolate(frame, [55, 85], [300, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: cardEase,
  });
  const card3Opacity = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  // HOT badge pulse
  const hotPulse = frame > 60 ? 1 + Math.sin((frame - 60) * 0.2) * 0.08 : 1;

  // Score zoom
  const scoreScale = spring({
    frame: Math.max(0, frame - 80),
    fps,
    from: 0.8,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });
  const scoreOpacity = interpolate(frame, [80, 95], [0, 1], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  const leads = [
    { name: 'Sarah J.', service: 'Botox Inquiry', score: 85, hot: true, x: card1X, o: card1Opacity },
    { name: 'Michael C.', service: 'Filler Consultation', score: 78, hot: true, x: card2X, o: card2Opacity },
    { name: 'Emily R.', service: 'Chemical Peel', score: 72, hot: false, x: card3X, o: card3Opacity },
  ];

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: '#F0F9FF',
      position: 'relative', overflow: 'hidden', opacity: fadeIn,
    }}>
      {/* Text Overlay */}
      <TextOverlay
        text="AI Identifies Your Hottest Leads"
        subtitle="Leads scored 70+ need immediate follow-up"
        startFrame={0}
        duration={80}
        fontSize={44}
      />

      {/* Screenshot */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)', width: '90%', height: '82%',
        marginTop: '20px', overflow: 'hidden',
      }}>
        <div style={{
          width: '100%', height: '100%', backgroundColor: '#ffffff',
          borderRadius: '12px', boxShadow: '0 10px 40px rgba(2, 4, 18, 0.1)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '40px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0',
            display: 'flex', alignItems: 'center', paddingLeft: '16px', gap: '8px',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
            <div style={{ marginLeft: 12, fontSize: 12, color: '#666', fontFamily: 'system-ui, sans-serif' }}>Hot Leads Dashboard</div>
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            <Img
              src={staticFile('screenshots/12_leads_dashboard_hot.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, transformOrigin: 'center top' }}
            />
          </div>
        </div>
      </div>

      {/* Lead cards overlay - slide in from right */}
      {leads.map((lead, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            right: 100,
            top: 240 + i * 130,
            transform: `translateX(${lead.x}px)`,
            opacity: lead.o,
            width: '300px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '12px',
            border: `2px solid ${lead.hot ? '#1D4ED8' : '#f59e0b'}`,
            padding: '14px 18px',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.12)',
            backdropFilter: 'blur(4px)',
            zIndex: 130,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontWeight: 700, color: '#020412', fontSize: '16px', fontFamily: 'system-ui, sans-serif' }}>
              {lead.name}
            </div>
            <div style={{
              backgroundColor: lead.hot ? '#1D4ED8' : '#f59e0b',
              color: lead.hot ? '#ffffff' : '#020412',
              padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
              fontFamily: 'system-ui, sans-serif',
              transform: i === 0 ? `scale(${hotPulse})` : 'none',
            }}>
              {lead.hot ? 'HOT' : 'WARM'}
            </div>
          </div>
          <div style={{ color: '#666', fontSize: '14px', fontFamily: 'system-ui, sans-serif', marginBottom: '6px' }}>
            {lead.service}
          </div>
          <div style={{ color: '#1D4ED8', fontSize: '15px', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
            Score: {lead.score}/100
          </div>
        </div>
      ))}

      {/* Score highlight */}
      {frame >= 80 && (
        <div style={{
          position: 'absolute', right: 80, top: 195,
          opacity: scoreOpacity, transform: `scale(${scoreScale})`,
          zIndex: 140,
        }}>
          <div style={{
            backgroundColor: 'rgba(2, 4, 18, 0.85)', borderRadius: '10px',
            padding: '8px 16px', backdropFilter: 'blur(4px)',
          }}>
            <div style={{ color: '#1D4ED8', fontSize: '18px', fontWeight: 700, fontFamily: 'system-ui, sans-serif' }}>
              One click to call them back
            </div>
          </div>
        </div>
      )}

      {/* Bottom text */}
      <TextOverlay
        text="Never let a hot lead go cold"
        startFrame={110}
        duration={70}
        position="bottom"
        fontSize={28}
        withBackground={true}
      />
    </div>
  );
};
