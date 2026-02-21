import React from 'react';
import {
    useCurrentFrame,
    useVideoConfig,
    Sequence,
    interpolate,
    spring,
} from 'remotion';
import { loadFont } from '@remotion/google-fonts/Outfit';
import { ChatBubble } from './ChatBubble';
import { Waveform } from './Waveform';
import { COLORS, secToFrames, PHASE_A_END_SEC } from '../constants';

const { fontFamily } = loadFont();

// ─── Timestamped Transcript Data ─────────────────────────────────────────────
// Each entry maps to the exact second the person starts speaking in the video.
const transcript = [
    { startSec: 26, isAi: true, text: "Thank you for choosing Lone Tree Aesthetics, this is Lisa. Who do I have the pleasure of speaking with?" },
    { startSec: 31, isAi: false, text: "Hi Lisa. This is Anna calling. May I book an appointment with you today for Botox, please?" },
    { startSec: 38, isAi: true, text: "Hi Anna, I'd be happy to help you with that. When are you looking to book your Botox appointment?" },
    { startSec: 46, isAi: false, text: "Wait, uh... Do you have any specials going on for this month?" },
    { startSec: 51, isAi: true, text: "Yes, we do! Buy one syringe of Juvederm Ultra XC and get 20 free units of Botox." },
    { startSec: 62, isAi: false, text: "How do I know your before and after photos aren't just good lighting and editing?" },
    { startSec: 68, isAi: true, text: "Great question. We pride ourselves on transparency. Our photos are taken under consistent lighting to ensure they accurately reflect results." },
    { startSec: 91, isAi: false, text: "Wait... do you guys do payment plans?" },
    { startSec: 95, isAi: true, text: "Yes, we offer payment plans through Cherry Financing. It allows you to split payments into smaller amounts." },
    { startSec: 109, isAi: false, text: "Oh, that's wonderful. Yes, please, I would like to book that appointment." },
    { startSec: 120, isAi: false, text: "I need a couple of minutes here. I'll give you a call back." },
    { startSec: 128, isAi: true, text: "No problem at all, Anna. Feel free to call back whenever you're ready. Have a great day." },
];

// ─── Chat Header ─────────────────────────────────────────────────────────────
const ChatHeader: React.FC = () => {
    const frame = useCurrentFrame();
    // Green dot pulse
    const pulse = interpolate(
        Math.sin(frame * 0.12),
        [-1, 1],
        [0.6, 1.0]
    );

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 28px',
                borderBottom: `1px solid ${COLORS.glassBorder}`,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Green live dot */}
                <div
                    style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: COLORS.success,
                        opacity: pulse,
                        boxShadow: `0 0 10px rgba(34, 197, 94, ${pulse * 0.6})`,
                    }}
                />
                <div>
                    <div
                        style={{
                            fontFamily,
                            fontSize: '18px',
                            fontWeight: 700,
                            color: 'white',
                            lineHeight: 1.3,
                        }}
                    >
                        Lone Tree Aesthetics
                    </div>
                    <div
                        style={{
                            fontFamily,
                            fontSize: '13px',
                            fontWeight: 400,
                            color: 'rgba(255,255,255,0.55)',
                            lineHeight: 1.3,
                        }}
                    >
                        AI Voice Agent — Live Call
                    </div>
                </div>
            </div>

            {/* Duration badge */}
            <div
                style={{
                    fontFamily,
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.5)',
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    padding: '6px 14px',
                    borderRadius: '100px',
                    border: `1px solid rgba(255,255,255,0.08)`,
                }}
            >
                Powered by Voxanne
            </div>
        </div>
    );
};

// ─── Main Chat Overlay ───────────────────────────────────────────────────────
export const ChatOverlay: React.FC = () => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Slide-up entrance animation (spring physics)
    const slideUp = spring({
        frame,
        fps,
        config: { damping: 28, stiffness: 80, mass: 1.2 },
    });

    const translateY = interpolate(slideUp, [0, 1], [600, 0]);
    const containerOpacity = interpolate(slideUp, [0, 1], [0, 1]);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '60px',
                left: '40px',
                right: '40px',
                top: '120px',
                transform: `translateY(${translateY}px)`,
                opacity: containerOpacity,
                display: 'flex',
                flexDirection: 'column',
                // Glassmorphism: dark semi-transparent with blur
                backgroundColor: COLORS.glass,
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                borderRadius: '24px',
                border: `1px solid ${COLORS.glassBorder}`,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05)',
                overflow: 'hidden',
            }}
        >
            <ChatHeader />

            {/* Scrollable messages area */}
            <div
                style={{
                    flex: 1,
                    padding: '24px 28px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    overflow: 'hidden',
                }}
            >
                {transcript.map((msg, index) => {
                    // Frame when this message appears (relative to Phase B start)
                    const msgStartFrame = secToFrames(msg.startSec - PHASE_A_END_SEC);

                    // Calculate duration until next message (or 10s if last)
                    const nextMsg = transcript[index + 1];
                    const msgDuration = nextMsg
                        ? secToFrames(nextMsg.startSec - msg.startSec)
                        : secToFrames(10);

                    return (
                        <Sequence
                            from={msgStartFrame}
                            durationInFrames={Infinity}
                            key={index}
                            layout="none"
                        >
                            <div style={{ marginBottom: '4px' }}>
                                <ChatBubble text={msg.text} isAi={msg.isAi} />

                                {/* Show waveform WHILE AI is speaking (for the message duration) */}
                                {msg.isAi && (
                                    <Sequence
                                        from={0}
                                        durationInFrames={msgDuration}
                                        layout="none"
                                    >
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '10px',
                                                marginLeft: '56px',
                                                marginBottom: '8px',
                                            }}
                                        >
                                            <Waveform barCount={14} width={140} height={32} />
                                            <span
                                                style={{
                                                    fontFamily,
                                                    fontSize: '12px',
                                                    color: 'rgba(255,255,255,0.35)',
                                                    fontWeight: 400,
                                                }}
                                            >
                                                Lisa is speaking...
                                            </span>
                                        </div>
                                    </Sequence>
                                )}
                            </div>
                        </Sequence>
                    );
                })}
            </div>
        </div>
    );
};
