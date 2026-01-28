/**
 * Compliance API Routes
 *
 * Priority 7: HIPAA & GDPR Compliance
 *
 * Endpoints:
 * - POST /api/compliance/data-export - Export all user data (GDPR Article 15)
 * - POST /api/compliance/data-deletion - Request data deletion (GDPR Article 17)
 * - GET /api/compliance/deletion-status/:requestId - Check deletion request status
 * - GET /api/compliance/audit-log - View compliance audit trail (admin only)
 *
 * Legal Requirements:
 * - GDPR Article 15: Right to access personal data
 * - GDPR Article 17: Right to erasure ("right to be forgotten")
 * - GDPR Article 30: Maintain records of processing activities
 * - HIPAA: Provide audit trail of PHI access and deletion
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase-client';
import { log as logger } from '../services/logger';
import { requireAuth } from '../middleware/auth';
import rateLimit from 'express-rate-limit';

const complianceRouter = Router();

// Rate limiting: Compliance endpoints are expensive operations
const complianceLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 requests per hour per user
  message: 'Too many compliance requests, please try again in 1 hour',
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * POST /api/compliance/data-export
 *
 * Export all data for authenticated user's organization
 * GDPR Article 15: Right to access personal data
 *
 * Returns JSON file containing:
 * - Organization settings
 * - Contacts
 * - Call logs (with PHI redacted)
 * - Appointments
 * - Messages
 * - Agents configuration
 */
complianceRouter.post('/data-export',
  requireAuth,
  complianceLimiter,
  async (req: Request, res: Response) => {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const startTime = Date.now();

    logger.info('Compliance', 'Data export requested', {
      orgId,
      userId,
      requestedAt: new Date().toISOString()
    });

    try {
      // Fetch all org data in parallel for performance
      const [
        orgResult,
        contactsResult,
        callLogsResult,
        appointmentsResult,
        messagesResult,
        agentsResult,
        servicesResult
      ] = await Promise.all([
        // Organization details
        supabase
          .from('organizations')
          .select('id, name, created_at, metadata')
          .eq('id', orgId)
          .single(),

        // Contacts (active only, exclude soft-deleted)
        supabase
          .from('contacts')
          .select('id, name, phone, email, lead_status, lead_score, service_interests, created_at, last_contacted_at')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),

        // Call logs (exclude soft-deleted, transcripts are already PHI-redacted)
        supabase
          .from('call_logs')
          .select('id, to_number, from_number, status, started_at, ended_at, duration_seconds, transcript, sentiment_score, sentiment_label, created_at')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(1000), // Limit to recent 1000 calls

        // Appointments (exclude soft-deleted)
        supabase
          .from('appointments')
          .select('id, service_type, scheduled_at, duration_minutes, status, contact_phone, customer_name, notes, created_at')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .order('scheduled_at', { ascending: false }),

        // Messages (exclude soft-deleted)
        supabase
          .from('messages')
          .select('id, to_number, body, status, sent_at, created_at')
          .eq('org_id', orgId)
          .is('deleted_at', null)
          .order('sent_at', { ascending: false })
          .limit(500), // Limit to recent 500 messages

        // Agents configuration
        supabase
          .from('agents')
          .select('id, name, role, active, created_at')
          .eq('org_id', orgId),

        // Services
        supabase
          .from('services')
          .select('id, name, price, keywords, description, created_at')
          .eq('org_id', orgId)
      ]);

      // Check for errors
      const errors = [
        orgResult.error,
        contactsResult.error,
        callLogsResult.error,
        appointmentsResult.error,
        messagesResult.error,
        agentsResult.error,
        servicesResult.error
      ].filter(Boolean);

      if (errors.length > 0) {
        logger.error('Compliance', 'Data export failed', {
          orgId,
          errors: errors.map((e: any) => e.message)
        });
        return res.status(500).json({ error: 'Failed to export data' });
      }

      // Compile export data
      const exportData = {
        export_metadata: {
          export_date: new Date().toISOString(),
          org_id: orgId,
          legal_basis: 'GDPR Article 15 - Right to Access',
          data_format_version: '1.0'
        },
        organization: orgResult.data,
        contacts: contactsResult.data || [],
        call_logs: callLogsResult.data || [],
        appointments: appointmentsResult.data || [],
        messages: messagesResult.data || [],
        agents: agentsResult.data || [],
        services: servicesResult.data || [],
        summary: {
          total_contacts: contactsResult.data?.length || 0,
          total_calls: callLogsResult.data?.length || 0,
          total_appointments: appointmentsResult.data?.length || 0,
          total_messages: messagesResult.data?.length || 0
        }
      };

      // Log export to audit trail
      await supabase
        .from('system_audit_logs')
        .insert({
          org_id: orgId,
          user_id: userId,
          event_type: 'data_export',
          event_category: 'compliance',
          severity: 'info',
          details: {
            records_exported: exportData.summary,
            export_size_bytes: JSON.stringify(exportData).length,
            legal_basis: 'GDPR Article 15'
          },
          created_at: new Date().toISOString()
        });

      const executionTime = Date.now() - startTime;

      logger.info('Compliance', 'Data export completed', {
        orgId,
        recordsExported: exportData.summary,
        executionTime: `${executionTime}ms`
      });

      // Return as JSON download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="voxanne-data-export-${orgId}-${Date.now()}.json"`);
      return res.json(exportData);

    } catch (error: any) {
      logger.error('Compliance', 'Data export exception', {
        orgId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'Internal server error during data export',
        message: 'Please contact support if this persists'
      });
    }
  }
);

