import React from 'react';
import { Img, staticFile } from 'remotion';

interface ScreenshotFrameProps {
  screenshotPath: string;
  title?: string;
  scale?: number;
}

export const ScreenshotFrame: React.FC<ScreenshotFrameProps> = ({
  screenshotPath,
  title = 'Dashboard',
  scale = 1,
}) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: '#F0F9FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '90%',
          height: '90%',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(2, 4, 18, 0.1)',
          overflow: 'hidden',
          transform: `scale(${scale})`,
          transformOrigin: 'center',
          transition: 'transform 0.3s ease-out',
        }}
      >
        {/* Browser-like header */}
        <div
          style={{
            height: '40px',
            backgroundColor: '#f5f5f5',
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '16px',
            gap: '8px',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ff5f56',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#ffbd2e',
            }}
          />
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#27c93f',
            }}
          />
          <div
            style={{
              marginLeft: '12px',
              fontSize: '12px',
              color: '#666',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {title}
          </div>
        </div>

        {/* Screenshot content */}
        <div
          style={{
            width: '100%',
            height: 'calc(100% - 40px)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Img
            src={staticFile(screenshotPath)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        </div>
      </div>
    </div>
  );
};
