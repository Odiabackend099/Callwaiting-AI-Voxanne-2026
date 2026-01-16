/**
 * Frontend API Route: POST /api/auth/google-calendar/callback
 *
 * DEPRECATED: This route is NOT used in the current OAuth flow.
 *
 * Why it's deprecated:
 * The GOOGLE_REDIRECT_URI points directly to the backend (/api/google-oauth/callback),
 * so Google redirects straight to the backend, bypassing this frontend route.
 *
 * The actual flow:
 * 1. User authorizes on Google consent screen
 * 2. Google redirects to backend /api/google-oauth/callback
 * 3. Backend exchanges code and stores tokens
 * 4. Backend redirects to frontend /dashboard/api-keys?success=calendar_connected
 * 5. Frontend detects the success parameter and confirms connection
 *
 * This route remains for backward compatibility if anyone was using it.
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

    // This is a legacy pathway - the actual token exchange happens in the backend
    // at /api/google-oauth/callback (which is the GOOGLE_REDIRECT_URI)
    console.warn('[Google OAuth Callback] Deprecated route called. Tokens should have been exchanged at backend.');

    return NextResponse.json(
      {
        error: 'This route is deprecated. Google OAuth redirects directly to backend.',
        info: 'Check /api/google-oauth/callback status instead'
      },
      { status: 410 } // 410 Gone
    );
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
