'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Mic, Settings, Sparkles, Volume2, Power, Bot, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AuroraBackground } from '@/components/AuroraBackground';
import { GlassCard } from '@/components/GlassCard';
import { motion } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

// --- Types & Constants ---
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface Voice {
    id: string;
    name: string;
    gender: string;
    provider: string;
    isDefault?: boolean;
}

interface Transcript {
    id: string;
    speaker: 'user' | 'agent';
    text: string;
    isFinal: boolean;
    confidence: number;
    timestamp: Date;
}

export default function AgentConsolePage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();

    // --- Voice Agent Hook ---
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

    // --- Configuration State ---
    const [activeTab, setActiveTab] = useState<'pitch' | 'config'>('pitch');
    const [voices, setVoices] = useState<Voice[]>([]);
    const [configSaving, setConfigSaving] = useState(false);

    // Fields
    const [systemPrompt, setSystemPrompt] = useState('');
    const [firstMessage, setFirstMessage] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [language, setLanguage] = useState('en-US');
    const [maxDurationSeconds, setMaxDurationSeconds] = useState(300);

    // Validations & Loading
    const [isLoadingConfig, setIsLoadingConfig] = useState(true);

    // Transcription Display State
    const [displayTranscripts, setDisplayTranscripts] = useState<Transcript[]>([]);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // --- Effects ---

    // Auth Guard
    useEffect(() => {
        if (!authLoading && !user) router.push('/login');
    }, [user, authLoading, router]);

    // Load Config
    useEffect(() => {
        if (!user) return;
        loadConfiguration();
    }, [user]);

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

    // --- Functions ---

    async function loadConfiguration() {
        try {
            setIsLoadingConfig(true);
            const [voicesRes, agentRes] = await Promise.all([
                fetch(`${API_BASE_URL}/api/assistants/voices/available`),
                fetch(`${API_BASE_URL}/api/founder-console/agent/config`, { credentials: 'include' })
            ]);

            if (voicesRes.ok) setVoices(await voicesRes.json());

            if (agentRes.ok) {
                const config = await agentRes.json();
                if (config?.vapi) {
                    setSystemPrompt(config.vapi.systemPrompt || '');
                    setFirstMessage(config.vapi.firstMessage || '');
                    setVoiceId(config.vapi.voice || '');
                    setLanguage(config.vapi.language || 'en-US');
                    setMaxDurationSeconds(config.vapi.maxCallDuration || 300);
                }
            }
        } catch (err) {
            console.error('Failed to load config', err);
        } finally {
            setIsLoadingConfig(false);
        }
    }

    async function saveConfig() {
        setConfigSaving(true);
        try {
            const payload = {
                systemPrompt,
                firstMessage,
                voiceId,
                language,
                maxDurationSeconds
            };

            const response = await fetch(`${API_BASE_URL}/api/founder-console/agent/behavior`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.error || 'Failed to save configuration');
            }

            console.log('Configuration saved successfully');
        } catch (err) {
            console.error('Save failed', err);
        } finally {
            setConfigSaving(false);
        }
    }

    const handleToggleCall = async () => {
        if (isConnected) {
            stopRecording();
            await stopCall();
        } else {
            await startCall();
            setTimeout(startRecording, 500);
        }
    };

    if (authLoading || isLoadingConfig) {
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
                        <button onClick={() => router.push('/dashboard')} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-6 h-6 text-white" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <Sparkles className="w-6 h-6 text-emerald-400" />
                                Agent Console
                            </h1>
                            <p className="text-sm text-slate-400">Configure & Test your AI Receptionist</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isConnected ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>
                            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-xs font-bold uppercase">{isConnected ? 'Live' : 'Offline'}</span>
                        </div>
                        <button
                            onClick={saveConfig}
                            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-sm font-semibold transition-all flex items-center gap-2"
                        >
                            {configSaving ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                            Save Changes
                        </button>
                    </div>
                </header>

                {/* Main Split Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-[600px]">

                    {/* LEFT PANEL: Configuration (Pitch & Settings) */}
                    <div className="lg:col-span-5 flex flex-col gap-6">
                        <GlassCard className="flex-1 flex flex-col !p-0 overflow-hidden">
                            <div className="flex border-b border-white/10">
                                <button
                                    onClick={() => setActiveTab('pitch')}
                                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'pitch' ? 'bg-white/5 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Bot className="w-4 h-4" />
                                    Core Pitch
                                </button>
                                <button
                                    onClick={() => setActiveTab('config')}
                                    className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'config' ? 'bg-white/5 text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}
                                >
                                    <Settings className="w-4 h-4" />
                                    Configuration
                                </button>
                            </div>

                            <div className="p-6 flex-1 flex flex-col">
                                {activeTab === 'pitch' ? (
                                    <div className="flex-1 flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-semibold text-slate-300">System Prompt / Sales Pitch</label>
                                            <span className="text-xs text-slate-500">This defines how your agent behaves.</span>
                                        </div>
                                        <textarea
                                            value={systemPrompt}
                                            onChange={(e) => setSystemPrompt(e.target.value)}
                                            className="flex-1 w-full bg-slate-900/50 border border-white/10 rounded-xl p-4 text-sm font-mono text-slate-300 focus:outline-none focus:border-emerald-500/50 resize-none"
                                            placeholder="You are a helpful assistant..."
                                        />
                                    </div>
                                ) : (
                                    <div className="space-y-6 overflow-y-auto max-h-[500px] pr-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                                <Volume2 className="w-4 h-4 text-purple-400" /> Voice
                                            </label>
                                            <select
                                                value={voiceId}
                                                onChange={(e) => setVoiceId(e.target.value)}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                            >
                                                <option value="">Select a voice...</option>
                                                {voices.map(v => (
                                                    <option key={v.id} value={v.id}>{v.name} ({v.gender})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-300">Language</label>
                                            <select
                                                value={language}
                                                onChange={(e) => setLanguage(e.target.value)}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                            >
                                                <option value="en-US">English (US)</option>
                                                <option value="en-GB">English (UK)</option>
                                                <option value="es-ES">Spanish (Spain)</option>
                                                <option value="es-MX">Spanish (Mexico)</option>
                                                <option value="fr-FR">French</option>
                                                <option value="de-DE">German</option>
                                                <option value="it-IT">Italian</option>
                                                <option value="pt-BR">Portuguese (Brazil)</option>
                                                <option value="pt-PT">Portuguese (Portugal)</option>
                                                <option value="nl-NL">Dutch</option>
                                                <option value="pl-PL">Polish</option>
                                                <option value="ru-RU">Russian</option>
                                                <option value="ja-JP">Japanese</option>
                                                <option value="zh-CN">Chinese (Simplified)</option>
                                                <option value="zh-TW">Chinese (Traditional)</option>
                                                <option value="ko-KR">Korean</option>
                                                <option value="ar-SA">Arabic</option>
                                                <option value="hi-IN">Hindi</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-300">First Message</label>
                                            <textarea
                                                value={firstMessage}
                                                onChange={(e) => setFirstMessage(e.target.value)}
                                                placeholder="What the agent says when answering..."
                                                rows={3}
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 resize-none"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-slate-300">Max Call Duration (seconds)</label>
                                            <input
                                                type="number"
                                                value={maxDurationSeconds}
                                                onChange={(e) => setMaxDurationSeconds(parseInt(e.target.value) || 300)}
                                                min="60"
                                                max="3600"
                                                className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50"
                                            />
                                            <p className="text-xs text-slate-500">60-3600 seconds (1 min - 1 hour)</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </GlassCard>
                    </div>

                    {/* RIGHT PANEL: Live Test & Transcription */}
                    <div className="lg:col-span-7 flex flex-col gap-6">
                        <GlassCard className="flex-1 flex flex-col relative overflow-hidden !p-0">
                            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 opacity-80" />

                            {/* Transcription Area */}
                            <div className="relative z-10 flex-1 overflow-y-auto p-6 space-y-4 min-h-[400px]">
                                {displayTranscripts.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4 opacity-50">
                                        <Mic className="w-12 h-12" />
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
                                                {!t.isFinal && <span className="text-xs opacity-50 mt-2 block animate-pulse">...typing</span>}
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
                                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-xl hover:scale-105 active:scale-95 ${isConnected
                                            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30'
                                            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30'
                                            }`}
                                    >
                                        {isConnected ? <Power className="w-8 h-8 text-white" /> : <Mic className="w-8 h-8 text-white" />}
                                    </button>
                                </div>
                                <p className="text-center text-xs text-slate-500 mt-4 font-mono">
                                    {isConnected ? 'LIVE SESSION ACTIVE' : 'READY TO START'}
                                </p>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            </div >
        </AuroraBackground >
    );
}
