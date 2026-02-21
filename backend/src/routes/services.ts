/**
 * Services Routes
 * Manages organization service definitions and pricing for pipeline value calculation
 * Multi-tenant safe: all queries filtered by org_id
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { supabase } from '../services/supabase-client';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { getCachedServicePricing, invalidateServiceCache } from '../services/cache';
import { sanitizeError, handleDatabaseError, sanitizeValidationError } from '../utils/error-sanitizer';

const servicesRouter = Router();

servicesRouter.use(requireAuthOrDev);

/**
 * GET /api/services
 * List all services for the organization
 * @query limit - Items per page (default 50, max 100)
 * @query offset - Pagination offset (default 0)
 * @returns List of services with pricing and keywords
 */
servicesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
      offset: z.coerce.number().int().min(0).default(0)
    });

    const parsed = schema.parse(req.query);

    // Fetch services for the organization
    const { data: services, error, count } = await supabase
      .from('services')
      .select('*', { count: 'exact' })
      .eq('org_id', orgId)
      .order('created_at', { ascending: false })
      .range(parsed.offset, parsed.offset + parsed.limit - 1);

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Services - GET / - Database error',
        'Failed to fetch services'
      );
    }

    return res.json({
      services: services || [],
      pagination: {
        offset: parsed.offset,
        limit: parsed.limit,
        total: count || 0
      }
    });
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Services - GET / - Unexpected error',
      'Failed to fetch services'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * GET /api/services/:id
 * Get a specific service
 * @param id - Service ID
 * @returns Service details
 */
servicesRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const { data: service, error } = await supabase
      .from('services')
      .select('*')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (error || !service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    return res.json(service);
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Services - GET /:id - Unexpected error',
      'Failed to fetch service'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * POST /api/services
 * Create a new service
 * @body name - Service name (required)
 * @body price - Service price in dollars (required)
 * @body keywords - Array of keywords to match in transcripts (required)
 * @returns Created service
 */
servicesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const schema = z.object({
      name: z.string().min(1, 'Service name is required'),
      price: z.number().min(0, 'Price must be a positive number'),
      keywords: z.array(z.string().min(1)).min(1, 'At least one keyword is required')
    });

    const parsed = schema.parse(req.body);

    // Create service
    const { data: service, error } = await supabase
      .from('services')
      .insert({
        org_id: orgId,
        name: parsed.name,
        price: parsed.price,
        keywords: parsed.keywords,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single();

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Services - POST / - Database error',
        'Failed to create service'
      );
    }

    // Invalidate service cache after creation
    invalidateServiceCache(orgId);

    log.info('Services', 'Service created', {
      orgId,
      serviceId: service.id,
      name: parsed.name,
      price: parsed.price
    });

    return res.status(201).json(service);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const userMessage = sanitizeValidationError(e);
      return res.status(400).json({ error: userMessage });
    }
    const userMessage = sanitizeError(
      e,
      'Services - POST / - Unexpected error',
      'Failed to create service'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * PATCH /api/services/:id
 * Update a service
 * @param id - Service ID
 * @body name - Service name (optional)
 * @body price - Service price (optional)
 * @body keywords - Array of keywords (optional)
 * @returns Updated service
 */
servicesRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
      price: z.number().min(0).optional(),
      keywords: z.array(z.string().min(1)).min(1).optional()
    });

    const parsed = schema.parse(req.body);

    // Check if service exists
    const { data: existing, error: checkError } = await supabase
      .from('services')
      .select('id')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Update service
    const { data: service, error } = await supabase
      .from('services')
      .update({
        ...parsed,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('org_id', orgId)
      .select('*')
      .single();

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Services - PATCH /:id - Database error',
        'Failed to update service'
      );
    }

    // Invalidate service cache after update
    invalidateServiceCache(orgId);

    log.info('Services', 'Service updated', { orgId, serviceId: id });

    return res.json(service);
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      const userMessage = sanitizeValidationError(e);
      return res.status(400).json({ error: userMessage });
    }
    const userMessage = sanitizeError(
      e,
      'Services - PATCH /:id - Unexpected error',
      'Failed to update service'
    );
    return res.status(500).json({ error: userMessage });
  }
});

/**
 * DELETE /api/services/:id
 * Delete a service
 * @param id - Service ID
 * @returns Success message
 */
servicesRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const orgId = req.user?.orgId;
    if (!orgId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    // Check if service exists
    const { data: existing, error: checkError } = await supabase
      .from('services')
      .select('id, name')
      .eq('id', id)
      .eq('org_id', orgId)
      .single();

    if (checkError || !existing) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Delete service
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('org_id', orgId);

    if (error) {
      return handleDatabaseError(
        res,
        error,
        'Services - DELETE /:id - Database error',
        'Failed to delete service'
      );
    }

    // Invalidate service cache after deletion
    invalidateServiceCache(orgId);

    log.info('Services', 'Service deleted', { orgId, serviceId: id, serviceName: existing.name });

    return res.json({
      success: true,
      message: `Service "${existing.name}" deleted successfully`
    });
  } catch (e: any) {
    const userMessage = sanitizeError(
      e,
      'Services - DELETE /:id - Unexpected error',
      'Failed to delete service'
    );
    return res.status(500).json({ error: userMessage });
  }
});

export { servicesRouter };
