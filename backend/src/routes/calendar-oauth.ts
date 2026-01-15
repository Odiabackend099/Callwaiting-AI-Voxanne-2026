import { Router, Request, Response } from 'express';
import { google } from 'googleapis';
import { supabase } from '../services/supabase-client';
import { encrypt, decrypt } from '../utils/encryption';
import { validateOrgIdParameter } from '../services/org-validation';
import * as crypto from 'crypto';

const router = Router();

// Initialize Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

/**
 * GET /api/calendar/auth/url
 * Generates Google OAuth consent URL for clinic to connect their calendar
 * Request: org_id in query params or session
 * Response: { url: "https://accounts.google.com/o/oauth2/v2/auth?..." }
 */
router.get('/auth/url', async (req: Request, res: Response) => {
  try {
    const session = (req as any).session;
    const orgId = (req.query.org_id as string) || session?.org_id;

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'org_id is required',
      });
    }

    // Store org_id in session to retrieve it in callback
    if (session) {
      session.calendarOrgId = orgId;
    }

    // Generate consent URL with offline access (for refresh_token)
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      prompt: 'consent', // Force consent screen to ensure refresh_token
    });

    res.json({
      success: true,
      url: authUrl,
    });
  } catch (error) {
    console.error('Error generating OAuth URL:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate OAuth URL',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/calendar/auth/callback
 * Handles Google OAuth callback
 * Query: code (authorization code from Google)
 * Exchanges code for access_token and refresh_token
 * Stores refresh_token in Supabase (encrypted)
 */
router.get('/auth/callback', async (req: Request, res: Response) => {
  try {
    const { code } = req.query;
    const session = (req as any).session;
    const orgId = session?.calendarOrgId;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Missing authorization code',
      });
    }

    if (!orgId) {
      return res.status(400).json({
        success: false,
        message: 'Missing organization ID in session',
      });
    }

    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.refresh_token) {
      return res.status(400).json({
        success: false,
        message:
          'Failed to obtain refresh token. Ensure you selected "offline access".',
      });
    }

    // Get user's Google email
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    const googleEmail = profile.data.emailAddress;

    if (!googleEmail) {
      return res.status(400).json({
        success: false,
        message: 'Could not retrieve Google email address',
      });
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(tokens.access_token || '');
    const encryptedRefreshToken = encrypt(tokens.refresh_token);

    // Calculate token expiry (Google tokens expire in ~1 hour)
    const expiryDate = tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000);

    // Store or update calendar connection in Supabase
    const { data, error } = await supabase
      .from('calendar_connections')
      .upsert(
        {
          org_id: orgId,
          google_email: googleEmail,
          access_token: encryptedAccessToken,
          refresh_token: encryptedRefreshToken,
          token_expiry: expiryDate,
          calendar_id: 'primary',
          updated_at: new Date(),
        },
        { onConflict: 'org_id' }
      )
      .select();

    if (error) {
      console.error('Error storing calendar connection:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to store calendar connection',
        error: error.message,
      });
    }

    // Clear session
    if (session) {
      session.calendarOrgId = null;
    }

    // Redirect to dashboard with success message
    const redirectUrl = `${process.env.FRONTEND_URL}/dashboard/api-keys?calendar=connected&email=${encodeURIComponent(
      googleEmail
    )}`;

    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in OAuth callback:', error);

    const redirectUrl = `${process.env.FRONTEND_URL}/dashboard/api-keys?calendar=error&message=${encodeURIComponent(
      error instanceof Error ? error.message : 'Unknown error'
    )}`;

    res.redirect(redirectUrl);
  }
});

/**
 * GET /api/calendar/status/:orgId
 * Check if calendar is connected and get clinic email
 */
router.get('/status/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // SECURITY: Validate org_id parameter matches user's org_id
    try {
      validateOrgIdParameter(orgId, req.org_id || '');
    } catch (validationError: any) {
      return res.status(403).json({
        success: false,
        error: validationError.message
      });
    }

    const { data, error } = await supabase
      .from('calendar_connections')
      .select('google_email, token_expiry')
      .eq('org_id', orgId)
      .single();

    if (error || !data) {
      return res.json({
        success: true,
        connected: false,
      });
    }

    res.json({
      success: true,
      connected: true,
      email: data.google_email,
      expiryDate: data.token_expiry,
    });
  } catch (error) {
    console.error('Error checking calendar status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check calendar status',
    });
  }
});

/**
 * POST /api/calendar/disconnect/:orgId
 * Remove calendar connection (clinic can disconnect)
 */
router.post('/disconnect/:orgId', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;

    // SECURITY: Validate org_id parameter matches user's org_id
    try {
      validateOrgIdParameter(orgId, req.org_id || '');
    } catch (validationError: any) {
      return res.status(403).json({
        success: false,
        error: validationError.message
      });
    }

    const { error } = await supabase
      .from('calendar_connections')
      .delete()
      .eq('org_id', orgId);

    if (error) {
      return res.status(500).json({
        success: false,
        message: 'Failed to disconnect calendar',
      });
    }

    res.json({
      success: true,
      message: 'Calendar disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to disconnect calendar',
    });
  }
});

export default router;
