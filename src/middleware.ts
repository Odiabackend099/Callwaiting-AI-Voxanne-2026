import { createServerClient } from '@supabase/ssr';
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        return NextResponse.next({ request: { headers: req.headers } });
    }

    // @supabase/ssr middleware pattern: reassign response inside setAll
    // to ensure cookie changes propagate correctly.
    let res = NextResponse.next({ request: req });

    const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
            cookies: {
                getAll() {
                    return req.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        req.cookies.set(name, value)
                    );
                    res = NextResponse.next({ request: req });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        res.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // IMPORTANT: Use getUser() instead of getSession() — getUser() validates
    // the JWT against Supabase Auth, while getSession() only reads the local cookie.
    const { data: { user } } = await supabase.auth.getUser();

    const pathname = req.nextUrl.pathname;

    // Route protection: block unauthenticated users from /dashboard/*
    if (!user && pathname.startsWith('/dashboard')) {
        const loginUrl = new URL('/login', req.url);
        return NextResponse.redirect(loginUrl);
    }

    // Route protection: block users without org_id from /dashboard/*
    if (user && pathname.startsWith('/dashboard')) {
        const orgId = user.app_metadata?.org_id;
        if (!orgId) {
            const loginUrl = new URL('/login', req.url);
            loginUrl.searchParams.set('error', 'no_org');
            return NextResponse.redirect(loginUrl);
        }
    }

    // If authenticated and on /login, redirect to dashboard
    if (user && pathname === '/login') {
        const dashboardUrl = new URL('/dashboard', req.url);
        return NextResponse.redirect(dashboardUrl);
    }

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
