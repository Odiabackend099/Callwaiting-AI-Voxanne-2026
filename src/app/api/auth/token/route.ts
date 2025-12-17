import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase env missing' },
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

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      return NextResponse.json(
        { token: null, expiresIn: 0 },
        { status: 401 }
      );
    }

    const expiresIn = data.session.expires_in ?? 0;
    return NextResponse.json({
      token: data.session.access_token,
      expiresIn,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get token' },
      { status: 500 }
    );
  }
}
