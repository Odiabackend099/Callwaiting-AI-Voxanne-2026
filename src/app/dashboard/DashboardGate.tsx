'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useOrg } from '@/hooks/useOrg';

export default function DashboardGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, isVerified } = useAuth();
  const orgId = useOrg();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!isVerified) {
      const qs = user.email ? `?email=${encodeURIComponent(user.email)}` : '';
      router.push(`/verify-email${qs}`);
      return;
    }

    // If orgId is missing after auth resolves, force login to rehydrate session org context
    if (!orgId) {
      router.push('/login');
      return;
    }
  }, [loading, user, isVerified, orgId, router]);

  if (loading) return null;
  // Bypass auth for testing
  return <>{children}</>;
}
