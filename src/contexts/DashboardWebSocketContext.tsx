'use client';

import React, { createContext, useContext, useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketEvent {
    type: string;
    [key: string]: any;
}

interface DashboardWebSocketContextValue {
    isConnected: boolean;
    backendAvailable: boolean;
    subscribe: (eventType: string, callback: (data: WebSocketEvent) => void) => () => void;
}

const DashboardWebSocketContext = createContext<DashboardWebSocketContextValue>({
    isConnected: false,
    backendAvailable: true,
    subscribe: () => () => {},
});

export function useDashboardWebSocket() {
    return useContext(DashboardWebSocketContext);
}

const MAX_RECONNECT_ATTEMPTS = 15;
const BASE_RECONNECT_DELAY = 1000;

export function DashboardWebSocketProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [backendAvailable, setBackendAvailable] = useState(true);
    const wsRef = useRef<WebSocket | null>(null);
    const subscribersRef = useRef<Map<string, Set<(data: WebSocketEvent) => void>>>(new Map());
    const reconnectAttemptsRef = useRef(0);
    const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const mountedRef = useRef(true);

    const dispatch = useCallback((event: WebSocketEvent) => {
        const subscribers = subscribersRef.current.get(event.type);
        if (subscribers) {
            subscribers.forEach((cb) => {
                try { cb(event); } catch (e) { console.error('WS subscriber error:', e); }
            });
        }
        // Also dispatch to wildcard subscribers
        const wildcardSubs = subscribersRef.current.get('*');
        if (wildcardSubs) {
            wildcardSubs.forEach((cb) => {
                try { cb(event); } catch (e) { console.error('WS wildcard subscriber error:', e); }
            });
        }
    }, []);

    const connect = useCallback(() => {
        if (!mountedRef.current) return;
        // Clean up existing connection
        if (wsRef.current) {
            wsRef.current.onclose = null;
            wsRef.current.onerror = null;
            wsRef.current.onmessage = null;
            if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
                wsRef.current.close();
            }
        }

        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
        const wsProtocol = backendUrl.startsWith('https') ? 'wss:' : 'ws:';
        const wsHost = backendUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const wsUrl = `${wsProtocol}//${wsHost}/ws/live-calls`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                if (!mountedRef.current) return;
                setIsConnected(true);
                setBackendAvailable(true);
                reconnectAttemptsRef.current = 0;
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type) {
                        dispatch(data);
                    }
                } catch (err) {
                    console.error('Failed to parse WS message:', err);
                }
            };

            ws.onerror = () => {
                // onclose will handle reconnection
            };

            ws.onclose = () => {
                if (!mountedRef.current) return;
                setIsConnected(false);
                wsRef.current = null;

                // Reconnect with exponential backoff
                if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
                    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
                    reconnectAttemptsRef.current++;
                    reconnectTimerRef.current = setTimeout(connect, delay);
                } else {
                    setBackendAvailable(false);
                }
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
        }
    }, [dispatch]);

    useEffect(() => {
        mountedRef.current = true;
        connect();

        return () => {
            mountedRef.current = false;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.onclose = null;
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, [connect]);

    const subscribe = useCallback((eventType: string, callback: (data: WebSocketEvent) => void) => {
        if (!subscribersRef.current.has(eventType)) {
            subscribersRef.current.set(eventType, new Set());
        }
        subscribersRef.current.get(eventType)!.add(callback);

        // Return unsubscribe function
        return () => {
            const subs = subscribersRef.current.get(eventType);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    subscribersRef.current.delete(eventType);
                }
            }
        };
    }, []);

    return (
        <DashboardWebSocketContext.Provider value={{ isConnected, backendAvailable, subscribe }}>
            {children}
        </DashboardWebSocketContext.Provider>
    );
}
