'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Save, Check, AlertCircle, Loader2, Volume2, Globe, MessageSquare, Clock, Phone } from 'lucide-react';
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

interface InboundStatus {
    configured: boolean;
    inboundNumber?: string;
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
    const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);

    // Inbound agent config
    const [inboundConfig, setInboundConfig] = useState<AgentConfig>({
        systemPrompt: '',
        firstMessage: '',
        voice: '',
        language: 'en-US',
        maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
    });

    // Outbound agent config
    const [outboundConfig, setOutboundConfig] = useState<AgentConfig>({
        systemPrompt: '',
        firstMessage: '',
        voice: '',
        language: 'en-US',
        maxDuration: AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
    });

    const [originalInboundConfig, setOriginalInboundConfig] = useState<AgentConfig | null>(null);
    const [originalOutboundConfig, setOriginalOutboundConfig] = useState<AgentConfig | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const [voicesData, settingsData, agentData, inboundStatusData] = await Promise.all([
                authedBackendFetch<any>('/api/assistants/voices/available'),
                authedBackendFetch<any>('/api/founder-console/settings'),
                authedBackendFetch<any>('/api/founder-console/agent/config'),
                authedBackendFetch<any>('/api/inbound/status'),
            ]);

            setVoices(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []));
            setVapiConfigured(Boolean(settingsData?.vapiConfigured));
            setInboundStatus({
                configured: Boolean(inboundStatusData?.configured),
                inboundNumber: inboundStatusData?.inboundNumber
            });

            // Load inbound agent config
            if (agentData?.vapi) {
                const vapi = agentData.vapi;
                const loadedConfig = {
                    systemPrompt: vapi.systemPrompt || '',
                    firstMessage: vapi.firstMessage || '',
                    voice: vapi.voice || '',
                    language: vapi.language || 'en-US',
                    maxDuration: vapi.maxCallDuration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                };
                setInboundConfig(loadedConfig);
                setOriginalInboundConfig(loadedConfig);
            }

            // Load outbound agent config
            const outboundData = await authedBackendFetch<any>('/api/founder-console/outbound-agent-config');
            if (outboundData) {
                const loadedConfig = {
                    systemPrompt: outboundData.system_prompt || '',
                    firstMessage: outboundData.first_message || '',
                    voice: outboundData.voice_id || '',
                    language: outboundData.language || 'en-US',
                    maxDuration: outboundData.max_call_duration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                };
                setOutboundConfig(loadedConfig);
                setOriginalOutboundConfig(loadedConfig);
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
        const inboundChanged = originalInboundConfig && (
            inboundConfig.systemPrompt !== originalInboundConfig.systemPrompt ||
            inboundConfig.firstMessage !== originalInboundConfig.firstMessage ||
            inboundConfig.voice !== originalInboundConfig.voice ||
            inboundConfig.language !== originalInboundConfig.language ||
            inboundConfig.maxDuration !== originalInboundConfig.maxDuration
        );

        const outboundChanged = originalOutboundConfig && (
            outboundConfig.systemPrompt !== originalOutboundConfig.systemPrompt ||
            outboundConfig.firstMessage !== originalOutboundConfig.firstMessage ||
            outboundConfig.voice !== originalOutboundConfig.voice ||
            outboundConfig.language !== originalOutboundConfig.language ||
            outboundConfig.maxDuration !== originalOutboundConfig.maxDuration
        );

        return inboundChanged || outboundChanged;
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
            // Build independent payloads for each agent
            const payload: any = {};

            // Only include inbound config if it has changes
            if (originalInboundConfig && (
                inboundConfig.systemPrompt !== originalInboundConfig.systemPrompt ||
                inboundConfig.firstMessage !== originalInboundConfig.firstMessage ||
                inboundConfig.voice !== originalInboundConfig.voice ||
                inboundConfig.language !== originalInboundConfig.language ||
                inboundConfig.maxDuration !== originalInboundConfig.maxDuration
            )) {
                payload.inbound = {
                    systemPrompt: inboundConfig.systemPrompt,
                    firstMessage: inboundConfig.firstMessage,
                    voiceId: inboundConfig.voice,
                    language: inboundConfig.language,
                    maxDurationSeconds: inboundConfig.maxDuration
                };
            }

            // Only include outbound config if it has changes
            if (originalOutboundConfig && (
                outboundConfig.systemPrompt !== originalOutboundConfig.systemPrompt ||
                outboundConfig.firstMessage !== originalOutboundConfig.firstMessage ||
                outboundConfig.voice !== originalOutboundConfig.voice ||
                outboundConfig.language !== originalOutboundConfig.language ||
                outboundConfig.maxDuration !== originalOutboundConfig.maxDuration
            )) {
                payload.outbound = {
                    systemPrompt: outboundConfig.systemPrompt,
                    firstMessage: outboundConfig.firstMessage,
                    voiceId: outboundConfig.voice,
                    language: outboundConfig.language,
                    maxDurationSeconds: outboundConfig.maxDuration
                };
            }

            // If no changes, don't send
            if (!payload.inbound && !payload.outbound) {
                setError('No changes to save');
                setIsSaving(false);
                return;
            }

            // Save both agents independently
            const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
            }

            setOriginalInboundConfig(inboundConfig);
            setOriginalOutboundConfig(outboundConfig);
            setSaveSuccess(true);

            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = setTimeout(() => {
                setSaveSuccess(false);
            }, 3000);

        } catch (err) {
            console.error('Error saving:', err);
            setError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleTestInbound = async () => {
        try {
            await authedBackendFetch<any>('/api/founder-console/agent/web-test', {
                method: 'POST',
                timeoutMs: 30000,
                retries: 1,
            });
            router.push('/dashboard/test?tab=web');
        } catch (err) {
            setError('Failed to start web test');
        }
    };

    const handleTestOutbound = async () => {
        try {
            router.push('/dashboard/test?tab=phone');
        } catch (err) {
            setError('Failed to start outbound test');
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
                <div className="max-w-6xl mx-auto px-6 py-8">
                    <div className="mb-8 flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Configuration</h1>
                            <p className="text-gray-600">Configure both inbound and outbound agents. Settings sync to Vapi automatically.</p>
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
                                    Save Both Agents
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* INBOUND AGENT */}
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6">
                                <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2 mb-1">
                                    <Phone className="w-6 h-6" />
                                    Inbound Agent
                                </h2>
                                <p className="text-sm text-blue-700">Receives incoming calls</p>
                                {inboundStatus?.configured && (
                                    <p className="text-xs text-blue-600 mt-2">📱 {inboundStatus.inboundNumber}</p>
                                )}
                            </div>

                            {/* System Prompt */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-purple-600" />
                                    System Prompt
                                </h3>
                                <textarea
                                    value={inboundConfig.systemPrompt}
                                    onChange={(e) => setInboundConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                    placeholder="You are a helpful AI assistant..."
                                    className="w-full h-48 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none font-mono text-sm leading-relaxed"
                                />
                            </div>

                            {/* First Message */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-blue-600" />
                                    First Message
                                </h3>
                                <textarea
                                    value={inboundConfig.firstMessage}
                                    onChange={(e) => setInboundConfig(prev => ({ ...prev, firstMessage: e.target.value }))}
                                    placeholder="Hello, thanks for calling!"
                                    className="w-full h-20 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                                />
                            </div>

                            {/* Voice & Language */}
                            <div className="space-y-4">
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Volume2 className="w-5 h-5 text-blue-600" />
                                        Voice
                                    </h3>
                                    <select
                                        value={inboundConfig.voice}
                                        onChange={(e) => setInboundConfig(prev => ({ ...prev, voice: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    >
                                        <option value="">Select a voice...</option>
                                        {voices.map((voice) => (
                                            <option key={voice.id} value={voice.id}>
                                                {voice.name} ({voice.gender}) - {voice.provider}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-cyan-600" />
                                        Language
                                    </h3>
                                    <select
                                        value={inboundConfig.language}
                                        onChange={(e) => setInboundConfig(prev => ({ ...prev, language: e.target.value }))}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                    Max Call Duration
                                </h3>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        value={inboundConfig.maxDuration}
                                        onChange={(e) => setInboundConfig(prev => ({ ...prev, maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS }))}
                                        min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
                                        max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                    <span className="text-gray-500 font-medium whitespace-nowrap">seconds</span>
                                </div>
                            </div>

                            {/* Test Button */}
                            <button
                                onClick={handleTestInbound}
                                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                            >
                                🌐 Test Web (Browser)
                            </button>
                        </div>

                        {/* OUTBOUND AGENT */}
                        <div className="space-y-6">
                            <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-6">
                                <h2 className="text-2xl font-bold text-emerald-900 flex items-center gap-2 mb-1">
                                    📤 Outbound Agent
                                </h2>
                                <p className="text-sm text-emerald-700">Makes outgoing calls</p>
                                {inboundStatus?.configured && (
                                    <p className="text-xs text-emerald-600 mt-2">Caller ID: {inboundStatus.inboundNumber}</p>
                                )}
                            </div>

                            {/* System Prompt */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-purple-600" />
                                    System Prompt
                                </h3>
                                <textarea
                                    value={outboundConfig.systemPrompt}
                                    onChange={(e) => setOutboundConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                                    placeholder="You are a professional outbound sales representative..."
                                    className="w-full h-48 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                                />
                            </div>

                            {/* First Message */}
                            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-blue-600" />
                                    First Message
                                </h3>
                                <textarea
                                    value={outboundConfig.firstMessage}
                                    onChange={(e) => setOutboundConfig(prev => ({ ...prev, firstMessage: e.target.value }))}
                                    placeholder="Hello! This is an outbound call from..."
                                    className="w-full h-20 px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                                />
                            </div>

                            {/* Voice & Language */}
                            <div className="space-y-4">
                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Volume2 className="w-5 h-5 text-emerald-600" />
                                        Voice
                                    </h3>
                                    <select
                                        value={outboundConfig.voice}
                                        onChange={(e) => setOutboundConfig(prev => ({ ...prev, voice: e.target.value }))}
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

                                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                        <Globe className="w-5 h-5 text-cyan-600" />
                                        Language
                                    </h3>
                                    <select
                                        value={outboundConfig.language}
                                        onChange={(e) => setOutboundConfig(prev => ({ ...prev, language: e.target.value }))}
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
                                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-amber-600" />
                                    Max Call Duration
                                </h3>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        value={outboundConfig.maxDuration}
                                        onChange={(e) => setOutboundConfig(prev => ({ ...prev, maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS }))}
                                        min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
                                        max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
                                        className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                    <span className="text-gray-500 font-medium whitespace-nowrap">seconds</span>
                                </div>
                            </div>

                            {/* Test Button */}
                            <button
                                onClick={handleTestOutbound}
                                className="w-full px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
                            >
                                ☎️ Test Live Call
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
