/**
 * WebSocket Service for CallWaiting AI
 * Handles real-time call monitoring and transcript streaming
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { attachClientWebSocket } from './web-voice-bridge';
import { supabase } from './supabase-client';
import { createLogger } from './logger';

const logger = createLogger('WebSocket');

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
  | { type: 'recording_ready'; callId: string; recordingUrl: string; storagePath: string; expiresAt: string; timestamp: string }
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
    logger.info('Client connected', { remoteAddress: req.socket.remoteAddress, origin });
    
    // Store client with empty userId initially
    clients.set(ws, { ws, userId: undefined });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        if (DEBUG_WS) logger.debug('Received message', { type: data?.type });
        
        // Handle subscribe message to set userId
        if (data.type === 'subscribe') {
          const client = clients.get(ws);
          if (!client) return;

          const token = typeof data.token === 'string' ? data.token : undefined;

          // CRITICAL SECURITY FIX: Require token in production (no dev bypass by default)
          // Dev bypass requires BOTH NODE_ENV=development AND ALLOW_DEV_WS_BYPASS=true
          const isProduction = process.env.NODE_ENV !== 'development';
          const allowDevBypass = process.env.ALLOW_DEV_WS_BYPASS === 'true';
          const isDev = !isProduction && allowDevBypass;

          // If no token provided and not in dev mode, reject
          if (!token && !isDev) {
            logger.warn('WebSocket subscription rejected: no token provided (production mode)', {
              nodeEnv: process.env.NODE_ENV,
              allowDevBypass
            });
            ws.close(1008, 'Unauthorized: Token required');
            return;
          }

          if (token) {
            // Validate JWT format BEFORE calling Supabase
            const jwtParts = token.split('.');
            if (jwtParts.length !== 3) {
              logger.warn('WebSocket auth failed: Invalid JWT format');
              ws.close(1008, 'Unauthorized: Invalid token format');
              return;
            }

            // CRITICAL: Check token expiry from decoded payload
            try {
              const payload = JSON.parse(Buffer.from(jwtParts[1], 'base64').toString());
              if (payload.exp && payload.exp * 1000 < Date.now()) {
                logger.warn('WebSocket auth failed: Token expired', { exp: payload.exp });
                ws.close(1008, 'Unauthorized: Token expired');
                return;
              }
            } catch (decodeErr) {
              logger.warn('WebSocket auth failed: Could not decode JWT payload', { error: (decodeErr as any)?.message });
              ws.close(1008, 'Unauthorized: Invalid token');
              return;
            }

            // Authenticate with timeout to prevent race conditions
            const authTimeout = setTimeout(() => {
              logger.warn('WebSocket auth timeout');
              ws.close(1008, 'Auth timeout');
            }, 5000);

            supabase.auth
              .getUser(token)
              .then(({ data: authData, error }) => {
                clearTimeout(authTimeout);
                if (error || !authData?.user?.id) {
                  logger.warn('WebSocket auth failed', { error: error?.message });
                  ws.close(1008, 'Unauthorized: Invalid token');
                  return;
                }

                client.userId = authData.user.id;
                if (DEBUG_WS) logger.debug('Client authenticated and subscribed', { userId: client.userId });
              })
              .catch((err) => {
                clearTimeout(authTimeout);
                logger.error('WebSocket auth error', { error: err?.message });
                ws.close(1008, 'Unauthorized: Auth error');
              });
          } else if (isDev) {
            // DEVELOPMENT MODE ONLY: use hardcoded test userId (requires explicit env var)
            client.userId = 'dev-test-user';
            if (DEBUG_WS) logger.debug('Dev-mode subscription accepted (ALLOW_DEV_WS_BYPASS=true)', { userId: client.userId });
          }
        }
        
        // Handle ping/pong for connection health
        if (data.type === 'ping') {
          safeSend(ws, JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        }
      } catch (e) {
        logger.error('Failed to parse WebSocket message', { error: (e as any)?.message });
      }
    });

    ws.on('close', () => {
      logger.debug('Client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('Client error', { error: (error as any)?.message });
      clients.delete(ws);
    });
  });

  logger.info('Server initialized on /ws/live-calls');
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
      logger.warn('Dropping event in production: missing userId', { type: (event as any).type });
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

  const broadcastScope = (event as any).userId ? ` to user ${(event as any).userId}` : ' to all clients';
  if (DEBUG_WS) logger.debug(`Broadcast ${(event as any).type}${broadcastScope}`, { sentCount });
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
    logger.debug('WebVoice new connection', { url });

    // Extract trackingId from path: /api/web-voice/trackingId?userId=xxx
    const pathMatch = url.match(/\/api\/web-voice\/([^/?]+)/);
    const trackingId = pathMatch?.[1];

    // Extract userId from query params with error handling
    let userId: string | null = null;
    try {
      const urlObj = new URL(url, 'http://localhost');
      userId = urlObj.searchParams.get('userId');
    } catch (err) {
      logger.error('WebVoice URL parsing failed', { url, error: (err as any)?.message });
      ws.close(1008, 'Invalid URL');
      return;
    }

    logger.debug('WebVoice parsed connection params', { trackingId, userId });

    if (!trackingId || !userId) {
      logger.warn('WebVoice connection rejected: missing trackingId or userId', { trackingId, userId });
      ws.close(1008, 'Missing trackingId or userId');
      return;
    }

    logger.info('WebVoice client connecting to session', { trackingId });

    // Attach client WebSocket to the session with authorization
    const attached = attachClientWebSocket(trackingId, ws, userId);
    if (!attached) {
      logger.error('WebVoice failed to attach client to session', { trackingId });
      ws.close(1008, 'Session not found or unauthorized');
      return;
    }

    logger.info('WebVoice client successfully attached to session', { trackingId });

    ws.on('close', () => {
      logger.debug('WebVoice client disconnected from session', { trackingId });
    });

    ws.on('error', (error) => {
      logger.error('WebVoice client error', { trackingId, error: (error as any)?.message });
    });
  });

  logger.info('WebVoice WebSocket server initialized for media bridge');
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
  
  logger.info('Server closed');
}

export default {
  initWebSocket,
  initWebVoiceWebSocket,
  wsBroadcast,
  broadcastMetrics,
  getConnectedClientCount,
  closeWebSocket
};
