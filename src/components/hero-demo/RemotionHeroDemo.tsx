
'use client';

import React, { useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { VoxanneDemo } from '../../remotion/Composition';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface RemotionHeroDemoProps {
    isActive: boolean;
    onToggle: () => void;
}

export default function RemotionHeroDemo({ isActive, onToggle }: RemotionHeroDemoProps) {
    const playerRef = useRef<PlayerRef>(null);

    // Auto-play/pause based on active state
    useEffect(() => {
        if (isActive) {
            playerRef.current?.play();
        } else {
            playerRef.current?.pause();
        }
    }, [isActive]);

    return (
        <div className="relative w-full h-[400px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col group">

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

            {/* ACTIVE STATE: Remotion Player */}
            <div className={cn("absolute inset-0 transition-opacity duration-500", isActive ? "opacity-100" : "opacity-0 pointer-events-none")}>
                <Player
                    ref={playerRef}
                    component={VoxanneDemo}
                    durationInFrames={148 * 30}
                    compositionWidth={1920}
                    compositionHeight={1080}
                    fps={30}
                    controls
                    style={{
                        width: '100%',
                        height: '100%',
                    }}
                    inputProps={{}}
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
