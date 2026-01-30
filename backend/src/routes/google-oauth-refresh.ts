#!/usr/bin/env node
/**
 * Google Calendar OAuth Token Refresh Routes
 *
 * Provides manual and automatic token refresh capabilities.
 * Handles token expiration gracefully without blocking calendar operations.
 *
 * Endpoints:
 * - POST /api/google-oauth/refresh-token - Manual refresh
 * - GET /api/google-oauth/token-status/:orgId - Check token status
 *
 * Usage (CLI):
 * curl -X POST http://localhost:3001/api/google-oauth/refresh-token \
 *   -H "Content-Type: application/json" \
 *   -d '{"orgId": "...", "forceRefresh": true}'
 */

import { Request, Response, Router } from 'express';
import { IntegrationDecryptor } from '../services/integration-decryptor';
import { EncryptionService } from '../services/encryption';
import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { log } from '../services/logger';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * Get OAuth2 client configured with Google credentials
 */
function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID || '',
    process.env.GOOGLE_CLIENT_SECRET || '',
    process.env.GOOGLE_REDIRECT_URI || ''
  );
}

/**
 * POST /api/google-oauth/refresh-token
 *
 * Manually trigger a token refresh for an organization
 *
 * Request body:
 * {
 *   "orgId": "uuid-string",
 *   "forceRefresh": true  // optional: bypass expiry check
 * }
 *
 * Response (success):
 * {
 *   "success": true,
 *   "message": "Token refreshed successfully",
 *   "expiresAt": "2026-01-28T16:15:30Z",
 *   "expiresInSeconds": 3600
 * }
 *
 * Response (needs re-auth):
 * {
 *   "success": false,
 *   "reason": "refresh_token_invalid",
 *   "message": "Refresh token expired or revoked",
 *   "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
 *   "next_step": "User must visit authUrl to re-authenticate"
 * }
 */
router.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const { orgId, forceRefresh } = req.body;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        error: 'orgId is required'
      });
    }

    log.info('GoogleOAuthRefresh', 'Token refresh requested', { orgId, forceRefresh });

    // Step 1: Fetch current credentials
    let currentCreds: any;
    try {
      currentCreds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
    } catch (error: any) {
      log.warn('GoogleOAuthRefresh', 'Failed to fetch credentials', {
        orgId,
        error: error?.message
      });

      return res.status(400).json({
        success: false,
        reason: 'no_credentials',
        message: 'Google Calendar not connected for this organization',
        next_step: 'Connect Google Calendar in dashboard settings'
      });
    }

    // Step 2: Check if token needs refresh (unless forceRefresh)
    if (!forceRefresh) {
      const expiresAt = new Date(currentCreds.expiresAt);
      const isExpired = expiresAt < new Date();
      const expiresInSeconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

      if (!isExpired && expiresInSeconds > 300) {
        // Token is still valid and not expiring soon
        return res.status(200).json({
          success: true,
          message: 'Token is still valid',
          expiresAt: currentCreds.expiresAt,
          expiresInSeconds,
          refreshNotNeeded: true
        });
      }
    }

    // Step 3: Attempt to refresh token
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: currentCreds.refreshToken
    });

    let refreshedCreds: any;
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      refreshedCreds = credentials;

      log.info('GoogleOAuthRefresh', 'Token refreshed via Google API', {
        orgId,
        hasAccessToken: !!credentials.access_token,
        expiryDate: credentials.expiry_date
      });
    } catch (refreshError: any) {
      log.error('GoogleOAuthRefresh', 'Token refresh failed', {
        orgId,
        error: refreshError?.message,
        code: refreshError?.code
      });

      // Check if it's a refresh_token_invalid error (401 or 400 invalid_grant)
      const isRefreshTokenInvalid =
        refreshError?.code === 401 ||
        (refreshError?.message && refreshError.message.includes('invalid_grant')) ||
        (refreshError?.message && refreshError.message.includes('Refresh token revoked'));

      if (isRefreshTokenInvalid) {
        // Refresh token is dead, user needs to re-authenticate
        const authUrl = oauth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: [
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ]
        });

        return res.status(401).json({
          success: false,
          reason: 'refresh_token_invalid',
          message: 'Refresh token expired or revoked',
          authUrl,
          next_step: 'User must visit the auth URL to re-authenticate Google Calendar'
        });
      }

      // Other error (network, API issue, etc.)
      return res.status(500).json({
        success: false,
        reason: 'refresh_failed',
        message: `Token refresh failed: ${refreshError?.message}`,
        next_step: 'Check network connection and try again. If persistent, reconnect Google Calendar.'
      });
    }

    // Step 4: Store refreshed credentials
    const newAccessToken = refreshedCreds.access_token;
    const newRefreshToken = refreshedCreds.refresh_token || currentCreds.refreshToken;
    const newExpiresAt = new Date(refreshedCreds.expiry_date || Date.now() + 3600000).toISOString();

    try {
      // Method 1: Via IntegrationDecryptor (application layer)
      await IntegrationDecryptor.storeCredentials(orgId, 'google_calendar', {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        email: currentCreds.email
      });

      // Method 2: Backup - Direct database update for safety
      const encryptedConfig = EncryptionService.encryptObject({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
        email: currentCreds.email
      });

      await supabase
        .from('org_credentials')
        .update({
          encrypted_config: encryptedConfig,
          updated_at: new Date().toISOString()
        })
        .eq('org_id', orgId)
        .eq('provider', 'google_calendar');

      log.info('GoogleOAuthRefresh', 'Token stored successfully', {
        orgId,
        expiresAt: newExpiresAt
      });
    } catch (storageError: any) {
      log.error('GoogleOAuthRefresh', 'Failed to store refreshed token', {
        orgId,
        error: storageError?.message
      });

      return res.status(500).json({
        success: false,
        reason: 'storage_failed',
        message: 'Token was refreshed but failed to store',
        next_step: 'This is a server error. Please contact support.'
      });
    }

    // Step 5: Return success response
    const expiresInSeconds = Math.floor((new Date(newExpiresAt).getTime() - Date.now()) / 1000);

    return res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      expiresAt: newExpiresAt,
      expiresInSeconds,
      expiresInMinutes: Math.floor(expiresInSeconds / 60),
      nextRefreshAt: new Date(Date.now() + (expiresInSeconds - 300) * 1000).toISOString()
    });
  } catch (error: any) {
    log.error('GoogleOAuthRefresh', 'Unexpected error', {
      error: error?.message,
      stack: error?.stack
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error?.message
    });
  }
});

