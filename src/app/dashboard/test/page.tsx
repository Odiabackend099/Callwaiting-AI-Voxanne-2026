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
        isSpeaking,
        transcripts,
        error: voiceError,
        startCall,
        stopCall,
        startRecording,
        stopRecording,
        activeVolume,
    } = useVoiceAgentContext();

    // Typed call status — maps to the CTO directive's 'inactive' | 'loading' | 'active' contract
    const [callInitiating, setCallInitiating] = useState(false);
    const callStatus: 'inactive' | 'loading' | 'active' =
        callInitiating ? 'loading' : isConnected ? 'active' : 'inactive';

    const [displayTranscripts, setDisplayTranscripts] = useState<any[]>([]);
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
                            const isFinal = data.is_final === true;
                            const newTranscript = {
                                id: `${outboundTrackingId}_${Date.now()}_${Math.random()}`,
                                speaker,
                                text: data.text,
                                isFinal,
                                confidence: data.confidence || 0.95,
                                timestamp: new Date()
                            };

                            setOutboundTranscripts(prev => {
                                const last = prev[prev.length - 1];
                                // Update existing partial for same speaker instead of appending
                                if (!isFinal && last && last.speaker === speaker && !last.isFinal) {
                                    const updated = [...prev];
                                    updated[updated.length - 1] = { ...last, text: data.text };
                                    return updated;
                                }
                                return [...prev, newTranscript].slice(-100);
                            });
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

                            {/* Primary Call Button + VAD Visualizer Ring */}
                            <div className="relative flex items-center justify-center">
                                {/* VAD pulse ring — scales with mic volume when active */}
                                <div
                                    className="absolute rounded-full bg-surgical-400/30 pointer-events-none"
                                    style={{
                                        width: 48,
                                        height: 48,
                                        transform: `scale(${callStatus === 'active' && isRecording && !isSpeaking ? 1 + activeVolume * 1.5 : 1})`,
                                        opacity: callStatus === 'active' && isRecording && !isSpeaking ? 0.5 + activeVolume * 0.5 : 0,
                                        transition: 'transform 80ms ease-out, opacity 80ms ease-out',
                                    }}
                                />
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleToggleWebCall}
                                    disabled={callInitiating}
                                    aria-label={isConnected ? 'End call' : 'Start call'}
                                    title={isConnected ? 'End session' : 'Start session'}
                                    className={`w-12 h-12 rounded-full transition-all flex items-center justify-center relative z-10 ${isConnected
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
                    </div>
                )}

                {/* --- Phone Test Interface --- */}
                {activeTab === 'phone' && (
                    <div className="flex flex-col h-full bg-white">
                        <div className="p-8 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">

                            {/* Header — always visible */}
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-surgical-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm">
                                    <Phone className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-obsidian mb-2">Try a Live Call</h2>
                                <p className="text-sm text-obsidian/70">Enter your number and your AI agent will call you instantly.</p>

                                {/* Caller ID — shown only when a number is known */}
                                {(outboundCallerIdNumber && outboundCallerIdNumber !== 'Auto-assigned at call time') || (inboundStatus?.configured && inboundStatus.inboundNumber) ? (
                                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-surgical-50 border border-surgical-200 rounded-full">
                                        <Phone className="w-3.5 h-3.5 text-surgical-500 flex-shrink-0" />
                                        <span className="text-sm text-obsidian/70">Your agent will call from </span>
                                        <span className="text-sm font-semibold text-obsidian font-mono">
                                            {outboundCallerIdNumber && outboundCallerIdNumber !== 'Auto-assigned at call time'
                                                ? outboundCallerIdNumber
                                                : inboundStatus!.inboundNumber}
                                        </span>
                                    </div>
                                ) : null}

                                {/* Live indicator — only while call is active */}
                                {outboundTrackingId && wsConnectionStatus === 'connected' && (
                                    <div className="mt-3 flex items-center justify-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full bg-surgical-500 shadow-lg shadow-surgical-500/50 animate-pulse" />
                                        <span className="text-xs text-obsidian/50">Live</span>
                                    </div>
                                )}
                            </div>

                            {/* Loading — agent warming up */}
                            {outboundConfigLoading && (
                                <div className="text-center space-y-3">
                                    <Loader2 className="w-8 h-8 text-surgical-500 animate-spin mx-auto" />
                                    <p className="text-sm text-obsidian/60">Getting your agent ready…</p>
                                </div>
                            )}

                            {/* Setup incomplete */}
                            {!outboundConfigLoading && outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div className="p-5 bg-surgical-50 border border-surgical-200 rounded-2xl text-center">
                                        <div className="w-12 h-12 bg-white border border-surgical-200 rounded-xl flex items-center justify-center mx-auto mb-3">
                                            <AlertCircle className="w-6 h-6 text-surgical-500" />
                                        </div>
                                        <p className="font-semibold text-obsidian text-sm mb-1">Your agent isn't ready yet</p>
                                        <p className="text-xs text-obsidian/60 leading-relaxed">
                                            Finish setting up your AI agent before placing a test call.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => router.push('/dashboard/agent-config')}
                                        className="w-full py-3 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-medium transition-all shadow-sm tracking-tight"
                                    >
                                        Finish Setup
                                    </button>
                                </div>
                            )}

                            {/* Post-call summary */}
                            {callSummary && !outboundTrackingId && (
                                <div className="space-y-4">
                                    <div className="p-6 bg-white rounded-2xl border border-surgical-200 shadow-sm">
                                        <div className="flex items-center gap-3 mb-5">
                                            <div className="w-10 h-10 rounded-xl bg-surgical-50 border border-surgical-200 flex items-center justify-center flex-shrink-0">
                                                <Phone className="w-5 h-5 text-surgical-600" />
                                            </div>
                                            <div>
                                                <h3 className="text-base font-semibold text-obsidian tracking-tight">Call complete</h3>
                                                {callSummary.durationSeconds ? (
                                                    <p className="text-xs text-obsidian/50 mt-0.5">
                                                        {Math.floor(callSummary.durationSeconds / 60)}m {callSummary.durationSeconds % 60}s
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>

                                        {callSummary.transcripts && callSummary.transcripts.length > 0 && (
                                            <div className="border-t border-surgical-100 pt-4">
                                                <p className="text-xs text-obsidian/50 font-medium mb-3 uppercase tracking-wider">How it went</p>
                                                <div className="space-y-2">
                                                    {callSummary.transcripts.slice(-5).map((t: any, idx: number) => (
                                                        <div key={idx} className={`flex ${t.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                                            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${t.speaker === 'agent'
                                                                ? 'bg-surgical-50 text-obsidian border border-surgical-200'
                                                                : 'bg-surgical-600 text-white'
                                                            }`}>
                                                                {t.text}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => router.push('/dashboard/calls?tab=outbound')}
                                            className="flex-1 py-3 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-medium transition-all shadow-sm tracking-tight"
                                        >
                                            View Full Transcript
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCallSummary(null);
                                                setPhoneNumber('');
                                                setOutboundTranscripts([]);
                                            }}
                                            className="px-6 py-3 rounded-xl border border-surgical-200 text-obsidian/60 hover:bg-surgical-50 font-medium transition-all tracking-tight"
                                        >
                                            Call Again
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Call initiation form */}
                            {!outboundConfigLoading && !outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-obsidian mb-2">Your phone number</label>
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                setPhoneNumber(e.target.value);
                                                setPhoneValidationError(null);
                                            }}
                                            placeholder="+1 (555) 000-0000"
                                            className={`w-full px-4 py-3 rounded-xl border bg-white text-obsidian placeholder-obsidian/40 focus:ring-2 focus:ring-surgical-500 focus:border-surgical-500 outline-none text-lg transition-all ${phoneValidationError ? 'border-red-500' : 'border-surgical-200'}`}
                                        />
                                        {phoneValidationError && (
                                            <p className="text-xs text-red-600 mt-2">{phoneValidationError}</p>
                                        )}
                                        {!phoneValidationError && (
                                            <p className="text-xs text-obsidian/40 mt-2">Include your country code, e.g. +1 for the US</p>
                                        )}
                                    </div>

                                    <button
                                        onClick={handleInitiateCall}
                                        disabled={isCallingPhone || !phoneNumber}
                                        className="w-full px-6 py-4 rounded-xl bg-surgical-600 hover:bg-surgical-700 text-white font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
                                    >
                                        {isCallingPhone ? (
                                            <>
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                                Calling you…
                                            </>
                                        ) : (
                                            <>
                                                <Phone className="w-5 h-5" />
                                                Call Me Now
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Active call view */}
                            {outboundTrackingId && !callSummary && (
                                <div className="flex flex-col h-full">
                                    <div className="flex-none">
                                        <div className="p-6 bg-surgical-50 rounded-2xl border border-surgical-200 text-center">
                                            {/* Pulsing ring animation */}
                                            <div className="relative w-16 h-16 mx-auto mb-4">
                                                <div className="absolute inset-0 rounded-full bg-surgical-400/30 animate-ping" />
                                                <div className="relative w-16 h-16 rounded-full bg-surgical-600 flex items-center justify-center shadow-lg">
                                                    <Phone className="w-7 h-7 text-white" />
                                                </div>
                                            </div>
                                            <h3 className="text-lg font-semibold text-obsidian tracking-tight">Your phone is ringing</h3>
                                            <p className="text-sm text-obsidian/60 mt-1">Pick up and start talking to your AI agent.</p>
                                        </div>

                                        <button
                                            onClick={handleEndPhoneCall}
                                            className="mt-4 w-full px-8 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-medium transition-all tracking-tight"
                                        >
                                            End Call
                                        </button>
                                    </div>

                                    {/* Live conversation */}
                                    {outboundTranscripts.length > 0 && (
                                        <div className="flex-1 min-h-0 mt-4">
                                            <div className="h-full bg-white rounded-xl border border-surgical-200 flex flex-col overflow-hidden">
                                                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surgical-100 flex-none">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-surgical-500 animate-pulse" />
                                                    <p className="text-xs font-medium text-obsidian/60">Live conversation</p>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                                    {outboundTranscripts.map((t, i) => (
                                                        <div key={i} className={`flex ${t.speaker === 'agent' ? 'justify-start' : 'justify-end'}`}>
                                                            <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${t.speaker === 'agent'
                                                                ? 'bg-surgical-50 text-obsidian border border-surgical-200'
                                                                : 'bg-surgical-600 text-white'
                                                            }`}>
                                                                {t.text}
                                                                {!t.isFinal && <span className="animate-pulse opacity-60"> …</span>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                    <div ref={outboundTranscriptEndRef} />
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
                            <h3 className="text-xl font-semibold text-obsidian mb-2 tracking-tight">Ready to call?</h3>
                            <p className="text-sm text-obsidian/60 mb-1 tracking-tight">
                                Your AI agent will call <span className="font-semibold text-obsidian">{phoneNumber}</span> right now.
                            </p>
                            <p className="text-xs text-obsidian/40 mb-6">Make sure you're available to answer.</p>
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
                                    Yes, Call Me
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
