/**
 * Google Calendar OAuth Routes
 * Handles OAuth 2.0 authorization flow for Google Calendar integration
 */

import express, { Request, Response } from 'express';
import {
  getOAuthUrl,
  exchangeCodeForTokens,
  revokeAccess
} from '../services/google-oauth-service';
import { requireAuthOrDev } from '../middleware/auth';
import { log } from '../services/logger';
import { supabase } from '../services/supabase-client';

const router = express.Router();

/**
 * GET /api/google-oauth/test
 * Simple test route to verify router is registered
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Google OAuth router is working!', timestamp: new Date().toISOString() });
});

/**
 * TESTING ONLY: POST /api/google-oauth/test-callback
 * Simulates a successful OAuth callback for testing purposes
 * This allows testing the calendar status display without waiting for Google's redirect
 */
router.post('/test-callback', async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    res.status(403).json({ error: 'This endpoint is only available in development' });
    return;
  }

  try {
    const { orgId, email } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    // Insert dummy credentials to simulate successful OAuth
    const { error } = await supabase
      .from('org_credentials')
      .upsert({
        org_id: orgId,
        provider: 'google_calendar',
        encrypted_config: 'test_encrypted_credentials',
        is_active: true,
        metadata: email ? { email } : undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'org_id,provider'
      });

    if (error) {
      // Check if it's a table not found error
      if (error.code === 'PGRST116' || error.message?.includes('Could not find the table')) {
        log.error('GoogleOAuth', 'org_credentials table not found', { error, code: error?.code });
        res.status(503).json({
          error: 'Database not initialized',
          message: 'The org_credentials table does not exist. Please contact support to initialize the database schema.'
        });
        return;
      }

      log.error('GoogleOAuth', 'Failed to insert test credentials', { error, code: error?.code });
      res.status(500).json({ error: 'Failed to simulate OAuth callback', details: error?.message });
      return;
    }

    log.info('GoogleOAuth', 'Test callback simulated successfully', { orgId, email });
    res.json({ success: true, message: 'Test OAuth callback simulated', connected: true, email });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Test callback error', { error: error?.message, code: error?.code });
    res.status(500).json({ error: 'Test callback failed', message: error?.message });
  }
});

/**
 * GET /api/google-oauth/authorize
 *
 * Initiates OAuth flow by redirecting user to Google consent screen
 * CRITICAL: This is the unified OAuth endpoint - consolidates all calendar OAuth flows
 *
 * Query parameters:
 * - orgId (optional): Organization ID. If not provided, uses authenticated user's orgId
 * - org_id (optional): Alternative parameter name for org ID (from calendar-oauth.ts compatibility)
 *
 * Response: JSON with authUrl (for API calls) OR redirects to Google OAuth (for browser)
 */
router.get('/authorize', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from query parameter (support both orgId and org_id)
    let orgId = (req.query.orgId || req.query.org_id) as string;

    // If not provided in query, try to get from authenticated user
    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }

    // If still no orgId, use default for dev mode
    if (!orgId) {
      if (process.env.NODE_ENV === 'development') {
        orgId = 'a0000000-0000-0000-0000-000000000001';
        log.warn('GoogleOAuth', 'No orgId provided, using default for dev mode', { orgId });
      } else {
        res.status(400).json({
          error: 'orgId is required. Provide it as query parameter or ensure user is authenticated.'
        });
        return;
      }
    }

    // Generate OAuth URL
    const authUrl = await getOAuthUrl(orgId);

    const acceptsJSON = req.accepts('json') || req.headers.accept?.includes('application/json');
    log.info('GoogleOAuth', 'Authorize endpoint called', { orgId, acceptsJSON, acceptHeader: req.headers.accept });

    // UNIFIED BEHAVIOR: Check if caller wants JSON or redirect
    // Frontend API routes want JSON (Accept: application/json), direct browser navigation wants redirect
    if (acceptsJSON) {
      // Return JSON for API callers (Next.js route handlers)
      log.info('GoogleOAuth', 'Returning JSON response');
      res.json({
        success: true,
        url: authUrl,
        authUrl: authUrl // Also include as authUrl for compatibility
      });
    } else {
      // Redirect for direct browser navigation
      log.info('GoogleOAuth', 'Redirecting to Google OAuth');
      res.redirect(authUrl);
    }
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to generate OAuth URL', {
      error: error?.message,
      stack: error?.stack
    });

    // Frontend URL for error redirects
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorParam = encodeURIComponent('oauth_generation_failed');

    // Return JSON or redirect based on request type
    if (req.accepts('json')) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate OAuth URL',
        message: error?.message
      });
    } else {
      res.redirect(`${frontendUrl}/dashboard/api-keys?error=${errorParam}`);
    }
  }
});

