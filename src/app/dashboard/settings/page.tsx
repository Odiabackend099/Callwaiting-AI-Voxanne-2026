'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Key, Bot, Phone, Save, Check, X, Eye, EyeOff, AlertCircle, Loader2, Mic, LogOut, ChevronRight, Volume2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// Left Sidebar Navigation
function LeftSidebar() {
    const router = useRouter();
    const { user, logout } = useAuth();

    const navItems = [
        { label: 'Dashboard', href: '/dashboard', icon: Phone },
        { label: 'Agent Config', href: '/dashboard/settings', icon: Bot },
    ];

    return (
        <div className="fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-200 flex flex-col">
            {/* Logo */}
            <div className="p-6 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                        <Phone className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl font-bold text-gray-900">Voxanne</span>
                </div>
            </div>

            {/* Navigation Items */}
            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.href === '/dashboard/settings';
                    return (
                        <button
                            key={item.href}
                            onClick={() => router.push(item.href)}
                            className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-all font-medium text-left ${
                                isActive
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <Icon className="w-5 h-5" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* User Section */}
            <div className="p-4 border-t border-gray-200 space-y-3">
                <div className="px-4 py-3 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                    <p className="text-xs text-gray-500">Account</p>
                </div>
                <button
                    onClick={() => {
                        logout();
                        router.push('/login');
                    }}
                    className="w-full px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium"
                >
                    <LogOut className="w-5 h-5" />
                    Logout
                </button>
            </div>
        </div>
    );
}

// Right Voice Test Panel
function VoiceTestPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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

    const [displayTranscripts, setDisplayTranscripts] = useState<any[]>([]);
    const [callInitiating, setCallInitiating] = useState(false);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // Sync Transcripts
    useEffect(() => {
        if (transcripts && transcripts.length > 0) {
            setDisplayTranscripts(
                transcripts.map((t: any, idx: number) => ({
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
                await new Promise(resolve => setTimeout(resolve, 1000));
                startRecording();
            } catch (err) {
                console.error('Failed to start call', err);
            } finally {
                setCallInitiating(false);
            }
        }
    };

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: isOpen ? 0 : '100%' }}
                transition={{ type: 'spring', damping: 20 }}
                className="fixed right-0 top-0 h-screen w-96 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl"
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Voice Test</h2>
                        <p className="text-sm text-gray-600">Real-time transcription</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Status Indicator */}
                <div className="px-6 pt-4">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-full border w-fit ${
                        isConnected
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-gray-100 border-gray-200 text-gray-600'
                    }`}>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        <span className="text-xs font-bold uppercase">{isConnected ? 'Live' : 'Offline'}</span>
                    </div>
                </div>

                {/* Transcription Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-gray-50">
                    {displayTranscripts.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                            <Volume2 className="w-8 h-8" />
                            <p className="text-sm">Start a call to see transcription...</p>
                        </div>
                    ) : (
                        displayTranscripts.map((t: any) => (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={t.id}
                                className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-lg p-3 text-sm ${
                                    t.speaker === 'user'
                                        ? 'bg-emerald-50 text-emerald-900 rounded-tr-none border border-emerald-200'
                                        : 'bg-cyan-50 text-cyan-900 rounded-tl-none border border-cyan-200'
                                }`}>
                                    <p className="text-xs font-bold mb-1 opacity-60 uppercase">{t.speaker === 'user' ? 'You' : 'Agent'}</p>
                                    <p className="leading-relaxed">{t.text}</p>
                                    <div className="flex items-center justify-between mt-1 gap-2">
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

                {/* Controls */}
                <div className="p-6 border-t border-gray-200 bg-white space-y-4">
                    {voiceError && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {voiceError}
                        </div>
                    )}

                    <button
                        onClick={handleToggleCall}
                        disabled={callInitiating}
                        className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all font-semibold text-white ${
                            isConnected
                                ? 'bg-red-500 hover:bg-red-600'
                                : 'bg-emerald-500 hover:bg-emerald-600'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                        {callInitiating ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Connecting...
                            </>
                        ) : isConnected ? (
                            <>
                                <Phone className="w-5 h-5" />
                                End Call
                            </>
                        ) : (
                            <>
                                <Mic className="w-5 h-5" />
                                Start Call
                            </>
                        )}
                    </button>

                    <p className="text-center text-xs text-gray-600 font-mono">
                        {isConnected ? 'SESSION ACTIVE' : callInitiating ? 'CONNECTING...' : 'READY'}
                    </p>
                </div>
            </motion.div>
        </>
    );
}

