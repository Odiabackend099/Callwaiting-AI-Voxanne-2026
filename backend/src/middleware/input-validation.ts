/**
 * Input validation middleware for MVP security
 * Sanitizes and validates common request patterns
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Sanitize string input: trim, remove control characters
 */
export function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, 10000); // Max 10KB per field
}

/**
 * Validate phone number (E.164 format)
 */
export function validatePhoneNumber(phone: unknown): boolean {
  if (typeof phone !== 'string') return false;
  const e164Regex = /^\+[1-9]\d{1,14}$/;
  return e164Regex.test(phone.trim());
}

/**
 * Validate email format
 */
export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validate UUID format
 */
export function validateUUID(id: unknown): boolean {
  if (typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id.trim());
}

/**
 * Middleware to validate knowledge base POST/PATCH requests
 */
export function validateKnowledgeBaseInput(req: Request, res: Response, next: NextFunction): void {
  try {
    const schema = z.object({
      filename: z.string()
        .min(1, 'Filename required')
        .max(255, 'Filename too long')
        .transform(s => sanitizeString(s))
        .refine(s => !s.includes('..') && !s.includes('/') && !s.includes('\\'), 'Invalid filename'),
      content: z.string()
        .min(1, 'Content required')
        .max(300000, 'Content too large')
        .transform(s => sanitizeString(s)),
      category: z.enum(['products_services', 'operations', 'ai_guidelines', 'general']).optional(),
      active: z.boolean().optional()
    });

    const validated = schema.parse(req.body);
    (req as any).validatedBody = validated;
    next();
  } catch (error: any) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.errors?.[0]?.message || error.message
    });
  }
}

/**
 * Middleware to validate calls POST requests
 */
export function validateCallsInput(req: Request, res: Response, next: NextFunction): void {
  try {
    const schema = z.object({
      leads: z.array(z.object({
        id: z.string().min(1),
        name: z.string().max(255).optional(),
        phone: z.string().refine(validatePhoneNumber, 'Invalid phone format'),
        company: z.string().max(255).optional(),
        city: z.string().max(255).optional(),
        email: z.string().refine(validateEmail, 'Invalid email').optional()
      })).optional(),
      leadIds: z.array(z.string()).optional(),
      vapiAgentId: z.string().min(1, 'Agent ID required'),
      vapiPhoneNumberId: z.string().optional(),
      selectedVoice: z.string().min(1, 'Voice required')
    });

    const validated = schema.parse(req.body);
    (req as any).validatedBody = validated;
    next();
  } catch (error: any) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.errors?.[0]?.message || error.message
    });
  }
}

/**
 * Middleware to validate inbound setup POST requests
 */
export function validateInboundSetupInput(req: Request, res: Response, next: NextFunction): void {
  try {
    const schema = z.object({
      twilioAccountSid: z.string()
        .min(1, 'Twilio Account SID required')
        .refine(s => /^AC[a-z0-9]{32}$/i.test(s), 'Invalid Twilio Account SID'),
      twilioAuthToken: z.string()
        .min(32, 'Invalid Twilio Auth Token')
        .max(32, 'Invalid Twilio Auth Token'),
      twilioPhoneNumber: z.string()
        .refine(validatePhoneNumber, 'Invalid phone number format (E.164 required)')
    });

    const validated = schema.parse(req.body);
    (req as any).validatedBody = validated;
    next();
  } catch (error: any) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.errors?.[0]?.message || error.message
    });
  }
}

/**
 * Middleware to validate assistant sync POST requests
 */
export function validateAssistantSyncInput(req: Request, res: Response, next: NextFunction): void {
  try {
    const schema = z.object({
      agentId: z.string()
        .min(1, 'Agent ID required')
        .refine(validateUUID, 'Invalid agent ID format')
    });

    const validated = schema.parse(req.body);
    (req as any).validatedBody = validated;
    next();
  } catch (error: any) {
    res.status(400).json({
      error: 'Validation failed',
      details: error.errors?.[0]?.message || error.message
    });
  }
}
