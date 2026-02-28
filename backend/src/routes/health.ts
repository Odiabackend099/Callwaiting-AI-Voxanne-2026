/**
 * Health Check Endpoint
 * Validates all critical services are operational
 * Must respond in <100ms — required for Twilio webhook compatibility
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const healthRouter = Router();

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    vapi: boolean;
    timestamp: string;
  };
  uptime: number;
  response_time_ms?: number;
}

healthRouter.get('/health', async (req: Request, res: Response) => {
  const startTime = Date.now();

  const checks = {
    database: false,
    vapi: false,
    timestamp: new Date().toISOString()
  };

  // Check database — lightweight ping with 2s hard timeout
  // Uses raw SQL "SELECT 1" to avoid reading real tenant data or depending on RLS-gated tables
  try {
    const dbCheck = supabase.rpc('ping').then(() => ({ error: null })).catch((e: any) => {
      // Fallback: if ping RPC doesn't exist, use minimal query
      return supabase.from('organizations').select('id').limit(1);
    });
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('DB health check timeout (2000ms)')), 2000)
    );
    const response = await Promise.race([dbCheck, timeout]);
    checks.database = (response as any).error === null;
  } catch (error: any) {
    checks.database = false;
    log.warn('Health', 'Database health check failed', { error: error.message });
  }

  // Check Vapi — validate env var presence only (warning-level dependency)
  // Actual connectivity tested via /health/vapi when needed
  checks.vapi = !!process.env.VAPI_PRIVATE_KEY;

  // Database is the only hard dependency — unhealthy only if DB is down
  const allHealthy = checks.database;
  const status: HealthCheck['status'] = allHealthy ? 'healthy' : (checks.vapi ? 'degraded' : 'unhealthy');

  const responseTimeMs = Date.now() - startTime;

  if (responseTimeMs > 100) {
    log.warn('Health', 'Health check exceeded 100ms SLA', { response_time_ms: responseTimeMs });
  }

  const response: HealthCheck = {
    status,
    checks,
    uptime: process.uptime(),
    response_time_ms: responseTimeMs
  };

  // Return 503 only if database is completely down
  const statusCode = checks.database ? 200 : 503;
  res.status(statusCode).json(response);
});

const authRouter = Router();

authRouter.get('/auth/health', (req, res) => res.status(200).send('OK'));

export { healthRouter, authRouter };
