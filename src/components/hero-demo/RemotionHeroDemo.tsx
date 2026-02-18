
'use client';

import React, { useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface RemotionHeroDemoProps {
    isActive: boolean;
    onToggle: () => void;
}

export default function RemotionHeroDemo({ isActive, onToggle }: RemotionHeroDemoProps) {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Auto-play/pause based on active state
    useEffect(() => {
        if (isActive) {
            // Attempt autoplay with catch for browser policies
            videoRef.current?.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
            videoRef.current?.pause();
        }
    }, [isActive]);

    return (
        <div className="relative w-full aspect-[9/16] h-auto bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col group">

            {/* IDLE STATE: "Watch Demo" Cover */}
            <AnimatePresence>
                {!isActive && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-blue-600/90 to-indigo-900/90 backdrop-blur-sm"
                    >
                        <button
                            onClick={onToggle}
                            className="group/btn relative w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
                        >
                            <Play className="w-6 h-6 text-blue-600 ml-1 fill-blue-600" />
                            <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
                        </button>
                        <p className="mt-4 text-white font-medium text-sm tracking-wide">Watch workflow demo</p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ACTIVE STATE: Optimized MP4 Video */}
            <div className={cn("absolute inset-0 transition-opacity duration-500", isActive ? "opacity-100" : "opacity-0 pointer-events-none")}>
                <video
                    ref={videoRef}
                    src="/demo/voxanne-testimonial.mp4"
                    className="w-full h-full object-cover"
                    controls={true}
                    playsInline
                    loop
                />
            </div>

            {/* Status Badge overlay (optional, fits the 'Industry Standard' look) */}
            {isActive && (
                <div className="absolute top-4 left-4 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <span className="text-[10px] font-semibold text-white/80 uppercase tracking-wider mix-blend-difference">
                        Live Simulation
                    </span>
                </div>
            )}
        </div>
    );
}
