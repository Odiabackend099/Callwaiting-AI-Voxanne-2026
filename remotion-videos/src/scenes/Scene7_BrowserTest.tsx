import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Img,
  staticFile,
} from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { StepIndicator } from '../components/StepIndicator';
import { ClickSimulation } from '../components/ClickSimulation';

interface ChatBubbleProps {
  text: string;
  role: 'patient' | 'ai';
  appearFrame: number;
  yOffset: number;
  frame: number;
  fps: number;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({
  text,
  role,
  appearFrame,
  yOffset,
  frame,
  fps,
}) => {
  if (frame < appearFrame) {
    return null;
  }

  const localFrame = frame - appearFrame;

  const springVal = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, stiffness: 120 },
  });

  const opacity = springVal;
  const translateY = interpolate(springVal, [0, 1], [20, 0]);

  const isPatient = role === 'patient';

  return (
    <div
      style={{
        position: 'absolute',
        bottom: yOffset,
        left: isPatient ? 'auto' : '10%',
        right: isPatient ? '10%' : 'auto',
        maxWidth: '42%',
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 300,
      }}
    >
      <div
        style={{
          backgroundColor: isPatient ? '#DBEAFE' : '#ffffff',
          border: isPatient ? 'none' : '2px solid #1D4ED8',
          color: '#020412',
          padding: '12px 16px',
          borderRadius: isPatient
            ? '14px 14px 4px 14px'
            : '14px 14px 14px 4px',
          fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
          fontSize: '15px',
          lineHeight: 1.45,
          boxShadow: '0 2px 10px rgba(2, 4, 18, 0.08)',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            color: isPatient ? '#1D4ED8' : '#6B7280',
            marginBottom: '4px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {isPatient ? 'Patient' : 'Voxanne AI'}
        </div>
        {text}
      </div>
    </div>
  );
};

export const Scene7_BrowserTest: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in from frames 0-15
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Crossfade between idle and active screenshots at frames 50-70
  const screenshotTransition = interpolate(frame, [50, 70], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F9FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadeIn,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
      }}
    >
      {/* Browser chrome container */}
      <div
        style={{
          position: 'relative',
          width: '90%',
          height: '90%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow:
            '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
          overflow: 'hidden',
        }}
      >
        {/* macOS-style browser chrome bar */}
        <div
          style={{
            height: '40px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '16px',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          {/* Red dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ff5f56',
            }}
          />
          {/* Yellow dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ffbd2e',
            }}
          />
          {/* Green dot */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#27c93f',
            }}
          />
          {/* Title text */}
          <div
            style={{
              marginLeft: '12px',
              fontSize: '13px',
              color: '#666666',
              fontFamily: 'system-ui, -apple-system, Inter, sans-serif',
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            Voxanne AI - Browser Test
          </div>
        </div>

        {/* Screenshot content area */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Screenshot 1: idle state (visible frames 0-60, fades out with crossfade) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: 1 - screenshotTransition,
            }}
          >
            <Img
              src={staticFile('screenshots/07_test_browser_idle.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* Screenshot 2: active state (crossfades in at frames 50-70) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              opacity: screenshotTransition,
            }}
          >
            <Img
              src={staticFile('screenshots/08_test_browser_active.png')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </div>
        </div>
      </div>

      {/* Primary TextOverlay */}
      <TextOverlay
        text="Test Your AI Live"
        subtitle="Try a conversation right in your browser"
        startFrame={0}
        duration={60}
        fontSize={44}
        position="top"
      />

      {/* Cursor clicks the Start Call button area */}
      <ClickSimulation
        startFrame={20}
        fromX={960}
        fromY={300}
        toX={700}
        toY={450}
      />

      {/* Chat bubbles appear sequentially after screenshot transition */}

      {/* Bubble 1: Patient (frame 80) */}
      <ChatBubble
        text="Hi, I'd like to schedule a Botox consultation"
        role="patient"
        appearFrame={80}
        yOffset={320}
        frame={frame}
        fps={fps}
      />

      {/* Bubble 2: AI (frame 110) */}
      <ChatBubble
        text="I'd love to help! We have openings Tuesday at 2 PM or Thursday at 10 AM."
        role="ai"
        appearFrame={110}
        yOffset={240}
        frame={frame}
        fps={fps}
      />

      {/* Bubble 3: Patient (frame 145) */}
      <ChatBubble
        text="Tuesday at 2 PM please"
        role="patient"
        appearFrame={145}
        yOffset={170}
        frame={frame}
        fps={fps}
      />

      {/* Bubble 4: AI (frame 170) */}
      <ChatBubble
        text="You're all set! Botox consultation booked for Tuesday at 2 PM."
        role="ai"
        appearFrame={170}
        yOffset={90}
        frame={frame}
        fps={fps}
      />

      {/* Final TextOverlay at bottom */}
      <TextOverlay
        text="Your AI just booked an appointment"
        startFrame={200}
        duration={40}
        position="bottom"
        withBackground={true}
      />

      {/* Step indicator at bottom */}
      <StepIndicator
        currentStep={6}
        totalSteps={6}
        label="Live Testing"
      />
    </div>
  );
};
