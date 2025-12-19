// Load environment variables FIRST before any other imports
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'; // Add express-rate-limit import
import { createServer } from 'http';
import { webhooksRouter } from './routes/webhooks';
import { callsRouter } from './routes/calls';
import { assistantsRouter } from './routes/assistants';
import { phoneNumbersRouter } from './routes/phone-numbers';
import integrationsRouter from './routes/integrations';
import founderConsoleRouter from './routes/founder-console-v2';
import founderConsoleSettingsRouter from './routes/founder-console-settings';
import { initLogger, requestLogger, log } from './services/logger';
import { WebSocketServer } from 'ws';
import { attachClientWebSocket } from './services/web-voice-bridge';
import { initWebSocket } from './services/websocket';
import { supabase } from './services/supabase-client';
import inboundSetupRouter from './routes/inbound-setup';
import knowledgeBaseRouter from './routes/knowledge-base';
import { ragRouter } from './routes/knowledge-base-rag';
import { vapiRagRouter } from './routes/vapi-rag-integration';
import { vapiWebhookRouter } from './routes/vapi-webhook';
import { vapiSetupRouter } from './routes/vapi-setup';
import vapiDiscoveryRouter from './routes/vapi-discovery';
import { callsRouter as callsDashboardRouter } from './routes/calls-dashboard';
import agentSyncRouter from './routes/agent-sync';
import { scheduleOrphanCleanup } from './jobs/orphan-recording-cleanup';
import { scheduleRecordingUploadRetry } from './services/recording-upload-retry';
import { scheduleTwilioCallPoller } from './jobs/twilio-call-poller';
// import { workspaceRouter } from './routes/workspace';

// Initialize logger
initLogger();

declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

declare module 'http' {
  interface IncomingMessage {
    rawBody?: string;
  }
}

const app = express();
const PORT = process.env.PORT || 3001;

// Trust reverse proxy headers (x-forwarded-proto/host). Required for correct absolute URL generation.
app.set('trust proxy', true);

// Middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // Default allowed origins (always include these)
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://callwaitingai.dev',
      'https://www.callwaitingai.dev',
      'https://voxanne-frontend-h0pv6jv68-odia-backends-projects.vercel.app'
    ];

    // Get additional origins from environment variable
    const envOrigins = (process.env.CORS_ORIGIN || '')
      .trim()
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);

    const allowed = [...defaultOrigins, ...envOrigins];

    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Allow if origin is in allowed list
    if (allowed.includes(origin)) {
      return callback(null, true);
    }

    // Reject with error
    return callback(new Error('CORS not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  maxAge: 86400 // 24 hours
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf?.toString('utf8');
  },
}));

// General API rate limiter (100 req/15min)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(apiLimiter);

// Webhook rate limiter (30 req/1min)
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use('/api/webhooks', webhookLimiter);

// Request logging middleware (replaces console.log)
app.use(requestLogger());

