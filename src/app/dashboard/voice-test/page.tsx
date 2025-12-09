"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { VoiceControls } from '@/components/voice/VoiceControls';
import { TranscriptDisplay } from '@/components/voice/TranscriptDisplay';

export default function VoiceTestPage() {
    const router = useRouter();
    const [callStarted, setCallStarted] = useState(false);

    const {
        isConnected,
        isRecording,
        isSpeaking,
        transcripts,
        error,
        connect,
        disconnect,
        startRecording,
        stopRecording,
    } = useVoiceAgent({
        onConnected: () => {
            console.log('✅ Connected to voice agent');
        },
        onDisconnected: () => {
            console.log('🔌 Disconnected from voice agent');
            setCallStarted(false);
        },
        onError: (err) => {
            console.error('❌ Voice agent error:', err);
        },
    });

    const handleStartCall = async () => {
        try {
            await connect();
            setCallStarted(true);
            // Auto-start recording after connection
            setTimeout(async () => {
                await startRecording();
            }, 1000);
        } catch (error) {
            console.error('Failed to start call:', error);
        }
    };

    const handleEndCall = () => {
        disconnect();
        setCallStarted(false);
    };

    const toggleRecording = async () => {
        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    };

    return (
        <div className="h-screen bg-slate-950 flex flex-col overflow-hidden">
            {/* Header - Minimal & Centered */}
            <div className="flex-shrink-0 p-4 flex justify-between items-center max-w-2xl mx-auto w-full z-30">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                    aria-label="Back to Dashboard"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <h1 className="text-sm font-medium text-slate-300">Roxanne AI</h1>

                <div className="w-9" /> {/* Spacer for balance */}
            </div>

            {/* Main Content Container - Centered */}
            <div className="flex-1 flex flex-col w-full max-w-2xl mx-auto relative min-h-0">

                {/* Error Banner */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="absolute top-0 left-4 right-4 z-20"
                        >
                            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-3 flex items-center gap-3 justify-center backdrop-blur-md">
                                <AlertCircle className="w-4 h-4 text-red-400" />
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Chat/Transcript Area - Flexible Height with proper padding for mobile */}
                <div className="flex-1 overflow-hidden relative min-h-0">
                    {/* Gradient Overlay Top */}
                    <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-slate-950 to-transparent z-10 pointer-events-none" />

                    <TranscriptDisplay
                        transcripts={transcripts}
                        isSpeaking={isSpeaking}
                        className="h-full pt-4 pb-32" // Extra bottom padding for mobile controls
                    />

                    {/* Gradient Overlay Bottom - taller for mobile */}
                    <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent z-10 pointer-events-none" />
                </div>
            </div>

            {/* Bottom Controls Area - FIXED at bottom for mobile */}
            <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/50 z-40 pb-safe">
                <div className="w-full max-w-2xl mx-auto px-4 py-4">
                    {!callStarted ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <button
                                onClick={handleStartCall}
                                className="inline-flex items-center justify-center gap-3 px-8 py-4 bg-white text-slate-950 rounded-full hover:scale-105 transition-all font-semibold text-lg shadow-xl shadow-white/10"
                            >
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                Start Conversation
                            </button>
                            <p className="mt-3 text-slate-500 text-sm">
                                Tap to start speaking with Roxanne
                            </p>
                        </motion.div>
                    ) : (
                        <VoiceControls
                            isConnected={isConnected}
                            isRecording={isRecording}
                            isSpeaking={isSpeaking}
                            onToggleRecording={toggleRecording}
                            onEndCall={handleEndCall}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
