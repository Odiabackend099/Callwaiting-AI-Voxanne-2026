'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Phone, AlertCircle, Loader2, Volume2, Globe, Activity, StopCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
// LeftSidebar removed (now in layout)
import { useVoiceAgentContext } from '@/contexts/VoiceAgentContext';
import { motion, AnimatePresence } from 'framer-motion';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

// E.164 phone validation
const E164_REGEX = /^\+[1-9]\d{1,14}$/;

// Config caching
const CACHE_KEY = 'outbound_config_cache';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface InboundStatus {
    configured: boolean;
    inboundNumber?: string;
    vapiPhoneNumberId?: string;
}

function setVoiceSessionActiveFlag(active: boolean) {
    if (typeof window === 'undefined') return;
    try {
        if (active) {
            window.sessionStorage.setItem('voice_session_active', 'true');
        } else {
            window.sessionStorage.removeItem('voice_session_active');
        }
    } catch {
        // ignore
    }
}

interface CachedConfig {
    data: any;
    timestamp: number;
    missingFields?: string[];
}

function getCachedConfig(): CachedConfig | null {
    if (typeof window === 'undefined') return null;
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;

    try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp > CACHE_TTL_MS) {
            localStorage.removeItem(CACHE_KEY);
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}

function setCachedConfig(data: any, missingFields?: string[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now(),
        missingFields
    }));
}

