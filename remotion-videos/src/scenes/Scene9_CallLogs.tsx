import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { HighlightBox } from '../components/HighlightBox';

export const Scene9_CallLogs: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns: slow zoom
  const scale = interpolate(frame, [0, 180], [1, 1.1], {
    extrapolateRight: 'clamp',
  });
  const translateY = interpolate(frame, [0, 180], [0, -20], {
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: '#F0F9FF',
      position: 'relative', overflow: 'hidden', opacity: fadeIn,
    }}>
      {/* Text Overlay */}
      <TextOverlay
        text="Every Call, Analyzed by AI"
        subtitle="Full transcripts, recordings, and insights"
        startFrame={0}
        duration={80}
        fontSize={44}
      />

      {/* Screenshot Container */}
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
          {/* Browser chrome */}
          <div style={{
            height: '40px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #e0e0e0',
            display: 'flex', alignItems: 'center', paddingLeft: '16px', gap: '8px',
          }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: '#27c93f' }} />
            <div style={{ marginLeft: 12, fontSize: 12, color: '#666', fontFamily: 'system-ui, sans-serif' }}>
              Call Logs & Analytics
            </div>
          </div>
          <div style={{
            width: '100%', height: 'calc(100% - 40px)', overflow: 'hidden',
          }}>
            <Img
              src={staticFile('screenshots/11_call_logs_dashboard.png')}
              style={{
                width: '100%', height: '100%', objectFit: 'cover',
                transform: `scale(${scale}) translateY(${translateY}px)`,
                transformOrigin: 'center top',
              }}
            />
          </div>
        </div>
      </div>

      {/* Highlight boxes appearing sequentially */}
      <HighlightBox
        x={780} y={310} width={180} height={45}
        startFrame={40} duration={100}
        label="AI Sentiment Score" labelPosition="top"
      />
      <HighlightBox
        x={1050} y={310} width={150} height={45}
        startFrame={70} duration={80}
        label="View Transcript" labelPosition="top"
        color="#22c55e"
      />
      <HighlightBox
        x={620} y={310} width={130} height={45}
        startFrame={100} duration={60}
        label="Call Duration" labelPosition="top"
        color="#f59e0b"
      />

      {/* Bottom summary text */}
      <TextOverlay
        text="Track every interaction automatically"
        startFrame={110}
        duration={70}
        position="bottom"
        fontSize={28}
        withBackground={true}
      />
    </div>
  );
};
