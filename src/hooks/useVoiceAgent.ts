"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecorder } from '@/lib/audio/recorder';
import { AudioPlayer } from '@/lib/audio/player';
import { supabase } from '@/lib/supabase';
import type { VoiceAgentState, TranscriptMessage, WebSocketEvent } from '@/types/voice';

// Backend API URL - connects to local backend on port 3001
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

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
    const audioSendCountRef = useRef(0);
    const speakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastAudioTimeRef = useRef<number>(0);

    const MAX_RECONNECT_ATTEMPTS = 3;
    const RECONNECT_DELAY = 2000;
    const CONNECTION_TIMEOUT_MS = 10000; // 10 second timeout for WebSocket connection

    // Get auth token from Supabase
    const getAuthToken = useCallback(async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.error('Failed to get Supabase session:', error);
                return null;
            }
            return session?.access_token || null;
        } catch (e) {
            console.error('Error getting auth token:', e);
            return null;
        }
    }, []);

    // Connect to WebSocket via backend web-test endpoint
    const connect = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, error: null, isConnected: false }));

            const token = await getAuthToken();
            if (!token) {
                throw new Error('Not authenticated. Please log in first.');
            }

            // Step 1: Call backend to initiate web test and get WebSocket URL
            console.log('🔌 Initiating web test via backend...');
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
                
                // Handle specific error codes
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

            console.log('✅ Web test initiated:', { trackingId: data.trackingId, vapiCallId: data.vapiCallId });
            trackingIdRef.current = data.trackingId;

            // Step 2: Connect to the backend WebSocket bridge
            const wsUrl = data.bridgeWebsocketUrl;
            console.log('🔌 Connecting to WebSocket bridge:', wsUrl);

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            // Set connection timeout
            connectionTimeoutRef.current = setTimeout(() => {
                if (ws.readyState === WebSocket.CONNECTING) {
                    console.warn('🔌 WebSocket connection timeout');
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
                console.log('✅ WebSocket connected to bridge');
                reconnectAttemptsRef.current = 0;
                setState(prev => ({
                    ...prev,
                    isConnected: true,
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
                    // Handle binary audio data (can be Blob or ArrayBuffer)
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

                    // Handle ArrayBuffer (Node.js ws sends Buffer as ArrayBuffer)
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
                    console.log('📨 WebSocket message:', data.type);

                    switch (data.type) {
                        case 'connected':
                            console.log('Agent ready');
                            break;

                        case 'transcript':
                            // Validate transcript event has required fields
                            if (!data.text) {
                                console.warn('Transcript event missing text field');
                                break;
                            }
                            // Process both final and interim transcripts
                            const isFinal = data.is_final === true;
                            if (isFinal) {
                                setState(prev => {
                                    // Deduplicate: Don't add if identical to last message and within 500ms
                                    const lastMsg = prev.transcripts[prev.transcripts.length - 1];
                                    const isDuplicate = lastMsg &&
                                        lastMsg.text === data.text &&
                                        lastMsg.speaker === (data.speaker || 'user') &&
                                        (new Date().getTime() - lastMsg.timestamp.getTime() < 500);

                                    if (isDuplicate) return prev;

                                    const transcript: TranscriptMessage = {
                                        id: `${Date.now()}_${Math.random()}`,
                                        speaker: data.speaker || 'user',
                                        text: data.text,
                                        confidence: data.confidence,
                                        isFinal: true,
                                        timestamp: new Date(),
                                    };

                                    return {
                                        ...prev,
                                        transcripts: [...prev.transcripts, transcript],
                                        session: prev.session ? {
                                            ...prev.session,
                                            totalMessages: prev.session.totalMessages + 1,
                                        } : null,
                                    };
                                });
                            }
                            break;

                        case 'response':
                            // Validate response event has required fields
                            if (!data.text) {
                                console.warn('Response event missing text field');
                                break;
                            }
                            const transcript: TranscriptMessage = {
                                id: `${Date.now()}_${Math.random()}`,
                                speaker: 'agent',
                                text: data.text || '',
                                confidence: data.confidence,
                                isFinal: true,
                                timestamp: new Date(),
                            };
                            setState(prev => ({
                                ...prev,
                                transcripts: [...prev.transcripts, transcript],
                                isSpeaking: true,
                                session: prev.session ? {
                                    ...prev.session,
                                    totalMessages: prev.session.totalMessages + 1,
                                } : null,
                            }));
                            break;

                        case 'audio':
                            if (data.audio && playerRef.current) {
                                // Decode base64 audio and play
                                const audioData = Uint8Array.from(atob(data.audio), c => c.charCodeAt(0));
                                await playerRef.current.playChunk(audioData.buffer);
                                setState(prev => ({ ...prev, isSpeaking: true }));

                                // Don't auto-reset state here - let backend state events handle it
                                // or rely on player finish callback if implemented
                            }
                            break;

                        case 'state':
                            // Handle backend state changes
                            const { to } = data;
                            if (to === 'SPEAKING') {
                                setState(prev => ({ ...prev, isSpeaking: true }));
                            } else if (to === 'LISTENING' || to === 'IDLE') {
                                setState(prev => ({ ...prev, isSpeaking: false }));
                            }
                            break;

                        case 'error':
                            console.error('❌ Server error:', data.error || data.message);
                            setState(prev => ({ ...prev, error: data.error || data.message || 'Unknown error' }));
                            options.onError?.(data.error || data.message || 'Unknown error');
                            break;

                        case 'interrupt':
                            console.log('🔇 Agent interrupted');
                            playerRef.current?.stop();
                            setState(prev => ({ ...prev, isSpeaking: false }));
                            break;
                    }
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                setState(prev => ({ ...prev, error: 'Connection error occurred' }));
            };

            ws.onclose = (event) => {
                console.log('🔌 WebSocket closed:', event.code, event.reason);
                console.log(`   📊 Sent ${audioSendCountRef.current} audio chunks before closing`);
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
                    console.log(`🔄 Reconnecting... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
                    reconnectTimeoutRef.current = setTimeout(() => {
                        connect();
                    }, RECONNECT_DELAY);
                }
            };

        } catch (error: unknown) {
            console.error('Failed to connect:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState(prev => ({ ...prev, error: errorMessage }));
            options.onError?.(errorMessage);
        }
    }, [getAuthToken, options]);

    // Start recording
    const startRecording = useCallback(async () => {
        try {
            if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
                throw new Error('Not connected to server');
            }

            // Initialize audio player if not already done
            if (!playerRef.current) {
                playerRef.current = new AudioPlayer();
            }

            // Initialize audio recorder with WebSocket
            audioSendCountRef.current = 0;
            const recorder = new AudioRecorder(wsRef.current);

            await recorder.start();
            recorderRef.current = recorder;

            setState(prev => ({ ...prev, isRecording: true }));
            console.log('🎤 Recording started');
        } catch (error: unknown) {
            console.error('Failed to start recording:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            setState(prev => ({ ...prev, error: errorMessage }));
            options.onError?.(errorMessage);
        }
    }, [options]);

    // Stop recording
    const stopRecording = useCallback(() => {
        if (recorderRef.current) {
            recorderRef.current.stop();
            recorderRef.current = null;
        }
        setState(prev => ({ ...prev, isRecording: false }));
        console.log('🎤 Recording stopped');
    }, []);

    // Disconnect and end web test session
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

        // End the web test session on backend
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
                    console.log('✅ Web test session ended on backend');
                }
            } catch (e) {
                console.error('Failed to end web test session:', e);
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
            // Clear any pending timeouts
            if (speakingTimeoutRef.current) {
                clearTimeout(speakingTimeoutRef.current);
            }
            disconnect();
        };
    }, [disconnect]);

    return {
        ...state,
        connect,
        disconnect,
        startRecording,
        stopRecording,
    };
}