// Routes
app.use('/api/webhooks', webhooksRouter);
app.use('/api/calls', callsRouter);
app.use('/api/calls-dashboard', callsDashboardRouter);
app.use('/api/assistants', assistantsRouter);
app.use('/api/phone-numbers', phoneNumbersRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/inbound', inboundSetupRouter);
app.use('/api/knowledge-base', knowledgeBaseRouter);
app.use('/api/knowledge-base', ragRouter);
app.use('/api/vapi', vapiRagRouter);
app.use('/api/vapi', vapiWebhookRouter);
app.use('/api/vapi', vapiSetupRouter);
app.use('/api/vapi', vapiDiscoveryRouter);
app.use('/api/founder-console', founderConsoleRouter);
app.use('/api/founder-console', founderConsoleSettingsRouter);
app.use('/api/founder-console', agentSyncRouter);
// app.use('/api/founder-console/workspace', workspaceRouter);

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

// WebSocket server for live calls (noServer: manual upgrade handling to avoid conflicts)
const liveCallsWss = new WebSocketServer({ noServer: true });
console.log('[WebSocket] Server initialized for /ws/live-calls/*');

// Initialize WebSocket service (pass noServer wss, not HTTP server)
initWebSocket(liveCallsWss);

// Manual upgrade handling to support path prefixes (ws library path option is exact match only)
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url || '';
  const origin = request.headers.origin || 'unknown';
  
  console.log('[WebSocket] Upgrade request received', {
    pathname,
    origin,
    method: request.method,
    headers: {
      upgrade: request.headers.upgrade,
      connection: request.headers.connection,
      'sec-websocket-key': request.headers['sec-websocket-key'],
      'sec-websocket-version': request.headers['sec-websocket-version'],
    },
  });

  // Validate origin for CORS security (allow localhost and production domains)
  const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://voxanne-frontend-7c8wg3jiv-odia-backends-projects.vercel.app',
    'https://callwaitingai.dev',
    'https://www.callwaitingai.dev',
    process.env.FRONTEND_URL || ''
  ].filter(Boolean);

  const isOriginAllowed = !origin || origin === 'unknown' || allowedOrigins.some(allowed => origin === allowed);
  
  if (!isOriginAllowed) {
    console.error('[WebSocket] Origin not allowed', { origin, allowedOrigins });
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }

  if (pathname.startsWith('/api/web-voice')) {
    console.log('[WebSocket] Handling /api/web-voice upgrade');
    try {
      webTestWss.handleUpgrade(request, socket, head, (ws) => {
        console.log('[WebSocket] Upgrade successful, emitting connection event');
        webTestWss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error('[WebSocket] handleUpgrade error', { pathname, error: err instanceof Error ? err.message : String(err) });
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch {
        // ignore
      }
    }
  } else if (pathname.startsWith('/ws/live-calls')) {
    console.log('[WebSocket] Handling /ws/live-calls upgrade');
    try {
      liveCallsWss.handleUpgrade(request, socket, head, (ws) => {
        console.log('[WebSocket] /ws/live-calls upgrade successful, emitting connection event');
        liveCallsWss.emit('connection', ws, request);
      });
    } catch (err) {
      console.error('[WebSocket] /ws/live-calls handleUpgrade error', { pathname, error: err instanceof Error ? err.message : String(err) });
      try {
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
      } catch {
        // ignore
      }
    }
  } else {
    console.log('[WebSocket] Unknown path, sending 404', { pathname });
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
  }
});

// Handle Web Test WebSocket connections
webTestWss.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const trackingId = url.pathname.replace('/api/web-voice/', '').split('?')[0];
    const isDev = (process.env.NODE_ENV || 'development') === 'development';
    const userIdParam = url.searchParams.get('userId') || '';

    const attach = (effectiveUserId: string) => {
      console.log('[WebVoice] WS connection attempt', { trackingId, userId: effectiveUserId, path: req.url });

      const attached = attachClientWebSocket(trackingId, ws, effectiveUserId);
      if (!attached) {
        console.error('[WebVoice] Failed to attach to session', { trackingId, userId: effectiveUserId });
        console.error('[WebVoice] Session may have expired or been cleaned up. Closing connection.');
        setTimeout(() => {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.close(1008, 'Session not found or unauthorized');
            }
          } catch (e) {
            // ignore already closed
          }
        }, 500);
        return;
      }

      console.log('[WebVoice] ✅ Client attached to session', { trackingId });
    };

    // Require auth message in prod; allow dev fallback if no token (E2E/dev).
    const authTimeout = setTimeout(() => {
      try {
        if (!isDev) {
          ws.close(1008, 'Unauthorized');
        }
      } catch {
        // ignore
      }
    }, 3000);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg?.type !== 'auth') return;
        clearTimeout(authTimeout);

        const token = typeof msg.token === 'string' ? msg.token : '';
        if (!token) {
          if (!isDev) {
            ws.close(1008, 'Unauthorized');
            return;
          }
          attach(userIdParam || process.env.DEV_USER_ID || 'dev-user');
          return;
        }

        supabase.auth.getUser(token)
          .then(({ data, error }) => {
            const uid = data?.user?.id;
            if (error || !uid) {
              ws.close(1008, 'Unauthorized');
              return;
            }
            attach(uid);
          })
          .catch(() => {
            ws.close(1008, 'Unauthorized');
          });
      } catch {
        // ignore
      }
    });

    // Dev fallback: if no auth message is sent, still allow attachment via query param.
    if (isDev) {
      setTimeout(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            attach(userIdParam || process.env.DEV_USER_ID || 'dev-user');
          }
        } catch {
          // ignore
        }
      }, 100);
    }

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

// Schedule background jobs
try {
  scheduleOrphanCleanup();
  console.log('Orphan recording cleanup job scheduled');
} catch (error: any) {
  console.warn('Failed to schedule orphan cleanup job:', error.message);
}

try {
  scheduleRecordingUploadRetry();
  console.log('Recording upload retry job scheduled');
} catch (error: any) {
  console.warn('Failed to schedule recording upload retry job:', error.message);
}

try {
  scheduleTwilioCallPoller();
  console.log('Twilio call poller scheduled');
} catch (error: any) {
  console.warn('Failed to schedule Twilio call poller:', error.message);
}
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
