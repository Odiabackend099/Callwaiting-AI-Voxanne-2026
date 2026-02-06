import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';
import { StepIndicator } from '../components/StepIndicator';
import { ClickSimulation } from '../components/ClickSimulation';
import { FormFillSimulation } from '../components/FormFillSimulation';

export const Scene3_ConfigureAgent: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in the screenshot from frames 0-15
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
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
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.12), 0 2px 8px rgba(2, 4, 18, 0.06)',
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
            Voxanne Dashboard
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
          <Img
            src={staticFile('screenshots/02_agent_config_inbound.png')}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </div>

      {/* Primary text overlay at top: "Create Your AI Receptionist" */}
      <TextOverlay
        text="Create Your AI Receptionist"
        subtitle="Tell your AI how to greet patients"
        startFrame={0}
        duration={70}
        fontSize={44}
        position="top"
      />

      {/* Cursor moves from center to system prompt field */}
      {/* TODO: Add 'system-prompt-textarea' to 02_agent_config_inbound.json manifest */}
      <ClickSimulation
        startFrame={30}
        fromX={960}
        fromY={400}
        toElementName="system-prompt-textarea"
        screenshotName="02_agent_config_inbound.png"
      />

      {/* Form fill: typing the system prompt */}
      {/* TODO: Add 'system-prompt-textarea' to 02_agent_config_inbound.json manifest */}
      <FormFillSimulation
        text="You are a friendly receptionist for Valley Dermatology. Help callers schedule appointments."
        startFrame={60}
        elementName="system-prompt-textarea"
        screenshotName="02_agent_config_inbound.png"
        charRate={2}
      />

      {/* Second text overlay at bottom: "Your AI is ready to talk" */}
      <TextOverlay
        text="Your AI is ready to talk"
        startFrame={190}
        duration={50}
        position="bottom"
        withBackground={true}
      />

      {/* Step indicator at bottom */}
      <StepIndicator
        currentStep={2}
        totalSteps={6}
        label="Agent Configuration"
      />
    </div>
  );
};
