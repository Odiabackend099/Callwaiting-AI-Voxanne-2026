'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mic, MicOff, Power, AlertCircle, Loader2, Volume2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { motion } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

interface Transcript {
    id: string;
    speaker: 'user' | 'agent';
    text: string;
    isFinal: boolean;
    confidence: number;
    timestamp: Date;
}

export default function VoiceTestPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    const {
        isConnected,
        isRecording,
        transcripts,
        error: voiceError,
        startCall,
        stopCall,
        startRecording,
        stopRecording
    } = useVoiceAgent();

    const [displayTranscripts, setDisplayTranscripts] = useState<Transcript[]>([]);
    const [callInitiating, setCallInitiating] = useState(false);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auth Guard
    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading, router]);

    // Sync Transcripts
    useEffect(() => {
        if (transcripts && transcripts.length > 0) {
            setDisplayTranscripts(
                transcripts.map((t, idx) => ({
                    id: `${idx}-${t.timestamp.getTime()}`,
                    speaker: t.speaker,
                    text: t.text,
                    isFinal: t.isFinal,
                    confidence: t.confidence || 0.95,
                    timestamp: t.timestamp
                }))
            );
        }
    }, [transcripts]);

    // Auto-scroll
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [displayTranscripts]);

    const handleToggleCall = async () => {
        if (isConnected) {
            stopRecording();
            await stopCall();
        } else {
            setCallInitiating(true);
            try {
                await startCall();
                // Wait for WebSocket to be ready before starting recording
                await new Promise(resolve => setTimeout(resolve, 1000));
                startRecording();
            } catch (err) {
                console.error('Failed to start call', err);
            } finally {
                setCallInitiating(false);
            }
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <AuroraBackground>
            <div className="min-h-screen w-full relative z-10 p-6 flex flex-col pointer-events-auto overflow-y-auto">
                {/* Header */}
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.push('/dashboard/settings')} 
                            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Mic className="w-6 h-6 text-emerald-400" />
                                Voice Test
                            </h1>
                            <p className="text-sm text-slate-400">Real-time transcription with voice activity detection</p>
                        </div>
                    </div>

                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isConnected ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="text-xs font-bold uppercase">{isConnected ? 'Live' : 'Offline'}</span>
                    </div>
                </header>

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-6">
                    {/* Transcription Area */}
                    <GlassCard className="flex-1 flex flex-col relative overflow-hidden !p-0">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 opacity-80" />

                        {/* Transcription Display */}
                        <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px]">
                            {displayTranscripts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                                    <Volume2 className="w-12 h-12" />
                                    <p>Start a call to see live transcription...</p>
                                </div>
                            ) : (
                                displayTranscripts.map((t) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        key={t.id}
                                        className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`max-w-[80%] rounded-2xl p-4 ${t.speaker === 'user'
                                            ? 'bg-emerald-500/20 text-emerald-50 rounded-tr-none border border-emerald-500/20'
                                            : 'bg-indigo-500/20 text-indigo-50 rounded-tl-none border border-indigo-500/20'
                                            }`}>
                                            <p className="text-xs font-bold mb-1 opacity-50 uppercase">{t.speaker === 'user' ? 'You' : 'Agent'}</p>
                                            <p className="leading-relaxed">{t.text}</p>
                                            <div className="flex items-center justify-between mt-2 gap-2">
                                                {!t.isFinal && <span className="text-xs opacity-50 animate-pulse">...typing</span>}
                                                <span className="text-xs opacity-50 ml-auto">
                                                    {Math.round(t.confidence * 100)}%
                                                </span>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                            <div ref={transcriptEndRef} />
                        </div>

                        {/* Bottom Controls */}
                        <div className="relative z-10 p-6 border-t border-white/10 bg-slate-900/50 backdrop-blur-md">
                            {voiceError && (
                                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-200">
                                    <AlertCircle className="w-4 h-4" />
                                    {voiceError}
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-6">
                                <button
                                    onClick={handleToggleCall}
                                    disabled={callInitiating}
                                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isConnected
                                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                                        : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                                        }`}
                                >
                                    {callInitiating ? (
                                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                                    ) : isConnected ? (
                                        <Power className="w-8 h-8 text-white" />
                                    ) : (
                                        <Mic className="w-8 h-8 text-white" />
                                    )}
                                </button>
                            </div>
                            <p className="text-center text-xs text-slate-500 mt-4 font-mono">
                                {isConnected ? 'LIVE SESSION ACTIVE' : callInitiating ? 'CONNECTING...' : 'READY TO START'}
                            </p>
                        </div>
                    </GlassCard>
                </div>
            </div>
        </AuroraBackground>
    );
}
