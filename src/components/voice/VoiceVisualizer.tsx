"use client";

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface VoiceVisualizerProps {
    isRecording: boolean;
    isSpeaking: boolean;
    isConnected: boolean;
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
    isRecording,
    isSpeaking,
    isConnected,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        let phase = 0;

        const draw = () => {
            ctx.clearRect(0, 0, width, height);

            if (!isConnected) {
                // Draw static line when not connected
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(0, height / 2);
                ctx.lineTo(width, height / 2);
                ctx.stroke();
                return;
            }

            // Draw waveform
            const barCount = 50;
            const barWidth = width / barCount;
            const centerY = height / 2;

            for (let i = 0; i < barCount; i++) {
                const x = i * barWidth;

                // Create wave effect
                let amplitude = 0;
                if (isRecording || isSpeaking) {
                    amplitude = Math.sin((i / barCount) * Math.PI * 4 + phase) * 20;
                    amplitude += Math.sin((i / barCount) * Math.PI * 2 - phase * 0.5) * 10;
                }

                const barHeight = Math.abs(amplitude) + 2;

                // Color based on state
                const gradient = ctx.createLinearGradient(0, 0, 0, height);
                if (isSpeaking) {
                    gradient.addColorStop(0, '#06b6d4'); // cyan
                    gradient.addColorStop(1, '#3b82f6'); // blue
                } else if (isRecording) {
                    gradient.addColorStop(0, '#10b981'); // green
                    gradient.addColorStop(1, '#059669');
                } else {
                    gradient.addColorStop(0, '#64748b'); // gray
                    gradient.addColorStop(1, '#475569');
                }

                ctx.fillStyle = gradient;
                ctx.fillRect(x, centerY - barHeight / 2, barWidth - 2, barHeight);
            }

            phase += 0.1;
            animationRef.current = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [isRecording, isSpeaking, isConnected]);

    return (
        <div className="relative w-full h-32 bg-slate-900/50 rounded-xl overflow-hidden border border-slate-700">
            <canvas
                ref={canvasRef}
                width={800}
                height={128}
                className="w-full h-full"
            />

            {/* Status indicator */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
                <motion.div
                    animate={{
                        scale: isRecording || isSpeaking ? [1, 1.2, 1] : 1,
                    }}
                    transition={{
                        duration: 1,
                        repeat: isRecording || isSpeaking ? Infinity : 0,
                    }}
                    className={`w-3 h-3 rounded-full ${isSpeaking
                        ? 'bg-cyan-500'
                        : isRecording
                            ? 'bg-green-500'
                            : isConnected
                                ? 'bg-slate-500'
                                : 'bg-red-500'
                        }`}
                />
                <span className="text-sm text-slate-300 font-medium">
                    {isSpeaking
                        ? 'Voxanne is speaking...'
                        : isRecording
                            ? 'Listening...'
                            : isConnected
                                ? 'Connected'
                                : 'Disconnected'}
                </span>
            </div>
        </div>
    );
};
