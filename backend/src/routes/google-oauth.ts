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
import { EncryptionService } from '../services/encryption';

const isValidUUID = (uuid: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
};

const router = express.Router();

/**
 * GET /api/google-oauth/test
 * Simple test route to verify router is registered
 */
router.get('/test', (req: Request, res: Response) => {
  res.json({ message: 'Google OAuth router is working!', timestamp: new Date().toISOString() });
});

/**
 * POST /api/google-oauth/test-store-credentials
 * Test endpoint to verify credentials can be stored in database
 * Body: { orgId: string, email?: string }
 */
router.post('/test-store-credentials', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orgId, email } = req.body;

    if (!orgId) {
      res.status(400).json({ error: 'orgId is required' });
      return;
    }

    log.info('GoogleOAuth', 'Test: Attempting to store credentials', { orgId, email });

    // Test credentials to store
    const testCredentials = {
      accessToken: 'test_access_token_12345',
      refreshToken: 'test_refresh_token_67890',
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      email: email || 'test@gmail.com'
    };

    // Call storeCredentials directly
    const { IntegrationDecryptor } = await import('../services/integration-decryptor');
    await IntegrationDecryptor.storeCredentials(
      orgId,
      'google_calendar',
      testCredentials
    );

    log.info('GoogleOAuth', 'Test: Credentials stored successfully', { orgId });

    res.json({
      success: true,
      message: 'Test credentials stored successfully',
      orgId,
      email: testCredentials.email,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Test: Failed to store credentials', {
      error: error?.message,
      stack: error?.stack
    });

    res.status(500).json({
      success: false,
      error: 'Failed to store test credentials',
      message: error?.message,
      timestamp: new Date().toISOString()
    });
  }
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
      return res.status(500).json({ error: 'Failed to simulate OAuth callback' });
      return;
    }

    log.info('GoogleOAuth', 'Test callback simulated successfully', { orgId, email });
    res.json({ success: true, message: 'Test OAuth callback simulated', connected: true, email });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Test callback error', { error: error?.message, code: error?.code });
    return res.status(500).json({ error: 'Test callback failed' });
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
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!frontendUrl) {
      log.error('GoogleOAuth', 'FRONTEND_URL not set, cannot redirect user');
      return res.status(500).json({
        error: 'Frontend URL configuration missing. Contact administrator.'
      });
    }

    // Warn in production if using localhost
    if (frontendUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      log.error('GoogleOAuth', 'Frontend URL pointing to localhost in production!');
    }

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
  console.log('[DEBUG] OAuth Callback Triggered');
  console.log('Full URL:', req.url);
  console.log('Query Params:', req.query);
  console.log('Headers:', req.headers);

  try {
    const { code, state, error } = req.query;
    console.log('[DEBUG] Code:', code?.toString().slice(0, 10) + '...');
    console.log('[DEBUG] State:', state);

    // Get frontend URL for redirects
    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!frontendUrl) {
      log.error('GoogleOAuth', 'FRONTEND_URL not set, cannot redirect user');
      return res.status(500).json({
        error: 'Frontend URL configuration missing. Contact administrator.'
      });
    }

    // Warn in production if using localhost
    if (frontendUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      log.error('GoogleOAuth', 'Frontend URL pointing to localhost in production!');
    }

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
      log.debug('GoogleOAuth', 'Calling exchangeCodeForTokens', {
        codeLength: code?.toString().length,
        stateLength: state?.toString().length
      });

      const result = await exchangeCodeForTokens(code as string, state as string);

      log.info('GoogleOAuth', 'OAuth callback successful', {
        orgId: result.orgId,
        email: result.email,
        timestamp: new Date().toISOString(),
        success: result.success
      });

      // Redirect to frontend with success (optionally include email if available)
      const successParam = encodeURIComponent('calendar_connected');
      let redirectUrl = `${frontendUrl}/dashboard/api-keys?success=${successParam}`;
      if (result.email) {
        redirectUrl += `&email=${encodeURIComponent(result.email)}`;
      }
      res.redirect(redirectUrl);
    } catch (exchangeError: any) {
      log.error('GoogleOAuth', 'Failed to exchange code for tokens', {
        error: exchangeError?.message,
        errorCode: exchangeError?.code,
        errorResponse: exchangeError?.response?.data,
        stack: exchangeError?.stack,
        timestamp: new Date().toISOString()
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
    console.error('[DEBUG] Callback error:', error);
    log.error('GoogleOAuth', 'OAuth callback handler error', {
      error: error?.message,
      stack: error?.stack
    });

    const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL;

    if (!frontendUrl) {
      log.error('GoogleOAuth', 'FRONTEND_URL not set, cannot redirect user');
      return res.status(500).json({
        error: 'Frontend URL configuration missing. Contact administrator.'
      });
    }

    // Warn in production if using localhost
    if (frontendUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
      log.error('GoogleOAuth', 'Frontend URL pointing to localhost in production!');
    }

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
    const userId = req.user?.id || 'unknown';
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    await revokeAccess(orgId, userId, ipAddress);

    log.info('GoogleOAuth', 'Access revoked successfully', { orgId, userId });

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
 * GET /api/google-oauth/status/:orgId
 * 
 * Check if Google Calendar is connected for an organization
 * 
 * URL parameters:
 * - orgId (required): Organization ID to check
 * 
 * Response: JSON with connection status
 */
router.get('/status/:orgId?', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from path, query, or authenticated user (in order of precedence)
    let orgId = req.params.orgId || req.query.orgId as string;

    if (!orgId && req.user?.orgId) {
      orgId = req.user.orgId;
    }

    // Handle "unknown" as missing orgId (frontend fallback value)
    if (orgId === 'unknown') {
      orgId = '';
    }

    // If still no orgId, use default for dev mode
    if (!orgId && process.env.NODE_ENV === 'development') {
      orgId = 'a0000000-0000-0000-0000-000000000001';
      log.warn('GoogleOAuth', 'Using default dev org_id - user session missing org_id', {
        message: 'User needs to log out and back in, or update auth.users.raw_app_meta_data'
      });
    }

    // Validate orgId format (applies to all sources)
    if (!orgId || (orgId !== 'test' && !isValidUUID(orgId))) {
      return res.status(400).json({
        error: 'Invalid organization ID',
        message: 'Please provide a valid organization ID in UUID format. Your user session may be missing org_id - try logging out and back in.'
      });
    }

    log.debug('GoogleOAuth', 'Status endpoint called', {
      orgId,
      path: req.path,
      method: req.method
    });

    // Check if credentials exist in org_credentials table
    // Add retry logic for schema cache issues with exponential backoff
    // Include encrypted_config for fallback email extraction if metadata is missing
    let credentials: any = null;
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      const { data, error } = await supabase
        .from('org_credentials')
        .select('provider, created_at, updated_at, metadata, is_active, encrypted_config, connected_calendar_email')
        .eq('org_id', orgId)
        .eq('provider', 'google_calendar')
        .eq('is_active', true)
        .maybeSingle();

      if (!error) {
        credentials = data;
        break;
      }

      lastError = error;

      // Handle schema cache errors with exponential backoff
      if (error.code === 'PGRST116' || error.code === 'PGRST205' || error.message?.includes('Could not find')) {
        if (attempt < 3) {
          const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s
          log.debug('GoogleOAuth', `Schema cache retry ${attempt}/3`, { orgId, delayMs });
          await new Promise(resolve => setTimeout(resolve, delayMs));
          continue;
        }
      }

      // Non-retryable error
      break;
    }

    // Check if we got data after retries
    if (lastError && !credentials) {
      if (lastError.code === 'PGRST116' || lastError.code === 'PGRST205') {
        log.warn('GoogleOAuth', 'Schema cache issue after retries', {
          orgId,
          error: lastError?.message,
          code: lastError?.code
        });

        res.json({
          connected: false,
          message: 'Checking calendar status... Please refresh in a moment',
          isSchemaRefreshing: true,
          timestamp: new Date().toISOString()
        });
        return;
      }

      throw lastError;
    }

    if (!credentials) {
      log.debug('GoogleOAuth', 'No credentials found', {
        orgId,
        timestamp: new Date().toISOString()
      });

      res.json({
        connected: false,
        message: 'Google Calendar not connected',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Get email priority: 1. DB Column 2. Metadata 3. Decrypted Config
    let email = credentials.connected_calendar_email || credentials.metadata?.email || null;

    // Fallback: Try to decrypt email from encrypted_config if not in metadata or column
    if (!email && credentials.encrypted_config) {
      try {
        const decrypted = EncryptionService.decryptObject(credentials.encrypted_config);
        email = decrypted.email || null;
        if (email) {
          // Self-healing: Backfill the email to the column for next time
          log.debug('GoogleOAuth', 'Email recovered from encrypted config - triggering backfill', { orgId });
          // Fire and forget update to save optimized lookup for next time
          supabase.from('org_credentials')
            .update({ connected_calendar_email: email })
            .eq('org_id', orgId)
            .eq('provider', 'google_calendar')
            .then(({ error }) => {
              if (error) log.warn('GoogleOAuth', 'Background email backfill failed', { error: error.message });
            });
        }
      } catch (decryptError) {
        log.debug('GoogleOAuth', 'Could not decrypt email from config', {
          orgId,
          error: (decryptError as any)?.message
        });
      }
    }

    log.info('GoogleOAuth', 'Status check successful', {
      orgId,
      connected: true,
      email: email || 'no email found',
      source: credentials.connected_calendar_email ? 'column' : (credentials.metadata?.email ? 'metadata' : 'encrypted'),
      timestamp: new Date().toISOString()
    });

    res.json({
      connected: true,
      active: credentials.is_active === true,
      email: email,
      connectedAt: credentials.updated_at,
      hasTokens: true,
      timestamp: new Date().toISOString()
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

/**
 * GET /api/google-oauth/test-orgid
 *
 * Test endpoint for orgId debugging
 *
 * Response: JSON with received orgId, query parameters, authenticated user, and headers
 */
router.get('/test-orgid/:orgId?', requireAuthOrDev, (req: Request, res: Response) => {
  const response = {
    pathOrgId: req.params.orgId,
    queryOrgId: req.query.orgId,
    authenticatedUser: req.user?.orgId ? { orgId: req.user.orgId } : null,
    headers: {
      authorization: req.headers.authorization
    },
    timestamp: new Date().toISOString()
  };

  log.debug('GoogleOAuth TestEndpoint', 'Test orgId endpoint called', response);
  res.json(response);
});

/**
 * GET /api/google-oauth/debug
 *
 * Comprehensive diagnostic endpoint
 * Shows current user's org_id from JWT and checks database state
 *
 * DEVELOPMENT: This endpoint works without auth for easier debugging
 * Pass ?orgId=<uuid> in query to check a specific org
 *
 * Response: Detailed diagnostic information for troubleshooting
 */
router.get('/debug', async (req: Request, res: Response): Promise<void> => {
  try {
    // Get orgId from either authenticated user or query parameter
    let userOrgId = req.user?.orgId;

    // Allow overriding with query parameter for testing
    if (req.query.orgId) {
      userOrgId = req.query.orgId as string;
      log.debug('GoogleOAuth Debug', 'Using org_id from query parameter', { orgId: userOrgId });
    }

    if (!userOrgId) {
      res.status(400).json({
        error: 'No org_id provided',
        hint: 'Either authenticate with org_id in JWT, or pass ?orgId=<uuid> as query parameter',
        authenticated: !!req.user,
        jwtOrgId: req.user?.orgId || null,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Check database for credentials
    const { data: credentials, error: credError } = await supabase
      .from('org_credentials')
      .select('provider, is_active, metadata, created_at, updated_at')
      .eq('org_id', userOrgId)
      .eq('provider', 'google_calendar');

    // Check profile for org_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, org_id')
      .eq('id', req.user?.id || '');

    const response = {
      jwt: {
        org_id: userOrgId,
        user_id: req.user?.id
      },
      database: {
        profile: profile?.[0] || null,
        profileError: profileError?.message || null,
        googleCalendarCredentials: credentials || [],
        credentialsError: credError?.message || null,
        credentialsCount: credentials?.length || 0
      },
      diagnostics: {
        hasOrgIdInJwt: !!userOrgId,
        hasGoogleCalendarConnected: (credentials?.length || 0) > 0 && credentials?.[0]?.is_active,
        timestamp: new Date().toISOString()
      }
    };

    log.info('GoogleOAuth Debug', 'Diagnostic check performed', {
      orgId: userOrgId,
      hasCredentials: (credentials?.length || 0) > 0
    });

    res.json(response);
  } catch (error: any) {
    log.error('GoogleOAuth Debug', 'Diagnostic check failed', {
      error: error?.message,
      stack: error?.stack
    });

    res.status(500).json({
      error: 'Failed to run diagnostic check',
      message: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/google-oauth/test-flow
 * 
 * Test endpoint for OAuth flow
 * 
 * Response: HTML with link to start OAuth flow
 */
router.get('/test-flow', async (req: Request, res: Response) => {
  try {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    const authUrl = await getOAuthUrl(orgId);

    res.send(`
      <html>
        <body>
          <h1>Google OAuth Test</h1>
          <a href="${authUrl}">Connect Google Calendar</a>
          <div id="status"></div>
          <script>
            document.querySelector('a').addEventListener('click', (e) => {
              document.getElementById('status').innerText = 'Redirecting to Google...';
            });
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

/**
 * GET /api/google-oauth/test-page
 * 
 * Direct test endpoint
 * 
 * Response: HTML with link to start OAuth flow
 */
router.get('/test-page', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google OAuth Test</title>
    </head>
    <body>
      <h1>Google Calendar OAuth Test</h1>
      <a href="/api/google-oauth/authorize?orgId=550e8400-e29b-41d4-a716-446655440000">
        Connect Google Calendar
      </a>
    </body>
    </html>
  `);
});

router.get('/test-page', (req: Request, res: Response) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Google OAuth Test</title>
    </head>
    <body>
      <h1>Google Calendar OAuth Test</h1>
      <a href="/api/google-oauth/authorize?orgId=550e8400-e29b-41d4-a716-446655440000">
        Connect Google Calendar
      </a>
    </body>
    </html>
  `);
});

/**
 * GET /api/google-oauth/test-success
 * 
 * Test endpoint for successful OAuth callback
 * 
 * Response: JSON with success status
 */
router.get('/test-success', async (req: Request, res: Response) => {
  try {
    // Simulate successful OAuth callback
    const orgId = '550e8400-e29b-41d4-a716-446655440000';
    const credentials = {
      accessToken: 'test_access_token',
      refreshToken: 'test_refresh_token',
      expiresAt: new Date(Date.now() + 3600000).toISOString()
    };

    await IntegrationDecryptor.storeCredentials(orgId, 'google_calendar', credentials);
    res.json({ success: true });
  } catch (error) {
    console.error('[DEBUG] Test error:', error);
    return res.status(500).json({ error: 'Operation failed' });
  }
});

export default router;
