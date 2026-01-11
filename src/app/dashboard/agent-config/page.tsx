'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Save, Check, AlertCircle, Loader2, Volume2, Globe, MessageSquare, Clock, Phone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
// LeftSidebar removed (now in layout)
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { PROMPT_TEMPLATES, PromptTemplate } from '@/lib/prompt-templates';
import { useAgentStore, INITIAL_CONFIG } from '@/lib/store/agentStore';

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
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();

    // Tab navigation with URL param support
    const tabParam = searchParams.get('agent');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab as 'inbound' | 'outbound');

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [voices, setVoices] = useState<Voice[]>([]);
    const [vapiConfigured, setVapiConfigured] = useState(false);
    const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);



    // Global Store State
    const { inboundConfig, outboundConfig, setInboundConfig, setOutboundConfig } = useAgentStore();

    // Server state for draft comparison
    const [serverInbound, setServerInbound] = useState<AgentConfig | null>(null);
    const [serverOutbound, setServerOutbound] = useState<AgentConfig | null>(null);
    const [hasDraft, setHasDraft] = useState(false);

    // Helper to check equality
    const areConfigsEqual = (a: AgentConfig, b: AgentConfig) => {
        return a.systemPrompt === b.systemPrompt &&
            a.firstMessage === b.firstMessage &&
            a.voice === b.voice &&
            a.language === b.language &&
            a.maxDuration === b.maxDuration;
    };


    const [originalInboundConfig, setOriginalInboundConfig] = useState<AgentConfig | null>(null);
    const [originalOutboundConfig, setOriginalOutboundConfig] = useState<AgentConfig | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const loadData = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const results = await Promise.allSettled([
                authedBackendFetch<any>('/api/assistants/voices/available'),
                authedBackendFetch<any>('/api/founder-console/settings'),
                authedBackendFetch<any>('/api/founder-console/agent/config'),
                authedBackendFetch<any>('/api/inbound/status'),
            ]);

            const [voicesResult, settingsResult, agentResult, inboundResult] = results;

            if (voicesResult.status === 'fulfilled') {
                const voicesData = voicesResult.value;
                setVoices(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []));
            } else {
                console.error('Failed to load voices:', voicesResult.reason);
                setError('Failed to load available voices. Please refresh the page.');
                setIsLoading(false);
                return;
            }

            if (settingsResult.status === 'fulfilled') {
                setVapiConfigured(Boolean(settingsResult.value?.vapiConfigured));
            } else {
                console.error('Failed to load settings:', settingsResult.reason);
                setError('Failed to load integration settings. Please refresh the page.');
                setIsLoading(false);
                return;
            }

            if (agentResult.status === 'fulfilled') {
                const agentData = agentResult.value;
                if (agentData?.agents) {
                    const inboundAgent = agentData.agents.find((a: any) => a.role === 'inbound');
                    const outboundAgent = agentData.agents.find((a: any) => a.role === 'outbound');

                    if (inboundAgent) {
                        const loadedConfig = {
                            systemPrompt: inboundAgent.system_prompt || '',
                            firstMessage: inboundAgent.first_message || '',
                            voice: inboundAgent.voice || '',
                            language: inboundAgent.language || 'en-US',
                            maxDuration: inboundAgent.max_call_duration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                        };

                        // Check for drafts
                        const currentStore = useAgentStore.getState().inboundConfig;
                        if (!areConfigsEqual(currentStore, loadedConfig)) {
                            // If store is default/empty, just overwrite
                            if (areConfigsEqual(currentStore, INITIAL_CONFIG) || (!currentStore.systemPrompt && !currentStore.voice)) {
                                setInboundConfig(loadedConfig);
                                setOriginalInboundConfig(loadedConfig);
                            } else {
                                // Real draft exists
                                setHasDraft(true);
                                setServerInbound(loadedConfig);
                                setOriginalInboundConfig(loadedConfig); // Original is server state
                            }
                        } else {
                            setInboundConfig(loadedConfig);
                            setOriginalInboundConfig(loadedConfig);
                        }
                    }

                    if (outboundAgent) {
                        const loadedConfig = {
                            systemPrompt: outboundAgent.system_prompt || '',
                            firstMessage: outboundAgent.first_message || '',
                            voice: outboundAgent.voice || '',
                            language: outboundAgent.language || 'en-US',
                            maxDuration: outboundAgent.max_call_duration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                        };

                        // Check for drafts
                        const currentStore = useAgentStore.getState().outboundConfig;
                        if (!areConfigsEqual(currentStore, loadedConfig)) {
                            // If store is default/empty, just overwrite
                            if (areConfigsEqual(currentStore, INITIAL_CONFIG) || (!currentStore.systemPrompt && !currentStore.voice)) {
                                setOutboundConfig(loadedConfig);
                                setOriginalOutboundConfig(loadedConfig);
                            } else {
                                // Real draft exists
                                setHasDraft(true);
                                setServerOutbound(loadedConfig);
                                setOriginalOutboundConfig(loadedConfig);
                            }
                        } else {
                            setOutboundConfig(loadedConfig);
                            setOriginalOutboundConfig(loadedConfig);
                        }
                    }
                } else if (agentData?.vapi) {
                    // Legacy single Vapi config handling (treat as inbound)
                    const vapi = agentData.vapi;
                    const loadedConfig = {
                        systemPrompt: vapi.systemPrompt || '',
                        firstMessage: vapi.firstMessage || '',
                        voice: vapi.voice || '',
                        language: vapi.language || 'en-US',
                        maxDuration: vapi.maxCallDuration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS
                    };

                    const currentStore = useAgentStore.getState().inboundConfig;
                    if (!areConfigsEqual(currentStore, loadedConfig)) {
                        if (areConfigsEqual(currentStore, INITIAL_CONFIG) || (!currentStore.systemPrompt && !currentStore.voice)) {
                            setInboundConfig(loadedConfig);
                            setOriginalInboundConfig(loadedConfig);
                        } else {
                            setHasDraft(true);
                            setServerInbound(loadedConfig);
                            setOriginalInboundConfig(loadedConfig);
                        }
                    } else {
                        setInboundConfig(loadedConfig);
                        setOriginalInboundConfig(loadedConfig);
                    }
                }
            } else {
                console.error('Failed to load agent config:', agentResult.reason);
                setError('Failed to load agent configuration. Please refresh the page.');
                setIsLoading(false);
                return;
            }

            if (inboundResult.status === 'fulfilled') {
                setInboundStatus({
                    configured: Boolean(inboundResult.value?.configured),
                    inboundNumber: inboundResult.value?.inboundNumber
                });
            } else {
                console.warn('Failed to load inbound status:', inboundResult.reason);
            }
        } catch (err) {
            console.error('Unexpected error loading configuration:', err);
            setError('An unexpected error occurred. Please refresh the page.');
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

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const hasValidConfig = (config: AgentConfig): boolean => {
        return !!(config.systemPrompt?.trim() && config.firstMessage?.trim() && config.voice && config.language);
    };

    const hasAgentChanged = (current: AgentConfig, original: AgentConfig | null): boolean => {
        if (!original) return hasValidConfig(current);
        return (
            current.systemPrompt !== original.systemPrompt ||
            current.firstMessage !== original.firstMessage ||
            current.voice !== original.voice ||
            current.language !== original.language ||
            current.maxDuration !== original.maxDuration
        );
    };

    const inboundChanged = hasAgentChanged(inboundConfig, originalInboundConfig);
    const outboundChanged = hasAgentChanged(outboundConfig, originalOutboundConfig);

    const hasChanges = () => inboundChanged || outboundChanged;

    const hasActiveTabChanges = () => {
        if (activeTab === 'inbound') return inboundChanged;
        if (activeTab === 'outbound') return outboundChanged;
        return false;
    };

    // Validate agent config before save
    const restoreDraft = () => {
        setHasDraft(false);
        // Store already has the draft, so we just clear the banner
    };

    const discardDraft = () => {
        if (serverInbound) setInboundConfig(serverInbound);
        if (serverOutbound) setOutboundConfig(serverOutbound);
        setHasDraft(false);
    };

    const validateAgentConfig = (config: AgentConfig, agentType: 'inbound' | 'outbound'): string | null => {
        if (!config.systemPrompt || config.systemPrompt.trim() === '') {
            return `${agentType} agent system prompt is required`;
        }
        if (!config.firstMessage || config.firstMessage.trim() === '') {
            return `${agentType} agent first message is required`;
        }
        if (!config.voice) {
            return `${agentType} agent voice must be selected`;
        }
        if (config.maxDuration < AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS ||
            config.maxDuration > AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS) {
            return `${agentType} agent duration must be between ${AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS} and ${AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS} seconds`;
        }
        return null;
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
            // Build payload for ONLY the active tab
            const payload: any = {};

            // Save only the ACTIVE tab's agent
            if (activeTab === 'inbound' && inboundChanged) {
                // Validate inbound config
                const inboundError = validateAgentConfig(inboundConfig, 'inbound');
                if (inboundError) {
                    setError(inboundError);
                    setIsSaving(false);
                    return;
                }

                payload.inbound = {
                    systemPrompt: inboundConfig.systemPrompt,
                    firstMessage: inboundConfig.firstMessage,
                    voiceId: inboundConfig.voice,
                    language: inboundConfig.language,
                    maxDurationSeconds: inboundConfig.maxDuration
                };
            }

            if (activeTab === 'outbound' && outboundChanged) {
                // Validate outbound config
                const outboundError = validateAgentConfig(outboundConfig, 'outbound');
                if (outboundError) {
                    setError(outboundError);
                    setIsSaving(false);
                    return;
                }

                payload.outbound = {
                    systemPrompt: outboundConfig.systemPrompt,
                    firstMessage: outboundConfig.firstMessage,
                    voiceId: outboundConfig.voice,
                    language: outboundConfig.language,
                    maxDurationSeconds: outboundConfig.maxDuration
                };
            }

            // If no changes, don't send (this shouldn't happen due to button disabled state)
            if (!payload.inbound && !payload.outbound) {
                setError('No changes to save');
                setIsSaving(false);
                return;
            }

            // Save to backend
            const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
            }

            // Update original config for ACTIVE tab only
            if (activeTab === 'inbound') {
                setOriginalInboundConfig(inboundConfig);
            } else {
                setOriginalOutboundConfig(outboundConfig);
            }

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

    // When save is successful, update server baseline to current config (which is now synced)
    useEffect(() => {
        if (saveSuccess) {
            setServerInbound(inboundConfig);
            setServerOutbound(outboundConfig);
            setHasDraft(false); // Changes are now saved
        }
    }, [saveSuccess, inboundConfig, outboundConfig]);

    const handleTestInbound = async () => {
        try {
            setError(null);
            const inboundError = validateAgentConfig(inboundConfig, 'inbound');
            if (inboundError) {
                setError(inboundError);
                return;
            }
            await authedBackendFetch<any>('/api/founder-console/agent/web-test', {
                method: 'POST',
                timeoutMs: 30000,
                retries: 1,
            });
            router.push('/dashboard/test?tab=web');
        } catch (err) {
            console.error('Failed to start web test:', err);
            setError(err instanceof Error ? err.message : 'Failed to start web test');
        }
    };

    const handleTestOutbound = async () => {
        try {
            setError(null);
            const outboundError = validateAgentConfig(outboundConfig, 'outbound');
            if (outboundError) {
                setError(outboundError);
                return;
            }
            router.push('/dashboard/test?tab=phone');
        } catch (err) {
            console.error('Failed to start outbound test:', err);
            setError(err instanceof Error ? err.message : 'Failed to start outbound test');
        }
    };

    const applyTemplate = (templateId: string, type: 'inbound' | 'outbound') => {
        const template = PROMPT_TEMPLATES.find(t => t.id === templateId);
        if (!template) return;

        if (type === 'inbound') {
            setInboundConfig({
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
        } else {
            setOutboundConfig({
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
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
        <div className="max-w-6xl mx-auto px-6 py-8">
            <div className="mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Configuration</h1>
                    <p className="text-gray-600">Configure both inbound and outbound agents. Settings sync to Vapi automatically.</p>
                </div>

                <button
                    onClick={handleSave}
                    disabled={!hasActiveTabChanges() || isSaving || !vapiConfigured}
                    className={`px-6 py-3 rounded-xl font-medium shadow-lg transition-all flex items-center gap-2 ${saveSuccess
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : hasActiveTabChanges() && vapiConfigured
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-xl'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200'
                        }`}
                >
                    {isSaving ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Saving {activeTab === 'inbound' ? 'Inbound' : 'Outbound'} Agent...
                        </>
                    ) : saveSuccess ? (
                        <>
                            <Check className="w-5 h-5" />
                            Saved!
                        </>
                    ) : (
                        <>
                            <Save className="w-5 h-5" />
                            Save {activeTab === 'inbound' ? 'Inbound' : 'Outbound'} Agent
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

            {/* Draft Restoration Banner */}
            {hasDraft && (
                <div className="mb-6 p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Save className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                            <h3 className="font-bold text-indigo-900">Unsaved Changes Found</h3>
                            <p className="text-sm text-indigo-700">We restored your unsaved changes from your last session.</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={discardDraft}
                            className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
                        >
                            Discard Draft
                        </button>
                        <button
                            onClick={restoreDraft}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                        >
                            Keep Draft
                        </button>
                    </div>
                </div>
            )}

            {/* Tab Navigation */}
            <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl inline-flex mb-8">
                <button
                    onClick={() => {
                        setActiveTab('inbound');
                        router.push('/dashboard/agent-config?agent=inbound');
                    }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'inbound'
                            ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Phone className="w-4 h-4" />
                    Inbound Agent
                    {inboundStatus?.inboundNumber && (
                        <span className="text-xs opacity-70">({inboundStatus.inboundNumber})</span>
                    )}
                </button>
                <button
                    onClick={() => {
                        setActiveTab('outbound');
                        router.push('/dashboard/agent-config?agent=outbound');
                    }}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                        activeTab === 'outbound'
                            ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 shadow-sm'
                            : 'text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200'
                    }`}
                >
                    <Phone className="w-4 h-4" />
                    Outbound Agent
                    {inboundStatus?.inboundNumber && (
                        <span className="text-xs opacity-70">(Caller ID: {inboundStatus.inboundNumber})</span>
                    )}
                </button>
            </div>

            {/* INBOUND AGENT TAB */}
            {activeTab === 'inbound' && (
            <div className="space-y-6 max-w-3xl">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-2xl p-6">
                        <h2 className="text-2xl font-bold text-blue-900 flex items-center gap-2 mb-1">
                            <Phone className="w-6 h-6" />
                            Inbound Agent
                        </h2>
                        <p className="text-sm text-blue-700">Receives incoming calls</p>
                        {inboundStatus?.configured && inboundStatus?.inboundNumber && (
                            <p className="text-xs text-blue-600 mt-2">📱 {inboundStatus.inboundNumber}</p>
                        )}
                    </div>

                    {/* Template Selector */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Bot className="w-5 h-5 text-indigo-600" />
                            Prompt Template
                        </h3>
                        <p className="text-sm text-gray-500 mb-4">Auto-fill the system prompt and first message with industry best practices.</p>
                        <select
                            onChange={(e) => applyTemplate(e.target.value, 'inbound')}
                            className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            defaultValue=""
                        >
                            <option value="" disabled>Select a template...</option>
                            {PROMPT_TEMPLATES.map((template) => (
                                <option key={template.id} value={template.id}>
                                    {template.name} - {template.description}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* System Prompt */}
                    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <Bot className="w-5 h-5 text-purple-600" />
                            System Prompt
                        </h3>
                        <textarea
                            value={inboundConfig.systemPrompt}
                            onChange={(e) => setInboundConfig({ systemPrompt: e.target.value })}
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
                            onChange={(e) => setInboundConfig({ firstMessage: e.target.value })}
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
                                onChange={(e) => setInboundConfig({ voice: e.target.value })}
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
                                onChange={(e) => setInboundConfig({ language: e.target.value })}
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
                                onChange={(e) => setInboundConfig({ maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS })}
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
            )}

            {/* OUTBOUND AGENT TAB */}
            {activeTab === 'outbound' && (
            <div className="space-y-6 max-w-3xl">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-2 border-emerald-200 rounded-2xl p-6">
                        <h2 className="text-2xl font-bold text-emerald-900 flex items-center gap-2 mb-1">
                            📤 Outbound Agent
                        </h2>
                        <p className="text-sm text-emerald-700">Makes outgoing calls</p>
                        {inboundStatus?.configured && inboundStatus?.inboundNumber && (
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
                            onChange={(e) => setOutboundConfig({ systemPrompt: e.target.value })}
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
                            onChange={(e) => setOutboundConfig({ firstMessage: e.target.value })}
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
                                onChange={(e) => setOutboundConfig({ voice: e.target.value })}
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
                                onChange={(e) => setOutboundConfig({ language: e.target.value })}
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
                                onChange={(e) => setOutboundConfig({ maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS })}
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
            )}
        </div>

    );
}
