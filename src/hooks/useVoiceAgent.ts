"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecorder } from '@/lib/audio/recorder';
import { AudioPlayer } from '@/lib/audio/player';
import { supabase } from '@/lib/supabase';
import type { VoiceAgentState, TranscriptMessage, WebSocketEvent } from '@/types/voice';

interface UseVoiceAgentOptions {
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: string) => void;
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
    const sessionIdRef = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substring(7)}`);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const audioSendCountRef = useRef(0);

    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000;

    // Get WebSocket URL
    const getWebSocketUrl = useCallback(() => {
        // Use secure WebSocket when talking to the hosted Roxanne backend.
        // In dev, the frontend runs on localhost:9120 but the voice orchestrator
        // is deployed on Render at roxanneai.onrender.com.

        // If an explicit env var is provided, always prefer that.
        const configuredHost = process.env.NEXT_PUBLIC_VOICE_BACKEND_URL;

        // Default to the Render host if not overridden.
        const host = configuredHost || 'roxanneai.onrender.com';

        // Use wss for remote HTTPS host, ws for localhost/dev overrides.
        const isLocal = host.startsWith('localhost') || host.startsWith('127.0.0.1');
        const protocol = isLocal ? 'ws:' : 'wss:';

        return `${protocol}//${host}/ws/web-client`;
    }, []);

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

    // Connect to WebSocket
    const connect = useCallback(async () => {
        try {
            setState(prev => ({ ...prev, error: null, isConnected: false }));

            const token = await getAuthToken();

            // Build WebSocket URL with optional token
            let wsUrl = `${getWebSocketUrl()}?sessionId=${sessionIdRef.current}`;
            if (token) {
                wsUrl += `&token=${token}`;
                console.log('🔌 Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN'));
            } else {
                console.log('🔌 Connecting to WebSocket (no auth):', wsUrl);
            }

            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('✅ WebSocket connected');
                reconnectAttemptsRef.current = 0;
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    session: {
                        id: sessionIdRef.current,
                        sessionId: sessionIdRef.current,
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
                            console.log('🎉 Agent ready:', data.message);
                            break;

                        case 'transcript':
                            if (data.text && data.is_final) {
                                setState(prev => {
                                    // Deduplicate: Don't add if identical to last message and within 1s
                                    const lastMsg = prev.transcripts[prev.transcripts.length - 1];
                                    const isDuplicate = lastMsg &&
                                        lastMsg.text === data.text &&
                                        lastMsg.speaker === (data.speaker || 'user') &&
                                        (new Date().getTime() - lastMsg.timestamp.getTime() < 1000);

                                    if (isDuplicate) return prev;

                                    const transcript: TranscriptMessage = {
                                        id: `${Date.now()}_${Math.random()}`,
                                        speaker: data.speaker || 'user',
                                        text: data.text || '',
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
                            if (data.text) {
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
                            }
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
    }, [getWebSocketUrl, getAuthToken, options]);

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

    // Disconnect
    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        stopRecording();

        if (playerRef.current) {
            playerRef.current.close();
            playerRef.current = null;
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
    }, [stopRecording]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
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
