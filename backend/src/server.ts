// Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import { webhooksRouter } from './routes/webhooks';
import { callsRouter } from './routes/calls';
import { assistantsRouter } from './routes/assistants';
import { phoneNumbersRouter } from './routes/phone-numbers';
import integrationsRouter from './routes/integrations';
import founderConsoleRouter from './routes/founder-console';
import founderConsoleSettingsRouter from './routes/founder-console-settings';
import { initLogger, requestLogger, log } from './services/logger';
import { WebSocketServer } from 'ws';
import { attachClientWebSocket } from './services/web-voice-bridge';
import webTestDiagnosticsRouter from './routes/web-test-diagnostics';

// Initialize logger
initLogger();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy headers (x-forwarded-proto/host). Required for correct absolute URL generation.
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Request logging middleware (replaces console.log)
app.use(requestLogger());

// Routes
app.use('/api/webhooks', webhooksRouter);
app.use('/api/calls', callsRouter);
app.use('/api/assistants', assistantsRouter);
app.use('/api/phone-numbers', phoneNumbersRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/founder-console', founderConsoleRouter);
app.use('/api/founder-console', founderConsoleSettingsRouter);
app.use('/', webTestDiagnosticsRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Voxanne Backend',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      webhooks: '/api/webhooks/vapi',
      calls: '/api/calls',
      assistants: '/api/assistants',
      phoneNumbers: '/api/phone-numbers'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

// Create HTTP server instance (critical: do NOT use app.listen)
const server = createServer(app);

// WebSocket server for Web Test (noServer for manual upgrade handling)
const webTestWss = new WebSocketServer({ noServer: true });
console.log('[WebSocket] Server initialized for /api/web-voice/*');

// WebSocket server for live calls (noServer for manual upgrade handling)
const liveCallsWss = new WebSocketServer({ noServer: true });
console.log('[WebSocket] Server initialized for /ws/live-calls');

// Manual upgrade handling to support path prefixes (ws library path option is exact match only)
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url || '';
  
  if (pathname.startsWith('/api/web-voice')) {
    webTestWss.handleUpgrade(request, socket, head, (ws) => {
      webTestWss.emit('connection', ws, request);
    });
  } else if (pathname.startsWith('/ws/live-calls')) {
    // Origin validation for live calls
    const origin = request.headers.origin;
    const allowedOrigins = (process.env.WS_ALLOWED_ORIGINS || 'http://localhost:3002,http://127.0.0.1:3002').split(',');
    const isAllowed = !origin || allowedOrigins.some(allowed => origin === allowed.trim());

    if (!isAllowed) {
      console.warn(`[WebSocket] Connection rejected from unauthorized origin: ${origin}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    liveCallsWss.handleUpgrade(request, socket, head, (ws) => {
      liveCallsWss.emit('connection', ws, request);
    });
  } else {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// Handle Web Test WebSocket connections
webTestWss.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const trackingId = url.pathname.replace('/api/web-voice/', '').split('?')[0];
    const userId = url.searchParams.get('userId') || 'unknown';

    console.log('[WebVoice] WS connection attempt', { trackingId, userId, path: req.url });

    // Attach to in-memory session
    const attached = attachClientWebSocket(trackingId, ws, userId);
    if (!attached) {
      console.error('[WebVoice] Failed to attach to session', { trackingId, userId });
      console.error('[WebVoice] Session may have expired or been cleaned up. Closing connection.');
      ws.close(1008, 'Session not found or unauthorized');
      return;
    }

    console.log('[WebVoice] ✅ Client attached to session', { trackingId });

    ws.on('close', (code, reason) => {
      console.log('[WebVoice] WS closed', { trackingId, code, reason: reason.toString() });
    });

    ws.on('error', (err) => {
      console.error('[WebVoice] WS error', { trackingId, error: err.message });
    });
  } catch (err) {
    console.error('[WebVoice] Connection handler error', err);
    ws.close(1011, 'Internal error');
  }
});

// Handle live calls WebSocket connections
liveCallsWss.on('connection', (ws, req) => {
  console.log('[LiveCalls] Client connected');
  
  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      }
    } catch (e) {
      console.error('[LiveCalls] Failed to parse message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[LiveCalls] Client disconnected');
  });

  ws.on('error', (error) => {
    console.error('[LiveCalls] Client error:', error);
  });
});

// Start listening (critical: use server.listen, not app.listen)
server.listen(PORT, () => {

  console.log(`
╔════════════════════════════════════════╗
║    Voxanne Backend Server Started      ║
╚════════════════════════════════════════╝

Port: ${PORT}
Environment: ${process.env.NODE_ENV || 'development'}
Uptime: ${new Date().toISOString()}

Endpoints:
  GET  /health
  GET  /
  POST /api/webhooks/vapi
  POST /api/calls/create
  GET  /api/calls/:callId
  GET  /api/calls
  POST /api/assistants/sync
  GET  /api/assistants
  GET  /api/assistants/:assistantId
  GET  /api/assistants/voices/available
  POST /api/phone-numbers/import
  GET  /api/phone-numbers
  GET  /api/phone-numbers/:phoneNumberId

  Founder Console:
  GET  /api/founder-console/agent/config
  POST /api/founder-console/agent/config
  GET  /api/founder-console/leads
  POST /api/founder-console/calls/start
  POST /api/founder-console/calls/end
  GET  /api/founder-console/calls/recent
  GET  /api/founder-console/voices
  
  WebSocket:
  WS   /ws/live-calls
  WS   /api/web-voice

Ready to accept requests!
`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
