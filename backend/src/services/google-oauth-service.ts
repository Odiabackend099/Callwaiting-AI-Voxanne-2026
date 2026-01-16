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
  try {
    const client = getOAuth2Client();
    
    // Encode orgId in state parameter (CSRF protection)
    // Using base64url encoding (URL-safe base64)
    const state = Buffer.from(JSON.stringify({ orgId })).toString('base64url');
    
    const authUrl = client.generateAuthUrl({
      access_type: 'offline', // Required to get refresh token
      scope: ['https://www.googleapis.com/auth/calendar.events'], // Read/write calendar events
      state,
      prompt: 'consent' // Force consent screen to ensure refresh token
    });

    log.info('GoogleOAuth', 'Generated OAuth URL', { orgId, hasState: !!state });
    return authUrl;
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to generate OAuth URL', {
      orgId,
      error: error?.message
    });
    throw new Error(`Failed to generate OAuth URL: ${error.message}`);
  }
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
        email: userEmail
      });

      await IntegrationDecryptor.storeCredentials(
        orgId,
        'google_calendar',
        credentialsWithMetadata
      );

      log.info('GoogleOAuth', 'Tokens stored successfully', {
        orgId,
        hasAccessToken: !!tokens.access_token,
        hasRefreshToken: !!tokens.refresh_token,
        email: userEmail,
        timestamp: new Date().toISOString()
      });
    } catch (storageError: any) {
      log.error('GoogleOAuth', 'Failed to store tokens', {
        orgId,
        error: storageError.message,
        errorCode: storageError?.code,
        stack: storageError?.stack
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
    // Fetch and decrypt stored tokens using IntegrationDecryptor
    let googleCreds;
    try {
      googleCreds = await IntegrationDecryptor.getGoogleCalendarCredentials(orgId);
    } catch (error: any) {
      log.error('GoogleOAuth', 'Failed to retrieve Google Calendar credentials', {
        orgId,
        error: error?.message
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

    // Check if access token is expired and refresh if needed
    if (client.isAccessTokenExpired()) {
      try {
        log.info('GoogleOAuth', 'Access token expired, refreshing', { orgId });

        const { credentials } = await client.refreshAccessToken();

        if (!credentials.access_token) {
          throw new Error('Refresh token exchange did not return access token');
        }

        // Update stored access token using IntegrationDecryptor
        // Keep refresh token unchanged, only update access token and expiry
        const updatedCreds = {
          accessToken: credentials.access_token,
          refreshToken: refreshToken, // Keep existing refresh token
          expiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : new Date(Date.now() + 3600000).toISOString()
        };

        await IntegrationDecryptor.storeCredentials(
          orgId,
          'google_calendar',
          updatedCreds
        );

        // Update the client with fresh access token
        client.setCredentials({
          access_token: credentials.access_token,
          refresh_token: refreshToken,
          expiry_date: credentials.expiry_date
        });

        log.info('GoogleOAuth', 'Access token refreshed and stored', { orgId });
      } catch (refreshError: any) {
        log.error('GoogleOAuth', 'Token refresh failed', {
          orgId,
          error: refreshError?.message
        });
        throw new Error(
          'Token refresh failed. Your Google Calendar connection may have been revoked. ' +
          'Please reconnect Google Calendar in settings.'
        );
      }
    }

    // Return authenticated calendar client
    const calendar = google.calendar({ version: 'v3', auth: client });
    return calendar;
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to get calendar client', {
      orgId,
      error: error?.message
    });
    throw error;
  }
}

/**
 * Revoke Google Calendar access for organization
 * Deletes stored tokens from database
 * 
 * @param orgId - Organization ID
 */
export async function revokeAccess(orgId: string): Promise<void> {
  try {
    // Note: We don't revoke with Google API (that requires additional API call and permission)
    // Just invalidate the stored credentials by marking as inactive
    const { error: updateError } = await supabase
      .from('org_credentials')
      .update({
        is_active: false,
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

    // Invalidate cache
    IntegrationDecryptor.invalidateCache(orgId, 'google_calendar');

    log.info('GoogleOAuth', 'Access revoked successfully', { orgId });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to revoke access', {
      orgId,
      error: error?.message
    });
    throw error;
  }
}
