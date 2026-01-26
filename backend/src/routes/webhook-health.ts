/**
 * Webhook Health Check Endpoint
 *
 * Purpose: Verify that the backend webhook URL is reachable and configured correctly.
 * Used by: Terminal tests, monitoring systems, deployment validation
 *
 * Critical for: Production deployment - ensures Vapi can reach webhook endpoints
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/webhook/health
 *
 * Returns basic health status and backend configuration info
 * No authentication required - this is a public health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    backend_url: process.env.BACKEND_URL || 'not configured',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/webhook/status (more detailed version)
 *
 * Returns comprehensive system status including environment checks
 */
router.get('/status', (req: Request, res: Response) => {
  const checks = {
    database: !!process.env.SUPABASE_URL,
    vapi: !!process.env.VAPI_PRIVATE_KEY,
    twilio: !!process.env.TWILIO_ACCOUNT_SID,
    google: !!process.env.GOOGLE_CLIENT_ID,
    encryption: !!process.env.ENCRYPTION_KEY
  };

  const allHealthy = Object.values(checks).every(check => check === true);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'healthy' : 'degraded',
    backend_url: process.env.BACKEND_URL || 'not configured',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    integrations: checks,
    warnings: [
      !process.env.BACKEND_URL && 'BACKEND_URL not configured',
      process.env.BACKEND_URL?.includes('ngrok') && 'Using ephemeral ngrok URL - not suitable for production'
    ].filter(Boolean)
  });
});

export default router;