/**
 * GET /api/google-oauth/callback
 * 
 * Handles OAuth callback from Google
 * Exchanges authorization code for tokens and stores them
 * 
 * Query parameters:
 * - code: Authorization code from Google
 * - state: State parameter containing orgId (for CSRF protection)
 * - error: Error from Google (if user denied consent)
 * 
 * Response: Redirects to frontend settings page with success/error status
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, state, error } = req.query;

    // Get frontend URL for redirects
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // DEBUG: Log all query parameters and full URL for diagnosis
    log.info('GoogleOAuth', 'Callback received', {
      hasCode: !!code,
      hasState: !!state,
      hasError: !!error,
      codeLength: code ? String(code).length : 0,
      stateLength: state ? String(state).length : 0,
      queryKeys: Object.keys(req.query),
      fullUrl: req.url,
      referer: req.headers.referer
    });

    // Handle user denial or errors from Google
    if (error) {
      log.warn('GoogleOAuth', 'OAuth error from Google', {
        error,
        errorDescription: req.query.error_description
      });
      
      const errorParam = encodeURIComponent(error === 'access_denied' ? 'user_denied_consent' : 'oauth_failed');
      res.redirect(`${frontendUrl}/dashboard/api-keys?error=${errorParam}`);
      return;
    }

    // Validate required parameters
    if (!code || !state) {
      log.error('GoogleOAuth', 'Missing required OAuth parameters', {
        hasCode: !!code,
        hasState: !!state,
        queryParams: req.query,
        fullUrl: req.url,
        headers: {
          referer: req.headers.referer,
          host: req.headers.host,
          'user-agent': req.headers['user-agent']
        }
      });
      
      // Also log to console for immediate visibility
      console.error('[OAuth Callback Debug]', {
        url: req.url,
        query: req.query,
        hasCode: !!code,
        hasState: !!state,
        allQueryKeys: Object.keys(req.query)
      });
      
      const errorParam = encodeURIComponent('missing_oauth_parameters');
      res.redirect(`${frontendUrl}/dashboard/api-keys?error=${errorParam}&debug=missing_code_or_state`);
      return;
    }

    // Exchange code for tokens and store
    try {
      const result = await exchangeCodeForTokens(code as string, state as string);
      
      log.info('GoogleOAuth', 'OAuth callback successful', {
        orgId: result.orgId
      });

      // Redirect to frontend with success
      const successParam = encodeURIComponent('calendar_connected');
      res.redirect(`${frontendUrl}/dashboard/api-keys?success=${successParam}`);
    } catch (exchangeError: any) {
      log.error('GoogleOAuth', 'Failed to exchange code for tokens', {
        error: exchangeError?.message,
        errorCode: exchangeError?.code,
        errorResponse: exchangeError?.response?.data,
        stack: exchangeError?.stack
      });

      // Determine error type with more specific error messages
      let errorParam = 'oauth_callback_failed';
      let errorDetails = exchangeError?.message || 'Unknown error';
      
      if (exchangeError?.message?.includes('state')) {
        errorParam = 'oauth_state_invalid';
      } else if (exchangeError?.message?.includes('redirect_uri_mismatch')) {
        errorParam = 'oauth_token_exchange_failed';
        errorDetails = 'Redirect URI mismatch - check Google Cloud Console';
      } else if (exchangeError?.message?.includes('invalid_grant')) {
        errorParam = 'oauth_token_exchange_failed';
        errorDetails = 'Authorization code expired or already used';
      } else if (exchangeError?.message?.includes('token') || exchangeError?.message?.includes('Token exchange')) {
        errorParam = 'oauth_token_exchange_failed';
      }

      // Log full error details for debugging
      console.error('[OAuth Token Exchange Error]', {
        errorMessage: exchangeError?.message,
        errorCode: exchangeError?.code,
        errorResponse: exchangeError?.response?.data,
        fullError: exchangeError
      });

      res.redirect(`${frontendUrl}/dashboard/api-keys?error=${errorParam}&details=${encodeURIComponent(errorDetails)}`);
    }
  } catch (error: any) {
    log.error('GoogleOAuth', 'OAuth callback handler error', {
      error: error?.message,
      stack: error?.stack
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorParam = encodeURIComponent('oauth_callback_error');
    res.redirect(`${frontendUrl}/dashboard/api-keys?error=${errorParam}`);
  }
});

/**
 * POST /api/google-oauth/revoke
 * 
 * Revokes Google Calendar access for an organization
 * Deletes stored tokens from database
 * 
 * Body:
 * - orgId (optional): Organization ID. If not provided, uses authenticated user's orgId
 * 
 * Response: JSON with success status
 */
