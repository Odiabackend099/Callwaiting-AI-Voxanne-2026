/**
 * WebSocket Service for Voice AI Founder Console
 * Handles real-time call monitoring and transcript streaming
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { attachClientWebSocket } from './web-voice-bridge';
import { supabase } from './supabase-client';

const DEBUG_WS = process.env.DEBUG_WEBSOCKET === 'true';
const MAX_WS_BUFFERED_AMOUNT_BYTES = Number(process.env.WS_MAX_BUFFERED_BYTES || 2_000_000);

function safeSend(ws: WebSocket, message: string): boolean {
  if (ws.readyState !== WebSocket.OPEN) return false;
  if (typeof (ws as any).bufferedAmount === 'number' && (ws as any).bufferedAmount > MAX_WS_BUFFERED_AMOUNT_BYTES) {
    return false;
  }
  try {
    ws.send(message);
    return true;
  } catch {
    return false;
  }
}

// Metrics data structure
export interface UsageMetrics {
  today: {
    calls: number;
    answeredCalls: number;
    successRate: number;
    totalMinutes: number;
    estimatedCost: number;
  };
  monthly: {
    calls: number;
    answeredCalls: number;
    successRate: number;
    totalMinutes: number;
    estimatedCost: number;
  };
  creditWarningThreshold: number;
}

// Event types that match the frontend WSEvent type
export type WSEventType = (
  | { type: 'call_status'; vapiCallId: string; trackingId: string; userId: string; status: 'connecting' | 'ringing' | 'in_progress' | 'ended' | 'failed' }
  | { type: 'transcript'; vapiCallId: string; trackingId: string; userId: string; speaker: 'agent' | 'customer'; text: string; is_final: boolean; confidence: number; frontendSpeaker?: 'agent' | 'user'; ts: number }
  | { type: 'transcript_delta'; vapiCallId: string; trackingId: string; userId: string; speaker: 'agent' | 'customer'; text: string; ts: number }
  | { type: 'call_ended'; vapiCallId: string; trackingId: string; userId: string; durationSeconds?: number; reason?: string }
  | { type: 'metrics_update'; metrics: UsageMetrics }
);

// WebSocket client with user context
interface WebSocketClient {
  ws: WebSocket;
  userId?: string;
}

// Store connected clients with user context
const clients: Map<WebSocket, WebSocketClient> = new Map();

let wss: WebSocketServer | null = null;

/**
 * Initialize WebSocket server on existing WebSocketServer instance
 */
export function initWebSocket(wssInstance: WebSocketServer): WebSocketServer {
  wss = wssInstance;
  
  // Set up origin verification for manual upgrade handling
  // (verifyClient is only used when WebSocketServer is attached to HTTP server directly)
  // For manual upgrade handling, origin validation happens in server.ts upgrade handler

  wss.on('connection', (ws: WebSocket, req) => {
    const origin = req.headers.origin || 'unknown';
    console.log(`[WebSocket] Client connected from ${req.socket.remoteAddress} (origin: ${origin})`);
    
    // Store client with empty userId initially
    clients.set(ws, { ws, userId: undefined });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (DEBUG_WS) console.log('[WebSocket] Received message:', { type: data?.type });
        
        // Handle subscribe message to set userId
        if (data.type === 'subscribe') {
          const client = clients.get(ws);
          if (!client) return;

          const isDev = (process.env.NODE_ENV || 'development') === 'development';
          const token = typeof data.token === 'string' ? data.token : undefined;

          // In production, never trust a client-provided userId.
          if (!isDev && !token) {
            ws.close(1008, 'Unauthorized');
            return;
          }

          if (token) {
            supabase.auth
              .getUser(token)
              .then(({ data: authData, error }) => {
                if (error || !authData?.user?.id) {
                  ws.close(1008, 'Unauthorized');
                  return;
                }

                client.userId = authData.user.id;
                if (DEBUG_WS) console.log('[WebSocket] Client authenticated and subscribed', { userId: client.userId });
              })
              .catch(() => {
                ws.close(1008, 'Unauthorized');
              });
          } else if (isDev && typeof data.userId === 'string' && data.userId) {
            // Dev-only fallback for local testing
            client.userId = data.userId;
            if (DEBUG_WS) console.log('[WebSocket] Dev-mode subscription accepted', { userId: client.userId });
          } else {
            ws.close(1008, 'Unauthorized');
            return;
          }
        }
        
        // Handle ping/pong for connection health
        if (data.type === 'ping') {
          safeSend(ws, JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        console.error('[WebSocket] Failed to parse message:', e);
      }
    });

    ws.on('close', () => {
      console.log('[WebSocket] Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('[WebSocket] Client error:', error);
      clients.delete(ws);
    });
  });

  console.log('[WebSocket] Server initialized on /ws/live-calls');
  return wss;
}

