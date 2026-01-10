/**
 * Google Calendar OAuth Service
 * Handles OAuth 2.0 authorization code flow for Google Calendar API access
 * 
 * This is SEPARATE from user authentication OAuth (Supabase Auth handles that)
 * This is for accessing user's Google Calendar to read/write events
 */

import { google } from 'googleapis';
import * as crypto from 'crypto';
import { supabase } from './supabase-client';
import { log } from './logger';

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

// Encryption key - must be 32 bytes (256 bits) for AES-256-CBC
let ENCRYPTION_KEY: Buffer | null = null;

/**
 * Initialize encryption key from environment variable
 * Validates key format and throws if missing/invalid
 */
function getEncryptionKey(): Buffer {
  if (ENCRYPTION_KEY) {
    return ENCRYPTION_KEY;
  }

  const keyString = process.env.GOOGLE_ENCRYPTION_KEY;
  if (!keyString) {
    throw new Error(
      'GOOGLE_ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Support both hex and base64 formats
  try {
    // Try hex first (recommended format)
    if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
      ENCRYPTION_KEY = Buffer.from(keyString, 'hex');
    } else {
      // Try base64
      ENCRYPTION_KEY = Buffer.from(keyString, 'base64');
    }

    // Validate key length (must be 32 bytes for AES-256)
    if (ENCRYPTION_KEY.length !== 32) {
      throw new Error(`Encryption key must be 32 bytes (64 hex characters or 44 base64 characters). Got ${ENCRYPTION_KEY.length} bytes.`);
    }

    return ENCRYPTION_KEY;
  } catch (error: any) {
    throw new Error(`Invalid GOOGLE_ENCRYPTION_KEY format: ${error.message}`);
  }
}

/**
 * Encrypt text using AES-256-CBC with random IV
 * Output format: "iv_hex:encrypted_hex"
 * 
 * @param text - Plaintext to encrypt
 * @returns Encrypted string in format "iv:encrypted"
 */
export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(16); // 16 bytes IV for CBC mode
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV and encrypted data separated by colon
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error: any) {
    log.error('GoogleOAuth', 'Encryption failed', { error: error?.message });
    throw new Error(`Token encryption failed: ${error.message}`);
  }
}

/**
 * Decrypt text encrypted with encrypt()
 * 
 * @param encryptedText - Encrypted string in format "iv:encrypted"
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedText: string): string {
  try {
    const key = getEncryptionKey();
    const [ivHex, encryptedHex] = encryptedText.split(':');
    
    if (!ivHex || !encryptedHex) {
      throw new Error('Invalid encrypted format. Expected "iv:encrypted"');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    log.error('GoogleOAuth', 'Decryption failed', { error: error?.message });
    throw new Error(`Token decryption failed: ${error.message}`);
  }
}

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
): Promise<{ orgId: string; success: boolean }> {
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

    // Encrypt tokens before storing
    const config = {
      access_token: encrypt(tokens.access_token),
      refresh_token: encrypt(tokens.refresh_token),
      expires_at: expiresAt
    };

    // Store encrypted tokens in database
    const { error: upsertError } = await supabase
      .from('integrations')
      .upsert(
        {
          org_id: orgId,
          provider: 'google_calendar',
          config,
          connected: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'org_id,provider' }
      );

    if (upsertError) {
      log.error('GoogleOAuth', 'Failed to store tokens', {
        orgId,
        error: upsertError.message
      });
      throw new Error(`Failed to store tokens: ${upsertError.message}`);
    }

    log.info('GoogleOAuth', 'Tokens stored successfully', {
      orgId,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    });

    return { orgId, success: true };
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
    // Fetch stored tokens from database
    const { data: integration, error: fetchError } = await supabase
      .from('integrations')
      .select('config')
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar')
      .single();

    if (fetchError || !integration?.config) {
      throw new Error(`Google Calendar not connected for organization ${orgId}. Please connect Google Calendar first.`);
    }

    const config = integration.config as any;

    if (!config.access_token || !config.refresh_token) {
      throw new Error('Invalid token configuration. Please reconnect Google Calendar.');
    }

    // Decrypt tokens
    let accessToken: string;
    let refreshToken: string;

    try {
      accessToken = decrypt(config.access_token);
      refreshToken = decrypt(config.refresh_token);
    } catch (error: any) {
      log.error('GoogleOAuth', 'Token decryption failed', {
        orgId,
        error: error?.message
      });
      throw new Error('Failed to decrypt stored tokens. Encryption key may have changed.');
    }

    // Set credentials on OAuth client
    const client = getOAuth2Client();
    client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
      expiry_date: config.expires_at ? new Date(config.expires_at).getTime() : undefined
    });

    // Check if access token is expired and refresh if needed
    if (client.isAccessTokenExpired()) {
      try {
        log.info('GoogleOAuth', 'Access token expired, refreshing', { orgId });
        
        const { credentials } = await client.refreshAccessToken();
        
        if (!credentials.access_token) {
          throw new Error('Refresh token exchange did not return access token');
        }

        // Update stored access token (keep refresh token unchanged)
        const updatedConfig = {
          ...config,
          access_token: encrypt(credentials.access_token),
          expires_at: credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : new Date(Date.now() + 3600000).toISOString()
        };

        const { error: updateError } = await supabase
          .from('integrations')
          .update({
            config: updatedConfig,
            updated_at: new Date().toISOString()
          })
          .eq('org_id', orgId)
          .eq('provider', 'google_calendar');

        if (updateError) {
          log.warn('GoogleOAuth', 'Failed to update refreshed token in database', {
            orgId,
            error: updateError.message
          });
          // Don't throw - token is refreshed in memory, will work for this request
        }

        // Update OAuth client with new token
        client.setCredentials(credentials);

        log.info('GoogleOAuth', 'Access token refreshed successfully', { orgId });
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
    // Optionally revoke token with Google (optional - just deleting from DB is usually enough)
    // For now, just delete from database
    
    const { error: deleteError } = await supabase
      .from('integrations')
      .delete()
      .eq('org_id', orgId)
      .eq('provider', 'google_calendar');

    if (deleteError) {
      log.error('GoogleOAuth', 'Failed to revoke access', {
        orgId,
        error: deleteError.message
      });
      throw new Error(`Failed to revoke access: ${deleteError.message}`);
    }

    log.info('GoogleOAuth', 'Access revoked successfully', { orgId });
  } catch (error: any) {
    log.error('GoogleOAuth', 'Failed to revoke access', {
      orgId,
      error: error?.message
    });
    throw error;
  }
}
