/**
 * Frontend API Route: GET /api/auth/google-calendar/authorize
 *
 * Purpose: Bridge between React component and backend OAuth service
 * FIXED: Now properly fetches org_id from Supabase session + database
 * - Gets user from Supabase auth
 * - Fetches org_id from profiles table (REAL data, not broken cookies)
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

    // Step 2: Fetch tenant_id from DATABASE (not broken cookies/metadata)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error('[Google OAuth] User profile not found or tenant_id missing:', profileError?.message);
      return NextResponse.json(
        { error: 'Organization not found. Please log in again.' },
        { status: 401 }
      );
    }

    const orgId = profile.tenant_id;
    console.log(`[Google OAuth] Got tenant_id from database: ${orgId}`);

    // Step 3: Call backend with the REAL org_id
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    const response = await fetch(
      `${backendUrl}/api/calendar/auth/url?org_id=${encodeURIComponent(orgId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('[Google OAuth] Backend error:', error);
      
      return NextResponse.json(
        { error: error.message || 'Failed to generate authorization URL' },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('[Google OAuth] Auth URL generated successfully');

    return NextResponse.json({
      authUrl: data.url,
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
