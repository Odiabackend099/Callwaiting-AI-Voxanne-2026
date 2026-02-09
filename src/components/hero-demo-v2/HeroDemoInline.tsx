import React, { useEffect, useState } from 'react';
import { useAudioSyncV2 } from './useAudioSyncV2';
import AnnaAvatar from './AnnaAvatar';
import TranscriptionPanel from './TranscriptionPanel';
import { TIMING } from './preciseTimeline';
import { Play, RotateCcw, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

interface HeroDemoInlineProps {
    isActive: boolean;
    onClose: () => void;
}

export default function HeroDemoInline({ isActive, onClose }: HeroDemoInlineProps) {
    const {
        isPlaying,
        currentTime,
        duration,
        togglePlay,
        isCallActive,
        annaSpeaking,
        audioRef
    } = useAudioSyncV2('/demo/audio.mp3');

    // Auto-play when activated
    useEffect(() => {
        if (isActive && audioRef.current && !isPlaying) {
            togglePlay();
        } else if (!isActive && audioRef.current && isPlaying) {
            togglePlay(); // Pause if deactivated
        }
    }, [isActive]);

    // Calculate progress for seek bar
    const progress = (currentTime / TIMING.TOTAL_DURATION) * 100;

    if (!isActive) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-white/95 backdrop-blur-sm flex flex-col"
        >
            {/* Close / Minimize Button */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 z-[60] p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                title="Close Demo"
            >
                <X className="w-5 h-5 text-gray-600" />
            </button>

            {/* Main Content Container - Fitted to Parent */}
            <div className="relative flex-1 flex items-center justify-center overflow-hidden">

                {/* Left Side: Avatar & Visuals */}
                <div className={cn(
                    "flex-1 flex flex-col items-center justify-center transition-all duration-1000",
                    isCallActive ? "translate-x-[-15%] scale-90" : "translate-x-0 scale-100"
                )}>
                    <div className="scale-75 origin-center">
                        <AnnaAvatar isSpeaking={annaSpeaking} />
                    </div>

                    {/* Status Text Overlay */}
                    <div className="mt-4 text-center space-y-1">
                        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                            Anna
                        </h2>
                        <p className="text-sm text-teal-600 font-medium uppercase tracking-widest">
                            {isCallActive ? 'On Call with AI' : 'Medical Aesthetician'}
                        </p>
                    </div>

                    {/* Call Status Indicator */}
                    <AnimatePresence>
                        {isCallActive && (
                            <motion.div
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                className="mt-4 flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm"
                            >
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                </span>
                                <span className="font-mono font-bold text-xs">LIVE CALL</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right Side: Transcription Panel */}
                <TranscriptionPanel
                    currentTime={currentTime}
                    isVisible={isCallActive}
                />
            </div>

            {/* Bottom Controls - Compact */}
            <div className="w-full bg-white/50 backdrop-blur-md px-6 py-3 border-t border-white/20 flex items-center gap-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={togglePlay}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                    >
                        {isPlaying ? <span className="w-4 h-4 block i-lucide-pause" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    {/* Progress Bar */}
                    <div className="w-[300px] lg:w-[400px] h-1.5 bg-gray-200 rounded-full overflow-hidden relative group cursor-pointer"
                        onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const pos = (e.clientX - rect.left) / rect.width;
                            if (audioRef.current) audioRef.current.currentTime = pos * TIMING.TOTAL_DURATION;
                        }}
                    >
                        <div
                            className="h-full bg-blue-600 transition-all duration-100 ease-linear rounded-full relative"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>

                <span className="text-xs font-mono text-gray-600 w-10 text-right ml-auto">
                    {formatTime(currentTime)}
                </span>
            </div>
        </motion.div>
    );
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
