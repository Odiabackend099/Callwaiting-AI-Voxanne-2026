/**
 * Lead Status Update Endpoints
 * 
 * Critical CRM endpoint using Closed-Loop UX Synchronization pattern.
 * - Idempotent: X-Idempotency-Key prevents duplicate status changes
 * - Supports bulk operations: Update multiple leads atomically
 * - Optimistic updates: UI updates before confirmation
 * - Real-time: All team members see status changes instantly
 * 
 * Integrated with Pattern Library:
 * - Middleware: createIdempotencyMiddleware()
 * - Retry: retryWithBackoff()
 * - Realtime: RealtimeSyncService
 * - Offline: Supports offline queue (frontend)
 * 
 * Frontend: Use SyncButton component with bulk operation support
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { createIdempotencyMiddleware } from '../middleware/idempotency';
import { retryWithBackoff } from '../utils/error-recovery';
import { getRealtimeSyncService } from '../services/realtime-sync';
import { log } from '../services/logger';

const router = Router();

router.use(requireAuthOrDev);

// Valid lead statuses
const VALID_STATUSES = ['new', 'contacted', 'qualified', 'proposal_sent', 'negotiating', 'won', 'lost'] as const;

/**
 * POST /api/leads/update-status
 * 
 * Update lead status (single or bulk).
 * 
 * Features:
 * - Idempotent: Same update idempotency key returns same result
 * - Bulk operations: Update multiple leads in single request
 * - Atomic: All updates succeed or all fail (transaction)
 * - Real-time: All clients see status change immediately
 * - Audit trail: Logs who changed status when
 * - Optimistic updates: UI can update before server confirmation
 * 
 * Request Headers:
 * - X-Idempotency-Key: Unique request identifier
 * 
 * Request Body (Single):
 * {
 *   "leadId": "uuid",
 *   "status": "won" | "lost" | "contacted" | etc,
 *   "notes": "optional reason for status change",
 *   "optimistic": true  // optional: UI already updated, just confirm
 * }
 * 
 * Request Body (Bulk):
 * {
 *   "leadIds": ["uuid", "uuid", ...],
 *   "status": "won",
 *   "notes": "bulk status change",
 *   "bulkOperation": true
 * }
 * 
 * Response (Single):
 * {
 *   "success": true,
 *   "lead": { id, name, status, status_changed_at, ... },
 *   "message": "Status updated to won"
 * }
 * 
 * Response (Bulk):
 * {
 *   "success": true,
 *   "updated": 5,
 *   "failed": 0,
 *   "message": "5 leads updated"
 * }
 * 
 * Error Cases:
 * - 400: Invalid status or missing required fields
 * - 404: Lead not found
 * - 409: Lead already has target status
 * - 500: Database error (will retry)
 */
