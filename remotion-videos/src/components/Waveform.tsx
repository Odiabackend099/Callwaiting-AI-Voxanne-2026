import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { COLORS } from '../constants';

interface WaveformProps {
    barCount?: number;
    width?: number;
    height?: number;
}

/**
 * Animated audio waveform visualizer.
 * Shows pulsing bars to indicate the AI is actively speaking.
 * Subconsciously tells viewers: "This isn't a chatbot — it's a VOICE bot."
 */
export const Waveform: React.FC<WaveformProps> = ({
    barCount = 14,
    width = 160,
    height = 40,
}) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const bars = Array.from({ length: barCount }, (_, i) => {
        // Each bar oscillates with a phase offset for a wave-like effect
        const phaseOffset = (i / barCount) * Math.PI * 2;
        const speed = 0.15;

        // Two overlapping sin waves for organic motion
        const wave1 = Math.sin(frame * speed + phaseOffset);
        const wave2 = Math.sin(frame * speed * 1.3 + phaseOffset * 0.7) * 0.4;
        const combined = (wave1 + wave2) / 1.4;

        // Map [-1, 1] to a height percentage [0.15, 1.0]
        const barHeight = interpolate(combined, [-1, 1], [0.15, 1.0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });

        // Subtle opacity pulsing
        const barOpacity = interpolate(combined, [-1, 1], [0.5, 1.0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
        });

        const barWidth = width / barCount - 2;

        return (
            <div
                key={i}
                style={{
                    width: `${barWidth}px`,
                    height: `${barHeight * height}px`,
                    backgroundColor: COLORS.primary,
                    borderRadius: '4px',
                    opacity: barOpacity,
                    transition: 'height 0.05s ease',
                    boxShadow: `0 0 8px rgba(37, 99, 235, ${barOpacity * 0.4})`,
                }}
            />
        );
    });

    // Overall fade-in
    const fadeIn = interpolate(frame, [0, 10], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
    });

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                height: `${height}px`,
                width: `${width}px`,
                opacity: fadeIn,
            }}
        >
            {bars}
        </div>
    );
};
