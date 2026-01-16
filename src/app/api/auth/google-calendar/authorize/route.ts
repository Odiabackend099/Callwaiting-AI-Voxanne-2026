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
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }

    // Step 1: Get Supabase session
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          cookieStore.set({ name, value: '', ...options });
        },
      },
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      console.error('[Google OAuth] No valid session:', sessionError?.message);
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    // Step 2: Extract org_id from JWT app_metadata (single source of truth)
    const orgId = session.user.app_metadata?.org_id as string | undefined;

    if (!orgId) {
      console.error('[Google OAuth] User missing org_id in JWT:', session.user.id);
      return NextResponse.json(
        { error: 'Organization not found. Please contact support.' },
        { status: 401 }
      );
    }

    console.log(`[Google OAuth] Got org_id from JWT: ${orgId}`);

    // Step 3: Call backend with the REAL org_id
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
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
