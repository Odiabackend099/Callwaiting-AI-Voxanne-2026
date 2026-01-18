/**
 * Google Calendar OAuth Service
 * Handles OAuth 2.0 authorization code flow for Google Calendar API access
 * 
 * This is SEPARATE from user authentication OAuth (Supabase Auth handles that)
 * This is for accessing user's Google Calendar to read/write events
 */

import { google } from 'googleapis';
import { supabase } from './supabase-client';
import { log } from './logger';
import { EncryptionService } from './encryption';
import { IntegrationDecryptor } from './integration-decryptor';

// OAuth 2.0 Client Configuration
// Initialize lazily to avoid errors if env vars not set during module load
let oauth2Client: any = null;

function getOAuth2Client() {
  if (!oauth2Client) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/google-oauth/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables are required');
    }

    oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }
  return oauth2Client;
}

// Note: Encryption is now handled by unified EncryptionService
// This uses AES-256-GCM instead of the old AES-256-CBC
// Migration: Old tokens encrypted with CBC will be re-encrypted on next token refresh

/**
 * Generate OAuth authorization URL
 * Encodes orgId in state parameter for CSRF protection
 * 
 * @param orgId - Organization ID to associate with this OAuth flow
 * @returns Authorization URL to redirect user to Google
 */
export async function getOAuthUrl(orgId: string): Promise<string> {
  const client = getOAuth2Client();
  const state = Buffer.from(JSON.stringify({ orgId })).toString('base64url');

  // Strictly follows Google's OAuth protocol for offline access
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    state
  });
}

/**
 * Exchange authorization code for tokens
 * Encrypts and stores tokens in database
 * 
 * @param code - Authorization code from Google callback
 * @param state - State parameter from callback (contains orgId)
 * @returns Success status and orgId
 */
export async function exchangeCodeForTokens(
  code: string,
  state: string
): Promise<{ orgId: string; success: boolean; email?: string }> {
  try {
    // Decode orgId from state parameter
    let orgId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
      orgId = stateData.orgId;

      if (!orgId || typeof orgId !== 'string') {
        throw new Error('Invalid state: orgId missing or invalid');
      }
    } catch (error: any) {
      log.error('GoogleOAuth', 'Failed to decode state parameter', {
        error: error?.message,
        stateLength: state.length
      });
      throw new Error('Invalid state parameter. OAuth flow may have been tampered with.');
    }

    // Exchange code for tokens
    const client = getOAuth2Client();

    log.debug('GoogleOAuth', 'Exchanging authorization code for tokens', {
      codeLength: code.length,
      hasCode: !!code,
      redirectUri: client.credentials?.redirect_uri || 'not set'
    });

    let tokens: any;
    try {
      const response = await client.getToken(code);
      tokens = response.tokens;
    } catch (tokenError: any) {
      log.error('GoogleOAuth', 'Google token exchange error', {
        error: tokenError?.message,
        errorCode: tokenError?.code,
        errorResponse: tokenError?.response?.data,
        stack: tokenError?.stack
      });

      // Provide more helpful error messages
      if (tokenError?.message?.includes('redirect_uri_mismatch')) {
        throw new Error('Redirect URI mismatch. Ensure http://localhost:3001/api/google-oauth/callback is added to Google Cloud Console authorized redirect URIs.');
      } else if (tokenError?.message?.includes('invalid_grant')) {
        throw new Error('Authorization code expired or already used. Please restart the OAuth flow.');
      } else {
        throw new Error(`Token exchange failed: ${tokenError?.message || 'Unknown error'}`);
      }
    }

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new Error('Google did not return required tokens (access_token and refresh_token)');
    }

    // Calculate expiry time (default to 1 hour if not provided)
    const expiresAt = tokens.expiry_date
      ? new Date(tokens.expiry_date).toISOString()
      : new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

    // Store encrypted tokens using IntegrationDecryptor (unified encryption)
    // This automatically encrypts with AES-256-GCM and stores in org_credentials
    const credentials = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt
    };

    // Get user email from ID token for metadata
    let userEmail: string | null = null;
    try {
      if (tokens.id_token) {
        const decodedIdToken = JSON.parse(
          Buffer.from(tokens.id_token.split('.')[1], 'base64').toString()
        );
        userEmail = decodedIdToken.email || null;
        log.debug('GoogleOAuth', 'Extracted email from ID token', { userEmail });
      }
    } catch (idTokenError: any) {
      log.warn('GoogleOAuth', 'Failed to extract email from ID token', {
        error: idTokenError?.message
      });
    }

    // Prepare credentials with metadata
    const credentialsWithMetadata = {
      ...credentials,
      email: userEmail
    };

    try {
      log.debug('GoogleOAuth', 'Storing credentials with metadata', {
        orgId,
        hasEmail: !!userEmail,
        email: userEmail,
        credentialsKeys: Object.keys(credentialsWithMetadata)
      });

      console.log('[GoogleOAuth] About to store credentials:', {
        orgId,
        provider: 'google_calendar',
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        email: userEmail
      });

      await IntegrationDecryptor.storeCredentials(
        orgId,
        'google_calendar',
        credentialsWithMetadata
      );

      // Update the exposed email column for UI
      if (userEmail) {
        await supabase
          .from('org_credentials')
          .update({ connected_calendar_email: userEmail })
          .eq('org_id', orgId)
          .eq('provider', 'google_calendar');
      }

      console.log('[GoogleOAuth] storeCredentials() completed successfully');

      log.info('GoogleOAuth', 'Tokens stored successfully', {
        orgId,
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        email: userEmail,
        timestamp: new Date().toISOString()
      });
    } catch (storageError: any) {
      console.error('[GoogleOAuth] storeCredentials() failed with error:', storageError);

      log.error('GoogleOAuth', 'Failed to store tokens', {
        orgId,
        error: storageError.message,
        errorCode: storageError?.code,
        stack: storageError?.stack,
        fullError: storageError
      });
      throw new Error(`Failed to store tokens: ${storageError.message}`);
    }

    return { orgId, success: true, email: userEmail || undefined };
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to exchange code for tokens', {
      error: error?.message,
      stack: error?.stack
    });
    throw error;
  }
}

