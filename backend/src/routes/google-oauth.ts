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
 * GET /api/google-oauth/authorize
 * 
 * Initiates OAuth flow by redirecting user to Google consent screen
 * 
 * Query parameters:
 * - orgId (optional): Organization ID. If not provided, uses authenticated user's orgId
 * 
 * Response: Redirects to Google OAuth consent screen
 */
/**
 * GET /api/google-oauth/authorize
 * Public endpoint - initiates OAuth flow
 * orgId can be passed as query parameter
 */
router.get('/authorize', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from query parameter or authenticated user context
    let orgId = req.query.orgId as string;

    // If not provided in query, try to get from authenticated user
    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }

    // If still no orgId, use default for dev mode
    if (!orgId) {
      if (process.env.NODE_ENV === 'development') {
        orgId = req.query.orgId as string || 'a0000000-0000-0000-0000-000000000001';
        log.warn('GoogleOAuth', 'No orgId provided, using default for dev mode', { orgId });
      } else {
        res.status(400).json({
          error: 'orgId is required. Provide it as query parameter or ensure user is authenticated.'
        });
        return;
      }
    }

    // Generate OAuth URL and redirect
    const authUrl = await getOAuthUrl(orgId);
    
    log.info('GoogleOAuth', 'Redirecting to Google OAuth', { orgId });
    res.redirect(authUrl);
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to generate OAuth URL', {
      error: error?.message,
      stack: error?.stack
    });

    // Redirect to frontend with error
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorParam = encodeURIComponent('oauth_generation_failed');
    res.redirect(`${frontendUrl}/dashboard/settings?error=${errorParam}`);
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
      res.redirect(`${frontendUrl}/dashboard/settings?error=${errorParam}`);
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
      res.redirect(`${frontendUrl}/dashboard/settings?error=${errorParam}&debug=missing_code_or_state`);
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
      res.redirect(`${frontendUrl}/dashboard/settings?success=${successParam}`);
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

      res.redirect(`${frontendUrl}/dashboard/settings?error=${errorParam}&details=${encodeURIComponent(errorDetails)}`);
    }
  } catch (error: any) {
    log.error('GoogleOAuth', 'OAuth callback handler error', {
      error: error?.message,
      stack: error?.stack
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorParam = encodeURIComponent('oauth_callback_error');
    res.redirect(`${frontendUrl}/dashboard/settings?error=${errorParam}`);
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

    // Check if integration exists
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('config, connected, updated_at')
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar')
      .maybeSingle();

    if (error || !integration) {
      res.json({
        connected: false,
        message: 'Google Calendar not connected'
      });
      return;
    }

    res.json({
      connected: true,
      active: integration.connected,
      connectedAt: integration.updated_at,
      hasTokens: !!(integration.config as any)?.refresh_token
    });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to check connection status', {
      error: error?.message
    });

    res.status(500).json({
      error: 'Failed to check connection status',
      message: error?.message || 'Unknown error'
    });
  }
});

export default router;
