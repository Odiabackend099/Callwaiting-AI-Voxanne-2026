import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const next = requestUrl.searchParams.get('next') || '/dashboard';

    if (code) {
        try {
            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
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
                }
            );

            const { error } = await supabase.auth.exchangeCodeForSession(code);
            
            if (error) {
                console.error('Session exchange error:', error);
                // Redirect to login with error message
                return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));
            }
        } catch (err) {
            console.error('Auth callback error:', err);
            return NextResponse.redirect(new URL('/login?error=auth_error', requestUrl.origin));
        }
    }

    // Use NEXT_PUBLIC_APP_URL for production domain, fallback to requestUrl.origin for dev
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    
    // Ensure next param is safe (prevent open redirect)
    const safeNext = next.startsWith('/') ? next : '/dashboard';
    
    return NextResponse.redirect(baseUrl + safeNext);
}
