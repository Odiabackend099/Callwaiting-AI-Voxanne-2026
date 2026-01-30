'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface AudioVisualizerProps {
    isActive: boolean;
    barCount?: number;
    height?: number;
    color?: string;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
    isActive,
    barCount = 20,
    height = 40,
    color = 'bg-surgical-500'
}) => {
    return (
        <div className="flex items-center justify-center gap-1 h-full w-full">
            {Array.from({ length: barCount }).map((_, i) => (
                <motion.div
                    key={i}
                    className={`w-1.5 rounded-full ${color}`}
                    initial={{ height: 4 }}
                    animate={{
                        height: isActive ? [4, Math.random() * height + 4, 4] : 4,
                        opacity: isActive ? 1 : 0.3
                    }}
                    transition={{
                        duration: 0.5,
                        repeat: isActive ? Infinity : 0,
                        repeatType: "reverse",
                        delay: i * 0.05,
                        ease: "easeInOut"
                    }}
                    style={{
                        minHeight: '4px'
                    }}
                />
            ))}
        </div>
    );
};
