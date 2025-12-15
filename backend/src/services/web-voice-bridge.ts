/**
 * Web Voice Bridge Service (v2 - Battle-Tested)
 * 
 * Manages WebSocket connections between browser clients and Vapi's WebSocket transport.
 * Handles PCM audio streaming (16-bit, 16kHz) and transcript messages.
 * 
 * Key invariants:
 * - vapiCallId: Vapi call ID (primary identifier)
 * - trackingId: Database call_tracking row ID
 * - userId: User who owns the session (for authorization)
 * - Session lifecycle: create → attach client → end
 * - No race conditions: createWebVoiceSession returns Promise that resolves only when Vapi is connected
 */

import WebSocket from 'ws';
import { supabase } from './supabase-client';
import { wsBroadcast } from './websocket';

// Constants
const VAPI_AUDIO_SAMPLE_RATE = 16000;
const WEB_VOICE_SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_CLEANUP_INTERVAL_MS = 60_000; // Check every 60 seconds
const CALL_TIMEOUT_MS = 15 * 60 * 1000; // 15 minute hard timeout for calls

interface WebVoiceSession {
  vapiCallId: string;
  trackingId: string;
  userId: string;
  vapiWebSocket: WebSocket;
  clientWebSocket: WebSocket | null;
  createdAt: number; // timestamp in ms
  timeoutHandle?: NodeJS.Timeout; // Handle for call timeout
}

interface VapiTranscriptMessage {
  type?: string;
  text?: string;
  content?: string;
  message?: string;
  role?: 'assistant' | 'user';
}

// Session map: trackingId -> WebVoiceSession
const webVoiceSessions = new Map<string, WebVoiceSession>();

/**
 * Validate UUID format (basic check)
 */
function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * End a session and close all connections
 */
function endSession(trackingId: string): void {
  const session = webVoiceSessions.get(trackingId);
  if (!session) return;

  // Clear timeout if set
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }

  try {
    if (session.clientWebSocket?.readyState === WebSocket.OPEN) {
      session.clientWebSocket.close(1000, 'Session ended');
    }
  } catch (e) {
    // ignore
  }

  try {
    if (session.vapiWebSocket?.readyState === WebSocket.OPEN) {
      session.vapiWebSocket.close(1000, 'Session ended');
    }
  } catch (e) {
    // ignore
  }

  webVoiceSessions.delete(trackingId);
}

/**
 * Periodic cleanup of stale sessions (TTL-based)
 */
function startSessionCleanup(): void {
  setInterval(() => {
    const now = Date.now();
    const sessionsToDelete: string[] = [];

    webVoiceSessions.forEach((session, trackingId) => {
      const ageMs = now - session.createdAt;
      if (ageMs > WEB_VOICE_SESSION_TTL_MS) {
        console.warn('[WebVoiceBridge] TTL cleanup: ending stale session', {
          trackingId,
          ageSeconds: Math.round(ageMs / 1000)
        });
        sessionsToDelete.push(trackingId);
      }
    });

    sessionsToDelete.forEach(trackingId => endSession(trackingId));
  }, SESSION_CLEANUP_INTERVAL_MS);
}

// Start cleanup on module load
startSessionCleanup();

/**
 * Create a new web voice session
 * 
 * Returns a Promise that resolves ONLY when the Vapi WebSocket connection is open.
 * This eliminates race conditions: by the time HTTP handler returns 200, backend has live Vapi connection.
 */
export function createWebVoiceSession(
  vapiCallId: string,
  trackingId: string,
  userId: string,
  vapiTransportUrl: string
): Promise<WebVoiceSession> {
  return new Promise((resolve, reject) => {
    // Check for duplicate sessions
    if (webVoiceSessions.has(trackingId)) {
      console.warn('[WebVoiceBridge] Duplicate session creation, cleaning up old session', { trackingId });
      endSession(trackingId);
    }

    const vapiWs = new WebSocket(vapiTransportUrl);

    const session: WebVoiceSession = {
      vapiCallId,
      trackingId,
      userId,
      vapiWebSocket: vapiWs,
      clientWebSocket: null,
      createdAt: Date.now()
    };

    // Resolve only when connection is open
    vapiWs.on('open', () => {
      console.log('[WebVoiceBridge] Vapi WebSocket connected', { vapiCallId, trackingId });
      
      // Set up call timeout (15 minutes max)
      session.timeoutHandle = setTimeout(() => {
        console.warn('[WebVoiceBridge] Call timeout reached, ending session', { vapiCallId, trackingId });
        endSession(trackingId);
        
        // Broadcast timeout event
        wsBroadcast({
          type: 'call_ended',
          vapiCallId,
          trackingId,
          userId,
          reason: 'timeout',
          durationSeconds: Math.floor((Date.now() - session.createdAt) / 1000)
        });
      }, CALL_TIMEOUT_MS);
      
      webVoiceSessions.set(trackingId, session);
      resolve(session);
    });

    // Reject on error
    vapiWs.on('error', (err) => {
      console.error('[WebVoiceBridge] Vapi WebSocket error during connection', { vapiCallId, error: err.message });
      reject(err);
    });

    // Handle messages from Vapi
    vapiWs.on('message', (data: WebSocket.Data) => {
      handleVapiMessage(data, session);
    });

    // Handle Vapi disconnect
    vapiWs.on('close', (code, reason) => {
      console.log('[WebVoiceBridge] Vapi WebSocket closed', { 
        vapiCallId, 
        trackingId,
        code,
        reason: reason?.toString(),
        clientConnected: session.clientWebSocket?.readyState === WebSocket.OPEN
      });
      
      // Close client if still connected
      if (session.clientWebSocket?.readyState === WebSocket.OPEN) {
        console.log('[WebVoiceBridge] Closing client due to Vapi disconnect', { trackingId });
        session.clientWebSocket.close(1000, 'Vapi connection closed');
      }

      // Broadcast call_ended
      wsBroadcast({
        type: 'call_ended',
        vapiCallId,
        trackingId,
        userId,
        reason: 'vapi_disconnected'
      });

      endSession(trackingId);
    });
  });
}

