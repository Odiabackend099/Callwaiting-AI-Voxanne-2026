/**
 * Escalation Rules API Routes
 * Manages call escalation/transfer rules for organizations
 */

import { Router } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { supabase } from '../services/supabase-client';

const router = Router();

/**
 * GET /api/escalation-rules
 * List all escalation rules for the authenticated user's organization
 * Optional query param: agentId - filter rules for specific agent
 */
router.get('/', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;
        const { agentId } = req.query;

        let query = supabase
            .from('escalation_rules')
            .select('*')
            .eq('org_id', orgId)
            .order('priority', { ascending: false });

        // Filter by agent if provided (includes global rules where agent_id is null)
        if (agentId) {
            query = query.or(`agent_id.eq.${agentId},agent_id.is.null`);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Escalation Rules] Error fetching rules:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data || []);
    } catch (error: any) {
        console.error('[Escalation Rules] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to fetch escalation rules' });
    }
});

/**
 * POST /api/escalation-rules
 * Create a new escalation rule
 */
router.post('/', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;
        const {
            agent_id,
            trigger_type,
            trigger_value,
            transfer_number,
            transfer_type,
            name,
            description,
            enabled,
            priority
        } = req.body;

        // Validate required fields
        if (!trigger_type || !transfer_number || !name) {
            return res.status(400).json({
                error: 'Missing required fields: trigger_type, transfer_number, name'
            });
        }

        // Validate trigger_type
        const validTriggerTypes = ['wait_time', 'sentiment', 'ai_request', 'manual'];
        if (!validTriggerTypes.includes(trigger_type)) {
            return res.status(400).json({
                error: `Invalid trigger_type. Must be one of: ${validTriggerTypes.join(', ')}`
            });
        }

        const { data, error } = await supabase
            .from('escalation_rules')
            .insert({
                org_id: orgId,
                agent_id: agent_id || null,
                trigger_type,
                trigger_value: trigger_value || null,
                transfer_number,
                transfer_type: transfer_type || 'external',
                name,
                description: description || null,
                enabled: enabled !== undefined ? enabled : true,
                priority: priority || 0
            })
            .select()
            .single();

        if (error) {
            console.error('[Escalation Rules] Error creating rule:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json(data);
    } catch (error: any) {
        console.error('[Escalation Rules] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to create escalation rule' });
    }
});

/**
 * PATCH /api/escalation-rules/:id
 * Update an existing escalation rule
 */
router.patch('/:id', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;
        const { id } = req.params;

        // Don't allow org_id to be changed
        const { org_id, ...updateData } = req.body;

        const { data, error } = await supabase
            .from('escalation_rules')
            .update({
                ...updateData,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('org_id', orgId) // Ensure user can only update their org's rules
            .select()
            .single();

        if (error) {
            console.error('[Escalation Rules] Error updating rule:', error);
            return res.status(400).json({ error: error.message });
        }

        if (!data) {
            return res.status(404).json({ error: 'Escalation rule not found' });
        }

        res.json(data);
    } catch (error: any) {
        console.error('[Escalation Rules] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to update escalation rule' });
    }
});

/**
 * DELETE /api/escalation-rules/:id
 * Delete an escalation rule
 */
router.delete('/:id', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;
        const { id } = req.params;

        const { error } = await supabase
            .from('escalation_rules')
            .delete()
            .eq('id', id)
            .eq('org_id', orgId); // Ensure user can only delete their org's rules

        if (error) {
            console.error('[Escalation Rules] Error deleting rule:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(204).send();
    } catch (error: any) {
        console.error('[Escalation Rules] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to delete escalation rule' });
    }
});

/**
 * GET /api/escalation-rules/transfers
 * Get transfer queue history
 */
router.get('/transfers', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;
        const { status, limit = 50 } = req.query;

        let query = supabase
            .from('transfer_queue')
            .select('*')
            .eq('org_id', orgId)
            .order('created_at', { ascending: false })
            .limit(Number(limit));

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error('[Escalation Rules] Error fetching transfers:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data || []);
    } catch (error: any) {
        console.error('[Escalation Rules] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to fetch transfer queue' });
    }
});

export default router;
