import React, { useEffect, useRef, useState } from 'react';
import { useAudioSyncV2 } from './useAudioSyncV2';
import AnnaAvatar from './AnnaAvatar';
import TranscriptionPanel from './TranscriptionPanel';
import { TIMING } from './preciseTimeline';
import { Play, Pause, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface HeroDemoCardProps {
    isActive: boolean;
    onToggle: () => void;
}

export default function HeroDemoCard({ isActive, onToggle }: HeroDemoCardProps) {
    const {
        isPlaying,
        currentTime,
        duration,
        togglePlay,
        isCallActive,
        annaSpeaking,
        audioRef
    } = useAudioSyncV2('/demo/audio.mp3');

    // Auto-play when activated if not already playing
    useEffect(() => {
        if (isActive && audioRef.current && !isPlaying) {
            togglePlay();
        } else if (!isActive && audioRef.current && isPlaying) {
            togglePlay(); // Pause if deactivated
        }
    }, [isActive]);

    // Calculate progress
    const progress = (currentTime / TIMING.TOTAL_DURATION) * 100;

    return (
        <div className="relative w-full h-[400px] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header / Status Bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-2">
                    <div className={cn("w-2 h-2 rounded-full", isActive ? "bg-green-400 animate-pulse" : "bg-white/40")} />
                    <span className="text-xs font-semibold text-white/80 tracking-wide uppercase">
                        {isActive ? 'Live Demo' : 'Voxanne AI'}
                    </span>
                </div>
                {isActive && (
                    <span className="text-[10px] font-mono text-white/50">
                        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                    </span>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative flex items-center justify-center p-4">

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
                                className="group relative w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300"
                            >
                                <Play className="w-6 h-6 text-blue-600 ml-1 fill-blue-600" />
                                <div className="absolute inset-0 rounded-full border-2 border-white/30 animate-ping" />
                            </button>
                            <p className="mt-4 text-white font-medium text-sm tracking-wide">Watch workflow demo</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ACTIVE STATE: Player */}
                <div className={cn("absolute inset-0 flex flex-col transition-all duration-500", isActive ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none")}>

                    {/* Avatar Area - Compact */}
                    <div className="flex-1 relative flex items-center justify-center bg-gradient-to-b from-transparent to-black/20">
                        <div className="scale-[0.65] transform-gpu">
                            <AnnaAvatar isSpeaking={annaSpeaking} />
                        </div>

                        {/* Call Badge */}
                        {isCallActive && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-medium text-white/90">On Call</span>
                            </div>
                        )}
                    </div>

                    {/* Transcript Overlay - Slides up from bottom */}
                    <div className="h-[40%] bg-white/95 backdrop-blur-md border-t border-white/20 relative">
                        <TranscriptionPanel
                            currentTime={currentTime}
                            isVisible={true}
                            minimal={true} // New prop for compact mode if needed, or just rely on container size
                        />
                    </div>

                    {/* Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/50 to-transparent flex items-center gap-3">
                        <button onClick={togglePlay} className="text-white hover:text-blue-300 transition-colors">
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        {/* Mini Progress */}
                        <div className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
