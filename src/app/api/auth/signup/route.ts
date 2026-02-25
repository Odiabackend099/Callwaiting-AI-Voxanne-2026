import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// --- Startup guard ---
// Fail loudly at boot time rather than silently at request time.
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('[api/auth/signup] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Admin client — module-level, stateless (no session, no token refresh).
// Uses service role key. Runs server-side ONLY — never exposed to the browser.
// Bypasses the Supabase project-level "Allow new users to sign up" restriction.
// The on_auth_user_created DB trigger automatically creates org + profile + JWT metadata.
const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// --- IP-based rate limiting (5 sign-ups per IP per 60 s) ---
// sessionStorage-based client-side guard is trivially bypassed by direct POST;
// this server-side window prevents spam account creation and Supabase quota exhaustion.
const ipWindows = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

// Clean up stale entries every 5 minutes to prevent unbounded Map growth.
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of ipWindows) {
        if (now > entry.resetAt) ipWindows.delete(key);
    }
}, 5 * 60_000);

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = ipWindows.get(ip);
    if (!entry || now > entry.resetAt) {
        ipWindows.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }
    entry.count += 1;
    return entry.count > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
    // --- Rate limit check ---
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: 'Too many sign-up attempts. Please try again in a minute.' },
            { status: 429 }
        );
    }

    try {
        // req.text() + JSON.parse for compatibility across HTTP clients and runtimes.
        const rawText = await req.text().catch(() => '');
        if (!rawText) {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }
        let parsed: unknown;
        try {
            parsed = JSON.parse(rawText);
        } catch {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }

        // --- Type-safe extraction (guards against non-string values like numbers/objects) ---
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
        }
        const p = parsed as Record<string, unknown>;
        const trimmedFirst = typeof p.firstName === 'string' ? p.firstName.trim() : '';
        const trimmedLast  = typeof p.lastName  === 'string' ? p.lastName.trim()  : '';
        const trimmedEmail = typeof p.email     === 'string' ? p.email.trim().toLowerCase() : '';
        const password     = typeof p.password  === 'string' ? p.password              : '';

        // --- Input validation ---
        if (!trimmedFirst || !trimmedLast || !trimmedEmail || !password) {
            return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
        }

        if (trimmedFirst.length > 50 || trimmedLast.length > 50) {
            return NextResponse.json(
                { error: 'Name must be 50 characters or fewer.' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'Password must be at least 8 characters.' },
                { status: 400 }
            );
        }

        if (password.length > 128) {
            return NextResponse.json(
                { error: 'Password must be 128 characters or fewer.' },
                { status: 400 }
            );
        }

        // --- Create user via admin API ---
        // email_confirm: true → user can sign in immediately (no verification email).
        // The on_auth_user_created trigger fires synchronously during this call:
        //   1. Creates public.organizations row
        //   2. Creates public.profiles row (role: 'owner')
        //   3. Writes org_id into auth.users.raw_app_meta_data (→ JWT app_metadata)
        const { data, error } = await adminClient.auth.admin.createUser({
            email: trimmedEmail,
            password,
            email_confirm: true,
            user_metadata: {
                first_name: trimmedFirst,
                last_name: trimmedLast,
                full_name: `${trimmedFirst} ${trimmedLast}`.trim(),
            },
        });

        if (error) {
            // status 422 = email already registered (Supabase's canonical signal).
            // String matching is omitted — it is fragile and changes across Supabase versions.
            if (error.status === 422) {
                // Return the provider so the client can tailor the error message
                // (e.g., "You signed up with Google" instead of a generic message).
                const existingProviders = await getExistingProviders(trimmedEmail);
                return NextResponse.json(
                    {
                        error: 'An account with this email already exists. Please sign in instead.',
                        provider: existingProviders,
                    },
                    { status: 409 }
                );
            }

            console.error('[api/auth/signup] admin.createUser failed:', {
                message: error.message,
                status: error.status,
            });
            return NextResponse.json(
                { error: 'Failed to create account. Please try again.' },
                { status: 500 }
            );
        }

        // 201 Created — a new user resource was created.
        // userId is intentionally omitted: the client doesn't use it and leaking
        // internal UUIDs in API responses is unnecessary.
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[api/auth/signup] Unexpected error:', message);
        return NextResponse.json(
            { error: 'An unexpected error occurred. Please try again.' },
            { status: 500 }
        );
    }
}

// Looks up the auth providers linked to an existing email so the client can
// display a specific "you signed up with Google" message instead of a generic one.
// Returns an empty array on any error (fail-open: the 409 is still returned).
async function getExistingProviders(email: string): Promise<string[]> {
    try {
        const { data } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const user = data?.users?.find((u) => u.email === email);
        return (user?.app_metadata?.providers as string[]) ?? [];
    } catch {
        return [];
    }
}
