import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const host = req.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const isVercelHost = host.endsWith('.vercel.app');

    // Prevent Supabase PKCE (code_verifier) mismatch by forcing a single canonical origin.
    // If the OAuth flow starts on *.vercel.app and returns to callwaitingai.dev (or vice versa),
    // the code_verifier stored per-origin won't be found and Supabase throws bad_code_verifier.
    if (!isLocalhost && isVercelHost) {
        const url = req.nextUrl.clone();
        url.hostname = 'callwaitingai.dev';
        url.protocol = 'https:';
        url.port = '';
        return NextResponse.redirect(url, 308);
    }

    let res = NextResponse.next({
        request: {
            headers: req.headers,
        },
    });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return res;
    }

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                get(name: string) {
                    return req.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    req.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    res.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: any) {
                    req.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                    res.cookies.set({
                        name,
                        value: '',
                        ...options,
                    });
                },
            },
        }
    );

    // Refresh session if expired - required for Server Components
    await supabase.auth.getSession();

    return res;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
