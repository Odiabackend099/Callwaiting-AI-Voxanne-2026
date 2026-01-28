'use client';
export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mic, Phone, AlertCircle, Loader2, Volume2, Globe, Activity, StopCircle, PlayCircle, MicOff } from 'lucide-react';
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
    const [isMuted, setIsMuted] = useState(false);
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
    const [outboundCallerIdNumber, setOutboundCallerIdNumber] = useState<string>('');
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
        if (activeTab === 'web' && displayTranscripts.length > 0) {
            // Use immediate scroll for better UX during rapid updates
            const scrollElement = transcriptEndRef.current;
            if (scrollElement) {
                // Small delay to ensure DOM is updated
                requestAnimationFrame(() => {
                    scrollElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
            }
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

    // Keyboard shortcuts for web test
    useEffect(() => {
        if (activeTab !== 'web') return;

        const handleKeyPress = (e: KeyboardEvent) => {
            // Ignore if typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            // Spacebar: Toggle mute
            if (e.code === 'Space' && isConnected && !callInitiating) {
                e.preventDefault();
                handleToggleMute();
            }

            // Ctrl/Cmd + E: End call
            if ((e.ctrlKey || e.metaKey) && e.key === 'e' && isConnected && !callInitiating) {
                e.preventDefault();
                handleToggleWebCall();
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [isConnected, isMuted, callInitiating, activeTab]);

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

                if (!outboundAgent) {
                    setOutboundConfigError('No outbound agent configured');
                    setOutboundConfigMissingFields(['Outbound Agent']);
                    setOutboundConfigLoaded(false);
                    return;
                }

                const config = outboundAgent;
                const missingFields = [];

                // Check all required fields
                if (!config.vapi_assistant_id) {
                    missingFields.push('VAPI Assistant ID');
                }
                if (!config.system_prompt || config.system_prompt.trim() === '') {
                    missingFields.push('System Prompt');
                }
                if (!config.vapi_phone_number_id) {
                    missingFields.push('Caller ID Phone Number');
                }

                if (missingFields.length > 0) {
                    setOutboundConfigError('Outbound agent configuration is incomplete');
                    setOutboundConfigMissingFields(missingFields);
                    setOutboundConfigLoaded(false);
                    setOutboundCallerIdNumber('');
                    setCachedConfig(config, missingFields);
                } else {
                    setOutboundConfigLoaded(true);
                    setOutboundConfigError(null);
                    setOutboundConfigMissingFields([]);

                    // Store the caller ID phone number for display
                    // Try to fetch the actual phone number from the phone number ID
                    // For now, we'll fetch it from inbound status or show the ID
                    if (inboundStatus?.inboundNumber) {
                        setOutboundCallerIdNumber(inboundStatus.inboundNumber);
                    } else {
                        setOutboundCallerIdNumber(config.vapi_phone_number_id || 'Not configured');
                    }

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


    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400 tracking-tight">Loading...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col overflow-hidden">
            <div className="flex-none px-6 pt-6">
                {/* Premium Header with Glassmorphism */}
                <div className="mb-4 p-6 rounded-2xl bg-slate-900/40 backdrop-blur-md border border-slate-800/60 max-w-5xl mx-auto">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <h1 className="text-2xl font-semibold text-slate-50 tracking-tight">Test Agent</h1>
                    </div>
                    <p className="text-sm text-slate-400 tracking-tight ml-[52px]">Interact with your agent in real-time to verify behavior and responses.</p>
                </div>

                {/* Premium Tabs */}
                <div className="bg-slate-900/40 backdrop-blur-sm p-1 rounded-xl inline-flex mb-4 border border-slate-800/50 max-w-5xl mx-auto">
                    <button
                        onClick={() => setActiveTab('web')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium tracking-tight transition-all flex items-center gap-2 ${activeTab === 'web'
                            ? 'bg-slate-800 text-slate-50 shadow-lg'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        <Globe className="w-4 h-4" />
                        Browser Test
                    </button>
                    <button
                        onClick={() => setActiveTab('phone')}
                        className={`px-6 py-2.5 rounded-lg text-sm font-medium tracking-tight transition-all flex items-center gap-2 ${activeTab === 'phone'
                            ? 'bg-slate-800 text-slate-50 shadow-lg'
                            : 'text-slate-400 hover:text-slate-300'
                            }`}
                    >
                        <Phone className="w-4 h-4" />
                        Live Call
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-slate-900/50 backdrop-blur-md border border-slate-800/60 rounded-2xl shadow-2xl overflow-hidden mx-6 mb-6 max-w-5xl w-full flex flex-col self-center">

                {/* --- Web Test Interface --- */}
                {activeTab === 'web' && (
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Premium Status Header with Glassmorphism */}
                        <div className="flex-none relative px-6 py-4 border-b border-slate-800/50 bg-slate-800/30 backdrop-blur-sm flex items-center justify-between">
                            {/* Subtle gradient accent line */}
                            <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent opacity-60" />

                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full transition-all ${isConnected ? 'bg-emerald-400 animate-pulse shadow-lg shadow-emerald-500/50' : 'bg-slate-600'
                                    }`} />
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                    {isConnected ? 'Connected' : 'Ready'}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {isRecording && !isMuted && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 rounded-full border border-red-500/30 backdrop-blur-sm">
                                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                                        <span className="text-xs font-medium text-red-400 tracking-tight">Recording</span>
                                    </div>
                                )}
                                {isMuted && (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 rounded-full border border-slate-600/50 backdrop-blur-sm">
                                        <MicOff className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-xs font-medium text-slate-400 tracking-tight">Muted</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Transcript Area - Premium Dark Design - Takes all available space */}
                        <div
                            className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-950/50"
                            role="log"
                            aria-live="polite"
                            aria-label="Conversation transcript"
                        >
                            {displayTranscripts.length === 0 ? (
                                <div className="flex-1 flex flex-col min-h-0 items-center justify-center text-slate-500">
                                    <div className="w-16 h-16 rounded-2xl bg-slate-800/50 border border-slate-700/50 flex items-center justify-center mb-4 backdrop-blur-sm">
                                        <Mic className="w-8 h-8 text-slate-600" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-400 tracking-tight">Start the session to begin speaking</p>
                                    <p className="text-xs text-slate-600 mt-1 tracking-tight">Press the call button below</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayTranscripts.map((t) => (
                                        <div
                                            key={t.id}
                                            className={`flex ${t.speaker === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div className={`max-w-[75%] sm:max-w-[70%] rounded-xl px-4 py-2.5 text-sm backdrop-blur-sm transition-all ${t.speaker === 'user'
                                                ? 'bg-gradient-to-br from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-500/20'
                                                : 'bg-slate-800/60 text-slate-200 border border-slate-700/50'
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
                        </div>

                        {/* Premium Fixed Control Bar - Always Visible at Bottom */}
                        <div className="flex-none px-4 sm:px-6 py-4 sm:py-5 border-t border-slate-800/60 bg-slate-900/80 backdrop-blur-xl flex items-center justify-center gap-4 sm:gap-6">
                            {/* Subtle gradient accent line at top */}
                            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

                            {/* Mute Button - Premium Style */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleToggleMute}
                                disabled={!isConnected}
                                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                                aria-pressed={isMuted}
                                title={isMuted ? 'Unmute (Spacebar)' : 'Mute (Spacebar)'}
                                className={`group relative w-11 h-11 sm:w-14 sm:h-14 rounded-full transition-all duration-300 flex items-center justify-center ${isMuted
                                    ? 'bg-red-500/10 text-red-400 border-2 border-red-500/50 hover:bg-red-500/20 shadow-lg shadow-red-500/20'
                                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-300 hover:bg-slate-700/60 border border-slate-700/50'
                                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                            >
                                {/* Glow effect on hover */}
                                <div className={`absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isMuted ? 'bg-red-500/10' : 'bg-slate-700/20'
                                    } blur-xl`} />
                                {isMuted ? <MicOff className="w-5 h-5 relative z-10" /> : <Mic className="w-5 h-5 relative z-10" />}
                            </motion.button>

                            {/* Primary Call Button - Premium Gradient */}
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={handleToggleWebCall}
                                disabled={callInitiating}
                                aria-label={isConnected ? 'End call' : 'Start call'}
                                title={isConnected ? 'End session (Ctrl+E)' : 'Start session'}
                                className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-full transition-all duration-300 shadow-2xl flex items-center justify-center ${isConnected
                                    ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-red-500/50'
                                    : 'bg-gradient-to-br from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white shadow-emerald-500/50'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                {/* Animated glow effect */}
                                <div className={`absolute inset-0 rounded-full opacity-60 group-hover:opacity-100 transition-opacity blur-2xl ${isConnected ? 'bg-red-500' : 'bg-emerald-500'
                                    }`} />
                                {callInitiating ? (
                                    <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin relative z-10" />
                                ) : isConnected ? (
                                    <StopCircle className="w-7 h-7 sm:w-8 sm:h-8 relative z-10" />
                                ) : (
                                    <Phone className="w-7 h-7 sm:w-8 sm:h-8 relative z-10" />
                                )}
                            </motion.button>
                        </div>
                    </div>
                )}

                {/* --- Phone Test Interface --- */}
                {activeTab === 'phone' && (
                    <div className="flex flex-col h-full bg-slate-950/50">
                        <div className="p-8 max-w-xl mx-auto w-full flex-1 flex flex-col justify-center">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-cyan-500/30">
                                    <Phone className="w-8 h-8 text-white" />
                                </div>
                                <h2 className="text-2xl font-semibold text-slate-50 mb-2 tracking-tight">Live Call Test</h2>
                                <p className="text-sm text-slate-400 tracking-tight">Enter your phone number to receive a test call from your agent.</p>

                                <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-left backdrop-blur-sm">
                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Caller ID</p>
                                    <p className="text-sm text-slate-200 mt-1">
                                        {inboundStatus?.configured && inboundStatus.inboundNumber
                                            ? inboundStatus.inboundNumber
                                            : 'Inbound not configured yet'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-2">Outbound calls always use your inbound number.</p>
                                </div>

                                {/* WebSocket Connection Status */}
                                {outboundTrackingId && (
                                    <div className="mt-4 flex items-center justify-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${wsConnectionStatus === 'connected' ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : wsConnectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-slate-600'}`} />
                                        <span className="text-xs text-slate-400 tracking-tight">
                                            {wsConnectionStatus === 'connected' ? 'Live transcript connected' : wsConnectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Config Loading State */}
                            {outboundConfigLoading && (
                                <div className="text-center space-y-4">
                                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                                    <p className="text-sm text-slate-400 tracking-tight">Loading outbound configuration...</p>
                                </div>
                            )}

                            {/* Config Error State */}
                            {!outboundConfigLoading && outboundConfigError && !outboundTrackingId && !callSummary && (
                                <div className="space-y-4">
                                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl backdrop-blur-sm">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-medium text-red-300 text-sm tracking-tight">{outboundConfigError}</p>
                                                {outboundConfigMissingFields.length > 0 && (
                                                    <div className="mt-2">
                                                        <p className="text-xs text-red-400">Missing fields:</p>
                                                        <ul className="list-disc list-inside text-xs text-red-400 mt-1">
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
                                        className="w-full py-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 tracking-tight"
                                    >
                                        Go to Agent Configuration
                                    </button>
                                </div>
                            )}

                            {/* Call Summary (Post-Call) */}
                            {callSummary && !outboundTrackingId && (
                                <div className="space-y-4">
                                    <div className="p-6 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
                                        <h3 className="text-lg font-semibold text-slate-50 mb-4 tracking-tight">Call Summary</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Status</p>
                                                <p className="text-sm text-slate-200 capitalize mt-1">{callSummary.status || 'Completed'}</p>
                                            </div>
                                            {callSummary.durationSeconds && (
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Duration</p>
                                                    <p className="text-sm text-slate-200 mt-1">{Math.floor(callSummary.durationSeconds / 60)}m {callSummary.durationSeconds % 60}s</p>
                                                </div>
                                            )}
                                            <div>
                                                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Tracking ID</p>
                                                <p className="text-sm text-slate-200 font-mono mt-1">{callSummary.trackingId}</p>
                                            </div>
                                            {callSummary.transcripts && callSummary.transcripts.length > 0 && (
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-2">Last Transcript Lines</p>
                                                    <div className="space-y-2">
                                                        {callSummary.transcripts.slice(-5).map((t: any, idx: number) => (
                                                            <div key={idx} className="text-sm">
                                                                <span className={`font-semibold ${t.speaker === 'agent' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                                                    {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                                </span>
                                                                <span className="text-slate-300">{t.text}</span>
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
                                            className="flex-1 py-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 tracking-tight"
                                        >
                                            View in Calls Dashboard
                                        </button>
                                        <button
                                            onClick={() => {
                                                setCallSummary(null);
                                                setPhoneNumber('');
                                                setOutboundTranscripts([]);
                                            }}
                                            className="px-6 py-3 rounded-xl border border-slate-700/50 text-slate-300 hover:bg-slate-800/50 font-medium transition-all tracking-tight"
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
                                        <label className="block text-sm font-medium text-slate-400 mb-2 tracking-tight">Phone Number</label>
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={(e) => {
                                                setPhoneNumber(e.target.value);
                                                setPhoneValidationError(null);
                                            }}
                                            placeholder="+15551234567"
                                            className={`w-full px-4 py-3 rounded-xl border bg-slate-800/50 backdrop-blur-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none text-lg transition-all ${phoneValidationError ? 'border-red-500/50' : 'border-slate-700/50'}`}
                                        />
                                        {phoneValidationError && (
                                            <p className="text-xs text-red-400 mt-2">{phoneValidationError}</p>
                                        )}
                                        {!phoneValidationError && (
                                            <p className="text-xs text-slate-500 mt-2 tracking-tight">Enter the phone number you want the AI agent to call</p>
                                        )}
                                    </div>

                                    {/* Outbound Caller ID Display */}
                                    {outboundCallerIdNumber && (
                                        <div className="p-4 bg-slate-800/50 border border-slate-700/50 rounded-xl backdrop-blur-sm">
                                            <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Outbound Caller ID</p>
                                            <p className="text-sm text-slate-200 mt-1 font-mono">
                                                {outboundCallerIdNumber}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-2">
                                                This number will appear as the caller ID to the recipient
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleInitiateCall}
                                        disabled={isCallingPhone || !phoneNumber}
                                        className="w-full py-4 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-semibold text-lg shadow-2xl shadow-cyan-500/30 hover:shadow-cyan-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        {isCallingPhone ? (
                                            <>
                                                <Loader2 className="w-6 h-6 animate-spin" />
                                                Initiating Call...
                                            </>
                                        ) : (
                                            <>
                                                <Phone className="w-6 h-6" />
                                                Start Outbound Call
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Active Call State */}
                            {outboundTrackingId && !callSummary && (
                                <div className="text-center space-y-6">
                                    <div className="p-6 bg-emerald-500/10 rounded-2xl border border-emerald-500/30 backdrop-blur-sm">
                                        <Activity className="w-12 h-12 text-emerald-400 mx-auto mb-3 animate-pulse" />
                                        <h3 className="text-lg font-semibold text-emerald-300 tracking-tight">Call In Progress</h3>
                                        <p className="text-sm text-emerald-400/80">Check your phone!</p>
                                    </div>

                                    <button
                                        onClick={handleEndPhoneCall}
                                        className="px-8 py-3 rounded-xl border border-slate-700/50 text-slate-300 hover:bg-slate-800/50 font-medium transition-all tracking-tight"
                                    >
                                        End Test Session
                                    </button>

                                    {/* Live Transcript Preview */}
                                    {outboundTranscripts.length > 0 && (
                                        <div className="mt-8 text-left bg-slate-800/50 rounded-xl p-4 max-h-64 overflow-y-auto border border-slate-700/50 backdrop-blur-sm">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Live Transcript</p>
                                            <div className="space-y-3">
                                                {outboundTranscripts.map((t, i) => (
                                                    <div key={i} className="text-sm">
                                                        <span className={`font-semibold ${t.speaker === 'agent' ? 'text-cyan-400' : 'text-slate-400'}`}>
                                                            {t.speaker === 'agent' ? 'Agent: ' : 'You: '}
                                                        </span>
                                                        <span className="text-slate-300">{t.text}</span>
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

                {/* Premium Confirmation Dialog */}
                {showConfirmDialog && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-slate-900/95 backdrop-blur-xl border border-slate-800/60 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
                        >
                            <h3 className="text-xl font-semibold text-slate-50 mb-2 tracking-tight">Confirm Test Call</h3>
                            <p className="text-sm text-slate-400 mb-6 tracking-tight">
                                Are you sure you want to place a test call to <span className="font-mono font-semibold text-cyan-400">{phoneNumber}</span>?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowConfirmDialog(false)}
                                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-700/50 text-slate-300 hover:bg-slate-800/50 font-medium transition-all tracking-tight"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmCall}
                                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-medium transition-all shadow-lg shadow-cyan-500/30 tracking-tight"
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
            <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto mb-3" />
                    <p className="text-sm text-slate-400 tracking-tight">Initializing test environment...</p>
                </div>
            </div>
        }>
            <TestAgentPageContent />
        </React.Suspense>
    );
}