/**
 * Get authenticated Google Calendar client for organization
 * Automatically refreshes access token if expired
 * 
 * @param orgId - Organization ID
 * @returns Authenticated calendar client (googleapis calendar instance)
 */
export async function getCalendarClient(orgId: string): Promise<any> {
  try {
    log.info('GoogleOAuth', '[TOKEN-FLOW START] getCalendarClient', { orgId, timestamp: new Date().toISOString() });

    // Fetch and decrypt stored tokens using IntegrationDecryptor
    let googleCreds;
    try {
      log.info('GoogleOAuth', '[TOKEN] Fetching credentials from storage', { orgId });
      googleCreds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId, true);
      log.info('GoogleOAuth', '[TOKEN] Credentials retrieved', {
        orgId,
        hasAccessToken: !!googleCreds.accessToken,
        hasRefreshToken: !!googleCreds.refreshToken,
        expiresAt: googleCreds.expiresAt
      });
    } catch (error: any) {
      log.error('GoogleOAuth', '[TOKEN-CRITICAL] Failed to retrieve Google Calendar credentials', {
        orgId,
        error: error?.message,
        timestamp: new Date().toISOString()
      });
      throw new Error('Google Calendar not connected. Please reconnect your Google account.');
    }

    const accessToken = googleCreds.accessToken;
    const refreshToken = googleCreds.refreshToken;

    // Set credentials on OAuth client
    const client = getOAuth2Client();
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: googleCreds.expiresAt ? new Date(googleCreds.expiresAt).getTime() : undefined
    });

    log.info('GoogleOAuth', '[TOKEN] Credentials set on OAuth client', { orgId });

    // OPTIMIZATION: Only refresh if expired or expiring soon (within 5 minutes)
    // This prevents hitting Google API and DB on every request (saving ~1-2s latency)
    const now = Date.now();
    const expiryTime = client.credentials.expiry_date || 0;
    const isExpiringSoon = expiryTime - now < 5 * 60 * 1000; // 5 minutes buffer

    log.info('GoogleOAuth', '[TOKEN-CHECK] Checking token expiry', {
      orgId,
      expiryTime: new Date(expiryTime).toISOString(),
      isExpiringSoon,
      gapMs: expiryTime - now
    });

    if (isExpiringSoon || !client.credentials.access_token) {
      log.info('GoogleOAuth', '[TOKEN-REFRESH] Token expired or expiring soon - refreshing', { orgId });

      try {
        const { credentials: refreshedCreds } = await client.refreshAccessToken();

        if (!refreshedCreds.access_token) {
          throw new Error('Refresh token exchange did not return access token');
        }

        log.info('GoogleOAuth', '[TOKEN-REFRESH] ✅ Refresh successful', {
          orgId,
          newAccessToken: refreshedCreds.access_token ? refreshedCreds.access_token.substring(0, 20) + '...' : 'MISSING',
          expiryDate: refreshedCreds.expiry_date
        });

        // Update stored access token using IntegrationDecryptor
        const updatedCreds = {
          accessToken: refreshedCreds.access_token,
          refreshToken: refreshToken, // Keep existing refresh token
          expiresAt: refreshedCreds.expiry_date
            ? new Date(refreshedCreds.expiry_date).toISOString()
            : new Date(Date.now() + 3600000).toISOString()
        };

        await IntegrationDecryptor.storeCredentials(
          orgId,
          'google_calendar',
          updatedCreds
        );

        // Update the client with fresh access token
        client.setCredentials({
          access_token: refreshedCreds.access_token,
          refresh_token: refreshToken,
          expiry_date: refreshedCreds.expiry_date
        });

        log.info('GoogleOAuth', '[TOKEN-REFRESH] ✅ New token stored and client updated', { orgId });
      } catch (forceRefreshError: any) {
        log.error('GoogleOAuth', '[TOKEN-REFRESH-CRITICAL] Failed to refresh token', {
          orgId,
          error: forceRefreshError?.message,
          timestamp: new Date().toISOString()
        });
        // Propagate error if we really needed a token
        throw forceRefreshError;
      }
    } else {
      log.info('GoogleOAuth', '[TOKEN-OPTIMIZED] cached token is valid - skipping refresh', { orgId });
    }

    // OLD CHECK: This is now redundant since we forced refresh above, but keeping for defensive coding
    const isExpired = client.credentials.expiry_date
      ? client.credentials.expiry_date <= Date.now()
      : false;

    if (isExpired) {
      // This should rarely happen now due to forced refresh above
      log.warn('GoogleOAuth', '[TOKEN-LATE-CHECK] Token still appears expired after force refresh', { orgId });
    }

    // Return authenticated calendar client
    log.info('GoogleOAuth', '[TOKEN-FLOW] Creating calendar instance with authenticated client', { orgId });
    const calendar = google.calendar({ version: 'v3', auth: client });

    log.info('GoogleOAuth', '[TOKEN-FLOW END] getCalendarClient SUCCESS - calendar client ready', {
      orgId,
      timestamp: new Date().toISOString()
    });

    return calendar;
  } catch (error: any) {
    log.error('GoogleOAuth', '[CRITICAL] Failed to get calendar client', {
      orgId,
      errorMessage: error?.message,
      errorCode: error?.code,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

/**
 * Revoke Google Calendar access for organization
 * Deletes stored tokens from database and logs the security event
 * 
 * @param orgId - Organization ID
 * @param userId - ID of user performing the action (for audit)
 * @param ipAddress - IP address of request (for audit)
 */
export async function revokeAccess(orgId: string, userId?: string, ipAddress?: string): Promise<void> {
  try {
    // 1. Soft delete the credential and clear email
    const { error: updateError } = await supabase
      .from('org_credentials')
      .update({
        is_active: false,
        connected_calendar_email: null, // Clear the visible email
        updated_at: new Date().toISOString()
      })
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar');

    if (updateError) {
      log.error('GoogleOAuth', 'Failed to revoke access', {
        orgId,
        error: updateError.message
      });
      throw new Error(`Failed to revoke access: ${updateError.message}`);
    }

    // 2. Invalidate cache
    IntegrationDecryptor.invalidateCache(orgId, 'google_calendar');

    // 3. Security Audit Log
    if (userId) {
      await supabase.from('security_audit_log').insert({
        org_id: orgId,
        user_id: userId,
        action: 'UNLINK_GOOGLE_CALENDAR',
        details: { provider: 'google_calendar', reason: 'User requested disconnect' },
        ip_address: ipAddress || 'unknown'
      });
    }

    log.info('GoogleOAuth', 'Access revoked successfully', { orgId, userId });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to revoke access', {
      orgId,
      error: error?.message
    });
    throw error;
  }
}