// Main Settings Page
export default function SettingsPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [activeTab, setActiveTab] = useState('api-keys');
    const [voicePanelOpen, setVoicePanelOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [globalSaving, setGlobalSaving] = useState(false);
    const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

    // API Key States
    const [vapiKey, setVapiKey] = useState({ value: '', originalValue: '', saving: false, saved: false, error: null as string | null });
    const [twilioKey, setTwilioKey] = useState({ value: '', originalValue: '', saving: false, saved: false, error: null as string | null });
    const [vapiConfigured, setVapiConfigured] = useState(false);

    // Agent Config States
    const [systemPrompt, setSystemPrompt] = useState({ value: '', originalValue: '', saving: false, saved: false, error: null as string | null });
    const [firstMessage, setFirstMessage] = useState({ value: '', originalValue: '', saving: false, saved: false, error: null as string | null });
    const [voiceId, setVoiceId] = useState({ value: '', originalValue: '', saving: false, saved: false, error: null as string | null });
    const [language, setLanguage] = useState({ value: 'en-US', originalValue: 'en-US', saving: false, saved: false, error: null as string | null });
    const [maxSeconds, setMaxSeconds] = useState({ value: '300', originalValue: '300', saving: false, saved: false, error: null as string | null });
    const [outboundNumber, setOutboundNumber] = useState('');
    const [voices, setVoices] = useState<any[]>([]);

    // Auth Guard
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    // Load Settings
    useEffect(() => {
        async function loadSettings() {
            if (!user) return;
            try {
                setLoading(true);
                const [voicesRes, agentRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/assistants/voices/available`),
                    fetch(`${API_BASE_URL}/api/founder-console/agent/config`, { credentials: 'include' })
                ]);

                if (voicesRes.ok) {
                    setVoices(await voicesRes.json());
                }

                if (agentRes.ok) {
                    const config = await agentRes.json();
                    if (config?.vapi) {
                        setSystemPrompt(prev => ({
                            ...prev,
                            value: config.vapi.systemPrompt || '',
                            originalValue: config.vapi.systemPrompt || ''
                        }));
                        setFirstMessage(prev => ({
                            ...prev,
                            value: config.vapi.firstMessage || '',
                            originalValue: config.vapi.firstMessage || ''
                        }));
                        setVoiceId(prev => ({
                            ...prev,
                            value: config.vapi.voice || '',
                            originalValue: config.vapi.voice || ''
                        }));
                        setLanguage(prev => ({
                            ...prev,
                            value: config.vapi.language || 'en-US',
                            originalValue: config.vapi.language || 'en-US'
                        }));
                        setMaxSeconds(prev => ({
                            ...prev,
                            value: (config.vapi.maxCallDuration || 300).toString(),
                            originalValue: (config.vapi.maxCallDuration || 300).toString()
                        }));
                    }
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
                setLoadError('Failed to load settings. Please refresh the page.');
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            loadSettings();
        }

        return () => {
            timeoutRefs.current.forEach(clearTimeout);
        };
    }, [user]);

    const handleSaveConfig = async () => {
        setGlobalSaving(true);
        try {
            const payload = {
                systemPrompt: systemPrompt.value,
                firstMessage: firstMessage.value,
                voiceId: voiceId.value,
                language: language.value,
                maxDurationSeconds: parseInt(maxSeconds.value)
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

            // Update all saved states
            setSystemPrompt(prev => ({ ...prev, saved: true, originalValue: prev.value }));
            setFirstMessage(prev => ({ ...prev, saved: true, originalValue: prev.value }));
            setVoiceId(prev => ({ ...prev, saved: true, originalValue: prev.value }));
            setLanguage(prev => ({ ...prev, saved: true, originalValue: prev.value }));
            setMaxSeconds(prev => ({ ...prev, saved: true, originalValue: prev.value }));

            // Clear saved indicators after 3 seconds
            const timeoutId = setTimeout(() => {
                setSystemPrompt(prev => ({ ...prev, saved: false }));
                setFirstMessage(prev => ({ ...prev, saved: false }));
                setVoiceId(prev => ({ ...prev, saved: false }));
                setLanguage(prev => ({ ...prev, saved: false }));
                setMaxSeconds(prev => ({ ...prev, saved: false }));
            }, 3000);
            timeoutRefs.current.push(timeoutId);
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to save configuration';
            setSystemPrompt(prev => ({ ...prev, error: errorMsg }));
        } finally {
            setGlobalSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-white">
            {/* Left Sidebar */}
            <LeftSidebar />

            {/* Main Content */}
            <div className="flex-1 ml-64 overflow-y-auto">
                <div className="max-w-4xl mx-auto p-8">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-4xl font-bold text-gray-900 mb-2">Agent Configuration</h1>
                        <p className="text-gray-600">Configure your AI agent behavior and settings</p>
                    </div>

                    {loadError && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {loadError}
                        </div>
                    )}

                    {/* Tabs */}
                    <div className="flex gap-2 mb-8 border-b border-gray-200 pb-4">
                        <button
                            onClick={() => setActiveTab('api-keys')}
                            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all font-medium ${
                                activeTab === 'api-keys'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <Key className="w-5 h-5" />
                            API Keys
                        </button>
                        <button
                            onClick={() => setActiveTab('agent-config')}
                            className={`px-6 py-3 rounded-lg flex items-center gap-2 transition-all font-medium ${
                                activeTab === 'agent-config'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                        >
                            <Bot className="w-5 h-5" />
                            Agent Config
                        </button>
                    </div>

                    {/* API Keys Tab */}
                    {activeTab === 'api-keys' && (
                        <div className="space-y-6">
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <h3 className="text-lg font-bold text-gray-900 mb-4">Vapi API Key</h3>
                                <div className="space-y-3">
                                    <input
                                        type="password"
                                        value={vapiKey.value}
                                        onChange={(e) => setVapiKey(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                        placeholder="Enter your Vapi API key"
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none"
                                    />
                                    <button
                                        className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                                    >
                                        <Save className="w-4 h-4 inline mr-2" />
                                        Save API Key
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Agent Config Tab */}
                    {activeTab === 'agent-config' && (
                        <div className="space-y-6">
                            {/* System Prompt */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">System Prompt</label>
                                <textarea
                                    value={systemPrompt.value}
                                    onChange={(e) => setSystemPrompt(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                    placeholder="Enter system prompt..."
                                    className="w-full h-40 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* First Message */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">First Message</label>
                                <textarea
                                    value={firstMessage.value}
                                    onChange={(e) => setFirstMessage(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                    placeholder="Enter first message..."
                                    className="w-full h-24 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* Voice Selection */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">Voice</label>
                                <select
                                    value={voiceId.value}
                                    onChange={(e) => setVoiceId(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none"
                                >
                                    <option value="">Select a voice...</option>
                                    {voices.map((voice: any) => (
                                        <option key={voice.id} value={voice.id}>
                                            {voice.name} ({voice.gender})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Language */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">Language</label>
                                <select
                                    value={language.value}
                                    onChange={(e) => setLanguage(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none"
                                >
                                    <option value="en-US">English (US)</option>
                                    <option value="en-GB">English (UK)</option>
                                    <option value="es-ES">Spanish (Spain)</option>
                                    <option value="fr-FR">French</option>
                                    <option value="de-DE">German</option>
                                </select>
                            </div>

                            {/* Max Duration */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">Max Call Duration (seconds)</label>
                                <input
                                    type="number"
                                    value={maxSeconds.value}
                                    onChange={(e) => setMaxSeconds(prev => ({ ...prev, value: e.target.value, saved: false, error: null }))}
                                    placeholder="300"
                                    min="60"
                                    max="3600"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none"
                                />
                            </div>

                            {/* Outbound Call Configuration */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-3">Live Call Test (Outbound)</label>
                                <p className="text-xs text-gray-600 mb-4">Test the agent by calling a phone number</p>
                                <input
                                    type="tel"
                                    value={outboundNumber}
                                    onChange={(e) => setOutboundNumber(e.target.value)}
                                    placeholder="+1 (555) 123-4567"
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:border-emerald-500 outline-none mb-4"
                                />
                                <p className="text-xs text-gray-500">Enter the phone number to call for testing</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-4">
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={globalSaving}
                                    className="flex-1 px-6 py-3 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {globalSaving ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Save Configuration
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => setVoicePanelOpen(true)}
                                    className="flex-1 px-6 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mic className="w-5 h-5" />
                                    Web Test
                                </button>
                                <button
                                    onClick={() => {
                                        if (!outboundNumber.trim()) {
                                            alert('Please enter a phone number for live call test');
                                            return;
                                        }
                                        // TODO: Implement live call test with outbound number
                                        console.log('Live call test to:', outboundNumber);
                                    }}
                                    className="flex-1 px-6 py-3 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-semibold transition-colors flex items-center justify-center gap-2"
                                >
                                    <Phone className="w-5 h-5" />
                                    Live Call Test
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right Voice Test Panel */}
            <VoiceTestPanel isOpen={voicePanelOpen} onClose={() => setVoicePanelOpen(false)} />
        </div>
    );
}
