
import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const analyticsRouter = Router();

/**
 * GET /api/analytics/dashboard-pulse
 * Retrieves the high-level metrics for the dashboard cards
 */
analyticsRouter.get('/dashboard-pulse', async (req: Request, res: Response) => {
    try {
        // Determine org_id from request (middleware usually attaches it, or use header/query for now)
        // For MVP/Console, assuming single org or passed securely. 
        // Ideally user is authenticated via middleware.
        const orgId = req.headers['x-org-id'] as string; // Temporary for dev/MVP

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const { data, error } = await supabase
            .from('view_clinical_dashboard_pulse')
            .select('*')
            .eq('org_id', orgId)
            .single();

        if (error) {
            log.error('AnalyticsAPI', 'Failed to fetch dashboard pulse', { error: error.message });
            // If no data found (0 calls), return zeros
            if (error.code === 'PGRST116') {
                return res.json({
                    total_calls: 0,
                    inbound_calls: 0,
                    outbound_calls: 0,
                    avg_duration_seconds: 0,
                    success_rate: 0,
                    pipeline_value: 0,
                    hot_leads_count: 0
                });
            }
            return res.status(500).json({ error: 'Database error' });
        }

        return res.json(data);
    } catch (err: any) {
        log.error('AnalyticsAPI', 'Internal error', { error: err.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/analytics/leads
 * Retrieves the actionable leads list
 */
analyticsRouter.get('/leads', async (req: Request, res: Response) => {
    try {
        const orgId = req.headers['x-org-id'] as string;

        if (!orgId) {
            return res.status(400).json({ error: 'Organization ID required' });
        }

        const { data, error } = await supabase
            .from('view_actionable_leads')
            .select('*')
            .eq('org_id', orgId);

        if (error) {
            log.error('AnalyticsAPI', 'Failed to fetch leads', { error: error.message });
            return res.status(500).json({ error: 'Database error' });
        }

        return res.json({ leads: data || [] });
    } catch (err: any) {
        log.error('AnalyticsAPI', 'Internal error', { error: err.message });
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default analyticsRouter;
