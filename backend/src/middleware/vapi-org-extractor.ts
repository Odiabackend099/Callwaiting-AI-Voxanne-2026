/**
 * Vapi Organization Extractor Middleware
 *
 * Extracts org_id from Vapi customer metadata and attaches to request
 * This enables multi-tenant webhook routing
 *
 * Usage: app.use('/api/vapi', extractVapiOrgId);
 *
 * Then in handlers: const orgId = (req as any).orgId;
 */

import { Request, Response, NextFunction } from 'express';
import { log } from '../services/logger';

declare global {
  namespace Express {
    interface Request {
      orgId?: string;
      vapiCustomer?: any;
      vapiAssistantId?: string;
    }
  }
}

/**
 * Extracts organization ID from Vapi customer metadata
 * Supports multiple payload formats from Vapi
 *
 * Vapi can send org_id in:
 * 1. req.body.customer.metadata.org_id (standard format)
 * 2. req.body.message.customer.metadata.org_id (nested format)
 * 3. req.body.orgId (direct format)
 */
export function extractVapiOrgId(req: Request, res: Response, next: NextFunction) {
  try {
    // Try multiple paths to find org_id
    let orgId: string | undefined;
    let customer: any = {};

    // Path 1: Direct customer metadata
    if (req.body?.customer?.metadata?.org_id) {
      orgId = req.body.customer.metadata.org_id;
      customer = req.body.customer;
    }
    // Path 2: Nested in message
    else if (req.body?.message?.customer?.metadata?.org_id) {
      orgId = req.body.message.customer.metadata.org_id;
      customer = req.body.message.customer;
    }
    // Path 3: Direct at root
    else if (req.body?.orgId) {
      orgId = req.body.orgId;
    }

    // Attach to request for downstream handlers
    if (orgId) {
      (req as any).orgId = orgId;
      (req as any).vapiCustomer = customer;
      (req as any).vapiAssistantId = req.body.assistantId;

      // Log for debugging (only first 30 chars of org_id)
      const shortOrgId = orgId.substring(0, 30);
      const toolName = req.body.message?.toolCall?.function?.name ||
                      req.body.toolCall?.function?.name ||
                      'unknown';

      log.debug('Vapi-OrgExtractor', 'Extracted org_id from Vapi metadata', {
        orgId: shortOrgId,
        assistantId: req.body.assistantId?.substring(0, 20),
        toolName,
        hasCustomerMetadata: !!customer.metadata,
        payloadFormat: req.body.message ? 'nested' : 'direct'
      });
    } else {
      // Warn if no org_id found but endpoint was called
      log.warn('Vapi-OrgExtractor', 'No org_id found in Vapi request', {
        hasCustomer: !!req.body.customer,
        hasMessage: !!req.body.message,
        bodyKeys: Object.keys(req.body || {}),
        customerKeys: Object.keys(req.body?.customer || {}),
        metadataKeys: Object.keys(req.body?.customer?.metadata || {})
      });
    }

    next();
  } catch (error) {
    // Don't block request on middleware error
    log.warn('Vapi-OrgExtractor', 'Error extracting org_id', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    next();
  }
}

/**
 * Validation middleware to ensure org_id is present
 * Use this for endpoints that REQUIRE org_id
 *
 * Usage: app.use('/api/vapi/tools/bookClinicAppointment', requireVapiOrgId);
 */
export function requireVapiOrgId(req: Request, res: Response, next: NextFunction) {
  const orgId = (req as any).orgId;

  if (!orgId) {
    log.warn('Vapi-RequireOrgId', 'Request missing org_id', {
      url: req.path,
      hasCustomer: !!req.body?.customer,
      bodyKeys: Object.keys(req.body || {})
    });

    return res.status(400).json({
      success: false,
      error: 'Missing org_id in customer metadata',
      message: 'Vapi request must include customer.metadata.org_id',
      hint: 'Check Vapi assistant settings → Metadata section'
    });
  }

  next();
}

/**
 * Debug middleware to log all Vapi requests
 * Use only in development
 */
export function debugVapiRequests(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== 'production') {
    log.info('Vapi-Debug', 'Incoming Vapi request', {
      path: req.path,
      method: req.method,
      orgId: (req as any).orgId,
      assistantId: req.body.assistantId?.substring(0, 20),
      messageType: req.body.messageType,
      toolName: req.body.message?.toolCall?.function?.name,
      bodySize: JSON.stringify(req.body).length
    });
  }

  next();
}

export default {
  extractVapiOrgId,
  requireVapiOrgId,
  debugVapiRequests
};
