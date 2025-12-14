import { Router, Request, Response } from 'express';
import { getActiveSessions, getSession } from '../services/web-voice-bridge';

const router = Router();

/**
 * Get real-time diagnostics for all active Web Test sessions
 * Includes Vapi connection state, audio forwarding stats, and session lifecycle
 */
router.get('/api/web-test/diagnostics', (req: Request, res: Response) => {
  try {
    const sessions = getActiveSessions();
    
    const diagnostics = sessions.map(session => {
      const vapiState = session.vapiWebSocket?.readyState;
      const clientState = session.clientWebSocket?.readyState;
      const age = Date.now() - session.createdAt;
      
      return {
        trackingId: session.trackingId,
        vapiCallId: session.vapiCallId,
        userId: session.userId,
        vapi: {
          connected: vapiState === 1, // WebSocket.OPEN
          state: vapiState,
          stateLabel: getWebSocketStateLabel(vapiState),
          bufferedAmount: session.vapiWebSocket?.bufferedAmount || 0
        },
        client: {
          connected: clientState === 1, // WebSocket.OPEN
          state: clientState,
          stateLabel: getWebSocketStateLabel(clientState),
          bufferedAmount: session.clientWebSocket?.bufferedAmount || 0
        },
        session: {
          ageMs: age,
          ageSec: Math.round(age / 1000),
          createdAt: new Date(session.createdAt).toISOString()
        }
      };
    });

    res.json({
      timestamp: new Date().toISOString(),
      activeSessions: sessions.length,
      sessions: diagnostics,
      summary: {
        vapiConnected: diagnostics.filter(d => d.vapi.connected).length,
        clientConnected: diagnostics.filter(d => d.client.connected).length,
        totalAudioFramesForwarded: diagnostics.reduce((sum, d) => sum + (d.vapi.bufferedAmount || 0), 0)
      }
    });
  } catch (err) {
    console.error('[WebTestDiagnostics] Error fetching diagnostics', err);
    res.status(500).json({ error: 'Failed to fetch diagnostics' });
  }
});

/**
 * Get detailed diagnostics for a specific session
 */
router.get('/api/web-test/diagnostics/:trackingId', (req: Request, res: Response) => {
  try {
    const { trackingId } = req.params;
    const session = getSession(trackingId);

    if (!session) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const vapiState = session.vapiWebSocket?.readyState;
    const clientState = session.clientWebSocket?.readyState;
    const age = Date.now() - session.createdAt;

    res.json({
      timestamp: new Date().toISOString(),
      trackingId: session.trackingId,
      vapiCallId: session.vapiCallId,
      userId: session.userId,
      vapi: {
        connected: vapiState === 1,
        state: vapiState,
        stateLabel: getWebSocketStateLabel(vapiState),
        bufferedAmount: session.vapiWebSocket?.bufferedAmount || 0,
        readyState: {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED'
        }[vapiState || 3]
      },
      client: {
        connected: clientState === 1,
        state: clientState,
        stateLabel: getWebSocketStateLabel(clientState),
        bufferedAmount: session.clientWebSocket?.bufferedAmount || 0,
        readyState: {
          0: 'CONNECTING',
          1: 'OPEN',
          2: 'CLOSING',
          3: 'CLOSED'
        }[clientState || 3]
      },
      session: {
        ageMs: age,
        ageSec: Math.round(age / 1000),
        createdAt: new Date(session.createdAt).toISOString(),
        ttlMs: 10 * 60 * 1000,
        ttlSec: 600,
        timeUntilExpireMs: Math.max(0, (10 * 60 * 1000) - age),
        timeUntilExpireSec: Math.max(0, Math.round(((10 * 60 * 1000) - age) / 1000))
      },
      health: {
        vapiHealthy: vapiState === 1,
        clientHealthy: clientState === 1,
        sessionHealthy: vapiState === 1 && age < (10 * 60 * 1000),
        issues: getSessionIssues(session, vapiState, clientState, age)
      }
    });
  } catch (err) {
    console.error('[WebTestDiagnostics] Error fetching session diagnostics', err);
    res.status(500).json({ error: 'Failed to fetch diagnostics' });
  }
});

/**
 * Stream real-time diagnostics (Server-Sent Events)
 */
router.get('/api/web-test/diagnostics/stream', (req: Request, res: Response) => {
  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial data
  sendDiagnosticUpdate(res);

  // Send updates every 2 seconds
  const interval = setInterval(() => {
    sendDiagnosticUpdate(res);
  }, 2000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});

/**
 * Helper: Send diagnostic update via SSE
 */
function sendDiagnosticUpdate(res: Response): void {
  try {
    const sessions = getActiveSessions();
    
    const diagnostics = sessions.map(session => {
      const vapiState = session.vapiWebSocket?.readyState;
      const clientState = session.clientWebSocket?.readyState;
      const age = Date.now() - session.createdAt;
      
      return {
        trackingId: session.trackingId,
        vapi: {
          connected: vapiState === 1,
          state: vapiState,
          buffered: session.vapiWebSocket?.bufferedAmount || 0
        },
        client: {
          connected: clientState === 1,
          state: clientState,
          buffered: session.clientWebSocket?.bufferedAmount || 0
        },
        age: Math.round(age / 1000)
      };
    });

    const data = {
      timestamp: new Date().toISOString(),
      sessions: diagnostics,
      count: sessions.length
    };

    res.write(`data: ${JSON.stringify(data)}\n\n`);
  } catch (err) {
    console.error('[WebTestDiagnostics] Error in SSE stream', err);
  }
}

/**
 * Helper: Get WebSocket state label
 */
function getWebSocketStateLabel(state: number | undefined): string {
  switch (state) {
    case 0: return 'CONNECTING';
    case 1: return 'OPEN';
    case 2: return 'CLOSING';
    case 3: return 'CLOSED';
    default: return 'UNKNOWN';
  }
}

/**
 * Helper: Identify session health issues
 */
function getSessionIssues(session: any, vapiState: number | undefined, clientState: number | undefined, age: number): string[] {
  const issues: string[] = [];

  if (vapiState !== 1) {
    issues.push(`Vapi WebSocket not open (state: ${getWebSocketStateLabel(vapiState)})`);
  }

  if (clientState !== 1) {
    issues.push(`Client WebSocket not open (state: ${getWebSocketStateLabel(clientState)})`);
  }

  if (age > 10 * 60 * 1000) {
    issues.push('Session TTL exceeded (10 minutes)');
  }

  if (vapiState === 1 && clientState === 1 && session.vapiWebSocket?.bufferedAmount > 65536) {
    issues.push('Vapi buffer high (>64KB) - may indicate slow network');
  }

  if (vapiState === 1 && clientState === 1 && session.clientWebSocket?.bufferedAmount > 65536) {
    issues.push('Client buffer high (>64KB) - may indicate slow network');
  }

  return issues.length > 0 ? issues : ['None - session is healthy'];
}

export default router;