/**
 * Broadcast event to all connected clients
 * If userId is specified in event, only send to that user
 */
export function wsBroadcast(event: WSEventType): void {
  // Never broadcast user-scoped call events without userId in production.
  // This prevents cross-user transcript leakage if a handler forgets to attach userId.
  if (process.env.NODE_ENV === 'production') {
    if ((event as any).type !== 'metrics_update' && !(event as any).userId) {
      return;
    }
  }

  const message = JSON.stringify(event);
  let sentCount = 0;

  clients.forEach((client) => {
    // Filter by userId for call events (always present)
    if ((event as any).userId && client.userId !== (event as any).userId) return;

    if (safeSend(client.ws, message)) sentCount++;
  });

  const targetInfo = (event as any).userId ? ` to user ${(event as any).userId}` : ' to all clients';
  if (DEBUG_WS) console.log(`[WebSocket] Broadcast ${(event as any).type}${targetInfo}: ${sentCount} clients`);
}

/**
 * Broadcast metrics update to all connected clients
 */
export function broadcastMetrics(metrics: UsageMetrics): void {
  wsBroadcast({ type: 'metrics_update', metrics });
}

/**
 * Get count of connected clients
 */
export function getConnectedClientCount(): number {
  return clients.size;
}

/**
 * Initialize WebSocket server for web-voice media bridge
 * Handles browser audio ↔ Vapi WebSocket connections
 */
export function initWebVoiceWebSocket(server: Server): WebSocketServer {
  // Create WebSocket server with noServer: true for manual upgrade handling
  // This allows us to handle /api/web-voice/* paths via server.on('upgrade')
  const webVoiceWss = new WebSocketServer({ 
    noServer: true
  });

  webVoiceWss.on('connection', (ws: WebSocket, req) => {
    const url = req.url || '';
    console.log('[WebVoice] New connection:', { url });

    // Extract trackingId from path: /api/web-voice/trackingId?userId=xxx
    const pathMatch = url.match(/\/api\/web-voice\/([^/?]+)/);
    const trackingId = pathMatch?.[1];

    // Extract userId from query params
    const urlObj = new URL(url, 'http://localhost');
    const userId = urlObj.searchParams.get('userId');

    console.log('[WebVoice] Parsed connection params:', { trackingId, userId });

    if (!trackingId || !userId) {
      console.warn('[WebVoice] Connection rejected: missing trackingId or userId', { trackingId, userId });
      ws.close(1008, 'Missing trackingId or userId');
      return;
    }

    console.log(`[WebVoice] Client connecting to session: ${trackingId}`);

    // Attach client WebSocket to the session with authorization
    const attached = attachClientWebSocket(trackingId, ws, userId);
    if (!attached) {
      console.error('[WebVoice] Failed to attach client to session', { trackingId });
      ws.close(1008, 'Session not found or unauthorized');
      return;
    }

    console.log(`[WebVoice] Client successfully attached to session: ${trackingId}`);

    ws.on('close', () => {
      console.log(`[WebVoice] Client disconnected from session: ${trackingId}`);
    });

    ws.on('error', (error) => {
      console.error(`[WebVoice] Client error for session ${trackingId}:`, error);
    });
  });

  console.log('[WebVoice] WebSocket server initialized for media bridge');
  return webVoiceWss;
}

/**
 * Close all connections and shutdown WebSocket server
 */
export function closeWebSocket(): void {
  clients.forEach((client) => {
    client.ws.close();
  });
  clients.clear();
  
  if (wss) {
    wss.close();
    wss = null;
  }
  
  console.log('[WebSocket] Server closed');
}

export default {
  initWebSocket,
  initWebVoiceWebSocket,
  wsBroadcast,
  broadcastMetrics,
  getConnectedClientCount,
  closeWebSocket
};
