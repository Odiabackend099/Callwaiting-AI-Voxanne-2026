import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { loadFont } from '@remotion/google-fonts/Outfit';
import { COLORS } from '../constants';

// Load Outfit font dynamically
const { fontFamily } = loadFont();

interface ChatBubbleProps {
    text: string;
    isAi: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ text, isAi }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    // Spring "pop-in" animation for natural physics feel
    const scale = spring({
        frame,
        fps,
        config: { damping: 200, stiffness: 150, mass: 0.5 },
    });

    // Gentle opacity fade
    const opacity = spring({
        frame,
        fps,
        config: { damping: 300, stiffness: 100, mass: 0.8 },
    });

    return (
        <div
            style={{
                transform: `scale(${scale})`,
                opacity,
                display: 'flex',
                width: '100%',
                marginBottom: '16px',
                justifyContent: isAi ? 'flex-start' : 'flex-end',
                alignItems: 'flex-end',
            }}
        >
            {/* AI Avatar — "V" badge */}
            {isAi && (
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        minWidth: '44px',
                        borderRadius: '50%',
                        backgroundColor: COLORS.primary,
                        marginRight: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 12px rgba(37, 99, 235, 0.35)`,
                    }}
                >
                    <span
                        style={{
                            color: 'white',
                            fontWeight: 700,
                            fontSize: '20px',
                            fontFamily,
                            lineHeight: 1,
                        }}
                    >
                        V
                    </span>
                </div>
            )}

            {/* The Message Bubble */}
            <div
                style={{
                    maxWidth: '75%',
                    padding: '16px 20px',
                    fontSize: '22px',
                    lineHeight: 1.45,
                    fontWeight: 500,
                    fontFamily,
                    borderRadius: '20px',
                    borderTopLeftRadius: isAi ? '4px' : '20px',
                    borderTopRightRadius: isAi ? '20px' : '4px',
                    backgroundColor: isAi ? 'white' : COLORS.primary,
                    color: isAi ? COLORS.dark : 'white',
                    boxShadow: isAi
                        ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)'
                        : '0 4px 12px rgba(37, 99, 235, 0.3)',
                }}
            >
                {text}
            </div>

            {/* User avatar on right side */}
            {!isAi && (
                <div
                    style={{
                        width: '44px',
                        height: '44px',
                        minWidth: '44px',
                        borderRadius: '50%',
                        backgroundColor: COLORS.dark,
                        marginLeft: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                    }}
                >
                    <span
                        style={{
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '18px',
                            fontFamily,
                            lineHeight: 1,
                        }}
                    >
                        A
                    </span>
                </div>
            )}
        </div>
    );
};
