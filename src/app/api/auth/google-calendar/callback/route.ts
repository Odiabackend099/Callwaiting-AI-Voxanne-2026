/**
 * Frontend API Route: POST /api/auth/google-calendar/callback
 *
 * Purpose: Handle OAuth callback from Google and exchange code for tokens
 * - Receives authorization code from Google OAuth flow
 * - Exchanges code for tokens via backend
 * - Backend stores encrypted tokens in Supabase
 *
 * Flow:
 * 1. User authorized on Google consent screen
 * 2. Google redirects back to frontend
 * 3. Frontend calls this endpoint with auth code
 * 4. This endpoint exchanges code for tokens via backend
 * 5. Backend stores encrypted tokens in Supabase
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { code, state } = await req.json();
    
    // Get org_id from cookies or headers
    let orgId = req.cookies.get('org_id')?.value;
    
    if (!orgId) {
      orgId = req.headers.get('x-org-id') || '';
    }

    if (!code || !orgId) {
      return NextResponse.json(
        { 
          error: 'Missing authorization code or organization ID',
          details: { code: !!code, orgId: !!orgId }
        },
        { status: 400 }
      );
    }

    // Call backend to exchange code for tokens
    const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';
    
    console.log(`[Google OAuth Callback] Exchanging code for org: ${orgId}`);
    
    const response = await fetch(
      `${backendUrl}/api/calendar/auth/callback`,
      {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          code, 
          state,
          org_id: orgId 
        }),
      }
    );

    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Google OAuth Callback] Backend error:', data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('[Google OAuth Callback] Tokens exchanged and stored successfully');

    return NextResponse.json({ 
      success: true,
      data,
      message: 'Google Calendar connected successfully'
    });
  } catch (error) {
    console.error('[Google OAuth Callback] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to complete authorization',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
