import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/orgs/[orgId]
 * 
 * Get organization data
 * Returns 200 with org data if user has access
 * Returns 401 if not authenticated
 * Returns 403 if user doesn't have access to this org
 * Returns 404 if org not found
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user has access to this org (RLS enforced by database)
    const { data: userOrg, error: userOrgError } = await supabase
      .from('user_org_roles')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (userOrgError || !userOrg) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get organization data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, status, created_at, updated_at')
      .eq('id', orgId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (error) {
    console.error('[GET /api/orgs/[orgId]] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}

/**
 * PUT /api/orgs/[orgId]
 * 
 * Update organization data
 * Only admins can update organization name
 * Status cannot be changed via API (managed by support)
 * 
 * Returns 200 with updated org data if successful
 * Returns 400 if invalid request
 * Returns 401 if not authenticated
 * Returns 403 if user is not admin
 * Returns 404 if org not found
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = params;

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { name } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: 'Organization name must be less than 100 characters' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Verify user is admin of this org
    const { data: userRole, error: userRoleError } = await supabase
      .from('user_org_roles')
      .select('role')
      .eq('org_id', orgId)
      .eq('user_id', user.id)
      .single();

    if (userRoleError || !userRole) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (userRole.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Update organization (only name, status is read-only)
    const { data: updated, error: updateError } = await supabase
      .from('organizations')
      .update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId)
      .select('id, name, status, created_at, updated_at')
      .single();

    if (updateError || !updated) {
      console.error('[PUT /api/orgs/[orgId]] Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[PUT /api/orgs/[orgId]] Error:', error);
    return NextResponse.json({ error: 'Failed to update organization' }, { status: 500 });
  }
}
