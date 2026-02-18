"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecorder } from '@/lib/audio/recorder';
import { AudioPlayer } from '@/lib/audio/player';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/hooks/useOrg';
import { authedBackendFetch } from '@/lib/authed-backend-fetch';
import type { VoiceAgentState, TranscriptMessage, WebSocketEvent } from '@/types/voice';
import { mapDbSpeakerToFrontend, type FrontendSpeaker } from '@/types/transcript';

const MAX_TRANSCRIPT_HISTORY = 100;
const INTERIM_TRANSCRIPT_TIMEOUT_MS = 5000;
const DEBUG_VOICE_AGENT = process.env.NEXT_PUBLIC_DEBUG_VOICE_AGENT === 'true';

interface UseVoiceAgentOptions {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
    preventAutoDisconnectOnUnmount?: boolean;
    autoStartRecording?: boolean;
}

interface WebTestResponse {
    success: boolean;
    vapiCallId: string;
    trackingId: string;
    userId: string;
    bridgeWebsocketUrl: string;
    requestId: string;
    error?: string;
}

export function useVoiceAgent(options: UseVoiceAgentOptions = {}) {
    const [state, setState] = useState<VoiceAgentState>({
        isConnected: false,
        isRecording: false,
        isSpeaking: false,
        transcripts: [],
        error: null,
        session: null,
    });

    const { user, session } = useAuth();
    const validatedOrgId = useOrg(); // Get validated org_id from JWT (replaces hardcoded value)

    const wsRef = useRef<WebSocket | null>(null);
    const recorderRef = useRef<AudioRecorder | null>(null);
    const playerRef = useRef<AudioPlayer | null>(null);
    const trackingIdRef = useRef<string | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const interimTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const manualDisconnectRef = useRef(false);
    const isConnectingRef = useRef(false);
    const isMountedRef = useRef(true);

    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000;
    const CONNECTION_TIMEOUT_MS = 10000;

    const getReconnectDelayMs = useCallback((attempt: number) => {
        const base = Math.min(8000, RECONNECT_DELAY * Math.pow(2, Math.max(0, attempt - 1)));
        return base + Math.floor(Math.random() * 250);
    }, []);

    /**
     * Handle transcript event with proper speaker mapping and deduplication
     */
    const handleTranscriptEvent = useCallback((data: any, state: VoiceAgentState): VoiceAgentState => {
        if (!data.text) {
            console.warn('[VoiceAgent] Transcript missing text field');
            return state;
        }

        const isFinal = data.is_final === true;
        const dbSpeaker = data.speaker || 'customer';
        const speaker: FrontendSpeaker = mapDbSpeakerToFrontend(dbSpeaker as any);
        const transcriptText: string = data.text || '';

        const lastMsg = state.transcripts[state.transcripts.length - 1];

        if (isFinal) {
            // Deduplicate final transcripts
            const isDuplicate = lastMsg &&
                lastMsg.text === transcriptText &&
                lastMsg.speaker === speaker &&
                (new Date().getTime() - lastMsg.timestamp.getTime() < 500);

            if (isDuplicate) return state;

            // Convert interim to final if same speaker and text
            if (lastMsg && lastMsg.speaker === speaker && !lastMsg.isFinal && lastMsg.text === transcriptText) {
                const updatedTranscripts = [...state.transcripts];
                updatedTranscripts[updatedTranscripts.length - 1] = {
                    ...lastMsg,
                    isFinal: true,
                    confidence: data.confidence || 0.95,
                };
                return {
                    ...state,
                    transcripts: updatedTranscripts,
                    session: state.session ? {
                        ...state.session,
                        totalMessages: state.session.totalMessages + 1,
                    } : null,
                };
            }

            // Add new final transcript
            const transcript: TranscriptMessage = {
                id: `${Date.now()}_${Math.random()}`,
                speaker,
                text: transcriptText,
                confidence: data.confidence || 0.95,
                isFinal: true,
                timestamp: new Date(),
            };

            // Keep only last MAX_TRANSCRIPT_HISTORY transcripts
            const newTranscripts = [...state.transcripts, transcript].slice(-MAX_TRANSCRIPT_HISTORY);

            return {
                ...state,
                transcripts: newTranscripts,
                session: state.session ? {
                    ...state.session,
                    totalMessages: state.session.totalMessages + 1,
                } : null,
            };
        } else {
            // Interim transcript
            if (lastMsg && lastMsg.speaker === speaker && !lastMsg.isFinal) {
                // Update existing interim
                const updatedTranscripts = [...state.transcripts];
                updatedTranscripts[updatedTranscripts.length - 1] = {
                    ...lastMsg,
                    text: transcriptText,
                    confidence: data.confidence || 0.95,
                    timestamp: new Date(),
                };
                return {
                    ...state,
                    transcripts: updatedTranscripts,
                };
            }

            // New interim transcript
            const interimTranscript: TranscriptMessage = {
                id: `interim_${Date.now()}_${Math.random()}`,
                speaker,
                text: transcriptText,
                confidence: data.confidence || 0.95,
                isFinal: false,
                timestamp: new Date(),
            };

            return {
                ...state,
                transcripts: [...state.transcripts, interimTranscript],
            };
        }
    }, []);

    /**
     * Auto-convert interim transcripts to final after timeout
     */
    const scheduleInterimTimeout = useCallback((state: VoiceAgentState) => {
        if (interimTranscriptTimeoutRef.current) {
            clearTimeout(interimTranscriptTimeoutRef.current);
        }

        const lastMsg = state.transcripts[state.transcripts.length - 1];
        if (lastMsg && !lastMsg.isFinal) {
            interimTranscriptTimeoutRef.current = setTimeout(() => {
                setState(prev => {
                    const updatedTranscripts = [...prev.transcripts];
                    if (updatedTranscripts.length > 0 && !updatedTranscripts[updatedTranscripts.length - 1].isFinal) {
                        updatedTranscripts[updatedTranscripts.length - 1] = {
                            ...updatedTranscripts[updatedTranscripts.length - 1],
                            isFinal: true,
                        };
                    }
                    return { ...prev, transcripts: updatedTranscripts };
                });
            }, INTERIM_TRANSCRIPT_TIMEOUT_MS);
        }
    }, []);

    // Track mount state
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const startRecording = useCallback(async () => {
        try {
            // **FIX #1: Check WebSocket is actually open before starting recorder**
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error('Not connected to server. Please wait for connection to establish.');
            }

            // **FIX #2: Initialize AudioPlayer first if not already done**
            if (!playerRef.current) {
                playerRef.current = new AudioPlayer();
                if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] AudioPlayer initialized');
            }

            // **FIX #3: Create and start AudioRecorder with proper error handling**
            const recorder = new AudioRecorder(wsRef.current, (errorMsg: string) => {
                // Propagate recorder errors to UI
                setState(prev => ({ ...prev, error: errorMsg }));
                options.onError?.(errorMsg);
            });

            await recorder.start();
            recorderRef.current = recorder;

            setState(prev => ({ ...prev, isRecording: true }));
            if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Recording started');
        } catch (error: unknown) {
            console.error('[VoiceAgent] Failed to start recording:', error);
            const errorMessage = error instanceof Error ? error.message : 'Failed to start recording';
            setState(prev => ({ ...prev, error: errorMessage }));
            options.onError?.(errorMessage);
            throw error;  // Re-throw so caller knows it failed
        }
    }, [options]);

    const stopRecording = useCallback(() => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        setState(prev => ({ ...prev, isRecording: false }));
        if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Recording stopped');
    }, []);

    const connect = useCallback(async () => {
        // Prevent race conditions and double connections
        if (isConnectingRef.current || (wsRef.current && wsRef.current.readyState === WebSocket.OPEN)) {
            console.warn('[VoiceAgent] Already connecting or connected. Ignoring request.');
            return;
        }

        try {
            isConnectingRef.current = true;
            manualDisconnectRef.current = false;
            setState(prev => ({ ...prev, error: null, isConnected: false }));

            // Cleanup any existing stale connection
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }

            const token = session?.access_token;

            if (!token) {
                throw new Error('Not authenticated. Please log in first.');
            }

            if (!isMountedRef.current) return;

            if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Initiating web test...');

            // Validate org_id before initiating web test (multi-tenant security)
            if (!validatedOrgId) {
                throw new Error('Organization not validated. Please refresh the page or log in again.');
            }

            const data = await authedBackendFetch<WebTestResponse>('/api/founder-console/agent/web-test', {
                method: 'POST',
                body: JSON.stringify({
                    // Inject org_id for Vapi Context (uses validated org from JWT)
                    customer: {
                        metadata: {
                            org_id: validatedOrgId
                        }
                    },
                    variableValues: {
                        org_id: validatedOrgId
                    }
                }),
                timeoutMs: 30000,
                retries: 2,
                requireAuth: true,
            }).catch((err: any) => {
                if (err?.status === 401) {
                    throw new Error('Not authenticated. Please log in first.');
                }
                if (err?.status === 400) {
                    throw new Error(err?.message || 'Agent not configured. Please configure agent settings first.');
                }
                if (err?.status === 402) {
                    throw new Error(err?.message || 'Voice provider billing limit reached. Please contact support.');
                }
                throw err;
            });

            if (!isMountedRef.current) return;

            if (!data.success || !data.bridgeWebsocketUrl) {
                throw new Error(data.error || 'Failed to get WebSocket URL from backend');
            }

            if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Web test initiated:', { trackingId: data.trackingId });
            trackingIdRef.current = data.trackingId;

            let wsUrl = data.bridgeWebsocketUrl;

            // In local dev, the backend WebSocket server lives on :3001.
            // Next.js dev server on :3000 does not support WebSocket upgrades for this route.
            try {
                const parsed = new URL(wsUrl);
                const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
                if (isLocal && parsed.port === '3000') {
                    parsed.port = '3001';
                    wsUrl = parsed.toString();
                    if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Adjusted WebSocket URL for local dev:', wsUrl);
                }
            } catch {
                // If URL parsing fails, keep original value.
            }

            if (DEBUG_VOICE_AGENT) {
                try {
                    const safe = new URL(wsUrl);
                    safe.searchParams.delete('token');
                    console.log('[VoiceAgent] Connecting to WebSocket:', safe.toString());
                } catch {
                    console.log('[VoiceAgent] Connecting to WebSocket: [unparseable url]');
                }
            }

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            connectionTimeoutRef.current = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.warn('[VoiceAgent] WebSocket connection timeout (10s)');
                    ws.close();
                    if (isMountedRef.current) {
                        setState(prev => ({ ...prev, error: 'Connection timeout. Please try again.' }));
                        options.onError?.('Connection timeout');
                    }
                    isConnectingRef.current = false;
                }
            }, CONNECTION_TIMEOUT_MS);

            ws.onopen = () => {
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }
                if (!isMountedRef.current) {
                    ws.close();
                    isConnectingRef.current = false;
                    return;
                }

                // Authenticate immediately after connect (avoid token in URL/subprotocol).
                try {
                    if (token) {
                        ws.send(JSON.stringify({ type: 'auth', token }));
                    }
                } catch (e) {
                    console.error('[VoiceAgent] Failed to send auth token:', e);
                }

                isConnectingRef.current = false;
                if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] WebSocket connected');
                reconnectAttemptsRef.current = 0;

                // Clear transcripts on new connection (fresh session)
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    transcripts: [],
                    session: {
                        id: data.trackingId,
                        sessionId: data.trackingId,
                        status: 'connected',
                        startedAt: new Date(),
                        totalMessages: 0,
                    }
                }));
                options.onConnected?.();

                // **FIX #4: Auto-start recording if enabled**
                if (options.autoStartRecording) {
                    startRecording().catch((err) => {
                        console.error('[VoiceAgent] Auto-start recording failed:', err);
                        // Error is already propagated by startRecording
                    });
                }
            };

            ws.onmessage = async (event) => {
                try {
                    // Handle binary audio data
                    if (event.data instanceof Blob) {
                        const arrayBuffer = await event.data.arrayBuffer();
                        if (playerRef.current && arrayBuffer.byteLength > 0) {
                            // Ensure player is ready
                            await playerRef.current.resume();
                            await playerRef.current.playChunk(arrayBuffer);
                            setState(prev => ({ ...prev, isSpeaking: true }));
                            if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                            speakingTimeoutRef.current = setTimeout(() => {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }, 1000);
                        }
                        return;
                    }

                    if (event.data instanceof ArrayBuffer) {
                        if (playerRef.current && event.data.byteLength > 0) {
                            await playerRef.current.resume();
                            await playerRef.current.playChunk(event.data);
                            setState(prev => ({ ...prev, isSpeaking: true }));
                            if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
                            speakingTimeoutRef.current = setTimeout(() => {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }, 1000);
                        }
                        return;
                    }

                    // Handle JSON messages
                    const data: WebSocketEvent = JSON.parse(event.data);

                    // Filter out keepalive/ping if necessary
                    if ((data as any).type === 'ping') return;

                    if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] WebSocket message:', data.type);

                    switch (data.type) {
                        case 'connected':
                            if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Agent ready');
                            break;

                        case 'transcript':
                            if (DEBUG_VOICE_AGENT) {
                                console.log('[VoiceAgent] Transcript received:', {
                                    speaker: data.speaker,
                                    textLength: data.text?.length,
                                    isFinal: data.is_final
                                });
                            }

                            setState(prev => {
                                const newState = handleTranscriptEvent(data, prev);
                                scheduleInterimTimeout(newState);
                                return newState;
                            });
                            break;

                        case 'response':
                            if (!data.text) {
                                console.warn('[VoiceAgent] Response missing text field');
                                break;
                            }
                            const responseTranscript: TranscriptMessage = {
                                id: `${Date.now()}_${Math.random()}`,
                                speaker: 'agent',
                                text: data.text || '',
                                confidence: data.confidence || 0.95,
                                isFinal: true,
                                timestamp: new Date(),
                            };
                            setState(prev => ({
                                ...prev,
                                transcripts: [...prev.transcripts, responseTranscript],
                                isSpeaking: true,
                                session: prev.session ? {
                                    ...prev.session,
                                    totalMessages: prev.session.totalMessages + 1,
                                } : null,
                            }));
                            break;

                        case 'audio':
                            if (data.audio && playerRef.current) {
                                const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
                                await playerRef.current.resume();
                                await playerRef.current.playChunk(audioData.buffer);
                                setState(prev => ({ ...prev, isSpeaking: true }));
                            }
                            break;

                        case 'state':
                            const { to } = data;
                            if (to === 'SPEAKING') {
                                setState(prev => ({ ...prev, isSpeaking: true }));
                            } else if (to === 'LISTENING' || to === 'IDLE') {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }
                            break;

                        case 'error':
                            console.error('[VoiceAgent] Server sent error:', data.error || data.message);
                            setState(prev => ({ ...prev, error: data.error || data.message || 'Unknown error' }));
                            options.onError?.(data.error || data.message || 'Unknown error');
                            // Close socket if server reports critical error
                            if (wsRef.current) wsRef.current.close();
                            break;

                        case 'interrupt':
                            if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Agent interrupted');
                            playerRef.current?.stop();
                            setState(prev => ({ ...prev, isSpeaking: false }));
                            break;
                    }
                } catch (error) {
                    console.error('[VoiceAgent] Failed to parse message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('[VoiceAgent] WebSocket error:', error);
                setState(prev => ({ ...prev, error: 'Connection error occurred' }));
                isConnectingRef.current = false;
                options.onError?.('Connection error occurred');
            };

            ws.onclose = (event) => {
                console.log('[VoiceAgent] WebSocket closed:', event.code, event.reason);
                isConnectingRef.current = false;
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    isRecording: false,
                    session: prev.session ? {
                        ...prev.session,
                        status: 'disconnected',
                        endedAt: new Date(),
                        durationSeconds: Math.floor((new Date().getTime() - prev.session.startedAt.getTime()) / 1000),
                    } : null,
                }));

                wsRef.current = null;
                options.onDisconnected?.();

                // Auto-reconnect logic
                if (!manualDisconnectRef.current && reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && event.code !== 1000 && event.code !== 1008 && isMountedRef.current) {
                    reconnectAttemptsRef.current++;
                    if (DEBUG_VOICE_AGENT) {
                        console.log(`[VoiceAgent] Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    }
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, getReconnectDelayMs(reconnectAttemptsRef.current));
                }
            };

        } catch (error: unknown) {
            console.error('[VoiceAgent] Failed to connect:', error);
            if (isMountedRef.current) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                setState(prev => ({ ...prev, error: errorMessage }));
                options.onError?.(errorMessage);
            }
            isConnectingRef.current = false;
        }
    }, [user, session, options, handleTranscriptEvent, scheduleInterimTimeout, getReconnectDelayMs, startRecording]);

    const disconnect = useCallback(async () => {
        manualDisconnectRef.current = true;

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        if (interimTranscriptTimeoutRef.current) {
            clearTimeout(interimTranscriptTimeoutRef.current);
            interimTranscriptTimeoutRef.current = null;
        }

        if (speakingTimeoutRef.current) {
            clearTimeout(speakingTimeoutRef.current);
            speakingTimeoutRef.current = null;
        }

        stopRecording();

        if (playerRef.current) {
            playerRef.current.close();
            playerRef.current = null;
        }

        if (trackingIdRef.current) {
            try {
                const token = session?.access_token;
                if (token) {
                    await authedBackendFetch('/api/founder-console/agent/web-test/end', {
                        method: 'POST',
                        body: JSON.stringify({ trackingId: trackingIdRef.current }),
                        timeoutMs: 20000,
                        retries: 1,
                        requireAuth: true,
                    });
                    if (DEBUG_VOICE_AGENT) console.log('[VoiceAgent] Web test session ended');
                }
            } catch (e) {
                console.error('[VoiceAgent] Failed to end session:', e);
            }
            trackingIdRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close(1000, 'User disconnected');
            wsRef.current = null;
        }

        isConnectingRef.current = false;
        reconnectAttemptsRef.current = 0;

        setState(prev => ({
            ...prev,
            isConnected: false,
            isRecording: false,
            session: prev.session ? {
                ...prev.session,
                status: 'disconnected',
                endedAt: new Date(),
                durationSeconds: Math.floor((new Date().getTime() - prev.session.startedAt.getTime()) / 1000),
            } : null,
        }));

    }, [stopRecording, session, user]);

    // Attempt to recover audio on tab/app foreground
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                try {
                    playerRef.current?.resume();
                } catch {
                    // ignore
                }
            }
        };
        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    // Cleanup on unmount (default behavior)
    useEffect(() => {
        if (options.preventAutoDisconnectOnUnmount) return;
        return () => {
            disconnect();
        };
    }, [disconnect, options.preventAutoDisconnectOnUnmount]);

    return {
        ...state,
        startCall: connect,
        stopCall: disconnect,
        startRecording,
        stopRecording,
    };
}
