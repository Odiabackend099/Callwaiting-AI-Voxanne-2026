/**
 * Integration Status Route
 * 
 * Provides a secure endpoint for the frontend to check which integrations
 * are configured on the backend. This is the "Single Source of Truth"
 * for integration state.
 * 
 * CRITICAL: This endpoint ONLY returns boolean status, NEVER actual API keys
 * or sensitive data.
 * 
 * Route: GET /api/integrations/status
 * Response: { integrations: { vapi: boolean, openai: boolean, ... } }
 */

import { Router, Request, Response } from 'express';
import { log } from '../services/logger';

const router = Router();

// Simple in-memory cache with TTL (5 minutes)
let statusCache: { 
  timestamp: number; 
  data: { 
    integrations: Record<string, boolean> 
  } 
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Check if a secret is configured (not empty)
 */
function isSecretConfigured(secret: string | undefined): boolean {
  return !!(secret && secret.trim().length > 0);
}

/**
 * Get integration status from backend environment
 * Returns ONLY boolean values, never actual keys
 */
function getIntegrationStatus() {
  return {
    integrations: {
      // Vapi Integration
      vapi: isSecretConfigured(process.env.VAPI_API_KEY),
      
      // OpenAI Integration
      openai: isSecretConfigured(process.env.OPENAI_API_KEY),
      
      // Twilio Integration
      twilio: isSecretConfigured(process.env.TWILIO_AUTH_TOKEN) && 
              isSecretConfigured(process.env.TWILIO_ACCOUNT_SID),
      
      // Supabase (public credentials are okay, but service role key is secret)
      supabase: isSecretConfigured(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
                isSecretConfigured(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      
      // Stripe Integration
      stripe: isSecretConfigured(process.env.STRIPE_SECRET_KEY),
      
      // Google Cloud Integration
      googleCloud: isSecretConfigured(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      
      // Anthropic (Claude) Integration
      anthropic: isSecretConfigured(process.env.ANTHROPIC_API_KEY),
      
      // Pinecone (Vector DB) Integration
      pinecone: isSecretConfigured(process.env.PINECONE_API_KEY)
    },
    timestamp: new Date().toISOString(),
    cacheAge: statusCache ? Date.now() - statusCache.timestamp : null
  };
}

/**
 * GET /api/integrations/status
 * 
 * Returns the status of all configured integrations.
 * Public endpoint (no auth required) - returns only boolean status.
 * Cached for 5 minutes to reduce redundant checks.
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const now = Date.now();
    
    // Check cache validity
    if (statusCache && (now - statusCache.timestamp) < CACHE_TTL_MS) {
      log.debug('IntegrationsStatus', 'Returning cached status', {
        cacheAge: now - statusCache.timestamp
      });
      return res.json(statusCache.data);
    }

    // Generate fresh status
    const status = getIntegrationStatus();
    
    // Update cache
    statusCache = {
      timestamp: now,
      data: status
    };

    log.debug('IntegrationsStatus', 'Returning fresh status', {
      vapi: status.integrations.vapi,
      openai: status.integrations.openai,
      twilio: status.integrations.twilio
    });

    res.status(200).json(status);
  } catch (error: any) {
    log.error('IntegrationsStatus', 'Failed to get status', {
      error: error?.message
    });
    
    res.status(500).json({
      error: 'Failed to retrieve integration status',
      integrations: {
        vapi: false,
        openai: false,
        twilio: false,
        supabase: false,
        stripe: false,
        googleCloud: false,
        anthropic: false,
        pinecone: false
      }
    });
  }
});

/**
 * GET /api/integrations/status/:integration
 * 
 * Check status of a specific integration
 * Example: GET /api/integrations/status/vapi → { configured: true }
 */
router.get('/status/:integration', (req: Request, res: Response) => {
  try {
    const { integration } = req.params;
    const status = getIntegrationStatus();
    
    const integrationStatus = status.integrations[integration as keyof typeof status.integrations];
    
    if (integrationStatus === undefined) {
      return res.status(404).json({
        error: `Unknown integration: ${integration}`,
        available: Object.keys(status.integrations)
      });
    }

    log.debug('IntegrationsStatus', 'Checking specific integration', {
      integration,
      configured: integrationStatus
    });

    res.status(200).json({
      integration,
      configured: integrationStatus,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('IntegrationsStatus', 'Failed to get specific status', {
      integration: req.params.integration,
      error: error?.message
    });
    
    res.status(500).json({
      error: 'Failed to check integration status'
    });
  }
});

/**
 * POST /api/integrations/status/clear-cache
 * 
 * Clear the integration status cache (admin only, for testing)
 * This can be called after updating environment variables to force refresh
 */
router.post('/status/clear-cache', (req: Request, res: Response) => {
  try {
    // In production, you would check auth here
    // For now, we'll allow it for development/testing
    
    statusCache = null;
    
    log.info('IntegrationsStatus', 'Cache cleared');
    res.json({ 
      message: 'Integration status cache cleared',
      status: 'ok'
    });
  } catch (error: any) {
    log.error('IntegrationsStatus', 'Failed to clear cache', {
      error: error?.message
    });
    
    res.status(500).json({
      error: 'Failed to clear cache'
    });
  }
});

export default router;
