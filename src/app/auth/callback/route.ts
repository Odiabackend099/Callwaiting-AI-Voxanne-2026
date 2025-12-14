import { createServerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');

    if (code) {
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

        await supabase.auth.exchangeCodeForSession(code);
    }

    // URL to redirect to after sign in process completes.
    // Handle the 'next' query param for redirects (e.g. to /update-password)
    const next = requestUrl.searchParams.get('next') || '/dashboard';
    
    // Use NEXT_PUBLIC_APP_URL for production domain, fallback to requestUrl.origin for dev
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || requestUrl.origin;
    const baseUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
    
    return NextResponse.redirect(baseUrl + next);
}
