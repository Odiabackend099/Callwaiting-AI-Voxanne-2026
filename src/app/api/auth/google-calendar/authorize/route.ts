/**
 * Frontend API Route: GET /api/auth/google-calendar/authorize
 *
 * Purpose: Bridge between React component and backend OAuth service
 * FIXED: Now extracts org_id from JWT app_metadata (single source of truth)
 * - Gets user from Supabase auth
 * - Extracts org_id from JWT's app_metadata (cryptographically signed)
 * - Calls backend to generate Google OAuth consent URL
 * - Returns URL to frontend for redirect
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    // Step 1: Get authenticated user
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      console.error('[Google OAuth] No valid user:', userError?.message);
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Step 2: Extract org_id from JWT app_metadata (single source of truth).
    // Only trust app_metadata (admin-set, cryptographically signed).
    const orgId = user.app_metadata?.org_id as string | undefined;

    if (!orgId) {
      console.error('[Google OAuth] User missing org_id in app_metadata:', {
        user_id: user.id,
        email: user.email,
        app_metadata: user.app_metadata,
      });
      return NextResponse.json(
        {
          error: 'Organization not found. Please log out and log in again to refresh your session.',
          details: 'Your user session is missing the organization ID. This typically requires a fresh login.'
        },
        { status: 401 }
      );
    }

    console.log(`[Google OAuth] Got org_id from JWT: ${orgId}`);

    // Step 3: Call backend with the REAL org_id
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';
    console.log(`[Google OAuth] Using backend URL: ${backendUrl}`);

    // CRITICAL FIX: Call the unified OAuth endpoint
    // /api/google-oauth/authorize is the single source of truth for all OAuth flows
    const fullUrl = `${backendUrl}/api/google-oauth/authorize?org_id=${encodeURIComponent(orgId)}`;
    console.log(`[Google OAuth] Calling unified endpoint: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json', // Request JSON response from backend
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[Google OAuth] Backend error:', error);

      return NextResponse.json(
        { error: error.message || error.error || 'Failed to generate authorization URL' },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[Google OAuth] Auth URL generated successfully', { hasUrl: !!data.url });

    // Backend returns either 'url' or 'authUrl' - support both for compatibility
    const authUrl = data.authUrl || data.url;
    if (!authUrl) {
      throw new Error('Backend returned no authorization URL');
    }

    return NextResponse.json({
      authUrl,
      success: true,
    });
  } catch (error) {
    console.error('[Google OAuth] Error generating OAuth URL:', error);
    return NextResponse.json(
      { error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}