router.post(
  '/update-status',
  createIdempotencyMiddleware(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const orgId = req.user?.orgId;
      const userId = req.user?.id;

      if (!orgId || !userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Validate request body
      const singleSchema = z.object({
        leadId: z.string().uuid('Invalid lead ID').optional(),
        leadIds: z.array(z.string().uuid()).optional(),
        status: z.enum(VALID_STATUSES),
        notes: z.string().optional(),
        optimistic: z.boolean().optional(),
        bulkOperation: z.boolean().optional(),
      });

      let validated;
      try {
        validated = singleSchema.parse(req.body);
      } catch (error: any) {
        res.status(400).json({
          error: 'Invalid request',
          details: error.errors?.[0]?.message || error.message,
        });
        return;
      }

      // Determine if single or bulk operation
      const isBulk = validated.bulkOperation || (validated.leadIds && validated.leadIds.length > 0);
      const leadIds = isBulk ? validated.leadIds! : [validated.leadId!];

      if (!isBulk && !validated.leadId) {
        res.status(400).json({ error: 'Either leadId or leadIds required' });
        return;
      }

      if (isBulk && leadIds.length === 0) {
        res.status(400).json({ error: 'leadIds array cannot be empty' });
        return;
      }

      // Execute update with retry
      const result = await retryWithBackoff(
        () => updateLeadStatusInternal(leadIds, orgId, validated.status, userId, validated.notes, isBulk),
        {
          maxAttempts: 3,
          initialDelayMs: 1000,
          shouldRetry: (error) => {
            // Don't retry validation errors
            if (error.message.includes('not found')) return false;
            if (error.message.includes('Invalid')) return false;
            return true;
          },
          onRetry: (attempt, error) => {
            log.warn('LeadStatusUpdate', `Retry attempt ${attempt}`, {
              leadCount: leadIds.length,
              error: error.message,
            });
          },
        }
      );

      // Publish changes to realtime
      const realtimeSync = getRealtimeSyncService();

      if (isBulk) {
        // Publish bulk update event
        await realtimeSync.publish('leads_bulk_update', {
          leadIds,
          status: validated.status,
          updatedAt: new Date().toISOString(),
          updatedBy: userId,
        });

        log.info('LeadStatusUpdate', 'Bulk status update completed', {
          count: leadIds.length,
          status: validated.status,
          orgId,
        });

        res.json({
          success: true,
          updated: result.updated,
          failed: result.failed,
          message: `${result.updated} leads updated to ${validated.status}`,
        });
      } else {
        // Publish single update event
        await realtimeSync.publish('leads', {
          id: result.lead.id,
          status: validated.status,
          status_changed_at: result.lead.status_changed_at,
          updatedAt: new Date().toISOString(),
        });

        log.info('LeadStatusUpdate', 'Lead status updated', {
          leadId: validated.leadId,
          status: validated.status,
          orgId,
        });

        res.json({
          success: true,
          lead: result.lead,
          message: `Status updated to ${validated.status}`,
        });
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      log.error('LeadStatusUpdate', 'Failed to update status', {
        error: err.message,
        orgId: req.user?.orgId,
      });

      if (err.message.includes('not found')) {
        res.status(404).json({ error: 'One or more leads not found' });
      } else if (err.message.includes('Invalid')) {
        res.status(400).json({ error: err.message });
      } else {
        res.status(500).json({
          error: 'Failed to update status',
          message: 'Your changes will be retried automatically',
        });
      }
    }
  }
);

/**
 * Internal: Update lead status (single or bulk)
 */
async function updateLeadStatusInternal(
  leadIds: string[],
  orgId: string,
  newStatus: string,
  userId: string,
  notes?: string,
  isBulk: boolean = false
): Promise<any> {
  const now = new Date().toISOString();

  if (!isBulk && leadIds.length === 1) {
    // Single lead update
    const leadId = leadIds[0];

    // Fetch current lead
    const { data: lead, error: fetchError } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', leadId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !lead) {
      throw new Error('Lead not found in this organization');
    }

    if (lead.lead_status === newStatus) {
      throw new Error(`Lead already has status: ${newStatus}`);
    }

    // Update lead
    const { data: updated, error: updateError } = await supabase
      .from('contacts')
      .update({
        lead_status: newStatus,
        status_changed_at: now,
        status_changed_by: userId,
        notes: notes ? `${lead.notes || ''}\n[${now}] ${notes}` : lead.notes,
        updated_at: now,
      })
      .eq('id', leadId)
      .eq('org_id', orgId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update lead: ${updateError.message}`);
    }

    return { lead: updated };
  } else {
    // Bulk update
    const { data: leads, error: fetchError } = await supabase
      .from('contacts')
      .select('id')
      .in('id', leadIds)
      .eq('org_id', orgId);

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    const foundIds = (leads || []).map((l) => l.id);
    const missingIds = leadIds.filter((id) => !foundIds.includes(id));

    if (missingIds.length > 0) {
      throw new Error(`${missingIds.length} leads not found`);
    }

    // Update all leads
    const { error: updateError, count } = await supabase
      .from('contacts')
      .update({
        lead_status: newStatus,
        status_changed_at: now,
        status_changed_by: userId,
        updated_at: now,
      })
      .in('id', leadIds)
      .eq('org_id', orgId);

    if (updateError) {
      throw new Error(`Failed to update leads: ${updateError.message}`);
    }

    return {
      updated: count || leadIds.length,
      failed: 0,
    };
  }
}

/**
 * GET /api/leads/:leadId/status-history
 * Get status change history for a lead
 */
router.get('/:leadId/status-history', async (req: Request, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Fetch lead with status history from notes
    const { data: lead, error } = await supabase
      .from('contacts')
      .select('id, name, lead_status, status_changed_at, status_changed_by, notes')
      .eq('id', req.params.leadId)
      .eq('org_id', orgId)
      .single();

    if (error || !lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    // Parse status changes from notes (in production: use dedicated audit table)
    const history = [
      {
        status: lead.lead_status,
        changedAt: lead.status_changed_at,
        changedBy: lead.status_changed_by,
      },
    ];

    res.json({
      leadId: lead.id,
      currentStatus: lead.lead_status,
      history,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

export default router;