const TestAgentPageContent = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, loading } = useAuth();

    // Initialize activeTab from query param if present
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'web' || tabParam === 'phone') ? tabParam : 'web';
    const [activeTab, setActiveTab] = useState<'web' | 'phone'>(initialTab);

    // --- Web Test State ---
    const {
        isConnected,
        isRecording,
        transcripts,
        error: voiceError,
        startCall,
        stopCall,
        startRecording,
        stopRecording
    } = useVoiceAgentContext();

    const [displayTranscripts, setDisplayTranscripts] = useState<any[]>([]);
    const [callInitiating, setCallInitiating] = useState(false);
    const transcriptEndRef = useRef<HTMLDivElement>(null);

    // --- Phone Test State ---
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isCallingPhone, setIsCallingPhone] = useState(false);
    const [phoneCallId, setPhoneCallId] = useState<string | null>(null);
    const [outboundTrackingId, setOutboundTrackingId] = useState<string | null>(null);
    const [outboundConnected, setOutboundConnected] = useState(false);
    const [outboundTranscripts, setOutboundTranscripts] = useState<any[]>([]);
    const [outboundConfigLoaded, setOutboundConfigLoaded] = useState(false);
    const [outboundConfigLoading, setOutboundConfigLoading] = useState(false);
    const [outboundConfigError, setOutboundConfigError] = useState<string | null>(null);
    const [outboundConfigMissingFields, setOutboundConfigMissingFields] = useState<string[]>([]);
    const [inboundStatus, setInboundStatus] = useState<InboundStatus | null>(null);
    const [wsConnectionStatus, setWsConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
    const [callSummary, setCallSummary] = useState<any>(null);
    const outboundWsRef = useRef<WebSocket | null>(null);
    const outboundTranscriptEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);


    // --- Web Test Effects ---
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

    useEffect(() => {
        if (activeTab === 'web') {
            transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [displayTranscripts, activeTab]);

    const handleToggleWebCall = async () => {
        if (isConnected) {
            stopRecording();
            await stopCall();
        } else {
            setCallInitiating(true);
            try {
                await startCall();
                // Wait a moment for connection to stabilize before recording
            } catch (err) {
                console.error('Failed to start web call', err);
            } finally {
                setCallInitiating(false);
            }
        }
    };

    useEffect(() => {
        setVoiceSessionActiveFlag(isConnected || isRecording);
        return () => {
            setVoiceSessionActiveFlag(false);
        };
    }, [isConnected, isRecording]);

    // --- Phone Test Effects ---
    const getAuthToken = async () => {
        return (await supabase.auth.getSession()).data.session?.access_token;
    };

    // Load outbound agent config before making phone calls
    useEffect(() => {
        const loadInboundStatus = async () => {
            try {
                const data = await authedBackendFetch<any>('/api/inbound/status');
                setInboundStatus({
                    configured: Boolean(data?.configured),
                    inboundNumber: data?.inboundNumber,
                    vapiPhoneNumberId: data?.vapiPhoneNumberId
                });
            } catch {
                setInboundStatus(null);
            }
        };

        const loadOutboundConfig = async () => {
            // Check cache first
            const cached = getCachedConfig();
            if (cached) {
                if (cached.missingFields && cached.missingFields.length > 0) {
                    setOutboundConfigError('Outbound agent configuration is incomplete');
                    setOutboundConfigMissingFields(cached.missingFields);
                    setOutboundConfigLoaded(false);
                } else {
                    setOutboundConfigLoaded(true);
                    setOutboundConfigError(null);
                    setOutboundConfigMissingFields([]);
                    setCachedConfig(cached.data); // Cache hit, update timestamp
                }
                return;
            }

            setOutboundConfigLoading(true);
            try {
                const agentData = await authedBackendFetch<any>('/api/founder-console/agent/config');
                const outboundAgent = agentData?.agents?.find((a: any) => a.role === 'outbound');
                const config = outboundAgent || {};
                const missingFields = [];
                if (!config.system_prompt) missingFields.push('System Prompt');

                if (missingFields.length > 0) {
                    setOutboundConfigError('Outbound agent configuration is incomplete');
                    setOutboundConfigMissingFields(missingFields);
                    setOutboundConfigLoaded(false);
                    setCachedConfig(config, missingFields);
                } else {
                    setOutboundConfigLoaded(true);
                    setOutboundConfigError(null);
                    setOutboundConfigMissingFields([]);
                    setCachedConfig(config);
                }
            } catch (err) {
                console.error('Error loading outbound config:', err);
                setOutboundConfigError('Failed to load outbound agent configuration');
                setOutboundConfigLoaded(false);
            } finally {
                setOutboundConfigLoading(false);
            }
        };

        if (activeTab === 'phone' && user) {
            loadInboundStatus();
            loadOutboundConfig();
        }
    }, [activeTab, user]);

    const validatePhoneNumber = (phone: string): boolean => {
        if (!phone) {
            setPhoneValidationError('Phone number is required');
            return false;
        }
        if (!E164_REGEX.test(phone)) {
            setPhoneValidationError('Phone number must be in E.164 format (e.g., +1234567890)');
            return false;
        }
        setPhoneValidationError(null);
        return true;
    };

    const handleInitiateCall = () => {
        if (!validatePhoneNumber(phoneNumber)) return;
        setShowConfirmDialog(true);
    };

    const handleConfirmCall = async () => {
        setShowConfirmDialog(false);
        if (!phoneNumber) return;

        if (!outboundConfigLoaded) {
            return;
        }

        setIsCallingPhone(true);
        setCallSummary(null);
        try {
            const data = await authedBackendFetch<any>('/api/founder-console/agent/web-test-outbound', {
                method: 'POST',
                body: JSON.stringify({ phoneNumber }),
                timeoutMs: 30000,
                retries: 1,
            });
            if (data.trackingId) {
                setOutboundTrackingId(data.trackingId);
                setPhoneCallId(data.callId);
            }
        } catch (err) {
            console.error('Phone call failed:', err);
            alert((err as any).message || 'Failed to start phone call');
        } finally {
            setIsCallingPhone(false);
        }
    };

    const handleEndPhoneCall = async () => {
        if (outboundWsRef.current) {
            outboundWsRef.current.close();
            outboundWsRef.current = null;
        }

        // Fetch call summary
        if (outboundTrackingId) {
            try {
                const summary = await authedBackendFetch<any>(`/api/founder-console/calls/${outboundTrackingId}/state`);
                setCallSummary(summary);
            } catch (err) {
                console.error('Failed to fetch call summary:', err);
            }
        }

        setOutboundTrackingId(null);
        setOutboundConnected(false);
        setWsConnectionStatus('disconnected');
    };

    // Connect to main WebSocket for live call transcripts
    useEffect(() => {
        if (activeTab !== 'phone' || !outboundTrackingId) {
            if (outboundWsRef.current) {
                outboundWsRef.current.close();
                outboundWsRef.current = null;
            }
            return;
        }

        const connectWebSocket = async () => {
            const token = await getAuthToken();
            if (!token) return;

            try {
                setWsConnectionStatus('connecting');
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const backendUrl = new URL(API_BASE_URL);
                const wsHost = backendUrl.host;
                const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

                const ws = new WebSocket(wsUrl);
                outboundWsRef.current = ws;

                ws.onopen = () => {
                    console.log('[LiveCall] WebSocket connected');
                    setWsConnectionStatus('connected');
                    setOutboundConnected(true);
                    ws.send(JSON.stringify({ type: 'subscribe', token }));
                };

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.trackingId !== outboundTrackingId) return;

                        if (data.type === 'transcript') {
                            const speaker = data.speaker === 'agent' ? 'agent' : 'user';
                            const newTranscript = {
                                id: `${outboundTrackingId}_${Date.now()}_${Math.random()}`,
                                speaker,
                                text: data.text,
                                isFinal: data.is_final === true,
                                confidence: data.confidence || 0.95,
                                timestamp: new Date()
                            };

                            setOutboundTranscripts(prev => [...prev, newTranscript].slice(-100));
                            // Auto-scroll
                            setTimeout(() => {
                                outboundTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                            }, 100);
                        } else if (data.type === 'call_ended') {
                            handleEndPhoneCall();
                        }
                    } catch (e) {
                        console.error('WebSocket message error', e);
                    }
                };

                ws.onerror = (error) => {
                    console.error('[LiveCall] WebSocket error:', error);
                    setWsConnectionStatus('disconnected');
                };

                ws.onclose = () => {
                    console.log('[LiveCall] WebSocket closed');
                    setWsConnectionStatus('disconnected');
                    setOutboundConnected(false);
                };

            } catch (err) {
                console.error('WebSocket connection failed', err);
                setWsConnectionStatus('disconnected');
            }
        };

        connectWebSocket();

        return () => {
            if (outboundWsRef.current) {
                outboundWsRef.current.close();
                outboundWsRef.current = null;
            }
        };
    }, [activeTab, outboundTrackingId]);


    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Test Agent</h1>
                <p className="text-gray-700">Interact with your agent in real-time to verify behavior.</p>
            </div>

            {/* Tabs */}
            <div className="bg-gray-100 p-1 rounded-xl inline-flex mb-8">
                <button
                    onClick={() => setActiveTab('web')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'web'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    <Globe className="w-4 h-4" />
                    Browser Test
                </button>
                <button
                    onClick={() => setActiveTab('phone')}
                    className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'phone'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800'
                        }`}
                >
                    <Phone className="w-4 h-4" />
                    Live Call
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden min-h-[500px] flex flex-col">

                {/* --- Web Test Interface --- */}
                {activeTab === 'web' && (
                    <div className="flex flex-col h-full">
                        {/* Header / Controls */}
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-300'}`} />
                                <span className="font-medium text-gray-700">
                                    {isConnected ? 'Connected' : 'Ready to Connect'}
                                </span>
                            </div>

                            <button
                                onClick={handleToggleWebCall}
                                disabled={callInitiating}
                                className={`px-6 py-2.5 rounded-lg font-semibold text-white shadow-sm transition-all flex items-center gap-2 ${isConnected
                                    ? 'bg-red-500 hover:bg-red-600'
                                    : 'bg-emerald-600 hover:bg-emerald-700'
                                    }`}
                            >
                                {callInitiating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Connecting...
                                    </>
                                ) : isConnected ? (
                                    <>
                                        <StopCircle className="w-5 h-5" />
                                        End Session
                                    </>
                                ) : (
                                    <>
                                        <PlayCircle className="w-5 h-5" />
                                        Start Session
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Transcript Area */}
                        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-white relative">
                            {displayTranscripts.length === 0 ? (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                                    <Mic className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="text-lg font-medium">Start the session to begin speaking</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {displayTranscripts.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[80%] rounded-2xl px-5 py-3 ${t.speaker === 'user'
                                                ? 'bg-blue-500 text-white rounded-tr-none'
                                                : 'bg-gray-100 text-gray-800 rounded-tl-none'
                                                }`}>
                                                <p className="text-sm font-medium opacity-75 mb-1 text-xs uppercase tracking-wider">
                                                    {t.speaker === 'user' ? 'You' : 'Agent'}
                                                </p>
                                                <p className="leading-relaxed">
                                                    {t.text}
                                                    {!t.isFinal && <span className="animate-pulse">...</span>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={transcriptEndRef} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- Phone Test Interface --- */}
                {activeTab === 'phone' && (
                    <div className="flex flex-col h-full">
                        <div className="p-8 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                    <Phone className="w-8 h-8 text-blue-600" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Live Call Test</h2>
                                <p className="text-gray-500">Enter your phone number to receive a test call from your agent.</p>

                                <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left">
                                    <p className="text-xs text-gray-600 font-medium uppercase">Caller ID</p>
                                    <p className="text-sm text-gray-900">
                                        {inboundStatus?.configured && inboundStatus.inboundNumber
                                            ? inboundStatus.inboundNumber
                                            : 'Inbound not configured yet'}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">Outbound calls always use your inbound number.</p>
                                </div>

                                {/* WebSocket Connection Status */}
                                {outboundTrackingId && (
                                    <div className="mt-4 flex items-center justify-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${wsConnectionStatus === 'connected' ? 'bg-green-500' : wsConnectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-300'}`} />
                                        <span className="text-xs text-gray-600">
                                            {wsConnectionStatus === 'connected' ? 'Live transcript connected' : wsConnectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Config Loading State */}
                            {outboundConfigLoading && (
                                <div className="text-center space-y-4">
                                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                                    <p className="text-gray-600">Loading outbound configuration...</p>
                                </div>
                            )}

                            {/* Config Error State */}
                            {!outboundConfigLoading && outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-red-900">{outboundConfigError}</p>
                                                {outboundConfigMissingFields.length > 0 && (
                                                    <div className="mt-2">
                                                        <p className="text-sm text-red-700">Missing fields:</p>
                                                        <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                                                            {outboundConfigMissingFields.map((field, idx) => (
                                                                <li key={idx}>{field}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => router.push('/dashboard/agent-config')}
                                        className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                                    >
                                        Go to Agent Configuration
                                    </button>
                                </div>
                            )}

                            {/* Call Summary (Post-Call) */}
                            {callSummary && !outboundTrackingId && (
                                <div className="space-y-4">
                                    <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                                        <h3 className="text-lg font-bold text-gray-900 mb-4">Call Summary</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium uppercase">Status</p>
                                                <p className="text-sm text-gray-900 capitalize">{callSummary.status || 'Completed'}</p>
                                            </div>
                                            {callSummary.durationSeconds && (
                                                <div>
                                                    <p className="text-xs text-gray-600 font-medium uppercase">Duration</p>
                                                    <p className="text-sm text-gray-900">{Math.floor(callSummary.durationSeconds / 60)}m {callSummary.durationSeconds % 60}s</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-gray-600 font-medium uppercase">Tracking ID</p>
                                                <p className="text-sm text-gray-900 font-mono">{callSummary.trackingId}</p>
                                            </div>
                                            {callSummary.transcripts && callSummary.transcripts.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-gray-600 font-medium uppercase mb-2">Last Transcript Lines</p>
                                                    <div className="space-y-2">
                                                        {callSummary.transcripts.slice(-5).map((t: any, idx: number) => (
                                                            <div key={idx} className="text-sm">
                                                                <span className={`font-bold ${t.speaker === 'agent' ? 'text-blue-600' : 'text-gray-700'}`}>
                                                                    {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                                </span>
                                                                <span className="text-gray-800">{t.text}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => router.push('/dashboard/calls?tab=outbound')}
                                            className="flex-1 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                                        >
                                            View in Calls Dashboard
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCallSummary(null);
                                                setPhoneNumber('');
                                                setOutboundTranscripts([]);
                                            }}
                                            className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                        >
                                            New Test
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Call Initiation Form */}
                            {!outboundConfigLoading && !outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                setPhoneNumber(e.target.value);
                                                setPhoneValidationError(null);
                                            }}
                                            placeholder="+15551234567"
                                            className={`w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg ${phoneValidationError ? 'border-red-500' : 'border-gray-200'}`}
                                        />
                                        {phoneValidationError && (
                                            <p className="text-xs text-red-600 mt-1">{phoneValidationError}</p>
                                        )}
                                        {!phoneValidationError && (
                                            <p className="text-xs text-gray-500 mt-1">Must be in E.164 format (e.g., +1234567890)</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleInitiateCall}
                                        disabled={isCallingPhone || !phoneNumber}
                                        className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {isCallingPhone ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                Initiating Call...
                                            </>
                                        ) : (
                                            <>
                                                <Phone className="w-6 h-6" />
                                                Call Me Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Active Call State */}
                            {outboundTrackingId && !callSummary && (
                                <div className="text-center space-y-6">
                                    <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                                        <Activity className="w-12 h-12 text-emerald-500 mx-auto mb-3 animate-pulse" />
                                        <h3 className="text-lg font-bold text-emerald-800">Call In Progress</h3>
                                        <p className="text-emerald-600">Check your phone!</p>
                                    </div>

                                    <button
                                        onClick={handleEndPhoneCall}
                                        className="px-8 py-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium transition-all"
                                    >
                                        End Test Session
                                    </button>

                                    {/* Live Transcript Preview */}
                                    {outboundTranscripts.length > 0 && (
                                        <div className="mt-8 text-left bg-gray-50 rounded-xl p-4 max-h-64 overflow-y-auto border border-gray-200">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Live Transcript</p>
                                            <div className="space-y-3">
                                                {outboundTranscripts.map((t, i) => (
                                                    <div key={i} className="text-sm">
                                                        <span className={`font-bold ${t.speaker === 'agent' ? 'text-blue-600' : 'text-gray-700'}`}>
                                                            {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                        </span>
                                                        <span className="text-gray-800">{t.text}</span>
                                                    </div>
                                                ))}
                                                <div ref={outboundTranscriptEndRef} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Confirmation Dialog */}
                {showConfirmDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
                            <h3 className="text-xl font-bold text-gray-900 mb-2">Confirm Test Call</h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to place a test call to <span className="font-mono font-bold">{phoneNumber}</span>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmCall}
                                    className="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                                >
                                    Confirm Call
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

    );
};

export default function TestAgentPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        }>
            <TestAgentPageContent />
        </React.Suspense>
    );
}

