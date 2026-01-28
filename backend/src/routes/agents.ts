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

        // Batch fetch user details to avoid N+1 query problem
        // Instead of getUserById for each agent (N queries), list all users once (1 query)
        const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({
            perPage: 1000 // Fetch up to 1000 users (more than enough for most orgs)
        });

        if (usersError) {
            log.error('agents', 'Error fetching users in batch', { error: usersError.message, orgId });
            return res.status(500).json({ error: usersError.message });
        }

        // Create lookup map for O(1) access
        const userMap = new Map<string, any>(users.map(u => [u.id, u] as [string, any]));

        // Map agents to user details using the lookup map
        const agentsWithDetails = (data || []).map(agent => {
            const user = userMap.get(agent.user_id);
            if (user) {
                return {
                    id: user.id as string,
                    email: (user.email as string) || 'Unknown',
                    created_at: agent.created_at
                };
            }
            // User not found (might have been deleted)
            log.warn('agents', 'User not found for agent', { userId: agent.user_id, orgId });
            return null;
        });

        // Filter out null values (agents with deleted users)
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
