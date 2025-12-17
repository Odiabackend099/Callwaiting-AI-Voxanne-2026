'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Save, Check, AlertCircle, Loader2, Volume2, Globe, MessageSquare, Clock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const AGENT_CONFIG_CONSTRAINTS = {
    MIN_DURATION_SECONDS: 60,
    MAX_DURATION_SECONDS: 3600,
    DEFAULT_DURATION_SECONDS: 300
};

interface Voice {
    id: string;
    name: string;
    gender: string;
    provider: string;
    isDefault?: boolean;
}

interface AgentConfig {
    systemPrompt: string;
    firstMessage: string;
    voice: string;
    language: string;
    maxDuration: number;
}

export default function AgentConfigPage() {
    const router = useRouter();
    const { user, loading } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [voices, setVoices] = useState<Voice[]>([]);
    const [vapiConfigured, setVapiConfigured] = useState(false);

    const [config, setConfig] = useState<AgentConfig>({
        systemPrompt: '',
        firstMessage: '',
        voice: '',
        language: 'en-US',
        maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
    });

    const [originalConfig, setOriginalConfig] = useState<AgentConfig | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [voicesData, settingsData, agentData] = await Promise.all([
                authedBackendFetch<any>('/api/assistants/voices/available'),
                authedBackendFetch<any>('/api/founder-console/settings'),
                authedBackendFetch<any>('/api/founder-console/agent/config'),
            ]);

            setVoices(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []));
            setVapiConfigured(Boolean(settingsData?.vapiConfigured));

            if (agentData?.vapi) {
                const vapi = agentData.vapi;
                const loadedConfig = {
                    systemPrompt: vapi.systemPrompt || '',
                    firstMessage: vapi.firstMessage || '',
                    voice: vapi.voice || '',
                    language: vapi.language || 'en-US',
                    maxDuration: vapi.maxCallDuration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                };
                setConfig(loadedConfig);
                setOriginalConfig(loadedConfig);
            }
        } catch (err) {
            console.error('Error loading configuration:', err);
            setError('Failed to load configuration. Please refresh the page.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        } else if (user) {
            loadData();
        }
    }, [user, loading, router, loadData]);

    const hasChanges = () => {
        if (!originalConfig) return false;
        return (
            config.systemPrompt !== originalConfig.systemPrompt ||
            config.firstMessage !== originalConfig.firstMessage ||
            config.voice !== originalConfig.voice ||
            config.language !== originalConfig.language ||
            config.maxDuration !== originalConfig.maxDuration
        );
    };

    const handleSave = async () => {
        if (!vapiConfigured) {
            setError('Please configure your Vapi API key in the API Keys page first.');
            return;
        }

        setIsSaving(true);
        setSaveSuccess(false);
        setError(null);

        try {
            const payload = {
                systemPrompt: config.systemPrompt,
                firstMessage: config.firstMessage,
                voiceId: config.voice,
                language: config.language,
                maxDurationSeconds: config.maxDuration
            };

            // Save agent behavior to database AND sync to Vapi with knowledge base
            // The /api/founder-console/agent/behavior endpoint:
            // 1. Updates both INBOUND and OUTBOUND agents in the DB
            // 2. Calls ensureAssistantSynced for each agent (creates or updates Vapi assistant)
            // 3. ensureAssistantSynced attaches the knowledge base via /api/assistants/sync
            const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            // Verify sync was successful
            if (!result?.success) {
                throw new Error('Failed to sync agent configuration to Vapi');
            }

            setOriginalConfig(config);
            setSaveSuccess(true);

            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                setSaveSuccess(false);
            }, 3000);

        } catch (err) {
            console.error('Error saving:', err);
            setError('Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="flex h-screen bg-white">
            <LeftSidebar />

            <div className="flex-1 ml-64 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 py-8">
                    <div className="mb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Configuration</h1>
                            <p className="text-gray-600">Customize your AI agent's personality and behavior.</p>
                        </div>

                        <button
                            onClick={handleSave}
                            disabled={!hasChanges() || isSaving || !vapiConfigured}
                            className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2 ${saveSuccess
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                    : hasChanges() && vapiConfigured
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl'
                                        : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                                }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Saving...
                                </>
                            ) : saveSuccess ? (
                                <>
                                    <Check className="w-5 h-5" />
                                    Saved!
                                </>
                            ) : (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    {!vapiConfigured && (
                        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span>
                                Your Vapi API key is not configured. Please go to the <a href="/dashboard/api-keys" className="font-bold underline">API Keys</a> page to set it up.
                            </span>
                        </div>
                    )}

                    <div className="space-y-6">
                        {/* System Prompt */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Bot className="w-5 h-5 text-purple-600" />
                                System Prompt
                            </h2>
                            <p className="text-sm text-gray-700 mb-4">
                                The core instructions for your AI agent. Define its persona, knowledge, and rules here.
                            </p>
                            <textarea
                                value={config.systemPrompt}
                                onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                placeholder="You are a helpful AI assistant..."
                                className="w-full h-64 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                            />
                        </div>

                        {/* First Message */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-600" />
                                First Message
                            </h2>
                            <p className="text-sm text-gray-700 mb-4">
                                What the agent says immediately when answering a call.
                            </p>
                            <textarea
                                value={config.firstMessage}
                                onChange={(e) => setConfig(prev => ({ ...prev, firstMessage: e.target.value }))}
                                placeholder="Hello, thanks for calling! How can I help you today?"
                                className="w-full h-24 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Voice Selection */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Volume2 className="w-5 h-5 text-emerald-600" />
                                    Voice
                                </h2>
                                <select
                                    value={config.voice}
                                    onChange={(e) => setConfig(prev => ({ ...prev, voice: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                >
                                    <option value="">Select a voice...</option>
                                    {voices.map((voice) => (
                                        <option key={voice.id} value={voice.id}>
                                            {voice.name} ({voice.gender}) - {voice.provider}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Language Selection */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-cyan-600" />
                                    Language
                                </h2>
                                <select
                                    value={config.language}
                                    onChange={(e) => setConfig(prev => ({ ...prev, language: e.target.value }))}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
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
                                </select>
                            </div>
                        </div>

                        {/* Max Duration */}
                        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-600" />
                                Max Call Duration
                            </h2>
                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    value={config.maxDuration}
                                    onChange={(e) => setConfig(prev => ({ ...prev, maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS }))}
                                    min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
                                    max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
                                    className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                                <span className="text-gray-500 font-medium whitespace-nowrap">seconds</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                                Limit the maximum length of a call to control costs (60 - 3600 seconds).
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
