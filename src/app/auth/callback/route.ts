import { createServerClient } from '@supabase/ssr';
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
                        getAll() {
                            return cookieStore.getAll();
                        },
                        setAll(cookiesToSet) {
                            try {
                                cookiesToSet.forEach(({ name, value, options }) =>
                                    cookieStore.set(name, value, options)
                                );
                            } catch {
                                // setAll called from a Server Component context
                            }
                        },
                    },
                }
            );

            const { error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
                const safeError = (error.code || error.name || 'auth_failed')
                    .toString()
                    .toLowerCase()
                    .replace(/[^a-z0-9_\-]/g, '')
                    .slice(0, 40);

                const safeHint = (error.message || '')
                    .toString()
                    .toLowerCase()
                    .replace(/https?:\/\/[^\s]+/g, 'url')
                    .replace(/[^a-z0-9_\-\s]/g, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .slice(0, 60);

                if (process.env.NODE_ENV !== 'production') {
                    console.error('Session exchange error:', {
                        code: error.code,
                        name: error.name,
                        message: error.message,
                    });
                }

                const qs = safeHint ? `?error=${safeError}&hint=${safeHint}` : `?error=${safeError}`;
                return NextResponse.redirect(new URL(`/login${qs}`, requestUrl.origin));
            }
        } catch (err) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('Auth callback error:', err);
            }
            return NextResponse.redirect(new URL('/login?error=auth_error', requestUrl.origin));
        }
    }

    // In dev/local we must NOT force redirect to a production domain.
    const nodeEnv = process.env.NODE_ENV || 'development';
    const appUrl = nodeEnv === 'production'
        ? (process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin)
        : requestUrl.origin;

    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;

    // Ensure next param is safe (prevent open redirect)
    const safeNext = (next.startsWith('/') && !next.startsWith('//')) ? next : '/dashboard';

    return NextResponse.redirect(baseUrl + safeNext);
}
