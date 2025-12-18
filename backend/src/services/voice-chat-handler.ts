/**
 * Voice Chat Handler for Real-Time Transcription and VAD
 * Manages WebSocket connections for live voice conversations
 */

import { WebSocket } from 'ws';
import { createLogger } from './logger';
import { supabase } from './supabase-client';

const logger = createLogger('VoiceChatHandler');

interface VoiceChatSession {
  trackingId: string;
  userId: string;
  ws: WebSocket;
  isMuted: boolean;
  startTime: number;
  agentMessages: string[];
  userMessages: string[];
}

interface TranscriptMessage {
  id: string;
  speaker: 'agent' | 'user';
  text: string;
  isFinal: boolean;
  messageId: string;
}

interface VADState {
  state: 'listening' | 'speaking' | 'idle';
  confidence?: number;
}

// Store active voice chat sessions
const activeSessions = new Map<string, VoiceChatSession>();
let messageIdCounter = 0;

// Track last speaker for each session to detect speaker changes
const lastSpeakerMap = new Map<string, 'agent' | 'user' | null>();

/**
 * Create a new voice chat session
 */
export function createVoiceChatSession(
  trackingId: string,
  userId: string,
  ws: WebSocket
): VoiceChatSession {
  const session: VoiceChatSession = {
    trackingId,
    userId,
    ws,
    isMuted: false,
    startTime: Date.now(),
    agentMessages: [],
    userMessages: [],
  };

  activeSessions.set(trackingId, session);
  logger.info('Voice chat session created', { trackingId, userId });

  return session;
}

/**
 * Get active voice chat session
 */
export function getVoiceChatSession(trackingId: string): VoiceChatSession | undefined {
  return activeSessions.get(trackingId);
}

/**
 * Send transcript update to client
 */
export function sendTranscript(
  session: VoiceChatSession,
  speaker: 'agent' | 'user',
  text: string,
  isFinal: boolean
): void {
  if (session.ws.readyState !== WebSocket.OPEN) {
    logger.warn('WebSocket not open, cannot send transcript', { trackingId: session.trackingId });
    return;
  }

  const messageId = `msg-${++messageIdCounter}`;

  // Store message
  if (speaker === 'agent') {
    session.agentMessages.push(text);
  } else {
    session.userMessages.push(text);
  }

  // Update VAD state based on speaker change
  const lastSpeaker = lastSpeakerMap.get(session.trackingId);
  if (lastSpeaker !== speaker) {
    lastSpeakerMap.set(session.trackingId, speaker);
    // Send VAD state update when speaker changes
    const vadState = speaker === 'agent' ? 'speaking' : 'listening';
    sendVADState(session, vadState, 0.9);
  }

  const payload: TranscriptMessage = {
    id: messageId,
    speaker,
    text,
    isFinal,
    messageId,
  };

  try {
    session.ws.send(
      JSON.stringify({
        type: 'transcript',
        payload,
      })
    );
  } catch (err) {
    logger.error('Failed to send transcript', { trackingId: session.trackingId, error: err });
  }
}

/**
 * Send VAD (Voice Activity Detection) state update
 */
export function sendVADState(
  session: VoiceChatSession,
  state: 'listening' | 'speaking' | 'idle',
  confidence?: number
): void {
  if (session.ws.readyState !== WebSocket.OPEN) {
    logger.warn('WebSocket not open, cannot send VAD state', { trackingId: session.trackingId });
    return;
  }

  const payload: VADState = {
    state,
    confidence,
  };

  try {
    session.ws.send(
      JSON.stringify({
        type: 'vad',
        payload,
      })
    );
  } catch (err) {
    logger.error('Failed to send VAD state', { trackingId: session.trackingId, error: err });
  }
}

/**
 * Handle incoming WebSocket message from client
 */
export function handleVoiceChatMessage(
  session: VoiceChatSession,
  message: any
): void {
  const { type, payload } = message;

  switch (type) {
    case 'mute':
      session.isMuted = payload.muted;
      logger.info('Microphone muted', { trackingId: session.trackingId, muted: payload.muted });
      break;

    case 'end-call':
      endVoiceChatSession(session);
      break;

    default:
      logger.warn('Unknown message type', { trackingId: session.trackingId, type });
  }
}

/**
 * End voice chat session
 */
export function endVoiceChatSession(session: VoiceChatSession): void {
  logger.info('Ending voice chat session', {
    trackingId: session.trackingId,
    duration: Date.now() - session.startTime,
    agentMessages: session.agentMessages.length,
    userMessages: session.userMessages.length,
  });

  // Send call-ended message to client
  if (session.ws.readyState === WebSocket.OPEN) {
    try {
      session.ws.send(
        JSON.stringify({
          type: 'call-ended',
          payload: {
            duration: Math.floor((Date.now() - session.startTime) / 1000),
          },
        })
      );
    } catch (err) {
      logger.error('Failed to send call-ended message', { error: err });
    }
  }

  // Save session to database
  saveVoiceChatSession(session).catch((err) => {
    logger.error('Failed to save voice chat session', { error: err });
  });

  // Close WebSocket
  if (session.ws.readyState === WebSocket.OPEN) {
    session.ws.close();
  }

  // Remove from active sessions
  activeSessions.delete(session.trackingId);
  
  // Clean up speaker tracking
  lastSpeakerMap.delete(session.trackingId);
}

/**
 * Save voice chat session to database
 */
async function saveVoiceChatSession(session: VoiceChatSession): Promise<void> {
  try {
    const duration = Math.floor((Date.now() - session.startTime) / 1000);

    // Save to call_logs table
    const { error } = await supabase.from('call_logs').insert({
      tracking_id: session.trackingId,
      user_id: session.userId,
      call_type: 'web-test',
      status: 'completed',
      duration_seconds: duration,
      transcript: {
        agent: session.agentMessages.join(' '),
        user: session.userMessages.join(' '),
      },
      metadata: {
        isMuted: session.isMuted,
        messageCount: session.agentMessages.length + session.userMessages.length,
      },
    });

    if (error) {
      logger.error('Failed to save call log', { error });
    }
  } catch (err) {
    logger.error('Error saving voice chat session', { error: err });
  }
}

/**
 * Get session statistics
 */
export function getSessionStats(session: VoiceChatSession) {
  return {
    trackingId: session.trackingId,
    userId: session.userId,
    duration: Date.now() - session.startTime,
    isMuted: session.isMuted,
    agentMessageCount: session.agentMessages.length,
    userMessageCount: session.userMessages.length,
    totalMessages: session.agentMessages.length + session.userMessages.length,
  };
}

/**
 * Cleanup all sessions (for graceful shutdown)
 */
export function cleanupAllSessions(): void {
  logger.info('Cleaning up all voice chat sessions', { count: activeSessions.size });

  activeSessions.forEach((session) => {
    endVoiceChatSession(session);
  });

  activeSessions.clear();
}
