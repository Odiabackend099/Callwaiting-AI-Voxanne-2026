'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, Save, Check, AlertCircle, Loader2, Volume2, Globe, MessageSquare, Clock, Phone, Sparkles, LayoutTemplate, Play, ArrowRight, ChevronDown, Info, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import { supabase } from '@/lib/supabase';
import { PROMPT_TEMPLATES, OUTBOUND_PROMPT_TEMPLATES, PromptTemplate } from '@/lib/prompt-templates';
import { useAgentStore, INITIAL_CONFIG, AgentConfig } from '@/lib/store/agentStore';
import { VoiceSelector } from '@/components/VoiceSelector';
import { formatPence } from '@/utils/currency';
import { UnifiedAgentConfigForm } from '@/components/dashboard/AgentConfig/UnifiedAgentConfigForm';
import { PromptCheckpointModal } from '@/components/dashboard/AgentConfig/PromptCheckpointModal';
import { MultiTabConflictAlert } from '@/components/dashboard/AgentConfig/MultiTabConflictAlert';
import { usePromptCheckpoint } from '@/hooks/usePromptCheckpoint';
import { useMultiTabConflictDetection } from '@/hooks/useMultiTabConflictDetection';
import useSWR from 'swr';

const fetcher = (url: string) => authedBackendFetch<any>(url);

const AGENT_CONFIG_CONSTRAINTS = {
    MIN_DURATION_SECONDS: 60,
    MAX_DURATION_SECONDS: 3600,
    DEFAULT_DURATION_SECONDS: 300
};

interface Voice {
    id: string;
    name: string;
    provider: string;
    gender: string;
    language: string;
    characteristics: string;
    accent: string;
    bestFor: string;
    latency: string;
    quality: string;
    isDefault: boolean;
    requiresApiKey: boolean;
}


interface InboundStatus {
    configured: boolean;
    inboundNumber?: string;
}

interface VapiNumber {
    id: string;               // Vapi phone number UUID
    number: string;           // E.164 format e.g. "+14407396528"
    name: string;
    type: 'managed' | 'byoc';
    routingDirection?: string; // 'inbound' | 'outbound' | 'unassigned' — from managed_phone_numbers
}

