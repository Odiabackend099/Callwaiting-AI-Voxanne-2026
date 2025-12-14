'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Activity, Mic, Power, AlertCircle, Loader2, Volume2, Settings, LogOut, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

// Navigation Component
function DashboardNav() {
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuth();

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: Activity },
        { label: 'Voice Test', href: '/dashboard/voice-test', icon: Mic },
        { label: 'Settings', href: '/dashboard/settings', icon: Settings }
    ];

    return (
        <nav className="bg-white border-b border-gray-200 shadow-sm">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                                <Phone className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-xl font-bold text-gray-900">Voxanne</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {navItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = pathname === item.href;
                                return (
                                    <button
                                        key={item.href}
                                        onClick={() => router.push(item.href)}
                                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-all font-medium ${
                                            isActive
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-sm">
                            <p className="font-medium text-gray-900">{user?.email}</p>
                            <p className="text-gray-500">Account</p>
                        </div>
                        <button
                            onClick={() => {
                                logout();
                                router.push('/login');
                            }}
                            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}

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
        <>
            <DashboardNav />
            <div className="min-h-screen bg-white">
                <div className="max-w-7xl mx-auto px-6 py-8 pb-32">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Voice Test</h1>
                        <p className="text-gray-600">Real-time transcription with voice activity detection</p>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col gap-6">
                        {/* Transcription Area */}
                        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
                            {/* Transcription Display */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-4 bg-gray-50">
                                {displayTranscripts.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                        <Volume2 className="w-12 h-12" />
                                        <p className="text-lg font-medium">Start a call to see live transcription...</p>
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
                                                ? 'bg-emerald-50 text-emerald-900 rounded-tr-none border border-emerald-200'
                                                : 'bg-cyan-50 text-cyan-900 rounded-tl-none border border-cyan-200'
                                                }`}>
                                                <p className="text-xs font-bold mb-1 opacity-60 uppercase">{t.speaker === 'user' ? 'You' : 'Agent'}</p>
                                                <p className="leading-relaxed text-sm">{t.text}</p>
                                                <div className="flex items-center justify-between mt-2 gap-2">
                                                    {!t.isFinal && <span className="text-xs opacity-60 animate-pulse">...typing</span>}
                                                    <span className="text-xs opacity-60 ml-auto">
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
                            <div className="p-8 border-t border-gray-200 bg-white">
                                {voiceError && (
                                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-sm text-red-700">
                                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                        {voiceError}
                                    </div>
                                )}

                                <div className="flex items-center justify-center gap-6">
                                    <button
                                        onClick={handleToggleCall}
                                        disabled={callInitiating}
                                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white ${isConnected
                                            ? 'bg-red-500 hover:bg-red-600 shadow-red-200'
                                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200'
                                            }`}
                                    >
                                        {callInitiating ? (
                                            <Loader2 className="w-8 h-8 animate-spin" />
                                        ) : isConnected ? (
                                            <Power className="w-8 h-8" />
                                        ) : (
                                            <Mic className="w-8 h-8" />
                                        )}
                                    </button>
                                </div>
                                <p className="text-center text-sm text-gray-600 mt-6 font-mono font-semibold">
                                    {isConnected ? 'LIVE SESSION ACTIVE' : callInitiating ? 'CONNECTING...' : 'READY TO START'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
