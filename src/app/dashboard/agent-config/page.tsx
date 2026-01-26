'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Save, Check, AlertCircle, Loader2, Volume2, Globe, MessageSquare, Clock, Phone, Sparkles, LayoutTemplate, Play, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { PROMPT_TEMPLATES, OUTBOUND_PROMPT_TEMPLATES, PromptTemplate } from '@/lib/prompt-templates';
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
    const [savingAgent, setSavingAgent] = useState<'inbound' | 'outbound' | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [voices, setVoices] = useState<Voice[]>([]);
    const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);

    // Vapi Phone Number State
    const [vapiNumbers, setVapiNumbers] = useState<any[]>([]);
    const [selectedNumberId, setSelectedNumberId] = useState('');
    const [assigningNumber, setAssigningNumber] = useState(false);

    // Outbound Phone Number State
    const [selectedOutboundNumberId, setSelectedOutboundNumberId] = useState('');
    const [originalOutboundPhoneNumberId, setOriginalOutboundPhoneNumberId] = useState('');
    const [assigningOutboundNumber, setAssigningOutboundNumber] = useState(false);

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
                authedBackendFetch<any>('/api/integrations/vapi/numbers'), // Fetch Vapi numbers
            ]);

            const [voicesResult, settingsResult, agentResult, inboundResult, numbersResult] = results;

            if (voicesResult.status === 'fulfilled') {
                const voicesData = voicesResult.value;
                setVoices(Array.isArray(voicesData) ? voicesData : (voicesData?.voices || []));
            } else {
                console.error('Failed to load voices:', voicesResult.reason);
                setError('Failed to load available voices. Please refresh the page.');
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

                        // Load saved phone number ID
                        if (outboundAgent.vapi_phone_number_id) {
                            setSelectedOutboundNumberId(outboundAgent.vapi_phone_number_id);
                            setOriginalOutboundPhoneNumberId(outboundAgent.vapi_phone_number_id);
                        }

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
            }

            if (numbersResult.status === 'fulfilled' && numbersResult.value.success) {
                setVapiNumbers(numbersResult.value.numbers || []);
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

    const hasOutboundPhoneChanged = (): boolean => {
        return selectedOutboundNumberId !== originalOutboundPhoneNumberId;
    };

    const inboundChanged = hasAgentChanged(inboundConfig, originalInboundConfig);
    const outboundChanged = hasAgentChanged(outboundConfig, originalOutboundConfig) || hasOutboundPhoneChanged();

    const hasActiveTabChanges = () => {
        if (activeTab === 'inbound') return inboundChanged;
        if (activeTab === 'outbound') return outboundChanged;
        return false;
    };

    const restoreDraft = () => {
        setHasDraft(false);
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
        setIsSaving(true);
        setSaveSuccess(false);
        setError(null);

        const currentAgent = activeTab;
        setSavingAgent(currentAgent);

        try {
            const payload: any = {};

            if (activeTab === 'inbound' && inboundChanged) {
                const inboundError = validateAgentConfig(inboundConfig, 'inbound');
                if (inboundError) {
                    setError(inboundError);
                    setIsSaving(false);
                    setSavingAgent(null);
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
                const outboundError = validateAgentConfig(outboundConfig, 'outbound');
                if (outboundError) {
                    setError(outboundError);
                    setIsSaving(false);
                    setSavingAgent(null);
                    return;
                }

                payload.outbound = {
                    systemPrompt: outboundConfig.systemPrompt,
                    firstMessage: outboundConfig.firstMessage,
                    voiceId: outboundConfig.voice,
                    language: outboundConfig.language,
                    maxDurationSeconds: outboundConfig.maxDuration,
                    vapiPhoneNumberId: selectedOutboundNumberId || null
                };
            }

            if (!payload.inbound && !payload.outbound) {
                setError('No changes to save');
                setIsSaving(false);
                setSavingAgent(null);
                return;
            }

            const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                method: 'POST',
                body: JSON.stringify(payload),
                timeoutMs: 30000,
                retries: 1,
            });

            if (!result?.success) {
                throw new Error(result?.error || 'Failed to sync agent configuration to Vapi');
            }

            if (currentAgent === 'inbound') {
                setOriginalInboundConfig(inboundConfig);
            } else if (currentAgent === 'outbound') {
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
            setSavingAgent(null);
        }
    };

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
        const templates = type === 'inbound' ? PROMPT_TEMPLATES : OUTBOUND_PROMPT_TEMPLATES;
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        if (type === 'inbound') {
            setInboundConfig({
                ...inboundConfig,
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
        } else {
            setOutboundConfig({
                ...outboundConfig,
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
        }
    };

    const handleAssignNumber = async () => {
        if (!selectedNumberId) return;
        try {
            setAssigningNumber(true);
            setError(null);

            const selectedNumObj = vapiNumbers.find(n => n.id === selectedNumberId);
            const phoneNumber = selectedNumObj?.number;

            const result = await authedBackendFetch<any>('/api/integrations/vapi/assign-number', {
                method: 'POST',
                body: JSON.stringify({
                    vapiPhoneId: selectedNumberId,
                    phoneNumber: phoneNumber
                })
            });

            if (result.success) {
                const status = await authedBackendFetch<InboundStatus>('/api/inbound/status');
                setInboundStatus(status);
                alert('Agent successfully assigned to phone number!');
            } else {
                throw new Error(result.error || 'Assignment failed');
            }
        } catch (err: any) {
            console.error('Failed to assign number:', err);
            setError(err.message || 'Failed to assign phone number');
        } finally {
            setAssigningNumber(false);
        }
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;
    const setConfig = activeTab === 'inbound' ? setInboundConfig : setOutboundConfig;
    const templates = activeTab === 'inbound' ? PROMPT_TEMPLATES : OUTBOUND_PROMPT_TEMPLATES;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Bot className="w-6 h-6 text-emerald-500" />
                                Agent Configuration
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Configure behavior and settings for your AI agents
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {activeTab === 'inbound' ? (
                                <button
                                    onClick={handleTestInbound}
                                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Globe className="w-4 h-4" />
                                    Test in Browser
                                </button>
                            ) : (
                                <button
                                    onClick={handleTestOutbound}
                                    className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Phone className="w-4 h-4" />
                                    Test Call
                                </button>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={!hasActiveTabChanges() || isSaving}
                                className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm ${saveSuccess
                                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                                    : hasActiveTabChanges()
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                                    }`}
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : saveSuccess ? (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Saved
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 mt-6 border-b border-slate-200 dark:border-slate-800">
                        <button
                            onClick={() => {
                                setActiveTab('inbound');
                                router.push('/dashboard/agent-config?agent=inbound');
                            }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'inbound'
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            <Phone className="w-4 h-4" />
                            Inbound Agent
                        </button>
                        <button
                            onClick={() => {
                                setActiveTab('outbound');
                                router.push('/dashboard/agent-config?agent=outbound');
                            }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'outbound'
                                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                }`}
                        >
                            <ArrowRight className="w-4 h-4" />
                            Outbound Agent
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {hasDraft && (
                    <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
                                <Save className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="font-medium text-indigo-900 dark:text-indigo-300">Unsaved Changes Restored</h3>
                                <p className="text-sm text-indigo-700 dark:text-indigo-400">We found unsaved changes from your last session.</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={discardDraft}
                                className="px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium transition-colors"
                            >
                                Discard
                            </button>
                            <button
                                onClick={restoreDraft}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors shadow-sm"
                            >
                                Keep Draft
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN - Configuration */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Status Card (Inbound Only) */}
                        {activeTab === 'inbound' && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Phone className="w-5 h-5 text-emerald-500" />
                                    Phone Number
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Current Number</p>
                                        <p className="text-lg font-mono text-slate-900 dark:text-white">
                                            {inboundStatus?.configured && inboundStatus.inboundNumber
                                                ? inboundStatus.inboundNumber
                                                : 'Not Assigned'}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Assign New Number
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={selectedNumberId}
                                                onChange={(e) => setSelectedNumberId(e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                <option value="" disabled>Select number...</option>
                                                {vapiNumbers.map((num) => (
                                                    <option key={num.id} value={num.id}>
                                                        {num.number} {num.name ? `(${num.name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={handleAssignNumber}
                                                disabled={assigningNumber || !selectedNumberId}
                                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                            >
                                                {assigningNumber ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Caller ID Selection (Outbound Only) */}
                        {activeTab === 'outbound' && (
                            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                    <Phone className="w-5 h-5 text-emerald-500" />
                                    Outbound Caller ID
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
                                        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Selected Number</p>
                                        <p className="text-lg font-mono text-slate-900 dark:text-white">
                                            {selectedOutboundNumberId && vapiNumbers.find(n => n.id === selectedOutboundNumberId)?.number
                                                ? vapiNumbers.find(n => n.id === selectedOutboundNumberId)?.number
                                                : 'Not Selected'}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                            Choose Caller ID Number
                                        </label>
                                        <div className="flex gap-2">
                                            <select
                                                value={selectedOutboundNumberId}
                                                onChange={(e) => setSelectedOutboundNumberId(e.target.value)}
                                                className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                                            >
                                                <option value="" disabled>Select number...</option>
                                                {vapiNumbers.map((num) => (
                                                    <option key={num.id} value={num.id}>
                                                        {num.number} {num.name ? `(${num.name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">
                                            This number will be shown as Caller ID when calling leads.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Voice Settings */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Volume2 className="w-5 h-5 text-blue-500" />
                                Voice Settings
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Voice Persona
                                    </label>
                                    <select
                                        value={currentConfig.voice}
                                        onChange={(e) => setConfig({ ...currentConfig, voice: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="">Select a voice...</option>
                                        {voices.map((voice) => (
                                            <option key={voice.id} value={voice.id}>
                                                {voice.name} ({voice.gender}) - {voice.provider}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Language
                                    </label>
                                    <select
                                        value={currentConfig.language}
                                        onChange={(e) => setConfig({ ...currentConfig, language: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="en-US">English (US)</option>
                                        <option value="en-GB">English (UK)</option>
                                        <option value="es-ES">Spanish (Spain)</option>
                                        <option value="es-MX">Spanish (Mexico)</option>
                                        <option value="fr-FR">French</option>
                                        <option value="de-DE">German</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Limits */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <Clock className="w-5 h-5 text-amber-500" />
                                Limits
                            </h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    Max Duration (Seconds)
                                </label>
                                <input
                                    type="number"
                                    value={currentConfig.maxDuration}
                                    onChange={(e) => setConfig({ ...currentConfig, maxDuration: parseInt(e.target.value) || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS })}
                                    min={AGENT_CONFIG_CONSTRAINTS.MIN_DURATION_SECONDS}
                                    max={AGENT_CONFIG_CONSTRAINTS.MAX_DURATION_SECONDS}
                                    className="w-full px-3 py-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Auto-end call after this time.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN - Intelligence */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Template Selector */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <LayoutTemplate className="w-5 h-5 text-purple-500" />
                                Quick Start Templates
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {templates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => applyTemplate(template.id, activeTab)}
                                        className="text-left p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-purple-500 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all group"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium text-slate-900 dark:text-white group-hover:text-purple-700 dark:group-hover:text-purple-400">
                                                {template.name}
                                            </span>
                                            <Sparkles className="w-4 h-4 text-slate-400 group-hover:text-purple-500" />
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                                            {template.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* System Prompt */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Bot className="w-5 h-5 text-emerald-500" />
                                    System Prompt
                                </h3>
                                <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                                    Core Personality
                                </span>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Define how your agent behaves, speaks, and handles specific scenarios.
                            </p>
                            <textarea
                                value={currentConfig.systemPrompt}
                                onChange={(e) => setConfig({ ...currentConfig, systemPrompt: e.target.value })}
                                placeholder="You are a helpful AI assistant..."
                                className="w-full h-96 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none resize-none font-mono text-sm leading-relaxed"
                            />
                        </div>

                        {/* First Message */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="w-5 h-5 text-blue-500" />
                                First Message
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                The very first thing your agent says when the call connects.
                            </p>
                            <textarea
                                value={currentConfig.firstMessage}
                                onChange={(e) => setConfig({ ...currentConfig, firstMessage: e.target.value })}
                                placeholder="Hello! How can I help you today?"
                                className="w-full h-24 px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
