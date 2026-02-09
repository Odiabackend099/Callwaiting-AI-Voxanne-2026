/**
 * Server-side endpoint to fetch tenant_id for authenticated user
 * Uses service role to bypass RLS restrictions
 * Frontend calls this instead of querying profiles directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      );
    }

    // Get authenticated user
    const supabase = await createClient();

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service role client to bypass RLS
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const adminSupabase = createServiceClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('[Tenant ID] Profile fetch error:', profileError);
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    if (!profile?.tenant_id) {
      return NextResponse.json(
        { error: 'Tenant ID not set' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      tenantId: profile.tenant_id,
      userId: user.id,
    });
  } catch (error) {
    console.error('[Tenant ID] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
