/**
 * Agents API Routes
 * Returns team members with 'agent' role for dropdowns and selection
 */

import { Router } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { supabase } from '../services/supabase-client';
import { log } from '../services/logger';

const router = Router();

/**
 * GET /api/agents
 * List all agents (team members with role='agent') for the authenticated user's organization
 * Used in escalation rules and other features that need to select specific agents
 */
router.get('/', requireAuthOrDev, async (req, res) => {
    try {
        const user = (req as any).user;

        // CRITICAL: Verify authentication and org_id
        if (!user || !user.orgId) {
            log.error('agents', 'Missing authentication or orgId', {
                hasUser: !!user
            });
            return res.status(401).json({
                error: 'Authentication required'
            });
        }

        const orgId = user.orgId;

        log.info('agents', 'Fetching agents for organization', { orgId });

        // Fetch team members with 'agent' role
        const { data, error } = await supabase
            .from('user_org_roles')
            .select(`
                user_id,
                role,
                created_at
            `)
            .eq('org_id', orgId)
            .eq('role', 'agent')
            .order('created_at', { ascending: true });

        if (error) {
            log.error('agents', 'Error fetching agents', { error: error.message, orgId });
            return res.status(500).json({ error: error.message });
        }

        // Fetch user details from auth.users for each agent
        const agentsWithDetails = await Promise.all(
            (data || []).map(async (agent) => {
                try {
                    const { data: userData } = await supabase.auth.admin.getUserById(agent.user_id);
                    if (userData?.user) {
                        return {
                            id: userData.user.id,
                            email: userData.user.email || 'Unknown',
                            created_at: agent.created_at
                        };
                    }
                    return null;
                } catch (err) {
                    log.warn('agents', 'Error fetching user details', {
                        userId: agent.user_id,
                        error: err instanceof Error ? err.message : String(err)
                    });
                    return null;
                }
            })
        );

        // Filter out null values (failed fetches)
        const validAgents = agentsWithDetails.filter(agent => agent !== null);

        log.info('agents', 'Successfully fetched agents', {
            orgId,
            count: validAgents.length
        });

        res.json(validAgents);
    } catch (error: any) {
        log.error('agents', 'Unexpected error', {
            error: error?.message,
            stack: error?.stack
        });
        res.status(500).json({ error: 'Failed to fetch agents' });
    }
});

export default router;