/**
 * Handle messages from Vapi (binary audio or JSON control messages)
 */
function handleVapiMessage(data: WebSocket.Data, session: WebVoiceSession): void {
  // Forward to client if connected
  if (session.clientWebSocket?.readyState === WebSocket.OPEN) {
    session.clientWebSocket.send(data);
  }

  // Try to parse as JSON control message (transcript, status, etc.)
  if (Buffer.isBuffer(data)) {
    const maybeJson = data.toString('utf8');
    
    // Log non-audio messages
    if (maybeJson.length < 500) {
      console.log('[WebVoiceBridge] Vapi buffer message', {
        trackingId: session.trackingId,
        length: data.byteLength,
        preview: maybeJson.substring(0, 150)
      });
    }
    
    try {
      const message = JSON.parse(maybeJson) as VapiTranscriptMessage;
      console.log('[WebVoiceBridge] Parsed Vapi JSON', {
        trackingId: session.trackingId,
        type: message.type,
        hasText: !!message.text,
        role: message.role
      });
      handleVapiTranscriptMessage(message, session);
      return;
    } catch {
      // Treat as pure audio binary; already forwarded to client above
      return;
    }
  }

  if (typeof data === 'string') {
    console.log('[WebVoiceBridge] Vapi string message', {
      trackingId: session.trackingId,
      length: data.length,
      preview: data.substring(0, 150)
    });
    
    try {
      const message = JSON.parse(data) as VapiTranscriptMessage;
      console.log('[WebVoiceBridge] Parsed Vapi JSON from string', {
        trackingId: session.trackingId,
        type: message.type,
        hasText: !!message.text,
        role: message.role
      });
      handleVapiTranscriptMessage(message, session);
    } catch {
      // Non-JSON text: ignore or log at debug level
    }
  }
}

/**
 * Handle transcript messages from Vapi
 * GUARANTEED FIX: Normalize speaker to 'agent'|'customer' for all outputs
 * CRITICAL FIX #3: Use actual Vapi confidence scores
 */
