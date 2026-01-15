/**
 * Server-side endpoint to fetch tenant_id for authenticated user
 * Uses service role to bypass RLS restrictions
 * Frontend calls this instead of querying profiles directly
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      return NextResponse.json(
        { error: 'Server configuration missing' },
        { status: 500 }
      );
    }

    // Get user session
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Use service role client to bypass RLS
    const { createClient } = await import('@supabase/supabase-js');
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .select('tenant_id')
      .eq('id', session.user.id)
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
      userId: session.user.id,
    });
  } catch (error) {
    console.error('[Tenant ID] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
