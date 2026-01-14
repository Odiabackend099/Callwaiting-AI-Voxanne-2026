/**
 * Team Management API Routes
 * Manages user roles and team members within organizations
 */

import { Router } from 'express';
import { requireAuthOrDev } from '../middleware/auth';
import { supabase } from '../services/supabase-client';

const router = Router();

/**
 * Helper function to check if user is admin
 */
async function isUserAdmin(userId: string, orgId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from('user_org_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('org_id', orgId)
        .single();

    if (error || !data) return false;
    return data.role === 'admin';
}

/**
 * GET /api/team/members
 * List all team members for the authenticated user's organization
 */
router.get('/members', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId } = req.user!;

        const { data, error } = await supabase
            .from('user_org_roles')
            .select(`
        id,
        user_id,
        org_id,
        role,
        invited_by,
        invited_at,
        accepted_at,
        created_at,
        updated_at
      `)
            .eq('org_id', orgId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[Team] Error fetching members:', error);
            return res.status(500).json({ error: error.message });
        }

        // Fetch user details from auth.users for each member
        const membersWithDetails = await Promise.all(
            (data || []).map(async (member) => {
                const { data: userData } = await supabase.auth.admin.getUserById(member.user_id);
                return {
                    ...member,
                    user: userData?.user ? {
                        id: userData.user.id,
                        email: userData.user.email,
                        created_at: userData.user.created_at
                    } : null
                };
            })
        );

        res.json(membersWithDetails);
        return;
    } catch (error: any) {
        console.error('[Team] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to fetch team members' });
    }
});

/**
 * POST /api/team/members
 * Invite a new user to the organization (admin only)
 */
router.post('/members', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId, id: inviterId } = req.user!;
        const { email, role } = req.body;

        // Validate required fields
        if (!email || !role) {
            return res.status(400).json({
                error: 'Missing required fields: email, role'
            });
        }

        // Validate role
        const validRoles = ['admin', 'agent', 'viewer'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        // Verify requester is admin
        const isAdmin = await isUserAdmin(inviterId, orgId);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can invite users' });
        }

        // Check if user exists in auth.users
        const { data: existingUser } = await supabase.auth.admin.listUsers();
        const user = existingUser?.users.find(u => u.email === email);

        if (!user) {
            return res.status(400).json({
                error: 'User not found. User must be registered first.'
            });
        }

        // Check if user is already in this org
        const { data: existingRole } = await supabase
            .from('user_org_roles')
            .select('*')
            .eq('user_id', user.id)
            .eq('org_id', orgId)
            .single();

        if (existingRole) {
            return res.status(400).json({
                error: 'User is already a member of this organization'
            });
        }

        // Create user role
        const { data, error } = await supabase
            .from('user_org_roles')
            .insert({
                user_id: user.id,
                org_id: orgId,
                role,
                invited_by: inviterId,
                accepted_at: new Date().toISOString() // Auto-accept for now
            })
            .select()
            .single();

        if (error) {
            console.error('[Team] Error inviting user:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(201).json(data);
        return;
    } catch (error: any) {
        console.error('[Team] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to invite user' });
    }
});

/**
 * PATCH /api/team/members/:userId/role
 * Change a user's role (admin only)
 */
router.patch('/members/:userId/role', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId, id: requesterId } = req.user!;
        const { userId } = req.params;
        const { role } = req.body;

        // Validate role
        const validRoles = ['admin', 'agent', 'viewer'];
        if (!role || !validRoles.includes(role)) {
            return res.status(400).json({
                error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
            });
        }

        // Verify requester is admin
        const isAdmin = await isUserAdmin(requesterId, orgId);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can change roles' });
        }

        // Prevent changing your own role
        if (userId === requesterId) {
            return res.status(400).json({
                error: 'Cannot change your own role'
            });
        }

        const { data, error } = await supabase
            .from('user_org_roles')
            .update({
                role,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)
            .eq('org_id', orgId)
            .select()
            .single();

        if (error) {
            console.error('[Team] Error updating role:', error);
            return res.status(400).json({ error: error.message });
        }

        if (!data) {
            return res.status(404).json({ error: 'User not found in organization' });
        }

        res.json(data);
        return;
    } catch (error: any) {
        console.error('[Team] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

/**
 * DELETE /api/team/members/:userId
 * Remove a user from the organization (admin only)
 */
router.delete('/members/:userId', requireAuthOrDev, async (req, res) => {
    try {
        const { orgId, id: requesterId } = req.user!;
        const { userId } = req.params;

        // Verify requester is admin
        const isAdmin = await isUserAdmin(requesterId, orgId);
        if (!isAdmin) {
            return res.status(403).json({ error: 'Only admins can remove users' });
        }

        // Prevent removing yourself
        if (userId === requesterId) {
            return res.status(400).json({
                error: 'Cannot remove yourself from the organization'
            });
        }

        const { error } = await supabase
            .from('user_org_roles')
            .delete()
            .eq('user_id', userId)
            .eq('org_id', orgId);

        if (error) {
            console.error('[Team] Error removing user:', error);
            return res.status(400).json({ error: error.message });
        }

        res.status(204).send();
    } catch (error: any) {
        console.error('[Team] Unexpected error:', error);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

/**
 * GET /api/team/roles
 * Get available roles and their descriptions
 */
router.get('/roles', requireAuthOrDev, async (req, res) => {
    res.json([
        {
            role: 'admin',
            name: 'Administrator',
            description: 'Full access to all features including team management'
        },
        {
            role: 'agent',
            name: 'Agent',
            description: 'Can view data and take actions (transfer calls, book appointments)'
        },
        {
            role: 'viewer',
            name: 'Viewer',
            description: 'Read-only access to dashboard and reports'
        }
    ]);
});

export default router;