/**
 * POST /api/compliance/data-deletion
 *
 * Request deletion of user data
 * GDPR Article 17: Right to erasure
 *
 * Body:
 * {
 *   scope: 'all_data' | 'contact_data' | 'call_data',
 *   contact_id?: string, // Optional: delete specific contact
 *   phone_number?: string, // Optional: delete by phone
 *   reason?: string // Optional: reason for deletion
 * }
 *
 * Returns:
 * {
 *   request_id: string,
 *   status: 'pending',
 *   estimated_completion: ISO date
 * }
 */
complianceRouter.post('/data-deletion',
  requireAuth,
  complianceLimiter,
  async (req: Request, res: Response) => {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;
    const userEmail = req.user?.email;

    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    const {
      scope,
      contact_id,
      phone_number,
      reason
    } = req.body;

    // Validate scope
    const validScopes = ['all_data', 'contact_data', 'call_data', 'user_data'];
    if (!scope || !validScopes.includes(scope)) {
      return res.status(400).json({
        error: 'Invalid scope',
        message: `scope must be one of: ${validScopes.join(', ')}`
      });
    }

    logger.info('Compliance', 'Data deletion request received', {
      orgId,
      userId,
      scope,
      contact_id,
      phone_number,
      requestedAt: new Date().toISOString()
    });

    try {
      // Create deletion request in database
      const { data: deletionRequest, error } = await supabase
        .from('data_deletion_requests')
        .insert({
          org_id: orgId,
          requester_email: userEmail || 'unknown',
          requester_phone: null,
          requested_at: new Date().toISOString(),
          requested_by: userId,
          scope: scope,
          contact_id: contact_id || null,
          phone_number: phone_number || null,
          email: null,
          status: 'pending',
          legal_basis: 'gdpr_article_17',
          verification_method: 'authenticated_user',
          verified_at: new Date().toISOString() // Auto-verified for authenticated users
        })
        .select()
        .single();

      if (error) {
        logger.error('Compliance', 'Failed to create deletion request', {
          orgId,
          error: error.message
        });

        return res.status(500).json({ error: 'Failed to create deletion request' });
      }

      // Log deletion request to audit trail
      await supabase
        .from('system_audit_logs')
        .insert({
          org_id: orgId,
          user_id: userId,
          event_type: 'data_deletion_requested',
          event_category: 'compliance',
          severity: 'warning',
          details: {
            request_id: deletionRequest.id,
            scope: scope,
            contact_id: contact_id || null,
            phone_number: phone_number || null,
            reason: reason || null,
            legal_basis: 'GDPR Article 17'
          },
          created_at: new Date().toISOString()
        });

      // Estimate completion time (30 days grace period + processing time)
      const estimatedCompletion = new Date();
      estimatedCompletion.setDate(estimatedCompletion.getDate() + 30);

      logger.info('Compliance', 'Data deletion request created', {
        requestId: deletionRequest.id,
        orgId,
        scope
      });

      return res.json({
        request_id: deletionRequest.id,
        status: 'pending',
        scope: scope,
        estimated_completion: estimatedCompletion.toISOString(),
        message: 'Your data deletion request has been received. Data will be permanently deleted after a 30-day grace period.',
        grace_period_days: 30,
        cancellation_deadline: estimatedCompletion.toISOString()
      });

    } catch (error: any) {
      logger.error('Compliance', 'Data deletion request exception', {
        orgId,
        error: error.message,
        stack: error.stack
      });

      return res.status(500).json({
        error: 'Internal server error during deletion request',
        message: 'Please contact support if this persists'
      });
    }
  }
);

