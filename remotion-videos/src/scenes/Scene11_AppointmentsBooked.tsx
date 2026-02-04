import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';
import { TextOverlay } from '../components/TextOverlay';

export const Scene11_AppointmentsBooked: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Fade in
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Ken Burns
  const scale = interpolate(frame, [0, 180], [1, 1.08], { extrapolateRight: 'clamp' });

  // Staggered appointment cards
  const appointments = [
    { name: 'Sarah J.', service: 'Botox', time: 'Tue 2:00 PM', delay: 30 },
    { name: 'Michael C.', service: 'Chemical Peel', time: 'Wed 10:00 AM', delay: 50 },
    { name: 'Emily R.', service: 'Consultation', time: 'Thu 3:30 PM', delay: 70 },
  ];

  // Google Calendar checkmark
  const checkOpacity = interpolate(frame, [90, 105], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const checkScale = spring({
    frame: Math.max(0, frame - 90),
    fps,
    from: 0.5,
    to: 1,
    config: { damping: 12, stiffness: 100 },
  });

  // Revenue counter
  const revenueRaw = spring({
    frame: Math.max(0, frame - 110),
    fps,
    from: 0,
    to: 1200,
    config: { damping: 50, stiffness: 60 },
  });
  const revenueValue = Math.floor(revenueRaw);
  const revenueOpacity = interpolate(frame, [110, 125], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{
      width: '100%', height: '100%', backgroundColor: '#F0F9FF',
      position: 'relative', overflow: 'hidden', opacity: fadeIn,
    }}>
      {/* Text Overlay */}
      <TextOverlay
        text="Appointments Booked Automatically"
        subtitle="Synced directly to Google Calendar"
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
            <div style={{ marginLeft: 12, fontSize: 12, color: '#666', fontFamily: 'system-ui, sans-serif' }}>
              Appointments Calendar
            </div>
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 40px)', overflow: 'hidden' }}>
            <Img
              src={staticFile('screenshots/13_appointments_calendar.png')}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, transformOrigin: 'center top' }}
            />
          </div>
        </div>
      </div>

      {/* Appointment cards - staggered fade in */}
      {appointments.map((appt, i) => {
        const cardOpacity = interpolate(frame, [appt.delay, appt.delay + 15], [0, 1], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });
        const cardScale = spring({
          frame: Math.max(0, frame - appt.delay),
          fps,
          from: 0.85,
          to: 1,
          config: { damping: 15, stiffness: 120 },
        });
        const cardY = interpolate(frame, [appt.delay, appt.delay + 15], [15, 0], {
          extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
        });

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 120,
              top: 240 + i * 110,
              opacity: cardOpacity,
              transform: `scale(${cardScale}) translateY(${cardY}px)`,
              width: '340px',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '12px',
              border: '2px solid #1D4ED8',
              padding: '14px 18px',
              boxShadow: '0 4px 16px rgba(29, 78, 216, 0.15)',
              backdropFilter: 'blur(4px)',
              zIndex: 130,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            {/* Check icon */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              backgroundColor: '#22c55e', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 10L8.5 13.5L15 6.5" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#020412', fontSize: '16px', fontFamily: 'system-ui, sans-serif' }}>
                {appt.name} - {appt.service}
              </div>
              <div style={{ color: '#1D4ED8', fontSize: '14px', fontWeight: 600, fontFamily: 'system-ui, sans-serif', marginTop: '2px' }}>
                {appt.time}
              </div>
            </div>
          </div>
        );
      })}

      {/* Google Calendar synced badge */}
      {frame >= 90 && (
        <div style={{
          position: 'absolute', left: 140, top: 580,
          opacity: checkOpacity, transform: `scale(${checkScale})`,
          zIndex: 140,
        }}>
          <div style={{
            backgroundColor: '#22c55e', borderRadius: '10px',
            padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
          }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M5 11L9 15L17 7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{ color: '#ffffff', fontSize: '16px', fontWeight: 700, fontFamily: 'system-ui, sans-serif' }}>
              Synced to Google Calendar
            </div>
          </div>
        </div>
      )}

      {/* Revenue counter */}
      {frame >= 110 && (
        <div style={{
          position: 'absolute', left: 140, top: 635,
          opacity: revenueOpacity, zIndex: 140,
        }}>
          <div style={{
            backgroundColor: 'rgba(2, 4, 18, 0.85)', borderRadius: '10px',
            padding: '8px 18px', backdropFilter: 'blur(4px)',
          }}>
            <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 600, fontFamily: 'system-ui, sans-serif' }}>
              3 appointments this week = <span style={{ color: '#22c55e', fontWeight: 800 }}>${revenueValue.toLocaleString()}</span> revenue
            </div>
          </div>
        </div>
      )}

      {/* Bottom text */}
      <TextOverlay
        text="All booked without a single staff call"
        startFrame={120}
        duration={60}
        position="bottom"
        fontSize={28}
        withBackground={true}
      />
    </div>
  );
};
