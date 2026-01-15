import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * GET /api/orgs/validate/[orgId]
 * 
 * Validate that:
 * 1. Organization exists in database
 * 2. Authenticated user has access to this organization
 * 
 * Returns:
 * - 200 + {success: true, orgId} if org exists and user has access
 * - 400 if orgId is missing or invalid format
 * - 401 if user is not authenticated
 * - 403 if user doesn't have access to this organization
 * - 404 if organization doesn't exist
 * - 500 if database error
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    // Validate orgId parameter
    if (!orgId || typeof orgId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid organization ID' },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(orgId)) {
      return NextResponse.json(
        { error: 'Organization ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Get authenticated user via Supabase
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      );
    }

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

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if organization exists (using RLS to enforce access)
    // This query will return data ONLY if the user has access to this org
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status')
      .eq('id', orgId)
      .single();

    if (orgError) {
      // Distinguish between "not found" and other errors
      if (orgError.code === 'PGRST116') {
        // PGRST116 = no rows returned
        return NextResponse.json(
          { error: 'Organization not found or access denied' },
          { status: 404 }
        );
      }

      console.error('[/api/orgs/validate] Database error:', orgError);
      return NextResponse.json(
        { error: 'Database error during validation' },
        { status: 500 }
      );
    }

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Additional check: Verify user belongs to this organization
    // (RLS should enforce this, but we double-check for safety)
    const { data: userOrgs, error: userOrgError } = await supabase
      .from('profiles')
      .select('org_id')
      .eq('id', user.id)
      .eq('org_id', orgId)
      .single();

    if (userOrgError) {
      if (userOrgError.code === 'PGRST116') {
        // User doesn't belong to this org
        return NextResponse.json(
          { error: 'You do not have access to this organization' },
          { status: 403 }
        );
      }

      console.error('[/api/orgs/validate] Profile check error:', userOrgError);
      return NextResponse.json(
        { error: 'Error checking user access' },
        { status: 500 }
      );
    }

    if (!userOrgs) {
      return NextResponse.json(
        { error: 'You do not have access to this organization' },
        { status: 403 }
      );
    }

    // All checks passed
    return NextResponse.json({
      success: true,
      orgId: org.id,
      orgName: org.name,
      status: org.status,
    });
  } catch (error) {
    console.error('[/api/orgs/validate] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