/**
 * GET /api/google-oauth/token-status/:orgId
 *
 * Check the current token status for an organization
 *
 * Response (valid token):
 * {
 *   "orgId": "uuid",
 *   "hasTokens": true,
 *   "accessTokenExists": true,
 *   "refreshTokenExists": true,
 *   "email": "user@gmail.com",
 *   "expiresAt": "2026-01-28T16:15:30Z",
 *   "expiresInSeconds": 3600,
 *   "isExpired": false,
 *   "isExpiringSoon": false,
 *   "lastUpdated": "2026-01-28T15:00:00Z",
 *   "status": "healthy"
 * }
 *
 * Response (expired token):
 * {
 *   "orgId": "uuid",
 *   "hasTokens": true,
 *   "status": "expired",
 *   "isExpired": true,
 *   "expiresAt": "2026-01-25T10:00:00Z",
 *   "message": "Token expired 3 days ago. Please refresh or reconnect."
 * }
 */
router.get('/token-status/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // Fetch credentials from database
    const { data: cred, error } = await supabase
      .from('org_credentials')
      .select('encrypted_config, updated_at, is_active')
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar')
      .single();

    if (error || !cred) {
      return res.status(404).json({
        orgId,
        hasTokens: false,
        status: 'not_connected',
        message: 'No Google Calendar credentials found for this organization'
      });
    }

    if (!cred.is_active) {
      return res.status(200).json({
        orgId,
        hasTokens: false,
        status: 'disabled',
        message: 'Google Calendar integration is disabled'
      });
    }

    // Try to decrypt credentials
    let decrypted: any;
    try {
      decrypted = EncryptionService.decryptObject(cred.encrypted_config);
    } catch (decryptError: any) {
      return res.status(200).json({
        orgId,
        hasTokens: true,
        status: 'corrupted',
        message: 'Credentials are corrupted. Please reconnect Google Calendar.',
        decryptError: decryptError?.message
      });
    }

    // Check expiration
    const expiresAt = new Date(decrypted.expiresAt);
    const now = new Date();
    const isExpired = expiresAt < now;
    const expiresInSeconds = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    const isExpiringSoon = expiresInSeconds < 300; // 5 minutes

    let status = 'healthy';
    if (isExpired) {
      status = 'expired';
    } else if (isExpiringSoon) {
      status = 'expiring_soon';
    }

    return res.status(200).json({
      orgId,
      hasTokens: true,
      accessTokenExists: !!decrypted.accessToken,
      refreshTokenExists: !!decrypted.refreshToken,
      email: decrypted.email || 'unknown',
      expiresAt: decrypted.expiresAt,
      expiresInSeconds,
      expiresInMinutes: Math.floor(expiresInSeconds / 60),
      isExpired,
      isExpiringSoon,
      lastUpdated: cred.updated_at,
      status,
      recommendation:
        status === 'expired'
          ? 'Token is expired. Call POST /api/google-oauth/refresh-token or reconnect in dashboard.'
          : status === 'expiring_soon'
            ? 'Token will expire soon. Consider refreshing proactively.'
            : 'Token is healthy'
    });
  } catch (error: any) {
    log.error('GoogleOAuthStatus', 'Unexpected error', {
      error: error?.message
    });

    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message
    });
  }
});

export default router;
