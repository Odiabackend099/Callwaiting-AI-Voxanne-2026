'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function DashboardGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, isVerified } = useAuth();

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
  }, [loading, user, isVerified, router]);

  if (loading) return null;
  if (!user) return null;
  if (!isVerified) return null;

  return <>{children}</>;
}
