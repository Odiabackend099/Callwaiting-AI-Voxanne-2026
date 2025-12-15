'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Phone, AlertCircle, Loader2, Volume2, Globe, Activity, StopCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import LeftSidebar from '@/components/dashboard/LeftSidebar';
import { useVoiceAgent } from '@/hooks/useVoiceAgent';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function TestAgentPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [activeTab, setActiveTab] = useState<'web' | 'phone'>('web');

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
    } = useVoiceAgent();

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
    const outboundWsRef = useRef<WebSocket | null>(null);

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
                await new Promise(resolve => setTimeout(resolve, 1000));
                startRecording();
            } catch (err) {
                console.error('Failed to start web call', err);
            } finally {
                setCallInitiating(false);
            }
        }
    };

    // --- Phone Test Effects ---
    const getAuthToken = async () => {
        return (await supabase.auth.getSession()).data.session?.access_token;
    };

    const handleStartPhoneCall = async () => {
        if (!phoneNumber) return;

        setIsCallingPhone(true);
        try {
            const token = await getAuthToken();
            const response = await fetch(`${API_BASE_URL}/api/founder-console/agent/web-test-outbound`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ phoneNumber })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Failed to initiate call');
            }

            const data = await response.json();
            if (data.trackingId) {
                setOutboundTrackingId(data.trackingId);
                setPhoneCallId(data.callId); // Assuming backend returns callId too
            }
            alert('Call initiated! Your phone should ring shortly.');

        } catch (err) {
            console.error('Phone call failed:', err);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            alert((err as any).message || 'Failed to start phone call');
        } finally {
            setIsCallingPhone(false);
        }
    };

    const handleEndPhoneCall = async () => {
        // Since we might not store the call SID on frontend easily for pure "end" action without more backend support,
        // we'll mainly rely on user hanging up or us closing the tracking socket.
        // But if we have an endpoint, we can call it.
        // For now, we mainly clean up the UI state and websocket.
        if (outboundWsRef.current) {
            outboundWsRef.current.close();
            outboundWsRef.current = null;
        }
        setOutboundTrackingId(null);
        setOutboundConnected(false);
        setOutboundTranscripts([]);
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
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                // Adjust if running locally vs production, usually backend URL host but here we assume same origin or configured URL
                // If backend is on a different port/host, we need to use that.
                // Our backend API URL is API_BASE_URL.
                // Let's parse the host from there.

                const backendUrl = new URL(API_BASE_URL);
                const wsHost = backendUrl.host;
                const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

                const ws = new WebSocket(wsUrl);
                outboundWsRef.current = ws;

                ws.onopen = () => {
                    console.log('[LiveCall] WebSocket connected');
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
                        } else if (data.type === 'call_ended') {
                            setOutboundConnected(false);
                            setOutboundTrackingId(null);
                        }
                    } catch (e) {
                        console.error('WebSocket message error', e);
                    }
                };

                ws.onclose = () => {
                    setOutboundConnected(false);
                };

            } catch (err) {
                console.error('WebSocket connection failed', err);
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
                                    </div>

                                    {!outboundTrackingId ? (
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                                                <input
                                                    type="tel"
                                                    value={phoneNumber}
                                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                                    placeholder="+15551234567"
                                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
                                                />
                                            </div>
                                            <button
                                                onClick={handleStartPhoneCall}
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
                                    ) : (
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
                                                        {outboundTranscripts.slice(-3).map((t, i) => (
                                                            <div key={i} className="text-sm">
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
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
