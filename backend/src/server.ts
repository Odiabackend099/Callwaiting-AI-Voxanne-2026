// Load environment variables FIRST before any other imports
// Use process.cwd() which is reliable with tsx
// @ts-ignore
const path = require('path');
const envPath = path.join(process.cwd(), '.env');
// @ts-ignore
require('dotenv').config({ path: envPath });

// CRITICAL: Initialize Sentry BEFORE other imports if in production
import * as Sentry from '@sentry/node';
import * as Tracing from '@sentry/tracing';

// Initialize Sentry early if configured
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app: undefined }) // Will attach to app after it's created
    ]
  });
}

// Import centralized configuration (single source of truth for env variables)
import { config } from './config';

import express, { NextFunction, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit'; // Add express-rate-limit import
import { createServer } from 'http';
import { webhooksRouter } from './routes/webhooks';
import smsStatusWebhookRouter from './routes/sms-status-webhook'; // default export
import googleOAuthRouter from './routes/google-oauth';
import { callsRouter } from './routes/calls';
import { assistantsRouter } from './routes/assistants';
import { phoneNumbersRouter } from './routes/phone-numbers';
import integrationsRouter from './routes/integrations-byoc'; // default export
import founderConsoleRouter from './routes/founder-console-v2'; // default export
import founderConsoleSettingsRouter from './routes/founder-console-settings'; // default export
import { initLogger, requestLogger, log } from './services/logger';
import { WebSocketServer } from 'ws';
import { attachClientWebSocket } from './services/web-voice-bridge';
import { initWebSocket } from './services/websocket';
import { supabase } from './services/supabase-client';
import inboundSetupRouter from './routes/inbound-setup'; // default export
import phoneMappingRouter from './routes/phone-mapping-routes'; // default export
import knowledgeBaseRouter from './routes/knowledge-base'; // default export
import { ragRouter } from './routes/knowledge-base-rag';
import { vapiRagRouter } from './routes/vapi-rag-integration';
import { vapiWebhookRouter } from './routes/vapi-webhook';
import { vapiSetupRouter } from './routes/vapi-setup';
import vapiToolsRouter from './routes/vapi-tools-routes';
import handoffRouter from './routes/handoff-routes';
import vapiDiscoveryRouter from './routes/vapi-discovery'; // default export
import verificationRouter from './routes/verification';
import { callsRouter as callsDashboardRouter } from './routes/calls-dashboard'; // named export
import agentSyncRouter from './routes/agent-sync'; // default export
import dashboardLeadsRouter from './routes/dashboard-leads'; // default export
import { bookDemoRouter } from './routes/book-demo';
import integrationsStatusRouter from './routes/integrations-status'; // default export
import { scheduleOrphanCleanup } from './jobs/orphan-recording-cleanup';
import { scheduleTelephonyVerificationCleanup } from './jobs/telephony-verification-cleanup';
import { scheduleRecordingUploadRetry } from './services/recording-upload-retry';
import { scheduleTwilioCallPoller } from './jobs/twilio-call-poller';
import { scheduleVapiCallPoller } from './jobs/vapi-call-poller';
import { scheduleRecordingMetricsMonitor } from './jobs/recording-metrics-monitor';
import { scheduleRecordingQueueWorker } from './jobs/recording-queue-worker';
import escalationRulesRouter from './routes/escalation-rules'; // default export
import teamRouter from './routes/team'; // default export
import agentsRouter from './routes/agents'; // default export
import { contactsRouter } from './routes/contacts';
import { appointmentsRouter } from './routes/appointments';
import { notificationsRouter } from './routes/notifications';
import { servicesRouter } from './routes/services';
// import { workspaceRouter } from './routes/workspace';
import analyticsRouter from './routes/analytics';
import calendarOAuthRouter from './routes/calendar-oauth'; // default export
import vapiCalendarToolsRouter from './routes/vapi-tools'; // default export
import toolSyncRouter from './routes/tool-sync'; // default export
import { authRouter } from './routes/health';
import healthIntegrationsRouter from './routes/health-integrations'; // default export
import orgsRouter from './routes/orgs'; // default export
import oauthTestRouter from './routes/oauth-test';
import internalApiRoutes from './routes/internal-api-routes'; // default export
import integrationsApiRouter from './routes/integrations-api'; // default export
import telephonyRouter from './routes/telephony'; // default export - Hybrid Telephony

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
// Set to 1 for single proxy (Render uses 1 proxy layer)
app.set('trust proxy', 1);

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
      'https://voxanne-frontend-h0pv6jv68-odia-backends-projects.vercel.app',
      // Production Vercel deployment
      'https://callwaiting-ai-voxanne-2026.vercel.app',
      'https://callwaiting-ai-voxanne-2026-d49b2ejye-odia-backends-projects.vercel.app'
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
  // SECURITY FIX: Removed 'x-org-id' - org_id must come from JWT only
  maxAge: 86400 // 24 hours
}));
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf?.toString('utf8');
  },
}));
app.use(express.static('public')); // Add static file serving for public directory

