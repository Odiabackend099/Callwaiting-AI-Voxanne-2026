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

    // Route redirects: old telephony URLs → unified phone-settings page
    if (pathname === '/dashboard/telephony' || pathname === '/dashboard/verified-caller-id') {
        const phoneSettingsUrl = new URL('/dashboard/phone-settings', req.url);
        return NextResponse.redirect(phoneSettingsUrl, 301); // Permanent redirect
    }

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

    // 7-day email verification grace period — redirect to /verify-email after grace expires
    // Only enforced once Supabase "Email confirmations" is enabled (email_confirmed_at will be null for unverified users).
    // With confirmations OFF, email_confirmed_at is always set immediately; this block becomes a no-op.
    if (user && pathname.startsWith('/dashboard')) {
        const emailConfirmedAt = (user as any).email_confirmed_at as string | null;
        if (!emailConfirmedAt) {
            const createdAt = new Date((user as any).created_at ?? Date.now());
            if (Date.now() - createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
                return NextResponse.redirect(new URL('/verify-email?expired=true', req.url));
            }
        }
    }

    // If authenticated and on /login or /sign-up, redirect to dashboard
    // Exception: if redirected to /login with ?error=no_org, let the user see the error
    // AND allow navigation from /login to /sign-up and vice versa when error exists
    // (otherwise they get an infinite loop: dashboard → login → dashboard → ...)
    const loginError = req.nextUrl.searchParams.get('error');
    const hasError = loginError !== null;
    if (user && (pathname === '/login' || pathname === '/sign-up') && !hasError) {
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
