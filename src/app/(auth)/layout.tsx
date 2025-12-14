'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useAuth();

    // If user is already logged in, redirect to dashboard
    // BUT: Don't redirect if we're in the middle of auth callback
    useEffect(() => {
        if (!loading && user) {
            // Only redirect if not already on dashboard or in callback flow
            if (!pathname.includes('/dashboard') && !pathname.includes('/auth/callback')) {
                router.push('/dashboard');
            }
        }
    }, [user, loading, router, pathname]);

    return <>{children}</>;
}
