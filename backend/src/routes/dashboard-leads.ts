import express, { Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';

const router = express.Router();

/**
 * GET /api/dashboard/hot-leads
 * 
 * Fetches recent hot lead alerts for the authenticated user's organization.
 * Returns formatted data suitable for the frontend Dashboard UI.
 */
router.get('/hot-leads', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
    try {
        const orgId = req.user?.orgId;

        if (!orgId) {
            res.status(401).json({ error: 'Unauthorized: No organization ID found' });
            return;
        }

        // Fetch the 12 most recent hot leads
        const { data: leads, error } = await supabase
            .from('hot_lead_alerts')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(12);

        if (error) {
            log.error('DashboardLeads', 'Failed to fetch hot leads', { error: error.message, orgId });
            res.status(500).json({ error: 'Failed to fetch hot leads' });
            return;
        }

        // Format for frontend
        const formattedLeads = (leads || []).map((lead) => {
            const created = new Date(lead.created_at);
            const now = new Date();
            const diffMs = now.getTime() - created.getTime();

            // Calculate human-readable "time ago"
            let timeAgo = 'Just now';
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMins / 60);
            const diffDays = Math.floor(diffHours / 24);

            if (diffMins < 1) timeAgo = 'Just now';
            else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
            else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
            else timeAgo = `${diffDays}d ago`;

            return {
                id: lead.id,
                name: lead.lead_name,
                phone: lead.lead_phone,
                serviceType: lead.service_interest || 'General Inquiry',
                score: lead.lead_score || 0,
                summary: lead.summary || 'No summary provided',
                createdAt: lead.created_at,
                timeAgo
            };
        });

        res.json({ leads: formattedLeads });
    } catch (error: any) {
        log.error('DashboardLeads', 'Unexpected error in GET /hot-leads', { error: error.message });
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
