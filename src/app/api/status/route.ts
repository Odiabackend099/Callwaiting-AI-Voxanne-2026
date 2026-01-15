import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        status: 'error',
        message: 'Supabase configuration missing',
        database_connected: false,
      }, { status: 500 });
    }

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: any) { cookieStore.set({ name, value, ...options }); },
        remove(name: string, options: any) { cookieStore.set({ name, value: '', ...options }); },
      },
    });

    // Get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session?.user?.id) {
      return NextResponse.json({
        status: 'unauthenticated',
        user_id: null,
        organization_id: null,
        session_valid: false,
        database_connected: false,
      });
    }

    const userId = session.user.id;
    const userEmail = session.user.email;

    // Try to fetch user profile and organization
    let organizationId = null;
    let organizationName = null;
    let databaseConnected = false;

    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', userId)
        .single();

      if (!profileError && profile?.organization_id) {
        organizationId = profile.organization_id;
        databaseConnected = true;

        // Get organization name
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', organizationId)
          .single();

        if (!orgError && org?.name) {
          organizationName = org.name;
        }
      }
    } catch (err) {
      console.error('Error fetching profile/org:', err);
    }

    // Get recent database activity
    let recentQueries = [];
    try {
      if (organizationId) {
        const { data: calls, error: callsError } = await supabase
          .from('calls')
          .select('created_at')
          .eq('organization_id', organizationId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (!callsError && calls?.length > 0) {
          recentQueries.push({
            table: 'calls',
            operation: 'SELECT',
            timestamp: calls[0].created_at,
            row_count: calls.length,
          });
        }

        const { count: profileCount } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId);

        if (profileCount !== null) {
          recentQueries.push({
            table: 'profiles',
            operation: 'SELECT',
            timestamp: new Date().toISOString(),
            row_count: profileCount,
          });
        }
      }
    } catch (err) {
      console.error('Error getting recent queries:', err);
    }

    return NextResponse.json({
      status: 'healthy',
      user_id: userId,
      user_email: userEmail,
      organization_id: organizationId,
      organization_name: organizationName,
      session_valid: true,
      database_connected: databaseConnected,
      recent_queries: recentQueries,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Status API] Unexpected error:', error);
    return NextResponse.json({
      status: 'error',
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