/**
 * GET /api/compliance/deletion-status/:requestId
 *
 * Check status of data deletion request
 *
 * Returns:
 * {
 *   request_id: string,
 *   status: 'pending' | 'processing' | 'completed' | 'failed',
 *   requested_at: ISO date,
 *   processed_at: ISO date | null,
 *   records_deleted: object | null
 * }
 */
complianceRouter.get('/deletion-status/:requestId',
  requireAuth,
  async (req: Request, res: Response) => {
    const orgId = req.user?.orgId;
    const { requestId } = req.params;

    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    if (!requestId) {
      return res.status(400).json({ error: 'Request ID required' });
    }

    try {
      const { data: request, error } = await supabase
        .from('data_deletion_requests')
        .select('*')
        .eq('id', requestId)
        .eq('org_id', orgId)
        .single();

      if (error || !request) {
        return res.status(404).json({ error: 'Deletion request not found' });
      }

      return res.json({
        request_id: request.id,
        status: request.status,
        scope: request.scope,
        requested_at: request.requested_at,
        processed_at: request.processed_at || null,
        records_deleted: request.records_deleted || null,
        error_message: request.error_message || null
      });

    } catch (error: any) {
      logger.error('Compliance', 'Failed to fetch deletion status', {
        orgId,
        requestId,
        error: error.message
      });

      return res.status(500).json({ error: 'Failed to fetch deletion status' });
    }
  }
);

/**
 * GET /api/compliance/audit-log
 *
 * View compliance audit trail (admin only)
 * Returns all compliance-related events for the organization
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 200)
 * - event_type: Filter by event type
 */
complianceRouter.get('/audit-log',
  requireAuth,
  async (req: Request, res: Response) => {
    const orgId = req.user?.orgId;
    const userId = req.user?.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Organization ID required' });
    }

    // Check if user is admin (simplified - should check role in production)
    const { data: userRole, error: roleError } = await supabase
      .from('user_org_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('org_id', orgId)
      .single();

    if (roleError || !userRole || !['admin', 'owner'].includes(userRole.role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const eventType = req.query.event_type as string;
    const offset = (page - 1) * limit;

    try {
      let query = supabase
        .from('system_audit_logs')
        .select('*', { count: 'exact' })
        .eq('org_id', orgId)
        .eq('event_category', 'compliance')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data: auditLogs, count, error } = await query;

      if (error) {
        logger.error('Compliance', 'Failed to fetch audit logs', {
          orgId,
          error: error.message
        });

        return res.status(500).json({ error: 'Failed to fetch audit logs' });
      }

      return res.json({
        audit_logs: auditLogs || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit)
        }
      });

    } catch (error: any) {
      logger.error('Compliance', 'Audit log fetch exception', {
        orgId,
        error: error.message
      });

      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

export default complianceRouter;
