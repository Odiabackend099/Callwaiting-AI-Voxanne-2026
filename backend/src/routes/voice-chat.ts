/**
 * Voice Chat Route Handler
 * Handles WebSocket connections for real-time voice conversations
 */

import { Router, Request, Response } from 'express';
import { WebSocket } from 'ws';
import { createLogger } from '../services/logger';
import {
  createVoiceChatSession,
  getVoiceChatSession,
  handleVoiceChatMessage,
  endVoiceChatSession,
  sendTranscript,
  sendVADState,
  getSessionStats,
} from '../services/voice-chat-handler';

const logger = createLogger('VoiceChatRoute');
const router = Router();

/**
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'voice-chat' });
});

/**
 * Get session stats
 */
router.get('/session/:trackingId', (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const session = getVoiceChatSession(trackingId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(getSessionStats(session));
});

/**
 * Send transcript to session
 */
router.post('/transcript/:trackingId', (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const { speaker, text, isFinal } = req.body;

  if (!speaker || !text) {
    return res.status(400).json({ error: 'Missing speaker or text' });
  }

  const session = getVoiceChatSession(trackingId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    sendTranscript(session, speaker, text, isFinal || false);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to send transcript', { error: err });
    res.status(500).json({ error: 'Failed to send transcript' });
  }
});

/**
 * Send VAD state to session
 */
router.post('/vad/:trackingId', (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const { state, confidence } = req.body;

  if (!state) {
    return res.status(400).json({ error: 'Missing state' });
  }

  const session = getVoiceChatSession(trackingId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    sendVADState(session, state, confidence);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to send VAD state', { error: err });
    res.status(500).json({ error: 'Failed to send VAD state' });
  }
});

/**
 * End session
 */
router.post('/end/:trackingId', (req: Request, res: Response) => {
  const { trackingId } = req.params;
  const session = getVoiceChatSession(trackingId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    endVoiceChatSession(session);
    res.json({ success: true });
  } catch (err) {
    logger.error('Failed to end session', { error: err });
    res.status(500).json({ error: 'Failed to end session' });
  }
});

export default router;

/**
 * WebSocket upgrade handler for voice chat
 * This should be called from server.ts when handling WebSocket upgrades
 */
export function handleVoiceChatWebSocket(
  ws: WebSocket,
  trackingId: string,
  userId: string
): void {
  logger.info('Voice chat WebSocket connection', { trackingId, userId });

  // Create session
  const session = createVoiceChatSession(trackingId, userId, ws);

  // Send connected message
  ws.send(
    JSON.stringify({
      type: 'connected',
      payload: { trackingId, userId },
    })
  );

  // Handle messages
  ws.on('message', (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      handleVoiceChatMessage(session, message);
    } catch (err) {
      logger.error('Failed to parse WebSocket message', { error: err });
    }
  });

  // Handle close
  ws.on('close', () => {
    logger.info('Voice chat WebSocket closed', { trackingId });
    endVoiceChatSession(session);
  });

  // Handle error
  ws.on('error', (err) => {
    logger.error('Voice chat WebSocket error', { trackingId, error: err });
    endVoiceChatSession(session);
  });
}
