"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, AlertCircle, Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

export default function VoiceTestPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [callStarted, setCallStarted] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Auth guard
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

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
            setIsConnecting(false);
        },
        onDisconnected: () => {
            console.log('🔌 Disconnected from voice agent');
            setCallStarted(false);
            setIsConnecting(false);
        },
        onError: (err) => {
            console.error('❌ Voice agent error:', err);
            setIsConnecting(false);
        },
    });

    // Auto-scroll to latest transcript
    useEffect(() => {
        if (transcriptEndRef.current) {
            transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [transcripts]);

    const handleStartCall = async () => {
        try {
            setIsConnecting(true);
            await connect();
            setCallStarted(true);
            // Auto-start recording after connection
            setTimeout(async () => {
                await startRecording();
            }, 500);
        } catch (error) {
            console.error('Failed to start call:', error);
            setIsConnecting(false);
        }
    };

    const handleEndCall = () => {
        stopRecording();
        disconnect();
        setCallStarted(false);
    };

    const toggleMute = async () => {
        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-b border-white/10">
                <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        <span className="text-sm font-medium">Back</span>
                    </button>
                    
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                            <span className="text-white text-sm font-bold">V</span>
                        </div>
                        <div>
                            <h1 className="text-white font-semibold">Voxanne</h1>
                            <p className="text-xs text-slate-400">AI Voice Assistant</p>
                        </div>
                    </div>
                    
                    <div className="w-16" /> {/* Spacer */}
                </div>
            </header>

            {/* Main Content */}
            <main className="pt-24 pb-40 px-4 max-w-4xl mx-auto">
                {/* Error Banner */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="mb-6"
                        >
                            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3">
                                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <p className="text-red-300 text-sm">{error}</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Conversation Area */}
                <div className="min-h-[60vh] flex flex-col">
                    {transcripts.length === 0 ? (
                        /* Empty State */
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex flex-col items-center justify-center text-center py-20"
                        >
                            {/* Animated Avatar */}
                            <motion.div 
                                className={`relative mb-8 ${
                                    callStarted && isSpeaking ? 'animate-pulse' : ''
                                }`}
                            >
                                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/20">
                                    <span className="text-white text-5xl font-bold">V</span>
                                </div>
                                {callStarted && (
                                    <motion.div
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-green-500 flex items-center justify-center border-4 border-slate-900"
                                    >
                                        {isSpeaking ? (
                                            <Volume2 className="w-5 h-5 text-white animate-pulse" />
                                        ) : isRecording ? (
                                            <Mic className="w-5 h-5 text-white" />
                                        ) : (
                                            <Phone className="w-4 h-4 text-white" />
                                        )}
                                    </motion.div>
                                )}
                            </motion.div>

                            <h2 className="text-2xl font-bold text-white mb-3">
                                {callStarted 
                                    ? isSpeaking 
                                        ? "Voxanne is speaking..." 
                                        : isRecording 
                                            ? "Listening..." 
                                            : "Connected"
                                    : "Talk to Voxanne"
                                }
                            </h2>
                            <p className="text-slate-400 max-w-md">
                                {callStarted 
                                    ? "Speak naturally. Voxanne will respond in real-time."
                                    : "Experience our AI voice receptionist. Click below to start a conversation."
                                }
                            </p>

                            {/* Features List - Only show when not in call */}
                            {!callStarted && (
                                <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
                                    {[
                                        { icon: "🎯", title: "Natural Speech", desc: "Just talk normally" },
                                        { icon: "⚡", title: "Real-time", desc: "Instant responses" },
                                        { icon: "🔒", title: "Private", desc: "Secure connection" },
                                    ].map((feature, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: 0.1 * i }}
                                            className="bg-white/5 rounded-2xl p-4 text-center border border-white/5"
                                        >
                                            <div className="text-2xl mb-2">{feature.icon}</div>
                                            <div className="text-white font-medium text-sm">{feature.title}</div>
                                            <div className="text-slate-500 text-xs">{feature.desc}</div>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        /* Transcript Messages */
                        <div className="space-y-4 py-4">
                            {transcripts.map((msg, index) => (
                                <motion.div
                                    key={msg.id || index}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`flex ${
                                        msg.speaker === 'agent' ? 'justify-start' : 'justify-end'
                                    }`}
                                >
                                    <div
                                        className={`max-w-[80%] rounded-2xl px-5 py-3 ${
                                            msg.speaker === 'agent'
                                                ? 'bg-gradient-to-br from-cyan-600/80 to-blue-600/80 text-white'
                                                : 'bg-white/10 text-white border border-white/10'
                                        }`}
                                    >
                                        <p className="text-sm leading-relaxed">{msg.text}</p>
                                        <p className={`text-xs mt-1 ${
                                            msg.speaker === 'agent' ? 'text-cyan-200' : 'text-slate-500'
                                        }`}>
                                            {msg.speaker === 'agent' ? 'Voxanne' : 'You'}
                                        </p>
                                    </div>
                                </motion.div>
                            ))}
                            
                            {/* Speaking Indicator */}
                            {isSpeaking && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex justify-start"
                                >
                                    <div className="bg-cyan-600/50 rounded-2xl px-5 py-3 flex items-center gap-2">
                                        <div className="flex gap-1">
                                            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                            <span className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                        </div>
                                        <span className="text-cyan-200 text-sm">Voxanne is speaking...</span>
                                    </div>
                                </motion.div>
                            )}
                            
                            {/* Auto-scroll anchor */}
                            <div ref={transcriptEndRef} />
                        </div>
                    )}
                </div>
            </main>

            {/* Bottom Controls */}
            <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/95 to-transparent pt-10 pb-8 px-4">
                <div className="max-w-md mx-auto">
                    {!callStarted ? (
                        /* Start Button */
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center"
                        >
                            <button
                                onClick={handleStartCall}
                                disabled={isConnecting}
                                className="group relative inline-flex items-center justify-center gap-3 px-10 py-5 bg-white text-black rounded-full font-semibold text-lg shadow-2xl shadow-white/20 hover:bg-slate-100 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {isConnecting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Connecting...
                                    </>
                                ) : (
                                    <>
                                        <Phone className="w-5 h-5" />
                                        Start Conversation
                                    </>
                                )}
                                
                                {/* Glow effect */}
                                <div className="absolute inset-0 rounded-full bg-white blur-xl opacity-30 group-hover:opacity-50 transition-opacity -z-10" />
                            </button>
                            <p className="mt-4 text-slate-500 text-sm">
                                Click to start talking with Voxanne
                            </p>
                        </motion.div>
                    ) : (
                        /* In-Call Controls */
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-center gap-6"
                        >
                            {/* Mute Button */}
                            <button
                                onClick={toggleMute}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                                    isRecording
                                        ? 'bg-white/10 text-white hover:bg-white/20'
                                        : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                }`}
                            >
                                {isRecording ? (
                                    <Mic className="w-7 h-7" />
                                ) : (
                                    <MicOff className="w-7 h-7" />
                                )}
                            </button>

                            {/* End Call Button */}
                            <button
                                onClick={handleEndCall}
                                className="w-20 h-20 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-2xl shadow-red-500/30 hover:scale-105 transition-all"
                            >
                                <PhoneOff className="w-8 h-8" />
                            </button>

                            {/* Speaker Indicator */}
                            <div
                                className={`w-16 h-16 rounded-full flex items-center justify-center ${
                                    isSpeaking
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-white/5 text-slate-500'
                                }`}
                            >
                                <Volume2 className={`w-7 h-7 ${isSpeaking ? 'animate-pulse' : ''}`} />
                            </div>
                        </motion.div>
                    )}

                    {/* Connection Status */}
                    {callStarted && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 text-center"
                        >
                            <div className="inline-flex items-center gap-2 text-sm">
                                <span className={`w-2 h-2 rounded-full ${
                                    isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                                }`} />
                                <span className="text-slate-400">
                                    {isConnected ? 'Connected' : 'Reconnecting...'}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    );
}
