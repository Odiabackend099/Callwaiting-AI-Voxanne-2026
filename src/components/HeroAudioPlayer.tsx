"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Play, Pause, Volume2 } from "lucide-react";

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
            className="w-full max-w-2xl mx-auto mb-10 flex flex-col md:flex-row items-center gap-5"
        >
            {/* Play Button */}
            <button
                onClick={togglePlay}
                className={`
                    relative group flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300
                    ${isPlaying
                        ? "bg-cyan-500 text-white shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                        : "bg-white text-black hover:scale-105 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
                    }
                `}
            >
                {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
            </button>

            {/* Content */}
            <div className="flex-1 text-center md:text-left">
                <p className="text-white font-medium text-base mb-1">
                    Hear CALL WAITING AI LTD handle a skeptic clinic owner
                </p>
                <p className="text-sm text-slate-500">
                    Real conversation • 45 seconds
                </p>
                
                {/* Progress Bar */}
                <div className="mt-3 h-1 w-full max-w-xs mx-auto md:mx-0 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            <audio
                ref={audioRef}
                src={audioSrc}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleEnded}
                className="hidden"
            />
        </motion.div>
    );
}