// General API rate limiter (100 req/15min in production, disabled in development)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased from 100 to 1000 to handle rapid development/testing
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req: any) => {
    // Skip rate limiting entirely in development mode for easier local testing
    // This prevents 429 errors during development/Fast Refresh rebuilds
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
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

// Sentry middleware: capture requests and traces (production only)
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// Request ID Middleware: Assign unique ID to each request for tracing/debugging
import { randomUUID } from 'crypto';
app.use((req: any, res: Response, next: NextFunction) => {
  req.id = req.headers['x-request-id'] as string || randomUUID();
  res.setHeader('X-Request-ID', req.id);
  next();
});

// Tenant Resolver Middleware: Automatically injects org_id for users missing it
// This ensures existing users with stale JWTs still work without manual fixes
import { tenantResolver } from './middleware/tenant-resolver';
app.use(tenantResolver);

// CSRF Protection Middleware
import { csrfTokenGenerator, validateCsrfToken, csrfTokenEndpoint } from './middleware/csrf-protection';
app.use(csrfTokenGenerator); // Generate token on every request
app.use(validateCsrfToken); // Validate on state-changing requests

// CSRF Token Endpoint: Allow frontend to explicitly fetch token if needed
app.get('/api/csrf-token', csrfTokenEndpoint);

// Routes
app.use('/api/webhooks', webhooksRouter);
app.use('/api/webhooks', smsStatusWebhookRouter);
app.use('/api/calls', callsRouter);
app.use('/api/calls-dashboard', callsDashboardRouter);
app.use('/api/assistants', assistantsRouter);
app.use('/api/phone-numbers', phoneNumbersRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/integrations', integrationsStatusRouter);
app.use('/api/inbound', inboundSetupRouter);
app.use('/api/inbound', phoneMappingRouter);
app.use('/api/knowledge-base', knowledgeBaseRouter);
app.use('/api/knowledge-base', ragRouter);
app.use('/api/vapi', vapiRagRouter);
app.use('/api/vapi', vapiWebhookRouter);
app.use('/api/vapi', vapiSetupRouter);
app.use('/api/vapi', vapiToolsRouter);
app.use('/api/vapi', toolSyncRouter);
app.use('/api/handoff', handoffRouter);
app.use('/api/vapi', vapiDiscoveryRouter);
app.use('/api/founder-console', founderConsoleRouter);
app.use('/api/founder-console', founderConsoleSettingsRouter);
app.use('/api/founder-console', agentSyncRouter);
app.use('/api/dashboard', dashboardLeadsRouter);
app.use('/api/book-demo', bookDemoRouter);
app.use('/api/escalation-rules', escalationRulesRouter);
app.use('/api/team', teamRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/orgs', orgsRouter); // Organization validation routes
app.use('/api/internal', internalApiRoutes); // Internal API routes (webhook configuration, etc.)
app.use('/api/integrations', integrationsApiRouter); // Fetch decrypted credentials
app.use('/api/calendar', calendarOAuthRouter);
app.use('/api/vapi', vapiCalendarToolsRouter);
app.use('/api/google-oauth', googleOAuthRouter);
app.use('/api/health', healthIntegrationsRouter);
app.use('/api/telephony', telephonyRouter); // Hybrid Telephony BYOC routes
log.info('Server', 'Google OAuth routes registered at /api/google-oauth');
log.info('Server', 'Hybrid Telephony routes registered at /api/telephony');
log.info('Server', 'Health integrations diagnostic endpoint registered at /api/health/integrations');
log.info('Server', 'Contacts, appointments, notifications, calendar, and org validation routes registered');
// app.use('/api/founder-console/workspace', workspaceRouter);

// Health check endpoint - comprehensive dependency verification
// CRITICAL: Twilio webhook timeout = 15 seconds
// Keep response <100ms; process heavy operations async via background queue
// With UptimeRobot keep-alive every 10 min, spin-down is eliminated
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok' as 'ok' | 'degraded' | 'error',
    services: {
      database: false,
      supabase: false,
      backgroundJobs: false
    },
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database_size_mb: 0
  };

  try {
    // Check Supabase database connectivity
    const { data, error } = await supabase
      .from('organizations')
      .select('id')
      .limit(1);

    if (!error) {
      health.services.database = true;
      health.services.supabase = true;
    } else {
      health.status = 'degraded';
      log.warn('Health', 'Database check failed', { error: error.message });
    }

    // Check database size (Supabase free tier limit: 500 MB)
    // Alert if approaching limit to trigger upgrade planning
    const { data: sizeData, error: sizeError } = await supabase.rpc('pg_database_size');
    if (!sizeError && sizeData) {
      // sizeData is in bytes, convert to MB
      health.database_size_mb = Math.round((sizeData / 1024 / 1024) * 10) / 10;

      // Log warnings if approaching limits
      if (health.database_size_mb > 480) {
        log.error('Health', 'CRITICAL: Database size approaching Supabase free tier limit', {
          current_mb: health.database_size_mb,
          limit_mb: 500,
          action: 'UPGRADE to Supabase Pro immediately'
        });
        health.status = 'error';
      } else if (health.database_size_mb > 400) {
        log.warn('Health', 'WARNING: Database size approaching limit, plan upgrade soon', {
          current_mb: health.database_size_mb,
          limit_mb: 500,
          threshold_warn_mb: 400
        });
        if (health.status === 'ok') {
          health.status = 'degraded';
        }
      }
    } else if (sizeError) {
      // pg_database_size function may not exist; try alternative query
      // This is non-critical, don't fail health check
      log.warn('Health', 'Could not retrieve database size', { error: sizeError.message });
    }
  } catch (error: any) {
    health.status = 'error';
    health.services.database = false;
    log.error('Health', 'Health check failed', { error: error?.message });
  }

  // Background jobs check - verify critical jobs are scheduled
  // (We don't track individual job state, but presence of scheduler indicates jobs are active)
  health.services.backgroundJobs = true; // Jobs are scheduled in main server startup

  // Return 503 if any critical service is down
  const statusCode = health.services.database ? 200 : 503;
  res.status(statusCode).json(health);
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

// Sentry error handler (production only) - MUST come before generic error handler
if (process.env.NODE_ENV === 'production' && process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

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

    // CRITICAL SSOT FIX: Removed userIdParam - no query param fallback allowed
    const attach = (effectiveUserId: string, effectiveOrgId?: string) => {
      console.log('[WebVoice] WS connection attempt', {
        trackingId,
        userId: effectiveUserId,
        orgId: effectiveOrgId || 'unknown',
        path: req.url
      });

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

      console.log('[WebVoice] ✅ Client attached to session', { trackingId, userId: effectiveUserId, orgId: effectiveOrgId });
    };

    // CRITICAL SSOT FIX: Always require auth message (even in dev mode, use a dev JWT token)
    const authTimeout = setTimeout(() => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1008, 'Unauthorized: No auth message received');
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
          // CRITICAL SSOT FIX: No query param fallback - always require token
          // In dev mode, use DEV_JWT_TOKEN env var if available (for testing)
          if (isDev && process.env.DEV_JWT_TOKEN) {
            supabase.auth.getUser(process.env.DEV_JWT_TOKEN)
              .then(({ data, error }) => {
                if (error || !data?.user) {
                  ws.close(1008, 'Unauthorized: Invalid dev token');
                  return;
                }
                // CRITICAL SSOT: Extract org_id from app_metadata
                const orgId = (data.user.app_metadata?.org_id || data.user.user_metadata?.org_id) as string;
                attach(data.user.id, orgId);
              })
              .catch(() => {
                ws.close(1008, 'Unauthorized: Dev token validation failed');
              });
          } else {
            ws.close(1008, 'Unauthorized: No token provided');
          }
          return;
        }

        // CRITICAL SSOT: Always validate JWT token (even in dev mode)
        supabase.auth.getUser(token)
          .then(({ data, error }) => {
            const uid = data?.user?.id;
            if (error || !uid) {
              ws.close(1008, 'Unauthorized: Invalid or expired token');
              return;
            }
            // CRITICAL SSOT: Extract org_id from app_metadata (admin-set, immutable)
            // Fallback to user_metadata for backward compatibility during migration
            const orgId = (data.user.app_metadata?.org_id || data.user.user_metadata?.org_id) as string;

            if (!orgId) {
              ws.close(1008, 'Forbidden: User not assigned to organization');
              return;
            }

            attach(uid, orgId);
          })
          .catch(() => {
            ws.close(1008, 'Unauthorized: Token validation failed');
          });
      } catch {
        // ignore
      }
    });

    // CRITICAL SSOT FIX: Removed query param fallback entirely
    // No fallback means: if auth message not received within 3 seconds, connection is closed
    // This prevents unauthorized access via query params

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
if (process.env.NODE_ENV !== 'test') {
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
  
    CallWaiting AI:
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
      scheduleTelephonyVerificationCleanup();
      console.log('Telephony verification cleanup job scheduled');
    } catch (error: any) {
      console.warn('Failed to schedule telephony verification cleanup job:', error.message);
    }

    try {
      scheduleRecordingUploadRetry();
      console.log('Recording upload retry job scheduled');
    } catch (error: any) {
      console.warn('Failed to schedule recording upload retry job:', error.message);
    }

    try {
      scheduleRecordingMetricsMonitor();
      console.log('Recording metrics monitor job scheduled');
    } catch (error: any) {
      console.warn('Failed to schedule recording metrics monitor job:', error.message);
    }

    try {
      scheduleRecordingQueueWorker();
      console.log('Recording queue worker job scheduled');
    } catch (error: any) {
      console.warn('Failed to schedule recording queue worker job:', error.message);
    }

    // DISABLED: Vapi and Twilio pollers removed in favor of webhook-only architecture
    // Reason: Polling caused race conditions with webhook handlers and wasted bandwidth
    // Webhooks are more reliable (immediate notification) and prevent duplicate processing
    // Keep poller functions in codebase for emergency manual recovery only
    // See: /Users/mac/.claude/plans/streamed-swinging-ullman.md for details

    // try {
    //   scheduleTwilioCallPoller();
    //   console.log('Twilio call poller scheduled');
    // } catch (error: any) {
    //   console.warn('Failed to schedule Twilio call poller:', error.message);
    // }

    // try {
    //   scheduleVapiCallPoller();
    //   console.log('Vapi call poller scheduled');
    // } catch (error: any) {
    //   console.warn('Failed to schedule Vapi call poller:', error.message);
    // }

    console.log('✅ Recording pollers disabled - using webhook-only architecture');
  });
}

// Mount routers
app.use('/api/auth', authRouter);
app.use('/oauth-test', oauthTestRouter);

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