export default function AgentConfigPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();
    const { success, warning: toastWarning, info: toastInfo } = useToast();

    // Tab navigation with URL param support
    const tabParam = searchParams.get('agent');
    const initialTab = (tabParam === 'inbound' || tabParam === 'outbound') ? tabParam : 'inbound';
    const [activeTab, setActiveTab] = useState<'inbound' | 'outbound'>(initialTab as 'inbound' | 'outbound');

    const [isSaving, setIsSaving] = useState(false);
    const [savingAgent, setSavingAgent] = useState<'inbound' | 'outbound' | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [advancedVoiceOpen, setAdvancedVoiceOpen] = useState(false);

    // Track which persona template is currently active (for selected ring)
    const [selectedInboundTemplateId, setSelectedInboundTemplateId] = useState<string | null>(null);
    const [selectedOutboundTemplateId, setSelectedOutboundTemplateId] = useState<string | null>(null);

    const [voices, setVoices] = useState<Voice[]>([]);
    const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);

    // Voice preview state — parent is single source of truth
    const [isPreviewing, setIsPreviewing] = useState(false);
    const [previewPhase, setPreviewPhase] = useState<'idle' | 'loading' | 'playing'>('idle');
    const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const previewAbortRef = useRef<AbortController | null>(null);

    // Vapi Phone Number State
    const [vapiNumbers, setVapiNumbers] = useState<VapiNumber[]>([]);
    const [selectedNumberId, setSelectedNumberId] = useState('');
    const [assigningNumber, setAssigningNumber] = useState(false);

    // Outbound Phone Number State
    const [selectedOutboundNumberId, setSelectedOutboundNumberId] = useState('');
    const [originalOutboundPhoneNumberId, setOriginalOutboundPhoneNumberId] = useState('');
    const [assigningOutboundNumber, setAssigningOutboundNumber] = useState(false);

    // Global Store State
    const { inboundConfig, outboundConfig, setInboundConfig, setOutboundConfig } = useAgentStore();

    // Prompt checkpoint hook for review-before-save modal
    const checkpoint = usePromptCheckpoint();

    // Multi-tab conflict detection hook
    const conflict = useMultiTabConflictDetection({
        agentType: activeTab,
        agentName: (activeTab === 'inbound' ? inboundConfig : outboundConfig).name || `${activeTab} Agent`,
    });

    // Draft state removed — DB is the single source of truth (PRD rule).
    // These are kept as no-ops so delete handler references don't break.
    const [serverInbound, setServerInbound] = useState<AgentConfig | null>(null);
    const [serverOutbound, setServerOutbound] = useState<AgentConfig | null>(null);

    // Helper to check equality
    const areConfigsEqual = (a: AgentConfig, b: AgentConfig) => {
        return a.name === b.name &&
            a.systemPrompt === b.systemPrompt &&
            a.firstMessage === b.firstMessage &&
            a.voice === b.voice &&
            a.voiceProvider === b.voiceProvider &&
            a.language === b.language &&
            a.maxDuration === b.maxDuration &&
            (a.voiceStability ?? null) === (b.voiceStability ?? null) &&
            (a.voiceSimilarityBoost ?? null) === (b.voiceSimilarityBoost ?? null);
    };

    const [originalInboundConfig, setOriginalInboundConfig] = useState<AgentConfig | null>(null);
    const [originalOutboundConfig, setOriginalOutboundConfig] = useState<AgentConfig | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // SWR hooks — cached, deduplicated, instant on revisit
    const { data: voicesRaw, error: voicesError } = useSWR(
        user ? '/api/assistants/voices/available' : null, fetcher
    );
    const { data: agentData, error: agentError, isLoading: agentLoading } = useSWR(
        user ? '/api/founder-console/agent/config' : null, fetcher
    );
    const { data: inboundRaw } = useSWR(
        user ? '/api/inbound/status' : null, fetcher
    );
    const { data: vapiNumbersData } = useSWR(
        user ? '/api/integrations/vapi/numbers' : null, fetcher
    );
    const { data: phoneSettings, isLoading: phoneSettingsLoading } = useSWR(
        user ? '/api/phone-settings/status' : null, fetcher
    );

    // Derive state from SWR data
    const isLoading = agentLoading && !agentData;

    // Derive direction map: vapiPhoneId/phoneNumber → 'inbound' | 'outbound'
    //
    // Two data sources, applied in priority order (Source 1 wins over Source 2):
    //   1. numbers.inbound[] / numbers.outbound[] arrays — multi-number routing (preferred)
    //   2. Flat inbound/outbound fields — orgs provisioned before multi-number routing (fallback)
    //
    // Within Source 1: inbound is written first, outbound second. If the same number
    // appears in both arrays (data integrity issue upstream), outbound wins — intentional,
    // as outbound assignment is more specific.
    const numberDirectionMap = useMemo((): Record<string, 'inbound' | 'outbound'> => {
        const map: Record<string, 'inbound' | 'outbound'> = {};
        if (!phoneSettings) return map;

        // Source 1: numbers arrays (multi-number routing)
        (phoneSettings.numbers?.inbound as { vapiPhoneId?: string; phoneNumber?: string }[] ?? []).forEach((n) => {
            if (n.vapiPhoneId) map[n.vapiPhoneId] = 'inbound';
            if (n.phoneNumber) map[n.phoneNumber] = 'inbound';
        });
        (phoneSettings.numbers?.outbound as { vapiPhoneId?: string; phoneNumber?: string }[] ?? []).forEach((n) => {
            if (n.vapiPhoneId) map[n.vapiPhoneId] = 'outbound';
            if (n.phoneNumber) map[n.phoneNumber] = 'outbound';
        });

        // Source 2: flat fields (orgs provisioned before multi-number routing).
        // Only sets a key if Source 1 didn't already populate it.
        const setIfAbsent = (key: string | undefined, dir: 'inbound' | 'outbound') => {
            if (key && !(key in map)) map[key] = dir;
        };
        setIfAbsent(phoneSettings.inbound?.vapiPhoneId, 'inbound');
        setIfAbsent(phoneSettings.inbound?.managedNumber, 'inbound');
        setIfAbsent(phoneSettings.outbound?.managedOutboundVapiPhoneId, 'outbound');
        setIfAbsent(phoneSettings.outbound?.managedOutboundNumber, 'outbound');

        return map;
    }, [phoneSettings]);

    // Direction-filtered number arrays for the Agent Config dropdowns.
    // Inbound tab shows only inbound-direction numbers; outbound tab shows only outbound.
    // Numbers with no known direction (falsy, 'unassigned', or BYOC) appear in both tabs.
    // NOTE: 'unassigned' is an explicit DB string — must be handled alongside falsy values
    // so these numbers don't get excluded from both dropdowns silently.
    const inboundNumbers = useMemo(() =>
        vapiNumbers.filter(num => {
            const dir = num.routingDirection || numberDirectionMap[num.id] || numberDirectionMap[num.number];
            return !dir || dir === 'inbound' || dir === 'unassigned';
        }), [vapiNumbers, numberDirectionMap]);

    const outboundNumbers = useMemo(() =>
        vapiNumbers.filter(num => {
            const dir = num.routingDirection || numberDirectionMap[num.id] || numberDirectionMap[num.number];
            return !dir || dir === 'outbound' || dir === 'unassigned';
        }), [vapiNumbers, numberDirectionMap]);

    // Sync voices from SWR
    useEffect(() => {
        if (voicesRaw) {
            setVoices(Array.isArray(voicesRaw) ? voicesRaw : (voicesRaw?.voices || []));
        }
    }, [voicesRaw]);

    // Sync inbound status from SWR
    useEffect(() => {
        if (inboundRaw) {
            setInboundStatus({
                configured: Boolean(inboundRaw?.configured),
                inboundNumber: inboundRaw?.inboundNumber
            });
        }
    }, [inboundRaw]);

    // Sync vapi numbers from SWR
    useEffect(() => {
        if (vapiNumbersData?.success) {
            setVapiNumbers(vapiNumbersData.numbers || []);
        }
    }, [vapiNumbersData]);

    // Sync agent config from SWR — DB is the single source of truth.
    // Always overwrite the in-memory Zustand store with what the DB returns.
    const configSyncedRef = useRef(false);
    useEffect(() => {
        if (!agentData?.agents || configSyncedRef.current) return;
        configSyncedRef.current = true;

        const inboundAgent = agentData.agents.find((a: any) => a.role === 'inbound');
        const outboundAgent = agentData.agents.find((a: any) => a.role === 'outbound');

        if (inboundAgent) {
            const loadedConfig: AgentConfig = {
                name: inboundAgent.name || 'Inbound Agent',
                systemPrompt: inboundAgent.systemPrompt || inboundAgent.system_prompt || '',
                firstMessage: inboundAgent.firstMessage || inboundAgent.first_message || '',
                voice: inboundAgent.voice || '',
                voiceProvider: inboundAgent.voiceProvider || inboundAgent.voice_provider || undefined,
                language: inboundAgent.language || 'en-US',
                maxDuration: inboundAgent.maxCallDuration || inboundAgent.max_call_duration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS,
                voiceStability: inboundAgent.voiceStability ?? null,
                voiceSimilarityBoost: inboundAgent.voiceSimilarityBoost ?? null
            };

            setInboundConfig(loadedConfig);
            setOriginalInboundConfig(loadedConfig);
        }

        if (outboundAgent) {
            const loadedConfig: AgentConfig = {
                name: outboundAgent.name || 'Outbound Agent',
                systemPrompt: outboundAgent.systemPrompt || outboundAgent.system_prompt || '',
                firstMessage: outboundAgent.firstMessage || outboundAgent.first_message || '',
                voice: outboundAgent.voice || '',
                voiceProvider: outboundAgent.voiceProvider || outboundAgent.voice_provider || undefined,
                language: outboundAgent.language || 'en-US',
                maxDuration: outboundAgent.maxCallDuration || outboundAgent.max_call_duration || AGENT_CONFIG_CONSTRAINTS.DEFAULT_DURATION_SECONDS,
                voiceStability: outboundAgent.voiceStability ?? null,
                voiceSimilarityBoost: outboundAgent.voiceSimilarityBoost ?? null
            };

            if (outboundAgent.vapi_phone_number_id || outboundAgent.vapiPhoneNumberId) {
                const phoneId = outboundAgent.vapi_phone_number_id || outboundAgent.vapiPhoneNumberId;
                setSelectedOutboundNumberId(phoneId);
                setOriginalOutboundPhoneNumberId(phoneId);
            }

            setOutboundConfig(loadedConfig);
            setOriginalOutboundConfig(loadedConfig);
        }
    }, [agentData]);

    // Sync SWR errors to local error state
    useEffect(() => {
        if (voicesError) setError('Failed to load available voices. Please refresh the page.');
        else if (agentError) setError('Failed to load agent configuration. Please refresh the page.');
    }, [voicesError, agentError]);

    // Auth redirect
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
            // Clean up voice preview on unmount
            if (previewAbortRef.current) previewAbortRef.current.abort();
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, []);

    const hasValidConfig = (config: AgentConfig): boolean => {
        return !!(config.systemPrompt?.trim() && config.firstMessage?.trim() && config.voice && config.language);
    };

    const hasAgentChanged = (current: AgentConfig, original: AgentConfig | null): boolean => {
        if (!original) return hasValidConfig(current);
        return (
            current.name !== original.name ||
            current.systemPrompt !== original.systemPrompt ||
            current.firstMessage !== original.firstMessage ||
            current.voice !== original.voice ||
            current.voiceProvider !== original.voiceProvider ||
            current.language !== original.language ||
            current.maxDuration !== original.maxDuration ||
            (current.voiceStability ?? null) !== (original.voiceStability ?? null) ||
            (current.voiceSimilarityBoost ?? null) !== (original.voiceSimilarityBoost ?? null)
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

    // Warn user before losing unsaved changes on browser close/refresh
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (inboundChanged || outboundChanged) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [inboundChanged, outboundChanged]);


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

    // Actual save logic (called after checkpoint confirmation)
    const performSave = async () => {
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
                    name: inboundConfig.name,
                    systemPrompt: inboundConfig.systemPrompt,
                    firstMessage: inboundConfig.firstMessage,
                    voiceId: inboundConfig.voice,
                    voiceProvider: inboundConfig.voiceProvider,
                    language: inboundConfig.language,
                    maxDurationSeconds: inboundConfig.maxDuration,
                    voiceStability: inboundConfig.voiceStability ?? null,
                    voiceSimilarityBoost: inboundConfig.voiceSimilarityBoost ?? null,
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
                    name: outboundConfig.name,
                    systemPrompt: outboundConfig.systemPrompt,
                    firstMessage: outboundConfig.firstMessage,
                    voiceId: outboundConfig.voice,
                    voiceProvider: outboundConfig.voiceProvider,
                    language: outboundConfig.language,
                    maxDurationSeconds: outboundConfig.maxDuration,
                    vapiPhoneNumberId: selectedOutboundNumberId || null,
                    voiceStability: outboundConfig.voiceStability ?? null,
                    voiceSimilarityBoost: outboundConfig.voiceSimilarityBoost ?? null,
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

            // Warn if tools failed to sync (agent saved but tools not registered)
            if (result?.toolsSynced === false) {
                setError('Agent saved, but tools failed to sync to Vapi. Please try saving again. If the issue persists, contact support.');
            }

            setSaveSuccess(true);

            // Broadcast save to other tabs for conflict detection
            conflict.broadcastSave();

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

    // Wrapper: Check for conflicts, then show checkpoint before actual save
    const handleSave = async () => {
        // Block save if another tab modified the config
        if (!conflict.canSave()) {
            setError('Another tab has modified this agent. Please refresh to see the latest changes.');
            return;
        }

        const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;

        // Show prompt checkpoint before saving
        checkpoint.show(
            {
                agentName: currentConfig.name || `${activeTab} Agent`,
                systemPrompt: currentConfig.systemPrompt,
                firstMessage: currentConfig.firstMessage,
            },
            {
                onConfirm: async () => {
                    checkpoint.setLoading(true);
                    try {
                        await performSave();
                        checkpoint.close();
                    } finally {
                        checkpoint.setLoading(false);
                    }
                },
                onCancel: () => {
                    checkpoint.close();
                }
            }
        );
    };

    const handleTestInbound = async () => {
        setError(null);

        // Pre-flight balance check: Minimum 79 pence required for a test call
        try {
            const wallet = await authedBackendFetch<any>('/api/billing/wallet');
            if ((wallet?.balance_pence || 0) < 79) {
                setError(`Insufficient balance (${formatPence(wallet?.balance_pence || 0)}). Minimum £0.79 required for test calls. Please top up your wallet first.`);
                return;
            }
        } catch {
            // Non-blocking: if wallet check fails, let the webhook handle it
        }

        const inboundError = validateAgentConfig(inboundConfig, 'inbound');
        if (inboundError) {
            setError(inboundError);
            return;
        }

        // FIX: Auto-save unsaved changes before testing so the browser test
        // uses the config the user sees in the UI, not stale DB data.
        if (inboundChanged) {
            setIsSaving(true);
            setSavingAgent('inbound');
            try {
                const payload = {
                    inbound: {
                        name: inboundConfig.name,
                        systemPrompt: inboundConfig.systemPrompt,
                        firstMessage: inboundConfig.firstMessage,
                        voiceId: inboundConfig.voice,
                        voiceProvider: inboundConfig.voiceProvider,
                        language: inboundConfig.language,
                        maxDurationSeconds: inboundConfig.maxDuration,
                        voiceStability: inboundConfig.voiceStability ?? null,
                        voiceSimilarityBoost: inboundConfig.voiceSimilarityBoost ?? null,
                    }
                };
                const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                    timeoutMs: 30000,
                    retries: 1,
                });
                if (!result?.success) {
                    throw new Error(result?.error || 'Failed to save before testing');
                }
                setOriginalInboundConfig(inboundConfig);
            } catch (err) {
                console.error('Auto-save before test failed:', err);
                setError(err instanceof Error ? err.message : 'Failed to save changes before testing. Please save manually first.');
                setIsSaving(false);
                setSavingAgent(null);
                return;
            } finally {
                setIsSaving(false);
                setSavingAgent(null);
            }
        }

        router.push('/dashboard/test?tab=web&autostart=1');
    };

    const handleTestOutbound = async () => {
        try {
            setError(null);

            // Pre-flight balance check: Minimum 79 pence required for a test call
            try {
                const wallet = await authedBackendFetch<any>('/api/billing/wallet');
                if ((wallet?.balance_pence || 0) < 79) {
                    setError(`Insufficient balance (${formatPence(wallet?.balance_pence || 0)}). Minimum £0.79 required for test calls. Please top up your wallet first.`);
                    return;
                }
            } catch {
                // Non-blocking: if wallet check fails, let the webhook handle it
            }

            const outboundError = validateAgentConfig(outboundConfig, 'outbound');
            if (outboundError) {
                setError(outboundError);
                return;
            }

            // FIX: Auto-save unsaved changes before testing (same fix as inbound)
            if (outboundChanged) {
                setIsSaving(true);
                setSavingAgent('outbound');
                try {
                    const payload = {
                        outbound: {
                            name: outboundConfig.name,
                            systemPrompt: outboundConfig.systemPrompt,
                            firstMessage: outboundConfig.firstMessage,
                            voiceId: outboundConfig.voice,
                            voiceProvider: outboundConfig.voiceProvider,
                            language: outboundConfig.language,
                            maxDurationSeconds: outboundConfig.maxDuration,
                            vapiPhoneNumberId: selectedOutboundNumberId || null,
                            voiceStability: outboundConfig.voiceStability ?? null,
                            voiceSimilarityBoost: outboundConfig.voiceSimilarityBoost ?? null,
                        }
                    };
                    const result = await authedBackendFetch<any>('/api/founder-console/agent/behavior', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                        timeoutMs: 30000,
                        retries: 1,
                    });
                    if (!result?.success) {
                        throw new Error(result?.error || 'Failed to save before testing');
                    }
                    setOriginalOutboundConfig(outboundConfig);
                } catch (saveErr) {
                    console.error('Auto-save before test failed:', saveErr);
                    setError(saveErr instanceof Error ? saveErr.message : 'Failed to save changes before testing. Please save manually first.');
                    setIsSaving(false);
                    setSavingAgent(null);
                    return;
                } finally {
                    setIsSaving(false);
                    setSavingAgent(null);
                }
            }

            router.push('/dashboard/test?tab=phone');
        } catch (err) {
            console.error('Failed to start outbound test:', err);
            setError(err instanceof Error ? err.message : 'Failed to start outbound test');
        }
    };

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            setError(null);

            const response = await authedBackendFetch<any>(
                `/api/founder-console/agent/${activeTab}`,
                {
                    method: 'DELETE',
                }
            );

            if (!response?.success) {
                throw new Error(response?.error || 'Failed to delete agent');
            }

            // Clear local state
            if (activeTab === 'inbound') {
                setInboundConfig(INITIAL_CONFIG);
                setOriginalInboundConfig(null);
                setServerInbound(null);
                setSelectedNumberId('');
            } else {
                setOutboundConfig(INITIAL_CONFIG);
                setOriginalOutboundConfig(null);
                setServerOutbound(null);
                setSelectedOutboundNumberId('');
            }

            setShowDeleteModal(false);

        } catch (error: any) {
            setError(error.message || 'Failed to delete agent');
            setShowDeleteModal(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const applyTemplate = (templateId: string, type: 'inbound' | 'outbound') => {
        const templates = type === 'inbound' ? PROMPT_TEMPLATES : OUTBOUND_PROMPT_TEMPLATES;
        const template = templates.find(t => t.id === templateId);
        if (!template) return;

        // Confirm before overwriting a custom (non-template) prompt
        const currentPrompt = type === 'inbound' ? inboundConfig.systemPrompt : outboundConfig.systemPrompt;
        if (currentPrompt && currentPrompt.trim().length > 0) {
            const allTemplates = [...PROMPT_TEMPLATES, ...OUTBOUND_PROMPT_TEMPLATES];
            const isFromTemplate = allTemplates.some(t => t.systemPrompt === currentPrompt);
            if (!isFromTemplate && !window.confirm(
                `Selecting "${template.name}" will replace your current system prompt and first message. Continue?`
            )) return;
        }

        if (type === 'inbound') {
            setInboundConfig({
                ...inboundConfig,
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
            setSelectedInboundTemplateId(templateId);
        } else {
            setOutboundConfig({
                ...outboundConfig,
                systemPrompt: template.systemPrompt,
                firstMessage: template.firstMessage
            });
            setSelectedOutboundTemplateId(templateId);
        }
    };

    // Reset all preview state to idle
    const resetPreviewState = () => {
        setIsPreviewing(false);
        setPreviewPhase('idle');
        setPreviewingVoiceId(null);
    };

    const handleStopPreview = () => {
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        if (previewAbortRef.current) {
            previewAbortRef.current.abort();
        }
        resetPreviewState();
    };

    const handlePreviewVoice = async (voiceId: string, provider: string) => {
        if (isPreviewing) return; // prevent double-clicks

        // Abort any in-flight preview request
        if (previewAbortRef.current) {
            previewAbortRef.current.abort();
        }

        // Stop any existing preview audio
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }

        setIsPreviewing(true);
        setPreviewPhase('loading');
        setPreviewingVoiceId(voiceId);

        const controller = new AbortController();
        previewAbortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;

            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
            const res = await fetch(`${backendUrl}/api/founder-console/agent/voice-preview`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                credentials: 'include',
                body: JSON.stringify({ voiceId, provider }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const contentType = res.headers.get('content-type') || '';

            if (contentType.includes('application/json')) {
                const data = await res.json();
                if (data.previewUnavailable) {
                    toastWarning(data.message || 'Voice preview not available. Use Test Call instead.');
                } else {
                    setError(data.error || 'Voice preview failed.');
                    setTimeout(() => setError(null), 5000);
                }
                resetPreviewState();
                return;
            }

            if (!res.ok) {
                toastWarning('Voice preview failed. Please try Test Call instead.');
                resetPreviewState();
                return;
            }

            // Audio binary — stream as blob and play
            const arrayBuffer = await res.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            previewAudioRef.current = audio;
            audio.onended = () => {
                resetPreviewState();
                URL.revokeObjectURL(url);
                previewAudioRef.current = null;
            };
            audio.onerror = () => {
                resetPreviewState();
                URL.revokeObjectURL(url);
                previewAudioRef.current = null;
            };
            try {
                await audio.play();
                setPreviewPhase('playing');
            } catch (playError: any) {
                toastWarning('Browser blocked audio playback. Click the page first, then try again.');
                resetPreviewState();
                URL.revokeObjectURL(url);
                previewAudioRef.current = null;
            }
        } catch (err: any) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') {
                resetPreviewState();
                return;
            }
            toastWarning(err?.message || 'Voice preview failed. Try Test Call instead.');
            resetPreviewState();
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
                success('Agent successfully assigned to phone number!');
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

    const handleAssignOutboundNumber = async () => {
        if (!selectedOutboundNumberId) return;
        try {
            setAssigningOutboundNumber(true);
            setError(null);

            const selectedNumObj = vapiNumbers.find(n => n.id === selectedOutboundNumberId);
            const phoneNumber = selectedNumObj?.number;

            const result = await authedBackendFetch<any>('/api/integrations/vapi/assign-number', {
                method: 'POST',
                body: JSON.stringify({
                    phoneNumberId: selectedOutboundNumberId,
                    role: 'outbound'
                })
            });

            if (result.success) {
                // Update the original value to reflect the newly assigned number
                setOriginalOutboundPhoneNumberId(selectedOutboundNumberId);
                success('Phone number assigned successfully to outbound agent!');
            } else {
                throw new Error(result.error || 'Assignment failed');
            }
        } catch (err: any) {
            console.error('Failed to assign outbound number:', err);
            setError(err.message || 'Failed to assign phone number');
        } finally {
            setAssigningOutboundNumber(false);
        }
    };

    if (!user && !loading) return null;

    const currentConfig = activeTab === 'inbound' ? inboundConfig : outboundConfig;
    const setConfig = activeTab === 'inbound' ? setInboundConfig : setOutboundConfig;
    const templates = activeTab === 'inbound' ? PROMPT_TEMPLATES : OUTBOUND_PROMPT_TEMPLATES;

    // Wrapper to adapt handlePreviewVoice to accept only voiceId
    // The provider is determined from the voice object
    const handlePreviewVoiceAdapter = (voiceId: string) => {
        const voice = voices.find(v => v.id === voiceId);
        if (voice) {
            return handlePreviewVoice(voiceId, voice.provider);
        }
    };

    return (
        <div className="min-h-screen bg-clinical-bg pb-20">
            {/* Sticky Header */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-surgical-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-obsidian flex items-center gap-2">
                                <Bot className="w-6 h-6 text-surgical-600" />
                                Agent Configuration
                            </h1>
                            <p className="text-sm text-obsidian/60">
                                Configure behavior and settings for your AI agents
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {activeTab === 'inbound' ? (
                                <button
                                    onClick={handleTestInbound}
                                    className="px-4 py-2 rounded-lg bg-surgical-50 text-obsidian/60 hover:bg-surgical-100 font-medium transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Globe className="w-4 h-4" />
                                    Test in Browser
                                </button>
                            ) : (
                                <button
                                    onClick={handleTestOutbound}
                                    className="px-4 py-2 rounded-lg bg-surgical-50 text-obsidian/60 hover:bg-surgical-100 font-medium transition-colors flex items-center gap-2 text-sm"
                                >
                                    <Phone className="w-4 h-4" />
                                    Test Call
                                </button>
                            )}

                            <button
                                onClick={handleSave}
                                disabled={!hasActiveTabChanges() || isSaving}
                                className={`px-6 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 text-sm ${saveSuccess
                                    ? 'bg-surgical-50 text-surgical-600 border border-surgical-200'
                                    : hasActiveTabChanges()
                                        ? 'bg-surgical-600 hover:bg-surgical-700 text-white shadow-surgical-500/20'
                                        : 'bg-surgical-50 text-obsidian/40 cursor-not-allowed border border-surgical-200'
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

                            {/* Delete Button - Show only if agent exists */}
                            {(activeTab === 'inbound' ? originalInboundConfig : originalOutboundConfig) && (
                                <button
                                    onClick={() => setShowDeleteModal(true)}
                                    disabled={isSaving || isDeleting}
                                    className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium text-sm shadow-sm"
                                    title="Delete this agent"
                                >
                                    <svg
                                        className="w-4 h-4"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                    </svg>
                                    <span className="hidden sm:inline">Delete Agent</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex items-center gap-1 mt-6 border-b border-surgical-200">
                        <button
                            onClick={() => {
                                handleStopPreview();
                                setActiveTab('inbound');
                                setAdvancedVoiceOpen(false);
                                router.push('/dashboard/agent-config?agent=inbound');
                            }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'inbound'
                                ? 'border-surgical-600 text-surgical-600'
                                : 'border-transparent text-obsidian/60 hover:text-obsidian'
                                }`}
                        >
                            <Phone className="w-4 h-4" />
                            Inbound Agent
                        </button>
                        <button
                            onClick={() => {
                                handleStopPreview();
                                setActiveTab('outbound');
                                setAdvancedVoiceOpen(false);
                                router.push('/dashboard/agent-config?agent=outbound');
                            }}
                            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'outbound'
                                ? 'border-surgical-600 text-surgical-600'
                                : 'border-transparent text-obsidian/60 hover:text-obsidian'
                                }`}
                        >
                            <ArrowRight className="w-4 h-4" />
                            Outbound Agent
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 text-surgical-600 animate-spin" />
                    </div>
                )}

                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {error}
                    </div>
                )}


                {/* Unified Agent Configuration Form - Replaces ~360 lines of duplicated form JSX */}
                {!isLoading && (
                    <UnifiedAgentConfigForm
                        agentType={activeTab}
                        config={currentConfig}
                        originalConfig={activeTab === 'inbound' ? originalInboundConfig : originalOutboundConfig}
                        inboundStatus={inboundStatus || undefined}
                        outboundNumberId={selectedOutboundNumberId}
                        vapiNumbers={vapiNumbers}
                        hasChanges={hasActiveTabChanges()}
                        isSaving={isSaving}
                        saveSuccess={saveSuccess && savingAgent === activeTab}
                        error={error || undefined}
                        isDeleting={isDeleting}
                        previewingVoiceId={previewingVoiceId}
                        previewPhase={previewPhase}
                        personas={templates}
                        voices={voices}
                        advancedVoiceOpen={advancedVoiceOpen}
                        onAdvancedVoiceToggle={setAdvancedVoiceOpen}
                        onConfigChange={(updates) => {
                            setConfig({ ...currentConfig, ...updates });
                        }}
                        onSave={handleSave}
                        onPreviewVoice={handlePreviewVoiceAdapter}
                        onStopPreview={handleStopPreview}
                        onDelete={() => setShowDeleteModal(true)}
                        onTestCall={activeTab === 'inbound' ? handleTestInbound : handleTestOutbound}
                    />
                )}
            </div>

            {/* Prompt Checkpoint Modal - Review before save */}
            {checkpoint.isOpen && (
                <PromptCheckpointModal
                    isOpen={checkpoint.isOpen}
                    agentName={checkpoint.agentName}
                    systemPrompt={checkpoint.systemPrompt}
                    firstMessage={checkpoint.firstMessage}
                    isLoading={checkpoint.isLoading}
                    onConfirm={checkpoint.handleConfirm}
                    onCancel={checkpoint.handleCancel}
                    onEdit={checkpoint.handleEdit}
                />
            )}

            {/* Multi-Tab Conflict Alert */}
            <MultiTabConflictAlert
                isVisible={conflict.hasConflict}
                message={conflict.conflictMessage}
                conflictingAgentName={conflict.conflictingTab?.agentName}
                onDismiss={conflict.clearConflict}
                onRefresh={() => window.location.reload()}
            />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-red-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-3 bg-red-50 rounded-full">
                                <AlertCircle className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold text-obsidian">
                                Delete {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Agent
                            </h3>
                        </div>

                        <div className="mb-6 space-y-3">
                            <p className="text-obsidian/60">
                                Are you sure you want to delete this agent? This action cannot be undone.
                            </p>

                            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium text-red-700">
                                    What will be deleted:
                                </p>
                                <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                                    <li>Agent configuration (name, prompts, voice, settings)</li>
                                    <li>Phone number assignment (if any)</li>
                                    <li>VAPI assistant registration</li>
                                </ul>
                            </div>

                            <div className="bg-surgical-50 border border-surgical-200 rounded-lg p-4 space-y-2">
                                <p className="text-sm font-medium text-obsidian">
                                    What will be preserved:
                                </p>
                                <ul className="text-sm text-obsidian/60 space-y-1 ml-4 list-disc">
                                    <li>Historical call logs (for compliance)</li>
                                    <li>Appointment records</li>
                                    <li>Contact database</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-surgical-100 text-obsidian/60 rounded-lg hover:bg-surgical-200 transition-colors disabled:opacity-50 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete Agent'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
