import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) {
      return NextResponse.json(
        { access_token: null, expiresIn: 0 },
        { status: 401 }
      );
    }

    const expiresIn = data.session.expires_in ?? 0;
    return NextResponse.json({
      access_token: data.session.access_token,
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
