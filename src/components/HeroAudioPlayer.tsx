"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2, User, Mic } from "lucide-react";

export default function HeroAudioPlayer({ audioSrc = "/audio/hero_conversation.mp3" }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            const current = audioRef.current.currentTime;
            const duration = audioRef.current.duration || 1;
            setProgress((current / duration) * 100);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setProgress(0);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="w-full max-w-2xl mx-auto mb-10"
        >
            <div className="relative overflow-hidden rounded-3xl bg-slate-900/40 backdrop-blur-xl border border-white/10 shadow-2xl">
                {/* Glow Effects */}
                <div className={`absolute top-0 left-1/4 w-32 h-32 bg-cyan-500/20 rounded-full blur-[50px] transition-opacity duration-700 ${isPlaying ? "opacity-100 animate-pulse" : "opacity-30"}`} />
                <div className={`absolute bottom-0 right-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] transition-opacity duration-700 ${isPlaying ? "opacity-100 animate-pulse delay-75" : "opacity-30"}`} />

                <div className="relative p-6 px-8 flex flex-col md:flex-row items-center gap-6">

                    {/* Play Button */}
                    <button
                        onClick={togglePlay}
                        className={`
                            relative group flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300
                            ${isPlaying
                                ? "bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                                : "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                            }
                        `}
                    >
                        {isPlaying ? (
                            <Pause className="w-6 h-6 fill-current" />
                        ) : (
                            <Play className="w-6 h-6 fill-current ml-1" />
                        )}

                        {/* Ring Ripple Animation when paused */}
                        {!isPlaying && (
                            <span className="absolute inset-0 rounded-full border border-white/30 animate-ping opacity-75" />
                        )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 w-full text-center md:text-left">
                        <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                Audio Evidence
                            </span>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Volume2 className="w-3 h-3" />
                                Listen to the conversation
                            </span>
                        </div>

                        <h3 className="text-white font-semibold text-lg leading-tight mb-1">
                            "Can you actually stop the bleeding?"
                        </h3>
                        <p className="text-sm text-slate-400">
                            Hear Roxanne handle a skeptic clinic owner in real-time.
                        </p>

                        {/* Progress Bar */}
                        <div className="mt-4 h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    </div>

                    {/* Avatar Visuals */}
                    <div className="hidden md:flex items-center gap-[-10px]">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center z-10 text-slate-400">
                            <User className="w-5 h-5" />
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 border-2 border-slate-900 flex items-center justify-center z-20 shadow-lg -ml-4">
                            <Mic className="w-5 h-5 text-white" />
                        </div>
                    </div>
                </div>

                <audio
                    ref={audioRef}
                    src={audioSrc}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleEnded}
                    className="hidden"
                />
            </div>
        </motion.div>
    );
}
