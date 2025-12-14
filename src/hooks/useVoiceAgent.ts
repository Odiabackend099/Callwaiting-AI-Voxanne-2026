"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecorder } from '@/lib/audio/recorder';
import { AudioPlayer } from '@/lib/audio/player';
import { supabase } from '@/lib/supabase';
import type { VoiceAgentState, TranscriptMessage, WebSocketEvent } from '@/types/voice';
import { mapDbSpeakerToFrontend, type FrontendSpeaker } from '@/types/transcript';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
const MAX_TRANSCRIPT_HISTORY = 100;
const INTERIM_TRANSCRIPT_TIMEOUT_MS = 5000;

interface UseVoiceAgentOptions {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
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

    const wsRef = useRef<WebSocket | null>(null);
    const recorderRef = useRef<AudioRecorder | null>(null);
    const playerRef = useRef<AudioPlayer | null>(null);
    const trackingIdRef = useRef<string | null>(null);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const interimTranscriptTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000;
    const CONNECTION_TIMEOUT_MS = 10000;

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

    const getAuthToken = useCallback(async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('[VoiceAgent] Failed to get session:', error);
                return null;
            }
            return session?.access_token || null;
        } catch (e) {
            console.error('[VoiceAgent] Error getting auth token:', e);
            return null;
        }
    }, []);

    const connect = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, error: null, isConnected: false }));

            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated. Please log in first.');
            }

            console.log('[VoiceAgent] Initiating web test...');
            const response = await fetch(`${API_BASE_URL}/api/founder-console/agent/web-test`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({})
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                if (response.status === 401) {
                    throw new Error('Not authenticated. Please log in first.');
                }
                if (response.status === 400) {
                    throw new Error(errorData.error || 'Agent not configured. Please configure agent settings first.');
                }
                throw new Error(errorData.error || `Failed to start web test: ${response.status}`);
            }

            const data: WebTestResponse = await response.json();
            
            if (!data.success || !data.bridgeWebsocketUrl) {
                throw new Error(data.error || 'Failed to get WebSocket URL from backend');
            }

            console.log('[VoiceAgent] Web test initiated:', { trackingId: data.trackingId });
            trackingIdRef.current = data.trackingId;

            const wsUrl = data.bridgeWebsocketUrl;
            console.log('[VoiceAgent] Connecting to WebSocket:', wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            connectionTimeoutRef.current = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.warn('[VoiceAgent] WebSocket connection timeout');
                    ws.close();
                    setState(prev => ({ ...prev, error: 'Connection timeout. Please try again.' }));
                    options.onError?.('Connection timeout');
                }
            }, CONNECTION_TIMEOUT_MS);

            ws.onopen = () => {
                if (connectionTimeoutRef.current) {
                    clearTimeout(connectionTimeoutRef.current);
                    connectionTimeoutRef.current = null;
                }
                console.log('[VoiceAgent] WebSocket connected');
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
            };

            ws.onmessage = async (event) => {
                try {
                    // Handle binary audio data
                    if (event.data instanceof Blob) {
                        const arrayBuffer = await event.data.arrayBuffer();
                        if (playerRef.current && arrayBuffer.byteLength > 0) {
                            await playerRef.current.playChunk(arrayBuffer);
                            setState(prev => ({ ...prev, isSpeaking: true }));
                            setTimeout(() => {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }, 1000);
                        }
                        return;
                    }

                    if (event.data instanceof ArrayBuffer) {
                        if (playerRef.current && event.data.byteLength > 0) {
                            await playerRef.current.playChunk(event.data);
                            setState(prev => ({ ...prev, isSpeaking: true }));
                            setTimeout(() => {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }, 1000);
                        }
                        return;
                    }

                    // Handle JSON messages
                    const data: WebSocketEvent = JSON.parse(event.data);
                    console.log('[VoiceAgent] WebSocket message:', data.type);

                    switch (data.type) {
                        case 'connected':
                            console.log('[VoiceAgent] Agent ready');
                            break;

                        case 'transcript':
                            console.log('[VoiceAgent] Transcript received:', {
                                speaker: data.speaker,
                                textLength: data.text?.length,
                                isFinal: data.is_final
                            });
                            
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
                            console.error('[VoiceAgent] Server error:', data.error || data.message);
                            setState(prev => ({ ...prev, error: data.error || data.message || 'Unknown error' }));
                            options.onError?.(data.error || data.message || 'Unknown error');
                            break;

                        case 'interrupt':
                            console.log('[VoiceAgent] Agent interrupted');
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
            };

            ws.onclose = (event) => {
                console.log('[VoiceAgent] WebSocket closed:', event.code);
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    isRecording: false,
                    session: prev.session ? {
                        ...prev.session,
                        status: 'disconnected',
                        endedAt: new Date(),
                    } : null,
                }));

                wsRef.current = null;
                options.onDisconnected?.();

                // Auto-reconnect logic
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS && event.code !== 1000) {
                    reconnectAttemptsRef.current++;
                    console.log(`[VoiceAgent] Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                }
            };

        } catch (error: unknown) {
            console.error('[VoiceAgent] Failed to connect:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState(prev => ({ ...prev, error: errorMessage }));
            options.onError?.(errorMessage);
        }
    }, [getAuthToken, options]);

    const startRecording = useCallback(async () => {
        try {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error('Not connected to server');
            }

            if (!playerRef.current) {
                playerRef.current = new AudioPlayer();
            }

            const recorder = new AudioRecorder(wsRef.current);
            await recorder.start();
            recorderRef.current = recorder;

            setState(prev => ({ ...prev, isRecording: true }));
            console.log('[VoiceAgent] Recording started');
        } catch (error: unknown) {
            console.error('[VoiceAgent] Failed to start recording:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState(prev => ({ ...prev, error: errorMessage }));
            options.onError?.(errorMessage);
        }
    }, [options]);

    const stopRecording = useCallback(() => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        setState(prev => ({ ...prev, isRecording: false }));
        console.log('[VoiceAgent] Recording stopped');
    }, []);

    const disconnect = useCallback(async () => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (connectionTimeoutRef.current) {
            clearTimeout(connectionTimeoutRef.current);
            connectionTimeoutRef.current = null;
        }

        stopRecording();

        if (playerRef.current) {
            playerRef.current.close();
            playerRef.current = null;
        }

        if (trackingIdRef.current) {
            try {
                const token = await getAuthToken();
                if (token) {
                    await fetch(`${API_BASE_URL}/api/founder-console/agent/web-test/end`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ trackingId: trackingIdRef.current })
                    });
                    console.log('[VoiceAgent] Web test session ended');
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

        setState(prev => ({
            ...prev,
            isConnected: false,
            session: prev.session ? {
                ...prev.session,
                status: 'disconnected',
                endedAt: new Date(),
                durationSeconds: Math.floor((new Date().getTime() - prev.session.startedAt.getTime()) / 1000),
            } : null,
        }));
    }, [stopRecording, getAuthToken]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        ...state,
        startCall: connect,
        stopCall: disconnect,
        startRecording,
        stopRecording,
    };
}