router.post('/revoke', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from body or authenticated user context
    let orgId = req.body.orgId as string;

    // If not provided in body, try to get from authenticated user
    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }

    // If still no orgId, use default for dev mode
    if (!orgId) {
      if (process.env.NODE_ENV === 'development') {
        orgId = 'a0000000-0000-0000-0000-000000000001';
        log.warn('GoogleOAuth', 'No orgId provided for revoke, using default for dev mode', { orgId });
      } else {
        res.status(400).json({
          error: 'orgId is required. Provide it in request body or ensure user is authenticated.'
        });
        return;
      }
    }

    // Revoke access (delete tokens)
    await revokeAccess(orgId);

    log.info('GoogleOAuth', 'Access revoked successfully', { orgId });

    res.json({
      success: true,
      message: 'Google Calendar access revoked successfully'
    });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to revoke access', {
      error: error?.message,
      stack: error?.stack
    });

    res.status(500).json({
      error: 'Failed to revoke access',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/google-oauth/status
 * 
 * Check if Google Calendar is connected for an organization
 * 
 * Query parameters:
 * - orgId (optional): Organization ID. If not provided, uses authenticated user's orgId
 * 
 * Response: JSON with connection status
 */
router.get('/status', requireAuthOrDev, async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from query or authenticated user context
    let orgId = req.query.orgId as string;

    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }

    if (!orgId) {
      if (process.env.NODE_ENV === 'development') {
        orgId = 'a0000000-0000-0000-0000-000000000001';
      } else {
        res.status(400).json({
          error: 'orgId is required'
        });
        return;
      }
    }

    // Check if credentials exist in org_credentials table
    const { data: credentials, error } = await supabase
      .from('org_credentials')
      .select('provider, created_at, updated_at, metadata')
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar')
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      // Handle table not found error
      if (error.code === 'PGRST116' || error.message?.includes('Could not find the table')) {
        log.warn('GoogleOAuth', 'org_credentials table not found', { error: error?.message });
        res.json({
          connected: false,
          message: 'Google Calendar credentials table not yet configured - please contact support'
        });
        return;
      }

      // Other errors
      throw error;
    }

    if (!credentials) {
      res.json({
        connected: false,
        message: 'Google Calendar not connected'
      });
      return;
    }

    // Try to get the email from metadata or user profile
    let email = credentials.metadata?.email || null;

    if (!email) {
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', orgId)
        .maybeSingle();

      email = userProfile?.email;
    }

    res.json({
      connected: true,
      active: true,
      email: email,
      connectedAt: credentials.updated_at,
      hasTokens: true
    });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to check connection status', {
      error: error?.message,
      code: error?.code
    });

    // If it's a table not found error, provide helpful message
    if (error?.message?.includes('Could not find the table')) {
      return res.json({
        connected: false,
        message: 'Credentials storage not yet initialized'
      });
    }

    res.status(500).json({
      error: 'Failed to check connection status',
      message: error?.message || 'Unknown error'
    });
  }
});

export default router;
