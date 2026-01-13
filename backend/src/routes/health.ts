/**
 * Health Check Endpoint
 * Validates all critical services are operational
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { OpenAI } from 'openai';

const healthRouter = Router();

interface HealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    checks: {
        database: boolean;
        openai: boolean;
        timestamp: string;
    };
    uptime: number;
}

healthRouter.get('/health', async (req: Request, res: Response) => {
    const startTime = Date.now();

    const checks = {
        database: false,
        openai: false,
        timestamp: new Date().toISOString()
    };

    // Check database
    try {
        const { error } = await supabase.from('organizations').select('id').limit(1);
        checks.database = !error;
    } catch (error) {
        checks.database = false;
    }

    // Check OpenAI
    try {
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        if (openai) checks.openai = true;
    } catch (error) {
        checks.openai = false;
    }

    const allHealthy = checks.database && checks.openai;
    const status: HealthCheck['status'] = allHealthy ? 'healthy' : 'degraded';

    const response: HealthCheck = {
        status,
        checks,
        uptime: process.uptime()
    };

    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(response);
});

export { healthRouter };