function handleVapiTranscriptMessage(
  message: VapiTranscriptMessage,
  session: WebVoiceSession
): void {
  // Extract text from various possible fields
  const text = (message.text ?? message.content ?? message.message ?? '').trim();
  if (!text) return;

  // Normalize speaker: Vapi uses 'assistant'/'user', we use 'agent'/'customer'
  const speaker: 'agent' | 'customer' =
    message.role === 'assistant' ? 'agent' : 'customer';

  // CRITICAL FIX #3: Use actual Vapi confidence, fallback to 0.95
  const confidence = (message as any).confidence ?? 0.95;

  const timestamp = Date.now();
  const transcriptPayload = {
    type: 'transcript',
    speaker,
    text,
    is_final: true,
    confidence,
    ts: timestamp
  };

  console.log('[WebVoiceBridge] Broadcasting transcript', {
    trackingId: session.trackingId,
    speaker,
    textLength: text.length,
    timestamp
  });

  // Send transcript event directly to client WebSocket (real-time)
  if (session.clientWebSocket?.readyState === WebSocket.OPEN) {
    try {
      session.clientWebSocket.send(JSON.stringify(transcriptPayload));
    } catch (err) {
      console.error('[WebVoiceBridge] Failed to send transcript to client', {
        trackingId: session.trackingId,
        error: (err as Error).message
      });
    }
  }

  // Broadcast transcript to main WS for other listeners (same format)
  wsBroadcast({
    type: 'transcript',
    vapiCallId: session.vapiCallId,
    trackingId: session.trackingId,
    userId: session.userId,
    speaker,
    text,
    is_final: true,
    ts: timestamp
  } as any);

  // Insert into call_transcripts (fire and forget)
  (async () => {
    try {
      await supabase.from('call_transcripts').insert({
        call_id: session.trackingId,
        speaker,
        text,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('[WebVoiceBridge] Failed to store transcript', {
        trackingId: session.trackingId,
        error: error?.message
      });
    }
  })();
}

/**
 * Attach a client WebSocket to an existing session
 */
export function attachClientWebSocket(
  trackingId: string,
  clientWs: WebSocket,
  userId: string
): boolean {
  // Validate trackingId format
  if (!isValidUuid(trackingId)) {
    console.error('[WebVoiceBridge] Invalid trackingId format', { trackingId });
    return false;
  }

  // Log all active sessions for debugging
  const activeSessions = Array.from(webVoiceSessions.keys());
  console.log('[WebVoiceBridge] Attachment attempt', { trackingId, userId, activeSessions });

  const session = webVoiceSessions.get(trackingId);
  if (!session) {
    console.error('[WebVoiceBridge] Session not found', { trackingId, activeSessions });
    return false;
  }

  // Check Vapi connection state
  if (session.vapiWebSocket?.readyState !== WebSocket.OPEN) {
    console.error('[WebVoiceBridge] Vapi WebSocket not open', {
      trackingId,
      vapiState: session.vapiWebSocket?.readyState
    });
    return false;
  }

  // Authorization: verify userId matches session owner
  if (session.userId !== userId) {
    console.error('[WebVoiceBridge] Unauthorized session attachment', {
      trackingId,
      requestedUserId: userId,
      sessionUserId: session.userId
    });
    return false;
  }

  // Close existing client connection if present (prevent duplicate attachments)
  if (session.clientWebSocket && session.clientWebSocket !== clientWs) {
    try {
      session.clientWebSocket.close(1008, 'New client attached');
    } catch {
      // ignore
    }
  }

  session.clientWebSocket = clientWs;

  // Forward client audio to Vapi
  let audioFrameCount = 0;
  clientWs.on('message', (data: WebSocket.Data) => {
    audioFrameCount++;
    
    if (session.vapiWebSocket?.readyState !== WebSocket.OPEN) {
      console.warn('[WebVoiceBridge] Vapi WebSocket not open, dropping audio frame', {
        trackingId,
        vapiState: session.vapiWebSocket?.readyState,
        frameCount: audioFrameCount
      });
      return;
    }

    try {
      session.vapiWebSocket.send(data);
      
      // Log every 100 frames to avoid spam
      if (audioFrameCount % 100 === 0) {
        console.log('[WebVoiceBridge] Audio forwarding active', {
          trackingId,
          frameCount: audioFrameCount,
          vapiBuffered: session.vapiWebSocket.bufferedAmount
        });
      }
    } catch (err) {
      console.error('[WebVoiceBridge] Failed to send audio to Vapi', {
        trackingId,
        error: (err as Error).message,
        frameCount: audioFrameCount
      });
    }
  });

  // Handle client disconnect
  clientWs.on('close', () => {
    console.log('[WebVoiceBridge] Client disconnected', { trackingId });
    if (session.clientWebSocket === clientWs) {
      session.clientWebSocket = null;
    }
  });

  clientWs.on('error', (error) => {
    console.error('[WebVoiceBridge] Client WebSocket error', {
      trackingId,
      error: error.message
    });
  });

  return true;
}

/**
 * End a web voice session explicitly
 */
export function endWebVoiceSession(trackingId: string): void {
  const session = webVoiceSessions.get(trackingId);
  if (!session) {
    console.warn('[WebVoiceBridge] Session not found for end', { trackingId });
    return;
  }

  console.log('[WebVoiceBridge] Ending session', { trackingId });

  // Send end-call control message to Vapi
  if (session.vapiWebSocket?.readyState === WebSocket.OPEN) {
    try {
      session.vapiWebSocket.send(JSON.stringify({ type: 'end-call' }));
    } catch (e) {
      // ignore
    }
  }

  // Broadcast call_ended
  wsBroadcast({
    type: 'call_ended',
    vapiCallId: session.vapiCallId,
    trackingId: session.trackingId,
    userId: session.userId,
    reason: 'client_ended'
  });

  // Clean up
  endSession(trackingId);
}

/**
 * Get an active session (for monitoring/debugging)
 */
export function getSession(trackingId: string): WebVoiceSession | undefined {
  return webVoiceSessions.get(trackingId);
}

/**
 * Get all active sessions (for monitoring)
 */
export function getActiveSessions(): WebVoiceSession[] {
  return Array.from(webVoiceSessions.values());
}
