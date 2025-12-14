"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Loader2, PhoneOff, Video } from 'lucide-react';

interface VoiceControlsProps {
    isConnected: boolean;
    isRecording: boolean;
    isSpeaking: boolean;
    onToggleRecording: () => void;
    onEndCall: () => void; // New prop for end call
    className?: string;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
    isConnected,
    isRecording,
    isSpeaking,
    onToggleRecording,
    onEndCall,
    className = '',
}) => {
    // Determine status text
    const getStatusText = () => {
        if (!isConnected) return 'Connecting...';
        if (isSpeaking) return 'Voxanne is speaking...';
        if (isRecording) return 'Listening...';
        return 'Mic Muted';
    };

    return (
        <div className={`flex flex-col items-center gap-6 w-full max-w-md mx-auto ${className}`}>

            {/* Status Text (Floating above controls) */}
            <motion.p
                key={getStatusText()}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm font-medium transition-colors duration-300 ${isSpeaking ? 'text-cyan-400' :
                    isRecording ? 'text-white' : 'text-slate-400'
                    }`}
            >
                {getStatusText()}
            </motion.p>

            {/* Main Control Bar */}
            <div className="flex items-center justify-center gap-6 px-8 py-4 bg-slate-800/80 backdrop-blur-md border border-slate-700/50 rounded-full shadow-2xl">

                {/* 1. Mute/Unmute (Secondary Button) */}
                <motion.button
                    onClick={onToggleRecording}
                    disabled={!isConnected}
                    className={`
                        p-4 rounded-full transition-all duration-200
                        ${!isRecording
                            ? 'bg-slate-700 text-white hover:bg-slate-600'
                            : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700'
                        }
                    `}
                    title="Toggle Mute"
                    whileTap={{ scale: 0.95 }}
                >
                    {isRecording ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </motion.button>

                {/* 2. Visualizer / Main Indicator (Central Element) */}
                <div className="relative">
                    {/* Pulsing rings when recording */}
                    {/* Pulsing rings - Color matches state */}
                    {(isRecording || isSpeaking) && (
                        <motion.div
                            className={`absolute inset-0 rounded-full ${isSpeaking ? 'bg-cyan-500/20' : 'bg-green-500/20'}`}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            style={{ width: '100%', height: '100%', padding: '20px', margin: '-20px' }}
                        />
                    )}

                    {/* Central Status Icon */}
                    <div className={`
                        w-16 h-16 rounded-full flex items-center justify-center shadow-lg transition-all duration-500
                        ${isSpeaking
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-600 shadow-cyan-500/50 scale-110'
                            : isRecording
                                ? 'bg-gradient-to-br from-green-500 to-emerald-600 shadow-green-500/30'
                                : 'bg-slate-700'
                        }
                    `}>
                        {!isConnected ? (
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                        ) : isSpeaking ? (
                            <div className="flex gap-1 items-end h-6">
                                {[...Array(3)].map((_, i) => (
                                    <motion.div
                                        key={i}
                                        className="w-1.5 bg-white rounded-full"
                                        animate={{ height: ['8px', '24px', '8px'] }}
                                        transition={{
                                            duration: 0.8,
                                            repeat: Infinity,
                                            delay: i * 0.15,
                                            ease: "easeInOut",
                                        }}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="w-3 h-3 rounded-full bg-white" /> // Simple "On" dot
                        )}
                    </div>
                </div>

                {/* 3. End Call (Secondary Button - Dangerous) */}
                <motion.button
                    onClick={onEndCall}
                    className="p-4 rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200 border border-red-500/20"
                    title="End Call"
                    whileTap={{ scale: 0.95 }}
                >
                    <PhoneOff className="w-6 h-6" />
                </motion.button>
            </div>
        </div>
    );
};
