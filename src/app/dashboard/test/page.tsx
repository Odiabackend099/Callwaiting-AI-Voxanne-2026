'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Phone, AlertCircle, Loader2, Volume2, Globe, Activity, StopCircle, PlayCircle, MicOff, ArrowDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import { supabase } from '@/lib/supabase';
// LeftSidebar removed (now in layout)
import { useVoiceAgentContext } from '@/contexts/VoiceAgentContext';
import { motion, AnimatePresence } from 'framer-motion';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

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
    const { error: showErrorToast } = useToast();

    // Initialize activeTab and autostart from query params
    const tabParam = searchParams.get('tab');
    const initialTab = (tabParam === 'web' || tabParam === 'phone') ? tabParam : 'web';
    const [activeTab, setActiveTab] = useState<'web' | 'phone'>(initialTab);
    const autostartParam = searchParams.get('autostart') === '1';
    const autostartFiredRef = useRef(false);

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
    const [isMuted, setIsMuted] = useState(false);
    const [showScrollButton, setShowScrollButton] = useState(false);
    const transcriptEndRef = useRef<HTMLDivElement>(null);
    const transcriptContainerRef = useRef<HTMLDivElement>(null);

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
    const [outboundCallerIdNumber, setOutboundCallerIdNumber] = useState<string>('');
    const [wsConnectionStatus, setWsConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [phoneValidationError, setPhoneValidationError] = useState<string | null>(null);
    const [callSummary, setCallSummary] = useState<any>(null);
    const outboundWsRef = useRef<WebSocket | null>(null);
    const outboundTranscriptEndRef = useRef<HTMLDivElement>(null);

    // Auto-start session when arriving from agent-config with ?autostart=1
    useEffect(() => {
        if (autostartParam && !autostartFiredRef.current && user && !loading && activeTab === 'web' && !isConnected && !callInitiating) {
            autostartFiredRef.current = true;
            handleToggleWebCall();
        }
    }, [autostartParam, user, loading, activeTab, isConnected, callInitiating]);

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
        if (activeTab === 'web' && displayTranscripts.length > 0) {
            const scrollContainer = transcriptContainerRef.current;
            const scrollElement = transcriptEndRef.current;

            if (scrollContainer && scrollElement) {
                // Check if user scrolled up manually (100px threshold)
                const { scrollHeight, scrollTop, clientHeight } = scrollContainer;
                const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;

                // Only auto-scroll if user is already near bottom (AI industry standard)
                if (isNearBottom) {
                    requestAnimationFrame(() => {
                        scrollElement.scrollIntoView({
                            behavior: 'smooth',
                            block: 'end',
                            inline: 'nearest'
                        });
                    });
                }
            }
        }
    }, [displayTranscripts, activeTab]);

    // Scroll listener to show/hide scroll-to-bottom button
    useEffect(() => {
        const container = transcriptContainerRef.current;
        if (!container || activeTab !== 'web') return;

        const handleScroll = () => {
            const { scrollHeight, scrollTop, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
            setShowScrollButton(!isNearBottom);
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [activeTab]);

    const handleToggleWebCall = async () => {
        if (isConnected) {
            stopRecording();
            await stopCall();
        } else {
            setCallInitiating(true);
            try {
                await startCall();
            } catch (err: any) {
                console.error('Failed to start web call', err);
                const msg = err?.message || 'Failed to start call';
                showErrorToast(msg);
            } finally {
                setCallInitiating(false);
            }
        }
    };

    const handleToggleMute = async () => {
        if (!isConnected) return;

        if (isMuted) {
            // Unmute: restart recording
            try {
                await startRecording();
                setIsMuted(false);
            } catch (err) {
                console.error('Failed to unmute:', err);
            }
        } else {
            // Mute: stop recording (keeps WebSocket alive)
            stopRecording();
            setIsMuted(true);
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

    // Load inbound status on mount (needed by both web and phone tabs)
    useEffect(() => {
        if (!user) return;
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
        loadInboundStatus();
    }, [user]);

    // Load phone settings on mount for Caller ID display (independent of outbound config)
    useEffect(() => {
        if (!user) return;
        const loadCallerIdInfo = async () => {
            try {
                const phoneStatus = await authedBackendFetch<any>('/api/phone-settings/status');
                if (phoneStatus?.outbound?.managedOutboundNumber) {
                    setOutboundCallerIdNumber(phoneStatus.outbound.managedOutboundNumber);
                } else if (phoneStatus?.outbound?.verifiedNumber) {
                    setOutboundCallerIdNumber(phoneStatus.outbound.verifiedNumber);
                } else if (phoneStatus?.inbound?.managedNumber) {
                    setOutboundCallerIdNumber(phoneStatus.inbound.managedNumber);
                } else {
                    setOutboundCallerIdNumber('Auto-assigned at call time');
                }
            } catch {
                // Fallback handled by existing inbound status
            }
        };
        loadCallerIdInfo();
    }, [user]);

    // Load outbound agent config before making phone calls
    useEffect(() => {
        const loadOutboundConfig = async () => {
            // Always fetch fresh config - stale cache can block the UI with
            // outdated "missing fields" errors after the user fixes config.
            if (typeof window !== 'undefined') {
                localStorage.removeItem(CACHE_KEY);
            }

            setOutboundConfigLoading(true);
            try {
                const agentData = await authedBackendFetch<any>('/api/founder-console/agent/config');
                const outboundAgent = agentData?.agents?.find((a: any) => a.role === 'outbound');

                if (!outboundAgent) {
                    setOutboundConfigError('No outbound agent configured');
                    setOutboundConfigMissingFields(['Outbound Agent']);
                    setOutboundConfigLoaded(false);
                    return;
                }

                const config = outboundAgent;
                const missingFields: string[] = [];

                // Only block on system_prompt - the essential field for the call.
                // vapi_assistant_id and vapi_phone_number_id are auto-resolved by the backend
                // at call time, so don't block the UI for them.
                if (!config.system_prompt || config.system_prompt.trim() === '') {
                    missingFields.push('System Prompt');
                }

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
            showErrorToast((err as any).message || 'Failed to start phone call');
        } finally {
            setIsCallingPhone(false);
        }
    };

    const handleEndPhoneCall = async () => {
        try {
            // Close WebSocket connection
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
                    // Set empty summary on error so UI doesn't get stuck
                    setCallSummary({ status: 'ended', trackingId: outboundTrackingId });
                }
            }
        } catch (error) {
            console.error('Error ending call:', error);
        } finally {
            // CRITICAL FIX: Always reset call state, even on error
            setOutboundTrackingId(null);
            setOutboundTranscripts([]);
            setOutboundConnected(false);
            setWsConnectionStatus('disconnected');
        }
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
                            // Auto-scroll with requestAnimationFrame for smooth scrolling
                            requestAnimationFrame(() => {
                                outboundTranscriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            });
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


    if (!user && !loading) return null;

    return (
        <div className="min-h-screen bg-clinical-bg flex flex-col overflow-hidden p-6">
            <div className="flex-none max-w-5xl mx-auto w-full mb-4">
                {/* Tab Switcher - TOP POSITION */}
                <div className="bg-white border border-surgical-200 p-1 rounded-lg inline-flex shadow-sm">
                    <button
                        onClick={() => setActiveTab('web')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'web'
                            ? 'bg-surgical-600 text-white'
                            : 'text-obsidian hover:bg-surgical-50'
                            }`}
                    >
                        <Globe className="w-4 h-4" />
                        Browser Test
                    </button>
                    <button
                        onClick={() => setActiveTab('phone')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'phone'
                            ? 'bg-surgical-600 text-white'
                            : 'text-obsidian hover:bg-surgical-50'
                            }`}
                    >
                        <Phone className="w-4 h-4" />
                        Live Call
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white border border-surgical-200 rounded-xl shadow-sm overflow-hidden max-w-5xl w-full flex flex-col mx-auto">

                {/* --- Web Test Interface --- */}
                {activeTab === 'web' && (
                    <div className="flex-1 flex flex-col h-full relative">
                        {/* Transcript Area - Paper Style */}
                        <div
                            ref={transcriptContainerRef}
                            className="flex-1 p-6 overflow-y-auto space-y-4 bg-white overscroll-contain relative"
                            role="log"
                            aria-live="polite"
                            aria-label="Conversation transcript"
                        >
                            {displayTranscripts.length === 0 ? (
                                <div className="flex-1 flex flex-col min-h-0 items-center justify-center text-obsidian/60">
                                    <div className="w-20 h-20 rounded-2xl bg-surgical-50 border border-surgical-200 flex items-center justify-center">
                                        <Phone className="w-10 h-10 text-surgical-500" />
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayTranscripts.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[75%] sm:max-w-[70%] rounded-xl px-4 py-2.5 text-sm transition-all ${t.speaker === 'user'
                                                ? 'bg-surgical-600 text-white shadow-lg shadow-surgical-600/20'
                                                : 'bg-surgical-50 text-obsidian border border-surgical-200'
                                                }`}>
                                                <p className="leading-relaxed tracking-tight">
                                                    {t.text}
                                                    {!t.isFinal && <span className="animate-pulse">...</span>}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                    <div ref={transcriptEndRef} />
                                </div>
                            )}

                            {/* Gradient fade overlay at bottom */}
                            {displayTranscripts.length > 0 && (
                                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none z-5" />
                            )}
                        </div>

                        {/* Scroll to bottom button (ChatGPT-style) */}
                        <AnimatePresence>
                            {showScrollButton && displayTranscripts.length > 0 && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    transition={{ duration: 0.2 }}
                                    onClick={() => {
                                        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                    className="absolute bottom-24 right-6 z-20 bg-surgical-600 text-white px-4 py-2 rounded-full shadow-lg hover:bg-surgical-700 transition-colors flex items-center gap-2"
                                    aria-label="Scroll to latest message"
                                >
                                    <ArrowDown className="w-4 h-4" />
                                    <span className="text-sm font-medium">Latest</span>
                                </motion.button>
                            )}
                        </AnimatePresence>

                        {/* Voice error banner */}
                        {voiceError && !isConnected && (
                            <div className="mx-4 sm:mx-6 mb-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                                {voiceError}
                            </div>
                        )}

                        {/* Fixed Control Bar */}
                        <div className="sticky bottom-0 z-10 px-4 sm:px-6 py-4 sm:py-5 border-t border-surgical-200 bg-white/95 backdrop-blur-sm shadow-lg flex items-center justify-center gap-4 sm:gap-6">
                            {/* Subtle accent line at top */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-surgical-500/30 to-transparent" />

                            {/* Mute Button */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleToggleMute}
                                disabled={!isConnected}
                                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                                aria-pressed={isMuted}
                                title={isMuted ? 'Unmute' : 'Mute'}
                                className={`group relative w-11 h-11 sm:w-14 sm:h-14 rounded-full transition-all duration-300 flex items-center justify-center ${isMuted
                                    ? 'bg-red-50 text-red-700 border-2 border-red-200 hover:bg-red-100 shadow-lg shadow-red-500/10'
                                    : 'bg-surgical-50 text-obsidian/60 hover:text-obsidian hover:bg-surgical-100 border border-surgical-200'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {/* Glow effect on hover */}
                                <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isMuted ? 'bg-red-50' : 'bg-surgical-100'
                                    } blur-xl`} />
                                {isMuted ? <MicOff className="w-5 h-5 relative z-10" /> : <Mic className="w-5 h-5 relative z-10" />}
                            </motion.button>

                            {/* Primary Call Button */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleToggleWebCall}
                                disabled={callInitiating}
                                aria-label={isConnected ? 'End call' : 'Start call'}
                                title={isConnected ? 'End session' : 'Start session'}
                                className={`w-12 h-12 rounded-full transition-all flex items-center justify-center ${isConnected
                                    ? 'bg-red-600 hover:bg-red-700 text-white'
                                    : 'bg-surgical-600 hover:bg-surgical-700 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
                            >
                                {callInitiating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isConnected ? (
                                    <StopCircle className="w-5 h-5" />
                                ) : (
                                    <Phone className="w-5 h-5" />
                                )}
                            </motion.button>
                        </div>
                    </div>
                )}

                {/* --- Phone Test Interface --- */}
                {activeTab === 'phone' && (
                    <div className="flex flex-col h-full bg-white">
                        <div className="p-8 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-surgical-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Phone className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-obsidian mb-2">Live Call Test</h2>
                                <p className="text-sm text-obsidian/70">Enter your phone number to receive a test call from your agent.</p>

                                <div className="mt-4 p-4 bg-surgical-50 border border-surgical-200 rounded-lg text-left">
                                    <p className="text-xs text-obsidian/60 font-semibold uppercase tracking-wider">From Number / Caller ID</p>
                                    <p className="text-lg font-mono font-bold text-obsidian mt-1">
                                        {outboundCallerIdNumber && outboundCallerIdNumber !== 'Auto-assigned at call time'
                                            ? outboundCallerIdNumber
                                            : inboundStatus?.configured && inboundStatus.inboundNumber
                                                ? inboundStatus.inboundNumber
                                                : 'Auto-assigned at call time'}
                                    </p>
                                    <p className="text-xs text-obsidian/60 mt-2">
                                        {(!outboundCallerIdNumber || outboundCallerIdNumber === 'Auto-assigned at call time') && !(inboundStatus?.configured && inboundStatus.inboundNumber)
                                            ? 'A phone number will be automatically selected from your account when the call is placed.'
                                            : 'This number will appear as the caller ID on outbound calls.'}
                                    </p>
                                </div>

                                {/* WebSocket Connection Status */}
                                {outboundTrackingId && (
                                    <div className="mt-4 flex items-center justify-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${wsConnectionStatus === 'connected' ? 'bg-surgical-500 shadow-lg shadow-surgical-500/50' : wsConnectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-surgical-200'}`} />
                                        <span className="text-xs text-obsidian/60 tracking-tight">
                                            {wsConnectionStatus === 'connected' ? 'Live transcript connected' : wsConnectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Config Loading State */}
                            {outboundConfigLoading && (
                                <div className="text-center space-y-4">
                                    <Loader2 className="w-8 h-8 text-surgical-500 animate-spin mx-auto" />
                                    <p className="text-sm text-obsidian/60 tracking-tight">Loading outbound configuration...</p>
                                </div>
                            )}

                            {/* Config Error State */}
                            {!outboundConfigLoading && outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-red-700 text-sm tracking-tight">{outboundConfigError}</p>
                                                {outboundConfigMissingFields.length > 0 && (
                                                    <div className="mt-2">
                                                        <p className="text-xs text-red-700">Missing fields:</p>
                                                        <ul className="list-disc list-inside text-xs text-red-700 mt-1">
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
                                        className="w-full py-3 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-medium transition-all shadow-sm tracking-tight"
                                    >
                                        Go to Agent Configuration
                                    </button>
                                </div>
                            )}

                            {/* Call Summary (Post-Call) */}
                            {callSummary && !outboundTrackingId && (
                                <div className="space-y-4">
                                    <div className="p-6 bg-white rounded-2xl border border-surgical-200 shadow-sm">
                                        <h3 className="text-lg font-semibold text-obsidian mb-4 tracking-tight">Call Summary</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-obsidian/60 font-medium uppercase tracking-wider">Status</p>
                                                <p className="text-sm text-obsidian capitalize mt-1">{callSummary.status || 'Completed'}</p>
                                            </div>
                                            {callSummary.durationSeconds && (
                                                <div>
                                                    <p className="text-xs text-obsidian/60 font-medium uppercase tracking-wider">Duration</p>
                                                    <p className="text-sm text-obsidian mt-1">{Math.floor(callSummary.durationSeconds / 60)}m {callSummary.durationSeconds % 60}s</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-obsidian/60 font-medium uppercase tracking-wider">Tracking ID</p>
                                                <p className="text-sm text-obsidian font-mono mt-1">{callSummary.trackingId}</p>
                                            </div>
                                            {callSummary.transcripts && callSummary.transcripts.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-obsidian/60 font-medium uppercase tracking-wider mb-2">Last Transcript Lines</p>
                                                    <div className="space-y-2">
                                                        {callSummary.transcripts.slice(-5).map((t: any, idx: number) => (
                                                            <div key={idx} className="text-sm">
                                                                <span className={`font-semibold ${t.speaker === 'agent' ? 'text-surgical-600' : 'text-obsidian/60'}`}>
                                                                    {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                                </span>
                                                                <span className="text-obsidian">{t.text}</span>
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
                                            className="flex-1 py-3 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-medium transition-all shadow-sm tracking-tight"
                                        >
                                            View in Calls Dashboard
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCallSummary(null);
                                                setPhoneNumber('');
                                                setOutboundTranscripts([]);
                                            }}
                                            className="px-6 py-3 rounded-xl border border-surgical-200 text-obsidian/60 hover:bg-surgical-50 font-medium transition-all tracking-tight"
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
                                        <label className="block text-sm font-medium text-obsidian/60 mb-2 tracking-tight">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                setPhoneNumber(e.target.value);
                                                setPhoneValidationError(null);
                                            }}
                                            placeholder="+15551234567"
                                            className={`w-full px-4 py-3 rounded-xl border bg-white text-obsidian placeholder-obsidian/40 focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none text-lg transition-all ${phoneValidationError ? 'border-red-500' : 'border-surgical-200'}`}
                                        />
                                        {phoneValidationError && (
                                            <p className="text-xs text-red-700 mt-2">{phoneValidationError}</p>
                                        )}
                                        {!phoneValidationError && (
                                            <p className="text-xs text-obsidian/40 mt-2 tracking-tight">Enter the phone number you want the AI agent to call</p>
                                        )}
                                    </div>

                                    {/* Outbound Caller ID Display */}
                                    {outboundCallerIdNumber && (
                                        <div className="p-4 bg-surgical-50 border border-surgical-200 rounded-xl">
                                            <p className="text-xs text-obsidian/60 font-medium uppercase tracking-wider">Outbound Caller ID</p>
                                            <p className="text-sm text-obsidian mt-1 font-mono">
                                                {outboundCallerIdNumber}
                                            </p>
                                            <p className="text-xs text-obsidian/40 mt-2">
                                                This number will appear as the caller ID to the recipient
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleInitiateCall}
                                        disabled={isCallingPhone || !phoneNumber}
                                        className="w-full px-6 py-3 rounded-lg bg-surgical-600 hover:bg-surgical-700 text-white font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isCallingPhone ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Initiating Call...
                                            </>
                                        ) : (
                                            <>
                                                <Phone className="w-5 h-5" />
                                                Start Outbound Call
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Active Call State */}
                            {outboundTrackingId && !callSummary && (
                                <div className="flex flex-col h-full">
                                    {/* Fixed header section */}
                                    <div className="flex-none p-6">
                                        <div className="p-6 bg-surgical-50 rounded-2xl border border-surgical-200 text-center">
                                            <Activity className="w-12 h-12 text-surgical-600 mx-auto mb-3 animate-pulse" />
                                            <h3 className="text-lg font-semibold text-surgical-600 tracking-tight">Call In Progress</h3>
                                            <p className="text-sm text-obsidian/60">Check your phone!</p>
                                        </div>

                                        <button
                                            onClick={handleEndPhoneCall}
                                            className="mt-6 w-full px-8 py-3 rounded-xl border border-surgical-200 text-obsidian/60 hover:bg-surgical-50 font-medium transition-all tracking-tight"
                                        >
                                            End Test Session
                                        </button>
                                    </div>

                                    {/* Scrollable transcript section */}
                                    {outboundTranscripts.length > 0 && (
                                        <div className="flex-1 min-h-0 px-6 pb-6">
                                            <div className="h-full bg-surgical-50 rounded-xl p-4 border border-surgical-200 flex flex-col">
                                                <p className="text-xs font-semibold text-obsidian/60 uppercase tracking-widest mb-3 flex-none">Live Transcript</p>
                                                <div className="flex-1 overflow-y-auto min-h-0">
                                                    <div className="space-y-3">
                                                        {outboundTranscripts.map((t, i) => (
                                                            <div key={i} className="text-sm">
                                                                <span className={`font-semibold ${t.speaker === 'agent' ? 'text-surgical-600' : 'text-obsidian/60'}`}>
                                                                    {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                                </span>
                                                                <span className="text-obsidian">{t.text}</span>
                                                            </div>
                                                        ))}
                                                        <div ref={outboundTranscriptEndRef} />
                                                    </div>
                                                </div>
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
                    <div className="fixed inset-0 bg-obsidian/70 backdrop-blur-sm flex items-center justify-center z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white border border-surgical-200 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <h3 className="text-xl font-semibold text-obsidian mb-2 tracking-tight">Confirm Test Call</h3>
                            <p className="text-sm text-obsidian/60 mb-6 tracking-tight">
                                Are you sure you want to place a test call to <span className="font-mono font-semibold text-surgical-600">{phoneNumber}</span>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-surgical-200 text-obsidian/60 hover:bg-surgical-50 font-medium transition-all tracking-tight"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmCall}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-medium transition-all shadow-sm tracking-tight"
                                >
                                    Confirm Call
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </div>
        </div>

    );
};

export default function TestAgentPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen bg-surgical-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-surgical-500 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-obsidian/60 tracking-tight">Initializing test environment...</p>
                </div>
            </div>
        }>
            <TestAgentPageContent />
        </React.Suspense>
    );
}
