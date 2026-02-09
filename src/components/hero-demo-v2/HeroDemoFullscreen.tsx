import React, { useState, useEffect } from 'react';
import { useAudioSyncV2 } from './useAudioSyncV2';
import AnnaAvatar from './AnnaAvatar';
import TranscriptionPanel from './TranscriptionPanel';
import { TIMING } from './preciseTimeline';
import { Play, RotateCcw, X, Phone, PhoneOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';

export default function HeroDemoFullscreen() {
    const [isOpen, setIsOpen] = useState(false);
    const {
        isPlaying,
        currentTime,
        duration,
        togglePlay,
        isCallActive,
        annaSpeaking,
        audioRef
    } = useAudioSyncV2('/demo/audio.mp3');

    // Close on ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') handleClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
        togglePlay(); // Start playing immediately
    };

    const handleClose = () => {
        setIsOpen(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const handleReplay = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
        }
    };

    // Calculate progress for seek bar
    const progress = (currentTime / TIMING.TOTAL_DURATION) * 100;

    return (
        <>
            {/* Trigger Button (Hero Section) */}
            <button
                onClick={handleOpen}
                className="group relative inline-flex items-center justify-center px-8 py-4 font-bold text-white transition-all duration-200 bg-blue-600 rounded-full hover:bg-blue-700 hover:scale-105 shadow-xl hover:shadow-2xl"
            >
                <span className="mr-3 text-lg">Watch Live Demo</span>
                <Play className="w-6 h-6 fill-current" />
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-teal-500"></span>
                </span>
            </button>

            {/* Fullscreen Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-sm"
                    >
                        {/* Close Button */}
                        <button
                            onClick={handleClose}
                            className="absolute top-6 right-6 z-50 p-2 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                        >
                            <X className="w-8 h-8 text-gray-600" />
                        </button>

                        {/* Main Content Container */}
                        <div className="relative w-full h-full max-w-[1920px] mx-auto flex items-center justify-center overflow-hidden">

                            {/* Left Side: Avatar & Visuals */}
                            <div className={cn(
                                "flex-1 flex flex-col items-center justify-center transition-all duration-1000",
                                isCallActive ? "translate-x-[-20%]" : "translate-x-0"
                            )}>
                                <AnnaAvatar isSpeaking={annaSpeaking} />

                                {/* Status Text Overlay */}
                                <div className="mt-12 text-center space-y-2">
                                    <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
                                        Anna
                                    </h2>
                                    <p className="text-lg text-teal-600 font-medium uppercase tracking-widest">
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
                                            className="mt-8 flex items-center gap-3 px-6 py-3 bg-red-50 text-red-600 rounded-full border border-red-100 shadow-sm"
                                        >
                                            <span className="relative flex h-3 w-3">
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                            </span>
                                            <span className="font-mono font-bold">LIVE CALL</span>
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

                        {/* Bottom Controls */}
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white/50 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/20">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={togglePlay}
                                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors"
                                >
                                    {isPlaying ? <span className="w-5 h-5 block i-lucide-pause" /> : <Play className="w-5 h-5 fill-current" />}
                                </button>

                                {/* Progress Bar */}
                                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden relative group cursor-pointer"
                                    onClick={(e) => {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        const pos = (e.clientX - rect.left) / rect.width;
                                        if (audioRef.current) audioRef.current.currentTime = pos * TIMING.TOTAL_DURATION;
                                    }}
                                >
                                    <div
                                        className="h-full bg-blue-600 transition-all duration-100 ease-linear rounded-full relative"
                                        style={{ width: `${progress}%` }}
                                    >
                                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
                                    </div>
                                </div>

                                <span className="text-sm font-mono text-gray-600 w-16 text-right">
                                    {formatTime(currentTime)}
                                </span>

                                <button
                                    onClick={handleReplay}
                                    className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                                    title="Replay"
                                >
                                    <RotateCcw className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
