'use client';

import { OrgErrorBoundary } from '@/components/OrgErrorBoundary';

/**
 * DashboardGate - Client-side error boundary wrapper
 *
 * SECURITY FIX: Removed all redirect logic
 * - Server-side auth is handled by dashboard/layout.tsx
 * - Client-side only wraps children in OrgErrorBoundary for user-friendly error messages
 * - NO redirects here - redirects happen server-side only
 * - This prevents infinite redirect loops
 */
export default function DashboardGate({ children }: { children: React.ReactNode }) {
  return (
    <OrgErrorBoundary>
      {children}
    </OrgErrorBoundary>
  );
}
