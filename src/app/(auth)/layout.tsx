'use client';

/**
 * Auth Layout - Simple wrapper for auth pages
 *
 * SECURITY FIX: Removed all redirect logic
 * - NO redirect logic here - causes infinite loops with dashboard/layout.tsx
 * - Let users navigate freely between auth pages
 * - Dashboard access is gated server-side in dashboard/layout.tsx
 * - This prevents infinite redirect loops (auth → dashboard → auth)
 */
export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
