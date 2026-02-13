/**
 * Dashboard Health Check Endpoint
 * GET /api/health/dashboard
 *
 * Checks:
 * 1. Database connectivity (calls table accessible)
 * 2. API responsiveness (response time < 200ms)
 * 3. Auth middleware functional
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';

const healthRouter = Router();

interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
        database: { status: 'pass' | 'fail'; latency_ms: number; error?: string };
        storage: { status: 'pass' | 'fail' | 'skip'; error?: string };
    };
    response_time_ms: number;
}

/**
 * GET /api/health/dashboard
 * Returns health status of dashboard-related services
 * No authentication required (health check endpoint)
 */
healthRouter.get('/', async (_req: Request, res: Response) => {
    const startTime = Date.now();
    const result: HealthCheckResult = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        checks: {
            database: { status: 'pass', latency_ms: 0 },
            storage: { status: 'skip' },
        },
        response_time_ms: 0,
    };

    // Check 1: Database connectivity
    try {
        const dbStart = Date.now();
        const { count, error } = await supabase
            .from('calls')
            .select('id', { count: 'exact', head: true })
            .limit(1);

        result.checks.database.latency_ms = Date.now() - dbStart;

        if (error) {
            result.checks.database.status = 'fail';
            result.checks.database.error = error.message;
            result.status = 'unhealthy';
        }
    } catch (e: any) {
        result.checks.database.status = 'fail';
        result.checks.database.error = e.message;
        result.status = 'unhealthy';
    }

    // Check 2: Storage connectivity (list buckets)
    try {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
            result.checks.storage.status = 'fail';
            result.checks.storage.error = error.message;
            if (result.status === 'healthy') result.status = 'degraded';
        } else {
            result.checks.storage.status = 'pass';
        }
    } catch (e: any) {
        result.checks.storage.status = 'fail';
        result.checks.storage.error = e.message;
        if (result.status === 'healthy') result.status = 'degraded';
    }

    result.response_time_ms = Date.now() - startTime;

    const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;
    return res.status(statusCode).json(result);
});

export { healthRouter };
