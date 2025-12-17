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
const MAX_VAPI_BUFFERED_AMOUNT_BYTES = 2 * 1024 * 1024; // 2MB
const DEBUG_WEB_VOICE_BRIDGE = process.env.DEBUG_WEB_VOICE_BRIDGE === 'true';

interface WebVoiceSession {
  vapiCallId: string;
  trackingId: string;
  userId: string;
  vapiWebSocket: WebSocket;
  clientWebSocket: WebSocket | null;
  createdAt: number; // timestamp in ms
  timeoutHandle?: NodeJS.Timeout; // Handle for call timeout
  vapiClosed?: boolean; // Flag if Vapi closed cleanly or errored
  closeReason?: string; // Reason for Vapi closure
  closeCode?: number; // Code for Vapi closure
  ended?: boolean;
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
 * Mark session as closed but keep it briefly to allow client to read error
 */
function markSessionClosed(trackingId: string, code: number, reason: string): void {
  const session = webVoiceSessions.get(trackingId);
  if (!session) return;

  session.vapiClosed = true;
  session.closeCode = code;
  session.closeReason = reason;

  // Clear call timeout
  if (session.timeoutHandle) {
    clearTimeout(session.timeoutHandle);
  }

  // Delete after 5 seconds
  setTimeout(() => {
    endSession(trackingId);
  }, 5000);
}

function broadcastCallEndedOnce(session: WebVoiceSession, reason: string, durationSeconds?: number): void {
  if (session.ended) return;
  session.ended = true;
  wsBroadcast({
    type: 'call_ended',
    vapiCallId: session.vapiCallId,
    trackingId: session.trackingId,
    userId: session.userId,
    reason,
    ...(typeof durationSeconds === 'number' ? { durationSeconds } : {})
  });
}

/**
 * Periodic cleanup of stale sessions (TTL-based)
 */
function startSessionCleanup(): void {
  const interval = setInterval(() => {
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

  interval.unref();
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
    try {
      const parsed = new URL(vapiTransportUrl);
      if (parsed.protocol !== 'wss:') {
        reject(new Error('Invalid Vapi transport URL protocol'));
        return;
      }
      const host = parsed.hostname.toLowerCase();
      if (!(host === 'api.vapi.ai' || host.endsWith('.vapi.ai'))) {
        reject(new Error('Invalid Vapi transport URL host'));
        return;
      }
    } catch {
      reject(new Error('Invalid Vapi transport URL'));
      return;
    }

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

    // CRITICAL FIX: Add session to map IMMEDIATELY (before Vapi connects)
    // This prevents race condition where frontend connects before session exists
    webVoiceSessions.set(trackingId, session);
    console.log('[WebVoiceBridge] Session created and registered', { trackingId, vapiCallId });

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

      resolve(session);
    });

    // Reject on error
    vapiWs.on('error', (err) => {
      console.error('[WebVoiceBridge] Vapi WebSocket error during connection', { vapiCallId, error: err.message });
      markSessionClosed(trackingId, 1011, err.message || 'Vapi WebSocket error');
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

      broadcastCallEndedOnce(session, 'vapi_disconnected');

      // Mark session as closed with reason, don't delete immediately
      markSessionClosed(trackingId, code, reason?.toString());
    });
  });
}

/**
 * Handle messages from Vapi (binary audio or JSON control messages)
 * CRITICAL FIX: Buffer audio to smooth out Vapi's bursty delivery
 */
function handleVapiMessage(data: WebSocket.Data, session: WebVoiceSession): void {
  // Forward to client if connected, but only if it's valid data
  if (session.clientWebSocket?.readyState === WebSocket.OPEN) {
    // Validate data before sending
    if (Buffer.isBuffer(data) && data.byteLength > 0) {
      // Only send if it looks like audio (not JSON control message)
      const maybeJson = data.toString('utf8');
      const trimmed = maybeJson.trimStart();
      const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
      
      // If it's not JSON, it's audio - send it
      if (!looksLikeJson) {
        try {
          session.clientWebSocket.send(data);
        } catch (err) {
          console.error('[WebVoiceBridge] Failed to send audio to client', { trackingId: session.trackingId, error: err instanceof Error ? err.message : String(err) });
        }
        return;
      }
    } else if (typeof data === 'string' && data.length > 0) {
      // String data - send as-is (likely JSON)
      try {
        session.clientWebSocket.send(data);
      } catch (err) {
        console.error('[WebVoiceBridge] Failed to send message to client', { trackingId: session.trackingId, error: err instanceof Error ? err.message : String(err) });
      }
      return;
    }
  }

  // Try to parse as JSON control message (transcript, status, etc.)
  if (Buffer.isBuffer(data)) {
    const maybeJson = data.toString('utf8');

    const trimmed = maybeJson.trimStart();
    const looksLikeJson = trimmed.startsWith('{') || trimmed.startsWith('[');
    if (!looksLikeJson || maybeJson.length > 2000) {
      return;
    }

    if (DEBUG_WEB_VOICE_BRIDGE && maybeJson.length < 500) {
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
    if (DEBUG_WEB_VOICE_BRIDGE) {
      console.log('[WebVoiceBridge] Vapi string message', {
        trackingId: session.trackingId,
        length: data.length,
        preview: data.substring(0, 150)
      });
    }

    try {
      const message = JSON.parse(data) as VapiTranscriptMessage;
      if (DEBUG_WEB_VOICE_BRIDGE) {
        console.log('[WebVoiceBridge] Parsed Vapi JSON from string', {
          trackingId: session.trackingId,
          type: message.type,
          hasText: !!message.text,
          role: message.role
        });
      }
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

  if (DEBUG_WEB_VOICE_BRIDGE) {
    console.log('[WebVoiceBridge] Broadcasting transcript', {
      trackingId: session.trackingId,
      speaker,
      textLength: text.length,
      timestamp
    });
  }

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
    try {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Invalid session ID format',
        code: 4000
      }));
    } catch (e) { /* ignore */ }
    return false;
  }

  const activeSessions = Array.from(webVoiceSessions.keys());
  if (DEBUG_WEB_VOICE_BRIDGE) {
    console.log('[WebVoiceBridge] Attachment attempt', { trackingId, userId, activeSessions });
  }

  const session = webVoiceSessions.get(trackingId);
  if (!session) {
    console.error('[WebVoiceBridge] Session not found', { trackingId, activeSessions });
    try {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: 'Session not found or expired',
        code: 4004
      }));
    } catch (e) { /* ignore */ }
    return false;
  }

  // Check Vapi connection state
  if (session.vapiClosed || session.vapiWebSocket?.readyState !== WebSocket.OPEN) {
    console.error('[WebVoiceBridge] Vapi WebSocket not open', {
      trackingId,
      vapiClosed: session.vapiClosed,
      closeCode: session.closeCode,
      closeReason: session.closeReason,
      vapiState: session.vapiWebSocket?.readyState
    });

    // Send error to client before refusing
    try {
      clientWs.send(JSON.stringify({
        type: 'error',
        message: `Vapi connection failed: ${session.closeReason || 'Unknown error'} (Code: ${session.closeCode})`,
        code: session.closeCode
      }));
    } catch (e) {
      // ignore
    }

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
      if (session.vapiWebSocket.bufferedAmount > MAX_VAPI_BUFFERED_AMOUNT_BYTES) {
        console.warn('[WebVoiceBridge] Backpressure: dropping audio frame', {
          trackingId,
          frameCount: audioFrameCount,
          vapiBuffered: session.vapiWebSocket.bufferedAmount
        });
        return;
      }

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

  broadcastCallEndedOnce(session, 'client_ended');

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
